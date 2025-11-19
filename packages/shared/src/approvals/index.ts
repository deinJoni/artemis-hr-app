import { z } from "zod";

export const ApprovalCategoryEnum = z.enum([
  "equipment",
  "training",
  "salary_change",
]);
export type ApprovalCategory = z.infer<typeof ApprovalCategoryEnum>;

export const ApprovalStatusEnum = z.enum([
  "pending",
  "approved",
  "denied",
  "cancelled",
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusEnum>;

export const ApprovalUrgencyEnum = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);
export type ApprovalUrgency = z.infer<typeof ApprovalUrgencyEnum>;

export const ApprovalAttachmentSchema = z.object({
  name: z.string(),
  url: z.string().url().optional(),
  type: z.string().optional(),
});
export type ApprovalAttachment = z.infer<typeof ApprovalAttachmentSchema>;

const BaseDetailSchema = z.object({
  justification: z.string().optional().nullable(),
});

export const EquipmentApprovalDetailsSchema = BaseDetailSchema.extend({
  itemType: z.string(),
  specification: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  accessories: z.array(z.string()).optional(),
  neededBy: z.string().optional().nullable(),
  estimatedCost: z.number().optional().nullable(),
  currency: z.string().optional().nullable(),
  urgency: ApprovalUrgencyEnum.optional(),
});
export type EquipmentApprovalDetails = z.infer<typeof EquipmentApprovalDetailsSchema>;

export const TrainingFormatEnum = z.enum([
  "virtual",
  "in_person",
  "hybrid",
]);
export type TrainingFormat = z.infer<typeof TrainingFormatEnum>;

export const TrainingApprovalDetailsSchema = BaseDetailSchema.extend({
  courseName: z.string(),
  provider: z.string().optional().nullable(),
  schedule: z.string().optional().nullable(),
  format: TrainingFormatEnum.optional(),
  durationHours: z.number().optional().nullable(),
  estimatedCost: z.number().optional().nullable(),
  currency: z.string().optional().nullable(),
  certification: z.string().optional().nullable(),
  expectedOutcome: z.string().optional().nullable(),
});
export type TrainingApprovalDetails = z.infer<typeof TrainingApprovalDetailsSchema>;

export const SalaryChangeApprovalDetailsSchema = BaseDetailSchema.extend({
  currentSalary: z.number(),
  proposedSalary: z.number(),
  currency: z.string(),
  effectiveDate: z.string(),
  increasePercent: z.number().optional().nullable(),
  performanceSummary: z.string().optional().nullable(),
});
export type SalaryChangeApprovalDetails = z.infer<typeof SalaryChangeApprovalDetailsSchema>;

const BaseApprovalRequestSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  category: ApprovalCategoryEnum,
  status: ApprovalStatusEnum,
  title: z.string(),
  summary: z.string().nullable(),
  justification: z.string().nullable(),
  details: z.unknown(),
  attachments: z.array(ApprovalAttachmentSchema).optional(),
  needed_by: z.string().nullable(),
  requested_by_user_id: z.string().uuid(),
  requested_by_employee_id: z.string().uuid().nullable(),
  approver_user_id: z.string().uuid().nullable(),
  decision_reason: z.string().nullable(),
  requested_at: z.string(),
  decided_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  requestor_name: z.string().nullable(),
  requestor_job_title: z.string().nullable(),
  department_name: z.string().nullable(),
});

const EquipmentApprovalRequestSchema = BaseApprovalRequestSchema.extend({
  category: z.literal("equipment"),
  details: EquipmentApprovalDetailsSchema,
});

const TrainingApprovalRequestSchema = BaseApprovalRequestSchema.extend({
  category: z.literal("training"),
  details: TrainingApprovalDetailsSchema,
});

const SalaryChangeApprovalRequestSchema = BaseApprovalRequestSchema.extend({
  category: z.literal("salary_change"),
  details: SalaryChangeApprovalDetailsSchema,
});

export const ApprovalRequestSchema = z.discriminatedUnion("category", [
  EquipmentApprovalRequestSchema,
  TrainingApprovalRequestSchema,
  SalaryChangeApprovalRequestSchema,
]);
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export const ApprovalRequestListResponseSchema = z.object({
  approvals: z.array(ApprovalRequestSchema),
});
export type ApprovalRequestListResponse = z.infer<typeof ApprovalRequestListResponseSchema>;

const BaseRequestInputSchema = z.object({
  title: z.string().min(3),
  summary: z.string().optional(),
  justification: z.string().min(5),
  needed_by: z.string().optional(),
  attachments: z.array(ApprovalAttachmentSchema).optional(),
});

export const ApprovalRequestInputSchema = z.discriminatedUnion("category", [
  BaseRequestInputSchema.extend({
    category: z.literal("equipment"),
    details: EquipmentApprovalDetailsSchema,
  }),
  BaseRequestInputSchema.extend({
    category: z.literal("training"),
    details: TrainingApprovalDetailsSchema,
  }),
  BaseRequestInputSchema.extend({
    category: z.literal("salary_change"),
    details: SalaryChangeApprovalDetailsSchema,
  }),
]);
export type ApprovalRequestInput = z.infer<typeof ApprovalRequestInputSchema>;

export const ApprovalDecisionInputSchema = z
  .object({
    decision: z.enum(["approve", "deny"]),
    reason: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "deny" && !value.reason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Reason is required when denying a request",
      });
    }
  });
export type ApprovalDecisionInput = z.infer<typeof ApprovalDecisionInputSchema>;

