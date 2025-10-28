import { z } from "zod";

export const TimeEntrySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  clock_in_at: z.string(),
  clock_out_at: z.string().nullable(),
  duration_minutes: z.number().int().nonnegative().nullable(),
  location: z.record(z.string(), z.any()).nullable().optional(),
  break_minutes: z.number().int().nonnegative().default(0),
  project_task: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  entry_type: z.enum(['clock', 'manual']).default('clock'),
  approval_status: z.enum(['approved', 'pending', 'rejected']).default('approved'),
  approver_user_id: z.string().uuid().nullable(),
  approved_at: z.string().nullable(),
  edited_by: z.string().uuid().nullable(),
  updated_at: z.string(),
  created_at: z.string(),
});
export type TimeEntry = z.infer<typeof TimeEntrySchema>;

export const TimeOffStatusEnum = z.enum(["pending", "approved", "denied", "cancelled"]);
export const LeaveTypeEnum = z.enum(["vacation", "sick", "personal", "unpaid", "other"]);

export const TimeOffRequestSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  start_date: z.string(),
  end_date: z.string(),
  leave_type: LeaveTypeEnum,
  status: TimeOffStatusEnum,
  approver_user_id: z.string().uuid().nullable(),
  decided_at: z.string().nullable(),
  note: z.string().nullable().optional(),
  created_at: z.string(),
});
export type TimeOffRequest = z.infer<typeof TimeOffRequestSchema>;

export const CreateTimeOffRequestInputSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  leave_type: LeaveTypeEnum,
  note: z.string().max(1000).optional(),
});
export type CreateTimeOffRequestInput = z.infer<typeof CreateTimeOffRequestInputSchema>;

export const ApproveTimeOffRequestInputSchema = z.object({
  decision: z.enum(["approve", "deny"]).default("approve"),
});
export type ApproveTimeOffRequestInput = z.infer<typeof ApproveTimeOffRequestInputSchema>;

export const CalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: z.string(),
  end: z.string(),
  kind: z.enum(["time_off", "time_entry"]),
  userId: z.string().uuid(),
  leaveType: LeaveTypeEnum.optional(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CalendarRangeQuerySchema = z.object({
  start: z.string(),
  end: z.string(),
  teamId: z.string().uuid().optional(),
});
export type CalendarRangeQuery = z.infer<typeof CalendarRangeQuerySchema>;

export const TimeSummaryResponseSchema = z.object({
  hoursThisWeek: z.number().nonnegative(),
  targetHours: z.number().positive().default(40),
  activeEntry: TimeEntrySchema.nullable(),
  pto_balance_days: z.number().nonnegative().default(0),
  sick_balance_days: z.number().nonnegative().default(0),
});
export type TimeSummaryResponse = z.infer<typeof TimeSummaryResponseSchema>;

export const CalendarResponseSchema = z.object({
  events: z.array(CalendarEventSchema),
});
export type CalendarResponse = z.infer<typeof CalendarResponseSchema>;

// ==============================================
// Manual Time Entry Schemas
// ==============================================

export const ManualTimeEntryInputSchema = z.object({
  date: z.string(), // ISO date string
  start_time: z.string(), // ISO time string
  end_time: z.string(), // ISO time string
  break_minutes: z.number().int().min(0).max(1440).default(0), // Max 24 hours
  project_task: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});
export type ManualTimeEntryInput = z.infer<typeof ManualTimeEntryInputSchema>;

export const TimeEntryUpdateInputSchema = z.object({
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  break_minutes: z.number().int().min(0).max(1440).optional(),
  project_task: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  change_reason: z.string().max(200).optional(),
});
export type TimeEntryUpdateInput = z.infer<typeof TimeEntryUpdateInputSchema>;

export const TimeEntryApprovalInputSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().max(200).optional(),
});
export type TimeEntryApprovalInput = z.infer<typeof TimeEntryApprovalInputSchema>;

// ==============================================
// Overtime Schemas
// ==============================================

export const OvertimeBalanceSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  period: z.string(),
  regular_hours: z.number().nonnegative(),
  overtime_hours: z.number().nonnegative(),
  overtime_multiplier: z.number().min(1).max(3),
  carry_over_hours: z.number().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type OvertimeBalance = z.infer<typeof OvertimeBalanceSchema>;

export const OvertimeRuleSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  daily_threshold: z.number().min(0).max(24),
  weekly_threshold: z.number().min(0).max(168), // Max 7 days * 24 hours
  daily_multiplier: z.number().min(1).max(3),
  weekly_multiplier: z.number().min(1).max(3),
  is_default: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type OvertimeRule = z.infer<typeof OvertimeRuleSchema>;

export const OvertimeCalculationRequestSchema = z.object({
  user_id: z.string().uuid(),
  start_date: z.string(),
  end_date: z.string(),
});
export type OvertimeCalculationRequest = z.infer<typeof OvertimeCalculationRequestSchema>;

// ==============================================
// Time Entry List and Filter Schemas
// ==============================================

export const TimeEntryListQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: z.enum(['approved', 'pending', 'rejected']).optional(),
  entry_type: z.enum(['clock', 'manual']).optional(),
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

// ==============================================
// Manager Calendar Filter Schemas
// ==============================================

export const ManagerCalendarFilterSchema = z.object({
  start: z.string(),
  end: z.string(),
  user_ids: z.array(z.string().uuid()).optional(),
  status: z.enum(['all', 'clocked-in', 'not-clocked-in', 'on-leave', 'absent']).optional(),
  department_id: z.string().uuid().optional(),
  include_breaks: z.boolean().default(false),
  format: z.enum(['json', 'csv']).default('json'),
});
export type ManagerCalendarFilter = z.infer<typeof ManagerCalendarFilterSchema>;

export const TimeExportRequestSchema = z.object({
  format: z.enum(['csv', 'xlsx']).default('csv'),
  start_date: z.string(),
  end_date: z.string(),
  user_ids: z.array(z.string().uuid()).optional(),
  include_breaks: z.boolean().default(true),
  include_notes: z.boolean().default(true),
});
export type TimeExportRequest = z.infer<typeof TimeExportRequestSchema>;

// ==============================================
// Audit and Approval Schemas
// ==============================================

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
  entry_type: z.enum(['clock', 'manual']),
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

// ==============================================
// Team Summary Schemas
// ==============================================

export const TeamTimeSummarySchema = z.object({
  user_id: z.string().uuid(),
  employee_name: z.string(),
  employee_email: z.string().nullable(),
  total_hours: z.number().nonnegative(),
  regular_hours: z.number().nonnegative(),
  overtime_hours: z.number().nonnegative(),
  break_hours: z.number().nonnegative(),
  days_worked: z.number().int().nonnegative(),
  avg_daily_hours: z.number().nonnegative(),
  last_clock_in: z.string().nullable(),
  status: z.enum(['active', 'clocked-in', 'not-clocked-in', 'on-leave', 'absent']),
});
export type TeamTimeSummary = z.infer<typeof TeamTimeSummarySchema>;

export const TeamTimeSummaryResponseSchema = z.object({
  summaries: z.array(TeamTimeSummarySchema),
  period: z.object({
    start: z.string(),
    end: z.string(),
  }),
  total_team_hours: z.number().nonnegative(),
  total_overtime_hours: z.number().nonnegative(),
});
export type TeamTimeSummaryResponse = z.infer<typeof TeamTimeSummaryResponseSchema>;


