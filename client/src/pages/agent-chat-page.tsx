import { useState } from "react";
import { Link } from "wouter";
import { UniversalLayout } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  Bolt, 
  Send, 
  Paperclip, 
  Mic, 
  Target, 
  BarChart3, 
  FileText,
  Lock,
  Link2Off
} from "lucide-react";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: string;
  data?: {
    blockers?: Array<{
      id: string;
      title: string;
      priority: "critical" | "high" | "medium";
      blockedBy: string;
      icon: "lock" | "link-off";
    }>;
  };
}

const placeholderMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: "I'm DEX, your AI executive assistant. Ask me anything about your company. I have full context on your Q3 goals, current workflow bottlenecks, and team task distribution.",
    timestamp: "5m ago",
  },
  {
    id: "2",
    role: "user",
    content: "Can you show me the high-priority tasks that are currently blocked in the Engineering workflow?",
    timestamp: "2m ago",
  },
  {
    id: "3",
    role: "assistant",
    content: "Found 3 critical blockers in the Engineering Pipeline. These are impacting our target ship date for the V2 Core.",
    timestamp: "1m ago",
    data: {
      blockers: [
        {
          id: "b1",
          title: "API Authentication Refactor",
          priority: "critical",
          blockedBy: "Infrastructure approval",
          icon: "lock",
        },
        {
          id: "b2",
          title: "Database Schema Migration",
          priority: "high",
          blockedBy: "Pending QA sign-off",
          icon: "link-off",
        },
      ],
    },
  },
];

const suggestedActions = [
  { icon: Target, label: "Review Q3 Goals" },
  { icon: BarChart3, label: "Analyze Workflow" },
  { icon: FileText, label: "Summarize Tasks" },
];

export default function AgentChatPage() {
  const [messages] = useState<Message[]>(placeholderMessages);
  const [inputValue, setInputValue] = useState("");

  const handleSend = () => {
    if (!inputValue.trim()) return;
    setInputValue("");
  };

  return (
    <UniversalLayout title="DEX Assistant">
      <div className="flex-1 flex flex-col relative overflow-hidden bg-[#f3f4f5]">
        {/* Background decorative element */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#6a37d4]/5 blur-[120px] rounded-full pointer-events-none" />

        {/* Conversation thread */}
        <div className="flex-1 px-8 lg:px-24 pt-12 pb-48 overflow-y-auto space-y-10">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`flex flex-col gap-4 ${
                message.role === "user" ? "items-end" : "max-w-4xl"
              } animate-in fade-in slide-in-from-bottom-4 duration-700`}
              style={{ animationDelay: `${index * 150}ms` }}
            >
              {message.role === "assistant" && (
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 bg-[#6a37d4] rounded-lg flex items-center justify-center text-white">
                    <Bolt className="h-[18px] w-[18px]" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-[#6a37d4]">
                    DEX Assistant
                  </span>
                </div>
              )}

              {message.role === "user" ? (
                <>
                  <div className="glass-panel px-6 py-4 rounded-2xl rounded-tr-none border border-[#abadae]/15 text-[#2c2f30] max-w-xl bg-white/70 backdrop-blur-[16px]">
                    <p className="text-base">{message.content}</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-[#abadae]">
                    Sent {message.timestamp}
                  </span>
                </>
              ) : (
                <Card className="bg-white p-8 rounded-2xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] border border-[#abadae]/10">
                  <p className="text-base text-[#2c2f30] mb-6">
                    {message.content.split("Engineering Pipeline").map((part, i) =>
                      i === 0 ? (
                        <span key={i}>{part}</span>
                      ) : (
                        <span key={i}>
                          <span className="font-bold text-[#6a37d4]">Engineering Pipeline</span>
                          {part}
                        </span>
                      )
                    )}
                  </p>

                  {message.data?.blockers && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {message.data.blockers.map((blocker) => (
                          <div
                            key={blocker.id}
                            className="p-4 bg-[#f3f4f5] rounded-xl border border-[#abadae]/5"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <Badge
                                className={`${
                                  blocker.priority === "critical"
                                    ? "bg-[#ffdad6] text-[#93000a]"
                                    : "bg-amber-100 text-amber-800"
                                } text-[10px] font-bold uppercase`}
                              >
                                {blocker.priority}
                              </Badge>
                              {blocker.icon === "lock" ? (
                                <Lock className="h-4 w-4 text-[#abadae]" />
                              ) : (
                                <Link2Off className="h-4 w-4 text-[#abadae]" />
                              )}
                            </div>
                            <h4 className="font-semibold text-sm mb-1">{blocker.title}</h4>
                            <p className="text-xs text-[#595c5d]">Blocked by: {blocker.blockedBy}</p>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        className="mt-6 flex items-center gap-2 text-[#6a37d4] font-semibold text-sm hover:translate-x-1 transition-transform p-0 h-auto"
                      >
                        Generate detailed blocker report
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </Button>
                    </>
                  )}
                </Card>
              )}
            </div>
          ))}
        </div>

        {/* Fixed interaction layer */}
        <div className="fixed bottom-0 left-0 right-0 md:left-64 p-8 flex flex-col items-center pointer-events-none">
          {/* Suggested actions */}
          <div className="flex flex-wrap justify-center gap-2 mb-6 pointer-events-auto">
            {suggestedActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant="ghost"
                  className="bg-white/70 backdrop-blur-[16px] px-4 py-2 rounded-full border border-[#abadae]/20 text-xs font-medium text-[#595c5d] hover:bg-white hover:text-[#6a37d4] transition-all flex items-center gap-2 shadow-sm h-auto"
                >
                  <Icon className="h-4 w-4" />
                  {action.label}
                </Button>
              );
            })}
          </div>

          {/* Chat input */}
          <div className="w-full max-w-3xl bg-white/70 backdrop-blur-[16px] p-2 rounded-2xl border border-[#abadae]/15 shadow-[0_8px_48px_rgba(106,55,212,0.12)] pointer-events-auto mb-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 pl-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-[#abadae] hover:text-[#6a37d4] h-10 w-10"
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-[#abadae] hover:text-[#6a37d4] h-10 w-10"
                >
                  <Mic className="h-5 w-5" />
                </Button>
              </div>
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="flex-1 bg-transparent border-none focus-visible:ring-0 text-[#2c2f30] text-base placeholder:text-[#abadae] px-2 h-auto"
                placeholder="Message DEX..."
              />
              <Button
                onClick={handleSend}
                className="bg-[#6a37d4] hover:bg-[#6448b2] text-white p-3 rounded-xl shadow-lg shadow-[#6a37d4]/20 transition-all h-auto"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </UniversalLayout>
  );
}