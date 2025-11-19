import { createAgent } from 'langchain'
import { ChatOpenAI } from '@langchain/openai'
import type { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { User } from '../../types'
import { AIMessage, type BaseMessage } from '@langchain/core/messages'

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
import {
  createLeaveAgentTool,
  createEmployeeAgentTool,
  createTimeAgentTool,
  createPerformanceAgentTool,
  createOnboardingAgentTool,
} from './tools/agent-tools'
import {
  createConversation,
  getConversation,
  getLatestConversation,
  listConversations,
  saveMessage,
  type ConversationWithMessages,
} from './service'
import type { ToolCallLogEntry } from './types'
import type { AgentRuntimeContext } from './context'
import { attachToolLogging } from './utils/tool-logging'
import {
  convertChatMessagesToAgentState,
  extractMessageText,
  findLatestAIMessage,
  normalizeUsageMetadata,
} from './utils/messages'

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

const AGENT_SYSTEM_PROMPT = `You are a helpful HR assistant that routes questions to specialized sub-agents.
Available sub-agents:
- leave_management_agent: Use for questions about vacation days, leave balances, time-off requests, leave calendars
- employee_management_agent: Use for questions about employees, finding people, employee details, organizational structure
- time_management_agent: Use for questions about timesheets, clocking in/out, weekly hour summaries, or specific time entries
- performance_management_agent: Use for questions about goals, check-ins, team performance, or progress tracking
- onboarding_preparation_agent: Use for generating sample employees, demo data, or seeding approval requests for testing
Analyze the user's question and delegate to the appropriate specialized agent. If a question spans multiple domains, call multiple agents and synthesize the results.
Always be respectful and professional.`

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
  toolCalls: ToolCallLogEntry[]
}> {
  // Initialize LLM
  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.7,
    openAIApiKey: apiKey,
  })

  const toolCalls: ToolCallLogEntry[] = []

  const agentContext: AgentRuntimeContext = {
    supabase,
    userToken,
    apiBaseUrl,
    apiKey,
    toolCalls,
  }

  // Create tools with user context and instrument to capture tool calls
  const leaveAgentTool = attachToolLogging(createLeaveAgentTool(agentContext), toolCalls)
  const employeeAgentTool = attachToolLogging(createEmployeeAgentTool(agentContext), toolCalls)
  const timeAgentTool = attachToolLogging(createTimeAgentTool(agentContext), toolCalls)
  const performanceAgentTool = attachToolLogging(createPerformanceAgentTool(agentContext), toolCalls)
  const onboardingAgentTool = attachToolLogging(createOnboardingAgentTool(agentContext), toolCalls)

  const agent = createAgent({
    model,
    tools: [leaveAgentTool, employeeAgentTool, timeAgentTool, performanceAgentTool, onboardingAgentTool],
    systemPrompt: AGENT_SYSTEM_PROMPT,
  })

  const agentMessages = convertChatMessagesToAgentState(messages)
  const result = await agent.invoke({ messages: agentMessages })
  const aiMessage = findLatestAIMessage(result.messages as BaseMessage[])
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
