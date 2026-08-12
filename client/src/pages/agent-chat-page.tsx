import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2 } from "lucide-react";
import { UniversalLayout } from "@/components/universal-layout";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

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

interface CompanyContext {
  id: number | string;
  name: string;
  assistantName?: string | null;
}

const SUGGESTED_ACTIONS = [
  "What are my top priorities this week?",
  "Show me workflow bottlenecks",
  "Who's overloaded on my team?",
  "Draft a Q3 roadmap outline"
];

export default function AgentChatPage() {
  const [, params] = useRoute("/company/:companyId/chat");
  const companyId = params?.companyId;
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: company } = useQuery<CompanyContext>({
    queryKey: ["company", companyId],
    queryFn: () => apiRequest<CompanyContext>(`/api/companies/${companyId}`, "GET"),
    enabled: !!companyId,
  });
  const assistantName = company?.assistantName || "Executive Assistant";

  const { data: conversation, isLoading, error } = useQuery<Conversation>({
    queryKey: ["conversation", companyId],
    queryFn: () => apiRequest<Conversation>(`/api/companies/${companyId}/conversations`, "GET"),
    enabled: !!companyId
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest<Message>(`/api/companies/${companyId}/conversations`, "POST", {
        content
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation", companyId] });
      setMessage("");
    }
  });

  const handleSend = () => {
    if (!message.trim() || message.length > 4000) return;
    sendMessageMutation.mutate(message);
  };

  const handleSuggestedAction = (action: string) => {
    setMessage(action);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages]);

  const messages = conversation?.messages ?? [];

  return (
    <UniversalLayout showRightRail={false}>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="border-b border-border-subtle px-6 py-4">
          <h1 className="font-mono font-bold text-2xl text-text">{assistantName}</h1>
          <p className="font-mono text-sm text-text-secondary mt-1">
            Your AI executive assistant. Ask anything about your company.
          </p>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-20 rounded-lg animate-pulse ${
                    i % 2 === 0 ? "bg-surface-subtle ml-auto max-w-md" : "bg-surface-subtle mr-auto max-w-md"
                  }`}
                />
              ))}
            </div>
          )}

          {error && (
            <div className="bg-destructive-muted border border-destructive rounded-lg p-6 text-center">
              <p className="font-mono text-sm text-destructive mb-4">
                Failed to load conversation history. Refresh the page.
              </p>
              <Button
                onClick={() => queryClient.invalidateQueries({ queryKey: ["conversation", companyId] })}
                className="bg-destructive hover:bg-destructive-hover text-text-on-primary font-mono font-semibold text-sm uppercase tracking-wide px-6 py-3 rounded-md"
              >
                Retry
              </Button>
            </div>
          )}

          {!isLoading && !error && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="font-mono text-4xl text-text-tertiary mb-4">—</div>
              <h3 className="font-mono font-semibold text-lg text-text mb-2">
                I'm {assistantName}, your Executive Assistant. I coordinate the right organizational channel for your company.
              </h3>
              <div className="mt-8 flex flex-wrap gap-3 justify-center max-w-2xl">
                {SUGGESTED_ACTIONS.map((action) => (
                  <button
                    key={action}
                    onClick={() => handleSuggestedAction(action)}
                    className="bg-surface-subtle hover:bg-border text-text font-mono text-sm px-4 py-2 rounded-md border border-border transition-all duration-150"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isLoading && !error && messages.length > 0 && (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-md px-4 py-3 rounded-lg font-mono text-sm ${
                      msg.role === "user"
                        ? "bg-primary-muted text-text rounded-br-none"
                        : "bg-surface-subtle text-text rounded-bl-none"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className="text-xs text-text-tertiary mt-2">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>
                </div>
              ))}
              {sendMessageMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-surface-subtle text-text rounded-lg rounded-bl-none px-4 py-3 font-mono text-sm max-w-md">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-text-secondary">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              {sendMessageMutation.isError && (
                <div className="flex justify-center">
                  <div className="bg-destructive-muted border border-destructive rounded-lg px-4 py-3 text-center">
                    <p className="font-mono text-sm text-destructive mb-2">
                      Message failed to send. Retry or check your connection.
                    </p>
                    <Button
                      onClick={() => sendMessageMutation.mutate(message)}
                      className="bg-destructive hover:bg-destructive-hover text-text-on-primary font-mono font-semibold text-xs uppercase tracking-wide px-4 py-2 rounded-md"
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Suggested Actions Panel (only show if messages exist) */}
        {messages.length > 0 && (
          <div className="px-6 pb-2">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {SUGGESTED_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => handleSuggestedAction(action)}
                  className="bg-surface-subtle hover:bg-border text-text font-mono text-xs px-3 py-2 rounded-md border border-border whitespace-nowrap transition-all duration-150 flex-shrink-0"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Input */}
        <div className="border-t border-border-subtle px-6 py-4">
          <div className="flex items-end space-x-3">
            <div className="flex-1">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Ask ${assistantName} about workflows, tasks, strategy, or organization…`}
                className="w-full bg-surface-subtle border border-border rounded-md px-4 py-3 font-mono text-base text-text placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-150 resize-none min-h-[48px] max-h-[200px]"
                rows={1}
                disabled={sendMessageMutation.isPending}
              />
              {message.length > 4000 && (
                <p className="mt-1 font-mono text-xs text-destructive">
                  Message must not exceed 4000 characters ({message.length}/4000)
                </p>
              )}
            </div>
            <Button
              onClick={handleSend}
              disabled={!message.trim() || message.length > 4000 || sendMessageMutation.isPending}
              className="bg-primary hover:bg-primary-hover text-text-on-primary font-mono font-semibold text-sm uppercase tracking-wide px-6 py-3 rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  <span>Send</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </UniversalLayout>
  );
}
