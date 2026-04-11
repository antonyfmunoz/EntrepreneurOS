CREATE TABLE IF NOT EXISTS "steps" (
  "id" text PRIMARY KEY,
  "title" text,
  "description" text,
  "step_type" text,
  "completed_at" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);