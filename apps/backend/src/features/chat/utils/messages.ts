import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages'

import type { ChatMessage } from '@vibe/shared'

export function convertChatMessagesToAgentState(messages: ChatMessage[]): BaseMessage[] {
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

export function extractMessageText(message?: BaseMessage): string {
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

export function normalizeUsageMetadata(metadata?: AIMessage['usage_metadata']) {
  if (!metadata) {
    return undefined
  }

  return {
    prompt_tokens: metadata.input_tokens,
    completion_tokens: metadata.output_tokens,
    total_tokens: metadata.total_tokens,
  }
}

export function findLatestAIMessage(messages: BaseMessage[]): BaseMessage | undefined {
  return [...messages].reverse().find((message) => {
    return typeof (message as BaseMessage)._getType === 'function' && (message as BaseMessage)._getType() === 'ai'
  })
}
