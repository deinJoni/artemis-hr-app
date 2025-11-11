import { z } from "zod";

export const InterviewTypeEnum = z.enum([
  "phone_screen",
  "video",
  "in_person",
  "panel",
  "technical_assessment",
]);
export type InterviewType = z.infer<typeof InterviewTypeEnum>;

export const InterviewStatusEnum = z.enum([
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
]);
export type InterviewStatus = z.infer<typeof InterviewStatusEnum>;

export const RecommendationEnum = z.enum([
  "strong_yes",
  "yes",
  "maybe",
  "no",
  "strong_no",
]);
export type Recommendation = z.infer<typeof RecommendationEnum>;

export const InterviewSchema = z.object({
  id: z.string().uuid(),
  application_id: z.string().uuid(),
  type: InterviewTypeEnum,
  scheduled_at: z.string(),
  duration_minutes: z.number().int().default(60),
  location: z.string().nullable(),
  meeting_link: z.string().nullable(),
  interviewer_ids: z.array(z.string().uuid()),
  notes: z.string().nullable(),
  status: InterviewStatusEnum,
  created_at: z.string(),
  updated_at: z.string(),
});
export type Interview = z.infer<typeof InterviewSchema>;

export const InterviewCreateInputSchema = z.object({
  application_id: z.string().uuid(),
  type: InterviewTypeEnum,
  scheduled_at: z.string(),
  duration_minutes: z.number().int().min(15).max(480).default(60),
  location: z.string().optional().nullable(),
  meeting_link: z.string().url().optional().nullable(),
  interviewer_ids: z.array(z.string().uuid()).min(1),
  notes: z.string().optional().nullable(),
});
export type InterviewCreateInput = z.infer<typeof InterviewCreateInputSchema>;

export const EvaluationSchema = z.object({
  id: z.string().uuid(),
  interview_id: z.string().uuid(),
  evaluator_id: z.string().uuid(),
  scores: z.record(z.string(), z.number().int().min(1).max(10)),
  notes: z.string().nullable(),
  overall_rating: z.number().int().min(1).max(10).nullable(),
  recommendation: RecommendationEnum.nullable(),
  submitted_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export const EvaluationCreateInputSchema = z.object({
  interview_id: z.string().uuid(),
  scores: z.record(z.string(), z.number().int().min(1).max(10)),
  notes: z.string().optional().nullable(),
  overall_rating: z.number().int().min(1).max(10).optional().nullable(),
  recommendation: RecommendationEnum.optional().nullable(),
});
export type EvaluationCreateInput = z.infer<typeof EvaluationCreateInputSchema>;

export const InterviewDetailResponseSchema = InterviewSchema.extend({
  candidate_name: z.string(),
  job_title: z.string(),
  interviewers: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().email(),
    })
  ),
  evaluations: z.array(EvaluationSchema),
});
export type InterviewDetailResponse = z.infer<
  typeof InterviewDetailResponseSchema
>;

export const InterviewListResponseSchema = z.object({
  interviews: z.array(InterviewDetailResponseSchema),
  total: z.number().int(),
});
export type InterviewListResponse = z.infer<typeof InterviewListResponseSchema>;

