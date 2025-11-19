import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import {
  DocumentCategoryEnum,
  EmployeeDocumentSchema,
  type EmployeeDocument,
} from '@vibe/shared'

import type { Database } from '@database.types.ts'
import { AuditLogger } from '../../../lib/audit-logger'
import { supabaseAdmin } from '../../../lib/supabase'
import {
  DOCUMENT_BUCKET,
  buildDocumentStoragePath,
  sanitizeStorageFileName,
} from '../utils/storage'

export class EmployeeDocumentUploadError extends Error {
  constructor(message: string, public status: ContentfulStatusCode = 400) {
    super(message)
    this.name = 'EmployeeDocumentUploadError'
  }
}

export interface DocumentMetadataInput {
  description?: unknown
  category?: unknown
  expiry_date?: unknown
}

export interface DocumentMetadata {
  description: string | null
  category: string | null
  expiryDate: string | null
}

export const parseDocumentMetadata = (input: DocumentMetadataInput): DocumentMetadata => {
  const description =
    typeof input.description === 'string' && input.description.trim().length > 0
      ? input.description.trim()
      : null

  let category: string | null = null
  if (typeof input.category === 'string' && input.category.trim().length > 0) {
    const parsed = DocumentCategoryEnum.safeParse(input.category.trim())
    if (!parsed.success) {
      throw new EmployeeDocumentUploadError('Invalid category value')
    }
    category = parsed.data
  }

  let expiryDate: string | null = null
  if (typeof input.expiry_date === 'string' && input.expiry_date.trim().length > 0) {
    const trimmed = input.expiry_date.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new EmployeeDocumentUploadError('Invalid expiry_date format (YYYY-MM-DD)')
    }
    expiryDate = trimmed
  }

  return { description, category, expiryDate }
}

interface SaveEmployeeDocumentOptions extends DocumentMetadata {
  supabase: SupabaseClient<Database>
  tenantId: string
  employeeId: string
  file: File
  uploadedBy: string
  ipAddress?: string
  userAgent?: string
}

export async function saveEmployeeDocument({
  supabase,
  tenantId,
  employeeId,
  file,
  uploadedBy,
  description,
  category,
  expiryDate,
  ipAddress,
  userAgent,
}: SaveEmployeeDocumentOptions): Promise<EmployeeDocument> {
  const originalName = file.name && file.name.length > 0 ? file.name : 'document'
  const safeName = sanitizeStorageFileName(originalName)
  const storagePath = buildDocumentStoragePath(tenantId, employeeId, safeName)

  const { data: latestVersion, error: latestVersionError } = await supabase
    .from('employee_documents')
    .select('id, version')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('file_name', safeName)
    .eq('is_current', true)
    .maybeSingle()

  if (latestVersionError) {
    throw new EmployeeDocumentUploadError(latestVersionError.message)
  }

  const nextVersion = latestVersion?.version ? latestVersion.version + 1 : 1
  const previousVersionId = latestVersion?.id ?? null

  const upload = await supabaseAdmin.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    })

  if (upload.error) {
    throw new EmployeeDocumentUploadError(upload.error.message)
  }

  const insertPayload: Database['public']['Tables']['employee_documents']['Insert'] = {
    tenant_id: tenantId,
    employee_id: employeeId,
    storage_path: storagePath,
    file_name: safeName,
    mime_type: file.type || 'application/octet-stream',
    file_size: file.size,
    uploaded_by: uploadedBy,
    description,
    version: nextVersion,
    previous_version_id: previousVersionId,
    is_current: true,
    category,
    expiry_date: expiryDate,
  }

  const { data: inserted, error: insertError } = await supabase
    .from('employee_documents')
    .insert(insertPayload)
    .select(
      'id, tenant_id, employee_id, storage_path, file_name, mime_type, file_size, uploaded_by, uploaded_at, description, version, previous_version_id, is_current, category, expiry_date, updated_at',
    )
    .single()

  if (insertError || !inserted) {
    await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove([storagePath]).catch(() => undefined)
    throw new EmployeeDocumentUploadError(insertError?.message ?? 'Unable to save document metadata')
  }

  if (previousVersionId) {
    await supabase
      .from('employee_documents')
      .update({ is_current: false, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('id', previousVersionId)
  }

  const parsed = EmployeeDocumentSchema.safeParse(inserted)
  if (!parsed.success) {
    throw new EmployeeDocumentUploadError('Unexpected document response shape', 500)
  }

  const auditLogger = new AuditLogger(supabase)
  await auditLogger
    .logDocumentAction(
      tenantId,
      employeeId,
      uploadedBy,
      'document_added',
      parsed.data,
      ipAddress,
      userAgent,
    )
    .catch(() => undefined)

  return parsed.data
}
