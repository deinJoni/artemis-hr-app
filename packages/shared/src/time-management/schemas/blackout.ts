import { z } from "zod";

export const BlackoutPeriodSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  leave_type_id: z.string().uuid().nullable(),
  department_id: z.string().uuid().nullable(),
  reason: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type BlackoutPeriod = z.infer<typeof BlackoutPeriodSchema>;

export const BlackoutPeriodCreateInputSchema = z.object({
  name: z.string().min(1).max(200),
  start_date: z.string(),
  end_date: z.string(),
  leave_type_id: z.string().uuid().nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  reason: z.string().max(500).optional(),
});
export type BlackoutPeriodCreateInput = z.infer<typeof BlackoutPeriodCreateInputSchema>;

export const BlackoutPeriodUpdateInputSchema = BlackoutPeriodCreateInputSchema.partial();
export type BlackoutPeriodUpdateInput = z.infer<typeof BlackoutPeriodUpdateInputSchema>;

export const BlackoutPeriodListQuerySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  leave_type_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(100).default(20),
});
export type BlackoutPeriodListQuery = z.infer<typeof BlackoutPeriodListQuerySchema>;

export const BlackoutPeriodListResponseSchema = z.object({
  periods: z.array(BlackoutPeriodSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    page_size: z.number().int().min(1),
    total: z.number().int().min(0),
    total_pages: z.number().int().min(0),
  }),
});
export type BlackoutPeriodListResponse = z.infer<typeof BlackoutPeriodListResponseSchema>;
