import { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { generateAgentResponse } from "../openai";
import { insertAgentSchema } from "@shared/schema";
import {
  generateAIResponse,
  AIMessage,
} from "../ai";
import { callAI } from "../ai/gateway";

export function registerAgentRoutes(app: Express): void {
  // Agents API
  app.get("/api/agents", async (_req, res) => {
    try {
      const agents = await storage.getAgents();

      // For each agent, fetch their tasks
      const agentsWithTasks = await Promise.all(
        agents.map(async (agent) => {
          const tasks = await storage.getAgentTasks(agent.id);
          return {
            ...agent,
            tasks: tasks.map(task => ({
              id: task.id,
              title: task.title,
              status: task.status
            }))
          };
        })
      );

      res.json(agentsWithTasks);
    } catch (error) {
      console.error("Error fetching agents with tasks:", error);
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      const agentId = req.params.id;

      if (agentId === "direct-claude" || agentId === "direct-gpt4o") {
        return res.json({
          id: "direct-claude",
          name: "Claude Direct Chat",
          role: "AI Assistant",
          icon: "ri-robot-2-line",
          instructions: "You are Claude, an AI assistant. Answer helpfully, concisely, and professionally.",
          color: "#7C3AED",
          createdAt: new Date().toISOString(),
          tasks: []
        });
      }

      // Normal case - get agent from database
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Get the agent's tasks
      const tasks = await storage.getAgentTasks(agentId);

      // Return agent with tasks
      res.json({
        ...agent,
        tasks: tasks.map(task => ({
          id: task.id,
          title: task.title,
          status: task.status
        }))
      });
    } catch (error) {
      console.error("Error fetching agent:", error);
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });

  // Update an agent
  app.patch("/api/agents/:id", async (req, res) => {
    try {
      const agentId = req.params.id;

      // Verify the agent exists
      const existingAgent = await storage.getAgent(agentId);
      if (!existingAgent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Update the agent with the provided fields
      const updatedAgent = await storage.updateAgent(agentId, req.body);

      res.json(updatedAgent);
    } catch (error) {
      console.error("Error updating agent:", error);
      res.status(500).json({
        message: "Failed to update agent",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/agents", async (req, res) => {
    try {
      const agentData = insertAgentSchema.parse(req.body);
      const agent = await storage.createAgent(agentData);
      res.status(201).json(agent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid agent data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create agent" });
    }
  });

  // Agent Messages API
  app.get("/api/agents/:id/messages", async (req, res) => {
    const agentId = req.params.id;

    if (agentId === "direct-claude" || agentId === "direct-gpt4o") {
      const messages = await storage.getAgentMessages(agentId);

      // If the agent exists in database, return its messages
      if (messages && messages.length > 0) {
        return res.json(messages);
      }

      // Otherwise return empty array for first-time use
      return res.json([]);
    }

    // Regular case
    const messages = await storage.getAgentMessages(agentId);
    res.json(messages);
  });

  // Clear agent messages (New Chat functionality)
  app.post("/api/agents/:id/clear-messages", async (req, res) => {
    try {
      const agentId = req.params.id;
      await storage.clearAgentMessages(agentId);
      res.json({ success: true, message: "Chat history cleared successfully" });
    } catch (error) {
      console.error("Error clearing agent messages:", error);
      res.status(500).json({ error: "Failed to clear agent messages" });
    }
  });

  app.post("/api/agents/:id/chat", async (req, res) => {
    try {
      const { message, aiConfig } = req.body;
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      const agentId = req.params.id;

      if (agentId === "direct-claude") {
        const virtualClaudeAgent = {
          id: "direct-claude",
          name: "Claude Direct Chat",
          role: "AI Assistant",
          icon: "ri-robot-2-line",
          instructions: "You are Claude, an AI assistant made by Anthropic. Answer helpfully, concisely, and professionally.",
          brainContent: "",
        };

        await storage.addAgentMessage({
          agentId: agentId,
          role: "user",
          content: message,
          timestamp: new Date().toISOString(),
        });

        const selectedModel = aiConfig?.modelName || "claude-haiku-4-5";
        const tier = selectedModel.includes("sonnet") ? "standard" as const : "fast" as const;

        try {
          const gatewayResponse = await callAI({
            messages: [{ role: "user", content: message }],
            system: virtualClaudeAgent.instructions,
            tier,
            maxTokens: 8192,
            context: "agent-chat",
          });

          const reply = gatewayResponse.content;

          const aiMessage = await storage.addAgentMessage({
            agentId: agentId,
            role: "assistant",
            content: reply,
            timestamp: new Date().toISOString(),
          });

          return res.json({ reply, messageId: aiMessage.id });
        } catch (error) {
          console.error("Error in direct Claude mode:", error);
          throw error;
        }
      }

      // Normal case - get agent from database for regular agents
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Add user message to storage
      await storage.addAgentMessage({
        agentId: req.params.id,
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      });

      // Get all messages for context
      const dbMessages = await storage.getAgentMessages(req.params.id);

      // Setup agent brain info
      const brain = {
        instructions: agent.instructions || "",
        knowledgeBase: agent.brainContent || "",
        role: agent.role,
        name: agent.name,
      };

      let reply;

      const actionSystemPrompt = `\n\nYou can propose actions for the user to approve. When you want to take an action, include it in your response using this format:
[ACTION:SEND_EMAIL|to:recipient@example.com|subject:Email Subject|body:Email body text]
[ACTION:CREATE_TASK|title:Task Title|description:Task description|priority:medium]
[ACTION:CREATE_DOCUMENT|title:Document Title|content:Document content]
Only propose actions when the user explicitly asks you to do something actionable. Always explain what action you're proposing before the tag.`;

      if (aiConfig) {
        try {
          const aiMessages: AIMessage[] = dbMessages.map(m => ({
            role: m.role === "user" || m.role === "assistant" ? m.role : "user",
            content: m.content
          }));

          aiMessages.unshift({
            role: "system",
            content: `You are ${agent.name}, ${agent.role}. ${agent.instructions || ""}
                    ${agent.brainContent ? `\n\nReference knowledge:\n${agent.brainContent}` : ""}${actionSystemPrompt}`
          });

          reply = await generateAIResponse(aiMessages, aiConfig);
        } catch (aiError) {
          console.error("Error using unified AI service:", aiError);
          const history = dbMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
          }));
          reply = await generateAgentResponse(message, brain, history);
        }
      } else {
        const history = dbMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
        }));
        reply = await generateAgentResponse(message, brain, history);
      }

      const actionRegex = /\[ACTION:(\w+)\|([^\]]+)\]/g;
      let match;
      const extractedActions: any[] = [];
      let cleanReply = reply;

      while ((match = actionRegex.exec(reply)) !== null) {
        const actionType = match[1].toLowerCase();
        const paramsStr = match[2];
        const params: Record<string, string> = {};
        paramsStr.split("|").forEach(p => {
          const [key, ...valueParts] = p.split(":");
          if (key && valueParts.length > 0) {
            params[key.trim()] = valueParts.join(":").trim();
          }
        });

        const actionTypeMap: Record<string, string> = {
          send_email: "Send Email",
          create_task: "Create Task",
          create_document: "Create Document",
        };

        try {
          if (!req.isAuthenticated()) continue;
          const userId = (req.user as any).id;
          const action = await storage.createAction({
            agentId: req.params.id,
            userId,
            actionType,
            actionName: actionTypeMap[actionType] || actionType,
            description: `${actionTypeMap[actionType] || actionType} proposed by ${agent.name}`,
            parameters: params,
            estimatedTimeSaved: actionType === "send_email" ? 5 : 3,
            status: "pending",
            priority: "medium",
            requiresApproval: true,
          });
          extractedActions.push(action);
        } catch (actionErr) {
          console.error("Error creating action record:", actionErr);
        }

        cleanReply = cleanReply.replace(match[0], "");
      }

      cleanReply = cleanReply.trim();

      const aiMessage = await storage.addAgentMessage({
        agentId: req.params.id,
        role: "assistant",
        content: cleanReply,
        timestamp: new Date().toISOString(),
      });

      await storage.updateAgentActivity(req.params.id, "Responded to user message");

      res.json({
        reply: cleanReply,
        messageId: aiMessage.id,
        actionsCreated: extractedActions.length,
        actions: extractedActions,
      });
    } catch (error) {
      console.error("Error in chat:", error);
      res.status(500).json({
        message: "Failed to process message",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Agent Tasks API
  app.get("/api/agents/:id/tasks", async (req, res) => {
    const agentId = req.params.id;

    if (agentId === "direct-claude" || agentId === "direct-gpt4o") {
      return res.json([]);
    }

    // Regular case
    const tasks = await storage.getAgentTasks(agentId);
    res.json(tasks);
  });

  app.post("/api/agents/:id/generate-response", async (req, res) => {
    try {
      const { taskId, aiConfig } = req.body;
      if (!taskId) {
        return res.status(400).json({ message: "Task ID is required" });
      }

      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Generate a response about the task
      const brain = {
        instructions: agent.instructions || "",
        knowledgeBase: agent.brainContent || "",
        role: agent.role,
        name: agent.name,
      };

      let response;

      // Try the unified AI service first if aiConfig is provided
      if (aiConfig) {
        try {
          // Create messages for AI
          const messages: AIMessage[] = [
            {
              role: "system",
              content: `You are ${agent.name}, ${agent.role}. ${agent.instructions || ""}
                      ${agent.brainContent ? `\n\nReference knowledge:\n${agent.brainContent}` : ""}`
            },
            {
              role: "user",
              content: `Please provide an update or next steps for this task: ${task.title} - ${task.description}`
            }
          ];

          response = await generateAIResponse(messages, aiConfig);
        } catch (aiError) {
          console.error("Error using unified AI service for task response:", aiError);
          // Fall back to OpenAI
          response = await generateAgentResponse(
            `Please provide an update or next steps for this task: ${task.title} - ${task.description}`,
            brain,
            []
          );
        }
      } else {
        // Use the original OpenAI implementation
        response = await generateAgentResponse(
          `Please provide an update or next steps for this task: ${task.title} - ${task.description}`,
          brain,
          []
        );
      }

      res.json({ response });
    } catch (error) {
      console.error("Error generating response:", error);
      res.status(500).json({
        message: "Failed to generate response",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/agents/:id/collaborative-tasks", async (req, res) => {
    try {
      const tasks = await storage.getCollaborativeTasks(req.params.id);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching collaborative tasks:", error);
      res.status(500).json({
        message: "Failed to fetch collaborative tasks",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Agent Metrics
  app.get("/api/agents/:id/metrics", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
      const userId = (req.user as any).id;
      const metrics = await storage.getAgentMetrics(req.params.id, userId);
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
