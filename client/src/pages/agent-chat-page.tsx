import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bolt, Send, Loader2, AlertCircle } from "lucide-react";

import { UniversalLayout } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Company } from "@shared/schema";

// Chat is backed by the existing /api/agents/:id/chat + messages endpoints
// rather than the generated /api/companies/:id/conversations routes, which
// are 501 stubs until storage.createConversation lands. Using the "direct-
// claude" virtual agent id gives us a stable per-user conversation without
// requiring an agent row in the DB.
const CHAT_AGENT_ID = "direct-claude";

interface AgentMessage {
  id: string;
  agentId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

interface ChatResponse {
  reply: string;
  messageId: string;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function AgentChatPage() {
  const params = useParams<{ companyId?: string }>();
  const companyId = params.companyId;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { data: company } = useQuery<Company, Error>({
    queryKey: ["/api/company"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/company");
      return (await res.json()) as Company;
    },
  });

  const messagesQueryKey = [
    `/api/agents/${CHAT_AGENT_ID}/messages`,
  ] as const;

  const {
    data: messages,
    isLoading: messagesLoading,
    error: messagesError,
  } = useQuery<AgentMessage[], Error>({
    queryKey: messagesQueryKey,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/agents/${CHAT_AGENT_ID}/messages`,
      );
      return (await res.json()) as AgentMessage[];
    },
  });

  const sendMutation = useMutation<ChatResponse, Error, string>({
    mutationFn: async (text: string) => {
      const res = await apiRequest(
        "POST",
        `/api/agents/${CHAT_AGENT_ID}/chat`,
        { message: text },
      );
      return (await res.json()) as ChatResponse;
    },
    onMutate: async (text) => {
      // Optimistic append — user sees their message immediately. The full
      // assistant reply arrives in onSuccess and invalidates the query.
      setInput("");
      await queryClient.cancelQueries({ queryKey: messagesQueryKey });
      const previous = queryClient.getQueryData<AgentMessage[]>(messagesQueryKey) ?? [];
      const optimistic: AgentMessage = {
        id: `optimistic-${Date.now()}`,
        agentId: CHAT_AGENT_ID,
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      queryClient.setQueryData<AgentMessage[]>(messagesQueryKey, [
        ...previous,
        optimistic,
      ]);
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagesQueryKey });
    },
    onError: (err, _vars, ctx) => {
      // Roll back the optimistic message so the user can retry.
      const previous = (ctx as { previous?: AgentMessage[] } | undefined)
        ?.previous;
      if (previous) {
        queryClient.setQueryData(messagesQueryKey, previous);
      }
      toast({
        title: "Couldn't send message",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to the latest message whenever the list grows.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages?.length]);

  function handleSend() {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    sendMutation.mutate(text);
  }

  const assistantName = company?.assistantName ?? "DEX Assistant";
  const leftRailItems = companyId
    ? [
        { icon: Bolt, label: "Home", href: `/company/${companyId}`, active: false },
        {
          icon: Bolt,
          label: "Chat",
          href: `/company/${companyId}/chat`,
          active: true,
        },
      ]
    : undefined;

  return (
    <UniversalLayout
      title={`Chat — ${assistantName}`}
      companyName={company?.name}
      leftRailItems={leftRailItems}
    >
      <div className="flex flex-col h-[calc(100vh-160px)] relative overflow-hidden bg-[#f3f4f5]">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#6a37d4]/5 blur-[120px] rounded-full pointer-events-none" />

        {/* Header */}
        <div className="px-8 lg:px-24 pt-8 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#6a37d4] rounded-lg flex items-center justify-center text-white">
              <Bolt className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#2c2f30]">
                {assistantName}
              </h1>
              <p className="text-xs text-slate-500">
                Your company's AI executive assistant
              </p>
            </div>
          </div>
        </div>

        {/* Thread */}
        <div
          ref={scrollRef}
          className="flex-1 px-8 lg:px-24 pb-32 overflow-y-auto space-y-6"
        >
          {messagesLoading && (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-3" />
              <span className="text-sm">Loading conversation…</span>
            </div>
          )}

          {messagesError && !messagesLoading && (
            <Card className="p-6 bg-red-50 border border-red-200 max-w-2xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-900">
                    Couldn't load chat history
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    {messagesError.message}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {!messagesLoading &&
            messages &&
            messages.length === 0 && (
              <div className="max-w-2xl">
                <Card className="bg-white p-8 rounded-2xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] border border-[#abadae]/10">
                  <p className="text-base text-[#2c2f30] mb-2">
                    Hi, I'm {assistantName}. Ask me anything about{" "}
                    {company?.name ?? "your company"} — goals, tasks,
                    workflows, or the next best action.
                  </p>
                </Card>
              </div>
            )}

          {messages?.map((message) => {
            const isUser = message.role === "user";
            return (
              <div
                key={message.id}
                className={
                  "flex flex-col gap-2 " +
                  (isUser ? "items-end" : "max-w-2xl items-start")
                }
              >
                {!isUser && (
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 bg-[#6a37d4] rounded-md flex items-center justify-center text-white">
                      <Bolt className="h-3 w-3" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#6a37d4]">
                      {assistantName}
                    </span>
                  </div>
                )}
                {isUser ? (
                  <div className="px-5 py-3 rounded-2xl rounded-tr-none bg-[#6a37d4] text-white max-w-xl">
                    <p className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </div>
                ) : (
                  <Card className="bg-white p-5 rounded-2xl shadow-[0_8px_32px_rgba(106,55,212,0.06)] border border-[#abadae]/10">
                    <p className="text-sm text-[#2c2f30] whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </Card>
                )}
                <span className="text-[10px] uppercase tracking-widest text-[#abadae]">
                  {formatTimestamp(message.timestamp)}
                </span>
              </div>
            );
          })}

          {sendMutation.isPending && (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">{assistantName} is thinking…</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-none">
          <div className="max-w-3xl mx-auto bg-white/90 backdrop-blur-[16px] p-2 rounded-2xl border border-[#abadae]/15 shadow-[0_8px_48px_rgba(106,55,212,0.12)] pointer-events-auto">
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={sendMutation.isPending}
                className="flex-1 bg-transparent border-none focus-visible:ring-0 text-[#2c2f30] text-base placeholder:text-[#abadae] px-4 h-auto"
                placeholder={`Message ${assistantName}…`}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || sendMutation.isPending}
                className="bg-[#6a37d4] hover:bg-[#6448b2] text-white p-3 rounded-xl shadow-lg shadow-[#6a37d4]/20 h-auto disabled:opacity-50"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </UniversalLayout>
  );
}
