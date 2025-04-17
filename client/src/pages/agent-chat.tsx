import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerTrigger, DrawerClose } from "@/components/ui/drawer";
import { sendMessageToAgent } from "@/lib/openai";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AIModelSelector } from "@/components/ai-model-selector";
import { AIModelConfig, AIModelProvider } from "@/hooks/use-ai-models";
import { useRequestAIKeys } from "@/hooks/use-ai-api-keys";
import { ApiKeyDialog } from "@/components/api-key-dialog";
import { cn } from "@/lib/utils";
import { Settings, Info, Clipboard, Bot, Sparkles } from "lucide-react";
import { Link } from "wouter";

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

type AgentChatProps = {
  params?: { agentId: string }
};

export default function AgentChat({ params }: AgentChatProps) {
  const agentId = params?.agentId || "";
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [aiModelConfig, setAIModelConfig] = useState<AIModelConfig | null>(null);
  const [aiSelectorOpen, setAiSelectorOpen] = useState(false);
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [requiredApiProviders, setRequiredApiProviders] = useState<AIModelProvider[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { requestKeys } = useRequestAIKeys();

  const { data: agent } = useQuery<Agent>({
    queryKey: [`/api/agents/${agentId}`],
    enabled: !!agentId, // Only run query if agentId exists
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: [`/api/agents/${agentId}/messages`],
    enabled: !!agentId, // Only run query if agentId exists
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: [`/api/agents/${agentId}/tasks`],
    enabled: !!agentId, // Only run query if agentId exists
  });
  
  // Fetch all agents, but only to find the Executive Agent
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
  });
  
  // Find the Executive Agent from the fetched agents
  const executiveAgent = agents.find(a => a.role === 'executive') || agents[0];

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      setIsLoading(true);
      const response = await sendMessageToAgent(agentId, message, aiModelConfig);
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
        agentId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/tasks`] });
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    // If no custom AI model is selected, we'll use the default (likely OpenAI)
    const providers: AIModelProvider[] = aiModelConfig ? [aiModelConfig.provider] : ["openai"];
    
    // Check if we have the required API keys
    const hasKeys = await requestKeys(providers);
    
    if (!hasKeys) {
      // Set required providers and open the API key dialog
      setRequiredApiProviders(providers);
      setApiKeyDialogOpen(true);
      return;
    }
    
    // If we have the keys, send the message
    sendMessageMutation.mutate(message);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Layout title={agent?.name || "Agent Chat"}>
      <div className="flex h-full overflow-hidden -mt-6 -mx-6">
        {/* API Key Dialog */}
        <ApiKeyDialog 
          isOpen={apiKeyDialogOpen} 
          onClose={() => {
            setApiKeyDialogOpen(false);
            if (message.trim()) {
              sendMessageMutation.mutate(message);
            }
          }}
          providers={requiredApiProviders} 
        />
        
        {/* Toggle Sidebar Button - Only visible when sidebar is collapsed, positioned at the edge */}
        {sidebarCollapsed && (
          <div className="h-full w-10 border-r border-gray-200 flex flex-col items-center py-4 bg-gray-50">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-md mt-2"
              onClick={() => setSidebarCollapsed(false)}
            >
              <i className="ri-menu-line"></i>
            </Button>
          </div>
        )}
        
        {/* Left Sidebar - ChatGPT Style */}
        <div className={cn(
          "border-r border-gray-200 flex flex-col bg-gray-50 overflow-hidden transition-all duration-300",
          sidebarCollapsed ? "w-0 opacity-0" : "w-64 opacity-100"
        )}>
          {/* Sidebar Header */}
          <div className="p-4 flex justify-between items-center border-b border-gray-200">
            <div className="flex items-center">
              <Button variant="outline" size="sm" className="flex justify-start items-center gap-2 w-full">
                <Bot size={16} />
                <span className="text-sm font-medium">New Chat</span>
              </Button>
            </div>
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md">
                  <i className="ri-add-fill"></i>
                </Button>
              </DrawerTrigger>
              <DrawerContent className="p-4 max-w-sm mx-auto">
                <div className="space-y-4">
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center mr-4">
                      <i className={`${agent?.icon || "ri-robot-line"} text-xl`}></i>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{agent?.name || "Agent"}</h3>
                      <Badge variant="outline">{agent?.role || "Assistant"}</Badge>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">Agent Instructions</h4>
                    <p className="text-sm text-gray-600 border border-gray-200 rounded-md p-3 bg-gray-50">
                      {agent?.instructions || "This agent will help you with tasks and answer questions."}
                    </p>
                  </div>

                  {tasks.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Active Tasks</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {tasks.map(task => (
                          <div key={task.id} className="text-sm p-2 border border-gray-200 rounded-md">
                            <div className="flex justify-between">
                              <span className="font-medium">{task.title}</span>
                              <Badge variant="outline" className="ml-2">
                                {task.status === "todo" ? "To Do" : 
                                task.status === "in-progress" ? "In Progress" : 
                                "Done"}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <DrawerClose asChild>
                    <Button className="w-full">Close</Button>
                  </DrawerClose>
                </div>
              </DrawerContent>
            </Drawer>
          </div>
          
          {/* Agent Chats List */}
          <div className="flex-1 overflow-y-auto py-2">
            {/* Current Chat */}
            <div className="px-3 py-2">
              <h3 className="text-xs font-medium text-gray-500 mb-2">CURRENT CHAT</h3>
              <div className="space-y-1">
                {/* Active Conversation */}
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-md cursor-pointer",
                  "bg-primary/10 text-primary"
                )}>
                  <Bot size={18} />
                  <div className="flex-1 truncate">
                    <div className="text-sm font-medium">Chat with {agent?.name || "Agent"}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {messages.length > 0 
                        ? messages[messages.length - 1].content.slice(0, 30) + "..." 
                        : "Start a new conversation"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Previous conversations */}
            <div className="px-3 py-2">
              <h3 className="text-xs font-medium text-gray-500 mb-2">CONVERSATION HISTORY</h3>
              <div className="space-y-1">
                {messages.length > 0 ? (
                  <div className="text-xs text-gray-500 p-3">
                    <div className="flex flex-col gap-2 mt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{new Date().toLocaleDateString()}</span>
                        <Badge variant="outline" className="text-xs">
                          {messages.length} messages
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-600 italic">
                        Current conversation
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 italic p-3">
                    No conversation history yet
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Settings Footer */}
          <div className="border-t border-gray-200 p-3">
            <div className="flex flex-col space-y-1">
              <Popover open={aiSelectorOpen} onOpenChange={setAiSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="justify-start gap-2">
                    <Settings size={16} />
                    <span>AI Model Settings</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4" align="start">
                  <h3 className="text-sm font-medium mb-2">AI Model Settings</h3>
                  <AIModelSelector 
                    onSelectModel={(config) => {
                      setAIModelConfig(config);
                      setAiSelectorOpen(false);
                    }}
                    defaultProvider={aiModelConfig?.provider}
                    defaultModel={aiModelConfig?.modelName}
                  />
                </PopoverContent>
              </Popover>
              
              <Button variant="ghost" size="sm" className="justify-start gap-2">
                <i className="ri-organization-chart-line text-gray-600"></i>
                <span>Agent Organization</span>
              </Button>
              
              <Button variant="ghost" size="sm" className="justify-start gap-2">
                <i className="ri-task-line text-gray-600"></i>
                <span>View All Tasks</span>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-white">
          {/* Chat Header */}
          <div className="border-b border-gray-200 p-4 flex items-center justify-between">
            <div className="flex items-center">
              {!sidebarCollapsed && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="mr-2"
                  onClick={() => setSidebarCollapsed(true)}
                >
                  <i className="ri-menu-line"></i>
                </Button>
              )}
              <h1 className="font-medium text-lg">
                {agent ? agent.name : "Agent Chat"}
              </h1>
            </div>
            
            <div className="flex items-center gap-2">
              {aiModelConfig && (
                <Badge variant="outline" className="gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  {aiModelConfig.provider === "openai" ? "OpenAI" :
                   aiModelConfig.provider === "anthropic" ? "Claude" :
                   aiModelConfig.provider === "perplexity" ? "Perplexity" :
                   aiModelConfig.provider === "xai" ? "Grok" : 
                   aiModelConfig.provider}
                </Badge>
              )}
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  createTaskMutation.mutate({
                    title: "New task",
                    description: "Task suggested by agent"
                  });
                }}
              >
                <i className="ri-add-line mr-1"></i> Add Task
              </Button>
            </div>
          </div>
          
          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 md:px-8 space-y-8">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Bot size={32} className="text-primary" />
                </div>
                <h2 className="text-xl font-medium">Hello! I'm {agent?.name || "your AI assistant"}</h2>
                <p className="text-gray-500 max-w-md">
                  {agent?.instructions 
                    ? `I'm here to ${agent.instructions.toLowerCase().slice(0, 60)}...` 
                    : "How can I help you today? Feel free to ask me anything."}
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div 
                  key={message.id} 
                  className={cn(
                    "relative group max-w-3xl mx-auto",
                    message.role === "user" ? "text-right" : "border-l-4 border-l-primary/20 pl-4"
                  )}
                >
                  <div className="flex items-start">
                    {message.role !== "user" && (
                      <div className="w-9 h-9 flex-shrink-0 rounded-full bg-primary/20 mr-4 flex items-center justify-center">
                        <i className={cn(`${agent?.icon || "ri-robot-line"} text-primary`)}></i>
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <div className="mb-1 text-xs font-medium text-gray-500">
                        {message.role === "user" ? "You" : agent?.name || "Assistant"}
                      </div>
                      <div className={cn(
                        "prose prose-sm max-w-none",
                        message.role === "user" ? "text-left" : ""
                      )}>
                        {message.content}
                      </div>
                    </div>
                    
                    {message.role === "user" && (
                      <div className="w-9 h-9 flex-shrink-0 rounded-full bg-primary/20 ml-4 flex items-center justify-center">
                        <i className="ri-user-line text-primary"></i>
                      </div>
                    )}
                  </div>
                  
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-0 flex items-center space-x-2">
                    <Button variant="ghost" size="icon" className="w-7 h-7">
                      <Clipboard size={14} />
                    </Button>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input Area - ChatGPT style */}
          <div className="p-4 pb-8">
            <div className="mx-auto max-w-3xl">
              <form onSubmit={handleSendMessage} className="relative">
                <div className="border border-gray-300 rounded-xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:border-primary">
                  <div className="flex">
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={`Message ${agent?.name || "your agent"}...`}
                      disabled={isLoading}
                      className="border-0 rounded-none shadow-none focus-visible:ring-0 text-base py-6 min-h-[60px] max-h-[200px] resize-none"
                    />
                    <Button 
                      type="submit" 
                      disabled={isLoading || !message.trim()}
                      className="rounded-none bg-transparent hover:bg-transparent mr-2 self-end mb-2"
                      size="icon"
                    >
                      {isLoading ? (
                        <i className="ri-loader-4-line animate-spin text-primary"></i>
                      ) : (
                        <i className="ri-send-plane-fill text-primary hover:text-primary/80"></i>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex justify-center mt-2">
                  <p className="text-xs text-gray-500">
                    {agent?.name || "The agent"} helps with {agent?.role || "tasks"} based on current knowledge
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}