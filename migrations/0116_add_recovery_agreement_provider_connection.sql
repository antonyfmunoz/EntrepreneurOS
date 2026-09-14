-- New agreements use a company-scoped OAuth connection. Preserve the legacy
-- binding column because existing envelopes and signed receipts still refer to it.
ALTER TABLE eos_recovery_agreement_instances
  ADD COLUMN IF NOT EXISTS e_sign_provider_connection_id text
  REFERENCES eos_provider_connections(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS eos_recovery_agreement_provider_connection_idx
  ON eos_recovery_agreement_instances(company_id, e_sign_provider_connection_id)
  WHERE e_sign_provider_connection_id IS NOT NULL;
