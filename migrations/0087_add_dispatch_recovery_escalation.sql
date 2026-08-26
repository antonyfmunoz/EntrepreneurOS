-- A timed-out dispatch is not a failed dispatch. The recovery worker records a
-- distinct immutable escalation while leaving the run in dispatching until an
-- operator proves the provider outcome.
ALTER TABLE eos_integration_operation_events DROP CONSTRAINT IF EXISTS eos_integration_operation_event_type_check;
ALTER TABLE eos_integration_operation_events ADD CONSTRAINT eos_integration_operation_event_type_check CHECK (event_type IN ('manifest_frozen','run_planned','dispatch_claimed','dispatch_recovery_escalated','receipt_recorded','retry_authorized','incident_opened','incident_acknowledged','incident_resolved','fallback_changed','qualification_recorded','cutover_decided'));
