CREATE TABLE IF NOT EXISTS "roles" (
  "id" text PRIMARY KEY,
  "department_id" text,
  "title" text,
  "parent_role_id" text,
  "responsibilities" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);