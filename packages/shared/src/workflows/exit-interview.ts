import { z } from "zod";

export const ExitReasonEnum = z.enum([
  "resignation",
  "termination",
  "retirement",
  "contract_end",
  "other",
]);
export type ExitReason = z.infer<typeof ExitReasonEnum>;

export const ExitInterviewSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  conducted_at: z.string(),
  reason_for_leaving: ExitReasonEnum.nullable(),
  job_satisfaction_rating: z.number().int().min(1).max(5).nullable(),
  manager_relationship_rating: z.number().int().min(1).max(5).nullable(),
  company_culture_rating: z.number().int().min(1).max(5).nullable(),
  would_recommend: z.boolean().nullable(),
  feedback_json: z.unknown().nullable(),
  is_anonymous: z.boolean(),
  conducted_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ExitInterview = z.infer<typeof ExitInterviewSchema>;

export const ExitInterviewSubmitInputSchema = z.object({
  employee_id: z.string().uuid(),
  reason_for_leaving: ExitReasonEnum.optional(),
  job_satisfaction_rating: z.number().int().min(1).max(5).optional(),
  manager_relationship_rating: z.number().int().min(1).max(5).optional(),
  company_culture_rating: z.number().int().min(1).max(5).optional(),
  would_recommend: z.boolean().optional(),
  feedback_json: z.unknown().optional(),
  is_anonymous: z.boolean().default(false),
});
export type ExitInterviewSubmitInput = z.infer<
  typeof ExitInterviewSubmitInputSchema
>;

export const ExitInterviewResponseSchema = z.object({
  interview: ExitInterviewSchema,
});
export type ExitInterviewResponse = z.infer<typeof ExitInterviewResponseSchema>;

