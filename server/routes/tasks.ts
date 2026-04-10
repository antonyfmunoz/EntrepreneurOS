import { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertTaskSchema, updateTaskSchema } from "@shared/schema";

export function registerTaskRoutes(app: Express): void {
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

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const taskId = req.params.id;
      const task = await storage.getTask(taskId);

      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      await storage.deleteTask(taskId);
      res.status(200).json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error("Error deleting task:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", errors: error.errors });
      }
      res.status(500).json({
        message: "Failed to delete task",
        error: error instanceof Error ? error.message : String(error)
      });
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
}
