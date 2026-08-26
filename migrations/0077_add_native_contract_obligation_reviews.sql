-- Governed contract-obligation reviews. These append-only receipts preserve
-- the human decision, operational Evidence, authority decision, and exact
-- state transition separately from the mutable obligation projection.

CREATE TABLE IF NOT EXISTS eos_esign_obligation_reviews (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  envelope_id text NOT NULL REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT,
  promotion_id text NOT NULL REFERENCES eos_esign_obligation_promotions(id) ON DELETE RESTRICT,
  obligation_id text NOT NULL REFERENCES eos_risks_controls(id) ON DELETE RESTRICT,
  state_before text NOT NULL,
  state_after text NOT NULL,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_note text NOT NULL,
  next_review_at timestamptz,
  authority_class text NOT NULL,
  policy_decision_id text NOT NULL REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT,
  source_excerpt_sha256 text NOT NULL,
  previous_review_sha256 text NOT NULL DEFAULT '',
  review_sha256 text NOT NULL,
  reviewed_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_obligation_review_state_before_check CHECK (state_before IN (
    'identified','under_assessment','applicable_active','assigned','treating_in_progress','monitoring',
    'accepted','overdue_breached','remediating','satisfied_closed','superseded'
  )),
  CONSTRAINT eos_esign_obligation_review_state_after_check CHECK (state_after IN (
    'identified','under_assessment','applicable_active','assigned','treating_in_progress','monitoring',
    'accepted','overdue_breached','remediating','satisfied_closed','superseded'
  )),
  CONSTRAINT eos_esign_obligation_review_transition_check CHECK (state_before <> state_after),
  CONSTRAINT eos_esign_obligation_review_evidence_check CHECK (jsonb_typeof(evidence_ids) = 'array'),
  CONSTRAINT eos_esign_obligation_review_authority_check CHECK (authority_class IN ('execute','decide')),
  CONSTRAINT eos_esign_obligation_review_source_hash_check CHECK (source_excerpt_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_esign_obligation_review_previous_hash_check CHECK (previous_review_sha256 = '' OR previous_review_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_esign_obligation_review_hash_check CHECK (review_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS eos_esign_obligation_review_obligation_idx
  ON eos_esign_obligation_reviews(company_id, obligation_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS eos_esign_obligation_review_envelope_idx
  ON eos_esign_obligation_reviews(company_id, envelope_id, reviewed_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_obligation_review_hash_idx
  ON eos_esign_obligation_reviews(review_sha256);

CREATE OR REPLACE FUNCTION eos_protect_native_contract_obligation_reviews()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'EOS native contract obligation reviews are append-only';
END;
$$;

DROP TRIGGER IF EXISTS eos_esign_obligation_reviews_immutable ON eos_esign_obligation_reviews;
CREATE TRIGGER eos_esign_obligation_reviews_immutable
  BEFORE UPDATE OR DELETE ON eos_esign_obligation_reviews
  FOR EACH ROW EXECUTE FUNCTION eos_protect_native_contract_obligation_reviews();

ALTER TABLE eos_esign_events DROP CONSTRAINT IF EXISTS eos_esign_events_event_type_check;
ALTER TABLE eos_esign_events ADD CONSTRAINT eos_esign_events_event_type_check CHECK (event_type IN (
  'document_registered','document_generated','document_revision_registered','document_comparison_recorded','document_semantic_comparison_recorded',
  'comparison_reviewed','comparison_acknowledged',
  'envelope_created','envelope_revised','envelope_issued','envelope_completed','envelope_voided','envelope_expired',
  'envelope_cloned','envelope_renewed','envelope_replacement_created','envelope_replaced',
  'recipient_sent','recipient_opened','recipient_corrected','recipient_declined','identity_otp_requested',
  'identity_verified','consent_recorded','signature_recorded','delivery_prepared','delivery_succeeded','delivery_failed',
  'completion_delivery_prepared','completion_delivery_succeeded','completion_delivery_failed','evidence_promoted',
  'obligation_promoted','obligation_reviewed','negotiation_opened','negotiation_entry_recorded','negotiation_resolved',
  'reminder_scheduled','reminder_schedule_changed','batch_completed','recovery_required','recovery_attempt_failed'
));
