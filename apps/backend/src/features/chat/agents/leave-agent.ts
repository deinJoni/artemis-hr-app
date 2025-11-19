import { createAgent } from 'langchain'
import { ChatOpenAI } from '@langchain/openai'

import { createLeaveBalancesTool, createLeaveRequestsTool } from '../tools/leave'
import type { AgentRuntimeContext } from '../context'
import { attachToolLogging } from '../utils/tool-logging'

const LEAVE_AGENT_PROMPT = `You are a specialized leave and absence management assistant. You help users with:
- Checking leave balances (vacation, sick, personal days)
- Viewing leave requests (pending, approved, denied)
- Understanding leave policies
Always check balances before confirming availability. Be clear about remaining days and request status.`

export function createLeaveAgent(context: AgentRuntimeContext) {
  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.4,
    openAIApiKey: context.apiKey,
  })

  const leaveBalancesTool = attachToolLogging(createLeaveBalancesTool(context), context.toolCalls)
  const leaveRequestsTool = attachToolLogging(createLeaveRequestsTool(context), context.toolCalls)

  return createAgent({
    model,
    tools: [leaveBalancesTool, leaveRequestsTool],
    systemPrompt: LEAVE_AGENT_PROMPT,
  })
}
