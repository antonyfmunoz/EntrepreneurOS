CREATE TABLE IF NOT EXISTS "capabilities" (
  "id" text PRIMARY KEY,
  "enabled" text,
  "ai_allowed" text,
  "config" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);