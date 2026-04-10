// server/openai.ts
// Agent brain response generation — routes through AI gateway.
// Named "openai.ts" for historical reasons (originally used OpenAI).

import { callAI } from "./ai/gateway";

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
    const systemContent = `You are ${brain.name}, an AI assistant with the role of ${brain.role}.
          ${brain.instructions}
          ${brain.knowledgeBase ? `Use this knowledge base: ${brain.knowledgeBase}` : ""}
          Respond in a helpful, concise, and professional manner. Focus on your specific role.`;

    const gatewayMessages = [
      ...history.filter(m => m.role !== "system").map(m => ({
        role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const response = await callAI({
      messages: gatewayMessages,
      system: systemContent,
      tier: "fast",
      maxTokens: 8192,
      context: "agent-brain:generateResponse",
    });

    return response.content || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Error generating response from Claude:", error);
    return "I'm having trouble connecting to my knowledge base. Please try again in a moment.";
  }
}

export async function generateTaskSuggestion(
  agentBrain: AgentBrain,
  currentTasks: { title: string; description: string; status: string }[]
): Promise<{ title: string; description: string } | null> {
  try {
    const response = await callAI({
      messages: [
        { role: "user", content: "Suggest a new task based on current priorities." }
      ],
      system: `You are ${agentBrain.name}, an AI assistant with the role of ${agentBrain.role}.
          Based on your role and the current tasks, suggest a new task that would be valuable to work on.
          Current tasks: ${JSON.stringify(currentTasks)}

          Respond in JSON format with:
          {
            "title": "Task title - keep it short and specific",
            "description": "Brief description of what needs to be done and why it's important"
          }`,
      tier: "fast",
      maxTokens: 8192,
      context: "agent-brain:taskSuggestion",
    });

    if (!response.content) return null;
    return JSON.parse(response.content);
  } catch (error) {
    console.error("Error generating task suggestion:", error);
    return null;
  }
}
