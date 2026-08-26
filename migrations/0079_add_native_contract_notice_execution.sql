-- Exact, approval-bound contract notice execution. A prepared attempt is
-- persisted before Gmail is called; terminal attempt evidence is immutable.

CREATE TABLE IF NOT EXISTS eos_esign_contract_notices (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES eos_esign_contract_plans(id) ON DELETE RESTRICT,
  envelope_id text NOT NULL REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT,
  notice_type text NOT NULL,
  recipient_name text NOT NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body_text text NOT NULL,
  due_at timestamptz NOT NULL,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  classification text NOT NULL DEFAULT 'confidential',
  content_sha256 text NOT NULL,
  state text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  approval_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  approval_note text NOT NULL DEFAULT '',
  approval_policy_decision_id text REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT,
  approval_sha256 text NOT NULL DEFAULT '',
  approved_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  delivery_attempt_count integer NOT NULL DEFAULT 0,
  last_delivery_attempt_id text,
  provider_message_reference text NOT NULL DEFAULT '',
  delivered_at timestamptz,
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_contract_notice_type_check CHECK (notice_type IN ('renewal_offer','nonrenewal','termination','cure','other')),
  CONSTRAINT eos_esign_contract_notice_state_check CHECK (state IN ('draft','approved','sending','delivered','failed','uncertain','cancelled')),
  CONSTRAINT eos_esign_contract_notice_classification_check CHECK (classification IN ('internal','confidential','restricted')),
  CONSTRAINT eos_esign_contract_notice_content_hash_check CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_esign_contract_notice_approval_hash_check CHECK (approval_sha256 = '' OR approval_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_esign_contract_notice_approval_evidence_check CHECK (jsonb_typeof(approval_evidence_ids) = 'array'),
  CONSTRAINT eos_esign_contract_notice_version_check CHECK (version > 0 AND delivery_attempt_count >= 0)
);

CREATE INDEX IF NOT EXISTS eos_esign_contract_notice_plan_idx ON eos_esign_contract_notices(company_id, plan_id, due_at);
CREATE INDEX IF NOT EXISTS eos_esign_contract_notice_queue_idx ON eos_esign_contract_notices(company_id, state, due_at);

CREATE TABLE IF NOT EXISTS eos_esign_contract_notice_attempts (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  notice_id text NOT NULL REFERENCES eos_esign_contract_notices(id) ON DELETE RESTRICT,
  plan_id text NOT NULL REFERENCES eos_esign_contract_plans(id) ON DELETE RESTRICT,
  envelope_id text NOT NULL REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL,
  channel text NOT NULL DEFAULT 'gmail',
  state text NOT NULL DEFAULT 'prepared',
  content_sha256 text NOT NULL,
  approval_sha256 text NOT NULL,
  recipient_email text NOT NULL,
  requested_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  policy_decision_id text NOT NULL REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT,
  provider_message_reference text NOT NULL DEFAULT '',
  failure_code text NOT NULL DEFAULT '',
  failure_message text NOT NULL DEFAULT '',
  reconciliation_note text NOT NULL DEFAULT '',
  reconciliation_policy_decision_id text REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT,
  reconciled_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  reconciled_at timestamptz,
  prepared_at timestamptz NOT NULL,
  completed_at timestamptz,
  CONSTRAINT eos_esign_contract_notice_attempt_state_check CHECK (state IN ('prepared','delivered','failed','uncertain')),
  CONSTRAINT eos_esign_contract_notice_attempt_channel_check CHECK (channel = 'gmail'),
  CONSTRAINT eos_esign_contract_notice_attempt_hash_check CHECK (content_sha256 ~ '^[0-9a-f]{64}$' AND approval_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_esign_contract_notice_attempt_number_check CHECK (attempt_number > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_contract_notice_attempt_number_idx ON eos_esign_contract_notice_attempts(notice_id, attempt_number);
CREATE INDEX IF NOT EXISTS eos_esign_contract_notice_attempt_state_idx ON eos_esign_contract_notice_attempts(company_id, state, prepared_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'eos_esign_contract_notices_last_delivery_attempt_fk'
  ) THEN
    ALTER TABLE eos_esign_contract_notices
      ADD CONSTRAINT eos_esign_contract_notices_last_delivery_attempt_fk
      FOREIGN KEY (last_delivery_attempt_id) REFERENCES eos_esign_contract_notice_attempts(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION eos_protect_native_contract_notice_content()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state <> 'draft' AND (
    NEW.notice_type IS DISTINCT FROM OLD.notice_type OR NEW.recipient_name IS DISTINCT FROM OLD.recipient_name OR
    NEW.recipient_email IS DISTINCT FROM OLD.recipient_email OR NEW.subject IS DISTINCT FROM OLD.subject OR
    NEW.body_text IS DISTINCT FROM OLD.body_text OR NEW.due_at IS DISTINCT FROM OLD.due_at OR
    NEW.owner_seat_id IS DISTINCT FROM OLD.owner_seat_id OR NEW.classification IS DISTINCT FROM OLD.classification OR
    NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256 OR NEW.approval_sha256 IS DISTINCT FROM OLD.approval_sha256 OR
    NEW.approved_by_user_id IS DISTINCT FROM OLD.approved_by_user_id OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
  ) THEN RAISE EXCEPTION 'EOS approved contract notice content is immutable'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS eos_esign_contract_notice_content_immutable ON eos_esign_contract_notices;
CREATE TRIGGER eos_esign_contract_notice_content_immutable BEFORE UPDATE ON eos_esign_contract_notices
  FOR EACH ROW EXECUTE FUNCTION eos_protect_native_contract_notice_content();

CREATE OR REPLACE FUNCTION eos_protect_native_contract_notice_attempts()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.state <> 'prepared' THEN RAISE EXCEPTION 'EOS contract notice delivery attempts are immutable'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS eos_esign_contract_notice_attempts_immutable ON eos_esign_contract_notice_attempts;
CREATE TRIGGER eos_esign_contract_notice_attempts_immutable BEFORE UPDATE OR DELETE ON eos_esign_contract_notice_attempts
  FOR EACH ROW EXECUTE FUNCTION eos_protect_native_contract_notice_attempts();

ALTER TABLE eos_esign_events DROP CONSTRAINT IF EXISTS eos_esign_events_event_type_check;
ALTER TABLE eos_esign_events ADD CONSTRAINT eos_esign_events_event_type_check CHECK (event_type IN (
  'document_registered','document_generated','document_revision_registered','document_comparison_recorded','document_semantic_comparison_recorded',
  'comparison_reviewed','comparison_acknowledged','envelope_created','envelope_revised','envelope_issued','envelope_completed','envelope_voided','envelope_expired',
  'envelope_cloned','envelope_renewed','envelope_replacement_created','envelope_replaced','recipient_sent','recipient_opened','recipient_corrected','recipient_declined',
  'identity_otp_requested','identity_verified','consent_recorded','signature_recorded','delivery_prepared','delivery_succeeded','delivery_failed',
  'completion_delivery_prepared','completion_delivery_succeeded','completion_delivery_failed','evidence_promoted','obligation_promoted','obligation_reviewed',
  'contract_plan_recorded','contract_renewal_decided','contract_notice_created','contract_notice_approved','contract_notice_delivery_prepared',
  'contract_notice_delivery_succeeded','contract_notice_delivery_failed','contract_notice_delivery_reconciled','negotiation_opened','negotiation_entry_recorded','negotiation_resolved',
  'reminder_scheduled','reminder_schedule_changed','batch_completed','recovery_required','recovery_attempt_failed'
));
