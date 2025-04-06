import { apiRequest } from "./queryClient";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

export async function sendMessageToAgent(
  agentId: string,
  message: string
): Promise<string> {
  try {
    const response = await apiRequest("POST", `/api/agents/${agentId}/chat`, {
      message,
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
  taskId: string
): Promise<string> {
  try {
    const response = await apiRequest(
      "POST",
      `/api/agents/${agentId}/generate-response`,
      { taskId }
    );
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Error generating agent response:", error);
    throw error;
  }
}
