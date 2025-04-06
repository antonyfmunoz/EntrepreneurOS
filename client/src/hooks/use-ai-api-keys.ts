import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { AIModelProvider } from "./use-ai-models";

// Type definition for API key status response
export interface AIProviderKeyStatus {
  providerStatus: Record<AIModelProvider, boolean>;
}

// Custom hook to get AI provider API key status
export function useAIApiKeyStatus() {
  const { data, isLoading, error, refetch } = useQuery<AIProviderKeyStatus>({
    queryKey: ["/api/ai/provider-status"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: 1,
    refetchInterval: 60000, // Refetch every minute to check for newly added keys
  });
  
  return {
    providerStatus: data?.providerStatus || {
      openai: false,
      anthropic: false,
      perplexity: false,
      xai: false,
      gemini: false
    },
    isLoading,
    error,
    refetch
  };
}

// Request various AI provider API keys from the user
export function useRequestAIKeys() {
  const { providerStatus, refetch } = useAIApiKeyStatus();
  const [requiredKeys, setRequiredKeys] = useState<AIModelProvider[]>([]);
  
  // Function to request missing API keys for specific providers
  const requestKeys = async (providers: AIModelProvider[]) => {
    // Filter out providers that already have keys
    const missingProviders = providers.filter(provider => !providerStatus[provider]);
    
    if (missingProviders.length === 0) {
      return true;
    }
    
    setRequiredKeys(missingProviders);
    
    // Client code will handle showing a dialog to request keys
    return false;
  };
  
  // Generate an array of environment variable names based on provider
  const getKeyNames = (providers: AIModelProvider[]): string[] => {
    return providers.map(provider => {
      switch (provider) {
        case "openai": return "OPENAI_API_KEY";
        case "anthropic": return "ANTHROPIC_API_KEY";
        case "perplexity": return "PERPLEXITY_API_KEY";
        case "xai": return "XAI_API_KEY";
        case "gemini": return "GEMINI_API_KEY";
        default: return "";
      }
    }).filter(Boolean);
  };
  
  return {
    requiredKeys,
    requestKeys,
    getKeyNames,
    refetchStatus: refetch
  };
}