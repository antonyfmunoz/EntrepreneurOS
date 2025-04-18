import { 
  agents as agentsTable, 
  tasks as tasksTable, 
  messages as messagesTable,
  integrations as integrationsTable,
  users as usersTable,
  notifications as notificationsTable,
  aiMessages,
  type Agent, 
  type Task, 
  type InsertAgent, 
  type InsertTask, 
  type UpdateTask,
  type Message,
  type InsertMessage,
  type Integration,
  type InsertIntegration,
  type User,
  type InsertUser,
  type Notification,
  type InsertNotification,
  type AiMessage,
  type InsertAiMessage
} from "@shared/schema";
import { db, client } from './db';
import { eq, and, desc, asc } from 'drizzle-orm';
import session from 'express-session';
import connectPg from 'connect-pg-simple';

export interface IStorage {
  // User operations
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  
  // Agent operations
  getAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, updates: Partial<InsertAgent>): Promise<Agent | undefined>;
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
  getAllMessages(): Promise<Message[]>; // Get all messages in the system
  clearAgentMessages(agentId: string): Promise<void>; // Clear all messages for an agent (New Chat functionality)
  addAgentMessage(message: InsertMessage): Promise<Message>;
  addCollaborativeMessage(message: InsertMessage): Promise<Message>; // Special handling for collaborative messages

  // Agent collaboration operations
  addAgentCollaborator(taskId: string, agentId: string): Promise<Task>; // Add an agent as collaborator to a task
  assignTaskToAgent(taskId: string, agentId: string, assignedById: string): Promise<Task>; // Assign task to a different agent
  createSubtask(parentTaskId: string, subtask: InsertTask): Promise<Task>; // Create a subtask linked to parent

  // Integration operations
  getIntegrations(): Promise<Integration[]>;
  connectIntegration(type: string): Promise<Integration>;
  
  // Notification operations
  getNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotificationsCount(userId: string): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  
  // AI Assistant operations
  getAiMessages(userId: string): Promise<AiMessage[]>;
  addAiMessage(message: InsertAiMessage): Promise<AiMessage>;
  clearAiMessages(userId: string): Promise<void>;
  
  // Session store
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  // Define the session store property
  sessionStore: session.Store;
  
  constructor() {
    // Create PostgreSQL session store
    const PostgresSessionStore = connectPg(session);
    
    // Initialize the session store with the PostgreSQL connection string
    this.sessionStore = new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL
      },
      createTableIfMissing: true,
      // Table configuration (optional)
      tableName: 'session',
      schemaName: 'public'
    });
    
    // Initialize with sample data if needed
    this.initSampleData().catch(err => {
      console.error("Error initializing sample data:", err);
    });
  }
  
  // User operations
  async getUsers(): Promise<User[]> {
    return await db.select().from(usersTable);
  }

  async getUser(id: string): Promise<User | undefined> {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return users.length > 0 ? users[0] : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const users = await db.select().from(usersTable).where(eq(usersTable.username, username));
    return users.length > 0 ? users[0] : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const users = await db.select().from(usersTable).where(eq(usersTable.email, email));
    return users.length > 0 ? users[0] : undefined;
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    if (!firebaseUid) return undefined;
    
    const users = await db.select().from(usersTable).where(eq(usersTable.firebaseUid, firebaseUid));
    return users.length > 0 ? users[0] : undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    // Generate a unique ID
    const id = `user_${Date.now()}`;
    const now = new Date();
    
    // Convert preferences to string if present
    const preferences = user.preferences ? JSON.stringify(user.preferences) : null;
    
    // Create user with specific field mappings
    const [newUser] = await db.insert(usersTable)
      .values({
        id,
        username: user.username,
        password: user.password,
        email: user.email,
        fullName: user.fullName || null,
        avatar: user.avatar || null,
        company: user.company || null,
        role: user.role || "user",
        firebaseUid: user.firebaseUid || null,
        preferences: preferences,
        createdAt: now,
        updatedAt: now
      })
      .returning();
    
    return newUser;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    // Handle preferences conversion for update
    const updateData: Record<string, any> = { ...updates, updatedAt: new Date() };
    
    // Convert preferences to string if present
    if (updates.preferences) {
      updateData.preferences = JSON.stringify(updates.preferences);
    }
    
    const [updatedUser] = await db.update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, id))
      .returning();
    
    if (!updatedUser) {
      throw new Error(`User with id ${id} not found`);
    }
    
    return updatedUser;
  }

  private async initSampleData(): Promise<void> {
    // Check if there are any agents first
    const existingAgents = await this.getAgents();
    
    // If we already have agents, only continue if there's no executive agent
    const hasExecutiveAgent = existingAgents.some(agent => agent.role === 'executive');
    
    if (existingAgents.length > 0 && hasExecutiveAgent) {
      // Executive agent exists, no need to initialize
      return;
    }
    
    // Remove any existing agents if we're reinitializing
    if (existingAgents.length > 0) {
      // Delete all existing agents and their associated data
      for (const agent of existingAgents) {
        // Delete tasks associated with this agent
        await db.delete(tasksTable)
          .where(eq(tasksTable.agentId, agent.id));
          
        // Delete messages associated with this agent  
        await db.delete(messagesTable)
          .where(eq(messagesTable.agentId, agent.id));
      }
      
      // Now delete all the agents
      await db.delete(agentsTable);
    }

    try {
      // Use a single timestamp for all items
      const timestamp = new Date();
      
      // Create only the Executive Agent - which will manage all other agents
      const executiveAgent = await db.insert(agentsTable)
        .values({
          id: "agent_executive",
          name: "Executive Agent",
          role: "executive",
          roleLevel: "chief",
          department: "Management",
          icon: "ri-user-star-line",
          instructions: "Lead and manage the team of AI agents, create and assign specialized agents for different business functions, coordinate agent collaboration, and ensure alignment with business goals and strategy.",
          latestActivity: "Created agent",
          brainContent: "",
          createdAt: timestamp,
          updatedAt: timestamp
        })
        .returning()
        .then(rows => rows[0]);

      // Sample tasks for the Executive Agent
      await db.insert(tasksTable)
        .values([
          {
            id: "task_1",
            title: "Create a Business Plan",
            description: "Develop a comprehensive business plan for the executive AI that outlines the strategy, goals, and execution plan for all users.",
            status: "todo",
            dueDate: this.getFutureDate(1),
            agentId: executiveAgent.id,
            priority: "high",
            taskType: "standard",
            createdAt: timestamp,
            updatedAt: timestamp
          },
          {
            id: "task_2",
            title: "Create Marketing Agent",
            description: "Configure and deploy a specialized marketing agent to handle content strategy and social media management.",
            status: "todo",
            dueDate: this.getFutureDate(3),
            agentId: executiveAgent.id,
            priority: "high",
            taskType: "standard",
            createdAt: timestamp,
            updatedAt: timestamp
          },
          {
            id: "task_3",
            title: "Create Content Agent",
            description: "Configure and deploy a specialized content agent to handle blog posts, website copy, and product descriptions.",
            status: "todo", 
            dueDate: this.getFutureDate(4),
            agentId: executiveAgent.id,
            priority: "medium",
            taskType: "standard",
            createdAt: timestamp,
            updatedAt: timestamp
          },
          {
            id: "task_4",
            title: "Develop Business Strategy",
            description: "Analyze market trends and develop a comprehensive business strategy for Q2.",
            status: "in-progress",
            dueDate: this.getTodayDate(),
            agentId: executiveAgent.id,
            priority: "medium",
            taskType: "standard",
            createdAt: timestamp,
            updatedAt: timestamp
          },
          {
            id: "task_5",
            title: "Configure Agent Collaboration",
            description: "Set up collaboration protocols between specialized agents to ensure coordinated actions.",
            status: "in-progress",
            dueDate: this.getFutureDate(5),
            agentId: executiveAgent.id,
            priority: "low",
            taskType: "standard",
            createdAt: timestamp,
            updatedAt: timestamp
          }
        ]);

      // Update latest activity for Executive Agent
      await db.update(agentsTable)
        .set({ 
          latestActivity: "Established business goals and agent delegation strategy",
          updatedAt: timestamp
        })
        .where(eq(agentsTable.id, executiveAgent.id));

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

  async updateAgent(id: string, updates: Partial<InsertAgent> & { latestActivity?: string }): Promise<Agent | undefined> {
    try {
      // Get the current agent to make sure it exists
      const existingAgent = await this.getAgent(id);
      if (!existingAgent) {
        return undefined;
      }
      
      // Create update object with only the valid fields for the agents table
      const updateData: Record<string, any> = {};
      
      // Map scalar fields directly
      if (updates.name) updateData.name = updates.name;
      if (updates.role) updateData.role = updates.role;
      if (updates.icon) updateData.icon = updates.icon;
      if (updates.instructions) updateData.instructions = updates.instructions;
      
      // Handle latestActivity which is in the table schema but not in InsertAgent type
      if ('latestActivity' in updates) {
        updateData.latestActivity = updates.latestActivity;
      }
      
      // Note: We're not updating the updatedAt field until we migrate the database
      
      // Update the agent in the database
      const [agent] = await db.update(agentsTable)
        .set(updateData)
        .where(eq(agentsTable.id, id))
        .returning();
      
      return agent;
    } catch (error) {
      console.error("Error updating agent:", error);
      return undefined;
    }
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
  
  async getAllMessages(): Promise<Message[]> {
    return await db.select().from(messagesTable).orderBy(messagesTable.timestamp);
  }

  async clearAgentMessages(agentId: string): Promise<void> {
    // Delete all messages for the specified agent
    await db.delete(messagesTable)
      .where(eq(messagesTable.agentId, agentId));
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

  // Notification operations
  async getNotifications(userId: string): Promise<Notification[]> {
    return await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt));
  }

  async getUnreadNotificationsCount(userId: string): Promise<number> {
    const notifications = await db.select({ read: notificationsTable.read })
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.read, false)
      ));
    return notifications.length;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = `notification_${Date.now()}`;
    
    const [newNotification] = await db.insert(notificationsTable)
      .values({
        id,
        userId: notification.userId,
        title: notification.title,
        content: notification.content,
        type: notification.type,
        read: notification.read || false,
        href: notification.href || null,
        relatedId: notification.relatedId || null,
        metadata: notification.metadata || null,
        createdAt: new Date()
      })
      .returning();
    
    return newNotification;
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    const [notification] = await db.update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.id, id))
      .returning();
    
    return notification;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.userId, userId));
  }

  // AI Assistant operations
  async getAiMessages(userId: string): Promise<AiMessage[]> {
    return await db.select().from(aiMessages)
      .where(eq(aiMessages.userId, userId))
      .orderBy(asc(aiMessages.timestamp));
  }

  async addAiMessage(message: InsertAiMessage): Promise<AiMessage> {
    const id = message.id || `ai_msg_${Date.now()}`;
    const timestamp = message.timestamp || new Date();
    
    const [newMessage] = await db.insert(aiMessages)
      .values({
        id,
        role: message.role,
        content: message.content,
        userId: message.userId,
        timestamp
      })
      .returning();
    
    return newMessage;
  }

  async clearAiMessages(userId: string): Promise<void> {
    await db.delete(aiMessages)
      .where(eq(aiMessages.userId, userId));
  }
}

export const storage = new DatabaseStorage();
