import { DynamicStructuredTool } from '@langchain/core/tools'
import { HumanMessage, type BaseMessage } from '@langchain/core/messages'
import { z } from 'zod'

import type { AgentRuntimeContext } from '../context'
import { createLeaveAgent } from '../agents/leave-agent'
import { createEmployeeAgent } from '../agents/employee-agent'
import { createTimeAgent } from '../agents/time-agent'
import { createPerformanceAgent } from '../agents/performance-agent'
import { createOnboardingAgent } from '../agents/onboarding-agent'
import { extractMessageText, findLatestAIMessage } from '../utils/messages'

const AgentToolInputSchema = z.object({
  query: z.string().min(1).describe('Natural language query to route to the specialized agent'),
})

type AgentToolInput = z.infer<typeof AgentToolInputSchema>

export function createLeaveAgentTool(context: AgentRuntimeContext) {
  const agent = createLeaveAgent(context)

  return new DynamicStructuredTool({
    name: 'leave_management_agent',
    description: 'Use this tool for any questions about time off, vacation days, sick leave, leave balances, or leave requests.',
    schema: AgentToolInputSchema,
    func: async ({ query }: AgentToolInput) => runSubAgent(agent, query),
  })
}

export function createEmployeeAgentTool(context: AgentRuntimeContext) {
  const agent = createEmployeeAgent(context)

  return new DynamicStructuredTool({
    name: 'employee_management_agent',
    description: 'Use this tool when the user needs to find employees, view employee details, or ask about organizational structure.',
    schema: AgentToolInputSchema,
    func: async ({ query }: AgentToolInput) => runSubAgent(agent, query),
  })
}

export function createTimeAgentTool(context: AgentRuntimeContext) {
  const agent = createTimeAgent(context)

  return new DynamicStructuredTool({
    name: 'time_management_agent',
    description: 'Use this tool for questions about timesheets, clock-in status, weekly hours, or reviewing time entries.',
    schema: AgentToolInputSchema,
    func: async ({ query }: AgentToolInput) => runSubAgent(agent, query),
  })
}

export function createPerformanceAgentTool(context: AgentRuntimeContext) {
  const agent = createPerformanceAgent(context)

  return new DynamicStructuredTool({
    name: 'performance_management_agent',
    description: 'Use this tool when the user asks about personal goals, team performance, or check-in summaries.',
    schema: AgentToolInputSchema,
    func: async ({ query }: AgentToolInput) => runSubAgent(agent, query),
  })
}

export function createOnboardingAgentTool(context: AgentRuntimeContext) {
  const agent = createOnboardingAgent(context)

  return new DynamicStructuredTool({
    name: 'onboarding_preparation_agent',
    description: 'Use this tool when the user asks for sample data, demo employees, seeded approvals, or wants to populate their workspace with test data.',
    schema: AgentToolInputSchema,
    func: async ({ query }: AgentToolInput) => runSubAgent(agent, query),
  })
}

type AgentInstance = {
  invoke: (input: { messages: BaseMessage[] }) => Promise<{ messages: BaseMessage[] }>
}

async function runSubAgent(agent: AgentInstance, query: string): Promise<string> {
  const result = await agent.invoke({ messages: [new HumanMessage(query)] })
  const aiMessage = findLatestAIMessage(result.messages as BaseMessage[])
  const responseText = extractMessageText(aiMessage)

  if (!responseText) {
    throw new Error('Sub-agent response did not include a message')
  }

  return responseText
}
