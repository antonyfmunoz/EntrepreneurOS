CREATE TABLE IF NOT EXISTS eos_provider_ingress_registrations (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_binding_id text NOT NULL REFERENCES eos_integration_bindings(id) ON DELETE RESTRICT,
  control_work_packet_id text NOT NULL REFERENCES eos_work_packets(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  authentication_mode text NOT NULL,
  state text NOT NULL DEFAULT 'pending_verification',
  authorization_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider_account_reference text NOT NULL,
  provider_subscription_reference text NOT NULL DEFAULT '',
  topic_name text NOT NULL DEFAULT '',
  audience text NOT NULL DEFAULT '',
  service_account_email text NOT NULL DEFAULT '',
  verification_token_ciphertext text,
  verification_token_fingerprint text,
  watch_history_id text NOT NULL DEFAULT '',
  watch_expires_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  last_event_id text REFERENCES eos_integration_operation_events(id) ON DELETE RESTRICT,
  last_inbound_event_at timestamptz,
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_provider_ingress_provider_check CHECK (provider IN ('notion','gmail')),
  CONSTRAINT eos_provider_ingress_auth_check CHECK ((provider = 'notion' AND authentication_mode = 'notion_hmac_sha256') OR (provider = 'gmail' AND authentication_mode = 'google_pubsub_oidc')),
  CONSTRAINT eos_provider_ingress_state_check CHECK (state IN ('pending_verification','active','expired','failed','revoked')),
  CONSTRAINT eos_provider_ingress_version_check CHECK (version > 0),
  CONSTRAINT eos_provider_ingress_token_check CHECK ((verification_token_ciphertext IS NULL AND verification_token_fingerprint IS NULL) OR (verification_token_ciphertext LIKE 'enc:v1:%' AND verification_token_fingerprint ~ '^[0-9a-f]{64}$')),
  CONSTRAINT eos_provider_ingress_provider_config_check CHECK ((provider = 'notion' AND topic_name = '' AND audience = '' AND service_account_email = '') OR (provider = 'gmail' AND length(topic_name) >= 10 AND length(audience) >= 8 AND service_account_email LIKE '%@%.%'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_provider_ingress_binding_provider_idx ON eos_provider_ingress_registrations(integration_binding_id, provider);
CREATE INDEX IF NOT EXISTS eos_provider_ingress_company_state_idx ON eos_provider_ingress_registrations(company_id, state, updated_at);
CREATE INDEX IF NOT EXISTS eos_provider_ingress_watch_expiry_idx ON eos_provider_ingress_registrations(provider, state, watch_expires_at);

CREATE TABLE IF NOT EXISTS eos_provider_ingress_events (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  registration_id text NOT NULL REFERENCES eos_provider_ingress_registrations(id) ON DELETE RESTRICT,
  integration_binding_id text NOT NULL REFERENCES eos_integration_bindings(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  provider_object_reference text NOT NULL,
  verification_method text NOT NULL,
  processing_state text NOT NULL,
  payload_projection jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_sha256 text NOT NULL,
  event_sha256 text NOT NULL,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_provider_ingress_event_provider_check CHECK (provider IN ('notion','gmail')),
  CONSTRAINT eos_provider_ingress_event_verification_check CHECK (verification_method IN ('notion_hmac_sha256','google_pubsub_oidc')),
  CONSTRAINT eos_provider_ingress_event_state_check CHECK (processing_state IN ('observed','reconciliation_required')),
  CONSTRAINT eos_provider_ingress_event_hash_check CHECK (payload_sha256 ~ '^[0-9a-f]{64}$' AND event_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_provider_ingress_event_projection_check CHECK (jsonb_typeof(payload_projection) = 'object')
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_provider_ingress_event_dedupe_idx ON eos_provider_ingress_events(registration_id, provider_event_id);
CREATE UNIQUE INDEX IF NOT EXISTS eos_provider_ingress_event_hash_idx ON eos_provider_ingress_events(event_sha256);
CREATE INDEX IF NOT EXISTS eos_provider_ingress_event_binding_state_idx ON eos_provider_ingress_events(integration_binding_id, processing_state, received_at);

CREATE OR REPLACE FUNCTION eos_reject_provider_ingress_registration_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'EOS provider ingress registrations cannot be deleted; revoke the registration instead'; END $$;
DROP TRIGGER IF EXISTS eos_provider_ingress_registration_delete_guard ON eos_provider_ingress_registrations;
CREATE TRIGGER eos_provider_ingress_registration_delete_guard BEFORE DELETE ON eos_provider_ingress_registrations FOR EACH ROW EXECUTE FUNCTION eos_reject_provider_ingress_registration_delete();

CREATE OR REPLACE FUNCTION eos_reject_provider_ingress_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'EOS provider ingress events are append-only'; END $$;
DROP TRIGGER IF EXISTS eos_provider_ingress_event_guard ON eos_provider_ingress_events;
CREATE TRIGGER eos_provider_ingress_event_guard BEFORE UPDATE OR DELETE ON eos_provider_ingress_events FOR EACH ROW EXECUTE FUNCTION eos_reject_provider_ingress_event_mutation();

ALTER TABLE eos_integration_operation_events DROP CONSTRAINT IF EXISTS eos_integration_operation_event_type_check;
ALTER TABLE eos_integration_operation_events ADD CONSTRAINT eos_integration_operation_event_type_check CHECK (event_type IN ('manifest_frozen','run_planned','dispatch_claimed','dispatch_recovery_escalated','webhook_endpoint_configured','webhook_secret_rotated','webhook_endpoint_state_changed','provider_ingress_configured','provider_ingress_state_changed','provider_ingress_watch_started','receipt_recorded','retry_authorized','incident_opened','incident_acknowledged','incident_resolved','fallback_changed','qualification_recorded','cutover_decided'));
ALTER TABLE eos_integration_operation_events DROP CONSTRAINT IF EXISTS eos_integration_operation_event_subject_check;
ALTER TABLE eos_integration_operation_events ADD CONSTRAINT eos_integration_operation_event_subject_check CHECK (subject_type IN ('manifest','run','incident','operational_state','qualification','cutover','webhook_endpoint','provider_ingress'));
