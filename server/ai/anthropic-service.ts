import Anthropic from "@anthropic-ai/sdk";
import { AIServiceInterface, AIMessage, AIModelConfig } from "./index";

export class AnthropicService implements AIServiceInterface {
  private anthropic: Anthropic | null = null;
  
  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }
  
  isAvailable(): boolean {
    return this.anthropic !== null;
  }
  
  async generateResponse(messages: AIMessage[], config?: Partial<AIModelConfig>): Promise<string> {
    if (!this.anthropic) {
      throw new Error("Anthropic API key is not configured");
    }
    
    try {
      // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
      const modelName = config?.modelName || "claude-3-7-sonnet-20250219";
      const maxTokens = config?.maxTokens || 1000;
      const temperature = config?.temperature || 0.7;
      
      // Extract system message if it exists
      let systemMessage = "";
      let anthropicMessages = [];
      
      for (const message of messages) {
        if (message.role === "system") {
          systemMessage = message.content;
        } else {
          anthropicMessages.push({
            role: message.role,
            content: message.content
          });
        }
      }
      
      const response = await this.anthropic.messages.create({
        model: modelName,
        max_tokens: maxTokens,
        temperature: temperature,
        system: systemMessage,
        messages: anthropicMessages,
      });
      
      return response.content[0].text;
    } catch (error) {
      console.error("Error generating Anthropic response:", error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }
  
  async analyzeImage(base64Image: string, prompt: string): Promise<string> {
    if (!this.anthropic) {
      throw new Error("Anthropic API key is not configured");
    }
    
    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 500,
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
      
      return response.content[0].text;
    } catch (error) {
      console.error("Error analyzing image with Anthropic:", error);
      throw new Error(`Failed to analyze image: ${error.message}`);
    }
  }
}