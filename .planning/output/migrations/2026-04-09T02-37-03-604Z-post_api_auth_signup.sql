CREATE TABLE IF NOT EXISTS "signup" (
  "id" text PRIMARY KEY,
  "email" text,
  "password" text,
  "name" text,
  "terms_accepted" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);