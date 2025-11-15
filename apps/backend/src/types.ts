import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@database.types.ts'

// Extract User type from Supabase auth.getUser response
export type User = NonNullable<Awaited<ReturnType<SupabaseClient<Database>['auth']['getUser']>>['data']['user']>

export type Env = {
  Variables: {
    user: User
    userToken: string
    supabase: SupabaseClient<Database>
  }
}
