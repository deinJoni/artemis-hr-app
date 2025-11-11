import type { SupabaseClient } from '@supabase/supabase-js'

import {
  TimeSummaryResponseSchema,
  type TimeSummaryResponse,
} from '@vibe/shared'

import type { Database } from '@database.types.ts'
import { endOfWeekUtc, startOfWeekUtc } from '../utils/time'

type GetTimeSummaryParams = {
  supabase: SupabaseClient<Database>
  tenantId: string
  userId: string
}

export async function getTimeSummary({
  supabase,
  tenantId,
  userId,
}: GetTimeSummaryParams): Promise<TimeSummaryResponse> {
  const now = new Date()
  const rangeStart = startOfWeekUtc(now)
  const rangeEnd = endOfWeekUtc(now)

  const entries = await supabase
    .from('time_entries')
    .select(
      'id, tenant_id, user_id, clock_in_at, clock_out_at, duration_minutes, location, created_at'
    )
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .gte('clock_in_at', rangeStart.toISOString())
    .lt('clock_in_at', rangeEnd.toISOString())

  if (entries.error) {
    throw new Error(entries.error.message)
  }

  const minutes = (entries.data ?? [])
    .map((e) => (typeof e.duration_minutes === 'number' ? e.duration_minutes : 0))
    .reduce((a, b) => a + b, 0)

  const activeOpen = await supabase
    .from('time_entries')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .is('clock_out_at', null)
    .maybeSingle()

  if (activeOpen.error && activeOpen.error.code !== 'PGRST116') {
    throw new Error(activeOpen.error.message)
  }

  const profile = await supabase
    .from('profiles')
    .select(
      'user_id, tenant_id, display_name, created_at, updated_at, pto_balance_days, sick_balance_days'
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (profile.error && profile.error.code !== 'PGRST116') {
    throw new Error(profile.error.message)
  }

  let activeEntry: any = null
  if (activeOpen.data) {
    activeEntry = {
      ...activeOpen.data,
      break_minutes: activeOpen.data.break_minutes ?? 0,
      project_task: activeOpen.data.project_task ?? null,
      notes: activeOpen.data.notes ?? null,
      entry_type: activeOpen.data.entry_type ?? 'clock',
      approval_status: activeOpen.data.approval_status ?? 'approved',
      approver_user_id: activeOpen.data.approver_user_id ?? null,
      approved_at: activeOpen.data.approved_at ?? null,
      edited_by: activeOpen.data.edited_by ?? null,
      updated_at: activeOpen.data.updated_at ?? activeOpen.data.created_at,
    }
  }

  const payload = {
    hoursThisWeek: Math.round((minutes / 60) * 100) / 100,
    targetHours: 40,
    activeEntry,
    pto_balance_days: Number(profile.data?.pto_balance_days ?? 0),
    sick_balance_days: Number(profile.data?.sick_balance_days ?? 0),
  }

  const parsed = TimeSummaryResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error('TimeSummaryResponseSchema validation failed')
  }

  return parsed.data
}
