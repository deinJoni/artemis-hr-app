import { z } from "zod";

import { requireAtLeastOneField } from "../common/validators";

export const EmploymentStatusEnum = z.enum([
  "active",
  "on_leave",
  "terminated",
  "inactive",
]);
export type EmploymentStatus = z.infer<typeof EmploymentStatusEnum>;

export const EmploymentTypeEnum = z.enum([
  "full_time",
  "part_time",
  "contract",
  "intern",
  "seasonal",
]);
export type EmploymentType = z.infer<typeof EmploymentTypeEnum>;

export const WorkLocationEnum = z.enum(["office", "remote", "hybrid"]);
export type WorkLocation = z.infer<typeof WorkLocationEnum>;

export const SalaryFrequencyEnum = z.enum([
  "yearly",
  "monthly",
  "weekly",
  "hourly",
]);
export type SalaryFrequency = z.infer<typeof SalaryFrequencyEnum>;

export const DocumentCategoryEnum = z.enum([
  "contract",
  "certification",
  "id_document",
  "performance",
  "medical",
  "other",
]);
export type DocumentCategory = z.infer<typeof DocumentCategoryEnum>;

export const AuditActionEnum = z.enum([
  "created",
  "updated",
  "deleted",
  "document_added",
  "document_removed",
  "status_changed",
]);
export type AuditAction = z.infer<typeof AuditActionEnum>;

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
  employee_number: z.string().nullable(),
  date_of_birth: z.string().nullable(),
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
  office_location_id: z.string().uuid().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  status: EmploymentStatusEnum,
  salary_amount: z.number().nullable(),
  salary_currency: z.string().nullable(),
  salary_frequency: SalaryFrequencyEnum.nullable(),
  bank_account_encrypted: z.string().nullable(),
  tax_id_encrypted: z.string().nullable(),
  sensitive_data_flags: z.record(z.string(), z.boolean()).nullable(),
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
  employee_number: z.string().optional(),
  date_of_birth: z.string().optional(),
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
  office_location_id: z.string().uuid().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: EmploymentStatusEnum.optional(),
  salary_amount: z.number().optional(),
  salary_currency: z.string().optional(),
  salary_frequency: SalaryFrequencyEnum.optional(),
  bank_account_encrypted: z.string().optional(),
  tax_id_encrypted: z.string().optional(),
  sensitive_data_flags: z.record(z.string(), z.boolean()).optional(),
});
export type EmployeeCreateInput = z.infer<typeof EmployeeCreateInputSchema>;

export const EmployeeUpdateInputSchema = requireAtLeastOneField(
  z.object({
    email: z.string().email().optional(),
    name: z.string().min(1).optional(),
    manager_id: z.string().uuid().nullable().optional(),
    custom_fields: z.record(z.string(), z.any()).optional().nullable(),
    employee_number: z.string().optional(),
    date_of_birth: z.string().optional(),
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
    office_location_id: z.string().uuid().optional().nullable(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    status: EmploymentStatusEnum.optional(),
    salary_amount: z.number().optional(),
    salary_currency: z.string().optional(),
    salary_frequency: SalaryFrequencyEnum.optional(),
    bank_account_encrypted: z.string().optional(),
    tax_id_encrypted: z.string().optional(),
    sensitive_data_flags: z.record(z.string(), z.boolean()).optional().nullable(),
  })
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
  version: z.number().int().positive(),
  previous_version_id: z.string().uuid().nullable(),
  is_current: z.boolean(),
  category: DocumentCategoryEnum.nullable(),
  expiry_date: z.string().nullable(),
  updated_at: z.string(),
});
export type EmployeeDocument = z.infer<typeof EmployeeDocumentSchema>;

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

export const DepartmentUpdateInputSchema = requireAtLeastOneField(
  z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    parent_id: z.string().uuid().optional().nullable(),
    head_employee_id: z.string().uuid().optional().nullable(),
    cost_center: z.string().optional().nullable(),
  })
);
export type DepartmentUpdateInput = z.infer<typeof DepartmentUpdateInputSchema>;

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

export const OfficeLocationSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  address: z.record(z.string(), z.any()).nullable(),
  timezone: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type OfficeLocation = z.infer<typeof OfficeLocationSchema>;

export const OfficeLocationCreateInputSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(1),
  address: z.record(z.string(), z.any()).optional(),
  timezone: z.string().min(1).default("UTC"),
});
export type OfficeLocationCreateInput = z.infer<typeof OfficeLocationCreateInputSchema>;

export const OfficeLocationUpdateInputSchema = requireAtLeastOneField(
  z.object({
    name: z.string().min(1).optional(),
    address: z.record(z.string(), z.any()).optional().nullable(),
    timezone: z.string().min(1).optional(),
  })
);
export type OfficeLocationUpdateInput = z.infer<typeof OfficeLocationUpdateInputSchema>;

export const OfficeLocationListResponseSchema = z.object({
  locations: z.array(OfficeLocationSchema),
});
export type OfficeLocationListResponse = z.infer<typeof OfficeLocationListResponseSchema>;

export const TeamSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  team_lead_id: z.string().uuid().nullable(),
  department_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Team = z.infer<typeof TeamSchema>;

export const TeamMemberSchema = z.object({
  team_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  joined_at: z.string(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const TeamCreateInputSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  team_lead_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
});
export type TeamCreateInput = z.infer<typeof TeamCreateInputSchema>;

export const TeamUpdateInputSchema = requireAtLeastOneField(
  z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    team_lead_id: z.string().uuid().optional().nullable(),
    department_id: z.string().uuid().optional().nullable(),
  })
);
export type TeamUpdateInput = z.infer<typeof TeamUpdateInputSchema>;

export const TeamWithMembersSchema = TeamSchema.extend({
  member_count: z.number().int().min(0),
  members: z.array(EmployeeSchema).optional(),
});
export type TeamWithMembers = z.infer<typeof TeamWithMembersSchema>;

export const TeamListResponseSchema = z.object({
  teams: z.array(TeamWithMembersSchema),
});
export type TeamListResponse = z.infer<typeof TeamListResponseSchema>;

export const TeamMembersAddInputSchema = z.object({
  employee_ids: z.array(z.string().uuid()).min(1),
});
export type TeamMembersAddInput = z.infer<typeof TeamMembersAddInputSchema>;

export const DocumentExpiryNotificationSchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  notification_sent_at: z.string(),
  notification_type: z.enum(["expiring_soon", "expired"]),
  created_at: z.string(),
});
export type DocumentExpiryNotification = z.infer<
  typeof DocumentExpiryNotificationSchema
>;

export const ExpiringDocumentSchema = EmployeeDocumentSchema.extend({
  employee_name: z.string(),
  employee_id: z.string().uuid(),
});
export type ExpiringDocument = z.infer<typeof ExpiringDocumentSchema>;

export const ExpiringDocumentsResponseSchema = z.object({
  documents: z.array(ExpiringDocumentSchema),
  count: z.number().int().min(0),
});
export type ExpiringDocumentsResponse = z.infer<typeof ExpiringDocumentsResponseSchema>;

export const EmployeeAuditLogSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  changed_by: z.string().uuid(),
  action: AuditActionEnum,
  field_name: z.string().nullable(),
  old_value: z.any().nullable(),
  new_value: z.any().nullable(),
  change_reason: z.string().nullable(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  created_at: z.string(),
});
export type EmployeeAuditLog = z.infer<typeof EmployeeAuditLogSchema>;

export const EmployeeStatusHistorySchema = z.object({
  id: z.string().uuid(),
  employee_id: z.string().uuid(),
  status: EmploymentStatusEnum,
  effective_date: z.string(),
  reason: z.string().nullable(),
  created_by: z.string().uuid(),
  created_at: z.string(),
});
export type EmployeeStatusHistory = z.infer<typeof EmployeeStatusHistorySchema>;

export const EmployeeStatusHistoryCreateInputSchema = z.object({
  employee_id: z.string().uuid(),
  status: EmploymentStatusEnum,
  effective_date: z.string(),
  reason: z.string().optional(),
  created_by: z.string().uuid(),
});
export type EmployeeStatusHistoryCreateInput = z.infer<
  typeof EmployeeStatusHistoryCreateInputSchema
>;

export const EmployeeManagerOptionSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
});
export type EmployeeManagerOption = z.infer<typeof EmployeeManagerOptionSchema>;

export const EmployeeSortColumnEnum = z.enum(["name", "email", "created_at"]);

// Public employee schema - excludes sensitive fields (bank_account_encrypted, tax_id_encrypted)
export const EmployeePublicSchema = EmployeeSchema.omit({
  bank_account_encrypted: true,
  tax_id_encrypted: true,
});
export type EmployeePublic = z.infer<typeof EmployeePublicSchema>;

export const EmployeePublicListResponseSchema = z.object({
  employees: z.array(EmployeePublicSchema),
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
export type EmployeePublicListResponse = z.infer<typeof EmployeePublicListResponseSchema>;

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
  officeLocation: OfficeLocationSchema.nullable(),
  teams: z.array(TeamSchema),
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

export const DepartmentListResponseSchema = z.object({
  departments: z.array(DepartmentSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  }),
});
export type DepartmentListResponse = z.infer<typeof DepartmentListResponseSchema>;

export const DepartmentHierarchyResponseSchema = z.object({
  departments: z.array(DepartmentHierarchySchema),
});
export type DepartmentHierarchyResponse = z.infer<
  typeof DepartmentHierarchyResponseSchema
>;

export const EmployeeAuditLogResponseSchema = z.object({
  auditLog: z.array(EmployeeAuditLogSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  }),
});
export type EmployeeAuditLogResponse = z.infer<typeof EmployeeAuditLogResponseSchema>;

// Bulk operation schemas
export const BulkDeleteInputSchema = z.object({
  employee_ids: z.array(z.string().uuid()).min(1),
});
export type BulkDeleteInput = z.infer<typeof BulkDeleteInputSchema>;

export const BulkStatusUpdateInputSchema = z.object({
  employee_ids: z.array(z.string().uuid()).min(1),
  status: EmploymentStatusEnum,
  reason: z.string().max(500).optional(),
});
export type BulkStatusUpdateInput = z.infer<typeof BulkStatusUpdateInputSchema>;

export const BulkOperationResultSchema = z.object({
  success_count: z.number().int().min(0),
  error_count: z.number().int().min(0),
  errors: z.array(z.object({
    employee_id: z.string().uuid(),
    error: z.string(),
  })).optional(),
});
export type BulkOperationResult = z.infer<typeof BulkOperationResultSchema>;
