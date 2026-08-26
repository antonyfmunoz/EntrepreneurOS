-- Allowlisted provider dispatch binds the existing generic execution ledger to
-- an integration run before any external request can leave EOS.
ALTER TABLE eos_integration_runs
  ADD COLUMN IF NOT EXISTS provider_execution_id text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) WHERE c.contype = 'f' AND c.conrelid = 'eos_integration_runs'::regclass AND a.attname = 'provider_execution_id') THEN
    ALTER TABLE eos_integration_runs ADD CONSTRAINT eos_integration_run_provider_execution_fk FOREIGN KEY (provider_execution_id) REFERENCES eos_provider_executions(id) ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE eos_integration_runs DROP CONSTRAINT IF EXISTS eos_integration_run_state_check;
ALTER TABLE eos_integration_runs ADD CONSTRAINT eos_integration_run_state_check CHECK (state IN ('planned','dispatching','retry_ready','succeeded','failed','uncertain','dead_letter'));

ALTER TABLE eos_integration_operation_events DROP CONSTRAINT IF EXISTS eos_integration_operation_event_type_check;
ALTER TABLE eos_integration_operation_events ADD CONSTRAINT eos_integration_operation_event_type_check CHECK (event_type IN ('manifest_frozen','run_planned','dispatch_claimed','receipt_recorded','retry_authorized','incident_opened','incident_acknowledged','incident_resolved','fallback_changed','qualification_recorded','cutover_decided'));

ALTER TABLE eos_integration_run_receipts DROP CONSTRAINT IF EXISTS eos_integration_receipt_authority_check;
ALTER TABLE eos_integration_run_receipts ADD CONSTRAINT eos_integration_receipt_authority_check CHECK (authority IN ('provider_receipt','provider_observation','reconciled','manual_attestation','fixture'));

CREATE OR REPLACE FUNCTION eos_guard_integration_run_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event eos_integration_operation_events%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'EOS integration runs cannot be deleted'; END IF;
  IF NEW.integration_binding_id <> OLD.integration_binding_id OR NEW.manifest_id <> OLD.manifest_id OR NEW.operation <> OLD.operation OR NEW.idempotency_key <> OLD.idempotency_key OR NEW.request_sha256 <> OLD.request_sha256 OR NEW.owner_seat_id <> OLD.owner_seat_id OR NEW.classification <> OLD.classification THEN RAISE EXCEPTION 'EOS integration run definitions are immutable'; END IF;
  SELECT * INTO event FROM eos_integration_operation_events WHERE id = NEW.last_event_id;
  IF event.id IS NULL OR event.subject_type <> 'run' OR event.subject_id <> OLD.id OR event.version_before <> OLD.version OR event.version_after <> NEW.version OR NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'EOS integration run changes require an exact immutable event'; END IF;
  RETURN NEW;
END $$;
