import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@database.types.ts'

export const ensurePermission = async (
  supabase: SupabaseClient<Database>,
  tenantId: string,
  permission: string,
) => {
  const check = await supabase.rpc('app_has_permission', { permission, tenant: tenantId })
  if (check.error) throw new Error(check.error.message)
  if (!check.data) throw new Error('Forbidden')
}
