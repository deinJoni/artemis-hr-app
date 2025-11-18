import type { Hono } from 'hono'

import {
  AdminFeaturesResponseSchema,
  FeatureToggleInputSchema,
  TenantFeatureFlagsResponseSchema,
  TenantFeatureSummarySchema,
} from '@vibe/shared'

import type { Env } from '../types'
import { getPrimaryTenantId } from '../lib/tenant-context'
import { fetchTenantFeatures } from '../lib/features'
import { supabaseAdmin } from '../lib/supabase'

export const registerFeatureRoutes = (app: Hono<Env>) => {
  app.get('/api/features', async (c) => {
    const supabase = c.get('supabase')

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    try {
      const features = await fetchTenantFeatures(supabase, tenantId)
      const response = TenantFeatureFlagsResponseSchema.safeParse({ features })
      if (!response.success) {
        return c.json({ error: 'Unexpected response shape' }, 500)
      }
      return c.json(response.data)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load features'
      return c.json({ error: message }, 500)
    }
  })

  app.get('/api/admin/features', async (c) => {
    if (!c.get('superadmin')) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const tenantIdFilter = c.req.query('tenantId')

    const query = supabaseAdmin
      .from('tenants')
      .select('id, name')
      .order('name', { ascending: true })

    if (tenantIdFilter) {
      query.eq('id', tenantIdFilter)
    }

    const { data: tenants, error } = await query
    if (error) {
      return c.json({ error: error.message }, 400)
    }

    const tenantsWithFeatures = await Promise.all(
      (tenants ?? []).map(async (tenant) => ({
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        features: await fetchTenantFeatures(supabaseAdmin, tenant.id),
      })),
    )

    const response = AdminFeaturesResponseSchema.safeParse({ tenants: tenantsWithFeatures })
    if (!response.success) {
      return c.json({ error: 'Unexpected response shape' }, 500)
    }

    return c.json(response.data)
  })

  app.put('/api/admin/features/:tenantId/:featureSlug', async (c) => {
    if (!c.get('superadmin')) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const tenantId = c.req.param('tenantId')
    const featureSlug = c.req.param('featureSlug')

    const body = await c.req.json().catch(() => ({}))
    const parsedInput = FeatureToggleInputSchema.safeParse(body)
    if (!parsedInput.success) {
      return c.json({ error: 'Invalid payload', details: parsedInput.error.flatten() }, 400)
    }

    const tenantLookup = await supabaseAdmin
      .from('tenants')
      .select('id, name')
      .eq('id', tenantId)
      .maybeSingle()

    if (tenantLookup.error || !tenantLookup.data) {
      const message = tenantLookup.error?.message ?? 'Tenant not found'
      const status = tenantLookup.error?.code === 'PGRST116' ? 404 : 400
      return c.json({ error: message }, status)
    }

    const featureLookup = await supabaseAdmin
      .from('features')
      .select('id, default_enabled')
      .eq('slug', featureSlug)
      .maybeSingle()

    if (featureLookup.error || !featureLookup.data) {
      const message = featureLookup.error?.message ?? 'Feature not found'
      const status = featureLookup.error?.code === 'PGRST116' ? 404 : 400
      return c.json({ error: message }, status)
    }

    const { enabled, reason, notes } = parsedInput.data
    const user = c.get('user')

    if (enabled === featureLookup.data.default_enabled) {
      const { error: deleteError } = await supabaseAdmin
        .from('tenant_feature_flags')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('feature_id', featureLookup.data.id)

      if (deleteError) {
        return c.json({ error: deleteError.message }, 400)
      }
    } else {
      const { error: upsertError } = await supabaseAdmin.from('tenant_feature_flags').upsert(
        {
          tenant_id: tenantId,
          feature_id: featureLookup.data.id,
          enabled,
          reason: reason ?? null,
          notes: notes ?? null,
          toggled_by: user.id,
        },
        { onConflict: 'tenant_id,feature_id' },
      )

      if (upsertError) {
        return c.json({ error: upsertError.message }, 400)
      }
    }

    try {
      const features = await fetchTenantFeatures(supabaseAdmin, tenantId)
      const response = TenantFeatureSummarySchema.safeParse({
        tenant_id: tenantId,
        tenant_name: tenantLookup.data.name,
        features,
      })
      if (!response.success) {
        return c.json({ error: 'Unexpected response shape' }, 500)
      }
      return c.json(response.data)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load features'
      return c.json({ error: message }, 500)
    }
  })
}

