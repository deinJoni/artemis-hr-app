import type { Hono } from 'hono'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@database.types.ts'
import {
  AccessGrantInputSchema,
  AccessRevokeInputSchema,
  AccessListResponseSchema,
} from '@vibe/shared'
import { ensurePermission } from '../lib/permissions'
import type { Env } from '../types'

export const registerAccessRoutes = (app: Hono<Env>) => {
  // Grant system access to an employee
  app.post('/api/access/grant', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const body = await c.req.json().catch(() => ({}))
    const { tenantId, ...grantData } = body as {
      tenantId?: string
      employee_id?: string
      system_name?: string
      system_type?: string
      notes?: string
    }

    if (!tenantId) {
      return c.json({ error: 'tenantId is required' }, 400)
    }

    const parsed = AccessGrantInputSchema.safeParse(grantData)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'employees.write')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      const { data: grant, error } = await supabase
        .from('access_grants' as any)
        .insert({
          tenant_id: tenantId,
          employee_id: parsed.data.employee_id,
          system_name: parsed.data.system_name,
          system_type: parsed.data.system_type || null,
          granted_by: user.id,
          notes: parsed.data.notes || null,
        } as any)
        .select()
        .single()

      if (error) {
        throw new Error(error.message)
      }

      return c.json({ grant })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to grant access'
      return c.json({ error: message }, 400)
    }
  })

  // Revoke system access
  app.put('/api/access/revoke', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const body = await c.req.json().catch(() => ({}))
    const parsed = AccessRevokeInputSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    try {
      // Get grant to find tenant_id
      const { data: grant, error: grantError } = await supabase
        .from('access_grants' as any)
        .select('tenant_id' as any)
        .eq('id', parsed.data.grant_id)
        .single()

      if (grantError || !grant) {
        return c.json({ error: 'Access grant not found' }, 404)
      }

      await ensurePermission(supabase, (grant as any).tenant_id, 'employees.write')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      const { error: updateError } = await supabase
        .from('access_grants' as any)
        .update({
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
          notes: parsed.data.notes || null,
        })
        .eq('id', parsed.data.grant_id)
        .is('revoked_at', null) // Only revoke if not already revoked

      if (updateError) {
        throw new Error(updateError.message)
      }

      return c.json({ message: 'Access revoked successfully' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to revoke access'
      return c.json({ error: message }, 400)
    }
  })

  // Get access grants for an employee
  app.get('/api/access/:employeeId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const employeeId = c.req.param('employeeId')
    const tenantId = c.req.query('tenantId')

    if (!tenantId) {
      return c.json({ error: 'tenantId query parameter is required' }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'employees.read')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      const { data: grants, error } = await supabase
        .from('access_grants' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .order('granted_at', { ascending: false })

      if (error) {
        throw new Error(error.message)
      }

      const payload = AccessListResponseSchema.safeParse({ grants: grants || [] })
      if (!payload.success) {
        return c.json({ error: 'Unexpected response shape' }, 500)
      }

      return c.json(payload.data)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load access grants'
      return c.json({ error: message }, 400)
    }
  })
}

