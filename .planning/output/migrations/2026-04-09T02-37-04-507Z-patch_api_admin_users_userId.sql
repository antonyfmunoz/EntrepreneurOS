CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY,
  "role" text,
  "status" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);