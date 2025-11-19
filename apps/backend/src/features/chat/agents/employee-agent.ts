import { createAgent } from 'langchain'
import { ChatOpenAI } from '@langchain/openai'

import { createEmployeeTool } from '../tools/employees'
import { createEmployeeDetailsTool } from '../tools/employee-details'
import type { AgentRuntimeContext } from '../context'
import { attachToolLogging } from '../utils/tool-logging'

const EMPLOYEE_AGENT_PROMPT = `You are an employee management specialist. You help users with:
- Finding employees by name, email, or department
- Viewing employee details and profiles
- Understanding organizational structure
Respect privacy - only show information the user has permission to view.`

export function createEmployeeAgent(context: AgentRuntimeContext) {
  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.4,
    openAIApiKey: context.apiKey,
  })

  const listEmployeesTool = attachToolLogging(createEmployeeTool(context), context.toolCalls)
  const employeeDetailsTool = attachToolLogging(createEmployeeDetailsTool(context), context.toolCalls)

  return createAgent({
    model,
    tools: [listEmployeesTool, employeeDetailsTool],
    systemPrompt: EMPLOYEE_AGENT_PROMPT,
  })
}
