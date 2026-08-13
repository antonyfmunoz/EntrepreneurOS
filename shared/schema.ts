import { sql } from "drizzle-orm";
import { check, index, pgTable, primaryKey, text, serial, integer, boolean, timestamp, json, jsonb, decimal, uniqueIndex, varchar } from "drizzle-orm/pg-core";
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
  clerkUserId: text("clerk_user_id").unique(), // Clerk User ID for OAuth
  preferences: text("preferences"), // JSON string for user preferences
  metadata: jsonb("metadata"), // For storing miscellaneous user data like notification preferences
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
  clerkUserId: z.string().optional(), // Clerk User ID for OAuth
  preferences: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(), // Store metadata like notification preferences
});

// Agents
export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  // Nullable for legacy records; federation rejects unscoped agents.
  companyId: integer("company_id"),
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
  startDate: text("start_date"),
  dueDate: text("due_date"),
  instructions: text("instructions"),
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
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  instructions: z.string().optional(),
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
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  instructions: z.string().optional(),
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

export const supportTickets = pgTable("support_tickets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  requestId: text("request_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const createSupportTicketSchema = z.object({
  category: z.enum(["account", "technical", "integration", "feedback", "security", "other"]),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(10_000),
});

export type SupportTicket = typeof supportTickets.$inferSelect;
export type CreateSupportTicket = z.infer<typeof createSupportTicketSchema>;

export const billingSubscriptions = pgTable("billing_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerCustomerId: text("provider_customer_id").notNull(),
  providerSubscriptionId: text("provider_subscription_id").notNull().unique(),
  planKey: text("plan_key").notNull(),
  status: text("status").notNull(),
  entitlements: jsonb("entitlements").notNull().default([]),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const billingWebhookEvents = pgTable("billing_webhook_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  payloadHash: text("payload_hash").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const legalDocuments = pgTable("legal_documents", {
  id: text("id").primaryKey(),
  documentType: text("document_type").notNull(),
  title: text("title").notNull(),
  version: text("version").notNull(),
  url: text("url").notNull(),
  checksum: text("checksum").notNull(),
  required: boolean("required").notNull().default(true),
  status: text("status").notNull().default("published"),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});

export const legalAcceptances = pgTable("legal_acceptances", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => legalDocuments.id),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  documentChecksum: text("document_checksum").notNull(),
  ipHash: text("ip_hash").notNull(),
  userAgentHash: text("user_agent_hash").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountDeletionRequests = pgTable("account_deletion_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  clerkUserId: text("clerk_user_id"),
  status: text("status").notNull().default("scheduled"),
  deleteOwnedOrganizations: boolean("delete_owned_organizations").notNull().default(false),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
});

export const aiBudgets = pgTable("ai_budgets", {
  companyId: integer("company_id").primaryKey().references(() => companies.id, { onDelete: "cascade" }),
  monthlyLimitMicros: integer("monthly_limit_micros").notNull(),
  perRequestLimitMicros: integer("per_request_limit_micros").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  updatedByUserId: text("updated_by_user_id").notNull().references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiUsageLedger = pgTable("ai_usage_ledger", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  context: text("context").notNull(),
  model: text("model").notNull(),
  status: text("status").notNull().default("reserved"),
  reservedCostMicros: integer("reserved_cost_micros").notNull(),
  actualCostMicros: integer("actual_cost_micros"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const operationalControls = pgTable("operational_controls", {
  controlKey: text("control_key").primaryKey(),
  status: text("status").notNull(),
  evidenceUri: text("evidence_uri").notNull(),
  evidenceHash: text("evidence_hash").notNull(),
  evidenceScope: text("evidence_scope").notNull().default("production"),
  subject: text("subject").notNull().default("legacy-unspecified"),
  notes: text("notes"),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const operationalControlEvidenceHistory = pgTable("operational_control_evidence_history", {
  id: text("id").primaryKey(),
  controlKey: text("control_key").notNull().references(() => operationalControls.controlKey),
  status: text("status").notNull(),
  evidenceUri: text("evidence_uri").notNull(),
  evidenceHash: text("evidence_hash").notNull(),
  evidenceScope: text("evidence_scope").notNull(),
  subject: text("subject").notNull(),
  notes: text("notes"),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vendorRegistry = pgTable("vendor_registry", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  serviceCategory: text("service_category").notNull(),
  riskTier: text("risk_tier").notNull(),
  status: text("status").notNull(),
  dataClasses: jsonb("data_classes").notNull().default([]),
  dpaStatus: text("dpa_status").notNull(),
  subprocessorStatus: text("subprocessor_status").notNull(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id),
  reviewEvidenceUri: text("review_evidence_uri"),
  exitPlan: text("exit_plan").notNull(),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const serviceOwnership = pgTable("service_ownership", {
  serviceKey: text("service_key").primaryKey(),
  displayName: text("display_name").notNull(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id),
  backupOwnerUserId: text("backup_owner_user_id").references(() => users.id),
  onCallReference: text("on_call_reference").notNull(),
  escalationReference: text("escalation_reference"),
  availabilityTarget: text("availability_target").notNull(),
  latencyTarget: text("latency_target").notNull(),
  errorBudgetPolicy: text("error_budget_policy").notNull(),
  incidentRunbookUri: text("incident_runbook_uri").notNull(),
  accessReviewEvidenceUri: text("access_review_evidence_uri"),
  accessReviewedAt: timestamp("access_reviewed_at", { withTimezone: true }),
  nextAccessReviewAt: timestamp("next_access_review_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type Task = typeof tasks.$inferSelect & { subtasks?: Task[] };

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

// CRM - Contacts
export const crmContacts = pgTable("crm_contacts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  title: text("title"),
  status: text("status").default("lead"), // lead, prospect, customer, churned
  lastContact: timestamp("last_contact"),
  notes: text("notes"),
  avatar: text("avatar"),
  userId: text("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCrmContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  status: z.enum(["lead", "prospect", "customer", "churned"]).default("lead"),
  lastContact: z.date().optional(),
  notes: z.string().optional(),
  avatar: z.string().optional(),
  userId: z.string(),
});

// CRM - Deals
export const crmDeals = pgTable("crm_deals", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  stage: text("stage").default("discovery"), // discovery, proposal, negotiation, closed-won, closed-lost
  probability: integer("probability").default(50),
  expectedCloseDate: timestamp("expected_close_date"),
  contactId: text("contact_id").references(() => crmContacts.id),
  assignedAgentId: text("assigned_agent_id").references(() => agents.id),
  notes: text("notes"),
  userId: text("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCrmDealSchema = z.object({
  title: z.string().min(1, "Title is required"),
  company: z.string().min(1, "Company is required"),
  value: z.number().positive("Value must be positive"),
  stage: z.enum(["discovery", "proposal", "negotiation", "closed-won", "closed-lost"]).default("discovery"),
  probability: z.number().min(0).max(100).default(50),
  expectedCloseDate: z.date().optional(),
  contactId: z.string(),
  assignedAgentId: z.string().optional(),
  notes: z.string().optional(),
  userId: z.string(),
});

// CRM - Activities
export const crmActivities = pgTable("crm_activities", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // email, call, meeting, task, note
  subject: text("subject").notNull(),
  date: timestamp("date").notNull(),
  relatedToType: text("related_to_type").notNull(), // contact, deal
  relatedToId: text("related_to_id").notNull(),
  completed: boolean("completed").default(false),
  notes: text("notes"),
  createdByAgentId: text("created_by_agent_id").references(() => agents.id),
  userId: text("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCrmActivitySchema = z.object({
  type: z.enum(["email", "call", "meeting", "task", "note"]),
  subject: z.string().min(1, "Subject is required"),
  date: z.date(),
  relatedToType: z.enum(["contact", "deal"]),
  relatedToId: z.string(),
  completed: z.boolean().default(false),
  notes: z.string().optional(),
  createdByAgentId: z.string().optional(),
  userId: z.string(),
});

// Export CRM types
export type InsertCrmContact = z.infer<typeof insertCrmContactSchema>;
export type CrmContact = typeof crmContacts.$inferSelect;

export type InsertCrmDeal = z.infer<typeof insertCrmDealSchema>;
export type CrmDeal = typeof crmDeals.$inferSelect;

export type InsertCrmActivity = z.infer<typeof insertCrmActivitySchema>;
export type CrmActivity = typeof crmActivities.$inferSelect;

// Folders table
export const folders = pgTable("folders", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  parentId: text("parent_id").references((): any => folders.id),
  userId: text("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required"),
  parentId: z.string().optional(),
  userId: z.string(),
});

export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type Folder = typeof folders.$inferSelect;

// Documents table
export const documents = pgTable("documents", {
  id: text("id").primaryKey().notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  folderId: text("folder_id").references(() => folders.id),
  tags: text("tags").array(),
  userId: text("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDocumentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string(),
  folderId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  userId: z.string(),
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export const agentActions = pgTable("agent_actions", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Federation commands are always bound to a company. Legacy actions may be null
  // until they are backfilled, but they are never eligible for UMH execution.
  companyId: integer("company_id"),
  actionType: text("action_type").notNull(),
  actionName: text("action_name").notNull(),
  description: text("description"),
  parameters: jsonb("parameters").notNull(),
  status: text("status").notNull().default("pending"),
  requiresApproval: boolean("requires_approval").notNull().default(true),
  approvedBy: text("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  executedAt: timestamp("executed_at"),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  executionResult: jsonb("execution_result"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  taskId: text("task_id").references(() => tasks.id),
  conversationId: text("conversation_id"),
  estimatedTimeSaved: integer("estimated_time_saved"),
  priority: text("priority").default("medium"),
  tags: text("tags").array(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAgentActionSchema = z.object({
  agentId: z.string(),
  userId: z.string(),
  actionType: z.string(),
  actionName: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.unknown()),
  status: z.enum(["pending", "approved", "executing", "completed", "failed", "rejected"]).default("pending"),
  requiresApproval: z.boolean().default(true),
  taskId: z.string().optional(),
  conversationId: z.string().optional(),
  estimatedTimeSaved: z.number().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type InsertAgentAction = z.infer<typeof insertAgentActionSchema>;
export type AgentAction = typeof agentActions.$inferSelect;

export const oauthTokens = pgTable("oauth_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenType: text("token_type"),
  expiresAt: timestamp("expires_at"),
  scope: text("scope"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOauthTokenSchema = z.object({
  userId: z.string(),
  provider: z.string(),
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  tokenType: z.string().optional(),
  expiresAt: z.date().optional(),
  scope: z.string().optional(),
});

export type InsertOauthToken = z.infer<typeof insertOauthTokenSchema>;
export type OauthToken = typeof oauthTokens.$inferSelect;

export const agentMetrics = pgTable("agent_metrics", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  messagesSent: integer("messages_sent").default(0),
  messagesReceived: integer("messages_received").default(0),
  tasksCompleted: integer("tasks_completed").default(0),
  actionsExecuted: integer("actions_executed").default(0),
  tokensUsed: integer("tokens_used").default(0),
  apiCost: text("api_cost").default("0"),
  estimatedTimeSavedMinutes: integer("estimated_time_saved_minutes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAgentMetricSchema = z.object({
  agentId: z.string(),
  userId: z.string(),
  date: z.string(),
  messagesSent: z.number().default(0),
  messagesReceived: z.number().default(0),
  tasksCompleted: z.number().default(0),
  actionsExecuted: z.number().default(0),
  tokensUsed: z.number().default(0),
  apiCost: z.string().default("0"),
  estimatedTimeSavedMinutes: z.number().default(0),
});

export type InsertAgentMetric = z.infer<typeof insertAgentMetricSchema>;
export type AgentMetric = typeof agentMetrics.$inferSelect;

// Portfolios — a portfolio groups related companies under a single owner.
// One user can have many portfolios, each containing many companies.
export const portfolios = pgTable("portfolios", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPortfolioSchema = z.object({
  name: z.string().min(1, "Portfolio name is required"),
  description: z.string().optional(),
});

export const updatePortfolioSchema = z.object({
  name: z.string().min(1, "Portfolio name is required").optional(),
  description: z.string().optional().nullable(),
});

export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type UpdatePortfolio = z.infer<typeof updatePortfolioSchema>;
export type Portfolio = typeof portfolios.$inferSelect;

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  type: text("type"),
  stage: text("stage"),
  offer: text("offer"),
  targetCustomer: text("target_customer"),
  goals: text("goals"),
  assistantName: text("assistant_name").default("Assistant"),
  founderProfile: jsonb("founder_profile").notNull().default({}),
  orgId: text("org_id"),  // Clerk organization ID — nullable for single-user companies
  createdAt: timestamp("created_at").defaultNow()
});

export type InsertCompany = typeof companies.$inferInsert;
export type Company = typeof companies.$inferSelect;

export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

export const workflows = pgTable("workflows", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  companyId: integer("company_id").references(() => companies.id),
  status: text("status").default("active"), // active, paused
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWorkflowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  companyId: z.number(),
  status: z.enum(["active", "paused"]).default("active"),
});

export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;

// UMH federation is projection-owned: UMH never reads or writes these records
// directly. They provide the local installation binding, idempotency ledger,
// transactional outbox, immutable outcomes, and audit trail for HTTPS commands.
export const umhInstallations = pgTable("umh_installations", {
  id: text("id").primaryKey(),
  umhInstallationId: text("umh_installation_id").notNull().unique(),
  issuer: text("issuer").notNull(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  capabilities: jsonb("capabilities").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Canonical migration ledger. The runner creates this defensively for legacy
// databases, but it must also live in the Drizzle schema so a later `db:push`
// cannot treat it as an unknown table and erase checksum history.
export const eosSchemaMigrations = pgTable("eos_schema_migrations", {
  id: text("id").primaryKey(),
  checksum: text("checksum").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});

// This production protection table must be represented in the Drizzle schema
// as well as migrations. Otherwise a later `db:push` can erase the table while
// the checksum ledger still records its migration as applied.
export const eosRateLimitWindows = pgTable("eos_rate_limit_windows", {
  namespace: text("namespace").notNull(),
  identityHash: text("identity_hash").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.namespace, table.identityHash, table.windowStart] }),
  index("eos_rate_limit_windows_expires_at_idx").on(table.expiresAt),
  check("eos_rate_limit_windows_count_check", sql`${table.count} >= 0`),
]);

export const umhIdentityBindings = pgTable("umh_identity_bindings", {
  id: text("id").primaryKey(),
  installationId: text("installation_id").notNull().references(() => umhInstallations.id, { onDelete: "cascade" }),
  externalActorId: text("external_actor_id").notNull(),
  localUserId: text("local_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  delegationId: text("delegation_id").notNull(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const umhCommands = pgTable("umh_commands", {
  id: text("id").primaryKey(),
  installationId: text("installation_id").notNull().references(() => umhInstallations.id, { onDelete: "cascade" }),
  commandType: text("command_type").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  nonce: text("nonce").notNull(),
  requestHash: text("request_hash").notNull(),
  traceId: text("trace_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  actorUserId: text("actor_user_id").notNull().references(() => users.id),
  companyId: integer("company_id").notNull().references(() => companies.id),
  workPacketId: text("work_packet_id").references(() => eosWorkPackets.id, { onDelete: "set null" }),
  approvalId: text("approval_id").references(() => eosApprovalRequests.id, { onDelete: "set null" }),
  status: text("status").notNull(),
  outcome: jsonb("outcome").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const umhEventOutbox = pgTable("umh_event_outbox", {
  id: text("id").primaryKey(),
  installationId: text("installation_id").notNull().references(() => umhInstallations.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at").defaultNow(),
  leasedAt: timestamp("leased_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const umhAuditRecords = pgTable("umh_audit_records", {
  id: text("id").primaryKey(),
  installationId: text("installation_id").notNull().references(() => umhInstallations.id, { onDelete: "cascade" }),
  commandId: text("command_id").references(() => umhCommands.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  traceId: text("trace_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  actorUserId: text("actor_user_id").references(() => users.id),
  details: jsonb("details").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// EOS overlay MVP runtime. These records are authoritative local state even
// when every provider integration and UMH are offline.
export const eosManifestVersions = pgTable("eos_manifest_versions", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  status: text("status").notNull().default("draft"),
  manifest: jsonb("manifest").notNull(),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
  approvedByUserId: text("approved_by_user_id").references(() => users.id),
  activatedAt: timestamp("activated_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const eosWorkPackets = pgTable("eos_work_packets", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
  accountableUserId: text("accountable_user_id").notNull().references(() => users.id),
  accountableSeatId: text("accountable_seat_id"),
  title: text("title").notNull(),
  objective: text("objective").notNull(),
  status: text("status").notNull().default("draft"),
  priority: text("priority").notNull().default("medium"),
  source: text("source").notNull().default("manual"),
  visibility: text("visibility").notNull().default("company"),
  classification: text("classification").notNull().default("internal"),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  toolPack: jsonb("tool_pack").notNull().default([]),
  evidenceRequirements: jsonb("evidence_requirements").notNull().default([]),
  traceId: text("trace_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  dueAt: timestamp("due_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const eosApprovalRequests = pgTable("eos_approval_requests", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  workPacketId: text("work_packet_id").notNull().references(() => eosWorkPackets.id, { onDelete: "cascade" }),
  requestedByUserId: text("requested_by_user_id").notNull().references(() => users.id),
  assignedToUserId: text("assigned_to_user_id").notNull().references(() => users.id),
  assignedToSeatId: text("assigned_to_seat_id"),
  summary: text("summary").notNull(),
  status: text("status").notNull().default("pending"),
  decisionReason: text("decision_reason"),
  decidedByUserId: text("decided_by_user_id").references(() => users.id),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const eosEvidence = pgTable("eos_evidence", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  workPacketId: text("work_packet_id").notNull().references(() => eosWorkPackets.id, { onDelete: "cascade" }),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id),
  evidenceType: text("evidence_type").notNull(),
  title: text("title").notNull(),
  uri: text("uri"),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const eosAuditRecords = pgTable("eos_audit_records", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  traceId: text("trace_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  result: text("result").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

// Role-aware organizational runtime. Membership answers whether a principal may
// enter an organization; seats and their reporting edges determine what that
// principal may see and where communication is allowed to travel.
export const eosMemberships = pgTable("eos_memberships", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  seatId: text("seat_id"),
  role: text("role").notNull(),
  status: text("status").notNull().default("active"),
  purpose: text("purpose").notNull().default("operate"),
  classificationCeiling: text("classification_ceiling").notNull().default("internal"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("eos_memberships_one_active_human_per_seat_idx")
    .on(table.seatId)
    .where(sql`${table.seatId} IS NOT NULL AND ${table.status} = 'active'`),
]);

export const eosSeats = pgTable("eos_seats", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  supervisorSeatId: text("supervisor_seat_id"),
  occupantUserId: text("occupant_user_id").references(() => users.id, { onDelete: "set null" }),
  agentName: text("agent_name").notNull(),
  agentMode: text("agent_mode").notNull().default("autonomous"),
  mandate: text("mandate").notNull().default(""),
  authority: jsonb("authority").notNull().default({}),
  toolEntitlements: jsonb("tool_entitlements").notNull().default([]),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("eos_seats_one_active_founder_per_company_idx")
    .on(table.companyId)
    .where(sql`${table.kind} = 'founder' AND ${table.status} = 'active'`),
]);

// Invitations are explicit, expiring grants to one organizational seat. The
// raw acceptance token is never stored, and terminal records shed the invited
// email while retaining a non-reversible hash for abuse and audit controls.
export const eosMembershipInvitations = pgTable("eos_membership_invitations", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  seatId: text("seat_id").notNull().references(() => eosSeats.id, { onDelete: "cascade" }),
  invitedEmail: text("invited_email"),
  emailHash: text("email_hash").notNull(),
  tokenHash: text("token_hash").notNull(),
  invitedByUserId: text("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
  providerInvitationId: text("provider_invitation_id"),
  status: text("status").notNull().default("pending_delivery"),
  purpose: text("purpose").notNull().default("operate"),
  classificationCeiling: text("classification_ceiling").notNull().default("internal"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedByUserId: text("accepted_by_user_id").references(() => users.id, { onDelete: "set null" }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_membership_invitations_token_hash_idx").on(table.tokenHash),
  uniqueIndex("eos_membership_invitations_one_pending_per_seat_idx")
    .on(table.seatId)
    .where(sql`${table.status} IN ('pending_delivery', 'pending')`),
  uniqueIndex("eos_membership_invitations_one_pending_email_per_company_idx")
    .on(table.companyId, table.emailHash)
    .where(sql`${table.status} IN ('pending_delivery', 'pending')`),
  index("eos_membership_invitations_expiry_idx").on(table.status, table.expiresAt),
  check("eos_membership_invitations_status_check", sql`${table.status} IN ('pending_delivery', 'pending', 'accepted', 'revoked', 'expired', 'delivery_failed')`),
  check("eos_membership_invitations_classification_check", sql`${table.classificationCeiling} IN ('public', 'internal', 'confidential', 'restricted')`),
]);

export const eosConversations = pgTable("eos_conversations", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  seatId: text("seat_id").references(() => eosSeats.id, { onDelete: "set null" }),
  channelType: text("channel_type").notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const eosCommunicationMessages = pgTable("eos_communication_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => eosConversations.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  senderType: text("sender_type").notNull(),
  senderUserId: text("sender_user_id").references(() => users.id, { onDelete: "set null" }),
  senderSeatId: text("sender_seat_id").references(() => eosSeats.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  provenance: jsonb("provenance").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const eosAdvisorConsultations = pgTable("eos_advisor_consultations", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  conversationId: text("conversation_id").notNull().references(() => eosConversations.id, { onDelete: "cascade" }),
  advisorId: text("advisor_id").notNull(),
  advisorName: text("advisor_name").notNull(),
  request: text("request").notNull(),
  response: text("response").notNull(),
  model: text("model"),
  status: text("status").notNull(),
  provenance: jsonb("provenance").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const eosProviderExecutions = pgTable("eos_provider_executions", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  workPacketId: text("work_packet_id").notNull().references(() => eosWorkPackets.id, { onDelete: "cascade" }),
  approvalId: text("approval_id").references(() => eosApprovalRequests.id, { onDelete: "set null" }),
  requestedByUserId: text("requested_by_user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(),
  operation: text("operation").notNull(),
  status: text("status").notNull().default("awaiting_approval"),
  request: jsonb("request").notNull(),
  receipt: jsonb("receipt").notNull().default({}),
  reconciliationStatus: text("reconciliation_status").notNull().default("pending"),
  failureCode: text("failure_code"),
  traceId: text("trace_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  executedAt: timestamp("executed_at"),
  reconciledAt: timestamp("reconciled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// __ORCHESTRATOR_GENERATED_SCHEMAS__

export const login = pgTable("login", {
  id: text("id").primaryKey(),
  email: text("email"),
  password: text("password"),
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLoginSchema = z.object({
  email: z.string(),
  password: z.string(),
  companyId: z.string().min(1),
});

export type Login = typeof login.$inferSelect;
export type InsertLogin = z.infer<typeof insertLoginSchema>;

export const signup = pgTable("signup", {
  id: text("id").primaryKey(),
  email: text("email"),
  password: text("password"),
  name: text("name"),
  terms_accepted: text("terms_accepted"),
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSignupSchema = z.object({
  email: z.string(),
  password: z.string(),
  name: z.string(),
  terms_accepted: z.string(),
  companyId: z.string().min(1),
});

export type Signup = typeof signup.$inferSelect;
export type InsertSignup = z.infer<typeof insertSignupSchema>;

export const forgotPassword = pgTable("forgotPassword", {
  id: text("id").primaryKey(),
  email: text("email"),
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertForgotPasswordSchema = z.object({
  email: z.string(),
  companyId: z.string().min(1),
});

export type ForgotPassword = typeof forgotPassword.$inferSelect;
export type InsertForgotPassword = z.infer<typeof insertForgotPasswordSchema>;

export const resetPassword = pgTable("resetPassword", {
  id: text("id").primaryKey(),
  token: text("token"),
  new_password: text("new_password"),
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertResetPasswordSchema = z.object({
  token: z.string(),
  new_password: z.string(),
  companyId: z.string().min(1),
});

export type ResetPassword = typeof resetPassword.$inferSelect;
export type InsertResetPassword = z.infer<typeof insertResetPasswordSchema>;

export const metrics = pgTable("metrics", {
  id: text("id").primaryKey(),
  name: text("name"),
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMetricSchema = z.object({
  name: z.string(),
  companyId: z.string().min(1),
});

export type Metric = typeof metrics.$inferSelect;
export type InsertMetric = z.infer<typeof insertMetricSchema>;

export const recentActivity = pgTable("recentActivity", {
  id: text("id").primaryKey(),
  name: text("name"),
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRecentActivitySchema = z.object({
  name: z.string(),
  companyId: z.string().min(1),
});

export type RecentActivity = typeof recentActivity.$inferSelect;
export type InsertRecentActivity = z.infer<typeof insertRecentActivitySchema>;

export const profile = pgTable("profile", {
  id: text("id").primaryKey(),
  name: text("name"),
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProfileSchema = z.object({
  name: z.string(),
  companyId: z.string().min(1),
});

export type Profile = typeof profile.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;

export const security = pgTable("security", {
  id: text("id").primaryKey(),
  current_password: text("current_password"),
  new_password: text("new_password"),
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSecuritySchema = z.object({
  current_password: z.string(),
  new_password: z.string(),
  companyId: z.string().min(1),
});

export type Security = typeof security.$inferSelect;
export type InsertSecurity = z.infer<typeof insertSecuritySchema>;

export const config = pgTable("config", {
  id: text("id").primaryKey(),
  name: text("name"),
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertConfigSchema = z.object({
  name: z.string(),
  companyId: z.string().min(1),
});

export type Config = typeof config.$inferSelect;
export type InsertConfig = z.infer<typeof insertConfigSchema>;

export const register = pgTable("register", {
  id: text("id").primaryKey(),
  username: text("username"),
  email: text("email"),
  fullName: text("full_name"),
  password: text("password"),
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRegisterSchema = z.object({
  username: z.string(),
  email: z.string(),
  fullName: z.string(),
  password: z.string(),
  companyId: z.string().min(1),
});

export type Register = typeof register.$inferSelect;
export type InsertRegister = z.infer<typeof insertRegisterSchema>;

export const logout = pgTable("logout", {
  id: text("id").primaryKey(),
  name: text("name"),
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLogoutSchema = z.object({
  name: z.string(),
  companyId: z.string().min(1),
});

export type Logout = typeof logout.$inferSelect;
export type InsertLogout = z.infer<typeof insertLogoutSchema>;

export const me = pgTable("me", {
  id: text("id").primaryKey(),
  name: text("name"),
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMeSchema = z.object({
  name: z.string(),
  companyId: z.string().min(1),
});

export type Me = typeof me.$inferSelect;
export type InsertMe = z.infer<typeof insertMeSchema>;

export const departments = pgTable("departments", {
  id: text("id").primaryKey(),
  name: text("name"),
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDepartmentSchema = z.object({
  name: z.string(),
  companyId: z.string().min(1),
});

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;

export const roles = pgTable("roles", {
  id: text("id").primaryKey(),
  name: text("name"),
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRoleSchema = z.object({
  name: z.string(),
  companyId: z.string().min(1),
});

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

export const steps = pgTable("steps", {
  id: text("id").primaryKey(),
  name: text("name"),
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStepSchema = z.object({
  name: z.string(),
  companyId: z.string().min(1),
});

export type Step = typeof steps.$inferSelect;
export type InsertStep = z.infer<typeof insertStepSchema>;

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  name: text("name"),
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertConversationSchema = z.object({
  name: z.string(),
  companyId: z.string().min(1),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
