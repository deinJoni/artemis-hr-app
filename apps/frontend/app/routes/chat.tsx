import * as React from "react";
import type { Route } from "./+types/chat";
import { useApiContext } from "~/lib/api-context";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import {
  ConversationWithMessagesSchema,
  ChatListResponseSchema,
  type ConversationSummary,
  type ConversationWithMessages,
  type ToolCall,
} from "@vibe/shared";
import { Loader2, MessageCircle, RefreshCw, Send, Sparkles } from "lucide-react";

type ChatMessageView = {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
  createdAt: string;
  toolCalls?: ToolCall[];
  isPending?: boolean;
};

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Chat Assistant - Artemis" },
    { name: "description", content: "Chat with the Artemis AI assistant powered by LangChain." },
  ];
}

export default function ChatRoute() {
  const { session, apiBaseUrl } = useApiContext();
  const [conversation, setConversation] = React.useState<ConversationWithMessages | null>(null);
  const [messages, setMessages] = React.useState<ChatMessageView[]>([]);
  const [input, setInput] = React.useState("");
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [conversationList, setConversationList] = React.useState<ConversationSummary[]>([]);
  const [listLoading, setListLoading] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const normalizedBaseUrl = React.useMemo(() => apiBaseUrl.replace(/\/$/, ""), [apiBaseUrl]);

  const mapMessages = React.useCallback((data: ConversationWithMessages): ChatMessageView[] => {
    return (data.messages ?? []).map((message) => {
      const content = message.content as unknown;
      let text = "";
      let toolCalls: ToolCall[] | undefined;

      if (typeof content === "string") {
        text = content;
      } else if (content && typeof content === "object") {
        const contentObj = content as Record<string, unknown>;
        if (typeof contentObj.text === "string") {
          text = contentObj.text;
        }
        if (Array.isArray(contentObj.tool_calls)) {
          toolCalls = contentObj.tool_calls as ToolCall[];
        }
      }

      return {
        id: message.id,
        role: message.author_type as ChatMessageView["role"],
        text,
        createdAt: message.created_at ?? new Date().toISOString(),
        toolCalls,
      };
    });
  }, []);

  const parseConversation = React.useCallback(
    (payload: unknown) => {
      const parsed = ConversationWithMessagesSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("Unexpected chat payload");
      }
      return parsed.data;
    },
    [],
  );

  const fetchConversation = React.useCallback(
    async (id?: string, opts?: { initial?: boolean }) => {
      if (!session) return;

      const isInitial = opts?.initial ?? false;
      if (isInitial) {
        setInitialLoading(true);
      }
      setError(null);

      const endpoint = id
        ? `${normalizedBaseUrl}/api/chat/${id}`
        : `${normalizedBaseUrl}/api/chat`;

      try {
        const res = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (res.status === 404) {
          setConversation(null);
          setMessages([]);
          setConversationId(null);
          return;
        }

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || res.statusText);
        }

        const conversationData = parseConversation(data);
        setConversation(conversationData);
        setConversationId(conversationData.id);
        setMessages(mapMessages(conversationData));
      } catch (err) {
        console.error("Failed to load chat conversation:", err);
        const message = err instanceof Error ? err.message : "Unable to load chat conversation.";
        setError(message);
      } finally {
        if (isInitial) {
          setInitialLoading(false);
        }
      }
    },
    [mapMessages, normalizedBaseUrl, parseConversation, session],
  );

  const fetchConversationList = React.useCallback(async () => {
    if (!session) return;
    setListLoading(true);
    setListError(null);

    try {
      const res = await fetch(`${normalizedBaseUrl}/api/chats`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }

      const parsed = ChatListResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error("Unexpected conversation list payload");
      }

      setConversationList(parsed.data.conversations);
    } catch (err) {
      console.error("Failed to load conversations list:", err);
      const message = err instanceof Error ? err.message : "Unable to load conversations.";
      setListError(message);
    } finally {
      setListLoading(false);
    }
  }, [normalizedBaseUrl, session]);

  React.useEffect(() => {
    if (!session) {
      setConversation(null);
      setMessages([]);
      setConversationId(null);
      setInitialLoading(false);
      setConversationList([]);
      setListLoading(false);
      setListError(null);
      return;
    }
    void fetchConversation(undefined, { initial: true });
    void fetchConversationList();
  }, [fetchConversation, fetchConversationList, session]);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = React.useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();
      if (!session || sending) return;

      const trimmed = input.trim();
      if (!trimmed) return;

      const historyForPayload = messages
        .filter((msg) => msg.role === "user" || msg.role === "assistant")
        .map((msg) => ({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.text,
        }));

      const tempMessage: ChatMessageView = {
        id: `temp-${Date.now()}`,
        role: "user",
        text: trimmed,
        createdAt: new Date().toISOString(),
        isPending: true,
      };

      setMessages((prev) => [...prev, tempMessage]);
      setInput("");
      setSending(true);
      setError(null);

      try {
        const payload = {
          messages: [...historyForPayload, { role: "user" as const, content: trimmed }],
        };

        const endpoint = conversationId
          ? `${normalizedBaseUrl}/api/chat/${conversationId}`
          : `${normalizedBaseUrl}/api/chat`;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || res.statusText || "Unable to send message");
        }

        const newConversationId = data.conversation_id as string | undefined;
        if (newConversationId) {
          setConversationId(newConversationId);
          await fetchConversation(newConversationId);
        } else if (conversationId) {
          await fetchConversation(conversationId);
        } else {
          await fetchConversation(undefined, { initial: true });
        }

        await fetchConversationList();
      } catch (err) {
        console.error("Failed to send message:", err);
        const message = err instanceof Error ? err.message : "Unable to send message.";
        setError(message);
        setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
        setInput(trimmed);
      } finally {
        setSending(false);
      }
    },
    [conversationId, fetchConversation, fetchConversationList, input, messages, normalizedBaseUrl, sending, session],
  );

  const handleNewConversation = React.useCallback(() => {
    setConversation(null);
    setMessages([]);
    setConversationId(null);
    setInput("");
    setError(null);
  }, []);

  const handleSelectConversation = React.useCallback(
    (id: string) => {
      setConversationId(id);
      void fetchConversation(id, { initial: true });
    },
    [fetchConversation],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  if (!session) {
    return (
      <div className="container mx-auto space-y-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Chat Assistant</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please sign in to start chatting with the Artemis assistant.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Sparkles className="h-6 w-6 text-primary" />
            Artemis Assistant
          </h1>
          <p className="text-muted-foreground">
            Ask questions about your team, policies, or available tools. Artemis uses LangChain to
            provide contextual answers.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <ConversationSidebar
          conversations={conversationList}
          listLoading={listLoading}
          listError={listError}
          selectedId={conversationId}
          onSelect={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onRefresh={() => {
            void fetchConversation(conversationId ?? undefined, { initial: true });
            void fetchConversationList();
          }}
          disableNew={sending}
        />

        <Card className="border border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Conversation</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">
                {conversation?.status ? conversation.status.toUpperCase() : "DRAFT"}
              </Badge>
              {conversation?.updated_at ? (
                <span>
                  Updated {new Date(conversation.updated_at).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="flex h-[70vh] flex-col gap-4 p-0">
            <div className="flex-1 overflow-hidden px-4">
              <div className="h-full overflow-y-auto pr-4">
                <div className="space-y-4 py-4">
                  {initialLoading ? (
                    <div className="flex h-full items-center justify-center py-20 text-muted-foreground">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Loading conversation…
                    </div>
                  ) : hasMessages ? (
                    messages.map((message) => (
                      <ChatBubble key={message.id} message={message} />
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                      <Sparkles className="h-8 w-8" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Start a conversation</p>
                        <p className="text-sm">
                          Ask Artemis about employees, leave balances, or organizational policies.
                        </p>
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              </div>
            </div>

            <form onSubmit={handleSend} className="border-t border-border/60 bg-muted/20 p-4">
              <fieldset className="flex flex-col gap-3" disabled={sending}>
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your question and press Enter to send. Use Shift + Enter for a new line."
                  rows={3}
                  className="resize-none"
                />
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs text-muted-foreground">
                    Artemis can run internal tools when needed. Tool results will be shown inline.
                  </p>
                  <Button type="submit" disabled={sending || !input.trim()}>
                    {sending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send
                      </>
                    )}
                  </Button>
                </div>
              </fieldset>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ConversationSidebar({
  conversations,
  listLoading,
  listError,
  selectedId,
  onSelect,
  onNewConversation,
  onRefresh,
  disableNew,
}: {
  conversations: ConversationSummary[];
  listLoading: boolean;
  listError: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
  onRefresh: () => void;
  disableNew: boolean;
}) {
  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardTitle className="text-base">Conversations</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={onNewConversation} disabled={disableNew}>
            <MessageCircle className="mr-2 h-4 w-4" />
            New
          </Button>
        </div>
        {listError ? (
          <p className="text-xs text-destructive">{listError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">Recent chats sync across devices.</p>
        )}
      </CardHeader>
      <CardContent className="max-h-[70vh] overflow-y-auto p-0">
        {listLoading ? (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading conversations…
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No conversations yet.
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {conversations.map((item) => {
              const isActive = item.id === selectedId;
              return (
                <li key={item.id}>
                  <button
                    className={cn(
                      "flex w-full flex-col gap-1 px-4 py-3 text-left text-sm transition-colors",
                      isActive ? "bg-muted" : "hover:bg-muted/60",
                    )}
                    onClick={() => onSelect(item.id)}
                    aria-current={isActive ? "true" : undefined}
                  >
                    <span className="font-medium text-foreground">
                      {item.name ? item.name : "Untitled"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.last_updated).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ChatBubble({ message }: { message: ChatMessageView }) {
  const isUser = message.role === "user";
  const bubbleClasses = cn(
    "max-w-xl rounded-lg border px-4 py-3 shadow-sm transition-colors",
    isUser
      ? "ml-auto bg-primary text-primary-foreground border-primary/50"
      : "mr-auto bg-background border-border/70",
  );

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div className="space-y-2">
        <div className={bubbleClasses}>
          <div className="text-sm whitespace-pre-wrap">{message.text || "…"}</div>
        </div>
        {message.toolCalls && message.toolCalls.length > 0 ? (
          <div className={cn("space-y-2", isUser ? "text-right" : "text-left")}>
            {message.toolCalls.map((call, index) => (
              <div
                key={`${message.id}-tool-${index}`}
                className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-foreground"
              >
                <div className="font-medium text-primary">Tool • {call.tool_name}</div>
                {call.result?.output ? (
                  <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-background/70 p-2 text-xs">
                    {typeof call.result.output === "string"
                      ? call.result.output
                      : JSON.stringify(call.result.output, null, 2)}
                  </pre>
                ) : null}
                {call.result?.error ? (
                  <p className="mt-1 text-destructive">
                    {call.result.error}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
