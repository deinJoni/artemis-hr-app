import type { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { User } from '../types'

import {
  AccountBootstrapInputSchema,
  AccountBootstrapResponseSchema,
  CreateTenantInputSchema,
  CreateTenantResponseSchema,
  OnboardingStepPayloadSchema,
  OnboardingStepResponseSchema,
  TenantSchema,
  TenantUpdateInputSchema,
  type Tenant,
} from '@vibe/shared'

import type { Database } from '@database.types.ts'
import { supabaseAdmin } from '../lib/supabase'
import { fetchTenantFeatures } from '../lib/features'
import type { Env } from '../types'

type ProfileSummary = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'user_id' | 'tenant_id' | 'display_name' | 'created_at' | 'updated_at'
>

const TENANT_SELECT_COLUMNS =
  'id, name, created_at, company_name, company_size, language, onboarding_step, setup_completed, activated_at'

const TOTAL_ONBOARDING_STEPS = 3
const TENANT_NAME_MAX_LENGTH = 120

const toNullableString = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

const toEmailOrNull = (value: string | null | undefined) => {
  const normalized = toNullableString(value)
  if (!normalized) return null
  // Basic email validation to avoid tripping zod email parsing on malformed historical data
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null
}

const normalizeTenantForResponse = (
  tenant: Partial<Database['public']['Tables']['tenants']['Row']> & {
    id: string
    name: string
    created_at: string
    onboarding_step: number | string
    setup_completed: boolean
  },
): Tenant => ({
  id: tenant.id,
  name: tenant.name,
  created_at: tenant.created_at,
  company_name: toNullableString(tenant.company_name),
  company_size: toNullableString(tenant.company_size),
  language: toNullableString(tenant.language),
  onboarding_step:
    typeof tenant.onboarding_step === 'number'
      ? tenant.onboarding_step
      : Number(tenant.onboarding_step ?? 0),
  setup_completed: Boolean(tenant.setup_completed),
  activated_at: toNullableString(tenant.activated_at),
})

const generateTenantSuffix = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `#${crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`
  }
  return `#${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

const buildTenantNameWithSuffix = (base: string, suffix: string) => {
  const trimmedBase = base.trim()
  const separator = trimmedBase.length > 0 ? ' ' : ''
  const usableLength = Math.max(1, TENANT_NAME_MAX_LENGTH - suffix.length - separator.length)
  const clippedBase = trimmedBase.slice(0, usableLength)
  return `${clippedBase}${separator}${suffix}`.trim()
}

const ensureProfile = async (
  supabase: SupabaseClient<Database>,
  user: User,
  tenantId: string,
  displayName: string,
): Promise<ProfileSummary> => {
  const existingProfile = await supabase
    .from('profiles')
    .select('user_id, tenant_id, display_name, created_at, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingProfile.error) {
    throw new Error(existingProfile.error.message)
  }

  const currentProfile = (existingProfile.data ?? null) as ProfileSummary | null
  if (currentProfile) {
    if (currentProfile.tenant_id === tenantId && currentProfile.display_name === displayName) {
      return currentProfile
    }

    const updated = await supabaseAdmin
      .from('profiles')
      .update({ tenant_id: tenantId, display_name: displayName })
      .eq('user_id', user.id)
      .select('user_id, tenant_id, display_name, created_at, updated_at')
      .single()

    if (updated.error || !updated.data) {
      throw new Error(updated.error?.message ?? 'Unable to update profile')
    }

    return updated.data as ProfileSummary
  }

  const inserted = await supabaseAdmin
    .from('profiles')
    .insert({
      user_id: user.id,
      tenant_id: tenantId,
      display_name: displayName,
    })
    .select('user_id, tenant_id, display_name, created_at, updated_at')
    .single()

  if (inserted.error || !inserted.data) {
    throw new Error(inserted.error?.message ?? 'Unable to create profile')
  }

  return inserted.data as ProfileSummary
}

const resolveTenant = async (
  supabase: SupabaseClient<Database>,
  user: User,
  tenantId?: string | null,
) => {
  if (tenantId) {
    const tenantLookup = await supabase
      .from('tenants')
      .select(TENANT_SELECT_COLUMNS)
      .eq('id', tenantId)
      .maybeSingle()

    if (tenantLookup.error) {
      throw new Error(tenantLookup.error.message)
    }

    if (tenantLookup.data) {
      return tenantLookup.data
    }

    const fallback = await supabaseAdmin
      .from('tenants')
      .select(TENANT_SELECT_COLUMNS)
      .eq('id', tenantId)
      .maybeSingle()

    if (fallback.error || !fallback.data) {
      throw new Error(fallback.error?.message ?? 'Tenant not found')
    }

    return fallback.data
  }

  const createdTenant = await supabase.rpc('app_create_tenant', { p_name: `${user.email?.split('@')[0]}'s Workspace` })

  if (createdTenant.error || !createdTenant.data) {
    throw new Error(createdTenant.error?.message ?? 'Unable to resolve tenant')
  }

  // Fetch the full tenant record including language
  const fullTenant = await supabaseAdmin
    .from('tenants')
    .select(TENANT_SELECT_COLUMNS)
    .eq('id', createdTenant.data.id)
    .single()

  if (fullTenant.error || !fullTenant.data) {
    throw new Error(fullTenant.error?.message ?? 'Unable to fetch tenant')
  }

  return fullTenant.data
}

export const registerTenantRoutes = (app: Hono<Env>) => {
  app.post('/api/tenants', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const parsed = CreateTenantInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const supabase = c.get('supabase') as SupabaseClient<Database>

    const { data, error } = await supabase.rpc('app_create_tenant', { p_name: parsed.data.name })
    if (error) return c.json({ error: error.message }, 400)

    const output = CreateTenantResponseSchema.safeParse(data)
    if (!output.success) return c.json({ error: 'Unexpected response shape' }, 500)

    return c.json(output.data)
  })

  app.post('/api/account/bootstrap', async (c) => {
    const user = c.get('user') as User
    const supabase = c.get('supabase') as SupabaseClient<Database>

    const body = await c.req.json().catch(() => ({}))
    const parsedInput = AccountBootstrapInputSchema.safeParse(body)
    if (!parsedInput.success) {
      return c.json({ error: 'Invalid payload', details: parsedInput.error.flatten() }, 400)
    }

    const input = parsedInput.data

    const metadataNameCandidates = [
      input.displayName,
      typeof user.user_metadata?.name === 'string' ? (user.user_metadata.name as string) : undefined,
      typeof user.user_metadata?.full_name === 'string' ? (user.user_metadata.full_name as string) : undefined,
      typeof user.user_metadata?.display_name === 'string'
        ? (user.user_metadata.display_name as string)
        : undefined,
      user.email ? user.email.split('@')[0] : undefined,
    ].filter((value): value is string => Boolean(value && value.trim().length > 0))

    const fallbackDisplayName = metadataNameCandidates.length > 0
      ? metadataNameCandidates[0].trim()
      : 'Artemis member'

    const desiredDisplayName = (input.displayName ?? '').trim() || fallbackDisplayName
    const desiredTenantName = (input.tenantName ?? '').trim() || `${desiredDisplayName}'s Workspace`.trim()

    const membershipResult = await supabase
      .from('memberships')
      .select('tenant_id, role, created_at')
      .order('created_at', { ascending: true })
      .limit(1)

    if (membershipResult.error) {
      return c.json({ error: membershipResult.error.message }, 400)
    }

    let created = false
    let tenantId = membershipResult.data?.[0]?.tenant_id ?? null
    let tenantRecord: Tenant | null = null

    const attemptTenantCreation = async () => {
      let nextName = desiredTenantName
      for (let attempt = 0; attempt < 5; attempt++) {
        const tenantCreation = await supabase.rpc('app_create_tenant', { p_name: nextName })
        if (!tenantCreation.error && tenantCreation.data) {
          // Fetch the full tenant record including language
          const fullTenant = await supabaseAdmin
            .from('tenants')
            .select(TENANT_SELECT_COLUMNS)
            .eq('id', tenantCreation.data.id)
            .single()
          
          if (!fullTenant.error && fullTenant.data) {
            return fullTenant.data
          }
        }
        if (tenantCreation.error?.code === '23505') {
          const suffix = generateTenantSuffix()
          nextName = buildTenantNameWithSuffix(desiredTenantName, suffix)
          continue
        }
        throw new Error(tenantCreation.error?.message ?? 'Unable to create tenant')
      }
      throw new Error('Unable to create tenant')
    }

    if (!tenantId) {
      try {
        tenantRecord = await attemptTenantCreation()
        if (!tenantRecord) {
          return c.json({ error: 'Unable to create tenant' }, 400)
        }
        tenantId = tenantRecord.id
        created = true
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unable to create tenant'
        return c.json({ error: message }, 400)
      }
    }

    if (!tenantRecord && tenantId) {
      try {
        tenantRecord = (await resolveTenant(supabase, user, tenantId)) as Tenant
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Tenant not found'
        return c.json({ error: message }, 404)
      }
    }

    if (!tenantRecord || !tenantId) {
      return c.json({ error: 'Tenant resolution failed' }, 500)
    }

    let profileRecord
    try {
      profileRecord = await ensureProfile(supabase, user, tenantId, desiredDisplayName)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to create profile'
      return c.json({ error: message }, 400)
    }

    let features
    try {
      features = await fetchTenantFeatures(supabase, tenantId)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load feature flags'
      return c.json({ error: message }, 500)
    }

    const isSuperadmin = c.get('superadmin') ?? false

    const output = AccountBootstrapResponseSchema.safeParse({
      tenant: tenantRecord,
      profile: profileRecord,
      created,
      features,
      is_superadmin: isSuperadmin,
    })

    if (!output.success) {
      return c.json({ error: 'Unexpected response shape' }, 500)
    }

    return c.json(output.data)
  })

  app.put('/api/onboarding/step', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User

    const body = await c.req.json().catch(() => ({}))
    const parsed = OnboardingStepPayloadSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const membership = await supabase
      .from('memberships')
      .select('tenant_id, role, created_at')
      .order('created_at', { ascending: true })
      .limit(1)

    if (membership.error) {
      return c.json({ error: membership.error.message }, 400)
    }

    const tenantId = membership.data?.[0]?.tenant_id
    if (!tenantId) {
      return c.json({ error: 'No tenant found for the current user.' }, 400)
    }

    let tenant = await supabase
      .from('tenants')
      .select(TENANT_SELECT_COLUMNS)
      .eq('id', tenantId)
      .maybeSingle()

    if (tenant.error) {
      return c.json({ error: tenant.error.message }, 400)
    }

    if (!tenant.data) {
      const fallback = await supabaseAdmin
        .from('tenants')
        .select(TENANT_SELECT_COLUMNS)
        .eq('id', tenantId)
        .maybeSingle()
      if (fallback.error || !fallback.data) {
        return c.json({ error: fallback.error?.message ?? 'Tenant not found' }, 404)
      }
      tenant = { ...tenant, data: fallback.data }
    }

    const payload = parsed.data

    const updateData: Database['public']['Tables']['tenants']['Update'] = {}

    if (payload.step === 1) {
      updateData.company_name = payload.companyName
      updateData.company_size = payload.companySize
      updateData.language = payload.language
    } else if (payload.step === 2) {
      // Create employee record in step 2
      const employeeName = `${payload.firstName} ${payload.lastName}`
      
      // Check if employee already exists (use supabaseAdmin to bypass RLS)
      const existingEmployee = await supabaseAdmin
        .from('employees')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('email', payload.companyEmail)
        .maybeSingle()

      if (existingEmployee.error && existingEmployee.error.code !== 'PGRST116') {
        console.error('Error checking for existing employee:', existingEmployee.error.message)
        return c.json({ error: 'Failed to check for existing employee', details: existingEmployee.error.message }, 500)
      } else if (!existingEmployee.data) {
        // Create employee record
        const employeeInsert = await supabaseAdmin
          .from('employees')
          .insert({
            tenant_id: tenantId,
            user_id: user.id,
            email: payload.companyEmail,
            name: employeeName,
            job_title: payload.rolePosition,
            status: 'active',
            start_date: new Date().toISOString().split('T')[0],
          })
          .select('id')
          .single()

        if (employeeInsert.error) {
          console.error('Error creating employee record during onboarding:', employeeInsert.error.message)
          return c.json({ 
            error: 'Failed to create employee record during onboarding', 
            details: employeeInsert.error.message 
          }, 500)
        }

        // Verify employee was created
        if (!employeeInsert.data?.id) {
          console.error('Employee creation returned no ID')
          return c.json({ error: 'Employee creation failed: no ID returned' }, 500)
        }
      } else {
        // Update existing employee with job_title if needed
        const updateResult = await supabaseAdmin
          .from('employees')
          .update({
            job_title: payload.rolePosition,
            name: employeeName,
          })
          .eq('id', existingEmployee.data.id)

        if (updateResult.error) {
          console.error('Error updating existing employee during onboarding:', updateResult.error.message)
          return c.json({ 
            error: 'Failed to update existing employee record', 
            details: updateResult.error.message 
          }, 500)
        }
      }
    } else if (payload.step === 3) {
      updateData.setup_completed = true
      if (!tenant.data?.activated_at) {
        updateData.activated_at = new Date().toISOString()
      }
    }

    const currentStep = tenant.data?.onboarding_step ?? 0
    updateData.onboarding_step = Math.max(currentStep, payload.step)

    if (tenant.data?.setup_completed) {
      updateData.setup_completed = tenant.data.setup_completed || updateData.setup_completed
      updateData.onboarding_step = Math.max(tenant.data.onboarding_step ?? 0, TOTAL_ONBOARDING_STEPS)
    }

    const updated = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', tenantId)
      .select(TENANT_SELECT_COLUMNS)
      .single()

    if (updated.error || !updated.data) {
      return c.json({ error: updated.error?.message ?? 'Unable to save onboarding data' }, 400)
    }

    // Create default leave types when onboarding completes (step 3)
    const isCompletingOnboarding = payload.step === 3 && updated.data.setup_completed && !tenant.data?.setup_completed
    if (isCompletingOnboarding) {
      // Find the employee created in step 2
      const employee = await supabase
        .from('employees')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (employee.data) {
        // Create default leave types for tenant if they don't exist
        const defaultLeaveTypes = [
          { code: 'VACATION', name: 'Vacation', requires_approval: true, requires_certificate: false, allow_negative_balance: false, color: '#3B82F6' },
          { code: 'SICK', name: 'Sick Leave', requires_approval: false, requires_certificate: true, allow_negative_balance: true, color: '#EF4444' },
          { code: 'PERSONAL', name: 'Personal Leave', requires_approval: true, requires_certificate: false, allow_negative_balance: false, color: '#10B981' },
        ]

        for (const leaveType of defaultLeaveTypes) {
          // Check if leave type already exists
          const existingType = await supabaseAdmin
            .from('leave_types')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('code', leaveType.code)
            .maybeSingle()

          if (!existingType.data) {
            // Create leave type if it doesn't exist
            const { error: leaveTypeInsertError } = await supabaseAdmin
              .from('leave_types')
              .insert({
                tenant_id: tenantId,
                ...leaveType,
                is_active: true,
              })
            if (leaveTypeInsertError) {
              console.error(
                `Error creating leave type ${leaveType.code}:`,
                leaveTypeInsertError.message
              )
            }
          }
        }

        // Get all active leave types for this tenant with codes
        const leaveTypes = await supabaseAdmin
          .from('leave_types')
          .select('id, code')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)

        if (leaveTypes.data && leaveTypes.data.length > 0) {
          // Calculate period start/end (current year)
          const now = new Date()
          const currentYear = now.getFullYear()
          const periodStart = `${currentYear}-01-01`
          const periodEnd = `${currentYear}-12-31`

          // Default balances: 20 days vacation, 10 days sick, 5 days personal
          const defaultBalances: Record<string, number> = {
            VACATION: 20.0,
            SICK: 10.0,
            PERSONAL: 5.0,
          }

          // Get the first employee for creating balances
          const employee = await supabaseAdmin
            .from('employees')
            .select('id')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()

          if (employee.data) {
            const employeeId = employee.data.id
            // Create leave balances for each leave type
            const balanceInserts = leaveTypes.data.map(async (lt: { id: string; code: string }) => {
              const code = lt.code as keyof typeof defaultBalances
              const defaultBalance = defaultBalances[code] ?? 0
              
              // Check if balance already exists to avoid duplicates
              const existingBalance = await supabaseAdmin
                .from('leave_balances')
                .select('id')
                .eq('tenant_id', tenantId)
                .eq('employee_id', employeeId)
                .eq('leave_type_id', lt.id)
                .eq('period_start', periodStart)
                .eq('period_end', periodEnd)
                .maybeSingle()
              
              if (existingBalance.data) {
                console.log(`Leave balance for type ${lt.code} already exists, skipping`)
                return
              }
              
              const { error: balanceInsertError } = await supabaseAdmin
                .from('leave_balances')
                .insert({
                  tenant_id: tenantId,
                  employee_id: employeeId,
                  leave_type_id: lt.id,
                  balance_days: defaultBalance,
                  used_ytd: 0,
                  period_start: periodStart,
                  period_end: periodEnd,
                })
              if (balanceInsertError) {
                // Log but don't fail - balances can be configured manually
                console.error(
                  `Error creating leave balance for type ${lt.code}:`,
                  balanceInsertError.message,
                  balanceInsertError
                )
              } else {
                console.log(`Successfully created leave balance for type ${lt.code}`)
              }
            })

            // Wait for all balance inserts (best effort)
            await Promise.allSettled(balanceInserts)
          }
        }
      }
    }

    const normalizedTenant = normalizeTenantForResponse(updated.data)
    const response = OnboardingStepResponseSchema.safeParse({ tenant: normalizedTenant })
    if (!response.success) {
      console.error('Failed to validate onboarding response payload:', response.error)
      return c.json({ tenant: normalizedTenant })
    }

    return c.json(response.data)
  })

  app.get('/api/tenants/me', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>

    const membership = await supabase
      .from('memberships')
      .select('tenant_id, role, created_at')
      .order('created_at', { ascending: true })
      .limit(1)

    if (membership.error) {
      return c.json({ error: membership.error.message }, 400)
    }

    const tenantId = membership.data?.[0]?.tenant_id
    if (!tenantId) return c.json({ error: 'No tenant found for current user' }, 404)

    const tenant = await supabase
      .from('tenants')
      .select(TENANT_SELECT_COLUMNS)
      .eq('id', tenantId)
      .maybeSingle()

    if (tenant.error || !tenant.data) {
      return c.json({ error: tenant.error?.message ?? 'Tenant not found' }, 404)
    }

    const normalizedTenant = normalizeTenantForResponse(tenant.data)
    const parsed = TenantSchema.safeParse(normalizedTenant)
    if (!parsed.success) {
      console.error('Failed to validate tenant payload:', parsed.error)
      return c.json(normalizedTenant)
    }
    return c.json(parsed.data)
  })

  app.get('/api/permissions/:tenantId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const url = new URL(c.req.url)
    const permission = url.searchParams.get('permission') ?? ''
    if (!permission) return c.json({ error: 'permission is required' }, 400)
    const check = await supabase.rpc('app_has_permission', { permission, tenant: tenantId })
    if (check.error) return c.json({ error: check.error.message }, 400)
    return c.json({ allowed: Boolean(check.data) })
  })

  app.put('/api/tenants/:id', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const id = c.req.param('id')

    const body = await c.req.json().catch(() => ({}))
    const parsed = TenantUpdateInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const updated = await supabase
      .from('tenants')
      .update(parsed.data)
      .eq('id', id)
      .select(TENANT_SELECT_COLUMNS)
      .single()

    if (updated.error || !updated.data) {
      return c.json({ error: updated.error?.message ?? 'Unable to update tenant' }, 400)
    }

    const normalizedTenant = normalizeTenantForResponse(updated.data)
    const out = TenantSchema.safeParse(normalizedTenant)
    if (!out.success) {
      console.error('Failed to validate updated tenant payload:', out.error)
      return c.json(normalizedTenant)
    }
    return c.json(out.data)
  })
}
