import type { Hono } from 'hono'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@database.types.ts'
import {
  EquipmentAssignInputSchema,
  EquipmentListResponseSchema,
} from '@vibe/shared'
import { ensurePermission } from '../lib/permissions'
import type { Env } from '../types'

export const registerEquipmentRoutes = (app: Hono<Env>) => {
  // Assign equipment to an employee
  app.post('/api/equipment/assign', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const body = await c.req.json().catch(() => ({}))
    const { tenantId, ...assignData } = body as {
      tenantId?: string
      employee_id?: string
      type?: string
      brand?: string
      model?: string
      serial_number?: string
      notes?: string
    }

    if (!tenantId) {
      return c.json({ error: 'tenantId is required' }, 400)
    }

    const parsed = EquipmentAssignInputSchema.safeParse(assignData)
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'employees.write')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      const { data: equipment, error } = await supabase
        .from('equipment_items' as any)
        .insert({
          tenant_id: tenantId,
          employee_id: parsed.data.employee_id,
          type: parsed.data.type,
          brand: parsed.data.brand || null,
          model: parsed.data.model || null,
          serial_number: parsed.data.serial_number || null,
          status: 'assigned',
          assigned_at: new Date().toISOString(),
          notes: parsed.data.notes || null,
        })
        .select()
        .single()

      if (error) {
        throw new Error(error.message)
      }

      return c.json({ equipment })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to assign equipment'
      return c.json({ error: message }, 400)
    }
  })

  // Get equipment for an employee
  app.get('/api/equipment/:employeeId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const employeeId = c.req.param('employeeId')
    const tenantId = c.req.query('tenantId')

    if (!tenantId) {
      return c.json({ error: 'tenantId query parameter is required' }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'employees.read')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      const { data: equipment, error } = await supabase
        .from('equipment_items' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .order('assigned_at', { ascending: false })

      if (error) {
        throw new Error(error.message)
      }

      const payload = EquipmentListResponseSchema.safeParse({ equipment: equipment || [] })
      if (!payload.success) {
        return c.json({ error: 'Unexpected response shape' }, 500)
      }

      return c.json(payload.data)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load equipment'
      return c.json({ error: message }, 400)
    }
  })

  // Return equipment
  app.put('/api/equipment/:id/return', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const equipmentId = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const { notes } = body as { notes?: string }

    try {
      // Get equipment to find tenant_id
      const { data: equipment, error: equipError } = await supabase
        .from('equipment_items' as any)
        .select('tenant_id, employee_id')
        .eq('id', equipmentId)
        .single()

      if (equipError || !equipment) {
        return c.json({ error: 'Equipment not found' }, 404)
      }

      await ensurePermission(supabase, (equipment as any).tenant_id, 'employees.write')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    try {
      const { error: updateError } = await supabase
        .from('equipment_items' as any)
        .update({
          status: 'returned',
          returned_at: new Date().toISOString(),
          employee_id: null,
          notes: notes || null,
        })
        .eq('id', equipmentId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      return c.json({ message: 'Equipment returned successfully' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to return equipment'
      return c.json({ error: message }, 400)
    }
  })
}

