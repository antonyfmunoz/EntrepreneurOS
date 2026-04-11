import React, { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AgentChatStub from './agent-chat-stub';

export default function FloatingAIPanel() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {isOpen && (
        <div
          className="fixed bottom-24 right-8 w-[420px] h-[600px] rounded-xl border border-[#6a37d4] shadow-[0_8px_32px_rgba(106,55,212,0.08)] overflow-hidden z-50"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#abadae]/10">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-[#6a37d4]" />
              <span className="text-sm font-semibold text-[#2c2f30]">
                Your assistant
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 text-[#595c5d] hover:text-[#2c2f30]"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="h-[calc(100%-64px)]">
            <AgentChatStub />
          </div>
        </div>
      )}

      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-8 right-8 h-14 w-14 rounded-full bg-[#6a37d4] text-white shadow-[0_8px_32px_rgba(106,55,212,0.08)] hover:bg-[#5a2dc0] z-40"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageSquare className="h-6 w-6" />
        )}
      </Button>
    </>
  );
}
