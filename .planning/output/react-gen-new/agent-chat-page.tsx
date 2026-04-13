import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Sparkles } from "lucide-react";
import { UniversalLayout } from "@/components/universal-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { designTokens } from "@/lib/design-tokens";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
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
  { id: "4", label: "Review goals", prompt: "What progress have we made on our quarterly goals?" }
];

function ChatMessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-6`}>
      <div 
        className={`max-w-[80%] px-6 py-4 ${isUser ? "bg-[#6a37d4] text-white" : "bg-[#f5f6f7] text-[#2c2f30]"}`}
        style={{ borderRadius: "12px" }}
      >
        <p className="text-base leading-relaxed whitespace-pre-wrap">{message.content}</p>
        <time className={`text-xs mt-2 block ${isUser ? "text-white/70" : "text-[#595c5d]"}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </time>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-6">
      <div 
        className="bg-[#f5f6f7] px-6 py-4"
        style={{ borderRadius: "12px" }}
      >
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-[#595c5d] rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
          <span className="w-2 h-2 bg-[#595c5d] rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
          <span className="w-2 h-2 bg-[#595c5d] rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
        </div>
      </div>
    </div>
  );
}

function AgentStatusIndicator({ status }: { status: "online" | "thinking" | "offline" }) {
  const statusConfig = {
    online: { color: "#10b981", label: "Online" },
    thinking: { color: "#6a37d4", label: "Thinking..." },
    offline: { color: "#6b7280", label: "Offline" }
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-3 px-6 py-4 bg-[#eff1f2]" style={{ borderRadius: "12px" }}>
      <Sparkles className="w-5 h-5" style={{ color: config.color }} />
      <div className="flex-1">
        <p className="text-sm font-semibold text-[#2c2f30]">DEX</p>
        <p className="text-xs text-[#595c5d]">{config.label}</p>
      </div>
      <div 
        className="w-2 h-2 rounded-full" 
        style={{ backgroundColor: config.color }}
      ></div>
    </div>
  );
}

function SuggestedActionsPanel({ suggestions, onSelect }: { suggestions: SuggestedAction[], onSelect: (prompt: string) => void }) {
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

function ChatInput({ onSend, disabled }: { onSend: (message: string) => void, disabled: boolean }) {
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
        borderRadius: "12px"
      }}
    >
      <div className="max-w-4xl mx-auto flex gap-3 items-end">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask DEX anything about your company..."
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
            borderRadius: "12px"
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

function EmptyState({ onSelectSuggestion }: { onSelectSuggestion: (prompt: string) => void }) {
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
            <h2 className="text-xl font-semibold text-[#2c2f30]">DEX</h2>
            <p className="text-sm text-[#595c5d]">Your AI executive assistant</p>
          </div>
        </div>
        <p className="text-base text-[#2c2f30] mb-8 leading-relaxed">
          I'm DEX, your AI executive assistant. Ask me anything about your company.
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
          ></div>
        </div>
      ))}
    </div>
  );
}

function ErrorRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <Card className="max-w-md w-full p-8 bg-white text-center" style={{ borderRadius: "12px", border: "none" }}>
        <p className="text-base text-[#2c2f30] mb-6">Failed to load conversation. Check your connection and try again.</p>
        <Button
          onClick={onRetry}
          className="text-white"
          style={{ 
            backgroundColor: "#6a37d4",
            borderRadius: "12px"
          }}
        >
          Retry
        </Button>
      </Card>
    </div>
  );
}

export default function AgentChatPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [agentStatus, setAgentStatus] = useState<"online" | "thinking" | "offline">("online");

  const { data: conversation, isLoading, isError, refetch } = useQuery<Conversation>({
    queryKey: ["conversation", companyId],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${companyId}/conversations`);
      if (!response.ok) throw new Error("Failed to fetch conversation");
      return response.json();
    },
    enabled: !!companyId
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/companies/${companyId}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      if (!response.ok) throw new Error("Failed to send message");
      return response.json();
    },
    onMutate: async (content) => {
      setAgentStatus("thinking");
      await queryClient.cancelQueries({ queryKey: ["conversation", companyId] });
      
      const previousConversation = queryClient.getQueryData<Conversation>(["conversation", companyId]);
      
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date().toISOString()
      };

      queryClient.setQueryData<Conversation>(["conversation", companyId], (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: [...old.messages, optimisticMessage]
        };
      });

      return { previousConversation };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["conversation", companyId], data);
      setAgentStatus("online");
      
      if (typeof window !== "undefined" && (window as any).posthog) {
        (window as any).posthog.capture("message_sent", {
          companyId,
          messageLength: data.messages[data.messages.length - 2]?.content.length || 0
        });
      }
    },
    onError: (error, content, context) => {
      if (context?.previousConversation) {
        queryClient.setQueryData(["conversation", companyId], context.previousConversation);
      }
      setAgentStatus("online");
    }
  });

  const handleSendMessage = (content: string) => {
    sendMessageMutation.mutate(content);
  };

  const handleSuggestedAction = (prompt: string) => {
    handleSendMessage(prompt);
    
    if (typeof window !== "undefined" && (window as any).posthog) {
      (window as any).posthog.capture("suggested_action_clicked", {
        actionLabel: SUGGESTED_STARTERS.find(s => s.prompt === prompt)?.label || "Unknown"
      });
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages]);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).posthog) {
      (window as any).posthog.capture("page_viewed", { companyId });
    }
  }, [companyId]);

  return (
    <UniversalLayout companyId={companyId || ""} hideRightRail>
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 bg-white">
          <AgentStatusIndicator status={agentStatus} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {isLoading ? (
            <LoadingSkeleton />
          ) : isError ? (
            <ErrorRetry onRetry={() => refetch()} />
          ) : !conversation?.messages.length ? (
            <EmptyState onSelectSuggestion={handleSuggestedAction} />
          ) : (
            <div className="max-w-4xl mx-auto">
              {conversation.messages.map((message) => (
                <ChatMessageBubble key={message.id} message={message} />
              ))}
              {sendMessageMutation.isPending && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {conversation && conversation.messages.length > 0 && (
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
          disabled={sendMessageMutation.isPending} 
        />
      </div>
    </UniversalLayout>
  );
}