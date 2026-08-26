ALTER TABLE eos_recovery_billing_manifests
  ADD COLUMN IF NOT EXISTS provider_payment_intent_reference text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS provider_latest_invoice_reference text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS setup_payment_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS subscription_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_provider_event_at timestamptz;

DO $$ BEGIN
  ALTER TABLE eos_recovery_billing_manifests ADD CONSTRAINT eos_recovery_billing_manifest_setup_payment_check CHECK (setup_payment_state IN ('pending','succeeded','failed','refunded','disputed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE eos_recovery_billing_manifests ADD CONSTRAINT eos_recovery_billing_manifest_subscription_check CHECK (subscription_state IN ('pending','incomplete','trialing','active','past_due','paused','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS eos_recovery_provider_receipts (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider_key text NOT NULL,
  integration_binding_id text NOT NULL REFERENCES eos_integration_bindings(id) ON DELETE RESTRICT,
  provider_event_id text NOT NULL,
  provider_object_reference text NOT NULL DEFAULT '',
  event_type text NOT NULL,
  object_type text NOT NULL DEFAULT 'unmatched',
  agreement_instance_id text REFERENCES eos_recovery_agreement_instances(id) ON DELETE RESTRICT,
  billing_manifest_id text REFERENCES eos_recovery_billing_manifests(id) ON DELETE RESTRICT,
  signature_state text NOT NULL DEFAULT 'verified',
  verifier_method text NOT NULL,
  payload_sha256 text NOT NULL,
  payload_projection jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_state text NOT NULL,
  failure_code text NOT NULL DEFAULT '',
  failure_summary text NOT NULL DEFAULT '',
  evidence_id text REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  external_effects_observed boolean NOT NULL DEFAULT true,
  schema_version text NOT NULL DEFAULT 'empyrean-recovery-provider-receipt.v1',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_recovery_provider_receipt_provider_check CHECK (provider_key IN ('docusign','stripe')),
  CONSTRAINT eos_recovery_provider_receipt_object_check CHECK (object_type IN ('agreement','billing','unmatched')),
  CONSTRAINT eos_recovery_provider_receipt_signature_check CHECK (signature_state = 'verified'),
  CONSTRAINT eos_recovery_provider_receipt_processing_check CHECK (processing_state IN ('applied','ignored','rejected','recovery_required')),
  CONSTRAINT eos_recovery_provider_receipt_target_check CHECK ((object_type = 'agreement' AND agreement_instance_id IS NOT NULL AND billing_manifest_id IS NULL) OR (object_type = 'billing' AND billing_manifest_id IS NOT NULL AND agreement_instance_id IS NULL) OR (object_type = 'unmatched' AND agreement_instance_id IS NULL AND billing_manifest_id IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_recovery_provider_receipt_event_idx ON eos_recovery_provider_receipts(provider_key, integration_binding_id, provider_event_id);
CREATE INDEX IF NOT EXISTS eos_recovery_provider_receipt_activation_idx ON eos_recovery_provider_receipts(company_id, agreement_instance_id, billing_manifest_id, occurred_at);

CREATE OR REPLACE FUNCTION eos_reject_recovery_provider_receipt_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'recovery provider receipts are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eos_recovery_provider_receipts_append_only ON eos_recovery_provider_receipts;
CREATE TRIGGER eos_recovery_provider_receipts_append_only
BEFORE UPDATE OR DELETE ON eos_recovery_provider_receipts
FOR EACH ROW EXECUTE FUNCTION eos_reject_recovery_provider_receipt_mutation();
