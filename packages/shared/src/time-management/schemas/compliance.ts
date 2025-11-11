import { z } from "zod";

export const LeaveBalanceCheckResultSchema = z.object({
  valid: z.boolean(),
  error_code: z
    .enum(["NO_BALANCE_RECORD", "INSUFFICIENT_BALANCE", "MINIMUM_ENTITLEMENT_VIOLATION"])
    .optional(),
  message: z.string().optional(),
  available_balance: z.number().optional(),
  requested_days: z.number().optional(),
  current_balance: z.number().optional(),
  used_ytd: z.number().optional(),
  period_end: z.string().optional(),
  minimum_entitlement: z.number().optional(),
  would_remain: z.number().optional(),
});
export type LeaveBalanceCheckResult = z.infer<typeof LeaveBalanceCheckResultSchema>;

export const BlackoutPeriodCheckResultSchema = z.object({
  has_conflict: z.boolean(),
  blackout_period: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      start_date: z.string(),
      end_date: z.string(),
      reason: z.string().nullable(),
    })
    .optional(),
  message: z.string().optional(),
});
export type BlackoutPeriodCheckResult = z.infer<typeof BlackoutPeriodCheckResultSchema>;

export const LeaveComplianceValidationResultSchema = z.object({
  valid: z.boolean(),
  error_code: z
    .enum([
      "INVALID_LEAVE_TYPE",
      "NO_BALANCE_RECORD",
      "INSUFFICIENT_BALANCE",
      "MINIMUM_ENTITLEMENT_VIOLATION",
      "BLACKOUT_PERIOD_CONFLICT",
    ])
    .optional(),
  message: z.string().optional(),
  balance_check: LeaveBalanceCheckResultSchema.optional(),
  blackout_check: BlackoutPeriodCheckResultSchema.optional(),
  blackout_period: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      start_date: z.string(),
      end_date: z.string(),
      reason: z.string().nullable(),
    })
    .optional(),
});
export type LeaveComplianceValidationResult = z.infer<
  typeof LeaveComplianceValidationResultSchema
>;
