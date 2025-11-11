export const DOCUMENT_BUCKET = 'employee-documents'

export const sanitizeStorageFileName = (name: string): string => {
  const withoutSeparators = name.replace(/[\\/]+/g, '_').trim()
  const normalized =
    typeof withoutSeparators.normalize === 'function'
      ? withoutSeparators.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      : withoutSeparators
  const safe = normalized.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_')
  const clipped = safe.slice(-200)
  return clipped.length > 0 ? clipped : 'document'
}

export const buildDocumentStoragePath = (
  tenantId: string,
  employeeId: string,
  fileName: string
): string => {
  const unique =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${tenantId}/${employeeId}/${unique}-${fileName}`
}
