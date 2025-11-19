import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

import { TimeEntryListResponseSchema, TimeSummaryResponseSchema } from '@vibe/shared'

import type { ToolExecutionContext } from '../context'

const TimeEntriesInputSchema = z.object({
  user_id: z.string().uuid().optional().describe('Restrict entries to a specific user ID; defaults to the current user'),
  start_date: z.string().optional().describe('ISO date to filter entries that start on or after this date'),
  end_date: z.string().optional().describe('ISO date to filter entries that start on or before this date'),
  status: z.enum(['approved', 'pending', 'rejected']).optional().describe('Filter time entries by approval status'),
  entry_type: z.enum(['clock', 'manual']).optional().describe('Filter by entry type'),
  project_task: z.string().optional().describe('Filter by project or task name (case insensitive partial match)'),
  page: z.number().int().min(1).default(1).describe('Page number for pagination (default 1)'),
  page_size: z.number().int().min(1).max(100).default(20).describe('Results per page (default 20, max 100)'),
})

type TimeEntriesInput = z.infer<typeof TimeEntriesInputSchema>

export function createTimeSummaryTool(context: ToolExecutionContext) {
  return new DynamicStructuredTool({
    name: 'get_time_summary',
    description: 'Get the "My Time" summary including hours worked this week, target hours, active clock-in, and PTO balances.',
    schema: z.object({}).describe('No input required'),
    func: async () => {
      const { apiBaseUrl, userToken } = context

      try {
        const response = await fetch(`${apiBaseUrl}/api/time/summary`, {
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
        const parsed = TimeSummaryResponseSchema.safeParse(data)
        if (!parsed.success) {
          throw new Error(`Invalid time summary response format: ${parsed.error.message}`)
        }

        return JSON.stringify(parsed.data)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred'
        throw new Error(`Failed to get time summary: ${message}`)
      }
    },
  })
}

export function createTimeEntriesTool(context: ToolExecutionContext) {
  return new DynamicStructuredTool({
    name: 'get_time_entries',
    description: 'List time entries with filters for date range, status, entry type, and pagination. Defaults to the current user.',
    schema: TimeEntriesInputSchema,
    func: async ({
      user_id,
      start_date,
      end_date,
      status,
      entry_type,
      project_task,
      page = 1,
      page_size = 20,
    }: TimeEntriesInput) => {
      const { apiBaseUrl, userToken } = context

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          page_size: page_size.toString(),
        })

        if (user_id) params.set('user_id', user_id)
        if (start_date) params.set('start_date', start_date)
        if (end_date) params.set('end_date', end_date)
        if (status) params.set('status', status)
        if (entry_type) params.set('entry_type', entry_type)
        if (project_task) params.set('project_task', project_task)

        const response = await fetch(`${apiBaseUrl}/api/time/entries?${params.toString()}`, {
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

        const json = await response.json()
        const parsed = TimeEntryListResponseSchema.safeParse(json)
        if (!parsed.success) {
          throw new Error(`Invalid time entry response format: ${parsed.error.message}`)
        }

        return JSON.stringify(parsed.data)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred'
        throw new Error(`Failed to get time entries: ${message}`)
      }
    },
  })
}
