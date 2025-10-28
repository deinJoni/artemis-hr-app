import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@database.types.ts'
import type { EmployeeAuditLog } from '@vibe/shared'

export interface AuditLogEntry {
  tenant_id: string
  employee_id: string
  changed_by: string
  action: 'created' | 'updated' | 'deleted' | 'document_added' | 'document_removed' | 'status_changed'
  field_name?: string
  old_value?: any
  new_value?: any
  change_reason?: string
  ip_address?: string
  user_agent?: string
}

export class AuditLogger {
  constructor(private supabase: SupabaseClient<Database>) {}

  async logEmployeeChange(entry: AuditLogEntry): Promise<void> {
    const { error } = await this.supabase
      .from('employee_audit_log')
      .insert({
        tenant_id: entry.tenant_id,
        employee_id: entry.employee_id,
        changed_by: entry.changed_by,
        action: entry.action,
        field_name: entry.field_name || null,
        old_value: entry.old_value || null,
        new_value: entry.new_value || null,
        change_reason: entry.change_reason || null,
        ip_address: entry.ip_address || null,
        user_agent: entry.user_agent || null,
      })

    if (error) {
      console.error('Failed to log audit entry:', error)
      // Don't throw - audit logging should not break the main operation
    }
  }

  async logEmployeeCreation(
    tenantId: string,
    employeeId: string,
    changedBy: string,
    employeeData: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEmployeeChange({
      tenant_id: tenantId,
      employee_id: employeeId,
      changed_by: changedBy,
      action: 'created',
      new_value: employeeData,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
  }

  async logEmployeeUpdate(
    tenantId: string,
    employeeId: string,
    changedBy: string,
    changes: Record<string, { old: any; new: any }>,
    changeReason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    // Log each field change separately for better granularity
    for (const [fieldName, { old: oldValue, new: newValue }] of Object.entries(changes)) {
      // Skip unchanged values
      if (oldValue === newValue) continue

      await this.logEmployeeChange({
        tenant_id: tenantId,
        employee_id: employeeId,
        changed_by: changedBy,
        action: 'updated',
        field_name: fieldName,
        old_value: oldValue,
        new_value: newValue,
        change_reason: changeReason,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
    }
  }

  async logEmployeeDeletion(
    tenantId: string,
    employeeId: string,
    changedBy: string,
    employeeData: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEmployeeChange({
      tenant_id: tenantId,
      employee_id: employeeId,
      changed_by: changedBy,
      action: 'deleted',
      old_value: employeeData,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
  }

  async logDocumentAction(
    tenantId: string,
    employeeId: string,
    changedBy: string,
    action: 'document_added' | 'document_removed',
    documentData: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEmployeeChange({
      tenant_id: tenantId,
      employee_id: employeeId,
      changed_by: changedBy,
      action,
      new_value: action === 'document_added' ? documentData : null,
      old_value: action === 'document_removed' ? documentData : null,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
  }

  async logStatusChange(
    tenantId: string,
    employeeId: string,
    changedBy: string,
    oldStatus: string,
    newStatus: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEmployeeChange({
      tenant_id: tenantId,
      employee_id: employeeId,
      changed_by: changedBy,
      action: 'status_changed',
      field_name: 'status',
      old_value: oldStatus,
      new_value: newStatus,
      change_reason: reason,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
  }
}

// Helper function to extract IP and user agent from request
export function extractRequestInfo(req: any): { ipAddress?: string; userAgent?: string } {
  const ipAddress = req.headers?.get?.('x-forwarded-for') || 
                   req.headers?.get?.('x-real-ip') || 
                   req.headers?.get?.('cf-connecting-ip') ||
                   'unknown'
  
  const userAgent = req.headers?.get?.('user-agent') || 'unknown'

  return { ipAddress, userAgent }
}

// Helper function to compare objects and find changes
export function findChanges(oldObj: Record<string, any>, newObj: Record<string, any>): Record<string, { old: any; new: any }> {
  const changes: Record<string, { old: any; new: any }> = {}
  
  // Check all keys from both objects
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])
  
  for (const key of allKeys) {
    const oldValue = oldObj[key]
    const newValue = newObj[key]
    
    // Deep comparison for objects
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes[key] = { old: oldValue, new: newValue }
    }
  }
  
  return changes
}
