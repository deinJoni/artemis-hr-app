import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@database.types.ts'
import { WorkflowEngine } from './workflow-engine'

type Supabase = SupabaseClient<Database>

export class WorkflowQueueProcessor {
  private intervalId: NodeJS.Timeout | null = null
  private isProcessing = false

  constructor(
    private supabase: Supabase,
    private engine: WorkflowEngine,
    private pollIntervalMs: number = 60000, // 1 minute default
  ) {}

  /**
   * Start polling the queue
   */
  start(): void {
    if (this.intervalId) {
      console.warn('Workflow queue processor already started')
      return
    }

    console.log(`Starting workflow queue processor (polling every ${this.pollIntervalMs}ms)`)
    
    // Process immediately, then set up interval
    this.processQueue().catch((error) => {
      console.error('Error in initial queue processing:', error)
    })

    this.intervalId = setInterval(() => {
      this.processQueue().catch((error) => {
        console.error('Error processing workflow queue:', error)
      })
    }, this.pollIntervalMs)
  }

  /**
   * Stop polling the queue
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('Workflow queue processor stopped')
    }
  }

  /**
   * Process queued workflow actions
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return // Skip if already processing
    }

    this.isProcessing = true

    try {
      const now = new Date().toISOString()

      // Get due actions from queue
      const { data: queueItems, error } = await this.supabase
        .from('workflow_action_queue')
        .select(`
          id,
          run_id,
          node_id,
          resume_at,
          attempts,
          metadata,
          workflow_runs!inner (
            id,
            tenant_id,
            employee_id,
            context,
            workflow_versions!inner (
              definition
            )
          )
        `)
        .lte('resume_at', now)
        .order('resume_at', { ascending: true })
        .limit(50) // Process up to 50 items at a time

      if (error) {
        console.error('Error fetching queue items:', error)
        return
      }

      if (!queueItems || queueItems.length === 0) {
        return // No items to process
      }

      console.log(`Processing ${queueItems.length} queued workflow actions`)

      for (const item of queueItems) {
        try {
          const run = Array.isArray(item.workflow_runs) ? item.workflow_runs[0] : item.workflow_runs
          if (!run) {
            // Clean up orphaned queue item
            await this.supabase
              .from('workflow_action_queue')
              .delete()
              .eq('id', item.id)
            continue
          }

          const version = Array.isArray(run.workflow_versions)
            ? run.workflow_versions[0]
            : null

          if (!version) {
            await this.supabase
              .from('workflow_action_queue')
              .delete()
              .eq('id', item.id)
            continue
          }

          const definition = version.definition as {
            nodes?: Array<{ id: string; type?: string; config?: unknown }>
          }

          const node = definition.nodes?.find((n) => n.id === item.node_id)
          if (!node) {
            // Node not found, clean up
            await this.supabase
              .from('workflow_action_queue')
              .delete()
              .eq('id', item.id)
            continue
          }

          // Resume workflow execution
          if (item.node_id) {
            await this.engine.processStep({
              runId: run.id,
              nodeId: item.node_id,
              tenantId: (run as any).tenant_id,
              employeeId: (run as any).employee_id || undefined,
              config: node.config || {},
              context: ((run as any).context || {}) as Record<string, unknown>,
            })
          }

          // Remove from queue
          await this.supabase
            .from('workflow_action_queue')
            .delete()
            .eq('id', item.id)
        } catch (error) {
          console.error(`Error processing queue item ${item.id}:`, error)

          // Increment attempts
          const attempts = (item.attempts || 0) + 1
          const maxAttempts = 3

          if (attempts >= maxAttempts) {
            // Max attempts reached, mark as failed
            await this.supabase
              .from('workflow_action_queue')
              .update({
                attempts,
                last_error: error instanceof Error ? error.message : 'Unknown error',
              })
              .eq('id', item.id)

            // Mark workflow run as failed
            await this.supabase
              .from('workflow_runs')
              .update({
                status: 'failed',
                failed_at: new Date().toISOString(),
                last_error: error instanceof Error ? error.message : 'Queue processing failed after max attempts',
              })
              .eq('id', item.run_id)

            // Remove from queue
            await this.supabase
              .from('workflow_action_queue')
              .delete()
              .eq('id', item.id)
          } else {
            // Retry with exponential backoff
            const backoffMinutes = Math.pow(2, attempts) // 2, 4, 8 minutes
            const resumeAt = new Date()
            resumeAt.setMinutes(resumeAt.getMinutes() + backoffMinutes)

            await this.supabase
              .from('workflow_action_queue')
              .update({
                attempts,
                resume_at: resumeAt.toISOString(),
                last_error: error instanceof Error ? error.message : 'Unknown error',
              })
              .eq('id', item.id)
          }
        }
      }
    } finally {
      this.isProcessing = false
    }
  }
}

