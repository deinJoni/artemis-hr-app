import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, Json } from '@database.types.ts'
import type { Task } from '@vibe/shared'
import { TaskSchema } from '@vibe/shared'

import { WorkflowEngine } from '../../lib/workflow-engine'

type WorkflowRunStepRow = Database['public']['Tables']['workflow_run_steps']['Row']

type RunJoinedStep = WorkflowRunStepRow & {
  workflow_runs?: Array<{
    tenant_id: string
    employee_id: string | null
  }>
}

export interface TaskWithContext {
  task: Task
  tenantId: string
  employeeId: string | null
}

export function mapRunStepToTask(step: WorkflowRunStepRow): Task {
  const candidate = {
    id: step.id,
    run_id: step.run_id,
    node_id: step.node_id,
    status: step.status,
    task_type: (step.task_type as Task['task_type']) ?? 'general',
    assigned_to: step.assigned_to as Task['assigned_to'],
    due_at: step.due_at,
    payload: step.payload as Task['payload'],
    result: step.result as Task['result'],
    error: step.error,
    started_at: step.started_at,
    completed_at: step.completed_at,
    updated_at: step.updated_at,
  }

  const parsed = TaskSchema.safeParse(candidate)
  if (!parsed.success) {
    throw new Error('Unable to parse workflow task payload')
  }

  return parsed.data
}

export async function fetchTaskWithContext(
  supabase: SupabaseClient<Database>,
  taskId: string,
): Promise<TaskWithContext> {
  const { data, error } = await supabase
    .from('workflow_run_steps')
    .select(
      `
        *,
        workflow_runs!inner (
          tenant_id,
          employee_id
        )
      `,
    )
    .eq('id', taskId)
    .maybeSingle()

  if (error || !data) {
    throw new Error(error?.message ?? 'Task not found')
  }

  const runInfo = Array.isArray(data.workflow_runs) ? data.workflow_runs[0] : data.workflow_runs

  if (!runInfo?.tenant_id) {
    throw new Error('Unable to determine tenant for task')
  }

  const task = mapRunStepToTask(data as WorkflowRunStepRow)

  return {
    task,
    tenantId: runInfo.tenant_id,
    employeeId: runInfo.employee_id ?? null,
  }
}

export async function completeWorkflowTask(options: {
  supabase: SupabaseClient<Database>
  taskId: string
  result?: Json | null
}): Promise<void> {
  const { supabase, taskId, result = null } = options
  const now = new Date().toISOString()

  const { data: step, error: stepError } = await supabase
    .from('workflow_run_steps')
    .select('run_id')
    .eq('id', taskId)
    .maybeSingle()

  if (stepError || !step) {
    throw new Error(stepError?.message ?? 'Task not found')
  }

  const { error: updateError } = await supabase
    .from('workflow_run_steps')
    .update({
      status: 'completed',
      result,
      completed_at: now,
    })
    .eq('id', taskId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  const engine = new WorkflowEngine(supabase)
  await engine.checkAndContinueRun(step.run_id)
}

