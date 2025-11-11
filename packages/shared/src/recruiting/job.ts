import { z } from "zod";

export const JobStatusEnum = z.enum([
  "draft",
  "pending_approval",
  "active",
  "paused",
  "filled",
  "closed",
]);
export type JobStatus = z.infer<typeof JobStatusEnum>;

// Job-specific employment types (includes freelance, excludes intern/seasonal)
export const JobEmploymentTypeEnum = z.enum([
  "full_time",
  "part_time",
  "contract",
  "freelance",
]);
export type JobEmploymentType = z.infer<typeof JobEmploymentTypeEnum>;

// Job-specific work locations (uses "on_site" instead of "office")
export const JobWorkLocationEnum = z.enum(["remote", "hybrid", "on_site"]);
export type JobWorkLocation = z.infer<typeof JobWorkLocationEnum>;

export const JobPostingChannelEnum = z.enum([
  "linkedin",
  "indeed",
  "stepstone",
  "jobs_bg",
  "glassdoor",
  "company_site",
  "instagram",
  "facebook",
  "tiktok",
  "other",
]);
export type JobPostingChannel = z.infer<typeof JobPostingChannelEnum>;

export const JobPostingStatusEnum = z.enum([
  "pending",
  "active",
  "paused",
  "completed",
  "failed",
]);
export type JobPostingStatus = z.infer<typeof JobPostingStatusEnum>;

export const RequirementSchema = z.object({
  skill: z.string(),
  proficiency: z.enum(["required", "preferred", "nice_to_have"]).optional(),
  level: z.string().optional(), // e.g., "Senior", "Mid-level"
});

export const RequirementsSchema = z.object({
  skills: z.array(RequirementSchema).optional(),
  experience_years: z.number().int().min(0).optional(),
  education: z.string().optional(),
  certifications: z.array(z.string()).optional(),
});

export const JobSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  job_id: z.string(),
  title: z.string(),
  department_id: z.string().uuid().nullable(),
  location_id: z.string().uuid().nullable(),
  status: JobStatusEnum,
  description: z.string(),
  requirements: RequirementsSchema.nullable(),
  employment_type: JobEmploymentTypeEnum.nullable(),
  work_location: JobWorkLocationEnum.nullable(),
  salary_min: z.number().nullable(),
  salary_max: z.number().nullable(),
  salary_currency: z.string().nullable(),
  salary_hidden: z.boolean(),
  benefits: z.array(z.string()).nullable(),
  application_deadline: z.string().nullable(),
  created_by: z.string().uuid(),
  approved_by: z.string().uuid().nullable(),
  published_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Job = z.infer<typeof JobSchema>;

export const JobCreateInputSchema = z.object({
  tenant_id: z.string().uuid(),
  title: z.string().min(1),
  department_id: z.string().uuid().optional().nullable(),
  location_id: z.string().uuid().optional().nullable(),
  description: z.string().min(1),
  requirements: RequirementsSchema.optional().nullable(),
  employment_type: JobEmploymentTypeEnum.optional().nullable(),
  work_location: JobWorkLocationEnum.optional().nullable(),
  salary_min: z.number().optional().nullable(),
  salary_max: z.number().optional().nullable(),
  salary_currency: z.string().optional().nullable(),
  salary_hidden: z.boolean().optional(),
  benefits: z.array(z.string()).optional().nullable(),
  application_deadline: z.string().optional().nullable(),
});
export type JobCreateInput = z.infer<typeof JobCreateInputSchema>;

export const JobUpdateInputSchema = z.object({
  title: z.string().min(1).optional(),
  department_id: z.string().uuid().optional().nullable(),
  location_id: z.string().uuid().optional().nullable(),
  status: JobStatusEnum.optional(),
  description: z.string().min(1).optional(),
  requirements: RequirementsSchema.optional().nullable(),
  employment_type: JobEmploymentTypeEnum.optional().nullable(),
  work_location: JobWorkLocationEnum.optional().nullable(),
  salary_min: z.number().optional().nullable(),
  salary_max: z.number().optional().nullable(),
  salary_currency: z.string().optional().nullable(),
  salary_hidden: z.boolean().optional(),
  benefits: z.array(z.string()).optional().nullable(),
  application_deadline: z.string().optional().nullable(),
});
export type JobUpdateInput = z.infer<typeof JobUpdateInputSchema>;

export const JobPublishInputSchema = z.object({
  channels: z.array(JobPostingChannelEnum),
  budget: z.record(z.string(), z.number()).optional(), // channel -> budget amount
});
export type JobPublishInput = z.infer<typeof JobPublishInputSchema>;

export const JobPostingSchema = z.object({
  id: z.string().uuid(),
  job_id: z.string().uuid(),
  channel: JobPostingChannelEnum,
  posted_at: z.string().nullable(),
  budget: z.number().nullable(),
  spent: z.number(),
  status: JobPostingStatusEnum,
  external_post_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type JobPosting = z.infer<typeof JobPostingSchema>;

export const JobListResponseSchema = z.object({
  jobs: z.array(JobSchema),
  total: z.number().int(),
});
export type JobListResponse = z.infer<typeof JobListResponseSchema>;

export const JobDetailResponseSchema = JobSchema.extend({
  department_name: z.string().nullable(),
  location_name: z.string().nullable(),
  postings: z.array(JobPostingSchema),
  application_count: z.number().int(),
});
export type JobDetailResponse = z.infer<typeof JobDetailResponseSchema>;

