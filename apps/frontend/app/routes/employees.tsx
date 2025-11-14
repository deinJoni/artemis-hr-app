import * as React from "react";
import { createPortal } from "react-dom";
import { useRevalidator } from "react-router";
import type { Route } from "./+types/employees";
import { Button } from "~/components/ui/button";
import { EmployeeDataTable } from "~/components/employees/data-table";
import { useEmployeesTable } from "~/hooks/use-employees-table";
import { supabase } from "~/lib/supabase";
import { EmployeeCreateInputSchema, type Employee, type EmployeeCustomFieldDef } from "@vibe/shared";
import { useEmployeeFieldDefs } from "~/hooks/use-employee-field-defs";
import { cn } from "~/lib/utils";
import { Loader2, Plus, RefreshCw, X, Filter, Download, Upload, Trash2, AlertCircle } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { ImportWizard } from "~/components/employees/import-wizard";
import { useToast } from "~/components/toast";
import type { BulkDeleteInput, BulkStatusUpdateInput, EmploymentStatus } from "@vibe/shared";
import { useTranslation } from "~/lib/i18n";

const employmentTypes = ["Full-time", "Part-time", "Contractor", "Intern", "Seasonal"] as const;
const salaryFrequencyOptions = ["per year", "per month", "per week", "per hour"] as const;
const currencyOptions = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;

const wizardSteps = [
  {
    id: "personal" as const,
    label: "Personal",
    description: "Core identity details",
    required: true,
  },
  {
    id: "job" as const,
    label: "Job",
    description: "Role & reporting",
    required: true,
  },
  {
    id: "compensation" as const,
    label: "Compensation",
    description: "Pay & payroll",
    required: false,
  },
  {
    id: "custom" as const,
    label: "Custom",
    description: "Additional information",
    required: false,
  },
] as const;

type WizardStepId = (typeof wizardSteps)[number]["id"];

type CreateWizardState = {
  personal: {
    fullName: string;
    personalEmail: string;
    phoneNumber: string;
    homeAddress: string;
  };
  job: {
    workEmail: string;
    jobTitle: string;
    department: string;
    managerId: string;
    startDate: string;
  };
  compensation: {
    employmentType: string;
    salary: string;
    salaryFrequency: string;
    currency: string;
    bankDetails: string;
  };
  custom: Record<string, unknown>;
};

const createInitialWizardState = (): CreateWizardState => ({
  personal: {
    fullName: "",
    personalEmail: "",
    phoneNumber: "",
    homeAddress: "",
  },
  job: {
    workEmail: "",
    jobTitle: "",
    department: "",
    managerId: "",
    startDate: "",
  },
  compensation: {
    employmentType: "",
    salary: "",
    salaryFrequency: salaryFrequencyOptions[0],
    currency: currencyOptions[0],
    bankDetails: "",
  },
  custom: {},
});

const sanitizeRecord = (record: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string") {
        return value.trim().length > 0;
      }
      return true;
    })
  );

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
    { title: "Employees | Artemis" },
    { name: "description", content: "Manage employees for your workspace." },
  ];
}

export default function Employees({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
  const revalidator = useRevalidator();
  const apiBaseUrl = React.useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);

  const [tenantId, setTenantId] = React.useState<string | null>(null);
  const [initializing, setInitializing] = React.useState(true);
  const [initError, setInitError] = React.useState<string | null>(null);
  const [mutationError, setMutationError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [createForm, setCreateForm] = React.useState<CreateWizardState>(() => createInitialWizardState());
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeStepIndex, setActiveStepIndex] = React.useState(0);
  const [wizardError, setWizardError] = React.useState<string | null>(null);
  
  // Filter states
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("");
  const [locationFilter, setLocationFilter] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [showFilters, setShowFilters] = React.useState(false);
  
  // Bulk action states
  const [selectedEmployees, setSelectedEmployees] = React.useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = React.useState(false);
  const [bulkStatusValue, setBulkStatusValue] = React.useState<EmploymentStatus | "">("");
  const [bulkStatusReason, setBulkStatusReason] = React.useState("");
  const [bulkActionLoading, setBulkActionLoading] = React.useState(false);
  const toast = useToast();
  
  // Department data for filter
  const [departments, setDepartments] = React.useState<Array<{ id: string; name: string }>>([]);
  
  // Office locations data for filter
  const [officeLocations, setOfficeLocations] = React.useState<Array<{ id: string; name: string }>>([]);
  
  // Import wizard state
  const [showImportWizard, setShowImportWizard] = React.useState(false);

  const {
    data,
    total,
    loading: tableLoading,
    error: tableError,
    pageIndex,
    setPageIndex,
    pageSize,
    setPageSize,
    sorting,
    setSorting,
    search,
    setSearch,
    refresh,
  } = useEmployeesTable({ 
    apiBaseUrl, 
    tenantId,
    departmentId: departmentFilter || undefined,
    officeLocationId: locationFilter || undefined,
    status: statusFilter || undefined,
  });

  const { fieldDefs, loading: defsLoading } = useEmployeeFieldDefs({ apiBaseUrl, tenantId });

  React.useEffect(() => {
    let cancelled = false;
    async function resolveTenant() {
      setInitializing(true);
      setInitError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Missing access token");
        const tenantRes = await fetch(`${apiBaseUrl}/api/tenants/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const tenantJson = (await tenantRes.json()) as { id?: string };
        if (!tenantRes.ok || typeof tenantJson?.id !== "string") throw new Error("Unable to resolve tenant");
        if (cancelled) return;
        setTenantId(tenantJson.id);
      } catch (e: unknown) {
        if (!cancelled) {
          setInitError(e instanceof Error ? e.message : "Unable to resolve workspace");
          setTenantId(null);
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }
    void resolveTenant();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  // Load departments for filter
  React.useEffect(() => {
    if (!tenantId) return;
    
    let cancelled = false;
    async function loadDepartments() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Missing access token");
        
        const deptRes = await fetch(`${apiBaseUrl}/api/departments/${tenantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const deptJson = await deptRes.json();
        if (!deptRes.ok) throw new Error(deptJson.error || "Unable to load departments");
        
        if (cancelled) return;
        setDepartments(deptJson.departments || []);
      } catch (e: unknown) {
        if (!cancelled) {
          console.error("Failed to load departments:", e);
        }
      }
    }
    void loadDepartments();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, tenantId]);

  // Load office locations for filter
  React.useEffect(() => {
    if (!tenantId) return;
    
    let cancelled = false;
    async function loadLocations() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Missing access token");
        
        const locRes = await fetch(`${apiBaseUrl}/api/office-locations/${tenantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const locJson = await locRes.json();
        if (!locRes.ok) throw new Error(locJson.error || "Unable to load office locations");
        
        if (cancelled) return;
        setOfficeLocations(locJson.locations || []);
      } catch (e: unknown) {
        if (!cancelled) {
          console.error("Failed to load office locations:", e);
        }
      }
    }
    void loadLocations();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, tenantId]);

  const handleRefresh = React.useCallback(() => {
    void refresh();
  }, [refresh]);

  const handleExport = React.useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Missing access token");
      
      const params = new URLSearchParams();
      if (departmentFilter) params.append('departmentId', departmentFilter);
      if (statusFilter) params.append('status', statusFilter);
      
      const response = await fetch(`${apiBaseUrl}/api/employees/${tenantId}/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        console.error("Export failed:", response.status, errorText);
        throw new Error(`Export failed: ${errorText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `employees_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Export failed";
      console.error("Export error:", error);
      setMutationError(message);
    }
  }, [apiBaseUrl, tenantId, departmentFilter, statusFilter]);

  const handleBulkExport = React.useCallback(async () => {
    if (!tenantId || selectedEmployees.size === 0) return;
    
    setBulkActionLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Missing access token");
      
      // Export selected employees
      const response = await fetch(`${apiBaseUrl}/api/employees/${tenantId}/export?employeeIds=${Array.from(selectedEmployees).join(',')}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Export failed");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `selected_employees_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.showToast(`Successfully exported ${selectedEmployees.size} employee(s)`, "success");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Export failed";
      toast.showToast(message, "error");
      console.error("Export error:", error);
    } finally {
      setBulkActionLoading(false);
    }
  }, [apiBaseUrl, tenantId, selectedEmployees, toast]);

  const handleBulkDelete = React.useCallback(async () => {
    if (!tenantId || selectedEmployees.size === 0) return;
    
    setBulkActionLoading(true);
    setBulkDeleteDialogOpen(false);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Missing access token");
      
      const payload: BulkDeleteInput = {
        employee_ids: Array.from(selectedEmployees),
      };
      
      const response = await fetch(`${apiBaseUrl}/api/employees/${tenantId}/bulk`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Bulk delete failed");
      }
      
      if (data.error_count > 0) {
        const errorMsg = data.errors?.map((e: { employee_id: string; error: string }) => 
          `Employee ${e.employee_id}: ${e.error}`
        ).join(', ') || "Some deletions failed";
        toast.showToast(`${data.success_count} deleted, ${data.error_count} failed: ${errorMsg}`, "error");
      } else {
        toast.showToast(`Successfully deleted ${data.success_count} employee(s)`, "success");
      }
      
      setSelectedEmployees(new Set());
      await refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Bulk delete failed";
      toast.showToast(message, "error");
      console.error("Bulk delete error:", error);
    } finally {
      setBulkActionLoading(false);
    }
  }, [apiBaseUrl, tenantId, selectedEmployees, refresh, toast]);

  const handleBulkStatusUpdate = React.useCallback(async () => {
    if (!tenantId || selectedEmployees.size === 0 || !bulkStatusValue) return;
    
    setBulkActionLoading(true);
    setBulkStatusDialogOpen(false);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Missing access token");
      
      const payload: BulkStatusUpdateInput = {
        employee_ids: Array.from(selectedEmployees),
        status: bulkStatusValue,
        reason: bulkStatusReason.trim() || undefined,
      };
      
      const response = await fetch(`${apiBaseUrl}/api/employees/${tenantId}/bulk/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Bulk status update failed");
      }
      
      if (data.error_count > 0) {
        const errorMsg = data.errors?.map((e: { employee_id: string; error: string }) => 
          `Employee ${e.employee_id}: ${e.error}`
        ).join(', ') || "Some updates failed";
        toast.showToast(`${data.success_count} updated, ${data.error_count} failed: ${errorMsg}`, "error");
      } else {
        toast.showToast(`Successfully updated ${data.success_count} employee(s) to ${bulkStatusValue}`, "success");
      }
      
      setSelectedEmployees(new Set());
      setBulkStatusValue("");
      setBulkStatusReason("");
      await refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Bulk status update failed";
      toast.showToast(message, "error");
      console.error("Bulk status update error:", error);
    } finally {
      setBulkActionLoading(false);
    }
  }, [apiBaseUrl, tenantId, selectedEmployees, bulkStatusValue, bulkStatusReason, refresh, toast]);

  const handleSelectEmployee = React.useCallback((employeeId: string, selected: boolean) => {
    setSelectedEmployees(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(employeeId);
      } else {
        newSet.delete(employeeId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = React.useCallback((selected: boolean) => {
    if (selected) {
      setSelectedEmployees(new Set(data.map(emp => emp.id)));
    } else {
      setSelectedEmployees(new Set());
    }
  }, [data]);

  const resetWizardState = React.useCallback(() => {
    setCreateForm(createInitialWizardState());
    setActiveStepIndex(0);
    setWizardError(null);
  }, []);

  const validateStepById = React.useCallback(
    (id: WizardStepId): string | null => {
      if (id === "personal") {
        if (!createForm.personal.fullName.trim()) {
          return "Please add the employee's full name.";
        }
        if (!createForm.personal.personalEmail.trim()) {
          return "Personal email is required.";
        }
      }
      if (id === "job") {
        if (!createForm.job.workEmail.trim()) {
          return "Work email is required.";
        }
        if (!createForm.job.jobTitle.trim()) {
          return "Job title is required.";
        }
      }
      return null;
    },
    [createForm]
  );

  const handleOpenWizard = React.useCallback(() => {
    if (!tenantId) return;
    resetWizardState();
    setWizardError(null);
    setDrawerOpen(true);
  }, [resetWizardState, tenantId]);

  const handleCloseWizard = React.useCallback(() => {
    setDrawerOpen(false);
    resetWizardState();
  }, [resetWizardState]);

  const handleNextStep = React.useCallback(() => {
    const currentStepId = wizardSteps[activeStepIndex]?.id;
    if (!currentStepId) return;
    const validationMessage = validateStepById(currentStepId);
    if (validationMessage) {
      setWizardError(validationMessage);
      return;
    }
    setWizardError(null);
    setActiveStepIndex((index) => Math.min(wizardSteps.length - 1, index + 1));
  }, [activeStepIndex, validateStepById]);

  const handleBackStep = React.useCallback(() => {
    setWizardError(null);
    setActiveStepIndex((index) => Math.max(0, index - 1));
  }, []);

  const handleCreate = React.useCallback(
    async ({ closeAfter = true }: { closeAfter?: boolean } = {}) => {
      if (!tenantId) return;
      const firstInvalid = wizardSteps.find((step) => step.required && validateStepById(step.id));
      if (firstInvalid) {
        setWizardError(validateStepById(firstInvalid.id));
        const targetIndex = wizardSteps.findIndex((step) => step.id === firstInvalid.id);
        if (targetIndex >= 0) {
          setActiveStepIndex(targetIndex);
        }
        return;
      }

      setWizardError(null);
      setMutationError(null);
      setCreating(true);

      try {
        // Map employment type from form value to enum value
        const employmentTypeMap: Record<string, "full_time" | "part_time" | "contract" | "intern" | "seasonal" | undefined> = {
          "Full-time": "full_time",
          "Part-time": "part_time",
          "Contractor": "contract",
          "Intern": "intern",
          "Seasonal": "seasonal",
        };

        // Map salary frequency from form value to enum value
        const salaryFrequencyMap: Record<string, "yearly" | "monthly" | "weekly" | "hourly" | undefined> = {
          "per year": "yearly",
          "per month": "monthly",
          "per week": "weekly",
          "per hour": "hourly",
        };

        // Extract job metadata fields (these go as top-level fields, not custom_fields)
        // Debug: Log form state
        console.log('Form state:', {
          jobTitle: createForm.job.jobTitle,
          jobTitleTrimmed: createForm.job.jobTitle.trim(),
          department: createForm.job.department,
          startDate: createForm.job.startDate,
        });
        
        // Extract jobTitle - keep as string if not empty, otherwise undefined
        // IMPORTANT: Use explicit check for empty string to ensure truthy check works
        const jobTitleRaw = createForm.job.jobTitle.trim();
        const jobTitle = jobTitleRaw.length > 0 ? jobTitleRaw : undefined;
        // Debug: Log the actual form value
        console.log('createForm.job.jobTitle:', createForm.job.jobTitle);
        console.log('jobTitleRaw after trim:', jobTitleRaw);
        console.log('jobTitle final value:', jobTitle);
        console.log('jobTitle is truthy?', !!jobTitle);
        const departmentId = createForm.job.department.trim() || undefined;
        const startDate = createForm.job.startDate.trim() || undefined;
        const employmentType = createForm.compensation.employmentType 
          ? employmentTypeMap[createForm.compensation.employmentType] 
          : undefined;
        const salaryAmount = createForm.compensation.salary.trim() 
          ? parseFloat(createForm.compensation.salary) 
          : undefined;
        const salaryCurrency = createForm.compensation.currency.trim() || undefined;
        const salaryFrequency = createForm.compensation.salaryFrequency 
          ? salaryFrequencyMap[createForm.compensation.salaryFrequency] 
          : undefined;
        
        // Debug: Log extracted values
        console.log('Extracted values:', {
          jobTitle,
          departmentId,
          startDate,
          employmentType,
          salaryAmount,
          salaryCurrency,
          salaryFrequency,
        });

        // Keep only truly custom fields in custom_fields
        const derivedCustomFields = sanitizeRecord({
          personal_email: createForm.personal.personalEmail,
          phone_number: createForm.personal.phoneNumber,
          home_address: createForm.personal.homeAddress,
          bank_details: createForm.compensation.bankDetails,
        });

        const dynamicCustomFields = sanitizeRecord(createForm.custom);
        const combinedCustomFields = { ...derivedCustomFields, ...dynamicCustomFields };

        // Build payload with job metadata fields
        // Include fields only when they have values (not empty strings or undefined)
        const payloadData: Record<string, unknown> = {
          tenant_id: tenantId,
          email: createForm.job.workEmail.trim(),
          name: createForm.personal.fullName.trim(),
        };

        // Add optional fields only when they have values
        if (createForm.job.managerId) {
          payloadData.manager_id = createForm.job.managerId;
        }
        if (jobTitle) {
          payloadData.job_title = jobTitle;
        }
        if (departmentId) {
          payloadData.department_id = departmentId;
        }
        if (startDate) {
          payloadData.start_date = startDate;
        }
        if (employmentType) {
          payloadData.employment_type = employmentType;
        }
        if (salaryAmount !== undefined && !isNaN(salaryAmount)) {
          payloadData.salary_amount = salaryAmount;
        }
        if (salaryCurrency) {
          payloadData.salary_currency = salaryCurrency;
        }
        if (salaryFrequency) {
          payloadData.salary_frequency = salaryFrequency;
        }
        if (Object.keys(combinedCustomFields).length > 0) {
          payloadData.custom_fields = combinedCustomFields;
        }

        // Debug: Log payload before Zod parsing
        console.log('Payload before Zod parse:', payloadData);
        
        const payload = EmployeeCreateInputSchema.parse(payloadData);
        
        // Debug: Log payload after Zod parsing
        console.log('Payload after Zod parse:', payload);

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Missing access token");
        
        // Debug: Log the final payload being sent
        const finalPayloadString = JSON.stringify(payload);
        console.log('Final payload string being sent:', finalPayloadString);
        console.log('Payload object keys:', Object.keys(payload));
        console.log('job_title in payload:', payload.job_title);
        
        const response = await fetch(`${apiBaseUrl}/api/employees/${tenantId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: finalPayloadString,
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData?.error || response.statusText || "Unable to create employee";
          throw new Error(errorMessage);
        }

        setMutationError(null);
        resetWizardState();
        if (closeAfter) {
          setDrawerOpen(false);
        }
        await refresh();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unable to create employee";
        setWizardError(message);
        setMutationError(message);
      } finally {
        setCreating(false);
      }
    },
    [apiBaseUrl, createForm, refresh, resetWizardState, tenantId, validateStepById]
  );

  const dataLength = data.length;

  const handleRemove = React.useCallback(
    async (employee: Employee) => {
      if (!tenantId) return;
      setMutationError(null);
      setRemovingId(employee.id);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Missing access token");
        const response = await fetch(`${apiBaseUrl}/api/employees/${tenantId}/${employee.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Unable to delete employee");

        const isLastItemOnPage =
          total > 0 && total === pageIndex * pageSize + 1 && pageIndex > 0 && dataLength === 1;

        if (isLastItemOnPage) {
          setPageIndex((current) => Math.max(0, current - 1));
        } else {
          await refresh();
        }
      } catch (e: unknown) {
        setMutationError(e instanceof Error ? e.message : "Unable to delete employee");
      } finally {
        setRemovingId((current) => (current === employee.id ? null : current));
      }
    },
    [apiBaseUrl, dataLength, pageIndex, pageSize, refresh, setPageIndex, tenantId, total]
  );

  const managerOptions = React.useMemo(
    () =>
      data.map((employee) => ({
        id: employee.id,
        label: employee.name ? employee.name : employee.email,
      })),
    [data]
  );

  if (initializing) {
    return (
      <div className="flex flex-1 items-center justify-center py-20 text-sm text-muted-foreground">
        {t("employees.loadingEmployees")}
      </div>
    );
  }

  const currentStep = wizardSteps[activeStepIndex] ?? wizardSteps[0];
  const isFirstStep = activeStepIndex === 0;
  const isLastStep = activeStepIndex === wizardSteps.length - 1;

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-4">
          <div>
            <h1 className="text-4xl font-semibold text-foreground">{t("employees.title")}</h1>
            <p className="text-base text-muted-foreground">
              {t("employees.description")}
            </p>
          </div>
          
          {/* Search and Actions */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur-sm md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-xl">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("employees.searchPlaceholder")}
                className="h-12 w-full rounded-xl border border-input bg-background pl-12 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleRefresh}
                disabled={tableLoading}
                className="h-12 rounded-xl border border-input"
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", tableLoading && "animate-spin")} />
                {t("common.refresh")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleExport}
                disabled={!tenantId}
                className="h-12 rounded-xl border border-input"
              >
                <Download className="mr-2 h-4 w-4" />
                {t("common.export")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setShowImportWizard(true)}
                disabled={!tenantId}
                className="h-12 rounded-xl border border-input"
              >
                <Upload className="mr-2 h-4 w-4" />
                {t("common.import")}
              </Button>
              <Button
                type="button"
                size="lg"
                className="h-12 rounded-xl bg-orange-500 text-orange-50 hover:bg-orange-500/90"
                onClick={handleOpenWizard}
                disabled={!tenantId || defsLoading}
              >
                <Plus className="mr-2 h-5 w-5" />
                {t("employees.addEmployee")}
              </Button>
            </div>
          </div>
          
          {/* Filters and Bulk Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="h-10"
              >
                <Filter className="mr-2 h-4 w-4" />
                {t("common.filter")}
                {(departmentFilter || locationFilter || statusFilter) && (
                  <Badge variant="secondary" className="ml-2">
                    {(departmentFilter ? 1 : 0) + (locationFilter ? 1 : 0) + (statusFilter ? 1 : 0)}
                  </Badge>
                )}
              </Button>
              
              {selectedEmployees.size > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {selectedEmployees.size} {t("employees.selected")}
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBulkExport}
                    disabled={bulkActionLoading}
                    className="h-10"
                  >
                    {bulkActionLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {t("common.export")}
                  </Button>
                  <Dialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={bulkActionLoading}
                        className="h-10"
                      >
                        {t("employees.changeStatus")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("employees.statusChange")} {selectedEmployees.size} {t("employees.employees")}</DialogTitle>
                        <DialogDescription>
                          {t("employees.selectStatus")}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="bulk-status">{t("common.status")} *</Label>
                          <Select
                            value={bulkStatusValue}
                            onValueChange={(value) => setBulkStatusValue(value as EmploymentStatus)}
                          >
                            <SelectTrigger id="bulk-status">
                              <SelectValue placeholder={t("employees.selectStatus")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">{t("common.active")}</SelectItem>
                              <SelectItem value="on_leave">{t("leave.requests")}</SelectItem>
                              <SelectItem value="terminated">{t("common.delete")}</SelectItem>
                              <SelectItem value="inactive">{t("common.inactive")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="bulk-status-reason">{t("leave.reason")} ({t("common.optional")})</Label>
                          <Textarea
                            id="bulk-status-reason"
                            placeholder={t("employees.reasonForStatusChange")}
                            value={bulkStatusReason}
                            onChange={(e) => setBulkStatusReason(e.target.value)}
                            rows={3}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setBulkStatusDialogOpen(false)}>
                            {t("common.cancel")}
                          </Button>
                          <Button
                            onClick={handleBulkStatusUpdate}
                            disabled={!bulkStatusValue || bulkActionLoading}
                          >
                            {bulkActionLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t("common.updating")}
                              </>
                            ) : (
                              t("employees.changeStatus")
                            )}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={bulkActionLoading}
                        className="h-10 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t("common.delete")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("common.delete")} {selectedEmployees.size} {t("employees.employees")}?</DialogTitle>
                        <DialogDescription>
                          {t("employees.confirmDelete")}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span>{t("common.warning")}</span>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)}>
                          {t("common.cancel")}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleBulkDelete}
                          disabled={bulkActionLoading}
                        >
                          {bulkActionLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t("common.deleting")}
                            </>
                          ) : (
                            t("common.confirm") + " " + t("common.delete")
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedEmployees(new Set())}
                    disabled={bulkActionLoading}
                    className="h-10"
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          {/* Filter Panel */}
          {showFilters && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">Department</label>
                  <select
                    value={departmentFilter}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDepartmentFilter(e.target.value)}
                    className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="">All Departments</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Office Location</label>
                  <select
                    value={locationFilter}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLocationFilter(e.target.value)}
                    className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="">All Locations</option>
                    {officeLocations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                    className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="terminated">Terminated</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDepartmentFilter("");
                      setLocationFilter("");
                      setStatusFilter("");
                    }}
                    className="h-10"
                  >
                    {t("common.clear")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </header>

        {initError || mutationError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {initError ?? mutationError}
          </div>
        ) : null}

        <section className="flex flex-1 flex-col rounded-2xl border border-border/60 bg-card/80 p-6 shadow-lg">
          <EmployeeDataTable
            data={data}
            total={total}
            loading={tableLoading}
            error={tableError}
            fieldDefs={fieldDefs}
            pageIndex={pageIndex}
            setPageIndex={setPageIndex}
            pageSize={pageSize}
            setPageSize={setPageSize}
            sorting={sorting}
            setSorting={setSorting}
            search={search}
            setSearch={setSearch}
            onRefresh={handleRefresh}
            onRemove={handleRemove}
            removingId={removingId}
            toolbar={null}
            selectedEmployees={selectedEmployees}
            onSelectEmployee={handleSelectEmployee}
            onSelectAll={handleSelectAll}
            departmentFilter={departmentFilter}
            statusFilter={statusFilter}
          />
        </section>
      </div>

      <SlideOver open={drawerOpen} onClose={handleCloseWizard} dismissDisabled={creating}>
        <div className="flex h-full w-full flex-col bg-background">
          <div className="flex items-start justify-between border-b border-border/60 px-6 py-6">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Create a New Employee Profile</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Follow the guided steps to onboard a team member without losing your place.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleCloseWizard}
              disabled={creating}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="border-b border-border/60 px-6 py-5">
            <WizardProgress steps={wizardSteps} currentStep={activeStepIndex} />
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{currentStep.label} Details</h3>
                <p className="text-sm text-muted-foreground">{currentStep.description}</p>
              </div>

              {wizardError ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {wizardError}
                </div>
              ) : null}

              {currentStep.id === "personal" ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FieldGroup label={t("employees.fullName")} required>
                    <input
                      type="text"
                      value={createForm.personal.fullName}
                      onChange={(event) =>
                        setCreateForm((state) => ({
                          ...state,
                          personal: { ...state.personal, fullName: event.target.value },
                        }))
                      }
                      className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </FieldGroup>
                  <FieldGroup label={t("employees.personalEmail")} required>
                    <input
                      type="email"
                      value={createForm.personal.personalEmail}
                      onChange={(event) =>
                        setCreateForm((state) => ({
                          ...state,
                          personal: { ...state.personal, personalEmail: event.target.value },
                        }))
                      }
                      className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </FieldGroup>
                  <FieldGroup label={t("employees.phoneNumber")}>
                    <input
                      type="tel"
                      value={createForm.personal.phoneNumber}
                      onChange={(event) =>
                        setCreateForm((state) => ({
                          ...state,
                          personal: { ...state.personal, phoneNumber: event.target.value },
                        }))
                      }
                      className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </FieldGroup>
                  <FieldGroup label={t("employees.homeAddress")} className="md:col-span-2">
                    <textarea
                      value={createForm.personal.homeAddress}
                      onChange={(event) =>
                        setCreateForm((state) => ({
                          ...state,
                          personal: { ...state.personal, homeAddress: event.target.value },
                        }))
                      }
                      className="min-h-[96px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </FieldGroup>
                </div>
              ) : null}

              {currentStep.id === "job" ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FieldGroup label={t("employees.workEmail")} required>
                    <input
                      type="email"
                      value={createForm.job.workEmail}
                      onChange={(event) =>
                        setCreateForm((state) => ({
                          ...state,
                          job: { ...state.job, workEmail: event.target.value },
                        }))
                      }
                      className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </FieldGroup>
                  <FieldGroup label={t("employees.jobTitle")} required>
                    <input
                      type="text"
                      value={createForm.job.jobTitle}
                      onChange={(event) =>
                        setCreateForm((state) => ({
                          ...state,
                          job: { ...state.job, jobTitle: event.target.value },
                        }))
                      }
                      className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </FieldGroup>
                  <FieldGroup label={t("employees.department")}>
                    <select
                      value={createForm.job.department}
                      onChange={(event) =>
                        setCreateForm((state) => ({
                          ...state,
                          job: { ...state.job, department: event.target.value },
                        }))
                      }
                      className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Select department...</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </FieldGroup>
                  <FieldGroup label={t("employees.manager")}>
                    <select
                      value={createForm.job.managerId}
                      onChange={(event) =>
                        setCreateForm((state) => ({
                          ...state,
                          job: { ...state.job, managerId: event.target.value },
                        }))
                      }
                      className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Select manager...</option>
                      {managerOptions.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.label}
                        </option>
                      ))}
                    </select>
                  </FieldGroup>
                  <FieldGroup label={t("employees.startDate")}>
                    <input
                      type="date"
                      value={createForm.job.startDate}
                      onChange={(event) =>
                        setCreateForm((state) => ({
                          ...state,
                          job: { ...state.job, startDate: event.target.value },
                        }))
                      }
                      className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </FieldGroup>
                </div>
              ) : null}

              {currentStep.id === "compensation" ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FieldGroup label={t("employees.employmentType")}>
                    <select
                      value={createForm.compensation.employmentType}
                      onChange={(event) =>
                        setCreateForm((state) => ({
                          ...state,
                          compensation: { ...state.compensation, employmentType: event.target.value },
                        }))
                      }
                      className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Select type...</option>
                      {employmentTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </FieldGroup>
                  <FieldGroup label={t("employees.salaryWage")}>
                    <input
                      type="text"
                      value={createForm.compensation.salary}
                      onChange={(event) =>
                        setCreateForm((state) => ({
                          ...state,
                          compensation: { ...state.compensation, salary: event.target.value },
                        }))
                      }
                      placeholder={t("employees.salaryPlaceholder")}
                      className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </FieldGroup>
                  <FieldGroup label={t("employees.compensationFrequency")}>
                    <select
                      value={createForm.compensation.salaryFrequency}
                      onChange={(event) =>
                        setCreateForm((state) => ({
                          ...state,
                          compensation: { ...state.compensation, salaryFrequency: event.target.value },
                        }))
                      }
                      className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      {salaryFrequencyOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </FieldGroup>
                  <FieldGroup label={t("employees.currency")}>
                    <select
                      value={createForm.compensation.currency}
                      onChange={(event) =>
                        setCreateForm((state) => ({
                          ...state,
                          compensation: { ...state.compensation, currency: event.target.value },
                        }))
                      }
                      className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      {currencyOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </FieldGroup>
                  <FieldGroup label={t("employees.bankDetails")} className="md:col-span-2">
                    <textarea
                      value={createForm.compensation.bankDetails}
                      onChange={(event) =>
                        setCreateForm((state) => ({
                          ...state,
                          compensation: { ...state.compensation, bankDetails: event.target.value },
                        }))
                      }
                      placeholder={t("employees.bankDetailsPlaceholder")}
                      className="min-h-[96px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </FieldGroup>
                </div>
              ) : null}

              {currentStep.id === "custom" ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-base font-semibold text-foreground">Additional Company Fields</h4>
                    <p className="text-sm text-muted-foreground">
                      Capture any extra onboarding details configured by your workspace admins.
                    </p>
                  </div>
                  {defsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading custom fields...
                    </div>
                  ) : fieldDefs.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {fieldDefs.map((def) => (
                        <DynamicFieldInput
                          key={def.id}
                          def={def}
                          value={createForm.custom[def.key]}
                          onChange={(value) =>
                            setCreateForm((state) => ({
                              ...state,
                              custom: { ...state.custom, [def.key]: value },
                            }))
                          }
                          disabled={creating}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                      No additional company fields are configured yet.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="sticky bottom-0 flex items-center gap-3 border-t border-border/60 bg-background px-6 py-5">
            <Button
              type="button"
              variant="outline"
              onClick={isFirstStep ? handleCloseWizard : handleBackStep}
              disabled={creating}
              className="rounded-xl"
            >
              {isFirstStep ? t("common.cancel") : t("common.back")}
            </Button>
            <div className="ml-auto flex items-center gap-3">
              {isLastStep ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void handleCreate({ closeAfter: false });
                    }}
                    disabled={creating}
                    className="rounded-xl"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.saving")}
                      </>
                    ) : (
                      t("common.save") + " & " + t("employees.addEmployee")
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      void handleCreate();
                    }}
                    disabled={creating}
                    className="rounded-xl bg-orange-500 text-orange-50 hover:bg-orange-500/90"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.creating")}
                      </>
                    ) : (
                      t("employees.addEmployee")
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={handleNextStep}
                  className="rounded-xl bg-orange-500 text-orange-50 hover:bg-orange-500/90"
                >
                  {t("common.next")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </SlideOver>
      
      {/* Import Wizard */}
      <ImportWizard
        isOpen={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        onComplete={() => {
          setShowImportWizard(false);
          // Refresh the employee list
          revalidator.revalidate();
        }}
        apiBaseUrl={apiBaseUrl}
        tenantId={tenantId || ""}
      />
    </div>
  );
}

type FieldGroupProps = {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
};

function FieldGroup({ label, children, required, className }: FieldGroupProps) {
  return (
    <label className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-semibold text-foreground">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </span>
      {children}
    </label>
  );
}

type WizardProgressProps = {
  steps: typeof wizardSteps;
  currentStep: number;
};

function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  return (
    <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, index) => {
        const status = index === currentStep ? "active" : index < currentStep ? "complete" : "upcoming";
        return (
          <li key={step.id} className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition",
                status === "active"
                  ? "border-primary bg-primary text-primary-foreground"
                  : status === "complete"
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border/60 bg-background text-muted-foreground"
              )}
            >
              {index + 1}
            </span>
            <div>
              <div className="text-sm font-semibold text-foreground">{step.label}</div>
              <div className="text-xs text-muted-foreground">{step.description}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

type SlideOverProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  dismissDisabled?: boolean;
};

function SlideOver({ open, onClose, children, dismissDisabled = false }: SlideOverProps) {
  const [mounted, setMounted] = React.useState(false);
  const [render, setRender] = React.useState(open);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (open) {
      setRender(true);
    } else {
      const timeout = setTimeout(() => setRender(false), 250);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [open]);

  React.useEffect(() => {
    if (!mounted) return;
    if (!open) {
      document.body.style.removeProperty("overflow");
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mounted, open]);

  React.useEffect(() => {
    if (!open || dismissDisabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dismissDisabled, onClose, open]);

  if (!mounted || !render) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex">
      <div
        className={cn(
          "fixed inset-0 bg-black/60 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => {
          if (!dismissDisabled) onClose();
        }}
      />
      <div
        className={cn(
          "ml-auto flex h-full w-full max-w-3xl transform drop-shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

function DynamicFieldInput({ def, value, onChange, disabled }: {
  def: EmployeeCustomFieldDef;
  value: unknown;
  onChange: (val: unknown) => void;
  disabled?: boolean;
}) {
  const id = `field-${def.key}`;
  const baseProps = {
    id,
    disabled,
    className: "h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20",
  } as const;
  return (
    <label className="flex flex-col gap-2 text-left">
      <span className="text-sm font-semibold text-foreground">{def.name}</span>
      {def.type === "text" ? (
        <input type="text" {...baseProps} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
      ) : def.type === "number" ? (
        <input
          type="number"
          {...baseProps}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      ) : def.type === "date" ? (
        <input type="date" {...baseProps} value={String(value ?? "").slice(0, 10)} onChange={(e) => onChange(e.target.value)} />
      ) : def.type === "boolean" ? (
        <select
          {...baseProps}
          value={String(Boolean(value))}
          onChange={(e) => onChange(e.target.value === "true")}
        >
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      ) : def.type === "select" ? (
        <select
          {...baseProps}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select...</option>
          {Array.isArray((def.options as any)?.choices)
            ? ((def.options as any).choices as string[]).map((opt: string) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))
            : null}
        </select>
      ) : (
        <input type="text" {...baseProps} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}
