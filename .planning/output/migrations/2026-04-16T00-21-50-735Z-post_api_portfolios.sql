CREATE TABLE IF NOT EXISTS "portfolios" (
  "id" text PRIMARY KEY,
  "name" text,
  "description" text,
  "canvas_position" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);