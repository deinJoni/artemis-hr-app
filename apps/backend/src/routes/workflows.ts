import type { Hono } from 'hono'
import type { SupabaseClient, User } from '@supabase/supabase-js'

import {
  WorkflowDetailResponseSchema,
  WorkflowListResponseSchema,
} from '@vibe/shared'

import type { Database } from '@database.types.ts'
import { createWorkflowDraft, getWorkflowDetail, listWorkflowsForTenant, publishWorkflow, updateWorkflowDraft, WorkflowCreateInputSchema, WorkflowUpdateInputSchema } from '../lib/workflows'
import { ensurePermission } from '../lib/permissions'
import type { Env } from '../types'

export const registerWorkflowRoutes = (app: Hono<Env>) => {
  app.get('/api/workflows/:tenantId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')

    try {
      await ensurePermission(supabase, tenantId, 'workflows.read')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      const workflows = await listWorkflowsForTenant(supabase, tenantId)
      const payload = WorkflowListResponseSchema.safeParse({ workflows })
      if (!payload.success) {
        return c.json({ error: 'Unexpected response shape' }, 500)
      }
      return c.json(payload.data)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load workflows'
      return c.json({ error: message }, 400)
    }
  })

  app.post('/api/workflows/:tenantId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const tenantId = c.req.param('tenantId')
    const body = await c.req.json().catch(() => ({}))
    const parsed = WorkflowCreateInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'workflows.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      const result = await createWorkflowDraft(
        supabase,
        tenantId,
        user.id,
        parsed.data,
      )
      const payload = WorkflowDetailResponseSchema.safeParse(result)
      if (!payload.success) {
        return c.json({ error: 'Unexpected response shape' }, 500)
      }
      return c.json(payload.data)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to create workflow'
      return c.json({ error: message }, 400)
    }
  })

  app.get('/api/workflows/:tenantId/:workflowId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const workflowId = c.req.param('workflowId')

    try {
      await ensurePermission(supabase, tenantId, 'workflows.read')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      const detail = await getWorkflowDetail(supabase, tenantId, workflowId)
      const payload = WorkflowDetailResponseSchema.safeParse(detail)
      if (!payload.success) {
        return c.json({ error: 'Unexpected response shape' }, 500)
      }
      return c.json(payload.data)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load workflow'
      return c.json({ error: message }, 400)
    }
  })

  app.put('/api/workflows/:tenantId/:workflowId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const tenantId = c.req.param('tenantId')
    const workflowId = c.req.param('workflowId')
    const body = await c.req.json().catch(() => ({}))
    const parsed = WorkflowUpdateInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'workflows.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      const updated = await updateWorkflowDraft(
        supabase,
        tenantId,
        workflowId,
        user.id,
        parsed.data,
      )
      const payload = WorkflowDetailResponseSchema.safeParse(updated)
      if (!payload.success) {
        return c.json({ error: 'Unexpected response shape' }, 500)
      }
      return c.json(payload.data)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to update workflow'
      return c.json({ error: message }, 400)
    }
  })

  app.post('/api/workflows/:tenantId/:workflowId/publish', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const tenantId = c.req.param('tenantId')
    const workflowId = c.req.param('workflowId')

    try {
      await ensurePermission(supabase, tenantId, 'workflows.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      const published = await publishWorkflow(
        supabase,
        tenantId,
        workflowId,
        user.id,
      )
      const payload = WorkflowDetailResponseSchema.safeParse(published)
      if (!payload.success) {
        return c.json({ error: 'Unexpected response shape' }, 500)
      }
      return c.json(payload.data)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to publish workflow'
      return c.json({ error: message }, 400)
    }
  })

}
