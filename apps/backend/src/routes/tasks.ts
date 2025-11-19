import type { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  TaskListResponseSchema,
  TaskCompleteInputSchema,
} from '@vibe/shared'

import type { Database, Json } from '@database.types.ts'
import { ensurePermission } from '../lib/permissions'
import type { Env, User } from '../types'
import {
  EmployeeDocumentUploadError,
  parseDocumentMetadata,
  saveEmployeeDocument,
} from '../features/employees/services/document-upload'
import {
  completeWorkflowTask,
  fetchTaskWithContext,
  mapRunStepToTask,
} from '../features/tasks/task-service'
import { extractRequestInfo } from '../lib/audit-logger'

type WorkflowRunStepRow = Database['public']['Tables']['workflow_run_steps']['Row']

export const registerTaskRoutes = (app: Hono<Env>) => {
  app.get('/api/tasks', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const url = new URL(c.req.url)
    const tenantId = url.searchParams.get('tenantId')

    if (!tenantId) {
      return c.json({ error: 'tenantId query parameter is required' }, 400)
    }

    try {
      await ensurePermission(supabase, tenantId, 'workflows.read')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    const statusFilter = (url.searchParams.get('status') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    const typeFilter = (url.searchParams.get('taskType') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    const assignedToId = url.searchParams.get('assignedToId')
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 1), 100)
    const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0)

    try {
      let query = supabase
        .from('workflow_run_steps')
        .select(
          `
            *,
            workflow_runs!inner (
              tenant_id,
              employee_id
            )
          `,
        )
        .eq('workflow_runs.tenant_id', tenantId)
        .order('due_at', { ascending: true, nullsFirst: true })
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (statusFilter.length > 0) {
        query = query.in('status', statusFilter)
      }

      if (typeFilter.length > 0) {
        query = query.in('task_type', typeFilter)
      }

      if (assignedToId) {
        query = query.contains('assigned_to', { id: assignedToId })
      }

      const { data, error } = await query
      if (error) {
        throw new Error(error.message)
      }

      const rows = (data ?? []) as WorkflowRunStepRow[]
      const tasks = rows.map((row) => mapRunStepToTask(row))

      const payload = TaskListResponseSchema.safeParse({ tasks })
      if (!payload.success) {
        return c.json({ error: 'Unexpected response shape' }, 500)
      }

      return c.json(payload.data)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load tasks'
      return c.json({ error: message }, 400)
    }
  })

  app.put('/api/tasks/:taskId/complete', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const taskId = c.req.param('taskId')
    const body = await c.req.json().catch(() => ({}))
    const parsed = TaskCompleteInputSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400)
    }

    let context: Awaited<ReturnType<typeof fetchTaskWithContext>>

    try {
      context = await fetchTaskWithContext(supabase, taskId)
      await ensurePermission(supabase, context.tenantId, 'workflows.run.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    if (context.task.task_type === 'document' && !parsed.data.documentId) {
      return c.json({ error: 'documentId is required for document tasks' }, 400)
    }

    const resultPayload: Record<string, unknown> = {}
    const baseResult = parsed.data.result
    if (baseResult && typeof baseResult === 'object') {
      Object.assign(resultPayload, baseResult as Record<string, unknown>)
    } else if (baseResult !== undefined) {
      resultPayload.data = baseResult
    }

    if (parsed.data.notes) {
      resultPayload.notes = parsed.data.notes
    }
    if (parsed.data.documentId) {
      resultPayload.documentId = parsed.data.documentId
    }
    if (parsed.data.formResponse) {
      resultPayload.formResponse = parsed.data.formResponse
    }

    try {
      await completeWorkflowTask({
        supabase,
        taskId,
        result: (Object.keys(resultPayload).length > 0
          ? (resultPayload as Json)
          : (baseResult as Json | null)) ?? null,
      })
      return c.json({ message: 'Task completed successfully' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to complete task'
      return c.json({ error: message }, 400)
    }
  })

  app.post('/api/tasks/:taskId/upload', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const taskId = c.req.param('taskId')
    const body = await c.req.parseBody()
    const rawFile = body.file
    const file =
      rawFile instanceof File
        ? rawFile
        : Array.isArray(rawFile)
          ? rawFile.find((item) => item instanceof File)
          : null

    if (!file) {
      return c.json({ error: 'File is required' }, 400)
    }

    let context: Awaited<ReturnType<typeof fetchTaskWithContext>>

    try {
      context = await fetchTaskWithContext(supabase, taskId)
      await ensurePermission(supabase, context.tenantId, 'workflows.run.manage')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Forbidden'
      return c.json({ error: message }, message === 'Forbidden' ? 403 : 400)
    }

    if (context.task.task_type !== 'document') {
      return c.json({ error: 'Task does not accept document uploads' }, 400)
    }

    if (!context.employeeId) {
      return c.json({ error: 'Task is not associated with an employee' }, 400)
    }

    let metadata: ReturnType<typeof parseDocumentMetadata>
    try {
      metadata = parseDocumentMetadata(body)
    } catch (error) {
      if (error instanceof EmployeeDocumentUploadError) {
        return c.json({ error: error.message }, error.status)
      }
      return c.json({ error: 'Invalid metadata' }, 400)
    }

    if (!metadata.category && context.task.payload && 'category' in context.task.payload) {
      metadata = {
        ...metadata,
        category:
          typeof (context.task.payload as Record<string, unknown>).category === 'string'
            ? ((context.task.payload as Record<string, unknown>).category as string)
            : null,
      }
    }

    const notes =
      typeof body.notes === 'string' && body.notes.trim().length > 0 ? body.notes.trim() : null

    const { ipAddress, userAgent } = extractRequestInfo(c.req)
    const user = c.get('user') as User

    try {
      const document = await saveEmployeeDocument({
        supabase,
        tenantId: context.tenantId,
        employeeId: context.employeeId,
        file,
        uploadedBy: user?.id ?? 'system',
        description:
          metadata.description ??
          (context.task.payload && 'description' in (context.task.payload as Record<string, unknown>)
            ? ((context.task.payload as Record<string, unknown>).description as string | null)
            : null),
        category: metadata.category,
        expiryDate: metadata.expiryDate,
        ipAddress,
        userAgent,
      })

      const resultPayload: Record<string, unknown> = {
        documentId: document.id,
      }

      if (notes) {
        resultPayload.notes = notes
      }

      if (context.task.payload && 'documentType' in (context.task.payload as Record<string, unknown>)) {
        resultPayload.documentType = (context.task.payload as Record<string, unknown>).documentType
      }

      await completeWorkflowTask({
        supabase,
        taskId,
        result: resultPayload as Json,
      })

      const refreshed = await fetchTaskWithContext(supabase, taskId).catch(() => null)

      return c.json({
        document,
        task: refreshed?.task ?? context.task,
      })
    } catch (error) {
      if (error instanceof EmployeeDocumentUploadError) {
        return c.json({ error: error.message }, error.status)
      }
      const message = error instanceof Error ? error.message : 'Unable to upload document'
      return c.json({ error: message }, 400)
    }
  })
}
