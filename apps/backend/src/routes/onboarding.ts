import type { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { User } from '../types'
import type { Database, Json } from '@database.types.ts'
import {
  TaskListResponseSchema,
  TaskCompleteInputSchema,
  type Task,
} from '@vibe/shared'
import { ensurePermission } from '../lib/permissions'
import { WorkflowEngine } from '../lib/workflow-engine'
import type { Env } from '../types'
import { completeWorkflowTask, mapRunStepToTask } from '../features/tasks/task-service'

export const registerOnboardingRoutes = (app: Hono<Env>) => {
  // Get journey by share token
  app.get('/api/journeys/:shareToken', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const shareToken = c.req.param('shareToken')

    try {
      const { data: journeyView, error } = await supabase
        .from('employee_journey_views')
        .select(`
          *,
          workflow_runs!inner (
            id,
            tenant_id,
            employee_id,
            status,
            employees!inner (
              id,
              name,
              email
            )
          )
        `)
        .eq('share_token', shareToken)
        .single()

      if (error || !journeyView) {
        return c.json({ error: 'Journey not found' }, 404)
      }

      const run = Array.isArray(journeyView.workflow_runs)
        ? journeyView.workflow_runs[0]
        : journeyView.workflow_runs

      if (!run) {
        return c.json({ error: 'Workflow run not found' }, 404)
      }

      const employee = Array.isArray(run.employees) ? run.employees[0] : run.employees

      return c.json({
        shareToken: journeyView.share_token,
        hero_copy: journeyView.hero_copy,
        description: 'Complete your onboarding tasks to get started',
        tenantId: run.tenant_id,
        employeeId: run.employee_id,
        employee: employee || null,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load journey'
      return c.json({ error: message }, 400)
    }
  })

  // Start onboarding workflow for an employee
  app.post('/api/onboarding/start', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const body = await c.req.json().catch(() => ({}))
    const { tenantId, employeeId, workflowId } = body as {
      tenantId?: string
      employeeId?: string
      workflowId?: string
    }

    if (!tenantId || !employeeId) {
      return c.json({ error: 'tenantId and employeeId are required' }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'workflows.run.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      const engine = new WorkflowEngine(supabase)

      // If workflowId is provided, start that specific workflow
      if (workflowId) {
        const { data: workflow } = await supabase
          .from('workflows')
          .select('id, active_version_id')
          .eq('id', workflowId)
          .eq('tenant_id', tenantId)
          .eq('status', 'published')
          .single()

        if (!workflow || !workflow.active_version_id) {
          return c.json({ error: 'Workflow not found or not published' }, 404)
        }

        const runId = await engine.instantiateRun({
          workflowId: workflow.id,
          versionId: workflow.active_version_id,
          tenantId,
          employeeId,
          triggerSource: 'manual',
          context: { started_by: user.id },
        })

        return c.json({ runId, message: 'Onboarding workflow started' })
      }

      // Otherwise, trigger onboarding workflows automatically
      await engine.handleTrigger({
        type: 'employee.created',
        tenantId,
        employeeId,
        payload: { started_by: user.id },
      })

      return c.json({ message: 'Onboarding workflows triggered' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to start onboarding'
      return c.json({ error: message }, 400)
    }
  })

  // Get onboarding instances/status for an employee
  app.get('/api/onboarding/instances/:employeeId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const employeeId = c.req.param('employeeId')
    const tenantId = c.req.query('tenantId')

    if (!tenantId) {
      return c.json({ error: 'tenantId query parameter is required' }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'workflows.read')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      const { data: runs, error } = await supabase
        .from('workflow_runs')
        .select(`
          id,
          workflow_id,
          status,
          started_at,
          completed_at,
          workflows!inner (
            id,
            name,
            kind
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .eq('workflows.kind', 'onboarding')
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(error.message)
      }

      return c.json({ instances: runs || [] })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load onboarding instances'
      return c.json({ error: message }, 400)
    }
  })

  // Get tasks for an employee
  app.get('/api/onboarding/tasks/:employeeId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const employeeId = c.req.param('employeeId')
    const tenantId = c.req.query('tenantId')

    if (!tenantId) {
      return c.json({ error: 'tenantId query parameter is required' }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'workflows.read')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      // Get workflow runs for this employee
      const { data: runs } = await supabase
        .from('workflow_runs')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .in('status', ['pending', 'in_progress'])

      if (!runs || runs.length === 0) {
        return c.json({ tasks: [] })
      }

      const runIds = runs.map((r: { id: string }) => r.id)

      // Get steps that are tasks (waiting_input status)
      const { data: steps, error } = await supabase
        .from('workflow_run_steps')
        .select('*')
        .in('run_id', runIds)
        .in('status', ['pending', 'waiting_input', 'in_progress'])
        .order('due_at', { ascending: true, nullsFirst: false })

      if (error) {
        throw new Error(error.message)
      }

      // Transform to Task format
      const tasks: Task[] = (steps || []).map((step: Database['public']['Tables']['workflow_run_steps']['Row']) =>
        mapRunStepToTask(step),
      )

      const payload = TaskListResponseSchema.safeParse({ tasks })
      if (!payload.success) {
        return c.json({ error: 'Unexpected response shape' }, 500)
      }

      return c.json(payload.data)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load tasks'
      return c.json({ error: message }, 400)
    }
  })

  // Mark a task as complete
  app.put('/api/onboarding/tasks/:id/complete', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const taskId = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const parsed = TaskCompleteInputSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    try {
      // Get the task to find tenant_id
      const { data: step, error: stepError } = await supabase
        .from('workflow_run_steps')
        .select(`
          id,
          run_id,
          workflow_runs!inner (
            tenant_id
          )
        `)
        .eq('id', taskId)
        .single()

      if (stepError || !step) {
        return c.json({ error: 'Task not found' }, 404)
      }

      const run = Array.isArray(step.workflow_runs) ? step.workflow_runs[0] : step.workflow_runs
      const tenantId = run?.tenant_id

      if (!tenantId) {
        return c.json({ error: 'Unable to determine tenant' }, 400)
      }

      await ensurePermission(supabase, tenantId, 'workflows.run.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      const resultPayload: Record<string, unknown> = {}
      const baseResult = parsed.data.result
      if (baseResult && typeof baseResult === 'object') {
        Object.assign(resultPayload, baseResult as Record<string, unknown>)
      } else if (baseResult !== undefined) {
        resultPayload.data = baseResult
      }

      if (parsed.data.notes) {
        resultPayload.notes = parsed.data.notes
      }
      if (parsed.data.documentId) {
        resultPayload.documentId = parsed.data.documentId
      }
      if (parsed.data.formResponse) {
        resultPayload.formResponse = parsed.data.formResponse
      }

      await completeWorkflowTask({
        supabase,
        taskId,
        result: (Object.keys(resultPayload).length > 0 ? (resultPayload as Json) : (baseResult as Json | null)) ?? null,
      })

      return c.json({ message: 'Task completed successfully' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to complete task'
      return c.json({ error: message }, 400)
    }
  })
}

