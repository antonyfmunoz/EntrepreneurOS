import axios from 'axios';

// This is a frontend implementation that calls our backend API
// We never expose the API key directly in the frontend
export async function callLLM(prompt: string): Promise<string> {
  try {
    // Using our existing backend API endpoint instead of calling OpenAI directly
    const response = await axios.post('/api/llm/chat', {
      prompt,
      systemMessage: "You are an autonomous business agent designed to help build and manage businesses."
    });
    
    return response.data.response;
  } catch (error) {
    console.error('LLM API error:', error);
    throw new Error('Failed to call LLM API');
  }
}