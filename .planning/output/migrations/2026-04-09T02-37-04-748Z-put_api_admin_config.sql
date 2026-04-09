CREATE TABLE IF NOT EXISTS "config" (
  "id" text PRIMARY KEY,
  "config_key" text,
  "config_value" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);