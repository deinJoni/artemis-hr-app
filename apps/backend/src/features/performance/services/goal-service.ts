import type { SupabaseClient, User } from '@supabase/supabase-js'

import {
  GoalKeyResultSchema,
  GoalSchema,
  GoalUpdateSchema,
  type Goal,
  type GoalKeyResult,
  type GoalUpdate,
} from '@vibe/shared'

import type { Database } from '@database.types.ts'
import { getEmployeeForUser, hasPermission } from '../../../lib/tenant-context'

type GoalRow = Database['public']['Tables']['goals']['Row']
type GoalKeyResultRow = Database['public']['Tables']['goal_key_results']['Row']
type GoalUpdateRow = Database['public']['Tables']['goal_updates']['Row']
type EmployeeRow = Database['public']['Tables']['employees']['Row']

type GoalWithRelations = GoalRow & {
  goal_key_results?: GoalKeyResultRow[] | null
  goal_updates?: GoalUpdateRow[] | null
}

export function clampProgress(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0
  if (value < 0) return 0
  if (value > 100) return 100
  return Math.round(value * 100) / 100
}

export async function fetchGoalsForEmployee(
  supabase: SupabaseClient<Database>,
  employeeId: string,
): Promise<Goal[]> {
  const res = await supabase
    .from('goals')
    .select(`
      id, tenant_id, employee_id, title, description, status, progress_pct, due_date, created_by, updated_by, created_at, updated_at,
      goal_key_results ( id, goal_id, label, target_value, current_value, status, created_at, updated_at ),
      goal_updates ( id, goal_id, author_id, body, created_at )
    `)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: true })

  if (res.error) throw new Error(res.error.message)
  return (res.data ?? []).map((row) => mapGoalRow(row as GoalWithRelations))
}

export async function fetchGoalById(
  supabase: SupabaseClient<Database>,
  goalId: string,
): Promise<Goal> {
  const res = await supabase
    .from('goals')
    .select(`
      id, tenant_id, employee_id, title, description, status, progress_pct, due_date, created_by, updated_by, created_at, updated_at,
      goal_key_results ( id, goal_id, label, target_value, current_value, status, created_at, updated_at ),
      goal_updates ( id, goal_id, author_id, body, created_at )
    `)
    .eq('id', goalId)
    .maybeSingle()

  if (res.error) throw new Error(res.error.message)
  if (!res.data) throw new Error('Goal not found')
  return mapGoalRow(res.data as GoalWithRelations)
}

export async function assertGoalReadAccess(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  user: User,
  employee: EmployeeRow,
): Promise<void> {
  try {
    if (await hasPermission(supabase, tenantId, 'goals.read')) return
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Unable to verify permissions')
  }

  const viewerEmployee = await getEmployeeForUser(supabase, tenantId, user)
  if (!viewerEmployee || viewerEmployee.id !== employee.id) {
    throw new Error('Forbidden')
  }
}

export async function assertGoalWriteAccess(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  user: User,
  employee: EmployeeRow,
): Promise<void> {
  try {
    if (await hasPermission(supabase, tenantId, 'goals.write')) return
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Unable to verify permissions')
  }

  const viewerEmployee = await getEmployeeForUser(supabase, tenantId, user)
  if (!viewerEmployee || viewerEmployee.id !== employee.id) {
    throw new Error('Forbidden')
  }
}

function mapGoalRow(row: GoalWithRelations): Goal {
  const keyResults = (row.goal_key_results ?? []).map(mapGoalKeyResultRow)
  const updates = (row.goal_updates ?? []).map(mapGoalUpdateRow)

  const goal = {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    progressPct: clampProgress(
      typeof row.progress_pct === 'number' ? row.progress_pct : Number(row.progress_pct ?? 0),
    ),
    dueDate: row.due_date ?? null,
    createdBy: row.created_by,
    updatedBy: row.updated_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    keyResults,
    updates,
  }
  return GoalSchema.parse(goal)
}

function mapGoalKeyResultRow(row: GoalKeyResultRow): GoalKeyResult {
  const payload = {
    id: row.id,
    goalId: row.goal_id,
    label: row.label,
    targetValue: row.target_value == null ? null : Number(row.target_value),
    currentValue: row.current_value == null ? null : Number(row.current_value),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
  return GoalKeyResultSchema.parse(payload)
}

function mapGoalUpdateRow(row: GoalUpdateRow): GoalUpdate {
  const payload = {
    id: row.id,
    goalId: row.goal_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
  }
  return GoalUpdateSchema.parse(payload)
}
