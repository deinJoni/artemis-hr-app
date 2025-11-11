import type { SupabaseClient, User } from '@supabase/supabase-js'

import type { Database } from '@database.types.ts'

export type Env = {
  Variables: {
    user: User
    userToken: string
    supabase: SupabaseClient<Database>
  }
}
