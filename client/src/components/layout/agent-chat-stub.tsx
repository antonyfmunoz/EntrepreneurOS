import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const placeholderMessages: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: 'Ready to help. What are you working on?',
    timestamp: '10:32 AM',
  },
  {
    id: '2',
    role: 'user',
    content: 'Show me tasks that are blocked.',
    timestamp: '10:33 AM',
  },
  {
    id: '3',
    role: 'assistant',
    content: 'Found 3 blocked tasks. Two are waiting on design review. One needs legal approval for the contract template. Want me to ping the owners?',
    timestamp: '10:33 AM',
  },
];

export default function AgentChatStub() {
  const [messages] = useState<Message[]>(placeholderMessages);
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (inputValue.trim()) {
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback
                className={`text-xs ${
                  message.role === 'assistant'
                    ? 'bg-[#6a37d4] text-white'
                    : 'bg-[#eff1f2] text-[#2c2f30]'
                }`}
              >
                {message.role === 'assistant' ? 'AI' : 'U'}
              </AvatarFallback>
            </Avatar>
            <div
              className={`flex flex-col gap-1 max-w-[280px] ${
                message.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`px-4 py-3 rounded-xl ${
                  message.role === 'assistant'
                    ? 'bg-[#eff1f2] text-[#2c2f30]'
                    : 'bg-[#6a37d4] text-white'
                }`}
              >
                <p className="text-sm leading-relaxed">{message.content}</p>
              </div>
              <span className="text-xs text-[#595c5d] px-1">
                {message.timestamp}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-[#abadae]/10 p-4">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Message your assistant..."
            className="flex-1 bg-[#eff1f2] border-none text-sm focus-visible:ring-1 focus-visible:ring-[#6a37d4]/20"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="bg-[#6a37d4] hover:bg-[#5a2dc0] text-white px-4"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
