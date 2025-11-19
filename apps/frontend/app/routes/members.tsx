import * as React from "react";
import type { Route } from "./+types/members";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { cn } from "~/lib/utils";
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
const ROLE_COLUMNS: Membership["role"][] = ["owner", "admin", "people_ops", "manager", "employee"];

type AccessLevel = "all" | "team" | "own" | false;

const ACCESS_LABELS: Record<Exclude<AccessLevel, false>, { label: string; className: string }> = {
  all: { label: "Full", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200" },
  team: { label: "Team", className: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200" },
  own: { label: "Self", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200" },
};

const PERMISSION_MATRIX: Array<{
  category: string;
  permission: string;
  description: string;
  access: Record<Membership["role"], AccessLevel>;
}> = [
  {
    category: "Workspace",
    permission: "Manage members",
    description: "Invite, remove, and change workspace roles.",
    access: { owner: "all", admin: "all", people_ops: false, manager: false, employee: false },
  },
  {
    category: "Employees",
    permission: "View employee profiles",
    description: "Access the full employee directory.",
    access: { owner: "all", admin: "all", people_ops: "all", manager: "team", employee: "own" },
  },
  {
    category: "Employees",
    permission: "Edit employee records",
    description: "Create or update employee details.",
    access: { owner: "all", admin: "all", people_ops: "all", manager: "team", employee: false },
  },
  {
    category: "Employees",
    permission: "Manage compensation",
    description: "Edit salary and payroll settings.",
    access: { owner: "all", admin: "all", people_ops: false, manager: false, employee: false },
  },
  {
    category: "Employees",
    permission: "View compensation",
    description: "View salary and pay information.",
    access: { owner: "all", admin: "all", people_ops: "all", manager: false, employee: false },
  },
  {
    category: "Employees",
    permission: "View sensitive data",
    description: "Access bank, tax, and sensitive flags.",
    access: { owner: "all", admin: "all", people_ops: "all", manager: false, employee: false },
  },
  {
    category: "Time & Leave",
    permission: "Approve time/leave",
    description: "Approve timesheets, overtime, or leave.",
    access: { owner: "all", admin: "all", people_ops: "all", manager: "team", employee: false },
  },
  {
    category: "Org Structure",
    permission: "Manage departments & teams",
    description: "Create, update, or delete departments and teams.",
    access: { owner: "all", admin: "all", people_ops: "all", manager: false, employee: false },
  },
  {
    category: "Compliance",
    permission: "View audit log",
    description: "Review employee change history.",
    access: { owner: "all", admin: "all", people_ops: "all", manager: "team", employee: false },
  },
  {
    category: "Data",
    permission: "Import/export data",
    description: "Bulk import employees or export reports.",
    access: { owner: "all", admin: "all", people_ops: "all", manager: false, employee: false },
  },
];

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

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Role-based permissions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Owners and admins have full access by default. Managers can work with their own teams, while employees only see their
            own data.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Permission</th>
                  <th className="px-4 py-3 font-medium">Scope</th>
                  {ROLE_COLUMNS.map((role) => (
                    <th key={role} className="px-4 py-3 font-medium">
                      {ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MATRIX.map((row, index) => {
                  const prevCategory = PERMISSION_MATRIX[index - 1]?.category;
                  const showCategoryHeader = index === 0 || prevCategory !== row.category;
                  return (
                    <React.Fragment key={`${row.category}-${row.permission}`}>
                      {showCategoryHeader ? (
                        <tr className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                          <td colSpan={ROLE_COLUMNS.length + 2} className="px-4 py-2 font-semibold">
                            {row.category}
                          </td>
                        </tr>
                      ) : null}
                      <tr className="border-t border-border/40">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{row.permission}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{row.description}</td>
                        {ROLE_COLUMNS.map((role) => {
                          const value = row.access[role];
                          if (!value) {
                            return (
                              <td key={role} className="px-4 py-3 text-center text-muted-foreground">
                                —
                              </td>
                            );
                          }
                          const badge = ACCESS_LABELS[value];
                          return (
                            <td key={role} className="px-4 py-3 text-center">
                              <span
                                className={cn(
                                  "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold",
                                  badge.className,
                                )}
                              >
                                {badge.label}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>Full</strong> means tenant-wide access, <strong>Team</strong> applies to direct reports, and <strong>Self</strong>{" "}
            is limited to the user&apos;s own record.
          </p>
        </CardContent>
      </Card>

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
          <Select
            value={newMember.role}
            onValueChange={(value) =>
              setNewMember((m) => ({ ...m, role: value as Membership["role"] }))
            }
          >
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                  <Select
                    value={m.role}
                    onValueChange={(value) => {
                      const nextRole = value as Membership["role"];
                      if (nextRole === "owner") return;
                      void changeRole(m.user_id, nextRole);
                    }}
                  >
                    <SelectTrigger className="h-9 w-full px-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMBER_ROLE_OPTIONS.map((role) => (
                        <SelectItem
                          key={role}
                          value={role}
                          disabled={role === "owner" && m.role !== "owner"}
                        >
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
