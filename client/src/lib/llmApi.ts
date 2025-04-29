import { apiRequest } from "./queryClient";

/**
 * Call the OpenAI GPT-4o API via our server endpoint
 * @param prompt The text prompt to send to the API
 * @param systemMessage Optional system instruction
 * @returns The response from GPT-4o
 */
export async function callLLM(prompt: string, systemMessage?: string): Promise<string> {
  try {
    const response = await apiRequest("POST", "/api/llm/chat", {
      prompt,
      systemMessage
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || "Failed to get response from AI");
    }
    
    return data.response;
  } catch (error) {
    console.error("Error calling LLM API:", error);
    throw error;
  }
}