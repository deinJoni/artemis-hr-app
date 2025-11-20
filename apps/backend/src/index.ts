import { Hono } from 'hono'

import type { Env } from './types'
import { requireUser } from './middleware/require-user'
import { registerAnalyticsRoutes } from './routes/analytics'
import { registerAuthRoutes } from './routes/auth'
import { registerTenantRoutes } from './routes/tenants'
import { registerMembershipRoutes } from './routes/memberships'
import { registerEmployeeRoutes } from './routes/employees'
import { registerImportRoutes } from './routes/imports'
import { registerWorkflowRoutes } from './routes/workflows'
import { registerLeaveAnalyticsRoutes } from './routes/leave-analytics'
import { registerPerformanceRoutes } from './routes/performance'
import { registerTimeManagementRoutes } from './routes/time-management'
import { registerOnboardingRoutes } from './routes/onboarding'
import { registerOnboardingSampleRoutes } from './features/onboarding/router'
import { registerOffboardingRoutes } from './routes/offboarding'
import { registerEquipmentRoutes } from './routes/equipment'
import { registerAccessRoutes } from './routes/access'
import { registerRecruitingRoutes } from './routes/recruiting'
import { registerFeatureRoutes } from './routes/features'
import { registerApprovalRoutes } from './routes/approvals'
import { registerTaskRoutes } from './routes/tasks'
import { registerChatRoutes } from './features/chat/router'
import { registerNewsRoutes } from './routes/news'
import { corsMiddleware } from './middleware/cors'

const app = new Hono<Env>()

app.use('*', corsMiddleware)

app.get('/', (c) => c.text('Hello Honoo!'))
app.get('/api', (c) => c.text('Hello Hono!'))
app.get('/api/', (c) => c.text('Hello Hono!'))

app.use('/api/*', requireUser)

registerAuthRoutes(app)
registerAnalyticsRoutes(app)
registerTenantRoutes(app)
registerMembershipRoutes(app)
registerImportRoutes(app) // Register before employee routes to avoid route conflicts
registerEmployeeRoutes(app)
registerWorkflowRoutes(app)
registerPerformanceRoutes(app)
registerTimeManagementRoutes(app)
registerLeaveAnalyticsRoutes(app)
registerOnboardingRoutes(app)
registerOnboardingSampleRoutes(app)
registerOffboardingRoutes(app)
registerEquipmentRoutes(app)
registerAccessRoutes(app)
registerRecruitingRoutes(app)
registerFeatureRoutes(app)
registerApprovalRoutes(app)
registerChatRoutes(app)
registerTaskRoutes(app)
registerNewsRoutes(app)

// Catch-all 404 handler for debugging
app.notFound((c) => {
  return c.json({ 
    error: 'Not Found', 
    path: c.req.path,
    method: c.req.method,
    url: c.req.url
  }, 404)
})

export default app
