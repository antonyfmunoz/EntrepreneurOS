-- Native contract operations: attributable negotiation, immutable clone lineage,
-- scheduled reminders, bulk control receipts, and human-reviewed promotion of
-- executed obligations into canonical EOS risk/obligation/control records.

ALTER TABLE eos_esign_envelopes
  ADD COLUMN IF NOT EXISTS cloned_from_envelope_id text REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS renewal_of_envelope_id text REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS eos_esign_envelope_clone_lineage_idx ON eos_esign_envelopes(company_id, cloned_from_envelope_id);
CREATE INDEX IF NOT EXISTS eos_esign_envelope_renewal_lineage_idx ON eos_esign_envelopes(company_id, renewal_of_envelope_id);

CREATE TABLE IF NOT EXISTS eos_esign_negotiations (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  envelope_id text NOT NULL REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','resolved','withdrawn')),
  opened_by_type text NOT NULL CHECK (opened_by_type IN ('recipient','operator')),
  opened_by_reference text NOT NULL,
  subject text NOT NULL,
  resolution_summary text NOT NULL DEFAULT '',
  resolved_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  resolved_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_negotiation_resolution_check CHECK (
    (state = 'open' AND resolved_by_user_id IS NULL AND resolved_at IS NULL) OR
    (state IN ('resolved','withdrawn') AND resolved_at IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_negotiation_open_idx ON eos_esign_negotiations(envelope_id) WHERE state = 'open';
CREATE INDEX IF NOT EXISTS eos_esign_negotiation_company_state_idx ON eos_esign_negotiations(company_id, state, updated_at);

CREATE TABLE IF NOT EXISTS eos_esign_negotiation_entries (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  negotiation_id text NOT NULL REFERENCES eos_esign_negotiations(id) ON DELETE RESTRICT,
  envelope_id text NOT NULL REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT,
  author_type text NOT NULL CHECK (author_type IN ('recipient','operator')),
  author_reference text NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('change_request','comment','response','resolution')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 2 AND 10000),
  requested_changes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(requested_changes) = 'array'),
  previous_entry_sha256 text NOT NULL DEFAULT '' CHECK (previous_entry_sha256 = '' OR previous_entry_sha256 ~ '^[0-9a-f]{64}$'),
  entry_sha256 text NOT NULL UNIQUE CHECK (entry_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eos_esign_negotiation_entry_timeline_idx ON eos_esign_negotiation_entries(negotiation_id, created_at);

CREATE TABLE IF NOT EXISTS eos_esign_reminder_schedules (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  envelope_id text NOT NULL REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT,
  recipient_id text NOT NULL REFERENCES eos_esign_recipients(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','delivering','paused','completed','cancelled','failed')),
  next_reminder_at timestamptz NOT NULL,
  interval_days integer NOT NULL CHECK (interval_days BETWEEN 1 AND 30),
  max_reminders integer NOT NULL CHECK (max_reminders BETWEEN 1 AND 20),
  sent_count integer NOT NULL DEFAULT 0 CHECK (sent_count >= 0 AND sent_count <= max_reminders),
  requested_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  last_failure_code text NOT NULL DEFAULT '',
  leased_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_reminder_active_idx ON eos_esign_reminder_schedules(recipient_id) WHERE state IN ('active','delivering');
CREATE INDEX IF NOT EXISTS eos_esign_reminder_due_idx ON eos_esign_reminder_schedules(state, next_reminder_at);

CREATE TABLE IF NOT EXISTS eos_esign_batches (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('remind','void')),
  state text NOT NULL DEFAULT 'running' CHECK (state IN ('running','completed','partial','failed')),
  reason text NOT NULL,
  requested_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  requested_count integer NOT NULL CHECK (requested_count BETWEEN 1 AND 100),
  succeeded_count integer NOT NULL DEFAULT 0 CHECK (succeeded_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  receipt_sha256 text NOT NULL DEFAULT '' CHECK (receipt_sha256 = '' OR receipt_sha256 ~ '^[0-9a-f]{64}$'),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eos_esign_batch_history_idx ON eos_esign_batches(company_id, created_at);

CREATE TABLE IF NOT EXISTS eos_esign_batch_items (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  batch_id text NOT NULL REFERENCES eos_esign_batches(id) ON DELETE RESTRICT,
  envelope_id text NOT NULL REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT,
  recipient_id text REFERENCES eos_esign_recipients(id) ON DELETE RESTRICT,
  outcome text NOT NULL CHECK (outcome IN ('succeeded','failed','skipped')),
  failure_code text NOT NULL DEFAULT '',
  result_projection jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(result_projection) = 'object'),
  item_sha256 text NOT NULL UNIQUE CHECK (item_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eos_esign_batch_item_batch_idx ON eos_esign_batch_items(batch_id, created_at);

CREATE TABLE IF NOT EXISTS eos_esign_obligation_promotions (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  envelope_id text NOT NULL REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT,
  evidence_id text NOT NULL REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  obligation_id text NOT NULL UNIQUE REFERENCES eos_risks_controls(id) ON DELETE RESTRICT,
  source_excerpt text NOT NULL,
  source_excerpt_sha256 text NOT NULL CHECK (source_excerpt_sha256 ~ '^[0-9a-f]{64}$'),
  promoted_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  receipt_sha256 text NOT NULL UNIQUE CHECK (receipt_sha256 ~ '^[0-9a-f]{64}$'),
  promoted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eos_esign_obligation_promotion_envelope_idx ON eos_esign_obligation_promotions(company_id, envelope_id);

CREATE OR REPLACE FUNCTION eos_protect_native_contract_operations()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'EOS native contract operation records are append-only'; END IF;
  IF TG_TABLE_NAME IN ('eos_esign_negotiation_entries','eos_esign_batch_items','eos_esign_obligation_promotions') THEN
    RAISE EXCEPTION 'EOS native contract operation records are immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS eos_esign_negotiation_entries_immutable ON eos_esign_negotiation_entries;
CREATE TRIGGER eos_esign_negotiation_entries_immutable BEFORE UPDATE OR DELETE ON eos_esign_negotiation_entries FOR EACH ROW EXECUTE FUNCTION eos_protect_native_contract_operations();
DROP TRIGGER IF EXISTS eos_esign_batch_items_immutable ON eos_esign_batch_items;
CREATE TRIGGER eos_esign_batch_items_immutable BEFORE UPDATE OR DELETE ON eos_esign_batch_items FOR EACH ROW EXECUTE FUNCTION eos_protect_native_contract_operations();
DROP TRIGGER IF EXISTS eos_esign_obligation_promotions_immutable ON eos_esign_obligation_promotions;
CREATE TRIGGER eos_esign_obligation_promotions_immutable BEFORE UPDATE OR DELETE ON eos_esign_obligation_promotions FOR EACH ROW EXECUTE FUNCTION eos_protect_native_contract_operations();

ALTER TABLE eos_esign_events DROP CONSTRAINT IF EXISTS eos_esign_events_event_type_check;
ALTER TABLE eos_esign_events ADD CONSTRAINT eos_esign_events_event_type_check CHECK (event_type IN (
  'document_registered','document_generated','envelope_created','envelope_revised','envelope_issued','envelope_completed',
  'envelope_voided','envelope_expired','envelope_cloned','envelope_renewed','recipient_sent','recipient_opened','recipient_corrected','recipient_declined',
  'identity_otp_requested','identity_verified','consent_recorded','signature_recorded','delivery_prepared',
  'delivery_succeeded','delivery_failed','completion_delivery_prepared','completion_delivery_succeeded',
  'completion_delivery_failed','evidence_promoted','obligation_promoted','negotiation_opened','negotiation_entry_recorded',
  'negotiation_resolved','reminder_scheduled','reminder_schedule_changed','batch_completed','recovery_required','recovery_attempt_failed'
));
