import { z } from "zod";

export const CommunicationTypeEnum = z.enum(["email", "sms", "whatsapp"]);
export type CommunicationType = z.infer<typeof CommunicationTypeEnum>;

export const CommunicationDirectionEnum = z.enum(["outbound", "inbound"]);
export type CommunicationDirection = z.infer<typeof CommunicationDirectionEnum>;

export const CommunicationStatusEnum = z.enum([
  "pending",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "failed",
  "bounced",
]);
export type CommunicationStatus = z.infer<typeof CommunicationStatusEnum>;

export const CommunicationSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  candidate_id: z.string().uuid(),
  type: CommunicationTypeEnum,
  direction: CommunicationDirectionEnum,
  subject: z.string().nullable(),
  content: z.string(),
  template_id: z.string().uuid().nullable(),
  sent_at: z.string().nullable(),
  delivered_at: z.string().nullable(),
  opened_at: z.string().nullable(),
  clicked_at: z.string().nullable(),
  status: CommunicationStatusEnum,
  sent_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Communication = z.infer<typeof CommunicationSchema>;

export const EmailSendInputSchema = z.object({
  candidate_id: z.string().uuid(),
  subject: z.string().min(1),
  content: z.string().min(1),
  template_id: z.string().uuid().optional().nullable(),
  scheduled_at: z.string().optional().nullable(),
});
export type EmailSendInput = z.infer<typeof EmailSendInputSchema>;

export const CommunicationListResponseSchema = z.object({
  communications: z.array(CommunicationSchema),
  total: z.number().int(),
});
export type CommunicationListResponse = z.infer<
  typeof CommunicationListResponseSchema
>;

