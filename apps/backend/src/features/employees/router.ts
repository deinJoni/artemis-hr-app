import type { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  BulkDeleteInputSchema,
  BulkOperationResultSchema,
  BulkStatusUpdateInputSchema,
  DepartmentCreateInputSchema,
  DepartmentHierarchyResponseSchema,
  DepartmentListResponseSchema,
  DepartmentSchema,
  DepartmentUpdateInputSchema,
  EmployeeAuditLogResponseSchema,
  EmployeeAuditLogSchema,
  EmployeeCreateInputSchema,
  EmployeeCustomFieldDefCreateSchema,
  EmployeeCustomFieldDefSchema,
  EmployeeCustomFieldDefUpdateSchema,
  DocumentCategoryEnum,
  DocumentExpiryFilterEnum,
  DocumentStatusFilterEnum,
  EmployeeDetailResponseSchema,
  EmployeeDocumentSchema,
  EmployeeDocumentListResponseSchema,
  EmployeeListResponseSchema,
  EmployeeManagerOptionSchema,
  EmployeeNoteCreateSchema,
  EmployeeNoteSchema,
  EmployeeNoteUpdateSchema,
  EmployeeSortColumnEnum,
  EmployeeUpdateInputSchema,
  SelfServiceProfileResponseSchema,
  OfficeLocationCreateInputSchema,
  OfficeLocationListResponseSchema,
  OfficeLocationSchema,
  OfficeLocationUpdateInputSchema,
  OrgHierarchyResponseSchema,
  OrgStructureResponseSchema,
  ReportingLinesResponseSchema,
  TeamCreateInputSchema,
  TeamListResponseSchema,
  TeamMembersAddInputSchema,
  TeamSchema,
  TeamUpdateInputSchema,
  TeamWithMembersSchema,
  type Department,
  type DepartmentCreateInput,
  type DepartmentUpdateInput,
  type EmployeeAuditLog,
  type EmployeeCustomFieldType,
  type EmployeeDocument,
  type EmployeeDocumentStats,
  type EmployeeNote,
} from '@vibe/shared'

import type { Database, Json } from '@database.types.ts'
import type { User } from '../../types'

import { AuditLogger, extractRequestInfo, findChanges } from '../../lib/audit-logger'
import { getEmployeeForUser, getPrimaryTenantId } from '../../lib/tenant-context'
import { supabaseAdmin } from '../../lib/supabase'
import { WorkflowEngine } from '../../lib/workflow-engine'
import type { Env } from '../../types'
import { DOCUMENT_BUCKET } from './utils/storage'
import {
  EmployeeDocumentUploadError,
  parseDocumentMetadata,
  saveEmployeeDocument,
} from './services/document-upload'
import {
  SELF_SERVICE_FIELD_KEYS,
  SelfServiceDraftInputParser,
  assertNoPendingProfileRequest,
  buildDiff,
  extractEmployeeSelfServiceFields,
  fetchLatestProfileRequest,
  mapRequestRowToSharedSchema,
  upsertProfileDraft,
} from './self-service'

const SELF_SERVICE_ALLOWED_FIELDS = [...SELF_SERVICE_FIELD_KEYS]

async function buildSelfServiceProfilePayload({
  supabase,
  tenantId,
  employee,
}: {
  supabase: SupabaseClient<Database>
  tenantId: string
  employee: Database['public']['Tables']['employees']['Row']
}) {
  const latest = await fetchLatestProfileRequest(supabase, tenantId, employee.id)

  const payload = SelfServiceProfileResponseSchema.safeParse({
    employee: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      phone_personal: employee.phone_personal ?? null,
      phone_work: employee.phone_work ?? null,
      emergency_contact_name: employee.emergency_contact_name ?? null,
      emergency_contact_phone: employee.emergency_contact_phone ?? null,
      home_address: (employee.home_address as Record<string, unknown> | null) ?? null,
    },
    request: latest ? mapRequestRowToSharedSchema(latest) : null,
    allowed_fields: SELF_SERVICE_ALLOWED_FIELDS,
  })

  if (!payload.success) throw new Error('Unexpected response shape')
  return payload.data
}

export const registerEmployeeRoutes = (app: Hono<Env>) => {
  app.get('/api/employees/:tenantId/:id', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const employeeId = c.req.param('id')
    
    // Reject "export" as an employee ID to avoid route conflicts
    if (employeeId === 'export') {
      return c.json({ error: 'Employee not found' }, 404)
    }

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
    let notes: EmployeeNote[] = []
    if (canViewDocs.data) {
      const docs = await supabase
        .from('employee_documents')
        .select(
          'id, tenant_id, employee_id, storage_path, file_name, mime_type, file_size, uploaded_by, uploaded_at, description, version, previous_version_id, is_current, category, expiry_date, updated_at',
        )
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .order('is_current', { ascending: false })
        .order('uploaded_at', { ascending: false })
      if (docs.error) return c.json({ error: docs.error.message }, 400)
      const parsedDocs = EmployeeDocumentSchema.array().safeParse(docs.data ?? [])
      if (!parsedDocs.success) return c.json({ error: 'Unexpected response shape' }, 500)
      documents = parsedDocs.data

      const notesRes = await supabase
        .from('employee_notes')
        .select('id, tenant_id, employee_id, body, created_by, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })
      if (notesRes.error) return c.json({ error: notesRes.error.message }, 400)
      const parsedNotes = EmployeeNoteSchema.array().safeParse(notesRes.data ?? [])
      if (!parsedNotes.success) return c.json({ error: 'Unexpected response shape' }, 500)
      notes = parsedNotes.data
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

    // Fetch office location information if employee has an office location
    let officeLocation = null
    if (employee.data.office_location_id) {
      const location = await supabase
        .from('office_locations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', employee.data.office_location_id)
        .maybeSingle()
      if (location.error) return c.json({ error: location.error.message }, 400)
      if (location.data) {
        const parsedLocation = OfficeLocationSchema.safeParse(location.data)
        if (!parsedLocation.success) return c.json({ error: 'Unexpected response shape' }, 500)
        officeLocation = parsedLocation.data
      }
    }

    // Fetch teams that this employee belongs to
    const teamMembers = await supabase
      .from('team_members')
      .select('team_id')
      .eq('employee_id', employeeId)
    if (teamMembers.error) return c.json({ error: teamMembers.error.message }, 400)
    
    let teams: any[] = []
    if (teamMembers.data && teamMembers.data.length > 0) {
      const teamIds = teamMembers.data.map((tm: { team_id: string }) => tm.team_id)
      const teamsResult = await supabase
        .from('teams')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('id', teamIds)
      if (teamsResult.error) return c.json({ error: teamsResult.error.message }, 400)
      if (teamsResult.data) {
        const parsedTeams = TeamSchema.array().safeParse(teamsResult.data)
        if (!parsedTeams.success) return c.json({ error: 'Unexpected response shape' }, 500)
        teams = parsedTeams.data
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

    const managerOptions = (managerRows.data ?? []).map((row: { id: string; name?: string | null; email?: string | null }) => ({
      id: row.id,
      label: row.name?.length ? row.name : row.email,
    }))
    const parsedManagers = EmployeeManagerOptionSchema.array().safeParse(managerOptions)
    if (!parsedManagers.success) return c.json({ error: 'Unexpected response shape' }, 500)

    const payload = EmployeeDetailResponseSchema.safeParse({
      employee: employee.data,
      customFieldDefs: fieldDefs.data ?? [],
      documents,
      notes: canViewDocs.data ? notes : undefined,
      managerOptions: parsedManagers.data,
      department,
      officeLocation,
      teams,
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

    const url = new URL(c.req.url)
    const rawCategory = url.searchParams.get('category')
    let categoryFilter: string | null = null
    if (rawCategory) {
      const parsedCategory = DocumentCategoryEnum.safeParse(rawCategory)
      if (!parsedCategory.success) {
        return c.json({ error: 'Invalid category filter' }, 400)
      }
      categoryFilter = parsedCategory.data
    }

    const rawStatus = url.searchParams.get('status') ?? 'all'
    const statusParsed = DocumentStatusFilterEnum.safeParse(rawStatus)
    const status = statusParsed.success ? statusParsed.data : 'all'

    const rawExpiry = url.searchParams.get('expiry') ?? 'all'
    const expiryParsed = DocumentExpiryFilterEnum.safeParse(rawExpiry)
    const expiry = expiryParsed.success ? expiryParsed.data : 'all'

    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    const soon = new Date(today)
    soon.setDate(soon.getDate() + 30)
    const soonStr = soon.toISOString().slice(0, 10)

    let docQuery = supabase
      .from('employee_documents')
      .select(
        'id, tenant_id, employee_id, storage_path, file_name, mime_type, file_size, uploaded_by, uploaded_at, description, version, previous_version_id, is_current, category, expiry_date, updated_at',
      )
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .order('is_current', { ascending: false })
      .order('uploaded_at', { ascending: false })

    if (categoryFilter) {
      docQuery = docQuery.eq('category', categoryFilter)
    }
    if (status === 'current') {
      docQuery = docQuery.eq('is_current', true)
    } else if (status === 'archived') {
      docQuery = docQuery.eq('is_current', false)
    }
    if (expiry === 'expired') {
      docQuery = docQuery.lte('expiry_date', todayStr).not('expiry_date', 'is', null)
    } else if (expiry === 'expiring') {
      docQuery = docQuery.gt('expiry_date', todayStr).lte('expiry_date', soonStr).not('expiry_date', 'is', null)
    }

    const docs = await docQuery
    if (docs.error) return c.json({ error: docs.error.message }, 400)

    const parsed = EmployeeDocumentSchema.array().safeParse(docs.data ?? [])
    if (!parsed.success) return c.json({ error: 'Unexpected response shape' }, 500)

    const statsQuery = await supabase
      .from('employee_documents')
      .select('id, is_current, category, expiry_date')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
    if (statsQuery.error) return c.json({ error: statsQuery.error.message }, 400)
    const statsRows = statsQuery.data ?? []
    const stats = statsRows.reduce<EmployeeDocumentStats>(
      (acc, doc) => {
        acc.total += 1
        if (doc.is_current) acc.current += 1
        else acc.archived += 1
        if (doc.category) {
          acc.categories[doc.category] = (acc.categories[doc.category] ?? 0) + 1
        }
        if (doc.expiry_date) {
          if (doc.expiry_date <= todayStr) {
            acc.expired += 1
          } else if (doc.expiry_date > todayStr && doc.expiry_date <= soonStr) {
            acc.expiringSoon += 1
          }
        }
        return acc
      },
      {
        total: 0,
        current: 0,
        archived: 0,
        categories: {},
        expiringSoon: 0,
        expired: 0,
      } as EmployeeDocumentStats,
    )

    const response = EmployeeDocumentListResponseSchema.safeParse({
      documents: parsed.data,
      filters: {
        category: categoryFilter,
        status,
        expiry,
      },
      stats,
    })
    if (!response.success) return c.json({ error: 'Unexpected response shape' }, 500)
    return c.json(response.data)
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

    let metadata: ReturnType<typeof parseDocumentMetadata>
    try {
      metadata = parseDocumentMetadata(body)
    } catch (error) {
      if (error instanceof EmployeeDocumentUploadError) {
        return c.json({ error: error.message }, error.status)
      }
      return c.json({ error: 'Invalid metadata' }, 400)
    }

    const { ipAddress, userAgent } = extractRequestInfo(c.req)

    try {
      const document = await saveEmployeeDocument({
        supabase,
        tenantId,
        employeeId,
        file,
        uploadedBy: user.id,
        description: metadata.description,
        category: metadata.category,
        expiryDate: metadata.expiryDate,
        ipAddress,
        userAgent,
      })
      return c.json(document, 201)
    } catch (error) {
      if (error instanceof EmployeeDocumentUploadError) {
        return c.json({ error: error.message }, error.status)
      }
      return c.json({ error: 'Unable to upload document' }, 400)
    }
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

    const accept = c.req.header('accept') ?? ''
    if (accept.includes('application/json')) {
      return c.json({ url: signedUrlRes.data.signedUrl, fileName: existing.data.file_name })
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
      .select(
        'id, tenant_id, employee_id, storage_path, file_name, mime_type, file_size, uploaded_by, uploaded_at, description, version, previous_version_id, is_current, category, expiry_date, updated_at',
      )
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

    if (existing.data.is_current) {
      const replacement = await supabase
        .from('employee_documents')
        .select(
          'id, tenant_id, employee_id, storage_path, file_name, mime_type, file_size, uploaded_by, uploaded_at, description, version, previous_version_id, is_current, category, expiry_date, updated_at',
        )
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .eq('file_name', existing.data.file_name)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (replacement.data) {
        await supabase
          .from('employee_documents')
          .update({ is_current: true, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('employee_id', employeeId)
          .eq('id', replacement.data.id)
      }
    }

    // Attempt storage removal (best-effort)
    await supabaseAdmin.storage
      .from(DOCUMENT_BUCKET)
      .remove([existing.data.storage_path])
      .catch(() => undefined)

    const user = c.get('user') as User
    const { ipAddress, userAgent } = extractRequestInfo(c.req)
    const auditLogger = new AuditLogger(supabase)
    await auditLogger.logDocumentAction(
      tenantId,
      employeeId,
      user.id,
      'document_removed',
      existing.data,
      ipAddress,
      userAgent,
    )

    return c.json({ ok: true })
  })

  app.get('/api/employees/:tenantId/:id/notes', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const employeeId = c.req.param('id')

    const canRead = await supabase.rpc('app_has_permission', { permission: 'employees.documents.read', tenant: tenantId })
    if (canRead.error) return c.json({ error: canRead.error.message }, 400)
    if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

    const notes = await supabase
      .from('employee_notes')
      .select('id, tenant_id, employee_id, body, created_by, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })

    if (notes.error) return c.json({ error: notes.error.message }, 400)
    const parsed = EmployeeNoteSchema.array().safeParse(notes.data ?? [])
    if (!parsed.success) return c.json({ error: 'Unexpected response shape' }, 500)
    return c.json({ notes: parsed.data })
  })

  app.post('/api/employees/:tenantId/:id/notes', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const employeeId = c.req.param('id')
    const user = c.get('user') as User

    const canWrite = await supabase.rpc('app_has_permission', { permission: 'employees.documents.write', tenant: tenantId })
    if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
    if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)

    const body = await c.req.json().catch(() => ({}))
    const parsed = EmployeeNoteCreateSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const normalizedBody = parsed.data.body.trim()
    if (!normalizedBody) {
      return c.json({ error: 'Note cannot be empty' }, 400)
    }

    const inserted = await supabase
      .from('employee_notes')
      .insert({
        tenant_id: tenantId,
        employee_id: employeeId,
        body: normalizedBody,
        created_by: user.id,
      })
      .select('id, tenant_id, employee_id, body, created_by, created_at, updated_at')
      .single()

    if (inserted.error || !inserted.data) {
      return c.json({ error: inserted.error?.message ?? 'Unable to save note' }, 400)
    }

    const parsedNote = EmployeeNoteSchema.safeParse(inserted.data)
    if (!parsedNote.success) return c.json({ error: 'Unexpected response shape' }, 500)
    return c.json(parsedNote.data, 201)
  })

  app.put('/api/employees/:tenantId/:id/notes/:noteId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const employeeId = c.req.param('id')
    const noteId = c.req.param('noteId')

    const canWrite = await supabase.rpc('app_has_permission', { permission: 'employees.documents.write', tenant: tenantId })
    if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
    if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)

    const existing = await supabase
      .from('employee_notes')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('id', noteId)
      .maybeSingle()
    if (existing.error) return c.json({ error: existing.error.message }, 400)
    if (!existing.data) return c.json({ error: 'Note not found' }, 404)

    const payload = await c.req.json().catch(() => ({}))
    const parsed = EmployeeNoteUpdateSchema.safeParse(payload)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const normalizedBody = parsed.data.body.trim()
    if (!normalizedBody) return c.json({ error: 'Note cannot be empty' }, 400)

    const updated = await supabase
      .from('employee_notes')
      .update({ body: normalizedBody, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('id', noteId)
      .select('id, tenant_id, employee_id, body, created_by, created_at, updated_at')
      .maybeSingle()
    if (updated.error) return c.json({ error: updated.error.message }, 400)
    if (!updated.data) return c.json({ error: 'Unable to update note' }, 400)

    const parsedNote = EmployeeNoteSchema.safeParse(updated.data)
    if (!parsedNote.success) return c.json({ error: 'Unexpected response shape' }, 500)
    return c.json(parsedNote.data)
  })

  app.delete('/api/employees/:tenantId/:id/notes/:noteId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const employeeId = c.req.param('id')
    const noteId = c.req.param('noteId')

    const canWrite = await supabase.rpc('app_has_permission', { permission: 'employees.documents.write', tenant: tenantId })
    if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
    if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)

    const existing = await supabase
      .from('employee_notes')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('id', noteId)
      .maybeSingle()
    if (existing.error) return c.json({ error: existing.error.message }, 400)
    if (!existing.data) return c.json({ error: 'Note not found' }, 404)

    const deleted = await supabase
      .from('employee_notes')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('id', noteId)
    if (deleted.error) return c.json({ error: deleted.error.message }, 400)

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
    const departmentId = url.searchParams.get('departmentId') ?? null
    const officeLocationId = url.searchParams.get('officeLocationId') ?? null
    const status = url.searchParams.get('status') ?? null
    const employmentType = url.searchParams.get('employmentType') ?? null

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
      .from('employees_public')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)

    if (search.length > 0) {
      const term = escapeLike(search)
      query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`)
    }

    if (departmentId) {
      query = query.eq('department_id', departmentId)
    }

    if (officeLocationId) {
      query = query.eq('office_location_id', officeLocationId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (employmentType) {
      query = query.eq('employment_type', employmentType)
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
    
    // Debug: Log incoming payload
    console.log('Backend received body:', JSON.stringify(body, null, 2))
    console.log('Backend body.job_title:', body.job_title)
    console.log('Backend body.salary_currency:', body.salary_currency)
    
    const parsed = EmployeeCreateInputSchema.safeParse(body)
    if (!parsed.success) {
      console.log('Backend Zod parse failed:', parsed.error.flatten())
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }
    
    // Debug: Log parsed data
    console.log('Backend parsed.data.job_title:', parsed.data.job_title)
    
    if (parsed.data.tenant_id !== tenantId) return c.json({ error: 'tenant_id mismatch' }, 400)

    const canWrite = await supabase.rpc('app_has_permission', { permission: 'employees.write', tenant: tenantId })
    if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
    if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)

    // 1) Check if user already exists, otherwise invite them
    // Try to invite first - if user exists, Supabase will return an error we can handle
    let newUserId: string | null = null
    let isExistingUser = false

    const invite = await (supabaseAdmin.auth as any).admin.inviteUserByEmail(parsed.data.email, {
      data: { display_name: parsed.data.name },
    })

    if (invite.error) {
      // Check if error indicates user already exists
      // Common Supabase error messages for existing users
      const errorMessage = invite.error.message?.toLowerCase() || ''
      if (errorMessage.includes('already registered') || 
          errorMessage.includes('user already exists') ||
          errorMessage.includes('already been registered')) {
        // User exists, find them by email
        const usersList = await (supabaseAdmin.auth as any).admin.listUsers()
        const userByEmail = usersList.data.users.find((u: { email?: string }) => u.email?.toLowerCase() === parsed.data.email.toLowerCase())
        
        if (userByEmail) {
          newUserId = userByEmail.id
          isExistingUser = true
        } else {
          // User exists but we can't find them - return error
          return c.json({ error: 'User exists but could not be retrieved. Please contact support.' }, 400)
        }
      } else {
        // Different error - return it
        return c.json({ error: invite.error.message || 'Unable to invite user' }, 400)
      }
    } else {
      // Invite succeeded - new user created
      newUserId = invite.data.user?.id || null
    }

    if (!newUserId) return c.json({ error: 'User creation failed: missing id' }, 500)

    // 2) Add membership so the user has access to the tenant (check if exists first)
    const existingMembership = await supabaseAdmin
      .from('memberships')
      .select('user_id, tenant_id')
      .eq('user_id', newUserId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (existingMembership.error) {
      return c.json({ error: existingMembership.error.message }, 400)
    }

    if (!existingMembership.data) {
      // Membership doesn't exist, create it
      const memberIns = await supabaseAdmin
        .from('memberships')
        .insert({ user_id: newUserId, tenant_id: tenantId, role: 'employee' })
      if (memberIns.error) return c.json({ error: memberIns.error.message }, 400)
    }

    // 3) Create or update profile with display name for the user
    const existingProfile = await supabaseAdmin
      .from('profiles')
      .select('user_id, tenant_id')
      .eq('user_id', newUserId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (existingProfile.error) {
      return c.json({ error: existingProfile.error.message }, 400)
    }

    if (!existingProfile.data) {
      // Profile doesn't exist, create it
      const profileIns = await supabaseAdmin
        .from('profiles')
        .insert({ user_id: newUserId, tenant_id: tenantId, display_name: parsed.data.name })
      if (profileIns.error) return c.json({ error: profileIns.error.message }, 400)
    } else {
      // Profile exists, update display name if needed
      const profileUpdate = await supabaseAdmin
        .from('profiles')
        .update({ display_name: parsed.data.name })
        .eq('user_id', newUserId)
        .eq('tenant_id', tenantId)
      if (profileUpdate.error) {
        // Log warning but don't fail - profile update is not critical
        console.warn('Failed to update profile display name:', profileUpdate.error.message)
      }
    }

    // Check if employee already exists for this user/tenant or email/tenant
    const existingEmployeeByUser = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', newUserId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const existingEmployeeByEmail = await supabase
      .from('employees')
      .select('*')
      .eq('email', parsed.data.email)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const existingEmployee = existingEmployeeByUser.data || existingEmployeeByEmail.data
    const existingEmployeeError = existingEmployeeByUser.error || existingEmployeeByEmail.error

    if (existingEmployeeError) {
      return c.json({ error: existingEmployeeError.message }, 400)
    }

    if (existingEmployee) {
      // Employee already exists, return it (but update fields if changed)
      const updatePayload: Partial<Database['public']['Tables']['employees']['Update']> = {}
      if (parsed.data.name !== existingEmployee.name) {
        updatePayload.name = parsed.data.name
      }
      if (parsed.data.email !== existingEmployee.email) {
        updatePayload.email = parsed.data.email
      }
      if (newUserId !== existingEmployee.user_id) {
        updatePayload.user_id = newUserId
      }
      if (parsed.data.manager_id !== undefined && parsed.data.manager_id !== existingEmployee.manager_id) {
        updatePayload.manager_id = parsed.data.manager_id ?? null
      }
      // Update Step 2 fields (Job Title, Department, Employment Type, Start Date)
      if (parsed.data.job_title !== undefined && parsed.data.job_title !== existingEmployee.job_title) {
        updatePayload.job_title = parsed.data.job_title ?? null
      }
      if (parsed.data.department_id !== undefined && parsed.data.department_id !== existingEmployee.department_id) {
        updatePayload.department_id = parsed.data.department_id ?? null
      }
      if (parsed.data.employment_type !== undefined && parsed.data.employment_type !== existingEmployee.employment_type) {
        updatePayload.employment_type = parsed.data.employment_type ?? null
      }
      if (parsed.data.start_date !== undefined && parsed.data.start_date !== existingEmployee.start_date) {
        updatePayload.start_date = parsed.data.start_date ?? null
      }
      if (parsed.data.work_location !== undefined && parsed.data.work_location !== existingEmployee.work_location) {
        updatePayload.work_location = parsed.data.work_location ?? null
      }
      if (parsed.data.office_location_id !== undefined && parsed.data.office_location_id !== existingEmployee.office_location_id) {
        updatePayload.office_location_id = parsed.data.office_location_id ?? null
      }

      if (Object.keys(updatePayload).length > 0) {
        const updated = await supabase
          .from('employees')
          .update(updatePayload)
          .eq('id', existingEmployee.id)
          .select()
          .single()
        if (updated.error) {
          return c.json({ error: updated.error.message }, 400)
        }
        return c.json(updated.data, 200)
      }

      return c.json(existingEmployee, 200)
    }

    // Validate custom_fields against field definitions
    const validatedCustomFields = await validateAndCoerceCustomFields(supabase, tenantId, parsed.data.custom_fields)
    const insertPayload: Database['public']['Tables']['employees']['Insert'] = {
      tenant_id: parsed.data.tenant_id,
      email: parsed.data.email,
      name: parsed.data.name,
      user_id: newUserId,
      manager_id: parsed.data.manager_id ?? null,
      // Use raw body value if Zod didn't parse it (fallback for optional fields)
      job_title: parsed.data.job_title !== undefined ? parsed.data.job_title : (body.job_title || null),
      department_id: parsed.data.department_id !== undefined ? parsed.data.department_id : (body.department_id || null),
      start_date: parsed.data.start_date !== undefined ? parsed.data.start_date : (body.start_date || null),
      employment_type: parsed.data.employment_type !== undefined ? parsed.data.employment_type : (body.employment_type || null),
      work_location: parsed.data.work_location ?? null,
      office_location_id: parsed.data.office_location_id ?? null,
      salary_amount: parsed.data.salary_amount !== undefined ? parsed.data.salary_amount : (body.salary_amount || null),
      salary_currency: parsed.data.salary_currency !== undefined ? parsed.data.salary_currency : (body.salary_currency || null),
      salary_frequency: parsed.data.salary_frequency !== undefined ? parsed.data.salary_frequency : (body.salary_frequency || null),
      custom_fields: validatedCustomFields ?? null,
    }
    
    // Debug: Log insert payload
    console.log('Backend insertPayload.job_title:', insertPayload.job_title)
    console.log('Backend insertPayload.salary_currency:', insertPayload.salary_currency)
    console.log('Backend insertPayload keys:', Object.keys(insertPayload))
    console.log('Backend parsed.data.job_title type:', typeof parsed.data.job_title)
    console.log('Backend parsed.data.salary_currency type:', typeof parsed.data.salary_currency)

    // Try to insert employee - handle duplicate employee_number by retrying with manual number
    let ins = await supabase
      .from('employees')
      .insert(insertPayload)
      .select()
      .single()
    
    // If duplicate employee_number error, generate a unique one manually and retry
    if (ins.error && ins.error.message?.includes('employees_employee_number_key')) {
      // Generate a unique employee_number with timestamp to avoid conflicts
      const year = new Date().getFullYear()
      const timestamp = Date.now().toString().slice(-6) // Last 6 digits of timestamp
      const uniqueEmployeeNumber = `EMP-${year}-${timestamp}`
      
      insertPayload.employee_number = uniqueEmployeeNumber
      ins = await supabase
        .from('employees')
        .insert(insertPayload)
        .select()
        .single()
    }
    
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

    // Trigger onboarding workflows
    console.log('[EMPLOYEE] Employee created, triggering workflows:', {
      employeeId: ins.data.id,
      tenantId,
      name: parsed.data.name,
      email: parsed.data.email,
    })
    try {
      const workflowEngine = new WorkflowEngine(supabase)
      await workflowEngine.handleTrigger({
        type: 'employee.created',
        tenantId,
        employeeId: ins.data.id,
        payload: {
          name: parsed.data.name,
          email: parsed.data.email,
          created_by: user.id,
        },
      })
      console.log('[EMPLOYEE] Workflow trigger completed successfully:', {
        employeeId: ins.data.id,
      })
    } catch (error) {
      // Log but don't fail the employee creation if workflow trigger fails
      console.error('[EMPLOYEE] Failed to trigger onboarding workflows:', {
        employeeId: ins.data.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }

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

    // Check for offboarding trigger (end_date set or status changed to terminated)
    const wasOffboardingTriggered = 
      (!currentEmployee.data.end_date && upd.data.end_date) ||
      (currentEmployee.data.status !== 'terminated' && upd.data.status === 'terminated')

    if (wasOffboardingTriggered) {
      try {
        const workflowEngine = new WorkflowEngine(supabase)
        await workflowEngine.handleTrigger({
          type: 'employee.offboardingScheduled',
          tenantId,
          employeeId: id,
          payload: {
            end_date: upd.data.end_date || currentEmployee.data.end_date,
            status: upd.data.status,
            updated_by: user.id,
          },
        })
      } catch (error) {
        // Log but don't fail the employee update if workflow trigger fails
        console.error('Failed to trigger offboarding workflows:', error)
      }
    }

    return c.redirect(`/api/employees/${tenantId}`)
  })

  app.delete('/api/employees/:tenantId/:id', async (c) => {
    try {
      const supabase = c.get('supabase') as SupabaseClient<Database>
      const user = c.get('user') as User
      const tenantId = c.req.param('tenantId')
      const id = c.req.param('id')

      const canDelete = await supabase.rpc('app_has_permission', { permission: 'employees.delete', tenant: tenantId })
      if (canDelete.error) return c.json({ error: canDelete.error.message }, 400)
      if (!canDelete.data) {
        const canWrite = await supabase.rpc('app_has_permission', { permission: 'employees.write', tenant: tenantId })
        if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
        if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)
      }

      const existingEmployee = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .maybeSingle()
      if (existingEmployee.error) return c.json({ error: existingEmployee.error.message }, 400)
      if (!existingEmployee.data) return c.json({ error: 'Employee not found' }, 404)

      const cleanupResult = await deleteEmployeeWithCleanup({
        supabase,
        tenantId,
        employeeId: id,
      })
      if ('error' in cleanupResult) {
        return c.json({ error: cleanupResult.error }, 400)
      }

      const { ipAddress, userAgent } = extractRequestInfo(c.req)
      const auditLogger = new AuditLogger(supabase)
      await auditLogger.logEmployeeDeletion(tenantId, id, user.id, existingEmployee.data, ipAddress, userAgent)

      return c.json({ success: true })
    } catch (error) {
      console.error('Failed to delete employee', error)
      return c.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        500,
      )
    }
  })

  // Bulk delete employees
  app.delete('/api/employees/:tenantId/bulk', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const tenantId = c.req.param('tenantId')

    const canDelete = await supabase.rpc('app_has_permission', { permission: 'employees.delete', tenant: tenantId })
    if (canDelete.error) return c.json({ error: canDelete.error.message }, 400)
    if (!canDelete.data) {
      // Fallback to write permission if delete permission doesn't exist
      const canWrite = await supabase.rpc('app_has_permission', { permission: 'employees.write', tenant: tenantId })
      if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
      if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = BulkDeleteInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const { employee_ids } = parsed.data

    // Validate all employees belong to tenant
    const { data: employees, error: fetchError } = await supabase
      .from('employees')
      .select('id, name, email')
      .eq('tenant_id', tenantId)
      .in('id', employee_ids)

    if (fetchError) {
      return c.json({ error: fetchError.message }, 400)
    }

    const foundIds = new Set(employees?.map((e: { id: string }) => e.id) || [])
    const notFound = employee_ids.filter((id) => !foundIds.has(id))

    if (notFound.length > 0) {
      return c.json({ error: `Employees not found: ${notFound.join(', ')}` }, 404)
    }

    // Delete employees and create audit logs
    const { ipAddress, userAgent } = extractRequestInfo(c.req)
    const auditLogger = new AuditLogger(supabase)
    const errors: Array<{ employee_id: string; error: string }> = []
    let successCount = 0

    for (const employeeId of employee_ids) {
      try {
        const employee = employees?.find((e: { id: string }) => e.id === employeeId)
        const cleanupResult = await deleteEmployeeWithCleanup({
          supabase,
          tenantId,
          employeeId,
        })

        if ('error' in cleanupResult) {
          errors.push({ employee_id: employeeId, error: cleanupResult.error })
          continue
        }

        successCount++
        // Create audit log
        await auditLogger.logEmployeeDeletion(
          tenantId,
          employeeId,
          user.id,
          employee || null,
          ipAddress,
          userAgent,
        )
      } catch (err) {
        errors.push({
          employee_id: employeeId,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    const result = BulkOperationResultSchema.parse({
      success_count: successCount,
      error_count: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    })

    return c.json(result)
  })

  // Bulk status update
  app.put('/api/employees/:tenantId/bulk/status', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const tenantId = c.req.param('tenantId')

    const canUpdate = await supabase.rpc('app_has_permission', { permission: 'employees.write', tenant: tenantId })
    if (canUpdate.error) return c.json({ error: canUpdate.error.message }, 400)
    if (!canUpdate.data) return c.json({ error: 'Forbidden' }, 403)

    const body = await c.req.json().catch(() => ({}))
    const parsed = BulkStatusUpdateInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const { employee_ids, status, reason } = parsed.data

    // Validate all employees belong to tenant
    const { data: employees, error: fetchError } = await supabase
      .from('employees')
      .select('id, name, email, status')
      .eq('tenant_id', tenantId)
      .in('id', employee_ids)

    if (fetchError) {
      return c.json({ error: fetchError.message }, 400)
    }

    const foundIds = new Set(employees?.map((e: { id: string }) => e.id) || [])
    const notFound = employee_ids.filter((id) => !foundIds.has(id))

    if (notFound.length > 0) {
      return c.json({ error: `Employees not found: ${notFound.join(', ')}` }, 404)
    }

    // Update employees and create audit logs
    const { ipAddress, userAgent } = extractRequestInfo(c.req)
    const auditLogger = new AuditLogger(supabase)
    const errors: Array<{ employee_id: string; error: string }> = []
    let successCount = 0

    for (const employeeId of employee_ids) {
      try {
        const employee = employees?.find((e: { id: string; status?: string | null }) => e.id === employeeId)
        if (!employee) continue

        const oldStatus = employee.status
        if (oldStatus === status) {
          // Already in target status, skip but count as success
          successCount++
          continue
        }

        const update = await supabase
          .from('employees')
          .update({
            status,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)
          .eq('id', employeeId)
          .select()
          .single()

        if (update.error) {
          errors.push({ employee_id: employeeId, error: update.error.message })
        } else {
          successCount++
          // Create audit log
          await auditLogger.logStatusChange(
            tenantId,
            employeeId,
            user.id,
            oldStatus,
            status,
            reason,
            ipAddress,
            userAgent,
          )
        }
      } catch (err) {
        errors.push({
          employee_id: employeeId,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    const result = BulkOperationResultSchema.parse({
      success_count: successCount,
      error_count: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    })

    return c.json(result)
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

  // ---------------- Office Locations endpoints ----------------

  // Get all office locations for a tenant
  app.get('/api/office-locations/:tenantId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')

    const canRead = await supabase.rpc('app_has_permission', { permission: 'office_locations.read', tenant: tenantId })
    if (canRead.error) return c.json({ error: canRead.error.message }, 400)
    if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

    const locations = await supabase
      .from('office_locations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true })

    if (locations.error) return c.json({ error: locations.error.message }, 400)

    const response = OfficeLocationListResponseSchema.parse({
      locations: locations.data || [],
    })

    return c.json(response)
  })

  // Get single office location
  app.get('/api/office-locations/:tenantId/:id', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const locationId = c.req.param('id')

    const canRead = await supabase.rpc('app_has_permission', { permission: 'office_locations.read', tenant: tenantId })
    if (canRead.error) return c.json({ error: canRead.error.message }, 400)
    if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

    const location = await supabase
      .from('office_locations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', locationId)
      .maybeSingle()

    if (location.error) return c.json({ error: location.error.message }, 400)
    if (!location.data) return c.json({ error: 'Office location not found' }, 404)

    return c.json(OfficeLocationSchema.parse(location.data))
  })

  // Create office location
  app.post('/api/office-locations/:tenantId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const body = await c.req.json().catch(() => ({}))
    const parsed = OfficeLocationCreateInputSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    if (parsed.data.tenant_id !== tenantId) return c.json({ error: 'tenant_id mismatch' }, 400)

    const canWrite = await supabase.rpc('app_has_permission', { permission: 'office_locations.write', tenant: tenantId })
    if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
    if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)

    const location = await supabase
      .from('office_locations')
      .insert({
        tenant_id: parsed.data.tenant_id,
        name: parsed.data.name,
        address: parsed.data.address ?? null,
        timezone: parsed.data.timezone ?? 'UTC',
      })
      .select()
      .single()

    if (location.error) return c.json({ error: location.error.message }, 400)

    return c.json(OfficeLocationSchema.parse(location.data))
  })

  // Update office location
  app.put('/api/office-locations/:tenantId/:id', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const locationId = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const parsed = OfficeLocationUpdateInputSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)

    const canWrite = await supabase.rpc('app_has_permission', { permission: 'office_locations.write', tenant: tenantId })
    if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
    if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)

    const location = await supabase
      .from('office_locations')
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', locationId)
      .select()
      .single()

    if (location.error) return c.json({ error: location.error.message }, 400)
    if (!location.data) return c.json({ error: 'Office location not found' }, 404)

    return c.json(OfficeLocationSchema.parse(location.data))
  })

  // Delete office location
  app.delete('/api/office-locations/:tenantId/:id', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const locationId = c.req.param('id')

    const canWrite = await supabase.rpc('app_has_permission', { permission: 'office_locations.write', tenant: tenantId })
    if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
    if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)

    // Check if any employees are assigned to this location
    const employees = await supabase
      .from('employees')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('office_location_id', locationId)
      .limit(1)

    if (employees.error) return c.json({ error: employees.error.message }, 400)
    if (employees.data && employees.data.length > 0) {
      return c.json({ error: 'Cannot delete office location with assigned employees. Please reassign employees first.' }, 400)
    }

    const location = await supabase
      .from('office_locations')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', locationId)

    if (location.error) return c.json({ error: location.error.message }, 400)

    return c.json({ ok: true })
  })

  // ---------------- Teams endpoints ----------------

  // Get all teams for a tenant
  app.get('/api/teams/:tenantId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')

    const canRead = await supabase.rpc('app_has_permission', { permission: 'teams.read', tenant: tenantId })
    if (canRead.error) return c.json({ error: canRead.error.message }, 400)
    if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

    const teams = await supabase
      .from('teams')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true })

    if (teams.error) return c.json({ error: teams.error.message }, 400)

    // Get member counts for each team
    const teamsWithCounts = await Promise.all(
      (teams.data || []).map(async (team: { id: string; [key: string]: unknown }) => {
        const memberCount = await supabase
          .from('team_members')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', team.id)

        return {
          ...team,
          member_count: memberCount.count || 0,
        }
      })
    )

    const response = TeamListResponseSchema.parse({
      teams: teamsWithCounts,
    })

    return c.json(response)
  })

  // Get single team with members
  app.get('/api/teams/:tenantId/:id', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const teamId = c.req.param('id')

    const canRead = await supabase.rpc('app_has_permission', { permission: 'teams.read', tenant: tenantId })
    if (canRead.error) return c.json({ error: canRead.error.message }, 400)
    if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

    const team = await supabase
      .from('teams')
      .select(`
        *,
        team_members(
          employee_id,
          joined_at,
          employees(*)
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('id', teamId)
      .maybeSingle()

    if (team.error) return c.json({ error: team.error.message }, 400)
    if (!team.data) return c.json({ error: 'Team not found' }, 404)

    const members = Array.isArray(team.data.team_members) 
      ? team.data.team_members.map((tm: any) => tm.employees).filter(Boolean)
      : []

    const teamWithMembers = {
      ...team.data,
      team_members: undefined,
      member_count: members.length,
      members,
    }

    return c.json(TeamWithMembersSchema.parse(teamWithMembers))
  })

  // Create team
  app.post('/api/teams/:tenantId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const body = await c.req.json().catch(() => ({}))
    const parsed = TeamCreateInputSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    if (parsed.data.tenant_id !== tenantId) return c.json({ error: 'tenant_id mismatch' }, 400)

    const canWrite = await supabase.rpc('app_has_permission', { permission: 'teams.write', tenant: tenantId })
    if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
    if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)

    const team = await supabase
      .from('teams')
      .insert({
        tenant_id: parsed.data.tenant_id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        team_lead_id: parsed.data.team_lead_id ?? null,
        department_id: parsed.data.department_id ?? null,
        office_location_id: parsed.data.office_location_id ?? null,
      })
      .select()
      .single()

    if (team.error) return c.json({ error: team.error.message }, 400)

    return c.json(TeamSchema.parse(team.data))
  })

  // Update team
  app.put('/api/teams/:tenantId/:id', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const teamId = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const parsed = TeamUpdateInputSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)

    const canWrite = await supabase.rpc('app_has_permission', { permission: 'teams.write', tenant: tenantId })
    if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
    if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)

    const team = await supabase
      .from('teams')
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', teamId)
      .select()
      .single()

    if (team.error) return c.json({ error: team.error.message }, 400)
    if (!team.data) return c.json({ error: 'Team not found' }, 404)

    return c.json(TeamSchema.parse(team.data))
  })

  // Delete team
  app.delete('/api/teams/:tenantId/:id', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const teamId = c.req.param('id')

    const canWrite = await supabase.rpc('app_has_permission', { permission: 'teams.write', tenant: tenantId })
    if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
    if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)

    // Team members will be automatically deleted via CASCADE
    const team = await supabase
      .from('teams')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', teamId)

    if (team.error) return c.json({ error: team.error.message }, 400)

    return c.json({ ok: true })
  })

  // Add members to team
  app.post('/api/teams/:tenantId/:id/members', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const teamId = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const parsed = TeamMembersAddInputSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)

    const canWrite = await supabase.rpc('app_has_permission', { permission: 'teams.write', tenant: tenantId })
    if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
    if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)

    // Verify team exists and belongs to tenant
    const teamCheck = await supabase
      .from('teams')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', teamId)
      .maybeSingle()

    if (teamCheck.error) return c.json({ error: teamCheck.error.message }, 400)
    if (!teamCheck.data) return c.json({ error: 'Team not found' }, 404)

    // Verify all employees belong to tenant
    const employeesCheck = await supabase
      .from('employees')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('id', parsed.data.employee_ids)

    if (employeesCheck.error) return c.json({ error: employeesCheck.error.message }, 400)
    if (employeesCheck.data && employeesCheck.data.length !== parsed.data.employee_ids.length) {
      return c.json({ error: 'One or more employees not found or do not belong to this tenant' }, 400)
    }

    // Insert team members (ignore conflicts for existing members)
    const members = parsed.data.employee_ids.map(employeeId => ({
      team_id: teamId,
      employee_id: employeeId,
    }))

    const insertResult = await supabase
      .from('team_members')
      .upsert(members, { onConflict: 'team_id,employee_id', ignoreDuplicates: false })

    if (insertResult.error) return c.json({ error: insertResult.error.message }, 400)

    return c.json({ ok: true, added: members.length })
  })

  // Remove member from team
  app.delete('/api/teams/:tenantId/:id/members/:employeeId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')
    const teamId = c.req.param('id')
    const employeeId = c.req.param('employeeId')

    const canWrite = await supabase.rpc('app_has_permission', { permission: 'teams.write', tenant: tenantId })
    if (canWrite.error) return c.json({ error: canWrite.error.message }, 400)
    if (!canWrite.data) return c.json({ error: 'Forbidden' }, 403)

    // Verify team exists and belongs to tenant
    const teamCheck = await supabase
      .from('teams')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', teamId)
      .maybeSingle()

    if (teamCheck.error) return c.json({ error: teamCheck.error.message }, 400)
    if (!teamCheck.data) return c.json({ error: 'Team not found' }, 404)

    const result = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('employee_id', employeeId)

    if (result.error) return c.json({ error: result.error.message }, 400)

    return c.json({ ok: true })
  })

  // ---------------- Organizational Structure endpoints ----------------

  // Get complete organizational structure
  app.get('/api/org-structure/:tenantId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')

    const canRead = await supabase.rpc('app_has_permission', { permission: 'employees.read', tenant: tenantId })
    if (canRead.error) return c.json({ error: canRead.error.message }, 400)
    if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

    // Get all active employees with their org structure data
    const orgData = await supabase
      .from('org_structure_view')
      .select('*')
      .eq('tenant_id', tenantId)

    if (orgData.error) return c.json({ error: orgData.error.message }, 400)

    // Transform the view data into nodes
    const nodes = (orgData.data || []).map((row: any) => {
      // Get direct reports for this employee
      const directReports = (orgData.data || [])
        .filter((r: any) => r.manager_id === row.employee_id)
        .map((r: any) => r.employee_id)

      return {
        employee_id: row.employee_id,
        tenant_id: row.tenant_id,
        employee_name: row.employee_name,
        email: row.email,
        job_title: row.job_title,
        employee_number: row.employee_number,
        status: row.status,
        manager_id: row.manager_id,
        dotted_line_manager_id: row.dotted_line_manager_id,
        department_id: row.department_id,
        department_name: row.department_name,
        office_location_id: row.office_location_id,
        location_name: row.location_name,
        manager_name: row.manager_name,
        manager_email: row.manager_email,
        dotted_line_manager_name: row.dotted_line_manager_name,
        dotted_line_manager_email: row.dotted_line_manager_email,
        teams: row.teams || [],
        direct_reports: directReports,
      }
    })

    // Get departments and locations for context
    const [departments, locations] = await Promise.all([
      supabase
        .from('departments')
        .select('*')
        .eq('tenant_id', tenantId),
      supabase
        .from('office_locations')
        .select('*')
        .eq('tenant_id', tenantId),
    ])

    if (departments.error) return c.json({ error: departments.error.message }, 400)
    if (locations.error) return c.json({ error: locations.error.message }, 400)

    const response = OrgStructureResponseSchema.parse({
      nodes,
      departments: departments.data || [],
      locations: locations.data || [],
    })

    return c.json(response)
  })

  // Get organizational hierarchy tree (optimized for org chart)
  app.get('/api/org-structure/:tenantId/hierarchy', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')

    const canRead = await supabase.rpc('app_has_permission', { permission: 'employees.read', tenant: tenantId })
    if (canRead.error) return c.json({ error: canRead.error.message }, 400)
    if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

    // Get all active employees
    const employees = await supabase
      .from('employees')
      .select('id, name, email, job_title, manager_id, department_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    if (employees.error) return c.json({ error: employees.error.message }, 400)

    // Get department names
    const departments = await supabase
      .from('departments')
      .select('id, name')
      .eq('tenant_id', tenantId)

    if (departments.error) return c.json({ error: departments.error.message }, 400)

    const deptMap = new Map((departments.data || []).map((d: any) => [d.id, d.name]))

    // Build hierarchy tree
    const employeeMap = new Map()
    const rootNodes: any[] = []

    // First pass: create all nodes
    ;(employees.data || []).forEach((emp: any) => {
      const node = {
        id: emp.id,
        name: emp.name,
        job_title: emp.job_title,
        email: emp.email,
        department_name: emp.department_id ? deptMap.get(emp.department_id) : null,
        children: [] as any[],
      }
      employeeMap.set(emp.id, node)
    })

    // Second pass: build tree structure
    ;(employees.data || []).forEach((emp: any) => {
      const node = employeeMap.get(emp.id)
      if (emp.manager_id && employeeMap.has(emp.manager_id)) {
        const parent = employeeMap.get(emp.manager_id)
        parent.children.push(node)
      } else {
        rootNodes.push(node)
      }
    })

    const response = OrgHierarchyResponseSchema.parse({
      root: rootNodes.length === 1 ? rootNodes[0] : rootNodes.length > 1 ? {
        id: 'root',
        name: 'Organization',
        job_title: null,
        email: '',
        department_name: null,
        children: rootNodes,
      } : null,
    })

    return c.json(response)
  })

  // Get reporting lines (direct and dotted-line)
  app.get('/api/org-structure/:tenantId/reporting-lines', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const tenantId = c.req.param('tenantId')

    const canRead = await supabase.rpc('app_has_permission', { permission: 'employees.read', tenant: tenantId })
    if (canRead.error) return c.json({ error: canRead.error.message }, 400)
    if (!canRead.data) return c.json({ error: 'Forbidden' }, 403)

    // Get employees with their managers
    const employees = await supabase
      .from('employees')
      .select('id, manager_id, dotted_line_manager_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    if (employees.error) return c.json({ error: employees.error.message }, 400)

    // Get all manager IDs that we need to look up
    const managerIds = new Set<string>()
    const dottedLineManagerIds = new Set<string>()
    ;(employees.data || []).forEach((emp: any) => {
      if (emp.manager_id) managerIds.add(emp.manager_id)
      if (emp.dotted_line_manager_id) dottedLineManagerIds.add(emp.dotted_line_manager_id)
    })

    // Fetch manager names
    const allManagerIds = Array.from(new Set([...managerIds, ...dottedLineManagerIds]))
    const managerNames = new Map<string, string>()
    
    if (allManagerIds.length > 0) {
      const managers = await supabase
        .from('employees')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .in('id', allManagerIds)
      
      if (managers.error) return c.json({ error: managers.error.message }, 400)
      ;(managers.data || []).forEach((m: any) => {
        managerNames.set(m.id, m.name)
      })
    }

    const reportingLines = (employees.data || []).map((emp: any) => ({
      employee_id: emp.id,
      manager_id: emp.manager_id,
      dotted_line_manager_id: emp.dotted_line_manager_id,
      manager_name: emp.manager_id ? managerNames.get(emp.manager_id) || null : null,
      dotted_line_manager_name: emp.dotted_line_manager_id ? managerNames.get(emp.dotted_line_manager_id) || null : null,
    }))

    const response = ReportingLinesResponseSchema.parse({
      reporting_lines: reportingLines,
    })

    return c.json(response)
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

  // Self-service profile endpoints
  app.get('/api/self-service/profile', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    let employee
    try {
      employee = await getEmployeeForUser(supabase, tenantId, user)
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unable to resolve employee context'
      return c.json({ error: message }, 400)
    }

    if (!employee) {
      return c.json({ error: 'Employee record not found for your account' }, 404)
    }

    try {
      const payload = await buildSelfServiceProfilePayload({ supabase, tenantId, employee })
      return c.json(payload)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load profile'
      return c.json({ error: message }, 500)
    }
  })

  app.post('/api/self-service/profile/draft', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    let employee
    try {
      employee = await getEmployeeForUser(supabase, tenantId, user)
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unable to resolve employee context'
      return c.json({ error: message }, 400)
    }

    if (!employee) {
      return c.json({ error: 'Employee record not found for your account' }, 404)
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = SelfServiceDraftInputParser.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    try {
      await assertNoPendingProfileRequest(supabase, tenantId, employee.id)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load profile request'
      return c.json({ error: message }, 409)
    }

    const snapshot = extractEmployeeSelfServiceFields(employee)
    try {
      await upsertProfileDraft({
        supabase,
        tenantId,
        employeeId: employee.id,
        userId: user.id,
        fields: parsed.data.fields,
        justification: parsed.data.justification ?? null,
        snapshot,
      })
      const payload = await buildSelfServiceProfilePayload({ supabase, tenantId, employee })
      return c.json(payload, 200)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to save draft'
      return c.json({ error: message }, 400)
    }
  })

  app.post('/api/self-service/profile/submit', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User

    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    let employee
    try {
      employee = await getEmployeeForUser(supabase, tenantId, user)
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unable to resolve employee context'
      return c.json({ error: message }, 400)
    }

    if (!employee) {
      return c.json({ error: 'Employee record not found for your account' }, 404)
    }

    const body = await c.req.json().catch(() => ({}))
    const parsed = SelfServiceDraftInputParser.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    const requestedFields = parsed.data.fields
    const snapshot = extractEmployeeSelfServiceFields(employee)
    const diff = buildDiff(snapshot, requestedFields)
    if (Object.keys(diff).length === 0) {
      return c.json({ error: 'No changes detected to submit for approval.' }, 400)
    }

    try {
      await assertNoPendingProfileRequest(supabase, tenantId, employee.id)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to submit request'
      return c.json({ error: message }, 409)
    }

    let draftRecord
    try {
      draftRecord = await upsertProfileDraft({
        supabase,
        tenantId,
        employeeId: employee.id,
        userId: user.id,
        fields: requestedFields,
        justification: parsed.data.justification ?? null,
        snapshot,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to save draft'
      return c.json({ error: message }, 400)
    }

    const justification =
      parsed.data.justification && parsed.data.justification.length >= 5
        ? parsed.data.justification
        : 'Employee requested updates to personal contact information.'

    const summaryFields = Object.keys(diff)
      .map((key) => key.replace(/_/g, ' '))
      .join(', ')

    const approvalInsert = await supabase
      .from('approval_requests')
      .insert({
        tenant_id: tenantId,
        category: 'profile_change',
        title: `Profile update request – ${employee.name}`,
        summary: summaryFields.length ? `Fields changed: ${summaryFields}` : null,
        justification,
        details: {
          employeeName: employee.name,
          employeeId: employee.id,
          updatedFields: requestedFields,
          previousFields: snapshot,
        },
        attachments: [],
        requested_by_user_id: user.id,
        requested_by_employee_id: employee.id,
        status: 'pending',
      })
      .select('id')
      .single()

    if (approvalInsert.error || !approvalInsert.data) {
      return c.json(
        { error: approvalInsert.error?.message ?? 'Unable to create approval request' },
        400,
      )
    }

    const updateRequest = await supabase
      .from('employee_profile_change_requests')
      .update({
        status: 'pending',
        approval_request_id: approvalInsert.data.id,
        submitted_at: new Date().toISOString(),
        justification,
        current_snapshot: snapshot,
        fields: requestedFields,
      })
      .eq('id', draftRecord.id)
      .select('*')
      .single()

    if (updateRequest.error) {
      return c.json({ error: updateRequest.error.message }, 400)
    }

    try {
      const payload = await buildSelfServiceProfilePayload({ supabase, tenantId, employee })
      return c.json(payload, 201)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load profile'
      return c.json({ error: message }, 500)
    }
  })
}

type DeleteEmployeeCleanupParams = {
  supabase: SupabaseClient<Database>
  tenantId: string
  employeeId: string
}

type DeleteEmployeeCleanupResult =
  | { success: true }
  | { error: string }

async function deleteEmployeeWithCleanup({
  supabase,
  tenantId,
  employeeId,
}: DeleteEmployeeCleanupParams): Promise<DeleteEmployeeCleanupResult> {
  const teamCleanup = await supabase.from('team_members').delete().eq('employee_id', employeeId)
  if (teamCleanup.error) {
    return { error: teamCleanup.error.message }
  }

  const { data: documents, error: documentsError } = await supabase
    .from('employee_documents')
    .select('storage_path')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)

  if (documentsError) {
    return { error: documentsError.message }
  }

  if (documents && documents.length > 0) {
    const docDelete = await supabase
      .from('employee_documents')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
    if (docDelete.error) {
      return { error: docDelete.error.message }
    }

    const storagePaths = documents
      .map((doc: Pick<EmployeeDocument, 'storage_path'>) => doc.storage_path)
      .filter((path: string | null | undefined): path is string => Boolean(path))
    if (storagePaths.length > 0) {
      await supabaseAdmin.storage
        .from(DOCUMENT_BUCKET)
        .remove(storagePaths)
        .catch((error: unknown) => {
          console.error('Failed to remove employee document files:', error)
        })
    }
  }

  const noteDelete = await supabase
    .from('employee_notes')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
  if (noteDelete.error) {
    return { error: noteDelete.error.message }
  }

  const employeeDelete = await supabase
    .from('employees')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', employeeId)

  if (employeeDelete.error) {
    return { error: employeeDelete.error.message }
  }

  return { success: true }
}

const validateAndCoerceCustomFields = async (
  supabase: SupabaseClient<Database>,
  tenantId: string,
  input: unknown,
): Promise<Record<string, Json> | null> => {
  if (input == null) return null
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('custom_fields must be an object')
  }

  const definitions = await supabase
    .from('employee_custom_field_defs')
    .select('key, type, required, options, position')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: true })

  if (definitions.error) throw new Error(definitions.error.message)

  type CustomFieldDef = {
    key: string
    type: string
    required?: boolean | null
    options?: unknown
    position?: number | null
  }

  const byKey = new Map<string, CustomFieldDef>(
    (definitions.data ?? []).map((def: CustomFieldDef) => [def.key as string, def] as const),
  )

  const raw = input as Record<string, unknown>
  const output: Record<string, Json> = {}

  for (const [key, value] of Object.entries(raw)) {
    const def = byKey.get(key)
    if (!def) {
      continue
    }
    output[key] = coerceCustomFieldValue(
      def.type as EmployeeCustomFieldType,
      value,
      def.options,
    )
  }

  for (const def of definitions.data ?? []) {
    if (def.required && !(def.key in output)) {
      throw new Error(`Missing required custom field: ${def.key}`)
    }
  }

  return output
}

const coerceCustomFieldValue = (
  type: EmployeeCustomFieldType,
  value: unknown,
  options: unknown,
): Json => {
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
      const date = new Date(str)
      if (Number.isNaN(date.getTime())) throw new Error('Invalid date')
      return date.toISOString()
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value
      if (value === 'true' || value === '1' || value === 1) return true
      if (value === 'false' || value === '0' || value === 0) return false
      throw new Error('Invalid boolean')
    }
    case 'select': {
      const config = (options && typeof options === 'object' && options !== null)
        ? (options as Record<string, unknown>)
        : undefined
      const choices = Array.isArray(config?.choices)
        ? (config?.choices as string[])
        : undefined
      if (!choices) throw new Error('Invalid select options')
      const val = String(value)
      if (!choices.includes(val)) throw new Error('Value not in select choices')
      return val
    }
    default:
      return String(value)
  }
}
