-- EntrepreneurOS-owned federation records. UMH accesses them only through HTTPS.
ALTER TABLE "agent_actions"
  ADD COLUMN IF NOT EXISTS "company_id" integer REFERENCES "companies"("id") ON DELETE CASCADE;
ALTER TABLE "agents"
  ADD COLUMN IF NOT EXISTS "company_id" integer REFERENCES "companies"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "umh_installations" (
  "id" text PRIMARY KEY NOT NULL,
  "umh_installation_id" text UNIQUE NOT NULL,
  "issuer" text NOT NULL,
  "company_id" integer NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT false,
  "capabilities" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "umh_commands" (
  "id" text PRIMARY KEY NOT NULL,
  "installation_id" text NOT NULL REFERENCES "umh_installations"("id") ON DELETE CASCADE,
  "command_type" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "nonce" text NOT NULL,
  "request_hash" text NOT NULL,
  "trace_id" text NOT NULL,
  "correlation_id" text NOT NULL,
  "actor_user_id" text NOT NULL REFERENCES "users"("id"),
  "company_id" integer NOT NULL REFERENCES "companies"("id"),
  "status" text NOT NULL,
  "outcome" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "completed_at" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "umh_commands_installation_idempotency_idx"
  ON "umh_commands" ("installation_id", "idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "umh_commands_installation_nonce_idx"
  ON "umh_commands" ("installation_id", "nonce");

CREATE TABLE IF NOT EXISTS "umh_event_outbox" (
  "id" text PRIMARY KEY NOT NULL,
  "installation_id" text NOT NULL REFERENCES "umh_installations"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "next_attempt_at" timestamp DEFAULT now(),
  "leased_at" timestamp,
  "delivered_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "umh_audit_records" (
  "id" text PRIMARY KEY NOT NULL,
  "installation_id" text NOT NULL REFERENCES "umh_installations"("id") ON DELETE CASCADE,
  "command_id" text REFERENCES "umh_commands"("id") ON DELETE SET NULL,
  "event_type" text NOT NULL,
  "trace_id" text NOT NULL,
  "correlation_id" text NOT NULL,
  "actor_user_id" text REFERENCES "users"("id"),
  "details" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now()
);
