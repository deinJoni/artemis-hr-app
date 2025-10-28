import { createClient } from "@supabase/supabase-js";
import type { Database } from "@database.types.ts";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient<Database>(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "sb-vibe-auth",
  },
});