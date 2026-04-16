CREATE TABLE IF NOT EXISTS "departments" (
  "id" text PRIMARY KEY,
  "name" text,
  "description" text,
  "parent_department_id" text,
  "order_index" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);