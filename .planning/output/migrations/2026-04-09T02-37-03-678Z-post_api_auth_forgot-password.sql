CREATE TABLE IF NOT EXISTS "forgotPassword" (
  "id" text PRIMARY KEY,
  "email" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);