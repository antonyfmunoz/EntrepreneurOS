CREATE TABLE IF NOT EXISTS "conversations" (
  "id" text PRIMARY KEY,
  "message" text,
  "conversation_id" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);