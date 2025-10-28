import { z } from "zod";

// Example API schemas and types shared between frontend and backend
// Chart
export const ExampleChartPointSchema = z.object({
  month: z.string(),
  users: z.number().finite().nonnegative(),
});
export type ExampleChartPoint = z.infer<typeof ExampleChartPointSchema>;

export const ExampleChartResponseSchema = z.object({
  chartData: z.array(ExampleChartPointSchema),
});
export type ExampleChartResponse = z.infer<typeof ExampleChartResponseSchema>;

// Table
export const ExamplePlanSchema = z.enum(["Starter", "Pro", "Business"]);
export type ExamplePlan = z.infer<typeof ExamplePlanSchema>;

export const ExampleTableRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  plan: ExamplePlanSchema,
});
export type ExampleTableRow = z.infer<typeof ExampleTableRowSchema>;

export const ExampleTableResponseSchema = z.object({
  tableData: z.array(ExampleTableRowSchema),
});
export type ExampleTableResponse = z.infer<typeof ExampleTableResponseSchema>;

// Tenants
export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  created_at: z.string(),
  company_name: z.string().nullable(),
  company_location: z.string().nullable(),
  company_size: z.string().nullable(),
  contact_name: z.string().nullable(),
  contact_email: z.string().email().nullable(),
  contact_phone: z.string().nullable(),
  needs_summary: z.string().nullable(),
  key_priorities: z.string().nullable(),
  onboarding_step: z.number().int().min(0),
  setup_completed: z.boolean(),
  activated_at: z.string().nullable(),
});
export type Tenant = z.infer<typeof TenantSchema>;

export const CreateTenantInputSchema = z.object({
  name: z.string().min(1),
});
export type CreateTenantInput = z.infer<typeof CreateTenantInputSchema>;

export const CreateTenantResponseSchema = TenantSchema;
export type CreateTenantResponse = z.infer<typeof CreateTenantResponseSchema>;

export const ProfileSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  display_name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const AccountBootstrapInputSchema = z.object({
  tenantName: z.string().min(1).max(120).optional(),
  displayName: z.string().min(1).max(120).optional(),
});
export type AccountBootstrapInput = z.infer<typeof AccountBootstrapInputSchema>;

export const AccountBootstrapResponseSchema = z.object({
  tenant: TenantSchema,
  profile: ProfileSchema,
  created: z.boolean(),
});
export type AccountBootstrapResponse = z.infer<typeof AccountBootstrapResponseSchema>;

export const OnboardingStepPayloadSchema = z.discriminatedUnion("step", [
  z.object({
    step: z.literal(1),
    companyName: z.string().min(1),
    companyLocation: z.string().min(1),
    companySize: z.string().min(1),
  }),
  z.object({
    step: z.literal(2),
    contactName: z.string().min(1),
    contactEmail: z.string().email(),
    contactPhone: z.string().min(3),
  }),
  z.object({
    step: z.literal(3),
    needsSummary: z.string().min(3),
    keyPriorities: z.string().min(3),
  }),
]);
export type OnboardingStepPayload = z.infer<typeof OnboardingStepPayloadSchema>;

export const OnboardingStepResponseSchema = z.object({
  tenant: TenantSchema,
});
export type OnboardingStepResponse = z.infer<typeof OnboardingStepResponseSchema>;

// ---------------------------
// Tenant settings (updates)
// ---------------------------

export const TenantUpdateInputSchema = z
  .object({
    company_name: z.string().min(1).optional().nullable(),
    company_location: z.string().min(1).optional().nullable(),
    company_size: z.string().min(1).optional().nullable(),
    contact_name: z.string().min(1).optional().nullable(),
    contact_email: z.string().email().optional().nullable(),
    contact_phone: z.string().min(1).optional().nullable(),
    needs_summary: z.string().min(1).optional().nullable(),
    key_priorities: z.string().min(1).optional().nullable(),
  })
  .refine(
    (obj: Record<string, unknown>) => Object.values(obj).some((v) => v !== undefined),
    { message: "At least one field must be provided" }
  );
export type TenantUpdateInput = z.infer<typeof TenantUpdateInputSchema>;

// ---------------------------
// Memberships (RBAC)
// ---------------------------

const AppRoleEnum = z.enum(["owner", "admin", "manager", "people_ops", "employee"]);

export const MembershipSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  role: AppRoleEnum,
  created_at: z.string(),
});
export type Membership = z.infer<typeof MembershipSchema>;

export const MembershipListItemSchema = MembershipSchema.extend({
  email: z.string().email().optional().nullable(),
});
export type MembershipListItem = z.infer<typeof MembershipListItemSchema>;

export const MembershipListResponseSchema = z.object({
  members: z.array(MembershipListItemSchema),
});
export type MembershipListResponse = z.infer<typeof MembershipListResponseSchema>;

export const MembershipCreateInputSchema = z.object({
  user_id: z.string().uuid(),
  role: AppRoleEnum,
});
export type MembershipCreateInput = z.infer<typeof MembershipCreateInputSchema>;

export const MembershipUpdateInputSchema = z.object({
  role: AppRoleEnum,
});
export type MembershipUpdateInput = z.infer<typeof MembershipUpdateInputSchema>;

// ---------------------------
// Employees (example domain)
// ---------------------------

// Enums for employee data
export const EmploymentStatusEnum = z.enum(["active", "on_leave", "terminated", "inactive"]);
export type EmploymentStatus = z.infer<typeof EmploymentStatusEnum>;

export const EmploymentTypeEnum = z.enum(["full_time", "part_time", "contract", "intern", "seasonal"]);
export type EmploymentType = z.infer<typeof EmploymentTypeEnum>;

export const WorkLocationEnum = z.enum(["office", "remote", "hybrid"]);
export type WorkLocation = z.infer<typeof WorkLocationEnum>;

export const SalaryFrequencyEnum = z.enum(["yearly", "monthly", "weekly", "hourly"]);
export type SalaryFrequency = z.infer<typeof SalaryFrequencyEnum>;

export const DocumentCategoryEnum = z.enum(["contract", "certification", "id_document", "performance", "medical", "other"]);
export type DocumentCategory = z.infer<typeof DocumentCategoryEnum>;

export const AuditActionEnum = z.enum(["created", "updated", "deleted", "document_added", "document_removed", "status_changed"]);
export type AuditAction = z.infer<typeof AuditActionEnum>;

// Address schema for structured home address
export const AddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  updated_at: z.string().optional(),
});
export type Address = z.infer<typeof AddressSchema>;

export const EmployeeSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  manager_id: z.string().uuid().nullable(),
  custom_fields: z.record(z.string(), z.any()).optional().nullable(),
  created_at: z.string(),
  // New HR fields
  employee_number: z.string().nullable(),
  date_of_birth: z.string().nullable(), // ISO date string
  nationality: z.string().nullable(),
  phone_personal: z.string().nullable(),
  phone_work: z.string().nullable(),
  emergency_contact_name: z.string().nullable(),
  emergency_contact_phone: z.string().nullable(),
  home_address: AddressSchema.nullable(),
  job_title: z.string().nullable(),
  department_id: z.string().uuid().nullable(),
  employment_type: EmploymentTypeEnum.nullable(),
  work_location: WorkLocationEnum.nullable(),
  start_date: z.string().nullable(), // ISO date string
  end_date: z.string().nullable(), // ISO date string
  status: EmploymentStatusEnum,
  salary_amount: z.number().nullable(),
  salary_currency: z.string().nullable(),
  salary_frequency: SalaryFrequencyEnum.nullable(),
  bank_account_encrypted: z.string().nullable(),
  tax_id_encrypted: z.string().nullable(),
  profile_completion_pct: z.number().int().min(0).max(100),
  updated_at: z.string(),
});
export type Employee = z.infer<typeof EmployeeSchema>;

export const EmployeeCreateInputSchema = z.object({
  tenant_id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  manager_id: z.string().uuid().nullable().optional(),
  custom_fields: z.record(z.string(), z.any()).optional(),
  // New HR fields
  employee_number: z.string().optional(),
  date_of_birth: z.string().optional(), // ISO date string
  nationality: z.string().optional(),
  phone_personal: z.string().optional(),
  phone_work: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  home_address: AddressSchema.optional(),
  job_title: z.string().optional(),
  department_id: z.string().uuid().optional(),
  employment_type: EmploymentTypeEnum.optional(),
  work_location: WorkLocationEnum.optional(),
  start_date: z.string().optional(), // ISO date string
  end_date: z.string().optional(), // ISO date string
  status: EmploymentStatusEnum.optional(),
  salary_amount: z.number().optional(),
  salary_currency: z.string().optional(),
  salary_frequency: SalaryFrequencyEnum.optional(),
  bank_account_encrypted: z.string().optional(),
  tax_id_encrypted: z.string().optional(),
});
export type EmployeeCreateInput = z.infer<typeof EmployeeCreateInputSchema>;

export const EmployeeUpdateInputSchema = z
  .object({
    email: z.string().email().optional(),
    name: z.string().min(1).optional(),
    manager_id: z.string().uuid().nullable().optional(),
    custom_fields: z.record(z.string(), z.any()).optional().nullable(),
    // New HR fields
    employee_number: z.string().optional(),
    date_of_birth: z.string().optional(), // ISO date string
    nationality: z.string().optional(),
    phone_personal: z.string().optional(),
    phone_work: z.string().optional(),
    emergency_contact_name: z.string().optional(),
    emergency_contact_phone: z.string().optional(),
    home_address: AddressSchema.optional().nullable(),
    job_title: z.string().optional(),
    department_id: z.string().uuid().optional().nullable(),
    employment_type: EmploymentTypeEnum.optional(),
    work_location: WorkLocationEnum.optional(),
    start_date: z.string().optional(), // ISO date string
    end_date: z.string().optional(), // ISO date string
    status: EmploymentStatusEnum.optional(),
    salary_amount: z.number().optional(),
    salary_currency: z.string().optional(),
    salary_frequency: SalaryFrequencyEnum.optional(),
    bank_account_encrypted: z.string().optional(),
    tax_id_encrypted: z.string().optional(),
  })
  .refine(
    (obj: Record<string, unknown>) => Object.values(obj).some((v) => v !== undefined),
    { message: "At least one field must be provided" }
  );
export type EmployeeUpdateInput = z.infer<typeof EmployeeUpdateInputSchema>;

export const EmployeeDocumentSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  storage_path: z.string(),
  file_name: z.string(),
  mime_type: z.string(),
  file_size: z.number().int().nonnegative(),
  uploaded_by: z.string().uuid(),
  uploaded_at: z.string(),
  description: z.string().nullable(),
  // New versioning fields
  version: z.number().int().positive(),
  previous_version_id: z.string().uuid().nullable(),
  is_current: z.boolean(),
  category: DocumentCategoryEnum.nullable(),
  expiry_date: z.string().nullable(), // ISO date string
  updated_at: z.string(),
});
export type EmployeeDocument = z.infer<typeof EmployeeDocumentSchema>;

// Department schemas
export const DepartmentSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  parent_id: z.string().uuid().nullable(),
  head_employee_id: z.string().uuid().nullable(),
  cost_center: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Department = z.infer<typeof DepartmentSchema>;

export const DepartmentCreateInputSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  parent_id: z.string().uuid().optional(),
  head_employee_id: z.string().uuid().optional(),
  cost_center: z.string().optional(),
});
export type DepartmentCreateInput = z.infer<typeof DepartmentCreateInputSchema>;

export const DepartmentUpdateInputSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    parent_id: z.string().uuid().optional().nullable(),
    head_employee_id: z.string().uuid().optional().nullable(),
    cost_center: z.string().optional().nullable(),
  })
  .refine(
    (obj: Record<string, unknown>) => Object.values(obj).some((v) => v !== undefined),
    { message: "At least one field must be provided" }
  );
export type DepartmentUpdateInput = z.infer<typeof DepartmentUpdateInputSchema>;

// Department hierarchy view
export const DepartmentHierarchySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  parent_id: z.string().uuid().nullable(),
  head_employee_id: z.string().uuid().nullable(),
  cost_center: z.string().nullable(),
  level: z.number().int().min(0),
  path: z.array(z.string().uuid()),
  full_path: z.string(),
  head_name: z.string().nullable(),
  head_email: z.string().nullable(),
  employee_count: z.number().int().min(0),
});
export type DepartmentHierarchy = z.infer<typeof DepartmentHierarchySchema>;

// Employee audit log schemas
export const EmployeeAuditLogSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  changed_by: z.string().uuid(),
  action: AuditActionEnum,
  field_name: z.string().nullable(),
  old_value: z.any().nullable(), // JSONB
  new_value: z.any().nullable(), // JSONB
  change_reason: z.string().nullable(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  created_at: z.string(),
});
export type EmployeeAuditLog = z.infer<typeof EmployeeAuditLogSchema>;

// Employee status history schemas
export const EmployeeStatusHistorySchema = z.object({
  id: z.string().uuid(),
  employee_id: z.string().uuid(),
  status: EmploymentStatusEnum,
  effective_date: z.string(), // ISO date string
  reason: z.string().nullable(),
  created_by: z.string().uuid(),
  created_at: z.string(),
});
export type EmployeeStatusHistory = z.infer<typeof EmployeeStatusHistorySchema>;

export const EmployeeStatusHistoryCreateInputSchema = z.object({
  employee_id: z.string().uuid(),
  status: EmploymentStatusEnum,
  effective_date: z.string(), // ISO date string
  reason: z.string().optional(),
  created_by: z.string().uuid(),
});
export type EmployeeStatusHistoryCreateInput = z.infer<typeof EmployeeStatusHistoryCreateInputSchema>;

export const EmployeeManagerOptionSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
});
export type EmployeeManagerOption = z.infer<typeof EmployeeManagerOptionSchema>;

export const EmployeeSortColumnEnum = z.enum(["name", "email", "created_at"]);
export const EmployeeListResponseSchema = z.object({
  employees: z.array(EmployeeSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  }),
  sort: z.object({
    column: EmployeeSortColumnEnum,
    order: z.enum(["asc", "desc"]),
  }),
  search: z.string().default(""),
});
export type EmployeeListResponse = z.infer<typeof EmployeeListResponseSchema>;

// Employee custom field definitions
export const EmployeeCustomFieldTypeEnum = z.enum([
  "text",
  "number",
  "date",
  "select",
  "boolean",
]);
export type EmployeeCustomFieldType = z.infer<typeof EmployeeCustomFieldTypeEnum>;

export const EmployeeCustomFieldDefSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1),
  key: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_\-]+$/, "Lowercase letters, numbers, dash or underscore only"),
  type: EmployeeCustomFieldTypeEnum,
  required: z.boolean().default(false),
  options: z.record(z.string(), z.any()).nullable().optional(),
  position: z.number().int().nonnegative().default(0),
  created_at: z.string(),
});
export type EmployeeCustomFieldDef = z.infer<typeof EmployeeCustomFieldDefSchema>;

export const EmployeeCustomFieldDefCreateSchema = EmployeeCustomFieldDefSchema.pick({
  tenant_id: true,
  name: true,
  key: true,
  type: true,
  required: true,
  options: true,
  position: true,
}).partial({ required: true, options: true, position: true });
export type EmployeeCustomFieldDefCreate = z.infer<
  typeof EmployeeCustomFieldDefCreateSchema
>;

export const EmployeeCustomFieldDefUpdateSchema = EmployeeCustomFieldDefSchema.pick({
  name: true,
  type: true,
  required: true,
  options: true,
  position: true,
});
export type EmployeeCustomFieldDefUpdate = z.infer<
  typeof EmployeeCustomFieldDefUpdateSchema
>;

export const EmployeeDetailResponseSchema = z.object({
  employee: EmployeeSchema,
  customFieldDefs: z.array(EmployeeCustomFieldDefSchema),
  documents: z.array(EmployeeDocumentSchema),
  managerOptions: z.array(EmployeeManagerOptionSchema),
  department: DepartmentSchema.nullable(),
  auditLog: z.array(EmployeeAuditLogSchema).optional(),
  statusHistory: z.array(EmployeeStatusHistorySchema).optional(),
  permissions: z.object({
    canEdit: z.boolean(),
    canManageDocuments: z.boolean(),
    canViewAuditLog: z.boolean(),
    canViewCompensation: z.boolean(),
    canEditCompensation: z.boolean(),
    canViewSensitive: z.boolean(),
    canEditSensitive: z.boolean(),
  }),
});
export type EmployeeDetailResponse = z.infer<typeof EmployeeDetailResponseSchema>;

// Department list response
export const DepartmentListResponseSchema = z.object({
  departments: z.array(DepartmentSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  }),
});
export type DepartmentListResponse = z.infer<typeof DepartmentListResponseSchema>;

// Department hierarchy response
export const DepartmentHierarchyResponseSchema = z.object({
  departments: z.array(DepartmentHierarchySchema),
});
export type DepartmentHierarchyResponse = z.infer<typeof DepartmentHierarchyResponseSchema>;

// Employee audit log response
export const EmployeeAuditLogResponseSchema = z.object({
  auditLog: z.array(EmployeeAuditLogSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  }),
});
export type EmployeeAuditLogResponse = z.infer<typeof EmployeeAuditLogResponseSchema>;

// CSV import schemas
export const CSVImportPreviewSchema = z.object({
  validRows: z.array(z.record(z.string(), z.any())),
  invalidRows: z.array(z.object({
    row: z.number().int().min(1),
    data: z.record(z.string(), z.any()),
    errors: z.array(z.string()),
  })),
  fieldMapping: z.record(z.string(), z.string()),
  totalRows: z.number().int().min(0),
});
export type CSVImportPreview = z.infer<typeof CSVImportPreviewSchema>;

export const CSVImportConfirmSchema = z.object({
  validRows: z.array(z.record(z.string(), z.any())),
  fieldMapping: z.record(z.string(), z.string()),
});
export type CSVImportConfirm = z.infer<typeof CSVImportConfirmSchema>;

export const CSVExportRequestSchema = z.object({
  tenantId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  status: EmploymentStatusEnum.optional(),
  includeSensitive: z.boolean().optional(),
  format: z.enum(['csv', 'xlsx']).optional(),
});
export type CSVExportRequest = z.infer<typeof CSVExportRequestSchema>;

export const CSVImportResultSchema = z.object({
  success: z.boolean(),
  created: z.number(),
  updated: z.number(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type CSVImportResult = z.infer<typeof CSVImportResultSchema>;

// ---------------------------
// Workflows
// ---------------------------

export const WorkflowKindEnum = z.enum(["onboarding", "offboarding"]);
export type WorkflowKind = z.infer<typeof WorkflowKindEnum>;

export const WorkflowStatusEnum = z.enum(["draft", "published", "archived"]);
export type WorkflowStatus = z.infer<typeof WorkflowStatusEnum>;

export const WorkflowTemplateSchema = z.object({
  id: z.string().uuid(),
  kind: WorkflowKindEnum,
  name: z.string(),
  description: z.string().nullable(),
  blocks: z.unknown(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type WorkflowTemplate = z.infer<typeof WorkflowTemplateSchema>;

export const WorkflowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  kind: WorkflowKindEnum,
  status: WorkflowStatusEnum,
  active_version_id: z.string().uuid().nullable(),
  created_by: z.string().uuid().nullable(),
  updated_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

export const WorkflowVersionSchema = z.object({
  id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  version_number: z.number().int().nonnegative(),
  is_active: z.boolean(),
  definition: z.unknown(),
  created_at: z.string(),
  created_by: z.string().uuid().nullable(),
  published_at: z.string().nullable(),
});
export type WorkflowVersion = z.infer<typeof WorkflowVersionSchema>;

export const WorkflowNodeTypeEnum = z.enum([
  "trigger",
  "action",
  "delay",
  "logic",
]);
export type WorkflowNodeType = z.infer<typeof WorkflowNodeTypeEnum>;

export const WorkflowNodeSchema = z.object({
  id: z.string().uuid(),
  version_id: z.string().uuid(),
  node_key: z.string(),
  type: WorkflowNodeTypeEnum,
  label: z.string().nullable(),
  config: z.unknown().nullable(),
  ui_position: z.unknown().nullable(),
  created_at: z.string(),
});
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;

export const WorkflowEdgeSchema = z.object({
  id: z.string().uuid(),
  version_id: z.string().uuid(),
  source_node_id: z.string().uuid(),
  target_node_id: z.string().uuid(),
  condition: z.unknown().nullable(),
  position: z.number().int().nonnegative(),
  created_at: z.string(),
});
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;

export const WorkflowRunStatusEnum = z.enum([
  "pending",
  "in_progress",
  "paused",
  "completed",
  "canceled",
  "failed",
]);
export type WorkflowRunStatus = z.infer<typeof WorkflowRunStatusEnum>;

export const WorkflowRunSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  version_id: z.string().uuid(),
  employee_id: z.string().uuid().nullable(),
  trigger_source: z.string().nullable(),
  status: WorkflowRunStatusEnum,
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  canceled_at: z.string().nullable(),
  failed_at: z.string().nullable(),
  last_error: z.string().nullable(),
  context: z.unknown().nullable(),
  created_at: z.string(),
});
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

export const WorkflowRunStepStatusEnum = z.enum([
  "pending",
  "queued",
  "waiting_input",
  "in_progress",
  "completed",
  "failed",
  "canceled",
]);
export type WorkflowRunStepStatus = z.infer<typeof WorkflowRunStepStatusEnum>;

export const WorkflowRunStepSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  node_id: z.string().uuid(),
  status: WorkflowRunStepStatusEnum,
  assigned_to: z.unknown().nullable(),
  due_at: z.string().nullable(),
  payload: z.unknown().nullable(),
  result: z.unknown().nullable(),
  error: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  updated_at: z.string(),
});
export type WorkflowRunStep = z.infer<typeof WorkflowRunStepSchema>;

export const WorkflowActionQueueSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  node_id: z.string().uuid().nullable(),
  resume_at: z.string(),
  attempts: z.number().int().nonnegative(),
  last_error: z.string().nullable(),
  metadata: z.unknown().nullable(),
  created_at: z.string(),
});
export type WorkflowActionQueue = z.infer<typeof WorkflowActionQueueSchema>;

export const WorkflowEventSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  event_type: z.string(),
  payload: z.unknown().nullable(),
  created_at: z.string(),
  created_by: z.string().uuid().nullable(),
});
export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>;

export const EmployeeJourneyViewSchema = z.object({
  run_id: z.string().uuid(),
  share_token: z.string().uuid(),
  hero_copy: z.string().nullable(),
  cta_label: z.string().nullable(),
  last_viewed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type EmployeeJourneyView = z.infer<typeof EmployeeJourneyViewSchema>;

export const WorkflowLatestVersionSchema = z.object({
  id: z.string().uuid(),
  version_number: z.number().int().nonnegative(),
  is_active: z.boolean(),
  published_at: z.string().nullable(),
});
export type WorkflowLatestVersion = z.infer<typeof WorkflowLatestVersionSchema>;

export const WorkflowListItemSchema = WorkflowSchema.extend({
  latestVersion: WorkflowLatestVersionSchema.optional(),
});
export type WorkflowListItem = z.infer<typeof WorkflowListItemSchema>;

export const WorkflowListResponseSchema = z.object({
  workflows: z.array(WorkflowListItemSchema),
});
export type WorkflowListResponse = z.infer<typeof WorkflowListResponseSchema>;

export const WorkflowVersionDetailSchema = z.object({
  id: z.string().uuid(),
  version_number: z.number().int().nonnegative(),
  is_active: z.boolean(),
  definition: z.unknown(),
  published_at: z.string().nullable(),
  created_at: z.string(),
});
export type WorkflowVersionDetail = z.infer<typeof WorkflowVersionDetailSchema>;

export const WorkflowDetailResponseSchema = z.object({
  workflow: WorkflowSchema,
  versions: z.array(WorkflowVersionDetailSchema),
});
export type WorkflowDetailResponse = z.infer<typeof WorkflowDetailResponseSchema>;

// ---------------------------
// Performance & Goals
// ---------------------------

export const GoalStatusEnum = z.enum(["todo", "in_progress", "completed"]);
export type GoalStatus = z.infer<typeof GoalStatusEnum>;

export const GoalKeyResultStatusEnum = z.enum(["pending", "in_progress", "achieved"]);
export type GoalKeyResultStatus = z.infer<typeof GoalKeyResultStatusEnum>;

export const GoalKeyResultSchema = z.object({
  id: z.string().uuid(),
  goalId: z.string().uuid(),
  label: z.string(),
  targetValue: z.number().nullable(),
  currentValue: z.number().nullable(),
  status: GoalKeyResultStatusEnum,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GoalKeyResult = z.infer<typeof GoalKeyResultSchema>;

export const GoalUpdateSchema = z.object({
  id: z.string().uuid(),
  goalId: z.string().uuid(),
  authorId: z.string().uuid(),
  body: z.string(),
  createdAt: z.string(),
});
export type GoalUpdate = z.infer<typeof GoalUpdateSchema>;

export const GoalSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  employeeId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: GoalStatusEnum,
  progressPct: z.number().min(0).max(100),
  dueDate: z.string().nullable(),
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  keyResults: z.array(GoalKeyResultSchema).optional(),
  updates: z.array(GoalUpdateSchema).optional(),
});
export type Goal = z.infer<typeof GoalSchema>;

export const GoalCreateInputSchema = z.object({
  tenantId: z.string().uuid(),
  employeeId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  status: GoalStatusEnum.optional(),
  progressPct: z
    .number()
    .min(0)
    .max(100)
    .optional(),
  dueDate: z.string().nullable().optional(),
  keyResults: z
    .array(
      z.object({
        label: z.string().min(1),
        targetValue: z.number().nullable().optional(),
        currentValue: z.number().nullable().optional(),
        status: GoalKeyResultStatusEnum.optional(),
      })
    )
    .optional(),
});
export type GoalCreateInput = z.infer<typeof GoalCreateInputSchema>;

export const GoalUpdateInputSchema = GoalCreateInputSchema.extend({
  goalId: z.string().uuid(),
}).partial({
  title: true,
  description: true,
  status: true,
  progressPct: true,
  dueDate: true,
  keyResults: true,
});
export type GoalUpdateInput = z.infer<typeof GoalUpdateInputSchema>;

export const GoalDeleteInputSchema = z.object({
  tenantId: z.string().uuid(),
  goalId: z.string().uuid(),
});
export type GoalDeleteInput = z.infer<typeof GoalDeleteInputSchema>;

export const GoalListResponseSchema = z.object({
  goals: z.array(GoalSchema),
});
export type GoalListResponse = z.infer<typeof GoalListResponseSchema>;

export const CheckInStatusEnum = z.enum(["draft", "completed"]);
export type CheckInStatus = z.infer<typeof CheckInStatusEnum>;

export const CheckInAgendaSchema = z.object({
  accomplishments: z.string().nullable(),
  priorities: z.string().nullable(),
  roadblocks: z.string().nullable(),
  notes: z.unknown().nullable().optional(),
  updatedAt: z.string().nullable(),
});
export type CheckInAgenda = z.infer<typeof CheckInAgendaSchema>;

export const CheckInSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  managerUserId: z.string().uuid(),
  employeeId: z.string().uuid(),
  status: CheckInStatusEnum,
  scheduledFor: z.string().nullable(),
  completedAt: z.string().nullable(),
  lastUpdatedBy: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  agenda: CheckInAgendaSchema.optional(),
  privateNote: z.string().nullable(),
});
export type CheckIn = z.infer<typeof CheckInSchema>;

export const CheckInCreateInputSchema = z.object({
  tenantId: z.string().uuid(),
  employeeId: z.string().uuid(),
  scheduledFor: z.string().nullable().optional(),
  agenda: CheckInAgendaSchema.optional(),
});
export type CheckInCreateInput = z.infer<typeof CheckInCreateInputSchema>;

export const CheckInUpdateInputSchema = z.object({
  tenantId: z.string().uuid(),
  checkInId: z.string().uuid(),
  status: CheckInStatusEnum.optional(),
  scheduledFor: z.string().nullable().optional(),
  agenda: CheckInAgendaSchema.optional(),
  privateNote: z.string().nullable().optional(),
});
export type CheckInUpdateInput = z.infer<typeof CheckInUpdateInputSchema>;

export const CheckInHistoryItemSchema = z.object({
  checkIn: CheckInSchema,
  agenda: CheckInAgendaSchema.optional(),
});
export type CheckInHistoryItem = z.infer<typeof CheckInHistoryItemSchema>;

export const CheckInHistoryResponseSchema = z.object({
  items: z.array(CheckInHistoryItemSchema),
});
export type CheckInHistoryResponse = z.infer<typeof CheckInHistoryResponseSchema>;

export const TeamMemberSummarySchema = z.object({
  employeeId: z.string().uuid(),
  employeeName: z.string(),
  employeeEmail: z.string().email().nullable(),
  avatarUrl: z.string().url().nullable(),
  managerEmployeeId: z.string().uuid().nullable(),
  totalGoals: z.number(),
  completedGoals: z.number(),
  activeGoals: z.number(),
  avgProgressPct: z.number(),
  lastCheckInAt: z.string().nullable(),
});
export type TeamMemberSummary = z.infer<typeof TeamMemberSummarySchema>;

export const MyTeamResponseSchema = z.object({
  team: z.array(TeamMemberSummarySchema),
});
export type MyTeamResponse = z.infer<typeof MyTeamResponseSchema>;

// ---------------------------
// Time Management
// ---------------------------

export {
  TimeEntrySchema,
  type TimeEntry,
  TimeOffRequestSchema,
  type TimeOffRequest,
  TimeOffStatusEnum,
  LeaveTypeEnum,
  CreateTimeOffRequestInputSchema,
  type CreateTimeOffRequestInput,
  ApproveTimeOffRequestInputSchema,
  type ApproveTimeOffRequestInput,
  CalendarEventSchema,
  type CalendarEvent,
  CalendarRangeQuerySchema,
  type CalendarRangeQuery,
  TimeSummaryResponseSchema,
  type TimeSummaryResponse,
  CalendarResponseSchema,
  type CalendarResponse,
  // Manual Time Entry
  ManualTimeEntryInputSchema,
  type ManualTimeEntryInput,
  TimeEntryUpdateInputSchema,
  type TimeEntryUpdateInput,
  TimeEntryApprovalInputSchema,
  type TimeEntryApprovalInput,
  // Overtime
  OvertimeBalanceSchema,
  type OvertimeBalance,
  OvertimeRuleSchema,
  type OvertimeRule,
  OvertimeCalculationRequestSchema,
  type OvertimeCalculationRequest,
  // Time Entry Lists
  TimeEntryListQuerySchema,
  type TimeEntryListQuery,
  TimeEntryListResponseSchema,
  type TimeEntryListResponse,
  // Manager Calendar
  ManagerCalendarFilterSchema,
  type ManagerCalendarFilter,
  TimeExportRequestSchema,
  type TimeExportRequest,
  // Audit and Approvals
  TimeEntryAuditSchema,
  type TimeEntryAudit,
  PendingApprovalSchema,
  type PendingApproval,
  PendingApprovalsResponseSchema,
  type PendingApprovalsResponse,
  // Team Summary
  TeamTimeSummarySchema,
  type TeamTimeSummary,
  TeamTimeSummaryResponseSchema,
  type TeamTimeSummaryResponse,
} from "./time/schemas";
