import type { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { User } from '../types'
import type { Database } from '@database.types.ts'
import {
  ExitInterviewSubmitInputSchema,
  ExitInterviewResponseSchema,
} from '@vibe/shared'
import { ensurePermission } from '../lib/permissions'
import { WorkflowEngine } from '../lib/workflow-engine'
import type { Env } from '../types'

export const registerOffboardingRoutes = (app: Hono<Env>) => {
  // Initiate offboarding for an employee
  app.post('/api/offboarding/initiate', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const body = await c.req.json().catch(() => ({}))
    const { tenantId, employeeId, lastDay, reason } = body as {
      tenantId?: string
      employeeId?: string
      lastDay?: string
      reason?: string
    }

    if (!tenantId || !employeeId) {
      return c.json({ error: 'tenantId and employeeId are required' }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'employees.write')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      // Update employee status/end_date
      const updateData: { end_date?: string; status?: string } = {}
      if (lastDay) {
        updateData.end_date = lastDay
      }
      // Don't update status to terminated immediately - let workflow handle it

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('employees')
          .update(updateData)
          .eq('id', employeeId)
          .eq('tenant_id', tenantId)

        if (updateError) {
          throw new Error(updateError.message)
        }
      }

      // Trigger offboarding workflow
      const engine = new WorkflowEngine(supabase)
      await engine.handleTrigger({
        type: 'employee.offboardingScheduled',
        tenantId,
        employeeId,
        payload: {
          lastDay,
          reason,
          initiated_by: user.id,
        },
      })

      return c.json({ message: 'Offboarding workflow initiated' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to initiate offboarding'
      return c.json({ error: message }, 400)
    }
  })

  // Get offboarding checklist for an employee
  app.get('/api/offboarding/checklist/:employeeId', async (c) => {
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
      // Get offboarding workflow runs
      const { data: runs } = await supabase
        .from('workflow_runs')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .eq('workflows.kind', 'offboarding')
        .in('status', ['pending', 'in_progress'])

      if (!runs || runs.length === 0) {
        return c.json({ checklist: [] })
      }

      const runIds = runs.map((r: { id: string }) => r.id)

      // Get checklist items (workflow steps)
      const { data: steps, error } = await supabase
        .from('workflow_run_steps')
        .select('*')
        .in('run_id', runIds)
        .order('created_at', { ascending: true })

      if (error) {
        throw new Error(error.message)
      }

      // Get equipment items
      const { data: equipment } = await supabase
        .from('equipment_items' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .in('status', ['assigned'])

      // Get access grants
      const { data: accessGrants } = await supabase
        .from('access_grants' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .is('revoked_at', null)

      return c.json({
        checklist: {
          workflowSteps: steps || [],
          equipment: equipment || [],
          accessGrants: accessGrants || [],
        },
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load checklist'
      return c.json({ error: message }, 400)
    }
  })

  // Submit exit interview
  app.post('/api/exit-interview/submit', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const body = await c.req.json().catch(() => ({}))
    const parsed = ExitInterviewSubmitInputSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const { employee_id: employeeId, ...interviewData } = parsed.data

    // Get employee to find tenant_id
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('tenant_id, user_id')
      .eq('id', employeeId)
      .single()

    if (empError || !employee) {
      return c.json({ error: 'Employee not found' }, 404)
    }

    // Check if user is submitting their own interview or has permission
    const isOwnInterview = employee.user_id === user.id

    if (!isOwnInterview) {
      try {
        await ensurePermission(supabase, employee.tenant_id, 'employees.write')
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Forbidden'
        return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
      }
    }

    try {
      const { data: interview, error: insertError } = await supabase
        .from('exit_interviews' as any)
        .insert({
          tenant_id: employee.tenant_id,
          employee_id: employeeId,
          conducted_at: new Date().toISOString(),
          ...interviewData,
          conducted_by: isOwnInterview ? null : user.id,
        } as any)
        .select()
        .single()

      if (insertError) {
        throw new Error(insertError.message)
      }

      const payload = ExitInterviewResponseSchema.safeParse({ interview })
      if (!payload.success) {
        return c.json({ error: 'Unexpected response shape' }, 500)
      }

      return c.json(payload.data)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to submit exit interview'
      return c.json({ error: message }, 400)
    }
  })
}

