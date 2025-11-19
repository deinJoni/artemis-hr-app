import { z } from "zod";

export const CompanyNewsCategoryEnum = z.enum(["news", "mitteilung", "announcement"]);
export type CompanyNewsCategory = z.infer<typeof CompanyNewsCategoryEnum>;

export const CompanyNewsStatusEnum = z.enum(["draft", "scheduled", "published", "archived"]);
export type CompanyNewsStatus = z.infer<typeof CompanyNewsStatusEnum>;

export const CompanyNewsSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  title: z.string().min(1),
  summary: z.string().optional().nullable(),
  body: z.string().min(1),
  category: CompanyNewsCategoryEnum,
  status: CompanyNewsStatusEnum,
  publish_at: z.string().datetime().optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  created_by: z.string().uuid(),
  published_by: z.string().uuid().optional().nullable(),
});
export type CompanyNews = z.infer<typeof CompanyNewsSchema>;

export const CompanyNewsActivitySchema = z.object({
  id: z.string().uuid(),
  news_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  action: z.string(),
  actor_id: z.string().uuid().optional().nullable(),
  details: z
    .record(z.string(), z.unknown())
    .optional()
    .nullable(),
  created_at: z.string(),
});
export type CompanyNewsActivity = z.infer<typeof CompanyNewsActivitySchema>;

const OptionalPublishAtSchema = z
  .string()
  .datetime()
  .optional()
  .nullable();

export const CompanyNewsCreateInputSchema = z.object({
  tenantId: z.string().uuid(),
  title: z
    .string()
    .min(3)
    .max(180),
  summary: z
    .string()
    .max(500)
    .optional()
    .nullable(),
  body: z.string().min(1),
  category: CompanyNewsCategoryEnum,
  status: CompanyNewsStatusEnum.optional().default("draft"),
  publishAt: OptionalPublishAtSchema,
});
export type CompanyNewsCreateInput = z.infer<typeof CompanyNewsCreateInputSchema>;

export const CompanyNewsUpdateInputSchema = z.object({
  title: z
    .string()
    .min(3)
    .max(180)
    .optional(),
  summary: z
    .string()
    .max(500)
    .optional()
    .nullable(),
  body: z.string().min(1).optional(),
  category: CompanyNewsCategoryEnum.optional(),
  status: CompanyNewsStatusEnum.optional(),
  publishAt: OptionalPublishAtSchema,
});
export type CompanyNewsUpdateInput = z.infer<typeof CompanyNewsUpdateInputSchema>;

export const CompanyNewsPublishInputSchema = z.object({
  publishAt: OptionalPublishAtSchema,
});
export type CompanyNewsPublishInput = z.infer<typeof CompanyNewsPublishInputSchema>;

export const CompanyNewsListResponseSchema = z.object({
  news: z.array(CompanyNewsSchema),
  total: z.number().int().nonnegative(),
});
export type CompanyNewsListResponse = z.infer<typeof CompanyNewsListResponseSchema>;

export const CompanyNewsActivityResponseSchema = z.object({
  activity: z.array(CompanyNewsActivitySchema),
});
export type CompanyNewsActivityResponse = z.infer<typeof CompanyNewsActivityResponseSchema>;
