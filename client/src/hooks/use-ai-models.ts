import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

// API response type from server
interface AIModelResponse {
  providers: {
    provider: AIModelProvider;
    models: {
      name: AIModelName;
      description: string;
      contextWindow: number;
      capabilities: string[];
    }[];
    isAvailable: boolean;
  }[];
}

export type AIModelProvider = "openai" | "anthropic" | "perplexity" | "xai" | "gemini";
export type AIModelName = 
  | "gpt-4o" 
  | "gpt-4-turbo" 
  | "claude-3-7-sonnet-20250219"
  | "claude-3-opus-20240229"
  | "llama-3.1-sonar-small-128k-online"
  | "llama-3.1-sonar-large-128k-online"
  | "grok-2-1212"
  | "grok-2-vision-1212"
  | "gemini-2.5-pro"
  | "gemini-2.5-pro-vision";

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

// Mock data for AI models when API is not available
const mockAIModels: AIModelInfo[] = [
  {
    provider: "openai",
    models: [
      {
        name: "gpt-4o",
        description: "Latest multimodal model with enhanced reasoning",
        contextWindow: 128000,
        capabilities: ["Text generation", "Image understanding", "Advanced reasoning"],
      },
      {
        name: "gpt-4-turbo",
        description: "Fast and efficient general purpose model",
        contextWindow: 128000,
        capabilities: ["Text generation", "Summarization", "Content creation"],
      }
    ],
    isAvailable: false,
  },
  {
    provider: "anthropic",
    models: [
      {
        name: "claude-3-7-sonnet-20250219",
        description: "Latest balanced model for most tasks",
        contextWindow: 200000,
        capabilities: ["Text generation", "Complex reasoning", "Content creation"],
      },
      {
        name: "claude-3-opus-20240229",
        description: "Most powerful model for complex tasks",
        contextWindow: 200000,
        capabilities: ["Advanced reasoning", "Long-form content", "Code generation"],
      }
    ],
    isAvailable: false,
  },
  {
    provider: "perplexity",
    models: [
      {
        name: "llama-3.1-sonar-small-128k-online",
        description: "Efficient model with internet access",
        contextWindow: 128000,
        capabilities: ["Text generation", "Internet search", "Real-time information"],
      },
      {
        name: "llama-3.1-sonar-large-128k-online",
        description: "Larger model with advanced capabilities",
        contextWindow: 128000,
        capabilities: ["Advanced reasoning", "Internet search", "Long-form content"],
      }
    ],
    isAvailable: false,
  },
  {
    provider: "xai",
    models: [
      {
        name: "grok-2-1212",
        description: "General purpose text model",
        contextWindow: 131072,
        capabilities: ["Text generation", "Code generation", "Problem solving"],
      },
      {
        name: "grok-2-vision-1212",
        description: "Multimodal model for text and images",
        contextWindow: 8192,
        capabilities: ["Text generation", "Image understanding", "Visual reasoning"],
      }
    ],
    isAvailable: false,
  }
];

export function useAIModels() {
  const { data, isLoading, error } = useQuery<AIModelResponse>({
    queryKey: ["/api/ai/models"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: 1,
    // If API fails, use mock data
    placeholderData: { providers: mockAIModels },
  });
  
  return {
    availableModels: data?.providers || mockAIModels,
    isLoading,
    error,
  };
}

export function useAIGeneration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const generateText = async (
    messages: Array<{role: "system" | "user" | "assistant"; content: string}>,
    config: AIModelConfig
  ) => {
    setLoading(true);
    setError(null);
    
    try {
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
        throw new Error(`Error generating text: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.response; // Updated to match server response structure
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  return {
    generateText,
    loading,
    error,
  };
}