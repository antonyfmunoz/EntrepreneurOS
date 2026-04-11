CREATE TABLE IF NOT EXISTS "steps" (
  "id" text PRIMARY KEY,
  "order" text,
  "title" text,
  "description" text,
  "step_type" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);