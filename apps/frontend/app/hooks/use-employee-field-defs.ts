import * as React from "react";
import {
  EmployeeCustomFieldDefCreateSchema,
  type EmployeeCustomFieldDef,
  type EmployeeCustomFieldDefCreate,
} from "@vibe/shared";
import { supabase } from "~/lib/supabase";

type UseEmployeeFieldDefsOptions = {
  apiBaseUrl: string;
  tenantId: string | null;
};

type UseEmployeeFieldDefsResult = {
  fieldDefs: EmployeeCustomFieldDef[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: EmployeeCustomFieldDefCreate) => Promise<void>;
  remove: (id: string) => Promise<void>;
  updating: boolean;
  creating: boolean;
  removingId: string | null;
};

export function useEmployeeFieldDefs({ apiBaseUrl, tenantId }: UseEmployeeFieldDefsOptions): UseEmployeeFieldDefsResult {
  const [fieldDefs, setFieldDefs] = React.useState<EmployeeCustomFieldDef[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [updating] = React.useState(false); // reserved for v2 (edit)
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fetchIdRef = React.useRef(0);

  const load = React.useCallback(async () => {
    if (!tenantId) return;
    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Missing access token");
      const res = await fetch(`${apiBaseUrl}/api/employee-fields/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        if (res.status === 403) {
          // No permission -> silently empty
          if (fetchId === fetchIdRef.current) setFieldDefs([]);
          return;
        }
        const message = json && typeof json === "object" && typeof json.error === "string"
          ? json.error
          : `Request failed (${res.status})`;
        if (fetchId === fetchIdRef.current) setError(message);
        return;
      }

      if (typeof json !== "object" || json === null || !Array.isArray(json.fields)) {
        if (fetchId === fetchIdRef.current) setError("Malformed response");
        return;
      }
      if (fetchId !== fetchIdRef.current) return;
      setFieldDefs((json.fields ?? []) as EmployeeCustomFieldDef[]);
    } catch (e: unknown) {
      if (fetchId !== fetchIdRef.current) return;
      setError(e instanceof Error ? e.message : "Unable to load fields");
      setFieldDefs([]);
    } finally {
      if (fetchId === fetchIdRef.current) setLoading(false);
    }
  }, [apiBaseUrl, tenantId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const refresh = React.useCallback(async () => {
    await load();
  }, [load]);

  const create = React.useCallback(
    async (input: EmployeeCustomFieldDefCreate) => {
      if (!tenantId) return;
      setCreating(true);
      setError(null);
      const parsed = EmployeeCustomFieldDefCreateSchema.safeParse(input);
      if (!parsed.success) {
        setCreating(false);
        throw new Error("Invalid field definition");
      }
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Missing access token");
        const res = await fetch(`${apiBaseUrl}/api/employee-fields/${tenantId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(parsed.data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(typeof err?.error === "string" ? err.error : "Unable to create field");
        }
        await load();
      } finally {
        setCreating(false);
      }
    },
    [apiBaseUrl, load, tenantId]
  );

  const remove = React.useCallback(
    async (id: string) => {
      if (!tenantId) return;
      setRemovingId(id);
      setError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Missing access token");
        const res = await fetch(`${apiBaseUrl}/api/employee-fields/${tenantId}/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(typeof err?.error === "string" ? err.error : "Unable to delete field");
        }
        await load();
      } finally {
        setRemovingId((cur) => (cur === id ? null : cur));
      }
    },
    [apiBaseUrl, load, tenantId]
  );

  return { fieldDefs, loading, error, refresh, create, remove, updating, creating, removingId };
}

