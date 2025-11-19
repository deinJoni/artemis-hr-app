import type { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Env, User } from '../types'
import type { Database } from '@database.types.ts'
import {
  ApprovalCategoryEnum,
  ApprovalDecisionInputSchema,
  ApprovalRequestInputSchema,
  ApprovalRequestListResponseSchema,
  ApprovalRequestSchema,
} from '@vibe/shared'
import { ensurePermission } from '../lib/permissions'
import { getEmployeeForUser, getPrimaryTenantId } from '../lib/tenant-context'

export const registerApprovalRoutes = (app: Hono<Env>) => {
  app.get('/api/approvals/requests', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'approvals.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    const url = new URL(c.req.url)
    const categoryParam = url.searchParams.get('category')
    const statusParam = url.searchParams.get('status') ?? 'pending'

    const validStatuses = ['pending', 'approved', 'denied', 'cancelled', 'all']
    if (!validStatuses.includes(statusParam)) {
      return c.json({ error: 'Invalid status filter' }, 400)
    }

    const query = supabase
      .from('approval_request_summary' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('requested_at', { ascending: false })

    if (statusParam !== 'all') {
      query.eq('status', statusParam)
    }

    if (categoryParam && categoryParam !== 'all') {
      const parsedCategory = ApprovalCategoryEnum.safeParse(categoryParam)
      if (!parsedCategory.success) {
        return c.json({ error: 'Invalid category filter' }, 400)
      }
      query.eq('category', parsedCategory.data)
    }

    const { data, error } = await query
    if (error) {
      return c.json({ error: error.message }, 400)
    }

    const payload = ApprovalRequestListResponseSchema.safeParse({ approvals: data || [] })
    if (!payload.success) {
      return c.json({ error: 'Unexpected response shape' }, 500)
    }

    return c.json(payload.data)
  })

  app.post('/api/approvals/requests', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const body = await c.req.json().catch(() => ({}))
    const parsed = ApprovalRequestInputSchema.safeParse(body)
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

    try {
      await ensurePermission(supabase, tenantId, 'approvals.submit')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    let employeeId: string | null = null
    try {
      const employee = await getEmployeeForUser(supabase, tenantId, user)
      employeeId = employee?.id ?? null
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve employee context'
      return c.json({ error: message }, 400)
    }

    const insertPayload = {
      tenant_id: tenantId,
      category: parsed.data.category,
      title: parsed.data.title,
      summary: parsed.data.summary ?? null,
      justification: parsed.data.justification,
      details: parsed.data.details,
      attachments: parsed.data.attachments ?? [],
      needed_by: parsed.data.needed_by ?? null,
      requested_by_user_id: user.id,
      requested_by_employee_id: employeeId,
      status: 'pending',
    }

    const { data: record, error } = await supabase
      .from('approval_requests')
      .insert(insertPayload)
      .select('id')
      .single()

    if (error || !record) {
      const message = error instanceof Error ? error.message : 'Unable to create approval request'
      return c.json({ error: message }, 400)
    }

    const { data: summary, error: summaryError } = await supabase
      .from('approval_request_summary' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', record.id)
      .single()

    if (summaryError || !summary) {
      const message = summaryError instanceof Error ? summaryError.message : 'Unable to load approval request'
      return c.json({ error: message }, 400)
    }

    const payload = ApprovalRequestSchema.safeParse(summary)
    if (!payload.success) {
      return c.json({ error: 'Unexpected response shape' }, 500)
    }

    return c.json(payload.data, 201)
  })

  app.put('/api/approvals/requests/:id/decision', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const requestId = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const parsed = ApprovalDecisionInputSchema.safeParse(body)
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

    try {
      await ensurePermission(supabase, tenantId, 'approvals.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    const { data: existing, error: fetchError } = await supabase
      .from('approval_requests')
      .select('id, status')
      .eq('tenant_id', tenantId)
      .eq('id', requestId)
      .single()

    if (fetchError || !existing) {
      return c.json({ error: 'Approval request not found' }, 404)
    }

    if (existing.status !== 'pending') {
      return c.json({ error: `Cannot update a ${existing.status} request` }, 400)
    }

    const newStatus = parsed.data.decision === 'approve' ? 'approved' : 'denied'
    const decisionReason = parsed.data.reason?.trim() || null

    const { error } = await supabase
      .from('approval_requests')
      .update({
        status: newStatus,
        decision_reason: decisionReason,
        approver_user_id: user.id,
        decided_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', requestId)

    if (error) {
      return c.json({ error: error.message }, 400)
    }

    const { data: summary, error: summaryError } = await supabase
      .from('approval_request_summary' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', requestId)
      .single()

    if (summaryError || !summary) {
      const message = summaryError instanceof Error ? summaryError.message : 'Unable to load approval request'
      return c.json({ error: message }, 400)
    }

    const payload = ApprovalRequestSchema.safeParse(summary)
    if (!payload.success) {
      return c.json({ error: 'Unexpected response shape' }, 500)
    }

    return c.json(payload.data)
  })
}
