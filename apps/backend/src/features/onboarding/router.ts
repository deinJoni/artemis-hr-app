import type { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { User } from '../../types'
import type { Database } from '@database.types.ts'
import {
  SampleEmployeeInputSchema,
  SampleApprovalInputSchema,
  SampleSeedInputSchema,
  SampleDataResponseSchema,
  SampleSeedResponseSchema,
} from '@vibe/shared'
import { ensurePermission } from '../../lib/permissions'
import { hasPermission } from '../../lib/tenant-context'
import { getPrimaryTenantId } from '../../lib/tenant-context'
import type { Env } from '../../types'
import { generateDummyEmployees, generateDummyApprovals } from './service'

export const registerOnboardingSampleRoutes = (app: Hono<Env>) => {
  // POST /api/onboarding/sample/employees - Generate sample employees
  app.post('/api/onboarding/sample/employees', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const body = await c.req.json().catch(() => ({}))

    const parsed = SampleEmployeeInputSchema.safeParse(body)
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

    // Check permission: prefer onboarding.sample_data, fallback to employees.write
    let hasAccess = false
    try {
      hasAccess = await hasPermission(supabase, tenantId, 'onboarding.sample_data')
    } catch {
      // Permission doesn't exist, try fallback
    }

    if (!hasAccess) {
      try {
        await ensurePermission(supabase, tenantId, 'employees.write')
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Forbidden'
        return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
      }
    }

    try {
      const result = await generateDummyEmployees(supabase, tenantId, parsed.data)
      const response = SampleDataResponseSchema.parse(result)
      return c.json(response)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate employees'
      return c.json({ error: message }, 500)
    }
  })

  // POST /api/onboarding/sample/approvals - Generate sample approval requests
  app.post('/api/onboarding/sample/approvals', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const body = await c.req.json().catch(() => ({}))

    const parsed = SampleApprovalInputSchema.safeParse(body)
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

    // Check permission: prefer onboarding.sample_data, fallback to approvals.submit
    let hasAccess = false
    try {
      hasAccess = await hasPermission(supabase, tenantId, 'onboarding.sample_data')
    } catch {
      // Permission doesn't exist, try fallback
    }

    if (!hasAccess) {
      try {
        await ensurePermission(supabase, tenantId, 'approvals.submit')
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Forbidden'
        return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
      }
    }

    try {
      const result = await generateDummyApprovals(supabase, tenantId, user.id, parsed.data)
      const response = SampleDataResponseSchema.parse(result)
      return c.json(response)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate approvals'
      return c.json({ error: message }, 500)
    }
  })

  // POST /api/onboarding/sample/seed - Generate both employees and approvals
  app.post('/api/onboarding/sample/seed', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const body = await c.req.json().catch(() => ({}))

    const parsed = SampleSeedInputSchema.safeParse(body)
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

    // Check permission: prefer onboarding.sample_data, fallback to combined permissions
    let hasAccess = false
    try {
      hasAccess = await hasPermission(supabase, tenantId, 'onboarding.sample_data')
    } catch {
      // Permission doesn't exist, try fallback
    }

    if (!hasAccess) {
      try {
        // Check both permissions
        await ensurePermission(supabase, tenantId, 'employees.write')
        await ensurePermission(supabase, tenantId, 'approvals.submit')
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Forbidden'
        return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
      }
    }

    try {
      const results: {
        employees?: z.infer<typeof SampleDataResponseSchema>
        approvals?: z.infer<typeof SampleDataResponseSchema>
      } = {}

      // Generate employees first if requested
      if (parsed.data.employees) {
        const employeeResult = await generateDummyEmployees(supabase, tenantId, parsed.data.employees)
        results.employees = SampleDataResponseSchema.parse(employeeResult)
      }

      // Generate approvals if requested
      if (parsed.data.approvals) {
        // If employees were generated, use their IDs for approvals
        const approvalInput = { ...parsed.data.approvals }
        if (results.employees?.sample_ids && results.employees.sample_ids.length > 0) {
          approvalInput.employee_ids = results.employees.sample_ids
        }

        const approvalResult = await generateDummyApprovals(supabase, tenantId, user.id, approvalInput)
        results.approvals = SampleDataResponseSchema.parse(approvalResult)
      }

      const summary = [
        results.employees ? `Created ${results.employees.records_created} employee(s)` : null,
        results.approvals ? `Created ${results.approvals.records_created} approval request(s)` : null,
      ]
        .filter(Boolean)
        .join(', ')

      const response = SampleSeedResponseSchema.parse({
        success: (results.employees?.success ?? true) && (results.approvals?.success ?? true),
        employees: results.employees,
        approvals: results.approvals,
        summary: summary || 'No data generated',
      })

      return c.json(response)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate sample data'
      return c.json({ error: message }, 500)
    }
  })
}

