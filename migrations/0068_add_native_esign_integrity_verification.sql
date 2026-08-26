CREATE TABLE IF NOT EXISTS eos_esign_integrity_checks (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  envelope_id text NOT NULL REFERENCES eos_esign_envelopes(id) ON DELETE CASCADE,
  requested_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  trigger_type text NOT NULL,
  state text NOT NULL,
  reason text NOT NULL DEFAULT '',
  source_sha256 text NOT NULL DEFAULT '',
  final_sha256 text NOT NULL DEFAULT '',
  audit_sha256 text NOT NULL DEFAULT '',
  event_count integer NOT NULL DEFAULT 0,
  audited_event_count integer NOT NULL DEFAULT 0,
  capture_count integer NOT NULL DEFAULT 0,
  failure_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification_projection jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_check_sha256 text NOT NULL DEFAULT '',
  check_sha256 text NOT NULL,
  checked_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_integrity_check_trigger_check CHECK (trigger_type IN ('completion','operator','scheduled','recovery')),
  CONSTRAINT eos_esign_integrity_check_state_check CHECK (state IN ('passed','failed','unavailable')),
  CONSTRAINT eos_esign_integrity_check_reason_check CHECK (char_length(reason) <= 1000),
  CONSTRAINT eos_esign_integrity_check_hashes_check CHECK (
    (source_sha256 = '' OR source_sha256 ~ '^[0-9a-f]{64}$') AND
    (final_sha256 = '' OR final_sha256 ~ '^[0-9a-f]{64}$') AND
    (audit_sha256 = '' OR audit_sha256 ~ '^[0-9a-f]{64}$') AND
    (previous_check_sha256 = '' OR previous_check_sha256 ~ '^[0-9a-f]{64}$') AND
    check_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT eos_esign_integrity_check_counts_check CHECK (
    event_count >= 0 AND audited_event_count >= 0 AND audited_event_count <= event_count AND capture_count >= 0
  ),
  CONSTRAINT eos_esign_integrity_check_failures_check CHECK (
    jsonb_typeof(failure_codes) = 'array' AND jsonb_array_length(failure_codes) <= 50
  ),
  CONSTRAINT eos_esign_integrity_check_projection_check CHECK (jsonb_typeof(verification_projection) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_integrity_check_hash_idx
  ON eos_esign_integrity_checks(envelope_id, check_sha256);
CREATE INDEX IF NOT EXISTS eos_esign_integrity_check_latest_idx
  ON eos_esign_integrity_checks(company_id, envelope_id, checked_at);
CREATE INDEX IF NOT EXISTS eos_esign_integrity_check_schedule_idx
  ON eos_esign_integrity_checks(state, checked_at);

CREATE OR REPLACE FUNCTION eos_reject_esign_integrity_check_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Native e-sign integrity check history is immutable';
END;
$$;

DROP TRIGGER IF EXISTS eos_esign_integrity_checks_immutable ON eos_esign_integrity_checks;
CREATE TRIGGER eos_esign_integrity_checks_immutable
BEFORE UPDATE OR DELETE ON eos_esign_integrity_checks
FOR EACH ROW EXECUTE FUNCTION eos_reject_esign_integrity_check_mutation();
