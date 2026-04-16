CREATE TABLE IF NOT EXISTS "activity_logs" (
  "id" text PRIMARY KEY,
  "actor_type" text,
  "actor_id" text,
  "action" text,
  "entity_type" text,
  "entity_id" text,
  "delta" text,
  "metadata" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "capability_manifests" (
  "id" text PRIMARY KEY,
  "action_type" text,
  "enabled" text,
  "ai_allowed" text,
  "config" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "companies" (
  "id" text PRIMARY KEY,
  "owner_id" text,
  "portfolio_id" text,
  "name" text,
  "stage" text,
  "industry" text,
  "business_model" text,
  "strategic_goals" text,
  "metadata" text,
  "config" text,
  "canvas_position" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" text PRIMARY KEY,
  "user_id" text,
  "title" text,
  "context_snapshot" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "departments" (
  "id" text PRIMARY KEY,
  "name" text,
  "description" text,
  "parent_department_id" text,
  "order_index" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "kpis" (
  "id" text PRIMARY KEY,
  "name" text,
  "description" text,
  "value" text,
  "unit" text,
  "target" text,
  "period" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" text PRIMARY KEY,
  "conversation_id" text,
  "role" text,
  "content" text,
  "metadata" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY,
  "user_id" text,
  "type" text,
  "title" text,
  "message" text,
  "link" text,
  "read" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "onboarding_progress" (
  "id" text PRIMARY KEY,
  "user_id" text,
  "step" text,
  "completed" text,
  "skipped" text,
  "data" text,
  "completed_at" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "portfolios" (
  "id" text PRIMARY KEY,
  "owner_id" text,
  "name" text,
  "description" text,
  "canvas_position" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "roles" (
  "id" text PRIMARY KEY,
  "department_id" text,
  "title" text,
  "description" text,
  "responsibilities" text,
  "parent_role_id" text,
  "assigned_user_id" text,
  "agent_slot" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "tasks" (
  "id" text PRIMARY KEY,
  "title" text,
  "description" text,
  "status" text,
  "priority" text,
  "assignments" text,
  "assignee_id" text,
  "created_by" text,
  "due_date" text,
  "completed_at" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_preferences" (
  "id" text PRIMARY KEY,
  "user_id" text,
  "email_notifications" text,
  "push_notifications" text,
  "task_alerts" text,
  "workflow_alerts" text,
  "autonomy_level" text,
  "theme" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY,
  "clerk_id" text,
  "username" text,
  "email" text,
  "full_name" text,
  "avatar_url" text,
  "default_company_id" text,
  "onboarding_completed" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "workflow_steps" (
  "id" text PRIMARY KEY,
  "workflow_id" text,
  "order_index" text,
  "title" text,
  "description" text,
  "step_type" text,
  "assignee_type" text,
  "assignee_id" text,
  "config" text,
  "completed_at" text,
  "completed_by" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "workflows" (
  "id" text PRIMARY KEY,
  "name" text,
  "description" text,
  "status" text,
  "current_step_index" text,
  "started_at" text,
  "completed_at" text,
  "created_by" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);