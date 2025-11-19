import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

import { GoalListResponseSchema, MyTeamResponseSchema } from '@vibe/shared'

import type { ToolExecutionContext } from '../context'

export function createMyGoalsTool(context: ToolExecutionContext) {
  return new DynamicStructuredTool({
    name: 'get_my_goals',
    description: 'Retrieve all goals assigned to the current user, including status, progress, and key results.',
    schema: z.object({}).describe('No input required'),
    func: async () => {
      const { apiBaseUrl, userToken } = context

      try {
        const response = await fetch(`${apiBaseUrl}/api/goals/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorBody.error || 'Unknown error'}`)
        }

        const data = await response.json()
        const parsed = GoalListResponseSchema.safeParse(data)
        if (!parsed.success) {
          throw new Error(`Invalid goals response format: ${parsed.error.message}`)
        }

        return JSON.stringify(parsed.data)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred'
        throw new Error(`Failed to get goals: ${message}`)
      }
    },
  })
}

export function createTeamPerformanceTool(context: ToolExecutionContext) {
  return new DynamicStructuredTool({
    name: 'get_team_performance',
    description: 'Summarize direct reports with goal progress, completion counts, and last check-in information.',
    schema: z.object({}).describe('No input required'),
    func: async () => {
      const { apiBaseUrl, userToken } = context

      try {
        const response = await fetch(`${apiBaseUrl}/api/my-team`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorBody.error || 'Unknown error'}`)
        }

        const data = await response.json()
        const parsed = MyTeamResponseSchema.safeParse(data)
        if (!parsed.success) {
          throw new Error(`Invalid team response format: ${parsed.error.message}`)
        }

        return JSON.stringify(parsed.data)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred'
        throw new Error(`Failed to get team performance: ${message}`)
      }
    },
  })
}
