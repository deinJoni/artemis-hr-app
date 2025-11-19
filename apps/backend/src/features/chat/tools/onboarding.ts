import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

import {
  SampleEmployeeInputSchema,
  SampleApprovalInputSchema,
  SampleSeedInputSchema,
  type SampleEmployeeInput,
  type SampleApprovalInput,
  type SampleSeedInput,
} from '@vibe/shared'
import { getPrimaryTenantId } from '../../../lib/tenant-context'

import type { ToolExecutionContext } from '../context'

export function createGenerateDummyEmployeesTool(context: ToolExecutionContext) {
  return new DynamicStructuredTool({
    name: 'generate_dummy_employees',
    description: 'Generate sample employee records for demo/testing purposes. Creates realistic employee data with names, emails, job titles, and optional manager relationships.',
    schema: SampleEmployeeInputSchema,
    func: async (input: SampleEmployeeInput) => {
      const { supabase, userToken, apiBaseUrl } = context

      try {
        const tenantId = await getPrimaryTenantId(supabase)

        const response = await fetch(`${apiBaseUrl}/api/onboarding/sample/employees`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        })

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(
            `API request failed: ${response.status} ${response.statusText} - ${errorBody.error || 'Unknown error'}`,
          )
        }

        const data = await response.json()
        return JSON.stringify(data)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred'
        throw new Error(`Failed to generate dummy employees: ${message}`)
      }
    },
  })
}

export function createGenerateDummyApprovalsTool(context: ToolExecutionContext) {
  return new DynamicStructuredTool({
    name: 'generate_dummy_approvals',
    description: 'Generate sample approval requests for demo/testing purposes. Creates realistic approval requests across different categories (equipment, training, salary_change, profile_change).',
    schema: SampleApprovalInputSchema,
    func: async (input: SampleApprovalInput) => {
      const { supabase, userToken, apiBaseUrl } = context

      try {
        const tenantId = await getPrimaryTenantId(supabase)

        const response = await fetch(`${apiBaseUrl}/api/onboarding/sample/approvals`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        })

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(
            `API request failed: ${response.status} ${response.statusText} - ${errorBody.error || 'Unknown error'}`,
          )
        }

        const data = await response.json()
        return JSON.stringify(data)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred'
        throw new Error(`Failed to generate dummy approvals: ${message}`)
      }
    },
  })
}

export function createGenerateDemoDatasetTool(context: ToolExecutionContext) {
  return new DynamicStructuredTool({
    name: 'generate_demo_dataset',
    description: 'Generate a complete demo dataset by creating both sample employees and approval requests. This is useful for populating a workspace with ready-to-use test data.',
    schema: SampleSeedInputSchema,
    func: async (input: SampleSeedInput) => {
      const { supabase, userToken, apiBaseUrl } = context

      try {
        const tenantId = await getPrimaryTenantId(supabase)

        const response = await fetch(`${apiBaseUrl}/api/onboarding/sample/seed`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        })

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(
            `API request failed: ${response.status} ${response.statusText} - ${errorBody.error || 'Unknown error'}`,
          )
        }

        const data = await response.json()
        return JSON.stringify(data)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred'
        throw new Error(`Failed to generate demo dataset: ${message}`)
      }
    },
  })
}

