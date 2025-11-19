import { createAgent } from 'langchain'
import { ChatOpenAI } from '@langchain/openai'

import {
  createGenerateDummyEmployeesTool,
  createGenerateDummyApprovalsTool,
  createGenerateDemoDatasetTool,
} from '../tools/onboarding'
import type { AgentRuntimeContext } from '../context'
import { attachToolLogging } from '../utils/tool-logging'

const ONBOARDING_AGENT_PROMPT = `You are an onboarding and demo data specialist. You help users generate sample employees and approval requests so they can explore the application features.

Your responsibilities:
- Generate realistic sample employee data (names, emails, job titles, departments)
- Create sample approval requests across different categories (equipment, training, salary changes, profile changes)
- Help users populate their workspace with test data for demos and testing

Guidelines:
- Always confirm what data will be generated before creating large datasets (>20 employees)
- Suggest reasonable counts based on user needs (e.g., 5-10 employees for quick demos, 20-50 for comprehensive testing)
- When generating approvals, ensure employees exist first or generate them together
- Be clear about what was created and provide helpful summaries
- If a user asks for "demo data" or "sample data", offer to generate both employees and approvals

Always be helpful and provide clear feedback about what was generated.`

export function createOnboardingAgent(context: AgentRuntimeContext) {
  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.4,
    openAIApiKey: context.apiKey,
  })

  const employeesTool = attachToolLogging(createGenerateDummyEmployeesTool(context), context.toolCalls)
  const approvalsTool = attachToolLogging(createGenerateDummyApprovalsTool(context), context.toolCalls)
  const demoDatasetTool = attachToolLogging(createGenerateDemoDatasetTool(context), context.toolCalls)

  return createAgent({
    model,
    tools: [employeesTool, approvalsTool, demoDatasetTool],
    systemPrompt: ONBOARDING_AGENT_PROMPT,
  })
}

