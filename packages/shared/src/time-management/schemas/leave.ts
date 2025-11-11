import { z } from "zod";

import { LeaveTypeEnum, TimeOffStatusEnum } from "../../common/enums";

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

export const LeaveTypeSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  code: z.string(),
  requires_approval: z.boolean(),
  requires_certificate: z.boolean(),
  allow_negative_balance: z.boolean(),
  max_balance: z.number().nullable(),
  minimum_entitlement_days: z.number().nullable(),
  enforce_minimum_entitlement: z.boolean(),
  color: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type LeaveType = z.infer<typeof LeaveTypeSchema>;

export const LeaveTypeCreateInputSchema = z.object({
  name: z.string().min(1).max(100),
  code: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Z_]+$/, "Code must be uppercase letters and underscores only"),
  requires_approval: z.boolean().default(true),
  requires_certificate: z.boolean().default(false),
  allow_negative_balance: z.boolean().default(false),
  max_balance: z.number().positive().nullable().optional(),
  minimum_entitlement_days: z.number().positive().nullable().optional(),
  enforce_minimum_entitlement: z.boolean().default(false),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color")
    .default("#3B82F6"),
});
export type LeaveTypeCreateInput = z.infer<typeof LeaveTypeCreateInputSchema>;

export const LeaveTypeUpdateInputSchema = LeaveTypeCreateInputSchema.partial().extend({
  is_active: z.boolean().optional(),
});
export type LeaveTypeUpdateInput = z.infer<typeof LeaveTypeUpdateInputSchema>;

export const LeaveBalanceSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  leave_type_id: z.string().uuid(),
  balance_days: z.number().nonnegative(),
  used_ytd: z.number().nonnegative(),
  period_start: z.string(),
  period_end: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type LeaveBalance = z.infer<typeof LeaveBalanceSchema>;

export const LeaveBalanceSummarySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  leave_type_id: z.string().uuid(),
  balance_days: z.number().nonnegative(),
  used_ytd: z.number().nonnegative(),
  period_start: z.string(),
  period_end: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  employee_name: z.string(),
  employee_email: z.string().nullable(),
  employee_number: z.string().nullable(),
  leave_type_name: z.string(),
  leave_type_code: z.string(),
  leave_type_color: z.string(),
  requires_approval: z.boolean(),
  requires_certificate: z.boolean(),
  allow_negative_balance: z.boolean(),
  remaining_balance: z.number(),
});
export type LeaveBalanceSummary = z.infer<typeof LeaveBalanceSummarySchema>;

export const LeaveBalanceAdjustmentInputSchema = z.object({
  leave_type_id: z.string().uuid(),
  adjustment_days: z.number(),
  reason: z.string().min(1).max(500),
  notes: z.string().max(1000).optional(),
});
export type LeaveBalanceAdjustmentInput = z.infer<typeof LeaveBalanceAdjustmentInputSchema>;

export const HolidayCalendarSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  date: z.string(),
  name: z.string(),
  is_half_day: z.boolean(),
  country: z.string().nullable(),
  region: z.string().nullable(),
  created_at: z.string(),
});
export type HolidayCalendar = z.infer<typeof HolidayCalendarSchema>;

export const HolidayCalendarCreateInputSchema = z.object({
  date: z.string(),
  name: z.string().min(1).max(200),
  is_half_day: z.boolean().default(false),
  country: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
});
export type HolidayCalendarCreateInput = z.infer<typeof HolidayCalendarCreateInputSchema>;

export const HolidayCalendarBulkImportSchema = z.object({
  holidays: z.array(HolidayCalendarCreateInputSchema),
  year: z.number().int().min(2020).max(2030),
});
export type HolidayCalendarBulkImport = z.infer<typeof HolidayCalendarBulkImportSchema>;

export const LeaveRequestEnhancedSchema = TimeOffRequestSchema.extend({
  days_count: z.number().nonnegative().nullable(),
  half_day_start: z.boolean().default(false),
  half_day_end: z.boolean().default(false),
  attachment_path: z.string().nullable(),
  denial_reason: z.string().nullable(),
  cancelled_by: z.string().uuid().nullable(),
  cancelled_at: z.string().nullable(),
  leave_type_id: z.string().uuid().nullable(),
  updated_at: z.string(),
  employee_name: z.string().optional(),
  employee_email: z.string().nullable().optional(),
  employee_number: z.string().nullable().optional(),
  leave_type_name: z.string().optional(),
  leave_type_color: z.string().optional(),
  requires_certificate: z.boolean().optional(),
  approver_name: z.string().nullable().optional(),
  cancelled_by_name: z.string().nullable().optional(),
});
export type LeaveRequestEnhanced = z.infer<typeof LeaveRequestEnhancedSchema>;

export const LeaveRequestListQuerySchema = z.object({
  employee_id: z.string().uuid().optional(),
  leave_type_id: z.string().uuid().optional(),
  status: TimeOffStatusEnum.optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  year: z.number().int().optional(),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(100).default(20),
});
export type LeaveRequestListQuery = z.infer<typeof LeaveRequestListQuerySchema>;

export const LeaveRequestListResponseSchema = z.object({
  requests: z.array(LeaveRequestEnhancedSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    page_size: z.number().int().min(1),
    total: z.number().int().min(0),
    total_pages: z.number().int().min(0),
  }),
});
export type LeaveRequestListResponse = z.infer<typeof LeaveRequestListResponseSchema>;

export const LeaveRequestAuditSchema = z.object({
  id: z.string().uuid(),
  request_id: z.string().uuid(),
  changed_by: z.string().uuid(),
  action: z.enum(["created", "approved", "denied", "cancelled", "modified"]),
  old_values: z.any().nullable(),
  new_values: z.any().nullable(),
  reason: z.string().nullable(),
  ip_address: z.string().nullable(),
  created_at: z.string(),
});
export type LeaveRequestAudit = z.infer<typeof LeaveRequestAuditSchema>;

export const TeamLeaveCalendarQuerySchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  employee_ids: z.array(z.string().uuid()).optional(),
  department_id: z.string().uuid().optional(),
  leave_type_ids: z.array(z.string().uuid()).optional(),
  status: z.array(TimeOffStatusEnum).optional(),
  include_holidays: z.boolean().default(true),
});
export type TeamLeaveCalendarQuery = z.infer<typeof TeamLeaveCalendarQuerySchema>;

export const TeamLeaveCalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: z.string(),
  end: z.string(),
  type: z.enum(["leave_request", "holiday"]),
  employee_id: z.string().uuid().optional(),
  employee_name: z.string().optional(),
  leave_type: z.string().optional(),
  leave_type_color: z.string().optional(),
  status: TimeOffStatusEnum.optional(),
  is_half_day: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});
export type TeamLeaveCalendarEvent = z.infer<typeof TeamLeaveCalendarEventSchema>;

export const TeamLeaveCalendarResponseSchema = z.object({
  events: z.array(TeamLeaveCalendarEventSchema),
  holidays: z.array(HolidayCalendarSchema),
  summary: z.object({
    total_requests: z.number().int().min(0),
    pending_requests: z.number().int().min(0),
    approved_requests: z.number().int().min(0),
    total_holidays: z.number().int().min(0),
  }),
});
export type TeamLeaveCalendarResponse = z.infer<typeof TeamLeaveCalendarResponseSchema>;

export const CreateLeaveRequestInputSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  leave_type_id: z.string().uuid(),
  half_day_start: z.boolean().default(false),
  half_day_end: z.boolean().default(false),
  note: z.string().max(1000).optional(),
  attachment: z.string().optional(),
});
export type CreateLeaveRequestInput = z.infer<typeof CreateLeaveRequestInputSchema>;

export const LeaveRequestApprovalInputSchema = z.object({
  decision: z.enum(["approve", "deny"]),
  reason: z.string().max(500).optional(),
});
export type LeaveRequestApprovalInput = z.infer<typeof LeaveRequestApprovalInputSchema>;

export const LeaveRequestUpdateInputSchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  half_day_start: z.boolean().optional(),
  half_day_end: z.boolean().optional(),
  note: z.string().max(1000).optional(),
  attachment: z.string().optional(),
});
export type LeaveRequestUpdateInput = z.infer<typeof LeaveRequestUpdateInputSchema>;
