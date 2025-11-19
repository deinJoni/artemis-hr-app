import { createAgent } from 'langchain'
import { ChatOpenAI } from '@langchain/openai'

import { createTimeEntriesTool, createTimeSummaryTool } from '../tools/time'
import type { AgentRuntimeContext } from '../context'
import { attachToolLogging } from '../utils/tool-logging'

const TIME_AGENT_PROMPT = `You are a time and attendance specialist. You help users with:
- Summarizing weekly hours, target hours, and active clock-ins
- Reviewing timesheet entries with filters like date range, status, or project
- Explaining timesheet and approval policies
Always reference exact hours and entry details when responding.`

export function createTimeAgent(context: AgentRuntimeContext) {
  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.4,
    openAIApiKey: context.apiKey,
  })

  const timeSummaryTool = attachToolLogging(createTimeSummaryTool(context), context.toolCalls)
  const timeEntriesTool = attachToolLogging(createTimeEntriesTool(context), context.toolCalls)

  return createAgent({
    model,
    tools: [timeSummaryTool, timeEntriesTool],
    systemPrompt: TIME_AGENT_PROMPT,
  })
}
