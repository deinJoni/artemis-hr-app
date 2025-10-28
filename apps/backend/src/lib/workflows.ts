import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@database.types.ts'
import {
  WorkflowKindEnum,
  WorkflowSchema,
  WorkflowStatusEnum,
  WorkflowListItemSchema,
  WorkflowDetailResponseSchema,
  WorkflowVersionDetailSchema,
  type WorkflowKind,
  type WorkflowListItem,
  type WorkflowDetailResponse,
  type WorkflowVersionDetail,
} from '@vibe/shared'

type Supabase = SupabaseClient<Database>

type WorkflowDefinitionValue = {
  nodes: Json[]
  edges: Json[]
  metadata: Record<string, Json>
}

const createEmptyDefinition = (): WorkflowDefinitionValue => ({
  nodes: [],
  edges: [],
  metadata: {},
})

export const WorkflowDefinitionSchema = z
  .object({
    nodes: z.array(z.unknown()).default([]),
    edges: z.array(z.unknown()).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()

export const normalizeWorkflowDefinition = (
  input: unknown,
): WorkflowDefinitionValue => {
  const base = createEmptyDefinition()
  if (input == null) return base
  const parsed = WorkflowDefinitionSchema.safeParse(input)
  if (!parsed.success) return base
  return {
    nodes: Array.isArray(parsed.data.nodes)
      ? (parsed.data.nodes as Json[])
      : [],
    edges: Array.isArray(parsed.data.edges)
      ? (parsed.data.edges as Json[])
      : [],
    metadata:
      parsed.data.metadata && typeof parsed.data.metadata === 'object'
        ? (parsed.data.metadata as Record<string, Json>)
        : {},
  }
}

export const WorkflowCreateInputSchema = z.object({
  name: z.string().min(1),
  kind: WorkflowKindEnum,
  templateId: z.string().uuid().optional(),
})
export type WorkflowCreateInput = z.infer<typeof WorkflowCreateInputSchema>

export const WorkflowUpdateInputSchema = z
  .object({
    name: z.string().min(1).optional(),
    status: WorkflowStatusEnum.optional(),
    definition: WorkflowDefinitionSchema.optional(),
  })
  .refine(
    (value) => Boolean(value.name ?? value.status ?? value.definition),
    { message: 'At least one field must be provided' },
  )
export type WorkflowUpdateInput = z.infer<typeof WorkflowUpdateInputSchema>

const slugify = (input: string) =>
  input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')

const randomSuffix = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8)
  }
  return Math.random().toString(36).slice(2, 10)
}

async function ensureUniqueSlug(
  supabase: Supabase,
  tenantId: string,
  base: string,
): Promise<string> {
  const baseSlug = slugify(base) || `workflow-${randomSuffix()}`
  let candidate = baseSlug
  let attempt = 0
  // Limit retries to avoid infinite loops; collisions are extremely unlikely.
  while (attempt < 10) {
    const { data, error } = await supabase
      .from('workflows')
      .select('slug')
      .eq('tenant_id', tenantId)
      .eq('slug', candidate)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return candidate
    candidate = `${baseSlug}-${randomSuffix()}`
    attempt += 1
  }
  throw new Error('Unable to generate unique workflow slug')
}

export async function listWorkflowsForTenant(
  supabase: Supabase,
  tenantId: string,
): Promise<WorkflowListItem[]> {
  const { data, error } = await supabase
    .from('workflows')
    .select(`
      id,
      tenant_id,
      name,
      slug,
      kind,
      status,
      active_version_id,
      created_by,
      updated_by,
      created_at,
      updated_at,
      workflow_versions:workflow_versions!workflow_versions_workflow_id_fkey (
        id,
        version_number,
        is_active,
        published_at
      )
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  const items = (data ?? []).map((row: any) => {
    const { workflow_versions: versions, ...rest } = row ?? {}
    const latestVersion = Array.isArray(versions)
      ? versions.reduce(
          (
            acc: {
              id: string
              version_number: number
              is_active: boolean
              published_at: string | null
            } | null,
            curr: any,
          ) => {
            if (!acc || curr.version_number > acc.version_number) {
              return {
                id: curr.id,
                version_number: curr.version_number,
                is_active: Boolean(curr.is_active),
                published_at: curr.published_at ?? null,
              }
            }
            return acc
          },
          null,
        )
      : null

    const payload = () => {
      const base = WorkflowSchema.safeParse(rest)
      if (!base.success) {
        throw new Error('Unexpected workflow row')
      }
      return {
        ...base.data,
        latestVersion: latestVersion ?? undefined,
      }
    }

    const parsed = WorkflowListItemSchema.safeParse(payload())
    if (!parsed.success) {
      throw new Error('Unexpected workflow list payload')
    }
    return parsed.data
  })
  return items
}

export async function getWorkflowDetail(
  supabase: Supabase,
  tenantId: string,
  workflowId: string,
) {
  const { data, error } = await supabase
    .from('workflows')
    .select(
      '*, workflow_versions(id, version_number, is_active, definition, published_at, created_at)',
    )
    .eq('tenant_id', tenantId)
    .eq('id', workflowId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Workflow not found')

  const parsedWorkflow = WorkflowSchema.safeParse(data)
  if (!parsedWorkflow.success) throw new Error('Unexpected workflow shape')

  const versions = Array.isArray(data.workflow_versions)
    ? data.workflow_versions.map(formatVersionDetail)
    : []

  return parseWorkflowDetail({
    workflow: parsedWorkflow.data,
    versions,
  })
}

export async function createWorkflowDraft(
  supabase: Supabase,
  tenantId: string,
  userId: string,
  input: WorkflowCreateInput,
): Promise<WorkflowDetailResponse> {
  const slug = await ensureUniqueSlug(supabase, tenantId, input.name)
  const now = new Date().toISOString()

  const { data: created, error } = await supabase
    .from('workflows')
    .insert({
      tenant_id: tenantId,
      name: input.name,
      slug,
      kind: input.kind,
      status: 'draft',
      created_by: userId,
      updated_by: userId,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!created) throw new Error('Workflow creation failed')

  const parsedWorkflow = WorkflowSchema.safeParse(created)
  if (!parsedWorkflow.success) throw new Error('Unexpected workflow shape')

  const definition = await resolveInitialDefinition(
    supabase,
    tenantId,
    input.kind,
    input.templateId,
  )

  const { data: version, error: versionError } = await supabase
    .from('workflow_versions')
    .insert({
      workflow_id: created.id,
      version_number: 1,
      is_active: false,
      definition: definition as Json,
      created_by: userId,
    })
    .select('id, version_number, definition, is_active, created_at, published_at')
    .maybeSingle()

  if (versionError) throw new Error(versionError.message)
  if (!version) throw new Error('Workflow version creation failed')

  return parseWorkflowDetail({
    workflow: parsedWorkflow.data,
    versions: [formatVersionDetail(version)],
  })
}

async function resolveInitialDefinition(
  supabase: Supabase,
  tenantId: string,
  kind: WorkflowKind,
  templateId?: string,
): Promise<WorkflowDefinitionValue> {
  if (!templateId) {
    return createEmptyDefinition()
  }

  const { data: template, error } = await supabase
    .from('workflow_templates')
    .select('blocks, kind')
    .eq('id', templateId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!template) throw new Error('Template not found')
  if (template.kind !== kind) {
    throw new Error('Template kind mismatch')
  }

  return normalizeWorkflowDefinition(template.blocks)
}

export async function updateWorkflowDraft(
  supabase: Supabase,
  tenantId: string,
  workflowId: string,
  userId: string,
  input: WorkflowUpdateInput,
) {
  const updates: Partial<Database['public']['Tables']['workflows']['Update']> =
    {}

  if (input.name) {
    updates.name = input.name
  }

  if (input.status) {
    updates.status = input.status
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_by = userId
    updates.updated_at = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('workflows')
      .update(updates)
      .eq('tenant_id', tenantId)
      .eq('id', workflowId)

    if (updateError) throw new Error(updateError.message)
  }

  if (input.definition) {
    const normalized = normalizeWorkflowDefinition(input.definition)
    const { error: defError } = await supabase
      .from('workflow_versions')
      .update({ definition: normalized as Json })
      .eq('workflow_id', workflowId)
      .eq('version_number', 1)

    if (defError) throw new Error(defError.message)
  }

  return getWorkflowDetail(supabase, tenantId, workflowId)
}

export async function publishWorkflow(
  supabase: Supabase,
  tenantId: string,
  workflowId: string,
  userId: string,
) {
  const { data: version, error: versionError } = await supabase
    .from('workflow_versions')
    .select('id, version_number, published_at')
    .eq('workflow_id', workflowId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (versionError) throw new Error(versionError.message)
  if (!version) throw new Error('No workflow version to publish')

  const now = new Date().toISOString()
  const { error: updateVersionError } = await supabase
    .from('workflow_versions')
    .update({ is_active: true, published_at: now })
    .eq('id', version.id)

  if (updateVersionError) throw new Error(updateVersionError.message)

  const { error: workflowUpdateError } = await supabase
    .from('workflows')
    .update({
      status: 'published',
      active_version_id: version.id,
      updated_by: userId,
      updated_at: now,
    })
    .eq('tenant_id', tenantId)
    .eq('id', workflowId)

  if (workflowUpdateError) throw new Error(workflowUpdateError.message)

  return getWorkflowDetail(supabase, tenantId, workflowId)
}

function formatVersionDetail(input: any): WorkflowVersionDetail {
  const parsed = WorkflowVersionDetailSchema.safeParse({
    id: input?.id,
    version_number: input?.version_number,
    is_active: Boolean(input?.is_active),
    definition: input?.definition as Json,
    published_at: input?.published_at ?? null,
    created_at: input?.created_at,
  })
  if (!parsed.success) {
    throw new Error('Unexpected workflow version payload')
  }
  return parsed.data
}

function parseWorkflowDetail(payload: unknown): WorkflowDetailResponse {
  const parsed = WorkflowDetailResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error('Unexpected workflow detail payload')
  }
  return parsed.data
}
