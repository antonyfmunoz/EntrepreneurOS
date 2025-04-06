import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Agents
export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  icon: text("icon").default("ri-robot-line"),
  instructions: text("instructions"),
  brainContent: text("brain_content"),
  latestActivity: text("latest_activity"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAgentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().min(1, "Role is required"),
  icon: z.string().optional(),
  instructions: z.string().optional(),
  brainSources: z.array(
    z.object({
      type: z.string(),
      url: z.string().optional(),
      content: z.string().optional(),
    })
  ).optional(),
});

// Tasks
export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").default("todo"),
  dueDate: text("due_date"),
  agentId: text("agent_id").references(() => agents.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  status: z.enum(["todo", "in-progress", "done"]).default("todo"),
  dueDate: z.string().optional(),
  agentId: z.string().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().min(1, "Description is required").optional(),
  status: z.enum(["todo", "in-progress", "done"]).optional(),
  dueDate: z.string().optional(),
  agentId: z.string().optional(),
});

// Messages
export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").references(() => agents.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertMessageSchema = z.object({
  agentId: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.string(),
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
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Integration = typeof integrations.$inferSelect;
