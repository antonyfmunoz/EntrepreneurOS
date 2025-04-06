import { 
  agents as agentsTable, 
  tasks as tasksTable, 
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

  // Message operations
  getAgentMessages(agentId: string): Promise<Message[]>;
  addAgentMessage(message: InsertMessage): Promise<Message>;

  // Integration operations
  getIntegrations(): Promise<Integration[]>;
  connectIntegration(type: string): Promise<Integration>;
}

export class MemStorage implements IStorage {
  private agents: Map<string, Agent>;
  private tasks: Map<string, Task>;
  private messages: Map<string, Message>;
  private integrations: Map<string, Integration>;
  private agentIdCounter: number;
  private taskIdCounter: number;
  private messageIdCounter: number;
  private integrationIdCounter: number;

  constructor() {
    this.agents = new Map();
    this.tasks = new Map();
    this.messages = new Map();
    this.integrations = new Map();
    this.agentIdCounter = 1;
    this.taskIdCounter = 1;
    this.messageIdCounter = 1;
    this.integrationIdCounter = 1;

    // Initialize with sample data
    this.initSampleData();
  }

  private initSampleData() {
    // Sample agents
    const marketingAgent = this.createAgent({
      name: "Marketing Agent",
      role: "marketing",
      icon: "ri-megaphone-line",
      instructions: "Help with marketing campaigns, social media, and content strategy.",
      brainSources: [],
    });

    const supportAgent = this.createAgent({
      name: "Support Agent",
      role: "support",
      icon: "ri-customer-service-2-line",
      instructions: "Assist with customer inquiries, troubleshooting, and support tickets.",
      brainSources: [],
    });

    const contentAgent = this.createAgent({
      name: "Content Agent",
      role: "content",
      icon: "ri-article-line",
      instructions: "Create and optimize content for blogs, social media, and website.",
      brainSources: [],
    });

    const opsAgent = this.createAgent({
      name: "Operations Agent",
      role: "operations",
      icon: "ri-user-settings-line",
      instructions: "Streamline operations, track KPIs, and generate reports.",
      brainSources: [],
    });

    // Sample tasks
    this.createTask({
      title: "Update website copy",
      description: "Review and update the website copy for the new product launch.",
      status: "todo",
      dueDate: this.getFutureDate(2),
      agentId: contentAgent.id,
    });

    this.createTask({
      title: "Create sales presentation",
      description: "Prepare sales presentation for client meeting.",
      status: "todo", 
      dueDate: this.getFutureDate(1),
      agentId: marketingAgent.id,
    });

    this.createTask({
      title: "Schedule social media posts",
      description: "Create and schedule posts for the week across all platforms.",
      status: "in-progress",
      dueDate: this.getTodayDate(),
      agentId: marketingAgent.id,
    });

    this.createTask({
      title: "Draft weekly blog post",
      description: "Write blog post on industry trends and updates.",
      status: "in-progress",
      dueDate: this.getFutureDate(3),
      agentId: contentAgent.id,
    });

    this.createTask({
      title: "Review support tickets",
      description: "Review and prioritize open support tickets.",
      status: "in-progress",
      dueDate: this.getTodayDate(),
      agentId: supportAgent.id,
    });

    this.createTask({
      title: "Create product descriptions",
      description: "Write compelling descriptions for new product line.",
      status: "done",
      dueDate: this.getPastDate(1),
      agentId: contentAgent.id,
    });

    this.createTask({
      title: "Analyze campaign metrics",
      description: "Review performance metrics from last campaign.",
      status: "done",
      dueDate: this.getPastDate(2),
      agentId: marketingAgent.id,
    });

    // Update latest activities
    this.updateAgentActivity(marketingAgent.id, "Created social media post for product launch");
    this.updateAgentActivity(supportAgent.id, "Drafted response for customer inquiry #1293");
    this.updateAgentActivity(contentAgent.id, "Outlined new blog post on industry trends");
    this.updateAgentActivity(opsAgent.id, "Generated monthly operations report");

    // Sample integrations
    this.createIntegration({
      name: "Notion",
      type: "notion",
      status: "connected",
      details: "3 workspaces",
      icon: "ri-notion-line",
    });

    this.createIntegration({
      name: "Gmail",
      type: "gmail",
      status: "connected",
      details: "example@gmail.com",
      icon: "ri-mail-line",
    });

    this.createIntegration({
      name: "Google Sheets",
      type: "google-sheets",
      status: "connected",
      details: "2 sheets",
      icon: "ri-file-list-3-line",
    });
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
    return Array.from(this.agents.values());
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    return this.agents.get(id);
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const id = `agent_${this.agentIdCounter++}`;
    const newAgent: Agent = { 
      ...agent, 
      id, 
      latestActivity: "Created agent",
      brainContent: "",
      createdAt: new Date().toISOString()
    };
    this.agents.set(id, newAgent);
    return newAgent;
  }

  async updateAgentActivity(id: string, activity: string): Promise<Agent | undefined> {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    
    const updatedAgent = { ...agent, latestActivity: activity };
    this.agents.set(id, updatedAgent);
    return updatedAgent;
  }

  // Task operations
  async getTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async createTask(task: InsertTask): Promise<Task> {
    const id = `task_${this.taskIdCounter++}`;
    const newTask: Task = { 
      ...task, 
      id, 
      createdAt: new Date().toISOString() 
    };
    this.tasks.set(id, newTask);
    return newTask;
  }

  async updateTask(id: string, updates: UpdateTask): Promise<Task> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task with id ${id} not found`);
    }
    
    const updatedTask = { ...task, ...updates };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  async getAgentTasks(agentId: string): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter(task => task.agentId === agentId);
  }

  // Message operations
  async getAgentMessages(agentId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.agentId === agentId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async addAgentMessage(message: InsertMessage): Promise<Message> {
    const id = `msg_${this.messageIdCounter++}`;
    const newMessage: Message = { ...message, id };
    this.messages.set(id, newMessage);
    return newMessage;
  }

  // Integration operations
  async getIntegrations(): Promise<Integration[]> {
    return Array.from(this.integrations.values());
  }

  async connectIntegration(type: string): Promise<Integration> {
    // In a real app, this would connect to the actual integration
    // For now, we'll just create a placeholder integration
    const id = `integration_${this.integrationIdCounter++}`;
    
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
    
    const newIntegration: Integration = {
      id,
      name,
      type: type || "other",
      status: "connected",
      details,
      icon,
    };
    
    this.integrations.set(id, newIntegration);
    return newIntegration;
  }

  private createIntegration(integration: InsertIntegration): Integration {
    const id = `integration_${this.integrationIdCounter++}`;
    const newIntegration: Integration = { ...integration, id };
    this.integrations.set(id, newIntegration);
    return newIntegration;
  }
}

export const storage = new MemStorage();
