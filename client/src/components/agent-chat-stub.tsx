import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import designTokens from '@/lib/design-tokens';

const DESIGN_TOKENS = {
  ...designTokens,
  borderRadius: designTokens.borderRadius.default,
  font: designTokens.typography.fontFamily,
};

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AgentChatStubProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export function AgentChatStub({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = 'Ask me anything...',
  className = '',
}: AgentChatStubProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedValue = inputValue.trim();
    if (!trimmedValue || isLoading) return;

    onSendMessage(trimmedValue);
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      className={`flex flex-col h-full ${className}`}
      style={{
        background: DESIGN_TOKENS.glassmorphism.background,
        backdropFilter: DESIGN_TOKENS.glassmorphism.backdropFilter,
        borderRadius: DESIGN_TOKENS.borderRadius,
        boxShadow: DESIGN_TOKENS.glassmorphism.shadow,
      }}
    >
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Bot
              size={48}
              style={{ color: DESIGN_TOKENS.colors.primary }}
              className="mb-4 opacity-40"
            />
            <p
              style={{
                color: DESIGN_TOKENS.colors.onSurfaceVariant,
                fontFamily: DESIGN_TOKENS.font,
                fontSize: '14px',
                lineHeight: '1.5',
              }}
            >
              Start a conversation with your AI assistant
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background: DESIGN_TOKENS.colors.primary,
                  }}
                >
                  <Bot size={16} color="#ffffff" />
                </div>
              )}
              <div
                className="max-w-[80%] px-4 py-3 rounded-xl"
                style={{
                  background:
                    message.role === 'user'
                      ? DESIGN_TOKENS.colors.primary
                      : DESIGN_TOKENS.colors.surfaceContainerLow,
                  color:
                    message.role === 'user'
                      ? '#ffffff'
                      : DESIGN_TOKENS.colors.onSurface,
                  fontFamily: DESIGN_TOKENS.font,
                  fontSize: '14px',
                  lineHeight: '1.5',
                  borderRadius: DESIGN_TOKENS.borderRadius,
                }}
              >
                {message.content}
              </div>
              {message.role === 'user' && (
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background: DESIGN_TOKENS.colors.surfaceContainerLow,
                  }}
                >
                  <User size={16} style={{ color: DESIGN_TOKENS.colors.onSurface }} />
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: DESIGN_TOKENS.colors.primary,
              }}
            >
              <Bot size={16} color="#ffffff" />
            </div>
            <div
              className="px-4 py-3 rounded-xl flex gap-1"
              style={{
                background: DESIGN_TOKENS.colors.surfaceContainerLow,
                borderRadius: DESIGN_TOKENS.borderRadius,
              }}
            >
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{
                  background: DESIGN_TOKENS.colors.onSurfaceVariant,
                  animationDelay: '0ms',
                }}
              />
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{
                  background: DESIGN_TOKENS.colors.onSurfaceVariant,
                  animationDelay: '150ms',
                }}
              />
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{
                  background: DESIGN_TOKENS.colors.onSurfaceVariant,
                  animationDelay: '300ms',
                }}
              />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t" style={{ borderColor: DESIGN_TOKENS.colors.outlineVariant }}>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            className="flex-1"
            style={{
              fontFamily: DESIGN_TOKENS.font,
              fontSize: '14px',
              borderRadius: DESIGN_TOKENS.borderRadius,
              borderColor: DESIGN_TOKENS.colors.outlineVariant,
            }}
          />
          <Button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            style={{
              background: DESIGN_TOKENS.colors.primary,
              color: '#ffffff',
              borderRadius: DESIGN_TOKENS.borderRadius,
              fontFamily: DESIGN_TOKENS.font,
            }}
            className="hover:opacity-90 transition-opacity"
          >
            <Send size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
}

export default AgentChatStub;