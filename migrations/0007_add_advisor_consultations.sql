CREATE TABLE IF NOT EXISTS "eos_advisor_consultations" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" integer NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "conversation_id" text NOT NULL REFERENCES "eos_conversations"("id") ON DELETE CASCADE,
  "advisor_id" text NOT NULL,
  "advisor_name" text NOT NULL,
  "request" text NOT NULL,
  "response" text NOT NULL,
  "model" text,
  "status" text NOT NULL,
  "provenance" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "eos_advisor_consultations_company_created_idx" ON "eos_advisor_consultations" ("company_id", "created_at");
