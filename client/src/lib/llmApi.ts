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
      // Create an error with additional properties based on the API response
      const error = new Error(data.message || "Failed to get response from AI");
      
      // Add properties from the response to the error object
      (error as any).status = response.status;
      (error as any).code = data.code || 'unknown_error';
      (error as any).details = data.error || '';
      
      throw error;
    }
    
    return data.response;
  } catch (error) {
    console.error("Error calling LLM API:", error);
    
    // Enhance error messages for common OpenAI issues
    if ((error as any).code === 'insufficient_quota' || 
        ((error as Error).message && (error as Error).message.includes('quota'))) {
      throw new Error("OpenAI API quota exceeded. Please update your API key or try a different model.");
    } else if ((error as any).status === 429 || 
               ((error as Error).message && (error as Error).message.includes('rate limit'))) {
      throw new Error("Rate limit exceeded. Please try again later.");
    } else if ((error as any).status === 401 || 
               ((error as Error).message && (error as Error).message.includes('API key'))) {
      throw new Error("Invalid API key. Please check your OpenAI API key in settings.");
    }
    
    throw error;
  }
}