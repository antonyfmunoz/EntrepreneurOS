CREATE TABLE IF NOT EXISTS "preferences" (
  "id" text PRIMARY KEY,
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