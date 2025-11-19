import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@database.types.ts'
import type { ToolCallLogEntry } from './types'

export interface ToolExecutionContext {
  supabase: SupabaseClient<Database>
  userToken: string
  apiBaseUrl: string
}

export interface AgentRuntimeContext extends ToolExecutionContext {
  apiKey: string
  toolCalls: ToolCallLogEntry[]
}
