import { z } from "zod";

export const FeatureGroupSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  sort_order: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type FeatureGroup = z.infer<typeof FeatureGroupSchema>;

export const FeatureSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  group_id: z.string().uuid(),
  default_enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Feature = z.infer<typeof FeatureSchema>;

export const TenantFeatureFlagSchema = z.object({
  feature_id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  group_key: z.string(),
  group_name: z.string(),
  default_enabled: z.boolean(),
  enabled: z.boolean(),
  source: z.enum(["default", "tenant_override"]),
});
export type TenantFeatureFlag = z.infer<typeof TenantFeatureFlagSchema>;

export const TenantFeatureFlagsResponseSchema = z.object({
  features: z.array(TenantFeatureFlagSchema),
});
export type TenantFeatureFlagsResponse = z.infer<typeof TenantFeatureFlagsResponseSchema>;

export const FeatureToggleInputSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});
export type FeatureToggleInput = z.infer<typeof FeatureToggleInputSchema>;

export const SuperadminAssignmentSchema = z.object({
  user_id: z.string().uuid(),
  granted_at: z.string(),
  notes: z.string().nullable().optional(),
});
export type SuperadminAssignment = z.infer<typeof SuperadminAssignmentSchema>;

export const TenantFeatureSummarySchema = z.object({
  tenant_id: z.string().uuid(),
  tenant_name: z.string(),
  features: z.array(TenantFeatureFlagSchema),
});
export type TenantFeatureSummary = z.infer<typeof TenantFeatureSummarySchema>;

export const AdminFeaturesResponseSchema = z.object({
  tenants: z.array(TenantFeatureSummarySchema),
});
export type AdminFeaturesResponse = z.infer<typeof AdminFeaturesResponseSchema>;

