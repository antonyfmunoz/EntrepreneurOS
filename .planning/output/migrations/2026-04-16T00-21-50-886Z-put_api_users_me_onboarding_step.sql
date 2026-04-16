CREATE TABLE IF NOT EXISTS "onboarding" (
  "id" text PRIMARY KEY,
  "completed" text,
  "skipped" text,
  "data" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);