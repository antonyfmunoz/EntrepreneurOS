-- New DocuSign receipt reconciliation is bound to the same company-scoped
-- OAuth connection that issued the envelope. Legacy binding-keyed receipts are
-- retained indefinitely for historical envelopes and auditability.
ALTER TABLE eos_recovery_provider_receipts
  ALTER COLUMN integration_binding_id DROP NOT NULL;

ALTER TABLE eos_recovery_provider_receipts
  ADD COLUMN IF NOT EXISTS provider_connection_id text
  REFERENCES eos_provider_connections(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS eos_recovery_provider_receipt_connection_event_idx
  ON eos_recovery_provider_receipts(provider_key, provider_connection_id, provider_event_id)
  WHERE provider_connection_id IS NOT NULL;

ALTER TABLE eos_recovery_provider_receipts
  DROP CONSTRAINT IF EXISTS eos_recovery_provider_receipt_source_check;

ALTER TABLE eos_recovery_provider_receipts
  ADD CONSTRAINT eos_recovery_provider_receipt_source_check
  CHECK (
    (integration_binding_id IS NOT NULL AND provider_connection_id IS NULL)
    OR (integration_binding_id IS NULL AND provider_connection_id IS NOT NULL)
  );
