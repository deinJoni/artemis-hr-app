import type { DynamicStructuredTool } from '@langchain/core/tools'

import type { ToolCallLogEntry } from '../types'

export function attachToolLogging<T extends DynamicStructuredTool>(
  tool: T,
  toolCalls: ToolCallLogEntry[],
): T {
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

export function parseToolOutput(output: unknown): unknown {
  if (typeof output !== 'string') {
    return output
  }

  try {
    return JSON.parse(output)
  } catch {
    return output
  }
}
