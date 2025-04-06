import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { sendMessageToAgent } from "@/lib/openai";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AIModelSelector } from "@/components/ai-model-selector";
import { AIModelConfig } from "@/hooks/use-ai-models";

type Agent = {
  id: string;
  name: string;
  role: string;
  icon: string;
  instructions: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

type Task = {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in-progress" | "done";
};

export default function AgentChat({ params }: { params: { agentId: string } }) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [aiModelConfig, setAIModelConfig] = useState<AIModelConfig | null>(null);
  const [aiSelectorOpen, setAiSelectorOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: agent } = useQuery<Agent>({
    queryKey: [`/api/agents/${params.agentId}`],
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: [`/api/agents/${params.agentId}/messages`],
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: [`/api/agents/${params.agentId}/tasks`],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      setIsLoading(true);
      const response = await sendMessageToAgent(params.agentId, message, aiModelConfig);
      return response;
    },
    onSuccess: () => {
      setMessage("");
      refetchMessages();
      setIsLoading(false);
    },
    onError: (error) => {
      toast({
        title: "Error sending message",
        description: error.message,
        variant: "destructive",
      });
      setIsLoading(false);
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: { title: string; description: string }) => {
      const res = await apiRequest("POST", "/api/tasks", {
        ...taskData,
        agentId: params.agentId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${params.agentId}/tasks`] });
      toast({
        title: "Task created",
        description: "New task has been created successfully",
      });
    },
  });

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    sendMessageMutation.mutate(message);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Layout title={agent ? `Chat with ${agent.name}` : "Agent Chat"}>
      <div className="flex gap-6">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col h-full">
          <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow p-4 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto mb-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <i className="ri-chat-3-line text-5xl mb-2"></i>
                    <p>Start a conversation with your agent</p>
                  </div>
                </div>
              )}
              
              {messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[70%] px-4 py-2 rounded-lg ${
                      message.role === 'user' 
                        ? 'bg-primary/10 text-primary rounded-tr-none' 
                        : 'bg-gray-100 text-gray-800 rounded-tl-none'
                    }`}
                  >
                    <div className="text-sm mb-1">
                      {message.content}
                    </div>
                    <div className="text-xs text-gray-500 text-right">
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <Popover open={aiSelectorOpen} onOpenChange={setAiSelectorOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1 h-8 text-xs"
                    >
                      <i className="ri-cpu-line text-gray-600"></i>
                      {aiModelConfig ? (
                        <span className="font-medium">
                          {aiModelConfig.provider === "openai" ? "OpenAI" :
                           aiModelConfig.provider === "anthropic" ? "Claude" :
                           aiModelConfig.provider === "perplexity" ? "Perplexity" :
                           aiModelConfig.provider === "xai" ? "Grok" : 
                           aiModelConfig.provider}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Default AI</span>
                      )}
                      <i className="ri-arrow-down-s-line"></i>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <div className="p-4">
                      <AIModelSelector 
                        onSelectModel={(config) => {
                          setAIModelConfig(config);
                          setAiSelectorOpen(false);
                        }}
                        defaultProvider={aiModelConfig?.provider}
                        defaultModel={aiModelConfig?.modelName}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              {aiModelConfig && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2 text-xs" 
                  onClick={() => setAIModelConfig(null)}
                >
                  <i className="ri-close-line mr-1"></i>
                  Reset to default
                </Button>
              )}
            </div>
            
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                type="submit" 
                disabled={isLoading || !message.trim()}
                className="bg-primary hover:bg-blue-600"
              >
                {isLoading ? (
                  <i className="ri-loader-4-line animate-spin"></i>
                ) : (
                  <i className="ri-send-plane-fill"></i>
                )}
              </Button>
            </form>
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="w-80 flex flex-col space-y-4">
          <Card className="p-4">
            <h3 className="font-medium text-gray-800 mb-2">Agent Details</h3>
            {agent && (
              <>
                <div className="flex items-center mb-3">
                  <div className={`w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center`}>
                    <i className={agent.icon || "ri-robot-line"}></i>
                  </div>
                  <div className="ml-3">
                    <p className="font-medium text-gray-800">{agent.name}</p>
                    <Badge variant={agent.role as any || "default"}>{agent.role}</Badge>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Instructions:</h4>
                  <p>{agent.instructions}</p>
                </div>
              </>
            )}
          </Card>
          
          <Card className="p-4 flex-1 overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-800">Agent Tasks</h3>
              <Button 
                variant="outline" 
                size="sm"
                className="text-xs"
                onClick={() => {
                  createTaskMutation.mutate({
                    title: "New task",
                    description: "Task suggested by agent"
                  });
                }}
              >
                <i className="ri-add-line mr-1"></i> Add
              </Button>
            </div>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {tasks.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No tasks assigned</p>
              ) : (
                tasks.map((task) => (
                  <div 
                    key={task.id} 
                    className="p-2 border border-gray-200 rounded-md text-sm"
                  >
                    <div className="font-medium mb-1 flex items-center justify-between">
                      <span>{task.title}</span>
                      <Badge variant={
                        task.status === "done" ? "success" : 
                        task.status === "in-progress" ? "warning" : 
                        "default"
                      } className="text-xs">
                        {task.status === "todo" ? "To Do" : 
                        task.status === "in-progress" ? "In Progress" : 
                        "Done"}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600">{task.description}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
