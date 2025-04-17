import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Bot, Save, ArrowLeft, Play } from "lucide-react";

type Agent = {
  id: string;
  name: string;
  role: string;
  icon: string;
  instructions: string;
};

type AgentProgrammingProps = {
  agentId?: string;
}

export default function AgentProgramming(props: AgentProgrammingProps) {
  const [_, navigate] = useLocation();
  const params = useParams();
  const { toast } = useToast();
  const agentId = props.agentId || params?.agentId || "";
  
  const [instructions, setInstructions] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [icon, setIcon] = useState("");
  
  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: [`/api/agents/${agentId}`],
    enabled: !!agentId,
  });
  
  useEffect(() => {
    if (agent) {
      setInstructions(agent.instructions || "");
      setName(agent.name || "");
      setRole(agent.role || "");
      setIcon(agent.icon || "ri-robot-line");
    }
  }, [agent]);
  
  const updateAgentMutation = useMutation({
    mutationFn: async (updatedAgent: Partial<Agent>) => {
      const res = await apiRequest("PATCH", `/api/agents/${agentId}`, updatedAgent);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
      toast({
        title: "Agent updated",
        description: "The agent has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating agent",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleSave = () => {
    updateAgentMutation.mutate({
      instructions,
      name,
      role,
      icon
    });
  };
  
  return (
    <Layout title={`Programming ${agent?.name || "Agent"}`}>
      <div className="flex items-center mb-8">
        <Button 
          variant="ghost" 
          size="icon" 
          className="mr-2"
          onClick={() => navigate(`/chat/${agentId}`)}
        >
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-2xl font-bold">Programming {agent?.name || "Agent"}</h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Tabs defaultValue="instructions" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="instructions">Instructions</TabsTrigger>
              <TabsTrigger value="brain">Knowledge</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="instructions" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Agent Instructions</h2>
                <Button 
                  onClick={handleSave} 
                  disabled={updateAgentMutation.isPending}
                  className="gap-2"
                >
                  <Save size={16} />
                  Save
                </Button>
              </div>
              <p className="text-gray-600 text-sm">
                Provide detailed instructions on how this agent should behave, what services it can access, and any specific knowledge it has.
              </p>
              <Textarea 
                value={instructions} 
                onChange={(e) => setInstructions(e.target.value)} 
                placeholder="Enter detailed instructions for the agent..."
                className="min-h-[300px] font-mono"
              />
              
              <div className="p-4 border rounded-md bg-gray-50">
                <h3 className="font-medium mb-2">Tips for Effective Instructions</h3>
                <ul className="list-disc pl-5 text-sm space-y-2">
                  <li>Begin with a clear description of the agent's role and purpose</li>
                  <li>Specify what types of tasks the agent should handle</li>
                  <li>Include any specific knowledge domains the agent should focus on</li>
                  <li>Set boundaries for what the agent should not do</li>
                  <li>Use clear, specific language to avoid ambiguity</li>
                </ul>
              </div>
            </TabsContent>
            
            <TabsContent value="brain" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Agent Knowledge</h2>
                <Button 
                  variant="outline" 
                  className="gap-2"
                >
                  <Play size={16} />
                  Test
                </Button>
              </div>
              <p className="text-gray-600 text-sm">
                Upload or reference knowledge sources that this agent can use to answer questions and perform tasks.
              </p>
              
              <Card className="p-6">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full mx-auto flex items-center justify-center">
                    <Bot size={32} className="text-primary" />
                  </div>
                  <h3 className="font-medium">Knowledge Base</h3>
                  <p className="text-sm text-gray-500">
                    Knowledge base functionality is coming soon. In the meantime, you can include specific knowledge in the agent instructions.
                  </p>
                  <Button variant="outline" disabled>Upload Knowledge</Button>
                </div>
              </Card>
            </TabsContent>
            
            <TabsContent value="settings" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Agent Settings</h2>
                <Button 
                  onClick={handleSave} 
                  disabled={updateAgentMutation.isPending}
                  className="gap-2"
                >
                  <Save size={16} />
                  Save
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Agent Name</label>
                  <Input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Executive Agent" 
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Agent Role</label>
                  <Input 
                    value={role} 
                    onChange={(e) => setRole(e.target.value)} 
                    placeholder="executive" 
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Agent Icon</label>
                  <div className="flex gap-2">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <i className={`${icon} text-primary text-lg`}></i>
                    </div>
                    <Input 
                      value={icon} 
                      onChange={(e) => setIcon(e.target.value)} 
                      placeholder="ri-robot-line" 
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Use Remix icon names (e.g., ri-robot-line, ri-admin-line)
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Agent Preview</h2>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <i className={`${icon || agent?.icon || "ri-robot-line"} text-primary text-xl`}></i>
              </div>
              <div>
                <div className="font-medium">{name || agent?.name || "Agent"}</div>
                <Badge variant="outline">{role || agent?.role || "Assistant"}</Badge>
              </div>
            </div>
            
            <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-3 bg-gray-50">
              {instructions ? 
                instructions.length > 200 ? instructions.substring(0, 200) + "..." : instructions 
                : agent?.instructions || "This agent will help you with tasks and answer questions."}
            </div>
          </Card>
          
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Tips & Help</h2>
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">💡 Instruction Tip:</span>{" "}
                The more specific your instructions, the better your agent will perform.
              </p>
              <p>
                <span className="font-medium">💡 Knowledge Tip:</span>{" "}
                You can reference external sources in the instructions for the agent to use.
              </p>
              <p>
                <span className="font-medium">💡 Role Definition:</span>{" "}
                Define clear boundaries for what this agent should and shouldn't do.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}