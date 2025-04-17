import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerTrigger, DrawerClose } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { sendMessageToAgent } from "@/lib/openai";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AIModelSelector } from "@/components/ai-model-selector";
import { AIModelConfig, AIModelProvider } from "@/hooks/use-ai-models";
import { useRequestAIKeys } from "@/hooks/use-ai-api-keys";
import { ApiKeyDialog } from "@/components/api-key-dialog";
import { cn } from "@/lib/utils";
import { Settings, Info, Clipboard, Bot, Sparkles, Trash2 } from "lucide-react";
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
  const [conversations, setConversations] = useState<{ id: string, title: string, messages: Message[] }[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
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
    onSuccess: (response) => {
      // Show toast notification when AI response is complete
      toast({
        title: `${agent?.name || "Agent"} responded`,
        description: response.substring(0, 60) + (response.length > 60 ? "..." : ""),
      });
      
      setMessage("");
      refetchMessages();
      setIsLoading(false);
    },
    onError: (error) => {
      // Only show toast for critical errors, not AI-related ones
      if (!error.message.includes("API") && !error.message.includes("AI")) {
        toast({
          title: "Error sending message",
          description: error.message,
          variant: "destructive",
        });
      }
      console.error("Message error:", error);
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
      // No toast for task creation
    },
  });

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Group messages into conversations
  useEffect(() => {
    if (agent) {
      if (messages.length > 0) {
        // For now, we'll create a simple structure with one conversation containing all messages
        // In a real app, these would be grouped by conversation ID from the server
        const currentConversation = {
          id: "current",
          title: `Today's Chat with ${agent?.name || "Agent"} - ${new Date().toLocaleDateString()}`,
          messages: messages
        };
        
        // For demonstration, create some "past" conversations by splitting messages
        // In a real app, these would come from the server
        const pastConversations = [];
        
        if (messages.length >= 4) {
          // Split into multiple conversations for demo purposes
          const firstConversation = {
            id: "past1",
            title: `Previous chat - ${new Date(Date.now() - 86400000).toLocaleDateString()}`,  // yesterday
            messages: messages.slice(0, 2)
          };
          pastConversations.push(firstConversation);
        }
        
        if (messages.length >= 8) {
          const secondConversation = {
            id: "past2",
            title: `Earlier chat - ${new Date(Date.now() - 172800000).toLocaleDateString()}`, // 2 days ago
            messages: messages.slice(0, 4)
          };
          pastConversations.push(secondConversation);
        }
        
        setConversations([currentConversation, ...pastConversations]);
        setActiveConversationId("current");
      } else {
        // If there are no messages, create an empty current conversation
        const emptyCurrentConversation = {
          id: "current",
          title: `Today's Chat with ${agent?.name || "Agent"} - ${new Date().toLocaleDateString()}`,
          messages: []
        };
        
        // Preserve existing conversations
        const pastConversations = conversations.filter(c => c.id !== "current");
        
        setConversations([emptyCurrentConversation, ...pastConversations]);
        setActiveConversationId("current");
      }
    }
  }, [messages, agent]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  // Handle opening a conversation
  const handleOpenConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    // In a real app, you would fetch the conversation's messages from the server here
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
            <div className="flex items-center w-full">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex justify-start items-center gap-2 w-full"
                onClick={async () => {
                  // First, update the UI immediately for a snappy experience
                  let updatedConversations = [];
                  
                  if (messages.length > 0) {
                    // Generate a unique ID for the current conversation moving to history
                    const pastConvId = `past_${Date.now()}`;
                    
                    // Create a history entry with the current messages
                    const pastConversation = {
                      id: pastConvId,
                      title: `Chat with ${agent?.name || "Agent"} - ${new Date().toLocaleDateString()}`,
                      messages: [...messages] // Store a copy of the current messages
                    };
                    
                    // Add all existing conversations except current to history
                    const existingHistory = conversations.filter(c => c.id !== "current");
                    
                    // Create a completely new empty conversation for "current"
                    updatedConversations = [
                      {
                        id: "current",
                        title: `Today's Chat with ${agent?.name || "Agent"} - ${new Date().toLocaleDateString()}`,
                        messages: [] // Empty message array
                      },
                      pastConversation, // Add the conversation we just completed
                      ...existingHistory // Add all other historical conversations
                    ];
                  } else {
                    // If there are no messages, just create a fresh current conversation
                    updatedConversations = [
                      {
                        id: "current",
                        title: `Today's Chat with ${agent?.name || "Agent"} - ${new Date().toLocaleDateString()}`,
                        messages: [] // Empty message array
                      },
                      ...conversations.filter(c => c.id !== "current") // Keep all existing history
                    ];
                  }
                  
                  // Update conversations state with our new array
                  setConversations(updatedConversations);
                  
                  // Set active conversation to the new empty one
                  setActiveConversationId("current");
                  
                  // Clear input field
                  setMessage("");
                  
                  // Don't show toast for new chat operations
                  // Silently start a new conversation
                  
                  // Scroll to bottom
                  scrollToBottom();
                  
                  // Then handle the server communication silently in the background
                  try {
                    // Clear the server-side messages
                    await apiRequest("POST", `/api/agents/${agentId}/clear-messages`);
                    
                    // Clear the messages in the React Query cache
                    queryClient.setQueryData([`/api/agents/${agentId}/messages`], []);
                    
                    // Refetch messages to ensure UI and database are in sync
                    refetchMessages();
                  } catch (error) {
                    // Just log the error but don't show a toast - the UI is already updated
                    console.log("Background operation failed, but UI is already updated");
                  }
                }}
              >
                <Bot size={16} />
                <span className="text-sm font-medium">New Chat</span>
              </Button>
            </div>
            <Drawer>
              <DrawerTrigger asChild>
                <span className="hidden">Hidden Trigger</span>
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
            {/* All Agents */}
            <div className="px-3 py-2">
              <h3 className="text-xs font-medium text-gray-500 mb-2">YOUR AGENTS</h3>
              <div className="space-y-1">
                {agents.map((agentItem) => (
                  <Link key={agentItem.id} href={`/chat/${agentItem.id}`}>
                    <div className={cn(
                      "flex items-center gap-3 p-3 rounded-md cursor-pointer",
                      agentId === agentItem.id ? "bg-primary/10 text-primary" : "hover:bg-gray-100 text-gray-700"
                    )}>
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <i className={agentItem.icon || "ri-robot-line"}></i>
                      </div>
                      <div className="flex-1 truncate">
                        <div className="text-sm font-medium">{agentItem.name}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {agentItem.role}
                        </div>
                      </div>
                      {agentItem.id === "agent_executive" && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 rounded-full ml-1"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                            >
                              <Info size={14} />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogTitle>Executive Agent</DialogTitle>
                            <DialogDescription>
                              Your Executive Agent leads and coordinates your AI teams.
                            </DialogDescription>
                            
                            <div className="flex items-center mb-4 mt-2">
                              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mr-4">
                                <i className={`${agentItem.icon || "ri-robot-line"} text-primary text-xl`}></i>
                              </div>
                              <div>
                                <h3 className="font-semibold text-base">{agentItem.name}</h3>
                                <Badge variant="outline">{agentItem.role}</Badge>
                              </div>
                            </div>
                            
                            <div className="border rounded-md p-4 mb-4">
                              <h4 className="text-sm font-medium mb-2">Agent Description</h4>
                              <p className="text-sm text-gray-600">
                                {agentItem.instructions || "This agent will help you build and manage your AI team. It can create agents, assign tasks, and coordinate between different agents."}
                              </p>
                            </div>
                            
                            <div className="flex justify-end">
                              <Button
                                variant="default"
                                className="gap-2"
                                onClick={() => {
                                  window.location.href = `/agent/${agentItem.id}/program`;
                                }}
                              >
                                <Settings size={16} />
                                Program Agent
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            
            {/* Current Conversation */}
            <div className="px-3 py-2">
              <h3 className="text-xs font-medium text-gray-500 mb-2">CURRENT CHAT</h3>
              <div className="space-y-1">
                {/* Active Conversation */}
                {conversations.length > 0 && (
                  <div 
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-md cursor-pointer",
                      activeConversationId === "current" ? "bg-primary/10 text-primary" : "hover:bg-gray-100 text-gray-700"
                    )}
                    onClick={() => handleOpenConversation("current")}
                  >
                    <Bot size={18} />
                    <div className="flex-1 truncate">
                      <div className="text-sm font-medium">Current Chat</div>
                      <div className="text-xs text-gray-500 truncate">
                        {messages.length > 0 
                          ? messages[messages.length - 1].content.slice(0, 30) + "..." 
                          : "Start a new conversation"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
          {/* Previous conversations */}
            <div className="px-3 py-2">
              <h3 className="text-xs font-medium text-gray-500 mb-2">CONVERSATION HISTORY</h3>
              <div className="space-y-1">
                {conversations.length > 1 ? (
                  // Show past conversations (skip the current one, which is at index 0)
                  conversations.slice(1).map((conversation) => (
                    <div 
                      key={conversation.id}
                      className={cn(
                        "text-xs p-3 rounded-md cursor-pointer transition-colors",
                        activeConversationId === conversation.id ? "bg-primary/10 text-primary" : "hover:bg-gray-100 text-gray-700"
                      )}
                      onClick={() => handleOpenConversation(conversation.id)}
                    >
                      <div className="flex flex-col gap-2 mt-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className={cn(
                            "text-gray-500",
                            activeConversationId === conversation.id ? "text-primary/80" : ""
                          )}>
                            {conversation.title.split(' - ')[1]} {/* Just the date part */}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 rounded-sm p-0"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent opening the conversation
                              
                              // Remove this conversation from history
                              const updatedConversations = conversations.filter(c => c.id !== conversation.id);
                              setConversations(updatedConversations);
                              
                              // If this was the active conversation, switch to current
                              if (activeConversationId === conversation.id) {
                                setActiveConversationId("current");
                              }
                              
                              // No toast for conversation deletion
                            }}
                          >
                            <Trash2 size={10} className="text-gray-400 hover:text-red-500" />
                          </Button>
                        </div>
                        <div className={cn(
                          "text-xs",
                          activeConversationId === conversation.id ? "text-primary/80" : "text-gray-600"
                        )}>
                          {conversation.messages[0].content.substring(0, 40)}...
                        </div>
                      </div>
                    </div>
                  ))
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
              <div>
                <h1 className="font-medium text-lg">
                  {agent ? agent.name : "Agent Chat"}
                </h1>
                {activeConversationId !== "current" && conversations.find(c => c.id === activeConversationId) && (
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <i className="ri-history-line"></i>
                    Viewing: {conversations.find(c => c.id === activeConversationId)?.title || "Past Conversation"}
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="h-auto p-0 text-xs text-primary" 
                      onClick={() => handleOpenConversation("current")}
                    >
                      Return to current chat
                    </Button>
                  </div>
                )}
              </div>
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
              // Show messages from the active conversation
              (activeConversationId === "current" ? messages : 
                conversations.find(c => c.id === activeConversationId)?.messages || messages)
                .map((message) => (
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
                      placeholder={activeConversationId !== "current" 
                        ? "Viewing past conversation... Return to current chat to send messages" 
                        : `Message ${agent?.name || "your agent"}...`}
                      disabled={isLoading || activeConversationId !== "current"}
                      className="border-0 rounded-none shadow-none focus-visible:ring-0 text-base py-6 min-h-[60px] max-h-[200px] resize-none"
                    />
                    <Button 
                      type="submit" 
                      disabled={isLoading || !message.trim() || activeConversationId !== "current"}
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