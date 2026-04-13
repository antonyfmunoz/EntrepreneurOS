import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bolt, Send, Sparkles } from "lucide-react";

import { UniversalLayout } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Company } from "@shared/schema";

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

interface SuggestedAction {
  id: string;
  label: string;
  prompt: string;
}

const SUGGESTED_STARTERS: SuggestedAction[] = [
  { id: "1", label: "Review my org chart", prompt: "Can you review my current org chart and identify any gaps?" },
  { id: "2", label: "Analyze task load", prompt: "Show me who on my team is overloaded with tasks" },
  { id: "3", label: "Create workflow", prompt: "Help me create a workflow for customer onboarding" },
  { id: "4", label: "Review goals", prompt: "What progress have we made on our quarterly goals?" },
];

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function ChatMessageBubble({ message, assistantName }: { message: AgentMessage; assistantName: string }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-6`}>
      {!isUser && (
        <div
          className="w-8 h-8 flex-shrink-0 flex items-center justify-center mr-3 mt-1"
          style={{ backgroundColor: "#6a37d4", borderRadius: "12px" }}
        >
          <Bolt className="w-4 h-4 text-white" />
        </div>
      )}
      <div
        className={`max-w-[80%] px-6 py-4 ${isUser ? "bg-[#6a37d4] text-white" : "bg-[#f5f6f7] text-[#2c2f30]"}`}
        style={{ borderRadius: "12px" }}
      >
        {!isUser && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#6a37d4] mb-2">
            {assistantName}
          </p>
        )}
        <p className="text-base leading-relaxed whitespace-pre-wrap">{message.content}</p>
        <time className={`text-xs mt-2 block ${isUser ? "text-white/70" : "text-[#595c5d]"}`}>
          {formatTimestamp(message.timestamp)}
        </time>
      </div>
    </div>
  );
}

function TypingIndicator({ assistantName }: { assistantName: string }) {
  return (
    <div className="flex justify-start mb-6">
      <div
        className="w-8 h-8 flex-shrink-0 flex items-center justify-center mr-3 mt-1"
        style={{ backgroundColor: "#6a37d4", borderRadius: "12px" }}
      >
        <Bolt className="w-4 h-4 text-white" />
      </div>
      <div
        className="bg-[#f5f6f7] px-6 py-4"
        style={{ borderRadius: "12px" }}
      >
        <p className="text-xs text-[#595c5d] mb-2">{assistantName} is thinking...</p>
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-[#595c5d] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-[#595c5d] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-[#595c5d] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

function AgentStatusIndicator({ status, assistantName }: { status: "online" | "thinking" | "offline"; assistantName: string }) {
  const statusConfig = {
    online: { color: "#10b981", label: "Online" },
    thinking: { color: "#6a37d4", label: "Thinking..." },
    offline: { color: "#6b7280", label: "Offline" },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-3 px-6 py-4 bg-[#eff1f2]" style={{ borderRadius: "12px" }}>
      <Sparkles className="w-5 h-5" style={{ color: config.color }} />
      <div className="flex-1">
        <p className="text-sm font-semibold text-[#2c2f30]">{assistantName}</p>
        <p className="text-xs text-[#595c5d]">{config.label}</p>
      </div>
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: config.color }}
      />
    </div>
  );
}

function SuggestedActionsPanel({ suggestions, onSelect }: { suggestions: SuggestedAction[]; onSelect: (prompt: string) => void }) {
  return (
    <div className="mb-4">
      <p className="text-xs uppercase tracking-wider text-[#595c5d] mb-3 px-1">Suggested</p>
      <div className="flex flex-wrap gap-2 md:grid md:grid-cols-2 lg:grid-cols-4">
        {suggestions.map((action) => (
          <button
            key={action.id}
            onClick={() => onSelect(action.prompt)}
            className="px-4 py-3 bg-white text-[#2c2f30] text-sm font-medium hover:bg-[#f5f6f7] transition-colors text-left"
            style={{ borderRadius: "12px" }}
            aria-label={`Suggested action: ${action.label}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatInput({ onSend, disabled, assistantName }: { onSend: (message: string) => void; disabled: boolean; assistantName: string }) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  };

  return (
    <div
      className="sticky bottom-0 bg-white/70 backdrop-blur-[16px] p-6"
      style={{
        boxShadow: "0 8px 32px rgba(106,55,212,0.08)",
        borderRadius: "12px",
      }}
    >
      <div className="max-w-4xl mx-auto flex gap-3 items-end">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${assistantName}...`}
          disabled={disabled}
          className="flex-1 min-h-[52px] max-h-[200px] resize-none bg-[#f5f6f7] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6a37d4]/20 focus:ring-offset-0 text-base text-[#2c2f30] placeholder:text-[#595c5d]"
          style={{ borderRadius: "12px", border: "none" }}
          rows={1}
          maxLength={4000}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          className="h-[52px] w-[52px] p-0 flex-shrink-0 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          style={{
            backgroundColor: "#6a37d4",
            borderRadius: "12px",
          }}
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>
      {input.length > 3800 && (
        <p className="text-xs text-[#595c5d] mt-2 text-right max-w-4xl mx-auto">
          {input.length}/4000 characters
        </p>
      )}
    </div>
  );
}

function EmptyState({ onSelectSuggestion, assistantName, companyName }: { onSelectSuggestion: (prompt: string) => void; assistantName: string; companyName: string }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <Card className="max-w-2xl w-full p-8 bg-white" style={{ borderRadius: "12px", border: "none" }}>
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-12 h-12 flex items-center justify-center bg-[#ae8dff]/20"
            style={{ borderRadius: "12px" }}
          >
            <Sparkles className="w-6 h-6 text-[#6a37d4]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#2c2f30]">{assistantName}</h2>
            <p className="text-sm text-[#595c5d]">Your AI executive assistant</p>
          </div>
        </div>
        <p className="text-base text-[#2c2f30] mb-8 leading-relaxed">
          Hi, I'm {assistantName}. Ask me anything about {companyName} — goals, tasks,
          workflows, or the next best action.
        </p>
        <SuggestedActionsPanel suggestions={SUGGESTED_STARTERS} onSelect={onSelectSuggestion} />
      </Card>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex-1 px-6 py-12 space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
          <div
            className="w-[60%] h-20 bg-[#f5f6f7] animate-pulse"
            style={{ borderRadius: "12px" }}
          />
        </div>
      ))}
    </div>
  );
}

function ErrorRetry({ onRetry, errorMessage }: { onRetry: () => void; errorMessage: string }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <Card className="max-w-md w-full p-8 bg-white text-center" style={{ borderRadius: "12px", border: "none" }}>
        <p className="text-base font-semibold text-[#2c2f30] mb-2">Couldn't load chat history</p>
        <p className="text-sm text-[#595c5d] mb-6">{errorMessage}</p>
        <Button
          onClick={onRetry}
          className="text-white"
          style={{
            backgroundColor: "#6a37d4",
            borderRadius: "12px",
          }}
        >
          Retry
        </Button>
      </Card>
    </div>
  );
}

export default function AgentChatPage() {
  const params = useParams<{ companyId?: string }>();
  const companyId = params.companyId;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [agentStatus, setAgentStatus] = useState<"online" | "thinking" | "offline">("online");

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
    refetch: messagesRefetch,
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
      setAgentStatus("thinking");
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
      setAgentStatus("online");
    },
    onError: (err, _vars, ctx) => {
      const previous = (ctx as { previous?: AgentMessage[] } | undefined)
        ?.previous;
      if (previous) {
        queryClient.setQueryData(messagesQueryKey, previous);
      }
      setAgentStatus("online");
      toast({
        title: "Couldn't send message",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (content: string) => {
    if (!content || sendMutation.isPending) return;
    sendMutation.mutate(content);
  };

  const handleSuggestedAction = (prompt: string) => {
    handleSendMessage(prompt);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const assistantName = company?.assistantName ?? "DEX Assistant";
  const displayCompanyName = company?.name ?? "your company";

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
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 bg-white">
          <AgentStatusIndicator status={agentStatus} assistantName={assistantName} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messagesLoading ? (
            <LoadingSkeleton />
          ) : messagesError ? (
            <ErrorRetry onRetry={() => messagesRefetch()} errorMessage={messagesError.message} />
          ) : !messages || messages.length === 0 ? (
            <EmptyState
              onSelectSuggestion={handleSuggestedAction}
              assistantName={assistantName}
              companyName={displayCompanyName}
            />
          ) : (
            <div className="max-w-4xl mx-auto">
              {messages.map((message) => (
                <ChatMessageBubble key={message.id} message={message} assistantName={assistantName} />
              ))}
              {sendMutation.isPending && <TypingIndicator assistantName={assistantName} />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {messages && messages.length > 0 && (
          <div className="px-6 pb-6">
            <div className="max-w-4xl mx-auto">
              <SuggestedActionsPanel
                suggestions={SUGGESTED_STARTERS}
                onSelect={handleSuggestedAction}
              />
            </div>
          </div>
        )}

        <ChatInput
          onSend={handleSendMessage}
          disabled={sendMutation.isPending}
          assistantName={assistantName}
        />
      </div>
    </UniversalLayout>
  );
}
