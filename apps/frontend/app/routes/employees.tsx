import * as React from "react";
import { createPortal } from "react-dom";
import type { Route } from "./+types/employees";
import { Button } from "~/components/ui/button";
import { EmployeeDataTable } from "~/components/employees/data-table";
import { useEmployeesTable } from "~/hooks/use-employees-table";
import { supabase } from "~/lib/supabase";
import { EmployeeCreateInputSchema, type Employee, type EmployeeCustomFieldDef } from "@vibe/shared";
import { useEmployeeFieldDefs } from "~/hooks/use-employee-field-defs";
import { cn } from "~/lib/utils";
import { Loader2, Plus, RefreshCw, X } from "lucide-react";

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
export function meta({}: Route.MetaArgs) {
  return [
    { title: "Employees | Artemis" },
    { name: "description", content: "Manage employees for your workspace." },
  ];
}

export default function Employees({ loaderData }: Route.ComponentProps) {
  const { baseUrl } = (loaderData ?? { baseUrl: "http://localhost:8787" }) as { baseUrl: string };
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
  } = useEmployeesTable({ apiBaseUrl, tenantId });

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

  const handleRefresh = React.useCallback(() => {
    void refresh();
  }, [refresh]);

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
        const derivedCustomFields = sanitizeRecord({
          personal_email: createForm.personal.personalEmail,
          phone_number: createForm.personal.phoneNumber,
          home_address: createForm.personal.homeAddress,
          job_title: createForm.job.jobTitle,
          department: createForm.job.department,
          manager_id: createForm.job.managerId || undefined,
          start_date: createForm.job.startDate,
          employment_type: createForm.compensation.employmentType,
          salary: createForm.compensation.salary,
          salary_frequency: createForm.compensation.salaryFrequency,
          salary_currency: createForm.compensation.currency,
          bank_details: createForm.compensation.bankDetails,
        });

        const dynamicCustomFields = sanitizeRecord(createForm.custom);
        const combinedCustomFields = { ...derivedCustomFields, ...dynamicCustomFields };

        const payload = EmployeeCreateInputSchema.parse({
          tenant_id: tenantId,
          email: createForm.job.workEmail.trim(),
          name: createForm.personal.fullName.trim(),
          manager_id: createForm.job.managerId ? createForm.job.managerId : undefined,
          custom_fields: Object.keys(combinedCustomFields).length > 0 ? combinedCustomFields : undefined,
        });

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Missing access token");
        const response = await fetch(`${apiBaseUrl}/api/employees/${tenantId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Unable to create employee");

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
        Loading employees...
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
            <h1 className="text-4xl font-semibold text-foreground">Employees</h1>
            <p className="text-base text-muted-foreground">
              A powerful command center to search, sort, and manage your people data.
            </p>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur-sm md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-xl">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, email, or role..."
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
                Refresh
              </Button>
              <Button
                type="button"
                size="lg"
                className="h-12 rounded-xl bg-orange-500 text-orange-50 hover:bg-orange-500/90"
                onClick={handleOpenWizard}
                disabled={!tenantId || defsLoading}
              >
                <Plus className="mr-2 h-5 w-5" />
                Add Employee
              </Button>
            </div>
          </div>
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
                  <FieldGroup label="Full Name" required>
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
                  <FieldGroup label="Personal Email" required>
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
                  <FieldGroup label="Phone Number">
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
                  <FieldGroup label="Home Address" className="md:col-span-2">
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
                  <FieldGroup label="Work Email" required>
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
                  <FieldGroup label="Job Title / Role" required>
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
                  <FieldGroup label="Department">
                    <input
                      type="text"
                      value={createForm.job.department}
                      onChange={(event) =>
                        setCreateForm((state) => ({
                          ...state,
                          job: { ...state.job, department: event.target.value },
                        }))
                      }
                      className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </FieldGroup>
                  <FieldGroup label="Manager">
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
                  <FieldGroup label="Start Date">
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
                  <FieldGroup label="Employment Type">
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
                  <FieldGroup label="Salary / Wage">
                    <input
                      type="text"
                      value={createForm.compensation.salary}
                      onChange={(event) =>
                        setCreateForm((state) => ({
                          ...state,
                          compensation: { ...state.compensation, salary: event.target.value },
                        }))
                      }
                      placeholder="e.g. 120000"
                      className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </FieldGroup>
                  <FieldGroup label="Compensation Frequency">
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
                  <FieldGroup label="Currency">
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
                  <FieldGroup label="Bank Details" className="md:col-span-2">
                    <textarea
                      value={createForm.compensation.bankDetails}
                      onChange={(event) =>
                        setCreateForm((state) => ({
                          ...state,
                          compensation: { ...state.compensation, bankDetails: event.target.value },
                        }))
                      }
                      placeholder="Account number, routing, IBAN, etc."
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
              {isFirstStep ? "Cancel" : "Back"}
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
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      "Save & Add Another"
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
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                      </>
                    ) : (
                      "Create Employee"
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={handleNextStep}
                  className="rounded-xl bg-orange-500 text-orange-50 hover:bg-orange-500/90"
                >
                  Next Step
                </Button>
              )}
            </div>
          </div>
        </div>
      </SlideOver>
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
