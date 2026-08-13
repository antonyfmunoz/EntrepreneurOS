import { useState, useRef, useEffect } from "react";
import { BriefcaseBusiness, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import clsx from "clsx";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface AgentChatStubProps {
  messages?: ChatMessage[];
  onSendMessage?: (message: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  className?: string;
  assistantName?: string;
  compact?: boolean;
  suggestions?: string[];
  onPromoteMessage?: (message: ChatMessage) => void;
  promoteLabel?: string;
}

export function AgentChatStub({
  messages = [],
  onSendMessage,
  placeholder = "Ask me anything...",
  isLoading = false,
  className,
  assistantName = "Executive Assistant",
  compact = false,
  suggestions = [],
  onPromoteMessage,
  promoteLabel = "Turn into work",
}: AgentChatStubProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    
    onSendMessage?.(trimmed);
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <div
      className={clsx(
        "flex h-full min-h-0 flex-col overflow-hidden",
        compact ? "bg-transparent" : "rounded-[12px] bg-white/70 backdrop-blur-[16px] shadow-[0_8px_32px_rgba(106,55,212,0.08)]",
        className
      )}
    >
      <div className={clsx("min-w-0 flex-1 overflow-x-hidden overflow-y-auto", compact ? "space-y-2 p-3" : "space-y-4 p-6")}>
        {messages.length === 0 ? (
          <div className={clsx("flex h-full items-center justify-center text-center text-[#595c5d]", compact ? "px-3 text-[11px]" : "text-sm")}>
            Ask {assistantName} anything
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={message.id}
              className={clsx(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div className={clsx("min-w-0", compact ? "w-fit max-w-[82%]" : "max-w-[80%]")}>
                <div
                  className={clsx(
                    "min-w-0 break-words [overflow-wrap:anywhere]",
                    compact ? "rounded-xl px-3 py-2 text-[11px] leading-relaxed" : "rounded-[12px] px-4 py-3 text-sm",
                    message.role === "user"
                      ? "bg-[#6a37d4] text-white"
                      : "bg-[#f5f6f7] text-[#2c2f30]"
                  )}
                >
                  {compact && <div className={clsx("mb-1 flex items-center gap-2 text-[9px] font-medium uppercase tracking-wide", message.role === "user" ? "text-white/70" : "text-muted-foreground")}><span>{message.role === "user" ? "You" : assistantName}</span><span className="ml-auto normal-case tracking-normal">{message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>}
                  {message.content}
                </div>
                {onPromoteMessage && message.role === "assistant" && index === messages.length - 1 && (
                  <button type="button" onClick={() => onPromoteMessage(message)} className="mt-1.5 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10">
                    <BriefcaseBusiness className="h-3 w-3" />{promoteLabel}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className={clsx("max-w-[80%] rounded-[12px] bg-[#f5f6f7] text-[#595c5d]", compact ? "px-3 py-2 text-[11px]" : "px-4 py-3 text-sm")}>
              <div className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-[#595c5d] rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="inline-block w-2 h-2 bg-[#595c5d] rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="inline-block w-2 h-2 bg-[#595c5d] rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className={clsx("flex-shrink-0 border-t border-[#eff1f2] bg-white/60", compact ? "p-2" : "p-4")}
      >
        {suggestions.length > 0 && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5" aria-label="Suggested requests">
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button" disabled={isLoading} onClick={() => onSendMessage?.(suggestion)} className="flex-shrink-0 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50">
                {suggestion}
              </button>
            ))}
          </div>
        )}
        <div className={clsx("flex items-center", compact ? "gap-1" : "gap-2")}>
          <div className={clsx("flex min-w-0 flex-1 items-center border border-[#eff1f2] bg-white", compact ? "rounded-lg" : "rounded-xl")}>
            <Input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              disabled={isLoading}
              className={clsx("min-w-0 flex-1 border-0 bg-transparent text-[#2c2f30] placeholder:text-[#abadae] focus-visible:ring-0 focus-visible:ring-offset-0", compact && "h-8 px-2 text-[11px]")}
            />
          </div>
          <Button
            type="submit"
            size={compact ? "icon" : "default"}
            disabled={!input.trim() || isLoading}
            className={clsx("flex-shrink-0 bg-[#6a37d4] text-white hover:bg-[#5a2dc0]", compact ? "h-8 w-8 rounded-lg" : "rounded-[12px] px-4")}
            aria-label={`Send message to ${assistantName}`}
          >
            <Send className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </Button>
        </div>
      </form>
    </div>
  );
}

export default AgentChatStub;
