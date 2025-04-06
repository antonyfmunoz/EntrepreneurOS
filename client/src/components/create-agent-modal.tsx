import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const agentIcons = [
  { icon: "ri-megaphone-line", label: "Marketing" },
  { icon: "ri-customer-service-2-line", label: "Support" },
  { icon: "ri-article-line", label: "Content" },
  { icon: "ri-user-settings-line", label: "Operations" },
  { icon: "ri-line-chart-line", label: "Analytics" },
  { icon: "ri-team-line", label: "Team" },
];

export function CreateAgentModal({ isOpen, onClose }: CreateAgentModalProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [selectedIcon, setSelectedIcon] = useState(0);
  const [notionLink, setNotionLink] = useState("");
  const [instructions, setInstructions] = useState("");
  const { toast } = useToast();

  const createAgentMutation = useMutation({
    mutationFn: async (agentData: any) => {
      const res = await apiRequest("POST", "/api/agents", agentData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Agent created",
        description: `${name} has been created successfully.`,
      });
      resetForm();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Failed to create agent",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setName("");
    setRole("");
    setSelectedIcon(0);
    setNotionLink("");
    setInstructions("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !role) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    createAgentMutation.mutate({
      name,
      role,
      icon: agentIcons[selectedIcon].icon,
      brainSources: [
        ...(notionLink ? [{ type: "notion", url: notionLink }] : []),
      ],
      instructions,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-800">Create New Agent</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div>
              <label htmlFor="agentName" className="block text-sm font-medium text-gray-700 mb-1">
                Agent Name
              </label>
              <Input
                id="agentName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Marketing Specialist"
              />
            </div>
            
            <div>
              <label htmlFor="agentRole" className="block text-sm font-medium text-gray-700 mb-1">
                Agent Role
              </label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="support">Customer Support</SelectItem>
                  <SelectItem value="content">Content Creation</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="custom">Custom Role...</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Agent Icon
              </label>
              <div className="grid grid-cols-6 gap-2">
                {agentIcons.map((icon, index) => (
                  <div
                    key={index}
                    className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer border-2 transition-colors ${
                      selectedIcon === index
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                    }`}
                    onClick={() => setSelectedIcon(index)}
                    title={icon.label}
                  >
                    <i className={icon.icon}></i>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload Agent Brain
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-md p-4">
                <div className="flex flex-col items-center justify-center">
                  <i className="ri-upload-cloud-2-line text-gray-400 text-3xl mb-2"></i>
                  <p className="text-sm text-gray-500 mb-1">Drag and drop files here, or</p>
                  <Button type="button" variant="link" className="text-primary hover:text-blue-700 text-sm font-medium">
                    browse files
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">Upload text files, PDFs, or provide a Notion link</p>
                </div>
              </div>
            </div>
            
            <div>
              <label htmlFor="notionLink" className="block text-sm font-medium text-gray-700 mb-1">
                Notion Link (Optional)
              </label>
              <Input
                id="notionLink"
                value={notionLink}
                onChange={(e) => setNotionLink(e.target.value)}
                placeholder="e.g. https://notion.so/workspace/page"
              />
            </div>
            
            <div>
              <label htmlFor="agentInstructions" className="block text-sm font-medium text-gray-700 mb-1">
                Agent Instructions
              </label>
              <Textarea
                id="agentInstructions"
                rows={4}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Describe what this agent should do and any specific instructions..."
              />
            </div>
          </div>
          
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createAgentMutation.isPending}
              className="bg-primary hover:bg-blue-600"
            >
              {createAgentMutation.isPending ? "Creating..." : "Create Agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
