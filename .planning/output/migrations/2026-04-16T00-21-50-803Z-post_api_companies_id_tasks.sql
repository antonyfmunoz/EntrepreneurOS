CREATE TABLE IF NOT EXISTS "tasks" (
  "id" text PRIMARY KEY,
  "title" text,
  "description" text,
  "status" text,
  "priority" text,
  "assignee_id" text,
  "assignments" text,
  "due_date" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);