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
import { registerOffboardingRoutes } from './routes/offboarding'
import { registerEquipmentRoutes } from './routes/equipment'
import { registerAccessRoutes } from './routes/access'
import { registerRecruitingRoutes } from './routes/recruiting'
import { registerChatRoutes } from './features/chat/router'
import { corsMiddleware } from './middleware/cors'

const app = new Hono<Env>()

app.use('*', corsMiddleware)

app.get('/', (c) => c.text('Hello Hono!'))

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
registerOffboardingRoutes(app)
registerEquipmentRoutes(app)
registerAccessRoutes(app)
registerRecruitingRoutes(app)
registerChatRoutes(app)

export default app
