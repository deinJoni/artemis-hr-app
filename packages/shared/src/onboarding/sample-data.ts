import { z } from 'zod'

import { EmploymentTypeEnum } from '../employees'
import { ApprovalCategoryEnum } from '../approvals'

export const SampleEmployeeInputSchema = z.object({
  count: z.number().int().min(1).max(100).describe('Number of employees to generate (1-100)'),
  departments: z.array(z.string().uuid()).optional().describe('Optional array of department IDs to assign employees to'),
  link_to_manager: z.boolean().default(false).describe('Whether to create manager relationships between employees'),
  employment_types: z.array(EmploymentTypeEnum).optional().describe('Optional array of employment types to use (if not provided, uses all types)'),
})

export type SampleEmployeeInput = z.infer<typeof SampleEmployeeInputSchema>

export const SampleApprovalInputSchema = z.object({
  count: z.number().int().min(1).max(50).describe('Number of approval requests to generate (1-50)'),
  approval_category_mix: z.record(ApprovalCategoryEnum, z.number().int().min(0)).optional().describe('Optional object mapping approval categories to counts (e.g., {equipment: 5, training: 3})'),
  employee_ids: z.array(z.string().uuid()).optional().describe('Optional array of employee IDs to use for approvals (if not provided, will use existing employees or generate new ones)'),
  include_attachments: z.boolean().default(false).describe('Whether to include attachment metadata in generated approvals'),
})

export type SampleApprovalInput = z.infer<typeof SampleApprovalInputSchema>

export const SampleDataResponseSchema = z.object({
  success: z.boolean(),
  records_created: z.number().int().min(0),
  sample_ids: z.array(z.string().uuid()).optional(),
  summary: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export type SampleDataResponse = z.infer<typeof SampleDataResponseSchema>

export const SampleSeedInputSchema = z.object({
  employees: SampleEmployeeInputSchema.optional(),
  approvals: SampleApprovalInputSchema.optional(),
})

export type SampleSeedInput = z.infer<typeof SampleSeedInputSchema>

export const SampleSeedResponseSchema = z.object({
  success: z.boolean(),
  employees: SampleDataResponseSchema.optional(),
  approvals: SampleDataResponseSchema.optional(),
  summary: z.string(),
})

export type SampleSeedResponse = z.infer<typeof SampleSeedResponseSchema>

