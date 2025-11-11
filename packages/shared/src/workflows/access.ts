import { z } from "zod";

export const AccessSystemTypeEnum = z.enum([
  "email",
  "vpn",
  "application",
  "building",
  "cloud_service",
  "other",
]);
export type AccessSystemType = z.infer<typeof AccessSystemTypeEnum>;

export const AccessGrantSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  system_name: z.string(),
  system_type: AccessSystemTypeEnum.nullable(),
  granted_at: z.string(),
  revoked_at: z.string().nullable(),
  granted_by: z.string().uuid().nullable(),
  revoked_by: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type AccessGrant = z.infer<typeof AccessGrantSchema>;

export const AccessGrantInputSchema = z.object({
  employee_id: z.string().uuid(),
  system_name: z.string(),
  system_type: AccessSystemTypeEnum.optional(),
  notes: z.string().optional(),
});
export type AccessGrantInput = z.infer<typeof AccessGrantInputSchema>;

export const AccessRevokeInputSchema = z.object({
  grant_id: z.string().uuid(),
  notes: z.string().optional(),
});
export type AccessRevokeInput = z.infer<typeof AccessRevokeInputSchema>;

export const AccessListResponseSchema = z.object({
  grants: z.array(AccessGrantSchema),
});
export type AccessListResponse = z.infer<typeof AccessListResponseSchema>;

