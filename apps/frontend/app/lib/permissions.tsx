import * as React from "react";

import { useApiContext } from "./api-context";

type PermissionHookOptions = {
  tenantId?: string | null;
  skip?: boolean;
};

type PermissionState = {
  allowed: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<boolean>;
};

type PermissionsState = {
  permissions: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  hasAll: boolean;
  hasAny: boolean;
  refresh: () => Promise<Record<string, boolean>>;
};

const permissionCache = new Map<string, boolean>();
const inflightRequests = new Map<string, Promise<boolean>>();

const buildCacheKey = (tenantId: string, permission: string) =>
  `${tenantId}::${permission}`;

async function requestPermission({
  apiBaseUrl,
  token,
  tenantId,
  permission,
  force = false,
}: {
  apiBaseUrl: string;
  token: string;
  tenantId: string;
  permission: string;
  force?: boolean;
}): Promise<boolean> {
  const cacheKey = buildCacheKey(tenantId, permission);

  if (!force) {
    if (permissionCache.has(cacheKey)) {
      return permissionCache.get(cacheKey)!;
    }
    const inflight = inflightRequests.get(cacheKey);
    if (inflight) {
      return inflight;
    }
  } else {
    permissionCache.delete(cacheKey);
  }

  const fetchPromise = (async () => {
    const response = await fetch(
      `${apiBaseUrl}/api/permissions/${tenantId}?permission=${encodeURIComponent(permission)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const payload = await response
      .json()
      .catch(() => ({ allowed: false }) as { allowed?: boolean });

    if (!response.ok) {
      const message =
        (typeof payload.error === "string" && payload.error) ||
        response.statusText ||
        "Unable to verify permission";
      throw new Error(message);
    }

    const allowed = Boolean(payload.allowed);
    permissionCache.set(cacheKey, allowed);
    return allowed;
  })();

  inflightRequests.set(cacheKey, fetchPromise);

  try {
    const result = await fetchPromise;
    return result;
  } finally {
    inflightRequests.delete(cacheKey);
  }
}

export function usePermission(
  permission: string,
  options: PermissionHookOptions = {}
): PermissionState {
  const { apiBaseUrl, session } = useApiContext();
  const tenantId = options.tenantId ?? null;
  const skip = options.skip ?? false;
  const accessToken = session?.access_token ?? null;

  const cacheKey =
    tenantId && permission ? buildCacheKey(tenantId, permission) : null;

  const [internalState, setInternalState] = React.useState<{
    allowed: boolean;
    loading: boolean;
    error: string | null;
  }>({
    allowed: false,
    loading: !skip && Boolean(permission),
    error: null,
  });

  const fetchPermission = React.useCallback(
    async (force = false) => {
      if (skip || !permission) {
        setInternalState((prev) => ({ ...prev, loading: false }));
        return false;
      }
      if (!tenantId || !accessToken || !apiBaseUrl) {
        const error = "Missing tenant or session";
        setInternalState((prev) => ({
          ...prev,
          loading: false,
          error,
        }));
        return false;
      }

      try {
        if (!force && cacheKey && permissionCache.has(cacheKey)) {
          const cached = permissionCache.get(cacheKey) ?? false;
          setInternalState({
            allowed: cached,
            loading: false,
            error: null,
          });
          return cached;
        }

        setInternalState((prev) => ({ ...prev, loading: true, error: null }));
        const allowed = await requestPermission({
          apiBaseUrl,
          token: accessToken,
          tenantId,
          permission,
          force,
        });
        setInternalState((prev) => ({
          ...prev,
          allowed,
          loading: false,
          error: null,
        }));
        return allowed;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to verify permission";
        setInternalState((prev) => ({
          ...prev,
          loading: false,
          error: message,
        }));
        return false;
      }
    },
    [accessToken, apiBaseUrl, cacheKey, permission, skip, tenantId]
  );

  React.useEffect(() => {
    let cancelled = false;
    if (skip || !permission) {
      setInternalState((prev) => ({ ...prev, loading: false }));
      return;
    }

    (async () => {
      const allowed = await fetchPermission(false);
      if (!cancelled) {
        setInternalState((prev) => ({
          ...prev,
          allowed,
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchPermission, permission, skip]);

  const refresh = React.useCallback(async () => {
    if (!cacheKey) return false;
    permissionCache.delete(cacheKey);
    return fetchPermission(true);
  }, [cacheKey, fetchPermission]);

  return {
    allowed: internalState.allowed,
    loading: internalState.loading,
    error: internalState.error,
    refresh,
  };
}

export function usePermissions(
  permissions: string[],
  options: PermissionHookOptions = {}
): PermissionsState {
  const uniquePermissions = React.useMemo(
    () => Array.from(new Set(permissions.filter(Boolean))),
    [permissions]
  );

  const { apiBaseUrl, session } = useApiContext();
  const tenantId = options.tenantId ?? null;
  const skip = options.skip ?? false;
  const accessToken = session?.access_token ?? null;

  const [permissionMap, setPermissionMap] = React.useState<Record<string, boolean>>(
    () =>
      uniquePermissions.reduce<Record<string, boolean>>((acc, perm) => {
        acc[perm] = false;
        return acc;
      }, {})
  );
  const [loading, setLoading] = React.useState(
    !skip && uniquePermissions.length > 0
  );
  const [error, setError] = React.useState<string | null>(null);

  const fetchAll = React.useCallback(
    async (force = false) => {
      if (skip || uniquePermissions.length === 0) {
        setLoading(false);
        return {};
      }

      if (!tenantId || !accessToken || !apiBaseUrl) {
        const message = "Missing tenant or session";
        setError(message);
        setLoading(false);
        return {};
      }

      setLoading(true);
      setError(null);

      try {
        const results = await Promise.all(
          uniquePermissions.map(async (perm) => {
            const allowed = await requestPermission({
              apiBaseUrl,
              token: accessToken,
              tenantId,
              permission: perm,
              force,
            });
            return { permission: perm, allowed };
          })
        );

        const next = results.reduce<Record<string, boolean>>((acc, result) => {
          acc[result.permission] = result.allowed;
          return acc;
        }, {});

        setPermissionMap(next);
        setLoading(false);
        return next;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to verify permissions";
        setError(message);
        setLoading(false);
        return {};
      }
    },
    [
      accessToken,
      apiBaseUrl,
      skip,
      tenantId,
      uniquePermissions,
    ]
  );

  React.useEffect(() => {
    if (uniquePermissions.length === 0) {
      setLoading(false);
      setPermissionMap({});
      return;
    }
    void fetchAll(false);
  }, [fetchAll, uniquePermissions.length]);

  const refresh = React.useCallback(async () => {
    if (!tenantId) return {};
    uniquePermissions.forEach((perm) =>
      permissionCache.delete(buildCacheKey(tenantId, perm))
    );
    return fetchAll(true);
  }, [fetchAll, tenantId, uniquePermissions]);

  const hasAll = React.useMemo(() => {
    if (uniquePermissions.length === 0) return true;
    return uniquePermissions.every((perm) => permissionMap[perm]);
  }, [permissionMap, uniquePermissions]);

  const hasAny = React.useMemo(() => {
    if (uniquePermissions.length === 0) return true;
    return uniquePermissions.some((perm) => permissionMap[perm]);
  }, [permissionMap, uniquePermissions]);

  return {
    permissions: permissionMap,
    loading,
    error,
    hasAll,
    hasAny,
    refresh,
  };
}

type PermissionGateProps = {
  permission: string | string[];
  tenantId?: string | null;
  requireAll?: boolean;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
  children: React.ReactNode;
  skip?: boolean;
};

export function PermissionGate({
  permission,
  tenantId,
  requireAll = true,
  fallback = null,
  loadingFallback = null,
  children,
  skip = false,
}: PermissionGateProps) {
  if (Array.isArray(permission)) {
    const result = usePermissions(permission, { tenantId, skip });
    if (result.loading) {
      return <>{loadingFallback}</>;
    }
    if (result.error) {
      return <>{fallback}</>;
    }
    const isAllowed = requireAll ? result.hasAll : result.hasAny;
    return <>{isAllowed ? children : fallback}</>;
  }

  const result = usePermission(permission, { tenantId, skip });
  if (result.loading) {
    return <>{loadingFallback}</>;
  }
  if (result.error) {
    return <>{fallback}</>;
  }
  return <>{result.allowed ? children : fallback}</>;
}

