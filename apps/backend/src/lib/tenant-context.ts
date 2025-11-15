import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@database.types.ts'

// Get User type from auth.getUser response (non-null since we check for user existence)
type User = NonNullable<Awaited<ReturnType<SupabaseClient<Database>['auth']['getUser']>>['data']['user']>

export type EmployeeRow = Database['public']['Tables']['employees']['Row']

export const getPrimaryTenantId = async (
  supabase: SupabaseClient<Database>,
): Promise<string> => {
  const membership = await supabase
    .from('memberships')
    .select('tenant_id, created_at')
    .order('created_at', { ascending: true })
    .limit(1)

  if (membership.error) throw new Error(membership.error.message)
  const tenantId = membership.data?.[0]?.tenant_id
  if (!tenantId) throw new Error('No tenant found for the current user.')
  return tenantId
}

export const hasPermission = async (
  supabase: SupabaseClient<Database>,
  tenantId: string,
  permission: string,
): Promise<boolean> => {
  const check = await supabase.rpc('app_has_permission', { permission, tenant: tenantId })
  if (check.error) throw new Error(check.error.message)
  return Boolean(check.data)
}

export const getEmployeeForUser = async (
  supabase: SupabaseClient<Database>,
  tenantId: string,
  user: User,
): Promise<EmployeeRow | null> => {
  const email = user.email
  if (!email) return null

  const res = await supabase
    .from('employees')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('email', email)
    .maybeSingle()

  if (res.error && res.error.code !== 'PGRST116') {
    throw new Error(res.error.message)
  }
  return res.data ?? null
}
