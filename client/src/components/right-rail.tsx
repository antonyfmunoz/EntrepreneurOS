import { useState } from "react";
import { X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentChatStub } from "@/components/agent-chat-stub";

interface RightRailProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RightRail({ isOpen, onClose }: RightRailProps) {
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 lg:hidden ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-[400px] lg:w-[320px] z-50 lg:z-30 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          background: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(16px)",
          boxShadow: "0 8px 32px rgba(106,55,212,0.08)",
        }}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#abadae]/20">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#6a37d4]" />
              <h2 className="text-base font-semibold text-[#2c2f30] font-['Inter']">
                AI Assistant
              </h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full hover:bg-[#eff1f2]"
            >
              <X className="w-4 h-4 text-[#595c5d]" />
            </Button>
          </div>

          <div className="flex-1 overflow-hidden">
            <AgentChatStub />
          </div>
        </div>
      </aside>
    </>
  );
}

export default RightRail;