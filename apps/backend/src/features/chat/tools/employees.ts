import { DynamicStructuredTool } from '@langchain/core/tools'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { Database } from '@database.types.ts'
import { EmployeePublicListResponseSchema } from '@vibe/shared'
import { getPrimaryTenantId } from '../../../lib/tenant-context'

export interface EmployeeToolContext {
  supabase: SupabaseClient<Database>
  userToken: string
  apiBaseUrl: string
}

// Define schema with explicit defaults to ensure proper JSON Schema conversion
const EmployeeToolInputSchema = z.object({
  search: z.string().optional().describe('Optional search term to filter employees by name or email'),
  status: z.enum(['active', 'on_leave', 'terminated', 'inactive']).optional().describe('Optional filter by employment status'),
  page: z.number().int().min(1).default(1).describe('Page number for pagination (default: 1)'),
  pageSize: z.number().int().min(1).max(100).default(20).describe('Number of results per page (default: 20, max: 100)'),
})

type EmployeeToolInput = z.infer<typeof EmployeeToolInputSchema>

/**
 * Creates a LangChain tool for fetching employees that the authenticated user has permission to view.
 * The tool calls the Hono API endpoint to ensure centralized permission checks, audit logging, and consistent response validation.
 */
export function createEmployeeTool(context: EmployeeToolContext) {
  return new DynamicStructuredTool({
    name: 'get_employees',
    description: 'Get all employees that the authenticated user has permission to view. Returns a paginated list of employees with their basic information (name, email, job title, department, status). Excludes sensitive data like bank accounts and tax IDs. Supports pagination with page and pageSize parameters.',
    schema: EmployeeToolInputSchema,
    func: async (input: EmployeeToolInput) => {
      const { search, status, page = 1, pageSize = 20 } = input
      const { supabase, userToken, apiBaseUrl } = context

      try {
        // Get tenant ID from user context
        const tenantId = await getPrimaryTenantId(supabase)

        // Build query parameters
        const params = new URLSearchParams({
          page: page.toString(),
          pageSize: pageSize.toString(),
          sort: 'name',
          order: 'asc',
        })

        if (search && search.trim().length > 0) {
          params.set('search', search.trim())
        }

        if (status) {
          params.set('status', status)
        }

        // Call the Hono API endpoint with Bearer token
        const url = `${apiBaseUrl}/api/employees/${tenantId}?${params.toString()}`
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

        // Parse and validate response with public schema
        // Note: The API returns EmployeeListResponseSchema, but we validate with EmployeePublicSchema
        // which excludes sensitive fields. The API response should already exclude those fields
        // in practice, but we validate to ensure type safety.
        const parsed = EmployeePublicListResponseSchema.safeParse(data)
        if (!parsed.success) {
          // If validation fails, try to transform the response by omitting sensitive fields
          if (data.employees && Array.isArray(data.employees)) {
            const publicEmployees = data.employees.map((emp: any) => {
              const { bank_account_encrypted, tax_id_encrypted, ...publicEmp } = emp
              return publicEmp
            })
            const transformed = { ...data, employees: publicEmployees }
            const retryParsed = EmployeePublicListResponseSchema.safeParse(transformed)
            if (retryParsed.success) {
              return JSON.stringify(retryParsed.data)
            }
          }
          throw new Error(`Invalid API response format: ${parsed.error.message}`)
        }

        // Return the validated public employee data
        return JSON.stringify(parsed.data)
      } catch (error) {
        // Throw errors instead of returning error JSON strings
        const message = error instanceof Error ? error.message : 'Unknown error occurred'
        throw new Error(`Failed to get employees: ${message}`)
      }
    },
  })
}

