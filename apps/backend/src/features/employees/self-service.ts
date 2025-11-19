import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@database.types.ts'
import type { User } from '../../types'
import { AuditLogger, findChanges } from '../../lib/audit-logger'
import {
  SelfServiceProfileDraftInputSchema,
  SelfServiceProfileFieldsSchema,
  SelfServiceProfileRequestSchema,
  type SelfServiceProfileFields,
  type SelfServiceProfileRequest,
} from '@vibe/shared'

export const SELF_SERVICE_FIELD_KEYS = [
  'phone_personal',
  'phone_work',
  'emergency_contact_name',
  'emergency_contact_phone',
  'home_address',
] as const

export type EmployeeRow = Database['public']['Tables']['employees']['Row']
export type ProfileRequestRow =
  Database['public']['Tables']['employee_profile_change_requests']['Row']

const FieldsParser = SelfServiceProfileFieldsSchema

export const SelfServiceDraftInputParser = SelfServiceProfileDraftInputSchema

export function extractEmployeeSelfServiceFields(employee: EmployeeRow): SelfServiceProfileFields {
  const payload = {
    phone_personal: employee.phone_personal ?? null,
    phone_work: employee.phone_work ?? null,
    emergency_contact_name: employee.emergency_contact_name ?? null,
    emergency_contact_phone: employee.emergency_contact_phone ?? null,
    home_address: (employee.home_address as Record<string, unknown> | null) ?? null,
  }

  return FieldsParser.parse(payload)
}

export function sanitizeSelfServiceFields(
  fields: Record<string, unknown>,
): SelfServiceProfileFields {
  return FieldsParser.parse(fields)
}

export function buildDiff(
  current: SelfServiceProfileFields,
  next: SelfServiceProfileFields,
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {}

  for (const key of SELF_SERVICE_FIELD_KEYS) {
    const oldValue = current[key] ?? null
    const newValue = next[key] ?? null

    const equal =
      typeof oldValue === 'object' && typeof newValue === 'object'
        ? JSON.stringify(oldValue ?? null) === JSON.stringify(newValue ?? null)
        : oldValue === newValue

    if (!equal) {
      changes[key] = { old: oldValue, new: newValue }
    }
  }

  return changes
}

export function hasSelfServiceChanges(
  current: SelfServiceProfileFields,
  next: SelfServiceProfileFields,
): boolean {
  return Object.keys(buildDiff(current, next)).length > 0
}

export async function applyApprovedProfileChangeRequest({
  supabase,
  request,
  user,
  ipAddress,
  userAgent,
}: {
  supabase: SupabaseClient<Database>
  request: ProfileRequestRow
  user: User
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  const employee = await supabase
    .from('employees')
    .select('*')
    .eq('tenant_id', request.tenant_id)
    .eq('id', request.employee_id)
    .maybeSingle()

  if (employee.error) throw new Error(employee.error.message)
  if (!employee.data) throw new Error('Employee not found for profile update')

  const desired = FieldsParser.parse(request.fields ?? {})
  const current = extractEmployeeSelfServiceFields(employee.data)
  const diff = buildDiff(current, desired)
  if (Object.keys(diff).length === 0) {
    return
  }

  const updatePayload: Database['public']['Tables']['employees']['Update'] = {}
  if ('phone_personal' in diff) {
    updatePayload.phone_personal = desired.phone_personal
  }
  if ('phone_work' in diff) {
    updatePayload.phone_work = desired.phone_work
  }
  if ('emergency_contact_name' in diff) {
    updatePayload.emergency_contact_name = desired.emergency_contact_name
  }
  if ('emergency_contact_phone' in diff) {
    updatePayload.emergency_contact_phone = desired.emergency_contact_phone
  }
  if ('home_address' in diff) {
    updatePayload.home_address = desired.home_address
      ? (desired.home_address as unknown as Database['public']['Tables']['employees']['Insert']['home_address'])
      : null
  }

  const updated = await supabase
    .from('employees')
    .update(updatePayload)
    .eq('tenant_id', request.tenant_id)
    .eq('id', request.employee_id)
    .select()
    .single()

  if (updated.error) throw new Error(updated.error.message)

  const auditLogger = new AuditLogger(supabase)
  const changes = findChanges(employee.data, updated.data)
  if (Object.keys(changes).length > 0) {
    await auditLogger.logEmployeeUpdate(
      request.tenant_id,
      request.employee_id,
      user.id,
      changes,
      'Self-service profile change approval',
      ipAddress,
      userAgent,
    )
  }
}

export async function fetchLatestProfileRequest(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  employeeId: string,
): Promise<ProfileRequestRow | null> {
  const query = await supabase
    .from('employee_profile_change_requests')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (query.error && query.error.code !== 'PGRST116') throw new Error(query.error.message)
  return query.data ?? null
}

export async function assertNoPendingProfileRequest(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  employeeId: string,
): Promise<void> {
  const existing = await supabase
    .from('employee_profile_change_requests')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('status', 'pending')
    .maybeSingle()
  if (existing.error && existing.error.code !== 'PGRST116') throw new Error(existing.error.message)
  if (existing.data) {
    throw new Error('A profile change request is already awaiting approval.')
  }
}

export function mapRequestRowToSharedSchema(row: ProfileRequestRow): SelfServiceProfileRequest {
  return SelfServiceProfileRequestSchema.parse({
    ...row,
    fields: FieldsParser.parse(row.fields ?? {}),
    current_snapshot: FieldsParser.parse(row.current_snapshot ?? {}),
  })
}

export async function upsertProfileDraft({
  supabase,
  tenantId,
  employeeId,
  userId,
  fields,
  justification,
  snapshot,
}: {
  supabase: SupabaseClient<Database>
  tenantId: string
  employeeId: string
  userId: string
  fields: SelfServiceProfileFields
  justification: string | null
  snapshot: SelfServiceProfileFields
}): Promise<ProfileRequestRow> {
  const existing = await supabase
    .from('employee_profile_change_requests')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('status', 'draft')
    .maybeSingle()
  if (existing.error && existing.error.code !== 'PGRST116') throw new Error(existing.error.message)

  if (existing.data) {
    const updated = await supabase
      .from('employee_profile_change_requests')
      .update({
        fields,
        justification,
        current_snapshot: snapshot,
        submitted_by_user_id: userId,
      })
      .eq('id', existing.data.id)
      .select('*')
      .single()
    if (updated.error) throw new Error(updated.error.message)
    return updated.data
  }

  const inserted = await supabase
    .from('employee_profile_change_requests')
    .insert({
      tenant_id: tenantId,
      employee_id: employeeId,
      status: 'draft',
      fields,
      justification,
      current_snapshot: snapshot,
      submitted_by_user_id: userId,
    })
    .select('*')
    .single()
  if (inserted.error) throw new Error(inserted.error.message)
  return inserted.data
}

export async function updateProfileRequestFromApproval({
  supabase,
  approvalRequestId,
  decision,
  decisionReason,
  user,
  ipAddress,
  userAgent,
}: {
  supabase: SupabaseClient<Database>
  approvalRequestId: string
  decision: 'approved' | 'denied' | 'cancelled'
  decisionReason: string | null
  user: User
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  const { data: profileRequest, error } = await supabase
    .from('employee_profile_change_requests')
    .select('*')
    .eq('approval_request_id', approvalRequestId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!profileRequest) return

  if (decision === 'approved') {
    await applyApprovedProfileChangeRequest({
      supabase,
      request: profileRequest,
      user,
      ipAddress,
      userAgent,
    })
  }

  const { error: updateError } = await supabase
    .from('employee_profile_change_requests')
    .update({
      status: decision,
      decided_at: new Date().toISOString(),
      decision_reason: decisionReason,
      approver_user_id: user.id,
    })
    .eq('id', profileRequest.id)
  if (updateError) throw new Error(updateError.message)
}
