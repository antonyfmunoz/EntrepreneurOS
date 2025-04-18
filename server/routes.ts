import { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { generateAgentResponse, generateTaskSuggestion } from "./openai";
import { z } from "zod";
import { 
  insertAgentSchema, 
  insertTaskSchema, 
  updateTaskSchema,
  messages as messagesTable
} from "@shared/schema";
import { 
  getModelInfo, 
  generateAIResponse, 
  AIMessage, 
  getAvailableProviders, 
  AIModelProvider,
  AIModelName 
} from "./ai";
import { db } from "./db";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes and middleware
  setupAuth(app);
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
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      // Get the agent's tasks
      const tasks = await storage.getAgentTasks(req.params.id);
      
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
    const messages = await storage.getAgentMessages(req.params.id);
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
  
  // Task Collaboration Endpoints
  app.post("/api/tasks/:id/collaborators", async (req, res) => {
    try {
      const { agentId } = req.body;
      if (!agentId) {
        return res.status(400).json({ message: "Agent ID is required" });
      }
      
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      const updatedTask = await storage.addAgentCollaborator(req.params.id, agentId);
      
      // Update the agent's activity
      await storage.updateAgentActivity(
        agentId,
        `Added as collaborator on task: ${updatedTask.title}`
      );
      
      // If there's a primary agent assigned, notify them too
      if (updatedTask.agentId && updatedTask.agentId !== agentId) {
        await storage.updateAgentActivity(
          updatedTask.agentId,
          `${agent.name} joined as collaborator on task: ${updatedTask.title}`
        );
      }
      
      res.json(updatedTask);
    } catch (error) {
      console.error("Error adding collaborator:", error);
      res.status(500).json({ 
        message: "Failed to add collaborator",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.post("/api/tasks/:id/assign", async (req, res) => {
    try {
      const { agentId, assignedById } = req.body;
      
      if (!agentId) {
        return res.status(400).json({ message: "Agent ID is required" });
      }
      
      // Verify both agents exist
      const targetAgent = await storage.getAgent(agentId);
      if (!targetAgent) {
        return res.status(404).json({ message: "Target agent not found" });
      }
      
      let assigningAgent;
      if (assignedById) {
        assigningAgent = await storage.getAgent(assignedById);
        if (!assigningAgent) {
          return res.status(404).json({ message: "Assigning agent not found" });
        }
      }
      
      const updatedTask = await storage.assignTaskToAgent(req.params.id, agentId, assignedById);
      
      // Update the new agent's activity
      await storage.updateAgentActivity(
        agentId,
        `Assigned task: ${updatedTask.title}`
      );
      
      // If assigned by another agent, update their activity too
      if (assigningAgent) {
        await storage.updateAgentActivity(
          assignedById,
          `Delegated task "${updatedTask.title}" to ${targetAgent.name}`
        );
      }
      
      res.json(updatedTask);
    } catch (error) {
      console.error("Error assigning task:", error);
      res.status(500).json({ 
        message: "Failed to assign task",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.post("/api/tasks/:id/subtask", async (req, res) => {
    try {
      const subtaskData = insertTaskSchema.parse(req.body);
      const parentTask = await storage.getTask(req.params.id);
      
      if (!parentTask) {
        return res.status(404).json({ message: "Parent task not found" });
      }
      
      const subtask = await storage.createSubtask(req.params.id, subtaskData);
      
      // If subtask is assigned to an agent, update the agent's tasks
      if (subtaskData.agentId) {
        await storage.updateAgentActivity(
          subtaskData.agentId, 
          `Assigned new subtask: ${subtaskData.title}`
        );
      }
      
      res.status(201).json(subtask);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid subtask data", 
          errors: error.errors 
        });
      }
      console.error("Error creating subtask:", error);
      res.status(500).json({ 
        message: "Failed to create subtask",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.get("/api/tasks/:id/subtasks", async (req, res) => {
    try {
      const subtasks = await storage.getSubtasks(req.params.id);
      res.json(subtasks);
    } catch (error) {
      console.error("Error fetching subtasks:", error);
      res.status(500).json({ 
        message: "Failed to fetch subtasks",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.get("/api/tasks/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getTaskMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching task messages:", error);
      res.status(500).json({ 
        message: "Failed to fetch task messages",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.post("/api/tasks/:id/messages", async (req, res) => {
    try {
      const { agentId, content, referencedAgentIds } = req.body;
      
      if (!agentId || !content) {
        return res.status(400).json({ 
          message: "Agent ID and message content are required" 
        });
      }
      
      // Create a new collaborative message associated with this task
      const message = await storage.addCollaborativeMessage({
        agentId,
        taskId: req.params.id,
        role: "assistant",
        content,
        referencedAgentIds: referencedAgentIds || null,
        timestamp: new Date().toISOString(),
      });
      
      // Update the agent's activity
      await storage.updateAgentActivity(
        agentId,
        `Added message to task: ${req.params.id}`
      );
      
      res.status(201).json(message);
    } catch (error) {
      console.error("Error adding task message:", error);
      res.status(500).json({ 
        message: "Failed to add task message",
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
  
  // Conversations API
  app.get("/api/conversations/:id", async (req, res) => {
    try {
      const messages = await storage.getConversationMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ 
        message: "Failed to fetch conversation",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Multi-agent collaboration endpoint
  app.post("/api/ai/multi-agent", async (req, res) => {
    try {
      const { 
        mainAgentId, 
        collaboratorIds,
        prompt,
        taskId,
        aiConfig
      } = req.body;
      
      if (!mainAgentId || !collaboratorIds || !Array.isArray(collaboratorIds) || !prompt) {
        return res.status(400).json({ 
          message: "Main agent ID, collaborator IDs array, and prompt are required" 
        });
      }
      
      // Get all agent data
      const mainAgent = await storage.getAgent(mainAgentId);
      if (!mainAgent) {
        return res.status(404).json({ message: "Main agent not found" });
      }
      
      const collaborators = [];
      for (const id of collaboratorIds) {
        const agent = await storage.getAgent(id);
        if (agent) {
          collaborators.push(agent);
        }
      }
      
      // Create a conversation ID
      const conversationId = `conv_${Date.now()}`;
      
      // Build system prompt that introduces all the agents to each other
      let systemPrompt = `This is a collaborative discussion between the following AI agents:
      
      MAIN AGENT:
      Name: ${mainAgent.name}
      Role: ${mainAgent.role}
      Expertise: ${mainAgent.instructions || "Not specified"}
      
      COLLABORATING AGENTS:`;
      
      for (const agent of collaborators) {
        systemPrompt += `
      Name: ${agent.name}
      Role: ${agent.role}
      Expertise: ${agent.instructions || "Not specified"}`;
      }
      
      systemPrompt += `
      
      The agents should work together to solve the problem, each contributing their expertise.
      Each agent should clearly identify themselves before speaking by starting their response with "I am [Agent Name]:".
      The discussion should be constructive and focused on generating the best possible solution.`;
      
      // Add task context if provided
      if (taskId) {
        const task = await storage.getTask(taskId);
        if (task) {
          systemPrompt += `
          
          TASK DETAILS:
          Title: ${task.title}
          Description: ${task.description}
          Status: ${task.status}
          Priority: ${task.priority || "medium"}`;
        }
      }
      
      // Use AI service to generate a collaborative response
      let collaborationMessages: AIMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ];
      
      let response;
      if (aiConfig) {
        response = await generateAIResponse(collaborationMessages, aiConfig);
      } else {
        // Use the highest-capability model available
        const availableProviders = getAvailableProviders();
        let provider: AIModelProvider = "openai";
        let modelName: AIModelName = "gpt-4o";
        
        if (availableProviders.includes("anthropic")) {
          provider = "anthropic";
          modelName = "claude-3-7-sonnet-20250219";
        } else if (availableProviders.includes("openai")) {
          provider = "openai";
          modelName = "gpt-4o";
        } else if (availableProviders.includes("xai")) {
          provider = "xai";
          modelName = "grok-2-1212";
        }
        
        response = await generateAIResponse(collaborationMessages, { provider, modelName });
      }
      
      // Save the conversation
      await storage.addAgentMessage({
        agentId: mainAgentId,
        taskId: taskId || null,
        conversationId,
        role: "system",
        content: systemPrompt,
        referencedAgentIds: collaboratorIds.join(','),
        timestamp: new Date().toISOString(),
      });
      
      await storage.addAgentMessage({
        agentId: mainAgentId,
        taskId: taskId || null,
        conversationId,
        role: "user",
        content: prompt,
        referencedAgentIds: collaboratorIds.join(','),
        timestamp: new Date().toISOString(),
      });
      
      await storage.addAgentMessage({
        agentId: mainAgentId,
        taskId: taskId || null,
        conversationId,
        role: "assistant",
        content: response,
        referencedAgentIds: collaboratorIds.join(','),
        timestamp: new Date().toISOString(),
      });
      
      // Update the main agent's activity
      await storage.updateAgentActivity(
        mainAgentId,
        `Initiated collaboration with ${collaborators.map(a => a.name).join(', ')}`
      );
      
      // Update collaborator agents' activities
      for (const agent of collaborators) {
        await storage.updateAgentActivity(
          agent.id,
          `Participated in collaboration initiated by ${mainAgent.name}`
        );
      }
      
      res.json({ 
        response,
        conversationId,
        mainAgent: {
          id: mainAgent.id,
          name: mainAgent.name,
          role: mainAgent.role
        },
        collaboratingAgents: collaborators.map(agent => ({
          id: agent.id,
          name: agent.name,
          role: agent.role
        }))
      });
    } catch (error) {
      console.error("Error in multi-agent collaboration:", error);
      res.status(500).json({ 
        message: "Failed to process multi-agent collaboration",
        error: error instanceof Error ? error.message : String(error)
      });
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
  
  // Enhanced Analytics API
  app.get("/api/analytics", async (req, res) => {
    try {
      const timeRange = req.query.timeRange || '7days';
      const agents = await storage.getAgents();
      const tasks = await storage.getTasks();
      // Get all messages
      const messages = await db.select().from(messagesTable).orderBy(messagesTable.timestamp);
      
      // Calculate date range based on timeRange
      const now = new Date();
      const startDate = new Date();
      if (timeRange === '7days') {
        startDate.setDate(now.getDate() - 7);
      } else if (timeRange === '30days') {
        startDate.setDate(now.getDate() - 30);
      } else if (timeRange === '90days') {
        startDate.setDate(now.getDate() - 90);
      }
      
      // Agent performance metrics
      const agentPerformance = agents.map(agent => {
        const agentTasks = tasks.filter(task => task.agentId === agent.id);
        const completedTasks = agentTasks.filter(task => task.status === 'done');
        const inProgressTasks = agentTasks.filter(task => task.status === 'in-progress');
        const pendingTasks = agentTasks.filter(task => task.status === 'todo');
        
        // Calculate completion rate
        const completionRate = agentTasks.length > 0 ? completedTasks.length / agentTasks.length : 0;
        
        // Calculate average completion time (simplified approximation)
        const averageCompletionTime = 
          completedTasks.length > 0 ? 
          completedTasks.reduce((sum, task) => {
            // Safely parse dates with fallbacks
            const createdDate = typeof task.createdAt === 'string' ? new Date(task.createdAt) : new Date();
            const updatedDate = typeof task.updatedAt === 'string' ? new Date(task.updatedAt) : new Date();
            const hoursDiff = (updatedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
            return sum + hoursDiff;
          }, 0) / completedTasks.length : 0;
        
        // Count tasks by priority
        const highPriorityTasks = agentTasks.filter(task => task.priority === 'high').length;
        const mediumPriorityTasks = agentTasks.filter(task => task.priority === 'medium').length;
        const lowPriorityTasks = agentTasks.filter(task => task.priority === 'low').length;
        
        return {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          icon: agent.icon,
          tasksCompleted: completedTasks.length,
          tasksInProgress: inProgressTasks.length,
          tasksPending: pendingTasks.length,
          completionRate,
          averageCompletionTime,
          tasksByPriority: {
            high: highPriorityTasks,
            medium: mediumPriorityTasks,
            low: lowPriorityTasks
          }
        };
      });
      
      // Generate task completion trends
      const taskCompletionTrends = [];
      const daysToGenerate = timeRange === '7days' ? 7 : (timeRange === '30days' ? 30 : 90);
      
      for (let i = 0; i < daysToGenerate; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (daysToGenerate - i - 1));
        const dateStr = date.toISOString().split('T')[0];
        
        // Filter tasks created or completed on this date
        const tasksCreatedOnDate = tasks.filter(task => {
          if (!task.createdAt) return false;
          const createdDate = new Date(task.createdAt);
          return createdDate.toISOString().split('T')[0] === dateStr;
        }).length;
        
        const tasksCompletedOnDate = tasks.filter(task => {
          if (task.status !== 'done' || !task.updatedAt) return false;
          const updatedDate = new Date(task.updatedAt);
          return updatedDate.toISOString().split('T')[0] === dateStr;
        }).length;
        
        taskCompletionTrends.push({
          date: dateStr,
          created: tasksCreatedOnDate,
          completed: tasksCompletedOnDate
        });
      }
      
      // Task distribution by status
      const taskDistributionByStatus = [
        {
          name: "Completed",
          value: tasks.filter(task => task.status === 'done').length,
          color: "#22c55e" // green-500
        },
        {
          name: "In Progress",
          value: tasks.filter(task => task.status === 'in-progress').length,
          color: "#f59e0b" // yellow-500 
        },
        {
          name: "To Do",
          value: tasks.filter(task => task.status === 'todo').length,
          color: "#6b7280" // gray-500
        }
      ];
      
      // Task distribution by type
      const taskDistributionByType = [
        {
          name: "Standard", 
          value: tasks.filter(task => task.taskType === 'standard').length,
          color: "#3b82f6" // blue-500
        },
        {
          name: "Collaboration",
          value: tasks.filter(task => task.taskType === 'collaboration').length,
          color: "#8b5cf6" // violet-500
        },
        {
          name: "Delegated",
          value: tasks.filter(task => task.taskType === 'delegated').length,
          color: "#ec4899" // pink-500
        },
        {
          name: "Subtask",
          value: tasks.filter(task => task.taskType === 'subtask').length,
          color: "#14b8a6" // teal-500
        }
      ];
      
      // Task distribution by priority
      const taskDistributionByPriority = [
        {
          name: "High",
          value: tasks.filter(task => task.priority === 'high').length,
          color: "#ef4444" // red-500
        },
        {
          name: "Medium",
          value: tasks.filter(task => task.priority === 'medium').length,
          color: "#f59e0b" // yellow-500
        },
        {
          name: "Low",
          value: tasks.filter(task => task.priority === 'low').length,
          color: "#10b981" // emerald-500
        }
      ];
      
      // Calculate overall stats
      const totalAgents = agents.length;
      const totalTasks = tasks.length;
      const completionRate = totalTasks > 0 ? 
        tasks.filter(task => task.status === 'done').length / totalTasks : 0;
      
      // Calculate average task age in days
      const averageTaskAge = tasks.length > 0 ? 
        tasks.reduce((sum, task) => {
          if (!task.createdAt) return sum;
          const createdDate = new Date(task.createdAt);
          const ageInDays = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
          return sum + ageInDays;
        }, 0) / tasks.length : 0;
      
      res.json({
        agentPerformance,
        taskCompletionTrends,
        taskDistributionByStatus,
        taskDistributionByType,
        taskDistributionByPriority,
        overallStats: {
          totalAgents,
          totalTasks,
          completionRate,
          averageTaskAge
        }
      });
    } catch (error) {
      console.error("Error generating analytics:", error);
      res.status(500).json({ 
        message: "Failed to generate analytics",
        error: error instanceof Error ? error.message : String(error)
      });
    }
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
      
      // Create a notification for the user when integration is connected
      if (req.user && integration) {
        await storage.createNotification({
          userId: req.user.id,
          title: "Integration Connected",
          content: `${integration.name} integration has been successfully connected`,
          type: "integration-connected",
          href: "/integrations",
          relatedId: integration.id
        });
      }
      
      res.status(201).json(integration);
    } catch (error) {
      res.status(500).json({ message: "Failed to connect integration" });
    }
  });
  
  // Notification API Routes
  app.get("/api/notifications", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check if there are any notifications for this user
      const existingNotifications = await storage.getNotifications(req.user.id);
      
      // If no notifications exist, create a test one
      if (existingNotifications.length === 0) {
        await storage.createNotification({
          userId: req.user.id,
          title: "Welcome to AgentOS",
          content: "Your notification system is now active. You'll receive updates here as agents complete tasks and integrations are connected.",
          type: "system",
          read: false
        });
      }
      
      const notifications = await storage.getNotifications(req.user.id);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });
  
  app.get("/api/notifications/count", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const count = await storage.getUnreadNotificationsCount(req.user.id);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching notification count:", error);
      res.status(500).json({ message: "Failed to fetch notification count" });
    }
  });
  
  app.post("/api/notifications/:id/read", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const notification = await storage.markNotificationAsRead(req.params.id);
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });
  
  app.post("/api/notifications/read-all", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      await storage.markAllNotificationsAsRead(req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });
  
  // AI Assistant API Routes
  app.get("/api/ai-assistant/messages", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const messages = await storage.getAiMessages(req.user.id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching AI assistant messages:", error);
      res.status(500).json({ message: "Failed to fetch AI assistant messages" });
    }
  });
  
  app.post("/api/ai-assistant/messages", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Create user message
      const userMessage = await storage.addAiMessage({
        role: "user",
        content: req.body.content,
        userId: req.user.id
      });
      
      // Generate assistant response
      // Usually this would involve an actual AI service call
      const assistantMessage = await storage.addAiMessage({
        role: "assistant",
        content: "I'm your AI assistant. I can help answer questions about the AgentOS platform and your agents. How can I assist you today?",
        userId: req.user.id
      });
      
      res.json(assistantMessage);
    } catch (error) {
      console.error("Error sending message to AI assistant:", error);
      res.status(500).json({ message: "Failed to send message to AI assistant" });
    }
  });
  
  app.delete("/api/ai-assistant/messages", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      await storage.clearAiMessages(req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing AI assistant messages:", error);
      res.status(500).json({ message: "Failed to clear AI assistant messages" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
