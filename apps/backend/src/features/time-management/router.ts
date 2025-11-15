import type { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { User } from '../../types'

import {
  ApproveTimeOffRequestInputSchema,
  CalendarResponseSchema,
  CalendarRangeQuerySchema,
  BlackoutPeriodCreateInputSchema,
  BlackoutPeriodListQuerySchema,
  BlackoutPeriodListResponseSchema,
  BlackoutPeriodSchema,
  BlackoutPeriodUpdateInputSchema,
  CreateLeaveRequestInputSchema,
  CreateTimeOffRequestInputSchema,
  HolidayCalendarBulkImportSchema,
  HolidayCalendarCreateInputSchema,
  LeaveBalanceAdjustmentInputSchema,
  LeaveBalanceSchema,
  LeaveBalanceSummarySchema,
  LeaveComplianceValidationResultSchema,
  LeaveRequestApprovalInputSchema,
  LeaveRequestListQuerySchema,
  LeaveRequestListResponseSchema,
  LeaveRequestUpdateInputSchema,
  LeaveTypeCreateInputSchema,
  LeaveTypeUpdateInputSchema,
  ManagerCalendarFilterSchema,
  ManualTimeEntryInputSchema,
  OvertimeCalculationRequestSchema,
  OvertimeRuleSchema,
  CreateOvertimeRequestInputSchema,
  OvertimeRequestApprovalInputSchema,
  OvertimeRequestSchema,
  PendingApprovalsResponseSchema,
  TeamLeaveCalendarQuerySchema,
  TeamLeaveCalendarResponseSchema,
  TimeEntryApprovalInputSchema,
  TimeEntryListQuerySchema,
  TimeEntryListResponseSchema,
  TimeEntrySchema,
  TimeEntryUpdateInputSchema,
  TimeExportRequestSchema,
  EmployeeCustomFieldDefSchema,
  EmployeeCustomFieldDefCreateSchema,
  EmployeeCustomFieldDefUpdateSchema,
} from '@vibe/shared'

import type { Database } from '@database.types.ts'
import { ensurePermission } from '../../lib/permissions'
import { getPrimaryTenantId } from '../../lib/tenant-context'
import { supabaseAdmin } from '../../lib/supabase'
import type { Env } from '../../types'
import { format } from 'date-fns'
import {
  clampNonNegative,
  endOfWeekUtc,
  formatTimeDisplay,
  parseIso,
  parseIsoDate,
  startOfWeekUtc,
} from './utils/time'
import {
  calculateOvertimeForPeriod,
  checkTimeEntryOverlap,
  createAuditLog,
  getOrCreateOvertimeBalance,
  requiresApproval,
} from './services/time-entry-service'
import { getTimeSummary } from './services/time-summary-service'

export const registerTimeManagementRoutes = (app: Hono<Env>) => {

  // ---------------- Time Management Endpoints ----------------

  // Summary for "My Time" widget
  app.get('/api/time/summary', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }
    try {
      const result = await getTimeSummary({
        supabase,
        tenantId,
        userId: user.id,
      })
      return c.json(result)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load time summary'
      return c.json({ error: message }, 500)
    }
  })

  // Clock in
  app.post('/api/time/clock-in', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const existing = await supabase
      .from('time_entries')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .is('clock_out_at', null)
      .limit(1)

    if (existing.error) return c.json({ error: existing.error.message }, 400)
    if ((existing.data ?? []).length > 0) return c.json({ error: 'Already clocked in' }, 409)

    const inserted = await supabase
      .from('time_entries')
      .insert({ tenant_id: tenantId, user_id: user.id })
      .select('id, tenant_id, user_id, clock_in_at, clock_out_at, duration_minutes, location, created_at')
      .single()

    if (inserted.error || !inserted.data) {
      return c.json({ error: inserted.error?.message ?? 'Unable to clock in' }, 400)
    }

    return c.json(inserted.data)
  })

  // Clock out
  app.post('/api/time/clock-out', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const open = await supabase
      .from('time_entries')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .is('clock_out_at', null)
      .maybeSingle()

    if (open.error && open.error.code !== 'PGRST116') {
      return c.json({ error: open.error.message }, 400)
    }
    if (!open.data) return c.json({ error: 'No active time entry' }, 409)

    const nowIso = new Date().toISOString()
    const upd = await supabase
      .from('time_entries')
      .update({ clock_out_at: nowIso })
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('id', open.data.id)
      .select('id, tenant_id, user_id, clock_in_at, clock_out_at, duration_minutes, location, created_at')
      .single()

    if (upd.error || !upd.data) {
      return c.json({ error: upd.error?.message ?? 'Unable to clock out' }, 400)
    }

    return c.json(upd.data)
  })

  // Create time off request
  app.post('/api/time-off/requests', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    const body = await c.req.json().catch(() => ({}))
    const parsed = CreateTimeOffRequestInputSchema.safeParse(body)
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

    const ins = await supabase
      .from('time_off_requests')
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        leave_type: parsed.data.leave_type,
        note: parsed.data.note ?? null,
      })
      .select('id, tenant_id, user_id, start_date, end_date, leave_type, status, approver_user_id, decided_at, note, created_at')
      .single()

    if (ins.error || !ins.data) {
      return c.json({ error: ins.error?.message ?? 'Unable to create request' }, 400)
    }

    return c.json(ins.data)
  })

  // Approve/Deny time off request
  app.put('/api/time-off/requests/:id/approve', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const id = c.req.param('id')

    const body = await c.req.json().catch(() => ({}))
    const parsed = ApproveTimeOffRequestInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    // Load via RLS first to avoid leaking across tenants
    const reqRow = await supabase
      .from('time_off_requests')
      .select('id, tenant_id, user_id, start_date, end_date, leave_type, status')
      .eq('id', id)
      .maybeSingle()

    if (reqRow.error) return c.json({ error: reqRow.error.message }, 400)
    if (!reqRow.data) return c.json({ error: 'Request not found' }, 404)

    const tenantId = reqRow.data.tenant_id
    try {
      await ensurePermission(supabase, tenantId, 'time_off.approve')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    const decision = parsed.data.decision
    const status = decision === 'approve' ? 'approved' : 'denied'
    const decidedAt = new Date().toISOString()

    // Update request status (admin to bypass requester-only RLS on updates)
    const upd = await supabaseAdmin
      .from('time_off_requests')
      .update({ status, approver_user_id: user.id, decided_at: decidedAt })
      .eq('id', id)
      .select('id, tenant_id, user_id, start_date, end_date, leave_type, status, approver_user_id, decided_at')
      .single()

    if (upd.error || !upd.data) {
      return c.json({ error: upd.error?.message ?? 'Unable to update request' }, 400)
    }

    // On approve, deduct balances for PTO/sick (not for unpaid)
    if (status === 'approved') {
      const start = parseIso(reqRow.data.start_date)
      const end = parseIso(reqRow.data.end_date)
      if (start && end) {
        const msPerDay = 24 * 60 * 60 * 1000
        const days = Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1
        const column = reqRow.data.leave_type === 'sick' ? 'sick_balance_days' : (reqRow.data.leave_type === 'unpaid' ? null : 'pto_balance_days')
        if (column) {
          // Fetch current balances
          const prof = await supabaseAdmin
            .from('profiles')
            .select('user_id, pto_balance_days, sick_balance_days')
            .eq('user_id', reqRow.data.user_id)
            .maybeSingle()

          if (!prof.error && prof.data) {
            const current = Number((prof.data as any)[column] ?? 0)
            const next = clampNonNegative(current - days)
            await supabaseAdmin
              .from('profiles')
              .update({ [column]: next } as any)
              .eq('user_id', reqRow.data.user_id)
          }
        }
      }
    }

    return c.json(upd.data)
  })

  // Enhanced team calendar with filtering and export
  app.get('/api/calendar', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'calendar.read')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    const url = new URL(c.req.url)
    const query = {
      start: url.searchParams.get('start') || undefined,
      end: url.searchParams.get('end') || undefined,
      user_ids: url.searchParams.getAll('user_ids[]'),
      status: url.searchParams.get('status') || undefined,
      department_id: url.searchParams.get('department_id') || undefined,
      include_breaks: url.searchParams.get('include_breaks') === 'true',
      format: url.searchParams.get('format') || 'json',
    }

    const parsed = ManagerCalendarFilterSchema.safeParse(query)
    if (!parsed.success) {
      return c.json({ error: 'Invalid query parameters', details: parsed.error.issues }, 400)
    }

    const { start, end, user_ids, status, department_id, include_breaks, format } = parsed.data

    const startDate = parseIso(start)
    const endDate = parseIso(end)
    if (!startDate || !endDate || endDate <= startDate) {
      return c.json({ error: 'Invalid start/end range' }, 400)
    }

    // Get team members based on filters
    let teamQuery = supabase
      .from('employees')
      .select('id, user_id, name, email, employee_number, department_id, status')
      .eq('tenant_id', tenantId)

    if (user_ids && user_ids.length > 0) {
      teamQuery = teamQuery.in('user_id', user_ids)
    }

    if (department_id) {
      teamQuery = teamQuery.eq('department_id', department_id)
    }

    const { data: teamMembers, error: teamError } = await teamQuery
    if (teamError) return c.json({ error: teamError.message }, 400)

    const teamUserIds = (teamMembers || []).map((m: { user_id: string | null }) => m.user_id)

    // Get approved time off overlapping range
    let timeOffQuery = supabase
      .from('time_off_requests')
      .select('id, user_id, start_date, end_date, leave_type, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'approved')
      .lte('start_date', endDate.toISOString())
      .gte('end_date', startDate.toISOString())

    if (teamUserIds.length > 0) {
      const validUserIds = teamUserIds.filter((id: string | null): id is string => id !== null)
      if (validUserIds.length > 0) {
        timeOffQuery = timeOffQuery.in('user_id', validUserIds)
      }
    }

    const { data: timeOff, error: timeOffError } = await timeOffQuery
    if (timeOffError) return c.json({ error: timeOffError.message }, 400)

    // Get time entries overlapping range with enhanced data
    let timeEntriesQuery = supabase
      .from('time_entries')
      .select(`
        id, user_id, clock_in_at, clock_out_at, break_minutes, 
        project_task, notes, entry_type, approval_status
      `)
      .eq('tenant_id', tenantId)
      .lt('clock_in_at', endDate.toISOString())
      .or(`clock_out_at.is.null,clock_out_at.gte.${startDate.toISOString()}`)

    if (teamUserIds.length > 0) {
      const validUserIds = teamUserIds.filter((id: string | null): id is string => id !== null)
      if (validUserIds.length > 0) {
        timeEntriesQuery = timeEntriesQuery.in('user_id', validUserIds)
      }
    }

    const { data: timeEntries, error: timeEntriesError } = await timeEntriesQuery
    if (timeEntriesError) return c.json({ error: timeEntriesError.message }, 400)

    // Create employee lookup map
    const employeeMap = new Map((teamMembers || []).map((emp: { user_id: string | null; name: string; email: string; employee_number: string | null; department_id: string | null; status: string }) => [emp.user_id, emp]))

    // Build events array
    const events = [
      ...((timeOff || []).map((r: { id: string; user_id: string; start_date: string; end_date: string; leave_type: string; status: string }) => {
        const evStart = new Date(r.start_date)
        evStart.setUTCHours(0, 0, 0, 0)
        const evEnd = new Date(r.end_date)
        evEnd.setUTCHours(0, 0, 0, 0)
        evEnd.setUTCDate(evEnd.getUTCDate() + 1) // make inclusive
        const employee = employeeMap.get(r.user_id)
        return {
          id: `off_${r.id}`,
          title: `Time Off - ${employee?.name || 'Unknown'}`,
          start: evStart.toISOString(),
          end: evEnd.toISOString(),
          kind: 'time_off' as const,
          userId: r.user_id,
          leaveType: r.leave_type as any,
          employeeName: employee?.name,
          employeeEmail: employee?.email,
          employeeNumber: employee?.employee_number,
        }
      })),
      ...((timeEntries || []).map((e: { id: string; user_id: string; clock_in_at: string; clock_out_at: string | null; break_minutes: number; project_task: string | null; notes: string | null; entry_type: string; approval_status: string }) => {
        const employee = employeeMap.get(e.user_id)
        const duration = e.clock_out_at ? 
          Math.max(0, new Date(e.clock_out_at).getTime() - new Date(e.clock_in_at).getTime()) / (1000 * 60) : 0
        const netDuration = Math.max(0, duration - (e.break_minutes || 0))
        
        return {
        id: `te_${e.id}`,
          title: `Worked Time - ${employee?.name || 'Unknown'}`,
        start: e.clock_in_at,
        end: e.clock_out_at ?? e.clock_in_at,
        kind: 'time_entry' as const,
        userId: e.user_id,
          employeeName: employee?.name,
          employeeEmail: employee?.email,
          employeeNumber: employee?.employee_number,
          duration: Math.round(duration),
          netDuration: Math.round(netDuration),
          breakMinutes: e.break_minutes || 0,
          projectTask: e.project_task,
          notes: e.notes,
          entryType: e.entry_type,
          approvalStatus: e.approval_status,
        }
      })),
    ]

    // Apply status filter
    let filteredEvents = events
    if (status && status !== 'all') {
      filteredEvents = events.filter(event => {
        if (event.kind === 'time_off') return true // Time off is always "on-leave"
        if (event.kind === 'time_entry') {
          switch (status) {
            case 'clocked-in':
              return !event.end || event.end === event.start
            case 'not-clocked-in':
              return false // This would need additional logic to show who hasn't clocked in
            case 'on-leave':
              return false // Time off entries are handled separately
            case 'absent':
              return false // This would need additional logic
            default:
              return true
          }
        }
        return true
      })
    }

    // Handle CSV export
    if (format === 'csv') {
      const csvHeaders = [
        'Date',
        'Employee Name',
        'Employee Email',
        'Employee Number',
        'Type',
        'Start Time',
        'End Time',
        'Duration (minutes)',
        'Net Duration (minutes)',
        'Break (minutes)',
        'Project/Task',
        'Notes',
        'Status'
      ]

      const csvRows = filteredEvents.map(event => {
        const startDate = new Date(event.start)
        const endDate = new Date(event.end)
        
        return [
          startDate.toISOString().split('T')[0],
          event.employeeName || '',
          event.employeeEmail || '',
          event.employeeNumber || '',
          event.kind === 'time_off' ? 'Time Off' : 'Work Time',
          startDate.toISOString(),
          endDate.toISOString(),
          event.kind === 'time_entry' ? (event.duration || 0) : 0,
          event.kind === 'time_entry' ? (event.netDuration || 0) : 0,
          event.kind === 'time_entry' ? (event.breakMinutes || 0) : 0,
          event.kind === 'time_entry' ? (event.projectTask || '') : '',
          event.kind === 'time_entry' ? (event.notes || '') : '',
          event.kind === 'time_entry' ? (event.approvalStatus || '') : (event.kind === 'time_off' ? 'approved' : '')
        ]
      })

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n')

      c.header('Content-Type', 'text/csv')
      c.header('Content-Disposition', `attachment; filename="team-calendar-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv"`)
      return c.text(csvContent)
    }

    // Return JSON response
    const calendarParsed = CalendarResponseSchema.safeParse({ events: filteredEvents })
    if (!calendarParsed.success) return c.json({ error: 'Unexpected response shape' }, 500)
    return c.json(calendarParsed.data)
  })

  // Time export endpoint for detailed reports
  app.get('/api/time/export', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'time.view_team')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, 403)
    }

    const url = new URL(c.req.url)
    const query = {
      format: url.searchParams.get('format') || 'csv',
      start_date: url.searchParams.get('start_date') || undefined,
      end_date: url.searchParams.get('end_date') || undefined,
      user_ids: url.searchParams.getAll('user_ids[]'),
      include_breaks: url.searchParams.get('include_breaks') === 'true',
      include_notes: url.searchParams.get('include_notes') === 'true',
    }

    const parsed = TimeExportRequestSchema.safeParse(query)
    if (!parsed.success) {
      return c.json({ error: 'Invalid query parameters', details: parsed.error.issues }, 400)
    }

    const { format, start_date, end_date, user_ids, include_breaks, include_notes } = parsed.data

    const startDate = parseIso(start_date)
    const endDate = parseIso(end_date)
    if (!startDate || !endDate || endDate <= startDate) {
      return c.json({ error: 'Invalid start/end range' }, 400)
    }

    // Get time entries
    let timeEntriesQuery = supabase
      .from('time_entries')
      .select(`
        id, user_id, clock_in_at, clock_out_at, break_minutes, 
        project_task, notes, entry_type, approval_status, created_at
      `)
      .eq('tenant_id', tenantId)
      .gte('clock_in_at', startDate.toISOString())
      .lte('clock_in_at', endDate.toISOString())

    if (user_ids && user_ids.length > 0) {
      timeEntriesQuery = timeEntriesQuery.in('user_id', user_ids)
    }

    const { data: timeEntries, error: timeEntriesError } = await timeEntriesQuery
    if (timeEntriesError) return c.json({ error: timeEntriesError.message }, 400)

    // Get employee data
    const userIds = [...new Set((timeEntries || []).map((e: { user_id: string; clock_in_at: string; clock_out_at: string | null; break_minutes: number; project_task: string | null; notes: string | null; entry_type: string; approval_status: string; created_at: string }) => e.user_id))]
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('user_id, name, email, employee_number, department_id')
      .in('user_id', userIds)

    if (employeesError) return c.json({ error: employeesError.message }, 400)

    const employeeMap = new Map((employees || []).map((emp: { user_id: string | null; name: string; email: string; employee_number: string | null; department_id: string | null }) => [emp.user_id, emp]))

    // Build CSV
    const csvHeaders = [
      'Date',
      'Employee Name',
      'Employee Email',
      'Employee Number',
      'Clock In',
      'Clock Out',
      'Duration (hours)',
      'Break (minutes)',
      'Net Duration (hours)',
      'Project/Task',
      'Entry Type',
      'Status'
    ]

    if (include_notes) {
      csvHeaders.push('Notes')
    }

    const csvRows = (timeEntries || []).map((entry: { id: string; user_id: string; clock_in_at: string; clock_out_at: string | null; break_minutes: number; project_task: string | null; notes: string | null; entry_type: string; approval_status: string; created_at: string }) => {
      const employee = employeeMap.get(entry.user_id)
      const clockIn = new Date(entry.clock_in_at)
      const clockOut = entry.clock_out_at ? new Date(entry.clock_out_at) : null
      const duration = clockOut ? 
        Math.max(0, clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60) : 0
      const netDuration = Math.max(0, duration - (entry.break_minutes || 0) / 60)
      
      const row = [
        clockIn.toISOString().split('T')[0],
        employee?.name || '',
        employee?.email || '',
        employee?.employee_number || '',
        clockIn.toISOString(),
        clockOut?.toISOString() || '',
        duration.toFixed(2),
        entry.break_minutes || 0,
        netDuration.toFixed(2),
        entry.project_task || '',
        entry.entry_type,
        entry.approval_status
      ]

      if (include_notes) {
        row.push(entry.notes || '')
      }

      return row
    })

    const csvContent = [csvHeaders, ...csvRows]
      .map((row: (string | number)[]) => row.map((cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    c.header('Content-Type', 'text/csv')
    c.header('Content-Disposition', `attachment; filename="time-export-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv"`)
    return c.text(csvContent)
  })

  // ==============================================
  // Manual Time Entry Endpoints
  // ==============================================

  // Create manual time entry
  app.post('/api/time/entries', async (c) => {
    try {
      const user = c.get('user') as User
      const supabase = c.get('supabase') as SupabaseClient<Database>

      let tenantId: string
      try {
        tenantId = await getPrimaryTenantId(supabase)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
        console.error('Error getting tenant ID:', error)
        return c.json({ error: message }, 400)
      }

      // Parse request body with error handling to ensure CORS headers are set
      let body: unknown
      try {
        body = await c.req.json()
      } catch (error) {
        console.error('Error parsing JSON:', error)
        return c.json({ error: 'Invalid JSON in request body' }, 400)
      }

      const parsed = ManualTimeEntryInputSchema.safeParse(body)
      if (!parsed.success) {
        console.error('Validation error:', parsed.error.issues)
        return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400)
      }

      const { date, start_time, end_time, break_minutes, project_task, notes } = parsed.data

      // Combine date and time
      const clockInAt = new Date(`${date}T${start_time}`)
      const clockOutAt = new Date(`${date}T${end_time}`)

      // Validate times
      if (clockOutAt <= clockInAt) {
        return c.json({ error: 'End time must be after start time' }, 400)
      }

      // Check for overlaps
      let hasOverlap = false
      try {
        hasOverlap = await checkTimeEntryOverlap(
          user.id,
          tenantId,
          clockInAt,
          clockOutAt,
          supabase
        )
      } catch (error) {
        console.error('Error checking overlap:', error)
        const message = error instanceof Error ? error.message : 'Error checking for overlapping entries'
        return c.json({ error: message }, 500)
      }

      if (hasOverlap) {
        return c.json({ error: 'Time entry overlaps with existing entry' }, 409)
      }

      // Check if approval is required
      let needsApproval = false
      try {
        needsApproval = await requiresApproval(
          new Date(date),
          'manual',
          user.id,
          supabase
        )
      } catch (error) {
        console.error('Error checking approval requirement:', error)
        // Default to requiring approval on error for safety
        needsApproval = true
      }

      const approvalStatus = needsApproval ? 'pending' : 'approved'
      // Ensure approver_user_id is either a valid UUID or null (never empty string)
      const approverUserId = needsApproval ? null : (user.id || null)
      const approvedAt = needsApproval ? null : new Date().toISOString()

      // Ensure all UUID fields are valid (not empty strings)
      if (!tenantId || tenantId.trim() === '') {
        return c.json({ error: 'Invalid tenant ID' }, 400)
      }
      if (!user.id || user.id.trim() === '') {
        return c.json({ error: 'Invalid user ID' }, 400)
      }

      // Create time entry
      const { data: entry, error } = await supabase
        .from('time_entries')
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          clock_in_at: clockInAt.toISOString(),
          clock_out_at: clockOutAt.toISOString(),
          break_minutes: break_minutes || 0,
          project_task: project_task && project_task.trim() !== '' ? project_task : null,
          notes: notes && notes.trim() !== '' ? notes : null,
          entry_type: 'manual',
          approval_status: approvalStatus,
          approver_user_id: approverUserId && approverUserId.trim() !== '' ? approverUserId : null,
          approved_at: approvedAt,
        })
        .select('*')
        .single()

      if (error) {
        console.error('Database error creating time entry:', error)
        return c.json({ error: error.message, details: error.details || error.hint }, 400)
      }

      return c.json(entry)
    } catch (error: unknown) {
      console.error('Unexpected error in POST /api/time/entries:', error)
      const message = error instanceof Error ? error.message : 'Internal server error'
      return c.json({ error: message }, 500)
    }
  })

  // List time entries with filters
  app.get('/api/time/entries', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const url = new URL(c.req.url)
    const query = {
      user_id: url.searchParams.get('user_id') || undefined,
      start_date: url.searchParams.get('start_date') || undefined,
      end_date: url.searchParams.get('end_date') || undefined,
      status: url.searchParams.get('status') || undefined,
      entry_type: url.searchParams.get('entry_type') || undefined,
      project_task: url.searchParams.get('project_task') || undefined,
      page: parseInt(url.searchParams.get('page') || '1'),
      page_size: parseInt(url.searchParams.get('page_size') || '20'),
    }

    const parsed = TimeEntryListQuerySchema.safeParse(query)
    if (!parsed.success) {
      return c.json({ error: 'Invalid query parameters', details: parsed.error.issues }, 400)
    }

    const { user_id, start_date, end_date, status, entry_type, project_task, page, page_size } = parsed.data

    // Build query
    let queryBuilder = supabase
      .from('time_entries')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)

    // Apply filters
    if (user_id) {
      // Check if user can view other users' entries
      if (user_id !== user.id) {
        try {
          await ensurePermission(supabase, tenantId, 'time.view_team')
        } catch {
          return c.json({ error: 'Forbidden' }, 403)
        }
      }
      queryBuilder = queryBuilder.eq('user_id', user_id)
    } else {
      // Default to current user's entries
      queryBuilder = queryBuilder.eq('user_id', user.id)
    }

    if (start_date) {
      queryBuilder = queryBuilder.gte('clock_in_at', start_date)
    }
    if (end_date) {
      queryBuilder = queryBuilder.lte('clock_in_at', end_date)
    }
    if (status) {
      queryBuilder = queryBuilder.eq('approval_status', status)
    }
    if (entry_type) {
      queryBuilder = queryBuilder.eq('entry_type', entry_type)
    }
    if (project_task) {
      queryBuilder = queryBuilder.ilike('project_task', `%${project_task}%`)
    }

    // Apply pagination
    const from = (page - 1) * page_size
    const to = from + page_size - 1
    queryBuilder = queryBuilder.range(from, to).order('clock_in_at', { ascending: false })

    const { data: entries, error, count } = await queryBuilder

    if (error) return c.json({ error: error.message }, 400)

    const totalPages = Math.ceil((count || 0) / page_size)

    const response = {
      entries: entries || [],
      pagination: {
        page,
        page_size,
        total: count || 0,
        total_pages: totalPages,
      },
    }

    const parsedResponse = TimeEntryListResponseSchema.safeParse(response)
    if (!parsedResponse.success) {
      return c.json({ error: 'Unexpected response shape' }, 500)
    }

    return c.json(parsedResponse.data)
  })

  // Update time entry
  app.put('/api/time/entries/:id', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const entryId = c.req.param('id')
    const body = await c.req.json()
    const parsed = TimeEntryUpdateInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400)
    }

    // Get existing entry
    const { data: existing, error: fetchError } = await supabase
      .from('time_entries')
      .select('*')
      .eq('id', entryId)
      .eq('tenant_id', tenantId)
      .single()

    if (fetchError) return c.json({ error: fetchError.message }, 400)
    if (!existing) return c.json({ error: 'Time entry not found' }, 404)

    // Check permissions
    if (existing.user_id !== user.id) {
      try {
        await ensurePermission(supabase, tenantId, 'time.view_team')
      } catch {
        return c.json({ error: 'Forbidden' }, 403)
      }
    }

    // Check if editing past entries requires special permission
    const entryDate = new Date(existing.clock_in_at)
    if (entryDate < new Date() && existing.entry_type === 'manual') {
      try {
        await ensurePermission(supabase, tenantId, 'time.edit_past')
      } catch {
        return c.json({ error: 'Editing past manual entries requires special permission' }, 403)
      }
    }

    const { start_time, end_time, break_minutes, project_task, notes, change_reason } = parsed.data

    // Build update object
    const updates: any = {}
    const changes: Array<{ field: string; old: any; new: any }> = []

    if (start_time !== undefined) {
      const newClockIn = new Date(`${entryDate.toISOString().split('T')[0]}T${start_time}`)
      updates.clock_in_at = newClockIn.toISOString()
      changes.push({ field: 'clock_in_at', old: existing.clock_in_at, new: updates.clock_in_at })
    }

    if (end_time !== undefined) {
      const newClockOut = new Date(`${entryDate.toISOString().split('T')[0]}T${end_time}`)
      updates.clock_out_at = newClockOut.toISOString()
      changes.push({ field: 'clock_out_at', old: existing.clock_out_at, new: updates.clock_out_at })
    }

    if (break_minutes !== undefined) {
      updates.break_minutes = break_minutes
      changes.push({ field: 'break_minutes', old: existing.break_minutes, new: break_minutes })
    }

    if (project_task !== undefined) {
      updates.project_task = project_task
      changes.push({ field: 'project_task', old: existing.project_task, new: project_task })
    }

    if (notes !== undefined) {
      updates.notes = notes
      changes.push({ field: 'notes', old: existing.notes, new: notes })
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: 'No changes provided' }, 400)
    }

    // Validate new times if both are provided
    if (updates.clock_in_at && updates.clock_out_at) {
      const newClockIn = new Date(updates.clock_in_at)
      const newClockOut = new Date(updates.clock_out_at)
      if (newClockOut <= newClockIn) {
        return c.json({ error: 'End time must be after start time' }, 400)
      }
    }

    // Check for overlaps with new times
    const finalClockIn = updates.clock_in_at ? new Date(updates.clock_in_at) : new Date(existing.clock_in_at)
    const finalClockOut = updates.clock_out_at ? new Date(updates.clock_out_at) : new Date(existing.clock_out_at || existing.clock_in_at)

    const hasOverlap = await checkTimeEntryOverlap(
      existing.user_id,
      tenantId,
      finalClockIn,
      finalClockOut,
      supabase,
      entryId
    )

    if (hasOverlap) {
      return c.json({ error: 'Time entry overlaps with existing entry' }, 409)
    }

    // Update entry
    updates.edited_by = user.id
    updates.updated_at = new Date().toISOString()

    const { data: updated, error: updateError } = await supabase
      .from('time_entries')
      .update(updates)
      .eq('id', entryId)
      .select('*')
      .single()

    if (updateError) return c.json({ error: updateError.message }, 400)

    // Create audit log entries
    for (const change of changes) {
      await createAuditLog(
        entryId,
        user.id,
        change.field,
        change.old,
        change.new,
        supabase,
        change_reason
      )
    }

    return c.json(updated)
  })

  // Delete time entry
  app.delete('/api/time/entries/:id', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const entryId = c.req.param('id')

    // Get existing entry
    const { data: existing, error: fetchError } = await supabase
      .from('time_entries')
      .select('*')
      .eq('id', entryId)
      .eq('tenant_id', tenantId)
      .single()

    if (fetchError) return c.json({ error: fetchError.message }, 400)
    if (!existing) return c.json({ error: 'Time entry not found' }, 404)

    // Check permissions
    if (existing.user_id !== user.id) {
      try {
        await ensurePermission(supabase, tenantId, 'time.view_team')
      } catch {
        return c.json({ error: 'Forbidden' }, 403)
      }
    }

    // Soft delete by setting approval_status to 'rejected'
    const { error: updateError } = await supabase
      .from('time_entries')
      .update({
        approval_status: 'rejected',
        edited_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId)

    if (updateError) return c.json({ error: updateError.message }, 400)

    // Create audit log
    await createAuditLog(
      entryId,
      user.id,
      'approval_status',
      existing.approval_status,
      'rejected',
      supabase,
      'Entry deleted'
    )

    return c.json({ success: true })
  })

  // ==============================================
  // Approval Workflow Endpoints
  // ==============================================

  // Get pending approvals for manager's team
  app.get('/api/time/entries/pending', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'time.approve')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, 403)
    }

    const url = new URL(c.req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('page_size') || '20')

    // Get pending approvals using the view
    const { data: approvals, error, count } = await supabase
      .from('pending_time_approvals')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (error) return c.json({ error: error.message }, 400)

    const response = {
      approvals: approvals || [],
      pagination: {
        page,
        page_size: pageSize,
        total: count || 0,
      },
    }

    const parsed = PendingApprovalsResponseSchema.safeParse(response)
    if (!parsed.success) {
      return c.json({ error: 'Unexpected response shape' }, 500)
    }

    return c.json(parsed.data)
  })

  // Approve/reject time entry
  app.put('/api/time/entries/:id/approve', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
      await ensurePermission(supabase, tenantId, 'time.approve')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const entryId = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const parsed = TimeEntryApprovalInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    // Get the entry first to check old status and get details
    const { data: oldEntry, error: fetchError } = await supabase
      .from('time_entries')
      .select('*')
      .eq('id', entryId)
      .eq('tenant_id', tenantId)
      .single()

    if (fetchError || !oldEntry) {
      return c.json({ error: 'Time entry not found' }, 404)
    }

    const oldStatus = oldEntry.approval_status
    const newStatus = parsed.data.decision === 'approve' ? 'approved' : 'rejected'

    // Validate entry can be processed
    if (oldStatus !== 'pending') {
      return c.json({ error: `Cannot approve or reject a ${oldStatus} entry` }, 400)
    }

    // Note: Since we've already checked oldStatus is 'pending', 
    // it can never equal newStatus ('approved' or 'rejected'), so idempotency check is not needed here
    // But we keep the structure for consistency with leave approvals

    // Require reason for rejection
    if (parsed.data.decision === 'reject' && !parsed.data.reason?.trim()) {
      return c.json({ error: 'Rejection reason is required' }, 400)
    }

    // Update entry
    const { data: updated, error: updateError } = await supabase
      .from('time_entries')
      .update({
        approval_status: newStatus,
        approver_user_id: user.id,
        approved_at: parsed.data.decision === 'approve' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .select('*')
      .single()

    if (updateError) {
      return c.json({ error: updateError.message }, 400)
    }

    // Create audit log
    await createAuditLog(
      entryId,
      user.id,
      'approval_status',
      'pending',
      newStatus,
      supabase,
      parsed.data.reason
    )

    return c.json(updated)
  })

  // Get audit trail for time entry
  app.get('/api/time/entries/:id/audit', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const entryId = c.req.param('id')

    // Check if user can view this entry
    const { data: entry, error: fetchError } = await supabase
      .from('time_entries')
      .select('user_id')
      .eq('id', entryId)
      .eq('tenant_id', tenantId)
      .single()

    if (fetchError) return c.json({ error: fetchError.message }, 400)
    if (!entry) return c.json({ error: 'Time entry not found' }, 404)

    if (entry.user_id !== user.id) {
      try {
        await ensurePermission(supabase, tenantId, 'time.view_team')
      } catch {
        return c.json({ error: 'Forbidden' }, 403)
      }
    }

    // Get audit trail
    const { data: audit, error } = await supabase
      .from('time_entry_audit')
      .select('*')
      .eq('time_entry_id', entryId)
      .order('created_at', { ascending: false })

    if (error) return c.json({ error: error.message }, 400)

    return c.json({ audit: audit || [] })
  })

  // ==============================================
  // Overtime Management Endpoints
  // ==============================================

  // Get current user's overtime balance
  app.get('/api/overtime/balance', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    // Check permission, but don't fail if check fails - allow users to view their own overtime
    try {
      await ensurePermission(supabase, tenantId, 'overtime.view')
    } catch (error: unknown) {
      // Permission check failed, but we'll still allow viewing own balance
      // Log for debugging but continue
      console.warn('Permission check failed for overtime.view, continuing anyway:', error)
    }

    const url = new URL(c.req.url)
    const period = url.searchParams.get('period') || getCurrentPeriod()

    const { data: balance, error } = await supabase
      .from('overtime_balances')
      .select('*')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .eq('period', period)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      return c.json({ error: error.message }, 400)
    }

    if (!balance) {
      // Create default balance if none exists
      const { data: newBalance, error: createError } = await supabase
        .from('overtime_balances')
        .insert({
          user_id: user.id,
          tenant_id: tenantId,
          period,
          regular_hours: 0,
          overtime_hours: 0,
          overtime_multiplier: 1.5,
          carry_over_hours: 0,
        })
        .select()
        .single()

      if (createError) return c.json({ error: createError.message }, 400)
      return c.json(newBalance)
    }

    return c.json(balance)
  })

  // Get specific user's overtime balance (manager only)
  app.get('/api/overtime/balance/:userId', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'time.view_team')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, 403)
    }

    const targetUserId = c.req.param('userId')
    const url = new URL(c.req.url)
    const period = url.searchParams.get('period') || getCurrentPeriod()

    const { data: balance, error } = await supabase
      .from('overtime_balances')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('tenant_id', tenantId)
      .eq('period', period)
      .single()

    if (error && error.code !== 'PGRST116') {
      return c.json({ error: error.message }, 400)
    }

    if (!balance) {
      return c.json({
        user_id: targetUserId,
        tenant_id: tenantId,
        period,
        regular_hours: 0,
        overtime_hours: 0,
        overtime_multiplier: 1.5,
        carry_over_hours: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    return c.json(balance)
  })

  // Trigger overtime calculation for period (admin only)
  app.post('/api/overtime/calculate', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'overtime.approve')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, 403)
    }

    const body = await c.req.json()
    const parsed = OvertimeCalculationRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400)
    }

    const { user_id, start_date, end_date } = parsed.data

    const start = new Date(start_date)
    const end = new Date(end_date)

    if (end <= start) {
      return c.json({ error: 'End date must be after start date' }, 400)
    }

    try {
      const { regularHours, overtimeHours } = await calculateOvertimeForPeriod(
        user_id,
        tenantId,
        start,
        end,
        supabase
      )

      // Get or create balance for the period
      const period = getPeriodForDate(start)
      const balance = await getOrCreateOvertimeBalance(user_id, tenantId, period, supabase)

      // Update balance
      const { data: updated, error: updateError } = await supabase
        .from('overtime_balances')
        .update({
          regular_hours: regularHours,
          overtime_hours: overtimeHours,
          updated_at: new Date().toISOString(),
        })
        .eq('id', balance.id)
        .select()
        .single()

      if (updateError) return c.json({ error: updateError.message }, 400)

      return c.json(updated)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Calculation failed'
      return c.json({ error: message }, 500)
    }
  })

  // Get tenant's overtime rules
  app.get('/api/overtime/rules', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'overtime.view')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, 403)
    }

    const { data: rules, error } = await supabase
      .from('overtime_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) return c.json({ error: error.message }, 400)

    return c.json({ rules: rules || [] })
  })

  // Create overtime request
  app.post('/api/overtime/request', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const body = await c.req.json()
    const parsed = CreateOvertimeRequestInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400)
    }

    const { start_date, end_date, estimated_hours, reason } = parsed.data

    // Validate date range
    const startDate = parseIso(start_date)
    const endDate = parseIso(end_date)
    if (!startDate || !endDate || endDate < startDate) {
      return c.json({ error: 'Invalid date range' }, 400)
    }

    // Check if user is a member of the tenant
    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return c.json({ error: 'Not a member of this tenant' }, 403)
    }

    // Create overtime request
    const { data: request, error } = await supabase
      .from('overtime_requests')
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        start_date: start_date,
        end_date: end_date,
        estimated_hours: estimated_hours,
        reason: reason,
        status: 'pending',
      })
      .select('*')
      .single()

    if (error) return c.json({ error: error.message }, 400)

    return c.json(request)
  })

  // Get overtime requests (for user's own requests or manager's team requests)
  app.get('/api/overtime/requests', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const url = new URL(c.req.url)
    const status = url.searchParams.get('status') || undefined
    const userId = url.searchParams.get('user_id') || undefined

    // Check if user has permission to view team requests
    let canViewTeam = false
    try {
      await ensurePermission(supabase, tenantId, 'time.view_team')
      canViewTeam = true
    } catch {
      // User doesn't have team view permission
    }

    let query = supabase
      .from('overtime_requests')
      .select('*')
      .eq('tenant_id', tenantId)

    // If user can view team and userId is specified, show that user's requests
    // Otherwise, show only user's own requests
    if (canViewTeam && userId) {
      query = query.eq('user_id', userId)
    } else {
      query = query.eq('user_id', user.id)
    }

    if (status) {
      query = query.eq('status', status)
    }

    query = query.order('created_at', { ascending: false })

    const { data: requests, error } = await query

    if (error) return c.json({ error: error.message }, 400)

    return c.json({ requests: requests || [] })
  })

  // Approve/deny overtime request
  app.put('/api/overtime/requests/:id/approve', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'time.approve')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, 403)
    }

    const requestId = c.req.param('id')
    const body = await c.req.json()
    const parsed = OvertimeRequestApprovalInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400)
    }

    const { decision, denial_reason } = parsed.data

    // Get existing request
    const { data: existing, error: fetchError } = await supabase
      .from('overtime_requests')
      .select('*')
      .eq('id', requestId)
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .single()

    if (fetchError) return c.json({ error: fetchError.message }, 400)
    if (!existing) return c.json({ error: 'Pending overtime request not found' }, 404)

    // Update request
    const { data: updated, error: updateError } = await supabase
      .from('overtime_requests')
      .update({
        status: decision === 'approve' ? 'approved' : 'denied',
        approver_user_id: user.id,
        decided_at: new Date().toISOString(),
        denial_reason: decision === 'deny' ? denial_reason || null : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select('*')
      .single()

    if (updateError) return c.json({ error: updateError.message }, 400)

    return c.json(updated)
  })

  // Helper function to get current period (e.g., "2025-W10")
  function getCurrentPeriod(): string {
    const now = new Date()
    const year = now.getFullYear()
    const week = getWeekNumber(now)
    return `${year}-W${week.toString().padStart(2, '0')}`
  }

  // Helper function to get period for a specific date
  function getPeriodForDate(date: Date): string {
    const year = date.getFullYear()
    const week = getWeekNumber(date)
    return `${year}-W${week.toString().padStart(2, '0')}`
  }

  // Helper function to get week number
  function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }

  // Pending time-off requests for approvers (manager+)
  app.get('/api/time-off/requests/pending', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'time_off.approve')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    const rows = await supabase
      .from('time_off_requests')
      .select('id, user_id, start_date, end_date, leave_type, status, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (rows.error) return c.json({ error: rows.error.message }, 400)

    // Enrich with requester display_name
    const enriched = await Promise.all(
      (rows.data ?? []).map(async (r: { id: string; user_id: string; start_date: string; end_date: string; leave_type: string; status: string; created_at: string }) => {
        const prof = await supabase
          .from('profiles')
          .select('display_name, user_id')
          .eq('user_id', r.user_id)
          .maybeSingle()
        const name = prof.data?.display_name ?? 'Member'
        return { ...r, display_name: name }
      }),
    )

    return c.json({ requests: enriched })
  })

  // ---------------- Employee Field Definitions endpoints ----------------

  app.get('/api/employee-fields/:tenantId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')

    const canRead = await supabase.rpc('app_has_permission', { permission: 'employees.read', tenant: tenantId })
    if (canRead.error) return c.json({ error: canRead.error.message }, 400)
    if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

    const rows = await supabase
      .from('employee_custom_field_defs')
      .select('id, tenant_id, name, key, type, required, options, position, created_at')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })

    if (rows.error) return c.json({ error: rows.error.message }, 400)

    const parsed = rows.data?.map((r: Database['public']['Tables']['employee_custom_field_defs']['Row']) => EmployeeCustomFieldDefSchema.parse(r)) ?? []
    return c.json({ fields: parsed })
  })

  app.post('/api/employee-fields/:tenantId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const body = await c.req.json().catch(() => ({}))
    const parsed = EmployeeCustomFieldDefCreateSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    if (parsed.data.tenant_id !== tenantId) return c.json({ error: 'tenant_id mismatch' }, 400)

    try {
      await ensurePermission(supabase, tenantId, 'employees.fields.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    const key = slugKey(parsed.data.key)
    const insertPayload: Database['public']['Tables']['employee_custom_field_defs']['Insert'] = {
      tenant_id: tenantId,
      name: parsed.data.name,
      key,
      type: parsed.data.type,
      required: parsed.data.required ?? false,
      options: parsed.data.options ?? null,
      position: parsed.data.position ?? 0,
    }

    const ins = await supabase
      .from('employee_custom_field_defs')
      .insert(insertPayload)
    if (ins.error) return c.json({ error: ins.error.message }, 400)

    return c.redirect(`/api/employee-fields/${tenantId}`)
  })

  app.put('/api/employee-fields/:tenantId/:id', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const parsed = EmployeeCustomFieldDefUpdateSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)

    try {
      await ensurePermission(supabase, tenantId, 'employees.fields.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    const upd = await supabase
      .from('employee_custom_field_defs')
      .update(parsed.data)
      .eq('tenant_id', tenantId)
      .eq('id', id)
    if (upd.error) return c.json({ error: upd.error.message }, 400)

    return c.redirect(`/api/employee-fields/${tenantId}`)
  })

  app.delete('/api/employee-fields/:tenantId/:id', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const id = c.req.param('id')

    try {
      await ensurePermission(supabase, tenantId, 'employees.fields.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    const del = await supabase
      .from('employee_custom_field_defs')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', id)
    if (del.error) return c.json({ error: del.error.message }, 400)

    return c.redirect(`/api/employee-fields/${tenantId}`)
  })

  // ==============================================
  // LEAVE & ABSENCE MANAGEMENT ENDPOINTS
  // ==============================================

  // Leave Types Management
  app.get('/api/leave/types', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const { data: leaveTypes, error } = await supabase
      .from('leave_types')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name')

    if (error) return c.json({ error: error.message }, 400)

    return c.json({ leaveTypes })
  })

  app.post('/api/leave/types', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
      await ensurePermission(supabase, tenantId, 'leave.manage_types')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = LeaveTypeCreateInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const { data: leaveType, error } = await supabase
      .from('leave_types')
      .insert({
        tenant_id: tenantId,
        ...parsed.data,
      })
      .select()
      .single()

    if (error) return c.json({ error: error.message }, 400)

    return c.json(leaveType)
  })

  app.put('/api/leave/types/:id', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const id = c.req.param('id')

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
      await ensurePermission(supabase, tenantId, 'leave.manage_types')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = LeaveTypeUpdateInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const { data: leaveType, error } = await supabase
      .from('leave_types')
      .update(parsed.data)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) return c.json({ error: error.message }, 400)

    return c.json(leaveType)
  })

  app.delete('/api/leave/types/:id', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const id = c.req.param('id')

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
      await ensurePermission(supabase, tenantId, 'leave.manage_types')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const { error } = await supabase
      .from('leave_types')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) return c.json({ error: error.message }, 400)

    return c.json({ success: true })
  })

  // Leave Balances
  app.get('/api/leave/balances/my-balance', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    // Get employee ID for current user
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    // If employee doesn't exist, return empty balances (user hasn't been set up as employee yet)
    if (empError && empError.code !== 'PGRST116') {
      return c.json({ error: empError.message }, 400)
    }

    if (!employee) {
      return c.json({ balances: [] })
    }

    const { data: balances, error } = await supabase
      .from('leave_balance_summary')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employee.id)
      .order('leave_type_name')

    if (error) return c.json({ error: error.message }, 400)

    return c.json({ balances: balances ?? [] })
  })

  app.get('/api/leave/balances/:employeeId', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const employeeId = c.req.param('employeeId')

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
      await ensurePermission(supabase, tenantId, 'leave.manage_balances')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const { data: balances, error } = await supabase
      .from('leave_balance_summary')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .order('leave_type_name')

    if (error) return c.json({ error: error.message }, 400)

    return c.json({ balances })
  })

  app.post('/api/leave/balances/:employeeId/adjust', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const employeeId = c.req.param('employeeId')

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
      await ensurePermission(supabase, tenantId, 'leave.manage_balances')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = LeaveBalanceAdjustmentInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    // Validate employee exists
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('id', employeeId)
      .eq('tenant_id', tenantId)
      .single()

    if (empError || !employee) {
      return c.json({ error: 'Employee not found' }, 404)
    }

    // Validate leave type exists
    const { data: leaveType, error: typeError } = await supabase
      .from('leave_types')
      .select('id')
      .eq('id', parsed.data.leave_type_id)
      .eq('tenant_id', tenantId)
      .single()

    if (typeError || !leaveType) {
      return c.json({ error: 'Leave type not found' }, 400)
    }

    // Validate adjustment is not zero
    if (parsed.data.adjustment_days === 0) {
      return c.json({ error: 'Adjustment days cannot be zero' }, 400)
    }

    // Get current balance or create new one
    const currentYear = new Date().getFullYear()
    const periodStart = `${currentYear}-01-01`
    const periodEnd = `${currentYear}-12-31`

    const { data: existingBalance, error: balanceError } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('leave_type_id', parsed.data.leave_type_id)
      .eq('period_start', periodStart)
      .single()

    let balanceId: string
    let newBalance: number

    if (existingBalance) {
      // Update existing balance
      newBalance = existingBalance.balance_days + parsed.data.adjustment_days
      const { data: updatedBalance, error: updateError } = await supabase
        .from('leave_balances')
        .update({
          balance_days: newBalance,
          notes: parsed.data.notes || existingBalance.notes || null,
        })
        .eq('id', existingBalance.id)
        .select()
        .single()

      if (updateError) return c.json({ error: updateError.message }, 400)
      balanceId = updatedBalance.id
    } else {
      // Create new balance
      newBalance = parsed.data.adjustment_days
      const { data: newBalanceRecord, error: createError } = await supabase
        .from('leave_balances')
        .insert({
          tenant_id: tenantId,
          employee_id: employeeId,
          leave_type_id: parsed.data.leave_type_id,
          balance_days: newBalance,
          used_ytd: 0,
          period_start: periodStart,
          period_end: periodEnd,
          notes: parsed.data.notes || null,
        })
        .select()
        .single()

      if (createError) return c.json({ error: createError.message }, 400)
      balanceId = newBalanceRecord.id
    }

    return c.json({ 
      success: true, 
      balanceId, 
      newBalance,
      adjustment: parsed.data.adjustment_days 
    })
  })

  app.get('/api/leave/balances/team', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
      await ensurePermission(supabase, tenantId, 'leave.view_team_calendar')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    // Get current user's employee record to find their team
    const { data: currentEmployee, error: empError } = await supabase
      .from('employees')
      .select('id, manager_id')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .single()

    if (empError || !currentEmployee) {
      return c.json({ error: 'Employee not found' }, 404)
    }

    // Get team members (direct reports)
    const { data: teamMembers, error: teamError } = await supabase
      .from('employees')
      .select('id')
      .eq('manager_id', currentEmployee.id)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    if (teamError) return c.json({ error: teamError.message }, 400)

    const teamMemberIds = teamMembers.map((m: { id: string }) => m.id)

    const { data: balances, error } = await supabase
      .from('leave_balance_summary')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('employee_id', teamMemberIds)
      .order('employee_name, leave_type_name')

    if (error) return c.json({ error: error.message }, 400)

    return c.json({ balances })
  })

  // Holiday Calendars
  app.get('/api/leave/holidays', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const year = c.req.query('year')
    const startDate = year ? `${year}-01-01` : `${new Date().getFullYear()}-01-01`
    const endDate = year ? `${year}-12-31` : `${new Date().getFullYear()}-12-31`

    const { data: holidays, error } = await supabase
      .from('holiday_calendars')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')

    if (error) return c.json({ error: error.message }, 400)

    return c.json({ holidays })
  })

  app.post('/api/leave/holidays', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
      await ensurePermission(supabase, tenantId, 'leave.manage_holidays')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = HolidayCalendarCreateInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const { data: holiday, error } = await supabase
      .from('holiday_calendars')
      .insert({
        tenant_id: tenantId,
        ...parsed.data,
      })
      .select()
      .single()

    if (error) return c.json({ error: error.message }, 400)

    return c.json(holiday)
  })

  app.post('/api/leave/holidays/bulk', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
      await ensurePermission(supabase, tenantId, 'leave.manage_holidays')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = HolidayCalendarBulkImportSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const holidaysToInsert = parsed.data.holidays.map(holiday => ({
      tenant_id: tenantId,
      ...holiday,
    }))

    const { data: holidays, error } = await supabase
      .from('holiday_calendars')
      .insert(holidaysToInsert)
      .select()

    if (error) return c.json({ error: error.message }, 400)

    return c.json({ holidays, count: holidays.length })
  })

  app.delete('/api/leave/holidays/:id', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const id = c.req.param('id')

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
      await ensurePermission(supabase, tenantId, 'leave.manage_holidays')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const { error } = await supabase
      .from('holiday_calendars')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) return c.json({ error: error.message }, 400)

    return c.json({ success: true })
  })

  // Blackout Periods
  app.get('/api/leave/blackout-periods', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const query = c.req.query()
    const parsed = BlackoutPeriodListQuerySchema.safeParse({
      start_date: query.start_date,
      end_date: query.end_date,
      leave_type_id: query.leave_type_id,
      department_id: query.department_id,
      page: query.page ? parseInt(query.page) : 1,
      page_size: query.page_size ? parseInt(query.page_size) : 20,
    })

    if (!parsed.success) {
      return c.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, 400)
    }

    const { page, page_size, ...filters } = parsed.data
    const offset = (page - 1) * page_size

    let query_builder = supabase
      .from('blackout_periods')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)

    // Apply filters
    if (filters.start_date) {
      query_builder = query_builder.gte('end_date', filters.start_date)
    }
    if (filters.end_date) {
      query_builder = query_builder.lte('start_date', filters.end_date)
    }
    if (filters.leave_type_id) {
      query_builder = query_builder.eq('leave_type_id', filters.leave_type_id)
    }
    if (filters.department_id) {
      query_builder = query_builder.eq('department_id', filters.department_id)
    }

    const { data: periods, error, count } = await query_builder
      .order('start_date', { ascending: true })
      .range(offset, offset + page_size - 1)

    if (error) return c.json({ error: error.message }, 400)

    const total = count || 0
    const total_pages = Math.ceil(total / page_size)

    return c.json({
      periods: periods || [],
      pagination: {
        page,
        page_size,
        total,
        total_pages,
      },
    })
  })

  app.post('/api/leave/blackout-periods', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
      await ensurePermission(supabase, tenantId, 'leave.manage_holidays')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = BlackoutPeriodCreateInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    // Validate date range
    if (new Date(parsed.data.end_date) < new Date(parsed.data.start_date)) {
      return c.json({ error: 'End date must be after start date' }, 400)
    }

    const { data: period, error } = await supabase
      .from('blackout_periods')
      .insert({
        tenant_id: tenantId,
        ...parsed.data,
      })
      .select()
      .single()

    if (error) return c.json({ error: error.message }, 400)

    return c.json(period)
  })

  app.put('/api/leave/blackout-periods/:id', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const id = c.req.param('id')

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
      await ensurePermission(supabase, tenantId, 'leave.manage_holidays')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = BlackoutPeriodUpdateInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    // Validate date range if both dates are provided
    if (parsed.data.start_date && parsed.data.end_date) {
      if (new Date(parsed.data.end_date) < new Date(parsed.data.start_date)) {
        return c.json({ error: 'End date must be after start date' }, 400)
      }
    }

    const { data: period, error } = await supabase
      .from('blackout_periods')
      .update(parsed.data)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) return c.json({ error: error.message }, 400)

    if (!period) {
      return c.json({ error: 'Blackout period not found' }, 404)
    }

    return c.json(period)
  })

  app.delete('/api/leave/blackout-periods/:id', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const id = c.req.param('id')

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
      await ensurePermission(supabase, tenantId, 'leave.manage_holidays')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const { error } = await supabase
      .from('blackout_periods')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) return c.json({ error: error.message }, 400)

    return c.json({ success: true })
  })

  // Enhanced Leave Requests
  app.get('/api/leave/requests', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const query = c.req.query()
    const parsed = LeaveRequestListQuerySchema.safeParse({
      employee_id: query.employee_id,
      leave_type_id: query.leave_type_id,
      status: query.status,
      start_date: query.start_date,
      end_date: query.end_date,
      year: query.year ? parseInt(query.year) : undefined,
      page: query.page ? parseInt(query.page) : 1,
      page_size: query.page_size ? parseInt(query.page_size) : 20,
    })

    if (!parsed.success) {
      return c.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, 400)
    }

    const { page, page_size, ...filters } = parsed.data
    const offset = (page - 1) * page_size

    let query_builder = supabase
      .from('leave_request_summary')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)

    // Apply filters
    if (filters.employee_id) {
      query_builder = query_builder.eq('user_id', filters.employee_id)
    }
    if (filters.leave_type_id) {
      query_builder = query_builder.eq('leave_type_id', filters.leave_type_id)
    }
    if (filters.status) {
      query_builder = query_builder.eq('status', filters.status)
    }
    if (filters.start_date) {
      query_builder = query_builder.gte('start_date', filters.start_date)
    }
    if (filters.end_date) {
      query_builder = query_builder.lte('end_date', filters.end_date)
    }
    if (filters.year) {
      query_builder = query_builder
        .gte('start_date', `${filters.year}-01-01`)
        .lte('start_date', `${filters.year}-12-31`)
    }

    const { data: requests, error, count } = await query_builder
      .order('created_at', { ascending: false })
      .range(offset, offset + page_size - 1)

    if (error) return c.json({ error: error.message }, 400)

    const total = count || 0
    const total_pages = Math.ceil(total / page_size)

    return c.json({
      requests: requests || [],
      pagination: {
        page,
        page_size,
        total,
        total_pages,
      },
    })
  })

  app.post('/api/leave/requests', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = CreateLeaveRequestInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    // Get employee ID and department for current user
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, department_id')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .single()

    if (empError || !employee) {
      return c.json({ error: 'Employee not found' }, 404)
    }

    // Calculate working days using the database function
    const { data: workingDays, error: calcError } = await supabase
      .rpc('calculate_working_days', {
        p_start_date: parsed.data.start_date,
        p_end_date: parsed.data.end_date,
        p_tenant_id: tenantId,
      })

    if (calcError) return c.json({ error: 'Failed to calculate working days' }, 400)

    // Check for overlapping requests (same employee, overlapping dates, not cancelled/denied)
    // Overlap condition: start_date <= new_end_date AND end_date >= new_start_date
    const { data: overlappingRequests, error: overlapError } = await supabase
      .from('time_off_requests')
      .select('id, start_date, end_date, status, leave_type_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved'])
      .lte('start_date', parsed.data.end_date)
      .gte('end_date', parsed.data.start_date)

    if (overlapError) {
      return c.json({ error: 'Failed to check for overlapping requests', details: overlapError.message }, 400)
    }

    if (overlappingRequests && overlappingRequests.length > 0) {
      const overlapDetails = overlappingRequests.map((req: { id: string; start_date: string; end_date: string; status: string; leave_type_id: string | null }) => 
        `${format(new Date(req.start_date), 'MMM d')} - ${format(new Date(req.end_date), 'MMM d')}`
      ).join(', ')
      return c.json({ 
        error: `You already have a leave request for overlapping dates: ${overlapDetails}. Please cancel or modify the existing request first.`,
        error_code: 'OVERLAPPING_REQUEST',
        overlapping_requests: overlappingRequests,
      }, 400)
    }

    // Validate compliance (balance, blackout periods, minimum entitlement)
    const { data: complianceResult, error: complianceError } = await supabase
      .rpc('validate_leave_request_compliance', {
        p_tenant_id: tenantId,
        p_employee_id: employee.id,
        p_leave_type_id: parsed.data.leave_type_id,
        p_start_date: parsed.data.start_date,
        p_end_date: parsed.data.end_date,
        p_days_requested: workingDays,
        p_department_id: employee.department_id || undefined,
      })

    if (complianceError) {
      return c.json({ error: 'Failed to validate leave request compliance', details: complianceError.message }, 400)
    }

    // Check if validation passed
    const validation = LeaveComplianceValidationResultSchema.safeParse(complianceResult)
    if (!validation.success) {
      return c.json({ error: 'Invalid compliance validation response' }, 500)
    }

    if (!validation.data.valid) {
      // Return user-friendly error message
      const errorMessage = validation.data.message || 'Leave request validation failed'
      return c.json({ 
        error: errorMessage,
        error_code: validation.data.error_code,
        details: validation.data.blackout_period || undefined,
      }, 400)
    }

    // Create the leave request
    const { data: request, error } = await supabase
      .from('time_off_requests')
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        leave_type: 'other', // Will be updated by trigger
        leave_type_id: parsed.data.leave_type_id,
        days_count: workingDays,
        half_day_start: parsed.data.half_day_start,
        half_day_end: parsed.data.half_day_end,
        note: parsed.data.note,
        attachment_path: parsed.data.attachment,
      })
      .select('*')
      .single()

    if (error) return c.json({ error: error.message }, 400)

    return c.json(request)
  })

  app.put('/api/leave/requests/:id', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const id = c.req.param('id')

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = LeaveRequestUpdateInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    // Check if request exists and belongs to user
    const { data: existingRequest, error: fetchError } = await supabase
      .from('time_off_requests')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingRequest) {
      return c.json({ error: 'Request not found' }, 404)
    }

    if (existingRequest.status !== 'pending') {
      return c.json({ error: 'Only pending requests can be modified' }, 400)
    }

    // Recalculate working days if dates changed
    let daysCount = existingRequest.days_count
    if (parsed.data.start_date || parsed.data.end_date) {
      const startDate = parsed.data.start_date || existingRequest.start_date
      const endDate = parsed.data.end_date || existingRequest.end_date

      const { data: workingDays, error: calcError } = await supabase
        .rpc('calculate_working_days', {
          p_start_date: startDate,
          p_end_date: endDate,
          p_tenant_id: tenantId,
        })

      if (calcError) return c.json({ error: 'Failed to calculate working days' }, 400)
      daysCount = workingDays
    }

    const { data: request, error } = await supabase
      .from('time_off_requests')
      .update({
        ...parsed.data,
        days_count: daysCount,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) return c.json({ error: error.message }, 400)

    return c.json(request)
  })

  app.delete('/api/leave/requests/:id', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const id = c.req.param('id')

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    // Check if request exists and belongs to user
    const { data: existingRequest, error: fetchError } = await supabase
      .from('time_off_requests')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingRequest) {
      return c.json({ error: 'Request not found' }, 404)
    }

    // Allow cancelling pending or approved requests, but not already cancelled or denied
    if (existingRequest.status === 'cancelled') {
      return c.json({ error: 'Request is already cancelled' }, 400)
    }

    if (existingRequest.status === 'denied') {
      return c.json({ error: 'Cannot cancel a denied request' }, 400)
    }

    const wasApproved = existingRequest.status === 'approved'
    const daysCount = existingRequest.days_count || 0
    const leaveTypeId = existingRequest.leave_type_id

    // Update request status
    const { error } = await supabase
      .from('time_off_requests')
      .update({
        status: 'cancelled',
        cancelled_by: user.id,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) return c.json({ error: error.message }, 400)

    // If cancelling an approved request, reverse the balance
    if (wasApproved && leaveTypeId && daysCount > 0) {
      // Get employee_id from user_id
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', existingRequest.user_id)
        .eq('tenant_id', tenantId)
        .single()

      if (!empError && employee) {
        // Find the active leave balance record
        const currentDate = new Date().toISOString().split('T')[0]
        const { data: balance, error: balanceError } = await supabase
          .from('leave_balances')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('employee_id', employee.id)
          .eq('leave_type_id', leaveTypeId)
          .lte('period_start', currentDate)
          .gte('period_end', currentDate)
          .order('period_start', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!balanceError && balance) {
          // Reverse the balance: decrement used_ytd
          const newUsedYtd = Math.max(0, balance.used_ytd - daysCount)
          
          const { error: updateBalanceError } = await supabase
            .from('leave_balances')
            .update({
              used_ytd: newUsedYtd,
            })
            .eq('id', balance.id)

          if (updateBalanceError) {
            // Log error but don't fail the cancellation
            console.error('Failed to reverse leave balance on cancellation:', updateBalanceError)
          }
        }
      }
    }

    return c.json({ success: true })
  })

  app.put('/api/leave/requests/:id/approve', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const id = c.req.param('id')

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
      await ensurePermission(supabase, tenantId, 'leave.approve_requests')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = LeaveRequestApprovalInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    // Get the request first to check old status and get details
    const { data: oldRequest, error: fetchError } = await supabase
      .from('time_off_requests')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (fetchError || !oldRequest) {
      return c.json({ error: 'Leave request not found' }, 404)
    }

    const oldStatus = oldRequest.status
    const newStatus = parsed.data.decision === 'approve' ? 'approved' : 'denied'
    const daysCount = oldRequest.days_count || 0
    const leaveTypeId = oldRequest.leave_type_id

    // Validate request can be processed
    if (oldStatus === 'cancelled') {
      return c.json({ error: 'Cannot approve or deny a cancelled request' }, 400)
    }

    // If already in the target state, return early (idempotent operation)
    if (oldStatus === newStatus) {
      return c.json({ 
        ...oldRequest, 
        message: `Request is already ${newStatus}` 
      })
    }

    // Require reason for denial
    if (parsed.data.decision === 'deny' && !parsed.data.reason?.trim()) {
      return c.json({ error: 'Denial reason is required' }, 400)
    }

    // Update the request status
    const { data: request, error } = await supabase
      .from('time_off_requests')
      .update({
        status: newStatus,
        approver_user_id: user.id,
        decided_at: new Date().toISOString(),
        denial_reason: parsed.data.decision === 'deny' ? parsed.data.reason : null,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single()

    if (error) return c.json({ error: error.message }, 400)

    // Update leave balance if needed
    if (leaveTypeId && daysCount > 0) {
      // Get employee_id from user_id
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', oldRequest.user_id)
        .eq('tenant_id', tenantId)
        .single()

      if (!empError && employee) {
        // Find the active leave balance record
        const currentDate = new Date().toISOString().split('T')[0]
        const { data: balance, error: balanceError } = await supabase
          .from('leave_balances')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('employee_id', employee.id)
          .eq('leave_type_id', leaveTypeId)
          .lte('period_start', currentDate)
          .gte('period_end', currentDate)
          .order('period_start', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!balanceError && balance) {
          // balance_days represents the total allocated balance (should remain constant)
          // used_ytd represents the total used year-to-date (increments with approvals)
          // remaining_balance (in view) = balance_days - used_ytd
          let newUsedYtd = balance.used_ytd

          // Handle status changes
          if (oldStatus === 'approved' && newStatus === 'denied') {
            // Reversing an approved request: decrement used_ytd
            newUsedYtd = Math.max(0, balance.used_ytd - daysCount)
          } else if (oldStatus !== 'approved' && newStatus === 'approved') {
            // Approving a new request: increment used_ytd
            newUsedYtd = balance.used_ytd + daysCount
          }
          // If denying a pending request or cancelling, no balance change needed

          // Update only used_ytd (balance_days should remain constant as total allocated)
          const { error: updateBalanceError } = await supabase
            .from('leave_balances')
            .update({
              used_ytd: newUsedYtd,
            })
            .eq('id', balance.id)

          if (updateBalanceError) {
            // Log error but don't fail the request update
            console.error('Failed to update leave balance:', updateBalanceError)
          }
        }
      }
    }

    return c.json(request)
  })

  app.get('/api/leave/requests/:id/audit', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const id = c.req.param('id')

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const { data: audit, error } = await supabase
      .from('leave_request_audit')
      .select('*')
      .eq('request_id', id)
      .order('created_at', { ascending: false })

    if (error) return c.json({ error: error.message }, 400)

    return c.json({ audit })
  })

  // Team Calendar
  app.get('/api/leave/team-calendar', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
      await ensurePermission(supabase, tenantId, 'leave.view_team_calendar')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    const query = c.req.query()
    const parsed = TeamLeaveCalendarQuerySchema.safeParse({
      start_date: query.start_date,
      end_date: query.end_date,
      employee_ids: query.employee_ids ? query.employee_ids.split(',') : undefined,
      department_id: query.department_id,
      leave_type_ids: query.leave_type_ids ? query.leave_type_ids.split(',') : undefined,
      status: query.status ? query.status.split(',') : undefined,
      include_holidays: query.include_holidays !== 'false',
    })

    if (!parsed.success) {
      return c.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, 400)
    }

    // Get team leave requests
    let eventsQuery = supabase
      .from('team_leave_calendar')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('start_date', parsed.data.start_date)
      .lte('end_date', parsed.data.end_date)

    if (parsed.data.employee_ids) {
      eventsQuery = eventsQuery.in('user_id', parsed.data.employee_ids)
    }
    if (parsed.data.leave_type_ids) {
      eventsQuery = eventsQuery.in('leave_type_id', parsed.data.leave_type_ids)
    }
    if (parsed.data.status) {
      eventsQuery = eventsQuery.in('status', parsed.data.status)
    }

    const { data: requests, error: requestsError } = await eventsQuery

    if (requestsError) return c.json({ error: requestsError.message }, 400)

    // Get holidays if requested
    let holidays: any[] = []
    if (parsed.data.include_holidays) {
      const { data: holidayData, error: holidayError } = await supabase
        .from('holiday_calendars')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('date', parsed.data.start_date)
        .lte('date', parsed.data.end_date)

      if (holidayError) return c.json({ error: holidayError.message }, 400)
      holidays = holidayData || []
    }

    // Transform requests to calendar events
    const events = (requests || []).map((req: any) => ({
      id: `request-${req.id}`,
      title: `${req.employee_name} - ${req.leave_type_name}`,
      start: req.start_date,
      end: req.end_date,
      type: 'leave_request' as const,
      employee_id: req.user_id,
      employee_name: req.employee_name,
      leave_type: req.leave_type_name,
      leave_type_color: req.leave_type_color,
      status: req.status,
      is_half_day: req.half_day_start || req.half_day_end,
      notes: req.note,
    }))

    // Transform holidays to calendar events
    const holidayEvents = holidays.map(holiday => ({
      id: `holiday-${holiday.id}`,
      title: holiday.name,
      start: holiday.date,
      end: holiday.date,
      type: 'holiday' as const,
      is_half_day: holiday.is_half_day,
    }))

    const allEvents = [...events, ...holidayEvents]

    const summary = {
      total_requests: events.length,
      pending_requests: events.filter((e: any) => e.status === 'pending').length,
      approved_requests: events.filter((e: any) => e.status === 'approved').length,
      total_holidays: holidayEvents.length,
    }

    return c.json({
      events: allEvents,
      holidays,
      summary,
    })
  })

  function slugKey(input: string): string {
    return input
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

}
