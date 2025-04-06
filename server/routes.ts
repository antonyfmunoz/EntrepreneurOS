import { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateAgentResponse, generateTaskSuggestion } from "./openai";
import { z } from "zod";
import { insertAgentSchema, insertTaskSchema, updateTaskSchema } from "@shared/schema";
import { getModelInfo, generateAIResponse, AIMessage, getAvailableProviders, AIModelProvider } from "./ai";

export async function registerRoutes(app: Express): Promise<Server> {
  // AI Models API
  app.get("/api/ai/models", (_req, res) => {
    try {
      const modelInfo = getModelInfo();
      const availableProviders = getAvailableProviders();
      
      // Transform model info into the expected format for the frontend
      const providers = Object.entries(modelInfo).map(([providerKey, info]) => {
        const provider = providerKey as AIModelProvider;
        return {
          provider,
          models: info.models,
          isAvailable: availableProviders.includes(provider)
        };
      });
      
      res.json({ providers });
    } catch (error) {
      console.error("Error fetching AI model info:", error);
      res.status(500).json({ message: "Failed to fetch AI model information" });
    }
  });
  
  // API Key Management
  app.get("/api/ai/provider-status", (_req, res) => {
    try {
      const providerStatus = {
        openai: process.env.OPENAI_API_KEY ? true : false,
        anthropic: process.env.ANTHROPIC_API_KEY ? true : false,
        perplexity: process.env.PERPLEXITY_API_KEY ? true : false,
        xai: process.env.XAI_API_KEY ? true : false,
        gemini: process.env.GEMINI_API_KEY ? true : false
      };
      
      res.json({ providerStatus });
    } catch (error) {
      console.error("Error checking AI provider status:", error);
      res.status(500).json({ message: "Failed to check AI provider status" });
    }
  });
  
  // Save API Key - this only works for development purposes
  // In production, you should use a proper secrets management system
  app.post("/api/keys/save", (req, res) => {
    try {
      const { keyName, value } = req.body;
      
      // Validate the key name to prevent security issues
      const allowedKeys = [
        "OPENAI_API_KEY", 
        "ANTHROPIC_API_KEY", 
        "PERPLEXITY_API_KEY",
        "XAI_API_KEY",
        "GEMINI_API_KEY"
      ];
      
      if (!allowedKeys.includes(keyName)) {
        return res.status(400).json({ message: "Invalid API key name" });
      }
      
      if (!value) {
        return res.status(400).json({ message: "API key value is required" });
      }
      
      // Set environment variable
      process.env[keyName] = value;
      
      console.log(`API key ${keyName} has been updated`);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving API key:", error);
      res.status(500).json({ message: "Failed to save API key" });
    }
  });
  
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const { messages, config } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: "Messages array is required" });
      }
      
      const aiMessages: AIMessage[] = messages.map(m => ({
        role: m.role,
        content: m.content
      }));
      
      const response = await generateAIResponse(aiMessages, config || {});
      res.json({ response });
    } catch (error) {
      console.error("AI generation error:", error);
      res.status(500).json({ 
        message: "Failed to generate AI response",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Agents API
  app.get("/api/agents", async (_req, res) => {
    const agents = await storage.getAgents();
    res.json(agents);
  });

  app.get("/api/agents/:id", async (req, res) => {
    const agent = await storage.getAgent(req.params.id);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }
    res.json(agent);
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
    const messages = await storage.getAgentMessages(req.params.id);
    res.json(messages);
  });

  app.post("/api/agents/:id/chat", async (req, res) => {
    try {
      const { message, aiConfig } = req.body;
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      const agent = await storage.getAgent(req.params.id);
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
      
      // Try the unified AI service first if aiConfig is provided
      if (aiConfig) {
        try {
          // Convert messages to AI format
          const aiMessages: AIMessage[] = dbMessages.map(m => ({
            role: m.role === "user" || m.role === "assistant" ? m.role : "user",
            content: m.content
          }));
          
          // Add system message with agent instructions at the beginning
          aiMessages.unshift({
            role: "system",
            content: `You are ${agent.name}, ${agent.role}. ${agent.instructions || ""}
                    ${agent.brainContent ? `\n\nReference knowledge:\n${agent.brainContent}` : ""}`
          });
          
          reply = await generateAIResponse(aiMessages, aiConfig);
        } catch (aiError) {
          console.error("Error using unified AI service:", aiError);
          // Fall back to OpenAI in case of error
          const history = dbMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
          }));
          reply = await generateAgentResponse(message, brain, history);
        }
      } else {
        // Use the original OpenAI implementation
        const history = dbMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
        }));
        reply = await generateAgentResponse(message, brain, history);
      }

      // Add AI response to storage
      const aiMessage = await storage.addAgentMessage({
        agentId: req.params.id,
        role: "assistant",
        content: reply,
        timestamp: new Date().toISOString(),
      });

      // Update agent's latest activity
      await storage.updateAgentActivity(req.params.id, "Responded to user message");

      res.json({ reply, messageId: aiMessage.id });
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
    const tasks = await storage.getAgentTasks(req.params.id);
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

  // Tasks API
  app.get("/api/tasks", async (_req, res) => {
    const tasks = await storage.getTasks();
    res.json(tasks);
  });

  app.get("/api/tasks/:id", async (req, res) => {
    const task = await storage.getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    res.json(task);
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const taskData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(taskData);

      // If task is assigned to an agent, update the agent's tasks
      if (taskData.agentId) {
        await storage.updateAgentActivity(taskData.agentId, `Assigned new task: ${taskData.title}`);
      }

      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid task data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const taskUpdate = updateTaskSchema.parse(req.body);
      const task = await storage.getTask(req.params.id);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const updatedTask = await storage.updateTask(req.params.id, taskUpdate);

      // If task has an agent assigned, update the agent's activity
      if (task.agentId) {
        const statusText = taskUpdate.status === "done" 
          ? "completed" 
          : taskUpdate.status === "in-progress" 
            ? "started working on" 
            : "is planning";
            
        await storage.updateAgentActivity(
          task.agentId, 
          `${statusText} task: ${task.title}`
        );
      }

      res.json(updatedTask);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid task update", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  // Stats API
  app.get("/api/stats", async (_req, res) => {
    const agents = await storage.getAgents();
    const tasks = await storage.getTasks();
    
    const activeAgents = agents.length;
    const tasksCompleted = tasks.filter(task => task.status === "done").length;
    const activeTasks = tasks.filter(task => task.status !== "done").length;

    res.json({
      activeAgents: {
        title: "Active Agents",
        value: activeAgents,
        change: 1,
        changeText: "1 agent",
        icon: "ri-robot-line",
        iconBgColor: "bg-blue-100",
        iconColor: "text-primary",
      },
      tasksCompleted: {
        title: "Tasks Completed",
        value: tasksCompleted,
        change: 12,
        changeText: "12 tasks",
        icon: "ri-check-double-line",
        iconBgColor: "bg-green-100",
        iconColor: "text-success",
      },
      activeTasks: {
        title: "Active Tasks",
        value: activeTasks,
        change: -2,
        changeText: "2 tasks",
        icon: "ri-time-line",
        iconBgColor: "bg-indigo-100",
        iconColor: "text-secondary",
      },
    });
  });

  // Integrations API
  app.get("/api/integrations", async (_req, res) => {
    const integrations = await storage.getIntegrations();
    res.json(integrations);
  });

  app.post("/api/integrations/connect", async (req, res) => {
    try {
      const { type } = req.body;
      if (!type) {
        return res.status(400).json({ message: "Integration type is required" });
      }

      const integration = await storage.connectIntegration(type);
      res.status(201).json(integration);
    } catch (error) {
      res.status(500).json({ message: "Failed to connect integration" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
