import { z } from "zod";

export const WorkflowKindEnum = z.enum(["onboarding", "offboarding"]);
export type WorkflowKind = z.infer<typeof WorkflowKindEnum>;

export const WorkflowStatusEnum = z.enum(["draft", "published", "archived"]);
export type WorkflowStatus = z.infer<typeof WorkflowStatusEnum>;

export const WorkflowTemplateSchema = z.object({
  id: z.string().uuid(),
  kind: WorkflowKindEnum,
  name: z.string(),
  description: z.string().nullable(),
  blocks: z.unknown(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type WorkflowTemplate = z.infer<typeof WorkflowTemplateSchema>;

export const WorkflowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  kind: WorkflowKindEnum,
  status: WorkflowStatusEnum,
  active_version_id: z.string().uuid().nullable(),
  created_by: z.string().uuid().nullable(),
  updated_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

export const WorkflowVersionSchema = z.object({
  id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  version_number: z.number().int().nonnegative(),
  is_active: z.boolean(),
  definition: z.unknown(),
  created_at: z.string(),
  created_by: z.string().uuid().nullable(),
  published_at: z.string().nullable(),
});
export type WorkflowVersion = z.infer<typeof WorkflowVersionSchema>;

export const WorkflowNodeTypeEnum = z.enum([
  "trigger",
  "action",
  "delay",
  "logic",
]);
export type WorkflowNodeType = z.infer<typeof WorkflowNodeTypeEnum>;

export const WorkflowNodeSchema = z.object({
  id: z.string().uuid(),
  version_id: z.string().uuid(),
  node_key: z.string(),
  type: WorkflowNodeTypeEnum,
  label: z.string().nullable(),
  config: z.unknown().nullable(),
  ui_position: z.unknown().nullable(),
  created_at: z.string(),
});
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;

export const WorkflowEdgeSchema = z.object({
  id: z.string().uuid(),
  version_id: z.string().uuid(),
  source_node_id: z.string().uuid(),
  target_node_id: z.string().uuid(),
  condition: z.unknown().nullable(),
  position: z.number().int().nonnegative(),
  created_at: z.string(),
});
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;

export const WorkflowRunStatusEnum = z.enum([
  "pending",
  "in_progress",
  "paused",
  "completed",
  "canceled",
  "failed",
]);
export type WorkflowRunStatus = z.infer<typeof WorkflowRunStatusEnum>;

export const WorkflowRunSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  version_id: z.string().uuid(),
  employee_id: z.string().uuid().nullable(),
  trigger_source: z.string().nullable(),
  status: WorkflowRunStatusEnum,
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  canceled_at: z.string().nullable(),
  failed_at: z.string().nullable(),
  last_error: z.string().nullable(),
  context: z.unknown().nullable(),
  created_at: z.string(),
});
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

export const WorkflowRunStepStatusEnum = z.enum([
  "pending",
  "queued",
  "waiting_input",
  "in_progress",
  "completed",
  "failed",
  "canceled",
]);
export type WorkflowRunStepStatus = z.infer<typeof WorkflowRunStepStatusEnum>;

export const WorkflowRunStepSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  node_id: z.string().uuid(),
  status: WorkflowRunStepStatusEnum,
  assigned_to: z.unknown().nullable(),
  due_at: z.string().nullable(),
  payload: z.unknown().nullable(),
  result: z.unknown().nullable(),
  error: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  updated_at: z.string(),
});
export type WorkflowRunStep = z.infer<typeof WorkflowRunStepSchema>;

export const WorkflowActionQueueSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  node_id: z.string().uuid().nullable(),
  resume_at: z.string(),
  attempts: z.number().int().nonnegative(),
  last_error: z.string().nullable(),
  metadata: z.unknown().nullable(),
  created_at: z.string(),
});
export type WorkflowActionQueue = z.infer<typeof WorkflowActionQueueSchema>;

export const WorkflowEventSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  event_type: z.string(),
  payload: z.unknown().nullable(),
  created_at: z.string(),
  created_by: z.string().uuid().nullable(),
});
export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>;

export const EmployeeJourneyViewSchema = z.object({
  run_id: z.string().uuid(),
  share_token: z.string().uuid(),
  hero_copy: z.string().nullable(),
  cta_label: z.string().nullable(),
  last_viewed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type EmployeeJourneyView = z.infer<typeof EmployeeJourneyViewSchema>;

export const WorkflowLatestVersionSchema = z.object({
  id: z.string().uuid(),
  version_number: z.number().int().nonnegative(),
  is_active: z.boolean(),
  published_at: z.string().nullable(),
});
export type WorkflowLatestVersion = z.infer<typeof WorkflowLatestVersionSchema>;

export const WorkflowListItemSchema = WorkflowSchema.extend({
  latestVersion: WorkflowLatestVersionSchema.optional(),
});
export type WorkflowListItem = z.infer<typeof WorkflowListItemSchema>;

export const WorkflowListResponseSchema = z.object({
  workflows: z.array(WorkflowListItemSchema),
});
export type WorkflowListResponse = z.infer<typeof WorkflowListResponseSchema>;

export const WorkflowVersionDetailSchema = z.object({
  id: z.string().uuid(),
  version_number: z.number().int().nonnegative(),
  is_active: z.boolean(),
  definition: z.unknown(),
  published_at: z.string().nullable(),
  created_at: z.string(),
});
export type WorkflowVersionDetail = z.infer<typeof WorkflowVersionDetailSchema>;

export const WorkflowDetailResponseSchema = z.object({
  workflow: WorkflowSchema,
  versions: z.array(WorkflowVersionDetailSchema),
});
export type WorkflowDetailResponse = z.infer<typeof WorkflowDetailResponseSchema>;

// Re-export task, equipment, access, and exit interview schemas
export * from "./tasks";
export * from "./equipment";
export * from "./access";
export * from "./exit-interview";
