CREATE TABLE IF NOT EXISTS "kpis" (
  "id" text PRIMARY KEY,
  "name" text,
  "description" text,
  "value" text,
  "unit" text,
  "target" text,
  "period" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);