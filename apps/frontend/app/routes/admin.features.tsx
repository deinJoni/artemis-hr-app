import * as React from "react";
import type { Route } from "./+types/admin.features";
import {
  AdminFeaturesResponseSchema,
  TenantFeatureSummarySchema,
  type TenantFeatureSummary,
} from "@vibe/shared";

import { useApiContext } from "~/lib/api-context";
import { useFeatureFlags } from "~/lib/feature-flags";
import { useToast } from "~/components/toast";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Feature Flags | Artemis" },
    {
      name: "description",
      content: "Superadmin console for enabling or disabling Artemis feature groups per tenant.",
    },
  ];
}

export default function AdminFeaturesPage() {
  const { session, apiBaseUrl } = useApiContext();
  const { showToast } = useToast();
  const { isSuperadmin, tenantId: currentTenantId, refresh } = useFeatureFlags();
  const [tenants, setTenants] = React.useState<TenantFeatureSummary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [updatingKey, setUpdatingKey] = React.useState<string | null>(null);

  const loadTenants = React.useCallback(async () => {
    if (!session?.access_token || !isSuperadmin) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/features`, {
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

      const parsed = AdminFeaturesResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("Unexpected response while loading feature flags");
      }

      setTenants(parsed.data.tenants);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to load feature flags";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, isSuperadmin, session?.access_token]);

  React.useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  const handleToggle = React.useCallback(
    async (tenant: TenantFeatureSummary, slug: string, nextEnabled: boolean) => {
      if (!session?.access_token) return;
      const opKey = `${tenant.tenant_id}:${slug}`;
      setUpdatingKey(opKey);

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/admin/features/${tenant.tenant_id}/${slug}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              enabled: nextEnabled,
              reason: nextEnabled ? "Enabled via superadmin console" : "Disabled via superadmin console",
            }),
          }
        );
        const payload = await response
          .json()
          .catch(() => ({} as Record<string, unknown>));
        if (!response.ok) {
          const message =
            (typeof payload.error === "string" && payload.error) ||
            response.statusText ||
            "Unable to update feature";
          throw new Error(message);
        }

        const parsed = TenantFeatureSummarySchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error("Unexpected response while updating feature flag");
        }

        setTenants((prev) =>
          prev.map((item) => (item.tenant_id === parsed.data.tenant_id ? parsed.data : item))
        );

        if (currentTenantId && currentTenantId === parsed.data.tenant_id) {
          await refresh().catch(() => {});
        }

        showToast(
          `${parsed.data.features.find((f) => f.slug === slug)?.name ?? "Feature"} ${
            nextEnabled ? "enabled" : "disabled"
          } for ${tenant.tenant_name}`,
          "success"
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unable to update feature flag";
        showToast(message, "error");
      } finally {
        setUpdatingKey(null);
      }
    },
    [apiBaseUrl, currentTenantId, refresh, session?.access_token, showToast]
  );

  const filteredTenants = React.useMemo(() => {
    if (!query.trim()) return tenants;
    const q = query.trim().toLowerCase();
    return tenants.filter(
      (tenant) =>
        tenant.tenant_name.toLowerCase().includes(q) ||
        tenant.tenant_id.toLowerCase().includes(q)
    );
  }, [tenants, query]);

  if (!isSuperadmin) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <h1 className="text-2xl font-semibold">Feature Flags</h1>
            <p className="text-sm text-muted-foreground">
              You need superadmin privileges to manage feature flags across tenants.
            </p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Feature Flags</h1>
          <p className="text-sm text-muted-foreground">
            Enable or disable feature groups per tenant. Changes apply instantly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadTenants()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search tenants..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="max-w-sm"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      {filteredTenants.length === 0 && !loading ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No tenants found. Adjust your search or refresh the list.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {filteredTenants.map((tenant) => (
          <Card key={tenant.tenant_id}>
            <CardHeader className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{tenant.tenant_name}</h2>
                <p className="text-xs text-muted-foreground">{tenant.tenant_id}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">
                  {tenant.features.filter((feature) => feature.source === "tenant_override").length}{" "}
                  overrides
                </Badge>
                <Badge variant="outline">
                  {tenant.features.filter((feature) => feature.enabled).length} enabled
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {tenant.features.map((feature) => {
                const key = `${tenant.tenant_id}:${feature.slug}`;
                const isUpdating = updatingKey === key;
                const nextEnabled = !feature.enabled;

                return (
                  <div
                    key={feature.slug}
                    className="flex flex-col gap-3 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{feature.name}</p>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <Badge variant={feature.enabled ? "default" : "secondary"}>
                          {feature.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                        <Badge variant="outline">
                          {feature.source === "tenant_override" ? "Override" : "Default"}
                        </Badge>
                        {feature.default_enabled ? (
                          <Badge variant="outline">Default: On</Badge>
                        ) : (
                          <Badge variant="outline">Default: Off</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Separator orientation="vertical" className="hidden h-10 sm:block" />
                      <button
                        type="button"
                        onClick={() => handleToggle(tenant, feature.slug, nextEnabled)}
                        disabled={isUpdating}
                        className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted transition-colors data-[state=checked]:bg-primary disabled:opacity-60"
                        data-state={feature.enabled ? "checked" : "unchecked"}
                        aria-pressed={feature.enabled}
                        aria-label={`Toggle ${feature.name}`}
                      >
                        <span
                          className="inline-block h-5 w-5 rounded-full bg-background shadow transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-1"
                          data-state={feature.enabled ? "checked" : "unchecked"}
                        />
                      </button>
                      <div className="text-xs text-muted-foreground">
                        {isUpdating ? "Saving..." : feature.enabled ? "On" : "Off"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

