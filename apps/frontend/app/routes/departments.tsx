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
  Search,
  UserCircle2,
  MapPin,
  CircleDollarSign,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { supabase } from "~/lib/supabase";
import { cn } from "~/lib/utils";
import {
  DepartmentListResponseSchema,
  DepartmentHierarchyResponseSchema,
  EmployeeListResponseSchema,
  OfficeLocationListResponseSchema,
  type Department,
  type DepartmentHierarchy,
  type Employee,
  type OfficeLocation,
} from "@vibe/shared";
import { usePermissions } from "~/lib/permissions";

type DepartmentWithStats = Department & {
  employeeCount: number;
  children?: DepartmentWithStats[];
};

const NO_PARENT_DEPARTMENT_VALUE = "__no_parent_department__";
const NO_DEPARTMENT_HEAD_VALUE = "__no_department_head__";
const NO_DEPARTMENT_OFFICE_VALUE = "__no_department_office__";

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
    error: null,
  });
  const [searchTerm, setSearchTerm] = React.useState("");
  const [expandedDepartments, setExpandedDepartments] = React.useState<Set<string>>(new Set());
  const [editingDept, setEditingDept] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<{
    name: string;
    description: string;
    parentId: string;
    headEmployeeId: string;
    costCenter: string;
    officeLocationId: string;
  }>({
    name: "",
    description: "",
    parentId: "",
    headEmployeeId: "",
    costCenter: "",
    officeLocationId: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [employeeOptions, setEmployeeOptions] = React.useState<Array<{ id: string; name: string }>>([]);
  const [officeLocations, setOfficeLocations] = React.useState<OfficeLocation[]>([]);
  const [tenantId, setTenantId] = React.useState<string | null>(null);
  const permissionKeys = React.useMemo(() => ["departments.read", "departments.manage"], []);
  const { permissions: departmentPermissions, loading: departmentPermissionsLoading } = usePermissions(permissionKeys, {
    tenantId,
    skip: !tenantId,
  });
  const canViewDepartments = departmentPermissions["departments.read"] ?? false;
  const canManageDepartments = departmentPermissions["departments.manage"] ?? false;

  const resolveTenantContext = React.useCallback(async () => {
    const session = (await supabase.auth.getSession()).data.session;
    const token = session?.access_token;
    if (!token) {
      throw new Error("Missing access token");
    }

    const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const tenantJson = (await tenantRes.json()) as { id?: string; error?: string };
    if (!tenantRes.ok || typeof tenantJson.id !== "string") {
      throw new Error(tenantJson.error || "Unable to resolve tenant");
    }

    setTenantId(prev => {
      const nextId = tenantJson.id ?? null;
      if (nextId === null) return prev;
      return prev === nextId ? prev : nextId;
    });
    return { token, tenantId: tenantJson.id };
  }, [apiBaseUrl]);

  const loadDepartments = React.useCallback(async () => {
    setState(prev => ({ ...prev, status: "loading" }));
    try {
      const { token, tenantId } = await resolveTenantContext();
      const parseJson = async (res: Response) => {
        try {
          return await res.json();
        } catch {
          return null;
        }
      };

      const [deptRes, hierarchyRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/departments/${tenantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBaseUrl}/api/departments/${tenantId}/tree`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const deptJson = await parseJson(deptRes);
      if (!deptRes.ok || !deptJson) {
        throw new Error(deptJson?.error || "Unable to load departments");
      }
      const deptParsed = DepartmentListResponseSchema.safeParse(deptJson);
      if (!deptParsed.success) {
        throw new Error("Unexpected department response shape");
      }

      const hierarchyJson = await parseJson(hierarchyRes);
      if (!hierarchyRes.ok || !hierarchyJson) {
        throw new Error(hierarchyJson?.error || "Unable to load department hierarchy");
      }
      const hierarchyParsed = DepartmentHierarchyResponseSchema.safeParse(hierarchyJson);
      if (!hierarchyParsed.success) {
        throw new Error("Unexpected hierarchy response shape");
      }

      const countMap = new Map(
        (hierarchyParsed.data.departments ?? []).map(node => [node.id, node.employee_count ?? 0]),
      );

      const departmentsWithStats = deptParsed.data.departments.map(dept => ({
        ...dept,
        employeeCount: countMap.get(dept.id) ?? 0,
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
  }, [apiBaseUrl, resolveTenantContext]);

  const loadReferenceData = React.useCallback(async () => {
    try {
      const { token, tenantId } = await resolveTenantContext();
      const [employeesRes, locationsRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/employees/${tenantId}?pageSize=500&sort=name&order=asc`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBaseUrl}/api/office-locations/${tenantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (employeesRes.ok) {
        const employeesJson = await employeesRes.json();
        const employeesParsed = EmployeeListResponseSchema.safeParse(employeesJson);
        if (employeesParsed.success) {
          setEmployeeOptions(
            employeesParsed.data.employees.map((employee: Employee) => ({
              id: employee.id,
              name: employee.name,
            })),
          );
        }
      }

      if (locationsRes.ok) {
        const locationsJson = await locationsRes.json();
        const locationsParsed = OfficeLocationListResponseSchema.safeParse(locationsJson);
        if (locationsParsed.success) {
          setOfficeLocations(locationsParsed.data.locations ?? []);
        }
      }
    } catch (err) {
      console.error("Failed to load reference data:", err);
    }
  }, [apiBaseUrl, resolveTenantContext]);

  React.useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  React.useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  const handleCreateDepartment = async () => {
    if (!canManageDepartments) {
      setError("You do not have permission to manage departments.");
      return;
    }
    if (!editForm.name.trim()) {
      setError("Department name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { token, tenantId } = await resolveTenantContext();
      const isNew = editingDept === "new";

      const url = isNew
        ? `${apiBaseUrl}/api/departments/${tenantId}`
        : `${apiBaseUrl}/api/departments/${tenantId}/${editingDept}`;

      const payload: Record<string, unknown> = isNew
        ? {
            tenant_id: tenantId,
            name: editForm.name.trim(),
          }
        : {
            name: editForm.name.trim(),
          };

      const description = editForm.description.trim();
      if (description) {
        payload.description = description;
      } else if (!isNew) {
        payload.description = null;
      }

      if (editForm.parentId) {
        payload.parent_id = editForm.parentId;
      } else if (!isNew) {
        payload.parent_id = null;
      }

      if (editForm.headEmployeeId) {
        payload.head_employee_id = editForm.headEmployeeId;
      } else if (!isNew) {
        payload.head_employee_id = null;
      }

      const costCenter = editForm.costCenter.trim();
      if (costCenter) {
        payload.cost_center = costCenter;
      } else if (!isNew) {
        payload.cost_center = null;
      }

      if (editForm.officeLocationId) {
        payload.office_location_id = editForm.officeLocationId;
      } else if (!isNew) {
        payload.office_location_id = null;
      }

      const response = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || `Failed to ${editingDept === "new" ? "create" : "update"} department`);
      }

      setEditForm({ name: "", description: "", parentId: "", headEmployeeId: "", costCenter: "", officeLocationId: "" });
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
    if (!canManageDepartments) {
      setError("You do not have permission to manage departments.");
      return;
    }
    if (!confirm("Are you sure you want to delete this department? This action cannot be undone.")) {
      return;
    }

    try {
      const { token, tenantId } = await resolveTenantContext();
      const response = await fetch(`${apiBaseUrl}/api/departments/${tenantId}/${deptId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to delete department");
      }

      if (editingDept === deptId) {
        setEditingDept(null);
        setEditForm({ name: "", description: "", parentId: "", headEmployeeId: "", costCenter: "", officeLocationId: "" });
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

  const hierarchyById = React.useMemo(() => {
    const map = new Map<string, DepartmentHierarchy>();
    state.hierarchy.forEach(node => map.set(node.id, node));
    return map;
  }, [state.hierarchy]);

  const filteredDepartments = React.useMemo(() => {
    if (!searchTerm.trim()) return state.departments;
    return state.departments.filter(dept =>
      dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dept.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dept.cost_center?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [state.departments, searchTerm]);

  const renderDepartmentTree = (departments: DepartmentWithStats[], parentId: string | null = null, level = 0) => {
    const children = departments.filter(dept => dept.parent_id === parentId);
    
    return children.map(dept => {
      const isExpanded = expandedDepartments.has(dept.id);
      const hasChildren = departments.some(d => d.parent_id === dept.id);
      const hierarchyMeta = hierarchyById.get(dept.id);
      
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
              {dept.cost_center && (
                <Badge variant="outline" className="mt-1 text-xs flex items-center gap-1 w-fit">
                  <CircleDollarSign className="h-3 w-3" />
                  {dept.cost_center}
                </Badge>
              )}
              {hierarchyMeta?.head_name && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <UserCircle2 className="h-3 w-3" />
                  <span>{hierarchyMeta.head_name}</span>
                </div>
              )}
              {hierarchyMeta?.office_location_name && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3" />
                  <span>{hierarchyMeta.office_location_name}</span>
                  {hierarchyMeta.office_location_timezone && (
                    <span className="text-[11px] text-muted-foreground/80">
                      ({hierarchyMeta.office_location_timezone})
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {canManageDepartments ? (
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
                      headEmployeeId: dept.head_employee_id || "",
                      costCenter: dept.cost_center || "",
                      officeLocationId: dept.office_location_id || "",
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
            ) : null}
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

  if (!tenantId || departmentPermissionsLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20 text-sm text-muted-foreground">
        Loading departments...
      </div>
    );
  }

  if (!canViewDepartments) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-20 text-center">
        <div className="max-w-md space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">Insufficient permissions</h2>
          <p className="text-sm text-muted-foreground">
            You do not have access to view departments. Contact your administrator if you need additional access.
          </p>
        </div>
      </div>
    );
  }

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
              {canManageDepartments ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setEditingDept("new");
                    setEditForm({
                      name: "",
                      description: "",
                      parentId: "",
                      headEmployeeId: "",
                      costCenter: "",
                      officeLocationId: "",
                    });
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Department
                </Button>
              ) : null}
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
          {canManageDepartments ? (
            <Card>
              <CardHeader>
                <CardTitle>{editingDept === "new" ? "Create Department" : "Edit Department"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={editForm.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEditForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Department name"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Input
                      value={editForm.description}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEditForm((prev) => ({ ...prev, description: e.target.value }))
                      }
                      placeholder="Optional description"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Parent Department</label>
                    <Select
                      value={editForm.parentId || NO_PARENT_DEPARTMENT_VALUE}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({ ...prev, parentId: value === NO_PARENT_DEPARTMENT_VALUE ? "" : value }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No parent (top-level)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_PARENT_DEPARTMENT_VALUE}>No parent (top-level)</SelectItem>
                        {state.departments
                          .filter((dept) => dept.id !== editingDept)
                          .map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Department Head</label>
                    <Select
                      value={editForm.headEmployeeId || NO_DEPARTMENT_HEAD_VALUE}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({
                          ...prev,
                          headEmployeeId: value === NO_DEPARTMENT_HEAD_VALUE ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No department head" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_DEPARTMENT_HEAD_VALUE}>No department head</SelectItem>
                        {employeeOptions.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Cost Center</label>
                    <Input
                      value={editForm.costCenter}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEditForm((prev) => ({ ...prev, costCenter: e.target.value }))
                      }
                      placeholder="e.g., OPS-1001"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Office Location</label>
                    <Select
                      value={editForm.officeLocationId || NO_DEPARTMENT_OFFICE_VALUE}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({
                          ...prev,
                          officeLocationId: value === NO_DEPARTMENT_OFFICE_VALUE ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No office location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_DEPARTMENT_OFFICE_VALUE}>No office location</SelectItem>
                        {officeLocations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                            {location.timezone ? ` (${location.timezone})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleCreateDepartment} disabled={saving || !editForm.name.trim()} className="flex-1">
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {editingDept === "new" ? "Create" : "Update"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingDept(null);
                        setEditForm({
                          name: "",
                          description: "",
                          parentId: "",
                          headEmployeeId: "",
                          costCenter: "",
                          officeLocationId: "",
                        });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Department Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  You have read-only access to departments. Contact your administrator if you need permission to create or modify
                  the org structure.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
