import type { Hono } from 'hono'
import type { SupabaseClient, User } from '@supabase/supabase-js'

import type { Database } from '@database.types.ts'
import type { Env } from '../../../../types'
import { getPrimaryTenantId } from '../../../../lib/tenant-context'
import { getTimeSummary } from '../../services/time-summary-service'

/**
 * Route catalogue for the time-tracking domain.
 *
 * Planned endpoints (to be migrated from the legacy router):
 * - GET  /api/time/summary
 * - POST /api/time/clock-in
 * - POST /api/time/clock-out
 * - POST /api/time/entries
 * - GET  /api/time/entries
 * - PUT  /api/time/entries/:id
 * - DELETE /api/time/entries/:id
 * - GET  /api/time/entries/pending
 * - PUT  /api/time/entries/:id/approve
 * - GET  /api/time/entries/:id/audit
 * - GET  /api/time/export
 */
export const registerTimeTrackingRoutes = (app: Hono<Env>) => {
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

    try {
      const result = await getTimeSummary({
        supabase,
        tenantId,
        userId: user.id,
      })
      return c.json(result)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load time summary'
      return c.json({ error: message }, 500)
    }
  })
}
