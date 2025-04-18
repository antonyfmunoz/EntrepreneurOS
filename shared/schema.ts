import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  avatar: text("avatar"),
  company: text("company"),
  role: text("role"),
  firebaseUid: text("firebase_uid").unique(), // Firebase User ID for Google Auth
  preferences: text("preferences"), // JSON string for user preferences
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email address"),
  fullName: z.string().optional(),
  avatar: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  firebaseUid: z.string().optional(), // Firebase User ID for Google Auth
  preferences: z.record(z.unknown()).optional(),
});

// Agents
export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),                      // Job title (e.g., "Marketing Specialist")
  roleLevel: text("role_level").default("laborer"),  // Chief, Manager, Laborer
  department: text("department").default("general"), // Marketing, Sales, Operations, etc.
  icon: text("icon").default("ri-robot-line"),
  instructions: text("instructions"),
  brainContent: text("brain_content"),
  knowledgeBase: text("knowledge_base"),             // Generated or uploaded knowledge
  kpis: text("kpis"),                                // Key Performance Indicators as JSON
  behavioralStyle: text("behavioral_style"),         // Agent's work style/personality
  latestActivity: text("latest_activity"),
  isActive: boolean("is_active").default(true),      // Whether agent is active or disabled
  simulationMode: boolean("simulation_mode").default(false), // If agent is in simulation mode
  parentAgentId: text("parent_agent_id"),            // For hierarchy, manually create relation
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAgentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().min(1, "Role is required"),
  roleLevel: z.enum(["chief", "manager", "laborer"]).default("laborer"),
  department: z.string().min(1, "Department is required"),
  icon: z.string().optional(),
  instructions: z.string().optional(),
  kpis: z.array(z.string()).optional(),
  behavioralStyle: z.string().optional(),
  isActive: z.boolean().optional(),
  simulationMode: z.boolean().optional(),
  parentAgentId: z.string().optional(),
  brainSources: z.array(
    z.object({
      type: z.enum(["url", "text", "file", "auto-generate"]),
      url: z.string().optional(),
      content: z.string().optional(),
    })
  ).optional(),
});

// Define Tasks table
export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").default("todo"),
  priority: text("priority").default("medium"),
  dueDate: text("due_date"),
  agentId: text("agent_id").references(() => agents.id),
  assignedById: text("assigned_by_id").references(() => agents.id),
  collaboratorIds: text("collaborator_ids"), // Comma-separated list of agent IDs
  taskType: text("task_type").default("standard"), // standard, collaboration, delegated
  parentTaskId: text("parent_task_id"), // For subtasks
  metadata: text("metadata"), // JSON string for additional task data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  status: z.enum(["todo", "in-progress", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueDate: z.string().optional(),
  agentId: z.string().optional(),
  assignedById: z.string().optional(),
  collaboratorIds: z.string().optional(), // Comma-separated agent IDs
  taskType: z.enum(["standard", "collaboration", "delegated"]).default("standard"),
  parentTaskId: z.string().optional(),
  metadata: z.string().optional(), // JSON string
});

export const updateTaskSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().min(1, "Description is required").optional(),
  status: z.enum(["todo", "in-progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueDate: z.string().optional(),
  agentId: z.string().optional(),
  assignedById: z.string().optional(),
  collaboratorIds: z.string().optional(),
  taskType: z.enum(["standard", "collaboration", "delegated"]).optional(),
  parentTaskId: z.string().optional(),
  metadata: z.string().optional(),
});

// Messages
export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").references(() => agents.id),
  taskId: text("task_id").references(() => tasks.id),  // Optional task context
  conversationId: text("conversation_id"),  // Group messages by conversation
  role: text("role").notNull(),
  content: text("content").notNull(),
  metadata: text("metadata"),  // Store additional message data (e.g., attachments, citations)
  referencedAgentIds: text("referenced_agent_ids"), // If message mentions/references other agents
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertMessageSchema = z.object({
  agentId: z.string(),
  taskId: z.string().optional(),
  conversationId: z.string().optional(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  metadata: z.string().optional(),
  referencedAgentIds: z.string().optional(), // Comma-separated list of agent IDs
  timestamp: z.string().optional(),
});

// Integrations
export const integrations = pgTable("integrations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").default("disconnected"),
  details: text("details"),
  icon: text("icon"),
});

export const insertIntegrationSchema = z.object({
  name: z.string(),
  type: z.string(),
  status: z.enum(["connected", "disconnected"]).default("disconnected"),
  details: z.string().optional(),
  icon: z.string().optional(),
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Integration = typeof integrations.$inferSelect;

// Notifications
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull(), // task-assigned, agent-created, integration-connected, etc.
  read: boolean("read").default(false),
  href: text("href"), // URL path for navigation when clicking the notification
  relatedId: text("related_id"), // ID of the related entity (task, agent, integration)
  metadata: jsonb("metadata"), // Additional data as JSON
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = z.object({
  userId: z.string(),
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  type: z.string().min(1, "Type is required"),
  read: z.boolean().optional(),
  href: z.string().optional(),
  relatedId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// AI Assistant Messages
export const aiMessages = pgTable("ai_messages", {
  id: text("id").primaryKey().notNull(),
  role: text("role").notNull(), // "user" or "assistant"
  content: text("content").notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertAiMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  userId: z.string(),
  timestamp: z.date().optional(),
});

export type InsertAiMessage = z.infer<typeof insertAiMessageSchema>;
export type AiMessage = typeof aiMessages.$inferSelect;
