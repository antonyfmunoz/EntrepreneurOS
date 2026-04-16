import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
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
  onSendMessage: (message: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  className?: string;
}

export function AgentChatStub({
  messages = [],
  onSendMessage,
  placeholder = "Ask me anything...",
  isLoading = false,
  className,
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
    
    onSendMessage(trimmed);
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <div
      className={clsx(
        "flex flex-col h-full rounded-[12px] overflow-hidden",
        "bg-white/70 backdrop-blur-[16px]",
        "shadow-[0_8px_32px_rgba(106,55,212,0.08)]",
        className
      )}
    >
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#595c5d] text-sm">
            Start a conversation with your AI assistant
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={clsx(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={clsx(
                  "max-w-[80%] rounded-[12px] px-4 py-3 text-sm",
                  message.role === "user"
                    ? "bg-[#6a37d4] text-white"
                    : "bg-[#f5f6f7] text-[#2c2f30]"
                )}
              >
                {message.content}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-[12px] px-4 py-3 text-sm bg-[#f5f6f7] text-[#595c5d]">
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
        className="border-t border-[#eff1f2] p-4 bg-white/50"
      >
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
            className="flex-1 bg-white border-[#eff1f2] focus:border-[#6a37d4] text-[#2c2f30] placeholder:text-[#abadae]"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-[#6a37d4] hover:bg-[#5a2dc0] text-white rounded-[12px] px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

export default AgentChatStub;