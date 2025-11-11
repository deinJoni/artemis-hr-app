import { z } from "zod";

export const AppRoleEnum = z.enum(["owner", "admin", "manager", "people_ops", "employee"]);

export const MembershipSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  role: AppRoleEnum,
  created_at: z.string(),
});
export type Membership = z.infer<typeof MembershipSchema>;

export const MembershipListItemSchema = MembershipSchema.extend({
  email: z.string().email().optional().nullable(),
});
export type MembershipListItem = z.infer<typeof MembershipListItemSchema>;

export const MembershipListResponseSchema = z.object({
  members: z.array(MembershipListItemSchema),
});
export type MembershipListResponse = z.infer<typeof MembershipListResponseSchema>;

export const MembershipCreateInputSchema = z.object({
  user_id: z.string().uuid(),
  role: AppRoleEnum,
});
export type MembershipCreateInput = z.infer<typeof MembershipCreateInputSchema>;

export const MembershipUpdateInputSchema = z.object({
  role: AppRoleEnum,
});
export type MembershipUpdateInput = z.infer<typeof MembershipUpdateInputSchema>;
