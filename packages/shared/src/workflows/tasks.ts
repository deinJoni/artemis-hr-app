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

export const TaskTypeEnum = z.enum(["general", "document", "form"]);
export type TaskType = z.infer<typeof TaskTypeEnum>;

const TaskAssigneeSchema = z
  .object({
    type: z.enum(["employee", "role", "department"]),
    id: z.string().uuid().optional(),
    role: z.string().optional(),
    department_id: z.string().uuid().optional(),
  })
  .nullable();

const TaskBasePayloadSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  attachments: z.array(z.string()).optional(),
  links: z.array(z.string()).optional(),
});

const DocumentTaskPayloadSchema = TaskBasePayloadSchema.extend({
  documentType: z.string(),
  required: z.boolean().optional(),
  category: z.string().optional(),
  templateId: z.string().uuid().optional(),
});

const FormFieldOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const FormFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.enum(["text", "textarea", "date", "select", "checkbox", "number"]),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  helperText: z.string().optional(),
  options: z.array(FormFieldOptionSchema).optional(),
});

const FormTaskPayloadSchema = TaskBasePayloadSchema.extend({
  formKey: z.string(),
  schema: z.record(z.string(), z.unknown()).optional(),
  fields: z.array(FormFieldSchema).optional(),
  submitLabel: z.string().optional(),
  defaultValues: z.record(z.string(), z.unknown()).optional(),
});

export const TaskPayloadSchema = TaskBasePayloadSchema.or(DocumentTaskPayloadSchema)
  .or(FormTaskPayloadSchema)
  .nullable();
export type TaskPayload = z.infer<typeof TaskPayloadSchema>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  node_id: z.string().uuid(),
  status: TaskStatusEnum,
  task_type: TaskTypeEnum,
  assigned_to: TaskAssigneeSchema,
  due_at: z.string().nullable(),
  payload: TaskPayloadSchema,
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
  documentId: z.string().uuid().optional(),
  formResponse: z.record(z.string(), z.unknown()).optional(),
});
export type TaskCompleteInput = z.infer<typeof TaskCompleteInputSchema>;

