CREATE TABLE "agent_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"user_id" text NOT NULL,
	"action_type" text NOT NULL,
	"action_name" text NOT NULL,
	"description" text,
	"parameters" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"executed_at" timestamp,
	"completed_at" timestamp,
	"failed_at" timestamp,
	"execution_result" jsonb,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"task_id" text,
	"conversation_id" text,
	"estimated_time_saved" integer,
	"priority" text DEFAULT 'medium',
	"tags" text[],
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"messages_sent" integer DEFAULT 0,
	"messages_received" integer DEFAULT 0,
	"tasks_completed" integer DEFAULT 0,
	"actions_executed" integer DEFAULT 0,
	"tokens_used" integer DEFAULT 0,
	"api_cost" text DEFAULT '0',
	"estimated_time_saved_minutes" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"role_level" text DEFAULT 'laborer',
	"department" text DEFAULT 'general',
	"icon" text DEFAULT 'ri-robot-line',
	"instructions" text,
	"brain_content" text,
	"knowledge_base" text,
	"kpis" text,
	"behavioral_style" text,
	"latest_activity" text,
	"is_active" boolean DEFAULT true,
	"simulation_mode" boolean DEFAULT false,
	"parent_agent_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"user_id" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"subject" text NOT NULL,
	"date" timestamp NOT NULL,
	"related_to_type" text NOT NULL,
	"related_to_id" text NOT NULL,
	"completed" boolean DEFAULT false,
	"notes" text,
	"created_by_agent_id" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"company" text,
	"title" text,
	"status" text DEFAULT 'lead',
	"last_contact" timestamp,
	"notes" text,
	"avatar" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_deals" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"stage" text DEFAULT 'discovery',
	"probability" integer DEFAULT 50,
	"expected_close_date" timestamp,
	"contact_id" text,
	"assigned_agent_id" text,
	"notes" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"folder_id" text,
	"tags" text[],
	"user_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'disconnected',
	"details" text,
	"icon" text
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text,
	"task_id" text,
	"conversation_id" text,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" text,
	"referenced_agent_ids" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"type" text NOT NULL,
	"read" boolean DEFAULT false,
	"href" text,
	"related_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_type" text,
	"expires_at" timestamp,
	"scope" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'todo',
	"priority" text DEFAULT 'medium',
	"start_date" text,
	"due_date" text,
	"instructions" text,
	"agent_id" text,
	"assigned_by_id" text,
	"collaborator_ids" text,
	"task_type" text DEFAULT 'standard',
	"parent_task_id" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"avatar" text,
	"company" text,
	"role" text,
	"firebase_uid" text,
	"preferences" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid")
);
--> statement-breakpoint
CREATE TABLE "dm_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"page_name" text NOT NULL,
	"page_slug" text NOT NULL,
	"purpose" text,
	"approved_at" timestamp,
	"token_version_ref" integer,
	"screenshot_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dm_patterns" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"variant" text,
	"props_shape" text,
	"usage_context" text,
	"shadcn_component" text,
	"page_slug_ref" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dm_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"repo_path" text NOT NULL,
	"framework" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "dm_projects_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "dm_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"color_primary" varchar(9),
	"color_secondary" varchar(9),
	"color_background" varchar(9),
	"color_surface" varchar(9),
	"color_text" varchar(9),
	"color_accent" varchar(9),
	"type_font_family" text,
	"type_size_base" numeric,
	"type_scale_ratio" numeric,
	"spacing_unit" numeric,
	"border_radius" numeric,
	"shadow_style" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pipeline_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"project_id" text NOT NULL,
	"page_name" text NOT NULL,
	"page_index" integer NOT NULL,
	"phase" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"output" text,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"phase" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"config" text NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_metrics" ADD CONSTRAINT "agent_metrics_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_metrics" ADD CONSTRAINT "agent_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_assigned_agent_id_agents_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_by_id_agents_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dm_tokens_project_version_idx" ON "dm_tokens" USING btree ("project_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_pages_run_page_phase_idx" ON "pipeline_pages" USING btree ("run_id","page_index","phase");