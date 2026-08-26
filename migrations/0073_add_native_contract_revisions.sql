-- Governed contract revisions: immutable document lineage and comparison
-- receipts, counterparty-visible negotiation, and replacement envelopes that
-- retire every signing path to the superseded text.

ALTER TABLE eos_esign_document_versions
  ADD COLUMN IF NOT EXISTS parent_document_version_id text REFERENCES eos_esign_document_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS negotiation_id text REFERENCES eos_esign_negotiations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS revision_summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS revision_evidence_sha256 text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS eos_esign_document_revision_lineage_idx
  ON eos_esign_document_versions(company_id, parent_document_version_id, created_at);
CREATE INDEX IF NOT EXISTS eos_esign_document_negotiation_idx
  ON eos_esign_document_versions(company_id, negotiation_id);

ALTER TABLE eos_esign_document_versions DROP CONSTRAINT IF EXISTS eos_esign_document_revision_check;
ALTER TABLE eos_esign_document_versions ADD CONSTRAINT eos_esign_document_revision_check CHECK (
  (parent_document_version_id IS NULL AND revision_summary = '' AND revision_evidence_sha256 = '') OR
  (parent_document_version_id IS NOT NULL AND char_length(revision_summary) BETWEEN 8 AND 2000 AND revision_evidence_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE TABLE IF NOT EXISTS eos_esign_document_comparisons (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_document_version_id text NOT NULL REFERENCES eos_esign_document_versions(id) ON DELETE RESTRICT,
  target_document_version_id text NOT NULL UNIQUE REFERENCES eos_esign_document_versions(id) ON DELETE RESTRICT,
  negotiation_id text REFERENCES eos_esign_negotiations(id) ON DELETE RESTRICT,
  comparison_type text NOT NULL DEFAULT 'operator_declared' CHECK (comparison_type IN ('operator_declared','generated_text')),
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  target_sha256 text NOT NULL CHECK (target_sha256 ~ '^[0-9a-f]{64}$'),
  revision_summary text NOT NULL CHECK (char_length(revision_summary) BETWEEN 8 AND 2000),
  declared_changes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(declared_changes) = 'array'),
  comparison_sha256 text NOT NULL UNIQUE CHECK (comparison_sha256 ~ '^[0-9a-f]{64}$'),
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_document_comparison_distinct_check CHECK (source_document_version_id <> target_document_version_id)
);
CREATE INDEX IF NOT EXISTS eos_esign_document_comparison_source_idx
  ON eos_esign_document_comparisons(company_id, source_document_version_id, created_at);

ALTER TABLE eos_esign_envelopes
  ADD COLUMN IF NOT EXISTS replaces_envelope_id text REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS replaced_by_envelope_id text REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_envelope_replaces_idx
  ON eos_esign_envelopes(replaces_envelope_id) WHERE replaces_envelope_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_envelope_replaced_by_idx
  ON eos_esign_envelopes(replaced_by_envelope_id) WHERE replaced_by_envelope_id IS NOT NULL;
ALTER TABLE eos_esign_envelopes DROP CONSTRAINT IF EXISTS eos_esign_envelope_replacement_distinct_check;
ALTER TABLE eos_esign_envelopes ADD CONSTRAINT eos_esign_envelope_replacement_distinct_check CHECK (
  id IS DISTINCT FROM replaces_envelope_id AND id IS DISTINCT FROM replaced_by_envelope_id
);

ALTER TABLE eos_esign_negotiations
  ADD COLUMN IF NOT EXISTS replacement_document_version_id text REFERENCES eos_esign_document_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS replacement_envelope_id text REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT;
ALTER TABLE eos_esign_negotiations DROP CONSTRAINT IF EXISTS eos_esign_negotiation_replacement_check;
ALTER TABLE eos_esign_negotiations ADD CONSTRAINT eos_esign_negotiation_replacement_check CHECK (
  (replacement_document_version_id IS NULL AND replacement_envelope_id IS NULL) OR
  (state = 'resolved' AND replacement_document_version_id IS NOT NULL AND replacement_envelope_id IS NOT NULL)
);

CREATE OR REPLACE FUNCTION eos_protect_native_contract_revision_evidence()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'EOS native contract revision evidence is immutable';
END;
$$;
DROP TRIGGER IF EXISTS eos_esign_document_comparisons_immutable ON eos_esign_document_comparisons;
CREATE TRIGGER eos_esign_document_comparisons_immutable BEFORE UPDATE OR DELETE ON eos_esign_document_comparisons
  FOR EACH ROW EXECUTE FUNCTION eos_protect_native_contract_revision_evidence();

ALTER TABLE eos_esign_events DROP CONSTRAINT IF EXISTS eos_esign_events_event_type_check;
ALTER TABLE eos_esign_events ADD CONSTRAINT eos_esign_events_event_type_check CHECK (event_type IN (
  'document_registered','document_generated','document_revision_registered','document_comparison_recorded',
  'envelope_created','envelope_revised','envelope_issued','envelope_completed','envelope_voided','envelope_expired',
  'envelope_cloned','envelope_renewed','envelope_replacement_created','envelope_replaced',
  'recipient_sent','recipient_opened','recipient_corrected','recipient_declined','identity_otp_requested',
  'identity_verified','consent_recorded','signature_recorded','delivery_prepared','delivery_succeeded','delivery_failed',
  'completion_delivery_prepared','completion_delivery_succeeded','completion_delivery_failed','evidence_promoted',
  'obligation_promoted','negotiation_opened','negotiation_entry_recorded','negotiation_resolved',
  'reminder_scheduled','reminder_schedule_changed','batch_completed','recovery_required','recovery_attempt_failed'
));
