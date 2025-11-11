import type { Hono } from 'hono'

import {
  type ExampleChartPoint,
  type ExampleChartResponse,
  type ExampleTableResponse,
  type ExampleTableRow,
} from '@vibe/shared'

import type { Env } from '../types'

export const registerAnalyticsRoutes = (app: Hono<Env>) => {
  app.get('/api/example/chart', (c) => {
    const chartData = [
      { month: 'Jan', users: 120 },
      { month: 'Feb', users: 160 },
      { month: 'Mar', users: 210 },
      { month: 'Apr', users: 190 },
      { month: 'May', users: 260 },
      { month: 'Jun', users: 300 },
    ] satisfies ExampleChartPoint[]

    return c.json({ chartData } satisfies ExampleChartResponse)
  })

  app.get('/api/example/table', (c) => {
    const tableData = [
      { id: '1', name: 'Acme Inc', email: 'contact@acme.com', plan: 'Pro' },
      { id: '2', name: 'Globex', email: 'hello@globex.com', plan: 'Business' },
      { id: '3', name: 'Initech', email: 'support@initech.io', plan: 'Starter' },
    ] satisfies ExampleTableRow[]

    return c.json({ tableData } satisfies ExampleTableResponse)
  })
}
