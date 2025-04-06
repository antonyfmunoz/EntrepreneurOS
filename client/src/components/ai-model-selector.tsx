import { useState, useEffect } from "react";
import { useAIModels, type AIModelProvider, type AIModelName, type AIModelInfo } from "@/hooks/use-ai-models";
import { useAIApiKeyStatus, useRequestAIKeys } from "@/hooks/use-ai-api-keys";
import { ApiKeyDialog } from "@/components/api-key-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AIModelConfig {
  provider: AIModelProvider;
  modelName: AIModelName;
  maxTokens?: number;
  temperature?: number;
}

interface AIModelSelectorProps {
  onSelectModel: (config: AIModelConfig | null) => void;
  defaultProvider?: AIModelProvider;
  defaultModel?: AIModelName;
}

export function AIModelSelector({ 
  onSelectModel,
  defaultProvider = "openai",
  defaultModel = "gpt-4o"
}: AIModelSelectorProps) {
  const { availableModels, isLoading } = useAIModels();
  const [selectedProvider, setSelectedProvider] = useState<AIModelProvider>(defaultProvider);
  const [selectedModel, setSelectedModel] = useState<AIModelName | null>(defaultModel);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(1000);
  
  // API Key management
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const { requiredKeys, requestKeys } = useRequestAIKeys();
  
  // Get models for current provider
  const currentProviderModels = availableModels.find((p: AIModelInfo) => p.provider === selectedProvider);
  const isProviderAvailable = currentProviderModels?.isAvailable || false;
  
  // Set up the config object for the parent component
  useEffect(() => {
    if (selectedProvider && selectedModel && isProviderAvailable) {
      onSelectModel({
        provider: selectedProvider,
        modelName: selectedModel,
        temperature,
        maxTokens,
      });
    } else {
      onSelectModel(null);
    }
  }, [selectedProvider, selectedModel, temperature, maxTokens, isProviderAvailable, onSelectModel]);
  
  // If the selected model is not available for the selected provider, reset it
  useEffect(() => {
    if (!currentProviderModels?.models.some((m: { name: AIModelName }) => m.name === selectedModel)) {
      // Select the first available model in the provider
      const defaultModel = currentProviderModels?.models[0]?.name;
      setSelectedModel(defaultModel || null);
    }
  }, [selectedProvider, currentProviderModels, selectedModel]);
  
  const handleProviderChange = (provider: AIModelProvider) => {
    setSelectedProvider(provider);
  };
  
  const handleModelChange = (model: AIModelName) => {
    setSelectedModel(model);
  };
  
  if (isLoading) {
    return <div className="text-center py-4">Loading available AI models...</div>;
  }
  
  return (
    <div className="space-y-6">
      {/* AI Provider Selection */}
      <div>
        <h4 className="text-sm font-medium mb-3">1. Select AI Provider</h4>
        <Tabs 
          value={selectedProvider} 
          onValueChange={(value) => handleProviderChange(value as AIModelProvider)}
          className="w-full"
        >
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger 
              value="openai" 
              disabled={!availableModels.find((p: AIModelInfo) => p.provider === "openai")?.isAvailable}
              className="relative"
            >
              <span className="flex items-center">
                OpenAI
                {!availableModels.find((p: AIModelInfo) => p.provider === "openai")?.isAvailable && (
                  <Badge variant="outline" className="ml-2 text-xs">API Key Required</Badge>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger 
              value="anthropic" 
              disabled={!availableModels.find((p: AIModelInfo) => p.provider === "anthropic")?.isAvailable}
            >
              <span className="flex items-center">
                Anthropic
                {!availableModels.find((p: AIModelInfo) => p.provider === "anthropic")?.isAvailable && (
                  <Badge variant="outline" className="ml-2 text-xs">API Key Required</Badge>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger 
              value="perplexity" 
              disabled={!availableModels.find((p: AIModelInfo) => p.provider === "perplexity")?.isAvailable}
            >
              <span className="flex items-center">
                Perplexity
                {!availableModels.find((p: AIModelInfo) => p.provider === "perplexity")?.isAvailable && (
                  <Badge variant="outline" className="ml-2 text-xs">API Key Required</Badge>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger 
              value="xai" 
              disabled={!availableModels.find((p: AIModelInfo) => p.provider === "xai")?.isAvailable}
            >
              <span className="flex items-center">
                xAI (Grok)
                {!availableModels.find((p: AIModelInfo) => p.provider === "xai")?.isAvailable && (
                  <Badge variant="outline" className="ml-2 text-xs">API Key Required</Badge>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger 
              value="gemini" 
              disabled={!availableModels.find((p: AIModelInfo) => p.provider === "gemini")?.isAvailable}
            >
              <span className="flex items-center">
                Gemini
                {!availableModels.find((p: AIModelInfo) => p.provider === "gemini")?.isAvailable && (
                  <Badge variant="outline" className="ml-2 text-xs">API Key Required</Badge>
                )}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Model Selection */}
      <div>
        <h4 className="text-sm font-medium mb-3">2. Select Model</h4>
        
        {!isProviderAvailable ? (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4">
            <h4 className="text-amber-800 font-medium">API Key Required</h4>
            <p className="text-amber-700 text-sm mt-1">
              This AI provider requires an API key to function. Add your API key to enable this provider.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 bg-white hover:bg-white border-amber-200 text-amber-800"
              onClick={() => {
                requestKeys([selectedProvider]).then(success => {
                  if (!success) {
                    setIsApiKeyDialogOpen(true);
                  }
                });
              }}
            >
              Add API Key
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {currentProviderModels?.models.map((model: {
              name: AIModelName;
              description: string;
              contextWindow: number;
              capabilities: string[];
            }) => (
              <Card 
                key={model.name}
                className={cn(
                  "cursor-pointer hover:border-primary/50 transition-colors",
                  selectedModel === model.name ? "border-primary" : ""
                )}
                onClick={() => handleModelChange(model.name)}
              >
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    {model.name}
                    {selectedModel === model.name && (
                      <Badge variant="default" className="ml-2">Selected</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Context: {model.contextWindow} tokens
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-gray-600 mb-2">{model.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {model.capabilities.map((capability, idx) => (
                      <Badge 
                        key={idx} 
                        variant="outline" 
                        className="text-xs px-2 py-0 h-5"
                      >
                        {capability === "Text generation" && "💬"}
                        {capability === "Image understanding" && "🖼️"}
                        {capability === "Advanced reasoning" && "🧠"}
                        {capability === "Complex reasoning" && "🧠"}
                        {capability === "Content creation" && "✍️"}
                        {capability === "Summarization" && "📝"}
                        {capability === "Code generation" && "👨‍💻"}
                        {capability === "Long-form content" && "📄"}
                        {capability === "Internet search" && "🔍"}
                        {capability === "Real-time information" && "⏱️"}
                        {capability === "Problem solving" && "🔧"}
                        {capability === "Visual reasoning" && "👁️"}
                        {capability === "Creative writing" && "✨"}
                        {" " + capability}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      {/* Advanced Parameters (only if provider is available) */}
      {isProviderAvailable && (
        <div>
          <Separator className="my-4" />
          <h4 className="text-sm font-medium mb-3">3. Advanced Parameters</h4>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="temperature">Temperature: {temperature}</Label>
                <span className="text-xs text-gray-500">Controls randomness</span>
              </div>
              <Slider
                id="temperature"
                min={0}
                max={1}
                step={0.1}
                value={[temperature]}
                onValueChange={(value) => setTemperature(value[0])}
              />
              <div className="flex justify-between text-xs mt-1 text-gray-500">
                <span>More precise (0)</span>
                <span>More creative (1)</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="max-tokens">Max Tokens: {maxTokens}</Label>
                <span className="text-xs text-gray-500">Response length</span>
              </div>
              <Slider
                id="max-tokens"
                min={100}
                max={4000}
                step={100}
                value={[maxTokens]}
                onValueChange={(value) => setMaxTokens(value[0])}
              />
              <div className="flex justify-between text-xs mt-1 text-gray-500">
                <span>Shorter (100)</span>
                <span>Longer (4000)</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* API Key Dialog */}
      <ApiKeyDialog 
        isOpen={isApiKeyDialogOpen}
        onClose={() => setIsApiKeyDialogOpen(false)}
        providers={requiredKeys.length > 0 ? requiredKeys : [selectedProvider]}
      />
    </div>
  );
}