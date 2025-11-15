import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@database.types.ts'
import type { ConversationSummary } from '@vibe/shared'

type ConversationRow = Database['public']['Tables']['conversations']['Row']
type MessageRow = Database['public']['Tables']['messages']['Row']

export type MessageContent = {
  text: string
  tool_calls?: Array<{
    tool_name: string
    input: unknown
    result?: {
      ok: boolean
      output?: unknown
      error?: string
      latency_ms?: number
    }
  }>
}

export type ConversationWithMessages = ConversationRow & {
  messages: MessageRow[]
}

/**
 * Create a new conversation for a user in their tenant
 */
export async function createConversation(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  userId: string,
  title?: string | null,
): Promise<string> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      tenant_id: tenantId,
      created_by: userId,
      title: title || null,
      status: 'open',
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`)
  }

  if (!data) {
    throw new Error('Failed to create conversation: no data returned')
  }

  return data.id
}

/**
 * Get a conversation with all its messages, verifying ownership
 */
export async function getConversation(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  userId: string,
): Promise<ConversationWithMessages | null> {
  // First verify the conversation exists and belongs to the user
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('created_by', userId)
    .single()

  if (convError || !conversation) {
    return null
  }

  // Fetch all messages for this conversation
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (messagesError) {
    throw new Error(`Failed to fetch messages: ${messagesError.message}`)
  }

  return {
    ...conversation,
    messages: messages || [],
  }
}

/**
 * Get the latest active conversation for a user in their tenant
 */
export async function getLatestConversation(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  userId: string,
): Promise<ConversationWithMessages | null> {
  // Get the most recent active conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('created_by', userId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (convError) {
    throw new Error(`Failed to fetch latest conversation: ${convError.message}`)
  }

  if (!conversation) {
    return null
  }

  // Fetch all messages for this conversation
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })

  if (messagesError) {
    throw new Error(`Failed to fetch messages: ${messagesError.message}`)
  }

  return {
    ...conversation,
    messages: messages || [],
  }
}

/**
 * List conversations for a user in their tenant ordered by last update
 */
export async function listConversations(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  userId: string,
  limit = 20,
): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, updated_at')
    .eq('tenant_id', tenantId)
    .eq('created_by', userId)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to list conversations: ${error.message}`)
  }

  if (!data) {
    return []
  }

  return data.map((conversation: { id: string; title: string | null; updated_at: string }) => ({
    id: conversation.id,
    name: conversation.title ?? null,
    last_updated: conversation.updated_at,
  }))
}

/**
 * Save a message to a conversation
 */
export async function saveMessage(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  tenantId: string,
  authorType: 'user' | 'assistant' | 'tool',
  authorId: string | null,
  content: MessageContent,
): Promise<string> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      author_type: authorType,
      author_id: authorId,
      content: content as unknown as Database['public']['Tables']['messages']['Insert']['content'],
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to save message: ${error.message}`)
  }

  if (!data) {
    throw new Error('Failed to save message: no data returned')
  }

  return data.id
}

/**
 * Update conversation status
 */
export async function updateConversationStatus(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  status: 'open' | 'closed' | 'archived',
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ status })
    .eq('id', conversationId)

  if (error) {
    throw new Error(`Failed to update conversation status: ${error.message}`)
  }
}
