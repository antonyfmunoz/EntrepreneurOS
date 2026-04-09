CREATE TABLE IF NOT EXISTS "security" (
  "id" text PRIMARY KEY,
  "current_password" text,
  "new_password" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);