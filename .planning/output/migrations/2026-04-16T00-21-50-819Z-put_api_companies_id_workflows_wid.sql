CREATE TABLE IF NOT EXISTS "workflows" (
  "id" text PRIMARY KEY,
  "name" text,
  "description" text,
  "status" text,
  "current_step_index" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);