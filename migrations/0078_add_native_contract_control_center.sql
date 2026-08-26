-- Contract control center. Signing-link expiry remains envelope transport
-- metadata; these human-reviewed dates govern the executed agreement itself.

CREATE TABLE IF NOT EXISTS eos_esign_contract_plans (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  envelope_id text NOT NULL REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT,
  lifecycle_state text NOT NULL DEFAULT 'active',
  renewal_intent text NOT NULL DEFAULT 'undecided',
  effective_at timestamptz NOT NULL,
  contract_ends_at timestamptz,
  notice_deadline_at timestamptz,
  next_review_at timestamptz NOT NULL,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  classification text NOT NULL DEFAULT 'confidential',
  notes text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  last_policy_decision_id text NOT NULL REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_contract_plan_state_check CHECK (lifecycle_state IN ('active','up_for_renewal','renewal_in_progress','nonrenewing','expired','closed')),
  CONSTRAINT eos_esign_contract_plan_intent_check CHECK (renewal_intent IN ('undecided','renew','renegotiate','terminate','allow_expiry')),
  CONSTRAINT eos_esign_contract_plan_classification_check CHECK (classification IN ('internal','confidential','restricted')),
  CONSTRAINT eos_esign_contract_plan_version_check CHECK (version > 0),
  CONSTRAINT eos_esign_contract_plan_term_check CHECK (contract_ends_at IS NULL OR contract_ends_at > effective_at),
  CONSTRAINT eos_esign_contract_plan_notice_check CHECK (notice_deadline_at IS NULL OR contract_ends_at IS NULL OR notice_deadline_at <= contract_ends_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_contract_plan_envelope_idx ON eos_esign_contract_plans(company_id, envelope_id);
CREATE INDEX IF NOT EXISTS eos_esign_contract_plan_review_idx ON eos_esign_contract_plans(company_id, lifecycle_state, next_review_at);
CREATE INDEX IF NOT EXISTS eos_esign_contract_plan_owner_idx ON eos_esign_contract_plans(owner_seat_id, lifecycle_state);

CREATE TABLE IF NOT EXISTS eos_esign_contract_plan_events (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES eos_esign_contract_plans(id) ON DELETE RESTRICT,
  envelope_id text NOT NULL REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  state_before text NOT NULL,
  state_after text NOT NULL,
  intent_before text NOT NULL,
  intent_after text NOT NULL,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  schedule_snapshot jsonb NOT NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text NOT NULL,
  authority_class text NOT NULL,
  policy_decision_id text NOT NULL REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT,
  previous_event_sha256 text NOT NULL DEFAULT '',
  event_sha256 text NOT NULL,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_contract_plan_event_type_check CHECK (event_type IN ('plan_recorded','renewal_decision_recorded')),
  CONSTRAINT eos_esign_contract_plan_event_schedule_check CHECK (jsonb_typeof(schedule_snapshot) = 'object'),
  CONSTRAINT eos_esign_contract_plan_event_evidence_check CHECK (jsonb_typeof(evidence_ids) = 'array'),
  CONSTRAINT eos_esign_contract_plan_event_authority_check CHECK (authority_class IN ('execute','decide')),
  CONSTRAINT eos_esign_contract_plan_event_previous_hash_check CHECK (previous_event_sha256 = '' OR previous_event_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_esign_contract_plan_event_hash_check CHECK (event_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS eos_esign_contract_plan_event_plan_idx ON eos_esign_contract_plan_events(company_id, plan_id, recorded_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_contract_plan_event_hash_idx ON eos_esign_contract_plan_events(event_sha256);

CREATE OR REPLACE FUNCTION eos_protect_native_contract_plan_events()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'EOS native contract plan events are append-only';
END;
$$;

DROP TRIGGER IF EXISTS eos_esign_contract_plan_events_immutable ON eos_esign_contract_plan_events;
CREATE TRIGGER eos_esign_contract_plan_events_immutable
  BEFORE UPDATE OR DELETE ON eos_esign_contract_plan_events
  FOR EACH ROW EXECUTE FUNCTION eos_protect_native_contract_plan_events();

ALTER TABLE eos_esign_events DROP CONSTRAINT IF EXISTS eos_esign_events_event_type_check;
ALTER TABLE eos_esign_events ADD CONSTRAINT eos_esign_events_event_type_check CHECK (event_type IN (
  'document_registered','document_generated','document_revision_registered','document_comparison_recorded','document_semantic_comparison_recorded',
  'comparison_reviewed','comparison_acknowledged',
  'envelope_created','envelope_revised','envelope_issued','envelope_completed','envelope_voided','envelope_expired',
  'envelope_cloned','envelope_renewed','envelope_replacement_created','envelope_replaced',
  'recipient_sent','recipient_opened','recipient_corrected','recipient_declined','identity_otp_requested',
  'identity_verified','consent_recorded','signature_recorded','delivery_prepared','delivery_succeeded','delivery_failed',
  'completion_delivery_prepared','completion_delivery_succeeded','completion_delivery_failed','evidence_promoted',
  'obligation_promoted','obligation_reviewed','contract_plan_recorded','contract_renewal_decided',
  'negotiation_opened','negotiation_entry_recorded','negotiation_resolved','reminder_scheduled','reminder_schedule_changed',
  'batch_completed','recovery_required','recovery_attempt_failed'
));
