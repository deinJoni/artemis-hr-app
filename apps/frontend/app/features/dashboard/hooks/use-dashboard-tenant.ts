import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import type { NavigateFunction } from "react-router";

import type { AccountBootstrapResponse } from "@vibe/shared";
import { supabase } from "~/lib/supabase";

type DashboardTenantState = {
  tenant: AccountBootstrapResponse["tenant"] | null;
  profile: AccountBootstrapResponse["profile"] | null;
  tenantLoading: boolean;
  tenantError: string | null;
};

type UseDashboardTenantArgs = {
  apiBaseUrl: string;
  navigate: NavigateFunction;
  session: Session | null;
};

export function useDashboardTenant({
  apiBaseUrl,
  navigate,
  session,
}: UseDashboardTenantArgs): DashboardTenantState {
  const [tenant, setTenant] = React.useState<DashboardTenantState["tenant"]>(null);
  const [profile, setProfile] = React.useState<DashboardTenantState["profile"]>(null);
  const [tenantLoading, setTenantLoading] = React.useState(true);
  const [tenantError, setTenantError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!session) return;
    const activeSession = session;

    let cancelled = false;

    async function fetchTenant() {
      setTenantLoading(true);
      setTenantError(null);
      try {
        const token = activeSession.access_token;
        if (!token) throw new Error("Missing access token");

        const response = await fetch(`${apiBaseUrl}/api/account/bootstrap`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });

        const payload = (await response
          .json()
          .catch(() => ({}))) as Partial<AccountBootstrapResponse>;

        if (!response.ok) {
          if (response.status === 401) {
            await supabase.auth.signOut();
            navigate("/login", { replace: true, state: { from: "/" } });
            return;
          }
          const message =
            (payload && typeof (payload as any).error === "string" && (payload as any).error) ||
            response.statusText ||
            "Unable to load workspace";
          throw new Error(message);
        }

        if (cancelled) return;

        const boot = payload as AccountBootstrapResponse;
        if (!boot?.tenant || !boot?.profile) {
          throw new Error("Unexpected response from the server");
        }

        if (!boot.tenant.setup_completed) {
          navigate("/onboarding", { replace: true });
          return;
        }

        setTenant(boot.tenant);
        setProfile(boot.profile);
      } catch (error: unknown) {
        if (!cancelled) {
          setTenantError(
            error instanceof Error ? error.message : "Unable to load workspace details",
          );
        }
      } finally {
        if (!cancelled) {
          setTenantLoading(false);
        }
      }
    }

    void fetchTenant();

    return () => {
      cancelled = true;
    };
  }, [session, apiBaseUrl, navigate]);

  return { tenant, profile, tenantLoading, tenantError };
}
