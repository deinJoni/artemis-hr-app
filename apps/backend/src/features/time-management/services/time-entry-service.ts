import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, Json } from '@database.types.ts'

export async function requiresApproval(
  entryDate: Date,
  entryType: 'clock' | 'manual',
  userId: string,
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  if (entryType === 'manual' && entryDate < new Date()) {
    return true
  }

  return false
}

export async function checkTimeEntryOverlap(
  userId: string,
  tenantId: string,
  startTime: Date,
  endTime: Date,
  supabase: SupabaseClient<Database>,
  excludeId?: string
): Promise<boolean> {
  let query = supabase
    .from('time_entries')
    .select('id, clock_in_at, clock_out_at')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .neq('approval_status', 'rejected')
  
  // Only add exclude filter if excludeId is provided and not empty
  if (excludeId && excludeId.trim() !== '') {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query

  if (error) throw error

  return (data || []).some((entry) => {
    const entryStart = new Date(entry.clock_in_at)
    const entryEnd = entry.clock_out_at ? new Date(entry.clock_out_at) : new Date()

    return (
      (startTime >= entryStart && startTime < entryEnd) ||
      (endTime > entryStart && endTime <= entryEnd) ||
      (startTime <= entryStart && endTime >= entryEnd)
    )
  })
}

export async function createAuditLog(
  timeEntryId: string,
  changedBy: string,
  fieldName: string,
  oldValue: unknown,
  newValue: unknown,
  supabase: SupabaseClient<Database>,
  changeReason?: string
): Promise<void> {
  const payload: Database['public']['Tables']['time_entry_audit']['Insert'] = {
    time_entry_id: timeEntryId,
    changed_by: changedBy,
    field_name: fieldName,
    old_value: (oldValue ?? null) as Json | null,
    new_value: (newValue ?? null) as Json | null,
    change_reason: changeReason ?? null,
  }

  const { error } = await supabase.from('time_entry_audit').insert(payload)

  if (error) throw error
}

export async function calculateOvertimeForPeriod(
  userId: string,
  tenantId: string,
  startDate: Date,
  endDate: Date,
  supabase: SupabaseClient<Database>
): Promise<{ regularHours: number; overtimeHours: number }> {
  const { data: rules, error: rulesError } = await supabase
    .from('overtime_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .single()

  if (rulesError) throw rulesError
  if (!rules) throw new Error('No overtime rules found for tenant')

  const { data: entries, error: entriesError } = await supabase
    .from('time_entries')
    .select('clock_in_at, clock_out_at, break_minutes')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('approval_status', 'approved')
    .gte('clock_in_at', startDate.toISOString())
    .lt('clock_in_at', endDate.toISOString())
    .not('clock_out_at', 'is', null)

  if (entriesError) throw entriesError

  let totalRegularHours = 0
  let totalOvertimeHours = 0
  const dailyHours: Record<string, number> = {}

  for (const entry of entries || []) {
    const clockIn = new Date(entry.clock_in_at)
    const clockOut = new Date(entry.clock_out_at!)
    const breakMinutes = entry.break_minutes || 0

    const totalMinutes = Math.max(0, clockOut.getTime() - clockIn.getTime()) / (1000 * 60)
    const netMinutes = Math.max(0, totalMinutes - breakMinutes)
    const netHours = netMinutes / 60

    const dateKey = clockIn.toISOString().split('T')[0]
    dailyHours[dateKey] = (dailyHours[dateKey] || 0) + netHours
  }

  for (const hours of Object.values(dailyHours)) {
    if (hours > rules.daily_threshold) {
      const dailyOvertime = hours - rules.daily_threshold
      totalOvertimeHours += dailyOvertime
      totalRegularHours += rules.daily_threshold
    } else {
      totalRegularHours += hours
    }
  }

  const totalHours = totalRegularHours + totalOvertimeHours
  if (totalHours > rules.weekly_threshold) {
    const weeklyOvertime = totalHours - rules.weekly_threshold
    const moveToOvertime = Math.min(weeklyOvertime, totalRegularHours)
    totalRegularHours -= moveToOvertime
    totalOvertimeHours += moveToOvertime
  }

  return {
    regularHours: Math.round(totalRegularHours * 100) / 100,
    overtimeHours: Math.round(totalOvertimeHours * 100) / 100,
  }
}

export async function getOrCreateOvertimeBalance(
  userId: string,
  tenantId: string,
  period: string,
  supabase: SupabaseClient<Database>
): Promise<any> {
  const { data: existing, error: fetchError } = await supabase
    .from('overtime_balances')
    .select('*')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('period', period)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') throw fetchError

  if (existing) return existing

  const { data: newBalance, error: createError } = await supabase
    .from('overtime_balances')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      period,
      regular_hours: 0,
      overtime_hours: 0,
      overtime_multiplier: 1.5,
      carry_over_hours: 0,
    })
    .select()
    .single()

  if (createError) throw createError
  return newBalance
}
