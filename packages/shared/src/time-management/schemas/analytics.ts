import { z } from "zod";

export const LeaveUtilizationItemSchema = z.object({
  tenant_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  employee_name: z.string(),
  employee_email: z.string().nullable(),
  department_id: z.string().uuid().nullable(),
  department_name: z.string().nullable(),
  leave_type_id: z.string().uuid(),
  leave_type_name: z.string(),
  leave_type_code: z.string(),
  period_month: z.string(),
  period_year: z.string(),
  request_count: z.number().int(),
  days_taken: z.number(),
  balance_at_period_start: z.number(),
  used_ytd_total: z.number(),
  utilization_rate: z.number(),
});
export type LeaveUtilizationItem = z.infer<typeof LeaveUtilizationItemSchema>;

export const LeaveUtilizationResponseSchema = z.object({
  utilization: z.array(z.any()),
  group_by: z.enum(["employee", "department", "leave_type"]),
});
export type LeaveUtilizationResponse = z.infer<typeof LeaveUtilizationResponseSchema>;

export const LeaveTrendItemSchema = z.object({
  tenant_id: z.string().uuid(),
  month: z.string(),
  leave_type_id: z.string().uuid(),
  leave_type_name: z.string(),
  leave_type_code: z.string(),
  request_count: z.number().int(),
  employee_count: z.number().int(),
  total_days: z.number(),
  avg_days_per_request: z.number(),
  min_days: z.number(),
  max_days: z.number(),
});
export type LeaveTrendItem = z.infer<typeof LeaveTrendItemSchema>;

export const LeaveTrendsResponseSchema = z.object({
  trends: z.array(z.any()),
  granularity: z.enum(["month", "quarter", "year"]),
});
export type LeaveTrendsResponse = z.infer<typeof LeaveTrendsResponseSchema>;

export const LeaveSummaryResponseSchema = z.object({
  summary: z.object({
    total_days_taken: z.number(),
    average_per_employee: z.number(),
    pending_requests: z.number().int(),
    total_employees: z.number().int(),
    leave_type_breakdown: z.array(
      z.object({
        leave_type_id: z.string().uuid(),
        leave_type_name: z.string(),
        total_days: z.number(),
      }),
    ),
  }),
  period: z.object({
    start_date: z.string(),
    end_date: z.string(),
  }),
});
export type LeaveSummaryResponse = z.infer<typeof LeaveSummaryResponseSchema>;
