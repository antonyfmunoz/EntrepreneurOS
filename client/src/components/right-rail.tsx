import * as React from "react";
import { useState } from "react";
import { X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentChatStub } from "@/components/agent-chat-stub";
import { cn } from "@/lib/utils";

export interface RightRailProps {
  className?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function RightRail({
  className,
  isOpen = true,
  onToggle,
}: RightRailProps) {
  const [internalOpen, setInternalOpen] = useState(true);
  const isControlled = onToggle !== undefined;
  const open = isControlled ? isOpen : internalOpen;

  const handleToggle = React.useCallback(() => {
    if (isControlled) {
      onToggle?.();
    } else {
      setInternalOpen((prev) => !prev);
    }
  }, [isControlled, onToggle]);

  return (
    <>
      {/* Mobile toggle button - fixed bottom right */}
      <Button
        onClick={handleToggle}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-[0_8px_32px_rgba(106,55,212,0.08)] md:hidden",
          open && "hidden"
        )}
        style={{
          background: "#6a37d4",
        }}
      >
        <MessageSquare className="h-6 w-6 text-white" />
      </Button>

      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={handleToggle}
        />
      )}

      {/* Right rail panel */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 h-screen w-[320px] transition-transform duration-300 md:sticky md:z-0",
          !open && "translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden",
          className
        )}
        style={{
          background: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(16px)",
          boxShadow: "0 8px 32px rgba(106, 55, 212, 0.08)",
        }}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#abadae]/20 px-6 py-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#6a37d4]" />
              <h2
                className="text-base font-semibold"
                style={{ color: "#2c2f30" }}
              >
                AI Assistant
              </h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggle}
              className="h-8 w-8 text-[#595c5d] hover:bg-[#eff1f2] hover:text-[#2c2f30]"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Chat content */}
          <div className="flex-1 overflow-hidden">
            <AgentChatStub />
          </div>
        </div>
      </aside>
    </>
  );
}

export default RightRail;