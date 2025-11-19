import { createAgent } from 'langchain'
import { ChatOpenAI } from '@langchain/openai'
import type { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { User } from '../../types'
import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages'

import type { Database } from '@database.types.ts'
import { getPrimaryTenantId } from '../../lib/tenant-context'
import type { Env } from '../../types'
import {
  ChatRequestSchema,
  ChatResponseSchema,
  ChatListResponseSchema,
  type ChatMessage,
  type MessageContent,
} from '@vibe/shared'
import { createEmployeeTool } from './tools/employees'
import {
  createConversation,
  getConversation,
  getLatestConversation,
  listConversations,
  saveMessage,
  type ConversationWithMessages,
} from './service'

export const registerChatRoutes = (app: Hono<Env>) => {
  // GET /api/chat/:conversationId - Get conversation with all messages
  app.get('/api/chat/:conversationId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const conversationId = c.req.param('conversationId')

    try {
      const conversation = await getConversation(supabase, conversationId, user.id)

      if (!conversation) {
        return c.json({ error: 'Conversation not found' }, 404)
      }

      return c.json(conversation)
    } catch (error) {
      console.error('Get conversation error:', error)
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      return c.json({ error: `Failed to get conversation: ${message}` }, 500)
    }
  })

  // GET /api/chat - Get latest active conversation
  app.get('/api/chat', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User

    try {
      const tenantId = await getPrimaryTenantId(supabase)
      const conversation = await getLatestConversation(supabase, tenantId, user.id)

      if (!conversation) {
        return c.json({ error: 'No active conversation found' }, 404)
      }

      return c.json(conversation)
    } catch (error) {
      console.error('Get latest conversation error:', error)
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      return c.json({ error: `Failed to get latest conversation: ${message}` }, 500)
    }
  })

  // GET /api/chats - List conversations for the current user
  app.get('/api/chats', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User

    try {
      const tenantId = await getPrimaryTenantId(supabase)
      const conversations = await listConversations(supabase, tenantId, user.id, 20)
      const response = ChatListResponseSchema.parse({ conversations })
      return c.json(response)
    } catch (error) {
      console.error('List conversations error:', error)
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      return c.json({ error: `Failed to list conversations: ${message}` }, 500)
    }
  })

  // POST /api/chat - Create new conversation and send message
  app.post('/api/chat', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const userToken = c.get('userToken')

    // Validate request body
    const body = await c.req.json().catch(() => ({}))
    const parsed = ChatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return c.json({ error: 'OpenAI API key not configured' }, 500)
    }

    // Get tenant ID
    let tenantId: string
    try {
      tenantId = await getPrimaryTenantId(supabase)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to resolve tenant'
      return c.json({ error: message }, 400)
    }

    // Get API base URL from environment or construct from request
    const apiBaseUrl = process.env.API_BASE_URL || (() => {
      const url = new URL(c.req.url)
      return `${url.protocol}//${url.host}`
    })()

    try {
      // Extract the last user message
      const lastMessage = parsed.data.messages[parsed.data.messages.length - 1]
      if (lastMessage.role !== 'user') {
        return c.json({ error: 'Last message must be from user' }, 400)
      }

      // Create new conversation
      const conversationId = await createConversation(supabase, tenantId, user.id, null)

      // Save user message
      await saveMessage(
        supabase,
        conversationId,
        tenantId,
        'user',
        user.id,
        { text: lastMessage.content },
      )

      // Process with agent and get response
      const { response, usage, toolCalls } = await processChatMessage({
        supabase,
        userToken,
        apiBaseUrl,
        apiKey,
        messages: parsed.data.messages,
        lastMessage: lastMessage.content,
      })

      // Build assistant message content with tool calls
      const assistantContent: MessageContent = {
        text: response,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      }

      // Save assistant response
      await saveMessage(
        supabase,
        conversationId,
        tenantId,
        'assistant',
        null,
        assistantContent,
      )

      // Return response
      const chatResponse = ChatResponseSchema.parse({
        conversation_id: conversationId,
        message: response,
        usage,
      })

      return c.json(chatResponse)
    } catch (error) {
      console.error('Chat error:', error)
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      return c.json({ error: `Chat processing failed: ${message}` }, 500)
    }
  })

  // POST /api/chat/:conversationId - Continue existing conversation
  app.post('/api/chat/:conversationId', async (c) => {
    const supabase = c.get('supabase') as SupabaseClient<Database>
    const user = c.get('user') as User
    const userToken = c.get('userToken')
    const conversationId = c.req.param('conversationId')

    // Validate request body
    const body = await c.req.json().catch(() => ({}))
    const parsed = ChatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
    }

    // Verify conversation exists and belongs to user
    const conversation = await getConversation(supabase, conversationId, user.id)
    if (!conversation) {
      return c.json({ error: 'Conversation not found' }, 404)
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return c.json({ error: 'OpenAI API key not configured' }, 500)
    }

    // Get API base URL from environment or construct from request
    const apiBaseUrl = process.env.API_BASE_URL || (() => {
      const url = new URL(c.req.url)
      return `${url.protocol}//${url.host}`
    })()

    try {
      // Extract the last user message
      const lastMessage = parsed.data.messages[parsed.data.messages.length - 1]
      if (lastMessage.role !== 'user') {
        return c.json({ error: 'Last message must be from user' }, 400)
      }

      // Save user message
      await saveMessage(
        supabase,
        conversationId,
        conversation.tenant_id,
        'user',
        user.id,
        { text: lastMessage.content },
      )

      // Process with agent and get response
      const { response, usage, toolCalls } = await processChatMessage({
        supabase,
        userToken,
        apiBaseUrl,
        apiKey,
        messages: parsed.data.messages,
        lastMessage: lastMessage.content,
      })

      // Build assistant message content with tool calls
      const assistantContent: MessageContent = {
        text: response,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      }

      // Save assistant response
      await saveMessage(
        supabase,
        conversationId,
        conversation.tenant_id,
        'assistant',
        null,
        assistantContent,
      )

      // Return response
      const chatResponse = ChatResponseSchema.parse({
        conversation_id: conversationId,
        message: response,
        usage,
      })

      return c.json(chatResponse)
    } catch (error) {
      console.error('Chat error:', error)
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      return c.json({ error: `Chat processing failed: ${message}` }, 500)
    }
  })
}

const AGENT_SYSTEM_PROMPT = 'You are a helpful HR assistant. You can help users query employee information. Always be respectful and professional.'

/**
 * Process chat message with LangChain agent
 * Returns response, usage, and tool calls
 */
async function processChatMessage({
  supabase,
  userToken,
  apiBaseUrl,
  apiKey,
  messages,
  lastMessage,
}: {
  supabase: SupabaseClient<Database>
  userToken: string
  apiBaseUrl: string
  apiKey: string
  messages: ChatMessage[]
  lastMessage: string
}): Promise<{
  response: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  toolCalls: Array<{
    tool_name: string
    input: unknown
    result?: {
      ok: boolean
      output?: unknown
      error?: string
      latency_ms?: number
    }
  }>
}> {
  // Initialize LLM
  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.7,
    openAIApiKey: apiKey,
  })

  const toolCalls: Array<{
    tool_name: string
    input: unknown
    result?: {
      ok: boolean
      output?: unknown
      error?: string
      latency_ms?: number
    }
  }> = []

  // Create tools with user context and instrument to capture tool calls
  const employeeTool = attachToolLogging(createEmployeeTool({
    supabase,
    userToken,
    apiBaseUrl,
  }), toolCalls)

  const agent = createAgent({
    model,
    tools: [employeeTool],
    systemPrompt: AGENT_SYSTEM_PROMPT,
  })

  const agentMessages = convertChatMessagesToAgentState(messages)
  const result = await agent.invoke({ messages: agentMessages })
  const aiMessage = [...result.messages].reverse().find((message) => {
    return typeof (message as BaseMessage)._getType === 'function' && (message as BaseMessage)._getType() === 'ai'
  }) as BaseMessage | undefined
  const responseText = extractMessageText(aiMessage)

  if (!responseText) {
    throw new Error('Agent response did not include a message')
  }

  const usage = aiMessage && 'usage_metadata' in aiMessage
    ? normalizeUsageMetadata((aiMessage as AIMessage).usage_metadata)
    : undefined

  return {
    response: responseText,
    usage,
    toolCalls,
  }
}

function convertChatMessagesToAgentState(messages: ChatMessage[]): BaseMessage[] {
  return messages.map((msg) => {
    switch (msg.role) {
      case 'assistant':
        return new AIMessage(msg.content)
      case 'system':
        return new SystemMessage(msg.content)
      default:
        return new HumanMessage(msg.content)
    }
  })
}

function extractMessageText(message?: BaseMessage): string {
  if (!message) {
    return ''
  }

  const { content } = message
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === 'string') {
        return part
      }
      if (typeof (part as { text?: string }).text === 'string') {
        return (part as { text?: string }).text as string
      }
      return ''
    }).join('\n').trim()
  }

  return ''
}

function normalizeUsageMetadata(metadata?: AIMessage['usage_metadata']) {
  if (!metadata) {
    return undefined
  }

  return {
    prompt_tokens: metadata.input_tokens,
    completion_tokens: metadata.output_tokens,
    total_tokens: metadata.total_tokens,
  }
}

function attachToolLogging(
  tool: ReturnType<typeof createEmployeeTool>,
  toolCalls: Array<{
    tool_name: string
    input: unknown
    result?: {
      ok: boolean
      output?: unknown
      error?: string
      latency_ms?: number
    }
  }>,
) {
  const originalFunc = tool.func.bind(tool)

  tool.func = async (input) => {
    const start = Date.now()
    try {
      const output = await originalFunc(input)

      toolCalls.push({
        tool_name: tool.name,
        input,
        result: {
          ok: true,
          output: parseToolOutput(output),
          latency_ms: Date.now() - start,
        },
      })

      return output
    } catch (error) {
      toolCalls.push({
        tool_name: tool.name,
        input,
        result: {
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          latency_ms: Date.now() - start,
        },
      })
      throw error
    }
  }

  return tool
}

function parseToolOutput(output: unknown): unknown {
  if (typeof output !== 'string') {
    return output
  }

  try {
    return JSON.parse(output)
  } catch {
    return output
  }
}
