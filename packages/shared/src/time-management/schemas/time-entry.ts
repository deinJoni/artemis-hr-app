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
  entry_type: z.enum(["clock", "manual"]).default("clock"),
  approval_status: z.enum(["approved", "pending", "rejected"]).default("approved"),
  approver_user_id: z.string().uuid().nullable(),
  approved_at: z.string().nullable(),
  edited_by: z.string().uuid().nullable(),
  updated_at: z.string(),
  created_at: z.string(),
});
export type TimeEntry = z.infer<typeof TimeEntrySchema>;

export const ManualTimeEntryInputSchema = z.object({
  date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  break_minutes: z.number().int().min(0).max(1440).default(0),
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
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(200).optional(),
}).refine(
  (data) => {
    // Require reason for rejections
    if (data.decision === "reject") {
      return data.reason && data.reason.trim().length > 0;
    }
    return true;
  },
  {
    message: "Rejection reason is required",
    path: ["reason"],
  }
);
export type TimeEntryApprovalInput = z.infer<typeof TimeEntryApprovalInputSchema>;
