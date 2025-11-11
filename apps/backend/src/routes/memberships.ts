import type { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  MembershipCreateInputSchema,
  MembershipListResponseSchema,
  MembershipUpdateInputSchema,
} from '@vibe/shared'

import type { Database } from '@database.types.ts'
import { ensurePermission } from '../lib/permissions'
import { supabaseAdmin } from '../lib/supabase'
import type { Env } from '../types'

const ensureOwnerRole = async (
  supabase: SupabaseClient<Database>,
  tenantId: string,
) => {
  const membership = await supabase
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (membership.error) throw new Error(membership.error.message)
  if (!membership.data || membership.data.role !== 'owner') {
    throw new Error('Only workspace owners can assign the owner role')
  }
}

export const registerMembershipRoutes = (app: Hono<Env>) => {
  app.get('/api/memberships/:tenantId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')

    try {
      await ensurePermission(supabase, tenantId, 'members.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    const rows = await supabaseAdmin
      .from('memberships')
      .select('user_id, tenant_id, role, created_at')
      .eq('tenant_id', tenantId)

    if (rows.error) return c.json({ error: rows.error.message }, 400)

    const members = await Promise.all(
      (rows.data ?? []).map(async (m) => {
        try {
          const user = await supabaseAdmin.auth.admin.getUserById(m.user_id)
          const email = user.data.user?.email ?? null
          return { ...m, email }
        } catch {
          return { ...m, email: null as string | null }
        }
      }),
    )

    const parsed = MembershipListResponseSchema.safeParse({ members })
    if (!parsed.success) return c.json({ error: 'Unexpected response shape' }, 500)
    return c.json(parsed.data)
  })

  app.post('/api/memberships/:tenantId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const body = await c.req.json().catch(() => ({}))
    const parsed = MembershipCreateInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'members.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    if (parsed.data.role === 'owner') {
      try {
        await ensureOwnerRole(supabase, tenantId)
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Only workspace owners can assign the owner role'
        return c.json({ error: message }, 403)
      }
    }

    const inserted = await supabase
      .from('memberships')
      .insert({ tenant_id: tenantId, user_id: parsed.data.user_id, role: parsed.data.role })
    if (inserted.error) return c.json({ error: inserted.error.message }, 400)

    return c.redirect(`/api/memberships/${tenantId}`)
  })

  app.put('/api/memberships/:tenantId/:userId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const userId = c.req.param('userId')
    const body = await c.req.json().catch(() => ({}))
    const parsed = MembershipUpdateInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'members.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    if (parsed.data.role === 'owner') {
      try {
        await ensureOwnerRole(supabase, tenantId)
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Only workspace owners can assign the owner role'
        return c.json({ error: message }, 403)
      }
    }

    const updated = await supabase
      .from('memberships')
      .update({ role: parsed.data.role })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
    if (updated.error) return c.json({ error: updated.error.message }, 400)

    return c.redirect(`/api/memberships/${tenantId}`)
  })

  app.delete('/api/memberships/:tenantId/:userId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const userId = c.req.param('userId')

    try {
      await ensurePermission(supabase, tenantId, 'members.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    const removed = await supabase
      .from('memberships')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
    if (removed.error) return c.json({ error: removed.error.message }, 400)

    return c.redirect(`/api/memberships/${tenantId}`)
  })
}
