import { OpenAIService } from "./openai-service";
import { AnthropicService } from "./anthropic-service";
import { PerplexityService } from "./perplexity-service";
import { XAIService } from "./xai-service";
import { AgentBrain } from "../openai";

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

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIServiceInterface {
  isAvailable(): boolean;
  generateResponse(messages: AIMessage[], config?: Partial<AIModelConfig>): Promise<string>;
  generateImage?(prompt: string): Promise<string>;
  analyzeImage?(base64Image: string, prompt: string): Promise<string>;
}

// Default configurations for each provider
const defaultConfigs: Record<AIModelProvider, AIModelConfig> = {
  openai: {
    provider: "openai",
    modelName: "gpt-4o",
    maxTokens: 1000,
    temperature: 0.7
  },
  anthropic: {
    provider: "anthropic",
    modelName: "claude-3-7-sonnet-20250219",
    maxTokens: 1000,
    temperature: 0.7
  },
  perplexity: {
    provider: "perplexity",
    modelName: "llama-3.1-sonar-small-128k-online",
    maxTokens: 1000,
    temperature: 0.7
  },
  xai: {
    provider: "xai",
    modelName: "grok-2-1212",
    maxTokens: 1000,
    temperature: 0.7
  }
};

// Singleton services
let openAIService: OpenAIService | null = null;
let anthropicService: AnthropicService | null = null;
let perplexityService: PerplexityService | null = null;
let xaiService: XAIService | null = null;

// Helper to get the appropriate service
function getService(provider: AIModelProvider): AIServiceInterface | null {
  switch (provider) {
    case "openai":
      if (!openAIService) {
        openAIService = new OpenAIService();
      }
      return openAIService;
    case "anthropic":
      if (!anthropicService) {
        anthropicService = new AnthropicService();
      }
      return anthropicService;
    case "perplexity":
      if (!perplexityService) {
        perplexityService = new PerplexityService();
      }
      return perplexityService;
    case "xai":
      if (!xaiService) {
        xaiService = new XAIService();
      }
      return xaiService;
    default:
      return null;
  }
}

// Get available AI providers
export function getAvailableProviders(): AIModelProvider[] {
  const providers: AIModelProvider[] = [];
  
  if (new OpenAIService().isAvailable()) {
    providers.push("openai");
  }
  
  if (new AnthropicService().isAvailable()) {
    providers.push("anthropic");
  }
  
  if (new PerplexityService().isAvailable()) {
    providers.push("perplexity");
  }
  
  if (new XAIService().isAvailable()) {
    providers.push("xai");
  }
  
  return providers;
}

// Generate a response using a specific provider and model
export async function generateAIResponse(
  messages: AIMessage[],
  config: Partial<AIModelConfig> = {}
): Promise<string> {
  const provider = config.provider || "openai";
  const service = getService(provider);
  
  if (!service || !service.isAvailable()) {
    throw new Error(`AI provider ${provider} is not available or properly configured`);
  }
  
  const fullConfig = {
    ...defaultConfigs[provider],
    ...config
  };
  
  return await service.generateResponse(messages, fullConfig);
}

// Agent-specific helper method
export async function generateAgentResponse(
  messages: AIMessage[],
  brain: AgentBrain,
  config: Partial<AIModelConfig> = {}
): Promise<string> {
  // Add system message with agent instructions
  const systemMessage: AIMessage = {
    role: "system",
    content: `You are ${brain.name}, ${brain.role}. ${brain.instructions}`
  };
  
  if (brain.knowledgeBase) {
    systemMessage.content += `\n\nYou have the following knowledge base:\n${brain.knowledgeBase}`;
  }
  
  const allMessages = [systemMessage, ...messages];
  
  return await generateAIResponse(allMessages, config);
}

// Generate an image using a provider that supports it
export async function generateImage(
  prompt: string,
  provider: AIModelProvider = "openai"
): Promise<string> {
  const service = getService(provider);
  
  if (!service || !service.isAvailable() || !service.generateImage) {
    throw new Error(`Image generation not available with provider ${provider}`);
  }
  
  return await service.generateImage(prompt);
}

// Analyze an image using a provider that supports it
export async function analyzeImage(
  base64Image: string,
  prompt: string,
  provider: AIModelProvider = "openai"
): Promise<string> {
  const service = getService(provider);
  
  if (!service || !service.isAvailable() || !service.analyzeImage) {
    throw new Error(`Image analysis not available with provider ${provider}`);
  }
  
  return await service.analyzeImage(base64Image, prompt);
}

// Get model information
export function getModelInfo(): {
  providers: AIModelProvider[];
  availableModels: Record<AIModelProvider, AIModelName[]>;
} {
  const providers = getAvailableProviders();
  
  const availableModels: Record<AIModelProvider, AIModelName[]> = {
    openai: ["gpt-4o", "gpt-4-turbo"],
    anthropic: ["claude-3-7-sonnet-20250219", "claude-3-opus-20240229"],
    perplexity: ["llama-3.1-sonar-small-128k-online", "llama-3.1-sonar-large-128k-online"],
    xai: ["grok-2-1212", "grok-2-vision-1212"]
  };
  
  return { providers, availableModels };
}