CREATE TABLE IF NOT EXISTS "companies" (
  "id" text PRIMARY KEY,
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