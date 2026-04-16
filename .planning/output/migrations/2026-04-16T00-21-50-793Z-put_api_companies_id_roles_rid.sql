CREATE TABLE IF NOT EXISTS "roles" (
  "id" text PRIMARY KEY,
  "title" text,
  "department_id" text,
  "description" text,
  "responsibilities" text,
  "parent_role_id" text,
  "assigned_user_id" text,
  "agent_slot" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);