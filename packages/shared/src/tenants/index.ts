import { z } from "zod";

import { requireAtLeastOneField } from "../common/validators";

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  created_at: z.string(),
  company_name: z.string().nullable(),
  company_size: z.string().nullable(),
  language: z.string().nullable(),
  onboarding_step: z.number().int().min(0),
  setup_completed: z.boolean(),
  activated_at: z.string().nullable(),
});
export type Tenant = z.infer<typeof TenantSchema>;

export const CreateTenantInputSchema = z.object({
  name: z.string().min(1),
});
export type CreateTenantInput = z.infer<typeof CreateTenantInputSchema>;

export const CreateTenantResponseSchema = TenantSchema;
export type CreateTenantResponse = z.infer<typeof CreateTenantResponseSchema>;

export const ProfileSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  display_name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const AccountBootstrapInputSchema = z.object({
  tenantName: z.string().min(1).max(120).optional(),
  displayName: z.string().min(1).max(120).optional(),
});
export type AccountBootstrapInput = z.infer<typeof AccountBootstrapInputSchema>;

export const AccountBootstrapResponseSchema = z.object({
  tenant: TenantSchema,
  profile: ProfileSchema,
  created: z.boolean(),
});
export type AccountBootstrapResponse = z.infer<typeof AccountBootstrapResponseSchema>;

const CompanySizeEnum = z.enum([
  "1-10",
  "11-25",
  "26-100",
  "101-500",
  "501-1000",
  "> 1000",
]);

const LanguageEnum = z.enum(["German", "English"]);

export const OnboardingStepPayloadSchema = z.discriminatedUnion("step", [
  z.object({
    step: z.literal(1),
    companyName: z.string().min(1),
    companySize: CompanySizeEnum,
    language: LanguageEnum,
  }),
  z.object({
    step: z.literal(2),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    companyEmail: z.string().email(),
    rolePosition: z.string().min(1),
  }),
  z.object({
    step: z.literal(3),
  }),
]);
export type OnboardingStepPayload = z.infer<typeof OnboardingStepPayloadSchema>;

export const OnboardingStepResponseSchema = z.object({
  tenant: TenantSchema,
});
export type OnboardingStepResponse = z.infer<typeof OnboardingStepResponseSchema>;

export const TenantUpdateInputSchema = requireAtLeastOneField(
  z.object({
    company_name: z.string().min(1).optional().nullable(),
    company_size: z.string().min(1).optional().nullable(),
    language: z.string().min(1).optional().nullable(),
  })
);
export type TenantUpdateInput = z.infer<typeof TenantUpdateInputSchema>;
