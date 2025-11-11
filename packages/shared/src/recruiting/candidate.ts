import { z } from "zod";

export const CandidateSourceEnum = z.enum([
  "direct_apply",
  "linkedin",
  "indeed",
  "referral",
  "job_board",
  "social_media",
  "event",
  "qr_code",
  "other",
]);
export type CandidateSource = z.infer<typeof CandidateSourceEnum>;

export const ApplicationStatusEnum = z.enum([
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
]);
export type ApplicationStatus = z.infer<typeof ApplicationStatusEnum>;

export const CandidateSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  resume_url: z.string().nullable(),
  cover_letter: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  portfolio_url: z.string().nullable(),
  source: CandidateSourceEnum,
  source_details: z.record(z.string(), z.any()).nullable(),
  applied_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Candidate = z.infer<typeof CandidateSchema>;

export const CandidateCreateInputSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  resume_url: z.string().optional().nullable(),
  cover_letter: z.string().optional().nullable(),
  linkedin_url: z.string().url().optional().nullable(),
  portfolio_url: z.string().url().optional().nullable(),
  source: CandidateSourceEnum,
  source_details: z.record(z.string(), z.any()).optional().nullable(),
  job_id: z.string().uuid(), // Job they're applying to
  application_answers: z.record(z.string(), z.any()).optional().nullable(),
});
export type CandidateCreateInput = z.infer<typeof CandidateCreateInputSchema>;

export const ApplicationSchema = z.object({
  id: z.string().uuid(),
  job_id: z.string().uuid(),
  candidate_id: z.string().uuid(),
  status: ApplicationStatusEnum,
  current_stage_id: z.string().uuid().nullable(),
  match_score: z.number().int().min(0).max(100).nullable(),
  application_answers: z.record(z.string(), z.any()).nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Application = z.infer<typeof ApplicationSchema>;

export const ApplicationUpdateStageInputSchema = z.object({
  stage_id: z.string().uuid(),
  notes: z.string().optional().nullable(),
});
export type ApplicationUpdateStageInput = z.infer<
  typeof ApplicationUpdateStageInputSchema
>;

export const CandidateDetailResponseSchema = CandidateSchema.extend({
  applications: z.array(
    ApplicationSchema.extend({
      job_title: z.string(),
      job_id: z.string().uuid(),
    })
  ),
});
export type CandidateDetailResponse = z.infer<
  typeof CandidateDetailResponseSchema
>;

export const CandidateListResponseSchema = z.object({
  candidates: z.array(
    CandidateSchema.extend({
      current_job_title: z.string().nullable(),
      match_score: z.number().int().min(0).max(100).nullable(),
      application_id: z.string().uuid().nullable(),
      current_stage: z.string().nullable(),
    })
  ),
  total: z.number().int(),
});
export type CandidateListResponse = z.infer<typeof CandidateListResponseSchema>;

