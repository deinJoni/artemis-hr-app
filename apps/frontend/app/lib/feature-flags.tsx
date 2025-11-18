import * as React from "react";
import {
  TenantFeatureFlagsResponseSchema,
  type TenantFeatureFlag,
} from "@vibe/shared";

import { useApiContext } from "./api-context";

type FeatureFlagContextValue = {
  features: TenantFeatureFlag[];
  featureMap: Record<string, TenantFeatureFlag>;
  isSuperadmin: boolean;
  tenantId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const FeatureFlagContext = React.createContext<FeatureFlagContextValue | null>(
  null
);

type FeatureFlagProviderProps = {
  tenantId: string | null;
  initialFeatures?: TenantFeatureFlag[];
  isSuperadmin?: boolean;
  children: React.ReactNode;
};

export function FeatureFlagProvider({
  tenantId,
  initialFeatures,
  isSuperadmin = false,
  children,
}: FeatureFlagProviderProps) {
  const { apiBaseUrl, session } = useApiContext();
  const [features, setFeatures] = React.useState<TenantFeatureFlag[]>(
    initialFeatures ?? []
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setFeatures(initialFeatures ?? []);
  }, [tenantId, initialFeatures]);

  const refresh = React.useCallback(async () => {
    if (!tenantId || !session?.access_token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/features`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = await response
        .json()
        .catch(() => ({} as Record<string, unknown>));

      if (!response.ok) {
        const message =
          (typeof payload.error === "string" && payload.error) ||
          response.statusText ||
          "Unable to load feature flags";
        throw new Error(message);
      }

      const parsed = TenantFeatureFlagsResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("Unexpected response while loading feature flags");
      }

      setFeatures(parsed.data.features);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to load feature flags";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, session?.access_token, tenantId]);

  const featureMap = React.useMemo(() => {
    return features.reduce<Record<string, TenantFeatureFlag>>((acc, feature) => {
      acc[feature.slug] = feature;
      return acc;
    }, {});
  }, [features]);

  const value = React.useMemo<FeatureFlagContextValue>(
    () => ({
      features,
      featureMap,
      isSuperadmin: Boolean(isSuperadmin),
      tenantId,
      loading,
      error,
      refresh,
    }),
    [features, featureMap, isSuperadmin, loading, error, refresh, tenantId]
  );

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = React.useContext(FeatureFlagContext);
  if (!context) {
    throw new Error("useFeatureFlags must be used within FeatureFlagProvider");
  }
  return context;
}

export function useFeatureFlag(slug: string, fallback = false) {
  const { featureMap } = useFeatureFlags();
  return featureMap[slug]?.enabled ?? fallback;
}

export function useFeatureGroup(groupKey: string) {
  const { features } = useFeatureFlags();
  return React.useMemo(
    () => features.filter((feature) => feature.group_key === groupKey),
    [features, groupKey]
  );
}

