CREATE TABLE IF NOT EXISTS "eos_manifest_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" integer NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "manifest" jsonb NOT NULL,
  "created_by_user_id" text NOT NULL REFERENCES "users"("id"),
  "approved_by_user_id" text REFERENCES "users"("id"),
  "activated_at" timestamp,
  "created_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "eos_manifest_company_version_idx"
  ON "eos_manifest_versions" ("company_id", "version");
CREATE INDEX IF NOT EXISTS "eos_manifest_company_status_idx"
  ON "eos_manifest_versions" ("company_id", "status");

CREATE TABLE IF NOT EXISTS "eos_work_packets" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" integer NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "created_by_user_id" text NOT NULL REFERENCES "users"("id"),
  "accountable_user_id" text NOT NULL REFERENCES "users"("id"),
  "title" text NOT NULL,
  "objective" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "priority" text NOT NULL DEFAULT 'medium',
  "source" text NOT NULL DEFAULT 'manual',
  "requires_approval" boolean NOT NULL DEFAULT false,
  "tool_pack" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "evidence_requirements" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "trace_id" text NOT NULL,
  "correlation_id" text NOT NULL,
  "due_at" timestamp,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "eos_work_packets_company_status_idx"
  ON "eos_work_packets" ("company_id", "status", "created_at");

CREATE TABLE IF NOT EXISTS "eos_approval_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" integer NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "work_packet_id" text NOT NULL REFERENCES "eos_work_packets"("id") ON DELETE CASCADE,
  "requested_by_user_id" text NOT NULL REFERENCES "users"("id"),
  "assigned_to_user_id" text NOT NULL REFERENCES "users"("id"),
  "summary" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "decision_reason" text,
  "decided_by_user_id" text REFERENCES "users"("id"),
  "decided_at" timestamp,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "eos_approvals_company_status_idx"
  ON "eos_approval_requests" ("company_id", "status", "created_at");

CREATE TABLE IF NOT EXISTS "eos_evidence" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" integer NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "work_packet_id" text NOT NULL REFERENCES "eos_work_packets"("id") ON DELETE CASCADE,
  "recorded_by_user_id" text NOT NULL REFERENCES "users"("id"),
  "evidence_type" text NOT NULL,
  "title" text NOT NULL,
  "uri" text,
  "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "eos_evidence_work_packet_idx"
  ON "eos_evidence" ("company_id", "work_packet_id", "created_at");

CREATE TABLE IF NOT EXISTS "eos_audit_records" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" integer NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "actor_user_id" text NOT NULL REFERENCES "users"("id"),
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "trace_id" text NOT NULL,
  "correlation_id" text NOT NULL,
  "result" text NOT NULL,
  "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "eos_audit_company_created_idx"
  ON "eos_audit_records" ("company_id", "created_at");
