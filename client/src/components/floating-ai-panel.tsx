import React, { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentChatStub } from "@/components/agent-chat-stub";
import { cn } from "@/lib/utils";

interface FloatingAiPanelProps {
  className?: string;
  defaultExpanded?: boolean;
}

export function FloatingAiPanel({
  className,
  defaultExpanded = false,
}: FloatingAiPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div
      className={cn(
        "fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-in-out",
        isExpanded ? "w-full max-w-2xl" : "w-auto",
        className
      )}
      style={{
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px rgba(106,55,212,0.08)",
        borderRadius: "12px",
      }}
    >
      <button
        onClick={toggleExpanded}
        className={cn(
          "w-full flex items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-white/50",
          !isExpanded && "rounded-[12px]"
        )}
        style={{
          borderRadius: isExpanded ? "12px 12px 0 0" : "12px",
        }}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Collapse AI assistant" : "Expand AI assistant"}
      >
        <div className="flex items-center gap-2">
          <Sparkles
            className="w-5 h-5"
            style={{ color: "#6a37d4" }}
            strokeWidth={2}
          />
          <span
            className="font-medium text-sm"
            style={{
              fontFamily: "Inter",
              color: "#2c2f30",
            }}
          >
            AI Assistant
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5" style={{ color: "#595c5d" }} />
        ) : (
          <ChevronDown className="w-5 h-5" style={{ color: "#595c5d" }} />
        )}
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div
          className="border-t px-6 py-6"
          style={{
            borderColor: "#eff1f2",
          }}
        >
          <AgentChatStub />
        </div>
      </div>
    </div>
  );
}

export default FloatingAiPanel;