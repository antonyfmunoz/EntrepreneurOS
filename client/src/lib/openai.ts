import { apiRequest } from "./queryClient";
import type { AIModelConfig } from "@/hooks/use-ai-models";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

export async function sendMessageToAgent(
  agentId: string,
  message: string,
  aiConfig?: AIModelConfig | null
): Promise<string> {
  try {
    const response = await apiRequest("POST", `/api/agents/${agentId}/chat`, {
      message,
      aiConfig
    });
    const data = await response.json();
    return data.reply;
  } catch (error) {
    console.error("Error sending message to agent:", error);
    throw error;
  }
}

export async function generateAgentResponse(
  agentId: string,
  taskId: string,
  aiConfig?: AIModelConfig | null
): Promise<string> {
  try {
    const response = await apiRequest(
      "POST",
      `/api/agents/${agentId}/generate-response`,
      { 
        taskId,
        aiConfig
      }
    );
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Error generating agent response:", error);
    throw error;
  }
}
