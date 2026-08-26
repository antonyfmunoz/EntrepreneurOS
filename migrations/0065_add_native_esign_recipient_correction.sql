-- Governed recipient correction for active EOS-native envelopes.
-- Identity replacement is represented by an append-only audit event; prior
-- signing links are invalidated and previously recorded consent is not carried
-- across to the replacement identity.

ALTER TABLE eos_esign_events
  DROP CONSTRAINT IF EXISTS eos_esign_events_event_type_check;

ALTER TABLE eos_esign_events
  DROP CONSTRAINT IF EXISTS eos_esign_event_type_check;

ALTER TABLE eos_esign_events
  ADD CONSTRAINT eos_esign_events_event_type_check
  CHECK (event_type IN (
    'document_registered',
    'envelope_created',
    'envelope_revised',
    'envelope_issued',
    'recipient_sent',
    'recipient_opened',
    'recipient_corrected',
    'consent_recorded',
    'signature_recorded',
    'recipient_declined',
    'envelope_completed',
    'envelope_voided',
    'envelope_expired',
    'delivery_prepared',
    'delivery_succeeded',
    'delivery_failed',
    'recovery_required',
    'recovery_attempt_failed'
  ));
