import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "sk-demo-key" });

export type AgentBrain = {
  instructions: string;
  knowledgeBase?: string;
  role: string;
  name: string;
};

export async function generateAgentResponse(
  message: string,
  brain: AgentBrain,
  history: { role: string; content: string }[]
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are ${brain.name}, an AI assistant with the role of ${brain.role}. 
          ${brain.instructions}
          ${brain.knowledgeBase ? `Use this knowledge base: ${brain.knowledgeBase}` : ""}
          Respond in a helpful, concise, and professional manner. Focus on your specific role.`,
        },
        ...history,
        { role: "user", content: message },
      ],
    });

    return response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Error generating response from OpenAI:", error);
    return "I'm having trouble connecting to my knowledge base. Please try again in a moment.";
  }
}

export async function generateTaskSuggestion(
  agentBrain: AgentBrain,
  currentTasks: { title: string; description: string; status: string }[]
): Promise<{ title: string; description: string } | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are ${agentBrain.name}, an AI assistant with the role of ${agentBrain.role}.
          Based on your role and the current tasks, suggest a new task that would be valuable to work on.
          Current tasks: ${JSON.stringify(currentTasks)}
          
          Respond in JSON format with:
          {
            "title": "Task title - keep it short and specific",
            "description": "Brief description of what needs to be done and why it's important"
          }`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) return null;
    
    return JSON.parse(content);
  } catch (error) {
    console.error("Error generating task suggestion:", error);
    return null;
  }
}
