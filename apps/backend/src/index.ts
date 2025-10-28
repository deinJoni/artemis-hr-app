import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getCookie } from 'hono/cookie'
import { supabaseAdmin, supabaseForUser } from './lib/supabase'
import { AuditLogger, extractRequestInfo, findChanges } from './lib/audit-logger'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database, Json } from '@database.types.ts'
import type {
  ExampleChartPoint,
  ExampleChartResponse,
  ExampleTableRow,
  ExampleTableResponse,
} from '@vibe/shared'
import {
  TimeSummaryResponseSchema,
  CreateTimeOffRequestInputSchema,
  ApproveTimeOffRequestInputSchema,
  CalendarResponseSchema,
  // New time management schemas
  ManualTimeEntryInputSchema,
  TimeEntryUpdateInputSchema,
  TimeEntryApprovalInputSchema,
  TimeEntryListQuerySchema,
  TimeEntryListResponseSchema,
  OvertimeBalanceSchema,
  OvertimeRuleSchema,
  OvertimeCalculationRequestSchema,
  PendingApprovalsResponseSchema,
  TeamTimeSummaryResponseSchema,
  TimeExportRequestSchema,
  ManagerCalendarFilterSchema,
} from '@vibe/shared'
import {
  AccountBootstrapInputSchema,
  AccountBootstrapResponseSchema,
  CreateTenantInputSchema,
  CreateTenantResponseSchema,
  OnboardingStepPayloadSchema,
  OnboardingStepResponseSchema,
  TenantSchema,
  TenantUpdateInputSchema,
  MembershipListResponseSchema,
  MembershipCreateInputSchema,
  MembershipUpdateInputSchema,
  EmployeeListResponseSchema,
  EmployeeCreateInputSchema,
  EmployeeUpdateInputSchema,
  EmployeeSortColumnEnum,
  EmployeeDetailResponseSchema,
  EmployeeDocumentSchema,
  EmployeeManagerOptionSchema,
  EmployeeCustomFieldDefCreateSchema,
  EmployeeCustomFieldDefUpdateSchema,
  EmployeeCustomFieldDefSchema,
  type EmployeeCustomFieldType,
  type EmployeeDocument,
  // New HR schemas
  DepartmentSchema,
  DepartmentCreateInputSchema,
  DepartmentUpdateInputSchema,
  DepartmentListResponseSchema,
  DepartmentHierarchyResponseSchema,
  EmployeeAuditLogSchema,
  EmployeeAuditLogResponseSchema,
  EmployeeStatusHistorySchema,
  EmployeeStatusHistoryCreateInputSchema,
  CSVImportPreviewSchema,
  CSVImportConfirmSchema,
  CSVExportRequestSchema,
  CSVImportResultSchema,
  type Department,
  type DepartmentCreateInput,
  type DepartmentUpdateInput,
  type EmployeeAuditLog,
  type EmployeeStatusHistory,
  WorkflowListResponseSchema,
  WorkflowDetailResponseSchema,
  GoalCreateInputSchema,
  GoalUpdateInputSchema,
  GoalListResponseSchema,
  GoalSchema,
  GoalKeyResultSchema,
  GoalUpdateSchema,
  MyTeamResponseSchema,
  CheckInCreateInputSchema,
  CheckInUpdateInputSchema,
  CheckInHistoryResponseSchema,
  CheckInSchema,
  type Goal,
  type GoalKeyResult,
  type GoalUpdate,
  type CheckIn,
} from '@vibe/shared'
import {
  createWorkflowDraft,
  getWorkflowDetail,
  listWorkflowsForTenant,
  publishWorkflow,
  updateWorkflowDraft,
  WorkflowCreateInputSchema,
  WorkflowUpdateInputSchema,
} from './lib/workflows'

type Env = {
  Variables: {
    user: User
    userToken: string
    supabase: SupabaseClient<Database>
  }
}

const app = new Hono<Env>()

const TENANT_SELECT_COLUMNS =
  'id, name, created_at, company_name, company_location, company_size, contact_name, contact_email, contact_phone, needs_summary, key_priorities, onboarding_step, setup_completed, activated_at'

const TOTAL_ONBOARDING_STEPS = 3
const TENANT_NAME_MAX_LENGTH = 120
const DOCUMENT_BUCKET = 'employee-documents'

const sanitizeStorageFileName = (name: string) => {
  const withoutSeparators = name.replace(/[\\/]+/g, '_').trim()
  const normalized =
    typeof withoutSeparators.normalize === 'function'
      ? withoutSeparators.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      : withoutSeparators
  const safe = normalized.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_')
  const clipped = safe.slice(-200)
  return clipped.length > 0 ? clipped : 'document'
}

const buildDocumentStoragePath = (tenantId: string, employeeId: string, fileName: string) => {
  const unique =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${tenantId}/${employeeId}/${unique}-${fileName}`
}

const generateTenantSuffix = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `#${crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`
  }
  return `#${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

const buildTenantNameWithSuffix = (base: string, suffix: string) => {
  const trimmedBase = base.trim()
  const separator = trimmedBase.length > 0 ? ' ' : ''
  const usableLength = Math.max(
    1,
    TENANT_NAME_MAX_LENGTH - suffix.length - separator.length,
  )
  const clippedBase = trimmedBase.slice(0, usableLength)
  return `${clippedBase}${separator}${suffix}`.trim()
}

// CORS for dev (allow Authorization header from the frontend)
app.use('*', cors({ origin: '*', allowHeaders: ['authorization', 'content-type'] }))

// ---- Auth guard: verifies token once, attaches user + user-scoped client ----
const requireUser = async (c: any, next: any) => {
  const hdr = c.req.header('authorization')
  const fromHeader = hdr?.startsWith('Bearer ') ? hdr.slice(7) : undefined
  const fromCookie = getCookie(c, 'sb-access-token')
  const token = fromHeader || fromCookie
  if (!token) return c.text('Unauthorized', 401)

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return c.text('Unauthorized', 401)

  c.set('user', data.user)
  c.set('userToken', token)
  c.set('supabase', supabaseForUser(token)) // RLS enforced if you use DB later

  await next()
}

// ---- Public health check ----
app.get('/', (c) => c.text('Hello Hono!'))

// ---- Everything under /api requires login ----
app.use('/api/*', requireUser)

// Example: authenticated users get dummy data
app.get('/api/example/chart', (c) => {
  const chartData = [
    { month: 'Jan', users: 120 },
    { month: 'Feb', users: 160 },
    { month: 'Mar', users: 210 },
    { month: 'Apr', users: 190 },
    { month: 'May', users: 260 },
    { month: 'Jun', users: 300 },
  ] satisfies ExampleChartPoint[]
  return c.json({ chartData } satisfies ExampleChartResponse)
})

app.get('/api/example/table', (c) => {
  const tableData = [
    { id: '1', name: 'Acme Inc', email: 'contact@acme.com', plan: 'Pro' },
    { id: '2', name: 'Globex', email: 'hello@globex.com', plan: 'Business' },
    { id: '3', name: 'Initech', email: 'support@initech.io', plan: 'Starter' },
  ] satisfies ExampleTableRow[]
  return c.json({ tableData } satisfies ExampleTableResponse)
})

// Optional: a “who am I” endpoint
app.get('/api/me', (c) => {
  const user = c.get('user')
  return c.json({ id: user.id,
    email: user.email,
    name: user.user_metadata.name,
    tenant: user.user_metadata.tenant,
    role: user.user_metadata.role })
})

// Create tenant (authenticated users only)
app.post('/api/tenants', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = CreateTenantInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
  }

  const { name } = parsed.data
  const supabase = c.get('supabase') as SupabaseClient<Database>

  const { data, error } = await supabase.rpc('app_create_tenant', { p_name: name })
  if (error) {
    return c.json({ error: error.message }, 400)
  }

  const output = CreateTenantResponseSchema.safeParse(data)
  if (!output.success) {
    return c.json({ error: 'Unexpected response shape' }, 500)
  }
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
    typeof user.user_metadata?.full_name === 'string'
      ? (user.user_metadata.full_name as string)
      : undefined,
    typeof user.user_metadata?.display_name === 'string'
      ? (user.user_metadata.display_name as string)
      : undefined,
    user.email ? user.email.split('@')[0] : undefined,
  ].filter((value): value is string => Boolean(value && value.trim().length > 0))

  const fallbackDisplayName = metadataNameCandidates.length > 0
    ? metadataNameCandidates[0].trim()
    : 'Artemis member'

  const desiredDisplayName = (input.displayName ?? '').trim() || fallbackDisplayName
  const desiredTenantName =
    (input.tenantName ?? '').trim() || `${desiredDisplayName}'s Workspace`.trim()

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

  const ensureProfile = async (targetTenantId: string) => {
    const existingProfile = await supabase
      .from('profiles')
      .select('user_id, tenant_id, display_name, created_at, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingProfile.error) {
      throw new Error(existingProfile.error.message)
    }

    const currentProfile = existingProfile.data ?? null
    const nextDisplayName =
      (input.displayName ?? '').trim() || currentProfile?.display_name || fallbackDisplayName

    if (currentProfile) {
      if (
        currentProfile.tenant_id === targetTenantId &&
        currentProfile.display_name === nextDisplayName
      ) {
        return currentProfile
      }

      const updated = await supabaseAdmin
        .from('profiles')
        .update({ tenant_id: targetTenantId, display_name: nextDisplayName })
        .eq('user_id', user.id)
        .select('user_id, tenant_id, display_name, created_at, updated_at')
        .single()

      if (updated.error || !updated.data) {
        throw new Error(updated.error?.message ?? 'Unable to update profile')
      }

      return updated.data
    }

    const inserted = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: user.id,
        tenant_id: targetTenantId,
        display_name: nextDisplayName,
      })
      .select('user_id, tenant_id, display_name, created_at, updated_at')
      .single()

    if (inserted.error || !inserted.data) {
      throw new Error(inserted.error?.message ?? 'Unable to create profile')
    }

    return inserted.data
  }

  let tenantRecord: Database['public']['Tables']['tenants']['Row'] | null = null

  if (!tenantId) {
    const attemptTenantCreation = async () => {
      let nextName = desiredTenantName
      for (let attempt = 0; attempt < 5; attempt++) {
        const tenantCreation = await supabase.rpc('app_create_tenant', { p_name: nextName })
        if (!tenantCreation.error && tenantCreation.data) {
          return tenantCreation.data as Database['public']['Tables']['tenants']['Row']
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

    try {
      tenantRecord = await attemptTenantCreation()
      tenantId = tenantRecord.id
      created = true
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to create tenant'
      return c.json({ error: message }, 400)
    }
  }

  if (!tenantRecord && tenantId) {
    const tenantLookup = await supabase
      .from('tenants')
      .select(TENANT_SELECT_COLUMNS)
      .eq('id', tenantId)
      .maybeSingle()

    if (tenantLookup.error) {
      return c.json({ error: tenantLookup.error.message }, 400)
    }

    if (!tenantLookup.data) {
      const tenantFallback = await supabaseAdmin
        .from('tenants')
        .select(TENANT_SELECT_COLUMNS)
        .eq('id', tenantId)
        .maybeSingle()
      if (tenantFallback.error || !tenantFallback.data) {
        return c.json({ error: tenantFallback.error?.message ?? 'Tenant not found' }, 404)
      }
      tenantRecord = tenantFallback.data
    } else {
      tenantRecord = tenantLookup.data
    }
  }

  if (!tenantRecord || !tenantId) {
    return c.json({ error: 'Tenant resolution failed' }, 500)
  }

  let profileRecord
  try {
    profileRecord = await ensureProfile(tenantId)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to create profile'
    return c.json({ error: message }, 400)
  }

  const output = AccountBootstrapResponseSchema.safeParse({
    tenant: tenantRecord,
    profile: profileRecord,
    created,
  })

  if (!output.success) {
    return c.json({ error: 'Unexpected response shape' }, 500)
  }

  return c.json(output.data)
})

app.put('/api/onboarding/step', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>

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

  let tenantRecord = await supabase
    .from('tenants')
    .select(TENANT_SELECT_COLUMNS)
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantRecord.error) {
    return c.json({ error: tenantRecord.error.message }, 400)
  }

  let tenant = tenantRecord.data
  if (!tenant) {
    const fallback = await supabaseAdmin
      .from('tenants')
      .select(TENANT_SELECT_COLUMNS)
      .eq('id', tenantId)
      .maybeSingle()
    if (fallback.error || !fallback.data) {
      return c.json({ error: fallback.error?.message ?? 'Tenant not found' }, 404)
    }
    tenant = fallback.data
  }

  const payload = parsed.data

  const updateData: Database['public']['Tables']['tenants']['Update'] = {}

  if (payload.step === 1) {
    updateData.company_name = payload.companyName
    updateData.company_location = payload.companyLocation
    updateData.company_size = payload.companySize
  } else if (payload.step === 2) {
    updateData.contact_name = payload.contactName
    updateData.contact_email = payload.contactEmail
    updateData.contact_phone = payload.contactPhone
  } else if (payload.step === 3) {
    updateData.needs_summary = payload.needsSummary
    updateData.key_priorities = payload.keyPriorities
    updateData.setup_completed = true
    if (!tenant.activated_at) {
      updateData.activated_at = new Date().toISOString()
    }
  }

  const currentStep = tenant.onboarding_step ?? 0
  updateData.onboarding_step = Math.max(currentStep, payload.step)

  if (tenant.setup_completed) {
    updateData.setup_completed = tenant.setup_completed || updateData.setup_completed
    updateData.onboarding_step = Math.max(tenant.onboarding_step ?? 0, TOTAL_ONBOARDING_STEPS)
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

  const response = OnboardingStepResponseSchema.safeParse({ tenant: updated.data })
  if (!response.success) {
    return c.json({ error: 'Unexpected response shape' }, 500)
  }

  return c.json(response.data)
})

// ---------------- Tenant endpoints ----------------

// Get current user's primary tenant
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

  const parsed = TenantSchema.safeParse(tenant.data)
  if (!parsed.success) return c.json({ error: 'Unexpected response shape' }, 500)
  return c.json(parsed.data)
})

// Simple permission check helper endpoint
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

// Update tenant basic fields (RLS ensures only admins/owners can update)
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

  const out = TenantSchema.safeParse(updated.data)
  if (!out.success) return c.json({ error: 'Unexpected response shape' }, 500)
  return c.json(out.data)
})

// ---------------- Memberships endpoints ----------------

// Helper: ensure the current user has a specific permission in a tenant
async function ensurePermission(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  permission: string,
) {
  const check = await supabase.rpc('app_has_permission', { permission, tenant: tenantId })
  if (check.error) throw new Error(check.error.message)
  if (!check.data) throw new Error('Forbidden')
}

async function ensureOwnerRole(
  supabase: SupabaseClient<Database>,
  tenantId: string,
) {
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

  // Enrich with user email via Admin API
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
  if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)

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
        error instanceof Error ? error.message : 'Only workspace owners can assign the owner role'
      return c.json({ error: message }, 403)
    }
  }

  const inserted = await supabase
    .from('memberships')
    .insert({ tenant_id: tenantId, user_id: parsed.data.user_id, role: parsed.data.role })
  if (inserted.error) return c.json({ error: inserted.error.message }, 400)

  // Return fresh list
  return c.redirect(`/api/memberships/${tenantId}`)
})

app.put('/api/memberships/:tenantId/:userId', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')
  const userId = c.req.param('userId')
  const body = await c.req.json().catch(() => ({}))
  const parsed = MembershipUpdateInputSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)

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
        error instanceof Error ? error.message : 'Only workspace owners can assign the owner role'
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

// ---------------- Employees endpoints ----------------

app.get('/api/employees/:tenantId/:id', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')
  const employeeId = c.req.param('id')

  const canRead = await supabase.rpc('app_has_permission', { permission: 'employees.read', tenant: tenantId })
  if (canRead.error) return c.json({ error: canRead.error.message }, 400)
  if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

  const employee = await supabase
    .from('employees')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', employeeId)
    .maybeSingle()
  if (employee.error) return c.json({ error: employee.error.message }, 400)
  if (!employee.data) return c.json({ error: 'Employee not found' }, 404)

  const [fieldDefs, managerRows, canEdit, canManageDocs, canViewDocs, canViewAudit, canViewCompensation, canEditCompensation, canViewSensitive, canEditSensitive] = await Promise.all([
    supabase
      .from('employee_custom_field_defs')
      .select('id, tenant_id, name, key, type, required, options, position, created_at')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true }),
    supabase
      .from('employees')
      .select('id, name, email')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true }),
    supabase.rpc('app_has_permission', { permission: 'employees.write', tenant: tenantId }),
    supabase.rpc('app_has_permission', { permission: 'employees.documents.write', tenant: tenantId }),
    supabase.rpc('app_has_permission', { permission: 'employees.documents.read', tenant: tenantId }),
    supabase.rpc('app_has_permission', { permission: 'employees.audit.read', tenant: tenantId }),
    supabase.rpc('app_has_permission', { permission: 'employees.compensation.read', tenant: tenantId }),
    supabase.rpc('app_has_permission', { permission: 'employees.compensation.write', tenant: tenantId }),
    supabase.rpc('app_has_permission', { permission: 'employees.sensitive.read', tenant: tenantId }),
    supabase.rpc('app_has_permission', { permission: 'employees.sensitive.write', tenant: tenantId }),
  ])

  if (fieldDefs.error) return c.json({ error: fieldDefs.error.message }, 400)
  if (managerRows.error) return c.json({ error: managerRows.error.message }, 400)
  if (canEdit.error) return c.json({ error: canEdit.error.message }, 400)
  if (canManageDocs.error) return c.json({ error: canManageDocs.error.message }, 400)
  if (canViewDocs.error) return c.json({ error: canViewDocs.error.message }, 400)
  if (canViewAudit.error) return c.json({ error: canViewAudit.error.message }, 400)
  if (canViewCompensation.error) return c.json({ error: canViewCompensation.error.message }, 400)
  if (canEditCompensation.error) return c.json({ error: canEditCompensation.error.message }, 400)
  if (canViewSensitive.error) return c.json({ error: canViewSensitive.error.message }, 400)
  if (canEditSensitive.error) return c.json({ error: canEditSensitive.error.message }, 400)

  let documents: EmployeeDocument[] = []
  if (canViewDocs.data) {
    const docs = await supabase
      .from('employee_documents')
      .select(
        'id, tenant_id, employee_id, storage_path, file_name, mime_type, file_size, uploaded_by, uploaded_at, description',
      )
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .order('uploaded_at', { ascending: false })
    if (docs.error) return c.json({ error: docs.error.message }, 400)
    const parsedDocs = EmployeeDocumentSchema.array().safeParse(docs.data ?? [])
    if (!parsedDocs.success) return c.json({ error: 'Unexpected response shape' }, 500)
    documents = parsedDocs.data
  }

  // Fetch department information if employee has a department
  let department = null
  if (employee.data.department_id) {
    const dept = await supabase
      .from('departments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', employee.data.department_id)
      .maybeSingle()
    if (dept.error) return c.json({ error: dept.error.message }, 400)
    if (dept.data) {
      department = DepartmentSchema.parse(dept.data)
    }
  }

  // Fetch recent audit log entries if user has permission
  let auditLog: any[] = []
  if (canViewAudit.data) {
    const audit = await supabase
      .from('employee_audit_log')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(10)
    if (audit.error) return c.json({ error: audit.error.message }, 400)
    auditLog = audit.data || []
  }

  const managerOptions = (managerRows.data ?? []).map((row) => ({
    id: row.id,
    label: row.name?.length ? row.name : row.email,
  }))
  const parsedManagers = EmployeeManagerOptionSchema.array().safeParse(managerOptions)
  if (!parsedManagers.success) return c.json({ error: 'Unexpected response shape' }, 500)

  const payload = EmployeeDetailResponseSchema.safeParse({
    employee: employee.data,
    customFieldDefs: fieldDefs.data ?? [],
    documents,
    managerOptions: parsedManagers.data,
    department,
    auditLog: canViewAudit.data ? auditLog : undefined,
    permissions: {
      canEdit: Boolean(canEdit.data),
      canManageDocuments: Boolean(canManageDocs.data),
      canViewAuditLog: Boolean(canViewAudit.data),
      canViewCompensation: Boolean(canViewCompensation.data),
      canEditCompensation: Boolean(canEditCompensation.data),
      canViewSensitive: Boolean(canViewSensitive.data),
      canEditSensitive: Boolean(canEditSensitive.data),
    },
  })
  if (!payload.success) return c.json({ error: 'Unexpected response shape' }, 500)
  return c.json(payload.data)
})

app.get('/api/employees/:tenantId/:id/documents', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')
  const employeeId = c.req.param('id')

  const canRead = await supabase.rpc('app_has_permission', { permission: 'employees.documents.read', tenant: tenantId })
  if (canRead.error) return c.json({ error: canRead.error.message }, 400)
  if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

  const docs = await supabase
    .from('employee_documents')
    .select(
      'id, tenant_id, employee_id, storage_path, file_name, mime_type, file_size, uploaded_by, uploaded_at, description',
    )
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .order('uploaded_at', { ascending: false })
  if (docs.error) return c.json({ error: docs.error.message }, 400)

  const parsed = EmployeeDocumentSchema.array().safeParse(docs.data ?? [])
  if (!parsed.success) return c.json({ error: 'Unexpected response shape' }, 500)
  return c.json({ documents: parsed.data })
})

app.post('/api/employees/:tenantId/:id/documents', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')
  const employeeId = c.req.param('id')
  const user = c.get('user') as User

  const canWrite = await supabase.rpc('app_has_permission', { permission: 'employees.documents.write', tenant: tenantId })
  if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
  if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)

  const body = await c.req.parseBody()
  const rawFile = body.file
  const file =
    rawFile instanceof File
      ? rawFile
      : Array.isArray(rawFile)
        ? rawFile.find((item) => item instanceof File)
        : null
  if (!file) return c.json({ error: 'File is required' }, 400)

  const originalName = file.name && file.name.length > 0 ? file.name : 'document'
  const safeName = sanitizeStorageFileName(originalName)
  const storagePath = buildDocumentStoragePath(tenantId, employeeId, safeName)
  const description =
    typeof body.description === 'string' && body.description.trim().length > 0
      ? body.description.trim()
      : null

  const upload = await supabaseAdmin.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    })
  if (upload.error) return c.json({ error: upload.error.message }, 400)

  const insertPayload: Database['public']['Tables']['employee_documents']['Insert'] = {
    tenant_id: tenantId,
    employee_id: employeeId,
    storage_path: storagePath,
    file_name: safeName,
    mime_type: file.type || 'application/octet-stream',
    file_size: file.size,
    uploaded_by: user.id,
    description,
  }

  const inserted = await supabase
    .from('employee_documents')
    .insert(insertPayload)
    .select(
      'id, tenant_id, employee_id, storage_path, file_name, mime_type, file_size, uploaded_by, uploaded_at, description',
    )
    .single()

  if (inserted.error || !inserted.data) {
    await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove([storagePath]).catch(() => undefined)
    return c.json({ error: inserted.error?.message ?? 'Unable to save document metadata' }, 400)
  }

  const parsed = EmployeeDocumentSchema.safeParse(inserted.data)
  if (!parsed.success) return c.json({ error: 'Unexpected response shape' }, 500)
  return c.json(parsed.data, 201)
})

// Download a document via signed URL (redirect)
app.get('/api/employees/:tenantId/:id/documents/:docId/download', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')
  const employeeId = c.req.param('id')
  const docId = c.req.param('docId')

  const canRead = await supabase.rpc('app_has_permission', { permission: 'employees.documents.read', tenant: tenantId })
  if (canRead.error) return c.json({ error: canRead.error.message }, 400)
  if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

  const existing = await supabase
    .from('employee_documents')
    .select('id, tenant_id, employee_id, storage_path, file_name')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('id', docId)
    .maybeSingle()
  if (existing.error) return c.json({ error: existing.error.message }, 400)
  if (!existing.data) return c.json({ error: 'Document not found' }, 404)

  const signedUrlRes = await supabaseAdmin.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(existing.data.storage_path, 60)
  if (signedUrlRes.error || !signedUrlRes.data?.signedUrl) {
    return c.json({ error: signedUrlRes.error?.message ?? 'Unable to create signed URL' }, 400)
  }

  return c.redirect(signedUrlRes.data.signedUrl, 302)
})

// Hard delete a document (row + storage object)
app.delete('/api/employees/:tenantId/:id/documents/:docId', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')
  const employeeId = c.req.param('id')
  const docId = c.req.param('docId')

  const canWrite = await supabase.rpc('app_has_permission', { permission: 'employees.documents.write', tenant: tenantId })
  if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
  if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)

  const existing = await supabase
    .from('employee_documents')
    .select('id, tenant_id, employee_id, storage_path')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('id', docId)
    .maybeSingle()
  if (existing.error) return c.json({ error: existing.error.message }, 400)
  if (!existing.data) return c.json({ error: 'Document not found' }, 404)

  const del = await supabase
    .from('employee_documents')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('id', docId)
  if (del.error) return c.json({ error: del.error.message }, 400)

  // Attempt storage removal (best-effort)
  await supabaseAdmin.storage
    .from(DOCUMENT_BUCKET)
    .remove([existing.data.storage_path])
    .catch(() => undefined)

  return c.json({ ok: true })
})

app.get('/api/employees/:tenantId', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')

  const url = new URL(c.req.url)
  const pageParam = Number.parseInt(url.searchParams.get('page') ?? '1', 10)
  const rawPageSize = Number.parseInt(url.searchParams.get('pageSize') ?? '10', 10)
  const requestedSort = url.searchParams.get('sort') ?? 'created_at'
  const requestedOrder = url.searchParams.get('order') ?? 'desc'
  const rawSearch = url.searchParams.get('search') ?? ''

  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const pageSize = Number.isFinite(rawPageSize)
    ? Math.min(Math.max(rawPageSize, 1), 100)
    : 10
  const allowedSortColumns = EmployeeSortColumnEnum.options as readonly string[]
  const sortColumn = allowedSortColumns.includes(requestedSort)
    ? (requestedSort as (typeof allowedSortColumns)[number])
    : 'created_at'
  const sortOrder = requestedOrder === 'asc' ? 'asc' : 'desc'
  const search = rawSearch.trim()
  const rangeStart = (page - 1) * pageSize
  const rangeEnd = rangeStart + pageSize - 1

  const escapeLike = (value: string) =>
    value.replace(/[%_\\]/g, (char) => `\\${char}`)

  // Optional explicit permission check
  const canRead = await supabase.rpc('app_has_permission', { permission: 'employees.read', tenant: tenantId })
  if (canRead.error) return c.json({ error: canRead.error.message }, 400)
  if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

  let query = supabase
    .from('employees')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)

  if (search.length > 0) {
    const term = escapeLike(search)
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`)
  }

  const rows = await query
    .order(sortColumn, { ascending: sortOrder === 'asc' })
    .range(rangeStart, rangeEnd)
  if (rows.error) return c.json({ error: rows.error.message }, 400)

  const parsed = EmployeeListResponseSchema.safeParse({
    employees: rows.data ?? [],
    pagination: {
      page,
      pageSize,
      total: rows.count ?? 0,
    },
    sort: {
      column: sortColumn,
      order: sortOrder,
    },
    search,
  })
  if (!parsed.success) return c.json({ error: 'Unexpected response shape' }, 500)
  return c.json(parsed.data)
})

app.post('/api/employees/:tenantId', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')
  const body = await c.req.json().catch(() => ({}))
  const parsed = EmployeeCreateInputSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
  if (parsed.data.tenant_id !== tenantId) return c.json({ error: 'tenant_id mismatch' }, 400)

  const canWrite = await supabase.rpc('app_has_permission', { permission: 'employees.write', tenant: tenantId })
  if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
  if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)

  // 1) Create/auth invite user so they can login
  // Use service role to invite the user by email. This sends an invite email (if SMTP configured)
  // and returns the user id needed to create membership and profile.
  const invite = await supabaseAdmin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { display_name: parsed.data.name },
  })
  if (invite.error) {
    // If the user already exists, fail fast for now to avoid creating orphaned employee rows
    // A follow-up endpoint could attach existing users by email.
    return c.json({ error: invite.error.message || 'Unable to invite user' }, 400)
  }
  const newUserId = invite.data.user?.id
  if (!newUserId) return c.json({ error: 'User creation failed: missing id' }, 500)

  // 2) Add membership so the invited user has access to the tenant
  const memberIns = await supabaseAdmin
    .from('memberships')
    .insert({ user_id: newUserId, tenant_id: tenantId, role: 'employee' })
  if (memberIns.error) return c.json({ error: memberIns.error.message }, 400)

  // 3) Create profile with display name for the user
  const profileIns = await supabaseAdmin
    .from('profiles')
    .insert({ user_id: newUserId, tenant_id: tenantId, display_name: parsed.data.name })
  if (profileIns.error) return c.json({ error: profileIns.error.message }, 400)

  // Validate custom_fields against field definitions
  const validatedCustomFields = await validateAndCoerceCustomFields(supabase, tenantId, parsed.data.custom_fields)
  const insertPayload: Database['public']['Tables']['employees']['Insert'] = {
    tenant_id: parsed.data.tenant_id,
    email: parsed.data.email,
    name: parsed.data.name,
    manager_id: parsed.data.manager_id ?? null,
    custom_fields: validatedCustomFields ?? null,
  }

  const ins = await supabase
    .from('employees')
    .insert(insertPayload)
    .select()
    .single()
  if (ins.error) return c.json({ error: ins.error.message }, 400)

  // Log employee creation in audit trail
  const user = c.get('user') as User
  const { ipAddress, userAgent } = extractRequestInfo(c.req)
  const auditLogger = new AuditLogger(supabase)
  await auditLogger.logEmployeeCreation(
    tenantId,
    ins.data.id,
    user.id,
    insertPayload,
    ipAddress,
    userAgent
  )

  return c.redirect(`/api/employees/${tenantId}`)
})

app.put('/api/employees/:tenantId/:id', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const parsed = EmployeeUpdateInputSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)

  const canWrite = await supabase.rpc('app_has_permission', { permission: 'employees.write', tenant: tenantId })
  if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
  if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)

  // Get current employee data for audit comparison
  const currentEmployee = await supabase
    .from('employees')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle()
  if (currentEmployee.error) return c.json({ error: currentEmployee.error.message }, 400)
  if (!currentEmployee.data) return c.json({ error: 'Employee not found' }, 404)

  // If custom_fields present, validate and coerce
  let updatePayload: Database['public']['Tables']['employees']['Update'] = { ...parsed.data }
  if ('custom_fields' in parsed.data) {
    const validated = await validateAndCoerceCustomFields(supabase, tenantId, parsed.data.custom_fields)
    updatePayload.custom_fields = validated ?? null
  }

  const upd = await supabase
    .from('employees')
    .update(updatePayload)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()
  if (upd.error) return c.json({ error: upd.error.message }, 400)

  // Log employee update in audit trail
  const user = c.get('user') as User
  const { ipAddress, userAgent } = extractRequestInfo(c.req)
  const auditLogger = new AuditLogger(supabase)
  
  // Find changes between old and new data
  const changes = findChanges(currentEmployee.data, upd.data)
  if (Object.keys(changes).length > 0) {
    await auditLogger.logEmployeeUpdate(
      tenantId,
      id,
      user.id,
      changes,
      undefined, // change reason - could be added to the API
      ipAddress,
      userAgent
    )
  }

  return c.redirect(`/api/employees/${tenantId}`)
})

app.delete('/api/employees/:tenantId/:id', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')
  const id = c.req.param('id')

  const canWrite = await supabase.rpc('app_has_permission', { permission: 'employees.write', tenant: tenantId })
  if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
  if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)

  const del = await supabase
    .from('employees')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (del.error) return c.json({ error: del.error.message }, 400)

  return c.redirect(`/api/employees/${tenantId}`)
})

// ---------------- Department endpoints ----------------

// Get all departments for a tenant
app.get('/api/departments/:tenantId', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')

  const canRead = await supabase.rpc('app_has_permission', { permission: 'departments.read', tenant: tenantId })
  if (canRead.error) return c.json({ error: canRead.error.message }, 400)
  if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

  const url = new URL(c.req.url)
  const pageParam = Number.parseInt(url.searchParams.get('page') ?? '1', 10)
  const rawPageSize = Number.parseInt(url.searchParams.get('pageSize') ?? '50', 10)
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const pageSize = Number.isFinite(rawPageSize) ? Math.min(Math.max(rawPageSize, 1), 100) : 50
  const rangeStart = (page - 1) * pageSize
  const rangeEnd = rangeStart + pageSize - 1

  const departments = await supabase
    .from('departments')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true })
    .range(rangeStart, rangeEnd)

  if (departments.error) return c.json({ error: departments.error.message }, 400)

  const response = DepartmentListResponseSchema.parse({
    departments: departments.data || [],
    pagination: {
      page,
      pageSize,
      total: departments.count || 0,
    },
  })

  return c.json(response)
})

// Get department hierarchy tree
app.get('/api/departments/:tenantId/tree', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')

  const canRead = await supabase.rpc('app_has_permission', { permission: 'departments.read', tenant: tenantId })
  if (canRead.error) return c.json({ error: canRead.error.message }, 400)
  if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

  const hierarchy = await supabase
    .from('department_hierarchy')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('level', { ascending: true })
    .order('name', { ascending: true })

  if (hierarchy.error) return c.json({ error: hierarchy.error.message }, 400)

  const response = DepartmentHierarchyResponseSchema.parse({
    departments: hierarchy.data || [],
  })

  return c.json(response)
})

// Get single department
app.get('/api/departments/:tenantId/:id', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')
  const departmentId = c.req.param('id')

  const canRead = await supabase.rpc('app_has_permission', { permission: 'departments.read', tenant: tenantId })
  if (canRead.error) return c.json({ error: canRead.error.message }, 400)
  if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

  const department = await supabase
    .from('departments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', departmentId)
    .maybeSingle()

  if (department.error) return c.json({ error: department.error.message }, 400)
  if (!department.data) return c.json({ error: 'Department not found' }, 404)

  return c.json(DepartmentSchema.parse(department.data))
})

// Create department
app.post('/api/departments/:tenantId', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')
  const body = await c.req.json().catch(() => ({}))
  const parsed = DepartmentCreateInputSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
  if (parsed.data.tenant_id !== tenantId) return c.json({ error: 'tenant_id mismatch' }, 400)

  const canManage = await supabase.rpc('app_has_permission', { permission: 'departments.manage', tenant: tenantId })
  if (canManage.error) return c.json({ error: canManage.error.message }, 400)
  if (!canManage.data) return c.json({ error: 'Forbidden' }, 403)

  const department = await supabase
    .from('departments')
    .insert(parsed.data)
    .select()
    .single()

  if (department.error) return c.json({ error: department.error.message }, 400)

  return c.json(DepartmentSchema.parse(department.data))
})

// Update department
app.put('/api/departments/:tenantId/:id', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')
  const departmentId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const parsed = DepartmentUpdateInputSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)

  const canManage = await supabase.rpc('app_has_permission', { permission: 'departments.manage', tenant: tenantId })
  if (canManage.error) return c.json({ error: canManage.error.message }, 400)
  if (!canManage.data) return c.json({ error: 'Forbidden' }, 403)

  const department = await supabase
    .from('departments')
    .update(parsed.data)
    .eq('tenant_id', tenantId)
    .eq('id', departmentId)
    .select()
    .single()

  if (department.error) return c.json({ error: department.error.message }, 400)

  return c.json(DepartmentSchema.parse(department.data))
})

// Delete department
app.delete('/api/departments/:tenantId/:id', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')
  const departmentId = c.req.param('id')

  const canManage = await supabase.rpc('app_has_permission', { permission: 'departments.manage', tenant: tenantId })
  if (canManage.error) return c.json({ error: canManage.error.message }, 400)
  if (!canManage.data) return c.json({ error: 'Forbidden' }, 403)

  // Check if department has employees
  const employees = await supabase
    .from('employees')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('department_id', departmentId)
    .limit(1)

  if (employees.error) return c.json({ error: employees.error.message }, 400)
  if (employees.data && employees.data.length > 0) {
    return c.json({ error: 'Cannot delete department with employees. Please reassign employees first.' }, 400)
  }

  // Check if department has child departments
  const children = await supabase
    .from('departments')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('parent_id', departmentId)
    .limit(1)

  if (children.error) return c.json({ error: children.error.message }, 400)
  if (children.data && children.data.length > 0) {
    return c.json({ error: 'Cannot delete department with child departments. Please delete or reassign child departments first.' }, 400)
  }

  const department = await supabase
    .from('departments')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', departmentId)

  if (department.error) return c.json({ error: department.error.message }, 400)

  return c.json({ ok: true })
})

// ---------------- Employee Audit Log endpoints ----------------

// Get employee audit log
app.get('/api/employees/:tenantId/:employeeId/audit-log', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')
  const employeeId = c.req.param('employeeId')

  const canRead = await supabase.rpc('app_has_permission', { permission: 'employees.audit.read', tenant: tenantId })
  if (canRead.error) return c.json({ error: canRead.error.message }, 400)
  if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

  const url = new URL(c.req.url)
  const pageParam = Number.parseInt(url.searchParams.get('page') ?? '1', 10)
  const rawPageSize = Number.parseInt(url.searchParams.get('pageSize') ?? '20', 10)
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const pageSize = Number.isFinite(rawPageSize) ? Math.min(Math.max(rawPageSize, 1), 100) : 20
  const rangeStart = (page - 1) * pageSize
  const rangeEnd = rangeStart + pageSize - 1

  const auditLog = await supabase
    .from('employee_audit_log')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .range(rangeStart, rangeEnd)

  if (auditLog.error) return c.json({ error: auditLog.error.message }, 400)

  const response = EmployeeAuditLogResponseSchema.parse({
    auditLog: auditLog.data || [],
    pagination: {
      page,
      pageSize,
      total: auditLog.count || 0,
    },
  })

  return c.json(response)
})

// Compare audit log entries
app.get('/api/employees/:tenantId/:employeeId/audit-log/compare/:logId', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')
  const employeeId = c.req.param('employeeId')
  const logId = c.req.param('logId')

  const canRead = await supabase.rpc('app_has_permission', { permission: 'employees.audit.read', tenant: tenantId })
  if (canRead.error) return c.json({ error: canRead.error.message }, 400)
  if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

  // Get the specific audit log entry
  const auditEntry = await supabase
    .from('employee_audit_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('id', logId)
    .maybeSingle()

  if (auditEntry.error) return c.json({ error: auditEntry.error.message }, 400)
  if (!auditEntry.data) return c.json({ error: 'Audit log entry not found' }, 404)

  return c.json(EmployeeAuditLogSchema.parse(auditEntry.data))
})

// ---------------- CSV Import/Export endpoints ----------------

// CSV Import Preview
app.post('/api/employees/:tenantId/import/preview', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')

  const canImport = await supabase.rpc('app_has_permission', { permission: 'employees.import', tenant: tenantId })
  if (canImport.error) return c.json({ error: canImport.error.message }, 400)
  if (!canImport.data) return c.json({ error: 'Forbidden' }, 403)

  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    if (!file) return c.json({ error: 'No file provided' }, 400)

    const csvText = await file.text()
    const lines = csvText.split('\n').filter(line => line.trim())
    if (lines.length < 2) return c.json({ error: 'CSV must have at least a header and one data row' }, 400)

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const dataRows = lines.slice(1).map((line, index) => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      const row: Record<string, string> = {}
      headers.forEach((header, i) => {
        row[header] = values[i] || ''
      })
      return { row: index + 2, data: row }
    })

    // Basic field mapping (can be enhanced)
    const fieldMapping: Record<string, string> = {
      'name': 'name',
      'email': 'email',
      'employee_number': 'employee_number',
      'job_title': 'job_title',
      'department': 'department_name',
      'manager_email': 'manager_email',
      'phone': 'phone_work',
      'start_date': 'start_date',
      'employment_type': 'employment_type',
      'work_location': 'work_location',
      'status': 'status'
    }

    const validRows: Record<string, any>[] = []
    const invalidRows: Array<{ row: number; data: Record<string, any>; errors: string[] }> = []

    for (const { row, data } of dataRows) {
      const errors: string[] = []
      
      // Validate required fields
      if (!data.name?.trim()) errors.push('Name is required')
      if (!data.email?.trim()) errors.push('Email is required')
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push('Invalid email format')
      }

      if (errors.length > 0) {
        invalidRows.push({ row, data, errors })
      } else {
        validRows.push(data)
      }
    }

    const response = CSVImportPreviewSchema.parse({
      validRows,
      invalidRows,
      fieldMapping,
      totalRows: dataRows.length
    })

    return c.json(response)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to process CSV file'
    return c.json({ error: message }, 400)
  }
})

// CSV Import Confirm
app.post('/api/employees/:tenantId/import/confirm', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')

  const canImport = await supabase.rpc('app_has_permission', { permission: 'employees.import', tenant: tenantId })
  if (canImport.error) return c.json({ error: canImport.error.message }, 400)
  if (!canImport.data) return c.json({ error: 'Forbidden' }, 403)

  try {
    const body = await c.req.json()
    const parsed = CSVImportConfirmSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)

    const { validRows, fieldMapping } = parsed.data
    const user = c.get('user') as User
    const { ipAddress, userAgent } = extractRequestInfo(c.req)
    const auditLogger = new AuditLogger(supabase)

    let created = 0
    let updated = 0
    const errors: string[] = []
    const warnings: string[] = []

    for (const rowData of validRows) {
      try {
        // Map CSV data to employee fields
        const employeeData: any = {
          tenant_id: tenantId,
          name: rowData.name?.trim(),
          email: rowData.email?.trim(),
          employee_number: rowData.employee_number?.trim() || null,
          job_title: rowData.job_title?.trim() || null,
          phone_work: rowData.phone?.trim() || null,
          start_date: rowData.start_date?.trim() || null,
          employment_type: rowData.employment_type?.trim() || null,
          work_location: rowData.work_location?.trim() || null,
          status: rowData.status?.trim() || 'active'
        }

        // Handle department lookup
        if (rowData.department_name?.trim()) {
          const dept = await supabase
            .from('departments')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('name', rowData.department_name.trim())
            .maybeSingle()
          
          if (dept.data) {
            employeeData.department_id = dept.data.id
          } else {
            warnings.push(`Department "${rowData.department_name}" not found for employee ${rowData.name}`)
          }
        }

        // Handle manager lookup
        if (rowData.manager_email?.trim()) {
          const manager = await supabase
            .from('employees')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('email', rowData.manager_email.trim())
            .maybeSingle()
          
          if (manager.data) {
            employeeData.manager_id = manager.data.id
          } else {
            warnings.push(`Manager with email "${rowData.manager_email}" not found for employee ${rowData.name}`)
          }
        }

        // Check if employee already exists
        const existing = await supabase
          .from('employees')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('email', employeeData.email)
          .maybeSingle()

        if (existing.data) {
          // Update existing employee
          const updateResult = await supabase
            .from('employees')
            .update(employeeData)
            .eq('id', existing.data.id)
            .select()
            .single()

          if (updateResult.error) {
            errors.push(`Failed to update employee ${employeeData.name}: ${updateResult.error.message}`)
            continue
          }

          // Log the update
          await auditLogger.logEmployeeUpdate(
            tenantId,
            existing.data.id,
            user.id,
            employeeData,
            ipAddress,
            userAgent,
            'Bulk import update'
          )

          updated++
        } else {
          // Create new employee
          // First create user account
          const invite = await supabaseAdmin.auth.admin.inviteUserByEmail(employeeData.email, {
            data: { display_name: employeeData.name },
          })
          if (invite.error) {
            errors.push(`Failed to create user account for ${employeeData.name}: ${invite.error.message}`)
            continue
          }
          const newUserId = invite.data.user?.id
          if (!newUserId) {
            errors.push(`User creation failed for ${employeeData.name}: missing user ID`)
            continue
          }

          // Add membership
          const memberIns = await supabaseAdmin
            .from('memberships')
            .insert({ user_id: newUserId, tenant_id: tenantId, role: 'employee' })
          if (memberIns.error) {
            errors.push(`Failed to add membership for ${employeeData.name}: ${memberIns.error.message}`)
            continue
          }

          // Create profile
          const profileIns = await supabaseAdmin
            .from('profiles')
            .insert({ user_id: newUserId, tenant_id: tenantId, display_name: employeeData.name })
          if (profileIns.error) {
            errors.push(`Failed to create profile for ${employeeData.name}: ${profileIns.error.message}`)
            continue
          }

          // Create employee record
          const createResult = await supabase
            .from('employees')
            .insert(employeeData)
            .select()
            .single()

          if (createResult.error) {
            errors.push(`Failed to create employee ${employeeData.name}: ${createResult.error.message}`)
            continue
          }

          // Log the creation
          await auditLogger.logEmployeeCreation(
            tenantId,
            createResult.data.id,
            user.id,
            employeeData,
            ipAddress,
            userAgent
          )

          created++
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Error processing employee ${rowData.name}: ${message}`)
      }
    }

    const response = CSVImportResultSchema.parse({
      success: errors.length === 0,
      created,
      updated,
      errors,
      warnings
    })

    return c.json(response)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to process import'
    return c.json({ error: message }, 400)
  }
})

// CSV Export
app.get('/api/employees/:tenantId/export', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')

  const canRead = await supabase.rpc('app_has_permission', { permission: 'employees.read', tenant: tenantId })
  if (canRead.error) return c.json({ error: canRead.error.message }, 400)
  if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

  try {
    const url = new URL(c.req.url)
    const departmentId = url.searchParams.get('departmentId')
    const status = url.searchParams.get('status')
    const includeSensitive = url.searchParams.get('includeSensitive') === 'true'
    const format = url.searchParams.get('format') || 'csv'

    // Build query
    let query = supabase
      .from('employees')
      .select(`
        *,
        departments(name),
        manager:employees!manager_id(name, email)
      `)
      .eq('tenant_id', tenantId)

    if (departmentId) query = query.eq('department_id', departmentId)
    if (status) query = query.eq('status', status)

    const { data: employees, error } = await query

    if (error) return c.json({ error: error.message }, 400)

    // Generate CSV
    const headers = [
      'name',
      'email',
      'employee_number',
      'job_title',
      'department',
      'manager_name',
      'manager_email',
      'phone_work',
      'start_date',
      'employment_type',
      'work_location',
      'status',
      'created_at'
    ]

    if (includeSensitive) {
      headers.push('salary_amount', 'salary_currency', 'salary_frequency')
    }

    const csvRows = employees?.map(emp => [
      emp.name || '',
      emp.email || '',
      emp.employee_number || '',
      emp.job_title || '',
      (emp.departments as any)?.name || '',
      (emp.manager as any)?.name || '',
      (emp.manager as any)?.email || '',
      emp.phone_work || '',
      emp.start_date || '',
      emp.employment_type || '',
      emp.work_location || '',
      emp.status || '',
      emp.created_at || '',
      ...(includeSensitive ? [
        emp.salary_amount || '',
        emp.salary_currency || '',
        emp.salary_frequency || ''
      ] : [])
    ]) || []

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const filename = `employees_export_${new Date().toISOString().split('T')[0]}.csv`

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to export employees'
    return c.json({ error: message }, 400)
  }
})

// ---------------- Workflows endpoints ----------------

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

// ---------------- Performance & Goals Endpoints ----------------

app.get('/api/my-team', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const user = c.get('user') as User

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  let hasManagerPermission = false
  try {
    hasManagerPermission = await hasPermission(supabase, tenantId, 'check_ins.read')
  } catch (error: unknown) {
    return c.json({ error: error instanceof Error ? error.message : 'Permission check failed' }, 400)
  }

  const viewerEmployee = await getEmployeeForUser(supabase, tenantId, user)
  if (!hasManagerPermission && !viewerEmployee) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  let employeeQuery = supabase
    .from('employees')
    .select('id, tenant_id, name, email, manager_id')
    .eq('tenant_id', tenantId)

  if (viewerEmployee) {
    employeeQuery = employeeQuery.eq('manager_id', viewerEmployee.id)
  }

  const employees = await employeeQuery.order('name', { ascending: true })
  if (employees.error) {
    return c.json({ error: employees.error.message }, 400)
  }

  const teamRows = employees.data ?? []
  const teamIds = teamRows.map((row) => row.id)

  const goalStats = new Map<
    string,
    {
      total: number
      completed: number
      active: number
      progressSum: number
      progressCount: number
    }
  >()
  const lastCheckInByEmployee = new Map<string, string | null>()

  if (teamIds.length > 0) {
    const goalsRes = await supabase
      .from('goals')
      .select('employee_id, status, progress_pct')
      .eq('tenant_id', tenantId)
      .in('employee_id', teamIds)

    if (goalsRes.error) {
      return c.json({ error: goalsRes.error.message }, 400)
    }

    for (const row of goalsRes.data ?? []) {
      const employeeId = row.employee_id
      const status = row.status
      const progress = typeof row.progress_pct === 'number'
        ? row.progress_pct
        : Number(row.progress_pct ?? 0)

      const current = goalStats.get(employeeId) ?? {
        total: 0,
        completed: 0,
        active: 0,
        progressSum: 0,
        progressCount: 0,
      }
      current.total += 1
      if (status === 'completed') {
        current.completed += 1
      } else {
        current.active += 1
      }
      if (!Number.isNaN(progress)) {
        current.progressSum += progress
        current.progressCount += 1
      }
      goalStats.set(employeeId, current)
    }

    const checkInsRes = await supabase
      .from('check_ins')
      .select('employee_id, completed_at')
      .eq('tenant_id', tenantId)
      .in('employee_id', teamIds)
      .eq('status', 'completed')

    if (checkInsRes.error) {
      return c.json({ error: checkInsRes.error.message }, 400)
    }

    for (const row of checkInsRes.data ?? []) {
      if (!row.completed_at) continue
      const existing = lastCheckInByEmployee.get(row.employee_id)
      if (!existing || existing < row.completed_at) {
        lastCheckInByEmployee.set(row.employee_id, row.completed_at)
      }
    }
  }

  const team = teamRows.map((employee) => {
    const summary = goalStats.get(employee.id)
    const avgProgressPct =
      summary && summary.progressCount > 0
        ? Math.round((summary.progressSum / summary.progressCount) * 100) / 100
        : 0
    return {
      employeeId: employee.id,
      employeeName: employee.name,
      employeeEmail: employee.email ?? null,
      avatarUrl: null,
      managerEmployeeId: employee.manager_id ?? null,
      totalGoals: summary?.total ?? 0,
      completedGoals: summary?.completed ?? 0,
      activeGoals: summary?.active ?? 0,
      avgProgressPct,
      lastCheckInAt: lastCheckInByEmployee.get(employee.id) ?? null,
    }
  })

  const parsed = MyTeamResponseSchema.safeParse({ team })
  if (!parsed.success) {
    return c.json({ error: 'Unexpected response shape' }, 500)
  }

  return c.json(parsed.data)
})

app.get('/api/goals/me', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const user = c.get('user') as User

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  const viewerEmployee = await getEmployeeForUser(supabase, tenantId, user)
  if (!viewerEmployee) {
    return c.json({ error: 'Employee record not found' }, 404)
  }

  let goals: Goal[]
  try {
    goals = await fetchGoalsForEmployee(supabase, viewerEmployee.id)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to load goals'
    return c.json({ error: message }, 400)
  }

  const parsed = GoalListResponseSchema.safeParse({ goals })
  if (!parsed.success) {
    return c.json({ error: 'Unexpected response shape' }, 500)
  }
  return c.json(parsed.data)
})

app.get('/api/my-team/:employeeId/goals', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const user = c.get('user') as User
  const employeeId = c.req.param('employeeId')

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  let employee: EmployeeRow | null
  try {
    employee = await getEmployeeById(supabase, employeeId)
  } catch (error: unknown) {
    return c.json({ error: error instanceof Error ? error.message : 'Unable to fetch employee' }, 400)
  }

  if (!employee || employee.tenant_id !== tenantId) {
    return c.json({ error: 'Employee not found' }, 404)
  }

  try {
    await assertGoalReadAccess(supabase, tenantId, user, employee)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
  }

  let goals: Goal[]
  try {
    goals = await fetchGoalsForEmployee(supabase, employee.id)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to load goals'
    return c.json({ error: message }, 400)
  }

  const parsed = GoalListResponseSchema.safeParse({ goals })
  if (!parsed.success) {
    return c.json({ error: 'Unexpected response shape' }, 500)
  }
  return c.json(parsed.data)
})

app.post('/api/goals', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const user = c.get('user') as User

  const body = await c.req.json().catch(() => ({}))
  const parsed = GoalCreateInputSchema.safeParse(body)
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

  if (parsed.data.tenantId !== tenantId) {
    return c.json({ error: 'tenantId mismatch' }, 400)
  }

  let employee: EmployeeRow | null
  try {
    employee = await getEmployeeById(supabase, parsed.data.employeeId)
  } catch (error: unknown) {
    return c.json({ error: error instanceof Error ? error.message : 'Unable to fetch employee' }, 400)
  }

  if (!employee || employee.tenant_id !== tenantId) {
    return c.json({ error: 'Employee not found' }, 404)
  }

  try {
    await assertGoalWriteAccess(supabase, tenantId, user, employee)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
  }

  const insertPayload: Database['public']['Tables']['goals']['Insert'] = {
    tenant_id: tenantId,
    employee_id: parsed.data.employeeId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    status: parsed.data.status ?? 'todo',
    progress_pct: clampProgress(parsed.data.progressPct),
    due_date: parsed.data.dueDate ?? null,
    created_by: user.id,
    updated_by: user.id,
  }

  const inserted = await supabase
    .from('goals')
    .insert(insertPayload)
    .select('id')
    .single()

  if (inserted.error || !inserted.data) {
    return c.json({ error: inserted.error?.message ?? 'Unable to create goal' }, 400)
  }

  if (Array.isArray(parsed.data.keyResults) && parsed.data.keyResults.length > 0) {
    const keyResultsInsert = parsed.data.keyResults.map((kr) => ({
      goal_id: inserted.data.id,
      label: kr.label,
      target_value: kr.targetValue ?? null,
      current_value: kr.currentValue ?? null,
      status: kr.status ?? 'pending',
    }))

    const keyResultIns = await supabase.from('goal_key_results').insert(keyResultsInsert)
    if (keyResultIns.error) {
      return c.json({ error: keyResultIns.error.message }, 400)
    }
  }

  try {
    const goal = await fetchGoalById(supabase, inserted.data.id)
    return c.json(goal)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to load goal'
    return c.json({ error: message }, 400)
  }
})

app.patch('/api/goals/:goalId', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const user = c.get('user') as User
  const goalId = c.req.param('goalId')

  const body = await c.req.json().catch(() => ({}))
  const parsed = GoalUpdateInputSchema.safeParse({ ...body, goalId })
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
  }

  const existingGoalRes = await supabase
    .from('goals')
    .select('id, tenant_id, employee_id')
    .eq('id', goalId)
    .maybeSingle()
  if (existingGoalRes.error) {
    return c.json({ error: existingGoalRes.error.message }, 400)
  }
  if (!existingGoalRes.data) {
    return c.json({ error: 'Goal not found' }, 404)
  }

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  if (parsed.data.tenantId && parsed.data.tenantId !== tenantId) {
    return c.json({ error: 'tenantId mismatch' }, 400)
  }
  if (existingGoalRes.data.tenant_id !== tenantId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  let employee: EmployeeRow | null
  try {
    employee = await getEmployeeById(supabase, existingGoalRes.data.employee_id)
  } catch (error: unknown) {
    return c.json({ error: error instanceof Error ? error.message : 'Unable to fetch employee' }, 400)
  }
  if (!employee) {
    return c.json({ error: 'Employee not found' }, 404)
  }

  try {
    await assertGoalWriteAccess(supabase, tenantId, user, employee)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
  }

  const updatePayload: Database['public']['Tables']['goals']['Update'] = {}
  if (parsed.data.title !== undefined) updatePayload.title = parsed.data.title
  if (parsed.data.description !== undefined) updatePayload.description = parsed.data.description ?? null
  if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status
  if (parsed.data.progressPct !== undefined) updatePayload.progress_pct = clampProgress(parsed.data.progressPct)
  if (parsed.data.dueDate !== undefined) updatePayload.due_date = parsed.data.dueDate ?? null
  updatePayload.updated_by = user.id

  if (Object.keys(updatePayload).length > 0) {
    const upd = await supabase
      .from('goals')
      .update(updatePayload)
      .eq('id', goalId)
    if (upd.error) {
      return c.json({ error: upd.error.message }, 400)
    }
  }

  if (parsed.data.keyResults !== undefined) {
    const del = await supabase
      .from('goal_key_results')
      .delete()
      .eq('goal_id', goalId)
    if (del.error) {
      return c.json({ error: del.error.message }, 400)
    }

    if (parsed.data.keyResults.length > 0) {
      const toInsert = parsed.data.keyResults.map((kr) => ({
        goal_id: goalId,
        label: kr.label,
        target_value: kr.targetValue ?? null,
        current_value: kr.currentValue ?? null,
        status: kr.status ?? 'pending',
      }))
      const ins = await supabase.from('goal_key_results').insert(toInsert)
      if (ins.error) {
        return c.json({ error: ins.error.message }, 400)
      }
    }
  }

  try {
    const goal = await fetchGoalById(supabase, goalId)
    return c.json(goal)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to load goal'
    return c.json({ error: message }, 400)
  }
})

app.delete('/api/goals/:goalId', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const user = c.get('user') as User
  const goalId = c.req.param('goalId')

  const existingGoalRes = await supabase
    .from('goals')
    .select('id, tenant_id, employee_id')
    .eq('id', goalId)
    .maybeSingle()
  if (existingGoalRes.error) {
    return c.json({ error: existingGoalRes.error.message }, 400)
  }
  if (!existingGoalRes.data) {
    return c.json({ error: 'Goal not found' }, 404)
  }

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  if (existingGoalRes.data.tenant_id !== tenantId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  let employee: EmployeeRow | null
  try {
    employee = await getEmployeeById(supabase, existingGoalRes.data.employee_id)
  } catch (error: unknown) {
    return c.json({ error: error instanceof Error ? error.message : 'Unable to fetch employee' }, 400)
  }
  if (!employee) {
    return c.json({ error: 'Employee not found' }, 404)
  }

  try {
    await assertGoalWriteAccess(supabase, tenantId, user, employee)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
  }

  const del = await supabase.from('goals').delete().eq('id', goalId)
  if (del.error) {
    return c.json({ error: del.error.message }, 400)
  }

  return c.body(null, 204)
})

app.post('/api/check-ins', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const user = c.get('user') as User

  const body = await c.req.json().catch(() => ({}))
  const parsed = CheckInCreateInputSchema.safeParse(body)
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

  if (parsed.data.tenantId !== tenantId) {
    return c.json({ error: 'tenantId mismatch' }, 400)
  }

  let employee: EmployeeRow | null
  try {
    employee = await getEmployeeById(supabase, parsed.data.employeeId)
  } catch (error: unknown) {
    return c.json({ error: error instanceof Error ? error.message : 'Unable to fetch employee' }, 400)
  }
  if (!employee || employee.tenant_id !== tenantId) {
    return c.json({ error: 'Employee not found' }, 404)
  }

  try {
    await assertCheckInWriteAccess(supabase, tenantId, user, employee)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
  }

  const insertPayload: Database['public']['Tables']['check_ins']['Insert'] = {
    tenant_id: tenantId,
    manager_user_id: user.id,
    employee_id: parsed.data.employeeId,
    status: 'draft',
    scheduled_for: parsed.data.scheduledFor ?? null,
    last_updated_by: user.id,
  }

  const inserted = await supabase
    .from('check_ins')
    .insert(insertPayload)
    .select('id')
    .single()
  if (inserted.error || !inserted.data) {
    return c.json({ error: inserted.error?.message ?? 'Unable to create check-in' }, 400)
  }

  if (parsed.data.agenda) {
    const agendaPayload: Database['public']['Tables']['check_in_agendas']['Insert'] = {
      check_in_id: inserted.data.id,
      accomplishments: parsed.data.agenda.accomplishments ?? null,
      priorities: parsed.data.agenda.priorities ?? null,
      roadblocks: parsed.data.agenda.roadblocks ?? null,
      notes_json: (parsed.data.agenda.notes as Json) ?? null,
      updated_at: new Date().toISOString(),
    }
    const agendaInsert = await supabase.from('check_in_agendas').upsert(agendaPayload, { onConflict: 'check_in_id' })
    if (agendaInsert.error) {
      return c.json({ error: agendaInsert.error.message }, 400)
    }
  }

  try {
    const checkIn = await fetchCheckInById(supabase, inserted.data.id)
    return c.json(checkIn)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to load check-in'
    return c.json({ error: message }, 400)
  }
})

app.patch('/api/check-ins/:checkInId', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const user = c.get('user') as User
  const checkInId = c.req.param('checkInId')

  const body = await c.req.json().catch(() => ({}))
  const parsed = CheckInUpdateInputSchema.safeParse({ ...body, checkInId })
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
  }

  const existingRes = await supabase
    .from('check_ins')
    .select('id, tenant_id, employee_id, manager_user_id, status, completed_at')
    .eq('id', checkInId)
    .maybeSingle()
  if (existingRes.error) {
    return c.json({ error: existingRes.error.message }, 400)
  }
  if (!existingRes.data) {
    return c.json({ error: 'Check-in not found' }, 404)
  }

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }
  if (existingRes.data.tenant_id !== tenantId || (parsed.data.tenantId && parsed.data.tenantId !== tenantId)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const employee = await getEmployeeById(supabase, existingRes.data.employee_id)
  if (!employee) {
    return c.json({ error: 'Employee not found' }, 404)
  }

  const viewerEmployee = await getEmployeeForUser(supabase, tenantId, user)

  let hasWritePermission = false
  try {
    hasWritePermission = await hasPermission(supabase, tenantId, 'check_ins.write')
  } catch (error: unknown) {
    return c.json({ error: error instanceof Error ? error.message : 'Permission check failed' }, 400)
  }

  const isManager = existingRes.data.manager_user_id === user.id
  const isEmployee = viewerEmployee ? viewerEmployee.id === employee.id : false
  const canManage = hasWritePermission || isManager

  if (!canManage && !isEmployee) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  if (!canManage) {
    if (parsed.data.status !== undefined || parsed.data.scheduledFor !== undefined || parsed.data.privateNote !== undefined) {
      return c.json({ error: 'Forbidden' }, 403)
    }
  }

  if (parsed.data.privateNote !== undefined && !canManage) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  if (parsed.data.agenda) {
    const agendaPayload: Database['public']['Tables']['check_in_agendas']['Insert'] = {
      check_in_id: existingRes.data.id,
      accomplishments: parsed.data.agenda.accomplishments ?? null,
      priorities: parsed.data.agenda.priorities ?? null,
      roadblocks: parsed.data.agenda.roadblocks ?? null,
      notes_json: (parsed.data.agenda.notes as Json) ?? null,
      updated_at: new Date().toISOString(),
    }
    const upsertAgenda = await supabase.from('check_in_agendas').upsert(agendaPayload, { onConflict: 'check_in_id' })
    if (upsertAgenda.error) {
      return c.json({ error: upsertAgenda.error.message }, 400)
    }
  }

  if (parsed.data.privateNote !== undefined && canManage) {
    const notePayload: Database['public']['Tables']['check_in_private_notes']['Insert'] = {
      check_in_id: existingRes.data.id,
      manager_user_id: existingRes.data.manager_user_id,
      body: parsed.data.privateNote ?? null,
      created_at: new Date().toISOString(),
    }
    const noteUpsert = await supabase
      .from('check_in_private_notes')
      .upsert(notePayload, { onConflict: 'check_in_id' })
    if (noteUpsert.error) {
      return c.json({ error: noteUpsert.error.message }, 400)
    }
  }

  const updatePayload: Database['public']['Tables']['check_ins']['Update'] = {}
  if (canManage) {
    if (parsed.data.scheduledFor !== undefined) {
      updatePayload.scheduled_for = parsed.data.scheduledFor ?? null
    }
    if (parsed.data.status !== undefined) {
      updatePayload.status = parsed.data.status
      if (parsed.data.status === 'completed') {
        updatePayload.completed_at = existingRes.data.completed_at ?? new Date().toISOString()
      } else if (parsed.data.status === 'draft') {
        updatePayload.completed_at = null
      }
    }
    updatePayload.last_updated_by = user.id
  }

  if (Object.keys(updatePayload).length > 0) {
    const upd = await supabase
      .from('check_ins')
      .update(updatePayload)
      .eq('id', existingRes.data.id)
    if (upd.error) {
      return c.json({ error: upd.error.message }, 400)
    }
  }

  try {
    const checkIn = await fetchCheckInById(supabase, existingRes.data.id)
    return c.json(checkIn)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to load check-in'
    return c.json({ error: message }, 400)
  }
})

app.get('/api/check-ins/:employeeId', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const user = c.get('user') as User
  const employeeId = c.req.param('employeeId')

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  const employee = await getEmployeeById(supabase, employeeId)
  if (!employee || employee.tenant_id !== tenantId) {
    return c.json({ error: 'Employee not found' }, 404)
  }

  try {
    await assertCheckInReadAccess(supabase, tenantId, user, employee)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
  }

  const rows = await supabase
    .from('check_ins')
    .select(`
      id, tenant_id, manager_user_id, employee_id, status, scheduled_for, completed_at, last_updated_by, created_at, updated_at,
      check_in_agendas ( accomplishments, priorities, roadblocks, notes_json, updated_at ),
      check_in_private_notes!left ( body, manager_user_id, created_at )
    `)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })

  if (rows.error) {
    return c.json({ error: rows.error.message }, 400)
  }

  const items = (rows.data ?? []).map((row) => {
    const checkIn = mapCheckInRow(row as CheckInWithRelations)
    return {
      checkIn,
      agenda: checkIn.agenda,
    }
  })

  const parsed = CheckInHistoryResponseSchema.safeParse({ items })
  if (!parsed.success) {
    return c.json({ error: 'Unexpected response shape' }, 500)
  }
  return c.json(parsed.data)
})

app.get('/api/check-in/:checkInId', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const user = c.get('user') as User
  const checkInId = c.req.param('checkInId')

  let checkIn: CheckIn
  try {
    checkIn = await fetchCheckInById(supabase, checkInId)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Check-in not found'
    return c.json({ error: message }, 404)
  }

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }
  if (checkIn.tenantId !== tenantId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const employee = await getEmployeeById(supabase, checkIn.employeeId)
  if (!employee) {
    return c.json({ error: 'Employee not found' }, 404)
  }

  try {
    await assertCheckInReadAccess(supabase, tenantId, user, employee)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
  }

  return c.json(checkIn)
})

app.get('/api/check-ins/me', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const user = c.get('user') as User

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  const viewerEmployee = await getEmployeeForUser(supabase, tenantId, user)
  if (!viewerEmployee) {
    return c.json({ error: 'Employee record not found' }, 404)
  }

  try {
    await assertCheckInReadAccess(supabase, tenantId, user, viewerEmployee)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
  }

  const rows = await supabase
    .from('check_ins')
    .select(`
      id, tenant_id, manager_user_id, employee_id, status, scheduled_for, completed_at, last_updated_by, created_at, updated_at,
      check_in_agendas ( accomplishments, priorities, roadblocks, notes_json, updated_at ),
      check_in_private_notes!left ( body, manager_user_id, created_at )
    `)
    .eq('employee_id', viewerEmployee.id)
    .order('created_at', { ascending: false })

  if (rows.error) {
    return c.json({ error: rows.error.message }, 400)
  }

  const items = (rows.data ?? []).map((row) => {
    const checkIn = mapCheckInRow(row as CheckInWithRelations)
    return {
      checkIn,
      agenda: checkIn.agenda,
    }
  })

  const parsed = CheckInHistoryResponseSchema.safeParse({ items })
  if (!parsed.success) {
    return c.json({ error: 'Unexpected response shape' }, 500)
  }
  return c.json(parsed.data)
})

async function validateAndCoerceCustomFields(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  input: unknown,
): Promise<Record<string, Json> | null> {
  if (input == null) return null
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('custom_fields must be an object')
  }

  const defs = await supabase
    .from('employee_custom_field_defs')
    .select('key, type, required, options, position')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: true })

  if (defs.error) throw new Error(defs.error.message)

  const byKey = new Map(
    (defs.data ?? []).map((d) => [d.key as string, d] as const),
  )

  const raw = input as Record<string, unknown>
  const output: Record<string, Json> = {}

  for (const [key, value] of Object.entries(raw)) {
    const def = byKey.get(key)
    if (!def) {
      // Ignore undefined custom fields to keep API lenient; definitions control allowed keys.
      continue
    }
    output[key] = coerceCustomFieldValue(def.type as EmployeeCustomFieldType, value, def.options)
  }

  // Ensure required fields present (when definitions require)
  for (const def of defs.data ?? []) {
    if (def.required && !(def.key in output)) {
      throw new Error(`Missing required custom field: ${def.key}`)
    }
  }

  return output
}

function coerceCustomFieldValue(
  type: EmployeeCustomFieldType,
  value: unknown,
  options: unknown,
): Json {
  if (value == null) return null
  switch (type) {
    case 'text':
      return String(value)
    case 'number': {
      const num = typeof value === 'number' ? value : Number(String(value))
      if (!Number.isFinite(num)) throw new Error('Invalid number')
      return num
    }
    case 'date': {
      const str = typeof value === 'string' ? value : String(value)
      const d = new Date(str)
      if (Number.isNaN(d.getTime())) throw new Error('Invalid date')
      return d.toISOString()
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value
      if (value === 'true' || value === '1' || value === 1) return true
      if (value === 'false' || value === '0' || value === 0) return false
      throw new Error('Invalid boolean')
    }
    case 'select': {
      const choices: unknown = (options && typeof options === 'object' && options !== null)
        ? (options as any).choices
        : undefined
      if (!Array.isArray(choices)) {
        throw new Error('Invalid select options')
      }
      const val = String(value)
      if (!choices.includes(val)) throw new Error('Value not in select choices')
      return val
    }
    default:
      return String(value)
  }
}

type EmployeeRow = Database['public']['Tables']['employees']['Row']
type GoalRow = Database['public']['Tables']['goals']['Row']
type GoalKeyResultRow = Database['public']['Tables']['goal_key_results']['Row']
type GoalUpdateRow = Database['public']['Tables']['goal_updates']['Row']
type CheckInRow = Database['public']['Tables']['check_ins']['Row']
type CheckInAgendaRow = Database['public']['Tables']['check_in_agendas']['Row']
type CheckInPrivateNoteRow = Database['public']['Tables']['check_in_private_notes']['Row']

type GoalWithRelations = GoalRow & {
  goal_key_results?: GoalKeyResultRow[] | null
  goal_updates?: GoalUpdateRow[] | null
}

type CheckInWithRelations = CheckInRow & {
  check_in_agendas?: CheckInAgendaRow | CheckInAgendaRow[] | null
  check_in_private_notes?: CheckInPrivateNoteRow | CheckInPrivateNoteRow[] | null
}

function clampProgress(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0
  if (value < 0) return 0
  if (value > 100) return 100
  return Math.round(value * 100) / 100
}

async function hasPermission(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  permission: string,
): Promise<boolean> {
  const check = await supabase.rpc('app_has_permission', { permission, tenant: tenantId })
  if (check.error) throw new Error(check.error.message)
  return Boolean(check.data)
}

async function getEmployeeForUser(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  user: User,
): Promise<EmployeeRow | null> {
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

async function getEmployeeById(
  supabase: SupabaseClient<Database>,
  employeeId: string,
): Promise<EmployeeRow | null> {
  const res = await supabase
    .from('employees')
    .select('*')
    .eq('id', employeeId)
    .maybeSingle()
  if (res.error && res.error.code !== 'PGRST116') {
    throw new Error(res.error.message)
  }
  return res.data ?? null
}

async function fetchGoalsForEmployee(
  supabase: SupabaseClient<Database>,
  employeeId: string,
): Promise<Goal[]> {
  const res = await supabase
    .from('goals')
    .select(`
      id, tenant_id, employee_id, title, description, status, progress_pct, due_date, created_by, updated_by, created_at, updated_at,
      goal_key_results ( id, goal_id, label, target_value, current_value, status, created_at, updated_at ),
      goal_updates ( id, goal_id, author_id, body, created_at )
    `)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: true })

  if (res.error) throw new Error(res.error.message)
  return (res.data ?? []).map((row) => mapGoalRow(row as GoalWithRelations))
}

async function fetchGoalById(
  supabase: SupabaseClient<Database>,
  goalId: string,
): Promise<Goal> {
  const res = await supabase
    .from('goals')
    .select(`
      id, tenant_id, employee_id, title, description, status, progress_pct, due_date, created_by, updated_by, created_at, updated_at,
      goal_key_results ( id, goal_id, label, target_value, current_value, status, created_at, updated_at ),
      goal_updates ( id, goal_id, author_id, body, created_at )
    `)
    .eq('id', goalId)
    .maybeSingle()

  if (res.error) throw new Error(res.error.message)
  if (!res.data) throw new Error('Goal not found')
  return mapGoalRow(res.data as GoalWithRelations)
}

function mapGoalRow(row: GoalWithRelations): Goal {
  const keyResults = (row.goal_key_results ?? []).map(mapGoalKeyResultRow)
  const updates = (row.goal_updates ?? []).map(mapGoalUpdateRow)

  const goal = {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    progressPct: clampProgress(
      typeof row.progress_pct === 'number' ? row.progress_pct : Number(row.progress_pct ?? 0),
    ),
    dueDate: row.due_date ?? null,
    createdBy: row.created_by,
    updatedBy: row.updated_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    keyResults,
    updates,
  }
  return GoalSchema.parse(goal)
}

function mapGoalKeyResultRow(row: GoalKeyResultRow): GoalKeyResult {
  const payload = {
    id: row.id,
    goalId: row.goal_id,
    label: row.label,
    targetValue: row.target_value == null ? null : Number(row.target_value),
    currentValue: row.current_value == null ? null : Number(row.current_value),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
  return GoalKeyResultSchema.parse(payload)
}

function mapGoalUpdateRow(row: GoalUpdateRow): GoalUpdate {
  const payload = {
    id: row.id,
    goalId: row.goal_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
  }
  return GoalUpdateSchema.parse(payload)
}

async function assertGoalReadAccess(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  user: User,
  employee: EmployeeRow,
): Promise<void> {
  try {
    if (await hasPermission(supabase, tenantId, 'goals.read')) return
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Unable to verify permissions')
  }

  const viewerEmployee = await getEmployeeForUser(supabase, tenantId, user)
  if (!viewerEmployee || viewerEmployee.id !== employee.id) {
    throw new Error('Forbidden')
  }
}

async function assertGoalWriteAccess(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  user: User,
  employee: EmployeeRow,
): Promise<void> {
  try {
    if (await hasPermission(supabase, tenantId, 'goals.write')) return
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Unable to verify permissions')
  }

  const viewerEmployee = await getEmployeeForUser(supabase, tenantId, user)
  if (!viewerEmployee || viewerEmployee.id !== employee.id) {
    throw new Error('Forbidden')
  }
}

async function assertCheckInWriteAccess(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  user: User,
  employee: EmployeeRow,
): Promise<void> {
  try {
    if (await hasPermission(supabase, tenantId, 'check_ins.write')) return
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Unable to verify permissions')
  }

  const viewerEmployee = await getEmployeeForUser(supabase, tenantId, user)
  if (!viewerEmployee || employee.manager_id !== viewerEmployee.id) {
    throw new Error('Forbidden')
  }
}

async function assertCheckInReadAccess(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  user: User,
  employee: EmployeeRow,
): Promise<void> {
  try {
    if (await hasPermission(supabase, tenantId, 'check_ins.read')) return
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Unable to verify permissions')
  }

  const viewerEmployee = await getEmployeeForUser(supabase, tenantId, user)
  if (!viewerEmployee) {
    throw new Error('Forbidden')
  }

  if (viewerEmployee.id === employee.id) return
  if (employee.manager_id === viewerEmployee.id) return

  throw new Error('Forbidden')
}

function mapCheckInRow(row: CheckInWithRelations): CheckIn {
  const agendaRow = Array.isArray(row.check_in_agendas)
    ? row.check_in_agendas[0]
    : row.check_in_agendas ?? null
  const privateNoteRow = Array.isArray(row.check_in_private_notes)
    ? row.check_in_private_notes[0]
    : row.check_in_private_notes ?? null

  const payload = {
    id: row.id,
    tenantId: row.tenant_id,
    managerUserId: row.manager_user_id,
    employeeId: row.employee_id,
    status: row.status,
    scheduledFor: row.scheduled_for ?? null,
    completedAt: row.completed_at ?? null,
    lastUpdatedBy: row.last_updated_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    agenda: agendaRow
      ? {
          accomplishments: agendaRow.accomplishments ?? null,
          priorities: agendaRow.priorities ?? null,
          roadblocks: agendaRow.roadblocks ?? null,
          notes: agendaRow.notes_json ?? null,
          updatedAt: agendaRow.updated_at ?? null,
        }
      : undefined,
    privateNote: privateNoteRow?.body ?? null,
  }

  return CheckInSchema.parse(payload)
}

async function fetchCheckInById(
  supabase: SupabaseClient<Database>,
  checkInId: string,
): Promise<CheckIn> {
  const res = await supabase
    .from('check_ins')
    .select(`
      id, tenant_id, manager_user_id, employee_id, status, scheduled_for, completed_at, last_updated_by, created_at, updated_at,
      check_in_agendas ( accomplishments, priorities, roadblocks, notes_json, updated_at ),
      check_in_private_notes!left ( body, manager_user_id, created_at )
    `)
    .eq('id', checkInId)
    .maybeSingle()

  if (res.error) {
    throw new Error(res.error.message)
  }
  if (!res.data) {
    throw new Error('Check-in not found')
  }

  return mapCheckInRow(res.data as CheckInWithRelations)
}

// ---------------- Time Management Helpers ----------------

async function getPrimaryTenantId(
  supabase: SupabaseClient<Database>,
): Promise<string> {
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

function parseIso(input: string | null | undefined): Date | null {
  if (!input) return null
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfWeekUtc(d: Date): Date {
  const dt = new Date(d)
  const day = dt.getUTCDay() // 0 (Sun) - 6 (Sat)
  const diffToMonday = (day + 6) % 7 // Monday = 0
  dt.setUTCDate(dt.getUTCDate() - diffToMonday)
  dt.setUTCHours(0, 0, 0, 0)
  return dt
}

function endOfWeekUtc(d: Date): Date {
  const start = startOfWeekUtc(d)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 7)
  return end
}

function clampNonNegative(n: number): number { return n < 0 ? 0 : n }

// ==============================================
// Time Management Helper Functions
// ==============================================

// Check if time entry requires approval
async function requiresApproval(
  entryDate: Date,
  entryType: 'clock' | 'manual',
  userId: string,
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  // Manual entries for past dates require approval
  if (entryType === 'manual' && entryDate < new Date()) {
    return true;
  }
  
  // Future: Add more complex rules here (e.g., based on employee role, location, etc.)
  return false;
}

// Check for overlapping time entries
async function checkTimeEntryOverlap(
  userId: string,
  tenantId: string,
  startTime: Date,
  endTime: Date,
  supabase: SupabaseClient<Database>,
  excludeId?: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('id, clock_in_at, clock_out_at')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .neq('approval_status', 'rejected')
    .not('id', 'eq', excludeId || '');

  if (error) throw error;

  return (data || []).some(entry => {
    const entryStart = new Date(entry.clock_in_at);
    const entryEnd = entry.clock_out_at ? new Date(entry.clock_out_at) : new Date();
    
    // Check for overlap
    return (
      // New entry starts during existing entry
      (startTime >= entryStart && startTime < entryEnd) ||
      // New entry ends during existing entry
      (endTime > entryStart && endTime <= entryEnd) ||
      // New entry completely contains existing entry
      (startTime <= entryStart && endTime >= entryEnd)
    );
  });
}

// Create audit log entry
async function createAuditLog(
  timeEntryId: string,
  changedBy: string,
  fieldName: string,
  oldValue: any,
  newValue: any,
  supabase: SupabaseClient<Database>,
  changeReason?: string
): Promise<void> {
  const { error } = await supabase
    .from('time_entry_audit')
    .insert({
      time_entry_id: timeEntryId,
      changed_by: changedBy,
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
      change_reason: changeReason,
    });

  if (error) throw error;
}

// Calculate overtime for a period
async function calculateOvertimeForPeriod(
  userId: string,
  tenantId: string,
  startDate: Date,
  endDate: Date,
  supabase: SupabaseClient<Database>
): Promise<{ regularHours: number; overtimeHours: number }> {
  // Get overtime rules for tenant
  const { data: rules, error: rulesError } = await supabase
    .from('overtime_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .single();

  if (rulesError) throw rulesError;
  if (!rules) throw new Error('No overtime rules found for tenant');

  // Get approved time entries for period
  const { data: entries, error: entriesError } = await supabase
    .from('time_entries')
    .select('clock_in_at, clock_out_at, break_minutes')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('approval_status', 'approved')
    .gte('clock_in_at', startDate.toISOString())
    .lt('clock_in_at', endDate.toISOString())
    .not('clock_out_at', 'is', null);

  if (entriesError) throw entriesError;

  let totalRegularHours = 0;
  let totalOvertimeHours = 0;

  // Group entries by day
  const dailyHours: { [date: string]: number } = {};
  
  for (const entry of entries || []) {
    const clockIn = new Date(entry.clock_in_at);
    const clockOut = new Date(entry.clock_out_at!);
    const breakMinutes = entry.break_minutes || 0;
    
    // Calculate net hours (duration minus breaks)
    const totalMinutes = Math.max(0, clockOut.getTime() - clockIn.getTime()) / (1000 * 60);
    const netMinutes = Math.max(0, totalMinutes - breakMinutes);
    const netHours = netMinutes / 60;
    
    const dateKey = clockIn.toISOString().split('T')[0];
    dailyHours[dateKey] = (dailyHours[dateKey] || 0) + netHours;
  }

  // Apply daily overtime rules
  for (const [date, hours] of Object.entries(dailyHours)) {
    if (hours > rules.daily_threshold) {
      const dailyOvertime = hours - rules.daily_threshold;
      totalOvertimeHours += dailyOvertime;
      totalRegularHours += rules.daily_threshold;
    } else {
      totalRegularHours += hours;
    }
  }

  // Apply weekly overtime rules
  const totalHours = totalRegularHours + totalOvertimeHours;
  if (totalHours > rules.weekly_threshold) {
    const weeklyOvertime = totalHours - rules.weekly_threshold;
    // Move some hours from regular to overtime
    const moveToOvertime = Math.min(weeklyOvertime, totalRegularHours);
    totalRegularHours -= moveToOvertime;
    totalOvertimeHours += moveToOvertime;
  }

  return {
    regularHours: Math.round(totalRegularHours * 100) / 100,
    overtimeHours: Math.round(totalOvertimeHours * 100) / 100,
  };
}

// Get or create overtime balance for period
async function getOrCreateOvertimeBalance(
  userId: string,
  tenantId: string,
  period: string,
  supabase: SupabaseClient<Database>
): Promise<any> {
  // Try to get existing balance
  const { data: existing, error: fetchError } = await supabase
    .from('overtime_balances')
    .select('*')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('period', period)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

  if (existing) return existing;

  // Create new balance
  const { data: newBalance, error: createError } = await supabase
    .from('overtime_balances')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      period,
      regular_hours: 0,
      overtime_hours: 0,
      overtime_multiplier: 1.5,
      carry_over_hours: 0,
    })
    .select()
    .single();

  if (createError) throw createError;
  return newBalance;
}

// Format time for display
function formatTimeDisplay(minutes: number | null): string {
  if (minutes === null) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins.toString().padStart(2, '0')}m`;
}

// Parse ISO date string safely
function parseIsoDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

// ---------------- Time Management Endpoints ----------------

// Summary for "My Time" widget
app.get('/api/time/summary', async (c) => {
  const user = c.get('user') as User
  const supabase = c.get('supabase') as SupabaseClient<Database>

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  const now = new Date()
  const rangeStart = startOfWeekUtc(now)
  const rangeEnd = endOfWeekUtc(now)

  const entries = await supabase
    .from('time_entries')
    .select('id, tenant_id, user_id, clock_in_at, clock_out_at, duration_minutes, location, created_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .gte('clock_in_at', rangeStart.toISOString())
    .lt('clock_in_at', rangeEnd.toISOString())

  if (entries.error) return c.json({ error: entries.error.message }, 400)

  const minutes = (entries.data ?? [])
    .map((e) => (typeof e.duration_minutes === 'number' ? e.duration_minutes : 0))
    .reduce((a, b) => a + b, 0)

  const activeOpen = await supabase
    .from('time_entries')
    .select('id, tenant_id, user_id, clock_in_at, clock_out_at, duration_minutes, location, created_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .is('clock_out_at', null)
    .maybeSingle()

  if (activeOpen.error && activeOpen.error.code !== 'PGRST116') {
    return c.json({ error: activeOpen.error.message }, 400)
  }

  const profile = await supabase
    .from('profiles')
    .select('user_id, tenant_id, display_name, created_at, updated_at, pto_balance_days, sick_balance_days')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profile.error) return c.json({ error: profile.error.message }, 400)

  const payload = {
    hoursThisWeek: Math.round((minutes / 60) * 100) / 100,
    targetHours: 40,
    activeEntry: activeOpen.data ?? null,
    pto_balance_days: Number(profile.data?.pto_balance_days ?? 0),
    sick_balance_days: Number(profile.data?.sick_balance_days ?? 0),
  }

  const parsed = TimeSummaryResponseSchema.safeParse(payload)
  if (!parsed.success) return c.json({ error: 'Unexpected response shape' }, 500)
  return c.json(parsed.data)
})

// Clock in
app.post('/api/time/clock-in', async (c) => {
  const user = c.get('user') as User
  const supabase = c.get('supabase') as SupabaseClient<Database>

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  const existing = await supabase
    .from('time_entries')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .is('clock_out_at', null)
    .limit(1)

  if (existing.error) return c.json({ error: existing.error.message }, 400)
  if ((existing.data ?? []).length > 0) return c.json({ error: 'Already clocked in' }, 409)

  const inserted = await supabase
    .from('time_entries')
    .insert({ tenant_id: tenantId, user_id: user.id })
    .select('id, tenant_id, user_id, clock_in_at, clock_out_at, duration_minutes, location, created_at')
    .single()

  if (inserted.error || !inserted.data) {
    return c.json({ error: inserted.error?.message ?? 'Unable to clock in' }, 400)
  }

  return c.json(inserted.data)
})

// Clock out
app.post('/api/time/clock-out', async (c) => {
  const user = c.get('user') as User
  const supabase = c.get('supabase') as SupabaseClient<Database>

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  const open = await supabase
    .from('time_entries')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .is('clock_out_at', null)
    .maybeSingle()

  if (open.error && open.error.code !== 'PGRST116') {
    return c.json({ error: open.error.message }, 400)
  }
  if (!open.data) return c.json({ error: 'No active time entry' }, 409)

  const nowIso = new Date().toISOString()
  const upd = await supabase
    .from('time_entries')
    .update({ clock_out_at: nowIso })
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .eq('id', open.data.id)
    .select('id, tenant_id, user_id, clock_in_at, clock_out_at, duration_minutes, location, created_at')
    .single()

  if (upd.error || !upd.data) {
    return c.json({ error: upd.error?.message ?? 'Unable to clock out' }, 400)
  }

  return c.json(upd.data)
})

// Create time off request
app.post('/api/time-off/requests', async (c) => {
  const user = c.get('user') as User
  const supabase = c.get('supabase') as SupabaseClient<Database>

  const body = await c.req.json().catch(() => ({}))
  const parsed = CreateTimeOffRequestInputSchema.safeParse(body)
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

  const ins = await supabase
    .from('time_off_requests')
    .insert({
      tenant_id: tenantId,
      user_id: user.id,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      leave_type: parsed.data.leave_type,
      note: parsed.data.note ?? null,
    })
    .select('id, tenant_id, user_id, start_date, end_date, leave_type, status, approver_user_id, decided_at, note, created_at')
    .single()

  if (ins.error || !ins.data) {
    return c.json({ error: ins.error?.message ?? 'Unable to create request' }, 400)
  }

  return c.json(ins.data)
})

// Approve/Deny time off request
app.put('/api/time-off/requests/:id/approve', async (c) => {
  const user = c.get('user') as User
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const id = c.req.param('id')

  const body = await c.req.json().catch(() => ({}))
  const parsed = ApproveTimeOffRequestInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
  }

  // Load via RLS first to avoid leaking across tenants
  const reqRow = await supabase
    .from('time_off_requests')
    .select('id, tenant_id, user_id, start_date, end_date, leave_type, status')
    .eq('id', id)
    .maybeSingle()

  if (reqRow.error) return c.json({ error: reqRow.error.message }, 400)
  if (!reqRow.data) return c.json({ error: 'Request not found' }, 404)

  const tenantId = reqRow.data.tenant_id
  try {
    await ensurePermission(supabase, tenantId, 'time_off.approve')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
  }

  const decision = parsed.data.decision
  const status = decision === 'approve' ? 'approved' : 'denied'
  const decidedAt = new Date().toISOString()

  // Update request status (admin to bypass requester-only RLS on updates)
  const upd = await supabaseAdmin
    .from('time_off_requests')
    .update({ status, approver_user_id: user.id, decided_at: decidedAt })
    .eq('id', id)
    .select('id, tenant_id, user_id, start_date, end_date, leave_type, status, approver_user_id, decided_at')
    .single()

  if (upd.error || !upd.data) {
    return c.json({ error: upd.error?.message ?? 'Unable to update request' }, 400)
  }

  // On approve, deduct balances for PTO/sick (not for unpaid)
  if (status === 'approved') {
    const start = parseIso(reqRow.data.start_date)
    const end = parseIso(reqRow.data.end_date)
    if (start && end) {
      const msPerDay = 24 * 60 * 60 * 1000
      const days = Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1
      const column = reqRow.data.leave_type === 'sick' ? 'sick_balance_days' : (reqRow.data.leave_type === 'unpaid' ? null : 'pto_balance_days')
      if (column) {
        // Fetch current balances
        const prof = await supabaseAdmin
          .from('profiles')
          .select('user_id, pto_balance_days, sick_balance_days')
          .eq('user_id', reqRow.data.user_id)
          .maybeSingle()

        if (!prof.error && prof.data) {
          const current = Number((prof.data as any)[column] ?? 0)
          const next = clampNonNegative(current - days)
          await supabaseAdmin
            .from('profiles')
            .update({ [column]: next } as any)
            .eq('user_id', reqRow.data.user_id)
        }
      }
    }
  }

  return c.json(upd.data)
})

// Enhanced team calendar with filtering and export
app.get('/api/calendar', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  try {
    await ensurePermission(supabase, tenantId, 'calendar.read')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
  }

  const url = new URL(c.req.url)
  const query = {
    start: url.searchParams.get('start') || undefined,
    end: url.searchParams.get('end') || undefined,
    user_ids: url.searchParams.getAll('user_ids[]'),
    status: url.searchParams.get('status') || undefined,
    department_id: url.searchParams.get('department_id') || undefined,
    include_breaks: url.searchParams.get('include_breaks') === 'true',
    format: url.searchParams.get('format') || 'json',
  }

  const parsed = ManagerCalendarFilterSchema.safeParse(query)
  if (!parsed.success) {
    return c.json({ error: 'Invalid query parameters', details: parsed.error.issues }, 400)
  }

  const { start, end, user_ids, status, department_id, include_breaks, format } = parsed.data

  const startDate = parseIso(start)
  const endDate = parseIso(end)
  if (!startDate || !endDate || endDate <= startDate) {
    return c.json({ error: 'Invalid start/end range' }, 400)
  }

  // Get team members based on filters
  let teamQuery = supabase
    .from('employees')
    .select('id, user_id, name, email, employee_number, department_id, status')
    .eq('tenant_id', tenantId)

  if (user_ids && user_ids.length > 0) {
    teamQuery = teamQuery.in('user_id', user_ids)
  }

  if (department_id) {
    teamQuery = teamQuery.eq('department_id', department_id)
  }

  const { data: teamMembers, error: teamError } = await teamQuery
  if (teamError) return c.json({ error: teamError.message }, 400)

  const teamUserIds = (teamMembers || []).map(m => m.user_id)

  // Get approved time off overlapping range
  let timeOffQuery = supabase
    .from('time_off_requests')
    .select('id, user_id, start_date, end_date, leave_type, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'approved')
    .lte('start_date', endDate.toISOString())
    .gte('end_date', startDate.toISOString())

  if (teamUserIds.length > 0) {
    const validUserIds = teamUserIds.filter((id): id is string => id !== null)
    if (validUserIds.length > 0) {
      timeOffQuery = timeOffQuery.in('user_id', validUserIds)
    }
  }

  const { data: timeOff, error: timeOffError } = await timeOffQuery
  if (timeOffError) return c.json({ error: timeOffError.message }, 400)

  // Get time entries overlapping range with enhanced data
  let timeEntriesQuery = supabase
    .from('time_entries')
    .select(`
      id, user_id, clock_in_at, clock_out_at, break_minutes, 
      project_task, notes, entry_type, approval_status
    `)
    .eq('tenant_id', tenantId)
    .lt('clock_in_at', endDate.toISOString())
    .or(`clock_out_at.is.null,clock_out_at.gte.${startDate.toISOString()}`)

  if (teamUserIds.length > 0) {
    const validUserIds = teamUserIds.filter((id): id is string => id !== null)
    if (validUserIds.length > 0) {
      timeEntriesQuery = timeEntriesQuery.in('user_id', validUserIds)
    }
  }

  const { data: timeEntries, error: timeEntriesError } = await timeEntriesQuery
  if (timeEntriesError) return c.json({ error: timeEntriesError.message }, 400)

  // Create employee lookup map
  const employeeMap = new Map((teamMembers || []).map(emp => [emp.user_id, emp]))

  // Build events array
  const events = [
    ...((timeOff || []).map((r) => {
      const evStart = new Date(r.start_date)
      evStart.setUTCHours(0, 0, 0, 0)
      const evEnd = new Date(r.end_date)
      evEnd.setUTCHours(0, 0, 0, 0)
      evEnd.setUTCDate(evEnd.getUTCDate() + 1) // make inclusive
      const employee = employeeMap.get(r.user_id)
      return {
        id: `off_${r.id}`,
        title: `Time Off - ${employee?.name || 'Unknown'}`,
        start: evStart.toISOString(),
        end: evEnd.toISOString(),
        kind: 'time_off' as const,
        userId: r.user_id,
        leaveType: r.leave_type as any,
        employeeName: employee?.name,
        employeeEmail: employee?.email,
        employeeNumber: employee?.employee_number,
      }
    })),
    ...((timeEntries || []).map((e) => {
      const employee = employeeMap.get(e.user_id)
      const duration = e.clock_out_at ? 
        Math.max(0, new Date(e.clock_out_at).getTime() - new Date(e.clock_in_at).getTime()) / (1000 * 60) : 0
      const netDuration = Math.max(0, duration - (e.break_minutes || 0))
      
      return {
      id: `te_${e.id}`,
        title: `Worked Time - ${employee?.name || 'Unknown'}`,
      start: e.clock_in_at,
      end: e.clock_out_at ?? e.clock_in_at,
      kind: 'time_entry' as const,
      userId: e.user_id,
        employeeName: employee?.name,
        employeeEmail: employee?.email,
        employeeNumber: employee?.employee_number,
        duration: Math.round(duration),
        netDuration: Math.round(netDuration),
        breakMinutes: e.break_minutes || 0,
        projectTask: e.project_task,
        notes: e.notes,
        entryType: e.entry_type,
        approvalStatus: e.approval_status,
      }
    })),
  ]

  // Apply status filter
  let filteredEvents = events
  if (status && status !== 'all') {
    filteredEvents = events.filter(event => {
      if (event.kind === 'time_off') return true // Time off is always "on-leave"
      if (event.kind === 'time_entry') {
        switch (status) {
          case 'clocked-in':
            return !event.end || event.end === event.start
          case 'not-clocked-in':
            return false // This would need additional logic to show who hasn't clocked in
          case 'on-leave':
            return false // Time off entries are handled separately
          case 'absent':
            return false // This would need additional logic
          default:
            return true
        }
      }
      return true
    })
  }

  // Handle CSV export
  if (format === 'csv') {
    const csvHeaders = [
      'Date',
      'Employee Name',
      'Employee Email',
      'Employee Number',
      'Type',
      'Start Time',
      'End Time',
      'Duration (minutes)',
      'Net Duration (minutes)',
      'Break (minutes)',
      'Project/Task',
      'Notes',
      'Status'
    ]

    const csvRows = filteredEvents.map(event => {
      const startDate = new Date(event.start)
      const endDate = new Date(event.end)
      
      return [
        startDate.toISOString().split('T')[0],
        event.employeeName || '',
        event.employeeEmail || '',
        event.employeeNumber || '',
        event.kind === 'time_off' ? 'Time Off' : 'Work Time',
        startDate.toISOString(),
        endDate.toISOString(),
        event.kind === 'time_entry' ? (event.duration || 0) : 0,
        event.kind === 'time_entry' ? (event.netDuration || 0) : 0,
        event.kind === 'time_entry' ? (event.breakMinutes || 0) : 0,
        event.kind === 'time_entry' ? (event.projectTask || '') : '',
        event.kind === 'time_entry' ? (event.notes || '') : '',
        event.kind === 'time_entry' ? (event.approvalStatus || '') : (event.kind === 'time_off' ? 'approved' : '')
      ]
    })

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    c.header('Content-Type', 'text/csv')
    c.header('Content-Disposition', `attachment; filename="team-calendar-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv"`)
    return c.text(csvContent)
  }

  // Return JSON response
  const calendarParsed = CalendarResponseSchema.safeParse({ events: filteredEvents })
  if (!calendarParsed.success) return c.json({ error: 'Unexpected response shape' }, 500)
  return c.json(calendarParsed.data)
})

// Time export endpoint for detailed reports
app.get('/api/time/export', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  try {
    await ensurePermission(supabase, tenantId, 'time.view_team')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, 403)
  }

  const url = new URL(c.req.url)
  const query = {
    format: url.searchParams.get('format') || 'csv',
    start_date: url.searchParams.get('start_date') || undefined,
    end_date: url.searchParams.get('end_date') || undefined,
    user_ids: url.searchParams.getAll('user_ids[]'),
    include_breaks: url.searchParams.get('include_breaks') === 'true',
    include_notes: url.searchParams.get('include_notes') === 'true',
  }

  const parsed = TimeExportRequestSchema.safeParse(query)
  if (!parsed.success) {
    return c.json({ error: 'Invalid query parameters', details: parsed.error.issues }, 400)
  }

  const { format, start_date, end_date, user_ids, include_breaks, include_notes } = parsed.data

  const startDate = parseIso(start_date)
  const endDate = parseIso(end_date)
  if (!startDate || !endDate || endDate <= startDate) {
    return c.json({ error: 'Invalid start/end range' }, 400)
  }

  // Get time entries
  let timeEntriesQuery = supabase
    .from('time_entries')
    .select(`
      id, user_id, clock_in_at, clock_out_at, break_minutes, 
      project_task, notes, entry_type, approval_status, created_at
    `)
    .eq('tenant_id', tenantId)
    .gte('clock_in_at', startDate.toISOString())
    .lte('clock_in_at', endDate.toISOString())

  if (user_ids && user_ids.length > 0) {
    timeEntriesQuery = timeEntriesQuery.in('user_id', user_ids)
  }

  const { data: timeEntries, error: timeEntriesError } = await timeEntriesQuery
  if (timeEntriesError) return c.json({ error: timeEntriesError.message }, 400)

  // Get employee data
  const userIds = [...new Set((timeEntries || []).map(e => e.user_id))]
  const { data: employees, error: employeesError } = await supabase
    .from('employees')
    .select('user_id, name, email, employee_number, department_id')
    .in('user_id', userIds)

  if (employeesError) return c.json({ error: employeesError.message }, 400)

  const employeeMap = new Map((employees || []).map(emp => [emp.user_id, emp]))

  // Build CSV
  const csvHeaders = [
    'Date',
    'Employee Name',
    'Employee Email',
    'Employee Number',
    'Clock In',
    'Clock Out',
    'Duration (hours)',
    'Break (minutes)',
    'Net Duration (hours)',
    'Project/Task',
    'Entry Type',
    'Status'
  ]

  if (include_notes) {
    csvHeaders.push('Notes')
  }

  const csvRows = (timeEntries || []).map(entry => {
    const employee = employeeMap.get(entry.user_id)
    const clockIn = new Date(entry.clock_in_at)
    const clockOut = entry.clock_out_at ? new Date(entry.clock_out_at) : null
    const duration = clockOut ? 
      Math.max(0, clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60) : 0
    const netDuration = Math.max(0, duration - (entry.break_minutes || 0) / 60)
    
    const row = [
      clockIn.toISOString().split('T')[0],
      employee?.name || '',
      employee?.email || '',
      employee?.employee_number || '',
      clockIn.toISOString(),
      clockOut?.toISOString() || '',
      duration.toFixed(2),
      entry.break_minutes || 0,
      netDuration.toFixed(2),
      entry.project_task || '',
      entry.entry_type,
      entry.approval_status
    ]

    if (include_notes) {
      row.push(entry.notes || '')
    }

    return row
  })

  const csvContent = [csvHeaders, ...csvRows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  c.header('Content-Type', 'text/csv')
  c.header('Content-Disposition', `attachment; filename="time-export-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv"`)
  return c.text(csvContent)
})

// ==============================================
// Manual Time Entry Endpoints
// ==============================================

// Create manual time entry
app.post('/api/time/entries', async (c) => {
  const user = c.get('user') as User
  const supabase = c.get('supabase') as SupabaseClient<Database>

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  const body = await c.req.json()
  const parsed = ManualTimeEntryInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400)
  }

  const { date, start_time, end_time, break_minutes, project_task, notes } = parsed.data

  // Combine date and time
  const clockInAt = new Date(`${date}T${start_time}`)
  const clockOutAt = new Date(`${date}T${end_time}`)

  // Validate times
  if (clockOutAt <= clockInAt) {
    return c.json({ error: 'End time must be after start time' }, 400)
  }

  // Check for overlaps
  const hasOverlap = await checkTimeEntryOverlap(
    user.id,
    tenantId,
    clockInAt,
    clockOutAt,
    supabase
  )

  if (hasOverlap) {
    return c.json({ error: 'Time entry overlaps with existing entry' }, 409)
  }

  // Check if approval is required
  const needsApproval = await requiresApproval(
    new Date(date),
    'manual',
    user.id,
    supabase
  )

  const approvalStatus = needsApproval ? 'pending' : 'approved'
  const approverUserId = needsApproval ? null : user.id
  const approvedAt = needsApproval ? null : new Date().toISOString()

  // Create time entry
  const { data: entry, error } = await supabase
    .from('time_entries')
    .insert({
      tenant_id: tenantId,
      user_id: user.id,
      clock_in_at: clockInAt.toISOString(),
      clock_out_at: clockOutAt.toISOString(),
      break_minutes: break_minutes || 0,
      project_task: project_task || null,
      notes: notes || null,
      entry_type: 'manual',
      approval_status: approvalStatus,
      approver_user_id: approverUserId,
      approved_at: approvedAt,
    })
    .select('*')
    .single()

  if (error) return c.json({ error: error.message }, 400)

  return c.json(entry)
})

// List time entries with filters
app.get('/api/time/entries', async (c) => {
  const user = c.get('user') as User
  const supabase = c.get('supabase') as SupabaseClient<Database>

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  const url = new URL(c.req.url)
  const query = {
    user_id: url.searchParams.get('user_id') || undefined,
    start_date: url.searchParams.get('start_date') || undefined,
    end_date: url.searchParams.get('end_date') || undefined,
    status: url.searchParams.get('status') || undefined,
    entry_type: url.searchParams.get('entry_type') || undefined,
    project_task: url.searchParams.get('project_task') || undefined,
    page: parseInt(url.searchParams.get('page') || '1'),
    page_size: parseInt(url.searchParams.get('page_size') || '20'),
  }

  const parsed = TimeEntryListQuerySchema.safeParse(query)
  if (!parsed.success) {
    return c.json({ error: 'Invalid query parameters', details: parsed.error.issues }, 400)
  }

  const { user_id, start_date, end_date, status, entry_type, project_task, page, page_size } = parsed.data

  // Build query
  let queryBuilder = supabase
    .from('time_entries')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)

  // Apply filters
  if (user_id) {
    // Check if user can view other users' entries
    if (user_id !== user.id) {
      try {
        await ensurePermission(supabase, tenantId, 'time.view_team')
      } catch {
        return c.json({ error: 'Forbidden' }, 403)
      }
    }
    queryBuilder = queryBuilder.eq('user_id', user_id)
  } else {
    // Default to current user's entries
    queryBuilder = queryBuilder.eq('user_id', user.id)
  }

  if (start_date) {
    queryBuilder = queryBuilder.gte('clock_in_at', start_date)
  }
  if (end_date) {
    queryBuilder = queryBuilder.lte('clock_in_at', end_date)
  }
  if (status) {
    queryBuilder = queryBuilder.eq('approval_status', status)
  }
  if (entry_type) {
    queryBuilder = queryBuilder.eq('entry_type', entry_type)
  }
  if (project_task) {
    queryBuilder = queryBuilder.ilike('project_task', `%${project_task}%`)
  }

  // Apply pagination
  const from = (page - 1) * page_size
  const to = from + page_size - 1
  queryBuilder = queryBuilder.range(from, to).order('clock_in_at', { ascending: false })

  const { data: entries, error, count } = await queryBuilder

  if (error) return c.json({ error: error.message }, 400)

  const totalPages = Math.ceil((count || 0) / page_size)

  const response = {
    entries: entries || [],
    pagination: {
      page,
      page_size,
      total: count || 0,
      total_pages: totalPages,
    },
  }

  const parsedResponse = TimeEntryListResponseSchema.safeParse(response)
  if (!parsedResponse.success) {
    return c.json({ error: 'Unexpected response shape' }, 500)
  }

  return c.json(parsedResponse.data)
})

// Update time entry
app.put('/api/time/entries/:id', async (c) => {
  const user = c.get('user') as User
  const supabase = c.get('supabase') as SupabaseClient<Database>

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  const entryId = c.req.param('id')
  const body = await c.req.json()
  const parsed = TimeEntryUpdateInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400)
  }

  // Get existing entry
  const { data: existing, error: fetchError } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', entryId)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError) return c.json({ error: fetchError.message }, 400)
  if (!existing) return c.json({ error: 'Time entry not found' }, 404)

  // Check permissions
  if (existing.user_id !== user.id) {
    try {
      await ensurePermission(supabase, tenantId, 'time.view_team')
    } catch {
      return c.json({ error: 'Forbidden' }, 403)
    }
  }

  // Check if editing past entries requires special permission
  const entryDate = new Date(existing.clock_in_at)
  if (entryDate < new Date() && existing.entry_type === 'manual') {
    try {
      await ensurePermission(supabase, tenantId, 'time.edit_past')
    } catch {
      return c.json({ error: 'Editing past manual entries requires special permission' }, 403)
    }
  }

  const { start_time, end_time, break_minutes, project_task, notes, change_reason } = parsed.data

  // Build update object
  const updates: any = {}
  const changes: Array<{ field: string; old: any; new: any }> = []

  if (start_time !== undefined) {
    const newClockIn = new Date(`${entryDate.toISOString().split('T')[0]}T${start_time}`)
    updates.clock_in_at = newClockIn.toISOString()
    changes.push({ field: 'clock_in_at', old: existing.clock_in_at, new: updates.clock_in_at })
  }

  if (end_time !== undefined) {
    const newClockOut = new Date(`${entryDate.toISOString().split('T')[0]}T${end_time}`)
    updates.clock_out_at = newClockOut.toISOString()
    changes.push({ field: 'clock_out_at', old: existing.clock_out_at, new: updates.clock_out_at })
  }

  if (break_minutes !== undefined) {
    updates.break_minutes = break_minutes
    changes.push({ field: 'break_minutes', old: existing.break_minutes, new: break_minutes })
  }

  if (project_task !== undefined) {
    updates.project_task = project_task
    changes.push({ field: 'project_task', old: existing.project_task, new: project_task })
  }

  if (notes !== undefined) {
    updates.notes = notes
    changes.push({ field: 'notes', old: existing.notes, new: notes })
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No changes provided' }, 400)
  }

  // Validate new times if both are provided
  if (updates.clock_in_at && updates.clock_out_at) {
    const newClockIn = new Date(updates.clock_in_at)
    const newClockOut = new Date(updates.clock_out_at)
    if (newClockOut <= newClockIn) {
      return c.json({ error: 'End time must be after start time' }, 400)
    }
  }

  // Check for overlaps with new times
  const finalClockIn = updates.clock_in_at ? new Date(updates.clock_in_at) : new Date(existing.clock_in_at)
  const finalClockOut = updates.clock_out_at ? new Date(updates.clock_out_at) : new Date(existing.clock_out_at || existing.clock_in_at)

  const hasOverlap = await checkTimeEntryOverlap(
    existing.user_id,
    tenantId,
    finalClockIn,
    finalClockOut,
    supabase,
    entryId
  )

  if (hasOverlap) {
    return c.json({ error: 'Time entry overlaps with existing entry' }, 409)
  }

  // Update entry
  updates.edited_by = user.id
  updates.updated_at = new Date().toISOString()

  const { data: updated, error: updateError } = await supabase
    .from('time_entries')
    .update(updates)
    .eq('id', entryId)
    .select('*')
    .single()

  if (updateError) return c.json({ error: updateError.message }, 400)

  // Create audit log entries
  for (const change of changes) {
    await createAuditLog(
      entryId,
      user.id,
      change.field,
      change.old,
      change.new,
      change_reason,
      supabase
    )
  }

  return c.json(updated)
})

// Delete time entry
app.delete('/api/time/entries/:id', async (c) => {
  const user = c.get('user') as User
  const supabase = c.get('supabase') as SupabaseClient<Database>

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  const entryId = c.req.param('id')

  // Get existing entry
  const { data: existing, error: fetchError } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', entryId)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError) return c.json({ error: fetchError.message }, 400)
  if (!existing) return c.json({ error: 'Time entry not found' }, 404)

  // Check permissions
  if (existing.user_id !== user.id) {
    try {
      await ensurePermission(supabase, tenantId, 'time.view_team')
    } catch {
      return c.json({ error: 'Forbidden' }, 403)
    }
  }

  // Soft delete by setting approval_status to 'rejected'
  const { error: updateError } = await supabase
    .from('time_entries')
    .update({
      approval_status: 'rejected',
      edited_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)

  if (updateError) return c.json({ error: updateError.message }, 400)

  // Create audit log
  await createAuditLog(
    entryId,
    user.id,
    'approval_status',
    existing.approval_status,
    'rejected',
    'Entry deleted',
    supabase
  )

  return c.json({ success: true })
})

// ==============================================
// Approval Workflow Endpoints
// ==============================================

// Get pending approvals for manager's team
app.get('/api/time/entries/pending', async (c) => {
  const user = c.get('user') as User
  const supabase = c.get('supabase') as SupabaseClient<Database>

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  try {
    await ensurePermission(supabase, tenantId, 'time.approve')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, 403)
  }

  const url = new URL(c.req.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const pageSize = parseInt(url.searchParams.get('page_size') || '20')

  // Get pending approvals using the view
  const { data: approvals, error, count } = await supabase
    .from('pending_time_approvals')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (error) return c.json({ error: error.message }, 400)

  const response = {
    approvals: approvals || [],
    pagination: {
      page,
      page_size: pageSize,
      total: count || 0,
    },
  }

  const parsed = PendingApprovalsResponseSchema.safeParse(response)
  if (!parsed.success) {
    return c.json({ error: 'Unexpected response shape' }, 500)
  }

  return c.json(parsed.data)
})

// Approve/reject time entry
app.put('/api/time/entries/:id/approve', async (c) => {
  const user = c.get('user') as User
  const supabase = c.get('supabase') as SupabaseClient<Database>

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  try {
    await ensurePermission(supabase, tenantId, 'time.approve')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, 403)
  }

  const entryId = c.req.param('id')
  const body = await c.req.json()
  const parsed = TimeEntryApprovalInputSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400)
  }

  const { decision, reason } = parsed.data

  // Get existing entry
  const { data: existing, error: fetchError } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', entryId)
    .eq('tenant_id', tenantId)
    .eq('approval_status', 'pending')
    .single()

  if (fetchError) return c.json({ error: fetchError.message }, 400)
  if (!existing) return c.json({ error: 'Pending time entry not found' }, 404)

  // Update entry
  const { data: updated, error: updateError } = await supabase
    .from('time_entries')
    .update({
      approval_status: decision === 'approve' ? 'approved' : 'rejected',
      approver_user_id: user.id,
      approved_at: decision === 'approve' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .select('*')
    .single()

  if (updateError) return c.json({ error: updateError.message }, 400)

  // Create audit log
  await createAuditLog(
    entryId,
    user.id,
    'approval_status',
    'pending',
    decision === 'approve' ? 'approved' : 'rejected',
    reason,
    supabase
  )

  return c.json(updated)
})

// Get audit trail for time entry
app.get('/api/time/entries/:id/audit', async (c) => {
  const user = c.get('user') as User
  const supabase = c.get('supabase') as SupabaseClient<Database>

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  const entryId = c.req.param('id')

  // Check if user can view this entry
  const { data: entry, error: fetchError } = await supabase
    .from('time_entries')
    .select('user_id')
    .eq('id', entryId)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError) return c.json({ error: fetchError.message }, 400)
  if (!entry) return c.json({ error: 'Time entry not found' }, 404)

  if (entry.user_id !== user.id) {
    try {
      await ensurePermission(supabase, tenantId, 'time.view_team')
    } catch {
      return c.json({ error: 'Forbidden' }, 403)
    }
  }

  // Get audit trail
  const { data: audit, error } = await supabase
    .from('time_entry_audit')
    .select('*')
    .eq('time_entry_id', entryId)
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 400)

  return c.json({ audit: audit || [] })
})

// ==============================================
// Overtime Management Endpoints
// ==============================================

// Get current user's overtime balance
app.get('/api/overtime/balance', async (c) => {
  const user = c.get('user') as User
  const supabase = c.get('supabase') as SupabaseClient<Database>

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  try {
    await ensurePermission(supabase, tenantId, 'overtime.view')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, 403)
  }

  const url = new URL(c.req.url)
  const period = url.searchParams.get('period') || getCurrentPeriod()

  const { data: balance, error } = await supabase
    .from('overtime_balances')
    .select('*')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .eq('period', period)
    .single()

  if (error && error.code !== 'PGRST116') {
    return c.json({ error: error.message }, 400)
  }

  if (!balance) {
    // Create default balance if none exists
    const { data: newBalance, error: createError } = await supabase
      .from('overtime_balances')
      .insert({
        user_id: user.id,
        tenant_id: tenantId,
        period,
        regular_hours: 0,
        overtime_hours: 0,
        overtime_multiplier: 1.5,
        carry_over_hours: 0,
      })
      .select()
      .single()

    if (createError) return c.json({ error: createError.message }, 400)
    return c.json(newBalance)
  }

  return c.json(balance)
})

// Get specific user's overtime balance (manager only)
app.get('/api/overtime/balance/:userId', async (c) => {
  const user = c.get('user') as User
  const supabase = c.get('supabase') as SupabaseClient<Database>

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  try {
    await ensurePermission(supabase, tenantId, 'time.view_team')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, 403)
  }

  const targetUserId = c.req.param('userId')
  const url = new URL(c.req.url)
  const period = url.searchParams.get('period') || getCurrentPeriod()

  const { data: balance, error } = await supabase
    .from('overtime_balances')
    .select('*')
    .eq('user_id', targetUserId)
    .eq('tenant_id', tenantId)
    .eq('period', period)
    .single()

  if (error && error.code !== 'PGRST116') {
    return c.json({ error: error.message }, 400)
  }

  if (!balance) {
    return c.json({
      user_id: targetUserId,
      tenant_id: tenantId,
      period,
      regular_hours: 0,
      overtime_hours: 0,
      overtime_multiplier: 1.5,
      carry_over_hours: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  return c.json(balance)
})

// Trigger overtime calculation for period (admin only)
app.post('/api/overtime/calculate', async (c) => {
  const user = c.get('user') as User
  const supabase = c.get('supabase') as SupabaseClient<Database>

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  try {
    await ensurePermission(supabase, tenantId, 'overtime.approve')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, 403)
  }

  const body = await c.req.json()
  const parsed = OvertimeCalculationRequestSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400)
  }

  const { user_id, start_date, end_date } = parsed.data

  const start = new Date(start_date)
  const end = new Date(end_date)

  if (end <= start) {
    return c.json({ error: 'End date must be after start date' }, 400)
  }

  try {
    const { regularHours, overtimeHours } = await calculateOvertimeForPeriod(
      user_id,
      tenantId,
      start,
      end,
      supabase
    )

    // Get or create balance for the period
    const period = getPeriodForDate(start)
    const balance = await getOrCreateOvertimeBalance(user_id, tenantId, period, supabase)

    // Update balance
    const { data: updated, error: updateError } = await supabase
      .from('overtime_balances')
      .update({
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
        updated_at: new Date().toISOString(),
      })
      .eq('id', balance.id)
      .select()
      .single()

    if (updateError) return c.json({ error: updateError.message }, 400)

    return c.json(updated)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Calculation failed'
    return c.json({ error: message }, 500)
  }
})

// Get tenant's overtime rules
app.get('/api/overtime/rules', async (c) => {
  const user = c.get('user') as User
  const supabase = c.get('supabase') as SupabaseClient<Database>

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  try {
    await ensurePermission(supabase, tenantId, 'overtime.view')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, 403)
  }

  const { data: rules, error } = await supabase
    .from('overtime_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 400)

  return c.json({ rules: rules || [] })
})

// Helper function to get current period (e.g., "2025-W10")
function getCurrentPeriod(): string {
  const now = new Date()
  const year = now.getFullYear()
  const week = getWeekNumber(now)
  return `${year}-W${week.toString().padStart(2, '0')}`
}

// Helper function to get period for a specific date
function getPeriodForDate(date: Date): string {
  const year = date.getFullYear()
  const week = getWeekNumber(date)
  return `${year}-W${week.toString().padStart(2, '0')}`
}

// Helper function to get week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// Pending time-off requests for approvers (manager+)
app.get('/api/time-off/requests/pending', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>

  let tenantId: string
  try {
    tenantId = await getPrimaryTenantId(supabase)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
    return c.json({ error: message }, 400)
  }

  try {
    await ensurePermission(supabase, tenantId, 'time_off.approve')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
  }

  const rows = await supabase
    .from('time_off_requests')
    .select('id, user_id, start_date, end_date, leave_type, status, created_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (rows.error) return c.json({ error: rows.error.message }, 400)

  // Enrich with requester display_name
  const enriched = await Promise.all(
    (rows.data ?? []).map(async (r) => {
      const prof = await supabase
        .from('profiles')
        .select('display_name, user_id')
        .eq('user_id', r.user_id)
        .maybeSingle()
      const name = prof.data?.display_name ?? 'Member'
      return { ...r, display_name: name }
    }),
  )

  return c.json({ requests: enriched })
})

// ---------------- Employee Field Definitions endpoints ----------------

app.get('/api/employee-fields/:tenantId', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')

  const canRead = await supabase.rpc('app_has_permission', { permission: 'employees.read', tenant: tenantId })
  if (canRead.error) return c.json({ error: canRead.error.message }, 400)
  if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

  const rows = await supabase
    .from('employee_custom_field_defs')
    .select('id, tenant_id, name, key, type, required, options, position, created_at')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (rows.error) return c.json({ error: rows.error.message }, 400)

  const parsed = rows.data?.map((r) => EmployeeCustomFieldDefSchema.parse(r)) ?? []
  return c.json({ fields: parsed })
})

app.post('/api/employee-fields/:tenantId', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')
  const body = await c.req.json().catch(() => ({}))
  const parsed = EmployeeCustomFieldDefCreateSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
  if (parsed.data.tenant_id !== tenantId) return c.json({ error: 'tenant_id mismatch' }, 400)

  try {
    await ensurePermission(supabase, tenantId, 'employees.fields.manage')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
  }

  const key = slugKey(parsed.data.key)
  const insertPayload: Database['public']['Tables']['employee_custom_field_defs']['Insert'] = {
    tenant_id: tenantId,
    name: parsed.data.name,
    key,
    type: parsed.data.type,
    required: parsed.data.required ?? false,
    options: parsed.data.options ?? null,
    position: parsed.data.position ?? 0,
  }

  const ins = await supabase
    .from('employee_custom_field_defs')
    .insert(insertPayload)
  if (ins.error) return c.json({ error: ins.error.message }, 400)

  return c.redirect(`/api/employee-fields/${tenantId}`)
})

app.put('/api/employee-fields/:tenantId/:id', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const parsed = EmployeeCustomFieldDefUpdateSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)

  try {
    await ensurePermission(supabase, tenantId, 'employees.fields.manage')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
  }

  const upd = await supabase
    .from('employee_custom_field_defs')
    .update(parsed.data)
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (upd.error) return c.json({ error: upd.error.message }, 400)

  return c.redirect(`/api/employee-fields/${tenantId}`)
})

app.delete('/api/employee-fields/:tenantId/:id', async (c) => {
  const supabase = c.get('supabase') as SupabaseClient<Database>
  const tenantId = c.req.param('tenantId')
  const id = c.req.param('id')

  try {
    await ensurePermission(supabase, tenantId, 'employees.fields.manage')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
  }

  const del = await supabase
    .from('employee_custom_field_defs')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (del.error) return c.json({ error: del.error.message }, 400)

  return c.redirect(`/api/employee-fields/${tenantId}`)
})

function slugKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default app
