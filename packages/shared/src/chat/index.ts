import { z } from "zod";

// Enums
export const ConversationStatusEnum = z.enum(["open", "closed", "archived"]);
export type ConversationStatus = z.infer<typeof ConversationStatusEnum>;

export const MessageAuthorTypeEnum = z.enum(["user", "assistant", "tool"]);
export type MessageAuthorType = z.infer<typeof MessageAuthorTypeEnum>;

// Message content structure (JSONB)
export const ToolCallResultSchema = z.object({
  ok: z.boolean(),
  output: z.any().optional(),
  error: z.string().optional(),
  latency_ms: z.number().int().nonnegative().optional(),
});
export type ToolCallResult = z.infer<typeof ToolCallResultSchema>;

export const ToolCallSchema = z.object({
  tool_name: z.string(),
  input: z.any(),
  result: ToolCallResultSchema.optional(),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

export const MessageContentSchema = z.object({
  text: z.string(),
  tool_calls: z.array(ToolCallSchema).optional(),
});
export type MessageContent = z.infer<typeof MessageContentSchema>;

// Conversation schema
export const ConversationSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  created_by: z.string().uuid(),
  title: z.string().nullable(),
  status: ConversationStatusEnum,
  created_at: z.string(),
  updated_at: z.string(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

// Message schema
export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  author_type: MessageAuthorTypeEnum,
  author_id: z.string().uuid().nullable(),
  content: MessageContentSchema,
  created_at: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

// Conversation with messages
export const ConversationWithMessagesSchema = ConversationSchema.extend({
  messages: z.array(MessageSchema),
});
export type ConversationWithMessages = z.infer<typeof ConversationWithMessagesSchema>;

export const ConversationSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  last_updated: z.string(),
});
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

// Request/Response schemas
export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  conversation_id: z.string().uuid(),
  message: z.string(),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      completion_tokens: z.number().int().nonnegative().optional(),
      total_tokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export const ChatListResponseSchema = z.object({
  conversations: z.array(ConversationSummarySchema),
});
export type ChatListResponse = z.infer<typeof ChatListResponseSchema>;
