import * as React from "react";
import type { Route } from "./+types/employees.$employeeId";
import { useNavigate } from "react-router";
import { format } from "date-fns";
import { ArrowLeft, Edit, FileText, Loader2, RefreshCw, Upload } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { supabase } from "~/lib/supabase";
import { cn } from "~/lib/utils";
import {
  EmployeeDetailResponseSchema,
  type Employee,
  type EmployeeCustomFieldDef,
  type EmployeeDocument,
  type EmployeeManagerOption,
} from "@vibe/shared";

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
};

type ReadyDetail = {
  tenantId: string;
  employee: Employee;
  customFieldDefs: EmployeeCustomFieldDef[];
  documents: EmployeeDocument[];
  managerOptions: EmployeeManagerOption[];
  permissions: {
    canEdit: boolean;
    canManageDocuments: boolean;
  };
};

type DetailState = {
  status: "idle" | "loading" | "ready" | "error";
  data: ReadyDetail | null;
  error: string | null;
};

// eslint-disable-next-line react-refresh/only-export-components
export async function loader() {
  const baseUrl =
    (import.meta as any).env?.VITE_BACKEND_URL ??
    (typeof process !== "undefined"
      ? ((process.env?.VITE_BACKEND_URL as string | undefined) ?? undefined)
      : undefined) ??
    "http://localhost:8787";
  return { baseUrl };
}

// eslint-disable-next-line react-refresh/only-export-components
export function meta({ params }: Route.MetaArgs) {
  return [
    { title: "Employee Detail | Artemis" },
    { name: "description", content: `Employee record for ${params.employeeId}` },
  ];
}

export default function EmployeeDetail({ loaderData, params }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);
  const employeeId = params.employeeId as string;
  const navigate = useNavigate();

  const [state, setState] = React.useState<DetailState>({ status: "idle", data: null, error: null });
  const [editForm, setEditForm] = React.useState<{ name: string; email: string; managerId: string }>({
    name: "",
    email: "",
    managerId: "",
  });
  const [editing, setEditing] = React.useState(false);
  const [editSaving, setEditSaving] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadPct, setUploadPct] = React.useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const loadDetail = React.useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      setStatusMessage(null);
      setState((prev) => ({
        status: "loading",
        data: silent ? prev.data : null,
        error: null,
      }));
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

        const detailRes = await fetch(`${apiBaseUrl}/api/employees/${tenantJson.id}/${employeeId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const detailJson = await detailRes.json().catch(() => ({}));
        if (!detailRes.ok) {
          throw new Error((detailJson as { error?: string }).error || "Unable to load employee");
        }

        const parsed = EmployeeDetailResponseSchema.safeParse(detailJson);
        if (!parsed.success) {
          throw new Error("Unexpected response shape");
        }

        const payload: ReadyDetail = {
          tenantId: tenantJson.id,
          employee: parsed.data.employee,
          customFieldDefs: parsed.data.customFieldDefs,
          documents: parsed.data.documents,
          managerOptions: parsed.data.managerOptions,
          permissions: parsed.data.permissions,
        };

        setState({ status: "ready", data: payload, error: null });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unable to load employee";
        setState((prev) => ({
          status: "error",
          data: silent ? prev.data : null,
          error: message,
        }));
      }
    },
    [apiBaseUrl, employeeId]
  );

  React.useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const detail = state.data;
  const managerLabel =
    detail?.employee.manager_id &&
    detail.managerOptions.find((option) => option.id === detail.employee.manager_id)?.label;

  const handleStartEdit = React.useCallback(() => {
    if (!detail) return;
    setEditForm({
      name: detail.employee.name,
      email: detail.employee.email,
      managerId: detail.employee.manager_id ?? "",
    });
    setEditError(null);
    setStatusMessage(null);
    setEditing(true);
  }, [detail]);

  const handleCancelEdit = React.useCallback(() => {
    setEditing(false);
    setEditError(null);
  }, []);

  const handleSubmitEdit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!detail) return;
      const trimmedName = editForm.name.trim();
      const trimmedEmail = editForm.email.trim();
      const managerId = editForm.managerId.trim();

      const payload: Record<string, unknown> = {};
      if (trimmedName && trimmedName !== detail.employee.name) payload.name = trimmedName;
      if (trimmedEmail && trimmedEmail !== detail.employee.email) payload.email = trimmedEmail;
      if ((managerId || null) !== (detail.employee.manager_id ?? null)) {
        payload.manager_id = managerId.length > 0 ? managerId : null;
      }

      if (Object.keys(payload).length === 0) {
        setEditError("No changes to save.");
        return;
      }

      setEditSaving(true);
      setEditError(null);
      setUploadError(null);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");

        const response = await fetch(`${apiBaseUrl}/api/employees/${detail.tenantId}/${detail.employee.id}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const errorJson = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error((errorJson as { error?: string }).error || "Unable to update employee");
        }

        setEditing(false);
        setStatusMessage("Employee updated successfully.");
        await loadDetail({ silent: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unable to update employee";
        setEditError(message);
      } finally {
        setEditSaving(false);
      }
    },
    [detail, editForm.email, editForm.managerId, editForm.name, apiBaseUrl, loadDetail]
  );

  const handleTriggerUpload = React.useCallback(() => {
    if (!detail?.permissions.canManageDocuments) return;
    fileInputRef.current?.click();
  }, [detail?.permissions.canManageDocuments]);

  const handleUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!detail || !file) return;

      setUploading(true);
      setUploadError(null);
      setStatusMessage(null);
      setUploadPct(0);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");

        await new Promise<void>((resolve, reject) => {
          const formData = new FormData();
          formData.append("file", file);
          const xhr = new XMLHttpRequest();
          xhr.open(
            "POST",
            `${apiBaseUrl}/api/employees/${detail.tenantId}/${detail.employee.id}/documents`
          );
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setUploadPct(pct);
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              try {
                const err = JSON.parse(xhr.responseText);
                reject(new Error(err?.error || "Unable to upload document"));
              } catch {
                reject(new Error("Unable to upload document"));
              }
            }
          };
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.send(formData);
        });

        await loadDetail({ silent: true });
        setStatusMessage("Document uploaded.");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unable to upload document";
        setUploadError(message);
      } finally {
        setUploading(false);
        setUploadPct(null);
      }
    },
    [detail, apiBaseUrl, loadDetail]
  );

  const handleRefresh = React.useCallback(() => {
    void loadDetail({ silent: Boolean(detail) });
  }, [detail, loadDetail]);

  if (state.status === "loading" && !detail) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading employee…
        </div>
      </div>
    );
  }

  if (state.status === "error" && !detail) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-base text-muted-foreground">{state.error ?? "Unable to load employee."}</p>
        <Button type="button" onClick={() => loadDetail()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!detail) return null;

  const loadingOverlay = state.status === "loading";
  const customFieldValues = (detail.employee.custom_fields as Record<string, unknown> | null) ?? {};

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/employees")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Employees
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={state.status === "loading"}
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", loadingOverlay && "animate-spin")} />
                Refresh
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => navigate(`/employees/${detail.employee.id}/growth`)}
              >
                <FileText className="mr-2 h-4 w-4" />
                Growth &amp; Goals
              </Button>
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-semibold text-foreground">{detail.employee.name}</h1>
            <p className="text-base text-muted-foreground">{detail.employee.email}</p>
          </div>
        </header>

        {statusMessage ? (
          <div className="rounded-2xl border border-emerald-300/60 bg-emerald-100/40 px-4 py-3 text-sm text-emerald-700">
            {statusMessage}
          </div>
        ) : null}

        {state.status === "error" && detail ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {state.error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card className="border-border/60 bg-card/80 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl">Profile</CardTitle>
                <p className="text-sm text-muted-foreground">Core employment details and reporting structure.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleStartEdit}
                  disabled={!detail.permissions.canEdit || editing}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Name</p>
                  <p className="text-sm text-foreground">{detail.employee.name}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Email</p>
                  <p className="text-sm text-foreground">{detail.employee.email}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Manager</p>
                  <p className="text-sm text-foreground">{managerLabel ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Joined</p>
                  <p className="text-sm text-foreground">
                    {format(new Date(detail.employee.created_at), "PPP p")}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Custom Fields</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {detail.customFieldDefs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No custom fields yet. Add fields from the employee configuration panel.
                    </p>
                  ) : (
                    detail.customFieldDefs.map((field) => {
                      const value = customFieldValues?.[field.key];
                      return (
                        <div key={field.id} className="rounded-xl border border-border/50 bg-background/60 p-3">
                          <p className="text-xs uppercase text-muted-foreground">{field.name}</p>
                          <p className="text-sm text-foreground">
                            {value === null || value === undefined || value === "" ? "—" : String(value)}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl">Documents</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Upload offer letters, payroll paperwork, or compliance acknowledgments.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={!detail.permissions.canManageDocuments || uploading}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleTriggerUpload}
                  disabled={!detail.permissions.canManageDocuments || uploading}
                >
                  <Upload className={cn("mr-2 h-4 w-4", uploading && "animate-spin")} />
                  Upload
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {uploadError ? (
                <div className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {uploadError}
                </div>
              ) : null}
              <div className="space-y-3">
                {detail.documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No documents uploaded yet. Collect onboarding paperwork or compliance acknowledgments here.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {detail.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="rounded-xl border border-border/50 bg-background/60 px-4 py-3 text-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{doc.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(doc.uploaded_at), "PPP p")} · {formatFileSize(doc.file_size)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <a
                              href={`${apiBaseUrl}/api/employees/${detail.tenantId}/${detail.employee.id}/documents/${doc.id}/download`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-9 items-center rounded-md px-3 text-sm hover:underline"
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Download
                            </a>
                            {detail.permissions.canManageDocuments ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                  if (!confirm("Delete this document permanently?")) return;
                                  try {
                                    const session = (await supabase.auth.getSession()).data.session;
                                    const token = session?.access_token;
                                    if (!token) throw new Error("Missing access token");
                                    const res = await fetch(
                                      `${apiBaseUrl}/api/employees/${detail.tenantId}/${detail.employee.id}/documents/${doc.id}`,
                                      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
                                    );
                                    const json = await res.json().catch(() => ({} as any));
                                    if (!res.ok) throw new Error((json as any)?.error || "Unable to delete document");
                                    await loadDetail({ silent: true });
                                  } catch (e: unknown) {
                                    setStatusMessage(null);
                                    setUploadError(e instanceof Error ? e.message : "Unable to delete document");
                                  }
                                }}
                              >
                                Delete
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              {uploading && uploadPct !== null ? (
                <div className="mt-3 text-xs text-muted-foreground">Uploading… {uploadPct}%</div>
              ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        {editing && detail.permissions.canEdit ? (
          <Card className="border-border/60 bg-card/80 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">Edit Employee</CardTitle>
              <p className="text-sm text-muted-foreground">
                Update core profile details and reporting relationships.
              </p>
            </CardHeader>
            <CardContent>
              {editError ? (
                <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  {editError}
                </div>
              ) : null}
              <form className="space-y-5" onSubmit={handleSubmitEdit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs uppercase text-muted-foreground">Full Name</span>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                      className="h-12 rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs uppercase text-muted-foreground">Work Email</span>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                      className="h-12 rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-2 md:col-span-2">
                    <span className="text-xs uppercase text-muted-foreground">Manager</span>
                    <select
                      value={editForm.managerId}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, managerId: event.target.value }))}
                      className="h-12 rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">No manager</option>
                      {detail.managerOptions
                        .filter((option) => option.id !== detail.employee.id)
                        .map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <Button type="button" variant="ghost" onClick={handleCancelEdit} disabled={editSaving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={editSaving}>
                    {editSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
