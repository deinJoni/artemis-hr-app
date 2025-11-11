import { z } from "zod";

export const TaskStatusEnum = z.enum([
  "pending",
  "queued",
  "waiting_input",
  "in_progress",
  "completed",
  "failed",
  "canceled",
]);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  node_id: z.string().uuid(),
  status: TaskStatusEnum,
  assigned_to: z
    .object({
      type: z.enum(["employee", "role", "department"]),
      id: z.string().uuid().optional(),
      role: z.string().optional(),
      department_id: z.string().uuid().optional(),
    })
    .nullable(),
  due_at: z.string().nullable(),
  payload: z
    .object({
      title: z.string(),
      description: z.string().optional(),
      instructions: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      attachments: z.array(z.string()).optional(),
      links: z.array(z.string()).optional(),
    })
    .nullable(),
  result: z.unknown().nullable(),
  error: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  updated_at: z.string(),
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskListResponseSchema = z.object({
  tasks: z.array(TaskSchema),
});
export type TaskListResponse = z.infer<typeof TaskListResponseSchema>;

export const TaskCompleteInputSchema = z.object({
  result: z.unknown().optional(),
  notes: z.string().optional(),
});
export type TaskCompleteInput = z.infer<typeof TaskCompleteInputSchema>;

