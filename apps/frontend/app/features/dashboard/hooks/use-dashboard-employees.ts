import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import type { NavigateFunction } from "react-router";

import type { Employee, EmployeeListResponse } from "@vibe/shared";
import { supabase } from "~/lib/supabase";

type UseDashboardEmployeesArgs = {
  apiBaseUrl: string;
  navigate: NavigateFunction;
  session: Session | null;
  tenantId: string | undefined;
};

type UseDashboardEmployeesResult = {
  employees: Employee[] | null;
  dataError: string | null;
  setDataError: React.Dispatch<React.SetStateAction<string | null>>;
};

export function useDashboardEmployees({
  apiBaseUrl,
  navigate,
  session,
  tenantId,
}: UseDashboardEmployeesArgs): UseDashboardEmployeesResult {
  const [employees, setEmployees] = React.useState<Employee[] | null>(null);
  const [dataError, setDataError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!session || !tenantId) return;

    const headers = { Authorization: `Bearer ${session.access_token}` } as const;
    let cancelled = false;

    async function loadEmployees() {
      setDataError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/api/employees/${tenantId}`, {
          headers,
        });

        if (!response.ok) {
          if (response.status === 401) {
            await supabase.auth.signOut();
            navigate("/login", { replace: true, state: { from: "/" } });
            return;
          }
          throw new Error("Unable to load employees");
        }

        const payload = (await response.json()) as EmployeeListResponse;
        if (!cancelled) {
          setEmployees(payload.employees ?? []);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setEmployees([]);
          setDataError(error instanceof Error ? error.message : "Unable to load workspace data");
        }
      }
    }

    void loadEmployees();

    return () => {
      cancelled = true;
    };
  }, [session, tenantId, apiBaseUrl, navigate]);

  return { employees, dataError, setDataError };
}
