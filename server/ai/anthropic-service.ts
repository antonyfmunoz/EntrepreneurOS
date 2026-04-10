import Anthropic from "@anthropic-ai/sdk";
import { AIServiceInterface, AIMessage, AIModelConfig } from "./index.js";
import { callAI, type ModelTier } from "./gateway.js";

const COMPLEXITY_KEYWORDS = [
  "analyze", "analysis", "explain in detail", "compare", "evaluate",
  "debug", "refactor", "architect", "design", "strategy", "plan",
  "complex", "comprehensive", "in-depth", "thorough", "detailed",
  "write code", "generate code", "implement", "build", "create a",
  "summarize this document", "review", "optimize", "improve",
  "legal", "financial", "medical", "technical", "research",
  "step by step", "pros and cons", "trade-offs", "reasoning",
  "why does", "how does", "what causes", "root cause",
];

export function shouldEscalateToSonnet(messages: AIMessage[]): boolean {
  const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
  if (!lastUserMessage) return false;

  const content = lastUserMessage.content.toLowerCase();

  if (content.length > 500) return true;

  const matchCount = COMPLEXITY_KEYWORDS.filter(kw => content.includes(kw)).length;
  if (matchCount >= 2) return true;

  if (content.includes("?") && content.split("?").length > 3) return true;

  return false;
}

/**
 * Maps a model name from the legacy AIModelConfig to a gateway ModelTier.
 * Defaults to "fast" (Haiku) for unknown model names.
 */
function modelNameToTier(modelName: string): ModelTier {
  if (modelName.includes("opus")) return "advanced";
  if (modelName.includes("sonnet")) return "standard";
  return "fast";
}

export class AnthropicService implements AIServiceInterface {
  isAvailable(): boolean {
    return !!(process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY && process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL);
  }

  async generateResponse(messages: AIMessage[], config?: Partial<AIModelConfig>): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error("Anthropic AI integration is not configured");
    }

    try {
      let modelName = config?.modelName || "claude-haiku-4-5";
      const maxTokens = config?.maxTokens || 8192;

      if (modelName === "claude-haiku-4-5" && shouldEscalateToSonnet(messages)) {
        modelName = "claude-sonnet-4-5";
        console.log("[AI] Auto-escalating to Sonnet for complex task");
      }

      let systemMessage = "";
      const gatewayMessages: Anthropic.MessageParam[] = [];

      for (const message of messages) {
        if (message.role === "system") {
          systemMessage = message.content;
        } else {
          gatewayMessages.push({
            role: message.role as "user" | "assistant",
            content: message.content,
          });
        }
      }

      if (gatewayMessages.length === 0) {
        gatewayMessages.push({ role: "user", content: "Hello" });
      }

      const tier = modelNameToTier(modelName);

      const response = await callAI({
        messages: gatewayMessages,
        system: systemMessage || undefined,
        tier,
        maxTokens,
        context: "anthropic-service:generateResponse",
      });

      return response.content;
    } catch (error: any) {
      console.error("Error generating Anthropic response:", error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  // NOTE: analyzeImage uses a direct Anthropic client because the gateway
  // does not support vision/multimodal message content yet. Once the gateway
  // supports image blocks this should be migrated.
  async analyzeImage(base64Image: string, prompt: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error("Anthropic AI integration is not configured");
    }

    try {
      const client = new Anthropic({
        apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
      });

      const response = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 8192,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64Image
              }
            }
          ]
        }]
      });

      const firstBlock = response.content[0];
      return firstBlock.type === "text" ? firstBlock.text : "";
    } catch (error: any) {
      console.error("Error analyzing image with Anthropic:", error);
      throw new Error(`Failed to analyze image: ${error.message}`);
    }
  }
}
