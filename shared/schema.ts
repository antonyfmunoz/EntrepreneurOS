import { sql } from "drizzle-orm";
import { check, index, pgTable, primaryKey, text, serial, integer, boolean, timestamp, json, jsonb, decimal, uniqueIndex, varchar, type AnyPgColumn } from "drizzle-orm/pg-core";
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

export const supportTicketMessages = pgTable("support_ticket_messages", {
  id: text("id").primaryKey(),
  ticketId: text("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  authorUserId: text("author_user_id").references(() => users.id, { onDelete: "set null" }),
  authorKind: text("author_kind").notNull(),
  body: text("body").notNull(),
  requestId: text("request_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("support_ticket_messages_ticket_created_idx").on(table.ticketId, table.createdAt),
  check("support_ticket_messages_author_kind_check", sql`${table.authorKind} IN ('customer', 'support')`),
  check("support_ticket_messages_body_length_check", sql`char_length(${table.body}) BETWEEN 1 AND 10000`),
]);

export const createSupportTicketSchema = z.object({
  category: z.enum(["account", "technical", "integration", "feedback", "security", "other"]),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(10_000),
});

export type SupportTicket = typeof supportTickets.$inferSelect;
export type SupportTicketMessage = typeof supportTicketMessages.$inferSelect;
export type CreateSupportTicket = z.infer<typeof createSupportTicketSchema>;

export const billingSubscriptions = pgTable("billing_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerCustomerId: text("provider_customer_id").notNull(),
  providerSubscriptionId: text("provider_subscription_id").notNull().unique(),
  planKey: text("plan_key").notNull(),
  status: text("status").notNull(),
  entitlements: jsonb("entitlements").notNull().default([]),
  seatLimit: integer("seat_limit").notNull().default(10),
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
  alertThresholdPercent: integer("alert_threshold_percent").notNull().default(80),
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
  reconciliationEvidenceUri: text("reconciliation_evidence_uri"),
  reconciledByUserId: text("reconciled_by_user_id").references(() => users.id),
  reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const aiBudgetAlerts = pgTable("ai_budget_alerts", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  monthStart: timestamp("month_start", { withTimezone: true }).notNull(),
  thresholdPercent: integer("threshold_percent").notNull(),
  usageMicros: integer("usage_micros").notNull(),
  limitMicros: integer("limit_micros").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("ai_budget_alerts_company_month_threshold_uidx").on(table.companyId, table.monthStart, table.thresholdPercent),
]);

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

export const operationalReadinessActions = pgTable("operational_readiness_actions", {
  blockerKey: text("blocker_key").primaryKey(),
  blockerType: text("blocker_type").notNull(),
  layer: integer("layer").notNull(),
  title: text("title").notNull(),
  evidenceClass: text("evidence_class").notNull(),
  nextAction: text("next_action").notNull(),
  operatorState: text("operator_state").notNull().default("unassigned"),
  ownerUserId: text("owner_user_id").references(() => users.id),
  dueAt: timestamp("due_at", { withTimezone: true }),
  notes: text("notes").notNull().default(""),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("operational_readiness_actions_layer_state_idx").on(table.layer, table.operatorState, table.dueAt),
  index("operational_readiness_actions_owner_idx").on(table.ownerUserId, table.operatorState),
]);

export const operationalReadinessActionEvents = pgTable("operational_readiness_action_events", {
  id: text("id").primaryKey(),
  blockerKey: text("blocker_key").notNull().references(() => operationalReadinessActions.blockerKey),
  eventType: text("event_type").notNull(),
  fromState: text("from_state"),
  toState: text("to_state").notNull(),
  ownerUserId: text("owner_user_id").references(() => users.id),
  dueAt: timestamp("due_at", { withTimezone: true }),
  notes: text("notes").notNull().default(""),
  actionVersion: integer("action_version").notNull(),
  actorUserId: text("actor_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("operational_readiness_action_events_version_uidx").on(table.blockerKey, table.actionVersion),
  index("operational_readiness_action_events_time_idx").on(table.blockerKey, table.createdAt),
]);

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
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userProvider: uniqueIndex("oauth_tokens_user_provider_idx").on(table.userId, table.provider),
}));

export const insertOauthTokenSchema = z.object({
  userId: z.string(),
  provider: z.string(),
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  tokenType: z.string().optional(),
  expiresAt: z.date().optional(),
  scope: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
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
  legalName: text("legal_name").notNull().default(""),
  assumedBusinessNames: jsonb("assumed_business_names").notNull().default([]),
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
  capabilityInstanceId: text("capability_instance_id"),
  processDefinitionId: text("process_definition_id"),
  resourceIds: jsonb("resource_ids").notNull().default([]),
  expectedOutput: text("expected_output").notNull().default(""),
  acceptanceCriteria: text("acceptance_criteria").notNull().default(""),
  constraintsPolicies: text("constraints_policies").notNull().default(""),
  failureEscalationCompensation: text("failure_escalation_compensation").notNull().default(""),
  humanFallback: text("human_fallback").notNull().default(""),
  sourceLineage: text("source_lineage").notNull().default(""),
  outputArtifactKeys: jsonb("output_artifact_keys").notNull().default([]),
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
  evidenceKey: text("evidence_key").notNull(),
  claimSubjectType: text("claim_subject_type").notNull().default("work_packet"),
  claimSubjectKey: text("claim_subject_key").notNull().default(""),
  verificationState: text("verification_state").notNull().default("unverified"),
  confidenceQuality: text("confidence_quality").notNull().default("medium"),
  dataClassification: text("data_classification").notNull().default("internal"),
  sourceSystem: text("source_system").notNull().default("native_eos"),
  producerProviderKey: text("producer_provider_key").notNull().default(""),
  consentRights: text("consent_rights").notNull().default(""),
  supportedClaimSummary: text("supported_claim_summary").notNull().default(""),
  verifierMethod: text("verifier_method").notNull().default(""),
  templateLearningEligibility: text("template_learning_eligibility").notNull().default("not_eligible"),
  relatedEventKeys: jsonb("related_event_keys").notNull().default([]),
  relatedDecisionKeys: jsonb("related_decision_keys").notNull().default([]),
  schemaVersion: text("schema_version").notNull().default("evidence-v1.0"),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
  expiresReviewAt: timestamp("expires_review_at", { withTimezone: true }),
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
export const eosPortfolioMemberships = pgTable("eos_portfolio_memberships", {
  id: text("id").primaryKey(),
  portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("portfolio_executive"),
  status: text("status").notNull().default("active"),
  classificationCeiling: text("classification_ceiling").notNull().default("internal"),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_portfolio_memberships_portfolio_user_idx").on(table.portfolioId, table.userId),
  index("eos_portfolio_memberships_user_status_idx").on(table.userId, table.status),
  check("eos_portfolio_memberships_role_check", sql`${table.role} IN ('portfolio_executive')`),
  check("eos_portfolio_memberships_status_check", sql`${table.status} IN ('active', 'suspended', 'revoked')`),
  check("eos_portfolio_memberships_classification_check", sql`${table.classificationCeiling} IN ('public', 'internal', 'confidential', 'restricted')`),
]);

export const eosOrganizationIdentityPolicies = pgTable("eos_organization_identity_policies", {
  companyId: integer("company_id").primaryKey().references(() => companies.id, { onDelete: "cascade" }),
  allowedEmailDomains: jsonb("allowed_email_domains").notNull().default([]),
  allowExternalCollaborators: boolean("allow_external_collaborators").notNull().default(true),
  updatedByUserId: text("updated_by_user_id").notNull().references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eosMemberships = pgTable("eos_memberships", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  seatId: text("seat_id"),
  portfolioMembershipId: text("portfolio_membership_id").references(() => eosPortfolioMemberships.id, { onDelete: "set null" }),
  role: text("role").notNull(),
  status: text("status").notNull().default("active"),
  purpose: text("purpose").notNull().default("operate"),
  classificationCeiling: text("classification_ceiling").notNull().default("internal"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("eos_memberships_company_user_idx").on(table.companyId, table.userId),
  uniqueIndex("eos_memberships_one_active_human_per_seat_idx")
    .on(table.seatId)
    .where(sql`${table.seatId} IS NOT NULL AND ${table.status} = 'active'`),
]);

// Position families describe durable, market-recognizable accountability
// domains. Agreements are versioned level-specific contracts compiled from a
// family into one organization's operating model. Neither object is a seat or
// an occupant.
export const eosPositionFamilies = pgTable("eos_position_families", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  canonicalKey: text("canonical_key").notNull(),
  name: text("name").notNull(),
  titleRoot: text("title_root").notNull(),
  department: text("department").notNull().default("General Management"),
  dominantResult: text("dominant_result").notNull(),
  applicability: jsonb("applicability").notNull().default({}),
  activationConditions: jsonb("activation_conditions").notNull().default([]),
  splitConditions: jsonb("split_conditions").notNull().default([]),
  trackOptions: jsonb("track_options").notNull().default(["individual_contributor"]),
  sourceType: text("source_type").notNull().default("custom"),
  templateAncestry: jsonb("template_ancestry").notNull().default([]),
  schemaVersion: text("schema_version").notNull().default("position-family-v1.0"),
  status: text("status").notNull().default("active"),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_position_families_company_key_idx").on(table.companyId, table.canonicalKey),
  index("eos_position_families_company_status_idx").on(table.companyId, table.status),
  check("eos_position_families_source_check", sql`${table.sourceType} IN ('template', 'custom', 'imported', 'legacy_backfill')`),
  check("eos_position_families_status_check", sql`${table.status} IN ('draft', 'active', 'deprecated')`),
]);

export const eosPositionAgreements = pgTable("eos_position_agreements", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  positionFamilyId: text("position_family_id").notNull().references(() => eosPositionFamilies.id, { onDelete: "cascade" }),
  levelCode: text("level_code").notNull(),
  title: text("title").notNull(),
  version: integer("version").notNull().default(1),
  contract: jsonb("contract").notNull(),
  contentHash: text("content_hash").notNull(),
  sourceType: text("source_type").notNull().default("custom"),
  templateAncestry: jsonb("template_ancestry").notNull().default([]),
  schemaVersion: text("schema_version").notNull().default("position-agreement-v1.0"),
  status: text("status").notNull().default("draft"),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
  effectiveUntil: timestamp("effective_until", { withTimezone: true }),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_position_agreements_family_level_version_idx").on(table.positionFamilyId, table.levelCode, table.version),
  uniqueIndex("eos_position_agreements_one_active_level_idx")
    .on(table.positionFamilyId, table.levelCode)
    .where(sql`${table.status} = 'active'`),
  index("eos_position_agreements_company_status_idx").on(table.companyId, table.status),
  check("eos_position_agreements_source_check", sql`${table.sourceType} IN ('template', 'custom', 'imported', 'legacy_backfill')`),
  check("eos_position_agreements_status_check", sql`${table.status} IN ('draft', 'active', 'superseded', 'deprecated')`),
  check("eos_position_agreements_effective_window_check", sql`${table.effectiveUntil} IS NULL OR ${table.effectiveUntil} > ${table.effectiveFrom}`),
]);

export const eosSeats = pgTable("eos_seats", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  positionAgreementId: text("position_agreement_id").references(() => eosPositionAgreements.id, { onDelete: "set null" }),
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

// Canonical executive command state. These registries preserve institutional
// intent, measurement, and exception/control state independently from any one
// dashboard projection. External sources may reconcile into them, but Native
// EOS records remain tenant-bound, lifecycle-governed, and audit-backed.
export const eosObjectives = pgTable("eos_objectives", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  objectiveKey: text("objective_key").notNull(),
  recordType: text("record_type").notNull(),
  title: text("title").notNull(),
  statement: text("statement").notNull(),
  state: text("state").notNull().default("proposed"),
  priority: text("priority").notNull().default("medium"),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  parentObjectiveId: text("parent_objective_id").references((): AnyPgColumn => eosObjectives.id, { onDelete: "set null" }),
  scopeBoundary: text("scope_boundary").notNull().default(""),
  rationaleTheory: text("rationale_theory").notNull().default(""),
  successExitCriteria: text("success_exit_criteria").notNull().default(""),
  timeHorizon: text("time_horizon").notNull().default(""),
  workPacketIds: jsonb("work_packet_ids").notNull().default([]),
  metricIds: jsonb("metric_ids").notNull().default([]),
  evidenceIds: jsonb("evidence_ids").notNull().default([]),
  decisionPolicyKeys: jsonb("decision_policy_keys").notNull().default([]),
  sourceAuthority: text("source_authority").notNull().default("native_eos"),
  classification: text("classification").notNull().default("internal"),
  schemaVersion: text("schema_version").notNull().default("objective-constraint-v1.0"),
  targetReviewAt: timestamp("target_review_at", { withTimezone: true }),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_objectives_company_key_idx").on(table.companyId, table.objectiveKey),
  index("eos_objectives_company_state_priority_idx").on(table.companyId, table.state, table.priority),
  index("eos_objectives_owner_state_idx").on(table.ownerSeatId, table.state),
  check("eos_objectives_type_check", sql`${table.recordType} IN ('objective', 'constraint', 'mandate', 'hypothesis', 'success_condition', 'guardrail')`),
  check("eos_objectives_state_check", sql`${table.state} IN ('proposed', 'active', 'at_risk', 'blocked', 'achieved', 'failed', 'superseded', 'archived')`),
  check("eos_objectives_priority_check", sql`${table.priority} IN ('critical', 'high', 'medium', 'low')`),
  check("eos_objectives_classification_check", sql`${table.classification} IN ('public', 'internal', 'confidential', 'restricted')`),
  check("eos_objectives_source_authority_check", sql`${table.sourceAuthority} IN ('native_eos', 'notion_runtime', 'external_authoritative', 'reconciled')`),
]);

export const eosMetricsOutcomes = pgTable("eos_metrics_outcomes", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  metricKey: text("metric_key").notNull(),
  recordType: text("record_type").notNull(),
  title: text("title").notNull(),
  state: text("state").notNull().default("proposed"),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  objectiveId: text("objective_id").references(() => eosObjectives.id, { onDelete: "set null" }),
  subjectType: text("subject_type").notNull().default("organization"),
  subjectKey: text("subject_key").notNull().default(""),
  definitionFormula: text("definition_formula").notNull().default(""),
  unitCurrency: text("unit_currency").notNull().default(""),
  thresholdDirection: text("threshold_direction").notNull().default(""),
  targetValue: decimal("target_value", { precision: 24, scale: 6 }),
  actualValue: decimal("actual_value", { precision: 24, scale: 6 }),
  forecastValue: decimal("forecast_value", { precision: 24, scale: 6 }),
  timeGrainPeriod: text("time_grain_period").notNull().default(""),
  verifierConfidence: text("verifier_confidence").notNull().default(""),
  attributionLimitations: text("attribution_limitations").notNull().default(""),
  evidenceIds: jsonb("evidence_ids").notNull().default([]),
  notes: text("notes").notNull().default(""),
  sourceAuthority: text("source_authority").notNull().default("native_eos"),
  classification: text("classification").notNull().default("internal"),
  schemaVersion: text("schema_version").notNull().default("metric-outcome-v1.0"),
  asOf: timestamp("as_of", { withTimezone: true }),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_metrics_outcomes_company_key_idx").on(table.companyId, table.metricKey),
  index("eos_metrics_outcomes_company_state_idx").on(table.companyId, table.state),
  index("eos_metrics_outcomes_owner_state_idx").on(table.ownerSeatId, table.state),
  check("eos_metrics_outcomes_type_check", sql`${table.recordType} IN ('metric_definition', 'measurement', 'target', 'forecast', 'benchmark', 'outcome', 'impact')`),
  check("eos_metrics_outcomes_state_check", sql`${table.state} IN ('proposed', 'defined', 'active', 'under_review', 'verified', 'contested', 'superseded', 'retired')`),
  check("eos_metrics_outcomes_classification_check", sql`${table.classification} IN ('public', 'internal', 'confidential', 'restricted')`),
  check("eos_metrics_outcomes_source_authority_check", sql`${table.sourceAuthority} IN ('native_eos', 'notion_runtime', 'external_authoritative', 'reconciled')`),
  check("eos_metrics_outcomes_valid_window_check", sql`${table.validUntil} IS NULL OR ${table.validUntil} > ${table.validFrom}`),
]);

export const eosRisksControls = pgTable("eos_risks_controls", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  riskControlKey: text("risk_control_key").notNull(),
  recordType: text("record_type").notNull(),
  title: text("title").notNull(),
  state: text("state").notNull().default("identified"),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  capabilityProcessAssetKey: text("capability_process_asset_key").notNull().default(""),
  descriptionCauseEventImpact: text("description_cause_event_impact").notNull(),
  inherentAssessment: text("inherent_assessment").notNull().default(""),
  residualAssessment: text("residual_assessment").notNull().default(""),
  appetiteToleranceMateriality: text("appetite_tolerance_materiality").notNull().default(""),
  treatmentControl: text("treatment_control").notNull().default(""),
  sourceRequirement: text("source_requirement").notNull().default(""),
  jurisdictionRegime: text("jurisdiction_regime").notNull().default(""),
  evidenceIds: jsonb("evidence_ids").notNull().default([]),
  policyDecisionWorkKeys: jsonb("policy_decision_work_keys").notNull().default([]),
  exceptionIncidentKeys: jsonb("exception_incident_keys").notNull().default([]),
  insuranceTransfer: text("insurance_transfer").notNull().default(""),
  notes: text("notes").notNull().default(""),
  sourceAuthority: text("source_authority").notNull().default("native_eos"),
  classification: text("classification").notNull().default("internal"),
  schemaVersion: text("schema_version").notNull().default("risk-obligation-control-v1.0"),
  dueReviewAt: timestamp("due_review_at", { withTimezone: true }),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_risks_controls_company_key_idx").on(table.companyId, table.riskControlKey),
  index("eos_risks_controls_company_state_idx").on(table.companyId, table.state),
  index("eos_risks_controls_owner_state_idx").on(table.ownerSeatId, table.state),
  check("eos_risks_controls_type_check", sql`${table.recordType} IN ('risk', 'obligation', 'control', 'incident', 'finding', 'remediation', 'insurance_transfer')`),
  check("eos_risks_controls_state_check", sql`${table.state} IN ('identified', 'under_assessment', 'applicable_active', 'assigned', 'treating_in_progress', 'monitoring', 'accepted', 'overdue_breached', 'remediating', 'satisfied_closed', 'superseded')`),
  check("eos_risks_controls_classification_check", sql`${table.classification} IN ('public', 'internal', 'confidential', 'restricted')`),
  check("eos_risks_controls_source_authority_check", sql`${table.sourceAuthority} IN ('native_eos', 'notion_runtime', 'external_authoritative', 'reconciled')`),
  check("eos_risks_controls_valid_window_check", sql`${table.validUntil} IS NULL OR ${table.validUntil} > ${table.validFrom}`),
]);

// Module 13 keeps authoritative source custody, company-local requirement
// interpretation, and attributable reviews separate. These records preserve
// professional claims without representing EOS as legal or compliance advice.
export const eosComplianceSourceVersions = pgTable("eos_compliance_source_versions", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  sourceKey: text("source_key").notNull(),
  sourceVersion: integer("source_version").notNull(),
  versionLabel: text("version_label").notNull(),
  title: text("title").notNull(),
  sourceType: text("source_type").notNull(),
  authoritySystem: text("authority_system").notNull(),
  authoritativeReference: text("authoritative_reference").notNull(),
  jurisdictionRegime: text("jurisdiction_regime").notNull(),
  summary: text("summary").notNull(),
  effectiveFrom: text("effective_from").notNull(),
  effectiveUntil: text("effective_until"),
  reviewedThrough: text("reviewed_through").notNull(),
  nextReviewAt: text("next_review_at").notNull(),
  contentSha256: text("content_sha256").notNull(),
  classification: text("classification").notNull().default("confidential"),
  state: text("state").notNull().default("draft"),
  reviewEvidenceId: text("review_evidence_id").references(() => eosEvidence.id, { onDelete: "restrict" }),
  reviewAuthority: text("review_authority"),
  reviewerName: text("reviewer_name"),
  reviewerOrganization: text("reviewer_organization"),
  reviewerCredentialReference: text("reviewer_credential_reference"),
  limitations: text("limitations").notNull().default(""),
  verificationPolicyDecisionId: text("verification_policy_decision_id").references((): AnyPgColumn => eosPolicyDecisions.id, { onDelete: "restrict" }),
  preparedByUserId: text("prepared_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  preparedAt: timestamp("prepared_at", { withTimezone: true }).notNull().defaultNow(),
  verifiedByUserId: text("verified_by_user_id").references(() => users.id, { onDelete: "restrict" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  supersededByUserId: text("superseded_by_user_id").references(() => users.id, { onDelete: "restrict" }),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
  supersessionReason: text("supersession_reason").notNull().default(""),
}, (table) => [
  uniqueIndex("eos_compliance_source_company_version_idx").on(table.companyId, table.sourceKey, table.sourceVersion),
  uniqueIndex("eos_compliance_source_hash_idx").on(table.companyId, table.contentSha256),
  index("eos_compliance_source_state_idx").on(table.companyId, table.state, table.nextReviewAt),
  check("eos_compliance_source_version_check", sql`${table.sourceVersion} > 0`),
  check("eos_compliance_source_type_check", sql`${table.sourceType} IN ('statute','regulation','contract','internal_policy','standard','professional_guidance','consent_notice','other')`),
  check("eos_compliance_source_state_check", sql`${table.state} IN ('draft','verified','superseded')`),
  check("eos_compliance_source_hash_check", sql`${table.contentSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_compliance_source_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`),
  check("eos_compliance_source_date_check", sql`${table.effectiveFrom} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND ${table.reviewedThrough} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND ${table.nextReviewAt} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND (${table.effectiveUntil} IS NULL OR ${table.effectiveUntil} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')`),
]);

export const eosComplianceRequirements = pgTable("eos_compliance_requirements", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  requirementKey: text("requirement_key").notNull(),
  requirementVersion: integer("requirement_version").notNull(),
  requirementType: text("requirement_type").notNull(),
  sourceVersionId: text("source_version_id").notNull().references(() => eosComplianceSourceVersions.id, { onDelete: "restrict" }),
  sourceSha256: text("source_sha256").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  subjectScope: text("subject_scope").notNull(),
  sourceRequirement: text("source_requirement").notNull(),
  jurisdictionRegime: text("jurisdiction_regime").notNull(),
  processingPurpose: text("processing_purpose").notNull().default(""),
  legalBasisClaim: text("legal_basis_claim").notNull().default(""),
  retentionTrigger: text("retention_trigger").notNull().default(""),
  retentionPeriod: text("retention_period").notNull().default(""),
  dispositionMethod: text("disposition_method").notNull().default(""),
  state: text("state").notNull().default("identified"),
  version: integer("version").notNull().default(1),
  dueReviewAt: text("due_review_at").notNull(),
  classification: text("classification").notNull().default("confidential"),
  definitionSha256: text("definition_sha256").notNull(),
  lastReviewId: text("last_review_id"),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_compliance_requirement_company_version_idx").on(table.companyId, table.requirementKey, table.requirementVersion),
  uniqueIndex("eos_compliance_requirement_hash_idx").on(table.companyId, table.definitionSha256),
  index("eos_compliance_requirement_state_idx").on(table.companyId, table.state, table.dueReviewAt),
  index("eos_compliance_requirement_owner_idx").on(table.ownerSeatId, table.state),
  check("eos_compliance_requirement_type_check", sql`${table.requirementType} IN ('obligation','right','consent','policy','retention_rule','control')`),
  check("eos_compliance_requirement_state_check", sql`${table.state} IN ('identified','under_assessment','applicable_active','monitoring','overdue_breached','remediating','satisfied_closed','superseded')`),
  check("eos_compliance_requirement_version_check", sql`${table.requirementVersion} > 0 AND ${table.version} > 0`),
  check("eos_compliance_requirement_hash_check", sql`${table.sourceSha256} ~ '^[0-9a-f]{64}$' AND ${table.definitionSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_compliance_requirement_date_check", sql`${table.dueReviewAt} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`),
  check("eos_compliance_requirement_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`),
  check("eos_compliance_requirement_retention_check", sql`${table.requirementType} <> 'retention_rule' OR (length(${table.retentionTrigger}) >= 3 AND length(${table.retentionPeriod}) >= 3 AND length(${table.dispositionMethod}) >= 3)`),
]);

export const eosComplianceRequirementReviews = pgTable("eos_compliance_requirement_reviews", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  requirementId: text("requirement_id").notNull().references(() => eosComplianceRequirements.id, { onDelete: "restrict" }),
  requirementVersion: integer("requirement_version").notNull(),
  sourceVersionId: text("source_version_id").notNull().references(() => eosComplianceSourceVersions.id, { onDelete: "restrict" }),
  sourceSha256: text("source_sha256").notNull(),
  reviewKind: text("review_kind").notNull(),
  outcome: text("outcome").notNull(),
  stateBefore: text("state_before").notNull(),
  stateAfter: text("state_after").notNull(),
  reviewEvidenceId: text("review_evidence_id").notNull().references(() => eosEvidence.id, { onDelete: "restrict" }),
  reviewAuthority: text("review_authority").notNull(),
  reviewerName: text("reviewer_name").notNull(),
  reviewerOrganization: text("reviewer_organization").notNull(),
  reviewerCredentialReference: text("reviewer_credential_reference").notNull(),
  factsConsidered: text("facts_considered").notNull(),
  rationale: text("rationale").notNull(),
  nextReviewAt: text("next_review_at"),
  policyDecisionId: text("policy_decision_id").notNull().references((): AnyPgColumn => eosPolicyDecisions.id, { onDelete: "restrict" }),
  reviewSha256: text("review_sha256").notNull(),
  reviewedByUserId: text("reviewed_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_compliance_review_hash_idx").on(table.reviewSha256),
  index("eos_compliance_review_requirement_idx").on(table.requirementId, table.requirementVersion),
  index("eos_compliance_review_company_idx").on(table.companyId, table.reviewedAt),
  check("eos_compliance_review_kind_check", sql`${table.reviewKind} IN ('applicability','periodic_review','control_test','closure')`),
  check("eos_compliance_review_outcome_check", sql`${table.outcome} IN ('applicable','not_applicable','needs_revision','effective','ineffective','inconclusive','satisfied','breached')`),
  check("eos_compliance_review_authority_check", sql`${table.reviewAuthority} IN ('qualified_counsel','privacy_professional','internal_compliance','business_owner')`),
  check("eos_compliance_review_hash_check", sql`${table.sourceSha256} ~ '^[0-9a-f]{64}$' AND ${table.reviewSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_compliance_review_detail_check", sql`length(${table.reviewerName}) >= 2 AND length(${table.reviewerOrganization}) >= 2 AND length(${table.reviewerCredentialReference}) >= 5 AND length(${table.factsConsidered}) >= 20 AND length(${table.rationale}) >= 20`),
]);

// Canonical stakeholder/commercial graph. Identity is kept separate from
// relationship context, opportunities/cases, offers, and economic facts so one
// party can participate in many governed contexts without duplicate contacts.
export const eosStakeholders = pgTable("eos_stakeholders", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  stakeholderKey: text("stakeholder_key").notNull(),
  name: text("name").notNull(),
  partyType: text("party_type").notNull(),
  state: text("state").notNull().default("proposed"),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  identityReference: text("identity_reference").notNull(),
  identityReferenceHash: text("identity_reference_hash").notNull(),
  externalId: text("external_id"),
  sourceSystem: text("source_system"),
  consentLegalBasis: text("consent_legal_basis").notNull().default(""),
  relationshipRole: text("relationship_role").notNull().default(""),
  evidenceKeys: jsonb("evidence_keys").notNull().default([]),
  sourceAuthority: text("source_authority").notNull().default("native_eos"),
  classification: text("classification").notNull().default("internal"),
  schemaVersion: text("schema_version").notNull().default("stakeholder-party-v1.0"),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_stakeholders_company_key_idx").on(table.companyId, table.stakeholderKey),
  uniqueIndex("eos_stakeholders_company_identity_idx").on(table.companyId, table.identityReferenceHash),
  uniqueIndex("eos_stakeholders_external_identity_idx").on(table.companyId, table.sourceSystem, table.externalId).where(sql`${table.externalId} IS NOT NULL`),
  index("eos_stakeholders_owner_state_idx").on(table.ownerSeatId, table.state),
  check("eos_stakeholders_party_type_check", sql`${table.partyType} IN ('person', 'organization', 'audience_segment', 'customer_segment', 'customer', 'prospect', 'partner', 'vendor_provider', 'employee', 'candidate', 'collaborator', 'community', 'investor', 'regulator', 'other')`),
  check("eos_stakeholders_state_check", sql`${table.state} IN ('proposed', 'active', 'dormant', 'restricted', 'closed')`),
  check("eos_stakeholders_classification_check", sql`${table.classification} IN ('public', 'internal', 'confidential', 'restricted')`),
  check("eos_stakeholders_source_authority_check", sql`${table.sourceAuthority} IN ('native_eos', 'notion_runtime', 'external_authoritative', 'reconciled')`),
  check("eos_stakeholders_external_source_check", sql`${table.externalId} IS NULL OR ${table.sourceSystem} IS NOT NULL`),
  check("eos_stakeholders_valid_window_check", sql`${table.validUntil} IS NULL OR ${table.validUntil} > ${table.validFrom}`),
]);

export const eosStakeholderRelationships = pgTable("eos_stakeholder_relationships", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  relationshipKey: text("relationship_key").notNull(),
  stakeholderId: text("stakeholder_id").notNull().references(() => eosStakeholders.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type").notNull(),
  title: text("title").notNull(),
  state: text("state").notNull().default("proposed"),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  needConstraint: text("need_constraint").notNull().default(""),
  fitHypothesis: text("fit_hypothesis").notNull().default(""),
  nextBestAction: text("next_best_action").notNull().default(""),
  evidenceKeys: jsonb("evidence_keys").notNull().default([]),
  sourceAuthority: text("source_authority").notNull().default("native_eos"),
  classification: text("classification").notNull().default("internal"),
  schemaVersion: text("schema_version").notNull().default("stakeholder-relationship-v1.0"),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_stakeholder_relationships_company_key_idx").on(table.companyId, table.relationshipKey),
  index("eos_stakeholder_relationships_party_state_idx").on(table.stakeholderId, table.state),
  index("eos_stakeholder_relationships_owner_state_idx").on(table.ownerSeatId, table.state),
  check("eos_stakeholder_relationships_type_check", sql`${table.relationshipType} IN ('prospect', 'customer', 'partner', 'vendor_provider', 'employee', 'candidate', 'collaborator', 'community', 'investor', 'regulator', 'beneficiary', 'donor', 'alumni', 'other')`),
  check("eos_stakeholder_relationships_state_check", sql`${table.state} IN ('proposed', 'active', 'dormant', 'restricted', 'closed')`),
  check("eos_stakeholder_relationships_classification_check", sql`${table.classification} IN ('public', 'internal', 'confidential', 'restricted')`),
  check("eos_stakeholder_relationships_source_authority_check", sql`${table.sourceAuthority} IN ('native_eos', 'notion_runtime', 'external_authoritative', 'reconciled')`),
]);

// Public Recovery Calculator sessions are tenant-bound but visitor-authored.
// Only a digest of the high-entropy bearer token is persisted. The raw model
// inputs and contact data remain confidential; the append-only event ledger is
// deliberately free of bearer tokens, email addresses, phone numbers and IPs.
export const eosRecoveryCalculatorSessions = pgTable("eos_recovery_calculator_sessions", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  publicTokenHash: text("public_token_hash").notNull(),
  status: text("status").notNull().default("started"),
  assumptionVersion: text("assumption_version").notNull(),
  reportVersion: text("report_version").notNull(),
  inputRevision: integer("input_revision").notNull().default(0),
  rawInputs: jsonb("raw_inputs").notNull().default({}),
  result: jsonb("result").notNull().default({}),
  salesBrief: jsonb("sales_brief").notNull().default({}),
  recoveryScore: integer("recovery_score"),
  dominantPool: text("dominant_pool"),
  fitClassification: text("fit_classification"),
  route: text("route"),
  intent: text("intent"),
  firstName: text("first_name"),
  workEmail: text("work_email"),
  companyName: text("company_name"),
  phone: text("phone"),
  communicationPreference: text("communication_preference"),
  consentGranted: boolean("consent_granted").notNull().default(false),
  consentVersion: text("consent_version"),
  consentGrantedAt: timestamp("consent_granted_at", { withTimezone: true }),
  contactCapturedAt: timestamp("contact_captured_at", { withTimezone: true }),
  stakeholderId: text("stakeholder_id").references(() => eosStakeholders.id, { onDelete: "set null" }),
  relationshipId: text("relationship_id").references(() => eosStakeholderRelationships.id, { onDelete: "set null" }),
  source: text("source").notNull().default("direct"),
  utm: jsonb("utm").notNull().default({}),
  externalWritebackState: text("external_writeback_state").notNull().default("not_configured"),
  externalWritebackAttempts: integer("external_writeback_attempts").notNull().default(0),
  externalWritebackError: text("external_writeback_error").notNull().default(""),
  calendarBooked: boolean("calendar_booked").notNull().default(false),
  calendarReference: text("calendar_reference").notNull().default(""),
  lastIdempotencyKey: text("last_idempotency_key"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_recovery_sessions_token_idx").on(table.publicTokenHash),
  uniqueIndex("eos_recovery_sessions_company_idempotency_idx").on(table.companyId, table.lastIdempotencyKey).where(sql`${table.lastIdempotencyKey} IS NOT NULL`),
  index("eos_recovery_sessions_company_status_idx").on(table.companyId, table.status, table.updatedAt),
  index("eos_recovery_sessions_contact_idx").on(table.companyId, table.workEmail),
  check("eos_recovery_sessions_status_check", sql`${table.status} IN ('started','partial_result','contact_captured','report_ready','routed','booked','expired')`),
  check("eos_recovery_sessions_revision_check", sql`${table.inputRevision} >= 0`),
  check("eos_recovery_sessions_score_check", sql`${table.recoveryScore} IS NULL OR ${table.recoveryScore} BETWEEN 0 AND 100`),
  check("eos_recovery_sessions_pool_check", sql`${table.dominantPool} IS NULL OR ${table.dominantPool} IN ('open_estimates','missed_response','past_customers')`),
  check("eos_recovery_sessions_fit_check", sql`${table.fitClassification} IS NULL OR ${table.fitClassification} IN ('high_fit','fit_not_ready','growth_constrained','early_or_insufficient')`),
  check("eos_recovery_sessions_route_check", sql`${table.route} IS NULL OR ${table.route} IN ('recovery_diagnostic','diy_nurture','growth_education','guidance_recheck')`),
  check("eos_recovery_sessions_writeback_check", sql`${table.externalWritebackState} IN ('not_configured','pending','succeeded','failed')`),
  check("eos_recovery_sessions_writeback_attempts_check", sql`${table.externalWritebackAttempts} >= 0`),
  check("eos_recovery_sessions_consent_check", sql`${table.consentGranted} = false OR (${table.consentVersion} IS NOT NULL AND ${table.consentGrantedAt} IS NOT NULL AND ${table.workEmail} IS NOT NULL)`),
  check("eos_recovery_sessions_expiry_check", sql`${table.expiresAt} > ${table.createdAt}`),
]);

export const eosRecoveryCalculatorEvents = pgTable("eos_recovery_calculator_events", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull().references(() => eosRecoveryCalculatorSessions.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  traceId: text("trace_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("eos_recovery_events_session_created_idx").on(table.sessionId, table.createdAt),
  check("eos_recovery_events_type_check", sql`${table.eventType} IN ('session_started','inputs_submitted','partial_result_viewed','contact_captured','report_unlocked','route_assigned','calendar_opened','calendar_booked','external_writeback_pending','external_writeback_succeeded','external_writeback_failed')`),
]);

// Call-2 packets preserve the decision record between a qualified Recovery
// diagnostic and the separately authorized agreement, payment and onboarding
// rails. Commercial terms are server-owned snapshots; operators may request an
// exception, but cannot silently rewrite price, scope or guarantee authority.
export const eosRecoveryCall2Packets = pgTable("eos_recovery_call_2_packets", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  sessionId: text("session_id").notNull().references(() => eosRecoveryCalculatorSessions.id, { onDelete: "restrict" }),
  commercialCaseId: text("commercial_case_id").notNull().references(() => eosCommercialCases.id, { onDelete: "restrict" }),
  workPacketId: text("work_packet_id").notNull().references(() => eosWorkPackets.id, { onDelete: "restrict" }),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  state: text("state").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  packetVersion: text("packet_version").notNull().default("empyrean-recovery-call2.v1"),
  termsAuthority: text("terms_authority").notNull(),
  salesBriefSnapshot: jsonb("sales_brief_snapshot").notNull().default({}),
  buyerDecisionMakers: jsonb("buyer_decision_makers").notNull().default([]),
  observedFacts: text("observed_facts").notNull().default(""),
  measuredSignals: text("measured_signals").notNull().default(""),
  unavailableData: text("unavailable_data").notNull().default(""),
  changesSinceCall1: text("changes_since_call_1").notNull().default(""),
  recoveryThesis: text("recovery_thesis").notNull().default(""),
  scopeDiscussion: text("scope_discussion").notNull().default(""),
  measurementAttribution: text("measurement_attribution").notNull().default(""),
  clientResponsibilities: text("client_responsibilities").notNull().default(""),
  objections: text("objections").notNull().default(""),
  recommendedPackage: text("recommended_package").notNull().default("standard"),
  foundingProofConsideration: text("founding_proof_consideration").notNull().default(""),
  termsPresented: jsonb("terms_presented").notNull().default({}),
  exceptionSummary: text("exception_summary").notNull().default(""),
  exceptionApprovalId: text("exception_approval_id").references(() => eosApprovalRequests.id, { onDelete: "restrict" }),
  disposition: text("disposition"),
  dependencyOrLostReason: text("dependency_or_lost_reason").notNull().default(""),
  decisionMaker: text("decision_maker").notNull().default(""),
  nextAction: text("next_action").notNull().default(""),
  nextActionAt: timestamp("next_action_at", { withTimezone: true }),
  agreementVersion: text("agreement_version").notNull().default(""),
  paymentPath: text("payment_path").notNull().default(""),
  onboardingTrigger: text("onboarding_trigger").notNull().default(""),
  externalEffectsExecuted: boolean("external_effects_executed").notNull().default(false),
  sourceAuthority: text("source_authority").notNull().default("native_eos"),
  classification: text("classification").notNull().default("confidential"),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_recovery_call_2_session_idx").on(table.sessionId),
  uniqueIndex("eos_recovery_call_2_case_idx").on(table.commercialCaseId),
  index("eos_recovery_call_2_company_state_idx").on(table.companyId, table.state, table.updatedAt),
  check("eos_recovery_call_2_state_check", sql`${table.state} IN ('draft','ready','decision_recorded','handoff_ready','closed')`),
  check("eos_recovery_call_2_version_check", sql`${table.version} > 0`),
  check("eos_recovery_call_2_package_check", sql`${table.recommendedPackage} IN ('founding_proof_cohort','standard')`),
  check("eos_recovery_call_2_disposition_check", sql`${table.disposition} IS NULL OR ${table.disposition} IN ('closed_won_pending_agreement_payment','conditional_named_dependency','nurture_not_now','closed_lost_reason')`),
  check("eos_recovery_call_2_no_effect_check", sql`${table.externalEffectsExecuted} = false`),
  check("eos_recovery_call_2_authority_check", sql`${table.sourceAuthority} = 'native_eos'`),
  check("eos_recovery_call_2_classification_check", sql`${table.classification} IN ('confidential','restricted')`),
]);

export const eosRecoveryCall2Events = pgTable("eos_recovery_call_2_events", {
  id: text("id").primaryKey(),
  packetId: text("packet_id").notNull().references(() => eosRecoveryCall2Packets.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  actorSeatId: text("actor_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  sequence: integer("sequence").notNull(),
  eventType: text("event_type").notNull(),
  fromState: text("from_state").notNull(),
  toState: text("to_state").notNull(),
  details: jsonb("details").notNull().default({}),
  traceId: text("trace_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_recovery_call_2_events_sequence_idx").on(table.packetId, table.sequence),
  index("eos_recovery_call_2_events_created_idx").on(table.packetId, table.createdAt),
  check("eos_recovery_call_2_events_sequence_check", sql`${table.sequence} > 0`),
  check("eos_recovery_call_2_events_type_check", sql`${table.eventType} IN ('packet_created','packet_updated','packet_ready','exception_requested','decision_recorded','handoff_prepared','closed')`),
]);

// Cross-company shared-service engagements coordinate two independently
// authorized company-local Work Packets. The engagement is not a reporting
// edge and never grants one company's principal authority inside the other.
export const eosSharedServiceEngagements = pgTable("eos_shared_service_engagements", {
  id: text("id").primaryKey(),
  engagementKey: text("engagement_key").notNull(),
  portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id, { onDelete: "cascade" }),
  beneficiaryCompanyId: integer("beneficiary_company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  providerCompanyId: integer("provider_company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  beneficiaryRelationshipId: text("beneficiary_relationship_id").notNull().references(() => eosStakeholderRelationships.id, { onDelete: "restrict" }),
  beneficiaryWorkPacketId: text("beneficiary_work_packet_id").notNull().references(() => eosWorkPackets.id, { onDelete: "restrict" }),
  beneficiaryApprovalId: text("beneficiary_approval_id").notNull().references(() => eosApprovalRequests.id, { onDelete: "restrict" }),
  providerWorkPacketId: text("provider_work_packet_id").references(() => eosWorkPackets.id, { onDelete: "restrict" }),
  beneficiaryOwnerSeatId: text("beneficiary_owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  providerOwnerSeatId: text("provider_owner_seat_id").references(() => eosSeats.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  serviceType: text("service_type").notNull().default("production"),
  state: text("state").notNull().default("awaiting_beneficiary_approval"),
  version: integer("version").notNull().default(1),
  scope: text("scope").notNull(),
  beneficiary: text("beneficiary").notNull(),
  priority: text("priority").notNull().default("high"),
  inputs: jsonb("inputs").notNull().default([]),
  acceptanceCriteria: text("acceptance_criteria").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  costCapacityTreatment: text("cost_capacity_treatment").notNull(),
  providerResponse: text("provider_response").notNull().default(""),
  clarificationResponse: text("clarification_response").notNull().default(""),
  deliverySummary: text("delivery_summary").notNull().default(""),
  providerEvidenceIds: jsonb("provider_evidence_ids").notNull().default([]),
  beneficiaryDisposition: text("beneficiary_disposition").notNull().default(""),
  beneficiaryEvidenceIds: jsonb("beneficiary_evidence_ids").notNull().default([]),
  costCapacityOutcome: text("cost_capacity_outcome").notNull().default(""),
  externalEffectsExecuted: boolean("external_effects_executed").notNull().default(false),
  sourceAuthority: text("source_authority").notNull().default("native_eos"),
  classification: text("classification").notNull().default("confidential"),
  schemaVersion: text("schema_version").notNull().default("shared-service-engagement-v1.0"),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_shared_service_engagements_key_idx").on(table.portfolioId, table.engagementKey),
  index("eos_shared_service_beneficiary_state_idx").on(table.beneficiaryCompanyId, table.state),
  index("eos_shared_service_provider_state_idx").on(table.providerCompanyId, table.state),
  check("eos_shared_service_distinct_companies_check", sql`${table.beneficiaryCompanyId} <> ${table.providerCompanyId}`),
  check("eos_shared_service_version_check", sql`${table.version} > 0`),
  check("eos_shared_service_priority_check", sql`${table.priority} IN ('low','medium','high','urgent')`),
  check("eos_shared_service_state_check", sql`${table.state} IN ('awaiting_beneficiary_approval','beneficiary_rejected','provider_review','clarification_requested','provider_accepted','provider_rejected','in_progress','delivered','rework_requested','accepted','rejected','cancelled')`),
  check("eos_shared_service_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`),
  check("eos_shared_service_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`),
  check("eos_shared_service_no_effect_check", sql`${table.externalEffectsExecuted} = false`),
]);

export const eosSharedServiceEvents = pgTable("eos_shared_service_events", {
  id: text("id").primaryKey(),
  engagementId: text("engagement_id").notNull().references(() => eosSharedServiceEngagements.id, { onDelete: "cascade" }),
  actorCompanyId: integer("actor_company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  actorUserId: text("actor_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  actorSeatId: text("actor_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  sequence: integer("sequence").notNull(),
  eventType: text("event_type").notNull(),
  fromState: text("from_state").notNull(),
  toState: text("to_state").notNull(),
  note: text("note").notNull().default(""),
  evidenceIds: jsonb("evidence_ids").notNull().default([]),
  traceId: text("trace_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_shared_service_events_sequence_idx").on(table.engagementId, table.sequence),
  index("eos_shared_service_events_created_idx").on(table.engagementId, table.createdAt),
  check("eos_shared_service_events_sequence_check", sql`${table.sequence} > 0`),
  check("eos_shared_service_events_type_check", sql`${table.eventType} IN ('request_created','beneficiary_approved','beneficiary_rejected','provider_clarification_requested','beneficiary_clarified','provider_accepted','provider_rejected','provider_started','provider_delivered','beneficiary_rework_requested','beneficiary_accepted','beneficiary_rejected_delivery','cancelled')`),
]);

export const eosOfferPrograms = pgTable("eos_offer_programs", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  offerKey: text("offer_key").notNull(), name: text("name").notNull(), offerType: text("offer_type").notNull(), state: text("state").notNull().default("thesis"), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  problemNeed: text("problem_need").notNull(), promiseOutcome: text("promise_outcome").notNull(), audienceStakeholderIds: jsonb("audience_stakeholder_ids").notNull().default([]), scopeInclusions: text("scope_inclusions").notNull().default(""), exclusionsConstraints: text("exclusions_constraints").notNull().default(""), deliveryModel: text("delivery_model").notNull().default(""), pricingEconomicModel: text("pricing_economic_model").notNull().default(""), commercialTermsAuthority: text("commercial_terms_authority").notNull().default(""), metricKeys: jsonb("metric_keys").notNull().default([]), workflowKeys: jsonb("workflow_keys").notNull().default([]), evidenceKeys: jsonb("evidence_keys").notNull().default([]),
  sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("internal"), schemaVersion: text("schema_version").notNull().default("offer-program-v1.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_offer_programs_company_key_idx").on(table.companyId, table.offerKey), index("eos_offer_programs_owner_state_idx").on(table.ownerSeatId, table.state),
  check("eos_offer_programs_type_check", sql`${table.offerType} IN ('service', 'product', 'program', 'subscription', 'engagement', 'content_series', 'internal_capability', 'other')`), check("eos_offer_programs_state_check", sql`${table.state} IN ('thesis', 'validation', 'active', 'paused', 'scaling', 'retired')`), check("eos_offer_programs_classification_check", sql`${table.classification} IN ('public', 'internal', 'confidential', 'restricted')`), check("eos_offer_programs_source_authority_check", sql`${table.sourceAuthority} IN ('native_eos', 'notion_runtime', 'external_authoritative', 'reconciled')`),
]);

export const eosCommercialCases = pgTable("eos_commercial_cases", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  caseKey: text("case_key").notNull(), title: text("title").notNull(), objectClass: text("object_class").notNull(), state: text("state").notNull().default("identified"), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), stakeholderIds: jsonb("stakeholder_ids").notNull().default([]), offerId: text("offer_id").references(() => eosOfferPrograms.id, { onDelete: "set null" }), valueEstimate: decimal("value_estimate", { precision: 24, scale: 6 }), currency: text("currency").notNull().default("USD"), probabilityConfidence: decimal("probability_confidence", { precision: 6, scale: 2 }), nextAction: text("next_action").notNull().default(""), targetDate: timestamp("target_date", { withTimezone: true }), resultOutcome: text("result_outcome").notNull().default(""), riskExceptionKeys: jsonb("risk_exception_keys").notNull().default([]), evidenceKeys: jsonb("evidence_keys").notNull().default([]), externalId: text("external_id"), sourceSystem: text("source_system"), sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("internal"), schemaVersion: text("schema_version").notNull().default("opportunity-engagement-case-v1.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_commercial_cases_company_key_idx").on(table.companyId, table.caseKey), uniqueIndex("eos_commercial_cases_external_idx").on(table.companyId, table.sourceSystem, table.externalId).where(sql`${table.externalId} IS NOT NULL`), index("eos_commercial_cases_owner_state_idx").on(table.ownerSeatId, table.state),
  check("eos_commercial_cases_class_check", sql`${table.objectClass} IN ('commercial_opportunity', 'client_engagement', 'delivery_case', 'partnership', 'recruiting', 'content_campaign', 'internal_initiative', 'other')`), check("eos_commercial_cases_state_check", sql`${table.state} IN ('identified', 'qualifying', 'qualified', 'proposal', 'negotiation', 'committed', 'active', 'on_hold', 'won', 'lost', 'disqualified', 'completed', 'closed')`), check("eos_commercial_cases_probability_check", sql`${table.probabilityConfidence} IS NULL OR (${table.probabilityConfidence} >= 0 AND ${table.probabilityConfidence} <= 100)`), check("eos_commercial_cases_classification_check", sql`${table.classification} IN ('public', 'internal', 'confidential', 'restricted')`), check("eos_commercial_cases_source_authority_check", sql`${table.sourceAuthority} IN ('native_eos', 'notion_runtime', 'external_authoritative', 'reconciled')`), check("eos_commercial_cases_external_source_check", sql`${table.externalId} IS NULL OR ${table.sourceSystem} IS NOT NULL`),
]);

export const eosValueFlows = pgTable("eos_value_flows", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  valueFlowKey: text("value_flow_key").notNull(), title: text("title").notNull(), flowType: text("flow_type").notNull(), state: text("state").notNull().default("proposed"), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), fromStakeholderId: text("from_stakeholder_id").references(() => eosStakeholders.id, { onDelete: "restrict" }), toStakeholderId: text("to_stakeholder_id").references(() => eosStakeholders.id, { onDelete: "restrict" }), offerId: text("offer_id").references(() => eosOfferPrograms.id, { onDelete: "set null" }), commercialCaseId: text("commercial_case_id").references(() => eosCommercialCases.id, { onDelete: "set null" }), amount: decimal("amount", { precision: 24, scale: 6 }), currency: text("currency").notNull().default("USD"), dueEffectiveAt: timestamp("due_effective_at", { withTimezone: true }), attributionNotes: text("attribution_notes").notNull().default(""), agreementReference: text("agreement_reference").notNull().default(""), evidenceKeys: jsonb("evidence_keys").notNull().default([]), externalId: text("external_id"), sourceSystem: text("source_system"), sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("internal"), schemaVersion: text("schema_version").notNull().default("value-flow-commitment-v1.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_value_flows_company_key_idx").on(table.companyId, table.valueFlowKey), uniqueIndex("eos_value_flows_external_idx").on(table.companyId, table.sourceSystem, table.externalId).where(sql`${table.externalId} IS NOT NULL`), index("eos_value_flows_owner_state_idx").on(table.ownerSeatId, table.state), index("eos_value_flows_case_state_idx").on(table.commercialCaseId, table.state),
  check("eos_value_flows_type_check", sql`${table.flowType} IN ('commitment', 'proposal', 'invoice', 'payment', 'refund', 'cost', 'revenue', 'referral', 'lead_attribution', 'outcome', 'resource_allocation', 'other')`), check("eos_value_flows_state_check", sql`${table.state} IN ('proposed', 'committed', 'invoiced', 'paid_settled', 'partially_settled', 'failed', 'cancelled', 'reconciled')`), check("eos_value_flows_endpoint_check", sql`${table.fromStakeholderId} IS NOT NULL OR ${table.toStakeholderId} IS NOT NULL`), check("eos_value_flows_amount_check", sql`${table.amount} IS NULL OR ${table.amount} >= 0`), check("eos_value_flows_classification_check", sql`${table.classification} IN ('public', 'internal', 'confidential', 'restricted')`), check("eos_value_flows_source_authority_check", sql`${table.sourceAuthority} IN ('native_eos', 'notion_runtime', 'external_authoritative', 'reconciled')`), check("eos_value_flows_provider_fact_check", sql`${table.flowType} NOT IN ('invoice', 'payment', 'refund', 'cost', 'revenue') OR (${table.sourceAuthority} IN ('external_authoritative', 'reconciled') AND ${table.sourceSystem} IS NOT NULL AND ${table.externalId} IS NOT NULL)`),
]);

// A customer-value cycle is a governed orchestration record over the canonical
// stakeholder, relationship, offer, commercial case, work, approval and
// evidence registries. The first release is intentionally pre-live only: it
// proves the operating path without contacting, charging, signing, publishing
// for, granting access to, or otherwise mutating an external party or provider.
export const eosCustomerValueCycles = pgTable("eos_customer_value_cycles", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  cycleKey: text("cycle_key").notNull(),
  title: text("title").notNull(),
  mode: text("mode").notNull().default("prelive_fixture"),
  syntheticLabel: text("synthetic_label").notNull().default("Synthetic / Non-Production"),
  state: text("state").notNull().default("awaiting_commercial_approval"),
  version: integer("version").notNull().default(1),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  stakeholderId: text("stakeholder_id").notNull().references(() => eosStakeholders.id, { onDelete: "restrict" }),
  relationshipId: text("relationship_id").notNull().references(() => eosStakeholderRelationships.id, { onDelete: "restrict" }),
  offerId: text("offer_id").notNull().references(() => eosOfferPrograms.id, { onDelete: "restrict" }),
  commercialCaseId: text("commercial_case_id").notNull().references(() => eosCommercialCases.id, { onDelete: "restrict" }),
  workPacketId: text("work_packet_id").notNull().references(() => eosWorkPackets.id, { onDelete: "restrict" }),
  approvalId: text("approval_id").notNull().references(() => eosApprovalRequests.id, { onDelete: "restrict" }),
  objective: text("objective").notNull(),
  acceptanceCriteria: text("acceptance_criteria").notNull(),
  cleanupCriteria: text("cleanup_criteria").notNull(),
  phaseEvidence: jsonb("phase_evidence").notNull().default({}),
  recoveryFromState: text("recovery_from_state").notNull().default(""),
  failureSummary: text("failure_summary").notNull().default(""),
  excludedFromMetrics: boolean("excluded_from_metrics").notNull().default(true),
  externalEffectsExecuted: boolean("external_effects_executed").notNull().default(false),
  restoredSafeStateAt: timestamp("restored_safe_state_at", { withTimezone: true }),
  sourceAuthority: text("source_authority").notNull().default("native_eos"),
  classification: text("classification").notNull().default("confidential"),
  schemaVersion: text("schema_version").notNull().default("customer-value-cycle-v1.0"),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_customer_value_cycles_company_key_idx").on(table.companyId, table.cycleKey),
  index("eos_customer_value_cycles_owner_state_idx").on(table.ownerSeatId, table.state),
  index("eos_customer_value_cycles_case_state_idx").on(table.commercialCaseId, table.state),
  check("eos_customer_value_cycles_mode_check", sql`${table.mode} = 'prelive_fixture'`),
  check("eos_customer_value_cycles_namespace_check", sql`${table.cycleKey} LIKE 'TEST-PRELIVE-%'`),
  check("eos_customer_value_cycles_label_check", sql`${table.syntheticLabel} = 'Synthetic / Non-Production'`),
  check("eos_customer_value_cycles_version_check", sql`${table.version} > 0`),
  check("eos_customer_value_cycles_state_check", sql`${table.state} IN ('awaiting_commercial_approval','commercial_approved','commercial_rejected','agreement_ready','onboarding','delivery','reporting','renewal_review','renewed','closed','recovery_required','cancelled')`),
  check("eos_customer_value_cycles_no_effect_check", sql`${table.externalEffectsExecuted} = false`),
  check("eos_customer_value_cycles_metric_exclusion_check", sql`${table.excludedFromMetrics} = true`),
  check("eos_customer_value_cycles_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`),
  check("eos_customer_value_cycles_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`),
]);

export const eosCustomerValueCycleEvents = pgTable("eos_customer_value_cycle_events", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id").notNull().references(() => eosCustomerValueCycles.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  actorSeatId: text("actor_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  sequence: integer("sequence").notNull(),
  eventType: text("event_type").notNull(),
  fromState: text("from_state").notNull(),
  toState: text("to_state").notNull(),
  note: text("note").notNull().default(""),
  evidenceIds: jsonb("evidence_ids").notNull().default([]),
  traceId: text("trace_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_customer_value_cycle_events_sequence_idx").on(table.cycleId, table.sequence),
  index("eos_customer_value_cycle_events_created_idx").on(table.cycleId, table.createdAt),
  check("eos_customer_value_cycle_events_sequence_check", sql`${table.sequence} > 0`),
  check("eos_customer_value_cycle_events_type_check", sql`${table.eventType} IN ('cycle_created','commercial_approved','commercial_rejected','agreement_verified','onboarding_started','delivery_started','reporting_started','renewal_review_started','renewed','closed','failure_reported','safe_state_restored','cancelled')`),
]);

export const eosCustomerValueProviderCheckpoints = pgTable("eos_customer_value_provider_checkpoints", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id").notNull().references(() => eosCustomerValueCycles.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  integrationBindingId: text("integration_binding_id").notNull().references(() => eosIntegrationBindings.id, { onDelete: "restrict" }),
  providerKey: text("provider_key").notNull(),
  phaseKey: text("phase_key").notNull(),
  operationKey: text("operation_key").notNull(),
  state: text("state").notNull().default("required"),
  version: integer("version").notNull().default(1),
  contractVersion: text("contract_version").notNull().default("customer-value-provider-fixture.v1"),
  scenarioResults: jsonb("scenario_results").notNull().default([]),
  requestHash: text("request_hash").notNull().default(""),
  responseHash: text("response_hash").notNull().default(""),
  evidenceId: text("evidence_id").references(() => eosEvidence.id, { onDelete: "set null" }),
  liveProviderBlocker: text("live_provider_blocker").notNull(),
  liveProviderVerified: boolean("live_provider_verified").notNull().default(false),
  externalEffectsExecuted: boolean("external_effects_executed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_customer_value_provider_checkpoint_key_idx").on(table.cycleId, table.providerKey),
  index("eos_customer_value_provider_checkpoint_state_idx").on(table.companyId, table.state),
  check("eos_customer_value_provider_checkpoint_provider_check", sql`${table.providerKey} IN ('gohighlevel','stripe','docusign','google-workspace','notion')`),
  check("eos_customer_value_provider_checkpoint_state_check", sql`${table.state} IN ('required','contract_qualified','contract_failed')`),
  check("eos_customer_value_provider_checkpoint_version_check", sql`${table.version} > 0`),
  check("eos_customer_value_provider_checkpoint_no_live_check", sql`${table.liveProviderVerified} = false`),
  check("eos_customer_value_provider_checkpoint_no_effect_check", sql`${table.externalEffectsExecuted} = false`),
]);

export const eosCustomerValueProviderFixtureRuns = pgTable("eos_customer_value_provider_fixture_runs", {
  id: text("id").primaryKey(),
  checkpointId: text("checkpoint_id").notNull().references(() => eosCustomerValueProviderCheckpoints.id, { onDelete: "cascade" }),
  cycleId: text("cycle_id").notNull().references(() => eosCustomerValueCycles.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  actorSeatId: text("actor_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  sequence: integer("sequence").notNull(),
  result: text("result").notNull(),
  scenarioResults: jsonb("scenario_results").notNull(),
  requestHash: text("request_hash").notNull(),
  responseHash: text("response_hash").notNull(),
  evidenceId: text("evidence_id").notNull().references(() => eosEvidence.id, { onDelete: "restrict" }),
  traceId: text("trace_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  externalEffectsExecuted: boolean("external_effects_executed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_customer_value_provider_fixture_run_sequence_idx").on(table.checkpointId, table.sequence),
  index("eos_customer_value_provider_fixture_run_cycle_idx").on(table.cycleId, table.createdAt),
  check("eos_customer_value_provider_fixture_run_result_check", sql`${table.result} IN ('passed','failed')`),
  check("eos_customer_value_provider_fixture_run_sequence_check", sql`${table.sequence} > 0`),
  check("eos_customer_value_provider_fixture_run_no_effect_check", sql`${table.externalEffectsExecuted} = false`),
]);

export const eosCapabilityInstances = pgTable("eos_capability_instances", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  capabilityInstanceKey: text("capability_instance_key").notNull(), capabilityKey: text("capability_key").notNull(), name: text("name").notNull(), state: text("state").notNull().default("planned"), maturity: text("maturity").notNull().default("ad_hoc"), accountableSeatId: text("accountable_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  activationTrigger: text("activation_trigger").notNull().default(""), deactivationTrigger: text("deactivation_trigger").notNull().default(""), moduleIds: jsonb("module_ids").notNull().default([]), agentKeys: jsonb("agent_keys").notNull().default([]), humanOperatorKey: text("human_operator_key").notNull().default(""), systemKeys: jsonb("system_keys").notNull().default([]), workflowKeys: jsonb("workflow_keys").notNull().default([]), metricKeys: jsonb("metric_keys").notNull().default([]), riskControlKeys: jsonb("risk_control_keys").notNull().default([]), evidenceKeys: jsonb("evidence_keys").notNull().default([]),
  sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("internal"), schemaVersion: text("schema_version").notNull().default("capability-instance-v1.0"), validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(), validUntil: timestamp("valid_until", { withTimezone: true }), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_capability_instances_company_key_idx").on(table.companyId, table.capabilityInstanceKey), index("eos_capability_instances_owner_state_idx").on(table.accountableSeatId, table.state),
  check("eos_capability_instances_state_check", sql`${table.state} IN ('planned', 'activating', 'active', 'dormant', 'blocked', 'deprecated')`), check("eos_capability_instances_maturity_check", sql`${table.maturity} IN ('ad_hoc', 'defined', 'repeatable', 'managed', 'optimizing')`), check("eos_capability_instances_modules_check", sql`jsonb_typeof(${table.moduleIds}) = 'array' AND jsonb_array_length(${table.moduleIds}) <= 14`), check("eos_capability_instances_source_authority_check", sql`${table.sourceAuthority} IN ('native_eos', 'notion_runtime', 'external_authoritative', 'reconciled')`), check("eos_capability_instances_classification_check", sql`${table.classification} IN ('public', 'internal', 'confidential', 'restricted')`), check("eos_capability_instances_valid_window_check", sql`${table.validUntil} IS NULL OR ${table.validUntil} > ${table.validFrom}`),
]);

export const eosProcessDefinitions = pgTable("eos_process_definitions", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }), processKey: text("process_key").notNull(), name: text("name").notNull(), version: integer("version").notNull().default(1), qualificationState: text("qualification_state").notNull().default("mapped"), releaseState: text("release_state").notNull().default("draft"), capabilityInstanceId: text("capability_instance_id").notNull().references(() => eosCapabilityInstances.id, { onDelete: "restrict" }), workflowKey: text("workflow_key").notNull(), purpose: text("purpose").notNull(), intendedOutcome: text("intended_outcome").notNull(),
  templateAncestry: text("template_ancestry").notNull().default(""), applicableOverlays: jsonb("applicable_overlays").notNull().default([]), triggerCondition: text("trigger_condition").notNull(), accountableSeatId: text("accountable_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), supportingActorKeys: jsonb("supporting_actor_keys").notNull().default([]), requiredAuthority: jsonb("required_authority").notNull().default([]), disclosureScope: text("disclosure_scope").notNull().default("internal"), prerequisites: jsonb("prerequisites").notNull().default([]), requiredInputs: jsonb("required_inputs").notNull().default([]), toolSystemBoundaries: jsonb("tool_system_boundaries").notNull().default([]), procedureSteps: jsonb("procedure_steps").notNull(), branchConditions: jsonb("branch_conditions").notNull().default([]), approvalGates: jsonb("approval_gates").notNull().default([]), prohibitedActions: jsonb("prohibited_actions").notNull().default([]), requiredOutputs: jsonb("required_outputs").notNull().default([]), evidenceRequirements: jsonb("evidence_requirements").notNull().default([]), qualityCriteria: jsonb("quality_criteria").notNull().default([]), sla: text("sla").notNull().default(""), emittedEvents: jsonb("emitted_events").notNull().default([]), failurePaths: jsonb("failure_paths").notNull().default([]), terminalCriteria: jsonb("terminal_criteria").notNull().default([]), trainingPrerequisites: jsonb("training_prerequisites").notNull().default([]), acceptanceTests: jsonb("acceptance_tests").notNull().default([]), reviewerKeys: jsonb("reviewer_keys").notNull().default([]),
  sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("internal"), schemaVersion: text("schema_version").notNull().default("canonical-sop-v1.0"), effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(), effectiveUntil: timestamp("effective_until", { withTimezone: true }), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_process_definitions_company_key_version_idx").on(table.companyId, table.processKey, table.version), index("eos_process_definitions_capability_state_idx").on(table.capabilityInstanceId, table.qualificationState),
  check("eos_process_definitions_version_check", sql`${table.version} > 0`), check("eos_process_definitions_qualification_check", sql`${table.qualificationState} IN ('mapped', 'artifact_complete', 'implemented', 'pre_live_qualified', 'field_qualified', 'retired')`), check("eos_process_definitions_release_check", sql`${table.releaseState} IN ('draft', 'review', 'released', 'paused', 'retired')`), check("eos_process_definitions_disclosure_check", sql`${table.disclosureScope} IN ('public', 'internal', 'confidential', 'restricted')`), check("eos_process_definitions_source_authority_check", sql`${table.sourceAuthority} IN ('native_eos', 'notion_runtime', 'external_authoritative', 'reconciled')`), check("eos_process_definitions_classification_check", sql`${table.classification} IN ('public', 'internal', 'confidential', 'restricted')`), check("eos_process_definitions_effective_window_check", sql`${table.effectiveUntil} IS NULL OR ${table.effectiveUntil} > ${table.effectiveFrom}`),
]);

// Phase-1 artifact closure and Phase-5 pre-live activation instrument. This is
// a tenant-scoped readiness ledger over canonical capability instances; it does
// not replace the underlying SOP, Evidence, authority, provider, or Work Packet
// registries and cannot self-certify live or native qualification.
export const eosArtifactClosureRecords = pgTable("eos_artifact_closure_records", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }), moduleId: integer("module_id").notNull(), capabilityKey: text("capability_key").notNull(), capabilityInstanceId: text("capability_instance_id").references(() => eosCapabilityInstances.id, { onDelete: "restrict" }), artifactClass: text("artifact_class").notNull(), applicability: text("applicability").notNull().default("missing"), maturity: text("maturity").notNull().default("doctrine"),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), templateStack: jsonb("template_stack").notNull().default([]), evidenceIds: jsonb("evidence_ids").notNull().default([]), blocker: text("blocker").notNull().default("Artifact state has not been reconciled."), nextAction: text("next_action").notNull().default("Reconcile this artifact class against the canonical runtime and attach attributable evidence."), rationale: text("rationale").notNull().default("Initialized from the canonical 22-class artifact closure contract; no maturity claim has been earned."), triggerCondition: text("trigger_condition").notNull().default(""), classification: text("classification").notNull().default("confidential"), version: integer("version").notNull().default(1), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_artifact_closure_company_capability_class_idx").on(table.companyId, table.moduleId, table.capabilityKey, table.artifactClass), index("eos_artifact_closure_owner_maturity_idx").on(table.ownerSeatId, table.maturity), index("eos_artifact_closure_company_module_idx").on(table.companyId, table.moduleId, table.updatedAt),
  check("eos_artifact_closure_module_check", sql`${table.moduleId} BETWEEN 1 AND 14`), check("eos_artifact_closure_class_check", sql`${table.artifactClass} IN ('capability_definition','template_ancestry_overlays','role_seat','position_agreement','role_agent_specialists','authority_permission_disclosure','sops','workflow_state_machine','work_packet_templates','kpis_scorecard_thresholds','meetings_cadences','interactive_instrument_read_model','forms_intake_checklists','scripts_messages_documents','tools_integrations_provider_bindings','events_telemetry','evidence_provenance_requirements','exception_escalation_rollback','training_onboarding_development','acceptance_tests_rehearsal_fixtures','instance_values_owners_live_configuration','template_learning_versioning')`), check("eos_artifact_closure_applicability_check", sql`${table.applicability} IN ('inherited','instantiated','missing','not_applicable','deferred_by_trigger')`), check("eos_artifact_closure_maturity_check", sql`${table.maturity} IN ('doctrine','mapped','artifact_complete','implemented','pre_live_qualified','field_qualified','native_qualified')`), check("eos_artifact_closure_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`), check("eos_artifact_closure_version_check", sql`${table.version} > 0`), check("eos_artifact_closure_missing_check", sql`${table.applicability} <> 'missing' OR (${table.blocker} <> '' AND ${table.maturity} IN ('doctrine','mapped'))`), check("eos_artifact_closure_trigger_check", sql`${table.applicability} NOT IN ('not_applicable','deferred_by_trigger') OR ${table.triggerCondition} <> ''`), check("eos_artifact_closure_qualified_check", sql`${table.maturity} NOT IN ('pre_live_qualified','field_qualified','native_qualified') OR (jsonb_array_length(${table.evidenceIds}) > 0 AND ${table.blocker} = '')`),
]);

export const eosArtifactClosureEvents = pgTable("eos_artifact_closure_events", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), recordId: text("record_id").notNull().references(() => eosArtifactClosureRecords.id, { onDelete: "restrict" }), sequence: integer("sequence").notNull(), action: text("action").notNull(), fromMaturity: text("from_maturity").notNull(), toMaturity: text("to_maturity").notNull(), changeProjection: jsonb("change_projection").notNull(), changeSha256: text("change_sha256").notNull(), evidenceIds: jsonb("evidence_ids").notNull().default([]), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_artifact_closure_events_record_sequence_idx").on(table.recordId, table.sequence), index("eos_artifact_closure_events_company_recorded_idx").on(table.companyId, table.recordedAt), check("eos_artifact_closure_events_sequence_check", sql`${table.sequence} > 0`), check("eos_artifact_closure_events_action_check", sql`${table.action} IN ('initialized','updated','advanced','regressed','reopened')`), check("eos_artifact_closure_events_from_check", sql`${table.fromMaturity} IN ('doctrine','mapped','artifact_complete','implemented','pre_live_qualified','field_qualified','native_qualified')`), check("eos_artifact_closure_events_to_check", sql`${table.toMaturity} IN ('doctrine','mapped','artifact_complete','implemented','pre_live_qualified','field_qualified','native_qualified')`), check("eos_artifact_closure_events_hash_check", sql`length(${table.changeSha256}) = 64`),
]);

// A synthetic, evidence-gated qualification campaign over the artifact-closure
// ledger. Runs never manufacture provider, field, or native truth: they retain
// the exact scope and closure snapshot that an owner reviewed before release.
export const eosPreLiveQualificationRuns = pgTable("eos_pre_live_qualification_runs", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }), runKey: text("run_key").notNull(), title: text("title").notNull(), objective: text("objective").notNull(), status: text("status").notNull().default("draft"), moduleIds: jsonb("module_ids").notNull(), capabilityKeys: jsonb("capability_keys").notNull().default([]), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), closureSnapshot: jsonb("closure_snapshot").notNull().default({}), blockerSummary: text("blocker_summary").notNull().default(""), decisionRationale: text("decision_rationale").notNull().default(""), decisionEvidenceIds: jsonb("decision_evidence_ids").notNull().default([]), classification: text("classification").notNull().default("confidential"), version: integer("version").notNull().default(1), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), startedAt: timestamp("started_at", { withTimezone: true }), qualifiedAt: timestamp("qualified_at", { withTimezone: true }), decidedAt: timestamp("decided_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_pre_live_runs_company_key_idx").on(table.companyId, table.runKey), index("eos_pre_live_runs_owner_status_idx").on(table.ownerSeatId, table.status), index("eos_pre_live_runs_company_updated_idx").on(table.companyId, table.updatedAt),
  check("eos_pre_live_runs_status_check", sql`${table.status} IN ('draft','in_progress','blocked','qualified','released','rejected','aborted')`), check("eos_pre_live_runs_modules_check", sql`jsonb_typeof(${table.moduleIds}) = 'array' AND jsonb_array_length(${table.moduleIds}) BETWEEN 1 AND 14`), check("eos_pre_live_runs_capabilities_check", sql`jsonb_typeof(${table.capabilityKeys}) = 'array'`), check("eos_pre_live_runs_decision_evidence_check", sql`jsonb_typeof(${table.decisionEvidenceIds}) = 'array'`), check("eos_pre_live_runs_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`), check("eos_pre_live_runs_version_check", sql`${table.version} > 0`), check("eos_pre_live_runs_release_check", sql`${table.status} NOT IN ('released','rejected') OR (${table.decidedAt} IS NOT NULL AND ${table.decisionRationale} <> '' AND jsonb_array_length(${table.decisionEvidenceIds}) > 0)`),
]);

export const eosPreLiveQualificationScenarios = pgTable("eos_pre_live_qualification_scenarios", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), runId: text("run_id").notNull().references(() => eosPreLiveQualificationRuns.id, { onDelete: "cascade" }), scenarioKey: text("scenario_key").notNull(), scenarioType: text("scenario_type").notNull(), title: text("title").notNull(), status: text("status").notNull().default("planned"), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), evidenceIds: jsonb("evidence_ids").notNull().default([]), resultSummary: text("result_summary").notNull().default(""), blocker: text("blocker").notNull().default(""), version: integer("version").notNull().default(1), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_pre_live_scenarios_run_type_idx").on(table.runId, table.scenarioType), index("eos_pre_live_scenarios_company_status_idx").on(table.companyId, table.status),
  check("eos_pre_live_scenarios_type_check", sql`${table.scenarioType} IN ('normal_flow','authority_denial','provider_unavailable','failure_recovery','rollback','tenant_isolation','audit_replay')`), check("eos_pre_live_scenarios_status_check", sql`${table.status} IN ('planned','passed','failed','blocked')`), check("eos_pre_live_scenarios_evidence_check", sql`jsonb_typeof(${table.evidenceIds}) = 'array'`), check("eos_pre_live_scenarios_version_check", sql`${table.version} > 0`), check("eos_pre_live_scenarios_result_check", sql`${table.status} = 'planned' OR (jsonb_array_length(${table.evidenceIds}) > 0 AND ${table.resultSummary} <> '')`), check("eos_pre_live_scenarios_blocker_check", sql`(${table.status} = 'passed' AND ${table.blocker} = '') OR (${table.status} IN ('failed','blocked') AND ${table.blocker} <> '') OR ${table.status} = 'planned'`),
]);

export const eosPreLiveQualificationEvents = pgTable("eos_pre_live_qualification_events", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), runId: text("run_id").notNull().references(() => eosPreLiveQualificationRuns.id, { onDelete: "restrict" }), sequence: integer("sequence").notNull(), action: text("action").notNull(), fromStatus: text("from_status").notNull(), toStatus: text("to_status").notNull(), eventProjection: jsonb("event_projection").notNull(), eventSha256: text("event_sha256").notNull(), evidenceIds: jsonb("evidence_ids").notNull().default([]), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_pre_live_events_run_sequence_idx").on(table.runId, table.sequence), index("eos_pre_live_events_company_recorded_idx").on(table.companyId, table.recordedAt), check("eos_pre_live_events_sequence_check", sql`${table.sequence} > 0`), check("eos_pre_live_events_action_check", sql`${table.action} IN ('created','started','scenario_recorded','qualified','released','rejected','reopened','aborted')`), check("eos_pre_live_events_status_check", sql`${table.fromStatus} IN ('none','draft','in_progress','blocked','qualified','released','rejected','aborted') AND ${table.toStatus} IN ('draft','in_progress','blocked','qualified','released','rejected','aborted')`), check("eos_pre_live_events_hash_check", sql`length(${table.eventSha256}) = 64`), check("eos_pre_live_events_evidence_check", sql`jsonb_typeof(${table.evidenceIds}) = 'array'`),
]);

export const eosResourcesAssets = pgTable("eos_resources_assets", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }), assetKey: text("asset_key").notNull(), name: text("name").notNull(), assetType: text("asset_type").notNull(), lifecycleState: text("lifecycle_state").notNull().default("proposed"), custodianSeatId: text("custodian_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), ownerOrganizationKey: text("owner_organization_key").notNull(), operatorOrganizationKey: text("operator_organization_key").notNull().default(""), dataClassification: text("data_classification").notNull().default("internal"), externalIdUrl: text("external_id_url"), sourceSystem: text("source_system"), rightsUsageLicense: text("rights_usage_license").notNull().default(""), replacementPortabilityNotes: text("replacement_portability_notes").notNull().default(""), toolEntitlementKeys: jsonb("tool_entitlement_keys").notNull().default([]), evidenceKeys: jsonb("evidence_keys").notNull().default([]), sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("internal"), schemaVersion: text("schema_version").notNull().default("resource-asset-v1.0"), validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(), validUntil: timestamp("valid_until", { withTimezone: true }), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_resources_assets_company_key_idx").on(table.companyId, table.assetKey), index("eos_resources_assets_custodian_state_idx").on(table.custodianSeatId, table.lifecycleState), check("eos_resources_assets_type_check", sql`${table.assetType} IN ('intellectual_property', 'brand_asset', 'content_asset', 'channel_account', 'system_tool', 'equipment', 'template', 'document', 'dataset', 'credential_reference', 'other')`), check("eos_resources_assets_state_check", sql`${table.lifecycleState} IN ('proposed', 'active', 'restricted', 'under_review', 'deprecated', 'archived')`), check("eos_resources_assets_data_classification_check", sql`${table.dataClassification} IN ('public', 'internal', 'confidential', 'restricted', 'highly_restricted')`), check("eos_resources_assets_source_authority_check", sql`${table.sourceAuthority} IN ('native_eos', 'notion_runtime', 'external_authoritative', 'reconciled')`), check("eos_resources_assets_classification_check", sql`${table.classification} IN ('public', 'internal', 'confidential', 'restricted')`), check("eos_resources_assets_external_source_check", sql`${table.externalIdUrl} IS NULL OR ${table.sourceSystem} IS NOT NULL`), check("eos_resources_assets_valid_window_check", sql`${table.validUntil} IS NULL OR ${table.validUntil} > ${table.validFrom}`),
]);

// Finance & Capital instrument. These tables hold governed financial context,
// planning and allocation decisions. Settled transactions remain provider
// projections in eos_value_flows and obligations/metrics/evidence retain their
// shared canonical registries.
export const eosFinancialSources = pgTable("eos_financial_sources", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  sourceKey: text("source_key").notNull(), name: text("name").notNull(), legalEntityName: text("legal_entity_name").notNull(), legalEntityReference: text("legal_entity_reference").notNull().default(""), accountType: text("account_type").notNull(), currency: text("currency").notNull().default("USD"), lifecycleState: text("lifecycle_state").notNull().default("draft"), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  sourceSystem: text("source_system"), externalId: text("external_id"), sourceAuthority: text("source_authority").notNull().default("native_eos"), reconciliationState: text("reconciliation_state").notNull().default("unreconciled"), freshnessAsOf: timestamp("freshness_as_of", { withTimezone: true }), evidenceIds: jsonb("evidence_ids").notNull().default([]), classification: text("classification").notNull().default("confidential"), schemaVersion: text("schema_version").notNull().default("financial-source-v1.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_financial_sources_company_key_idx").on(table.companyId, table.sourceKey), uniqueIndex("eos_financial_sources_external_idx").on(table.companyId, table.sourceSystem, table.externalId), index("eos_financial_sources_owner_state_idx").on(table.ownerSeatId, table.lifecycleState),
  check("eos_financial_sources_type_check", sql`${table.accountType} IN ('bank','accounting','payment','payroll','tax','investment','receivable','payable','cash_equivalent','other')`), check("eos_financial_sources_state_check", sql`${table.lifecycleState} IN ('draft','connected','stale','restricted','disconnected','archived')`), check("eos_financial_sources_reconciliation_check", sql`${table.reconciliationState} IN ('unreconciled','pending','reconciled','exception')`), check("eos_financial_sources_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`), check("eos_financial_sources_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`), check("eos_financial_sources_external_check", sql`(${table.externalId} IS NULL AND ${table.sourceSystem} IS NULL) OR (${table.externalId} IS NOT NULL AND ${table.sourceSystem} IS NOT NULL)`), check("eos_financial_sources_connected_check", sql`${table.lifecycleState} NOT IN ('connected','stale','restricted','disconnected') OR (${table.externalId} IS NOT NULL AND ${table.sourceSystem} IS NOT NULL)`),
]);

export const eosFinancialPlans = pgTable("eos_financial_plans", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }), planKey: text("plan_key").notNull(), name: text("name").notNull(), planType: text("plan_type").notNull(), state: text("state").notNull().default("draft"), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), financialSourceId: text("financial_source_id").references(() => eosFinancialSources.id, { onDelete: "set null" }), periodStart: timestamp("period_start", { withTimezone: true }).notNull(), periodEnd: timestamp("period_end", { withTimezone: true }).notNull(), currency: text("currency").notNull().default("USD"), plannedAmount: decimal("planned_amount", { precision: 24, scale: 6 }).notNull(), actualAmount: decimal("actual_amount", { precision: 24, scale: 6 }), varianceAmount: decimal("variance_amount", { precision: 24, scale: 6 }),
  assumptions: jsonb("assumptions").notNull().default([]), lineItems: jsonb("line_items").notNull().default([]), sourceValueFlowIds: jsonb("source_value_flow_ids").notNull().default([]), metricIds: jsonb("metric_ids").notNull().default([]), evidenceIds: jsonb("evidence_ids").notNull().default([]), reconciliationState: text("reconciliation_state").notNull().default("unreconciled"), reconciledAt: timestamp("reconciled_at", { withTimezone: true }), approvedByUserId: text("approved_by_user_id").references(() => users.id, { onDelete: "restrict" }), approvedAt: timestamp("approved_at", { withTimezone: true }), sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("confidential"), schemaVersion: text("schema_version").notNull().default("financial-plan-v1.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_financial_plans_company_key_idx").on(table.companyId, table.planKey), index("eos_financial_plans_owner_state_idx").on(table.ownerSeatId, table.state), index("eos_financial_plans_period_idx").on(table.companyId, table.periodStart, table.periodEnd),
  check("eos_financial_plans_type_check", sql`${table.planType} IN ('budget','forecast','scenario','liquidity','unit_economics','capital_plan')`), check("eos_financial_plans_state_check", sql`${table.state} IN ('draft','review','approved','active','superseded','archived')`), check("eos_financial_plans_reconciliation_check", sql`${table.reconciliationState} IN ('unreconciled','pending','reconciled','exception')`), check("eos_financial_plans_period_check", sql`${table.periodEnd} > ${table.periodStart}`), check("eos_financial_plans_planned_amount_check", sql`${table.plannedAmount} >= 0`), check("eos_financial_plans_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`), check("eos_financial_plans_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`),
]);

export const eosCapitalAllocations = pgTable("eos_capital_allocations", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }), allocationKey: text("allocation_key").notNull(), name: text("name").notNull(), allocationType: text("allocation_type").notNull(), state: text("state").notNull().default("proposed"), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), financialPlanId: text("financial_plan_id").references(() => eosFinancialPlans.id, { onDelete: "set null" }), targetType: text("target_type").notNull(), targetKey: text("target_key").notNull(), amount: decimal("amount", { precision: 24, scale: 6 }).notNull(), currency: text("currency").notNull().default("USD"), rationale: text("rationale").notNull(), alternatives: jsonb("alternatives").notNull().default([]), expectedOutcome: text("expected_outcome").notNull(), downsideRisk: text("downside_risk").notNull(), workPacketId: text("work_packet_id").references(() => eosWorkPackets.id, { onDelete: "set null" }), metricIds: jsonb("metric_ids").notNull().default([]), evidenceIds: jsonb("evidence_ids").notNull().default([]), approvedByUserId: text("approved_by_user_id").references(() => users.id, { onDelete: "restrict" }), approvedAt: timestamp("approved_at", { withTimezone: true }), sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("confidential"), schemaVersion: text("schema_version").notNull().default("capital-allocation-v1.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_capital_allocations_company_key_idx").on(table.companyId, table.allocationKey), index("eos_capital_allocations_owner_state_idx").on(table.ownerSeatId, table.state), index("eos_capital_allocations_plan_state_idx").on(table.financialPlanId, table.state),
  check("eos_capital_allocations_type_check", sql`${table.allocationType} IN ('operating','growth','reserve','debt_service','asset_purchase','internal_investment','external_investment','distribution','other')`), check("eos_capital_allocations_state_check", sql`${table.state} IN ('proposed','under_review','approved','committed','deployed','measuring','realized','rejected','cancelled')`), check("eos_capital_allocations_amount_check", sql`${table.amount} > 0`), check("eos_capital_allocations_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`), check("eos_capital_allocations_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`),
]);

// Systems, Integrations & Automation instrument. Provider credentials and
// native permissions stay authoritative in their secure provider rails; EOS
// stores only governed architecture, authority, health and fallback metadata.
export const eosSystems = pgTable("eos_systems", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }), systemKey: text("system_key").notNull(), name: text("name").notNull(), systemType: text("system_type").notNull(), lifecycleState: text("lifecycle_state").notNull().default("proposed"), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), vendorStakeholderId: text("vendor_stakeholder_id").references(() => eosStakeholders.id, { onDelete: "set null" }), capabilities: jsonb("capabilities").notNull().default([]), dataDomains: jsonb("data_domains").notNull().default([]), authoritativeFields: jsonb("authoritative_fields").notNull().default([]), nativeAdminUrl: text("native_admin_url"), monthlyCost: decimal("monthly_cost", { precision: 18, scale: 2 }), currency: text("currency").notNull().default("USD"), riskNotes: text("risk_notes").notNull().default(""), contractRenewalAt: timestamp("contract_renewal_at", { withTimezone: true }), replacementIntent: text("replacement_intent").notNull().default("unknown"), sourceAuthority: text("source_authority").notNull().default("native_eos"), sourceSystem: text("source_system"), externalId: text("external_id"), evidenceIds: jsonb("evidence_ids").notNull().default([]), classification: text("classification").notNull().default("restricted"), schemaVersion: text("schema_version").notNull().default("system-registry-v1.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_systems_company_key_idx").on(table.companyId, table.systemKey), uniqueIndex("eos_systems_external_idx").on(table.companyId, table.sourceSystem, table.externalId), index("eos_systems_owner_state_idx").on(table.ownerSeatId, table.lifecycleState),
  check("eos_systems_type_check", sql`${table.systemType} IN ('system','application','service','tool','data_platform','infrastructure','provider')`), check("eos_systems_state_check", sql`${table.lifecycleState} IN ('proposed','selected','implementing','active','degraded','replacement_planned','migrating','retired')`), check("eos_systems_replacement_check", sql`${table.replacementIntent} IN ('keep','integrate','migrate','replace','retire','unknown')`), check("eos_systems_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`), check("eos_systems_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`), check("eos_systems_cost_check", sql`${table.monthlyCost} IS NULL OR ${table.monthlyCost} >= 0`), check("eos_systems_external_check", sql`(${table.sourceSystem} IS NULL AND ${table.externalId} IS NULL) OR (${table.sourceSystem} IS NOT NULL AND ${table.externalId} IS NOT NULL)`),
]);

export const eosIntegrationBindings = pgTable("eos_integration_bindings", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }), integrationKey: text("integration_key").notNull(), name: text("name").notNull(), fromSystemId: text("from_system_id").references(() => eosSystems.id, { onDelete: "set null" }), toSystemId: text("to_system_id").references(() => eosSystems.id, { onDelete: "set null" }), providerKey: text("provider_key").notNull(), providerAccountReference: text("provider_account_reference").notNull().default(""), adapterKind: text("adapter_kind").notNull(), adapterReference: text("adapter_reference").notNull(), adapterVersion: text("adapter_version").notNull().default(""), transport: text("transport").notNull().default(""), lifecycleState: text("lifecycle_state").notNull().default("proposed"), connectionState: text("connection_state").notNull().default("unconfigured"), healthState: text("health_state").notNull().default("unknown"), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), recoveryOwnerSeatId: text("recovery_owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), administratorReference: text("administrator_reference").notNull().default(""), accountScope: text("account_scope").notNull().default(""), nativePermissions: jsonb("native_permissions").notNull().default([]), credentialReference: text("credential_reference"), executionAuthority: text("execution_authority").notNull().default(""), operations: jsonb("operations").notNull().default([]), expectedEvents: jsonb("expected_events").notNull().default([]), inputSchema: jsonb("input_schema").notNull().default({}), outputSchema: jsonb("output_schema").notNull().default({}), eventSchema: jsonb("event_schema").notNull().default({}), costModel: text("cost_model").notNull().default(""), latencyBudgetMs: integer("latency_budget_ms"), rateLimitPolicy: text("rate_limit_policy").notNull().default(""), idempotencyStrategy: text("idempotency_strategy").notNull().default(""), retryPolicy: text("retry_policy").notNull().default(""), timeoutMs: integer("timeout_ms"), cancellationBehavior: text("cancellation_behavior").notNull().default(""), redactionPolicy: text("redaction_policy").notNull().default(""), evidenceRequirements: jsonb("evidence_requirements").notNull().default([]), testCapability: text("test_capability").notNull().default(""), revocationProcedure: text("revocation_procedure").notNull().default(""), manualFallback: text("manual_fallback").notNull(), failureRecovery: text("failure_recovery").notNull(), replacementStatus: text("replacement_status").notNull().default("unknown"), parityState: text("parity_state").notNull().default("not_tested"), configurationVersion: integer("configuration_version").notNull().default(1), workPacketId: text("work_packet_id").references(() => eosWorkPackets.id, { onDelete: "set null" }), evidenceIds: jsonb("evidence_ids").notNull().default([]), lastHealthAt: timestamp("last_health_at", { withTimezone: true }), sourceAuthority: text("source_authority").notNull().default("native_eos"), sourceSystem: text("source_system"), externalId: text("external_id"), classification: text("classification").notNull().default("restricted"), schemaVersion: text("schema_version").notNull().default("integration-binding-v2.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_integration_bindings_company_key_idx").on(table.companyId, table.integrationKey), uniqueIndex("eos_integration_bindings_external_idx").on(table.companyId, table.sourceSystem, table.externalId), index("eos_integration_bindings_owner_state_idx").on(table.ownerSeatId, table.lifecycleState), index("eos_integration_bindings_health_idx").on(table.companyId, table.healthState, table.lastHealthAt),
  check("eos_integration_bindings_adapter_check", sql`${table.adapterKind} IN ('oauth','api_key','webhook','signed_https','service_account','database','file_exchange','manual','native')`), check("eos_integration_bindings_state_check", sql`${table.lifecycleState} IN ('proposed','selected','implementing','active','degraded','replacement_planned','migrating','retired')`), check("eos_integration_bindings_connection_check", sql`${table.connectionState} IN ('unconfigured','configured','connected','revoked','failed')`), check("eos_integration_bindings_health_check", sql`${table.healthState} IN ('unknown','healthy','degraded','unavailable')`), check("eos_integration_bindings_replacement_check", sql`${table.replacementStatus} IN ('keep','integrate','migrate','replace','retire','unknown')`), check("eos_integration_bindings_parity_check", sql`${table.parityState} IN ('not_tested','test_planned','passing','failing','accepted_exception')`), check("eos_integration_bindings_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`), check("eos_integration_bindings_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`), check("eos_integration_bindings_endpoint_check", sql`${table.fromSystemId} IS NOT NULL OR ${table.toSystemId} IS NOT NULL`), check("eos_integration_bindings_external_check", sql`(${table.sourceSystem} IS NULL AND ${table.externalId} IS NULL) OR (${table.sourceSystem} IS NOT NULL AND ${table.externalId} IS NOT NULL)`), check("eos_integration_bindings_latency_check", sql`${table.latencyBudgetMs} IS NULL OR ${table.latencyBudgetMs} > 0`), check("eos_integration_bindings_timeout_check", sql`${table.timeoutMs} IS NULL OR ${table.timeoutMs} > 0`), check("eos_integration_bindings_configuration_version_check", sql`${table.configurationVersion} > 0`),
]);

// Recovery commercial activation separates legal authority, the client-specific
// agreement package, and provider billing configuration. EOS can prepare and
// evaluate these records but can assert signing only from its own completed,
// hash-chained native envelope or an authoritative provider receipt. Payment
// still requires authoritative provider evidence promoted to canonical Evidence.
export const eosRecoveryAgreementAuthorities = pgTable("eos_recovery_agreement_authorities", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  agreementKey: text("agreement_key").notNull(),
  workPacketId: text("work_packet_id").notNull().references(() => eosWorkPackets.id, { onDelete: "restrict" }),
  state: text("state").notNull().default("counsel_blocked"),
  version: integer("version").notNull().default(1),
  authorityVersion: text("authority_version").notNull(),
  counselPacketSource: text("counsel_packet_source").notNull(),
  agreementTemplateSource: text("agreement_template_source").notNull(),
  issueDispositions: jsonb("issue_dispositions").notNull().default([]),
  reviewerName: text("reviewer_name").notNull().default(""),
  reviewerCredentialReference: text("reviewer_credential_reference").notNull().default(""),
  jurisdiction: text("jurisdiction").notNull().default(""),
  exactLanguageReference: text("exact_language_reference").notNull().default(""),
  unresolvedBusinessChoices: text("unresolved_business_choices").notNull().default(""),
  complianceDependencies: text("compliance_dependencies").notNull().default(""),
  effectiveVersion: text("effective_version").notNull().default(""),
  effectiveAt: timestamp("effective_at", { withTimezone: true }),
  counselEvidenceId: text("counsel_evidence_id").references(() => eosEvidence.id, { onDelete: "restrict" }),
  eSignBindingId: text("e_sign_binding_id").references(() => eosIntegrationBindings.id, { onDelete: "restrict" }),
  externalEffectsExecuted: boolean("external_effects_executed").notNull().default(false),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_recovery_agreement_authority_key_idx").on(table.companyId, table.agreementKey),
  index("eos_recovery_agreement_authority_state_idx").on(table.companyId, table.state, table.updatedAt),
  check("eos_recovery_agreement_authority_state_check", sql`${table.state} IN ('counsel_blocked','counsel_approved','counsel_approved_with_changes','counsel_rejected','superseded')`),
  check("eos_recovery_agreement_authority_version_check", sql`${table.version} > 0`),
  check("eos_recovery_agreement_authority_no_effect_check", sql`${table.externalEffectsExecuted} = false`),
]);

// Native e-signing owns immutable document versions and tenant-scoped signing
// envelopes. Binary documents remain in private artifact storage; relational
// records retain only bounded metadata, hashes, state, and audit lineage.
export const eosEsignClauses = pgTable("eos_esign_clauses", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  clauseKey: text("clause_key").notNull(), name: text("name").notNull(), description: text("description").notNull().default(""),
  state: text("state").notNull().default("active"), createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(), version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("eos_esign_clause_key_idx").on(table.companyId, table.clauseKey),
  check("eos_esign_clause_state_check", sql`${table.state} IN ('active','retired')`),
]);

export const eosEsignClauseVersions = pgTable("eos_esign_clause_versions", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  clauseId: text("clause_id").notNull().references(() => eosEsignClauses.id, { onDelete: "restrict" }), versionLabel: text("version_label").notNull(),
  bodyText: text("body_text").notNull(), bodySha256: text("body_sha256").notNull(), state: text("state").notNull().default("draft"),
  counselEvidenceId: text("counsel_evidence_id").references(() => eosEvidence.id, { onDelete: "restrict" }), approvedByUserId: text("approved_by_user_id").references(() => users.id, { onDelete: "restrict" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }), createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_esign_clause_version_idx").on(table.clauseId, table.versionLabel),
  uniqueIndex("eos_esign_clause_approved_idx").on(table.clauseId).where(sql`${table.state} = 'approved'`),
  check("eos_esign_clause_version_hash_check", sql`${table.bodySha256} ~ '^[0-9a-f]{64}$'`),
]);

export const eosEsignTemplates = pgTable("eos_esign_templates", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  templateKey: text("template_key").notNull(), name: text("name").notNull(), description: text("description").notNull().default(""), state: text("state").notNull().default("active"),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(), version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("eos_esign_template_key_idx").on(table.companyId, table.templateKey),
  check("eos_esign_template_state_check", sql`${table.state} IN ('active','retired')`),
]);

export const eosEsignTemplateVersions = pgTable("eos_esign_template_versions", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  templateId: text("template_id").notNull().references(() => eosEsignTemplates.id, { onDelete: "restrict" }), versionLabel: text("version_label").notNull(),
  titleTemplate: text("title_template").notNull(), bodyTemplate: text("body_template").notNull(), variableSchema: jsonb("variable_schema").notNull().default([]), recipientSchema: jsonb("recipient_schema").notNull().default([]), fieldSchema: jsonb("field_schema").notNull().default([]), clauseVersionIds: jsonb("clause_version_ids").notNull().default([]),
  contentSha256: text("content_sha256").notNull(), state: text("state").notNull().default("draft"), counselEvidenceId: text("counsel_evidence_id").references(() => eosEvidence.id, { onDelete: "restrict" }),
  approvedByUserId: text("approved_by_user_id").references(() => users.id, { onDelete: "restrict" }), approvedAt: timestamp("approved_at", { withTimezone: true }), createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_esign_template_version_idx").on(table.templateId, table.versionLabel),
  uniqueIndex("eos_esign_template_approved_idx").on(table.templateId).where(sql`${table.state} = 'approved'`),
  check("eos_esign_template_version_hash_check", sql`${table.contentSha256} ~ '^[0-9a-f]{64}$'`),
]);

export const eosEsignJurisdictionPacks = pgTable("eos_esign_jurisdiction_packs", {
  id: text("id").primaryKey(),
  portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id, { onDelete: "cascade" }),
  sourceCompanyId: integer("source_company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  packKey: text("pack_key").notNull(), packVersion: integer("pack_version").notNull(), name: text("name").notNull(),
  countryCode: text("country_code").notNull(), subdivision: text("subdivision").notNull().default(""), governingLawLabel: text("governing_law_label").notNull(),
  scopeSummary: text("scope_summary").notNull(), applicabilityCriteria: text("applicability_criteria").notNull(), exclusions: text("exclusions").notNull(),
  requiredReviews: jsonb("required_reviews").notNull().default([]), sourceReferences: jsonb("source_references").notNull().default([]),
  effectiveFrom: text("effective_from").notNull(), reviewedThrough: text("reviewed_through").notNull(), nextReviewAt: text("next_review_at").notNull(),
  contentSha256: text("content_sha256").notNull(), classification: text("classification").notNull().default("confidential"), state: text("state").notNull().default("draft"),
  preparedByUserId: text("prepared_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), preparedAt: timestamp("prepared_at", { withTimezone: true }).notNull(),
  reviewEvidenceId: text("review_evidence_id").references(() => eosEvidence.id, { onDelete: "restrict" }), reviewerName: text("reviewer_name").notNull().default(""), reviewerOrganization: text("reviewer_organization").notNull().default(""), reviewerCredentialReference: text("reviewer_credential_reference").notNull().default(""), publicationNote: text("publication_note").notNull().default(""),
  publicationPolicyDecisionId: text("publication_policy_decision_id").references((): AnyPgColumn => eosPolicyDecisions.id, { onDelete: "restrict" }), publishedByUserId: text("published_by_user_id").references(() => users.id, { onDelete: "restrict" }), publishedAt: timestamp("published_at", { withTimezone: true }),
  withdrawnByUserId: text("withdrawn_by_user_id").references(() => users.id, { onDelete: "restrict" }), withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }), withdrawalReason: text("withdrawal_reason").notNull().default(""),
}, (table) => [
  uniqueIndex("eos_esign_jurisdiction_pack_version_idx").on(table.portfolioId, table.packKey, table.packVersion),
  uniqueIndex("eos_esign_jurisdiction_pack_hash_idx").on(table.portfolioId, table.contentSha256),
  index("eos_esign_jurisdiction_pack_state_idx").on(table.portfolioId, table.state, table.preparedAt),
  check("eos_esign_jurisdiction_pack_state_check", sql`${table.state} IN ('draft','published','withdrawn')`),
  check("eos_esign_jurisdiction_pack_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`),
  check("eos_esign_jurisdiction_pack_hash_check", sql`${table.contentSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_jurisdiction_pack_version_check", sql`${table.packVersion} > 0`),
  check("eos_esign_jurisdiction_pack_country_check", sql`${table.countryCode} ~ '^[A-Z]{2}$'`),
  check("eos_esign_jurisdiction_pack_dates_check", sql`${table.effectiveFrom} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND ${table.reviewedThrough} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND ${table.nextReviewAt} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND ${table.reviewedThrough} >= ${table.effectiveFrom} AND ${table.nextReviewAt} > ${table.reviewedThrough}`),
  check("eos_esign_jurisdiction_pack_json_check", sql`jsonb_typeof(${table.requiredReviews}) = 'array' AND jsonb_array_length(${table.requiredReviews}) > 0 AND jsonb_typeof(${table.sourceReferences}) = 'array' AND jsonb_array_length(${table.sourceReferences}) > 0`),
  check("eos_esign_jurisdiction_pack_publication_check", sql`(${table.state} = 'draft' AND ${table.reviewEvidenceId} IS NULL AND ${table.publicationPolicyDecisionId} IS NULL AND ${table.publishedByUserId} IS NULL AND ${table.publishedAt} IS NULL) OR (${table.state} IN ('published','withdrawn') AND ${table.reviewEvidenceId} IS NOT NULL AND length(${table.reviewerName}) >= 2 AND length(${table.reviewerOrganization}) >= 2 AND length(${table.reviewerCredentialReference}) >= 5 AND length(${table.publicationNote}) >= 20 AND ${table.publicationPolicyDecisionId} IS NOT NULL AND ${table.publishedByUserId} IS NOT NULL AND ${table.publishedAt} IS NOT NULL)`),
]);

export const eosEsignJurisdictionPackApplicabilityDecisions = pgTable("eos_esign_jurisdiction_pack_applicability_decisions", {
  id: text("id").primaryKey(), packId: text("pack_id").notNull().references(() => eosEsignJurisdictionPacks.id, { onDelete: "restrict" }),
  portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id, { onDelete: "cascade" }), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  packSha256: text("pack_sha256").notNull(), outcome: text("outcome").notNull(), factsConsidered: text("facts_considered").notNull(), decisionRationale: text("decision_rationale").notNull(),
  reviewEvidenceId: text("review_evidence_id").notNull().references(() => eosEvidence.id, { onDelete: "restrict" }), reviewerName: text("reviewer_name").notNull(), reviewerOrganization: text("reviewer_organization").notNull(), reviewerCredentialReference: text("reviewer_credential_reference").notNull(),
  policyDecisionId: text("policy_decision_id").notNull().references((): AnyPgColumn => eosPolicyDecisions.id, { onDelete: "restrict" }), decisionSha256: text("decision_sha256").notNull(), decidedByUserId: text("decided_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
}, (table) => [
  uniqueIndex("eos_esign_jurisdiction_applicability_company_idx").on(table.packId, table.companyId),
  index("eos_esign_jurisdiction_applicability_portfolio_idx").on(table.portfolioId, table.companyId, table.decidedAt),
  check("eos_esign_jurisdiction_applicability_outcome_check", sql`${table.outcome} IN ('applicable','not_applicable','needs_revision')`),
  check("eos_esign_jurisdiction_applicability_hash_check", sql`${table.packSha256} ~ '^[0-9a-f]{64}$' AND ${table.decisionSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_jurisdiction_applicability_review_check", sql`length(${table.reviewerName}) >= 2 AND length(${table.reviewerOrganization}) >= 2 AND length(${table.reviewerCredentialReference}) >= 5 AND length(${table.factsConsidered}) >= 20 AND length(${table.decisionRationale}) >= 20`),
]);

export const eosEsignPortfolioTemplateProposals = pgTable("eos_esign_portfolio_template_proposals", {
  id: text("id").primaryKey(),
  portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id, { onDelete: "cascade" }),
  sourceCompanyId: integer("source_company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
  sourceTemplateVersionId: text("source_template_version_id").notNull().references(() => eosEsignTemplateVersions.id, { onDelete: "restrict" }),
  proposalKey: text("proposal_key").notNull(), proposalVersion: integer("proposal_version").notNull(),
  name: text("name").notNull(), description: text("description").notNull().default(""), sourceVersionLabel: text("source_version_label").notNull(),
  jurisdiction: text("jurisdiction").notNull(), applicabilitySummary: text("applicability_summary").notNull(), limitations: text("limitations").notNull(),
  titleTemplate: text("title_template").notNull(), bodyTemplate: text("body_template").notNull(),
  variableSchema: jsonb("variable_schema").notNull().default([]), recipientSchema: jsonb("recipient_schema").notNull().default([]), clauseSnapshot: jsonb("clause_snapshot").notNull().default([]),
  sourceContentSha256: text("source_content_sha256").notNull(), proposalSha256: text("proposal_sha256").notNull(),
  reviewEvidenceId: text("review_evidence_id").notNull().references(() => eosEvidence.id, { onDelete: "restrict" }), reviewAuthority: text("review_authority").notNull(),
  jurisdictionPackId: text("jurisdiction_pack_id").references(() => eosEsignJurisdictionPacks.id, { onDelete: "restrict" }), jurisdictionPackSha256: text("jurisdiction_pack_sha256"),
  classification: text("classification").notNull().default("confidential"), state: text("state").notNull().default("proposed"),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  withdrawnByUserId: text("withdrawn_by_user_id").references(() => users.id, { onDelete: "restrict" }), withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }), withdrawalReason: text("withdrawal_reason").notNull().default(""),
}, (table) => [
  uniqueIndex("eos_esign_portfolio_proposal_version_idx").on(table.portfolioId, table.proposalKey, table.proposalVersion),
  uniqueIndex("eos_esign_portfolio_proposal_hash_idx").on(table.portfolioId, table.proposalSha256),
  index("eos_esign_portfolio_proposal_state_idx").on(table.portfolioId, table.state, table.createdAt),
  check("eos_esign_portfolio_proposal_state_check", sql`${table.state} IN ('proposed','withdrawn')`),
  check("eos_esign_portfolio_proposal_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`),
  check("eos_esign_portfolio_proposal_review_authority_check", sql`${table.reviewAuthority} IN ('qualified_counsel','internal_legal','business_review')`),
  check("eos_esign_portfolio_proposal_hash_check", sql`${table.sourceContentSha256} ~ '^[0-9a-f]{64}$' AND ${table.proposalSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_portfolio_proposal_pack_check", sql`(${table.jurisdictionPackId} IS NULL AND ${table.jurisdictionPackSha256} IS NULL) OR (${table.jurisdictionPackId} IS NOT NULL AND ${table.jurisdictionPackSha256} ~ '^[0-9a-f]{64}$')`),
  check("eos_esign_portfolio_proposal_version_check", sql`${table.proposalVersion} > 0`),
]);

export const eosEsignPortfolioTemplateAdoptions = pgTable("eos_esign_portfolio_template_adoptions", {
  id: text("id").primaryKey(), proposalId: text("proposal_id").notNull().references(() => eosEsignPortfolioTemplateProposals.id, { onDelete: "restrict" }),
  portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id, { onDelete: "cascade" }), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  decision: text("decision").notNull(), decisionRationale: text("decision_rationale").notNull(), reviewEvidenceId: text("review_evidence_id").notNull().references(() => eosEvidence.id, { onDelete: "restrict" }), reviewAuthority: text("review_authority").notNull(),
  proposalSha256: text("proposal_sha256").notNull(), localTemplateId: text("local_template_id").references(() => eosEsignTemplates.id, { onDelete: "restrict" }), localTemplateVersionId: text("local_template_version_id").references(() => eosEsignTemplateVersions.id, { onDelete: "restrict" }),
  policyDecisionId: text("policy_decision_id").notNull().references((): AnyPgColumn => eosPolicyDecisions.id, { onDelete: "restrict" }), decisionSha256: text("decision_sha256").notNull(),
  decidedByUserId: text("decided_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
}, (table) => [
  uniqueIndex("eos_esign_portfolio_adoption_company_idx").on(table.proposalId, table.companyId),
  index("eos_esign_portfolio_adoption_portfolio_idx").on(table.portfolioId, table.companyId, table.decidedAt),
  check("eos_esign_portfolio_adoption_decision_check", sql`${table.decision} IN ('accepted','rejected')`),
  check("eos_esign_portfolio_adoption_review_authority_check", sql`${table.reviewAuthority} IN ('qualified_counsel','internal_legal','business_review')`),
  check("eos_esign_portfolio_adoption_hash_check", sql`${table.proposalSha256} ~ '^[0-9a-f]{64}$' AND ${table.decisionSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_portfolio_adoption_output_check", sql`(${table.decision} = 'accepted' AND ${table.localTemplateId} IS NOT NULL AND ${table.localTemplateVersionId} IS NOT NULL) OR (${table.decision} = 'rejected' AND ${table.localTemplateId} IS NULL AND ${table.localTemplateVersionId} IS NULL)`),
]);

export const eosEsignCounterparties = pgTable("eos_esign_counterparties", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  partyType: text("party_type").notNull(), legalName: text("legal_name").notNull(), displayName: text("display_name").notNull(), signerName: text("signer_name").notNull().default(""), signerEmail: text("signer_email").notNull().default(""), externalReference: text("external_reference").notNull().default(""),
  state: text("state").notNull().default("active"), dataClassification: text("data_classification").notNull().default("confidential"), createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(), version: integer("version").notNull().default(1),
}, (table) => [
  index("eos_esign_counterparty_lookup_idx").on(table.companyId, table.state, table.displayName),
  check("eos_esign_counterparty_type_check", sql`${table.partyType} IN ('person','organization')`),
]);

export const eosEsignDocumentVersions = pgTable("eos_esign_document_versions", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  documentKey: text("document_key").notNull(),
  documentVersion: text("document_version").notNull(),
  title: text("title").notNull(),
  sourceReference: text("source_reference").notNull(),
  sourceStorageKey: text("source_storage_key").notNull(),
  sourceSha256: text("source_sha256").notNull(),
  mimeType: text("mime_type").notNull().default("application/pdf"),
  sizeBytes: integer("size_bytes").notNull(),
  pageCount: integer("page_count").notNull().default(1),
  fieldSchema: jsonb("field_schema").notNull().default([]),
  counselEvidenceId: text("counsel_evidence_id").references(() => eosEvidence.id, { onDelete: "restrict" }),
  templateVersionId: text("template_version_id").references(() => eosEsignTemplateVersions.id, { onDelete: "restrict" }),
  counterpartyId: text("counterparty_id").references(() => eosEsignCounterparties.id, { onDelete: "restrict" }),
  workPacketId: text("work_packet_id").references(() => eosWorkPackets.id, { onDelete: "restrict" }),
  generationSnapshot: jsonb("generation_snapshot").notNull().default({}),
  parentDocumentVersionId: text("parent_document_version_id").references((): AnyPgColumn => eosEsignDocumentVersions.id, { onDelete: "restrict" }),
  negotiationId: text("negotiation_id").references((): AnyPgColumn => eosEsignNegotiations.id, { onDelete: "restrict" }),
  revisionSummary: text("revision_summary").notNull().default(""),
  revisionEvidenceSha256: text("revision_evidence_sha256").notNull().default(""),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_esign_document_version_key_idx").on(table.companyId, table.documentKey, table.documentVersion),
  index("eos_esign_document_version_evidence_idx").on(table.companyId, table.counselEvidenceId),
  check("eos_esign_document_version_hash_check", sql`${table.sourceSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_document_version_mime_check", sql`${table.mimeType} = 'application/pdf'`),
  check("eos_esign_document_version_size_check", sql`${table.sizeBytes} BETWEEN 1 AND 52428800`),
  check("eos_esign_document_version_page_count_check", sql`${table.pageCount} BETWEEN 1 AND 2000`),
]);

export const eosEsignEnvelopes = pgTable("eos_esign_envelopes", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  documentVersionId: text("document_version_id").notNull().references(() => eosEsignDocumentVersions.id, { onDelete: "restrict" }),
  recoveryAgreementInstanceId: text("recovery_agreement_instance_id"),
  state: text("state").notNull().default("draft"),
  routingMode: text("routing_mode").notNull().default("sequential"),
  assuranceMode: text("assurance_mode").notNull().default("link"),
  subject: text("subject").notNull(),
  message: text("message").notNull().default(""),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  declinedAt: timestamp("declined_at", { withTimezone: true }),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidReason: text("void_reason").notNull().default(""),
  finalStorageKey: text("final_storage_key").notNull().default(""),
  finalSha256: text("final_sha256").notNull().default(""),
  auditStorageKey: text("audit_storage_key").notNull().default(""),
  auditSha256: text("audit_sha256").notNull().default(""),
  templateVersionId: text("template_version_id").references(() => eosEsignTemplateVersions.id, { onDelete: "restrict" }),
  counterpartyId: text("counterparty_id").references(() => eosEsignCounterparties.id, { onDelete: "restrict" }),
  workPacketId: text("work_packet_id").references(() => eosWorkPackets.id, { onDelete: "restrict" }),
  evidenceId: text("evidence_id").references(() => eosEvidence.id, { onDelete: "restrict" }),
  clonedFromEnvelopeId: text("cloned_from_envelope_id"),
  renewalOfEnvelopeId: text("renewal_of_envelope_id"),
  replacesEnvelopeId: text("replaces_envelope_id").references((): AnyPgColumn => eosEsignEnvelopes.id, { onDelete: "restrict" }),
  replacedByEnvelopeId: text("replaced_by_envelope_id").references((): AnyPgColumn => eosEsignEnvelopes.id, { onDelete: "restrict" }),
  comparisonReviewSha256: text("comparison_review_sha256").notNull().default(""),
  comparisonReviewedByUserId: text("comparison_reviewed_by_user_id").references(() => users.id, { onDelete: "restrict" }),
  comparisonReviewedAt: timestamp("comparison_reviewed_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("eos_esign_envelope_state_idx").on(table.companyId, table.state, table.updatedAt),
  uniqueIndex("eos_esign_envelope_recovery_idx").on(table.companyId, table.recoveryAgreementInstanceId),
  check("eos_esign_envelope_state_check", sql`${table.state} IN ('draft','issued','in_progress','completed','declined','voided','expired','recovery_required')`),
  check("eos_esign_envelope_routing_check", sql`${table.routingMode} IN ('sequential','parallel')`),
  check("eos_esign_envelope_assurance_mode_check", sql`${table.assuranceMode} IN ('link','email_otp')`),
  check("eos_esign_envelope_version_check", sql`${table.version} > 0`),
  check("eos_esign_envelope_final_hash_check", sql`${table.finalSha256} = '' OR ${table.finalSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_envelope_audit_hash_check", sql`${table.auditSha256} = '' OR ${table.auditSha256} ~ '^[0-9a-f]{64}$'`),
]);

export const eosEsignRecipients = pgTable("eos_esign_recipients", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  envelopeId: text("envelope_id").notNull().references(() => eosEsignEnvelopes.id, { onDelete: "cascade" }),
  roleKey: text("role_key").notNull(),
  routingOrder: integer("routing_order").notNull().default(1),
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email").notNull(),
  state: text("state").notNull().default("pending"),
  tokenDigest: text("token_digest").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
  tokenUsedAt: timestamp("token_used_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  consentVersion: text("consent_version").notNull().default(""),
  consentedAt: timestamp("consented_at", { withTimezone: true }),
  comparisonAcknowledgementSha256: text("comparison_acknowledgement_sha256").notNull().default(""),
  comparisonAcknowledgedAt: timestamp("comparison_acknowledged_at", { withTimezone: true }),
  signatureMethod: text("signature_method").notNull().default(""),
  signatureName: text("signature_name").notNull().default(""),
  signatureSha256: text("signature_sha256").notNull().default(""),
  signatureCaptureSha256: text("signature_capture_sha256").notNull().default(""),
  signatureCaptureStorageKey: text("signature_capture_storage_key").notNull().default(""),
  signatureCaptureMimeType: text("signature_capture_mime_type").notNull().default(""),
  signatureCaptureSizeBytes: integer("signature_capture_size_bytes").notNull().default(0),
  signatureCaptureWidth: integer("signature_capture_width").notNull().default(0),
  signatureCaptureHeight: integer("signature_capture_height").notNull().default(0),
  fieldValues: jsonb("field_values").notNull().default({}),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  declinedAt: timestamp("declined_at", { withTimezone: true }),
  declineReason: text("decline_reason").notNull().default(""),
  networkFingerprintSha256: text("network_fingerprint_sha256").notNull().default(""),
  userAgentSha256: text("user_agent_sha256").notNull().default(""),
  deliveryState: text("delivery_state").notNull().default("manual_ready"),
  deliveryAttemptCount: integer("delivery_attempt_count").notNull().default(0),
  lastDeliveryAttemptId: text("last_delivery_attempt_id").notNull().default(""),
  lastDeliveredAt: timestamp("last_delivered_at", { withTimezone: true }),
  providerMessageReference: text("provider_message_reference").notNull().default(""),
  identityAssuranceState: text("identity_assurance_state").notNull().default("not_required"),
  identityVerifiedAt: timestamp("identity_verified_at", { withTimezone: true }),
  otpDigest: text("otp_digest").notNull().default(""),
  otpExpiresAt: timestamp("otp_expires_at", { withTimezone: true }),
  otpAttemptCount: integer("otp_attempt_count").notNull().default(0),
  otpSendCount: integer("otp_send_count").notNull().default(0),
  otpLastSentAt: timestamp("otp_last_sent_at", { withTimezone: true }),
  completionTokenDigest: text("completion_token_digest").notNull().default(""),
  completionDeliveryState: text("completion_delivery_state").notNull().default("not_requested"),
  completionDeliveryAttemptCount: integer("completion_delivery_attempt_count").notNull().default(0),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_esign_recipient_token_idx").on(table.tokenDigest),
  uniqueIndex("eos_esign_recipient_completion_token_idx").on(table.completionTokenDigest).where(sql`${table.completionTokenDigest} <> ''`),
  uniqueIndex("eos_esign_recipient_role_idx").on(table.envelopeId, table.roleKey),
  index("eos_esign_recipient_state_idx").on(table.companyId, table.state, table.updatedAt),
  check("eos_esign_recipient_state_check", sql`${table.state} IN ('pending','sent','opened','consented','signed','declined','expired')`),
  check("eos_esign_recipient_method_check", sql`${table.signatureMethod} IN ('','typed','drawn','uploaded')`),
  check("eos_esign_recipient_order_check", sql`${table.routingOrder} > 0`),
  check("eos_esign_recipient_token_hash_check", sql`${table.tokenDigest} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_recipient_signature_hash_check", sql`${table.signatureSha256} = '' OR ${table.signatureSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_recipient_capture_hash_check", sql`${table.signatureCaptureSha256} = '' OR ${table.signatureCaptureSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_recipient_capture_shape_check", sql`(
    ${table.signatureMethod} IN ('','typed') AND ${table.signatureCaptureStorageKey} = '' AND ${table.signatureCaptureMimeType} = '' AND ${table.signatureCaptureSizeBytes} = 0 AND ${table.signatureCaptureWidth} = 0 AND ${table.signatureCaptureHeight} = 0
  ) OR (
    ${table.signatureMethod} IN ('drawn','uploaded') AND ${table.signatureCaptureStorageKey} <> '' AND ${table.signatureCaptureMimeType} IN ('image/png','image/jpeg') AND ${table.signatureCaptureSizeBytes} BETWEEN 1 AND 524288 AND ${table.signatureCaptureWidth} BETWEEN 32 AND 2400 AND ${table.signatureCaptureHeight} BETWEEN 16 AND 1200
  )`),
  check("eos_esign_recipient_signed_capture_check", sql`${table.state} <> 'signed' OR (${table.signatureCaptureSha256} ~ '^[0-9a-f]{64}$' AND ${table.signatureSha256} ~ '^[0-9a-f]{64}$')`),
  check("eos_esign_recipient_delivery_state_check", sql`${table.deliveryState} IN ('routing_wait','manual_ready','sending','delivered','failed','uncertain')`),
  check("eos_esign_recipient_delivery_attempt_check", sql`${table.deliveryAttemptCount} >= 0`),
  check("eos_esign_recipient_identity_assurance_state_check", sql`${table.identityAssuranceState} IN ('not_required','pending','verified','locked')`),
  check("eos_esign_recipient_otp_digest_check", sql`${table.otpDigest} = '' OR ${table.otpDigest} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_recipient_otp_count_check", sql`${table.otpAttemptCount} BETWEEN 0 AND 5 AND ${table.otpSendCount} BETWEEN 0 AND 5`),
  check("eos_esign_recipient_completion_token_check", sql`${table.completionTokenDigest} = '' OR ${table.completionTokenDigest} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_recipient_completion_delivery_check", sql`${table.completionDeliveryState} IN ('not_requested','pending','delivering','delivered','retry','dead_letter')`),
  check("eos_esign_recipient_completion_attempt_count_check", sql`${table.completionDeliveryAttemptCount} >= 0`),
  check("eos_esign_recipient_version_check", sql`${table.version} > 0`),
]);

export const eosEsignEvents = pgTable("eos_esign_events", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  envelopeId: text("envelope_id").notNull().references(() => eosEsignEnvelopes.id, { onDelete: "cascade" }),
  recipientId: text("recipient_id").references(() => eosEsignRecipients.id, { onDelete: "restrict" }),
  sequence: integer("sequence").notNull(),
  eventType: text("event_type").notNull(),
  actorType: text("actor_type").notNull(),
  actorReference: text("actor_reference").notNull().default(""),
  eventProjection: jsonb("event_projection").notNull().default({}),
  previousEventSha256: text("previous_event_sha256").notNull().default(""),
  eventSha256: text("event_sha256").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_esign_event_sequence_idx").on(table.envelopeId, table.sequence),
  uniqueIndex("eos_esign_event_hash_idx").on(table.envelopeId, table.eventSha256),
  index("eos_esign_event_company_idx").on(table.companyId, table.occurredAt),
  check("eos_esign_event_sequence_check", sql`${table.sequence} > 0`),
  check("eos_esign_event_actor_check", sql`${table.actorType} IN ('operator','signer','system','provider')`),
  check("eos_esign_event_hash_check", sql`${table.eventSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_event_previous_hash_check", sql`${table.previousEventSha256} = '' OR ${table.previousEventSha256} ~ '^[0-9a-f]{64}$'`),
]);

export const eosEsignDeliveryAttempts = pgTable("eos_esign_delivery_attempts", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  envelopeId: text("envelope_id").notNull().references(() => eosEsignEnvelopes.id, { onDelete: "cascade" }),
  recipientId: text("recipient_id").notNull().references(() => eosEsignRecipients.id, { onDelete: "cascade" }),
  attemptNumber: integer("attempt_number").notNull(),
  channel: text("channel").notNull().default("gmail"),
  state: text("state").notNull().default("prepared"),
  tokenDigest: text("token_digest").notNull(),
  requestedByUserId: text("requested_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  providerMessageReference: text("provider_message_reference").notNull().default(""),
  failureCode: text("failure_code").notNull().default(""),
  failureMessage: text("failure_message").notNull().default(""),
  preparedAt: timestamp("prepared_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("eos_esign_delivery_attempt_number_idx").on(table.recipientId, table.attemptNumber),
  index("eos_esign_delivery_attempt_state_idx").on(table.companyId, table.state, table.preparedAt),
  check("eos_esign_delivery_attempt_number_check", sql`${table.attemptNumber} > 0`),
  check("eos_esign_delivery_channel_check", sql`${table.channel} IN ('gmail')`),
  check("eos_esign_delivery_state_check", sql`${table.state} IN ('prepared','delivered','failed','uncertain')`),
  check("eos_esign_delivery_token_hash_check", sql`${table.tokenDigest} ~ '^[0-9a-f]{64}$'`),
]);

export const eosEsignWebhookSubscriptions = pgTable("eos_esign_webhook_subscriptions", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  endpointUrl: text("endpoint_url").notNull(),
  description: text("description").notNull().default(""),
  eventTypes: jsonb("event_types").notNull().default(["*"]),
  secretCiphertext: text("secret_ciphertext").notNull(),
  secretFingerprint: text("secret_fingerprint").notNull(),
  state: text("state").notNull().default("active"),
  version: integer("version").notNull().default(1),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_esign_webhook_subscription_endpoint_idx").on(table.companyId, table.endpointUrl).where(sql`${table.state} <> 'revoked'`),
  index("eos_esign_webhook_subscription_state_idx").on(table.companyId, table.state, table.updatedAt),
  check("eos_esign_webhook_subscription_state_check", sql`${table.state} IN ('active','paused','revoked')`),
  check("eos_esign_webhook_subscription_version_check", sql`${table.version} > 0`),
  check("eos_esign_webhook_subscription_secret_check", sql`${table.secretCiphertext} LIKE 'enc:v1:%' AND ${table.secretFingerprint} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_webhook_subscription_event_types_check", sql`jsonb_typeof(${table.eventTypes}) = 'array'`),
]);

export const eosEsignWebhookDeliveries = pgTable("eos_esign_webhook_deliveries", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  subscriptionId: text("subscription_id").notNull().references(() => eosEsignWebhookSubscriptions.id, { onDelete: "cascade" }),
  eventId: text("event_id").notNull().references(() => eosEsignEvents.id, { onDelete: "cascade" }),
  state: text("state").notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  replayCount: integer("replay_count").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  leasedAt: timestamp("leased_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  lastHttpStatus: integer("last_http_status"),
  lastFailureCode: text("last_failure_code").notNull().default(""),
  lastFailureMessage: text("last_failure_message").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_esign_webhook_delivery_event_idx").on(table.subscriptionId, table.eventId),
  index("eos_esign_webhook_delivery_queue_idx").on(table.state, table.nextAttemptAt, table.createdAt),
  check("eos_esign_webhook_delivery_state_check", sql`${table.state} IN ('pending','delivering','retry','delivered','dead_letter')`),
  check("eos_esign_webhook_delivery_count_check", sql`${table.attemptCount} >= 0 AND ${table.replayCount} >= 0`),
]);

export const eosEsignWebhookAttempts = pgTable("eos_esign_webhook_attempts", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  deliveryId: text("delivery_id").notNull().references(() => eosEsignWebhookDeliveries.id, { onDelete: "cascade" }),
  attemptNumber: integer("attempt_number").notNull(),
  requestSha256: text("request_sha256").notNull(),
  outcome: text("outcome").notNull(),
  httpStatus: integer("http_status"),
  failureCode: text("failure_code").notNull().default(""),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
}, (table) => [
  uniqueIndex("eos_esign_webhook_attempt_number_idx").on(table.deliveryId, table.attemptNumber),
  check("eos_esign_webhook_attempt_number_check", sql`${table.attemptNumber} > 0`),
  check("eos_esign_webhook_attempt_hash_check", sql`${table.requestSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_webhook_attempt_outcome_check", sql`${table.outcome} IN ('delivered','retry','dead_letter')`),
]);

export const eosEsignCompletionDeliveries = pgTable("eos_esign_completion_deliveries", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  envelopeId: text("envelope_id").notNull().references(() => eosEsignEnvelopes.id, { onDelete: "cascade" }),
  recipientId: text("recipient_id").notNull().references(() => eosEsignRecipients.id, { onDelete: "cascade" }),
  requestedByUserId: text("requested_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  tokenCiphertext: text("token_ciphertext").notNull(),
  state: text("state").notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  replayCount: integer("replay_count").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  leasedAt: timestamp("leased_at", { withTimezone: true }),
  providerMessageReference: text("provider_message_reference").notNull().default(""),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  lastFailureCode: text("last_failure_code").notNull().default(""),
  lastFailureMessage: text("last_failure_message").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_esign_completion_delivery_recipient_idx").on(table.recipientId),
  index("eos_esign_completion_delivery_queue_idx").on(table.state, table.nextAttemptAt, table.createdAt),
  check("eos_esign_completion_delivery_state_check", sql`${table.state} IN ('pending','delivering','retry','delivered','dead_letter')`),
  check("eos_esign_completion_delivery_count_check", sql`${table.attemptCount} >= 0 AND ${table.replayCount} >= 0`),
  check("eos_esign_completion_delivery_token_check", sql`${table.tokenCiphertext} = '' OR ${table.tokenCiphertext} LIKE 'enc:v1:%'`),
]);

export const eosEsignCompletionDeliveryAttempts = pgTable("eos_esign_completion_delivery_attempts", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  deliveryId: text("delivery_id").notNull().references(() => eosEsignCompletionDeliveries.id, { onDelete: "cascade" }),
  attemptNumber: integer("attempt_number").notNull(),
  outcome: text("outcome").notNull(),
  providerMessageReference: text("provider_message_reference").notNull().default(""),
  failureCode: text("failure_code").notNull().default(""),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
}, (table) => [
  uniqueIndex("eos_esign_completion_attempt_number_idx").on(table.deliveryId, table.attemptNumber),
  check("eos_esign_completion_attempt_number_check", sql`${table.attemptNumber} > 0`),
  check("eos_esign_completion_attempt_outcome_check", sql`${table.outcome} IN ('delivered','retry','dead_letter')`),
]);

// Each completed-envelope verification is an append-only, hash-chained
// observation. The report deliberately contains only bounded hashes, counts,
// and failure codes; private storage keys and signer data stay outside it.
export const eosEsignIntegrityChecks = pgTable("eos_esign_integrity_checks", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  envelopeId: text("envelope_id").notNull().references(() => eosEsignEnvelopes.id, { onDelete: "cascade" }),
  requestedByUserId: text("requested_by_user_id").references(() => users.id, { onDelete: "restrict" }),
  triggerType: text("trigger_type").notNull(),
  state: text("state").notNull(),
  reason: text("reason").notNull().default(""),
  sourceSha256: text("source_sha256").notNull().default(""),
  finalSha256: text("final_sha256").notNull().default(""),
  auditSha256: text("audit_sha256").notNull().default(""),
  eventCount: integer("event_count").notNull().default(0),
  auditedEventCount: integer("audited_event_count").notNull().default(0),
  captureCount: integer("capture_count").notNull().default(0),
  failureCodes: jsonb("failure_codes").notNull().default([]),
  verificationProjection: jsonb("verification_projection").notNull().default({}),
  previousCheckSha256: text("previous_check_sha256").notNull().default(""),
  checkSha256: text("check_sha256").notNull(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_esign_integrity_check_hash_idx").on(table.envelopeId, table.checkSha256),
  index("eos_esign_integrity_check_latest_idx").on(table.companyId, table.envelopeId, table.checkedAt),
  index("eos_esign_integrity_check_schedule_idx").on(table.state, table.checkedAt),
  check("eos_esign_integrity_check_trigger_check", sql`${table.triggerType} IN ('completion','operator','scheduled','recovery')`),
  check("eos_esign_integrity_check_state_check", sql`${table.state} IN ('passed','failed','unavailable')`),
  check("eos_esign_integrity_check_reason_check", sql`char_length(${table.reason}) <= 1000`),
  check("eos_esign_integrity_check_hashes_check", sql`(${table.sourceSha256} = '' OR ${table.sourceSha256} ~ '^[0-9a-f]{64}$') AND (${table.finalSha256} = '' OR ${table.finalSha256} ~ '^[0-9a-f]{64}$') AND (${table.auditSha256} = '' OR ${table.auditSha256} ~ '^[0-9a-f]{64}$') AND (${table.previousCheckSha256} = '' OR ${table.previousCheckSha256} ~ '^[0-9a-f]{64}$') AND ${table.checkSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_integrity_check_counts_check", sql`${table.eventCount} >= 0 AND ${table.auditedEventCount} >= 0 AND ${table.auditedEventCount} <= ${table.eventCount} AND ${table.captureCount} >= 0`),
  check("eos_esign_integrity_check_failures_check", sql`jsonb_typeof(${table.failureCodes}) = 'array' AND jsonb_array_length(${table.failureCodes}) <= 50`),
  check("eos_esign_integrity_check_projection_check", sql`jsonb_typeof(${table.verificationProjection}) = 'object'`),
]);

export const eosEsignRetentionPolicies = pgTable("eos_esign_retention_policies", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  retentionDays: integer("retention_days").notNull(),
  backupRequired: boolean("backup_required").notNull().default(true),
  automaticDeletion: boolean("automatic_deletion").notNull().default(false),
  state: text("state").notNull().default("active"),
  version: integer("version").notNull().default(1),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_esign_retention_policy_active_idx").on(table.companyId).where(sql`${table.state} = 'active'`),
  check("eos_esign_retention_policy_days_check", sql`${table.retentionDays} BETWEEN 1 AND 36500`),
  check("eos_esign_retention_policy_state_check", sql`${table.state} IN ('active','retired')`),
  check("eos_esign_retention_policy_version_check", sql`${table.version} > 0`),
]);

export const eosEsignArtifacts = pgTable("eos_esign_artifacts", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  envelopeId: text("envelope_id").references(() => eosEsignEnvelopes.id, { onDelete: "restrict" }),
  documentVersionId: text("document_version_id").references(() => eosEsignDocumentVersions.id, { onDelete: "restrict" }),
  recipientId: text("recipient_id").references(() => eosEsignRecipients.id, { onDelete: "restrict" }),
  artifactKind: text("artifact_kind").notNull(),
  storageProvider: text("storage_provider").notNull(),
  storageKey: text("storage_key").notNull(),
  sha256: text("sha256").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  mimeType: text("mime_type").notNull(),
  state: text("state").notNull().default("active"),
  retentionPolicyId: text("retention_policy_id").references(() => eosEsignRetentionPolicies.id, { onDelete: "restrict" }),
  retainedUntil: timestamp("retained_until", { withTimezone: true }),
  backupState: text("backup_state").notNull().default("not_configured"),
  backupProvider: text("backup_provider").notNull().default(""),
  backupStorageKey: text("backup_storage_key").notNull().default(""),
  backupSha256: text("backup_sha256").notNull().default(""),
  backupVerifiedAt: timestamp("backup_verified_at", { withTimezone: true }),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  lastFailureCode: text("last_failure_code").notNull().default(""),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_esign_artifact_storage_idx").on(table.companyId, table.storageProvider, table.storageKey),
  index("eos_esign_artifact_envelope_idx").on(table.companyId, table.envelopeId, table.artifactKind),
  index("eos_esign_artifact_custody_schedule_idx").on(table.state, table.backupState, table.lastVerifiedAt),
  check("eos_esign_artifact_kind_check", sql`${table.artifactKind} IN ('source_pdf','completed_pdf','audit_json','signature_capture')`),
  check("eos_esign_artifact_provider_check", sql`${table.storageProvider} IN ('filesystem','s3')`),
  check("eos_esign_artifact_backup_provider_check", sql`${table.backupProvider} IN ('','filesystem','s3')`),
  check("eos_esign_artifact_hash_check", sql`${table.sha256} ~ '^[0-9a-f]{64}$' AND (${table.backupSha256} = '' OR ${table.backupSha256} ~ '^[0-9a-f]{64}$')`),
  check("eos_esign_artifact_size_check", sql`${table.sizeBytes} BETWEEN 1 AND 52428800`),
  check("eos_esign_artifact_state_check", sql`${table.state} IN ('active','deletion_pending','deleted','recovery_required')`),
  check("eos_esign_artifact_backup_state_check", sql`${table.backupState} IN ('not_configured','pending','verified','failed','deleted')`),
  check("eos_esign_artifact_version_check", sql`${table.version} > 0`),
]);

export const eosEsignLegalHolds = pgTable("eos_esign_legal_holds", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  envelopeId: text("envelope_id").notNull().references(() => eosEsignEnvelopes.id, { onDelete: "restrict" }),
  reason: text("reason").notNull(), reference: text("reference").notNull().default(""), state: text("state").notNull().default("active"),
  placedByUserId: text("placed_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
  releasedByUserId: text("released_by_user_id").references(() => users.id, { onDelete: "restrict" }), releasedAt: timestamp("released_at", { withTimezone: true }), releaseReason: text("release_reason").notNull().default(""), version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("eos_esign_legal_hold_active_idx").on(table.envelopeId).where(sql`${table.state} = 'active'`),
  check("eos_esign_legal_hold_state_check", sql`${table.state} IN ('active','released')`),
  check("eos_esign_legal_hold_reason_check", sql`char_length(${table.reason}) BETWEEN 10 AND 1000 AND char_length(${table.releaseReason}) <= 1000`),
  check("eos_esign_legal_hold_release_check", sql`(${table.state} = 'active' AND ${table.releasedByUserId} IS NULL AND ${table.releasedAt} IS NULL AND ${table.releaseReason} = '') OR (${table.state} = 'released' AND ${table.releasedByUserId} IS NOT NULL AND ${table.releasedAt} IS NOT NULL AND char_length(${table.releaseReason}) >= 10)`),
  check("eos_esign_legal_hold_version_check", sql`${table.version} > 0`),
]);

export const eosEsignDeletionRequests = pgTable("eos_esign_deletion_requests", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), envelopeId: text("envelope_id").notNull().references(() => eosEsignEnvelopes.id, { onDelete: "restrict" }),
  requestedByUserId: text("requested_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), reason: text("reason").notNull(), state: text("state").notNull().default("pending_approval"),
  decidedByUserId: text("decided_by_user_id").references(() => users.id, { onDelete: "restrict" }), decisionReason: text("decision_reason").notNull().default(""), decidedAt: timestamp("decided_at", { withTimezone: true }),
  executedByUserId: text("executed_by_user_id").references(() => users.id, { onDelete: "restrict" }), executedAt: timestamp("executed_at", { withTimezone: true }), failureCode: text("failure_code").notNull().default(""),
  version: integer("version").notNull().default(1), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_esign_deletion_request_open_idx").on(table.envelopeId).where(sql`${table.state} IN ('pending_approval','approved','executing')`),
  check("eos_esign_deletion_request_state_check", sql`${table.state} IN ('pending_approval','approved','rejected','blocked','executing','completed','failed','cancelled')`),
  check("eos_esign_deletion_request_reason_check", sql`char_length(${table.reason}) BETWEEN 10 AND 1000 AND char_length(${table.decisionReason}) <= 1000`),
  check("eos_esign_deletion_request_version_check", sql`${table.version} > 0`),
]);

export const eosEsignCustodyEvents = pgTable("eos_esign_custody_events", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), envelopeId: text("envelope_id").references(() => eosEsignEnvelopes.id, { onDelete: "restrict" }), artifactId: text("artifact_id").references(() => eosEsignArtifacts.id, { onDelete: "restrict" }), actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
  eventType: text("event_type").notNull(), eventProjection: jsonb("event_projection").notNull().default({}), previousEventSha256: text("previous_event_sha256").notNull().default(""), eventSha256: text("event_sha256").notNull(), occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_esign_custody_event_hash_idx").on(table.companyId, table.eventSha256),
  index("eos_esign_custody_event_envelope_idx").on(table.companyId, table.envelopeId, table.occurredAt),
  check("eos_esign_custody_event_hash_check", sql`${table.eventSha256} ~ '^[0-9a-f]{64}$' AND (${table.previousEventSha256} = '' OR ${table.previousEventSha256} ~ '^[0-9a-f]{64}$')`),
  check("eos_esign_custody_event_projection_check", sql`jsonb_typeof(${table.eventProjection}) = 'object'`),
]);

export const eosEsignStorageDrills = pgTable("eos_esign_storage_drills", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  requestedByUserId: text("requested_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  reason: text("reason").notNull(),
  state: text("state").notNull().default("running"),
  primaryProvider: text("primary_provider").notNull(),
  backupProvider: text("backup_provider").notNull(),
  primaryIdentitySha256: text("primary_identity_sha256").notNull(),
  backupIdentitySha256: text("backup_identity_sha256").notNull(),
  capabilitySnapshot: jsonb("capability_snapshot").notNull().default({}),
  steps: jsonb("steps").notNull().default([]),
  receiptSha256: text("receipt_sha256").notNull().default(""),
  failureCode: text("failure_code").notNull().default(""),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_esign_storage_drill_running_idx").on(table.companyId).where(sql`${table.state} = 'running'`),
  index("eos_esign_storage_drill_history_idx").on(table.companyId, table.startedAt),
  check("eos_esign_storage_drill_reason_check", sql`char_length(${table.reason}) BETWEEN 8 AND 1000`),
  check("eos_esign_storage_drill_state_check", sql`${table.state} IN ('running','passed','failed')`),
  check("eos_esign_storage_drill_provider_check", sql`${table.primaryProvider} IN ('filesystem','s3') AND ${table.backupProvider} IN ('filesystem','s3')`),
  check("eos_esign_storage_drill_identity_check", sql`${table.primaryIdentitySha256} ~ '^[0-9a-f]{64}$' AND ${table.backupIdentitySha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_storage_drill_json_check", sql`jsonb_typeof(${table.capabilitySnapshot}) = 'object' AND jsonb_typeof(${table.steps}) = 'array'`),
  check("eos_esign_storage_drill_completion_check", sql`(${table.state} = 'running' AND ${table.completedAt} IS NULL AND ${table.receiptSha256} = '' AND ${table.failureCode} = '') OR (${table.state} = 'passed' AND ${table.completedAt} IS NOT NULL AND ${table.receiptSha256} ~ '^[0-9a-f]{64}$' AND ${table.failureCode} = '') OR (${table.state} = 'failed' AND ${table.completedAt} IS NOT NULL AND ${table.receiptSha256} ~ '^[0-9a-f]{64}$' AND char_length(${table.failureCode}) BETWEEN 1 AND 200)`),
]);

export const eosEsignEvidencePromotions = pgTable("eos_esign_evidence_promotions", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  envelopeId: text("envelope_id").notNull().references(() => eosEsignEnvelopes.id, { onDelete: "restrict" }), evidenceId: text("evidence_id").notNull().references(() => eosEvidence.id, { onDelete: "restrict" }),
  workPacketId: text("work_packet_id").notNull().references(() => eosWorkPackets.id, { onDelete: "restrict" }), promotedByUserId: text("promoted_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  supportedClaimSummary: text("supported_claim_summary").notNull(), verifierMethod: text("verifier_method").notNull(), receiptSha256: text("receipt_sha256").notNull(), promotedAt: timestamp("promoted_at", { withTimezone: true }).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_esign_evidence_promotion_envelope_idx").on(table.envelopeId), uniqueIndex("eos_esign_evidence_promotion_evidence_idx").on(table.evidenceId), uniqueIndex("eos_esign_evidence_promotion_receipt_idx").on(table.receiptSha256),
  check("eos_esign_evidence_promotion_hash_check", sql`${table.receiptSha256} ~ '^[0-9a-f]{64}$'`),
]);

export const eosEsignNegotiations = pgTable("eos_esign_negotiations", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  envelopeId: text("envelope_id").notNull().references(() => eosEsignEnvelopes.id, { onDelete: "restrict" }), state: text("state").notNull().default("open"),
  openedByType: text("opened_by_type").notNull(), openedByReference: text("opened_by_reference").notNull(), subject: text("subject").notNull(),
  resolutionSummary: text("resolution_summary").notNull().default(""), resolvedByUserId: text("resolved_by_user_id").references(() => users.id, { onDelete: "restrict" }),
  replacementDocumentVersionId: text("replacement_document_version_id").references(() => eosEsignDocumentVersions.id, { onDelete: "restrict" }), replacementEnvelopeId: text("replacement_envelope_id").references(() => eosEsignEnvelopes.id, { onDelete: "restrict" }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }), version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_esign_negotiation_open_idx").on(table.envelopeId).where(sql`${table.state} = 'open'`),
  index("eos_esign_negotiation_company_state_idx").on(table.companyId, table.state, table.updatedAt),
]);

export const eosEsignNegotiationEntries = pgTable("eos_esign_negotiation_entries", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  negotiationId: text("negotiation_id").notNull().references(() => eosEsignNegotiations.id, { onDelete: "restrict" }),
  envelopeId: text("envelope_id").notNull().references(() => eosEsignEnvelopes.id, { onDelete: "restrict" }),
  authorType: text("author_type").notNull(), authorReference: text("author_reference").notNull(), entryType: text("entry_type").notNull(), body: text("body").notNull(),
  requestedChanges: jsonb("requested_changes").notNull().default([]), previousEntrySha256: text("previous_entry_sha256").notNull().default(""), entrySha256: text("entry_sha256").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("eos_esign_negotiation_entry_timeline_idx").on(table.negotiationId, table.createdAt), uniqueIndex("eos_esign_negotiation_entry_hash_idx").on(table.entrySha256)]);

export const eosEsignDocumentComparisons = pgTable("eos_esign_document_comparisons", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  sourceDocumentVersionId: text("source_document_version_id").notNull().references(() => eosEsignDocumentVersions.id, { onDelete: "restrict" }),
  targetDocumentVersionId: text("target_document_version_id").notNull().references(() => eosEsignDocumentVersions.id, { onDelete: "restrict" }),
  negotiationId: text("negotiation_id").references(() => eosEsignNegotiations.id, { onDelete: "restrict" }), comparisonType: text("comparison_type").notNull().default("operator_declared"),
  sourceSha256: text("source_sha256").notNull(), targetSha256: text("target_sha256").notNull(), revisionSummary: text("revision_summary").notNull(),
  declaredChanges: jsonb("declared_changes").notNull().default([]),
  structuredDiff: jsonb("structured_diff").notNull().default({}), diffStats: jsonb("diff_stats").notNull().default({}),
  sourceTextSha256: text("source_text_sha256").notNull().default(""), targetTextSha256: text("target_text_sha256").notNull().default(""),
  comparisonSha256: text("comparison_sha256").notNull(),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("eos_esign_document_comparison_target_idx").on(table.targetDocumentVersionId), uniqueIndex("eos_esign_document_comparison_hash_idx").on(table.comparisonSha256), index("eos_esign_document_comparison_source_idx").on(table.companyId, table.sourceDocumentVersionId, table.createdAt)]);

export const eosEsignReminderSchedules = pgTable("eos_esign_reminder_schedules", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  envelopeId: text("envelope_id").notNull().references(() => eosEsignEnvelopes.id, { onDelete: "restrict" }), recipientId: text("recipient_id").notNull().references(() => eosEsignRecipients.id, { onDelete: "restrict" }),
  state: text("state").notNull().default("active"), nextReminderAt: timestamp("next_reminder_at", { withTimezone: true }).notNull(), intervalDays: integer("interval_days").notNull(), maxReminders: integer("max_reminders").notNull(), sentCount: integer("sent_count").notNull().default(0),
  requestedByUserId: text("requested_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), lastFailureCode: text("last_failure_code").notNull().default(""), leasedAt: timestamp("leased_at", { withTimezone: true }), version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("eos_esign_reminder_active_idx").on(table.recipientId).where(sql`${table.state} IN ('active','delivering')`), index("eos_esign_reminder_due_idx").on(table.state, table.nextReminderAt)]);

export const eosEsignBatches = pgTable("eos_esign_batches", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), action: text("action").notNull(), state: text("state").notNull().default("running"), reason: text("reason").notNull(),
  requestedByUserId: text("requested_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), requestedCount: integer("requested_count").notNull(), succeededCount: integer("succeeded_count").notNull().default(0), failedCount: integer("failed_count").notNull().default(0), receiptSha256: text("receipt_sha256").notNull().default(""),
  completedAt: timestamp("completed_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("eos_esign_batch_history_idx").on(table.companyId, table.createdAt)]);

export const eosEsignBatchItems = pgTable("eos_esign_batch_items", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), batchId: text("batch_id").notNull().references(() => eosEsignBatches.id, { onDelete: "restrict" }), envelopeId: text("envelope_id").notNull().references(() => eosEsignEnvelopes.id, { onDelete: "restrict" }), recipientId: text("recipient_id").references(() => eosEsignRecipients.id, { onDelete: "restrict" }),
  outcome: text("outcome").notNull(), failureCode: text("failure_code").notNull().default(""), resultProjection: jsonb("result_projection").notNull().default({}), itemSha256: text("item_sha256").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("eos_esign_batch_item_batch_idx").on(table.batchId, table.createdAt), uniqueIndex("eos_esign_batch_item_hash_idx").on(table.itemSha256)]);

export const eosEsignObligationPromotions = pgTable("eos_esign_obligation_promotions", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), envelopeId: text("envelope_id").notNull().references(() => eosEsignEnvelopes.id, { onDelete: "restrict" }), evidenceId: text("evidence_id").notNull().references(() => eosEvidence.id, { onDelete: "restrict" }), obligationId: text("obligation_id").notNull().references(() => eosRisksControls.id, { onDelete: "restrict" }),
  sourceExcerpt: text("source_excerpt").notNull(), sourceExcerptSha256: text("source_excerpt_sha256").notNull(), promotedByUserId: text("promoted_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), receiptSha256: text("receipt_sha256").notNull(), promotedAt: timestamp("promoted_at", { withTimezone: true }).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("eos_esign_obligation_promotion_envelope_idx").on(table.companyId, table.envelopeId), uniqueIndex("eos_esign_obligation_promotion_obligation_idx").on(table.obligationId), uniqueIndex("eos_esign_obligation_promotion_receipt_idx").on(table.receiptSha256)]);

export const eosEsignObligationReviews = pgTable("eos_esign_obligation_reviews", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  envelopeId: text("envelope_id").notNull().references(() => eosEsignEnvelopes.id, { onDelete: "restrict" }),
  promotionId: text("promotion_id").notNull().references(() => eosEsignObligationPromotions.id, { onDelete: "restrict" }),
  obligationId: text("obligation_id").notNull().references(() => eosRisksControls.id, { onDelete: "restrict" }),
  stateBefore: text("state_before").notNull(),
  stateAfter: text("state_after").notNull(),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  evidenceIds: jsonb("evidence_ids").notNull().default([]),
  reviewNote: text("review_note").notNull(),
  nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
  authorityClass: text("authority_class").notNull(),
  policyDecisionId: text("policy_decision_id").notNull().references((): AnyPgColumn => eosPolicyDecisions.id, { onDelete: "restrict" }),
  sourceExcerptSha256: text("source_excerpt_sha256").notNull(),
  previousReviewSha256: text("previous_review_sha256").notNull().default(""),
  reviewSha256: text("review_sha256").notNull(),
  reviewedByUserId: text("reviewed_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("eos_esign_obligation_review_obligation_idx").on(table.companyId, table.obligationId, table.reviewedAt),
  index("eos_esign_obligation_review_envelope_idx").on(table.companyId, table.envelopeId, table.reviewedAt),
  uniqueIndex("eos_esign_obligation_review_hash_idx").on(table.reviewSha256),
  check("eos_esign_obligation_review_state_before_check", sql`${table.stateBefore} IN ('identified','under_assessment','applicable_active','assigned','treating_in_progress','monitoring','accepted','overdue_breached','remediating','satisfied_closed','superseded')`),
  check("eos_esign_obligation_review_state_after_check", sql`${table.stateAfter} IN ('identified','under_assessment','applicable_active','assigned','treating_in_progress','monitoring','accepted','overdue_breached','remediating','satisfied_closed','superseded')`),
  check("eos_esign_obligation_review_authority_check", sql`${table.authorityClass} IN ('execute','decide')`),
]);

// A signing-link expiry is deliberately not an agreement term. Contract plans
// record human-reviewed commercial dates and accountable ownership only after
// execution, while immutable events preserve every scheduling/decision change.
export const eosEsignContractPlans = pgTable("eos_esign_contract_plans", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  envelopeId: text("envelope_id").notNull().references(() => eosEsignEnvelopes.id, { onDelete: "restrict" }),
  lifecycleState: text("lifecycle_state").notNull().default("active"),
  renewalIntent: text("renewal_intent").notNull().default("undecided"),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  contractEndsAt: timestamp("contract_ends_at", { withTimezone: true }),
  noticeDeadlineAt: timestamp("notice_deadline_at", { withTimezone: true }),
  nextReviewAt: timestamp("next_review_at", { withTimezone: true }).notNull(),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  classification: text("classification").notNull().default("confidential"),
  notes: text("notes").notNull().default(""),
  version: integer("version").notNull().default(1),
  lastPolicyDecisionId: text("last_policy_decision_id").notNull().references((): AnyPgColumn => eosPolicyDecisions.id, { onDelete: "restrict" }),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_esign_contract_plan_envelope_idx").on(table.companyId, table.envelopeId),
  index("eos_esign_contract_plan_review_idx").on(table.companyId, table.lifecycleState, table.nextReviewAt),
  index("eos_esign_contract_plan_owner_idx").on(table.ownerSeatId, table.lifecycleState),
  check("eos_esign_contract_plan_state_check", sql`${table.lifecycleState} IN ('active','up_for_renewal','renewal_in_progress','nonrenewing','expired','closed')`),
  check("eos_esign_contract_plan_intent_check", sql`${table.renewalIntent} IN ('undecided','renew','renegotiate','terminate','allow_expiry')`),
  check("eos_esign_contract_plan_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`),
  check("eos_esign_contract_plan_version_check", sql`${table.version} > 0`),
  check("eos_esign_contract_plan_term_check", sql`${table.contractEndsAt} IS NULL OR ${table.contractEndsAt} > ${table.effectiveAt}`),
  check("eos_esign_contract_plan_notice_check", sql`${table.noticeDeadlineAt} IS NULL OR ${table.contractEndsAt} IS NULL OR ${table.noticeDeadlineAt} <= ${table.contractEndsAt}`),
]);

export const eosEsignContractPlanEvents = pgTable("eos_esign_contract_plan_events", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull().references(() => eosEsignContractPlans.id, { onDelete: "restrict" }),
  envelopeId: text("envelope_id").notNull().references(() => eosEsignEnvelopes.id, { onDelete: "restrict" }),
  eventType: text("event_type").notNull(),
  stateBefore: text("state_before").notNull(),
  stateAfter: text("state_after").notNull(),
  intentBefore: text("intent_before").notNull(),
  intentAfter: text("intent_after").notNull(),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  scheduleSnapshot: jsonb("schedule_snapshot").notNull(),
  evidenceIds: jsonb("evidence_ids").notNull().default([]),
  note: text("note").notNull(),
  authorityClass: text("authority_class").notNull(),
  policyDecisionId: text("policy_decision_id").notNull().references((): AnyPgColumn => eosPolicyDecisions.id, { onDelete: "restrict" }),
  previousEventSha256: text("previous_event_sha256").notNull().default(""),
  eventSha256: text("event_sha256").notNull(),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("eos_esign_contract_plan_event_plan_idx").on(table.companyId, table.planId, table.recordedAt),
  uniqueIndex("eos_esign_contract_plan_event_hash_idx").on(table.eventSha256),
  check("eos_esign_contract_plan_event_type_check", sql`${table.eventType} IN ('plan_recorded','renewal_decision_recorded')`),
  check("eos_esign_contract_plan_event_authority_check", sql`${table.authorityClass} IN ('execute','decide')`),
  check("eos_esign_contract_plan_event_hash_check", sql`${table.eventSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_contract_plan_event_previous_hash_check", sql`${table.previousEventSha256} = '' OR ${table.previousEventSha256} ~ '^[0-9a-f]{64}$'`),
]);

export const eosEsignContractNotices = pgTable("eos_esign_contract_notices", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull().references(() => eosEsignContractPlans.id, { onDelete: "restrict" }),
  envelopeId: text("envelope_id").notNull().references(() => eosEsignEnvelopes.id, { onDelete: "restrict" }),
  noticeType: text("notice_type").notNull(),
  recipientName: text("recipient_name").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  subject: text("subject").notNull(),
  bodyText: text("body_text").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  classification: text("classification").notNull().default("confidential"),
  contentSha256: text("content_sha256").notNull(),
  state: text("state").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  approvalEvidenceIds: jsonb("approval_evidence_ids").notNull().default([]),
  approvalNote: text("approval_note").notNull().default(""),
  approvalPolicyDecisionId: text("approval_policy_decision_id").references((): AnyPgColumn => eosPolicyDecisions.id, { onDelete: "restrict" }),
  approvalSha256: text("approval_sha256").notNull().default(""),
  approvedByUserId: text("approved_by_user_id").references(() => users.id, { onDelete: "restrict" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  deliveryAttemptCount: integer("delivery_attempt_count").notNull().default(0),
  lastDeliveryAttemptId: text("last_delivery_attempt_id"),
  providerMessageReference: text("provider_message_reference").notNull().default(""),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("eos_esign_contract_notice_plan_idx").on(table.companyId, table.planId, table.dueAt),
  index("eos_esign_contract_notice_queue_idx").on(table.companyId, table.state, table.dueAt),
  check("eos_esign_contract_notice_type_check", sql`${table.noticeType} IN ('renewal_offer','nonrenewal','termination','cure','other')`),
  check("eos_esign_contract_notice_state_check", sql`${table.state} IN ('draft','approved','sending','delivered','failed','uncertain','cancelled')`),
  check("eos_esign_contract_notice_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`),
  check("eos_esign_contract_notice_content_hash_check", sql`${table.contentSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_contract_notice_approval_hash_check", sql`${table.approvalSha256} = '' OR ${table.approvalSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_contract_notice_version_check", sql`${table.version} > 0 AND ${table.deliveryAttemptCount} >= 0`),
]);

export const eosEsignContractNoticeAttempts = pgTable("eos_esign_contract_notice_attempts", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  noticeId: text("notice_id").notNull().references(() => eosEsignContractNotices.id, { onDelete: "restrict" }),
  planId: text("plan_id").notNull().references(() => eosEsignContractPlans.id, { onDelete: "restrict" }),
  envelopeId: text("envelope_id").notNull().references(() => eosEsignEnvelopes.id, { onDelete: "restrict" }),
  attemptNumber: integer("attempt_number").notNull(),
  channel: text("channel").notNull().default("gmail"),
  state: text("state").notNull().default("prepared"),
  contentSha256: text("content_sha256").notNull(),
  approvalSha256: text("approval_sha256").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  requestedByUserId: text("requested_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  policyDecisionId: text("policy_decision_id").notNull().references((): AnyPgColumn => eosPolicyDecisions.id, { onDelete: "restrict" }),
  providerMessageReference: text("provider_message_reference").notNull().default(""),
  failureCode: text("failure_code").notNull().default(""),
  failureMessage: text("failure_message").notNull().default(""),
  reconciliationNote: text("reconciliation_note").notNull().default(""),
  reconciliationPolicyDecisionId: text("reconciliation_policy_decision_id").references((): AnyPgColumn => eosPolicyDecisions.id, { onDelete: "restrict" }),
  reconciledByUserId: text("reconciled_by_user_id").references(() => users.id, { onDelete: "restrict" }),
  reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
  preparedAt: timestamp("prepared_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("eos_esign_contract_notice_attempt_number_idx").on(table.noticeId, table.attemptNumber),
  index("eos_esign_contract_notice_attempt_state_idx").on(table.companyId, table.state, table.preparedAt),
  check("eos_esign_contract_notice_attempt_state_check", sql`${table.state} IN ('prepared','delivered','failed','uncertain')`),
  check("eos_esign_contract_notice_attempt_channel_check", sql`${table.channel} = 'gmail'`),
  check("eos_esign_contract_notice_attempt_hash_check", sql`${table.contentSha256} ~ '^[0-9a-f]{64}$' AND ${table.approvalSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_esign_contract_notice_attempt_number_check", sql`${table.attemptNumber} > 0`),
]);

// Module 7 customer-success control state. Stakeholder identity, relationship,
// Work Packet, Evidence, and contract authority remain in their canonical tables.
export const eosCustomerSuccessAccounts = pgTable("eos_customer_success_accounts", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  stakeholderId: text("stakeholder_id").notNull().references(() => eosStakeholders.id, { onDelete: "restrict" }),
  relationshipId: text("relationship_id").notNull().references(() => eosStakeholderRelationships.id, { onDelete: "restrict" }),
  contractEnvelopeId: text("contract_envelope_id").references(() => eosEsignEnvelopes.id, { onDelete: "restrict" }),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  lifecycleState: text("lifecycle_state").notNull().default("active"),
  healthState: text("health_state").notNull().default("unknown"),
  healthScore: integer("health_score"),
  renewalIntent: text("renewal_intent").notNull().default("undecided"),
  reviewCadenceDays: integer("review_cadence_days").notNull(),
  nextReviewAt: text("next_review_at").notNull(),
  renewalAt: text("renewal_at"),
  successDefinition: text("success_definition").notNull(),
  classification: text("classification").notNull().default("confidential"),
  version: integer("version").notNull().default(1),
  lastEventId: text("last_event_id"),
  lastHealthReviewId: text("last_health_review_id"),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_customer_success_account_party_idx").on(table.companyId, table.stakeholderId),
  index("eos_customer_success_account_owner_idx").on(table.ownerSeatId, table.lifecycleState),
  index("eos_customer_success_account_review_idx").on(table.companyId, table.nextReviewAt),
  check("eos_customer_success_account_lifecycle_check", sql`${table.lifecycleState} IN ('active','renewal_review','renewing','nonrenewing','churned','closed')`),
  check("eos_customer_success_account_health_check", sql`${table.healthState} IN ('unknown','healthy','watch','at_risk','critical')`),
  check("eos_customer_success_account_score_check", sql`${table.healthScore} IS NULL OR (${table.healthScore} >= 0 AND ${table.healthScore} <= 100)`),
  check("eos_customer_success_account_renewal_check", sql`${table.renewalIntent} IN ('undecided','renew','renegotiate','terminate','allow_expiry','defer')`),
  check("eos_customer_success_account_version_check", sql`${table.version} > 0 AND ${table.reviewCadenceDays} BETWEEN 1 AND 365`),
  check("eos_customer_success_account_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`),
]);

export const eosCustomerSuccessOutcomes = pgTable("eos_customer_success_outcomes", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), accountId: text("account_id").notNull().references(() => eosCustomerSuccessAccounts.id, { onDelete: "restrict" }), outcomeKey: text("outcome_key").notNull(), title: text("title").notNull(), definition: text("definition").notNull(), baselineValue: text("baseline_value").notNull(), targetValue: text("target_value").notNull(), actualValue: text("actual_value").notNull().default("not_recorded"), unit: text("unit").notNull(), dueAt: text("due_at").notNull(), attributionModel: text("attribution_model").notNull(), attributionRationale: text("attribution_rationale").notNull(), state: text("state").notNull().default("tracking"), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), evidenceIds: jsonb("evidence_ids").notNull().default([]), classification: text("classification").notNull().default("confidential"), definitionSha256: text("definition_sha256").notNull(), version: integer("version").notNull().default(1), lastEventId: text("last_event_id"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_customer_success_outcome_key_idx").on(table.accountId, table.outcomeKey), uniqueIndex("eos_customer_success_outcome_hash_idx").on(table.companyId, table.definitionSha256), index("eos_customer_success_outcome_state_idx").on(table.accountId, table.state, table.dueAt), check("eos_customer_success_outcome_state_check", sql`${table.state} IN ('tracking','achieved','not_achieved','abandoned')`), check("eos_customer_success_outcome_attribution_check", sql`${table.attributionModel} IN ('direct','contributing','correlated','unknown')`), check("eos_customer_success_outcome_version_check", sql`${table.version} > 0`), check("eos_customer_success_outcome_hash_check", sql`${table.definitionSha256} ~ '^[0-9a-f]{64}$'`), check("eos_customer_success_outcome_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`),
]);

export const eosCustomerSuccessIssues = pgTable("eos_customer_success_issues", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), accountId: text("account_id").notNull().references(() => eosCustomerSuccessAccounts.id, { onDelete: "restrict" }), issueKey: text("issue_key").notNull(), title: text("title").notNull(), severity: text("severity").notNull(), summary: text("summary").notNull(), state: text("state").notNull().default("open"), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), dueAt: text("due_at").notNull(), evidenceIds: jsonb("evidence_ids").notNull().default([]), resolution: text("resolution").notNull().default(""), classification: text("classification").notNull().default("confidential"), definitionSha256: text("definition_sha256").notNull(), version: integer("version").notNull().default(1), lastEventId: text("last_event_id"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), resolvedAt: timestamp("resolved_at", { withTimezone: true }), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_customer_success_issue_key_idx").on(table.accountId, table.issueKey), uniqueIndex("eos_customer_success_issue_hash_idx").on(table.companyId, table.definitionSha256), index("eos_customer_success_issue_state_idx").on(table.accountId, table.state, table.severity), check("eos_customer_success_issue_state_check", sql`${table.state} IN ('open','resolved')`), check("eos_customer_success_issue_severity_check", sql`${table.severity} IN ('low','medium','high','critical')`), check("eos_customer_success_issue_version_check", sql`${table.version} > 0`), check("eos_customer_success_issue_hash_check", sql`${table.definitionSha256} ~ '^[0-9a-f]{64}$'`), check("eos_customer_success_issue_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`),
]);

export const eosCustomerSuccessReports = pgTable("eos_customer_success_reports", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), accountId: text("account_id").notNull().references(() => eosCustomerSuccessAccounts.id, { onDelete: "restrict" }), reportKey: text("report_key").notNull(), title: text("title").notNull(), periodStart: text("period_start").notNull(), periodEnd: text("period_end").notNull(), executiveSummary: text("executive_summary").notNull(), snapshot: jsonb("snapshot").notNull(), evidenceIds: jsonb("evidence_ids").notNull(), proofConsent: text("proof_consent").notNull(), consentEvidenceId: text("consent_evidence_id").references(() => eosEvidence.id, { onDelete: "restrict" }), state: text("state").notNull().default("prepared"), reportSha256: text("report_sha256").notNull(), version: integer("version").notNull().default(1), approvalEvidenceIds: jsonb("approval_evidence_ids").notNull().default([]), approvalNote: text("approval_note").notNull().default(""), approvedByUserId: text("approved_by_user_id").references(() => users.id, { onDelete: "restrict" }), approvedAt: timestamp("approved_at", { withTimezone: true }), deliveryChannel: text("delivery_channel"), recipientScope: text("recipient_scope").notNull().default(""), externalReference: text("external_reference").notNull().default(""), receiptEvidenceId: text("receipt_evidence_id").references(() => eosEvidence.id, { onDelete: "restrict" }), deliveredAt: timestamp("delivered_at", { withTimezone: true }), classification: text("classification").notNull().default("confidential"), lastEventId: text("last_event_id"), preparedByUserId: text("prepared_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), preparedAt: timestamp("prepared_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_customer_success_report_key_idx").on(table.accountId, table.reportKey), uniqueIndex("eos_customer_success_report_hash_idx").on(table.companyId, table.reportSha256), index("eos_customer_success_report_state_idx").on(table.accountId, table.state, table.periodEnd), check("eos_customer_success_report_state_check", sql`${table.state} IN ('prepared','approved','delivery_recorded')`), check("eos_customer_success_report_consent_check", sql`${table.proofConsent} IN ('internal_only','customer_approved','public_approved') AND (${table.proofConsent} = 'internal_only' OR ${table.consentEvidenceId} IS NOT NULL)`), check("eos_customer_success_report_hash_check", sql`${table.reportSha256} ~ '^[0-9a-f]{64}$'`), check("eos_customer_success_report_version_check", sql`${table.version} > 0`), check("eos_customer_success_report_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`),
]);

export const eosCustomerSuccessEvents = pgTable("eos_customer_success_events", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), accountId: text("account_id").notNull().references(() => eosCustomerSuccessAccounts.id, { onDelete: "restrict" }), eventType: text("event_type").notNull(), subjectType: text("subject_type").notNull(), subjectId: text("subject_id").notNull(), accountVersionBefore: integer("account_version_before").notNull(), accountVersionAfter: integer("account_version_after").notNull(), subjectVersionBefore: integer("subject_version_before").notNull(), subjectVersionAfter: integer("subject_version_after").notNull(), evidenceIds: jsonb("evidence_ids").notNull().default([]), payload: jsonb("payload").notNull().default({}), policyDecisionId: text("policy_decision_id").notNull().references((): AnyPgColumn => eosPolicyDecisions.id, { onDelete: "restrict" }), previousEventSha256: text("previous_event_sha256").notNull().default(""), eventSha256: text("event_sha256").notNull(), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_customer_success_event_hash_idx").on(table.eventSha256), index("eos_customer_success_event_account_idx").on(table.accountId, table.recordedAt), check("eos_customer_success_event_type_check", sql`${table.eventType} IN ('account_created','health_review_recorded','outcome_created','outcome_progress_recorded','issue_opened','issue_resolved','report_prepared','report_approved','report_delivery_recorded','renewal_decided')`), check("eos_customer_success_event_subject_check", sql`${table.subjectType} IN ('account','outcome','issue','report')`), check("eos_customer_success_event_version_check", sql`${table.accountVersionBefore} >= 0 AND ${table.accountVersionAfter} > ${table.accountVersionBefore} AND ${table.subjectVersionBefore} >= 0 AND ${table.subjectVersionAfter} >= ${table.subjectVersionBefore}`), check("eos_customer_success_event_hash_check", sql`${table.eventSha256} ~ '^[0-9a-f]{64}$' AND (${table.previousEventSha256} = '' OR ${table.previousEventSha256} ~ '^[0-9a-f]{64}$')`),
]);

export const eosCustomerHealthReviews = pgTable("eos_customer_health_reviews", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), accountId: text("account_id").notNull().references(() => eosCustomerSuccessAccounts.id, { onDelete: "restrict" }), accountVersion: integer("account_version").notNull(), deliveryScore: integer("delivery_score").notNull(), outcomeScore: integer("outcome_score").notNull(), adoptionScore: integer("adoption_score").notNull(), relationshipScore: integer("relationship_score").notNull(), riskScore: integer("risk_score").notNull(), healthScore: integer("health_score").notNull(), healthState: text("health_state").notNull(), evidenceIds: jsonb("evidence_ids").notNull(), summary: text("summary").notNull(), nextActions: text("next_actions").notNull(), nextReviewAt: text("next_review_at").notNull(), policyDecisionId: text("policy_decision_id").notNull().references((): AnyPgColumn => eosPolicyDecisions.id, { onDelete: "restrict" }), reviewSha256: text("review_sha256").notNull(), reviewedByUserId: text("reviewed_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_customer_health_review_hash_idx").on(table.reviewSha256), index("eos_customer_health_review_account_idx").on(table.accountId, table.reviewedAt), check("eos_customer_health_review_score_check", sql`${table.deliveryScore} BETWEEN 0 AND 100 AND ${table.outcomeScore} BETWEEN 0 AND 100 AND ${table.adoptionScore} BETWEEN 0 AND 100 AND ${table.relationshipScore} BETWEEN 0 AND 100 AND ${table.riskScore} BETWEEN 0 AND 100 AND ${table.healthScore} BETWEEN 0 AND 100`), check("eos_customer_health_review_state_check", sql`${table.healthState} IN ('healthy','watch','at_risk','critical')`), check("eos_customer_health_review_hash_check", sql`${table.reviewSha256} ~ '^[0-9a-f]{64}$'`),
]);

// Module 11 product evolution. The existing eos_offer_programs table remains
// canonical; these records preserve hypotheses, tests, decisions, and rollout
// receipts before an explicitly approved patch may alter that canonical offer.
export const eosProductFeedbackSignals = pgTable("eos_product_feedback_signals", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), offerId: text("offer_id").notNull().references(() => eosOfferPrograms.id, { onDelete: "restrict" }), source: text("source").notNull(), sourceReference: text("source_reference").notNull(), summary: text("summary").notNull(), observedAt: timestamp("observed_at", { withTimezone: true }).notNull(), evidenceIds: jsonb("evidence_ids").notNull(), classification: text("classification").notNull().default("confidential"), signalSha256: text("signal_sha256").notNull(), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_product_feedback_signal_hash_idx").on(table.signalSha256), index("eos_product_feedback_offer_idx").on(table.offerId, table.observedAt), check("eos_product_feedback_source_check", sql`${table.source} IN ('customer','sales','delivery','support','operations','analytics','provider')`), check("eos_product_feedback_hash_check", sql`${table.signalSha256} ~ '^[0-9a-f]{64}$'`), check("eos_product_feedback_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`),
]);

export const eosProductChangeProposals = pgTable("eos_product_change_proposals", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), offerId: text("offer_id").notNull().references(() => eosOfferPrograms.id, { onDelete: "restrict" }), proposalKey: text("proposal_key").notNull(), title: text("title").notNull(), hypothesis: text("hypothesis").notNull(), baselineOfferSnapshot: jsonb("baseline_offer_snapshot").notNull(), baselineOfferSha256: text("baseline_offer_sha256").notNull(), proposedPatch: jsonb("proposed_patch").notNull(), proposalSha256: text("proposal_sha256").notNull(), rollbackPlan: text("rollback_plan").notNull(), successMetric: text("success_metric").notNull(), guardrailMetric: text("guardrail_metric").notNull(), feedbackSignalIds: jsonb("feedback_signal_ids").notNull().default([]), compatibilityOutcome: text("compatibility_outcome").notNull().default("pending"), compatibilityRationale: text("compatibility_rationale").notNull().default(""), compatibilityScope: jsonb("compatibility_scope").notNull().default({}), migrationPlan: text("migration_plan").notNull().default(""), compatibilityEvidenceIds: jsonb("compatibility_evidence_ids").notNull().default([]), releaseDecision: text("release_decision").notNull().default("pending"), releaseRationale: text("release_rationale").notNull().default(""), releaseEvidenceIds: jsonb("release_evidence_ids").notNull().default([]), rolloutState: text("rollout_state").notNull().default("not_started"), rolloutStage: text("rollout_stage"), rolloutPercent: integer("rollout_percent"), rollbackThreshold: text("rollback_threshold").notNull().default(""), rolloutExternalReference: text("rollout_external_reference").notNull().default(""), rolloutReceiptEvidenceId: text("rollout_receipt_evidence_id").references(() => eosEvidence.id, { onDelete: "restrict" }), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), classification: text("classification").notNull().default("confidential"), version: integer("version").notNull().default(1), lastEventId: text("last_event_id"), appliedAt: timestamp("applied_at", { withTimezone: true }), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_product_proposal_key_idx").on(table.companyId, table.proposalKey), uniqueIndex("eos_product_proposal_hash_idx").on(table.proposalSha256), index("eos_product_proposal_offer_idx").on(table.offerId, table.releaseDecision, table.rolloutState), check("eos_product_proposal_hash_check", sql`${table.baselineOfferSha256} ~ '^[0-9a-f]{64}$' AND ${table.proposalSha256} ~ '^[0-9a-f]{64}$'`), check("eos_product_proposal_compatibility_check", sql`${table.compatibilityOutcome} IN ('pending','compatible','breaking','unknown')`), check("eos_product_proposal_release_check", sql`${table.releaseDecision} IN ('pending','ship','iterate','reject')`), check("eos_product_proposal_rollout_check", sql`${table.rolloutState} IN ('not_started','running','completed','rolled_back') AND (${table.rolloutStage} IS NULL OR ${table.rolloutStage} IN ('internal','pilot','limited','general')) AND (${table.rolloutPercent} IS NULL OR ${table.rolloutPercent} BETWEEN 1 AND 100)`), check("eos_product_proposal_version_check", sql`${table.version} > 0`), check("eos_product_proposal_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`),
]);

export const eosProductExperiments = pgTable("eos_product_experiments", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), proposalId: text("proposal_id").notNull().references(() => eosProductChangeProposals.id, { onDelete: "restrict" }), question: text("question").notNull(), cohortScope: text("cohort_scope").notNull(), allocationPercent: integer("allocation_percent").notNull(), startsAt: text("starts_at").notNull(), endsAt: text("ends_at").notNull(), successMetric: text("success_metric").notNull(), guardrailMetric: text("guardrail_metric").notNull(), state: text("state").notNull().default("planned"), result: text("result").notNull().default("pending"), conclusion: text("conclusion").notNull().default(""), conclusionEvidenceIds: jsonb("conclusion_evidence_ids").notNull().default([]), experimentSha256: text("experiment_sha256").notNull(), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), classification: text("classification").notNull().default("confidential"), version: integer("version").notNull().default(1), lastEventId: text("last_event_id"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_product_experiment_proposal_idx").on(table.proposalId), uniqueIndex("eos_product_experiment_hash_idx").on(table.experimentSha256), index("eos_product_experiment_state_idx").on(table.companyId, table.state, table.endsAt), check("eos_product_experiment_state_check", sql`${table.state} IN ('planned','running','concluded','stopped') AND ${table.result} IN ('pending','met','not_met','inconclusive')`), check("eos_product_experiment_allocation_check", sql`${table.allocationPercent} BETWEEN 1 AND 100`), check("eos_product_experiment_hash_check", sql`${table.experimentSha256} ~ '^[0-9a-f]{64}$'`), check("eos_product_experiment_version_check", sql`${table.version} > 0`), check("eos_product_experiment_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`),
]);

export const eosProductExperimentObservations = pgTable("eos_product_experiment_observations", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), proposalId: text("proposal_id").notNull().references(() => eosProductChangeProposals.id, { onDelete: "restrict" }), experimentId: text("experiment_id").notNull().references(() => eosProductExperiments.id, { onDelete: "restrict" }), metricKey: text("metric_key").notNull(), value: text("value").notNull(), unit: text("unit").notNull(), windowStart: text("window_start").notNull(), windowEnd: text("window_end").notNull(), sourceAuthority: text("source_authority").notNull(), externalReference: text("external_reference").notNull().default(""), evidenceIds: jsonb("evidence_ids").notNull(), observationSha256: text("observation_sha256").notNull(), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_product_observation_hash_idx").on(table.observationSha256), index("eos_product_observation_experiment_idx").on(table.experimentId, table.recordedAt), check("eos_product_observation_authority_check", sql`${table.sourceAuthority} IN ('internal_observation','manual_attestation','provider_receipt','reconciled')`), check("eos_product_observation_hash_check", sql`${table.observationSha256} ~ '^[0-9a-f]{64}$'`),
]);

export const eosProductEvolutionEvents = pgTable("eos_product_evolution_events", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), proposalId: text("proposal_id").references(() => eosProductChangeProposals.id, { onDelete: "restrict" }), offerId: text("offer_id").notNull().references(() => eosOfferPrograms.id, { onDelete: "restrict" }), eventType: text("event_type").notNull(), subjectType: text("subject_type").notNull(), subjectId: text("subject_id").notNull(), versionBefore: integer("version_before").notNull(), versionAfter: integer("version_after").notNull(), evidenceIds: jsonb("evidence_ids").notNull().default([]), payload: jsonb("payload").notNull().default({}), policyDecisionId: text("policy_decision_id").notNull().references((): AnyPgColumn => eosPolicyDecisions.id, { onDelete: "restrict" }), previousEventSha256: text("previous_event_sha256").notNull().default(""), eventSha256: text("event_sha256").notNull(), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_product_evolution_event_hash_idx").on(table.eventSha256), index("eos_product_evolution_event_proposal_idx").on(table.proposalId, table.recordedAt), check("eos_product_evolution_event_type_check", sql`${table.eventType} IN ('feedback_recorded','proposal_created','compatibility_reviewed','experiment_created','experiment_started','experiment_stopped','observation_recorded','experiment_concluded','release_decided','rollout_started','rollout_advanced','rollout_completed','rollout_rolled_back','canonical_offer_applied')`), check("eos_product_evolution_subject_check", sql`${table.subjectType} IN ('feedback','proposal','experiment','observation','offer')`), check("eos_product_evolution_event_version_check", sql`${table.versionBefore} >= 0 AND ${table.versionAfter} >= ${table.versionBefore}`), check("eos_product_evolution_event_hash_check", sql`${table.eventSha256} ~ '^[0-9a-f]{64}$' AND (${table.previousEventSha256} = '' OR ${table.previousEventSha256} ~ '^[0-9a-f]{64}$')`),
]);

export const eosRecoveryAgreementInstances = pgTable("eos_recovery_agreement_instances", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  call2PacketId: text("call_2_packet_id").notNull().references(() => eosRecoveryCall2Packets.id, { onDelete: "restrict" }),
  authorityId: text("authority_id").notNull().references(() => eosRecoveryAgreementAuthorities.id, { onDelete: "restrict" }),
  workPacketId: text("work_packet_id").notNull().references(() => eosWorkPackets.id, { onDelete: "restrict" }),
  state: text("state").notNull().default("blocked_counsel"),
  version: integer("version").notNull().default(1),
  clientLegalName: text("client_legal_name").notNull().default(""),
  clientSignerName: text("client_signer_name").notNull().default(""),
  clientSignerEmail: text("client_signer_email").notNull().default(""),
  providerLegalName: text("provider_legal_name").notNull().default(""),
  packageKey: text("package_key").notNull(),
  termsSnapshot: jsonb("terms_snapshot").notNull(),
  agreementVersion: text("agreement_version").notNull().default(""),
  eSignProvider: text("e_sign_provider").notNull().default("eos_native"),
  eSignTemplateReference: text("e_sign_template_reference").notNull().default(""),
  eSignBindingId: text("e_sign_binding_id").references(() => eosIntegrationBindings.id, { onDelete: "restrict" }),
  nativeEnvelopeId: text("native_envelope_id").references(() => eosEsignEnvelopes.id, { onDelete: "restrict" }),
  providerEnvelopeReference: text("provider_envelope_reference").notNull().default(""),
  issuanceExecutionId: text("issuance_execution_id"),
  providerReceiptEvidenceId: text("provider_receipt_evidence_id").references(() => eosEvidence.id, { onDelete: "restrict" }),
  blockers: jsonb("blockers").notNull().default([]),
  externalEffectsExecuted: boolean("external_effects_executed").notNull().default(false),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_recovery_agreement_instance_packet_idx").on(table.call2PacketId),
  index("eos_recovery_agreement_instance_state_idx").on(table.companyId, table.state, table.updatedAt),
  check("eos_recovery_agreement_instance_state_check", sql`${table.state} IN ('blocked_counsel','blocked_esign','blocked_payment','eligible_to_issue','issued','signed','declined','voided','expired')`),
  check("eos_recovery_agreement_instance_provider_check", sql`${table.eSignProvider} IN ('eos_native','docusign')`),
  check("eos_recovery_agreement_instance_version_check", sql`${table.version} > 0`),
]);

export const eosRecoveryBillingManifests = pgTable("eos_recovery_billing_manifests", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  agreementInstanceId: text("agreement_instance_id").notNull().references(() => eosRecoveryAgreementInstances.id, { onDelete: "restrict" }),
  workPacketId: text("work_packet_id").notNull().references(() => eosWorkPackets.id, { onDelete: "restrict" }),
  state: text("state").notNull().default("configuration_required"),
  version: integer("version").notNull().default(1),
  manifestVersion: text("manifest_version").notNull(),
  manifestSource: text("manifest_source").notNull(),
  packageKey: text("package_key").notNull(),
  setupAmountMinor: integer("setup_amount_minor").notNull(),
  recurringAmountMinor: integer("recurring_amount_minor").notNull(),
  currency: text("currency").notNull().default("USD"),
  stripeBindingId: text("stripe_binding_id").references(() => eosIntegrationBindings.id, { onDelete: "restrict" }),
  providerProductReference: text("provider_product_reference").notNull().default(""),
  setupPriceReference: text("setup_price_reference").notNull().default(""),
  recurringPriceReference: text("recurring_price_reference").notNull().default(""),
  taxTreatment: text("tax_treatment").notNull().default(""),
  statementDescriptor: text("statement_descriptor").notNull().default(""),
  paymentMethodPolicy: text("payment_method_policy").notNull().default(""),
  subscriptionStartRule: text("subscription_start_rule").notNull().default(""),
  receiptBehavior: text("receipt_behavior").notNull().default(""),
  cancellationRefundAuthority: text("cancellation_refund_authority").notNull().default(""),
  providerCheckoutReference: text("provider_checkout_reference").notNull().default(""),
  providerCustomerReference: text("provider_customer_reference").notNull().default(""),
  providerSubscriptionReference: text("provider_subscription_reference").notNull().default(""),
  providerPaymentIntentReference: text("provider_payment_intent_reference").notNull().default(""),
  providerLatestInvoiceReference: text("provider_latest_invoice_reference").notNull().default(""),
  checkoutExecutionId: text("checkout_execution_id"),
  lastCompensationExecutionId: text("last_compensation_execution_id"),
  setupPaymentState: text("setup_payment_state").notNull().default("pending"),
  subscriptionState: text("subscription_state").notNull().default("pending"),
  lastProviderEventAt: timestamp("last_provider_event_at", { withTimezone: true }),
  providerReceiptEvidenceId: text("provider_receipt_evidence_id").references(() => eosEvidence.id, { onDelete: "restrict" }),
  blockers: jsonb("blockers").notNull().default([]),
  externalEffectsExecuted: boolean("external_effects_executed").notNull().default(false),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_recovery_billing_manifest_agreement_idx").on(table.agreementInstanceId),
  index("eos_recovery_billing_manifest_state_idx").on(table.companyId, table.state, table.updatedAt),
  check("eos_recovery_billing_manifest_state_check", sql`${table.state} IN ('configuration_required','blocked_agreement','blocked_stripe','checkout_eligible','issued','payment_failed','setup_paid_subscription_pending','active','recovery_required','cancelled','refunded','disputed')`),
  check("eos_recovery_billing_manifest_version_check", sql`${table.version} > 0`),
  check("eos_recovery_billing_manifest_amounts_check", sql`${table.setupAmountMinor} > 0 AND ${table.recurringAmountMinor} > 0`),
  check("eos_recovery_billing_manifest_currency_check", sql`${table.currency} = 'USD'`),
  check("eos_recovery_billing_manifest_setup_payment_check", sql`${table.setupPaymentState} IN ('pending','succeeded','failed','refunded','disputed')`),
  check("eos_recovery_billing_manifest_subscription_check", sql`${table.subscriptionState} IN ('pending','incomplete','trialing','active','past_due','paused','cancelled')`),
]);

export const eosRecoveryProviderReceipts = pgTable("eos_recovery_provider_receipts", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  providerKey: text("provider_key").notNull(),
  integrationBindingId: text("integration_binding_id").notNull().references(() => eosIntegrationBindings.id, { onDelete: "restrict" }),
  providerEventId: text("provider_event_id").notNull(),
  providerObjectReference: text("provider_object_reference").notNull().default(""),
  eventType: text("event_type").notNull(),
  objectType: text("object_type").notNull().default("unmatched"),
  agreementInstanceId: text("agreement_instance_id").references(() => eosRecoveryAgreementInstances.id, { onDelete: "restrict" }),
  billingManifestId: text("billing_manifest_id").references(() => eosRecoveryBillingManifests.id, { onDelete: "restrict" }),
  signatureState: text("signature_state").notNull().default("verified"),
  verifierMethod: text("verifier_method").notNull(),
  payloadSha256: text("payload_sha256").notNull(),
  payloadProjection: jsonb("payload_projection").notNull().default({}),
  processingState: text("processing_state").notNull(),
  failureCode: text("failure_code").notNull().default(""),
  failureSummary: text("failure_summary").notNull().default(""),
  evidenceId: text("evidence_id").references(() => eosEvidence.id, { onDelete: "restrict" }),
  externalEffectsObserved: boolean("external_effects_observed").notNull().default(true),
  schemaVersion: text("schema_version").notNull().default("empyrean-recovery-provider-receipt.v1"),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_recovery_provider_receipt_event_idx").on(table.providerKey, table.integrationBindingId, table.providerEventId),
  index("eos_recovery_provider_receipt_activation_idx").on(table.companyId, table.agreementInstanceId, table.billingManifestId, table.occurredAt),
  check("eos_recovery_provider_receipt_provider_check", sql`${table.providerKey} IN ('docusign','stripe')`),
  check("eos_recovery_provider_receipt_object_check", sql`${table.objectType} IN ('agreement','billing','unmatched')`),
  check("eos_recovery_provider_receipt_signature_check", sql`${table.signatureState} = 'verified'`),
  check("eos_recovery_provider_receipt_processing_check", sql`${table.processingState} IN ('applied','ignored','rejected','recovery_required')`),
  check("eos_recovery_provider_receipt_target_check", sql`(${table.objectType} = 'agreement' AND ${table.agreementInstanceId} IS NOT NULL AND ${table.billingManifestId} IS NULL) OR (${table.objectType} = 'billing' AND ${table.billingManifestId} IS NOT NULL AND ${table.agreementInstanceId} IS NULL) OR (${table.objectType} = 'unmatched' AND ${table.agreementInstanceId} IS NULL AND ${table.billingManifestId} IS NULL)`),
]);

export const eosRecoveryActivationEvents = pgTable("eos_recovery_activation_events", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  activationId: text("activation_id").notNull(),
  objectType: text("object_type").notNull(),
  objectId: text("object_id").notNull(),
  actorUserId: text("actor_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  actorSeatId: text("actor_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  sequence: integer("sequence").notNull(),
  eventType: text("event_type").notNull(),
  fromState: text("from_state").notNull(),
  toState: text("to_state").notNull(),
  details: jsonb("details").notNull().default({}),
  traceId: text("trace_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_recovery_activation_events_sequence_idx").on(table.activationId, table.sequence),
  index("eos_recovery_activation_events_object_idx").on(table.companyId, table.objectType, table.objectId, table.createdAt),
  check("eos_recovery_activation_events_object_type_check", sql`${table.objectType} IN ('authority','agreement','billing')`),
  check("eos_recovery_activation_events_sequence_check", sql`${table.sequence} > 0`),
]);

// Live Recovery operations are intentionally separate from the synthetic
// customer-value rehearsal. They preserve first-party Client Zero and paid
// client execution without weakening TEST-PRELIVE database constraints.
export const eosRecoveryEngagements = pgTable("eos_recovery_engagements", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  mode: text("mode").notNull(),
  title: text("title").notNull(),
  call2PacketId: text("call_2_packet_id").references(() => eosRecoveryCall2Packets.id, { onDelete: "restrict" }),
  stakeholderId: text("stakeholder_id").references(() => eosStakeholders.id, { onDelete: "restrict" }),
  relationshipId: text("relationship_id").references(() => eosStakeholderRelationships.id, { onDelete: "restrict" }),
  customerSuccessAccountId: text("customer_success_account_id").references(() => eosCustomerSuccessAccounts.id, { onDelete: "restrict" }),
  workPacketId: text("work_packet_id").notNull().references(() => eosWorkPackets.id, { onDelete: "restrict" }),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  state: text("state").notNull().default("draft"),
  returnState: text("return_state"),
  objective: text("objective").notNull(),
  eligiblePoolKeys: jsonb("eligible_pool_keys").notNull(),
  sourceBoundary: text("source_boundary").notNull(),
  consentPolicy: text("consent_policy").notNull(),
  clientSideOwner: text("client_side_owner").notNull().default(""),
  guaranteeWindowStart: text("guarantee_window_start"),
  guaranteeWindowEnd: text("guarantee_window_end"),
  nextAction: text("next_action").notNull(),
  nextActionAt: text("next_action_at"),
  healthState: text("health_state").notNull().default("unknown"),
  blockers: jsonb("blockers").notNull().default([]),
  evidenceIds: jsonb("evidence_ids").notNull().default([]),
  externalEffectsExecuted: boolean("external_effects_executed").notNull().default(false),
  sourceAuthority: text("source_authority").notNull().default("native_eos"),
  classification: text("classification").notNull().default("confidential"),
  version: integer("version").notNull().default(1),
  lastEventId: text("last_event_id"),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_recovery_engagement_call2_idx").on(table.call2PacketId).where(sql`${table.call2PacketId} IS NOT NULL`),
  index("eos_recovery_engagement_company_state_idx").on(table.companyId, table.state, table.updatedAt),
  index("eos_recovery_engagement_owner_idx").on(table.ownerSeatId, table.state),
  check("eos_recovery_engagement_mode_check", sql`${table.mode} IN ('client_zero','paid_client')`),
  check("eos_recovery_engagement_state_check", sql`${table.state} IN ('draft','intake','baseline','audit','campaign_approval','bounded_launch','operating','reporting','guarantee_review','renewal_review','paused','recovery_required','closed','cancelled')`),
  check("eos_recovery_engagement_return_state_check", sql`${table.returnState} IS NULL OR ${table.returnState} IN ('intake','baseline','audit','campaign_approval','bounded_launch','operating','reporting','guarantee_review','renewal_review')`),
  check("eos_recovery_engagement_mode_source_check", sql`(${table.mode} = 'client_zero' AND ${table.call2PacketId} IS NULL) OR (${table.mode} = 'paid_client' AND ${table.call2PacketId} IS NOT NULL AND ${table.stakeholderId} IS NOT NULL AND ${table.relationshipId} IS NOT NULL)`),
  check("eos_recovery_engagement_window_check", sql`${table.guaranteeWindowEnd} IS NULL OR ${table.guaranteeWindowStart} IS NULL OR ${table.guaranteeWindowEnd} > ${table.guaranteeWindowStart}`),
  check("eos_recovery_engagement_json_check", sql`jsonb_typeof(${table.eligiblePoolKeys}) = 'array' AND jsonb_array_length(${table.eligiblePoolKeys}) BETWEEN 1 AND 3 AND jsonb_typeof(${table.blockers}) = 'array' AND jsonb_typeof(${table.evidenceIds}) = 'array'`),
  check("eos_recovery_engagement_effect_check", sql`${table.externalEffectsExecuted} = false`),
  check("eos_recovery_engagement_authority_check", sql`${table.sourceAuthority} = 'native_eos'`),
  check("eos_recovery_engagement_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`),
  check("eos_recovery_engagement_version_check", sql`${table.version} > 0`),
]);

export const eosRecoveryDeliveryPools = pgTable("eos_recovery_delivery_pools", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), engagementId: text("engagement_id").notNull().references(() => eosRecoveryEngagements.id, { onDelete: "restrict" }), poolKey: text("pool_key").notNull(), state: text("state").notNull().default("unconfigured"), sourceSystemReference: text("source_system_reference").notNull().default(""), rawCount: integer("raw_count").notNull().default(0), eligibleCount: integer("eligible_count").notNull().default(0), excludedCount: integer("excluded_count").notNull().default(0), activationReadyCount: integer("activation_ready_count").notNull().default(0), exclusionSummary: text("exclusion_summary").notNull().default(""), qualificationNote: text("qualification_note").notNull().default(""), evidenceIds: jsonb("evidence_ids").notNull().default([]), version: integer("version").notNull().default(1), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_recovery_delivery_pool_key_idx").on(table.engagementId, table.poolKey), index("eos_recovery_delivery_pool_state_idx").on(table.companyId, table.state, table.updatedAt), check("eos_recovery_delivery_pool_key_check", sql`${table.poolKey} IN ('missed_calls','open_estimates','past_customers')`), check("eos_recovery_delivery_pool_state_check", sql`${table.state} IN ('unconfigured','collecting','qualified','approved','active','paused','completed','blocked')`), check("eos_recovery_delivery_pool_count_check", sql`${table.rawCount} >= 0 AND ${table.eligibleCount} >= 0 AND ${table.excludedCount} >= 0 AND ${table.activationReadyCount} >= 0 AND ${table.eligibleCount} + ${table.excludedCount} <= ${table.rawCount} AND ${table.activationReadyCount} <= ${table.eligibleCount}`), check("eos_recovery_delivery_pool_evidence_check", sql`jsonb_typeof(${table.evidenceIds}) = 'array'`), check("eos_recovery_delivery_pool_version_check", sql`${table.version} > 0`),
]);

export const eosRecoveryCampaignControls = pgTable("eos_recovery_campaign_controls", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), engagementId: text("engagement_id").notNull().references(() => eosRecoveryEngagements.id, { onDelete: "restrict" }), poolKey: text("pool_key").notNull(), name: text("name").notNull(), channel: text("channel").notNull(), integrationBindingId: text("integration_binding_id").references(() => eosIntegrationBindings.id, { onDelete: "restrict" }), messageVersionReference: text("message_version_reference").notNull(), consentBasis: text("consent_basis").notNull(), quietHours: text("quiet_hours").notNull(), cadence: text("cadence").notNull(), stopConditions: text("stop_conditions").notNull(), optOutHandling: text("opt_out_handling").notNull(), routingOwnerSeatId: text("routing_owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), escalationOwnerSeatId: text("escalation_owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), state: text("state").notNull().default("draft"), approvalEvidenceIds: jsonb("approval_evidence_ids").notNull().default([]), version: integer("version").notNull().default(1), lastEventId: text("last_event_id"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_recovery_campaign_name_idx").on(table.engagementId, table.name), index("eos_recovery_campaign_state_idx").on(table.companyId, table.state, table.updatedAt), check("eos_recovery_campaign_pool_check", sql`${table.poolKey} IN ('missed_calls','open_estimates','past_customers')`), check("eos_recovery_campaign_channel_check", sql`${table.channel} IN ('sms','email','phone','mixed','manual')`), check("eos_recovery_campaign_state_check", sql`${table.state} IN ('draft','awaiting_approval','approved','tested','active','paused','completed','rejected')`), check("eos_recovery_campaign_evidence_check", sql`jsonb_typeof(${table.approvalEvidenceIds}) = 'array'`), check("eos_recovery_campaign_version_check", sql`${table.version} > 0`),
]);

export const eosRecoveryOpportunities = pgTable("eos_recovery_opportunities", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), engagementId: text("engagement_id").notNull().references(() => eosRecoveryEngagements.id, { onDelete: "restrict" }), poolKey: text("pool_key").notNull(), externalReferenceSha256: text("external_reference_sha256").notNull(), title: text("title").notNull(), summary: text("summary").notNull(), state: text("state").notNull().default("identified"), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), estimatedValueMinor: integer("estimated_value_minor").notNull().default(0), actualValueMinor: integer("actual_value_minor").notNull().default(0), attributionModel: text("attribution_model").notNull().default("unattributed"), nextAction: text("next_action").notNull(), nextActionAt: text("next_action_at"), evidenceIds: jsonb("evidence_ids").notNull().default([]), version: integer("version").notNull().default(1), lastEventId: text("last_event_id"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_recovery_opportunity_reference_idx").on(table.companyId, table.engagementId, table.poolKey, table.externalReferenceSha256), index("eos_recovery_opportunity_state_idx").on(table.engagementId, table.state, table.updatedAt), check("eos_recovery_opportunity_pool_check", sql`${table.poolKey} IN ('missed_calls','open_estimates','past_customers')`), check("eos_recovery_opportunity_state_check", sql`${table.state} IN ('identified','contacted','replied','qualified','routed','booked','won','lost','suppressed','disputed')`), check("eos_recovery_opportunity_attribution_check", sql`${table.attributionModel} IN ('direct','assisted','unattributed','disputed')`), check("eos_recovery_opportunity_value_check", sql`${table.estimatedValueMinor} >= 0 AND ${table.actualValueMinor} >= 0`), check("eos_recovery_opportunity_hash_check", sql`${table.externalReferenceSha256} ~ '^[0-9a-f]{64}$'`), check("eos_recovery_opportunity_evidence_check", sql`jsonb_typeof(${table.evidenceIds}) = 'array'`), check("eos_recovery_opportunity_version_check", sql`${table.version} > 0`),
]);

export const eosRecoveryEngagementEvents = pgTable("eos_recovery_engagement_events", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), engagementId: text("engagement_id").notNull().references(() => eosRecoveryEngagements.id, { onDelete: "restrict" }), sequence: integer("sequence").notNull(), eventType: text("event_type").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id").notNull(), fromState: text("from_state").notNull(), toState: text("to_state").notNull(), engagementVersionBefore: integer("engagement_version_before").notNull(), engagementVersionAfter: integer("engagement_version_after").notNull(), evidenceIds: jsonb("evidence_ids").notNull().default([]), payload: jsonb("payload").notNull().default({}), policyDecisionId: text("policy_decision_id").notNull().references((): AnyPgColumn => eosPolicyDecisions.id, { onDelete: "restrict" }), previousEventSha256: text("previous_event_sha256").notNull().default(""), eventSha256: text("event_sha256").notNull(), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_recovery_engagement_event_sequence_idx").on(table.engagementId, table.sequence), uniqueIndex("eos_recovery_engagement_event_hash_idx").on(table.eventSha256), index("eos_recovery_engagement_event_company_idx").on(table.companyId, table.recordedAt), check("eos_recovery_engagement_event_sequence_check", sql`${table.sequence} > 0`), check("eos_recovery_engagement_event_entity_check", sql`${table.entityType} IN ('engagement','pool','campaign','opportunity','evidence','customer_success')`), check("eos_recovery_engagement_event_version_check", sql`${table.engagementVersionBefore} >= 0 AND ${table.engagementVersionAfter} >= ${table.engagementVersionBefore}`), check("eos_recovery_engagement_event_json_check", sql`jsonb_typeof(${table.evidenceIds}) = 'array' AND jsonb_typeof(${table.payload}) = 'object'`), check("eos_recovery_engagement_event_hash_check", sql`${table.eventSha256} ~ '^[0-9a-f]{64}$' AND (${table.previousEventSha256} = '' OR ${table.previousEventSha256} ~ '^[0-9a-f]{64}$')`),
]);

export const eosIntegrationBindingRevisions = pgTable("eos_integration_binding_revisions", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  integrationBindingId: text("integration_binding_id").notNull().references(() => eosIntegrationBindings.id, { onDelete: "cascade" }),
  configurationVersion: integer("configuration_version").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  changeSummary: text("change_summary").notNull(),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  recordedBySeatId: text("recorded_by_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  traceId: text("trace_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_integration_binding_revisions_version_idx").on(table.integrationBindingId, table.configurationVersion),
  index("eos_integration_binding_revisions_company_created_idx").on(table.companyId, table.createdAt),
  check("eos_integration_binding_revisions_version_check", sql`${table.configurationVersion} > 0`),
]);

export const eosToolEntitlements = pgTable("eos_tool_entitlements", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }), entitlementKey: text("entitlement_key").notNull(), systemId: text("system_id").notNull().references(() => eosSystems.id, { onDelete: "restrict" }), integrationBindingId: text("integration_binding_id").references(() => eosIntegrationBindings.id, { onDelete: "set null" }), granteeSeatId: text("grantee_seat_id").references(() => eosSeats.id, { onDelete: "restrict" }), granteeSubjectId: text("grantee_subject_id").references(() => eosAuthoritySubjects.id, { onDelete: "restrict" }), providerResourceReference: text("provider_resource_reference").notNull(), nativePermissions: jsonb("native_permissions").notNull().default([]), authorityGrantId: text("authority_grant_id").references(() => eosAuthorityGrants.id, { onDelete: "set null" }), credentialReference: text("credential_reference"), masteryState: text("mastery_state").notNull().default("unverified"), state: text("state").notNull().default("proposed"), revocationOwnerSeatId: text("revocation_owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), evidenceIds: jsonb("evidence_ids").notNull().default([]), effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(), effectiveUntil: timestamp("effective_until", { withTimezone: true }), lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }), sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("restricted"), schemaVersion: text("schema_version").notNull().default("tool-entitlement-v1.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_tool_entitlements_company_key_idx").on(table.companyId, table.entitlementKey), index("eos_tool_entitlements_grantee_state_idx").on(table.granteeSeatId, table.granteeSubjectId, table.state), check("eos_tool_entitlements_grantee_check", sql`(${table.granteeSeatId} IS NOT NULL)::int + (${table.granteeSubjectId} IS NOT NULL)::int = 1`), check("eos_tool_entitlements_mastery_check", sql`${table.masteryState} IN ('unverified','training','qualified','expired')`), check("eos_tool_entitlements_state_check", sql`${table.state} IN ('proposed','pending','active','suspended','revoked','expired')`), check("eos_tool_entitlements_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`), check("eos_tool_entitlements_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`), check("eos_tool_entitlements_effective_check", sql`${table.effectiveUntil} IS NULL OR ${table.effectiveUntil} > ${table.effectiveFrom}`),
]);

export const eosAutomations = pgTable("eos_automations", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }), automationKey: text("automation_key").notNull(), name: text("name").notNull(), integrationBindingId: text("integration_binding_id").notNull().references(() => eosIntegrationBindings.id, { onDelete: "restrict" }), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), triggerContract: text("trigger_contract").notNull(), actionContract: text("action_contract").notNull(), lifecycleState: text("lifecycle_state").notNull().default("proposed"), consequence: text("consequence").notNull().default("routine"), failureBehavior: text("failure_behavior").notNull(), manualFallback: text("manual_fallback").notNull(), workPacketId: text("work_packet_id").references(() => eosWorkPackets.id, { onDelete: "set null" }), evidenceIds: jsonb("evidence_ids").notNull().default([]), lastRunState: text("last_run_state").notNull().default("never"), lastRunAt: timestamp("last_run_at", { withTimezone: true }), nextRunAt: timestamp("next_run_at", { withTimezone: true }), sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("restricted"), schemaVersion: text("schema_version").notNull().default("automation-v1.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_automations_company_key_idx").on(table.companyId, table.automationKey), index("eos_automations_owner_state_idx").on(table.ownerSeatId, table.lifecycleState), check("eos_automations_state_check", sql`${table.lifecycleState} IN ('proposed','design','review','enabled','paused','degraded','disabled','retired')`), check("eos_automations_consequence_check", sql`${table.consequence} IN ('routine','material','high_consequence')`), check("eos_automations_run_state_check", sql`${table.lastRunState} IN ('never','queued','running','succeeded','failed','partial','cancelled')`), check("eos_automations_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`), check("eos_automations_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`),
]);

export const eosIntegrationHealthObservations = pgTable("eos_integration_health_observations", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), integrationBindingId: text("integration_binding_id").notNull().references(() => eosIntegrationBindings.id, { onDelete: "cascade" }), observedByUserId: text("observed_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), healthState: text("health_state").notNull(), checkType: text("check_type").notNull(), summary: text("summary").notNull(), externalReference: text("external_reference"), evidenceIds: jsonb("evidence_ids").notNull().default([]), traceId: text("trace_id").notNull(), correlationId: text("correlation_id").notNull(), observedAt: timestamp("observed_at", { withTimezone: true }).notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("eos_integration_health_binding_time_idx").on(table.integrationBindingId, table.observedAt), check("eos_integration_health_state_check", sql`${table.healthState} IN ('healthy','degraded','unavailable','unknown')`), check("eos_integration_health_type_check", sql`${table.checkType} IN ('live_provider','monitoring','manual_test','fixture','recovery_test','parity_test')`), check("eos_integration_health_expiry_check", sql`${table.expiresAt} IS NULL OR ${table.expiresAt} > ${table.observedAt}`),
]);

// Module 12 adapter operations plane. Binding configuration remains canonical
// in eos_integration_bindings; this plane records what was qualified, requested,
// observed, recovered, and cut over without ever storing provider credentials.
export const eosAdapterCapabilityManifests = pgTable("eos_adapter_capability_manifests", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), integrationBindingId: text("integration_binding_id").notNull().references(() => eosIntegrationBindings.id, { onDelete: "restrict" }), bindingConfigurationVersion: integer("binding_configuration_version").notNull(), contractVersion: text("contract_version").notNull(), operations: jsonb("operations").notNull(), expectedEvents: jsonb("expected_events").notNull(), inputSchemaSha256: text("input_schema_sha256").notNull(), outputSchemaSha256: text("output_schema_sha256").notNull(), eventSchemaSha256: text("event_schema_sha256").notNull(), manifestSha256: text("manifest_sha256").notNull(), evidenceIds: jsonb("evidence_ids").notNull(), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_adapter_manifest_binding_version_idx").on(table.integrationBindingId, table.bindingConfigurationVersion, table.contractVersion), uniqueIndex("eos_adapter_manifest_hash_idx").on(table.manifestSha256), index("eos_adapter_manifest_company_idx").on(table.companyId, table.recordedAt), check("eos_adapter_manifest_version_check", sql`${table.bindingConfigurationVersion} > 0`), check("eos_adapter_manifest_hash_check", sql`${table.inputSchemaSha256} ~ '^[0-9a-f]{64}$' AND ${table.outputSchemaSha256} ~ '^[0-9a-f]{64}$' AND ${table.eventSchemaSha256} ~ '^[0-9a-f]{64}$' AND ${table.manifestSha256} ~ '^[0-9a-f]{64}$'`),
]);

export const eosIntegrationOperationalStates = pgTable("eos_integration_operational_states", {
  integrationBindingId: text("integration_binding_id").primaryKey().references(() => eosIntegrationBindings.id, { onDelete: "cascade" }), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), trafficMode: text("traffic_mode").notNull().default("provider"), consecutiveFailures: integer("consecutive_failures").notNull().default(0), lastRunAt: timestamp("last_run_at", { withTimezone: true }), lastSuccessAt: timestamp("last_success_at", { withTimezone: true }), activeIncidentId: text("active_incident_id").references((): AnyPgColumn => eosIntegrationIncidents.id, { onDelete: "restrict" }), currentQualificationId: text("current_qualification_id").references((): AnyPgColumn => eosIntegrationQualifications.id, { onDelete: "restrict" }), version: integer("version").notNull().default(1), lastEventId: text("last_event_id").references((): AnyPgColumn => eosIntegrationOperationEvents.id, { onDelete: "restrict" }), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("eos_integration_operational_company_idx").on(table.companyId, table.trafficMode, table.updatedAt), check("eos_integration_operational_mode_check", sql`${table.trafficMode} IN ('provider','native','manual_fallback','paused')`), check("eos_integration_operational_version_check", sql`${table.version} > 0 AND ${table.consecutiveFailures} >= 0`),
]);

export const eosIntegrationRuns = pgTable("eos_integration_runs", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), integrationBindingId: text("integration_binding_id").notNull().references(() => eosIntegrationBindings.id, { onDelete: "restrict" }), automationId: text("automation_id").references(() => eosAutomations.id, { onDelete: "set null" }), manifestId: text("manifest_id").notNull().references(() => eosAdapterCapabilityManifests.id, { onDelete: "restrict" }), operation: text("operation").notNull(), idempotencyKey: text("idempotency_key").notNull(), requestReference: text("request_reference").notNull(), requestShape: jsonb("request_shape").notNull().default({}), requestSha256: text("request_sha256").notNull(), state: text("state").notNull().default("planned"), attemptCount: integer("attempt_count").notNull().default(0), maxAttempts: integer("max_attempts").notNull().default(3), providerExecutionId: text("provider_execution_id").references((): AnyPgColumn => eosProviderExecutions.id, { onDelete: "restrict" }), latestReceiptId: text("latest_receipt_id").references((): AnyPgColumn => eosIntegrationRunReceipts.id, { onDelete: "restrict" }), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), classification: text("classification").notNull().default("restricted"), version: integer("version").notNull().default(1), lastEventId: text("last_event_id").references((): AnyPgColumn => eosIntegrationOperationEvents.id, { onDelete: "restrict" }), createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_integration_run_idempotency_idx").on(table.integrationBindingId, table.idempotencyKey), uniqueIndex("eos_integration_run_request_hash_idx").on(table.integrationBindingId, table.requestSha256), index("eos_integration_run_state_idx").on(table.companyId, table.state, table.updatedAt), check("eos_integration_run_state_check", sql`${table.state} IN ('planned','dispatching','retry_ready','succeeded','failed','uncertain','dead_letter')`), check("eos_integration_run_attempt_check", sql`${table.attemptCount} >= 0 AND ${table.maxAttempts} BETWEEN 1 AND 20 AND ${table.attemptCount} <= ${table.maxAttempts}`), check("eos_integration_run_hash_check", sql`${table.requestSha256} ~ '^[0-9a-f]{64}$'`), check("eos_integration_run_version_check", sql`${table.version} > 0`), check("eos_integration_run_classification_check", sql`${table.classification} IN ('public','internal','confidential','restricted')`),
]);

export const eosIntegrationRunReceipts = pgTable("eos_integration_run_receipts", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), runId: text("run_id").notNull().references(() => eosIntegrationRuns.id, { onDelete: "restrict" }), attemptNumber: integer("attempt_number").notNull(), outcome: text("outcome").notNull(), authority: text("authority").notNull(), externalReference: text("external_reference").notNull(), summary: text("summary").notNull(), responseShape: jsonb("response_shape").notNull().default({}), responseSha256: text("response_sha256").notNull(), latencyMs: integer("latency_ms"), evidenceIds: jsonb("evidence_ids").notNull(), previousReceiptSha256: text("previous_receipt_sha256").notNull().default(""), receiptSha256: text("receipt_sha256").notNull(), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_integration_receipt_attempt_idx").on(table.runId, table.attemptNumber), uniqueIndex("eos_integration_receipt_hash_idx").on(table.receiptSha256), index("eos_integration_receipt_company_idx").on(table.companyId, table.recordedAt), check("eos_integration_receipt_outcome_check", sql`${table.outcome} IN ('succeeded','failed','uncertain')`), check("eos_integration_receipt_authority_check", sql`${table.authority} IN ('provider_receipt','provider_observation','reconciled','manual_attestation','fixture')`), check("eos_integration_receipt_hash_check", sql`${table.responseSha256} ~ '^[0-9a-f]{64}$' AND ${table.receiptSha256} ~ '^[0-9a-f]{64}$' AND (${table.previousReceiptSha256} = '' OR ${table.previousReceiptSha256} ~ '^[0-9a-f]{64}$')`), check("eos_integration_receipt_latency_check", sql`${table.latencyMs} IS NULL OR ${table.latencyMs} >= 0`),
]);

export const eosIntegrationWebhookEndpoints = pgTable("eos_integration_webhook_endpoints", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), integrationBindingId: text("integration_binding_id").notNull().references(() => eosIntegrationBindings.id, { onDelete: "restrict" }), controlWorkPacketId: text("control_work_packet_id").notNull().references(() => eosWorkPackets.id, { onDelete: "restrict" }), acceptedEventTypes: jsonb("accepted_event_types").notNull(), state: text("state").notNull().default("active"), secretCiphertext: text("secret_ciphertext").notNull(), previousSecretCiphertext: text("previous_secret_ciphertext"), previousSecretExpiresAt: timestamp("previous_secret_expires_at", { withTimezone: true }), secretFingerprint: text("secret_fingerprint").notNull(), version: integer("version").notNull().default(1), lastEventId: text("last_event_id").references((): AnyPgColumn => eosIntegrationOperationEvents.id, { onDelete: "restrict" }), lastInboundEventAt: timestamp("last_inbound_event_at", { withTimezone: true }), createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), rotatedByUserId: text("rotated_by_user_id").references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_integration_webhook_binding_idx").on(table.integrationBindingId), index("eos_integration_webhook_company_state_idx").on(table.companyId, table.state), check("eos_integration_webhook_state_check", sql`${table.state} IN ('active','revoked')`), check("eos_integration_webhook_fingerprint_check", sql`${table.secretFingerprint} ~ '^[0-9a-f]{64}$'`), check("eos_integration_webhook_version_check", sql`${table.version} > 0`), check("eos_integration_webhook_secret_cipher_check", sql`${table.secretCiphertext} LIKE 'enc:v1:%'`), check("eos_integration_webhook_previous_secret_check", sql`(${table.previousSecretCiphertext} IS NULL AND ${table.previousSecretExpiresAt} IS NULL) OR (${table.previousSecretCiphertext} LIKE 'enc:v1:%' AND ${table.previousSecretExpiresAt} IS NOT NULL)`), check("eos_integration_webhook_event_types_check", sql`jsonb_typeof(${table.acceptedEventTypes}) = 'array' AND jsonb_array_length(${table.acceptedEventTypes}) > 0`),
]);

export const eosIntegrationWebhookEvents = pgTable("eos_integration_webhook_events", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), endpointId: text("endpoint_id").notNull().references(() => eosIntegrationWebhookEndpoints.id, { onDelete: "restrict" }), integrationBindingId: text("integration_binding_id").notNull().references(() => eosIntegrationBindings.id, { onDelete: "restrict" }), providerEventId: text("provider_event_id").notNull(), eventType: text("event_type").notNull(), operation: text("operation"), outcome: text("outcome").notNull(), externalReference: text("external_reference").notNull(), summary: text("summary").notNull(), payloadProjection: jsonb("payload_projection").notNull().default({}), payloadSha256: text("payload_sha256").notNull(), signatureVersion: text("signature_version").notNull(), verificationKeyVersion: text("verification_key_version").notNull(), processingState: text("processing_state").notNull().default("unmatched"), matchedRunId: text("matched_run_id").references(() => eosIntegrationRuns.id, { onDelete: "restrict" }), receiptId: text("receipt_id").references(() => eosIntegrationRunReceipts.id, { onDelete: "restrict" }), eventSha256: text("event_sha256").notNull(), occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(), receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_integration_webhook_provider_event_idx").on(table.endpointId, table.providerEventId), uniqueIndex("eos_integration_webhook_event_hash_idx").on(table.eventSha256), index("eos_integration_webhook_event_binding_state_idx").on(table.integrationBindingId, table.processingState, table.receivedAt), check("eos_integration_webhook_event_outcome_check", sql`${table.outcome} IN ('succeeded','failed','uncertain','informational')`), check("eos_integration_webhook_event_processing_check", sql`${table.processingState} IN ('unmatched','reconciled')`), check("eos_integration_webhook_event_key_version_check", sql`${table.verificationKeyVersion} IN ('current','previous')`), check("eos_integration_webhook_event_hash_check", sql`${table.payloadSha256} ~ '^[0-9a-f]{64}$' AND ${table.eventSha256} ~ '^[0-9a-f]{64}$'`), check("eos_integration_webhook_signature_version_check", sql`${table.signatureVersion} = 'v1'`), check("eos_integration_webhook_payload_projection_check", sql`jsonb_typeof(${table.payloadProjection}) = 'object'`),
]);

// Provider-native ingress is intentionally separate from the EOS adapter envelope:
// Notion signs native events with its verification token, while Gmail emits an
// authenticated Pub/Sub mailbox-change signal that still requires reconciliation.
export const eosProviderIngressRegistrations = pgTable("eos_provider_ingress_registrations", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), integrationBindingId: text("integration_binding_id").notNull().references(() => eosIntegrationBindings.id, { onDelete: "restrict" }), controlWorkPacketId: text("control_work_packet_id").notNull().references(() => eosWorkPackets.id, { onDelete: "restrict" }), provider: text("provider").notNull(), authenticationMode: text("authentication_mode").notNull(), state: text("state").notNull().default("pending_verification"), authorizationUserId: text("authorization_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), providerAccountReference: text("provider_account_reference").notNull(), providerSubscriptionReference: text("provider_subscription_reference").notNull().default(""), resourceCollectionReference: text("resource_collection_reference").notNull().default(""), providerResourceReference: text("provider_resource_reference").notNull().default(""), reconciliationCursor: text("reconciliation_cursor").notNull().default(""), topicName: text("topic_name").notNull().default(""), audience: text("audience").notNull().default(""), serviceAccountEmail: text("service_account_email").notNull().default(""), verificationTokenCiphertext: text("verification_token_ciphertext"), verificationTokenFingerprint: text("verification_token_fingerprint"), watchHistoryId: text("watch_history_id").notNull().default(""), watchExpiresAt: timestamp("watch_expires_at", { withTimezone: true }), version: integer("version").notNull().default(1), lastEventId: text("last_event_id").references((): AnyPgColumn => eosIntegrationOperationEvents.id, { onDelete: "restrict" }), lastInboundEventAt: timestamp("last_inbound_event_at", { withTimezone: true }), createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), updatedByUserId: text("updated_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_provider_ingress_binding_provider_idx").on(table.integrationBindingId, table.provider), index("eos_provider_ingress_company_state_idx").on(table.companyId, table.state, table.updatedAt), index("eos_provider_ingress_watch_expiry_idx").on(table.provider, table.state, table.watchExpiresAt), check("eos_provider_ingress_provider_check", sql`${table.provider} IN ('notion','gmail','google_drive','google_calendar')`), check("eos_provider_ingress_auth_check", sql`(${table.provider} = 'notion' AND ${table.authenticationMode} = 'notion_hmac_sha256') OR (${table.provider} = 'gmail' AND ${table.authenticationMode} = 'google_pubsub_oidc') OR (${table.provider} IN ('google_drive','google_calendar') AND ${table.authenticationMode} = 'google_channel_token')`), check("eos_provider_ingress_provider_config_check", sql`(${table.provider} = 'notion' AND ${table.topicName} = '' AND ${table.audience} = '' AND ${table.serviceAccountEmail} = '' AND ${table.resourceCollectionReference} = '') OR (${table.provider} = 'gmail' AND length(${table.topicName}) >= 10 AND length(${table.audience}) >= 8 AND ${table.serviceAccountEmail} LIKE '%@%.%' AND ${table.resourceCollectionReference} = '') OR (${table.provider} = 'google_drive' AND ${table.resourceCollectionReference} = 'changes' AND ${table.topicName} = '' AND ${table.audience} = '' AND ${table.serviceAccountEmail} = '') OR (${table.provider} = 'google_calendar' AND ${table.resourceCollectionReference} <> '' AND ${table.topicName} = '' AND ${table.audience} = '' AND ${table.serviceAccountEmail} = '')`), check("eos_provider_ingress_state_check", sql`${table.state} IN ('pending_verification','active','expired','failed','revoked')`), check("eos_provider_ingress_version_check", sql`${table.version} > 0`), check("eos_provider_ingress_token_check", sql`(${table.verificationTokenCiphertext} IS NULL AND ${table.verificationTokenFingerprint} IS NULL) OR (${table.verificationTokenCiphertext} LIKE 'enc:v1:%' AND ${table.verificationTokenFingerprint} ~ '^[0-9a-f]{64}$')`),
]);

export const eosProviderIngressPolicies = pgTable("eos_provider_ingress_policies", {
  registrationId: text("registration_id").primaryKey().references(() => eosProviderIngressRegistrations.id, { onDelete: "restrict" }), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), watchRenewBeforeMinutes: integer("watch_renew_before_minutes").notNull().default(1440), reconciliationOverdueMinutes: integer("reconciliation_overdue_minutes").notNull().default(15), pendingVerificationMinutes: integer("pending_verification_minutes").notNull().default(60), externalEscalationEnabled: boolean("external_escalation_enabled").notNull().default(false), minimumEscalationSeverity: text("minimum_escalation_severity").notNull().default("material"), maxDeliveryAttempts: integer("max_delivery_attempts").notNull().default(5), version: integer("version").notNull().default(1), evidenceIds: jsonb("evidence_ids").notNull().default([]), rationale: text("rationale").notNull(), lastEventId: text("last_event_id").references((): AnyPgColumn => eosIntegrationOperationEvents.id, { onDelete: "restrict" }), updatedByUserId: text("updated_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("eos_provider_ingress_policy_company_idx").on(table.companyId), check("eos_provider_ingress_policy_thresholds_check", sql`${table.watchRenewBeforeMinutes} BETWEEN 5 AND 8640 AND ${table.reconciliationOverdueMinutes} BETWEEN 5 AND 1440 AND ${table.pendingVerificationMinutes} BETWEEN 5 AND 10080`), check("eos_provider_ingress_policy_severity_check", sql`${table.minimumEscalationSeverity} IN ('warning','material','critical')`), check("eos_provider_ingress_policy_attempts_check", sql`${table.maxDeliveryAttempts} BETWEEN 1 AND 10`), check("eos_provider_ingress_policy_version_check", sql`${table.version} > 0`), check("eos_provider_ingress_policy_evidence_check", sql`jsonb_typeof(${table.evidenceIds}) = 'array'`),
]);

export const eosProviderIngressEvents = pgTable("eos_provider_ingress_events", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), registrationId: text("registration_id").notNull().references(() => eosProviderIngressRegistrations.id, { onDelete: "restrict" }), integrationBindingId: text("integration_binding_id").notNull().references(() => eosIntegrationBindings.id, { onDelete: "restrict" }), provider: text("provider").notNull(), providerEventId: text("provider_event_id").notNull(), eventType: text("event_type").notNull(), providerObjectReference: text("provider_object_reference").notNull(), verificationMethod: text("verification_method").notNull(), processingState: text("processing_state").notNull(), payloadProjection: jsonb("payload_projection").notNull().default({}), payloadSha256: text("payload_sha256").notNull(), eventSha256: text("event_sha256").notNull(), occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(), receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_provider_ingress_event_dedupe_idx").on(table.registrationId, table.providerEventId), uniqueIndex("eos_provider_ingress_event_hash_idx").on(table.eventSha256), index("eos_provider_ingress_event_binding_state_idx").on(table.integrationBindingId, table.processingState, table.receivedAt), check("eos_provider_ingress_event_provider_check", sql`${table.provider} IN ('notion','gmail','google_drive','google_calendar')`), check("eos_provider_ingress_event_verification_check", sql`${table.verificationMethod} IN ('notion_hmac_sha256','google_pubsub_oidc','google_channel_token')`), check("eos_provider_ingress_event_state_check", sql`${table.processingState} IN ('observed','reconciliation_required')`), check("eos_provider_ingress_event_hash_check", sql`${table.payloadSha256} ~ '^[0-9a-f]{64}$' AND ${table.eventSha256} ~ '^[0-9a-f]{64}$'`), check("eos_provider_ingress_event_projection_check", sql`jsonb_typeof(${table.payloadProjection}) = 'object'`),
]);

export const eosProviderIngressReconciliationAttempts = pgTable("eos_provider_ingress_reconciliation_attempts", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), registrationId: text("registration_id").notNull().references(() => eosProviderIngressRegistrations.id, { onDelete: "restrict" }), eventId: text("event_id").notNull().references(() => eosProviderIngressEvents.id, { onDelete: "restrict" }), attemptNumber: integer("attempt_number").notNull(), trigger: text("trigger").notNull(), outcome: text("outcome").notNull(), externalReference: text("external_reference").notNull().default(""), summary: text("summary").notNull(), resultProjection: jsonb("result_projection").notNull().default({}), resultSha256: text("result_sha256").notNull(), failureCode: text("failure_code").notNull().default(""), evidenceIds: jsonb("evidence_ids").notNull().default([]), nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_provider_ingress_reconcile_attempt_idx").on(table.eventId, table.attemptNumber), index("eos_provider_ingress_reconcile_queue_idx").on(table.outcome, table.nextAttemptAt), index("eos_provider_ingress_reconcile_registration_idx").on(table.registrationId, table.recordedAt), check("eos_provider_ingress_reconcile_attempt_check", sql`${table.attemptNumber} > 0`), check("eos_provider_ingress_reconcile_trigger_check", sql`${table.trigger} IN ('worker','operator_replay')`), check("eos_provider_ingress_reconcile_outcome_check", sql`${table.outcome} IN ('succeeded','retry_scheduled','dead_letter')`), check("eos_provider_ingress_reconcile_hash_check", sql`${table.resultSha256} ~ '^[0-9a-f]{64}$'`), check("eos_provider_ingress_reconcile_projection_check", sql`jsonb_typeof(${table.resultProjection}) = 'object'`), check("eos_provider_ingress_reconcile_retry_check", sql`(${table.outcome} = 'retry_scheduled' AND ${table.nextAttemptAt} IS NOT NULL AND ${table.failureCode} <> '') OR (${table.outcome} <> 'retry_scheduled' AND ${table.nextAttemptAt} IS NULL)`),
]);

export const eosProviderResourceSnapshots = pgTable("eos_provider_resource_snapshots", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), registrationId: text("registration_id").notNull().references(() => eosProviderIngressRegistrations.id, { onDelete: "restrict" }), eventId: text("event_id").notNull().references(() => eosProviderIngressEvents.id, { onDelete: "restrict" }), provider: text("provider").notNull(), resourceType: text("resource_type").notNull(), resourceId: text("resource_id").notNull(), resourceState: text("resource_state").notNull().default("active"), providerRevision: text("provider_revision").notNull(), title: text("title").notNull(), providerUrl: text("provider_url").notNull(), metadataProjection: jsonb("metadata_projection").notNull().default({}), boundedContentSha256: text("bounded_content_sha256").notNull(), truncated: boolean("truncated").notNull().default(false), previousSnapshotSha256: text("previous_snapshot_sha256").notNull().default(""), snapshotSha256: text("snapshot_sha256").notNull(), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_provider_resource_snapshot_event_idx").on(table.eventId, table.resourceType, table.resourceId), uniqueIndex("eos_provider_resource_snapshot_hash_idx").on(table.snapshotSha256), index("eos_provider_resource_snapshot_resource_idx").on(table.registrationId, table.resourceId, table.recordedAt), check("eos_provider_resource_snapshot_provider_check", sql`(${table.provider} = 'notion' AND ${table.resourceType} = 'page') OR (${table.provider} = 'google_drive' AND ${table.resourceType} = 'file') OR (${table.provider} = 'google_calendar' AND ${table.resourceType} = 'event')`), check("eos_provider_resource_snapshot_state_check", sql`${table.resourceState} IN ('active','deleted')`), check("eos_provider_resource_snapshot_hash_check", sql`${table.boundedContentSha256} ~ '^[0-9a-f]{64}$' AND ${table.snapshotSha256} ~ '^[0-9a-f]{64}$' AND (${table.previousSnapshotSha256} = '' OR ${table.previousSnapshotSha256} ~ '^[0-9a-f]{64}$')`), check("eos_provider_resource_snapshot_url_check", sql`${table.providerUrl} = '' OR ${table.providerUrl} ~ '^https://'`), check("eos_provider_resource_snapshot_projection_check", sql`jsonb_typeof(${table.metadataProjection}) = 'object'`),
]);

export const eosProviderIngressWatchAttempts = pgTable("eos_provider_ingress_watch_attempts", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), registrationId: text("registration_id").notNull().references(() => eosProviderIngressRegistrations.id, { onDelete: "restrict" }), attemptNumber: integer("attempt_number").notNull(), trigger: text("trigger").notNull(), outcome: text("outcome").notNull(), historyId: text("history_id").notNull().default(""), expiresAt: timestamp("expires_at", { withTimezone: true }), summary: text("summary").notNull(), failureCode: text("failure_code").notNull().default(""), nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }), receiptSha256: text("receipt_sha256").notNull(), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_provider_ingress_watch_attempt_idx").on(table.registrationId, table.attemptNumber), index("eos_provider_ingress_watch_queue_idx").on(table.outcome, table.nextAttemptAt), check("eos_provider_ingress_watch_attempt_check", sql`${table.attemptNumber} > 0`), check("eos_provider_ingress_watch_trigger_check", sql`${table.trigger} IN ('manual','worker')`), check("eos_provider_ingress_watch_outcome_check", sql`${table.outcome} IN ('succeeded','retry_scheduled','dead_letter')`), check("eos_provider_ingress_watch_hash_check", sql`${table.receiptSha256} ~ '^[0-9a-f]{64}$'`), check("eos_provider_ingress_watch_retry_check", sql`(${table.outcome} = 'retry_scheduled' AND ${table.nextAttemptAt} IS NOT NULL AND ${table.failureCode} <> '') OR (${table.outcome} <> 'retry_scheduled' AND ${table.nextAttemptAt} IS NULL)`), check("eos_provider_ingress_watch_success_check", sql`${table.outcome} <> 'succeeded' OR (${table.historyId} <> '' AND ${table.expiresAt} IS NOT NULL)`),
]);

export const eosProviderIngressAlertDeliveryAttempts = pgTable("eos_provider_ingress_alert_delivery_attempts", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), registrationId: text("registration_id").notNull().references(() => eosProviderIngressRegistrations.id, { onDelete: "restrict" }), alertKey: text("alert_key").notNull(), alertId: text("alert_id").notNull(), alertKind: text("alert_kind").notNull(), severity: text("severity").notNull(), attemptNumber: integer("attempt_number").notNull(), trigger: text("trigger").notNull(), outcome: text("outcome").notNull(), deliveryResult: text("delivery_result").notNull(), failureCode: text("failure_code").notNull().default(""), payloadProjection: jsonb("payload_projection").notNull().default({}), payloadSha256: text("payload_sha256").notNull(), nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_provider_ingress_alert_attempt_idx").on(table.alertKey, table.attemptNumber), index("eos_provider_ingress_alert_registration_idx").on(table.registrationId, table.recordedAt), index("eos_provider_ingress_alert_queue_idx").on(table.outcome, table.nextAttemptAt), check("eos_provider_ingress_alert_key_check", sql`${table.alertKey} ~ '^[0-9a-f]{64}$' AND ${table.payloadSha256} ~ '^[0-9a-f]{64}$'`), check("eos_provider_ingress_alert_attempt_number_check", sql`${table.attemptNumber} > 0`), check("eos_provider_ingress_alert_severity_check", sql`${table.severity} IN ('warning','material','critical')`), check("eos_provider_ingress_alert_trigger_check", sql`${table.trigger} IN ('worker','operator_replay')`), check("eos_provider_ingress_alert_outcome_check", sql`${table.outcome} IN ('delivered','retry_scheduled','dead_letter')`), check("eos_provider_ingress_alert_result_check", sql`${table.deliveryResult} IN ('sent','suppressed','unconfigured','failed')`), check("eos_provider_ingress_alert_retry_check", sql`(${table.outcome} = 'retry_scheduled' AND ${table.nextAttemptAt} IS NOT NULL AND ${table.failureCode} <> '') OR (${table.outcome} <> 'retry_scheduled' AND ${table.nextAttemptAt} IS NULL)`), check("eos_provider_ingress_alert_projection_check", sql`jsonb_typeof(${table.payloadProjection}) = 'object'`),
]);

// Human acknowledgement is custody, not recovery. This append-only receipt
// proves who accepted responsibility for an exact current alert without
// suppressing the alert or claiming that its provider condition was repaired.
export const eosProviderIngressAlertAcknowledgements = pgTable("eos_provider_ingress_alert_acknowledgements", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), registrationId: text("registration_id").notNull().references(() => eosProviderIngressRegistrations.id, { onDelete: "restrict" }), alertKey: text("alert_key").notNull(), alertId: text("alert_id").notNull(), alertKind: text("alert_kind").notNull(), severity: text("severity").notNull(), summary: text("summary").notNull(), observedAt: timestamp("observed_at", { withTimezone: true }).notNull(), acknowledgementNote: text("acknowledgement_note").notNull(), evidenceIds: jsonb("evidence_ids").notNull().default([]), acknowledgedByUserId: text("acknowledged_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), acknowledgedBySeatId: text("acknowledged_by_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), receiptSha256: text("receipt_sha256").notNull(), acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_provider_ingress_alert_ack_key_idx").on(table.alertKey), uniqueIndex("eos_provider_ingress_alert_ack_hash_idx").on(table.receiptSha256), index("eos_provider_ingress_alert_ack_registration_idx").on(table.registrationId, table.acknowledgedAt), check("eos_provider_ingress_alert_ack_key_check", sql`${table.alertKey} ~ '^[0-9a-f]{64}$' AND ${table.receiptSha256} ~ '^[0-9a-f]{64}$'`), check("eos_provider_ingress_alert_ack_severity_check", sql`${table.severity} IN ('warning','material','critical')`), check("eos_provider_ingress_alert_ack_note_check", sql`length(trim(${table.acknowledgementNote})) BETWEEN 10 AND 2000`), check("eos_provider_ingress_alert_ack_evidence_check", sql`jsonb_typeof(${table.evidenceIds}) = 'array'`),
]);

export const eosIntegrationIncidents = pgTable("eos_integration_incidents", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), integrationBindingId: text("integration_binding_id").notNull().references(() => eosIntegrationBindings.id, { onDelete: "restrict" }), runId: text("run_id").references(() => eosIntegrationRuns.id, { onDelete: "restrict" }), severity: text("severity").notNull(), state: text("state").notNull().default("open"), summary: text("summary").notNull(), recoveryPlan: text("recovery_plan").notNull(), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), evidenceIds: jsonb("evidence_ids").notNull().default([]), resolution: text("resolution").notNull().default(""), version: integer("version").notNull().default(1), lastEventId: text("last_event_id").references((): AnyPgColumn => eosIntegrationOperationEvents.id, { onDelete: "restrict" }), openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(), resolvedAt: timestamp("resolved_at", { withTimezone: true }), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("eos_integration_incident_state_idx").on(table.companyId, table.state, table.updatedAt), index("eos_integration_incident_binding_idx").on(table.integrationBindingId, table.openedAt), check("eos_integration_incident_state_check", sql`${table.state} IN ('open','acknowledged','resolved')`), check("eos_integration_incident_severity_check", sql`${table.severity} IN ('warning','material','critical')`), check("eos_integration_incident_version_check", sql`${table.version} > 0`),
]);

export const eosIntegrationQualifications = pgTable("eos_integration_qualifications", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), integrationBindingId: text("integration_binding_id").notNull().references(() => eosIntegrationBindings.id, { onDelete: "restrict" }), manifestId: text("manifest_id").notNull().references(() => eosAdapterCapabilityManifests.id, { onDelete: "restrict" }), qualificationKey: text("qualification_key").notNull(), environment: text("environment").notNull(), outcome: text("outcome").notNull(), testedOperations: jsonb("tested_operations").notNull(), missingCapabilities: jsonb("missing_capabilities").notNull().default([]), testSummary: text("test_summary").notNull(), rollbackValidated: boolean("rollback_validated").notNull().default(false), evidenceIds: jsonb("evidence_ids").notNull(), qualificationSha256: text("qualification_sha256").notNull(), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_integration_qualification_key_idx").on(table.integrationBindingId, table.qualificationKey), uniqueIndex("eos_integration_qualification_hash_idx").on(table.qualificationSha256), index("eos_integration_qualification_company_idx").on(table.companyId, table.recordedAt), check("eos_integration_qualification_environment_check", sql`${table.environment} IN ('fixture','sandbox','production')`), check("eos_integration_qualification_outcome_check", sql`${table.outcome} IN ('passing','failing','accepted_exception')`), check("eos_integration_qualification_hash_check", sql`${table.qualificationSha256} ~ '^[0-9a-f]{64}$'`),
]);

export const eosIntegrationCutoverDecisions = pgTable("eos_integration_cutover_decisions", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), integrationBindingId: text("integration_binding_id").notNull().references(() => eosIntegrationBindings.id, { onDelete: "restrict" }), qualificationId: text("qualification_id").notNull().references(() => eosIntegrationQualifications.id, { onDelete: "restrict" }), decision: text("decision").notNull(), rationale: text("rationale").notNull(), evidenceIds: jsonb("evidence_ids").notNull(), decisionSha256: text("decision_sha256").notNull(), policyDecisionId: text("policy_decision_id").notNull().references((): AnyPgColumn => eosPolicyDecisions.id, { onDelete: "restrict" }), decidedByUserId: text("decided_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_integration_cutover_hash_idx").on(table.decisionSha256), index("eos_integration_cutover_binding_idx").on(table.integrationBindingId, table.decidedAt), check("eos_integration_cutover_decision_check", sql`${table.decision} IN ('approve_native','retain_provider','rollback_to_provider')`), check("eos_integration_cutover_hash_check", sql`${table.decisionSha256} ~ '^[0-9a-f]{64}$'`),
]);

export const eosIntegrationOperationEvents = pgTable("eos_integration_operation_events", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), integrationBindingId: text("integration_binding_id").notNull().references(() => eosIntegrationBindings.id, { onDelete: "restrict" }), eventType: text("event_type").notNull(), subjectType: text("subject_type").notNull(), subjectId: text("subject_id").notNull(), versionBefore: integer("version_before").notNull(), versionAfter: integer("version_after").notNull(), evidenceIds: jsonb("evidence_ids").notNull().default([]), payload: jsonb("payload").notNull().default({}), policyDecisionId: text("policy_decision_id").notNull().references((): AnyPgColumn => eosPolicyDecisions.id, { onDelete: "restrict" }), previousEventSha256: text("previous_event_sha256").notNull().default(""), eventSha256: text("event_sha256").notNull(), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_integration_operation_event_hash_idx").on(table.eventSha256), index("eos_integration_operation_event_binding_idx").on(table.integrationBindingId, table.recordedAt), check("eos_integration_operation_event_type_check", sql`${table.eventType} IN ('manifest_frozen','run_planned','dispatch_claimed','dispatch_recovery_escalated','webhook_endpoint_configured','webhook_secret_rotated','webhook_endpoint_state_changed','provider_ingress_configured','provider_ingress_configuration_rotated','provider_ingress_policy_updated','provider_ingress_state_changed','provider_ingress_watch_started','receipt_recorded','retry_authorized','incident_opened','incident_acknowledged','incident_resolved','fallback_changed','qualification_recorded','cutover_decided')`), check("eos_integration_operation_event_subject_check", sql`${table.subjectType} IN ('manifest','run','incident','operational_state','qualification','cutover','webhook_endpoint','provider_ingress')`), check("eos_integration_operation_event_version_check", sql`${table.versionBefore} >= 0 AND ${table.versionAfter} >= ${table.versionBefore}`), check("eos_integration_operation_event_hash_check", sql`${table.eventSha256} ~ '^[0-9a-f]{64}$' AND (${table.previousEventSha256} = '' OR ${table.previousEventSha256} ~ '^[0-9a-f]{64}$')`),
]);

// Workforce control instrument. These records evaluate role outcomes and
// organizational conditions, not private human activity. They extend the
// canonical seat/assignment graph instead of creating a second people model.
export const eosWorkforceReviews = pgTable("eos_workforce_reviews", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }), reviewKey: text("review_key").notNull(), subjectSeatId: text("subject_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), assignmentId: text("assignment_id").references(() => eosAssignments.id, { onDelete: "set null" }), reviewerSeatId: text("reviewer_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), periodStart: timestamp("period_start", { withTimezone: true }).notNull(), periodEnd: timestamp("period_end", { withTimezone: true }).notNull(), state: text("state").notNull().default("draft"), performanceAttribution: text("performance_attribution").notNull().default("undetermined"), outcomeSummary: text("outcome_summary").notNull(), strengths: jsonb("strengths").notNull().default([]), gaps: jsonb("gaps").notNull().default([]), managerObligations: jsonb("manager_obligations").notNull().default([]), employeeResponse: text("employee_response").notNull().default(""), correctionStatus: text("correction_status").notNull().default("none"), metricIds: jsonb("metric_ids").notNull().default([]), workPacketIds: jsonb("work_packet_ids").notNull().default([]), evidenceIds: jsonb("evidence_ids").notNull().default([]), sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("internal"), schemaVersion: text("schema_version").notNull().default("workforce-review-v1.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_workforce_reviews_company_key_idx").on(table.companyId, table.reviewKey), index("eos_workforce_reviews_subject_state_idx").on(table.subjectSeatId, table.state, table.periodEnd), index("eos_workforce_reviews_reviewer_state_idx").on(table.reviewerSeatId, table.state),
  check("eos_workforce_reviews_state_check", sql`${table.state} IN ('draft','self_review','manager_review','calibrated','acknowledged','closed')`), check("eos_workforce_reviews_attribution_check", sql`${table.performanceAttribution} IN ('undetermined','person','role_design','process','management','capacity','fit','mixed')`), check("eos_workforce_reviews_correction_check", sql`${table.correctionStatus} IN ('none','requested','resolved','rejected')`), check("eos_workforce_reviews_window_check", sql`${table.periodEnd} > ${table.periodStart}`), check("eos_workforce_reviews_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`), check("eos_workforce_reviews_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`),
]);

export const eosWorkforceReviewDialogue = pgTable("eos_workforce_review_dialogue", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  reviewId: text("review_id").notNull().references(() => eosWorkforceReviews.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  authorSeatId: text("author_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  responseType: text("response_type").notNull(),
  body: text("body").notNull(),
  correctionDecision: text("correction_decision").notNull().default(""),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("eos_workforce_review_dialogue_review_created_idx").on(table.reviewId, table.createdAt),
  uniqueIndex("eos_workforce_review_dialogue_review_sequence_idx").on(table.reviewId, table.sequence),
  index("eos_workforce_review_dialogue_company_created_idx").on(table.companyId, table.createdAt),
  check("eos_workforce_review_dialogue_type_check", sql`${table.responseType} IN ('employee_response','correction_request','manager_response','correction_resolution')`),
  check("eos_workforce_review_dialogue_decision_check", sql`(${table.responseType} = 'correction_resolution' AND ${table.correctionDecision} IN ('resolved','rejected')) OR (${table.responseType} <> 'correction_resolution' AND ${table.correctionDecision} = '')`),
  check("eos_workforce_review_dialogue_body_check", sql`length(trim(${table.body})) >= 3`),
  check("eos_workforce_review_dialogue_sequence_check", sql`${table.sequence} > 0`),
]);

export const eosDevelopmentPlans = pgTable("eos_development_plans", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }), planKey: text("plan_key").notNull(), subjectSeatId: text("subject_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), assignmentId: text("assignment_id").references(() => eosAssignments.id, { onDelete: "set null" }), managerSeatId: text("manager_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), targetPositionAgreementId: text("target_position_agreement_id").references(() => eosPositionAgreements.id, { onDelete: "set null" }), targetRole: text("target_role").notNull().default(""), state: text("state").notNull().default("draft"), capabilityGaps: jsonb("capability_gaps").notNull().default([]), developmentActions: jsonb("development_actions").notNull().default([]), successCriteria: jsonb("success_criteria").notNull().default([]), workPacketIds: jsonb("work_packet_ids").notNull().default([]), evidenceIds: jsonb("evidence_ids").notNull().default([]), reviewAt: timestamp("review_at", { withTimezone: true }), sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("internal"), schemaVersion: text("schema_version").notNull().default("development-plan-v1.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_development_plans_company_key_idx").on(table.companyId, table.planKey), index("eos_development_plans_subject_state_idx").on(table.subjectSeatId, table.state, table.reviewAt), index("eos_development_plans_manager_state_idx").on(table.managerSeatId, table.state),
  check("eos_development_plans_state_check", sql`${table.state} IN ('draft','active','paused','completed','cancelled')`), check("eos_development_plans_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`), check("eos_development_plans_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`),
]);

export const eosRoleSupportPlans = pgTable("eos_role_support_plans", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }), supportKey: text("support_key").notNull(), subjectSeatId: text("subject_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), assignmentId: text("assignment_id").references(() => eosAssignments.id, { onDelete: "set null" }), managerSeatId: text("manager_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), responsibility: text("responsibility").notNull(), objective: text("objective").notNull(), supportMode: text("support_mode").notNull(), state: text("state").notNull().default("draft"), humanOwnership: text("human_ownership").notNull(), supportInstructions: text("support_instructions").notNull(), guardrails: jsonb("guardrails").notNull().default([]), proofRequirements: jsonb("proof_requirements").notNull().default([]), evidenceIds: jsonb("evidence_ids").notNull().default([]), transferTarget: text("transfer_target").notNull().default(""), reviewAt: timestamp("review_at", { withTimezone: true }), sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("internal"), schemaVersion: text("schema_version").notNull().default("role-support-plan-v1.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_role_support_plans_company_key_idx").on(table.companyId, table.supportKey), index("eos_role_support_plans_subject_state_idx").on(table.subjectSeatId, table.state, table.reviewAt), index("eos_role_support_plans_manager_state_idx").on(table.managerSeatId, table.state),
  check("eos_role_support_plans_mode_check", sql`${table.supportMode} IN ('assist','teach','guard','transfer')`), check("eos_role_support_plans_state_check", sql`${table.state} IN ('draft','active','ready_for_review','completed','cancelled')`), check("eos_role_support_plans_guardrails_check", sql`${table.supportMode} NOT IN ('guard','transfer') OR jsonb_array_length(${table.guardrails}) > 0`), check("eos_role_support_plans_proof_check", sql`${table.supportMode} NOT IN ('teach','transfer') OR jsonb_array_length(${table.proofRequirements}) > 0`), check("eos_role_support_plans_transfer_target_check", sql`${table.supportMode} <> 'transfer' OR length(trim(${table.transferTarget})) >= 3`), check("eos_role_support_plans_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`), check("eos_role_support_plans_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`),
]);

export const eosCareerPathHypotheses = pgTable("eos_career_path_hypotheses", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }), pathKey: text("path_key").notNull(), subjectSeatId: text("subject_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), assignmentId: text("assignment_id").references(() => eosAssignments.id, { onDelete: "set null" }), sponsorSeatId: text("sponsor_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), origin: text("origin").notNull(), fromPositionAgreementId: text("from_position_agreement_id").references(() => eosPositionAgreements.id, { onDelete: "set null" }), targetPositionAgreementId: text("target_position_agreement_id").references(() => eosPositionAgreements.id, { onDelete: "set null" }), targetRole: text("target_role").notNull(), transitionType: text("transition_type").notNull(), careerTrack: text("career_track").notNull(), state: text("state").notNull().default("proposed"), aspirationStatement: text("aspiration_statement").notNull(), businessNeed: text("business_need").notNull().default(""), seatAvailability: text("seat_availability").notNull().default("unknown"), transitionCriteria: jsonb("transition_criteria").notNull().default([]), trainingRequirements: jsonb("training_requirements").notNull().default([]), proofRequirements: jsonb("proof_requirements").notNull().default([]), evidenceIds: jsonb("evidence_ids").notNull().default([]), authorityChangeProposal: text("authority_change_proposal").notNull().default(""), compensationChangeProposal: text("compensation_change_proposal").notNull().default(""), reviewAt: timestamp("review_at", { withTimezone: true }), sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("internal"), schemaVersion: text("schema_version").notNull().default("career-path-hypothesis-v1.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_career_path_hypotheses_company_key_idx").on(table.companyId, table.pathKey), index("eos_career_path_hypotheses_subject_state_idx").on(table.subjectSeatId, table.state, table.reviewAt), index("eos_career_path_hypotheses_sponsor_state_idx").on(table.sponsorSeatId, table.state),
  check("eos_career_path_hypotheses_origin_check", sql`${table.origin} IN ('employee','manager')`), check("eos_career_path_hypotheses_transition_type_check", sql`${table.transitionType} IN ('level_promotion','management_path','senior_ic_path','leadership_path','lateral_adjacent','cross_functional','recovery_reposition')`), check("eos_career_path_hypotheses_track_check", sql`${table.careerTrack} IN ('individual_contributor','management','leadership','executive','cross_functional')`), check("eos_career_path_hypotheses_state_check", sql`${table.state} IN ('proposed','under_review','development_active','evidence_ready','endorsed','declined','withdrawn')`), check("eos_career_path_hypotheses_seat_check", sql`${table.seatAvailability} IN ('unknown','available','unavailable','not_required')`), check("eos_career_path_hypotheses_target_check", sql`length(trim(${table.targetRole})) >= 3 OR ${table.targetPositionAgreementId} IS NOT NULL`), check("eos_career_path_hypotheses_proof_check", sql`jsonb_array_length(${table.proofRequirements}) > 0`), check("eos_career_path_hypotheses_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`), check("eos_career_path_hypotheses_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`),
]);

export const eosSuccessionHypotheses = pgTable("eos_succession_hypotheses", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }), successionKey: text("succession_key").notNull(), criticalSeatId: text("critical_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), candidateSeatId: text("candidate_seat_id").references(() => eosSeats.id, { onDelete: "restrict" }), candidateAssignmentId: text("candidate_assignment_id").references(() => eosAssignments.id, { onDelete: "set null" }), sponsorSeatId: text("sponsor_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), state: text("state").notNull().default("hypothesis"), readinessWindow: text("readiness_window").notNull().default("unassessed"), rationale: text("rationale").notNull(), proofGaps: jsonb("proof_gaps").notNull().default([]), developmentalAssignments: jsonb("developmental_assignments").notNull().default([]), externalHiringRequired: boolean("external_hiring_required").notNull().default(false), workPacketId: text("work_packet_id").references(() => eosWorkPackets.id, { onDelete: "set null" }), evidenceIds: jsonb("evidence_ids").notNull().default([]), sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("restricted"), schemaVersion: text("schema_version").notNull().default("succession-hypothesis-v1.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_succession_hypotheses_company_key_idx").on(table.companyId, table.successionKey), index("eos_succession_hypotheses_critical_state_idx").on(table.criticalSeatId, table.state, table.readinessWindow), index("eos_succession_hypotheses_candidate_state_idx").on(table.candidateSeatId, table.state),
  check("eos_succession_hypotheses_state_check", sql`${table.state} IN ('hypothesis','assessed','development_active','ready','selected','rejected','withdrawn')`), check("eos_succession_hypotheses_readiness_check", sql`${table.readinessWindow} IN ('unassessed','ready_now','within_6_months','within_12_months','within_18_months','not_ready')`), check("eos_succession_hypotheses_distinct_seats_check", sql`${table.candidateSeatId} IS NULL OR ${table.candidateSeatId} <> ${table.criticalSeatId}`), check("eos_succession_hypotheses_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`), check("eos_succession_hypotheses_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`),
]);

// Talent/recruiting instrument. Candidate identity remains canonical in the
// stakeholder registry; these records hold the changing relationship between
// one person and one institutional need, never a second people directory.
export const eosTalentNeeds = pgTable("eos_talent_needs", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }), needKey: text("need_key").notNull(), title: text("title").notNull(), targetSeatId: text("target_seat_id").references(() => eosSeats.id, { onDelete: "set null" }), capabilityInstanceId: text("capability_instance_id").references(() => eosCapabilityInstances.id, { onDelete: "set null" }), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), state: text("state").notNull().default("identified"), urgency: text("urgency").notNull().default("planned"), rationale: text("rationale").notNull(), requiredOutcomes: jsonb("required_outcomes").notNull().default([]), requiredNow: boolean("required_now").notNull().default(false), budgetConstraint: text("budget_constraint").notNull().default(""), evidenceIds: jsonb("evidence_ids").notNull().default([]), sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("confidential"), schemaVersion: text("schema_version").notNull().default("talent-need-v1.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_talent_needs_company_key_idx").on(table.companyId, table.needKey), index("eos_talent_needs_owner_state_idx").on(table.ownerSeatId, table.state, table.urgency), index("eos_talent_needs_target_state_idx").on(table.targetSeatId, table.state), check("eos_talent_needs_state_check", sql`${table.state} IN ('identified','validated','open','paused','filled','closed')`), check("eos_talent_needs_urgency_check", sql`${table.urgency} IN ('planned','soon','urgent','critical')`), check("eos_talent_needs_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`), check("eos_talent_needs_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`),
]);

export const eosTalentApplications = pgTable("eos_talent_applications", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }), applicationKey: text("application_key").notNull(), candidateStakeholderId: text("candidate_stakeholder_id").notNull().references(() => eosStakeholders.id, { onDelete: "restrict" }), candidateUserId: text("candidate_user_id").references(() => users.id, { onDelete: "set null" }), talentNeedId: text("talent_need_id").notNull().references(() => eosTalentNeeds.id, { onDelete: "restrict" }), targetSeatId: text("target_seat_id").references(() => eosSeats.id, { onDelete: "set null" }), ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), state: text("state").notNull().default("invited"), candidateSummary: text("candidate_summary").notNull().default(""), candidateData: jsonb("candidate_data").notNull().default({}), candidateCorrection: text("candidate_correction").notNull().default(""), correctionStatus: text("correction_status").notNull().default("none"), consentState: text("consent_state").notNull().default("pending"), consentScope: jsonb("consent_scope").notNull().default([]), roleHypotheses: jsonb("role_hypotheses").notNull().default([]), proofGaps: jsonb("proof_gaps").notNull().default([]), internalNotes: text("internal_notes").notNull().default(""), evidenceIds: jsonb("evidence_ids").notNull().default([]), portalTokenHash: text("portal_token_hash"), portalExpiresAt: timestamp("portal_expires_at", { withTimezone: true }), portalRevokedAt: timestamp("portal_revoked_at", { withTimezone: true }), portalLastAccessedAt: timestamp("portal_last_accessed_at", { withTimezone: true }), retentionUntil: timestamp("retention_until", { withTimezone: true }), deletionRequestedAt: timestamp("deletion_requested_at", { withTimezone: true }), portalIssueCount: integer("portal_issue_count").notNull().default(0), sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("confidential"), schemaVersion: text("schema_version").notNull().default("talent-application-v1.1"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_talent_applications_company_key_idx").on(table.companyId, table.applicationKey), uniqueIndex("eos_talent_applications_portal_token_idx").on(table.portalTokenHash).where(sql`${table.portalTokenHash} IS NOT NULL`), index("eos_talent_applications_candidate_state_idx").on(table.candidateStakeholderId, table.state), index("eos_talent_applications_need_state_idx").on(table.talentNeedId, table.state), index("eos_talent_applications_owner_state_idx").on(table.ownerSeatId, table.state), check("eos_talent_applications_state_check", sql`${table.state} IN ('invited','intake_started','intake_submitted','assessments_incomplete','assessments_complete','internal_review','interview_ready','trial_recommended','trial_active','decision','onboarding','activated','rejected','hold','withdrawn')`), check("eos_talent_applications_correction_check", sql`${table.correctionStatus} IN ('none','requested','resolved','rejected')`), check("eos_talent_applications_consent_check", sql`${table.consentState} IN ('pending','granted','limited','withdrawn')`), check("eos_talent_applications_portal_window_check", sql`${table.portalTokenHash} IS NULL OR ${table.portalExpiresAt} IS NOT NULL`), check("eos_talent_applications_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`), check("eos_talent_applications_classification_check", sql`${table.classification} IN ('confidential','restricted')`),
]);

export const eosTalentAssessments = pgTable("eos_talent_assessments", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), applicationId: text("application_id").notNull().references(() => eosTalentApplications.id, { onDelete: "cascade" }), assessmentKey: text("assessment_key").notNull(), assessmentType: text("assessment_type").notNull(), title: text("title").notNull(), state: text("state").notNull().default("planned"), decisionQuestion: text("decision_question").notNull(), evidenceExpected: text("evidence_expected").notNull(), validityScope: text("validity_scope").notNull().default(""), candidateBurden: text("candidate_burden").notNull().default(""), candidateSubmission: text("candidate_submission").notNull().default(""), internalEvaluation: text("internal_evaluation").notNull().default(""), consentRequired: boolean("consent_required").notNull().default(false), consentCaptured: boolean("consent_captured").notNull().default(false), generationMode: text("generation_mode").notNull().default("manual"), generatedSequence: integer("generated_sequence"), generationModel: text("generation_model"), generationGovernanceVersion: text("generation_governance_version"), generationInputSha256: text("generation_input_sha256"), generationRationale: text("generation_rationale").notNull().default(""), informationGap: text("information_gap").notNull().default(""), roleHypothesesSnapshot: jsonb("role_hypotheses_snapshot").notNull().default([]), evidenceIds: jsonb("evidence_ids").notNull().default([]), sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("confidential"), schemaVersion: text("schema_version").notNull().default("talent-assessment-v1.1"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_talent_assessments_company_key_idx").on(table.companyId, table.assessmentKey), index("eos_talent_assessments_application_state_idx").on(table.applicationId, table.state, table.assessmentType), uniqueIndex("eos_talent_assessments_adaptive_sequence_idx").on(table.applicationId, table.generatedSequence).where(sql`${table.generationMode} <> 'manual'`), uniqueIndex("eos_talent_assessments_adaptive_open_idx").on(table.applicationId).where(sql`${table.generationMode} <> 'manual' AND ${table.state} IN ('planned','candidate_action')`), check("eos_talent_assessments_type_check", sql`${table.assessmentType} IN ('eligibility','evidence_review','structured_interview','work_sample','simulation','reference','skills_test','job_relevant_cognitive','consented_contextual','paid_trial','other')`), check("eos_talent_assessments_state_check", sql`${table.state} IN ('planned','candidate_action','submitted','verified','reviewed','waived','cancelled')`), check("eos_talent_assessments_consent_check", sql`${table.consentRequired} = false OR ${table.state} IN ('planned','candidate_action','cancelled') OR ${table.consentCaptured} = true`), check("eos_talent_assessments_generation_mode_check", sql`${table.generationMode} IN ('manual','ai','deterministic_fallback')`), check("eos_talent_assessments_generation_sequence_check", sql`(${table.generationMode} = 'manual' AND ${table.generatedSequence} IS NULL) OR (${table.generationMode} <> 'manual' AND ${table.generatedSequence} BETWEEN 1 AND 5)`), check("eos_talent_assessments_generation_hash_check", sql`${table.generationInputSha256} IS NULL OR ${table.generationInputSha256} ~ '^[a-f0-9]{64}$'`), check("eos_talent_assessments_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`), check("eos_talent_assessments_classification_check", sql`${table.classification} IN ('confidential','restricted')`),
]);

// Internal-only recruiting evidence synthesis. These versioned packets organize
// Person x Role x Stage x Team evidence for an attributable human review; they
// never cross the candidate projection or grant a seat, trial, access, or authority.
export const eosTalentReviewPackets = pgTable("eos_talent_review_packets", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), applicationId: text("application_id").notNull().references(() => eosTalentApplications.id, { onDelete: "cascade" }), packetKey: text("packet_key").notNull(), version: integer("version").notNull(), state: text("state").notNull().default("draft"), stageSnapshot: text("stage_snapshot").notNull(), sourceApplicationUpdatedAt: timestamp("source_application_updated_at", { withTimezone: true }).notNull(), roleHypothesesSnapshot: jsonb("role_hypotheses_snapshot").notNull().default([]), requiredOutcomesSnapshot: jsonb("required_outcomes_snapshot").notNull().default([]), roleAssessments: jsonb("role_assessments").notNull().default([]), outcomeCoverage: jsonb("outcome_coverage").notNull().default([]), proofGaps: jsonb("proof_gaps").notNull().default([]), nextAssessment: jsonb("next_assessment"), interviewFocus: jsonb("interview_focus").notNull().default([]), teamFitQuestions: jsonb("team_fit_questions").notNull().default([]), packetSummary: text("packet_summary").notNull().default(""), assessmentIds: jsonb("assessment_ids").notNull().default([]), candidateEvidenceIds: jsonb("candidate_evidence_ids").notNull().default([]), verifiedEvidenceIds: jsonb("verified_evidence_ids").notNull().default([]), materializedAssessmentId: text("materialized_assessment_id").references(() => eosTalentAssessments.id, { onDelete: "set null" }), reviewerSeatId: text("reviewer_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), reviewerDecision: text("reviewer_decision").notNull().default(""), reviewerRationale: text("reviewer_rationale").notNull().default(""), signedOffAt: timestamp("signed_off_at", { withTimezone: true }), sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("restricted"), schemaVersion: text("schema_version").notNull().default("talent-review-packet-v1.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_talent_review_packets_company_key_idx").on(table.companyId, table.packetKey), uniqueIndex("eos_talent_review_packets_application_version_idx").on(table.applicationId, table.version), uniqueIndex("eos_talent_review_packets_open_idx").on(table.applicationId).where(sql`${table.state} IN ('draft','ready_for_review','in_review')`), index("eos_talent_review_packets_reviewer_state_idx").on(table.reviewerSeatId, table.state, table.updatedAt), check("eos_talent_review_packets_state_check", sql`${table.state} IN ('draft','ready_for_review','in_review','signed_off','superseded','cancelled')`), check("eos_talent_review_packets_version_check", sql`${table.version} > 0`), check("eos_talent_review_packets_recommendation_check", sql`${table.reviewerDecision} IN ('','collect_more_evidence','interview_ready','trial_recommended','decision_ready','hold','do_not_advance_recommendation')`), check("eos_talent_review_packets_signoff_check", sql`${table.state} <> 'signed_off' OR (${table.signedOffAt} IS NOT NULL AND ${table.reviewerDecision} <> '' AND ${table.reviewerRationale} <> '')`), check("eos_talent_review_packets_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`), check("eos_talent_review_packets_classification_check", sql`${table.classification} IN ('confidential','restricted')`),
]);

// A paid recruiting trial is a governed, candidate-visible proof contract over
// one application and target seat. It reuses Work Packet approval and Evidence
// truth; it never creates employment, payment, assignment, access, or authority.
export const eosTalentTrials = pgTable("eos_talent_trials", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), applicationId: text("application_id").notNull().references(() => eosTalentApplications.id, { onDelete: "cascade" }), targetSeatId: text("target_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), reviewPacketId: text("review_packet_id").notNull().references(() => eosTalentReviewPackets.id, { onDelete: "restrict" }), trialKey: text("trial_key").notNull(), version: integer("version").notNull(), state: text("state").notNull().default("draft"), title: text("title").notNull(), question: text("question").notNull(), durationDays: integer("duration_days").notNull(), compensationAmountMinor: integer("compensation_amount_minor").notNull(), compensationCurrency: text("compensation_currency").notNull(), compensationTerms: text("compensation_terms").notNull(), legalAgreementReference: text("legal_agreement_reference").notNull(), jurisdiction: text("jurisdiction").notNull(), inputsSupport: jsonb("inputs_support").notNull().default([]), requiredOutputs: jsonb("required_outputs").notNull().default([]), scorecard: jsonb("scorecard").notNull().default([]), constraintsDecisionRights: jsonb("constraints_decision_rights").notNull().default([]), observationPoints: jsonb("observation_points").notNull().default([]), reviewAt: timestamp("review_at", { withTimezone: true }).notNull(), outcomeCriteria: jsonb("outcome_criteria").notNull(), candidateInstructions: text("candidate_instructions").notNull(), predictedOutcome: text("predicted_outcome").notNull(), predictedConfidence: text("predicted_confidence").notNull().default("insufficient"), workPacketId: text("work_packet_id").notNull().references(() => eosWorkPackets.id, { onDelete: "restrict" }), approvalId: text("approval_id").notNull().references(() => eosApprovalRequests.id, { onDelete: "restrict" }), candidateAcceptance: text("candidate_acceptance").notNull().default(""), acceptedAt: timestamp("accepted_at", { withTimezone: true }), candidateSubmission: text("candidate_submission").notNull().default(""), candidateEvidenceIds: jsonb("candidate_evidence_ids").notNull().default([]), submittedAt: timestamp("submitted_at", { withTimezone: true }), scorecardObservations: jsonb("scorecard_observations").notNull().default([]), outcome: text("outcome").notNull().default(""), outcomeEvidenceIds: jsonb("outcome_evidence_ids").notNull().default([]), actualOutcomeSummary: text("actual_outcome_summary").notNull().default(""), reviewerSeatId: text("reviewer_seat_id").references(() => eosSeats.id, { onDelete: "restrict" }), reviewerRationale: text("reviewer_rationale").notNull().default(""), candidateFeedback: text("candidate_feedback").notNull().default(""), reviewedAt: timestamp("reviewed_at", { withTimezone: true }), learningProposal: text("learning_proposal").notNull().default(""), learningStatus: text("learning_status").notNull().default("not_proposed"), learningDecisionRationale: text("learning_decision_rationale").notNull().default(""), learningReviewedByUserId: text("learning_reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }), learningReviewedAt: timestamp("learning_reviewed_at", { withTimezone: true }), sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("restricted"), schemaVersion: text("schema_version").notNull().default("talent-trial-v1.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_talent_trials_company_key_idx").on(table.companyId, table.trialKey), uniqueIndex("eos_talent_trials_application_version_idx").on(table.applicationId, table.version), uniqueIndex("eos_talent_trials_open_idx").on(table.applicationId).where(sql`${table.state} IN ('draft','approved','offered','accepted','active','submitted','under_review')`), index("eos_talent_trials_reviewer_state_idx").on(table.reviewerSeatId, table.state, table.updatedAt), check("eos_talent_trials_state_check", sql`${table.state} IN ('draft','approved','offered','accepted','active','submitted','under_review','passed','redirected','extended','failed','declined','cancelled')`), check("eos_talent_trials_version_check", sql`${table.version} > 0`), check("eos_talent_trials_duration_check", sql`${table.durationDays} BETWEEN 1 AND 30`), check("eos_talent_trials_compensation_check", sql`${table.compensationAmountMinor} > 0 AND ${table.compensationCurrency} ~ '^[A-Z]{3}$'`), check("eos_talent_trials_confidence_check", sql`${table.predictedConfidence} IN ('insufficient','emerging','supported','contradicted')`), check("eos_talent_trials_outcome_check", sql`${table.outcome} IN ('','pass','redirect','extend','fail')`), check("eos_talent_trials_learning_check", sql`${table.learningStatus} IN ('not_proposed','proposed','accepted','rejected')`), check("eos_talent_trials_review_check", sql`${table.state} NOT IN ('passed','redirected','extended','failed') OR (${table.reviewedAt} IS NOT NULL AND ${table.reviewerSeatId} IS NOT NULL AND ${table.outcome} <> '' AND ${table.actualOutcomeSummary} <> '' AND ${table.reviewerRationale} <> '' AND ${table.candidateFeedback} <> '' AND ${table.learningProposal} <> '')`), check("eos_talent_trials_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`), check("eos_talent_trials_classification_check", sql`${table.classification} IN ('confidential','restricted')`),
]);

// Candidate-submitted evidence references are deliberately separate from the
// internally verified evidence registry. A candidate may supply a bounded
// statement or HTTPS reference; an authorized reviewer must independently
// verify and promote it before it can support a consequential decision.
export const eosTalentCandidateEvidence = pgTable("eos_talent_candidate_evidence", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), applicationId: text("application_id").notNull().references(() => eosTalentApplications.id, { onDelete: "cascade" }), evidenceKey: text("evidence_key").notNull(), title: text("title").notNull(), evidenceType: text("evidence_type").notNull(), sourceUrl: text("source_url").notNull().default(""), candidateStatement: text("candidate_statement").notNull().default(""), fileName: text("file_name").notNull().default(""), fileMimeType: text("file_mime_type").notNull().default(""), fileSizeBytes: integer("file_size_bytes"), contentSha256: text("content_sha256"), storageProvider: text("storage_provider"), storageKey: text("storage_key"), scanState: text("scan_state").notNull().default("not_applicable"), scanEngine: text("scan_engine"), scanCompletedAt: timestamp("scan_completed_at", { withTimezone: true }), transcriptionRequested: boolean("transcription_requested").notNull().default(false), transcriptionState: text("transcription_state").notNull().default("not_requested"), transcript: text("transcript").notNull().default(""), transcriptionProvider: text("transcription_provider"), transcriptionModel: text("transcription_model"), transcriptionCompletedAt: timestamp("transcription_completed_at", { withTimezone: true }), state: text("state").notNull().default("submitted"), promotedEvidenceId: text("promoted_evidence_id").references(() => eosEvidence.id, { onDelete: "restrict" }), promotedAt: timestamp("promoted_at", { withTimezone: true }), promotedByUserId: text("promoted_by_user_id").references(() => users.id, { onDelete: "restrict" }), withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }), classification: text("classification").notNull().default("confidential"), schemaVersion: text("schema_version").notNull().default("talent-candidate-evidence-v1.3"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_talent_candidate_evidence_company_key_idx").on(table.companyId, table.evidenceKey), uniqueIndex("eos_talent_candidate_evidence_promoted_evidence_idx").on(table.promotedEvidenceId).where(sql`${table.promotedEvidenceId} IS NOT NULL`), index("eos_talent_candidate_evidence_application_state_idx").on(table.applicationId, table.state), index("eos_talent_candidate_evidence_scan_idx").on(table.companyId, table.scanState, table.updatedAt), check("eos_talent_candidate_evidence_type_check", sql`${table.evidenceType} IN ('portfolio_link','resume_link','work_sample_link','reference_link','candidate_statement','other_link','portfolio_file','resume_file','work_sample_file','assessment_file','other_file','voice_response_file')`), check("eos_talent_candidate_evidence_state_check", sql`${table.state} IN ('submitted','withdrawn','promoted')`), check("eos_talent_candidate_evidence_promotion_check", sql`${table.state} <> 'promoted' OR (${table.promotedEvidenceId} IS NOT NULL AND ${table.promotedAt} IS NOT NULL AND ${table.promotedByUserId} IS NOT NULL)`), check("eos_talent_candidate_evidence_lineage_check", sql`${table.promotedEvidenceId} IS NULL OR ${table.promotedAt} IS NOT NULL`), check("eos_talent_candidate_evidence_withdrawal_check", sql`${table.state} <> 'withdrawn' OR ${table.withdrawnAt} IS NOT NULL`), check("eos_talent_candidate_evidence_payload_check", sql`${table.sourceUrl} <> '' OR ${table.candidateStatement} <> '' OR ${table.storageKey} IS NOT NULL`), check("eos_talent_candidate_evidence_file_metadata_check", sql`${table.storageKey} IS NULL OR (${table.storageProvider} IS NOT NULL AND ${table.fileName} <> '' AND ${table.fileMimeType} <> '' AND ${table.fileSizeBytes} BETWEEN 1 AND 10485760 AND ${table.contentSha256} ~ '^[a-f0-9]{64}$')`), check("eos_talent_candidate_evidence_scan_state_check", sql`${table.scanState} IN ('not_applicable','pending','clean','infected','failed')`), check("eos_talent_candidate_evidence_transcription_state_check", sql`${table.transcriptionState} IN ('not_requested','awaiting_scan','completed','unavailable','failed','declined')`), check("eos_talent_candidate_evidence_transcription_scope_check", sql`${table.transcriptionRequested} = false OR ${table.evidenceType} = 'voice_response_file'`), check("eos_talent_candidate_evidence_classification_check", sql`${table.classification} IN ('confidential','restricted')`),
]);

export const eosTalentCandidateMessages = pgTable("eos_talent_candidate_messages", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), applicationId: text("application_id").notNull().references(() => eosTalentApplications.id, { onDelete: "cascade" }), direction: text("direction").notNull(), body: text("body").notNull(), sentByUserId: text("sent_by_user_id").references(() => users.id, { onDelete: "set null" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("eos_talent_candidate_messages_application_created_idx").on(table.applicationId, table.createdAt), check("eos_talent_candidate_messages_direction_check", sql`${table.direction} IN ('candidate_to_team','team_to_candidate')`),
]);

export const eosTalentSchedulingRequests = pgTable("eos_talent_scheduling_requests", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), applicationId: text("application_id").notNull().references(() => eosTalentApplications.id, { onDelete: "cascade" }), schedulingKind: text("scheduling_kind").notNull().default("interview"), state: text("state").notNull().default("proposed"), proposedSlots: jsonb("proposed_slots").notNull().default([]), selectedSlot: text("selected_slot"), durationMinutes: integer("duration_minutes").notNull().default(45), schedulingUrl: text("scheduling_url").notNull().default(""), teamNote: text("team_note").notNull().default(""), candidateTimezone: text("candidate_timezone").notNull().default(""), candidateAvailability: text("candidate_availability").notNull().default(""), candidateMessage: text("candidate_message").notNull().default(""), sourceSystem: text("source_system").notNull().default("native_eos"), externalEventReference: text("external_event_reference"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("eos_talent_scheduling_application_state_idx").on(table.applicationId, table.state, table.createdAt), check("eos_talent_scheduling_kind_check", sql`${table.schedulingKind} IN ('intro','interview','work_sample','trial','decision_conversation')`), check("eos_talent_scheduling_state_check", sql`${table.state} IN ('proposed','accepted','alternative_requested','declined','cancelled','completed')`), check("eos_talent_scheduling_source_check", sql`${table.sourceSystem} IN ('native_eos','google_calendar','external_scheduling')`), check("eos_talent_scheduling_duration_check", sql`${table.durationMinutes} BETWEEN 15 AND 240`),
]);

// Token-authenticated candidate actions cannot be falsely attributed to an
// internal user. This append-only ledger records the bounded portal action and
// correlation identifiers without retaining IP addresses or raw bearer tokens.
export const eosTalentPortalEvents = pgTable("eos_talent_portal_events", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), applicationId: text("application_id").notNull().references(() => eosTalentApplications.id, { onDelete: "cascade" }), eventType: text("event_type").notNull(), traceId: text("trace_id").notNull(), correlationId: text("correlation_id").notNull(), details: jsonb("details").notNull().default({}), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("eos_talent_portal_events_application_created_idx").on(table.applicationId, table.createdAt), check("eos_talent_portal_events_type_check", sql`${table.eventType} IN ('portal_viewed','intake_saved','intake_submitted','assessment_submitted','evidence_submitted','evidence_withdrawn','candidate_question_submitted','team_message_sent','correction_requested','consent_withdrawn','application_withdrawn','deletion_requested','scheduling_responded','voice_processing_consented','voice_processing_withdrawn','voice_transcription_completed','voice_transcription_failed','adaptive_questioning_consented','adaptive_question_generated','adaptive_question_answered','adaptive_questioning_withdrawn','trial_accepted','trial_declined','trial_submitted')`),
]);

export const eosTalentPlacements = pgTable("eos_talent_placements", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }), placementKey: text("placement_key").notNull(), applicationId: text("application_id").notNull().references(() => eosTalentApplications.id, { onDelete: "restrict" }), targetSeatId: text("target_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), decidedBySeatId: text("decided_by_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }), state: text("state").notNull().default("pending"), rationale: text("rationale").notNull(), offerSummary: text("offer_summary").notNull().default(""), candidateResponse: text("candidate_response").notNull().default(""), onboardingChecklist: jsonb("onboarding_checklist").notNull().default([]), accessPlan: jsonb("access_plan").notNull().default([]), assignmentId: text("assignment_id").references(() => eosAssignments.id, { onDelete: "set null" }), evidenceIds: jsonb("evidence_ids").notNull().default([]), sourceAuthority: text("source_authority").notNull().default("native_eos"), classification: text("classification").notNull().default("restricted"), schemaVersion: text("schema_version").notNull().default("talent-placement-v1.0"), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_talent_placements_company_key_idx").on(table.companyId, table.placementKey), uniqueIndex("eos_talent_placements_application_idx").on(table.applicationId), index("eos_talent_placements_target_state_idx").on(table.targetSeatId, table.state), check("eos_talent_placements_state_check", sql`${table.state} IN ('pending','offer_approved','offer_accepted','offer_declined','rejected','hold','onboarding','activated','withdrawn')`), check("eos_talent_placements_authority_check", sql`${table.sourceAuthority} IN ('native_eos','notion_runtime','external_authoritative','reconciled')`), check("eos_talent_placements_classification_check", sql`${table.classification} IN ('confidential','restricted')`),
]);

// Canonical identity for every non-human or collective security subject that
// can receive Authority Grants. Human principals remain canonical in users;
// organizational responsibility remains canonical in seats. This registry
// prevents an arbitrary provider label, agent name, team, service account, or
// committee string from becoming an executable grantee.
export const eosAuthoritySubjects = pgTable("eos_authority_subjects", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  subjectKey: text("subject_key").notNull(),
  subjectType: text("subject_type").notNull(),
  displayName: text("display_name").notNull(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  supervisorSeatId: text("supervisor_seat_id").references(() => eosSeats.id, { onDelete: "set null" }),
  seatId: text("seat_id").references(() => eosSeats.id, { onDelete: "set null" }),
  parentSubjectId: text("parent_subject_id").references((): AnyPgColumn => eosAuthoritySubjects.id, { onDelete: "restrict" }),
  agentClass: text("agent_class"),
  externalIdentityKey: text("external_identity_key"),
  sourceAuthority: text("source_authority").notNull(),
  identityAttributes: jsonb("identity_attributes").notNull().default({}),
  governanceContract: jsonb("governance_contract").notNull().default({}),
  evidenceReferences: jsonb("evidence_references").notNull().default([]),
  classificationCeiling: text("classification_ceiling").notNull().default("internal"),
  verificationStatus: text("verification_status").notNull().default("pending"),
  status: text("status").notNull().default("proposed"),
  schemaVersion: text("schema_version").notNull().default("authority-subject-v1.0"),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
  effectiveUntil: timestamp("effective_until", { withTimezone: true }),
  reviewAt: timestamp("review_at", { withTimezone: true }),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_authority_subjects_company_key_idx").on(table.companyId, table.subjectKey),
  uniqueIndex("eos_authority_subjects_external_identity_idx")
    .on(table.companyId, table.subjectType, table.externalIdentityKey)
    .where(sql`${table.externalIdentityKey} IS NOT NULL`),
  uniqueIndex("eos_authority_subjects_primary_agent_seat_idx")
    .on(table.seatId)
    .where(sql`${table.subjectType} = 'agent' AND ${table.agentClass} <> 'sub_agent' AND ${table.status} IN ('proposed', 'provisioning', 'active', 'suspended')`),
  index("eos_authority_subjects_company_type_status_idx").on(table.companyId, table.subjectType, table.status),
  index("eos_authority_subjects_owner_status_idx").on(table.ownerUserId, table.status),
  index("eos_authority_subjects_parent_status_idx").on(table.parentSubjectId, table.status),
  index("eos_authority_subjects_review_idx").on(table.status, table.reviewAt),
  check("eos_authority_subjects_type_check", sql`${table.subjectType} IN ('agent', 'team', 'provider', 'service_account', 'governing_body')`),
  check("eos_authority_subjects_agent_class_check", sql`${table.agentClass} IS NULL OR ${table.agentClass} IN ('executive_assistant', 'advisor_agent', 'ceo_agent', 'role_agent', 'sub_agent')`),
  check("eos_authority_subjects_agent_type_check", sql`(${table.subjectType} = 'agent') = (${table.agentClass} IS NOT NULL)`),
  check("eos_authority_subjects_agent_context_check", sql`${table.subjectType} <> 'agent' OR ${table.agentClass} = 'advisor_agent' OR ${table.seatId} IS NOT NULL`),
  check("eos_authority_subjects_sub_agent_parent_check", sql`${table.agentClass} <> 'sub_agent' OR ${table.parentSubjectId} IS NOT NULL`),
  check("eos_authority_subjects_classification_check", sql`${table.classificationCeiling} IN ('public', 'internal', 'confidential', 'restricted', 'highly_restricted')`),
  check("eos_authority_subjects_verification_check", sql`${table.verificationStatus} IN ('pending', 'verified', 'rejected')`),
  check("eos_authority_subjects_status_check", sql`${table.status} IN ('proposed', 'provisioning', 'active', 'suspended', 'retired')`),
  check("eos_authority_subjects_effective_window_check", sql`${table.effectiveUntil} IS NULL OR ${table.effectiveUntil} > ${table.effectiveFrom}`),
]);

// A Role Operating Pack is the compiled, versioned operating environment for
// one live seat. It persists through occupant and agent changes.
export const eosRoleOperatingPacks = pgTable("eos_role_operating_packs", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  seatId: text("seat_id").notNull().references(() => eosSeats.id, { onDelete: "cascade" }),
  positionAgreementId: text("position_agreement_id").notNull().references(() => eosPositionAgreements.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  contract: jsonb("contract").notNull(),
  contentHash: text("content_hash").notNull(),
  compiledFrom: jsonb("compiled_from").notNull().default([]),
  schemaVersion: text("schema_version").notNull().default("role-operating-pack-v1.0"),
  status: text("status").notNull().default("active"),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
  effectiveUntil: timestamp("effective_until", { withTimezone: true }),
  compiledByUserId: text("compiled_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_role_packs_seat_version_idx").on(table.seatId, table.version),
  uniqueIndex("eos_role_packs_one_active_seat_idx")
    .on(table.seatId)
    .where(sql`${table.status} = 'active'`),
  index("eos_role_packs_company_status_idx").on(table.companyId, table.status),
  check("eos_role_packs_status_check", sql`${table.status} IN ('draft', 'active', 'superseded', 'deprecated')`),
  check("eos_role_packs_effective_window_check", sql`${table.effectiveUntil} IS NULL OR ${table.effectiveUntil} > ${table.effectiveFrom}`),
]);

// Membership grants entry to an organization. Assignments grant a principal an
// explicit operating or observing relationship to one or more seats. Keeping
// this separate is what allows one human to carry multiple roles without
// merging the person, membership, role, seat, or authority objects.
export const eosAssignments = pgTable("eos_assignments", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  membershipId: text("membership_id").references(() => eosMemberships.id, { onDelete: "cascade" }),
  principalUserId: text("principal_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  seatId: text("seat_id").notNull().references(() => eosSeats.id, { onDelete: "cascade" }),
  assignmentType: text("assignment_type").notNull().default("occupant"),
  operatingGrant: text("operating_grant").notNull().default("operate"),
  purpose: text("purpose").notNull().default("operate"),
  classificationCeiling: text("classification_ceiling").notNull().default("internal"),
  status: text("status").notNull().default("active"),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
  effectiveUntil: timestamp("effective_until", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_assignments_one_active_principal_per_seat_idx")
    .on(table.seatId)
    .where(sql`${table.status} = 'active' AND ${table.operatingGrant} = 'operate'`),
  uniqueIndex("eos_assignments_active_principal_seat_idx")
    .on(table.companyId, table.principalUserId, table.seatId)
    .where(sql`${table.status} = 'active'`),
  index("eos_assignments_principal_context_idx").on(table.companyId, table.principalUserId, table.status),
  index("eos_assignments_membership_status_idx").on(table.membershipId, table.status),
  check("eos_assignments_type_check", sql`${table.assignmentType} IN ('occupant', 'acting', 'observer')`),
  check("eos_assignments_operating_grant_check", sql`${table.operatingGrant} IN ('observe', 'operate')`),
  check("eos_assignments_classification_check", sql`${table.classificationCeiling} IN ('public', 'internal', 'confidential', 'restricted')`),
  check("eos_assignments_status_check", sql`${table.status} IN ('active', 'suspended', 'ended')`),
  check("eos_assignments_effective_window_check", sql`${table.effectiveUntil} IS NULL OR ${table.effectiveUntil} > ${table.effectiveFrom}`),
]);

// Authority is an explicit, temporal, revocable grant. It is never inferred
// from a title, assignment, agent, tool possession, or personality profile.
export const eosAuthorityGrants = pgTable("eos_authority_grants", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  authorityKey: text("authority_key").notNull(),
  granteeType: text("grantee_type").notNull(),
  granteeKey: text("grantee_key").notNull(),
  granteeSubjectId: text("grantee_subject_id").references(() => eosAuthoritySubjects.id, { onDelete: "restrict" }),
  grantorType: text("grantor_type").notNull(),
  grantorKey: text("grantor_key").notNull(),
  seatId: text("seat_id").references(() => eosSeats.id, { onDelete: "cascade" }),
  capabilityKey: text("capability_key"),
  effect: text("effect").notNull().default("allow"),
  authorityClasses: jsonb("authority_classes").notNull().default([]),
  actionResourceScope: jsonb("action_resource_scope").notNull().default({}),
  ceilingThreshold: jsonb("ceiling_threshold").notNull().default({}),
  conditions: jsonb("conditions").notNull().default([]),
  requiredApprovals: jsonb("required_approvals").notNull().default([]),
  conditionRules: jsonb("condition_rules").notNull().default([]),
  approvalPolicy: jsonb("approval_policy").notNull().default({}),
  separationOfDuties: jsonb("separation_of_duties").notNull().default([]),
  delegable: boolean("delegable").notNull().default(false),
  toolEntitlements: jsonb("tool_entitlements").notNull().default([]),
  policyDecisionSource: text("policy_decision_source").notNull(),
  evidenceReferences: jsonb("evidence_references").notNull().default([]),
  revocationDependentWork: jsonb("revocation_dependent_work").notNull().default([]),
  schemaVersion: text("schema_version").notNull().default("authority-grant-v1.2"),
  state: text("state").notNull().default("proposed"),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
  effectiveUntil: timestamp("effective_until", { withTimezone: true }),
  reviewAt: timestamp("review_at", { withTimezone: true }),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  revokedByUserId: text("revoked_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_authority_grants_company_key_idx").on(table.companyId, table.authorityKey),
  index("eos_authority_grants_grantee_state_idx").on(table.companyId, table.granteeType, table.granteeKey, table.state),
  index("eos_authority_grants_seat_state_idx").on(table.seatId, table.state),
  index("eos_authority_grants_subject_state_idx").on(table.granteeSubjectId, table.state),
  index("eos_authority_grants_review_idx").on(table.state, table.reviewAt),
  check("eos_authority_grants_grantee_type_check", sql`${table.granteeType} IN ('principal', 'agent', 'team', 'provider', 'seat', 'governing_body', 'service_account', 'other')`),
  check("eos_authority_grants_effect_check", sql`${table.effect} IN ('allow', 'deny')`),
  check("eos_authority_grants_state_check", sql`${table.state} IN ('proposed', 'active', 'changing', 'suspended', 'expired', 'revoked')`),
  check("eos_authority_grants_effective_window_check", sql`${table.effectiveUntil} IS NULL OR ${table.effectiveUntil} > ${table.effectiveFrom}`),
]);

// Every protected decision is immutable evidence of the policy inputs,
// matched grants, outcome, and reason codes used before an action or view.
export const eosPolicyDecisions = pgTable("eos_policy_decisions", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  principalUserId: text("principal_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  seatId: text("seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  evaluatedByUserId: text("evaluated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  authorityClass: text("authority_class").notNull(),
  resource: text("resource").notNull(),
  actionKey: text("action_key"),
  purpose: text("purpose").notNull(),
  context: jsonb("context").notNull().default({}),
  outcome: text("outcome").notNull(),
  reasonCodes: jsonb("reason_codes").notNull().default([]),
  matchedGrantIds: jsonb("matched_grant_ids").notNull().default([]),
  satisfiedGrantId: text("satisfied_grant_id").references(() => eosAuthorityGrants.id, { onDelete: "set null" }),
  requirements: jsonb("requirements").notNull().default({}),
  traceId: text("trace_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("eos_policy_decisions_company_created_idx").on(table.companyId, table.createdAt),
  index("eos_policy_decisions_principal_created_idx").on(table.principalUserId, table.createdAt),
  index("eos_policy_decisions_outcome_created_idx").on(table.outcome, table.createdAt),
  check("eos_policy_decisions_authority_class_check", sql`${table.authorityClass} IN ('view', 'recommend', 'execute', 'decide', 'approve', 'spend', 'sign', 'grant_access', 'delegate', 'override_emergency')`),
  check("eos_policy_decisions_outcome_check", sql`${table.outcome} IN ('permit', 'deny', 'require_approval', 'require_evidence', 'transform_minimize', 'escalate')`),
]);

// Invitations are explicit, expiring grants to one organizational seat. The
// raw acceptance token is never stored, and terminal records shed the invited
// email while retaining a non-reversible hash for abuse and audit controls.
export const eosMembershipInvitations = pgTable("eos_membership_invitations", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  seatId: text("seat_id").notNull().references(() => eosSeats.id, { onDelete: "cascade" }),
  talentApplicationId: text("talent_application_id").references(() => eosTalentApplications.id, { onDelete: "restrict" }),
  invitedEmail: text("invited_email"),
  emailHash: text("email_hash").notNull(),
  tokenHash: text("token_hash").notNull(),
  invitedByUserId: text("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
  providerInvitationId: text("provider_invitation_id"),
  status: text("status").notNull().default("pending_delivery"),
  purpose: text("purpose").notNull().default("operate"),
  classificationCeiling: text("classification_ceiling").notNull().default("internal"),
  portfolioScope: boolean("portfolio_scope").notNull().default(false),
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
  uniqueIndex("eos_membership_invitations_one_pending_talent_application_idx")
    .on(table.talentApplicationId)
    .where(sql`${table.talentApplicationId} IS NOT NULL AND ${table.status} IN ('pending_delivery', 'pending')`),
  index("eos_membership_invitations_talent_application_status_idx")
    .on(table.talentApplicationId, table.status)
    .where(sql`${table.talentApplicationId} IS NOT NULL`),
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
  idempotencyKey: text("idempotency_key").notNull(),
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
}, (table) => [
  uniqueIndex("eos_provider_execution_idempotency_idx").on(
    table.companyId,
    table.provider,
    table.operation,
    table.idempotencyKey,
  ),
]);

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

// Native package lifecycle. The current installation row is a tenant-scoped
// projection; every mutation is accompanied by an immutable event and a
// content-addressed snapshot so upgrade, rollback, and replication never rely
// on an untraceable dashboard state.
export const eosCompanyPackageInstallations = pgTable("eos_company_package_installations", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  packageKey: text("package_key").notNull(),
  organizationKey: text("organization_key").notNull(),
  installedVersion: text("installed_version"),
  desiredVersion: text("desired_version").notNull(),
  state: text("state").notNull().default("planned"),
  compatibilityReport: jsonb("compatibility_report").notNull().default({}),
  compiledInstance: jsonb("compiled_instance").notNull().default({}),
  rollbackSnapshots: jsonb("rollback_snapshots").notNull().default([]),
  snapshotSha256: text("snapshot_sha256").notNull(),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  classification: text("classification").notNull().default("restricted"),
  version: integer("version").notNull().default(1),
  lastAction: text("last_action").notNull().default("planned"),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_company_package_installations_company_package_idx").on(table.companyId, table.packageKey),
  index("eos_company_package_installations_company_state_idx").on(table.companyId, table.state),
  check("eos_company_package_installations_state_check", sql`${table.state} IN ('planned','installed','upgrade_planned','rollback_planned','blocked','retired')`),
  check("eos_company_package_installations_version_check", sql`${table.version} > 0`),
  check("eos_company_package_installations_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`),
  check("eos_company_package_installations_hash_check", sql`${table.snapshotSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_company_package_installations_rollback_array_check", sql`jsonb_typeof(${table.rollbackSnapshots}) = 'array'`),
]);

export const eosCompanyPackageInstallationEvents = pgTable("eos_company_package_installation_events", {
  id: text("id").primaryKey(),
  installationId: text("installation_id").notNull().references(() => eosCompanyPackageInstallations.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  action: text("action").notNull(),
  fromVersion: text("from_version"),
  toVersion: text("to_version"),
  eventProjection: jsonb("event_projection").notNull(),
  eventSha256: text("event_sha256").notNull(),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_company_package_installation_events_sequence_idx").on(table.installationId, table.sequence),
  index("eos_company_package_installation_events_company_time_idx").on(table.companyId, table.recordedAt),
  check("eos_company_package_installation_events_action_check", sql`${table.action} IN ('planned','installed','upgrade_planned','upgraded','rollback_planned','rolled_back','blocked','retired','replication_exported')`),
  check("eos_company_package_installation_events_sequence_check", sql`${table.sequence} > 0`),
  check("eos_company_package_installation_events_hash_check", sql`${table.eventSha256} ~ '^[0-9a-f]{64}$'`),
]);

export const eosSkillDefinitions = pgTable("eos_skill_definitions", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  skillKey: text("skill_key").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  version: integer("version").notNull().default(1),
  state: text("state").notNull().default("draft"),
  handlerKind: text("handler_kind").notNull(),
  handlerReference: text("handler_reference").notNull(),
  providerBindingId: text("provider_binding_id").references(() => eosIntegrationBindings.id, { onDelete: "restrict" }),
  inputSchema: jsonb("input_schema").notNull().default({}),
  outputSchema: jsonb("output_schema").notNull().default({}),
  allowedModes: jsonb("allowed_modes").notNull().default([]),
  requiredAuthority: jsonb("required_authority").notNull().default([]),
  toolEntitlements: jsonb("tool_entitlements").notNull().default([]),
  timeoutMs: integer("timeout_ms").notNull().default(60000),
  maxAttempts: integer("max_attempts").notNull().default(3),
  evidenceRequirements: jsonb("evidence_requirements").notNull().default([]),
  classification: text("classification").notNull().default("confidential"),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_skill_definitions_company_key_version_idx").on(table.companyId, table.skillKey, table.version),
  index("eos_skill_definitions_company_state_idx").on(table.companyId, table.state),
  check("eos_skill_definitions_state_check", sql`${table.state} IN ('draft','review','released','paused','retired')`),
  check("eos_skill_definitions_handler_check", sql`${table.handlerKind} IN ('manual','native','provider','projection')`),
  check("eos_skill_definitions_version_check", sql`${table.version} > 0`),
  check("eos_skill_definitions_attempts_check", sql`${table.maxAttempts} BETWEEN 1 AND 20`),
  check("eos_skill_definitions_timeout_check", sql`${table.timeoutMs} BETWEEN 100 AND 3600000`),
  check("eos_skill_definitions_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`),
  check("eos_skill_definitions_modes_array_check", sql`jsonb_typeof(${table.allowedModes}) = 'array'`),
  check("eos_skill_definitions_provider_check", sql`(${table.handlerKind} = 'provider' AND ${table.providerBindingId} IS NOT NULL) OR (${table.handlerKind} <> 'provider' AND ${table.providerBindingId} IS NULL)`),
]);

export const eosWorkflowRuns = pgTable("eos_workflow_runs", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  runKey: text("run_key").notNull(),
  processDefinitionId: text("process_definition_id").notNull().references(() => eosProcessDefinitions.id, { onDelete: "restrict" }),
  workPacketId: text("work_packet_id").references(() => eosWorkPackets.id, { onDelete: "restrict" }),
  executionMode: text("execution_mode").notNull(),
  state: text("state").notNull().default("queued"),
  currentStep: integer("current_step").notNull().default(0),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  delegatedSeatId: text("delegated_seat_id").references(() => eosSeats.id, { onDelete: "restrict" }),
  idempotencyKey: text("idempotency_key").notNull(),
  input: jsonb("input").notNull().default({}),
  output: jsonb("output").notNull().default({}),
  evidenceIds: jsonb("evidence_ids").notNull().default([]),
  approvalId: text("approval_id").references(() => eosApprovalRequests.id, { onDelete: "set null" }),
  blocker: text("blocker").notNull().default(""),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  classification: text("classification").notNull().default("confidential"),
  version: integer("version").notNull().default(1),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_workflow_runs_company_key_idx").on(table.companyId, table.runKey),
  uniqueIndex("eos_workflow_runs_company_idempotency_idx").on(table.companyId, table.idempotencyKey),
  index("eos_workflow_runs_company_state_schedule_idx").on(table.companyId, table.state, table.scheduledFor),
  index("eos_workflow_runs_owner_state_idx").on(table.ownerSeatId, table.state),
  check("eos_workflow_runs_mode_check", sql`${table.executionMode} IN ('manual','assisted','delegated','autonomous')`),
  check("eos_workflow_runs_state_check", sql`${table.state} IN ('queued','running','waiting_input','waiting_approval','blocked','completed','failed','cancelled')`),
  check("eos_workflow_runs_version_check", sql`${table.version} > 0`),
  check("eos_workflow_runs_step_check", sql`${table.currentStep} >= 0`),
  check("eos_workflow_runs_delegation_check", sql`(${table.executionMode} = 'delegated' AND ${table.delegatedSeatId} IS NOT NULL) OR (${table.executionMode} <> 'delegated' AND ${table.delegatedSeatId} IS NULL)`),
  check("eos_workflow_runs_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`),
  check("eos_workflow_runs_evidence_array_check", sql`jsonb_typeof(${table.evidenceIds}) = 'array'`),
  check("eos_workflow_runs_lease_check", sql`(${table.leaseOwner} IS NULL AND ${table.leaseExpiresAt} IS NULL) OR (${table.leaseOwner} IS NOT NULL AND ${table.leaseExpiresAt} IS NOT NULL)`),
]);

export const eosWorkflowRunEvents = pgTable("eos_workflow_run_events", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => eosWorkflowRuns.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  action: text("action").notNull(),
  fromState: text("from_state").notNull(),
  toState: text("to_state").notNull(),
  actorSeatId: text("actor_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  eventProjection: jsonb("event_projection").notNull(),
  eventSha256: text("event_sha256").notNull(),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_workflow_run_events_sequence_idx").on(table.runId, table.sequence),
  index("eos_workflow_run_events_company_time_idx").on(table.companyId, table.recordedAt),
  check("eos_workflow_run_events_sequence_check", sql`${table.sequence} > 0`),
  check("eos_workflow_run_events_hash_check", sql`${table.eventSha256} ~ '^[0-9a-f]{64}$'`),
]);

export const eosSkillInvocations = pgTable("eos_skill_invocations", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  runId: text("run_id").notNull().references(() => eosWorkflowRuns.id, { onDelete: "cascade" }),
  skillDefinitionId: text("skill_definition_id").notNull().references(() => eosSkillDefinitions.id, { onDelete: "restrict" }),
  stepIndex: integer("step_index").notNull(),
  state: text("state").notNull().default("queued"),
  attempt: integer("attempt").notNull().default(1),
  idempotencyKey: text("idempotency_key").notNull(),
  input: jsonb("input").notNull().default({}),
  output: jsonb("output").notNull().default({}),
  error: text("error").notNull().default(""),
  providerExecutionId: text("provider_execution_id").references(() => eosProviderExecutions.id, { onDelete: "set null" }),
  evidenceIds: jsonb("evidence_ids").notNull().default([]),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_skill_invocations_run_idempotency_idx").on(table.runId, table.idempotencyKey),
  index("eos_skill_invocations_run_step_idx").on(table.runId, table.stepIndex, table.attempt),
  check("eos_skill_invocations_state_check", sql`${table.state} IN ('queued','running','waiting_approval','completed','failed','cancelled')`),
  check("eos_skill_invocations_attempt_check", sql`${table.attempt} > 0`),
  check("eos_skill_invocations_step_check", sql`${table.stepIndex} >= 0`),
  check("eos_skill_invocations_evidence_array_check", sql`jsonb_typeof(${table.evidenceIds}) = 'array'`),
]);

export const eosAgentSchedules = pgTable("eos_agent_schedules", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  scheduleKey: text("schedule_key").notNull(),
  name: text("name").notNull(),
  seatId: text("seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  authoritySubjectId: text("authority_subject_id").notNull().references(() => eosAuthoritySubjects.id, { onDelete: "restrict" }),
  processDefinitionId: text("process_definition_id").notNull().references(() => eosProcessDefinitions.id, { onDelete: "restrict" }),
  triggerKind: text("trigger_kind").notNull(),
  cadence: text("cadence").notNull(),
  eventTypes: jsonb("event_types").notNull().default([]),
  executionMode: text("execution_mode").notNull(),
  inputTemplate: jsonb("input_template").notNull().default({}),
  state: text("state").notNull().default("draft"),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  maxRunsPerDay: integer("max_runs_per_day").notNull().default(24),
  evaluationRequired: boolean("evaluation_required").notNull().default(true),
  activationPolicyDecisionId: text("activation_policy_decision_id").references((): AnyPgColumn => eosPolicyDecisions.id, { onDelete: "restrict" }),
  classification: text("classification").notNull().default("confidential"),
  version: integer("version").notNull().default(1),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_agent_schedules_company_key_idx").on(table.companyId, table.scheduleKey),
  index("eos_agent_schedules_due_idx").on(table.state, table.nextRunAt),
  index("eos_agent_schedules_event_idx").on(table.companyId, table.triggerKind, table.state),
  check("eos_agent_schedules_trigger_check", sql`${table.triggerKind} IN ('schedule','event','manual')`),
  check("eos_agent_schedules_cadence_check", sql`${table.cadence} IN ('once','hourly','daily','weekly','monthly','event','manual')`),
  check("eos_agent_schedules_mode_check", sql`${table.executionMode} IN ('manual','assisted','delegated','autonomous')`),
  check("eos_agent_schedules_no_delegated_mode_check", sql`${table.executionMode} <> 'delegated'`),
  check("eos_agent_schedules_state_check", sql`${table.state} IN ('draft','active','paused','retired')`),
  check("eos_agent_schedules_version_check", sql`${table.version} > 0`),
  check("eos_agent_schedules_daily_limit_check", sql`${table.maxRunsPerDay} BETWEEN 1 AND 1440`),
  check("eos_agent_schedules_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`),
  check("eos_agent_schedules_event_array_check", sql`jsonb_typeof(${table.eventTypes}) = 'array'`),
  check("eos_agent_schedules_trigger_configuration_check", sql`
    (${table.triggerKind} = 'event' AND ${table.cadence} = 'event' AND jsonb_array_length(${table.eventTypes}) > 0 AND ${table.nextRunAt} IS NULL) OR
    (${table.triggerKind} = 'manual' AND ${table.cadence} = 'manual' AND jsonb_array_length(${table.eventTypes}) = 0 AND ${table.nextRunAt} IS NULL) OR
    (${table.triggerKind} = 'schedule' AND ${table.cadence} IN ('once','hourly','daily','weekly','monthly') AND jsonb_array_length(${table.eventTypes}) = 0 AND ${table.nextRunAt} IS NOT NULL)
  `),
]);

export const eosAgentRunEvaluations = pgTable("eos_agent_run_evaluations", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  workflowRunId: text("workflow_run_id").notNull().references(() => eosWorkflowRuns.id, { onDelete: "cascade" }),
  scheduleId: text("schedule_id").references(() => eosAgentSchedules.id, { onDelete: "set null" }),
  evaluatorSeatId: text("evaluator_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  outcome: text("outcome").notNull(),
  scores: jsonb("scores").notNull(),
  rationale: text("rationale").notNull(),
  evidenceIds: jsonb("evidence_ids").notNull().default([]),
  learningProposal: text("learning_proposal").notNull().default(""),
  learningState: text("learning_state").notNull().default("not_proposed"),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_agent_run_evaluations_run_idx").on(table.workflowRunId),
  index("eos_agent_run_evaluations_company_outcome_idx").on(table.companyId, table.outcome, table.createdAt),
  check("eos_agent_run_evaluations_outcome_check", sql`${table.outcome} IN ('passed','needs_review','failed')`),
  check("eos_agent_run_evaluations_learning_check", sql`${table.learningState} IN ('not_proposed','proposed','accepted','rejected')`),
  check("eos_agent_run_evaluations_evidence_array_check", sql`jsonb_typeof(${table.evidenceIds}) = 'array'`),
  check("eos_agent_run_evaluations_scores_check", sql`
    ${table.scores} ?& ARRAY['correctness','authorityCompliance','evidenceQuality','usefulness','efficiency']
    AND (${table.scores}->>'correctness')::numeric BETWEEN 0 AND 1
    AND (${table.scores}->>'authorityCompliance')::numeric BETWEEN 0 AND 1
    AND (${table.scores}->>'evidenceQuality')::numeric BETWEEN 0 AND 1
    AND (${table.scores}->>'usefulness')::numeric BETWEEN 0 AND 1
    AND (${table.scores}->>'efficiency')::numeric BETWEEN 0 AND 1
  `),
]);

export const eosAdvisorDeliberations = pgTable("eos_advisor_deliberations", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  portfolioId: integer("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
  founderSeatId: text("founder_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  question: text("question").notNull(),
  contextPacket: jsonb("context_packet").notNull(),
  panelMode: text("panel_mode").notNull(),
  advisorIds: jsonb("advisor_ids").notNull(),
  state: text("state").notNull().default("draft"),
  synthesis: text("synthesis").notNull().default(""),
  materialDissent: jsonb("material_dissent").notNull().default([]),
  decisionDueAt: timestamp("decision_due_at", { withTimezone: true }),
  classification: text("classification").notNull().default("restricted"),
  traceId: text("trace_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  version: integer("version").notNull().default(1),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("eos_advisor_deliberations_company_state_idx").on(table.companyId, table.state, table.updatedAt),
  check("eos_advisor_deliberations_panel_check", sql`${table.panelMode} IN ('relevant','full_council')`),
  check("eos_advisor_deliberations_state_check", sql`${table.state} IN ('draft','independent_complete','rebuttal_complete','revision_complete','synthesis_ready','decided','calibrated','failed')`),
  check("eos_advisor_deliberations_version_check", sql`${table.version} > 0`),
  check("eos_advisor_deliberations_classification_check", sql`${table.classification} = 'restricted'`),
  check("eos_advisor_deliberations_advisors_check", sql`jsonb_typeof(${table.advisorIds}) = 'array' AND jsonb_array_length(${table.advisorIds}) BETWEEN 1 AND 15`),
]);

export const eosAdvisorContributions = pgTable("eos_advisor_contributions", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  deliberationId: text("deliberation_id").notNull().references(() => eosAdvisorDeliberations.id, { onDelete: "cascade" }),
  advisorId: text("advisor_id").notNull(),
  advisorName: text("advisor_name").notNull(),
  round: text("round").notNull(),
  response: text("response").notNull(),
  claims: jsonb("claims").notNull().default([]),
  assumptions: jsonb("assumptions").notNull().default([]),
  evidenceReferences: jsonb("evidence_references").notNull().default([]),
  dissentReferences: jsonb("dissent_references").notNull().default([]),
  model: text("model"),
  status: text("status").notNull(),
  provenance: jsonb("provenance").notNull(),
  contentSha256: text("content_sha256").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_advisor_contributions_round_advisor_idx").on(table.deliberationId, table.round, table.advisorId),
  index("eos_advisor_contributions_deliberation_round_idx").on(table.deliberationId, table.round),
  check("eos_advisor_contributions_round_check", sql`${table.round} IN ('independent','rebuttal','revision','synthesis')`),
  check("eos_advisor_contributions_status_check", sql`${table.status} IN ('completed','failed')`),
  check("eos_advisor_contributions_hash_check", sql`${table.contentSha256} ~ '^[0-9a-f]{64}$'`),
]);

export const eosAdvisorDecisionOutcomes = pgTable("eos_advisor_decision_outcomes", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  deliberationId: text("deliberation_id").notNull().references(() => eosAdvisorDeliberations.id, { onDelete: "cascade" }),
  decision: text("decision").notNull(),
  rationale: text("rationale").notNull(),
  acceptedClaims: jsonb("accepted_claims").notNull().default([]),
  rejectedClaims: jsonb("rejected_claims").notNull().default([]),
  decisionEvidenceIds: jsonb("decision_evidence_ids").notNull().default([]),
  outcome: text("outcome"),
  outcomeSummary: text("outcome_summary").notNull().default(""),
  outcomeEvidenceIds: jsonb("outcome_evidence_ids").notNull().default([]),
  claimOutcomes: jsonb("claim_outcomes").notNull().default([]),
  learningProposal: text("learning_proposal").notNull().default(""),
  learningState: text("learning_state").notNull().default("not_proposed"),
  decidedByUserId: text("decided_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
  calibratedAt: timestamp("calibrated_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("eos_advisor_decision_outcomes_deliberation_idx").on(table.deliberationId),
  index("eos_advisor_decision_outcomes_company_decided_idx").on(table.companyId, table.decidedAt),
  check("eos_advisor_decision_outcomes_outcome_check", sql`${table.outcome} IS NULL OR ${table.outcome} IN ('better_than_expected','as_expected','worse_than_expected','inconclusive')`),
  check("eos_advisor_decision_outcomes_learning_check", sql`${table.learningState} IN ('not_proposed','proposed','accepted','rejected')`),
]);

// Institutional intelligence keeps observed reality, simulated possibilities,
// incident learning, and promoted organizational memory in separate ledgers.
// Nothing produced by a simulation or agent becomes canonical memory without
// an explicit human review decision and company-scoped Evidence.
export const eosRealityObservations = pgTable("eos_reality_observations", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  observationKey: text("observation_key").notNull(),
  subject: text("subject").notNull(),
  statement: text("statement").notNull(),
  sourceKind: text("source_kind").notNull(),
  sourceReference: text("source_reference").notNull().default(""),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  freshnessExpiresAt: timestamp("freshness_expires_at", { withTimezone: true }),
  confidence: integer("confidence").notNull(),
  state: text("state").notNull().default("asserted"),
  evidenceIds: jsonb("evidence_ids").notNull().default([]),
  supersedesObservationId: text("supersedes_observation_id").references((): AnyPgColumn => eosRealityObservations.id, { onDelete: "restrict" }),
  classification: text("classification").notNull().default("confidential"),
  contentSha256: text("content_sha256").notNull(),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_reality_observations_company_key_idx").on(table.companyId, table.observationKey),
  index("eos_reality_observations_company_subject_idx").on(table.companyId, table.subject, table.observedAt),
  check("eos_reality_observations_source_check", sql`${table.sourceKind} IN ('human','integration','document','workflow','metric','external')`),
  check("eos_reality_observations_state_check", sql`${table.state} IN ('asserted','verified','disputed','superseded')`),
  check("eos_reality_observations_confidence_check", sql`${table.confidence} BETWEEN 0 AND 100`),
  check("eos_reality_observations_evidence_array_check", sql`jsonb_typeof(${table.evidenceIds}) = 'array'`),
  check("eos_reality_observations_hash_check", sql`${table.contentSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_reality_observations_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`),
]);

export const eosScenarioModels = pgTable("eos_scenario_models", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  scenarioKey: text("scenario_key").notNull(),
  name: text("name").notNull(),
  decisionQuestion: text("decision_question").notNull(),
  assumptions: jsonb("assumptions").notNull().default([]),
  variables: jsonb("variables").notNull().default([]),
  branches: jsonb("branches").notNull().default([]),
  result: jsonb("result").notNull().default({}),
  state: text("state").notNull().default("draft"),
  evidenceIds: jsonb("evidence_ids").notNull().default([]),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  classification: text("classification").notNull().default("restricted"),
  version: integer("version").notNull().default(1),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_scenario_models_company_key_idx").on(table.companyId, table.scenarioKey),
  index("eos_scenario_models_company_state_idx").on(table.companyId, table.state, table.updatedAt),
  check("eos_scenario_models_state_check", sql`${table.state} IN ('draft','analyzed','selected','rejected','archived')`),
  check("eos_scenario_models_arrays_check", sql`jsonb_typeof(${table.assumptions}) = 'array' AND jsonb_typeof(${table.variables}) = 'array' AND jsonb_typeof(${table.branches}) = 'array' AND jsonb_typeof(${table.evidenceIds}) = 'array'`),
  check("eos_scenario_models_version_check", sql`${table.version} > 0`),
  check("eos_scenario_models_classification_check", sql`${table.classification} IN ('confidential','restricted')`),
]);

export const eosPostmortems = pgTable("eos_postmortems", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  eventType: text("event_type").notNull(),
  eventReference: text("event_reference").notNull().default(""),
  summary: text("summary").notNull(),
  impact: text("impact").notNull(),
  timeline: jsonb("timeline").notNull().default([]),
  contributingFactors: jsonb("contributing_factors").notNull().default([]),
  rootCauses: jsonb("root_causes").notNull().default([]),
  correctiveActions: jsonb("corrective_actions").notNull().default([]),
  evidenceIds: jsonb("evidence_ids").notNull().default([]),
  state: text("state").notNull().default("draft"),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  classification: text("classification").notNull().default("confidential"),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id, { onDelete: "restrict" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("eos_postmortems_company_state_idx").on(table.companyId, table.state, table.updatedAt),
  check("eos_postmortems_event_type_check", sql`${table.eventType} IN ('incident','failed_workflow','missed_outcome','provider_failure','security','customer','other')`),
  check("eos_postmortems_state_check", sql`${table.state} IN ('draft','review','accepted','rejected')`),
  check("eos_postmortems_arrays_check", sql`jsonb_typeof(${table.timeline}) = 'array' AND jsonb_typeof(${table.contributingFactors}) = 'array' AND jsonb_typeof(${table.rootCauses}) = 'array' AND jsonb_typeof(${table.correctiveActions}) = 'array' AND jsonb_typeof(${table.evidenceIds}) = 'array'`),
  check("eos_postmortems_review_check", sql`(${table.state} IN ('accepted','rejected') AND ${table.reviewedByUserId} IS NOT NULL AND ${table.reviewedAt} IS NOT NULL) OR (${table.state} IN ('draft','review'))`),
  check("eos_postmortems_classification_check", sql`${table.classification} IN ('confidential','restricted')`),
]);

export const eosLearningProposals = pgTable("eos_learning_proposals", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  title: text("title").notNull(),
  proposal: text("proposal").notNull(),
  targetType: text("target_type").notNull(),
  targetReference: text("target_reference").notNull().default(""),
  evidenceIds: jsonb("evidence_ids").notNull().default([]),
  state: text("state").notNull().default("proposed"),
  decisionRationale: text("decision_rationale").notNull().default(""),
  decidedByUserId: text("decided_by_user_id").references(() => users.id, { onDelete: "restrict" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  classification: text("classification").notNull().default("restricted"),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_learning_proposals_source_target_idx").on(table.companyId, table.sourceType, table.sourceId, table.targetType),
  index("eos_learning_proposals_company_state_idx").on(table.companyId, table.state, table.createdAt),
  check("eos_learning_proposals_source_check", sql`${table.sourceType} IN ('postmortem','agent_evaluation','advisor_calibration','workflow','human_review')`),
  check("eos_learning_proposals_target_check", sql`${table.targetType} IN ('memory','process','skill','policy','template','model_route')`),
  check("eos_learning_proposals_state_check", sql`${table.state} IN ('proposed','accepted','rejected','implemented')`),
  check("eos_learning_proposals_evidence_array_check", sql`jsonb_typeof(${table.evidenceIds}) = 'array'`),
  check("eos_learning_proposals_decision_check", sql`(${table.state} = 'proposed' AND ${table.decidedByUserId} IS NULL AND ${table.decidedAt} IS NULL) OR (${table.state} <> 'proposed' AND ${table.decidedByUserId} IS NOT NULL AND ${table.decidedAt} IS NOT NULL)`),
  check("eos_learning_proposals_classification_check", sql`${table.classification} = 'restricted'`),
]);

export const eosInstitutionalMemoryRecords = pgTable("eos_institutional_memory_records", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  memoryKey: text("memory_key").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  evidenceIds: jsonb("evidence_ids").notNull().default([]),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  state: text("state").notNull().default("verified"),
  supersedesMemoryId: text("supersedes_memory_id").references((): AnyPgColumn => eosInstitutionalMemoryRecords.id, { onDelete: "restrict" }),
  classification: text("classification").notNull().default("restricted"),
  contentSha256: text("content_sha256").notNull(),
  approvedByUserId: text("approved_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_institutional_memory_company_key_idx").on(table.companyId, table.memoryKey),
  index("eos_institutional_memory_company_kind_idx").on(table.companyId, table.kind, table.createdAt),
  check("eos_institutional_memory_kind_check", sql`${table.kind} IN ('fact','decision','lesson','pattern','policy')`),
  check("eos_institutional_memory_state_check", sql`${table.state} IN ('verified','superseded','retracted')`),
  check("eos_institutional_memory_evidence_array_check", sql`jsonb_typeof(${table.evidenceIds}) = 'array'`),
  check("eos_institutional_memory_hash_check", sql`${table.contentSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_institutional_memory_classification_check", sql`${table.classification} IN ('confidential','restricted')`),
]);

// Dormant-safe external workspaces. Capital, board, advisor, client, investor,
// and partner experiences can be fully configured while remaining incapable of
// disclosure until a founder-controlled activation and explicit publication.
export const eosStakeholderPortals = pgTable("eos_stakeholder_portals", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  portalKey: text("portal_key").notNull(), name: text("name").notNull(), portalType: text("portal_type").notNull(),
  stakeholderId: text("stakeholder_id").references(() => eosStakeholders.id, { onDelete: "restrict" }),
  state: text("state").notNull().default("dormant"), visibleSections: jsonb("visible_sections").notNull().default([]),
  activationRequirements: jsonb("activation_requirements").notNull().default([]), activationEvidenceIds: jsonb("activation_evidence_ids").notNull().default([]),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  activatedByUserId: text("activated_by_user_id").references(() => users.id, { onDelete: "restrict" }), activatedAt: timestamp("activated_at", { withTimezone: true }),
  version: integer("version").notNull().default(1), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_stakeholder_portals_company_key_idx").on(table.companyId, table.portalKey),
  index("eos_stakeholder_portals_company_state_idx").on(table.companyId, table.portalType, table.state),
  check("eos_stakeholder_portals_type_check", sql`${table.portalType} IN ('client','board','advisor','investor','capital','partner')`),
  check("eos_stakeholder_portals_state_check", sql`${table.state} IN ('dormant','configuring','active','paused','retired')`),
  check("eos_stakeholder_portals_arrays_check", sql`jsonb_typeof(${table.visibleSections}) = 'array' AND jsonb_typeof(${table.activationRequirements}) = 'array' AND jsonb_typeof(${table.activationEvidenceIds}) = 'array'`),
  check("eos_stakeholder_portals_activation_check", sql`(${table.state} = 'active' AND ${table.activatedByUserId} IS NOT NULL AND ${table.activatedAt} IS NOT NULL) OR ${table.state} <> 'active'`),
  check("eos_stakeholder_portals_version_check", sql`${table.version} > 0`),
]);

export const eosStakeholderPortalPublications = pgTable("eos_stakeholder_portal_publications", {
  id: text("id").primaryKey(), portalId: text("portal_id").notNull().references(() => eosStakeholderPortals.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), section: text("section").notNull(),
  title: text("title").notNull(), body: text("body").notNull(), dataProjection: jsonb("data_projection").notNull().default({}),
  evidenceIds: jsonb("evidence_ids").notNull().default([]), state: text("state").notNull().default("draft"),
  version: integer("version").notNull().default(1), publishedByUserId: text("published_by_user_id").references(() => users.id, { onDelete: "restrict" }),
  publishedAt: timestamp("published_at", { withTimezone: true }), recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("eos_stakeholder_portal_publications_portal_state_idx").on(table.portalId, table.state, table.updatedAt),
  check("eos_stakeholder_portal_publications_state_check", sql`${table.state} IN ('draft','published','withdrawn')`),
  check("eos_stakeholder_portal_publications_evidence_array_check", sql`jsonb_typeof(${table.evidenceIds}) = 'array'`),
  check("eos_stakeholder_portal_publications_publish_check", sql`(${table.state} = 'published' AND ${table.publishedByUserId} IS NOT NULL AND ${table.publishedAt} IS NOT NULL AND jsonb_array_length(${table.evidenceIds}) > 0) OR ${table.state} <> 'published'`),
]);

export const eosStakeholderPortalAccessGrants = pgTable("eos_stakeholder_portal_access_grants", {
  id: text("id").primaryKey(), portalId: text("portal_id").notNull().references(() => eosStakeholderPortals.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), recipientLabel: text("recipient_label").notNull(),
  recipientIdentityHash: text("recipient_identity_hash").notNull(), tokenHash: text("token_hash").notNull(), state: text("state").notNull().default("issued"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
  accessCount: integer("access_count").notNull().default(0), revokedAt: timestamp("revoked_at", { withTimezone: true }),
  issuedByUserId: text("issued_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_stakeholder_portal_access_token_idx").on(table.tokenHash),
  index("eos_stakeholder_portal_access_portal_state_idx").on(table.portalId, table.state, table.expiresAt),
  check("eos_stakeholder_portal_access_state_check", sql`${table.state} IN ('issued','accessed','revoked','expired')`),
  check("eos_stakeholder_portal_access_hash_check", sql`${table.recipientIdentityHash} ~ '^[0-9a-f]{64}$' AND ${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
  check("eos_stakeholder_portal_access_count_check", sql`${table.accessCount} >= 0`),
]);

// Canonical shared-instrument substrate. The horizontal instruments use one
// company-scoped lifecycle, command, relationship, Evidence, and audit grammar
// instead of recreating page-local or provider-specific ontologies.
export const eosInstrumentObjects = pgTable("eos_instrument_objects", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  instrumentKey: text("instrument_key").notNull(),
  objectType: text("object_type").notNull(),
  objectKey: text("object_key").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  state: text("state").notNull().default("draft"),
  classification: text("classification").notNull().default("confidential"),
  visibility: text("visibility").notNull().default("organization"),
  ownerSeatId: text("owner_seat_id").notNull().references(() => eosSeats.id, { onDelete: "restrict" }),
  parentObjectId: text("parent_object_id").references((): AnyPgColumn => eosInstrumentObjects.id, { onDelete: "restrict" }),
  data: jsonb("data").notNull().default({}),
  sourceReference: jsonb("source_reference").notNull().default({}),
  evidenceIds: jsonb("evidence_ids").notNull().default([]),
  contentSha256: text("content_sha256").notNull(),
  version: integer("version").notNull().default(1),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("eos_instrument_objects_company_key_idx").on(table.companyId, table.instrumentKey, table.objectKey),
  index("eos_instrument_objects_company_state_idx").on(table.companyId, table.instrumentKey, table.state, table.updatedAt),
  index("eos_instrument_objects_parent_idx").on(table.companyId, table.parentObjectId),
  check("eos_instrument_objects_instrument_check", sql`${table.instrumentKey} IN ('docs','files','sheets','slides','tables','forms','calendar','search','canvas','tasks','projects','workflows','crm','messages','conference_rooms','ai','knowledge','memory','analytics','learning','progression','commerce','finance','ads','reputation')`),
  check("eos_instrument_objects_state_check", sql`${table.state} IN ('draft','active','paused','completed','cancelled','archived')`),
  check("eos_instrument_objects_classification_check", sql`${table.classification} IN ('internal','confidential','restricted')`),
  check("eos_instrument_objects_visibility_check", sql`${table.visibility} IN ('seat','team','organization','portfolio')`),
  check("eos_instrument_objects_json_check", sql`jsonb_typeof(${table.data}) = 'object' AND jsonb_typeof(${table.sourceReference}) = 'object' AND jsonb_typeof(${table.evidenceIds}) = 'array'`),
  check("eos_instrument_objects_hash_check", sql`${table.contentSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_instrument_objects_version_check", sql`${table.version} > 0`),
]);

export const eosInstrumentCommands = pgTable("eos_instrument_commands", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  instrumentKey: text("instrument_key").notNull(),
  objectId: text("object_id").references(() => eosInstrumentObjects.id, { onDelete: "restrict" }),
  commandType: text("command_type").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  expectedVersion: integer("expected_version"),
  payload: jsonb("payload").notNull().default({}),
  state: text("state").notNull(),
  result: jsonb("result").notNull().default({}),
  policyDecisionId: text("policy_decision_id").notNull().references(() => eosPolicyDecisions.id, { onDelete: "restrict" }),
  requestedByUserId: text("requested_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("eos_instrument_commands_idempotency_idx").on(table.companyId, table.idempotencyKey),
  index("eos_instrument_commands_object_idx").on(table.companyId, table.objectId, table.createdAt),
  check("eos_instrument_commands_state_check", sql`${table.state} IN ('accepted','completed','rejected')`),
  check("eos_instrument_commands_payload_check", sql`jsonb_typeof(${table.payload}) = 'object' AND jsonb_typeof(${table.result}) = 'object'`),
]);

export const eosInstrumentEvents = pgTable("eos_instrument_events", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  instrumentKey: text("instrument_key").notNull(),
  objectId: text("object_id").notNull().references(() => eosInstrumentObjects.id, { onDelete: "restrict" }),
  commandId: text("command_id").notNull().references(() => eosInstrumentCommands.id, { onDelete: "restrict" }),
  eventType: text("event_type").notNull(),
  fromState: text("from_state"),
  toState: text("to_state").notNull(),
  objectVersion: integer("object_version").notNull(),
  payload: jsonb("payload").notNull().default({}),
  evidenceIds: jsonb("evidence_ids").notNull().default([]),
  contentSha256: text("content_sha256").notNull(),
  recordedByUserId: text("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_instrument_events_command_idx").on(table.commandId),
  index("eos_instrument_events_object_version_idx").on(table.objectId, table.objectVersion),
  check("eos_instrument_events_state_check", sql`${table.toState} IN ('draft','active','paused','completed','cancelled','archived') AND (${table.fromState} IS NULL OR ${table.fromState} IN ('draft','active','paused','completed','cancelled','archived'))`),
  check("eos_instrument_events_json_check", sql`jsonb_typeof(${table.payload}) = 'object' AND jsonb_typeof(${table.evidenceIds}) = 'array'`),
  check("eos_instrument_events_hash_check", sql`${table.contentSha256} ~ '^[0-9a-f]{64}$'`),
  check("eos_instrument_events_version_check", sql`${table.objectVersion} > 0`),
]);

export const eosInstrumentLinks = pgTable("eos_instrument_links", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  sourceObjectId: text("source_object_id").notNull().references(() => eosInstrumentObjects.id, { onDelete: "cascade" }),
  targetObjectId: text("target_object_id").notNull().references(() => eosInstrumentObjects.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("eos_instrument_links_unique_idx").on(table.companyId, table.sourceObjectId, table.targetObjectId, table.relationshipType),
  index("eos_instrument_links_target_idx").on(table.companyId, table.targetObjectId),
  check("eos_instrument_links_distinct_check", sql`${table.sourceObjectId} <> ${table.targetObjectId}`),
  check("eos_instrument_links_metadata_check", sql`jsonb_typeof(${table.metadata}) = 'object'`),
]);
export const eosAlertEmailReceipts = pgTable("eos_alert_email_receipts", {
  id: text("id").primaryKey(),
  event: text("event").notNull(),
  severity: text("severity").notNull(),
  senderUserId: text("sender_user_id").notNull(),
  recipient: text("recipient").notNull(),
  state: text("state").notNull().default("dispatching"),
  providerMessageId: text("provider_message_id"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  settledAt: timestamp("settled_at", { withTimezone: true }),
}, table => [
  index("eos_alert_email_received_idx").on(table.receivedAt),
  check("eos_alert_email_id_check", sql`${table.id} ~ '^[0-9a-f]{64}$'`),
  check("eos_alert_email_state_check", sql`${table.state} IN ('dispatching','delivered','uncertain')`),
  check("eos_alert_email_receipt_check", sql`${table.state} <> 'delivered' OR (${table.providerMessageId} IS NOT NULL AND length(${table.providerMessageId}) > 0)`),
]);

export type InsertConversation = z.infer<typeof insertConversationSchema>;
