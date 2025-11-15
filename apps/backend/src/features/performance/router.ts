import type { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { User } from '../../types'

import {
  CheckInCreateInputSchema,
  CheckInHistoryResponseSchema,
  CheckInSchema,
  CheckInUpdateInputSchema,
  GoalCreateInputSchema,
  GoalKeyResultSchema,
  GoalListResponseSchema,
  GoalSchema,
  GoalUpdateInputSchema,
  GoalUpdateSchema,
  MyTeamResponseSchema,
  type CheckIn,
  type Goal,
  type GoalKeyResult,
  type GoalUpdate,
  type EmployeeCustomFieldType,
} from '@vibe/shared'

import type { Database, Json } from '@database.types.ts'
import { ensurePermission } from '../../lib/permissions'
import {
  getEmployeeForUser,
  getPrimaryTenantId,
  hasPermission,
  type EmployeeRow,
} from '../../lib/tenant-context'
import type { Env } from '../../types'
import {
  assertGoalReadAccess,
  assertGoalWriteAccess,
  clampProgress,
  fetchGoalById,
  fetchGoalsForEmployee,
} from './services/goal-service'

export const registerPerformanceRoutes = (app: Hono<Env>) => {
  app.get('/api/my-team', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    let hasManagerPermission = false
    try {
      hasManagerPermission = await hasPermission(supabase, tenantId, 'check_ins.read')
    } catch (error: unknown) {
      return c.json({ error: error instanceof Error ? error.message : 'Permission check failed' }, 400)
    }

    const viewerEmployee = await getEmployeeForUser(supabase, tenantId, user)
    if (!hasManagerPermission && !viewerEmployee) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    let employeeQuery = supabase
      .from('employees')
      .select('id, tenant_id, name, email, manager_id')
      .eq('tenant_id', tenantId)

    if (viewerEmployee) {
      employeeQuery = employeeQuery.eq('manager_id', viewerEmployee.id)
    }

    const employees = await employeeQuery.order('name', { ascending: true })
    if (employees.error) {
      return c.json({ error: employees.error.message }, 400)
    }

    const teamRows = employees.data ?? []
    const teamIds = teamRows.map((row: { id: string }) => row.id)

    const goalStats = new Map<
      string,
      {
        total: number
        completed: number
        active: number
        progressSum: number
        progressCount: number
      }
    >()
    const lastCheckInByEmployee = new Map<string, string | null>()

    if (teamIds.length > 0) {
      const goalsRes = await supabase
        .from('goals')
        .select('employee_id, status, progress_pct')
        .eq('tenant_id', tenantId)
        .in('employee_id', teamIds)

      if (goalsRes.error) {
        return c.json({ error: goalsRes.error.message }, 400)
      }

      for (const row of goalsRes.data ?? []) {
        const employeeId = row.employee_id
        const status = row.status
        const progress = typeof row.progress_pct === 'number'
          ? row.progress_pct
          : Number(row.progress_pct ?? 0)

        const current = goalStats.get(employeeId) ?? {
          total: 0,
          completed: 0,
          active: 0,
          progressSum: 0,
          progressCount: 0,
        }
        current.total += 1
        if (status === 'completed') {
          current.completed += 1
        } else {
          current.active += 1
        }
        if (!Number.isNaN(progress)) {
          current.progressSum += progress
          current.progressCount += 1
        }
        goalStats.set(employeeId, current)
      }

      const checkInsRes = await supabase
        .from('check_ins')
        .select('employee_id, completed_at')
        .eq('tenant_id', tenantId)
        .in('employee_id', teamIds)
        .eq('status', 'completed')

      if (checkInsRes.error) {
        return c.json({ error: checkInsRes.error.message }, 400)
      }

      for (const row of checkInsRes.data ?? []) {
        if (!row.completed_at) continue
        const existing = lastCheckInByEmployee.get(row.employee_id)
        if (!existing || existing < row.completed_at) {
          lastCheckInByEmployee.set(row.employee_id, row.completed_at)
        }
      }

    }

    const team = teamRows.map((employee: { id: string; tenant_id: string; name: string; email: string; manager_id: string | null }) => {
      const summary = goalStats.get(employee.id)
      const avgProgressPct =
        summary && summary.progressCount > 0
          ? Math.round((summary.progressSum / summary.progressCount) * 100) / 100
          : 0
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        employeeEmail: employee.email ?? null,
        avatarUrl: null,
        managerEmployeeId: employee.manager_id ?? null,
        totalGoals: summary?.total ?? 0,
        completedGoals: summary?.completed ?? 0,
        activeGoals: summary?.active ?? 0,
        avgProgressPct,
        lastCheckInAt: lastCheckInByEmployee.get(employee.id) ?? null,
      }
    })

    const parsed = MyTeamResponseSchema.safeParse({ team })
    if (!parsed.success) {
      return c.json({ error: 'Unexpected response shape' }, 500)
    }

    return c.json(parsed.data)
  })

  app.get('/api/goals/me', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const viewerEmployee = await getEmployeeForUser(supabase, tenantId, user)
    if (!viewerEmployee) {
      return c.json({ error: 'Employee record not found' }, 404)
    }

    let goals: Goal[]
    try {
      goals = await fetchGoalsForEmployee(supabase, viewerEmployee.id)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load goals'
      return c.json({ error: message }, 400)
    }

    const parsed = GoalListResponseSchema.safeParse({ goals })
    if (!parsed.success) {
      return c.json({ error: 'Unexpected response shape' }, 500)
    }
    return c.json(parsed.data)
  })

  app.get('/api/my-team/:employeeId/goals', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const employeeId = c.req.param('employeeId')

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    let employee: EmployeeRow | null
    try {
      employee = await getEmployeeById(supabase, employeeId)
    } catch (error: unknown) {
      return c.json({ error: error instanceof Error ? error.message : 'Unable to fetch employee' }, 400)
    }

    if (!employee || employee.tenant_id !== tenantId) {
      return c.json({ error: 'Employee not found' }, 404)
    }

    try {
      await assertGoalReadAccess(supabase, tenantId, user, employee)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    let goals: Goal[]
    try {
      goals = await fetchGoalsForEmployee(supabase, employee.id)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load goals'
      return c.json({ error: message }, 400)
    }

    const parsed = GoalListResponseSchema.safeParse({ goals })
    if (!parsed.success) {
      return c.json({ error: 'Unexpected response shape' }, 500)
    }
    return c.json(parsed.data)
  })

  app.post('/api/goals', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User

    const body = await c.req.json().catch(() => ({}))
    const parsed = GoalCreateInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    if (parsed.data.tenantId !== tenantId) {
      return c.json({ error: 'tenantId mismatch' }, 400)
    }

    let employee: EmployeeRow | null
    try {
      employee = await getEmployeeById(supabase, parsed.data.employeeId)
    } catch (error: unknown) {
      return c.json({ error: error instanceof Error ? error.message : 'Unable to fetch employee' }, 400)
    }

    if (!employee || employee.tenant_id !== tenantId) {
      return c.json({ error: 'Employee not found' }, 404)
    }

    try {
      await assertGoalWriteAccess(supabase, tenantId, user, employee)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    const insertPayload: Database['public']['Tables']['goals']['Insert'] = {
      tenant_id: tenantId,
      employee_id: parsed.data.employeeId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status ?? 'todo',
      progress_pct: clampProgress(parsed.data.progressPct),
      due_date: parsed.data.dueDate ?? null,
      created_by: user.id,
      updated_by: user.id,
    }

    const inserted = await supabase
      .from('goals')
      .insert(insertPayload)
      .select('id')
      .single()

    if (inserted.error || !inserted.data) {
      return c.json({ error: inserted.error?.message ?? 'Unable to create goal' }, 400)
    }

    if (Array.isArray(parsed.data.keyResults) && parsed.data.keyResults.length > 0) {
      const keyResultsInsert = parsed.data.keyResults.map((kr) => ({
        goal_id: inserted.data.id,
        label: kr.label,
        target_value: kr.targetValue ?? null,
        current_value: kr.currentValue ?? null,
        status: kr.status ?? 'pending',
      }))

      const keyResultIns = await supabase.from('goal_key_results').insert(keyResultsInsert)
      if (keyResultIns.error) {
        return c.json({ error: keyResultIns.error.message }, 400)
      }
    }

    try {
      const goal = await fetchGoalById(supabase, inserted.data.id)
      return c.json(goal)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load goal'
      return c.json({ error: message }, 400)
    }
  })

  app.patch('/api/goals/:goalId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const goalId = c.req.param('goalId')

    const body = await c.req.json().catch(() => ({}))
    const parsed = GoalUpdateInputSchema.safeParse({ ...body, goalId })
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const existingGoalRes = await supabase
      .from('goals')
      .select('id, tenant_id, employee_id')
      .eq('id', goalId)
      .maybeSingle()
    if (existingGoalRes.error) {
      return c.json({ error: existingGoalRes.error.message }, 400)
    }
    if (!existingGoalRes.data) {
      return c.json({ error: 'Goal not found' }, 404)
    }

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    if (parsed.data.tenantId && parsed.data.tenantId !== tenantId) {
      return c.json({ error: 'tenantId mismatch' }, 400)
    }
    if (existingGoalRes.data.tenant_id !== tenantId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    let employee: EmployeeRow | null
    try {
      employee = await getEmployeeById(supabase, existingGoalRes.data.employee_id)
    } catch (error: unknown) {
      return c.json({ error: error instanceof Error ? error.message : 'Unable to fetch employee' }, 400)
    }
    if (!employee) {
      return c.json({ error: 'Employee not found' }, 404)
    }

    try {
      await assertGoalWriteAccess(supabase, tenantId, user, employee)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    const updatePayload: Database['public']['Tables']['goals']['Update'] = {}
    if (parsed.data.title !== undefined) updatePayload.title = parsed.data.title
    if (parsed.data.description !== undefined) updatePayload.description = parsed.data.description ?? null
    if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status
    if (parsed.data.progressPct !== undefined) updatePayload.progress_pct = clampProgress(parsed.data.progressPct)
    if (parsed.data.dueDate !== undefined) updatePayload.due_date = parsed.data.dueDate ?? null
    updatePayload.updated_by = user.id

    if (Object.keys(updatePayload).length > 0) {
      const upd = await supabase
        .from('goals')
        .update(updatePayload)
        .eq('id', goalId)
      if (upd.error) {
        return c.json({ error: upd.error.message }, 400)
      }
    }

    if (parsed.data.keyResults !== undefined) {
      const del = await supabase
        .from('goal_key_results')
        .delete()
        .eq('goal_id', goalId)
      if (del.error) {
        return c.json({ error: del.error.message }, 400)
      }

      if (parsed.data.keyResults.length > 0) {
        const toInsert = parsed.data.keyResults.map((kr) => ({
          goal_id: goalId,
          label: kr.label,
          target_value: kr.targetValue ?? null,
          current_value: kr.currentValue ?? null,
          status: kr.status ?? 'pending',
        }))
        const ins = await supabase.from('goal_key_results').insert(toInsert)
        if (ins.error) {
          return c.json({ error: ins.error.message }, 400)
        }
      }
    }

    try {
      const goal = await fetchGoalById(supabase, goalId)
      return c.json(goal)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load goal'
      return c.json({ error: message }, 400)
    }
  })

  app.delete('/api/goals/:goalId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const goalId = c.req.param('goalId')

    const existingGoalRes = await supabase
      .from('goals')
      .select('id, tenant_id, employee_id')
      .eq('id', goalId)
      .maybeSingle()
    if (existingGoalRes.error) {
      return c.json({ error: existingGoalRes.error.message }, 400)
    }
    if (!existingGoalRes.data) {
      return c.json({ error: 'Goal not found' }, 404)
    }

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    if (existingGoalRes.data.tenant_id !== tenantId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    let employee: EmployeeRow | null
    try {
      employee = await getEmployeeById(supabase, existingGoalRes.data.employee_id)
    } catch (error: unknown) {
      return c.json({ error: error instanceof Error ? error.message : 'Unable to fetch employee' }, 400)
    }
    if (!employee) {
      return c.json({ error: 'Employee not found' }, 404)
    }

    try {
      await assertGoalWriteAccess(supabase, tenantId, user, employee)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    const del = await supabase.from('goals').delete().eq('id', goalId)
    if (del.error) {
      return c.json({ error: del.error.message }, 400)
    }

    return c.body(null, 204)
  })

  app.post('/api/check-ins', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User

    const body = await c.req.json().catch(() => ({}))
    const parsed = CheckInCreateInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    if (parsed.data.tenantId !== tenantId) {
      return c.json({ error: 'tenantId mismatch' }, 400)
    }

    let employee: EmployeeRow | null
    try {
      employee = await getEmployeeById(supabase, parsed.data.employeeId)
    } catch (error: unknown) {
      return c.json({ error: error instanceof Error ? error.message : 'Unable to fetch employee' }, 400)
    }
    if (!employee || employee.tenant_id !== tenantId) {
      return c.json({ error: 'Employee not found' }, 404)
    }

    try {
      await assertCheckInWriteAccess(supabase, tenantId, user, employee)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    const insertPayload: Database['public']['Tables']['check_ins']['Insert'] = {
      tenant_id: tenantId,
      manager_user_id: user.id,
      employee_id: parsed.data.employeeId,
      status: 'draft',
      scheduled_for: parsed.data.scheduledFor ?? null,
      last_updated_by: user.id,
    }

    const inserted = await supabase
      .from('check_ins')
      .insert(insertPayload)
      .select('id')
      .single()
    if (inserted.error || !inserted.data) {
      return c.json({ error: inserted.error?.message ?? 'Unable to create check-in' }, 400)
    }

    if (parsed.data.agenda) {
      const agendaPayload: Database['public']['Tables']['check_in_agendas']['Insert'] = {
        check_in_id: inserted.data.id,
        accomplishments: parsed.data.agenda.accomplishments ?? null,
        priorities: parsed.data.agenda.priorities ?? null,
        roadblocks: parsed.data.agenda.roadblocks ?? null,
        notes_json: (parsed.data.agenda.notes as Json) ?? null,
        updated_at: new Date().toISOString(),
      }
      const agendaInsert = await supabase.from('check_in_agendas').upsert(agendaPayload, { onConflict: 'check_in_id' })
      if (agendaInsert.error) {
        return c.json({ error: agendaInsert.error.message }, 400)
      }
    }

    try {
      const checkIn = await fetchCheckInById(supabase, inserted.data.id)
      return c.json(checkIn)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load check-in'
      return c.json({ error: message }, 400)
    }
  })

  app.patch('/api/check-ins/:checkInId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const checkInId = c.req.param('checkInId')

    const body = await c.req.json().catch(() => ({}))
    const parsed = CheckInUpdateInputSchema.safeParse({ ...body, checkInId })
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const existingRes = await supabase
      .from('check_ins')
      .select('id, tenant_id, employee_id, manager_user_id, status, completed_at')
      .eq('id', checkInId)
      .maybeSingle()
    if (existingRes.error) {
      return c.json({ error: existingRes.error.message }, 400)
    }
    if (!existingRes.data) {
      return c.json({ error: 'Check-in not found' }, 404)
    }

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }
    if (existingRes.data.tenant_id !== tenantId || (parsed.data.tenantId && parsed.data.tenantId !== tenantId)) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const employee = await getEmployeeById(supabase, existingRes.data.employee_id)
    if (!employee) {
      return c.json({ error: 'Employee not found' }, 404)
    }

    const viewerEmployee = await getEmployeeForUser(supabase, tenantId, user)

    let hasWritePermission = false
    try {
      hasWritePermission = await hasPermission(supabase, tenantId, 'check_ins.write')
    } catch (error: unknown) {
      return c.json({ error: error instanceof Error ? error.message : 'Permission check failed' }, 400)
    }

    const isManager = existingRes.data.manager_user_id === user.id
    const isEmployee = viewerEmployee ? viewerEmployee.id === employee.id : false
    const canManage = hasWritePermission || isManager

    if (!canManage && !isEmployee) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    if (!canManage) {
      if (parsed.data.status !== undefined || parsed.data.scheduledFor !== undefined || parsed.data.privateNote !== undefined) {
        return c.json({ error: 'Forbidden' }, 403)
      }
    }

    if (parsed.data.privateNote !== undefined && !canManage) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    if (parsed.data.agenda) {
      const agendaPayload: Database['public']['Tables']['check_in_agendas']['Insert'] = {
        check_in_id: existingRes.data.id,
        accomplishments: parsed.data.agenda.accomplishments ?? null,
        priorities: parsed.data.agenda.priorities ?? null,
        roadblocks: parsed.data.agenda.roadblocks ?? null,
        notes_json: (parsed.data.agenda.notes as Json) ?? null,
        updated_at: new Date().toISOString(),
      }
      const upsertAgenda = await supabase.from('check_in_agendas').upsert(agendaPayload, { onConflict: 'check_in_id' })
      if (upsertAgenda.error) {
        return c.json({ error: upsertAgenda.error.message }, 400)
      }
    }

    if (parsed.data.privateNote !== undefined && canManage) {
      const notePayload: Database['public']['Tables']['check_in_private_notes']['Insert'] = {
        check_in_id: existingRes.data.id,
        manager_user_id: existingRes.data.manager_user_id,
        body: parsed.data.privateNote ?? null,
        created_at: new Date().toISOString(),
      }
      const noteUpsert = await supabase
        .from('check_in_private_notes')
        .upsert(notePayload, { onConflict: 'check_in_id' })
      if (noteUpsert.error) {
        return c.json({ error: noteUpsert.error.message }, 400)
      }
    }

    const updatePayload: Database['public']['Tables']['check_ins']['Update'] = {}
    if (canManage) {
      if (parsed.data.scheduledFor !== undefined) {
        updatePayload.scheduled_for = parsed.data.scheduledFor ?? null
      }
      if (parsed.data.status !== undefined) {
        updatePayload.status = parsed.data.status
        if (parsed.data.status === 'completed') {
          updatePayload.completed_at = existingRes.data.completed_at ?? new Date().toISOString()
        } else if (parsed.data.status === 'draft') {
          updatePayload.completed_at = null
        }
      }
      updatePayload.last_updated_by = user.id
    }

    if (Object.keys(updatePayload).length > 0) {
      const upd = await supabase
        .from('check_ins')
        .update(updatePayload)
        .eq('id', existingRes.data.id)
      if (upd.error) {
        return c.json({ error: upd.error.message }, 400)
      }
    }

    try {
      const checkIn = await fetchCheckInById(supabase, existingRes.data.id)
      return c.json(checkIn)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load check-in'
      return c.json({ error: message }, 400)
    }
  })

  app.get('/api/check-ins/:employeeId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const employeeId = c.req.param('employeeId')

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const employee = await getEmployeeById(supabase, employeeId)
    if (!employee || employee.tenant_id !== tenantId) {
      return c.json({ error: 'Employee not found' }, 404)
    }

    try {
      await assertCheckInReadAccess(supabase, tenantId, user, employee)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    const rows = await supabase
      .from('check_ins')
      .select(`
        id, tenant_id, manager_user_id, employee_id, status, scheduled_for, completed_at, last_updated_by, created_at, updated_at,
        check_in_agendas ( accomplishments, priorities, roadblocks, notes_json, updated_at ),
        check_in_private_notes!left ( body, manager_user_id, created_at )
      `)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })

    if (rows.error) {
      return c.json({ error: rows.error.message }, 400)
    }

    const items = (rows.data ?? []).map((row: any) => {
      const checkIn = mapCheckInRow(row as CheckInWithRelations)
      return {
        checkIn,
        agenda: checkIn.agenda,
      }
    })

    const parsed = CheckInHistoryResponseSchema.safeParse({ items })
    if (!parsed.success) {
      return c.json({ error: 'Unexpected response shape' }, 500)
    }
    return c.json(parsed.data)
  })

  app.get('/api/check-in/:checkInId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const checkInId = c.req.param('checkInId')

    let checkIn: CheckIn
    try {
      checkIn = await fetchCheckInById(supabase, checkInId)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Check-in not found'
      return c.json({ error: message }, 404)
    }

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }
    if (checkIn.tenantId !== tenantId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const employee = await getEmployeeById(supabase, checkIn.employeeId)
    if (!employee) {
      return c.json({ error: 'Employee not found' }, 404)
    }

    try {
      await assertCheckInReadAccess(supabase, tenantId, user, employee)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    return c.json(checkIn)
  })

  app.get('/api/check-ins/me', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const viewerEmployee = await getEmployeeForUser(supabase, tenantId, user)
    if (!viewerEmployee) {
      return c.json({ error: 'Employee record not found' }, 404)
    }

    try {
      await assertCheckInReadAccess(supabase, tenantId, user, viewerEmployee)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    const rows = await supabase
      .from('check_ins')
      .select(`
        id, tenant_id, manager_user_id, employee_id, status, scheduled_for, completed_at, last_updated_by, created_at, updated_at,
        check_in_agendas ( accomplishments, priorities, roadblocks, notes_json, updated_at ),
        check_in_private_notes!left ( body, manager_user_id, created_at )
      `)
      .eq('employee_id', viewerEmployee.id)
      .order('created_at', { ascending: false })

    if (rows.error) {
      return c.json({ error: rows.error.message }, 400)
    }

    const items = (rows.data ?? []).map((row: any) => {
      const checkIn = mapCheckInRow(row as CheckInWithRelations)
      return {
        checkIn,
        agenda: checkIn.agenda,
      }
    })

    const parsed = CheckInHistoryResponseSchema.safeParse({ items })
    if (!parsed.success) {
      return c.json({ error: 'Unexpected response shape' }, 500)
    }
    return c.json(parsed.data)
  })

  async function validateAndCoerceCustomFields(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    input: unknown,
  ): Promise<Record<string, Json> | null> {
    if (input == null) return null
    if (typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('custom_fields must be an object')
    }

    const defs = await supabase
      .from('employee_custom_field_defs')
      .select('key, type, required, options, position')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true })

    if (defs.error) throw new Error(defs.error.message)

    const byKey = new Map(
      (defs.data ?? []).map((d: { key: string; type: string; required: boolean; options: unknown; position: number }) => [d.key as string, d] as const),
    )

    const raw = input as Record<string, unknown>
    const output: Record<string, Json> = {}

    for (const [key, value] of Object.entries(raw)) {
      const def = byKey.get(key)
      if (!def) {
        // Ignore undefined custom fields to keep API lenient; definitions control allowed keys.
        continue
      }
      output[key] = coerceCustomFieldValue(def.type as EmployeeCustomFieldType, value, def.options as unknown)
    }

    // Ensure required fields present (when definitions require)
    for (const def of defs.data ?? []) {
      if (def.required && !(def.key in output)) {
        throw new Error(`Missing required custom field: ${def.key}`)
      }
    }

    return output
  }

  function coerceCustomFieldValue(
    type: EmployeeCustomFieldType,
    value: unknown,
    options: unknown,
  ): Json {
    if (value == null) return null
    switch (type) {
      case 'text':
        return String(value)
      case 'number': {
        const num = typeof value === 'number' ? value : Number(String(value))
        if (!Number.isFinite(num)) throw new Error('Invalid number')
        return num
      }
      case 'date': {
        const str = typeof value === 'string' ? value : String(value)
        const d = new Date(str)
        if (Number.isNaN(d.getTime())) throw new Error('Invalid date')
        return d.toISOString()
      }
      case 'boolean': {
        if (typeof value === 'boolean') return value
        if (value === 'true' || value === '1' || value === 1) return true
        if (value === 'false' || value === '0' || value === 0) return false
        throw new Error('Invalid boolean')
      }
      case 'select': {
        const choices: unknown = (options && typeof options === 'object' && options !== null)
          ? (options as any).choices
          : undefined
        if (!Array.isArray(choices)) {
          throw new Error('Invalid select options')
        }
        const val = String(value)
        if (!choices.includes(val)) throw new Error('Value not in select choices')
        return val
      }
      default:
        return String(value)
    }
  }

  type CheckInRow = Database['public']['Tables']['check_ins']['Row']
  type CheckInAgendaRow = Database['public']['Tables']['check_in_agendas']['Row']
  type CheckInPrivateNoteRow = Database['public']['Tables']['check_in_private_notes']['Row']

  type CheckInWithRelations = CheckInRow & {
    check_in_agendas?: CheckInAgendaRow | CheckInAgendaRow[] | null
    check_in_private_notes?: CheckInPrivateNoteRow | CheckInPrivateNoteRow[] | null
  }

  async function getEmployeeById(
    supabase: SupabaseClient<Database>,
    employeeId: string,
  ): Promise<EmployeeRow | null> {
    const res = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .maybeSingle()
    if (res.error && res.error.code !== 'PGRST116') {
      throw new Error(res.error.message)
    }
    return res.data ?? null
  }

  async function assertCheckInWriteAccess(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    user: User,
    employee: EmployeeRow,
  ): Promise<void> {
    try {
      if (await hasPermission(supabase, tenantId, 'check_ins.write')) return
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Unable to verify permissions')
    }

    const viewerEmployee = await getEmployeeForUser(supabase, tenantId, user)
    if (!viewerEmployee || employee.manager_id !== viewerEmployee.id) {
      throw new Error('Forbidden')
    }
  }

  async function assertCheckInReadAccess(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    user: User,
    employee: EmployeeRow,
  ): Promise<void> {
    try {
      if (await hasPermission(supabase, tenantId, 'check_ins.read')) return
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Unable to verify permissions')
    }

    const viewerEmployee = await getEmployeeForUser(supabase, tenantId, user)
    if (!viewerEmployee) {
      throw new Error('Forbidden')
    }

    if (viewerEmployee.id === employee.id) return
    if (employee.manager_id === viewerEmployee.id) return

    throw new Error('Forbidden')
  }

  function mapCheckInRow(row: CheckInWithRelations): CheckIn {
    const agendaRow = Array.isArray(row.check_in_agendas)
      ? row.check_in_agendas[0]
      : row.check_in_agendas ?? null
    const privateNoteRow = Array.isArray(row.check_in_private_notes)
      ? row.check_in_private_notes[0]
      : row.check_in_private_notes ?? null

    const payload = {
      id: row.id,
      tenantId: row.tenant_id,
      managerUserId: row.manager_user_id,
      employeeId: row.employee_id,
      status: row.status,
      scheduledFor: row.scheduled_for ?? null,
      completedAt: row.completed_at ?? null,
      lastUpdatedBy: row.last_updated_by ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      agenda: agendaRow
        ? {
            accomplishments: agendaRow.accomplishments ?? null,
            priorities: agendaRow.priorities ?? null,
            roadblocks: agendaRow.roadblocks ?? null,
            notes: agendaRow.notes_json ?? null,
            updatedAt: agendaRow.updated_at ?? null,
          }
        : undefined,
      privateNote: privateNoteRow?.body ?? null,
    }

    return CheckInSchema.parse(payload)
  }

  async function fetchCheckInById(
    supabase: SupabaseClient<Database>,
    checkInId: string,
  ): Promise<CheckIn> {
    const res = await supabase
      .from('check_ins')
      .select(`
        id, tenant_id, manager_user_id, employee_id, status, scheduled_for, completed_at, last_updated_by, created_at, updated_at,
        check_in_agendas ( accomplishments, priorities, roadblocks, notes_json, updated_at ),
        check_in_private_notes!left ( body, manager_user_id, created_at )
      `)
      .eq('id', checkInId)
      .maybeSingle()

    if (res.error) {
      throw new Error(res.error.message)
    }
    if (!res.data) {
      throw new Error('Check-in not found')
    }

    return mapCheckInRow(res.data as CheckInWithRelations)
  }

}
