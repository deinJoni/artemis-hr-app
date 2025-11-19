import { faker } from '@faker-js/faker'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { Database } from '@database.types.ts'
import {
  EmployeeCreateInputSchema,
  EmploymentTypeEnum,
  type EmployeeCreateInput,
} from '@vibe/shared'
import {
  ApprovalRequestInputSchema,
  ApprovalCategoryEnum,
  type ApprovalRequestInput,
} from '@vibe/shared'
import {
  SampleEmployeeInput,
  SampleApprovalInput,
  type SampleDataResponse,
} from '@vibe/shared'
import { supabaseAdmin } from '../../lib/supabase'

const JOB_TITLES = [
  'Software Engineer',
  'Product Manager',
  'Designer',
  'Marketing Specialist',
  'Sales Representative',
  'HR Coordinator',
  'Accountant',
  'Operations Manager',
  'Customer Success Manager',
  'Data Analyst',
  'Project Manager',
  'Business Analyst',
  'Content Writer',
  'DevOps Engineer',
  'QA Engineer',
]

const EMPLOYMENT_TYPES: Array<z.infer<typeof EmploymentTypeEnum>> = [
  'full_time',
  'part_time',
  'contract',
  'intern',
  'seasonal',
]

export async function generateDummyEmployees(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  input: SampleEmployeeInput,
): Promise<SampleDataResponse> {
  const { count, departments, link_to_manager, employment_types } = input

  // Get available departments if not provided
  let availableDepartments: string[] = []
  if (departments && departments.length > 0) {
    availableDepartments = departments
  } else {
    const { data: deptData } = await supabase
      .from('departments')
      .select('id')
      .eq('tenant_id', tenantId)
    if (deptData) {
      availableDepartments = deptData.map((d) => d.id)
    }
  }

  // Get employment types to use
  const typesToUse = employment_types && employment_types.length > 0
    ? employment_types
    : EMPLOYMENT_TYPES

  const createdEmployees: Array<{ id: string; name: string; email: string }> = []
  const errors: string[] = []

  // Generate employees
  for (let i = 0; i < count; i++) {
    try {
      const firstName = faker.person.firstName()
      const lastName = faker.person.lastName()
      const name = `${firstName} ${lastName}`
      const email = faker.internet.email({ firstName, lastName }).toLowerCase()

      // Select random department if available
      const departmentId = availableDepartments.length > 0
        ? faker.helpers.arrayElement(availableDepartments)
        : undefined

      // Select random employment type
      const employmentType = faker.helpers.arrayElement(typesToUse)

      // Select random job title
      const jobTitle = faker.helpers.arrayElement(JOB_TITLES)

      // Determine manager if link_to_manager is true and we have existing employees
      let managerId: string | null = null
      if (link_to_manager && createdEmployees.length > 0) {
        // Randomly assign a manager from previously created employees
        const manager = faker.helpers.arrayElement(createdEmployees)
        managerId = manager.id
      }

      // Create user account
      const invite = await (supabaseAdmin.auth as any).admin.inviteUserByEmail(email, {
        data: { display_name: name },
      })

      let userId: string | null = null
      if (invite.error) {
        // Check if user already exists
        const errorMessage = invite.error.message?.toLowerCase() || ''
        if (
          errorMessage.includes('already registered') ||
          errorMessage.includes('user already exists') ||
          errorMessage.includes('already been registered')
        ) {
          const usersList = await (supabaseAdmin.auth as any).admin.listUsers()
          const userByEmail = usersList.data.users.find(
            (u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase(),
          )
          if (userByEmail) {
            userId = userByEmail.id
          } else {
            errors.push(`Failed to find existing user for ${name}: ${invite.error.message}`)
            continue
          }
        } else {
          errors.push(`Failed to create user for ${name}: ${invite.error.message}`)
          continue
        }
      } else {
        userId = invite.data.user?.id ?? null
        if (!userId) {
          errors.push(`User creation failed for ${name}: missing user ID`)
          continue
        }
      }

      // Add membership
      if (!userId) {
        errors.push(`Failed to add membership for ${name}: missing user ID`)
        continue
      }

      const memberIns = await supabaseAdmin
        .from('memberships')
        .insert({ user_id: userId, tenant_id: tenantId, role: 'employee' })
      if (memberIns.error) {
        errors.push(`Failed to add membership for ${name}: ${memberIns.error.message}`)
        continue
      }

      // Create profile
      const profileIns = await supabaseAdmin
        .from('profiles')
        .insert({ user_id: userId, tenant_id: tenantId, display_name: name })
      if (profileIns.error) {
        errors.push(`Failed to create profile for ${name}: ${profileIns.error.message}`)
        continue
      }

      // Build employee create input
      const employeeData: EmployeeCreateInput = {
        tenant_id: tenantId,
        email,
        name,
        manager_id: managerId ?? undefined,
        job_title: jobTitle,
        department_id: departmentId,
        employment_type: employmentType,
        status: 'active',
        start_date: faker.date.past({ years: 2 }).toISOString().split('T')[0],
        phone_personal: faker.phone.number(),
        phone_work: faker.phone.number(),
      }

      // Validate with schema
      const validated = EmployeeCreateInputSchema.parse(employeeData)

      // Pre-generate employee_number with randomness to avoid race conditions
      // Format: EMP-YYYY-TTTTTT-RRRR (year, timestamp suffix, random suffix)
      const year = new Date().getFullYear()
      const timestamp = Date.now().toString().slice(-6) // Last 6 digits of timestamp
      const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
      const employeeNumber = `EMP-${year}-${timestamp}-${randomSuffix}`

      // Create employee record
      const insertPayload: Database['public']['Tables']['employees']['Insert'] = {
        tenant_id: validated.tenant_id,
        email: validated.email,
        name: validated.name,
        user_id: userId,
        employee_number: employeeNumber, // Pre-generate to bypass trigger and avoid race conditions
        manager_id: validated.manager_id ?? null,
        job_title: validated.job_title ?? null,
        department_id: validated.department_id ?? null,
        employment_type: validated.employment_type ?? null,
        status: validated.status ?? 'active',
        start_date: validated.start_date ?? null,
        phone_personal: validated.phone_personal ?? null,
        phone_work: validated.phone_work ?? null,
      }

      const employeeIns = await supabase
        .from('employees')
        .insert(insertPayload)
        .select('id, name, email')
        .single()

      if (employeeIns.error || !employeeIns.data) {
        errors.push(`Failed to create employee ${name}: ${employeeIns.error?.message || 'Unknown error'}`)
        continue
      }

      createdEmployees.push({
        id: employeeIns.data.id,
        name: employeeIns.data.name,
        email: employeeIns.data.email,
      })

      // Add a small delay between employee creations to ensure proper sequencing
      // This helps prevent race conditions and ensures each transaction commits before the next
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 100)) // 100ms delay
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Error creating employee ${i + 1}: ${message}`)
    }
  }

  const summary = `Created ${createdEmployees.length} employee(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ''}.`

  return {
    success: createdEmployees.length > 0,
    records_created: createdEmployees.length,
    sample_ids: createdEmployees.map((e) => e.id),
    summary,
    metadata: {
      errors: errors.length > 0 ? errors : undefined,
      sample_names: createdEmployees.slice(0, 5).map((e) => e.name),
    },
  }
}

export async function generateDummyApprovals(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  userId: string,
  input: SampleApprovalInput,
): Promise<SampleDataResponse> {
  const { count, approval_category_mix, employee_ids, include_attachments } = input

  // Get employee IDs to use
  let availableEmployeeIds: string[] = []
  if (employee_ids && employee_ids.length > 0) {
    availableEmployeeIds = employee_ids
  } else {
    const { data: empData } = await supabase
      .from('employees')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .limit(100)
    if (empData) {
      availableEmployeeIds = empData.map((e) => e.id)
    }
  }

  if (availableEmployeeIds.length === 0) {
    return {
      success: false,
      records_created: 0,
      summary: 'No employees available to create approval requests for. Please create employees first.',
    }
  }

  // Determine category distribution
  const categories: Array<z.infer<typeof ApprovalCategoryEnum>> = [
    'equipment',
    'training',
    'salary_change',
    'profile_change',
  ]

  let categoryCounts: Map<string, number> = new Map()
  if (approval_category_mix) {
    // Use provided mix
    Object.entries(approval_category_mix).forEach(([cat, cnt]) => {
      categoryCounts.set(cat, Math.min(cnt, count))
    })
  } else {
    // Distribute evenly
    const perCategory = Math.floor(count / categories.length)
    const remainder = count % categories.length
    categories.forEach((cat, idx) => {
      categoryCounts.set(cat, perCategory + (idx < remainder ? 1 : 0))
    })
  }

  const createdApprovals: Array<{ id: string; title: string; category: string }> = []
  const errors: string[] = []

  // Generate approvals
  for (const [category, categoryCount] of categoryCounts.entries()) {
    for (let i = 0; i < categoryCount; i++) {
      try {
        const employeeId = faker.helpers.arrayElement(availableEmployeeIds)

        // Get employee for user_id lookup
        const { data: employee } = await supabase
          .from('employees')
          .select('user_id')
          .eq('id', employeeId)
          .single()

        const requestorUserId = employee?.user_id ?? userId

        // Generate category-specific approval data
        let approvalData: ApprovalRequestInput

        switch (category) {
          case 'equipment': {
            approvalData = {
              category: 'equipment',
              title: faker.helpers.arrayElement([
                `Request for ${faker.commerce.productName()}`,
                `New ${faker.commerce.productAdjective()} Equipment`,
                `Equipment Purchase: ${faker.commerce.product()}`,
              ]),
              summary: faker.lorem.sentence(),
              justification: faker.lorem.paragraph(),
              details: {
                itemType: faker.helpers.arrayElement(['Laptop', 'Monitor', 'Keyboard', 'Mouse', 'Headset']),
                specification: faker.lorem.sentence(),
                estimatedCost: faker.number.int({ min: 100, max: 5000 }),
                currency: 'USD',
                urgency: faker.helpers.arrayElement(['low', 'medium', 'high']),
              },
            }
            break
          }
          case 'training': {
            approvalData = {
              category: 'training',
              title: faker.helpers.arrayElement([
                `Training: ${faker.company.buzzNoun()}`,
                `Professional Development: ${faker.company.buzzNoun()}`,
                `Course Enrollment: ${faker.company.buzzNoun()}`,
              ]),
              summary: faker.lorem.sentence(),
              justification: faker.lorem.paragraph(),
              details: {
                courseName: faker.company.buzzNoun(),
                provider: faker.company.name(),
                durationHours: faker.number.int({ min: 8, max: 40 }),
                estimatedCost: faker.number.int({ min: 500, max: 5000 }),
                currency: 'USD',
              },
            }
            break
          }
          case 'salary_change': {
            const currentSalary = faker.number.int({ min: 40000, max: 150000 })
            const proposedSalary = faker.number.int({ min: currentSalary, max: currentSalary * 1.3 })
            approvalData = {
              category: 'salary_change',
              title: faker.helpers.arrayElement([
                'Salary Adjustment Request',
                'Compensation Review',
                'Pay Increase Proposal',
              ]),
              summary: faker.lorem.sentence(),
              justification: faker.lorem.paragraph(),
              details: {
                currentSalary,
                proposedSalary,
                currency: 'USD',
                effectiveDate: faker.date.future().toISOString().split('T')[0],
              },
            }
            break
          }
          case 'profile_change': {
            approvalData = {
              category: 'profile_change',
              title: 'Profile Information Update',
              summary: faker.lorem.sentence(),
              justification: faker.lorem.paragraph(),
              details: {
                employeeName: faker.person.fullName(),
                employeeId,
                updatedFields: {
                  phone_personal: faker.phone.number(),
                  phone_work: faker.phone.number(),
                  emergency_contact_name: faker.person.fullName(),
                  emergency_contact_phone: faker.phone.number(),
                },
              },
            }
            break
          }
          default:
            throw new Error(`Unknown category: ${category}`)
        }

        // Add attachments if requested
        if (include_attachments) {
          approvalData.attachments = [
            {
              name: faker.system.fileName(),
              url: faker.internet.url(),
              type: faker.system.mimeType(),
            },
          ]
        }

        // Validate with schema
        const validated = ApprovalRequestInputSchema.parse(approvalData)

        // Create approval request
        const insertPayload = {
          tenant_id: tenantId,
          category: validated.category,
          title: validated.title,
          summary: validated.summary ?? null,
          justification: validated.justification,
          details: validated.details,
          attachments: validated.attachments ?? [],
          needed_by: validated.needed_by ?? null,
          requested_by_user_id: requestorUserId,
          requested_by_employee_id: employeeId,
          status: 'pending',
        }

        const approvalIns = await supabase
          .from('approval_requests')
          .insert(insertPayload)
          .select('id, title, category')
          .single()

        if (approvalIns.error || !approvalIns.data) {
          errors.push(
            `Failed to create approval ${validated.title}: ${approvalIns.error?.message || 'Unknown error'}`,
          )
          continue
        }

        createdApprovals.push({
          id: approvalIns.data.id,
          title: approvalIns.data.title,
          category: approvalIns.data.category,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Error creating approval: ${message}`)
      }
    }
  }

  const summary = `Created ${createdApprovals.length} approval request(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ''}.`

  return {
    success: createdApprovals.length > 0,
    records_created: createdApprovals.length,
    sample_ids: createdApprovals.map((a) => a.id),
    summary,
    metadata: {
      errors: errors.length > 0 ? errors : undefined,
      categories: createdApprovals.reduce((acc, a) => {
        acc[a.category] = (acc[a.category] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      sample_titles: createdApprovals.slice(0, 5).map((a) => a.title),
    },
  }
}

