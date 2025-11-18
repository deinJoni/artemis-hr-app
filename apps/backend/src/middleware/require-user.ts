import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'

import { supabaseAdmin, supabaseForUser } from '../lib/supabase'
import type { Env } from '../types'
import { applyCorsHeaders } from './cors'

export const requireUser: MiddlewareHandler<Env> = async (c, next) => {
  // OPTIONS requests are handled by the CORS middleware.
  if (c.req.method === 'OPTIONS') {
    return await next()
  }

  // Apply CORS headers first
  applyCorsHeaders(c)

  const hdr = c.req.header('authorization')
  const fromHeader = hdr?.startsWith('Bearer ') ? hdr.slice(7) : undefined
  const fromCookie = getCookie(c, 'sb-access-token')
  const token = fromHeader || fromCookie
  
  if (!token) {
    // Ensure CORS headers are set before returning error
    applyCorsHeaders(c)
    return c.json({ error: 'Unauthorized: No token provided' }, 401)
  }

  try {
    const { data, error } = await (supabaseAdmin.auth as any).getUser(token)
    
    if (error) {
      console.error('Auth error:', error.message)
      // Ensure CORS headers are set before returning error
      applyCorsHeaders(c)
      return c.json({ error: 'Unauthorized: Invalid token', details: error.message }, 401)
    }
    
    if (!data?.user) {
      // Ensure CORS headers are set before returning error
      applyCorsHeaders(c)
      return c.json({ error: 'Unauthorized: User not found' }, 401)
    }

    const user = data.user
    const supabaseClient = supabaseForUser(token)

    c.set('user', user)
    c.set('userToken', token)
    c.set('supabase', supabaseClient)

    let isSuperadmin = false
    try {
      const result = await supabaseClient
        .from('superadmins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (result.error && result.error.code !== 'PGRST116') {
        console.error('Superadmin lookup failed:', result.error.message)
      }
      isSuperadmin = Boolean(result.data)
    } catch (superadminError) {
      const message = superadminError instanceof Error ? superadminError.message : String(superadminError)
      console.error('Superadmin lookup threw:', message)
    }
    c.set('superadmin', isSuperadmin)

    await next()
  } catch (error) {
    // Ensure CORS headers are set even on errors
    applyCorsHeaders(c)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    console.error('Middleware error:', errorMessage)
    return c.json({ error: errorMessage }, 500)
  } finally {
    // Always ensure CORS headers are set
    applyCorsHeaders(c)
  }
}
