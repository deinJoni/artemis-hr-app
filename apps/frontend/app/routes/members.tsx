import * as React from "react";
import type { Route } from "./+types/members";
import { Button } from "~/components/ui/button";
import { supabase } from "~/lib/supabase";
import {
  MembershipListResponseSchema,
  MembershipCreateInputSchema,
  MembershipUpdateInputSchema,
  type MembershipListItem,
  type Membership,
} from "@vibe/shared";

const ROLE_LABELS: Record<Membership["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  people_ops: "People Ops",
  employee: "Employee",
};

const ASSIGNABLE_ROLES: Membership["role"][] = ["employee", "manager", "people_ops", "admin"];
const MEMBER_ROLE_OPTIONS: Membership["role"][] = ["owner", "admin", "people_ops", "manager", "employee"];

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
    { title: "Members | Artemis" },
    { name: "description", content: "Manage your workspace members and roles." },
  ];
}

export default function Members({ loaderData }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);

  const [tenantId, setTenantId] = React.useState<string | null>(null);
  const [members, setMembers] = React.useState<MembershipListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState(false);

  const [newMember, setNewMember] = React.useState<{ user_id: string; role: Membership["role"] }>({
    user_id: "",
    role: "employee",
  });

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Missing access token");
        // Determine tenant via /api/tenants/me
        const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const tenantJson = await tenantRes.json();
        if (!tenantRes.ok || typeof tenantJson?.id !== "string") throw new Error("Unable to resolve tenant");
        const id = tenantJson.id as string;
        if (cancelled) return;
        setTenantId(id);

        const res = await fetch(`${apiBaseUrl}/api/memberships/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const parsed = MembershipListResponseSchema.safeParse(json);
        if (!res.ok || !parsed.success) throw new Error("Unable to load members");
        if (cancelled) return;
        setMembers(parsed.data.members);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Unable to load members");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  async function refresh() {
    if (!tenantId) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const res = await fetch(`${apiBaseUrl}/api/memberships/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const parsed = MembershipListResponseSchema.safeParse(json);
      if (res.ok && parsed.success) {
        setMembers(parsed.data.members);
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Unable to refresh members");
    }
  }

  async function addMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!tenantId) return;
    setWorking(true);
    setError(null);
    try {
      const payload = MembershipCreateInputSchema.parse({
        user_id: newMember.user_id,
        role: newMember.role,
      });
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Missing access token");
      const res = await fetch(`${apiBaseUrl}/api/memberships/${tenantId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Unable to add member");
      setNewMember({ user_id: "", role: "employee" });
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to add member");
    } finally {
      setWorking(false);
    }
  }

  async function changeRole(userId: string, role: Membership["role"]) {
    if (!tenantId) return;
    setWorking(true);
    setError(null);
    try {
      const payload = MembershipUpdateInputSchema.parse({ role });
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Missing access token");
      const res = await fetch(`${apiBaseUrl}/api/memberships/${tenantId}/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Unable to update role");
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to update role");
    } finally {
      setWorking(false);
    }
  }

  async function removeMember(userId: string) {
    if (!tenantId) return;
    setWorking(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Missing access token");
      const res = await fetch(`${apiBaseUrl}/api/memberships/${tenantId}/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Unable to remove member");
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to remove member");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20 text-sm text-muted-foreground">
        Loading members...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Members</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage who has access to your Artemis workspace.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <form className="flex flex-wrap items-end gap-3" onSubmit={addMember}>
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-left">
          <span className="text-sm font-medium">User ID</span>
          <input
            type="text"
            value={newMember.user_id}
            onChange={(e) => setNewMember((m) => ({ ...m, user_id: e.target.value }))}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="UUID of an existing user"
            required
          />
        </label>
        <label className="flex w-40 flex-col gap-1 text-left">
          <span className="text-sm font-medium">Role</span>
          <select
            value={newMember.role}
            onChange={(e) =>
              setNewMember((m) => ({ ...m, role: e.target.value as Membership["role"] }))
            }
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={working}>
          {working ? "Working..." : "Add member"}
        </Button>
      </form>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={`${m.tenant_id}:${m.user_id}`} className="border-t">
                <td className="px-4 py-2">{m.email ?? m.user_id}</td>
                <td className="px-4 py-2">
                  <select
                    value={m.role}
                    onChange={(e) => {
                      const nextRole = e.target.value as Membership["role"];
                      if (nextRole === "owner") return;
                      void changeRole(m.user_id, nextRole);
                    }}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    {MEMBER_ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role} disabled={role === "owner"}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeMember(m.user_id)}
                    disabled={working}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
