import { createClient } from '@supabase/supabase-js';
import type { Database } from '@database.types.ts';

const url = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.SUPABASE_ANON_KEY; // optional

// Admin client (bypasses RLS) — use for trusted server ops
export const supabaseAdmin = createClient<Database>(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Per-user client (uses RLS via JWT) — call when you have a user token
export const supabaseForUser = (jwt: string) => {
  if (!anonKey) throw new Error('SUPABASE_ANON_KEY missing');
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
};