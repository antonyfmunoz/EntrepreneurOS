ALTER TABLE eos_recovery_agreement_instances
  DROP CONSTRAINT IF EXISTS eos_recovery_agreement_instance_state_check,
  DROP CONSTRAINT IF EXISTS eos_recovery_agreement_instance_no_effect_check,
  ADD COLUMN IF NOT EXISTS issuance_execution_id text;

ALTER TABLE eos_recovery_agreement_instances
  ADD CONSTRAINT eos_recovery_agreement_instance_state_check
  CHECK (state IN ('blocked_counsel','blocked_esign','blocked_payment','eligible_to_issue','issued','signed','declined','voided','expired'));

ALTER TABLE eos_recovery_billing_manifests
  DROP CONSTRAINT IF EXISTS eos_recovery_billing_manifest_no_effect_check,
  ADD COLUMN IF NOT EXISTS checkout_execution_id text,
  ADD COLUMN IF NOT EXISTS last_compensation_execution_id text;

DROP TRIGGER IF EXISTS eos_recovery_agreement_instance_no_effect ON eos_recovery_agreement_instances;
DROP TRIGGER IF EXISTS eos_recovery_billing_manifest_no_effect ON eos_recovery_billing_manifests;

ALTER TABLE eos_provider_executions
  ADD COLUMN IF NOT EXISTS idempotency_key text;

UPDATE eos_provider_executions
SET idempotency_key = id
WHERE idempotency_key IS NULL OR idempotency_key = '';

ALTER TABLE eos_provider_executions
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS eos_provider_execution_idempotency_idx
  ON eos_provider_executions(company_id, provider, operation, idempotency_key);
