import { z } from "zod";

import { AddressSchema } from "../employees";

const NullableString = z
  .string()
  .max(255)
  .optional()
  .or(z.literal(""))
  .or(z.null())
  .transform((value) => {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  });

const NullablePhone = z
  .string()
  .max(64)
  .optional()
  .or(z.literal(""))
  .or(z.null())
  .transform((value) => {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  });

export const SelfServiceProfileFieldsSchema = z.object({
  phone_personal: NullablePhone,
  phone_work: NullablePhone,
  emergency_contact_name: NullableString,
  emergency_contact_phone: NullablePhone,
  home_address: AddressSchema.optional().nullable(),
});
export type SelfServiceProfileFields = z.infer<typeof SelfServiceProfileFieldsSchema>;

export const ProfileChangeRequestStatusEnum = z.enum([
  "draft",
  "pending",
  "approved",
  "denied",
  "cancelled",
]);
export type ProfileChangeRequestStatus = z.infer<typeof ProfileChangeRequestStatusEnum>;

export const SelfServiceProfileRequestSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  status: ProfileChangeRequestStatusEnum,
  fields: SelfServiceProfileFieldsSchema,
  current_snapshot: SelfServiceProfileFieldsSchema,
  justification: z.string().nullable(),
  approval_request_id: z.string().uuid().nullable(),
  submitted_by_user_id: z.string().uuid(),
  submitted_at: z.string().nullable(),
  decided_at: z.string().nullable(),
  decision_reason: z.string().nullable(),
  approver_user_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type SelfServiceProfileRequest = z.infer<typeof SelfServiceProfileRequestSchema>;

export const SelfServiceProfileDraftInputSchema = z.object({
  fields: SelfServiceProfileFieldsSchema,
  justification: z
    .string()
    .max(1000)
    .optional()
    .or(z.literal(""))
    .or(z.null())
    .transform((value) => {
      if (value === undefined || value === null) return null;
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    }),
});
export type SelfServiceProfileDraftInput = z.infer<typeof SelfServiceProfileDraftInputSchema>;

export const SelfServiceProfileResponseSchema = z.object({
  employee: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    phone_personal: z.string().nullable(),
    phone_work: z.string().nullable(),
    emergency_contact_name: z.string().nullable(),
    emergency_contact_phone: z.string().nullable(),
    home_address: AddressSchema.nullable(),
  }),
  request: SelfServiceProfileRequestSchema.nullable(),
  allowed_fields: z.array(z.string()),
});
export type SelfServiceProfileResponse = z.infer<typeof SelfServiceProfileResponseSchema>;
