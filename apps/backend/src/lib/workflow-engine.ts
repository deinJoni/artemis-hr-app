import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@database.types.ts'
import type {
  WorkflowRunStatus,
  WorkflowRunStepStatus,
} from '@vibe/shared'

type Supabase = SupabaseClient<Database>

type WorkflowRow = Pick<
  Database['public']['Tables']['workflows']['Row'],
  'id' | 'kind' | 'active_version_id'
> & {
  workflow_versions: Array<{
    id: string
    definition: WorkflowDefinition | null
  }> | null
}

type WorkflowDefinition = {
  nodes: Array<{
    id: string
    type: string
    label?: string
    config?: unknown
  }>
  edges: Array<{
    source: string
    target: string
  }>
  metadata?: Record<string, unknown>
}

type TriggerEvent = {
  type: string
  tenantId: string
  employeeId?: string
  payload?: Record<string, unknown>
}

type StepExecutionContext = {
  runId: string
  nodeId: string // workflow_nodes.id
  definitionNodeId?: string // node.id from definition (for reference)
  tenantId: string
  employeeId?: string
  config: unknown
  context: Record<string, unknown>
}

export class WorkflowEngine {
  constructor(private supabase: Supabase) {}

  /**
   * Handle a trigger event and instantiate matching workflows
   */
  async handleTrigger(event: TriggerEvent): Promise<void> {
    const { type, tenantId, employeeId, payload = {} } = event

    console.log('[WORKFLOW-TRIGGER] Handling trigger event:', {
      type,
      tenantId,
      employeeId,
      payloadKeys: Object.keys(payload),
    })

    // Find published workflows that match this trigger
    const { data: workflows, error } = await this.supabase
      .from('workflows')
      .select(`
        id,
        kind,
        active_version_id,
        workflow_versions!workflows_active_version_fk!inner (
          id,
          definition
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'published')
      .not('active_version_id', 'is', null)

    if (error) {
      console.error('[WORKFLOW-TRIGGER] Error fetching workflows for trigger:', error)
      return
    }

    const typedWorkflows = (workflows ?? []) as unknown as WorkflowRow[]

    if (typedWorkflows.length === 0) {
      console.log('[WORKFLOW-TRIGGER] No published workflows found for tenant:', tenantId)
      return
    }

    console.log('[WORKFLOW-TRIGGER] Found published workflows:', {
      count: typedWorkflows.length,
      workflowIds: typedWorkflows.map((workflow) => workflow.id),
    })

    // Check each workflow's definition for matching trigger
    for (const workflow of typedWorkflows) {
      const version = Array.isArray(workflow.workflow_versions)
        ? workflow.workflow_versions[0]
        : null

      if (!version) {
        console.log('[WORKFLOW-TRIGGER] Skipping workflow (no version):', workflow.id)
        continue
      }

      const definition = version.definition as WorkflowDefinition
      if (!definition?.nodes) {
        console.log('[WORKFLOW-TRIGGER] Skipping workflow (no nodes):', workflow.id)
        continue
      }

      // Find trigger nodes matching this event type
      const triggerNodes = definition.nodes.filter(
        (node) =>
          node.type === 'trigger' &&
          (node.config as { event?: string })?.event === type,
      )

      if (triggerNodes.length === 0) {
        console.log('[WORKFLOW-TRIGGER] Skipping workflow (no matching trigger):', {
          workflowId: workflow.id,
          eventType: type,
          triggerNodesInDefinition: definition.nodes.filter(n => n.type === 'trigger').map(n => (n.config as { event?: string })?.event),
        })
        continue
      }

      console.log('[WORKFLOW-TRIGGER] Matching workflow found, instantiating run:', {
        workflowId: workflow.id,
        versionId: version.id,
        triggerNodes: triggerNodes.length,
        employeeId,
      })

      // Check if workflow should run for this employee
      // For now, we'll run all matching workflows
      // TODO: Add filtering logic based on employee attributes

      // Instantiate the workflow run
      await this.instantiateRun({
        workflowId: workflow.id,
        versionId: version.id,
        tenantId,
        employeeId,
        triggerSource: type,
        context: payload,
      })
    }
  }

  /**
   * Instantiate a workflow run from a published workflow
   */
  async instantiateRun(params: {
    workflowId: string
    versionId: string
    tenantId: string
    employeeId?: string
    triggerSource: string
    context?: Record<string, unknown>
  }): Promise<string> {
    const { workflowId, versionId, tenantId, employeeId, triggerSource, context = {} } = params

    console.log('[WORKFLOW-RUN] Instantiating workflow run:', {
      workflowId,
      versionId,
      tenantId,
      employeeId,
      triggerSource,
    })

    // Create workflow run
    const { data: run, error: runError } = await this.supabase
      .from('workflow_runs')
      .insert({
        tenant_id: tenantId,
        workflow_id: workflowId,
        version_id: versionId,
        employee_id: employeeId,
        trigger_source: triggerSource,
        status: 'pending',
        context: context as Json,
      })
      .select('id')
      .single()

    if (runError || !run) {
      console.error('[WORKFLOW-RUN] Failed to create workflow run:', runError)
      throw new Error(`Failed to create workflow run: ${runError?.message}`)
    }

    const runId = run.id
    console.log('[WORKFLOW-RUN] Workflow run created:', { runId, workflowId, employeeId })

    // Get workflow definition
    const { data: version, error: versionError } = await this.supabase
      .from('workflow_versions')
      .select('definition')
      .eq('id', versionId)
      .single()

    if (versionError || !version) {
      console.error('[WORKFLOW-RUN] Failed to fetch workflow version:', versionError)
      throw new Error(`Failed to fetch workflow version: ${versionError?.message}`)
    }

    const definition = version.definition as WorkflowDefinition
    console.log('[WORKFLOW-RUN] Workflow definition loaded:', {
      runId,
      nodeCount: definition.nodes?.length || 0,
      nodeTypes: definition.nodes?.map(n => n.type) || [],
    })

    // Create workflow_nodes from definition if they don't exist
    // For MVP, we'll create them on-the-fly for this run
    const nodeIdMap = new Map<string, string>() // Maps definition node.id to workflow_nodes.id

    for (const defNode of definition.nodes || []) {
      // Check if node already exists
      const { data: existingNode } = await this.supabase
        .from('workflow_nodes')
        .select('id')
        .eq('version_id', versionId)
        .eq('node_key', defNode.id)
        .maybeSingle()

      if (existingNode) {
        nodeIdMap.set(defNode.id, existingNode.id)
      } else {
        // Create workflow_node
        const { data: newNode, error: nodeError } = await this.supabase
          .from('workflow_nodes')
          .insert({
            version_id: versionId,
            node_key: defNode.id,
            type: defNode.type,
            label: defNode.label || null,
            config: (defNode.config || {}) as Json,
          })
          .select('id')
          .single()

        if (nodeError || !newNode) {
          console.error(`Failed to create workflow node ${defNode.id}:`, nodeError)
          continue
        }

        nodeIdMap.set(defNode.id, newNode.id)
      }
    }

    // Create employee journey view
    if (employeeId) {
      const shareToken = crypto.randomUUID()
      await this.supabase
        .from('employee_journey_views')
        .upsert({
          run_id: runId,
          share_token: shareToken,
          hero_copy: `Welcome! Let's get you started.`,
          cta_label: 'View Your Journey',
        }, {
          onConflict: 'run_id',
        })
    }

    // Mark run as in_progress
    await this.supabase
      .from('workflow_runs')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .eq('id', runId)

    // Process initial steps (trigger nodes)
    const triggerNodes = definition.nodes?.filter((node) => node.type === 'trigger') || []
    console.log('[WORKFLOW-RUN] Processing trigger nodes:', {
      runId,
      triggerNodeCount: triggerNodes.length,
      triggerNodeIds: triggerNodes.map(n => n.id),
    })

    for (const triggerNode of triggerNodes) {
      const workflowNodeId = nodeIdMap.get(triggerNode.id)
      if (workflowNodeId) {
        console.log('[WORKFLOW-RUN] Processing trigger node:', {
          runId,
          triggerNodeId: triggerNode.id,
          workflowNodeId,
        })
        await this.processStep({
          runId,
          nodeId: workflowNodeId, // Use workflow_nodes.id
          definitionNodeId: triggerNode.id, // Keep reference to definition node
          tenantId,
          employeeId,
          config: triggerNode.config || {},
          context,
        })
      }
    }

    console.log('[WORKFLOW-RUN] Workflow run instantiated and processing started:', { runId })
    return runId
  }

  /**
   * Process a workflow step
   */
  async processStep(ctx: StepExecutionContext): Promise<void> {
    const { runId, nodeId, tenantId, employeeId, config, context } = ctx

    console.log('[WORKFLOW-STEP] Processing step:', {
      runId,
      nodeId,
      employeeId,
      configKeys: Object.keys(config || {}),
    })

    // Get node definition from workflow definition
    const { data: run } = await this.supabase
      .from('workflow_runs')
      .select(`
        workflow_versions!inner (
          definition
        )
      `)
      .eq('id', runId)
      .single()

    if (!run) {
      throw new Error(`Workflow run not found: ${runId}`)
    }

    const version = Array.isArray(run.workflow_versions)
      ? run.workflow_versions[0]
      : null

    if (!version) {
      throw new Error(`Workflow version not found for run: ${runId}`)
    }

    const definition = version.definition as WorkflowDefinition
    
    // Get workflow_node to find the definition node
    const { data: workflowNode, error: nodeError } = await this.supabase
      .from('workflow_nodes')
      .select('node_key, type, config')
      .eq('id', nodeId)
      .single()

    if (nodeError || !workflowNode) {
      console.error('[WORKFLOW-STEP] Workflow node not found:', { nodeId, error: nodeError })
      throw new Error(`Workflow node not found: ${nodeId}`)
    }

    // Find corresponding definition node
    const node = definition.nodes?.find((n) => n.id === workflowNode.node_key)
    if (!node) {
      console.error('[WORKFLOW-STEP] Definition node not found:', { nodeId, nodeKey: workflowNode.node_key })
      throw new Error(`Definition node not found for workflow node: ${nodeId}`)
    }

    console.log('[WORKFLOW-STEP] Node details:', {
      runId,
      nodeId,
      nodeType: node.type,
      nodeLabel: node.label,
      nodeConfig: node.config,
    })

    // Update step status to in_progress
    // Note: We'll need to find the step by matching node_id from workflow_nodes
    // For MVP, we'll work around this by using the definition directly

    try {
      // Execute based on node type
      switch (node.type) {
        case 'trigger':
          // Trigger nodes are already processed, mark as completed
          console.log('[WORKFLOW-STEP] Completing trigger node:', { runId, nodeId })
          await this.completeStep(runId, nodeId, {})
          break

        case 'action':
          console.log('[WORKFLOW-STEP] Executing action node:', { runId, nodeId, actionType: (node.config as Record<string, unknown>)?.type })
          await this.executeAction(ctx, node)
          break

        case 'delay':
          console.log('[WORKFLOW-STEP] Executing delay node:', { runId, nodeId })
          await this.executeDelay(ctx, node)
          break

        case 'logic':
          // Logic nodes (if/then, parallel) - for MVP, we'll skip complex logic
          console.log('[WORKFLOW-STEP] Completing logic node:', { runId, nodeId })
          await this.completeStep(runId, nodeId, {})
          break

        default:
          console.warn('[WORKFLOW-STEP] Unknown node type:', { runId, nodeId, nodeType: node.type })
          await this.completeStep(runId, nodeId, {})
      }
    } catch (error) {
      console.error('[WORKFLOW-STEP] Step processing failed:', {
        runId,
        nodeId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      await this.failStep(runId, nodeId, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  /**
   * Execute an action node
   */
  private async executeAction(ctx: StepExecutionContext, node: { id: string; config?: unknown }): Promise<void> {
    const config = node.config as Record<string, unknown>
    const actionType = String(config?.type || config?.label || 'unknown')

    // For MVP, we'll implement basic action types
    // In a full implementation, this would dispatch to specific executors
    if (actionType.includes('email') || config?.template) {
      await this.executeSendEmail(ctx, config)
    } else if (actionType.includes('task') || config?.tasks) {
      await this.executeAssignTask(ctx, config)
    } else if (actionType.includes('document') || config?.documents) {
      await this.executeCreateDocument(ctx, config)
    } else if (config?.form || config?.form_schema) {
      await this.executeFormTask(ctx, config)
    } else {
      // Default: mark as completed
      await this.completeStep(ctx.runId, node.id, {})
    }
  }

  /**
   * Execute send email action
   */
  async executeSendEmail(ctx: StepExecutionContext, config: Record<string, unknown>): Promise<void> {
    // TODO: Integrate with email service
    // For MVP, we'll just log and mark as complete
    console.log('Execute send email:', {
      runId: ctx.runId,
      template: config.template,
      employeeId: ctx.employeeId,
    })

    await this.completeStep(ctx.runId, ctx.nodeId, {
      sent: true,
      template: config.template,
    })
  }

  /**
   * Execute assign task action
   */
  async executeAssignTask(ctx: StepExecutionContext, config: Record<string, unknown>): Promise<void> {
    const { runId, employeeId, nodeId } = ctx

    console.log('[WORKFLOW-TASK] Executing assign task action:', {
      runId,
      employeeId,
      nodeId,
      config,
    })

    // Create task entries as workflow_run_steps
    // We need to find the workflow_node_id for this node
    // For MVP, we'll create steps directly

    const tasks = (config.tasks as string[]) || []
    const assignee = config.assigned_to || { type: 'employee', id: employeeId }

    console.log('[WORKFLOW-TASK] Creating tasks:', {
      runId,
      taskCount: tasks.length,
      tasks,
      assignee,
    })

    for (const taskTitle of tasks) {
      // Create a step record for this task
      // Note: This is simplified - in production, we'd use workflow_nodes table
      const stepPayload = {
        title: taskTitle,
        description: config.description || '',
        instructions: config.instructions || '',
        priority: config.priority || 'medium',
      }

      // Get or create step
      const { data: existingStep } = await this.supabase
        .from('workflow_run_steps')
        .select('id')
        .eq('run_id', runId)
        .eq('node_id', nodeId)
        .maybeSingle()

      if (existingStep) {
        console.log('[WORKFLOW-TASK] Updating existing task step:', {
          runId,
          stepId: existingStep.id,
          taskTitle,
        })
        await this.supabase
          .from('workflow_run_steps')
          .update({
            status: 'waiting_input',
            assigned_to: assignee as Json,
            due_at: this.calculateDueDate(config),
            payload: stepPayload as unknown as Json,
            task_type: 'general',
          })
          .eq('id', existingStep.id)
      } else {
        console.log('[WORKFLOW-TASK] Creating new task step:', {
          runId,
          nodeId,
          taskTitle,
          taskType: 'general',
        })
        const { data: newStep, error: stepError } = await this.supabase
          .from('workflow_run_steps')
          .insert({
            run_id: runId,
            node_id: nodeId,
            status: 'waiting_input',
            assigned_to: assignee as Json,
            due_at: this.calculateDueDate(config),
            payload: stepPayload as unknown as Json,
            task_type: 'general',
          })
          .select('id')
          .single()

        if (stepError) {
          console.error('[WORKFLOW-TASK] Failed to create task step:', {
            runId,
            taskTitle,
            error: stepError,
          })
        } else {
          console.log('[WORKFLOW-TASK] Task step created successfully:', {
            runId,
            stepId: newStep?.id,
            taskTitle,
          })
        }
      }
    }

    console.log('[WORKFLOW-TASK] Completed assign task action:', {
      runId,
      tasksCreated: tasks.length,
    })

    await this.completeStep(runId, nodeId, {
      tasksCreated: tasks.length,
    })
  }

  /**
   * Execute create document action
   */
  async executeCreateDocument(ctx: StepExecutionContext, config: Record<string, unknown>): Promise<void> {
    const { runId, tenantId, employeeId, nodeId } = ctx

    console.log('[WORKFLOW-DOCUMENT] Executing create document action:', {
      runId,
      tenantId,
      employeeId,
      nodeId,
      config,
    })

    // TODO: Integrate with document service
    // For MVP, we'll create document requests as workflow steps
    const documents = (config.documents as string[]) || []
    const baseTitle = typeof config?.title === 'string' ? (config.title as string) : null
    const baseDescription = typeof config?.description === 'string' ? (config.description as string) : null
    const baseInstructions = typeof config?.instructions === 'string' ? (config.instructions as string) : null
    const baseCategory = typeof config?.category === 'string' ? (config.category as string) : null

    console.log('[WORKFLOW-DOCUMENT] Creating document tasks:', {
      runId,
      documentCount: documents.length,
      documents,
    })

    for (const docType of documents) {
      // Create document request step
      const stepPayload = {
        title: baseTitle || `Upload ${docType}`,
        description: baseDescription || undefined,
        instructions: baseInstructions || undefined,
        priority: (config?.priority as string) || 'medium',
        documentType: docType,
        category: baseCategory || undefined,
        required: true,
      }

      // Get or create step
      const { data: existingStep } = await this.supabase
        .from('workflow_run_steps')
        .select('id')
        .eq('run_id', runId)
        .eq('node_id', nodeId)
        .maybeSingle()

      if (existingStep) {
        console.log('[WORKFLOW-DOCUMENT] Updating existing document step:', {
          runId,
          stepId: existingStep.id,
          docType,
        })
        await this.supabase
          .from('workflow_run_steps')
          .update({
            status: 'waiting_input',
            assigned_to: { type: 'employee', id: employeeId } as Json,
            payload: stepPayload as Json,
            task_type: 'document',
          })
          .eq('id', existingStep.id)
      } else {
        console.log('[WORKFLOW-DOCUMENT] Creating new document step:', {
          runId,
          nodeId,
          docType,
          taskType: 'document',
        })
        const { data: newStep, error: stepError } = await this.supabase
          .from('workflow_run_steps')
          .insert({
            run_id: runId,
            node_id: nodeId,
            status: 'waiting_input',
            assigned_to: { type: 'employee', id: employeeId } as Json,
            payload: stepPayload as Json,
            task_type: 'document',
          })
          .select('id')
          .single()

        if (stepError) {
          console.error('[WORKFLOW-DOCUMENT] Failed to create document step:', {
            runId,
            docType,
            error: stepError,
          })
        } else {
          console.log('[WORKFLOW-DOCUMENT] Document step created successfully:', {
            runId,
            stepId: newStep?.id,
            docType,
          })
        }
      }
    }

    console.log('[WORKFLOW-DOCUMENT] Completed create document action:', {
      runId,
      documentsRequested: documents.length,
    })

    await this.completeStep(runId, nodeId, {
      documentsRequested: documents.length,
    })
  }

  /**
   * Execute form task action
   */
  async executeFormTask(ctx: StepExecutionContext, config: Record<string, unknown>): Promise<void> {
    const { runId, nodeId, employeeId } = ctx
    const assignee = config.assigned_to || { type: 'employee', id: employeeId }
    const formConfig = (config.form as Record<string, unknown>) || (config as Record<string, unknown>)

    const stepPayload = {
      title: (formConfig?.title as string) || 'Complete form',
      description: (formConfig?.description as string) || undefined,
      instructions: (formConfig?.instructions as string) || undefined,
      priority: (formConfig?.priority as string) || 'medium',
      formKey: (formConfig?.key as string) || (formConfig?.formKey as string) || nodeId,
      schema:
        (formConfig?.schema as Record<string, unknown>) ||
        (config?.form_schema as Record<string, unknown>) ||
        undefined,
      fields: Array.isArray(formConfig?.fields) ? (formConfig.fields as unknown[]) : undefined,
      submitLabel: (formConfig?.submit_label as string) || (formConfig?.submitLabel as string) || undefined,
      defaultValues: (formConfig?.default_values as Record<string, unknown>) || undefined,
    }

    const { data: existingStep } = await this.supabase
      .from('workflow_run_steps')
      .select('id')
      .eq('run_id', runId)
      .eq('node_id', nodeId)
      .maybeSingle()

    if (existingStep) {
      await this.supabase
        .from('workflow_run_steps')
        .update({
          status: 'waiting_input',
          assigned_to: assignee as Json,
          due_at: this.calculateDueDate(config),
          payload: stepPayload as unknown as Json,
          task_type: 'form',
        })
        .eq('id', existingStep.id)
    } else {
      await this.supabase
        .from('workflow_run_steps')
        .insert({
          run_id: runId,
          node_id: nodeId,
          status: 'waiting_input',
          assigned_to: assignee as Json,
          due_at: this.calculateDueDate(config),
          payload: stepPayload as unknown as Json,
          task_type: 'form',
        })
    }

    await this.completeStep(runId, nodeId, {
      formAwaitingInput: true,
    })
  }

  /**
   * Execute delay action
   */
  async executeDelay(ctx: StepExecutionContext, node: { id: string; config?: unknown }): Promise<void> {
    const config = node.config as { duration?: { value?: number; unit?: string } }
    const duration = config?.duration || { value: 1, unit: 'day' }
    const { value = 1, unit = 'day' } = duration

    // Calculate resume time
    const now = new Date()
    const resumeAt = new Date(now)
    if (unit === 'day') {
      resumeAt.setDate(resumeAt.getDate() + value)
    } else if (unit === 'hour') {
      resumeAt.setHours(resumeAt.getHours() + value)
    } else if (unit === 'minute') {
      resumeAt.setMinutes(resumeAt.getMinutes() + value)
    }

    // Queue the delay
    await this.supabase
      .from('workflow_action_queue')
      .insert({
        run_id: ctx.runId,
        node_id: ctx.nodeId,
        resume_at: resumeAt.toISOString(),
        attempts: 0,
        metadata: { delay: duration } as Json,
      })

    // Mark step as queued (will be resumed by queue processor)
    await this.updateStepStatus(ctx.runId, ctx.nodeId, 'queued')
  }

  /**
   * Calculate due date from config
   */
  private calculateDueDate(config: Record<string, unknown>): string | null {
    if (!config.due_date) return null

    const dueDate = config.due_date as { relative?: string; absolute?: string }
    if (dueDate.absolute) {
      return dueDate.absolute
    }

    if (dueDate.relative) {
      // Parse relative dates like "Day -3", "Day 1", "Week 2"
      const match = dueDate.relative.match(/(\w+)\s*([+-]?\d+)/)
      if (match) {
        const [, unit, offset] = match
        const now = new Date()
        if (unit.toLowerCase() === 'day') {
          now.setDate(now.getDate() + parseInt(offset, 10))
          return now.toISOString()
        }
      }
    }

    return null
  }

  /**
   * Complete a step
   */
  private async completeStep(runId: string, nodeId: string, result: unknown): Promise<void> {
    const now = new Date().toISOString()

    // Get or create step
    const { data: existingStep } = await this.supabase
      .from('workflow_run_steps')
      .select('id')
      .eq('run_id', runId)
      .eq('node_id', nodeId)
      .maybeSingle()

    if (existingStep) {
      // Update existing step
      await this.supabase
        .from('workflow_run_steps')
        .update({
          status: 'completed',
          result: result as Json,
          completed_at: now,
        })
        .eq('id', existingStep.id)
    } else {
      // Create new step
      await this.supabase
        .from('workflow_run_steps')
        .insert({
          run_id: runId,
          node_id: nodeId,
          status: 'completed',
          result: result as Json,
          completed_at: now,
        })
    }

    // Check if run is complete and process next steps
    await this.checkAndContinueRun(runId)
  }

  /**
   * Fail a step
   */
  private async failStep(runId: string, nodeId: string, error: string): Promise<void> {
    // Get or create step
    const { data: existingStep } = await this.supabase
      .from('workflow_run_steps')
      .select('id')
      .eq('run_id', runId)
      .eq('node_id', nodeId)
      .maybeSingle()

    if (existingStep) {
      await this.supabase
        .from('workflow_run_steps')
        .update({
          status: 'failed',
          error,
        })
        .eq('id', existingStep.id)
    } else {
      await this.supabase
        .from('workflow_run_steps')
        .insert({
          run_id: runId,
          node_id: nodeId,
          status: 'failed',
          error,
        })
    }

    // Mark run as failed
    await this.supabase
      .from('workflow_runs')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        last_error: error,
      })
      .eq('id', runId)
  }

  /**
   * Update step status
   */
  private async updateStepStatus(runId: string, nodeId: string, status: WorkflowRunStepStatus): Promise<void> {
    const { data: existingStep } = await this.supabase
      .from('workflow_run_steps')
      .select('id')
      .eq('run_id', runId)
      .eq('node_id', nodeId)
      .maybeSingle()

    if (existingStep) {
      await this.supabase
        .from('workflow_run_steps')
        .update({ status })
        .eq('id', existingStep.id)
    } else {
      await this.supabase
        .from('workflow_run_steps')
        .insert({
          run_id: runId,
          node_id: nodeId,
          status,
        })
    }
  }

  /**
   * Check if run is complete and process next steps
   */
  async checkAndContinueRun(runId: string): Promise<void> {
    // Get workflow definition
    const { data: run } = await this.supabase
      .from('workflow_runs')
      .select(`
        workflow_versions!inner (
          definition
        )
      `)
      .eq('id', runId)
      .single()

    if (!run) return

    const version = Array.isArray(run.workflow_versions)
      ? run.workflow_versions[0]
      : null

    if (!version) return

    const definition = version.definition as WorkflowDefinition

    // Get completed steps
    const { data: completedSteps } = await this.supabase
      .from('workflow_run_steps')
      .select('node_id')
      .eq('run_id', runId)
      .eq('status', 'completed')

    const completedNodeIds = new Set(
      (completedSteps || []).map((s: { node_id: string }) => s.node_id),
    )

    // Find next steps (nodes connected from completed nodes)
    // We need to map from definition node IDs to workflow_node IDs
    const { data: allNodes } = await this.supabase
      .from('workflow_nodes')
      .select('id, node_key')
      .eq('version_id', (run as any).version_id)

    const nodeKeyToIdMap = new Map(
      (allNodes || []).map((n: { node_key: string; id: string }) => [n.node_key, n.id])
    )

    const nextNodeKeys: string[] = []
    for (const edge of definition.edges || []) {
      // Find completed workflow_node IDs that match the source
      const completedWorkflowNodeIds = Array.from(completedNodeIds)
      const sourceWorkflowNodeId = nodeKeyToIdMap.get(edge.source)
      
      if (sourceWorkflowNodeId && completedNodeIds.has(sourceWorkflowNodeId)) {
        nextNodeKeys.push(edge.target)
      }
    }

    // Process next steps
    for (const nodeKey of nextNodeKeys) {
      const workflowNodeId = nodeKeyToIdMap.get(nodeKey)
      if (!workflowNodeId) continue

      // Check if step is already processed
      if (completedNodeIds.has(workflowNodeId)) continue

      const node = definition.nodes?.find((n) => n.id === nodeKey)
      if (!node) continue

      // Process the step
      await this.processStep({
        runId,
        nodeId: workflowNodeId as string,
        definitionNodeId: nodeKey,
        tenantId: (run as any).tenant_id,
        employeeId: (run as any).employee_id || undefined,
        config: (node.config || {}) as Record<string, unknown>,
        context: ((run as any).context || {}) as Record<string, unknown>,
      })
    }

    // Check if all steps are complete
    const { data: allSteps } = await this.supabase
      .from('workflow_run_steps')
      .select('status')
      .eq('run_id', runId)

    const allCompleted =
      allSteps &&
      allSteps.length > 0 &&
      allSteps.every(
        (s: { status: string }) =>
          s.status === 'completed' ||
          s.status === 'failed' ||
          s.status === 'canceled',
      )

    if (allCompleted) {
      await this.supabase
        .from('workflow_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId)
    }
  }
}
