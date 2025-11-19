import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

import { EmployeeDetailResponseSchema } from '@vibe/shared'

import { getPrimaryTenantId } from '../../../lib/tenant-context'
import type { ToolExecutionContext } from '../context'

const EmployeeDetailsInputSchema = z.object({
  employee_id: z.string().uuid().describe('Employee ID to retrieve'),
})

type EmployeeDetailsInput = z.infer<typeof EmployeeDetailsInputSchema>

export function createEmployeeDetailsTool(context: ToolExecutionContext) {
  return new DynamicStructuredTool({
    name: 'get_employee_details',
    description: 'Get full employee profile details, including role, department, and contact information. Requires employee ID.',
    schema: EmployeeDetailsInputSchema,
    func: async ({ employee_id }: EmployeeDetailsInput) => {
      const { supabase, userToken, apiBaseUrl } = context

      try {
        const tenantId = await getPrimaryTenantId(supabase)
        const response = await fetch(`${apiBaseUrl}/api/employees/${tenantId}/${employee_id}`, {
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
        const parsed = EmployeeDetailResponseSchema.safeParse(data)
        if (!parsed.success) {
          throw new Error(`Invalid employee detail response format: ${parsed.error.message}`)
        }

        return JSON.stringify(parsed.data)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred'
        throw new Error(`Failed to get employee details: ${message}`)
      }
    },
  })
}
