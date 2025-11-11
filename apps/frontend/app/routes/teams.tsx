import * as React from "react";
import { 
  Plus, 
  Users, 
  Edit, 
  Trash2, 
  Loader2,
  RefreshCw,
  Search,
  UserPlus,
  UserMinus,
  Building2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { supabase } from "~/lib/supabase";
import { cn } from "~/lib/utils";
import {
  TeamListResponseSchema,
  TeamWithMembersSchema,
  type TeamWithMembers,
  type Employee,
} from "@vibe/shared";

type TeamState = {
  status: "idle" | "loading" | "ready" | "error";
  teams: TeamWithMembers[];
  error: string | null;
};

export async function loader() {
  const baseUrl =
    (import.meta as any).env?.VITE_BACKEND_URL ??
    (typeof process !== "undefined"
      ? ((process.env?.VITE_BACKEND_URL as string | undefined) ?? undefined)
      : undefined) ??
    "http://localhost:8787";
  return { baseUrl };
}

export function meta() {
  return [
    { title: "Teams | Artemis" },
    { name: "description", content: "Manage teams and team members" },
  ];
}

export default function Teams({ loaderData }: { loaderData?: { baseUrl?: string } }) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);

  const [state, setState] = React.useState<TeamState>({ 
    status: "idle", 
    teams: [], 
    error: null 
  });
  const [searchTerm, setSearchTerm] = React.useState("");
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("");
  const [editingTeam, setEditingTeam] = React.useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = React.useState<string | null>(null);
  const [teamDetail, setTeamDetail] = React.useState<TeamWithMembers | null>(null);
  const [editForm, setEditForm] = React.useState<{ 
    name: string; 
    description: string;
    teamLeadId: string;
    departmentId: string;
  }>({
    name: "",
    description: "",
    teamLeadId: "",
    departmentId: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [departments, setDepartments] = React.useState<Array<{ id: string; name: string }>>([]);
  const [employees, setEmployees] = React.useState<Array<{ id: string; name: string }>>([]);
  const [addingMembers, setAddingMembers] = React.useState(false);
  const [selectedEmployees, setSelectedEmployees] = React.useState<Set<string>>(new Set());

  const loadTeams = React.useCallback(async () => {
    setState(prev => ({ ...prev, status: "loading" }));
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      if (!token) throw new Error("Missing access token");

      const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tenantJson = (await tenantRes.json()) as { id?: string; error?: string };
      if (!tenantRes.ok || typeof tenantJson.id !== "string") {
        throw new Error(tenantJson.error || "Unable to resolve tenant");
      }

      const teamsRes = await fetch(`${apiBaseUrl}/api/teams/${tenantJson.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const teamsJson = await teamsRes.json();
      if (!teamsRes.ok) {
        throw new Error(teamsJson.error || "Unable to load teams");
      }

      const teamsParsed = TeamListResponseSchema.safeParse(teamsJson);
      if (!teamsParsed.success) {
        throw new Error("Unexpected teams response shape");
      }

      setState({
        status: "ready",
        teams: teamsParsed.data.teams || [],
        error: null,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to load teams";
      setState(prev => ({
        ...prev,
        status: "error",
        error: message,
      }));
    }
  }, [apiBaseUrl]);

  // Load departments and employees for dropdowns
  React.useEffect(() => {
    if (!apiBaseUrl) return;
    
    let cancelled = false;
    async function loadDropdowns() {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");

        const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const tenantJson = (await tenantRes.json()) as { id?: string; error?: string };
        if (!tenantRes.ok || typeof tenantJson.id !== "string") {
          return;
        }

        const [deptRes, empRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/departments/${tenantJson.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiBaseUrl}/api/employees/${tenantJson.id}?pageSize=1000`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (cancelled) return;

        const deptJson = await deptRes.json();
        const empJson = await empRes.json();

        if (deptRes.ok && deptJson.departments) {
          setDepartments(deptJson.departments);
        }
        if (empRes.ok && empJson.employees) {
          setEmployees(empJson.employees.map((e: Employee) => ({ id: e.id, name: e.name })));
        }
      } catch (e: unknown) {
        console.error("Failed to load dropdowns:", e);
      }
    }
    void loadDropdowns();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  React.useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  const loadTeamDetail = React.useCallback(async (teamId: string) => {
    setLoadingDetail(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      if (!token) throw new Error("Missing access token");

      const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tenantJson = (await tenantRes.json()) as { id?: string; error?: string };
      if (!tenantRes.ok || typeof tenantJson.id !== "string") {
        throw new Error(tenantJson.error || "Unable to resolve tenant");
      }

      const detailRes = await fetch(`${apiBaseUrl}/api/teams/${tenantJson.id}/${teamId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const detailJson = await detailRes.json();
      if (!detailRes.ok) {
        throw new Error(detailJson.error || "Unable to load team details");
      }

      const detailParsed = TeamWithMembersSchema.safeParse(detailJson);
      if (!detailParsed.success) {
        throw new Error("Unexpected team detail response shape");
      }

      setTeamDetail(detailParsed.data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to load team details";
      setError(message);
    } finally {
      setLoadingDetail(false);
    }
  }, [apiBaseUrl]);

  const handleSaveTeam = async () => {
    if (!editForm.name.trim()) {
      setError("Team name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      if (!token) throw new Error("Missing access token");

      const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tenantJson = (await tenantRes.json()) as { id?: string; error?: string };
      if (!tenantRes.ok || typeof tenantJson.id !== "string") {
        throw new Error(tenantJson.error || "Unable to resolve tenant");
      }

      const url = editingTeam === "new"
        ? `${apiBaseUrl}/api/teams/${tenantJson.id}`
        : `${apiBaseUrl}/api/teams/${tenantJson.id}/${editingTeam}`;
      
      const method = editingTeam === "new" ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenant_id: tenantJson.id,
          name: editForm.name.trim(),
          ...(editForm.description.trim() ? { description: editForm.description.trim() } : {}),
          ...(editForm.teamLeadId ? { team_lead_id: editForm.teamLeadId } : {}),
          ...(editForm.departmentId ? { department_id: editForm.departmentId } : {}),
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || `Failed to ${editingTeam === "new" ? "create" : "update"} team`);
      }

      setEditForm({ name: "", description: "", teamLeadId: "", departmentId: "" });
      const savedTeamId = editingTeam;
      setEditingTeam(null);
      await loadTeams();
      if (selectedTeam === savedTeamId && savedTeamId && savedTeamId !== "new") {
        await loadTeamDetail(savedTeamId);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : `Failed to ${editingTeam === "new" ? "create" : "update"} team`;
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm("Are you sure you want to delete this team? This action cannot be undone.")) {
      return;
    }

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      if (!token) throw new Error("Missing access token");

      const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tenantJson = (await tenantRes.json()) as { id?: string; error?: string };
      if (!tenantRes.ok || typeof tenantJson.id !== "string") {
        throw new Error(tenantJson.error || "Unable to resolve tenant");
      }

      const response = await fetch(`${apiBaseUrl}/api/teams/${tenantJson.id}/${teamId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to delete team");
      }

      if (selectedTeam === teamId) {
        setSelectedTeam(null);
        setTeamDetail(null);
      }
      await loadTeams();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete team";
      setError(message);
    }
  };

  const handleAddMembers = async () => {
    if (!selectedTeam || selectedEmployees.size === 0) return;

    setAddingMembers(true);
    setError(null);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      if (!token) throw new Error("Missing access token");

      const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tenantJson = (await tenantRes.json()) as { id?: string; error?: string };
      if (!tenantRes.ok || typeof tenantJson.id !== "string") {
        throw new Error(tenantJson.error || "Unable to resolve tenant");
      }

      const response = await fetch(`${apiBaseUrl}/api/teams/${tenantJson.id}/${selectedTeam}/members`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employee_ids: Array.from(selectedEmployees),
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Failed to add members");
      }

      setSelectedEmployees(new Set());
      await loadTeamDetail(selectedTeam);
      await loadTeams();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add members";
      setError(message);
    } finally {
      setAddingMembers(false);
    }
  };

  const handleRemoveMember = async (employeeId: string) => {
    if (!selectedTeam) return;

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      if (!token) throw new Error("Missing access token");

      const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tenantJson = (await tenantRes.json()) as { id?: string; error?: string };
      if (!tenantRes.ok || typeof tenantJson.id !== "string") {
        throw new Error(tenantJson.error || "Unable to resolve tenant");
      }

      const response = await fetch(`${apiBaseUrl}/api/teams/${tenantJson.id}/${selectedTeam}/members/${employeeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to remove member");
      }

      await loadTeamDetail(selectedTeam);
      await loadTeams();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to remove member";
      setError(message);
    }
  };

  const filteredTeams = React.useMemo(() => {
    let filtered = state.teams;
    if (searchTerm.trim()) {
      filtered = filtered.filter(team =>
        team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (departmentFilter) {
      filtered = filtered.filter(team => team.department_id === departmentFilter);
    }
    return filtered;
  }, [state.teams, searchTerm, departmentFilter]);

  if (state.status === "error" && state.teams.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-base text-muted-foreground">{state.error ?? "Unable to load teams."}</p>
        <Button type="button" onClick={() => loadTeams()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-4xl font-semibold text-foreground">Teams</h1>
              <p className="text-base text-muted-foreground">Manage teams and team members</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => loadTeams()}
                disabled={state.status === "loading"}
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", state.status === "loading" && "animate-spin")} />
                Refresh
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => {
                  setEditingTeam("new");
                  setSelectedTeam(null);
                  setTeamDetail(null);
                  setEditForm({ name: "", description: "", teamLeadId: "", departmentId: "" });
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Team
              </Button>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr,400px]">
          {/* Teams List */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-4">
                <Search className="h-4 w-4" />
                <Input
                  placeholder="Search teams..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              {departments.length > 0 && (
                <div>
                  <Label className="text-sm">Filter by Department</Label>
                  <select
                    value={departmentFilter}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDepartmentFilter(e.target.value)}
                    className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm mt-2"
                  >
                    <option value="">All Departments</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {state.status === "loading" ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredTeams.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm || departmentFilter ? "No teams found matching your filters." : "No teams yet. Create your first team to get started."}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTeams.map(team => (
                    <div
                      key={team.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer",
                        selectedTeam === team.id && "ring-2 ring-primary"
                      )}
                      onClick={() => {
                        setSelectedTeam(team.id);
                        void loadTeamDetail(team.id);
                      }}
                    >
                      <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm">{team.name}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {team.member_count} {team.member_count === 1 ? 'member' : 'members'}
                          </Badge>
                        </div>
                        {team.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {team.description}
                          </p>
                        )}
                        {team.department_id && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            <span>{departments.find(d => d.id === team.department_id)?.name || "Unknown department"}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingTeam(team.id);
                            setEditForm({
                              name: team.name,
                              description: team.description || "",
                              teamLeadId: team.team_lead_id || "",
                              departmentId: team.department_id || "",
                            });
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTeam(team.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team Form or Detail */}
          {editingTeam && !selectedTeam ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingTeam === "new" ? "Create Team" : "Edit Team"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={editForm.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Team name"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={editForm.description}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Optional description"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <select
                      id="department"
                      value={editForm.departmentId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditForm(prev => ({ ...prev, departmentId: e.target.value }))}
                      className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                    >
                      <option value="">No department</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <Label htmlFor="teamLead">Team Lead</Label>
                    <select
                      id="teamLead"
                      value={editForm.teamLeadId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditForm(prev => ({ ...prev, teamLeadId: e.target.value }))}
                      className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                    >
                      <option value="">No team lead</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveTeam}
                      disabled={saving || !editForm.name.trim()}
                      className="flex-1"
                    >
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {editingTeam === "new" ? "Create" : "Update"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingTeam(null);
                        setEditForm({ name: "", description: "", teamLeadId: "", departmentId: "" });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : selectedTeam && teamDetail ? (
            <Card>
              <CardHeader>
                <CardTitle>{teamDetail.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {teamDetail.description && (
                  <p className="text-sm text-muted-foreground">{teamDetail.description}</p>
                )}
                
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Team Members ({teamDetail.member_count})</Label>
                  {loadingDetail ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : teamDetail.members && teamDetail.members.length > 0 ? (
                    <div className="space-y-2">
                      {teamDetail.members.map((member: Employee) => (
                        <div key={member.id} className="flex items-center justify-between p-2 rounded border">
                          <span className="text-sm">{member.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id)}
                            className="h-8 w-8 p-0"
                          >
                            <UserMinus className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">No members yet</p>
                  )}
                </div>
                
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Add Members</Label>
                  <select
                    multiple
                    value={Array.from(selectedEmployees)}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setSelectedEmployees(new Set(selected));
                    }}
                    className="w-full min-h-32 px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    {employees
                      .filter(emp => !teamDetail.members?.some((m: Employee) => m.id === emp.id))
                      .map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Hold Ctrl/Cmd to select multiple
                  </p>
                  <Button
                    onClick={handleAddMembers}
                    disabled={addingMembers || selectedEmployees.size === 0}
                    className="mt-2 w-full"
                    size="sm"
                  >
                    {addingMembers ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="mr-2 h-4 w-4" />
                    )}
                    Add Selected
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : selectedTeam && loadingDetail ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

