-- Machine-computed semantic comparisons for documents generated from the same
-- governed EOS template lineage. Uploaded PDFs remain operator-declared.

ALTER TABLE eos_esign_document_comparisons
  ADD COLUMN IF NOT EXISTS structured_diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS diff_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_text_sha256 text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_text_sha256 text NOT NULL DEFAULT '';

ALTER TABLE eos_esign_document_comparisons DROP CONSTRAINT IF EXISTS eos_esign_document_comparison_semantic_check;
ALTER TABLE eos_esign_document_comparisons ADD CONSTRAINT eos_esign_document_comparison_semantic_check CHECK (
  (comparison_type = 'operator_declared' AND structured_diff = '{}'::jsonb AND diff_stats = '{}'::jsonb AND source_text_sha256 = '' AND target_text_sha256 = '') OR
  (comparison_type = 'generated_text' AND jsonb_typeof(structured_diff) = 'object' AND structured_diff <> '{}'::jsonb AND jsonb_typeof(diff_stats) = 'object' AND diff_stats <> '{}'::jsonb AND source_text_sha256 ~ '^[0-9a-f]{64}$' AND target_text_sha256 ~ '^[0-9a-f]{64}$')
);

COMMENT ON COLUMN eos_esign_document_comparisons.structured_diff IS
  'Exact machine-computed text operations only for EOS-generated revisions; never a legal interpretation.';

ALTER TABLE eos_esign_events DROP CONSTRAINT IF EXISTS eos_esign_events_event_type_check;
ALTER TABLE eos_esign_events ADD CONSTRAINT eos_esign_events_event_type_check CHECK (event_type IN (
  'document_registered','document_generated','document_revision_registered','document_comparison_recorded','document_semantic_comparison_recorded',
  'envelope_created','envelope_revised','envelope_issued','envelope_completed','envelope_voided','envelope_expired',
  'envelope_cloned','envelope_renewed','envelope_replacement_created','envelope_replaced',
  'recipient_sent','recipient_opened','recipient_corrected','recipient_declined','identity_otp_requested',
  'identity_verified','consent_recorded','signature_recorded','delivery_prepared','delivery_succeeded','delivery_failed',
  'completion_delivery_prepared','completion_delivery_succeeded','completion_delivery_failed','evidence_promoted',
  'obligation_promoted','negotiation_opened','negotiation_entry_recorded','negotiation_resolved',
  'reminder_scheduled','reminder_schedule_changed','batch_completed','recovery_required','recovery_attempt_failed'
));
