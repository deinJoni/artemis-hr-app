import { z } from "zod";

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
  weekly_threshold: z.number().min(0).max(168),
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

export const OvertimeRequestSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  start_date: z.string(),
  end_date: z.string(),
  estimated_hours: z.number().positive().max(168),
  reason: z.string().min(1).max(1000),
  status: z.enum(["pending", "approved", "denied", "cancelled"]).default("pending"),
  approver_user_id: z.string().uuid().nullable(),
  decided_at: z.string().nullable(),
  denial_reason: z.string().max(500).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type OvertimeRequest = z.infer<typeof OvertimeRequestSchema>;

export const CreateOvertimeRequestInputSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  estimated_hours: z.number().positive().max(168),
  reason: z.string().min(1).max(1000),
});
export type CreateOvertimeRequestInput = z.infer<typeof CreateOvertimeRequestInputSchema>;

export const OvertimeRequestApprovalInputSchema = z.object({
  decision: z.enum(["approve", "deny"]),
  denial_reason: z.string().max(500).optional(),
});
export type OvertimeRequestApprovalInput = z.infer<typeof OvertimeRequestApprovalInputSchema>;
