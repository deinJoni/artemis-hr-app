export interface ToolCallResult {
  ok: boolean
  output?: unknown
  error?: string
  latency_ms?: number
}

export interface ToolCallLogEntry {
  tool_name: string
  input: unknown
  result?: ToolCallResult
}
