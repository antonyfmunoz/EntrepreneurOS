CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY,
  "email_notifications" text,
  "push_notifications" text,
  "notification_types" text,
  "company_id" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);