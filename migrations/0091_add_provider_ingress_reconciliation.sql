CREATE TABLE IF NOT EXISTS eos_provider_ingress_reconciliation_attempts (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  registration_id text NOT NULL REFERENCES eos_provider_ingress_registrations(id) ON DELETE RESTRICT,
  event_id text NOT NULL REFERENCES eos_provider_ingress_events(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL,
  trigger text NOT NULL,
  outcome text NOT NULL,
  external_reference text NOT NULL DEFAULT '',
  summary text NOT NULL,
  result_projection jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_sha256 text NOT NULL,
  failure_code text NOT NULL DEFAULT '',
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_attempt_at timestamptz,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_provider_ingress_reconcile_attempt_check CHECK (attempt_number > 0),
  CONSTRAINT eos_provider_ingress_reconcile_trigger_check CHECK (trigger IN ('worker','operator_replay')),
  CONSTRAINT eos_provider_ingress_reconcile_outcome_check CHECK (outcome IN ('succeeded','retry_scheduled','dead_letter')),
  CONSTRAINT eos_provider_ingress_reconcile_hash_check CHECK (result_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_provider_ingress_reconcile_projection_check CHECK (jsonb_typeof(result_projection) = 'object'),
  CONSTRAINT eos_provider_ingress_reconcile_retry_check CHECK ((outcome = 'retry_scheduled' AND next_attempt_at IS NOT NULL AND failure_code <> '') OR (outcome <> 'retry_scheduled' AND next_attempt_at IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_provider_ingress_reconcile_attempt_idx ON eos_provider_ingress_reconciliation_attempts(event_id, attempt_number);
CREATE INDEX IF NOT EXISTS eos_provider_ingress_reconcile_queue_idx ON eos_provider_ingress_reconciliation_attempts(outcome, next_attempt_at);
CREATE INDEX IF NOT EXISTS eos_provider_ingress_reconcile_registration_idx ON eos_provider_ingress_reconciliation_attempts(registration_id, recorded_at);
ALTER TABLE eos_provider_ingress_reconciliation_attempts DROP CONSTRAINT IF EXISTS eos_provider_ingress_reconcile_projection_check;
ALTER TABLE eos_provider_ingress_reconciliation_attempts ADD CONSTRAINT eos_provider_ingress_reconcile_projection_check CHECK (jsonb_typeof(result_projection) = 'object');
ALTER TABLE eos_provider_ingress_reconciliation_attempts DROP CONSTRAINT IF EXISTS eos_provider_ingress_reconcile_retry_check;
ALTER TABLE eos_provider_ingress_reconciliation_attempts ADD CONSTRAINT eos_provider_ingress_reconcile_retry_check CHECK ((outcome = 'retry_scheduled' AND next_attempt_at IS NOT NULL AND failure_code <> '') OR (outcome <> 'retry_scheduled' AND next_attempt_at IS NULL));

CREATE TABLE IF NOT EXISTS eos_provider_ingress_watch_attempts (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  registration_id text NOT NULL REFERENCES eos_provider_ingress_registrations(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL,
  trigger text NOT NULL,
  outcome text NOT NULL,
  history_id text NOT NULL DEFAULT '',
  expires_at timestamptz,
  summary text NOT NULL,
  failure_code text NOT NULL DEFAULT '',
  next_attempt_at timestamptz,
  receipt_sha256 text NOT NULL,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_provider_ingress_watch_attempt_check CHECK (attempt_number > 0),
  CONSTRAINT eos_provider_ingress_watch_trigger_check CHECK (trigger IN ('manual','worker')),
  CONSTRAINT eos_provider_ingress_watch_outcome_check CHECK (outcome IN ('succeeded','retry_scheduled','dead_letter')),
  CONSTRAINT eos_provider_ingress_watch_hash_check CHECK (receipt_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_provider_ingress_watch_retry_check CHECK ((outcome = 'retry_scheduled' AND next_attempt_at IS NOT NULL AND failure_code <> '') OR (outcome <> 'retry_scheduled' AND next_attempt_at IS NULL)),
  CONSTRAINT eos_provider_ingress_watch_success_check CHECK (outcome <> 'succeeded' OR (history_id <> '' AND expires_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_provider_ingress_watch_attempt_idx ON eos_provider_ingress_watch_attempts(registration_id, attempt_number);
CREATE INDEX IF NOT EXISTS eos_provider_ingress_watch_queue_idx ON eos_provider_ingress_watch_attempts(outcome, next_attempt_at);
ALTER TABLE eos_provider_ingress_watch_attempts DROP CONSTRAINT IF EXISTS eos_provider_ingress_watch_retry_check;
ALTER TABLE eos_provider_ingress_watch_attempts ADD CONSTRAINT eos_provider_ingress_watch_retry_check CHECK ((outcome = 'retry_scheduled' AND next_attempt_at IS NOT NULL AND failure_code <> '') OR (outcome <> 'retry_scheduled' AND next_attempt_at IS NULL));
ALTER TABLE eos_provider_ingress_watch_attempts DROP CONSTRAINT IF EXISTS eos_provider_ingress_watch_success_check;
ALTER TABLE eos_provider_ingress_watch_attempts ADD CONSTRAINT eos_provider_ingress_watch_success_check CHECK (outcome <> 'succeeded' OR (history_id <> '' AND expires_at IS NOT NULL));

CREATE OR REPLACE FUNCTION eos_reject_provider_ingress_attempt_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'EOS provider ingress attempts are append-only'; END $$;
DROP TRIGGER IF EXISTS eos_provider_ingress_reconcile_attempt_guard ON eos_provider_ingress_reconciliation_attempts;
CREATE TRIGGER eos_provider_ingress_reconcile_attempt_guard BEFORE UPDATE OR DELETE ON eos_provider_ingress_reconciliation_attempts FOR EACH ROW EXECUTE FUNCTION eos_reject_provider_ingress_attempt_mutation();
DROP TRIGGER IF EXISTS eos_provider_ingress_watch_attempt_guard ON eos_provider_ingress_watch_attempts;
CREATE TRIGGER eos_provider_ingress_watch_attempt_guard BEFORE UPDATE OR DELETE ON eos_provider_ingress_watch_attempts FOR EACH ROW EXECUTE FUNCTION eos_reject_provider_ingress_attempt_mutation();
