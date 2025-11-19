import './polyfills/abort-signal-any'
import app from './index'
import { supabaseAdmin } from './lib/supabase'
import { WorkflowEngine } from './lib/workflow-engine'
import { WorkflowQueueProcessor } from './lib/workflow-queue'

const port = Number(process.env.PORT ?? 8787)

// Initialize workflow queue processor
let queueProcessor: WorkflowQueueProcessor | null = null
let bunServer: { stop(): void } | null = null

const MAX_PORT_RETRIES = 5

function isAddrInUseError(error: unknown): error is Error & { code?: string } {
  return (
    error instanceof Error &&
    typeof (error as { code?: string }).code === 'string' &&
    (error as { code?: string }).code === 'EADDRINUSE'
  )
}

function startServer(initialPort: number, preferExactPort: boolean) {
  let attempts = 0
  let currentPort = initialPort

  while (attempts <= MAX_PORT_RETRIES) {
    try {
      const server = Bun.serve({ fetch: app.fetch, port: currentPort })
      return { server, port: currentPort }
    } catch (error) {
      if (isAddrInUseError(error) && attempts < MAX_PORT_RETRIES) {
        const nextPort = currentPort + 1
        console.warn(
          `[backend] Port ${currentPort} in use${
            preferExactPort && attempts === 0 ? ' (from PORT env variable)' : ''
          }, retrying on ${nextPort}...`
        )
        currentPort = nextPort
        attempts += 1
        continue
      }

      throw error
    }
  }

  throw new Error(
    `Unable to find an available port after ${MAX_PORT_RETRIES + 1} attempts starting at ${initialPort}.`
  )
}

if (typeof Bun !== 'undefined' && (Bun as any).serve) {
  try {
    const { server, port: activePort } = startServer(port, Boolean(process.env.PORT))
    bunServer = server
    console.log(`[backend] Listening on http://localhost:${activePort}`)

    // Start workflow queue processor
    try {
      const engine = new WorkflowEngine(supabaseAdmin)
      queueProcessor = new WorkflowQueueProcessor(supabaseAdmin, engine, 60000) // Poll every minute
      queueProcessor.start()
      console.log('[backend] Workflow queue processor started')
    } catch (error) {
      console.error('[backend] Failed to start workflow queue processor:', error)
    }
  } catch (error) {
    console.error('[backend] Failed to start server:', error)
    process.exit(1)
  }

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('[backend] Shutting down...')
    if (queueProcessor) {
      queueProcessor.stop()
    }
    bunServer?.stop()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log('[backend] Shutting down...')
    if (queueProcessor) {
      queueProcessor.stop()
    }
    bunServer?.stop()
    process.exit(0)
  })
}
