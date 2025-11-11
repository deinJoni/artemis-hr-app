import type { Hono } from 'hono'

import type { Env } from '../types'

export const registerAuthRoutes = (app: Hono<Env>) => {
  app.get('/api/me', (c) => {
    const user = c.get('user')

    return c.json({
      id: user.id,
      email: user.email,
      name: user.user_metadata.name,
      tenant: user.user_metadata.tenant,
      role: user.user_metadata.role,
    })
  })
}
