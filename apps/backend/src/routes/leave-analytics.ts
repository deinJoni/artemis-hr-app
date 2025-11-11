import type { Hono } from 'hono'
import type { SupabaseClient, User } from '@supabase/supabase-js'

import type { Database } from '@database.types.ts'
import { getPrimaryTenantId } from '../lib/tenant-context'
import { ensurePermission } from '../lib/permissions'
import type { Env } from '../types'

export const registerLeaveAnalyticsRoutes = (app: Hono<Env>) => {
  // Leave Utilization Analytics
  app.get('/api/leave/analytics/utilization', async (c) => {
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
    const employeeId = query.employee_id
    const departmentId = query.department_id
    const startDate = query.start_date
    const endDate = query.end_date
    const groupBy = query.group_by || 'employee'

    let queryBuilder = supabase
      .from('leave_utilization_summary')
      .select('*')
      .eq('tenant_id', tenantId)

    if (employeeId) {
      queryBuilder = queryBuilder.eq('employee_id', employeeId)
    }
    if (departmentId) {
      queryBuilder = queryBuilder.eq('department_id', departmentId)
    }
    if (startDate) {
      queryBuilder = queryBuilder.gte('period_month', startDate)
    }
    if (endDate) {
      queryBuilder = queryBuilder.lte('period_month', endDate)
    }

    const { data: utilization, error } = await queryBuilder.order('period_month', { ascending: false })

    if (error) {
      console.error('[Leave Analytics] Utilization query error:', error);
      return c.json({ error: error.message }, 400);
    }

    // Aggregate based on group_by parameter
    let result: any[] = []
    if (groupBy === 'department') {
      const grouped = new Map<string, any>()
      utilization?.forEach((item: any) => {
        const key = item.department_id || 'no-department'
        if (!grouped.has(key)) {
          grouped.set(key, {
            department_id: item.department_id,
            department_name: item.department_name || 'No Department',
            total_days: 0,
            total_requests: 0,
            employee_count: new Set(),
            leave_types: new Map(),
          })
        }
        const group = grouped.get(key)
        group.total_days += parseFloat(item.days_taken) || 0
        group.total_requests += parseInt(item.request_count) || 0
        group.employee_count.add(item.employee_id)
        const ltKey = item.leave_type_id
        if (!group.leave_types.has(ltKey)) {
          group.leave_types.set(ltKey, {
            leave_type_id: item.leave_type_id,
            leave_type_name: item.leave_type_name,
            days: 0,
            requests: 0,
          })
        }
        const lt = group.leave_types.get(ltKey)
        lt.days += parseFloat(item.days_taken) || 0
        lt.requests += parseInt(item.request_count) || 0
      })
      result = Array.from(grouped.values()).map((g) => ({
        ...g,
        employee_count: g.employee_count.size,
        leave_types: Array.from(g.leave_types.values()),
      }))
    } else if (groupBy === 'leave_type') {
      const grouped = new Map<string, any>()
      utilization?.forEach((item: any) => {
        const key = item.leave_type_id
        if (!grouped.has(key)) {
          grouped.set(key, {
            leave_type_id: item.leave_type_id,
            leave_type_name: item.leave_type_name,
            leave_type_code: item.leave_type_code,
            total_days: 0,
            total_requests: 0,
            employee_count: new Set(),
          })
        }
        const group = grouped.get(key)
        group.total_days += parseFloat(item.days_taken) || 0
        group.total_requests += parseInt(item.request_count) || 0
        group.employee_count.add(item.employee_id)
      })
      result = Array.from(grouped.values()).map((g) => ({
        ...g,
        employee_count: g.employee_count.size,
      }))
    } else {
      // Default: by employee
      result = utilization || []
    }

    return c.json({ utilization: result, group_by: groupBy })
  })

  // Leave Trends
  app.get('/api/leave/analytics/trends', async (c) => {
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
    const startDate = query.start_date || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
    const endDate = query.end_date || new Date().toISOString().split('T')[0]
    const granularity = query.granularity || 'month'

    let queryBuilder = supabase
      .from('leave_trends_monthly')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('month', startDate)
      .lte('month', endDate)

    const { data: trends, error } = await queryBuilder.order('month', { ascending: true })

    if (error) {
      console.error('[Leave Analytics] Trends query error:', error);
      return c.json({ error: error.message }, 400);
    }

    // Aggregate by granularity if needed
    let result = trends || []
    if (granularity === 'quarter') {
      const grouped = new Map<string, any>()
      trends?.forEach((item: any) => {
        const date = new Date(item.month)
        const quarter = `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`
        const key = `${quarter}-${item.leave_type_id}`
        if (!grouped.has(key)) {
          grouped.set(key, {
            period: quarter,
            leave_type_id: item.leave_type_id,
            leave_type_name: item.leave_type_name,
            total_days: 0,
            total_requests: 0,
            employee_count: new Set(),
          })
        }
        const group = grouped.get(key)
        group.total_days += parseFloat(item.total_days) || 0
        group.total_requests += parseInt(item.request_count) || 0
        item.employee_count?.forEach((emp: string) => group.employee_count.add(emp))
      })
      result = Array.from(grouped.values()).map((g) => ({
        ...g,
        employee_count: g.employee_count.size,
      }))
    } else if (granularity === 'year') {
      const grouped = new Map<string, any>()
      trends?.forEach((item: any) => {
        const date = new Date(item.month)
        const year = date.getFullYear().toString()
        const key = `${year}-${item.leave_type_id}`
        if (!grouped.has(key)) {
          grouped.set(key, {
            period: year,
            leave_type_id: item.leave_type_id,
            leave_type_name: item.leave_type_name,
            total_days: 0,
            total_requests: 0,
            employee_count: new Set(),
          })
        }
        const group = grouped.get(key)
        group.total_days += parseFloat(item.total_days) || 0
        group.total_requests += parseInt(item.request_count) || 0
        item.employee_count?.forEach((emp: string) => group.employee_count.add(emp))
      })
      result = Array.from(grouped.values()).map((g) => ({
        ...g,
        employee_count: g.employee_count.size,
      }))
    }

    return c.json({ trends: result, granularity })
  })

  // Leave Summary
  app.get('/api/leave/analytics/summary', async (c) => {
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
    const startDate = query.start_date || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
    const endDate = query.end_date || new Date().toISOString().split('T')[0]

    // Get total days taken
    const { data: totalDaysData, error: totalDaysError } = await supabase
      .from('time_off_requests')
      .select('days_count')
      .eq('tenant_id', tenantId)
      .eq('status', 'approved')
      .gte('start_date', startDate)
      .lte('start_date', endDate)

    if (totalDaysError) {
      console.error('[Leave Analytics] Total days query error:', totalDaysError);
      return c.json({ error: totalDaysError.message }, 400);
    }

    const totalDaysTaken = totalDaysData?.reduce((sum, r) => sum + (typeof r.days_count === 'string' ? parseFloat(r.days_count) : (r.days_count || 0)), 0) || 0

    // Get pending requests count
    const { count: pendingCount, error: pendingError } = await supabase
      .from('time_off_requests')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')

    if (pendingError) {
      console.error('[Leave Analytics] Pending requests query error:', pendingError);
      return c.json({ error: pendingError.message }, 400);
    }

    // Get employee count
    const { count: employeeCount, error: employeeError } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true)

    if (employeeError) {
      console.error('[Leave Analytics] Employee count query error:', employeeError);
      return c.json({ error: employeeError.message }, 400);
    }

    const avgDaysPerEmployee = employeeCount && employeeCount > 0 ? totalDaysTaken / employeeCount : 0

    // Get leave type breakdown
    const { data: typeBreakdown, error: typeError } = await supabase
      .from('leave_trends_monthly')
      .select('leave_type_id, leave_type_name, total_days')
      .eq('tenant_id', tenantId)
      .gte('month', startDate)
      .lte('month', endDate)

    if (typeError) {
      console.error('[Leave Analytics] Leave type breakdown query error:', typeError);
      return c.json({ error: typeError.message }, 400);
    }

    const breakdown = new Map<string, any>()
    typeBreakdown?.forEach((item: any) => {
      const key = item.leave_type_id
      if (!breakdown.has(key)) {
        breakdown.set(key, {
          leave_type_id: item.leave_type_id,
          leave_type_name: item.leave_type_name,
          total_days: 0,
        })
      }
      const group = breakdown.get(key)
      group.total_days += parseFloat(item.total_days) || 0
    })

    return c.json({
      summary: {
        total_days_taken: totalDaysTaken,
        average_per_employee: Math.round(avgDaysPerEmployee * 100) / 100,
        pending_requests: pendingCount || 0,
        total_employees: employeeCount || 0,
        leave_type_breakdown: Array.from(breakdown.values()),
      },
      period: {
        start_date: startDate,
        end_date: endDate,
      },
    })
  })

  // Export Leave Analytics
  app.get('/api/leave/analytics/export', async (c) => {
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
    const format = query.format || 'csv'
    const startDate = query.start_date || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
    const endDate = query.end_date || new Date().toISOString().split('T')[0]
    const reportType = query.report_type || 'utilization'

    if (format === 'csv') {
      let csvData = ''
      let headers: string[] = []
      let rows: any[] = []

      if (reportType === 'utilization') {
        const { data: utilization, error } = await supabase
          .from('leave_utilization_summary')
          .select('*')
          .eq('tenant_id', tenantId)
          .gte('period_month', startDate)
          .lte('period_month', endDate)

        if (error) return c.json({ error: error.message }, 400)

        headers = ['Employee', 'Email', 'Department', 'Leave Type', 'Month', 'Days Taken', 'Requests', 'Utilization Rate']
        rows = (utilization || []).map((item: any) => [
          item.employee_name || '',
          item.employee_email || '',
          item.department_name || 'No Department',
          item.leave_type_name || '',
          item.period_month || '',
          item.days_taken || 0,
          item.request_count || 0,
          `${item.utilization_rate || 0}%`,
        ])
      } else if (reportType === 'trends') {
        const { data: trends, error } = await supabase
          .from('leave_trends_monthly')
          .select('*')
          .eq('tenant_id', tenantId)
          .gte('month', startDate)
          .lte('month', endDate)

        if (error) return c.json({ error: error.message }, 400)

        headers = ['Month', 'Leave Type', 'Total Days', 'Requests', 'Employees', 'Avg Days per Request']
        rows = (trends || []).map((item: any) => [
          item.month || '',
          item.leave_type_name || '',
          item.total_days || 0,
          item.request_count || 0,
          item.employee_count || 0,
          Math.round((parseFloat(item.avg_days_per_request) || 0) * 100) / 100,
        ])
      }

      csvData = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')

      c.header('Content-Type', 'text/csv')
      c.header('Content-Disposition', `attachment; filename="leave-analytics-${reportType}-${startDate}-${endDate}.csv"`)
      return c.text(csvData)
    }

    // PDF export would require a PDF library - for now return JSON
    return c.json({ error: 'PDF export not yet implemented. Use CSV format.' }, 400)
  })
}

