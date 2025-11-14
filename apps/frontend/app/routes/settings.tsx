import * as React from "react";
import type { Route } from "./+types/settings";
import { Button } from "~/components/ui/button";
import { supabase } from "~/lib/supabase";
import { TenantSchema, TenantUpdateInputSchema, type Tenant } from "@vibe/shared";
import { useEmployeeFieldDefs } from "~/hooks/use-employee-field-defs";

export async function loader() {
  const baseUrl =
    (import.meta as any).env?.VITE_BACKEND_URL ??
    (typeof process !== "undefined"
      ? ((process.env?.VITE_BACKEND_URL as string | undefined) ?? undefined)
      : undefined) ??
    "http://localhost:8787";

  return { baseUrl };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Settings | Artemis" },
    { name: "description", content: "Manage your Artemis workspace settings." },
  ];
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);

  const [tenant, setTenant] = React.useState<Tenant | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [tenantId, setTenantId] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    company_name: "",
    company_size: "",
    language: "",
  });
  const [adminUser, setAdminUser] = React.useState<{ name: string; email: string | null } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function fetchTenant() {
      setLoading(true);
      setError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Missing access token");
        const response = await fetch(`${apiBaseUrl}/api/tenants/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        const parsed = TenantSchema.safeParse(payload);
        if (!response.ok || !parsed.success) throw new Error("Unable to load tenant");
        if (cancelled) return;
        setTenant(parsed.data);
        setTenantId(parsed.data.id);
        setForm({
          company_name: parsed.data.company_name ?? "",
          company_size: parsed.data.company_size ?? "",
          language: parsed.data.language ?? "",
        });
        
        // Fetch admin/owner user info
        const currentUser = sessionData.session?.user;
        if (currentUser) {
          setAdminUser({
            name: currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0] || 'Admin',
            email: currentUser.email || null,
          });
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Unable to load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchTenant();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  // Employee field defs management (permission gate handled server-side via 403)
  const { fieldDefs, loading: defsLoading, error: defsError, create: createDef, remove: removeDef, creating, removingId } = useEmployeeFieldDefs({ apiBaseUrl, tenantId });
  const [newField, setNewField] = React.useState<{
    name: string;
    key: string;
    type: "text" | "number" | "date" | "select" | "boolean";
    required: boolean;
    choices: string;
  }>({ name: "", key: "", type: "text", required: false, choices: "" });

  const handleCreateField = React.useCallback(async () => {
    if (!tenantId) return;
    const options = newField.type === "select" ? { choices: newField.choices.split(",").map((s) => s.trim()).filter(Boolean) } : undefined;
    await createDef({ tenant_id: tenantId, name: newField.name, key: newField.key, type: newField.type, required: newField.required, options });
    setNewField({ name: "", key: "", type: "text", required: false, choices: "" });
  }, [createDef, newField.choices, newField.key, newField.name, newField.required, newField.type, tenantId]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenant) return;
    setSaving(true);
    setError(null);
    try {
      const payload = TenantUpdateInputSchema.parse({
        company_name: form.company_name || null,
        company_size: form.company_size || null,
        language: form.language || null,
      });
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Missing access token");
      const response = await fetch(`${apiBaseUrl}/api/tenants/${tenant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      const parsed = TenantSchema.safeParse(json);
      if (!response.ok || !parsed.success) throw new Error("Unable to save settings");
      setTenant(parsed.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20 text-sm text-muted-foreground">
        Loading settings...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Workspace settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">Update basic company information.</p>
      </div>

      {/* Admin User Info Section */}
      {adminUser && (
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <h2 className="text-lg font-semibold mb-2">Admin User</h2>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span>{" "}
              <span className="font-medium">{adminUser.name}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Email:</span>{" "}
              <span className="font-medium">{adminUser.email || "–"}</span>
            </p>
          </div>
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSave}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-left">
            <span className="text-sm font-medium">Company name</span>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Acme Labs"
            />
          </label>
          <label className="space-y-1 text-left">
            <span className="text-sm font-medium">Company size</span>
            <select
              value={form.company_size}
              onChange={(e) => setForm((f) => ({ ...f, company_size: e.target.value }))}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select size...</option>
              <option value="1-10">1-10</option>
              <option value="11-25">11-25</option>
              <option value="26-100">26-100</option>
              <option value="101-500">101-500</option>
              <option value="501-1000">501-1000</option>
              <option value="> 1000">&gt; 1000</option>
            </select>
          </label>
        </div>

        <label className="space-y-1 text-left">
          <span className="text-sm font-medium">Language</span>
          <select
            value={form.language}
            onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select language...</option>
            <option value="German">German</option>
            <option value="English">English</option>
          </select>
        </label>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>

      {/* Manage Employee Fields (visible only if server allows read/manage; 403 results in empty list silently) */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Employee fields</h2>
        {defsError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{defsError}</div>
        ) : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Name</span>
            <input
              type="text"
              value={newField.name}
              onChange={(e) => setNewField((f) => ({ ...f, name: e.target.value }))}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              disabled={!tenantId || creating}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Key</span>
            <input
              type="text"
              value={newField.key}
              onChange={(e) => setNewField((f) => ({ ...f, key: e.target.value }))}
              placeholder="e.g. start_date"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              disabled={!tenantId || creating}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Type</span>
            <select
              value={newField.type}
              onChange={(e) => setNewField((f) => ({ ...f, type: e.target.value as any }))}
              className="h-10 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              disabled={!tenantId || creating}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Select</option>
              <option value="boolean">Boolean</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newField.required}
              onChange={(e) => setNewField((f) => ({ ...f, required: e.target.checked }))}
              disabled={!tenantId || creating}
            />
            <span className="text-sm">Required</span>
          </label>
          {newField.type === "select" ? (
            <label className="col-span-full flex flex-col gap-1">
              <span className="text-sm font-medium">Choices (comma-separated)</span>
              <input
                type="text"
                value={newField.choices}
                onChange={(e) => setNewField((f) => ({ ...f, choices: e.target.value }))}
                placeholder="e.g. HR,Marketing,Sales"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                disabled={!tenantId || creating}
              />
            </label>
          ) : null}
        </div>
        <div>
          <Button type="button" onClick={() => void handleCreateField()} disabled={!tenantId || creating || !newField.name || !newField.key}>
            {creating ? "Creating..." : "Add Field"}
          </Button>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Existing Fields</h3>
          <ul className="mt-2 divide-y rounded-md border">
            {defsLoading ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Loading…</li>
            ) : fieldDefs.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No fields yet or you don't have permission.</li>
            ) : (
              fieldDefs.map((def) => (
                <li key={def.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>
                    {def.name} <span className="text-muted-foreground">({def.key} · {def.type})</span>
                  </span>
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => void removeDef(def.id)} disabled={removingId === def.id}>
                    Delete
                  </Button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

