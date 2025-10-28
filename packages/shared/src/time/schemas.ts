import { z } from "zod";

export const TimeEntrySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  clock_in_at: z.string(),
  clock_out_at: z.string().nullable(),
  duration_minutes: z.number().int().nonnegative().nullable(),
  location: z.record(z.string(), z.any()).nullable().optional(),
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


