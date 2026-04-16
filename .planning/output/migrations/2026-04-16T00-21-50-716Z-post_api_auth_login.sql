CREATE TABLE IF NOT EXISTS "login" (
  "id" text PRIMARY KEY,
  "email" text,
  "password" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);