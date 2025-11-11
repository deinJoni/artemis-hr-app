import { z } from "zod";

import { TimeEntrySchema } from "./time-entry";

export const TimeEntryListQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: z.enum(["approved", "pending", "rejected"]).optional(),
  entry_type: z.enum(["clock", "manual"]).optional(),
  project_task: z.string().optional(),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(100).default(20),
});
export type TimeEntryListQuery = z.infer<typeof TimeEntryListQuerySchema>;

export const TimeEntryListResponseSchema = z.object({
  entries: z.array(TimeEntrySchema),
  pagination: z.object({
    page: z.number().int().min(1),
    page_size: z.number().int().min(1),
    total: z.number().int().min(0),
    total_pages: z.number().int().min(0),
  }),
});
export type TimeEntryListResponse = z.infer<typeof TimeEntryListResponseSchema>;

export const ManagerCalendarFilterSchema = z.object({
  start: z.string(),
  end: z.string(),
  user_ids: z.array(z.string().uuid()).optional(),
  status: z.enum(["all", "clocked-in", "not-clocked-in", "on-leave", "absent"]).optional(),
  department_id: z.string().uuid().optional(),
  include_breaks: z.boolean().default(false),
  format: z.enum(["json", "csv"]).default("json"),
});
export type ManagerCalendarFilter = z.infer<typeof ManagerCalendarFilterSchema>;

export const TimeExportRequestSchema = z.object({
  format: z.enum(["csv", "xlsx"]).default("csv"),
  start_date: z.string(),
  end_date: z.string(),
  user_ids: z.array(z.string().uuid()).optional(),
  include_breaks: z.boolean().default(true),
  include_notes: z.boolean().default(true),
});
export type TimeExportRequest = z.infer<typeof TimeExportRequestSchema>;

export const TimeEntryAuditSchema = z.object({
  id: z.string().uuid(),
  time_entry_id: z.string().uuid(),
  changed_by: z.string().uuid(),
  field_name: z.string(),
  old_value: z.any().nullable(),
  new_value: z.any().nullable(),
  change_reason: z.string().nullable(),
  created_at: z.string(),
});
export type TimeEntryAudit = z.infer<typeof TimeEntryAuditSchema>;

export const PendingApprovalSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  employee_name: z.string(),
  employee_email: z.string().nullable(),
  employee_number: z.string().nullable(),
  clock_in_at: z.string(),
  clock_out_at: z.string().nullable(),
  duration_minutes: z.number().int().nonnegative().nullable(),
  break_minutes: z.number().int().nonnegative(),
  project_task: z.string().nullable(),
  notes: z.string().nullable(),
  entry_type: z.enum(["clock", "manual"]),
  created_at: z.string(),
  manager_id: z.string().uuid().nullable(),
  manager_name: z.string().nullable(),
});
export type PendingApproval = z.infer<typeof PendingApprovalSchema>;

export const PendingApprovalsResponseSchema = z.object({
  approvals: z.array(PendingApprovalSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    page_size: z.number().int().min(1),
    total: z.number().int().min(0),
  }),
});
export type PendingApprovalsResponse = z.infer<typeof PendingApprovalsResponseSchema>;
