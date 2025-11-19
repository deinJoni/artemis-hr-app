import { createAgent } from 'langchain'
import { ChatOpenAI } from '@langchain/openai'

import { createMyGoalsTool, createTeamPerformanceTool } from '../tools/performance'
import type { AgentRuntimeContext } from '../context'
import { attachToolLogging } from '../utils/tool-logging'

const PERFORMANCE_AGENT_PROMPT = `You are a performance and goals specialist. You help users with:
- Listing personal goals, statuses, and key results
- Summarizing team performance, goal completion, and recent check-ins
- Highlighting blockers or follow-up actions based on goal data
Be precise about progress percentages and completion counts.`

export function createPerformanceAgent(context: AgentRuntimeContext) {
  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.4,
    openAIApiKey: context.apiKey,
  })

  const myGoalsTool = attachToolLogging(createMyGoalsTool(context), context.toolCalls)
  const teamPerformanceTool = attachToolLogging(createTeamPerformanceTool(context), context.toolCalls)

  return createAgent({
    model,
    tools: [myGoalsTool, teamPerformanceTool],
    systemPrompt: PERFORMANCE_AGENT_PROMPT,
  })
}
