import * as React from "react";
import type { Route } from "./+types/departments";
import { 
  Plus, 
  Building2, 
  Users, 
  Edit, 
  Trash2, 
  ChevronRight, 
  ChevronDown,
  Loader2,
  RefreshCw,
  Search
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { supabase } from "~/lib/supabase";
import { cn } from "~/lib/utils";
import {
  DepartmentListResponseSchema,
  DepartmentHierarchyResponseSchema,
  type Department,
  type DepartmentHierarchy,
} from "@vibe/shared";

type DepartmentWithStats = Department & {
  employeeCount: number;
  children?: DepartmentWithStats[];
};

type DepartmentState = {
  status: "idle" | "loading" | "ready" | "error";
  departments: DepartmentWithStats[];
  hierarchy: DepartmentHierarchy[];
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

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Departments | Artemis" },
    { name: "description", content: "Manage organizational departments and hierarchy" },
  ];
}

export default function Departments({ loaderData }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);
  const [state, setState] = React.useState<DepartmentState>({ 
    status: "idle", 
    departments: [], 
    hierarchy: [], 
    error: null 
  });
  const [searchTerm, setSearchTerm] = React.useState("");
  const [expandedDepartments, setExpandedDepartments] = React.useState<Set<string>>(new Set());
  const [editingDept, setEditingDept] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<{ name: string; description: string; parentId: string }>({
    name: "",
    description: "",
    parentId: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadDepartments = React.useCallback(async () => {
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

      // Load departments list
      const deptRes = await fetch(`${apiBaseUrl}/api/departments/${tenantJson.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const deptJson = await deptRes.json();
      if (!deptRes.ok) {
        throw new Error(deptJson.error || "Unable to load departments");
      }

      const deptParsed = DepartmentListResponseSchema.safeParse(deptJson);
      if (!deptParsed.success) {
        throw new Error("Unexpected department response shape");
      }

      // Load hierarchy
      const hierarchyRes = await fetch(`${apiBaseUrl}/api/departments/${tenantJson.id}/tree`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const hierarchyJson = await hierarchyRes.json();
      if (!hierarchyRes.ok) {
        throw new Error(hierarchyJson.error || "Unable to load department hierarchy");
      }

      const hierarchyParsed = DepartmentHierarchyResponseSchema.safeParse(hierarchyJson);
      if (!hierarchyParsed.success) {
        throw new Error("Unexpected hierarchy response shape");
      }

      // Get employee counts for each department
      const employeeCounts = await Promise.all(
        deptParsed.data.departments.map(async (dept) => {
          const empRes = await fetch(`${apiBaseUrl}/api/employees/${tenantJson.id}?departmentId=${dept.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const empJson = await empRes.json();
          return {
            departmentId: dept.id,
            count: empJson.employees?.length || 0,
          };
        })
      );

      const departmentsWithStats = deptParsed.data.departments.map(dept => ({
        ...dept,
        employeeCount: employeeCounts.find(c => c.departmentId === dept.id)?.count || 0,
      }));

      setState({
        status: "ready",
        departments: departmentsWithStats,
        hierarchy: hierarchyParsed.data.departments || [],
        error: null,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to load departments";
      setState(prev => ({
        ...prev,
        status: "error",
        error: message,
      }));
    }
  }, [apiBaseUrl]);

  React.useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  const handleCreateDepartment = async () => {
    if (!editForm.name.trim()) {
      setError("Department name is required");
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

      const url = editingDept === "new"
        ? `${apiBaseUrl}/api/departments/${tenantJson.id}`
        : `${apiBaseUrl}/api/departments/${tenantJson.id}/${editingDept}`;
      
      const method = editingDept === "new" ? "POST" : "PUT";

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
          ...(editForm.parentId ? { parent_id: editForm.parentId } : {}),
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || `Failed to ${editingDept === "new" ? "create" : "update"} department`);
      }

      setEditForm({ name: "", description: "", parentId: "" });
      setEditingDept(null);
      await loadDepartments();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : `Failed to ${editingDept === "new" ? "create" : "update"} department`;
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDepartment = async (deptId: string) => {
    if (!confirm("Are you sure you want to delete this department? This action cannot be undone.")) {
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

      const response = await fetch(`${apiBaseUrl}/api/departments/${tenantJson.id}/${deptId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to delete department");
      }

      await loadDepartments();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete department";
      setError(message);
    }
  };

  const toggleExpanded = (deptId: string) => {
    setExpandedDepartments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deptId)) {
        newSet.delete(deptId);
      } else {
        newSet.add(deptId);
      }
      return newSet;
    });
  };

  const filteredDepartments = React.useMemo(() => {
    if (!searchTerm.trim()) return state.departments;
    return state.departments.filter(dept =>
      dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dept.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [state.departments, searchTerm]);

  const renderDepartmentTree = (departments: DepartmentWithStats[], parentId: string | null = null, level = 0) => {
    const children = departments.filter(dept => dept.parent_id === parentId);
    
    return children.map(dept => {
      const isExpanded = expandedDepartments.has(dept.id);
      const hasChildren = departments.some(d => d.parent_id === dept.id);
      
      return (
        <div key={dept.id} className="space-y-1">
          <div 
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors",
              level > 0 && "ml-6"
            )}
          >
            {hasChildren ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleExpanded(dept.id)}
                className="h-6 w-6 p-0"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <div className="w-6" />
            )}
            
            <Building2 className="h-4 w-4 text-muted-foreground" />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm truncate">{dept.name}</h3>
                <Badge variant="secondary" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {dept.employeeCount}
                </Badge>
              </div>
              {dept.description && (
                <p className="text-xs text-muted-foreground truncate">{dept.description}</p>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingDept(dept.id);
                  setEditForm({
                    name: dept.name,
                    description: dept.description || "",
                    parentId: dept.parent_id || "",
                  });
                }}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteDepartment(dept.id)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          {hasChildren && isExpanded && (
            <div className="space-y-1">
              {renderDepartmentTree(departments, dept.id, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  if (state.status === "error" && state.departments.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-base text-muted-foreground">{state.error ?? "Unable to load departments."}</p>
        <Button type="button" onClick={() => loadDepartments()}>
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
              <h1 className="text-4xl font-semibold text-foreground">Departments</h1>
              <p className="text-base text-muted-foreground">Manage your organizational structure</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => loadDepartments()}
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
                  setEditingDept("new");
                  setEditForm({ name: "", description: "", parentId: "" });
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Department
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
          {/* Department Tree */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <Input
                  placeholder="Search departments..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              {state.status === "loading" ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredDepartments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "No departments found matching your search." : "No departments yet. Create your first department to get started."}
                </div>
              ) : (
                <div className="space-y-1">
                  {renderDepartmentTree(filteredDepartments)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Department Form */}
          <Card>
            <CardHeader>
              <CardTitle>
                {editingDept === "new" ? "Create Department" : "Edit Department"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={editForm.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Department name"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={editForm.description}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Parent Department</label>
                  <select
                    value={editForm.parentId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditForm(prev => ({ ...prev, parentId: e.target.value }))}
                    className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="">No parent (top-level)</option>
                    {state.departments
                      .filter(dept => dept.id !== editingDept)
                      .map(dept => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                  </select>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateDepartment}
                    disabled={saving || !editForm.name.trim()}
                    className="flex-1"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {editingDept === "new" ? "Create" : "Update"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingDept(null);
                      setEditForm({ name: "", description: "", parentId: "" });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
