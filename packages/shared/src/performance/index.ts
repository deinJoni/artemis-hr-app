import { z } from "zod";

export const GoalStatusEnum = z.enum(["todo", "in_progress", "completed"]);
export type GoalStatus = z.infer<typeof GoalStatusEnum>;

export const GoalKeyResultStatusEnum = z.enum([
  "pending",
  "in_progress",
  "achieved",
]);
export type GoalKeyResultStatus = z.infer<typeof GoalKeyResultStatusEnum>;

export const GoalKeyResultSchema = z.object({
  id: z.string().uuid(),
  goalId: z.string().uuid(),
  label: z.string(),
  targetValue: z.number().nullable(),
  currentValue: z.number().nullable(),
  status: GoalKeyResultStatusEnum,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GoalKeyResult = z.infer<typeof GoalKeyResultSchema>;

export const GoalUpdateSchema = z.object({
  id: z.string().uuid(),
  goalId: z.string().uuid(),
  authorId: z.string().uuid(),
  body: z.string(),
  createdAt: z.string(),
});
export type GoalUpdate = z.infer<typeof GoalUpdateSchema>;

export const GoalSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  employeeId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: GoalStatusEnum,
  progressPct: z.number().min(0).max(100),
  dueDate: z.string().nullable(),
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  keyResults: z.array(GoalKeyResultSchema).optional(),
  updates: z.array(GoalUpdateSchema).optional(),
});
export type Goal = z.infer<typeof GoalSchema>;

export const GoalCreateInputSchema = z.object({
  tenantId: z.string().uuid(),
  employeeId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  status: GoalStatusEnum.optional(),
  progressPct: z.number().min(0).max(100).optional(),
  dueDate: z.string().nullable().optional(),
  keyResults: z
    .array(
      z.object({
        label: z.string().min(1),
        targetValue: z.number().nullable().optional(),
        currentValue: z.number().nullable().optional(),
        status: GoalKeyResultStatusEnum.optional(),
      })
    )
    .optional(),
});
export type GoalCreateInput = z.infer<typeof GoalCreateInputSchema>;

export const GoalUpdateInputSchema = GoalCreateInputSchema.extend({
  goalId: z.string().uuid(),
}).partial({
  title: true,
  description: true,
  status: true,
  progressPct: true,
  dueDate: true,
  keyResults: true,
});
export type GoalUpdateInput = z.infer<typeof GoalUpdateInputSchema>;

export const GoalDeleteInputSchema = z.object({
  tenantId: z.string().uuid(),
  goalId: z.string().uuid(),
});
export type GoalDeleteInput = z.infer<typeof GoalDeleteInputSchema>;

export const GoalListResponseSchema = z.object({
  goals: z.array(GoalSchema),
});
export type GoalListResponse = z.infer<typeof GoalListResponseSchema>;

export const CheckInStatusEnum = z.enum(["draft", "completed"]);
export type CheckInStatus = z.infer<typeof CheckInStatusEnum>;

export const CheckInAgendaSchema = z.object({
  accomplishments: z.string().nullable(),
  priorities: z.string().nullable(),
  roadblocks: z.string().nullable(),
  notes: z.unknown().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});
export type CheckInAgenda = z.infer<typeof CheckInAgendaSchema>;

export const CheckInSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  managerUserId: z.string().uuid(),
  employeeId: z.string().uuid(),
  status: CheckInStatusEnum,
  scheduledFor: z.string().nullable(),
  completedAt: z.string().nullable(),
  lastUpdatedBy: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  agenda: CheckInAgendaSchema.optional(),
  privateNote: z.string().nullable(),
});
export type CheckIn = z.infer<typeof CheckInSchema>;

export const CheckInCreateInputSchema = z.object({
  tenantId: z.string().uuid(),
  employeeId: z.string().uuid(),
  scheduledFor: z.string().nullable().optional(),
  agenda: CheckInAgendaSchema.optional(),
});
export type CheckInCreateInput = z.infer<typeof CheckInCreateInputSchema>;

export const CheckInUpdateInputSchema = z.object({
  tenantId: z.string().uuid(),
  checkInId: z.string().uuid(),
  status: CheckInStatusEnum.optional(),
  scheduledFor: z.string().nullable().optional(),
  agenda: CheckInAgendaSchema.optional(),
  privateNote: z.string().nullable().optional(),
});
export type CheckInUpdateInput = z.infer<typeof CheckInUpdateInputSchema>;

export const CheckInHistoryItemSchema = z.object({
  checkIn: CheckInSchema,
  agenda: CheckInAgendaSchema.optional(),
});
export type CheckInHistoryItem = z.infer<typeof CheckInHistoryItemSchema>;

export const CheckInHistoryResponseSchema = z.object({
  items: z.array(CheckInHistoryItemSchema),
});
export type CheckInHistoryResponse = z.infer<typeof CheckInHistoryResponseSchema>;

export const TeamMemberSummarySchema = z.object({
  employeeId: z.string().uuid(),
  employeeName: z.string(),
  employeeEmail: z.string().email().nullable(),
  avatarUrl: z.string().url().nullable(),
  managerEmployeeId: z.string().uuid().nullable(),
  totalGoals: z.number(),
  completedGoals: z.number(),
  activeGoals: z.number(),
  avgProgressPct: z.number(),
  lastCheckInAt: z.string().nullable(),
});
export type TeamMemberSummary = z.infer<typeof TeamMemberSummarySchema>;

export const MyTeamResponseSchema = z.object({
  team: z.array(TeamMemberSummarySchema),
});
export type MyTeamResponse = z.infer<typeof MyTeamResponseSchema>;
