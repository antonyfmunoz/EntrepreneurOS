CREATE TABLE IF NOT EXISTS eos_provider_ingress_alert_acknowledgements (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  registration_id text NOT NULL REFERENCES eos_provider_ingress_registrations(id) ON DELETE RESTRICT,
  alert_key text NOT NULL,
  alert_id text NOT NULL,
  alert_kind text NOT NULL,
  severity text NOT NULL,
  summary text NOT NULL,
  observed_at timestamptz NOT NULL,
  acknowledgement_note text NOT NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  acknowledged_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  acknowledged_by_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  receipt_sha256 text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_provider_ingress_alert_ack_key_check CHECK (alert_key ~ '^[0-9a-f]{64}$' AND receipt_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_provider_ingress_alert_ack_severity_check CHECK (severity IN ('warning','material','critical')),
  CONSTRAINT eos_provider_ingress_alert_ack_note_check CHECK (length(trim(acknowledgement_note)) BETWEEN 10 AND 2000),
  CONSTRAINT eos_provider_ingress_alert_ack_evidence_check CHECK (jsonb_typeof(evidence_ids) = 'array')
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_provider_ingress_alert_ack_key_idx ON eos_provider_ingress_alert_acknowledgements(alert_key);
CREATE UNIQUE INDEX IF NOT EXISTS eos_provider_ingress_alert_ack_hash_idx ON eos_provider_ingress_alert_acknowledgements(receipt_sha256);
CREATE INDEX IF NOT EXISTS eos_provider_ingress_alert_ack_registration_idx ON eos_provider_ingress_alert_acknowledgements(registration_id, acknowledged_at DESC);

CREATE OR REPLACE FUNCTION eos_reject_provider_ingress_alert_ack_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'EOS provider ingress alert acknowledgements are append-only'; END $$;
DROP TRIGGER IF EXISTS eos_provider_ingress_alert_ack_guard ON eos_provider_ingress_alert_acknowledgements;
CREATE TRIGGER eos_provider_ingress_alert_ack_guard BEFORE UPDATE OR DELETE ON eos_provider_ingress_alert_acknowledgements FOR EACH ROW EXECUTE FUNCTION eos_reject_provider_ingress_alert_ack_mutation();
