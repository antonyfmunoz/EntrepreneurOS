CREATE TABLE IF NOT EXISTS "profile" (
  "id" text PRIMARY KEY,
  "name" text,
  "email" text,
  "avatar_url" text,
  "bio" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);