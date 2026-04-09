CREATE TABLE IF NOT EXISTS "resetPassword" (
  "id" text PRIMARY KEY,
  "token" text,
  "new_password" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);