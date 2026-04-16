CREATE TABLE IF NOT EXISTS "register" (
  "id" text PRIMARY KEY,
  "username" text,
  "email" text,
  "full_name" text,
  "password" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);