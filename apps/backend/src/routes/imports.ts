import type { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { User } from '../types'

import {
  CSVExportRequestSchema,
  CSVImportConfirmSchema,
  CSVImportPreviewSchema,
  CSVImportResultSchema,
} from '@vibe/shared'

import type { Database } from '@database.types.ts'
import { AuditLogger, extractRequestInfo } from '../lib/audit-logger'
import { supabaseAdmin } from '../lib/supabase'
import type { Env } from '../types'

export const registerImportRoutes = (app: Hono<Env>) => {
  // CSV Import Preview
  app.post('/api/employees/:tenantId/import/preview', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')

    const canImport = await supabase.rpc('app_has_permission', { permission: 'employees.import', tenant: tenantId })
    if (canImport.error) return c.json({ error: canImport.error.message }, 400)
    if (!canImport.data) return c.json({ error: 'Forbidden' }, 403)

    try {
      const formData = await c.req.formData()
      const file = formData.get('file') as File
      if (!file) return c.json({ error: 'No file provided' }, 400)

      const csvText = await file.text()
      const lines = csvText.split('\n').filter(line => line.trim())
      if (lines.length < 2) return c.json({ error: 'CSV must have at least a header and one data row' }, 400)

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      const dataRows = lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
        const row: Record<string, string> = {}
        headers.forEach((header, i) => {
          row[header] = values[i] || ''
        })
        return { row: index + 2, data: row }
      })

      // Basic field mapping (can be enhanced)
      const fieldMapping: Record<string, string> = {
        'name': 'name',
        'email': 'email',
        'employee_number': 'employee_number',
        'job_title': 'job_title',
        'department': 'department_name',
        'manager_email': 'manager_email',
        'phone': 'phone_work',
        'start_date': 'start_date',
        'employment_type': 'employment_type',
        'work_location': 'work_location',
        'status': 'status'
      }

      const validRows: Record<string, any>[] = []
      const invalidRows: Array<{ row: number; data: Record<string, any>; errors: string[] }> = []

      for (const { row, data } of dataRows) {
        const errors: string[] = []
        
        // Validate required fields
        if (!data.name?.trim()) errors.push('Name is required')
        if (!data.email?.trim()) errors.push('Email is required')
        if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
          errors.push('Invalid email format')
        }

        if (errors.length > 0) {
          invalidRows.push({ row, data, errors })
        } else {
          validRows.push(data)
        }
      }

      const response = CSVImportPreviewSchema.parse({
        validRows,
        invalidRows,
        fieldMapping,
        totalRows: dataRows.length
      })

      return c.json(response)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to process CSV file'
      return c.json({ error: message }, 400)
    }
  })

  // CSV Import Confirm
  app.post('/api/employees/:tenantId/import/confirm', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')

    const canImport = await supabase.rpc('app_has_permission', { permission: 'employees.import', tenant: tenantId })
    if (canImport.error) return c.json({ error: canImport.error.message }, 400)
    if (!canImport.data) return c.json({ error: 'Forbidden' }, 403)

    try {
      const body = await c.req.json()
      const parsed = CSVImportConfirmSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)

      const { validRows, fieldMapping } = parsed.data
      const user = c.get('user') as User
      const { ipAddress, userAgent } = extractRequestInfo(c.req)
      const auditLogger = new AuditLogger(supabase)

      let created = 0
      let updated = 0
      const errors: string[] = []
      const warnings: string[] = []

      for (const rowData of validRows) {
        try {
          // Map CSV data to employee fields
          const employeeData: any = {
            tenant_id: tenantId,
            name: rowData.name?.trim(),
            email: rowData.email?.trim(),
            employee_number: rowData.employee_number?.trim() || null,
            job_title: rowData.job_title?.trim() || null,
            phone_work: rowData.phone?.trim() || null,
            start_date: rowData.start_date?.trim() || null,
            employment_type: rowData.employment_type?.trim() || null,
            work_location: rowData.work_location?.trim() || null,
            status: rowData.status?.trim() || 'active'
          }

          // Handle department lookup
          if (rowData.department_name?.trim()) {
            const dept = await supabase
              .from('departments')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('name', rowData.department_name.trim())
              .maybeSingle()
            
            if (dept.data) {
              employeeData.department_id = dept.data.id
            } else {
              warnings.push(`Department "${rowData.department_name}" not found for employee ${rowData.name}`)
            }
          }

          // Handle manager lookup
          if (rowData.manager_email?.trim()) {
            const manager = await supabase
              .from('employees')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('email', rowData.manager_email.trim())
              .maybeSingle()
            
            if (manager.data) {
              employeeData.manager_id = manager.data.id
            } else {
              warnings.push(`Manager with email "${rowData.manager_email}" not found for employee ${rowData.name}`)
            }
          }

          // Check if employee already exists
          const existing = await supabase
            .from('employees')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('email', employeeData.email)
            .maybeSingle()

          if (existing.data) {
            // Update existing employee
            const updateResult = await supabase
              .from('employees')
              .update(employeeData)
              .eq('id', existing.data.id)
              .select()
              .single()

            if (updateResult.error) {
              errors.push(`Failed to update employee ${employeeData.name}: ${updateResult.error.message}`)
              continue
            }

            // Log the update
            await auditLogger.logEmployeeUpdate(
              tenantId,
              existing.data.id,
              user.id,
              employeeData,
              ipAddress,
              userAgent,
              'Bulk import update'
            )

            updated++
          } else {
            // Create new employee
            // First create user account
            const invite = await (supabaseAdmin.auth as any).admin.inviteUserByEmail(employeeData.email, {
              data: { display_name: employeeData.name },
            })
            if (invite.error) {
              errors.push(`Failed to create user account for ${employeeData.name}: ${invite.error.message}`)
              continue
            }
            const newUserId = invite.data.user?.id
            if (!newUserId) {
              errors.push(`User creation failed for ${employeeData.name}: missing user ID`)
              continue
            }

            // Add membership
            const memberIns = await supabaseAdmin
              .from('memberships')
              .insert({ user_id: newUserId, tenant_id: tenantId, role: 'employee' })
            if (memberIns.error) {
              errors.push(`Failed to add membership for ${employeeData.name}: ${memberIns.error.message}`)
              continue
            }

            // Create profile
            const profileIns = await supabaseAdmin
              .from('profiles')
              .insert({ user_id: newUserId, tenant_id: tenantId, display_name: employeeData.name })
            if (profileIns.error) {
              errors.push(`Failed to create profile for ${employeeData.name}: ${profileIns.error.message}`)
              continue
            }

            // Create employee record
            const createResult = await supabase
              .from('employees')
              .insert(employeeData)
              .select()
              .single()

            if (createResult.error) {
              errors.push(`Failed to create employee ${employeeData.name}: ${createResult.error.message}`)
              continue
            }

            // Log the creation
            await auditLogger.logEmployeeCreation(
              tenantId,
              createResult.data.id,
              user.id,
              employeeData,
              ipAddress,
              userAgent
            )

            created++
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Error processing employee ${rowData.name}: ${message}`)
        }
      }

      const response = CSVImportResultSchema.parse({
        success: errors.length === 0,
        created,
        updated,
        errors,
        warnings
      })

      return c.json(response)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to process import'
      return c.json({ error: message }, 400)
    }
  })

  // CSV Export
  app.get('/api/employees/:tenantId/export', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')

    console.log('[Export] Tenant ID:', tenantId)
    const user = c.get('user') as User
    
    // Check if user is owner first (owners have all permissions)
    const membership = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const isOwner = membership.data?.role === 'owner'
    
    if (!isOwner) {
      const canRead = await supabase.rpc('app_has_permission', { permission: 'employees.read', tenant: tenantId })
      if (canRead.error) {
        console.error('[Export] Permission check error:', canRead.error)
        return c.json({ error: canRead.error.message }, 400)
      }
      if (!canRead.data) {
        console.error('[Export] Permission denied')
        return c.json({ error: 'Forbidden' }, 403)
      }
    }
    
    console.log('[Export] Permission granted, fetching employees...')

    try {
      const url = new URL(c.req.url)
      const departmentId = url.searchParams.get('departmentId')
      const status = url.searchParams.get('status')
      const includeSensitive = url.searchParams.get('includeSensitive') === 'true'
      const format = url.searchParams.get('format') || 'csv'

      // Build query - select all employee fields
      let query = supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId)

      if (departmentId) query = query.eq('department_id', departmentId)
      if (status) query = query.eq('status', status)

      const { data: employees, error } = await query

      if (error) {
        console.error('[Export] Query error:', error)
        return c.json({ error: error.message }, 400)
      }
      
      console.log('[Export] Fetched', employees?.length || 0, 'employees')

      // Fetch department names and manager info separately if needed
      const departmentIds = [...new Set((employees || []).map((emp: Database['public']['Tables']['employees']['Row']) => emp.department_id).filter((id: string | null): id is string => Boolean(id)))]
      const managerIds = [...new Set((employees || []).map((emp: Database['public']['Tables']['employees']['Row']) => emp.manager_id).filter((id: string | null): id is string => Boolean(id)))]
      
      const departmentMap = new Map<string, string>()
      const managerMap = new Map<string, { name: string; email: string }>()
      
      if (departmentIds.length > 0) {
        const { data: departments, error: deptError } = await supabase
          .from('departments')
          .select('id, name')
          .in('id', departmentIds)
        if (deptError) {
          console.error('Error fetching departments:', deptError)
        } else if (departments) {
          departments.forEach((dept: { id: string; name: string }) => departmentMap.set(dept.id, dept.name))
        }
      }
      
      if (managerIds.length > 0) {
        const { data: managers, error: mgrError } = await supabase
          .from('employees')
          .select('id, name, email')
          .in('id', managerIds)
        if (mgrError) {
          console.error('Error fetching managers:', mgrError)
        } else if (managers) {
          managers.forEach((mgr: { id: string; name: string | null; email: string | null }) => managerMap.set(mgr.id, { name: mgr.name || '', email: mgr.email || '' }))
        }
      }

      // Generate CSV
      const headers = [
        'name',
        'email',
        'employee_number',
        'job_title',
        'department',
        'manager_name',
        'manager_email',
        'phone_work',
        'start_date',
        'employment_type',
        'work_location',
        'status',
        'created_at'
      ]

      if (includeSensitive) {
        headers.push('salary_amount', 'salary_currency', 'salary_frequency')
      }

      const csvRows = employees?.map((emp: Database['public']['Tables']['employees']['Row']) => {
        const manager = emp.manager_id ? managerMap.get(emp.manager_id) : null
        const departmentName = emp.department_id ? departmentMap.get(emp.department_id) : ''
        
        return [
          emp.name || '',
          emp.email || '',
          emp.employee_number || '',
          emp.job_title || '',
          departmentName || '',
          manager?.name || '',
          manager?.email || '',
          emp.phone_work || '',
          emp.start_date || '',
          emp.employment_type || '',
          emp.work_location || '',
          emp.status || '',
          emp.created_at || '',
          ...(includeSensitive ? [
            emp.salary_amount || '',
            emp.salary_currency || '',
            emp.salary_frequency || ''
          ] : [])
        ]
      }) || []

      const csvContent = [
        headers.join(','),
        ...csvRows.map((row: (string | number)[]) => row.map((field: string | number) => `"${String(field).replace(/"/g, '""')}"`).join(','))
      ].join('\n')

      const filename = `employees_export_${new Date().toISOString().split('T')[0]}.csv`

      c.header('Content-Type', 'text/csv; charset=utf-8')
      c.header('Content-Disposition', `attachment; filename="${filename}"`)
      return c.text(csvContent)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to export employees'
      return c.json({ error: message }, 400)
    }
  })

}
