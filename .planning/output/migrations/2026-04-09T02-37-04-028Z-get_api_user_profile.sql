CREATE TABLE IF NOT EXISTS "profile" (
  "id" text PRIMARY KEY,
  "name" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);