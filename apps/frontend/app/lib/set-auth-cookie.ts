/**
 * Sets the sb-access-token cookie for server-side loaders to access.
 * This cookie is what the backend middleware expects.
 */
export function setAuthCookie(token: string | null) {
  if (typeof document === 'undefined') return;
  
  if (token) {
    // Set cookie with 7 days expiry, httpOnly should be false for client-side access
    // Note: In production, you might want to set httpOnly via a server endpoint
    document.cookie = `sb-access-token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
  } else {
    // Clear cookie
    document.cookie = 'sb-access-token=; path=/; max-age=0';
  }
}

