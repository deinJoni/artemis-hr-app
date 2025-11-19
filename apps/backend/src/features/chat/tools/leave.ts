import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

import { LeaveRequestListResponseSchema, TimeOffStatusEnum } from '@vibe/shared'

import type { ToolExecutionContext } from '../context'

const LeaveBalanceInputSchema = z.object({
  employee_id: z.string().uuid().optional().describe('Optional employee ID. When omitted, fetches the current user\'s balances'),
})

type LeaveBalanceInput = z.infer<typeof LeaveBalanceInputSchema>

const LeaveRequestInputSchema = z.object({
  employee_id: z.string().uuid().optional().describe('Filter leave requests by employee ID'),
  leave_type_id: z.string().uuid().optional().describe('Filter by leave type ID'),
  status: TimeOffStatusEnum.optional().describe('Filter by leave request status'),
  start_date: z.string().optional().describe('ISO start date filter (inclusive)'),
  end_date: z.string().optional().describe('ISO end date filter (inclusive)'),
  year: z.number().int().optional().describe('Limit to requests starting within this year'),
  page: z.number().int().min(1).default(1).describe('Page number for pagination'),
  page_size: z.number().int().min(1).max(100).default(20).describe('Number of results per page (default 20, max 100)'),
})

type LeaveRequestInput = z.infer<typeof LeaveRequestInputSchema>

export function createLeaveBalancesTool(context: ToolExecutionContext) {
  return new DynamicStructuredTool({
    name: 'get_leave_balances',
    description: 'Get leave balances for the current user or a specific employee. Use this before confirming available days off.',
    schema: LeaveBalanceInputSchema,
    func: async ({ employee_id }: LeaveBalanceInput) => {
      const { userToken, apiBaseUrl } = context
      const url = employee_id
        ? `${apiBaseUrl}/api/leave/balances/${employee_id}`
        : `${apiBaseUrl}/api/leave/balances/my-balance`

      try {
        const response = await fetch(url, {
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
        return JSON.stringify(data)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred'
        throw new Error(`Failed to get leave balances: ${message}`)
      }
    },
  })
}

export function createLeaveRequestsTool(context: ToolExecutionContext) {
  return new DynamicStructuredTool({
    name: 'get_leave_requests',
    description: 'List leave requests with optional filters by employee, leave type, or status. Returns pagination metadata.',
    schema: LeaveRequestInputSchema,
    func: async ({
      employee_id,
      leave_type_id,
      status,
      start_date,
      end_date,
      year,
      page = 1,
      page_size = 20,
    }: LeaveRequestInput) => {
      const { apiBaseUrl, userToken } = context

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          page_size: page_size.toString(),
        })

        if (employee_id) params.set('employee_id', employee_id)
        if (leave_type_id) params.set('leave_type_id', leave_type_id)
        if (status) params.set('status', status)
        if (start_date) params.set('start_date', start_date)
        if (end_date) params.set('end_date', end_date)
        if (typeof year === 'number') params.set('year', year.toString())

        const response = await fetch(`${apiBaseUrl}/api/leave/requests?${params.toString()}`, {
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
        const parsed = LeaveRequestListResponseSchema.safeParse(json)
        if (!parsed.success) {
          throw new Error(`Invalid leave request response format: ${parsed.error.message}`)
        }

        return JSON.stringify(parsed.data)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred'
        throw new Error(`Failed to get leave requests: ${message}`)
      }
    },
  })
}
