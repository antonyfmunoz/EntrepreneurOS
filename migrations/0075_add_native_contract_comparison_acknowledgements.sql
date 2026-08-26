-- Explicit review evidence for replacement agreements. Ordinary envelopes do
-- not require a comparison. Replacement issuance and recipient consent bind to
-- the exact immutable comparison receipt rather than an unversioned checkbox.

ALTER TABLE eos_esign_envelopes
  ADD COLUMN IF NOT EXISTS comparison_review_sha256 text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS comparison_reviewed_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS comparison_reviewed_at timestamptz;

ALTER TABLE eos_esign_recipients
  ADD COLUMN IF NOT EXISTS comparison_acknowledgement_sha256 text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS comparison_acknowledged_at timestamptz;

ALTER TABLE eos_esign_envelopes DROP CONSTRAINT IF EXISTS eos_esign_envelope_comparison_review_check;
ALTER TABLE eos_esign_envelopes ADD CONSTRAINT eos_esign_envelope_comparison_review_check CHECK (
  (comparison_review_sha256 = '' AND comparison_reviewed_by_user_id IS NULL AND comparison_reviewed_at IS NULL) OR
  (comparison_review_sha256 ~ '^[0-9a-f]{64}$' AND comparison_reviewed_by_user_id IS NOT NULL AND comparison_reviewed_at IS NOT NULL)
);

ALTER TABLE eos_esign_recipients DROP CONSTRAINT IF EXISTS eos_esign_recipient_comparison_ack_check;
ALTER TABLE eos_esign_recipients ADD CONSTRAINT eos_esign_recipient_comparison_ack_check CHECK (
  (comparison_acknowledgement_sha256 = '' AND comparison_acknowledged_at IS NULL) OR
  (comparison_acknowledgement_sha256 ~ '^[0-9a-f]{64}$' AND comparison_acknowledged_at IS NOT NULL AND consented_at IS NOT NULL)
);

DROP TRIGGER IF EXISTS eos_esign_envelope_comparison_review_immutable ON eos_esign_envelopes;
DROP TRIGGER IF EXISTS eos_esign_recipient_comparison_ack_immutable ON eos_esign_recipients;
DROP FUNCTION IF EXISTS eos_protect_native_comparison_acknowledgements();

CREATE OR REPLACE FUNCTION eos_protect_native_envelope_comparison_review()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.comparison_review_sha256 <> '' AND
    (NEW.comparison_review_sha256 IS DISTINCT FROM OLD.comparison_review_sha256 OR
     NEW.comparison_reviewed_by_user_id IS DISTINCT FROM OLD.comparison_reviewed_by_user_id OR
     NEW.comparison_reviewed_at IS DISTINCT FROM OLD.comparison_reviewed_at) THEN
    RAISE EXCEPTION 'EOS envelope comparison review evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION eos_protect_native_recipient_comparison_acknowledgement()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.comparison_acknowledgement_sha256 <> '' AND
    (NEW.comparison_acknowledgement_sha256 IS DISTINCT FROM OLD.comparison_acknowledgement_sha256 OR
     NEW.comparison_acknowledged_at IS DISTINCT FROM OLD.comparison_acknowledged_at) AND NOT (
       (NEW.signer_email IS DISTINCT FROM OLD.signer_email OR NEW.signer_name IS DISTINCT FROM OLD.signer_name) AND
       NEW.consent_version = '' AND
       NEW.comparison_acknowledgement_sha256 = '' AND NEW.comparison_acknowledged_at IS NULL
     ) THEN
    RAISE EXCEPTION 'EOS recipient comparison acknowledgement evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER eos_esign_envelope_comparison_review_immutable BEFORE UPDATE ON eos_esign_envelopes
  FOR EACH ROW EXECUTE FUNCTION eos_protect_native_envelope_comparison_review();
CREATE TRIGGER eos_esign_recipient_comparison_ack_immutable BEFORE UPDATE ON eos_esign_recipients
  FOR EACH ROW EXECUTE FUNCTION eos_protect_native_recipient_comparison_acknowledgement();

ALTER TABLE eos_esign_events DROP CONSTRAINT IF EXISTS eos_esign_events_event_type_check;
ALTER TABLE eos_esign_events ADD CONSTRAINT eos_esign_events_event_type_check CHECK (event_type IN (
  'document_registered','document_generated','document_revision_registered','document_comparison_recorded','document_semantic_comparison_recorded',
  'comparison_reviewed','comparison_acknowledged',
  'envelope_created','envelope_revised','envelope_issued','envelope_completed','envelope_voided','envelope_expired',
  'envelope_cloned','envelope_renewed','envelope_replacement_created','envelope_replaced',
  'recipient_sent','recipient_opened','recipient_corrected','recipient_declined','identity_otp_requested',
  'identity_verified','consent_recorded','signature_recorded','delivery_prepared','delivery_succeeded','delivery_failed',
  'completion_delivery_prepared','completion_delivery_succeeded','completion_delivery_failed','evidence_promoted',
  'obligation_promoted','negotiation_opened','negotiation_entry_recorded','negotiation_resolved',
  'reminder_scheduled','reminder_schedule_changed','batch_completed','recovery_required','recovery_attempt_failed'
));
