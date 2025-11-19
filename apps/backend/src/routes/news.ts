import type { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  CompanyNewsActivityResponseSchema,
  CompanyNewsActivitySchema,
  CompanyNewsCreateInputSchema,
  CompanyNewsListResponseSchema,
  CompanyNewsPublishInputSchema,
  CompanyNewsSchema,
  CompanyNewsUpdateInputSchema,
  CompanyNewsStatusEnum,
} from '@vibe/shared'
import type { Database } from '@database.types.ts'
import type { Env, User } from '../types'
import { ensurePermission } from '../lib/permissions'
import { extractRequestInfo } from '../lib/audit-logger'

const DEFAULT_LIST_LIMIT = 20
const MAX_LIST_LIMIT = 100

type Supabase = SupabaseClient<Database>

const normalizeDatetime = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    // If it's already a valid ISO string, return as-is
    // Otherwise try to parse and convert
    try {
      const date = new Date(value)
      if (isNaN(date.getTime())) return null
      return date.toISOString()
    } catch {
      return null
    }
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  return null
}

const mapNewsRecord = (record: Record<string, unknown>) => {
  // Normalize datetime fields before validation
  const normalized = {
    ...record,
    publish_at: normalizeDatetime(record.publish_at),
    published_at: normalizeDatetime(record.published_at),
    created_at: normalizeDatetime(record.created_at) || (typeof record.created_at === 'string' ? record.created_at : new Date().toISOString()),
    updated_at: normalizeDatetime(record.updated_at) || (typeof record.updated_at === 'string' ? record.updated_at : new Date().toISOString()),
  }
  
  const parsed = CompanyNewsSchema.safeParse(normalized)
  if (!parsed.success) {
    console.error('[news] Schema validation failed:', {
      errors: parsed.error.flatten(),
      data: normalized,
      dataKeys: Object.keys(normalized),
    })
    throw new Error('Unexpected news payload')
  }
  return parsed.data
}

const mapActivityRecord = (record: Record<string, unknown>) => {
  const parsed = CompanyNewsActivitySchema.safeParse(record)
  if (!parsed.success) {
    throw new Error('Unexpected news activity payload')
  }
  return parsed.data
}

async function logNewsActivity(
  supabase: Supabase,
  tenantId: string,
  newsId: string,
  actorId: string,
  action: string,
  details?: Record<string, unknown>,
) {
  const payload = {
    tenant_id: tenantId,
    news_id: newsId,
    action,
    actor_id: actorId,
    details: details ?? null,
  }

  const { error } = await supabase.from('company_news_activity' as any).insert(payload as any)
  if (error) {
    console.error('[news] Failed to log activity', error.message)
  }
}

const STATUS_SET = new Set(CompanyNewsStatusEnum.options)
const parseStatusFilter = (value: string | null): string[] => {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => STATUS_SET.has(item as (typeof CompanyNewsStatusEnum.options)[number]))
}

export const registerNewsRoutes = (app: Hono<Env>) => {
  // List news items (supports filtering)
  app.get('/api/news', async (c) => {
    const supabase = c.get('supabase') as Supabase
    const url = new URL(c.req.url)
    const tenantId = url.searchParams.get('tenantId')
    const categories = (url.searchParams.get('category') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    const statusFilter = parseStatusFilter(url.searchParams.get('status'))
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get('limit') ?? `${DEFAULT_LIST_LIMIT}`, 10) || DEFAULT_LIST_LIMIT, 1),
      MAX_LIST_LIMIT,
    )
    const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0)

    if (!tenantId) {
      return c.json({ error: 'tenantId query parameter is required' }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'communications.news.read')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      let query = supabase
        .from('company_news' as any)
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('publish_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (categories.length > 0) {
        query = query.in('category', categories)
      }

      if (statusFilter.length > 0) {
        query = query.in('status', statusFilter)
      }

      const { data, count, error } = await query
      if (error) throw new Error(error.message)

      const news = (data ?? []).map((record) => mapNewsRecord(record as unknown as Record<string, unknown>))
      const payload = CompanyNewsListResponseSchema.parse({
        news,
        total: count ?? news.length,
      })

      return c.json(payload)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load news'
      console.error('[news] list failed', message)
      return c.json({ error: message }, 400)
    }
  })

  // Latest published items for dashboard
  app.get('/api/news/latest', async (c) => {
    const supabase = c.get('supabase') as Supabase
    const url = new URL(c.req.url)
    const tenantId = url.searchParams.get('tenantId')
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get('limit') ?? '3', 10) || 3, 1),
      6,
    )

    if (!tenantId) {
      return c.json({ error: 'tenantId query parameter is required' }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'communications.news.read')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from('company_news' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'published')
        .lte('publish_at', nowIso)
        .order('publish_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw new Error(error.message)

      const news = (data ?? []).map((record) => mapNewsRecord(record as unknown as Record<string, unknown>))
      return c.json({ news })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load latest news'
      console.error('[news] latest failed', message)
      return c.json({ error: message }, 400)
    }
  })

  // Fetch a single news item (with optional activity)
  app.get('/api/news/:newsId', async (c) => {
    const supabase = c.get('supabase') as Supabase
    const { newsId } = c.req.param()
    const tenantId = c.req.query('tenantId')
    const includeActivity = c.req.query('includeActivity') === 'true'

    if (!tenantId) {
      return c.json({ error: 'tenantId query parameter is required' }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'communications.news.read')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      const { data, error } = await supabase
        .from('company_news' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', newsId)
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!data) return c.json({ error: 'News item not found' }, 404)

      const news = mapNewsRecord(data as unknown as Record<string, unknown>)

      if (!includeActivity) {
        return c.json({ news })
      }

      const { data: activity, error: activityError } = await supabase
        .from('company_news_activity' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('news_id', newsId)
        .order('created_at', { ascending: false })

      if (activityError) {
        throw new Error(activityError.message)
      }

      const parsed = CompanyNewsActivityResponseSchema.parse({
        activity: (activity ?? []).map((record) => mapActivityRecord(record as unknown as Record<string, unknown>)),
      })

      return c.json({ news, ...parsed })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load news item'
      console.error('[news] detail failed', message)
      return c.json({ error: message }, 400)
    }
  })

  // Create a news item (draft or scheduled)
  app.post('/api/news', async (c) => {
    const supabase = c.get('supabase') as Supabase
    const user = c.get('user') as User
    const body = await c.req.json().catch(() => ({}))
    const parsed = CompanyNewsCreateInputSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const input = parsed.data

    try {
      await ensurePermission(supabase, input.tenantId, 'communications.news.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    if (input.status === 'published') {
      return c.json({ error: 'Use the publish endpoint to publish news' }, 400)
    }

    if (input.status === 'scheduled' && !input.publishAt) {
      return c.json({ error: 'publishAt is required when scheduling news' }, 400)
    }

    const now = new Date().toISOString()
    const payload = {
      tenant_id: input.tenantId,
      title: input.title,
      summary: input.summary ?? null,
      body: input.body,
      category: input.category,
      status: input.status ?? 'draft',
      publish_at: input.publishAt ?? null,
      created_by: user.id,
      published_at: null,
      published_by: null,
    }

    try {
      const { data, error } = await supabase
        .from('company_news' as any)
        .insert({ ...payload, created_at: now, updated_at: now } as any)
        .select('*')
        .single()

      if (error) throw new Error(error.message)
      const news = mapNewsRecord(data as unknown as Record<string, unknown>)

      await logNewsActivity(supabase, input.tenantId, news.id, user.id, 'created', {
        category: news.category,
        status: news.status,
      })

      return c.json({ news })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to create news item'
      console.error('[news] create failed', message)
      return c.json({ error: message }, 400)
    }
  })

  // Update news
  app.put('/api/news/:newsId', async (c) => {
    const supabase = c.get('supabase') as Supabase
    const user = c.get('user') as User
    const { newsId } = c.req.param()
    const body = await c.req.json().catch(() => ({}))
    const parsed = CompanyNewsUpdateInputSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const payload = parsed.data
    const tenantId = c.req.query('tenantId')

    if (!tenantId) {
      return c.json({ error: 'tenantId query parameter is required' }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'communications.news.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    if (payload.status === 'published') {
      return c.json({ error: 'Use the publish endpoint to publish news' }, 400)
    }

    if (payload.status === 'scheduled' && !payload.publishAt) {
      return c.json({ error: 'publishAt is required when scheduling news' }, 400)
    }

    try {
      const { data: existing, error: existingError } = await supabase
        .from('company_news' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', newsId)
        .maybeSingle()

      if (existingError) throw new Error(existingError.message)
      if (!existing) return c.json({ error: 'News item not found' }, 404)

      const updates: Record<string, unknown> = {}
      if (payload.title !== undefined) updates.title = payload.title
      if (payload.summary !== undefined) updates.summary = payload.summary ?? null
      if (payload.body !== undefined) updates.body = payload.body
      if (payload.category !== undefined) updates.category = payload.category
      if (payload.publishAt !== undefined) updates.publish_at = payload.publishAt ?? null
      if (payload.status !== undefined) updates.status = payload.status

      if (Object.keys(updates).length === 0) {
        return c.json({ error: 'No changes provided' }, 400)
      }

      const { data, error } = await supabase
        .from('company_news' as any)
        .update(updates)
        .eq('id', newsId)
        .eq('tenant_id', tenantId)
        .select('*')
        .single()

      if (error) throw new Error(error.message)
      const news = mapNewsRecord(data as unknown as Record<string, unknown>)

      await logNewsActivity(supabase, tenantId, news.id, user.id, 'updated', updates)

      return c.json({ news })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to update news item'
      console.error('[news] update failed', message)
      return c.json({ error: message }, 400)
    }
  })

  // Publish news
  app.post('/api/news/:newsId/publish', async (c) => {
    const supabase = c.get('supabase') as Supabase
    const user = c.get('user') as User
    const { newsId } = c.req.param()
    const tenantId = c.req.query('tenantId')
    const body = await c.req.json().catch(() => ({}))
    const parsed = CompanyNewsPublishInputSchema.safeParse(body)

    if (!tenantId) {
      return c.json({ error: 'tenantId query parameter is required' }, 400)
    }

    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'communications.news.publish')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    const publishAt = parsed.data.publishAt ?? new Date().toISOString()

    try {
      const { data, error } = await supabase
        .from('company_news' as any)
        .update({
          status: 'published',
          publish_at: publishAt,
          published_at: publishAt,
          published_by: user.id,
        })
        .eq('tenant_id', tenantId)
        .eq('id', newsId)
        .select('*')
        .single()

      if (error) throw new Error(error.message)
      if (!data) throw new Error('No data returned')

      // mapNewsRecord handles datetime normalization
      const news = mapNewsRecord(data as unknown as Record<string, unknown>)

      const { ipAddress, userAgent } = extractRequestInfo(c.req)
      await logNewsActivity(supabase, tenantId, news.id, user.id, 'published', {
        publish_at: publishAt,
        ip_address: ipAddress,
        user_agent: userAgent,
      })

      return c.json({ news })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to publish news item'
      console.error('[news] publish failed', message)
      return c.json({ error: message }, 400)
    }
  })

  // Unpublish (revert to draft)
  app.post('/api/news/:newsId/unpublish', async (c) => {
    const supabase = c.get('supabase') as Supabase
    const user = c.get('user') as User
    const { newsId } = c.req.param()
    const tenantId = c.req.query('tenantId')

    if (!tenantId) {
      return c.json({ error: 'tenantId query parameter is required' }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'communications.news.publish')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      const { data, error } = await supabase
        .from('company_news' as any)
        .update({
          status: 'draft',
          publish_at: null,
          published_at: null,
          published_by: null,
        })
        .eq('tenant_id', tenantId)
        .eq('id', newsId)
        .select('*')
        .single()

      if (error) throw new Error(error.message)
      if (!data) throw new Error('No data returned')

      // mapNewsRecord handles datetime normalization
      const news = mapNewsRecord(data as unknown as Record<string, unknown>)

      await logNewsActivity(supabase, tenantId, news.id, user.id, 'unpublished')
      return c.json({ news })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to unpublish news item'
      console.error('[news] unpublish failed', message)
      return c.json({ error: message }, 400)
    }
  })

  // Delete a news item
  app.delete('/api/news/:newsId', async (c) => {
    const supabase = c.get('supabase') as Supabase
    const user = c.get('user') as User
    const { newsId } = c.req.param()
    const tenantId = c.req.query('tenantId')

    if (!tenantId) {
      return c.json({ error: 'tenantId query parameter is required' }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'communications.news.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      const { error } = await supabase
        .from('company_news' as any)
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', newsId)

      if (error) throw new Error(error.message)

      await logNewsActivity(supabase, tenantId, newsId, user.id, 'deleted')

      return c.json({ message: 'News item deleted' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to delete news item'
      console.error('[news] delete failed', message)
      return c.json({ error: message }, 400)
    }
  })
}
