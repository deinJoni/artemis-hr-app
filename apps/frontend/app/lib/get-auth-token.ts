/**
 * Helper function to extract authentication token from request.
 * Works in both server-side (SSR) and client-side contexts.
 * 
 * Priority:
 * 1. Cookie: sb-access-token (what backend expects)
 * 2. Authorization header: Bearer <token>
 * 3. Supabase session (works in client-side navigation)
 */
export async function getAuthToken(request?: Request): Promise<string | null> {
  // Try to get token from cookies first (works in SSR)
  if (request) {
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map(c => {
        const [key, ...values] = c.split('=');
        return [key, decodeURIComponent(values.join('='))];
      })
    );
    
    // Backend expects 'sb-access-token' cookie
    if (cookies['sb-access-token']) {
      return cookies['sb-access-token'];
    }
    
    // Try Authorization header
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
  }
  
  // Fallback: try Supabase client (works in client-side navigation)
  // Note: This won't work in SSR, but will work during client-side navigation
  try {
    const { supabase } = await import('~/lib/supabase');
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    // If we're in SSR or Supabase is unavailable, return null
    return null;
  }
}

