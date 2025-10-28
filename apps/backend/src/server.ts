import app from './index'

const port = Number(process.env.PORT ?? 8787)
if (typeof Bun !== 'undefined' && (Bun as any).serve) {
  Bun.serve({ fetch: app.fetch, port })
  console.log(`[backend] Listening on http://localhost:${port}`)
}

