import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentChatStub } from "@/components/agent-chat-stub";
import { motion, AnimatePresence } from "framer-motion";

interface FloatingAiPanelProps {
  className?: string;
}

export function FloatingAiPanel({ className }: FloatingAiPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 ${className ?? ""}`}
    >
      <motion.div
        initial={false}
        animate={{
          height: isExpanded ? "auto" : "56px",
        }}
        transition={{
          duration: 0.3,
          ease: [0.4, 0, 0.2, 1],
        }}
        style={{
          background: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: "0 8px 32px rgba(106, 55, 212, 0.08)",
        }}
        className="overflow-hidden"
        data-testid="floating-ai-panel"
      >
        <div className="rounded-xl">
          <button
            onClick={toggleExpanded}
            className="w-full h-14 px-6 flex items-center justify-between hover:bg-white/40 transition-colors"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse AI Assistant" : "Expand AI Assistant"}
          >
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#6a37d4]" />
              <span className="text-[#2c2f30] font-medium text-sm">AI Assistant</span>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-[#595c5d]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[#595c5d]" />
            )}
          </button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="px-6 pb-6"
              >
                <div className="border-t border-[#abadae]/20 pt-4">
                  <AgentChatStub />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

export default FloatingAiPanel;