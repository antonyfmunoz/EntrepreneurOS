import { useQuery } from "@tanstack/react-query";

export type AIModelProvider = "openai" | "anthropic" | "perplexity" | "xai";
export type AIModelName = 
  | "gpt-4o" 
  | "gpt-4-turbo" 
  | "claude-3-7-sonnet-20250219"
  | "claude-3-opus-20240229"
  | "llama-3.1-sonar-small-128k-online"
  | "llama-3.1-sonar-large-128k-online"
  | "grok-2-1212"
  | "grok-2-vision-1212";

export interface AIModelConfig {
  provider: AIModelProvider;
  modelName: AIModelName;
  maxTokens?: number;
  temperature?: number;
}

export interface AIModelInfo {
  provider: AIModelProvider;
  models: {
    name: AIModelName;
    description: string;
    contextWindow: number;
    capabilities: string[];
  }[];
  isAvailable: boolean;
}

export function useAIModels() {
  const { 
    data: modelInfo, 
    isLoading, 
    error 
  } = useQuery<Record<AIModelProvider, AIModelInfo>>({
    queryKey: ["/api/ai/models"],
  });

  // Get available providers only
  const availableProviders = modelInfo 
    ? Object.entries(modelInfo)
      .filter(([_, info]) => info.isAvailable)
      .map(([key]) => key as AIModelProvider)
    : [];

  return {
    modelInfo,
    isLoading,
    error,
    availableProviders
  };
}

export function useAIGeneration() {
  const generateAIResponse = async (messages: any[], config: Partial<AIModelConfig> = {}) => {
    const response = await fetch("/api/ai/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        config,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to generate AI response");
    }

    const data = await response.json();
    return data.response;
  };

  return { generateAIResponse };
}