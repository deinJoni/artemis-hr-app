import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@database.types.ts'
import { TenantFeatureFlagsResponseSchema, type TenantFeatureFlag } from '@vibe/shared'

export const fetchTenantFeatures = async (
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<TenantFeatureFlag[]> => {
  const { data, error } = await supabase.rpc('app_get_tenant_features', { p_tenant: tenantId })
  if (error) {
    throw new Error(error.message)
  }

  const parsed = TenantFeatureFlagsResponseSchema.safeParse({
    features: Array.isArray(data) ? data : [],
  })

  if (!parsed.success) {
    throw new Error('Unable to load tenant features')
  }

  return parsed.data.features
}

export const toFeatureMap = (features: TenantFeatureFlag[]) => {
  return features.reduce<Record<string, TenantFeatureFlag>>((acc, feature) => {
    acc[feature.slug] = feature
    return acc
  }, {})
}

