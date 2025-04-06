import React, { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AIModelProvider } from "@/hooks/use-ai-models";
import { useToast } from "@/hooks/use-toast";
import { useRequestAIKeys } from "@/hooks/use-ai-api-keys";

interface ApiKeyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  providers: AIModelProvider[];
}

export function ApiKeyDialog({ isOpen, onClose, providers }: ApiKeyDialogProps) {
  const { getKeyNames, refetchStatus } = useRequestAIKeys();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Get all environment variable names for the required providers
  const keyNames = getKeyNames(providers);
  
  const handleInputChange = (keyName: string, value: string) => {
    setApiKeys(prev => ({
      ...prev,
      [keyName]: value
    }));
  };
  
  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // Submit keys one by one
      for (const keyName of keyNames) {
        if (!apiKeys[keyName]) continue;
        
        // Send the key to the backend
        const response = await fetch("/api/keys/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            keyName,
            value: apiKeys[keyName]
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to save ${keyName}`);
        }
      }
      
      // Success notification
      toast({
        title: "API keys saved",
        description: "Your API keys have been saved successfully. You can now use the selected AI providers.",
      });
      
      // Refresh provider status
      await refetchStatus();
      
      // Close dialog
      onClose();
    } catch (error) {
      toast({
        title: "Error saving API keys",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get provider names in a more readable format
  const getProviderName = (provider: AIModelProvider): string => {
    switch (provider) {
      case "openai": return "OpenAI";
      case "anthropic": return "Anthropic (Claude)";
      case "perplexity": return "Perplexity AI";
      case "xai": return "xAI (Grok)";
      case "gemini": return "Google Gemini";
      default: return provider;
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add AI Provider API Keys</DialogTitle>
          <DialogDescription>
            Enter your API keys for the selected AI providers to enable their usage in the application.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {providers.map(provider => {
            const keyName = getKeyNames([provider])[0];
            
            return (
              <div className="grid grid-cols-4 items-center gap-4" key={provider}>
                <Label htmlFor={keyName} className="text-right">
                  {getProviderName(provider)}
                </Label>
                <Input
                  id={keyName}
                  type="password"
                  placeholder={`Enter ${keyName}`}
                  className="col-span-3"
                  value={apiKeys[keyName] || ""}
                  onChange={(e) => handleInputChange(keyName, e.target.value)}
                />
              </div>
            );
          })}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save API Keys"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}