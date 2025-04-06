import { useState } from "react";
import { AIModelConfig, AIModelProvider, AIModelName, useAIModels } from "@/hooks/use-ai-models";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AIModelSelectorProps {
  onSelectModel: (config: AIModelConfig | null) => void;
  defaultProvider?: AIModelProvider;
  defaultModel?: AIModelName;
}

export function AIModelSelector({ 
  onSelectModel, 
  defaultProvider,
  defaultModel
}: AIModelSelectorProps) {
  const { modelInfo, isLoading, availableProviders } = useAIModels();
  
  // Default to the first available provider if none is specified
  const initialProvider = defaultProvider && availableProviders.includes(defaultProvider)
    ? defaultProvider
    : availableProviders[0];
  
  const [selectedProvider, setSelectedProvider] = useState<AIModelProvider | undefined>(initialProvider);
  const [selectedModel, setSelectedModel] = useState<AIModelName | undefined>(defaultModel);
  const [temperature, setTemperature] = useState(0.7);
  
  // If no model info is available, don't show the selector
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!modelInfo || availableProviders.length === 0) {
    return (
      <Card className="bg-red-50 border-red-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-red-700">No AI Models Available</CardTitle>
          <CardDescription className="text-red-600">
            No API keys have been configured. Please add API keys for at least one AI provider in your environment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-slate-50 text-slate-700">OpenAI API</Badge>
            <Badge variant="outline" className="bg-slate-50 text-slate-700">Anthropic Claude</Badge>
            <Badge variant="outline" className="bg-slate-50 text-slate-700">Perplexity</Badge>
            <Badge variant="outline" className="bg-slate-50 text-slate-700">xAI</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get models for the selected provider
  const providerModels = selectedProvider && modelInfo[selectedProvider]?.models || [];
  
  // Ensure selected model is from the current provider
  const validModel = selectedModel && providerModels.some(m => m.name === selectedModel)
    ? selectedModel
    : undefined;

  const handleProviderChange = (provider: AIModelProvider) => {
    setSelectedProvider(provider);
    // Reset model selection when provider changes
    setSelectedModel(undefined);
    
    // If we don't have a valid model, don't emit an update
    if (!provider) {
      onSelectModel(null);
      return;
    }
  };

  const handleModelChange = (model: AIModelName) => {
    setSelectedModel(model);
    
    if (selectedProvider && model) {
      onSelectModel({
        provider: selectedProvider,
        modelName: model,
        temperature,
      });
    } else {
      onSelectModel(null);
    }
  };

  const handleTemperatureChange = (value: number[]) => {
    const newTemp = value[0];
    setTemperature(newTemp);
    
    if (selectedProvider && selectedModel) {
      onSelectModel({
        provider: selectedProvider,
        modelName: selectedModel,
        temperature: newTemp,
      });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>AI Model Selection</CardTitle>
        <CardDescription>
          Choose which AI model to use for this agent
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="provider">AI Provider</Label>
          <Select 
            value={selectedProvider} 
            onValueChange={(value) => handleProviderChange(value as AIModelProvider)}
          >
            <SelectTrigger id="provider">
              <SelectValue placeholder="Select an AI provider" />
            </SelectTrigger>
            <SelectContent>
              {availableProviders.map(provider => (
                <SelectItem key={provider} value={provider}>
                  {provider === 'openai' ? 'OpenAI' :
                   provider === 'anthropic' ? 'Anthropic Claude' :
                   provider === 'perplexity' ? 'Perplexity AI' :
                   provider === 'xai' ? 'xAI Grok' : provider}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedProvider && (
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select 
              value={validModel} 
              onValueChange={(value) => handleModelChange(value as AIModelName)}
            >
              <SelectTrigger id="model">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {providerModels.map(model => (
                  <SelectItem key={model.name} value={model.name}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {validModel && (
              <div className="pt-2 text-sm text-muted-foreground">
                {providerModels.find(m => m.name === validModel)?.description}
              </div>
            )}
          </div>
        )}

        {selectedProvider && selectedModel && (
          <div className="space-y-2 pt-2">
            <div className="flex justify-between">
              <Label htmlFor="temperature">Temperature: {temperature.toFixed(1)}</Label>
            </div>
            <Slider
              id="temperature"
              min={0}
              max={1}
              step={0.1}
              value={[temperature]}
              onValueChange={handleTemperatureChange}
              className={cn(
                "w-full",
                temperature < 0.3 ? "accent-blue-500" :
                temperature < 0.7 ? "accent-green-500" :
                "accent-orange-500"
              )}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Deterministic</span>
              <span>Balanced</span>
              <span>Creative</span>
            </div>
          </div>
        )}
        
        {validModel && (
          <div className="pt-2">
            <h4 className="text-sm font-medium mb-2">Capabilities:</h4>
            <div className="flex flex-wrap gap-2">
              {providerModels.find(m => m.name === validModel)?.capabilities.map((capability, i) => (
                <Badge key={i} variant="secondary">{capability}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}