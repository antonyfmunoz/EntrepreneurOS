import { apiRequest } from "./queryClient";

/**
 * Call the OpenAI API via our server endpoint
 * @param prompt The text prompt to send to the API
 * @param model The OpenAI model to use (gpt-4o, gpt-4-turbo, gpt-3.5-turbo)
 * @param systemMessage Optional system instruction
 * @returns The response from the selected LLM
 */
export async function callLLM(prompt: string, model: string = "gpt-4o", systemMessage?: string): Promise<string> {
  try {
    const response = await apiRequest("POST", "/api/llm/chat", {
      prompt,
      model,
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