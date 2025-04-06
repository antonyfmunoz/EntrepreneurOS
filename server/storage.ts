import { 
  agents as agentsTable, 
  tasks as tasksTable, 
  messages as messagesTable,
  integrations as integrationsTable,
  type Agent, 
  type Task, 
  type InsertAgent, 
  type InsertTask, 
  type UpdateTask,
  type Message,
  type InsertMessage,
  type Integration,
  type InsertIntegration
} from "@shared/schema";
import { db } from './db';
import { eq, and } from 'drizzle-orm';

export interface IStorage {
  // Agent operations
  getAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgentActivity(id: string, activity: string): Promise<Agent | undefined>;

  // Task operations
  getTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: UpdateTask): Promise<Task>;
  getAgentTasks(agentId: string): Promise<Task[]>;
  getCollaborativeTasks(agentId: string): Promise<Task[]>; // Tasks where agent is a collaborator
  getTasksByType(taskType: string): Promise<Task[]>; // Get tasks by type (standard, collaboration, etc.)
  getSubtasks(parentTaskId: string): Promise<Task[]>; // Get all subtasks for a parent task

  // Message operations
  getAgentMessages(agentId: string): Promise<Message[]>;
  getTaskMessages(taskId: string): Promise<Message[]>; // Get all messages for a specific task
  getConversationMessages(conversationId: string): Promise<Message[]>; // Get all messages for a conversation
  addAgentMessage(message: InsertMessage): Promise<Message>;
  addCollaborativeMessage(message: InsertMessage): Promise<Message>; // Special handling for collaborative messages

  // Agent collaboration operations
  addAgentCollaborator(taskId: string, agentId: string): Promise<Task>; // Add an agent as collaborator to a task
  assignTaskToAgent(taskId: string, agentId: string, assignedById: string): Promise<Task>; // Assign task to a different agent
  createSubtask(parentTaskId: string, subtask: InsertTask): Promise<Task>; // Create a subtask linked to parent

  // Integration operations
  getIntegrations(): Promise<Integration[]>;
  connectIntegration(type: string): Promise<Integration>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Initialize with sample data if needed
    this.initSampleData().catch(err => {
      console.error("Error initializing sample data:", err);
    });
  }

  private async initSampleData(): Promise<void> {
    const existingAgents = await this.getAgents();
    if (existingAgents.length > 0) {
      // Data already exists, no need to initialize
      return;
    }

    try {
      // Sample agents with explicit IDs
      const marketingAgent = await db.insert(agentsTable)
        .values({
          id: "agent_1",
          name: "Marketing Agent",
          role: "marketing",
          icon: "ri-megaphone-line",
          instructions: "Help with marketing campaigns, social media, and content strategy.",
          latestActivity: "Created agent",
          brainContent: "",
        })
        .returning()
        .then(rows => rows[0]);

      const supportAgent = await db.insert(agentsTable)
        .values({
          id: "agent_2",
          name: "Support Agent",
          role: "support",
          icon: "ri-customer-service-2-line",
          instructions: "Assist with customer inquiries, troubleshooting, and support tickets.",
          latestActivity: "Created agent",
          brainContent: "",
        })
        .returning()
        .then(rows => rows[0]);

      const contentAgent = await db.insert(agentsTable)
        .values({
          id: "agent_3",
          name: "Content Agent",
          role: "content",
          icon: "ri-article-line",
          instructions: "Create and optimize content for blogs, social media, and website.",
          latestActivity: "Created agent",
          brainContent: "",
        })
        .returning()
        .then(rows => rows[0]);

      const opsAgent = await db.insert(agentsTable)
        .values({
          id: "agent_4",
          name: "Operations Agent",
          role: "operations",
          icon: "ri-user-settings-line",
          instructions: "Streamline operations, track KPIs, and generate reports.",
          latestActivity: "Created agent",
          brainContent: "",
        })
        .returning()
        .then(rows => rows[0]);

      // Sample tasks
      await db.insert(tasksTable)
        .values([
          {
            id: "task_1",
            title: "Update website copy",
            description: "Review and update the website copy for the new product launch.",
            status: "todo",
            dueDate: this.getFutureDate(2),
            agentId: contentAgent.id,
          },
          {
            id: "task_2",
            title: "Create sales presentation",
            description: "Prepare sales presentation for client meeting.",
            status: "todo", 
            dueDate: this.getFutureDate(1),
            agentId: marketingAgent.id,
          },
          {
            id: "task_3",
            title: "Schedule social media posts",
            description: "Create and schedule posts for the week across all platforms.",
            status: "in-progress",
            dueDate: this.getTodayDate(),
            agentId: marketingAgent.id,
          },
          {
            id: "task_4",
            title: "Draft weekly blog post",
            description: "Write blog post on industry trends and updates.",
            status: "in-progress",
            dueDate: this.getFutureDate(3),
            agentId: contentAgent.id,
          },
          {
            id: "task_5",
            title: "Review support tickets",
            description: "Review and prioritize open support tickets.",
            status: "in-progress",
            dueDate: this.getTodayDate(),
            agentId: supportAgent.id,
          },
          {
            id: "task_6",
            title: "Create product descriptions",
            description: "Write compelling descriptions for new product line.",
            status: "done",
            dueDate: this.getPastDate(1),
            agentId: contentAgent.id,
          },
          {
            id: "task_7",
            title: "Analyze campaign metrics",
            description: "Review performance metrics from last campaign.",
            status: "done",
            dueDate: this.getPastDate(2),
            agentId: marketingAgent.id,
          }
        ]);

      // Update latest activities
      await db.update(agentsTable)
        .set({ latestActivity: "Created social media post for product launch" })
        .where(eq(agentsTable.id, marketingAgent.id));
      
      await db.update(agentsTable)
        .set({ latestActivity: "Drafted response for customer inquiry #1293" })
        .where(eq(agentsTable.id, supportAgent.id));
      
      await db.update(agentsTable)
        .set({ latestActivity: "Outlined new blog post on industry trends" })
        .where(eq(agentsTable.id, contentAgent.id));
      
      await db.update(agentsTable)
        .set({ latestActivity: "Generated monthly operations report" })
        .where(eq(agentsTable.id, opsAgent.id));

      // Sample integrations
      await db.insert(integrationsTable)
        .values([
          {
            id: "integration_1",
            name: "Notion",
            type: "notion",
            status: "connected",
            details: "3 workspaces",
            icon: "ri-notion-line",
          },
          {
            id: "integration_2",
            name: "Gmail",
            type: "gmail",
            status: "connected",
            details: "example@gmail.com",
            icon: "ri-mail-line",
          },
          {
            id: "integration_3",
            name: "Google Sheets",
            type: "google-sheets",
            status: "connected",
            details: "2 sheets",
            icon: "ri-file-list-3-line",
          }
        ]);
    } catch (error) {
      console.error("Error initializing sample data:", error);
    }
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getFutureDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  private getPastDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }

  // Agent operations
  async getAgents(): Promise<Agent[]> {
    return await db.select().from(agentsTable);
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    const agents = await db.select().from(agentsTable).where(eq(agentsTable.id, id));
    return agents.length > 0 ? agents[0] : undefined;
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    // Generate a unique ID
    const id = `agent_${Date.now()}`;
    const now = new Date();
    
    // Create agent with specific field mappings
    const [newAgent] = await db.insert(agentsTable)
      .values({
        id,
        name: agent.name,
        role: agent.role,
        icon: agent.icon || "ri-robot-line",
        instructions: agent.instructions || null,
        latestActivity: "Created agent",
        brainContent: "",
        createdAt: now
      })
      .returning();
    
    return newAgent;
  }

  async updateAgentActivity(id: string, activity: string): Promise<Agent | undefined> {
    const [agent] = await db.update(agentsTable)
      .set({ latestActivity: activity })
      .where(eq(agentsTable.id, id))
      .returning();
    return agent;
  }

  // Task operations
  async getTasks(): Promise<Task[]> {
    return await db.select().from(tasksTable);
  }

  async getTask(id: string): Promise<Task | undefined> {
    const tasks = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    return tasks.length > 0 ? tasks[0] : undefined;
  }

  async createTask(task: InsertTask): Promise<Task> {
    // Generate a unique ID
    const id = `task_${Date.now()}`;
    const now = new Date();
    
    // Create task with specific field mappings
    const [newTask] = await db.insert(tasksTable)
      .values({
        id,
        title: task.title,
        description: task.description,
        status: task.status || "todo",
        priority: task.priority || "medium",
        dueDate: task.dueDate || null,
        agentId: task.agentId || null,
        assignedById: task.assignedById || null,
        collaboratorIds: task.collaboratorIds || null,
        taskType: task.taskType || "standard",
        parentTaskId: task.parentTaskId || null,
        metadata: task.metadata || null,
        createdAt: now,
        updatedAt: now
      })
      .returning();
    
    return newTask;
  }

  async updateTask(id: string, updates: UpdateTask): Promise<Task> {
    const [updatedTask] = await db.update(tasksTable)
      .set(updates)
      .where(eq(tasksTable.id, id))
      .returning();
    
    if (!updatedTask) {
      throw new Error(`Task with id ${id} not found`);
    }
    
    return updatedTask;
  }

  async getAgentTasks(agentId: string): Promise<Task[]> {
    return await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.agentId, agentId));
  }

  async getCollaborativeTasks(agentId: string): Promise<Task[]> {
    // Get tasks where agent is in the collaboratorIds list
    const allTasks = await db.select().from(tasksTable);
    return allTasks.filter(task => 
      task.collaboratorIds && task.collaboratorIds.split(',').includes(agentId)
    );
  }

  async getTasksByType(taskType: string): Promise<Task[]> {
    return await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.taskType, taskType));
  }

  async getSubtasks(parentTaskId: string): Promise<Task[]> {
    return await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.parentTaskId, parentTaskId));
  }

  async addAgentCollaborator(taskId: string, agentId: string): Promise<Task> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task with id ${taskId} not found`);
    }
    
    // Create or update the list of collaboratorIds
    let collaborators: string[] = [];
    if (task.collaboratorIds) {
      collaborators = task.collaboratorIds.split(',');
      // Only add the agent if they're not already a collaborator
      if (!collaborators.includes(agentId)) {
        collaborators.push(agentId);
      }
    } else {
      collaborators = [agentId];
    }
    
    // Update the task with the new collaborators list
    const [updatedTask] = await db.update(tasksTable)
      .set({ 
        collaboratorIds: collaborators.join(','),
        taskType: "collaboration",
        updatedAt: new Date()
      })
      .where(eq(tasksTable.id, taskId))
      .returning();
    
    return updatedTask;
  }

  async assignTaskToAgent(taskId: string, agentId: string, assignedById: string): Promise<Task> {
    const [updatedTask] = await db.update(tasksTable)
      .set({ 
        agentId: agentId,
        assignedById: assignedById,
        taskType: "delegated",
        updatedAt: new Date()
      })
      .where(eq(tasksTable.id, taskId))
      .returning();

    if (!updatedTask) {
      throw new Error(`Task with id ${taskId} not found`);
    }
    
    return updatedTask;
  }

  async createSubtask(parentTaskId: string, subtask: InsertTask): Promise<Task> {
    // Generate a unique ID
    const id = `task_${Date.now()}`;
    const now = new Date();

    // Create the subtask with the parentTaskId reference
    const [newTask] = await db.insert(tasksTable)
      .values({
        id,
        title: subtask.title,
        description: subtask.description,
        status: subtask.status || "todo",
        priority: subtask.priority || "medium",
        dueDate: subtask.dueDate || null,
        agentId: subtask.agentId || null,
        assignedById: subtask.assignedById || null,
        parentTaskId: parentTaskId,
        taskType: "subtask",
        createdAt: now,
        updatedAt: now
      })
      .returning();
    
    return newTask;
  }

  // Message operations
  async getAgentMessages(agentId: string): Promise<Message[]> {
    return await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.agentId, agentId))
      .orderBy(messagesTable.timestamp);
  }

  async getTaskMessages(taskId: string): Promise<Message[]> {
    return await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.taskId, taskId))
      .orderBy(messagesTable.timestamp);
  }

  async getConversationMessages(conversationId: string): Promise<Message[]> {
    return await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(messagesTable.timestamp);
  }

  async addAgentMessage(message: InsertMessage): Promise<Message> {
    // Generate a unique ID
    const id = `msg_${Date.now()}`;
    const now = new Date();
    
    // Create message with specific field mappings
    const [newMessage] = await db.insert(messagesTable)
      .values({
        id,
        role: message.role,
        content: message.content,
        agentId: message.agentId,
        taskId: message.taskId || null,
        conversationId: message.conversationId || null,
        metadata: message.metadata || null,
        referencedAgentIds: message.referencedAgentIds || null,
        timestamp: message.timestamp ? new Date(message.timestamp) : now
      })
      .returning();
    
    return newMessage;
  }

  async addCollaborativeMessage(message: InsertMessage): Promise<Message> {
    // Generate a unique ID
    const id = `msg_${Date.now()}`;
    const now = new Date();
    
    // If this is a collaborative message and no conversationId is provided,
    // generate one to group related messages together
    const conversationId = message.conversationId || `conv_${Date.now()}`;
    
    // Create collaborative message
    const [newMessage] = await db.insert(messagesTable)
      .values({
        id,
        role: message.role,
        content: message.content,
        agentId: message.agentId,
        taskId: message.taskId,
        conversationId: conversationId,
        metadata: message.metadata || null,
        referencedAgentIds: message.referencedAgentIds,
        timestamp: message.timestamp ? new Date(message.timestamp) : now
      })
      .returning();
    
    return newMessage;
  }

  // Integration operations
  async getIntegrations(): Promise<Integration[]> {
    return await db.select().from(integrationsTable);
  }

  async connectIntegration(type: string): Promise<Integration> {
    // In a real app, this would connect to the actual integration
    // For now, we'll just create a placeholder integration
    let name, details, icon, status;
    
    switch (type) {
      case "notion":
        name = "Notion";
        details = "Connected workspace";
        icon = "ri-notion-line";
        status = "connected";
        break;
      case "gmail":
        name = "Gmail";
        details = "Connected account";
        icon = "ri-mail-line";
        status = "connected";
        break;
      case "google-sheets":
        name = "Google Sheets";
        details = "Connected sheet";
        icon = "ri-file-list-3-line";
        status = "connected";
        break;
      case "zapier":
        name = "Zapier";
        details = "Connected account";
        icon = "ri-flashlight-line";
        status = "connected";
        break;
      default:
        name = "New Integration";
        details = "Connected service";
        icon = "ri-link";
        status = "connected";
    }
    
    // Generate a unique ID
    const id = `integration_${Date.now()}`;
    
    const [newIntegration] = await db.insert(integrationsTable)
      .values({
        id,
        name,
        type: type || "other",
        status,
        details,
        icon,
      })
      .returning();
    
    return newIntegration;
  }

  private async createIntegration(integration: InsertIntegration): Promise<Integration> {
    // Generate a unique ID
    const id = `integration_${Date.now()}`;
    
    const [newIntegration] = await db.insert(integrationsTable)
      .values({
        id,
        name: integration.name,
        type: integration.type,
        status: integration.status,
        details: integration.details || null,
        icon: integration.icon || null
      })
      .returning();
    
    return newIntegration;
  }
}

export const storage = new DatabaseStorage();
