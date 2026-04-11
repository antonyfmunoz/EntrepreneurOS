CREATE TABLE IF NOT EXISTS "companies" (
  "id" text PRIMARY KEY,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);