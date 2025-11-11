import type { MiddlewareHandler, Context } from 'hono'

const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'] as const
const EXTRA_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const ALLOWED_ORIGINS = new Set<string>([...DEFAULT_ORIGINS, ...EXTRA_ORIGINS])

const ALLOWED_HEADERS = ['authorization', 'content-type', 'sb-access-token'] as const
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'] as const

const ALLOWED_HEADERS_VALUE = ALLOWED_HEADERS.join(', ')
const ALLOWED_METHODS_VALUE = ALLOWED_METHODS.join(', ')

const resolveOrigin = (requestOrigin?: string | null): string => {
  if (!requestOrigin) return '*'
  if (ALLOWED_ORIGINS.has('*') || ALLOWED_ORIGINS.has(requestOrigin)) {
    return requestOrigin
  }
  // Fall back to reflecting the origin so that development environments remain unblocked.
  return requestOrigin
}

export const applyCorsHeaders = (c: Context) => {
  const origin = resolveOrigin(c.req.header('origin'))
  c.header('Access-Control-Allow-Origin', origin)
  c.header('Access-Control-Allow-Headers', ALLOWED_HEADERS_VALUE)
  c.header('Access-Control-Allow-Methods', ALLOWED_METHODS_VALUE)
  c.header('Access-Control-Max-Age', '86400')

  if (origin !== '*') {
    c.header('Access-Control-Allow-Credentials', 'true')
    c.header('Vary', 'Origin', { append: true })
  }
}

export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  // Apply CORS headers before handling the request
  applyCorsHeaders(c)

  if (c.req.method === 'OPTIONS') {
    // For OPTIONS preflight requests, set headers on context and return 204
    const origin = resolveOrigin(c.req.header('origin'))
    c.header('Access-Control-Allow-Origin', origin)
    c.header('Access-Control-Allow-Headers', ALLOWED_HEADERS_VALUE)
    c.header('Access-Control-Allow-Methods', ALLOWED_METHODS_VALUE)
    c.header('Access-Control-Max-Age', '86400')
    
    if (origin !== '*') {
      c.header('Access-Control-Allow-Credentials', 'true')
      c.header('Vary', 'Origin')
    }
    
    // Return empty response with 204 status
    return c.body(null, 204)
  }

  try {
    await next()
  } finally {
    // Ensure CORS headers are always applied to the response
    applyCorsHeaders(c)
  }
}
