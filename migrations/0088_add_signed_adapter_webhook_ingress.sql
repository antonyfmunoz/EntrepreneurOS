CREATE TABLE IF NOT EXISTS eos_integration_webhook_endpoints (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_binding_id text NOT NULL REFERENCES eos_integration_bindings(id) ON DELETE RESTRICT,
  control_work_packet_id text NOT NULL REFERENCES eos_work_packets(id) ON DELETE RESTRICT,
  accepted_event_types jsonb NOT NULL,
  state text NOT NULL DEFAULT 'active',
  secret_ciphertext text NOT NULL,
  previous_secret_ciphertext text,
  previous_secret_expires_at timestamptz,
  secret_fingerprint text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  last_event_id text REFERENCES eos_integration_operation_events(id) ON DELETE RESTRICT,
  last_inbound_event_at timestamptz,
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rotated_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_integration_webhook_state_check CHECK (state IN ('active','revoked')),
  CONSTRAINT eos_integration_webhook_fingerprint_check CHECK (secret_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_integration_webhook_version_check CHECK (version > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_integration_webhook_binding_idx ON eos_integration_webhook_endpoints(integration_binding_id);
CREATE INDEX IF NOT EXISTS eos_integration_webhook_company_state_idx ON eos_integration_webhook_endpoints(company_id, state);

CREATE TABLE IF NOT EXISTS eos_integration_webhook_events (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  endpoint_id text NOT NULL REFERENCES eos_integration_webhook_endpoints(id) ON DELETE RESTRICT,
  integration_binding_id text NOT NULL REFERENCES eos_integration_bindings(id) ON DELETE RESTRICT,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  operation text,
  outcome text NOT NULL,
  external_reference text NOT NULL,
  summary text NOT NULL,
  payload_projection jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_sha256 text NOT NULL,
  signature_version text NOT NULL,
  verification_key_version text NOT NULL,
  processing_state text NOT NULL DEFAULT 'unmatched',
  matched_run_id text REFERENCES eos_integration_runs(id) ON DELETE RESTRICT,
  receipt_id text REFERENCES eos_integration_run_receipts(id) ON DELETE RESTRICT,
  event_sha256 text NOT NULL,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_integration_webhook_event_outcome_check CHECK (outcome IN ('succeeded','failed','uncertain','informational')),
  CONSTRAINT eos_integration_webhook_event_processing_check CHECK (processing_state IN ('unmatched','reconciled')),
  CONSTRAINT eos_integration_webhook_event_key_version_check CHECK (verification_key_version IN ('current','previous')),
  CONSTRAINT eos_integration_webhook_event_hash_check CHECK (payload_sha256 ~ '^[0-9a-f]{64}$' AND event_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_integration_webhook_provider_event_idx ON eos_integration_webhook_events(endpoint_id, provider_event_id);
CREATE UNIQUE INDEX IF NOT EXISTS eos_integration_webhook_event_hash_idx ON eos_integration_webhook_events(event_sha256);
CREATE INDEX IF NOT EXISTS eos_integration_webhook_event_binding_state_idx ON eos_integration_webhook_events(integration_binding_id, processing_state, received_at);

ALTER TABLE eos_integration_operation_events DROP CONSTRAINT IF EXISTS eos_integration_operation_event_type_check;
ALTER TABLE eos_integration_operation_events ADD CONSTRAINT eos_integration_operation_event_type_check CHECK (event_type IN ('manifest_frozen','run_planned','dispatch_claimed','dispatch_recovery_escalated','webhook_endpoint_configured','webhook_secret_rotated','webhook_endpoint_state_changed','receipt_recorded','retry_authorized','incident_opened','incident_acknowledged','incident_resolved','fallback_changed','qualification_recorded','cutover_decided'));
ALTER TABLE eos_integration_operation_events DROP CONSTRAINT IF EXISTS eos_integration_operation_event_subject_check;
ALTER TABLE eos_integration_operation_events ADD CONSTRAINT eos_integration_operation_event_subject_check CHECK (subject_type IN ('manifest','run','incident','operational_state','qualification','cutover','webhook_endpoint'));

CREATE OR REPLACE FUNCTION eos_guard_integration_webhook_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'EOS integration webhook events are append-only'; END IF;
  IF NEW.company_id <> OLD.company_id OR NEW.endpoint_id <> OLD.endpoint_id OR NEW.integration_binding_id <> OLD.integration_binding_id OR NEW.provider_event_id <> OLD.provider_event_id OR NEW.event_type <> OLD.event_type OR NEW.outcome <> OLD.outcome OR NEW.payload_sha256 <> OLD.payload_sha256 OR NEW.event_sha256 <> OLD.event_sha256 OR NEW.received_at <> OLD.received_at THEN RAISE EXCEPTION 'EOS integration webhook event custody fields are immutable'; END IF;
  IF OLD.processing_state <> 'unmatched' OR NEW.processing_state <> 'reconciled' OR OLD.matched_run_id IS NOT NULL OR OLD.receipt_id IS NOT NULL OR NEW.matched_run_id IS NULL OR NEW.receipt_id IS NULL THEN RAISE EXCEPTION 'EOS integration webhook event transition is invalid'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS eos_integration_webhook_event_guard ON eos_integration_webhook_events;
CREATE TRIGGER eos_integration_webhook_event_guard BEFORE UPDATE OR DELETE ON eos_integration_webhook_events FOR EACH ROW EXECUTE FUNCTION eos_guard_integration_webhook_event_mutation();

CREATE OR REPLACE FUNCTION eos_reject_integration_webhook_endpoint_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'EOS integration webhook endpoints cannot be deleted; revoke the endpoint instead';
END $$;

DROP TRIGGER IF EXISTS eos_integration_webhook_endpoint_delete_guard ON eos_integration_webhook_endpoints;
CREATE TRIGGER eos_integration_webhook_endpoint_delete_guard BEFORE DELETE ON eos_integration_webhook_endpoints FOR EACH ROW EXECUTE FUNCTION eos_reject_integration_webhook_endpoint_delete();
