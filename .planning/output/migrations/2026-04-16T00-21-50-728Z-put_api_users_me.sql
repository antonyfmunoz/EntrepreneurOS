CREATE TABLE IF NOT EXISTS "me" (
  "id" text PRIMARY KEY,
  "full_name" text,
  "email" text,
  "avatar_url" text,
  "username" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);