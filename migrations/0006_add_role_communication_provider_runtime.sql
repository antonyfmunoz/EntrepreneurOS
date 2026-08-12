CREATE TABLE IF NOT EXISTS "eos_seats" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" integer NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "kind" text NOT NULL,
  "supervisor_seat_id" text,
  "occupant_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "agent_name" text NOT NULL,
  "agent_mode" text NOT NULL DEFAULT 'autonomous',
  "mandate" text NOT NULL DEFAULT '',
  "authority" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "tool_entitlements" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "eos_seats_supervisor_fk" FOREIGN KEY ("supervisor_seat_id") REFERENCES "eos_seats"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "eos_seats_company_kind_idx" ON "eos_seats" ("company_id", "kind", "status");

CREATE TABLE IF NOT EXISTS "eos_memberships" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" integer NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "seat_id" text REFERENCES "eos_seats"("id") ON DELETE SET NULL,
  "role" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "purpose" text NOT NULL DEFAULT 'operate',
  "classification_ceiling" text NOT NULL DEFAULT 'internal',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "eos_memberships_company_user_idx" ON "eos_memberships" ("company_id", "user_id");

CREATE TABLE IF NOT EXISTS "eos_conversations" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" integer NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "seat_id" text REFERENCES "eos_seats"("id") ON DELETE SET NULL,
  "channel_type" text NOT NULL,
  "title" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "eos_conversations_company_seat_channel_idx" ON "eos_conversations" ("company_id", "seat_id", "channel_type");

CREATE TABLE IF NOT EXISTS "eos_communication_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "conversation_id" text NOT NULL REFERENCES "eos_conversations"("id") ON DELETE CASCADE,
  "company_id" integer NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "sender_type" text NOT NULL,
  "sender_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "sender_seat_id" text REFERENCES "eos_seats"("id") ON DELETE SET NULL,
  "content" text NOT NULL,
  "provenance" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "eos_messages_conversation_created_idx" ON "eos_communication_messages" ("conversation_id", "created_at");

ALTER TABLE "eos_work_packets" ADD COLUMN IF NOT EXISTS "accountable_seat_id" text REFERENCES "eos_seats"("id") ON DELETE SET NULL;
ALTER TABLE "eos_work_packets" ADD COLUMN IF NOT EXISTS "visibility" text NOT NULL DEFAULT 'company';
ALTER TABLE "eos_work_packets" ADD COLUMN IF NOT EXISTS "classification" text NOT NULL DEFAULT 'internal';
ALTER TABLE "eos_approval_requests" ADD COLUMN IF NOT EXISTS "assigned_to_seat_id" text REFERENCES "eos_seats"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "eos_provider_executions" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" integer NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "work_packet_id" text NOT NULL REFERENCES "eos_work_packets"("id") ON DELETE CASCADE,
  "approval_id" text REFERENCES "eos_approval_requests"("id") ON DELETE SET NULL,
  "requested_by_user_id" text NOT NULL REFERENCES "users"("id"),
  "provider" text NOT NULL,
  "operation" text NOT NULL,
  "status" text NOT NULL DEFAULT 'awaiting_approval',
  "request" jsonb NOT NULL,
  "receipt" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "reconciliation_status" text NOT NULL DEFAULT 'pending',
  "failure_code" text,
  "trace_id" text NOT NULL,
  "correlation_id" text NOT NULL,
  "executed_at" timestamp,
  "reconciled_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "eos_provider_exec_company_status_idx" ON "eos_provider_executions" ("company_id", "status", "created_at");
