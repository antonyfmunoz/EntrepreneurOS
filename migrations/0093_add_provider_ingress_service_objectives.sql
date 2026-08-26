CREATE TABLE IF NOT EXISTS eos_provider_ingress_policies (
  registration_id text PRIMARY KEY REFERENCES eos_provider_ingress_registrations(id) ON DELETE RESTRICT,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  watch_renew_before_minutes integer NOT NULL DEFAULT 1440,
  reconciliation_overdue_minutes integer NOT NULL DEFAULT 15,
  pending_verification_minutes integer NOT NULL DEFAULT 60,
  external_escalation_enabled boolean NOT NULL DEFAULT false,
  minimum_escalation_severity text NOT NULL DEFAULT 'material',
  max_delivery_attempts integer NOT NULL DEFAULT 5,
  version integer NOT NULL DEFAULT 1,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  rationale text NOT NULL,
  last_event_id text REFERENCES eos_integration_operation_events(id) ON DELETE RESTRICT,
  updated_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_provider_ingress_policy_thresholds_check CHECK (watch_renew_before_minutes BETWEEN 5 AND 8640 AND reconciliation_overdue_minutes BETWEEN 5 AND 1440 AND pending_verification_minutes BETWEEN 5 AND 10080),
  CONSTRAINT eos_provider_ingress_policy_severity_check CHECK (minimum_escalation_severity IN ('warning','material','critical')),
  CONSTRAINT eos_provider_ingress_policy_attempts_check CHECK (max_delivery_attempts BETWEEN 1 AND 10),
  CONSTRAINT eos_provider_ingress_policy_version_check CHECK (version > 0),
  CONSTRAINT eos_provider_ingress_policy_evidence_check CHECK (jsonb_typeof(evidence_ids) = 'array')
);
CREATE INDEX IF NOT EXISTS eos_provider_ingress_policy_company_idx ON eos_provider_ingress_policies(company_id);

INSERT INTO eos_provider_ingress_policies (registration_id, company_id, rationale, updated_by_user_id, created_at, updated_at)
SELECT id, company_id, 'EOS default provider-ingress service objectives; operator review required before external escalation is enabled.', created_by_user_id, created_at, updated_at
FROM eos_provider_ingress_registrations
ON CONFLICT (registration_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS eos_provider_ingress_alert_delivery_attempts (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  registration_id text NOT NULL REFERENCES eos_provider_ingress_registrations(id) ON DELETE RESTRICT,
  alert_key text NOT NULL,
  alert_id text NOT NULL,
  alert_kind text NOT NULL,
  severity text NOT NULL,
  attempt_number integer NOT NULL,
  trigger text NOT NULL,
  outcome text NOT NULL,
  delivery_result text NOT NULL,
  failure_code text NOT NULL DEFAULT '',
  payload_projection jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_sha256 text NOT NULL,
  next_attempt_at timestamptz,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_provider_ingress_alert_key_check CHECK (alert_key ~ '^[0-9a-f]{64}$' AND payload_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_provider_ingress_alert_attempt_number_check CHECK (attempt_number > 0),
  CONSTRAINT eos_provider_ingress_alert_severity_check CHECK (severity IN ('warning','material','critical')),
  CONSTRAINT eos_provider_ingress_alert_trigger_check CHECK (trigger IN ('worker','operator_replay')),
  CONSTRAINT eos_provider_ingress_alert_outcome_check CHECK (outcome IN ('delivered','retry_scheduled','dead_letter')),
  CONSTRAINT eos_provider_ingress_alert_result_check CHECK (delivery_result IN ('sent','suppressed','unconfigured','failed')),
  CONSTRAINT eos_provider_ingress_alert_retry_check CHECK ((outcome = 'retry_scheduled' AND next_attempt_at IS NOT NULL AND failure_code <> '') OR (outcome <> 'retry_scheduled' AND next_attempt_at IS NULL)),
  CONSTRAINT eos_provider_ingress_alert_projection_check CHECK (jsonb_typeof(payload_projection) = 'object')
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_provider_ingress_alert_attempt_idx ON eos_provider_ingress_alert_delivery_attempts(alert_key, attempt_number);
CREATE INDEX IF NOT EXISTS eos_provider_ingress_alert_registration_idx ON eos_provider_ingress_alert_delivery_attempts(registration_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS eos_provider_ingress_alert_queue_idx ON eos_provider_ingress_alert_delivery_attempts(outcome, next_attempt_at);

CREATE OR REPLACE FUNCTION eos_reject_provider_ingress_alert_attempt_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'EOS provider ingress alert delivery attempts are append-only'; END $$;
DROP TRIGGER IF EXISTS eos_provider_ingress_alert_attempt_guard ON eos_provider_ingress_alert_delivery_attempts;
CREATE TRIGGER eos_provider_ingress_alert_attempt_guard BEFORE UPDATE OR DELETE ON eos_provider_ingress_alert_delivery_attempts FOR EACH ROW EXECUTE FUNCTION eos_reject_provider_ingress_alert_attempt_mutation();

ALTER TABLE eos_integration_operation_events DROP CONSTRAINT IF EXISTS eos_integration_operation_event_type_check;
ALTER TABLE eos_integration_operation_events ADD CONSTRAINT eos_integration_operation_event_type_check CHECK (event_type IN ('manifest_frozen','run_planned','dispatch_claimed','dispatch_recovery_escalated','webhook_endpoint_configured','webhook_secret_rotated','webhook_endpoint_state_changed','provider_ingress_configured','provider_ingress_configuration_rotated','provider_ingress_policy_updated','provider_ingress_state_changed','provider_ingress_watch_started','receipt_recorded','retry_authorized','incident_opened','incident_acknowledged','incident_resolved','fallback_changed','qualification_recorded','cutover_decided'));
