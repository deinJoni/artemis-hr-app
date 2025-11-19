import * as React from "react";
import type { Route } from "./+types/employees.$employeeId";
import { useNavigate } from "react-router";
import { format } from "date-fns";
import {
  ArrowLeft,
  Download,
  Edit,
  FileText,
  History,
  Loader2,
  Network,
  RefreshCw,
  Target,
  Trash2,
  Upload,
  User,
  FolderOpen,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { supabase } from "~/lib/supabase";
import { cn } from "~/lib/utils";
import {
  EmployeeDetailResponseSchema,
  EmployeeDocumentListResponseSchema,
  type DocumentExpiryFilter,
  type DocumentStatusFilter,
  type EmployeeDocumentStats,
  type Employee,
  type EmployeeCustomFieldDef,
  type EmployeeDocument,
  type EmployeeManagerOption,
  EmployeeNoteSchema,
  type EmployeeNote,
  type Department,
  type EmployeeAuditLog,
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
  notes: EmployeeNote[];
  managerOptions: EmployeeManagerOption[];
  department: Department | null;
  auditLog: EmployeeAuditLog[] | undefined;
  permissions: {
    canEdit: boolean;
    canManageDocuments: boolean;
    canViewAuditLog: boolean;
    canViewCompensation: boolean;
    canEditCompensation: boolean;
    canViewSensitive: boolean;
    canEditSensitive: boolean;
  };
};

type DocumentFilters = {
  category: string;
  status: DocumentStatusFilter;
  expiry: DocumentExpiryFilter;
};

type DocumentState = {
  items: EmployeeDocument[];
  stats: EmployeeDocumentStats | null;
  loading: boolean;
  error: string | null;
};

const EMPLOYEE_MANAGER_NONE_VALUE = "__employee_manager_none__";
const DOCUMENT_CATEGORY_NONE_VALUE = "__document_category_none__";
const DOCUMENT_CATEGORY_FILTER_ALL_VALUE = "__document_category_filter_all__";
const DOCUMENT_STATUS_FILTER_ALL_VALUE = "__document_status_filter_all__";
const DOCUMENT_EXPIRY_FILTER_ALL_VALUE = "__document_expiry_filter_all__";

type NotesState = {
  items: EmployeeNote[];
  loading: boolean;
  error: string | null;
};

type DetailState = {
  status: "idle" | "loading" | "ready" | "error";
  data: ReadyDetail | null;
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
  const [activeTab, setActiveTab] = React.useState<"overview" | "documents" | "history" | "goals">("overview");
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadPct, setUploadPct] = React.useState<number | null>(null);
  const [documentError, setDocumentError] = React.useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = React.useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = React.useState<string | null>(null);
  const [documentForm, setDocumentForm] = React.useState<{ description: string; category: string; expiryDate: string }>({
    description: "",
    category: "",
    expiryDate: "",
  });
  const [documentFilters, setDocumentFilters] = React.useState<DocumentFilters>({
    category: "",
    status: "all" as DocumentStatusFilter,
    expiry: "all" as DocumentExpiryFilter,
  });
  const [documentsState, setDocumentsState] = React.useState<DocumentState>({
    items: [],
    stats: null,
    loading: false,
    error: null,
  });
  const [notesState, setNotesState] = React.useState<NotesState>({
    items: [],
    loading: false,
    error: null,
  });
  const [noteBody, setNoteBody] = React.useState("");
  const [noteSaving, setNoteSaving] = React.useState(false);
  const [noteDeletingId, setNoteDeletingId] = React.useState<string | null>(null);
  const [noteFormError, setNoteFormError] = React.useState<string | null>(null);
  const resetDocumentFilters = React.useCallback(() => {
    setDocumentFilters({ category: "", status: "all" as DocumentStatusFilter, expiry: "all" as DocumentExpiryFilter });
  }, []);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const documentCategories = React.useMemo(
    () => [
      { value: "", label: "No Category" },
      { value: "contract", label: "Contract" },
      { value: "supplemental_agreement", label: "Supplemental Agreement" },
      { value: "disciplinary_warning", label: "Warning / Notice" },
      { value: "reference_letter", label: "Reference / Testimonial" },
      { value: "certification", label: "Certification" },
      { value: "id_document", label: "ID Document" },
      { value: "performance", label: "Performance" },
      { value: "medical", label: "Medical" },
      { value: "other", label: "Other" },
    ],
    [],
  );
  const documentCategoryFilterOptions = React.useMemo(
    () => [
      { value: "", label: "All Categories" },
      ...documentCategories.filter((option) => option.value),
    ],
    [documentCategories],
  );
  const documentStatusOptions = React.useMemo<{ value: DocumentStatusFilter; label: string }[]>(
    () => [
      { value: "all", label: "All Versions" },
      { value: "current", label: "Current Only" },
      { value: "archived", label: "Archived Only" },
    ],
    [],
  );
  const documentExpiryOptions = React.useMemo<{ value: DocumentExpiryFilter; label: string }[]>(
    () => [
      { value: "all", label: "Any Expiry" },
      { value: "expiring", label: "Expiring Soon (30 days)" },
      { value: "expired", label: "Expired" },
    ],
    [],
  );
  const categoryLabelMap = React.useMemo(
    () =>
      documentCategories.reduce<Record<string, string>>((acc, option) => {
        acc[option.value] = option.label;
        return acc;
      }, {}),
    [documentCategories]
  );
  const formatDate = React.useCallback((value: string | null | undefined, pattern: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return format(parsed, pattern);
  }, []);
  const formatMoney = React.useCallback((value: unknown) => {
    const numericValue =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseFloat(value)
          : null;
    if (numericValue === null || Number.isNaN(numericValue)) {
      return null;
    }
    return numericValue.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }, []);

  const fetchDocuments = React.useCallback(
    async (filters: DocumentFilters) => {
      if (!state.data) return;
      setDocumentsState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");
        const params = new URLSearchParams();
        if (filters.category) {
          params.set("category", filters.category);
        }
        if (filters.status !== "all") {
          params.set("status", filters.status);
        }
        if (filters.expiry !== "all") {
          params.set("expiry", filters.expiry);
        }
        const queryString = params.toString();
        const url = `${apiBaseUrl}/api/employees/${state.data.tenantId}/${state.data.employee.id}/documents${queryString ? `?${queryString}` : ""}`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error((json as { error?: string }).error || "Unable to load documents");
        }
        const parsed = EmployeeDocumentListResponseSchema.safeParse(json);
        if (!parsed.success) {
          throw new Error("Unexpected response shape");
        }
        setDocumentsState({
          items: parsed.data.documents,
          stats: parsed.data.stats,
          loading: false,
          error: null,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unable to load documents";
        setDocumentsState((prev) => ({ ...prev, loading: false, error: message }));
      }
    },
    [apiBaseUrl, state.data],
  );

  const refreshNotes = React.useCallback(
    async (silent = false) => {
      if (!state.data) return;
      if (!silent) {
        setNotesState((prev) => ({ ...prev, loading: true, error: null }));
      }
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");
        const response = await fetch(
          `${apiBaseUrl}/api/employees/${state.data.tenantId}/${state.data.employee.id}/notes`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error((json as { error?: string }).error || "Unable to load notes");
        }
        const parsed = EmployeeNoteSchema.array().safeParse((json as { notes?: unknown[] }).notes ?? []);
        if (!parsed.success) {
          throw new Error("Unexpected response shape");
        }
        setNotesState({ items: parsed.data, loading: false, error: null });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unable to load notes";
        setNotesState((prev) => ({ ...prev, loading: false, error: message }));
      }
    },
    [apiBaseUrl, state.data],
  );

  const loadDetail = React.useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) setState((prev) => ({ ...prev, status: "loading" }));
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");

        const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const tenantJson = (await tenantRes.json().catch(() => ({}))) as { id?: string; error?: string };
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
          notes: parsed.data.notes ?? [],
          managerOptions: parsed.data.managerOptions,
          department: parsed.data.department,
          auditLog: parsed.data.auditLog,
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

  React.useEffect(() => {
    if (!detail) return;
    setDocumentsState((prev) => ({
      ...prev,
      items: detail.documents,
    }));
    setNotesState((prev) => ({
      ...prev,
      items: detail.notes,
    }));
  }, [detail]);

  React.useEffect(() => {
    if (!detail) return;
    void fetchDocuments(documentFilters);
  }, [detail, documentFilters, fetchDocuments]);

  React.useEffect(() => {
    if (!detail) return;
    void refreshNotes(true);
  }, [detail, refreshNotes]);
  const hasDocumentFilters =
    documentFilters.category.length > 0 ||
    documentFilters.status !== "all" ||
    documentFilters.expiry !== "all";
  const managerLabel =
    detail && detail.employee.manager_id
      ? detail.managerOptions.find((option) => option.id === detail.employee.manager_id)?.label
      : undefined;

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
        const json = await response.json().catch(() => ({} as any));
        if (!response.ok) throw new Error((json as any)?.error || "Unable to update employee");
        setStatusMessage("Employee updated successfully.");
        setEditing(false);
        await loadDetail({ silent: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unable to update employee";
        setEditError(message);
      } finally {
        setEditSaving(false);
      }
    },
    [detail, editForm, apiBaseUrl, loadDetail]
  );

  const handleUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !detail) return;

      setUploading(true);
      setUploadError(null);
      setDocumentError(null);
      setStatusMessage(null);
      setUploadPct(0);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");

        const formData = new FormData();
        formData.append("file", file);
        const trimmedDescription = documentForm.description.trim();
        if (trimmedDescription.length > 0) {
          formData.append("description", trimmedDescription);
        }
        if (documentForm.category) {
          formData.append("category", documentForm.category);
        }
        if (documentForm.expiryDate) {
          formData.append("expiry_date", documentForm.expiryDate);
        }

        const response = await fetch(`${apiBaseUrl}/api/employees/${detail.tenantId}/${detail.employee.id}/documents`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const json = await response.json().catch(() => ({} as any));
        if (!response.ok) throw new Error((json as any)?.error || "Unable to upload document");
        setStatusMessage("Document uploaded successfully.");
        setDocumentForm({ description: "", category: "", expiryDate: "" });
        await fetchDocuments(documentFilters);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unable to upload document";
        setUploadError(message);
      } finally {
        setUploading(false);
        setUploadPct(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [detail, apiBaseUrl, fetchDocuments, documentFilters, documentForm]
  );

  const handleTriggerUpload = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDownloadDocument = React.useCallback(
    async (document: EmployeeDocument) => {
      if (!detail) return;
      setDownloadingDocId(document.id);
      setDocumentError(null);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");

        const response = await fetch(
          `${apiBaseUrl}/api/employees/${detail.tenantId}/${detail.employee.id}/documents/${document.id}/download`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );
        const json = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!response.ok || typeof json.url !== "string") {
          throw new Error(json.error || "Unable to create download link");
        }
        window.open(json.url, "_blank", "noopener");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unable to download document";
        setDocumentError(message);
      } finally {
        setDownloadingDocId(null);
      }
    },
    [apiBaseUrl, detail]
  );

  const handleDeleteDocument = React.useCallback(
    async (document: EmployeeDocument) => {
      if (!detail) return;
      setDeletingDocId(document.id);
      setDocumentError(null);
      setStatusMessage(null);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");

        const response = await fetch(
          `${apiBaseUrl}/api/employees/${detail.tenantId}/${detail.employee.id}/documents/${document.id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const json = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw new Error(json.error || "Unable to delete document");
        }
        setStatusMessage("Document deleted successfully.");
        await fetchDocuments(documentFilters);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unable to delete document";
        setDocumentError(message);
      } finally {
        setDeletingDocId(null);
      }
    },
    [apiBaseUrl, detail, fetchDocuments, documentFilters]
  );

  const handleSubmitNote = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!detail) return;
      const trimmed = noteBody.trim();
      if (!trimmed) {
        setNoteFormError("Please enter a note before saving.");
        return;
      }
      setNoteSaving(true);
      setNoteFormError(null);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");
        const response = await fetch(
          `${apiBaseUrl}/api/employees/${detail.tenantId}/${detail.employee.id}/notes`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ body: trimmed }),
          }
        );
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error((json as { error?: string }).error || "Unable to save note");
        }
        setNoteBody("");
        setStatusMessage("Note added.");
        await refreshNotes(true);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unable to save note";
        setNoteFormError(message);
      } finally {
        setNoteSaving(false);
      }
    },
    [apiBaseUrl, detail, noteBody, refreshNotes]
  );

  const handleDeleteNote = React.useCallback(
    async (noteId: string) => {
      if (!detail) return;
      setNoteDeletingId(noteId);
      setNotesState((prev) => ({ ...prev, error: null }));
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;
        if (!token) throw new Error("Missing access token");
        const response = await fetch(
          `${apiBaseUrl}/api/employees/${detail.tenantId}/${detail.employee.id}/notes/${noteId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error((json as { error?: string }).error || "Unable to delete note");
        }
        setStatusMessage("Note removed.");
        await refreshNotes(true);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unable to delete note";
        setNotesState((prev) => ({ ...prev, error: message }));
      } finally {
        setNoteDeletingId(null);
      }
    },
    [apiBaseUrl, detail, refreshNotes]
  );

  const handleRefresh = React.useCallback(() => {
    void loadDetail();
  }, [loadDetail]);

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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate("/org-structure")}
              >
                <Network className="mr-2 h-4 w-4" />
                View in Org Chart
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

        {/* Profile Completion Bar */}
        <div className="w-full">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Profile Completion</span>
            <span>{detail.employee.profile_completion_pct}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${detail.employee.profile_completion_pct}%` }}
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-border">
          <nav className="flex space-x-8">
            {[
              { id: "overview", label: "Overview", icon: User },
              { id: "documents", label: "Documents", icon: FolderOpen },
              { id: "history", label: "History", icon: History },
              { id: "goals", label: "Goals", icon: Target },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1">
          {activeTab === "overview" && (
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
                      <p className="text-xs uppercase text-muted-foreground">Employee Number</p>
                      <p className="text-sm text-foreground">{detail.employee.employee_number ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Job Title</p>
                      <p className="text-sm text-foreground">{detail.employee.job_title ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Department</p>
                      <p className="text-sm text-foreground">{detail.department?.name ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Employment Type</p>
                      <p className="text-sm text-foreground">
                        {detail.employee.employment_type ? 
                          detail.employee.employment_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
                          "—"
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Status</p>
                      <p className="text-sm text-foreground">
                        <span className={cn(
                          "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                          detail.employee.status === 'active' && "bg-green-100 text-green-800",
                          detail.employee.status === 'on_leave' && "bg-yellow-100 text-yellow-800",
                          detail.employee.status === 'terminated' && "bg-red-100 text-red-800",
                          detail.employee.status === 'inactive' && "bg-gray-100 text-gray-800"
                        )}>
                          {detail.employee.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Manager</p>
                      <p className="text-sm text-foreground">{managerLabel ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Start Date</p>
                      <p className="text-sm text-foreground">
                        {detail.employee.start_date ? 
                          format(new Date(detail.employee.start_date), "PPP") : 
                          "—"
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Work Location</p>
                      <p className="text-sm text-foreground">
                        {detail.employee.work_location ? 
                          detail.employee.work_location.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
                          "—"
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Phone (Work)</p>
                      <p className="text-sm text-foreground">{detail.employee.phone_work ?? "—"}</p>
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

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Compensation</p>
                        <p className="text-xs text-muted-foreground">
                          Salary information is only visible to authorized roles.
                        </p>
                      </div>
                    </div>
                    {detail.permissions.canViewCompensation ? (
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-xl border border-border/50 bg-background/60 p-3">
                          <p className="text-xs uppercase text-muted-foreground">Salary Amount</p>
                          <p className="text-sm text-foreground">
                        {formatMoney(detail.employee.salary_amount) ?? "—"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/50 bg-background/60 p-3">
                          <p className="text-xs uppercase text-muted-foreground">Currency</p>
                          <p className="text-sm text-foreground">
                            {detail.employee.salary_currency ?? "—"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/50 bg-background/60 p-3">
                          <p className="text-xs uppercase text-muted-foreground">Frequency</p>
                          <p className="text-sm text-foreground">
                            {detail.employee.salary_frequency
                              ? detail.employee.salary_frequency.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())
                              : "—"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                        Access to compensation details is restricted. Please contact an administrator if you believe this is an
                        error.
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Sensitive Data</p>
                        <p className="text-xs text-muted-foreground">
                          Bank details, tax identifiers, and privacy flags.
                        </p>
                      </div>
                    </div>
                    {detail.permissions.canViewSensitive ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-border/50 bg-background/60 p-3">
                          <p className="text-xs uppercase text-muted-foreground">Bank Account (Encrypted)</p>
                          <p className="text-sm text-foreground break-all">
                            {detail.employee.bank_account_encrypted ?? "—"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/50 bg-background/60 p-3">
                          <p className="text-xs uppercase text-muted-foreground">Tax Identifier (Encrypted)</p>
                          <p className="text-sm text-foreground break-all">
                            {detail.employee.tax_id_encrypted ?? "—"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/50 bg-background/60 p-3 md:col-span-2">
                          <p className="text-xs uppercase text-muted-foreground">Sensitive Data Flags</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {detail.employee.sensitive_data_flags &&
                            Object.keys(detail.employee.sensitive_data_flags).length > 0 ? (
                              Object.entries(detail.employee.sensitive_data_flags).map(([flag, enabled]) => (
                                <Badge
                                  key={flag}
                                  variant={enabled ? "default" : "outline"}
                                  className="rounded-full px-3 py-1 text-xs"
                                >
                                  {flag}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">No sensitive flags recorded.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                        Sensitive personal information is hidden for this account.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

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
                          <Select
                            value={editForm.managerId || EMPLOYEE_MANAGER_NONE_VALUE}
                            onValueChange={(value) =>
                              setEditForm((prev) => ({
                                ...prev,
                                managerId: value === EMPLOYEE_MANAGER_NONE_VALUE ? "" : value,
                              }))
                            }
                          >
                            <SelectTrigger className="h-12 w-full rounded-xl px-4">
                              <SelectValue placeholder="No manager" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={EMPLOYEE_MANAGER_NONE_VALUE}>No manager</SelectItem>
                              {detail.managerOptions
                                .filter((option) => option.id !== detail.employee.id)
                                .map((option) => (
                                  <SelectItem key={option.id} value={option.id}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button type="submit" disabled={editSaving}>
                          {editSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Save Changes
                        </Button>
                        <Button type="button" variant="outline" onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )}

          {activeTab === "documents" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Documents</CardTitle>
                  <p className="text-sm text-muted-foreground">Employee documents and files</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    onChange={handleUpload}
                    disabled={!detail.permissions.canManageDocuments || uploading}
                  />
                  {detail.permissions.canManageDocuments ? (
                    <div className="space-y-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Input
                          value={documentForm.description}
                          onChange={(event) =>
                            setDocumentForm((prev) => ({ ...prev, description: event.target.value }))
                          }
                          placeholder="Add a description (optional)"
                          disabled={uploading}
                        />
                        <Select
                          value={documentForm.category || DOCUMENT_CATEGORY_NONE_VALUE}
                          onValueChange={(value) =>
                            setDocumentForm((prev) => ({
                              ...prev,
                              category: value === DOCUMENT_CATEGORY_NONE_VALUE ? "" : value,
                            }))
                          }
                          disabled={uploading}
                        >
                          <SelectTrigger className="h-11 w-full rounded-xl px-3">
                            <SelectValue placeholder="Choose category" />
                          </SelectTrigger>
                          <SelectContent>
                            {documentCategories.map((option) => {
                              const optionValue = option.value || DOCUMENT_CATEGORY_NONE_VALUE;
                              return (
                                <SelectItem key={optionValue} value={optionValue}>
                                  {option.label}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <Input
                          type="date"
                          value={documentForm.expiryDate}
                          onChange={(event) =>
                            setDocumentForm((prev) => ({ ...prev, expiryDate: event.target.value }))
                          }
                          disabled={uploading}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleTriggerUpload}
                          disabled={uploading}
                          className="rounded-xl px-4"
                        >
                          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                          {uploading ? "Uploading..." : "Upload Document"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={
                            uploading ||
                            (documentForm.description.trim().length === 0 &&
                              documentForm.category === "" &&
                              documentForm.expiryDate === "")
                          }
                          onClick={() => setDocumentForm({ description: "", category: "", expiryDate: "" })}
                        >
                          Clear fields
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Supported formats: PDF, DOC/DOCX, images. Files are encrypted in storage.
                        </p>
                      </div>
                      {uploadError ? (
                        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                          {uploadError}
                        </div>
                      ) : null}
                      {uploadPct !== null ? (
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${uploadPct}%` }} />
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="space-y-4 rounded-2xl border border-border/60 bg-background/50 p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="flex flex-col gap-2">
                        <span className="text-xs uppercase text-muted-foreground">Category Filter</span>
                        <Select
                          value={documentFilters.category || DOCUMENT_CATEGORY_FILTER_ALL_VALUE}
                          onValueChange={(value) =>
                            setDocumentFilters((prev) => ({
                              ...prev,
                              category: value === DOCUMENT_CATEGORY_FILTER_ALL_VALUE ? "" : value,
                            }))
                          }
                          disabled={documentsState.loading}
                        >
                          <SelectTrigger className="h-11 w-full rounded-xl px-3">
                            <SelectValue placeholder="All categories" />
                          </SelectTrigger>
                          <SelectContent>
                            {documentCategoryFilterOptions.map((option) => {
                              const optionValue = option.value || DOCUMENT_CATEGORY_FILTER_ALL_VALUE;
                              return (
                                <SelectItem key={optionValue} value={optionValue}>
                                  {option.label}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-xs uppercase text-muted-foreground">Version State</span>
                        <Select
                          value={documentFilters.status}
                          onValueChange={(value) =>
                            setDocumentFilters((prev) => ({
                              ...prev,
                              status: value as DocumentStatusFilter,
                            }))
                          }
                          disabled={documentsState.loading}
                        >
                          <SelectTrigger className="h-11 w-full rounded-xl px-3">
                            <SelectValue placeholder="All versions" />
                          </SelectTrigger>
                          <SelectContent>
                            {documentStatusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-xs uppercase text-muted-foreground">Expiry Status</span>
                        <Select
                          value={documentFilters.expiry}
                          onValueChange={(value) =>
                            setDocumentFilters((prev) => ({
                              ...prev,
                              expiry: value as DocumentExpiryFilter,
                            }))
                          }
                          disabled={documentsState.loading}
                        >
                          <SelectTrigger className="h-11 w-full rounded-xl px-3">
                            <SelectValue placeholder="Any expiry" />
                          </SelectTrigger>
                          <SelectContent>
                            {documentExpiryOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!hasDocumentFilters && !documentsState.loading}
                        onClick={resetDocumentFilters}
                      >
                        Clear filters
                      </Button>
                      {documentsState.loading ? (
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Updating view…
                        </span>
                      ) : null}
                      {!documentsState.loading && !hasDocumentFilters ? (
                        <span>Showing all documents</span>
                      ) : null}
                    </div>
                  </div>

                  {documentsState.error ? (
                    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {documentsState.error}
                    </div>
                  ) : null}

                  {documentError ? (
                    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {documentError}
                    </div>
                  ) : null}

                  {documentsState.stats ? (
                    <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
                      {[
                        { label: "Total Files", value: documentsState.stats.total },
                        { label: "Current Versions", value: documentsState.stats.current },
                        { label: "Archived", value: documentsState.stats.archived },
                        { label: "Expiring Soon", value: documentsState.stats.expiringSoon },
                        { label: "Expired", value: documentsState.stats.expired },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="rounded-2xl border border-border/60 bg-card/70 p-3 text-center shadow-sm"
                        >
                          <p className="text-xs uppercase text-muted-foreground">{stat.label}</p>
                          <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {documentsState.stats && Object.keys(documentsState.stats.categories).length > 0 ? (
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {Object.entries(documentsState.stats.categories).map(([category, count]) => (
                        <span
                          key={category}
                          className="rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-foreground"
                        >
                          {(categoryLabelMap[category] ?? category).replace(/_/g, " ").replace(/\b\w/g, (letter) =>
                            letter.toUpperCase()
                          )}
                          : {count}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {documentsState.items.length > 0 ? (
                    <div className="space-y-4">
                      {documentsState.items.map((doc) => {
                        const uploadedAt = formatDate(doc.uploaded_at, "PPP p");
                        const expiryAt = formatDate(doc.expiry_date ?? undefined, "PPP");
                        const categoryLabel =
                          doc.category && categoryLabelMap[doc.category]
                            ? categoryLabelMap[doc.category]
                            : doc.category ?? undefined;
                        const downloading = downloadingDocId === doc.id;
                        const deleting = deletingDocId === doc.id;
                        return (
                          <div
                            key={doc.id}
                            className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="space-y-3">
                              <div className="flex items-start gap-3">
                                <FileText className="mt-1 h-5 w-5 text-primary" />
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-foreground">{doc.file_name}</p>
                                    <Badge variant={doc.is_current ? "default" : "outline"}>
                                      {doc.is_current ? "Current Version" : "Archived"}
                                    </Badge>
                                    <Badge variant="outline">v{doc.version}</Badge>
                                  </div>
                                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    <span>{formatFileSize(doc.file_size)}</span>
                                    {uploadedAt ? <span>• Uploaded {uploadedAt}</span> : null}
                                    {expiryAt ? <span>• Expires {expiryAt}</span> : null}
                                    {categoryLabel && categoryLabel !== "No Category" ? (
                                      <span>• {categoryLabel}</span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                              {doc.description ? (
                                <p className="text-sm text-muted-foreground">{doc.description}</p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadDocument(doc)}
                                disabled={downloading}
                                className="rounded-xl"
                              >
                                {downloading ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="mr-2 h-4 w-4" />
                                )}
                                Download
                              </Button>
                              {detail.permissions.canManageDocuments ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteDocument(doc)}
                                  disabled={deleting}
                                  className="rounded-xl text-destructive hover:text-destructive"
                                >
                                  {deleting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="mr-2 h-4 w-4" />
                                  )}
                                  Delete
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 py-8 text-center text-sm text-muted-foreground">
                      {hasDocumentFilters ? "No documents match the selected filters." : "No documents uploaded yet."}
                      {detail.permissions.canManageDocuments && !hasDocumentFilters ? (
                        <span className="mt-2 block text-xs text-muted-foreground/80">
                          Use the upload controls above to add contracts, certifications, or other files.
                        </span>
                      ) : null}
                      {hasDocumentFilters ? (
                        <span className="mt-2 block text-xs text-muted-foreground/80">
                          Try adjusting your filters or{" "}
                          <button type="button" className="underline" onClick={resetDocumentFilters}>
                            reset them
                          </button>
                          .
                        </span>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>HR Notes</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Private annotations for HR and managers. Not visible to employees.
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void refreshNotes()} disabled={notesState.loading}>
                    {notesState.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {detail.permissions.canManageDocuments ? (
                    <form onSubmit={handleSubmitNote} className="space-y-3 rounded-2xl border border-border/60 bg-muted/15 p-4">
                      <Textarea
                        value={noteBody}
                        onChange={(event) => {
                          setNoteBody(event.target.value);
                          if (noteFormError) setNoteFormError(null);
                        }}
                        placeholder="Add a confidential HR note..."
                        disabled={noteSaving}
                        className="min-h-[100px] resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                      {noteFormError ? (
                        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                          {noteFormError}
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Notes are timestamped with your user account.</p>
                        <Button type="submit" disabled={noteSaving || noteBody.trim().length === 0}>
                          {noteSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                          Save Note
                        </Button>
                      </div>
                    </form>
                  ) : null}

                  {notesState.error ? (
                    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {notesState.error}
                    </div>
                  ) : null}

                  {notesState.items.length > 0 ? (
                    <div className="space-y-3">
                      {notesState.items.map((note) => {
                        const createdAt = format(new Date(note.created_at), "PPP p");
                        const updatedAt = note.updated_at && note.updated_at !== note.created_at ? format(new Date(note.updated_at), "PPP p") : null;
                        const deleting = noteDeletingId === note.id;
                        return (
                          <div
                            key={note.id}
                            className="space-y-3 rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm"
                          >
                            <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">{note.body}</p>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span>Added {createdAt}</span>
                              {updatedAt ? <span>• Updated {updatedAt}</span> : null}
                              {detail.permissions.canManageDocuments ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="ml-auto rounded-xl text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteNote(note.id)}
                                  disabled={deleting}
                                >
                                  {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                  Delete
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 py-8 text-center text-sm text-muted-foreground">
                      No HR notes yet. {detail.permissions.canManageDocuments ? "Use the form above to capture context for this employee." : "Notes require HR permissions."}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Audit History</CardTitle>
                      <p className="text-sm text-muted-foreground">Track all changes to this employee record</p>
                    </div>
                    {detail.auditLog && detail.auditLog.length > 0 && detail.permissions.canViewAuditLog && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            const session = (await supabase.auth.getSession()).data.session;
                            const token = session?.access_token;
                            if (!token) return;
                            
                            const csvContent = [
                              ["Timestamp", "Action", "Field", "Before", "After", "Reason", "IP Address", "User Agent"].join(","),
                              ...detail.auditLog!.map((log) => {
                                const formatCsvValue = (val: any) => {
                                  if (val === null || val === undefined) return "";
                                  if (typeof val === "object") {
                                    try {
                                      return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
                                    } catch {
                                      return `"${String(val).replace(/"/g, '""')}"`;
                                    }
                                  }
                                  return `"${String(val).replace(/"/g, '""')}"`;
                                };
                                return [
                                  format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
                                  log.action,
                                  log.field_name || "",
                                  formatCsvValue(log.old_value),
                                  formatCsvValue(log.new_value),
                                  log.change_reason || "",
                                  log.ip_address || "",
                                  log.user_agent || "",
                                ].join(",");
                              }),
                            ].join("\n");
                            
                            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = `audit-log-${detail.employee.name.replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.csv`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                          } catch (error) {
                            console.error("Failed to export audit log:", error);
                          }
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {detail.auditLog && detail.auditLog.length > 0 ? (
                    <div className="space-y-4">
                      {detail.auditLog.map((log) => {
                        const formatValue = (value: any): string => {
                          if (value === null || value === undefined) return "—";
                          if (typeof value === "object") {
                            try {
                              return JSON.stringify(value, null, 2);
                            } catch {
                              return String(value);
                            }
                          }
                          return String(value);
                        };
                        const hasValueChange = log.old_value !== null || log.new_value !== null;
                        return (
                          <div key={log.id} className="flex items-start gap-3 p-4 border rounded-lg bg-card">
                            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium capitalize">{log.action}</span>
                                {log.field_name && (
                                  <span className="text-muted-foreground">• {log.field_name}</span>
                                )}
                                <span className="text-muted-foreground ml-auto">
                                  {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a")}
                                </span>
                              </div>
                              {hasValueChange && (
                                <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
                                  {log.old_value !== null && (
                                    <div className="space-y-1">
                                      <div className="font-medium text-muted-foreground">Before</div>
                                      <div className="p-2 rounded bg-muted/50 font-mono text-xs break-words">
                                        {formatValue(log.old_value)}
                                      </div>
                                    </div>
                                  )}
                                  {log.new_value !== null && (
                                    <div className="space-y-1">
                                      <div className="font-medium text-muted-foreground">After</div>
                                      <div className="p-2 rounded bg-muted/50 font-mono text-xs break-words">
                                        {formatValue(log.new_value)}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              {log.change_reason && (
                                <p className="text-sm text-muted-foreground mt-2 italic">
                                  Reason: {log.change_reason}
                                </p>
                              )}
                              {(log.ip_address || log.user_agent) && (
                                <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                                  {log.ip_address && log.ip_address !== "unknown" && (
                                    <span>IP: {log.ip_address}</span>
                                  )}
                                  {log.user_agent && log.user_agent !== "unknown" && (
                                    <span className="truncate max-w-xs" title={log.user_agent}>
                                      {log.user_agent}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No audit history available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "goals" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Goals & Growth</CardTitle>
                  <p className="text-sm text-muted-foreground">Employee goals and development</p>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Button onClick={() => navigate(`/employees/${detail.employee.id}/growth`)}>
                      <Target className="mr-2 h-4 w-4" />
                      View Goals & Growth
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
