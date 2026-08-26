-- Native Module 7 customer-success control center. Customer identity remains in
-- eos_stakeholders; EOS records business evidence and provider receipts without
-- claiming that a report was delivered or an agreement renewed by itself.
CREATE TABLE IF NOT EXISTS eos_customer_success_accounts (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stakeholder_id text NOT NULL REFERENCES eos_stakeholders(id) ON DELETE RESTRICT,
  relationship_id text NOT NULL REFERENCES eos_stakeholder_relationships(id) ON DELETE RESTRICT,
  contract_envelope_id text REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  lifecycle_state text NOT NULL DEFAULT 'active',
  health_state text NOT NULL DEFAULT 'unknown',
  health_score integer,
  renewal_intent text NOT NULL DEFAULT 'undecided',
  review_cadence_days integer NOT NULL,
  next_review_at text NOT NULL,
  renewal_at text,
  success_definition text NOT NULL,
  classification text NOT NULL DEFAULT 'confidential',
  version integer NOT NULL DEFAULT 1,
  last_event_id text,
  last_health_review_id text,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_customer_success_account_lifecycle_check CHECK (lifecycle_state IN ('active','renewal_review','renewing','nonrenewing','churned','closed')),
  CONSTRAINT eos_customer_success_account_health_check CHECK (health_state IN ('unknown','healthy','watch','at_risk','critical')),
  CONSTRAINT eos_customer_success_account_score_check CHECK (health_score IS NULL OR health_score BETWEEN 0 AND 100),
  CONSTRAINT eos_customer_success_account_renewal_check CHECK (renewal_intent IN ('undecided','renew','renegotiate','terminate','allow_expiry','defer')),
  CONSTRAINT eos_customer_success_account_version_check CHECK (version > 0 AND review_cadence_days BETWEEN 1 AND 365),
  CONSTRAINT eos_customer_success_account_date_check CHECK (next_review_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND (renewal_at IS NULL OR renewal_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')),
  CONSTRAINT eos_customer_success_account_classification_check CHECK (classification IN ('public','internal','confidential','restricted'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_customer_success_account_party_idx ON eos_customer_success_accounts(company_id, stakeholder_id);
CREATE INDEX IF NOT EXISTS eos_customer_success_account_owner_idx ON eos_customer_success_accounts(owner_seat_id, lifecycle_state);
CREATE INDEX IF NOT EXISTS eos_customer_success_account_review_idx ON eos_customer_success_accounts(company_id, next_review_at);

CREATE TABLE IF NOT EXISTS eos_customer_success_outcomes (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES eos_customer_success_accounts(id) ON DELETE RESTRICT,
  outcome_key text NOT NULL, title text NOT NULL, definition text NOT NULL,
  baseline_value text NOT NULL, target_value text NOT NULL, actual_value text NOT NULL DEFAULT 'not_recorded', unit text NOT NULL,
  due_at text NOT NULL, attribution_model text NOT NULL, attribution_rationale text NOT NULL,
  state text NOT NULL DEFAULT 'tracking', owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb, classification text NOT NULL DEFAULT 'confidential', definition_sha256 text NOT NULL,
  version integer NOT NULL DEFAULT 1, last_event_id text,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_customer_success_outcome_state_check CHECK (state IN ('tracking','achieved','not_achieved','abandoned')),
  CONSTRAINT eos_customer_success_outcome_attribution_check CHECK (attribution_model IN ('direct','contributing','correlated','unknown')),
  CONSTRAINT eos_customer_success_outcome_version_check CHECK (version > 0),
  CONSTRAINT eos_customer_success_outcome_hash_check CHECK (definition_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_customer_success_outcome_date_check CHECK (due_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  CONSTRAINT eos_customer_success_outcome_classification_check CHECK (classification IN ('public','internal','confidential','restricted'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_customer_success_outcome_key_idx ON eos_customer_success_outcomes(account_id, outcome_key);
CREATE UNIQUE INDEX IF NOT EXISTS eos_customer_success_outcome_hash_idx ON eos_customer_success_outcomes(company_id, definition_sha256);
CREATE INDEX IF NOT EXISTS eos_customer_success_outcome_state_idx ON eos_customer_success_outcomes(account_id, state, due_at);

CREATE TABLE IF NOT EXISTS eos_customer_success_issues (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES eos_customer_success_accounts(id) ON DELETE RESTRICT,
  issue_key text NOT NULL, title text NOT NULL, severity text NOT NULL, summary text NOT NULL,
  state text NOT NULL DEFAULT 'open', owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  due_at text NOT NULL, evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb, resolution text NOT NULL DEFAULT '',
  classification text NOT NULL DEFAULT 'confidential', definition_sha256 text NOT NULL,
  version integer NOT NULL DEFAULT 1, last_event_id text,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_customer_success_issue_state_check CHECK (state IN ('open','resolved')),
  CONSTRAINT eos_customer_success_issue_severity_check CHECK (severity IN ('low','medium','high','critical')),
  CONSTRAINT eos_customer_success_issue_version_check CHECK (version > 0),
  CONSTRAINT eos_customer_success_issue_hash_check CHECK (definition_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_customer_success_issue_date_check CHECK (due_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  CONSTRAINT eos_customer_success_issue_classification_check CHECK (classification IN ('public','internal','confidential','restricted'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_customer_success_issue_key_idx ON eos_customer_success_issues(account_id, issue_key);
CREATE UNIQUE INDEX IF NOT EXISTS eos_customer_success_issue_hash_idx ON eos_customer_success_issues(company_id, definition_sha256);
CREATE INDEX IF NOT EXISTS eos_customer_success_issue_state_idx ON eos_customer_success_issues(account_id, state, severity);

CREATE TABLE IF NOT EXISTS eos_customer_success_reports (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES eos_customer_success_accounts(id) ON DELETE RESTRICT,
  report_key text NOT NULL, title text NOT NULL, period_start text NOT NULL, period_end text NOT NULL,
  executive_summary text NOT NULL, snapshot jsonb NOT NULL, evidence_ids jsonb NOT NULL,
  proof_consent text NOT NULL, consent_evidence_id text REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'prepared', report_sha256 text NOT NULL, version integer NOT NULL DEFAULT 1,
  approval_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb, approval_note text NOT NULL DEFAULT '',
  approved_by_user_id text REFERENCES users(id) ON DELETE RESTRICT, approved_at timestamptz,
  delivery_channel text, recipient_scope text NOT NULL DEFAULT '', external_reference text NOT NULL DEFAULT '',
  receipt_evidence_id text REFERENCES eos_evidence(id) ON DELETE RESTRICT, delivered_at timestamptz,
  classification text NOT NULL DEFAULT 'confidential', last_event_id text,
  prepared_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  prepared_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_customer_success_report_state_check CHECK (state IN ('prepared','approved','delivery_recorded')),
  CONSTRAINT eos_customer_success_report_consent_check CHECK (proof_consent IN ('internal_only','customer_approved','public_approved') AND (proof_consent = 'internal_only' OR consent_evidence_id IS NOT NULL)),
  CONSTRAINT eos_customer_success_report_hash_check CHECK (report_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_customer_success_report_version_check CHECK (version > 0),
  CONSTRAINT eos_customer_success_report_date_check CHECK (period_start ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND period_end ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND period_end >= period_start),
  CONSTRAINT eos_customer_success_report_classification_check CHECK (classification IN ('public','internal','confidential','restricted'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_customer_success_report_key_idx ON eos_customer_success_reports(account_id, report_key);
CREATE UNIQUE INDEX IF NOT EXISTS eos_customer_success_report_hash_idx ON eos_customer_success_reports(company_id, report_sha256);
CREATE INDEX IF NOT EXISTS eos_customer_success_report_state_idx ON eos_customer_success_reports(account_id, state, period_end);

CREATE TABLE IF NOT EXISTS eos_customer_success_events (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES eos_customer_success_accounts(id) ON DELETE RESTRICT,
  event_type text NOT NULL, subject_type text NOT NULL, subject_id text NOT NULL,
  account_version_before integer NOT NULL, account_version_after integer NOT NULL,
  subject_version_before integer NOT NULL, subject_version_after integer NOT NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb, payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  policy_decision_id text NOT NULL REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT,
  previous_event_sha256 text NOT NULL DEFAULT '', event_sha256 text NOT NULL,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_customer_success_event_type_check CHECK (event_type IN ('account_created','health_review_recorded','outcome_created','outcome_progress_recorded','issue_opened','issue_resolved','report_prepared','report_approved','report_delivery_recorded','renewal_decided')),
  CONSTRAINT eos_customer_success_event_subject_check CHECK (subject_type IN ('account','outcome','issue','report')),
  CONSTRAINT eos_customer_success_event_version_check CHECK (account_version_before >= 0 AND account_version_after > account_version_before AND subject_version_before >= 0 AND subject_version_after >= subject_version_before),
  CONSTRAINT eos_customer_success_event_hash_check CHECK (event_sha256 ~ '^[0-9a-f]{64}$' AND (previous_event_sha256 = '' OR previous_event_sha256 ~ '^[0-9a-f]{64}$'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_customer_success_event_hash_idx ON eos_customer_success_events(event_sha256);
CREATE INDEX IF NOT EXISTS eos_customer_success_event_account_idx ON eos_customer_success_events(account_id, recorded_at);

CREATE TABLE IF NOT EXISTS eos_customer_health_reviews (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES eos_customer_success_accounts(id) ON DELETE RESTRICT,
  account_version integer NOT NULL, delivery_score integer NOT NULL, outcome_score integer NOT NULL,
  adoption_score integer NOT NULL, relationship_score integer NOT NULL, risk_score integer NOT NULL,
  health_score integer NOT NULL, health_state text NOT NULL, evidence_ids jsonb NOT NULL,
  summary text NOT NULL, next_actions text NOT NULL, next_review_at text NOT NULL,
  policy_decision_id text NOT NULL REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT,
  review_sha256 text NOT NULL, reviewed_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_customer_health_review_score_check CHECK (delivery_score BETWEEN 0 AND 100 AND outcome_score BETWEEN 0 AND 100 AND adoption_score BETWEEN 0 AND 100 AND relationship_score BETWEEN 0 AND 100 AND risk_score BETWEEN 0 AND 100 AND health_score BETWEEN 0 AND 100),
  CONSTRAINT eos_customer_health_review_state_check CHECK (health_state IN ('healthy','watch','at_risk','critical')),
  CONSTRAINT eos_customer_health_review_hash_check CHECK (review_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_customer_health_review_date_check CHECK (next_review_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_customer_health_review_hash_idx ON eos_customer_health_reviews(review_sha256);
CREATE INDEX IF NOT EXISTS eos_customer_health_review_account_idx ON eos_customer_health_reviews(account_id, reviewed_at);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'eos_customer_success_account_last_event_fk') THEN
    ALTER TABLE eos_customer_success_accounts ADD CONSTRAINT eos_customer_success_account_last_event_fk FOREIGN KEY (last_event_id) REFERENCES eos_customer_success_events(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'eos_customer_success_account_last_health_fk') THEN
    ALTER TABLE eos_customer_success_accounts ADD CONSTRAINT eos_customer_success_account_last_health_fk FOREIGN KEY (last_health_review_id) REFERENCES eos_customer_health_reviews(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'eos_customer_success_outcome_last_event_fk') THEN
    ALTER TABLE eos_customer_success_outcomes ADD CONSTRAINT eos_customer_success_outcome_last_event_fk FOREIGN KEY (last_event_id) REFERENCES eos_customer_success_events(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'eos_customer_success_issue_last_event_fk') THEN
    ALTER TABLE eos_customer_success_issues ADD CONSTRAINT eos_customer_success_issue_last_event_fk FOREIGN KEY (last_event_id) REFERENCES eos_customer_success_events(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'eos_customer_success_report_last_event_fk') THEN
    ALTER TABLE eos_customer_success_reports ADD CONSTRAINT eos_customer_success_report_last_event_fk FOREIGN KEY (last_event_id) REFERENCES eos_customer_success_events(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION eos_reject_customer_success_receipt_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'EOS customer-success receipts are append-only'; END;
$$;
DROP TRIGGER IF EXISTS eos_customer_success_event_immutable ON eos_customer_success_events;
CREATE TRIGGER eos_customer_success_event_immutable BEFORE UPDATE OR DELETE ON eos_customer_success_events FOR EACH ROW EXECUTE FUNCTION eos_reject_customer_success_receipt_mutation();
DROP TRIGGER IF EXISTS eos_customer_health_review_immutable ON eos_customer_health_reviews;
CREATE TRIGGER eos_customer_health_review_immutable BEFORE UPDATE OR DELETE ON eos_customer_health_reviews FOR EACH ROW EXECUTE FUNCTION eos_reject_customer_success_receipt_mutation();

CREATE OR REPLACE FUNCTION eos_guard_customer_success_account_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'EOS customer-success accounts cannot be deleted'; END IF;
  IF NEW.id IS NOT DISTINCT FROM OLD.id AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id
     AND NEW.stakeholder_id IS NOT DISTINCT FROM OLD.stakeholder_id AND NEW.relationship_id IS NOT DISTINCT FROM OLD.relationship_id
     AND NEW.contract_envelope_id IS NOT DISTINCT FROM OLD.contract_envelope_id AND NEW.owner_seat_id IS NOT DISTINCT FROM OLD.owner_seat_id
     AND NEW.review_cadence_days IS NOT DISTINCT FROM OLD.review_cadence_days AND NEW.renewal_at IS NOT DISTINCT FROM OLD.renewal_at
     AND NEW.success_definition IS NOT DISTINCT FROM OLD.success_definition AND NEW.classification IS NOT DISTINCT FROM OLD.classification
     AND NEW.recorded_by_user_id IS NOT DISTINCT FROM OLD.recorded_by_user_id AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
     AND NEW.version = OLD.version + 1 AND NEW.last_event_id IS DISTINCT FROM OLD.last_event_id
     AND EXISTS (
       SELECT 1 FROM eos_customer_success_events event
       WHERE event.id = NEW.last_event_id AND event.account_id = OLD.id
         AND event.account_version_before = OLD.version AND event.account_version_after = NEW.version
         AND (
           (event.event_type = 'health_review_recorded'
             AND NEW.lifecycle_state IS NOT DISTINCT FROM OLD.lifecycle_state AND NEW.renewal_intent IS NOT DISTINCT FROM OLD.renewal_intent
             AND NEW.health_score = (event.payload->>'healthScore')::integer AND NEW.health_state = event.payload->>'healthState'
             AND NEW.next_review_at = event.payload->>'nextReviewAt' AND NEW.last_health_review_id = event.payload->>'reviewId'
             AND EXISTS (SELECT 1 FROM eos_customer_health_reviews review WHERE review.id = NEW.last_health_review_id AND review.account_id = OLD.id AND review.account_version = OLD.version AND review.health_score = NEW.health_score AND review.health_state = NEW.health_state AND review.next_review_at = NEW.next_review_at))
           OR
           (event.event_type = 'renewal_decided'
             AND NEW.health_score IS NOT DISTINCT FROM OLD.health_score AND NEW.health_state IS NOT DISTINCT FROM OLD.health_state
             AND NEW.last_health_review_id IS NOT DISTINCT FROM OLD.last_health_review_id
             AND NEW.renewal_intent = event.payload->>'intentAfter' AND NEW.lifecycle_state = event.payload->>'lifecycleAfter' AND NEW.next_review_at = event.payload->>'nextReviewAt')
           OR
           (event.event_type IN ('outcome_created','outcome_progress_recorded','issue_opened','issue_resolved','report_prepared','report_approved','report_delivery_recorded')
             AND NEW.lifecycle_state IS NOT DISTINCT FROM OLD.lifecycle_state AND NEW.health_state IS NOT DISTINCT FROM OLD.health_state
             AND NEW.health_score IS NOT DISTINCT FROM OLD.health_score AND NEW.renewal_intent IS NOT DISTINCT FROM OLD.renewal_intent
             AND NEW.next_review_at IS NOT DISTINCT FROM OLD.next_review_at AND NEW.last_health_review_id IS NOT DISTINCT FROM OLD.last_health_review_id)
         )
     )
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'EOS customer-success account definitions are immutable; projections require an exact event receipt';
END;
$$;
DROP TRIGGER IF EXISTS eos_customer_success_account_guard ON eos_customer_success_accounts;
CREATE TRIGGER eos_customer_success_account_guard BEFORE UPDATE OR DELETE ON eos_customer_success_accounts FOR EACH ROW EXECUTE FUNCTION eos_guard_customer_success_account_mutation();

CREATE OR REPLACE FUNCTION eos_guard_customer_success_outcome_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'EOS customer outcomes cannot be deleted'; END IF;
  IF NEW.id IS NOT DISTINCT FROM OLD.id AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id AND NEW.account_id IS NOT DISTINCT FROM OLD.account_id
     AND NEW.outcome_key IS NOT DISTINCT FROM OLD.outcome_key AND NEW.title IS NOT DISTINCT FROM OLD.title AND NEW.definition IS NOT DISTINCT FROM OLD.definition
     AND NEW.baseline_value IS NOT DISTINCT FROM OLD.baseline_value AND NEW.target_value IS NOT DISTINCT FROM OLD.target_value AND NEW.unit IS NOT DISTINCT FROM OLD.unit
     AND NEW.due_at IS NOT DISTINCT FROM OLD.due_at AND NEW.attribution_model IS NOT DISTINCT FROM OLD.attribution_model AND NEW.attribution_rationale IS NOT DISTINCT FROM OLD.attribution_rationale
     AND NEW.owner_seat_id IS NOT DISTINCT FROM OLD.owner_seat_id AND NEW.classification IS NOT DISTINCT FROM OLD.classification AND NEW.definition_sha256 IS NOT DISTINCT FROM OLD.definition_sha256
     AND NEW.recorded_by_user_id IS NOT DISTINCT FROM OLD.recorded_by_user_id AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
     AND NEW.version = OLD.version + 1 AND NEW.last_event_id IS DISTINCT FROM OLD.last_event_id
     AND EXISTS (SELECT 1 FROM eos_customer_success_events event WHERE event.id = NEW.last_event_id AND event.event_type = 'outcome_progress_recorded' AND event.subject_type = 'outcome' AND event.subject_id = OLD.id AND event.subject_version_before = OLD.version AND event.subject_version_after = NEW.version AND NEW.state = event.payload->>'stateAfter' AND NEW.actual_value = event.payload->>'actualValue' AND NEW.evidence_ids = event.evidence_ids)
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'EOS customer outcome definitions are immutable; progress requires an exact event receipt';
END;
$$;
DROP TRIGGER IF EXISTS eos_customer_success_outcome_guard ON eos_customer_success_outcomes;
CREATE TRIGGER eos_customer_success_outcome_guard BEFORE UPDATE OR DELETE ON eos_customer_success_outcomes FOR EACH ROW EXECUTE FUNCTION eos_guard_customer_success_outcome_mutation();

CREATE OR REPLACE FUNCTION eos_guard_customer_success_issue_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'EOS customer issues cannot be deleted'; END IF;
  IF NEW.id IS NOT DISTINCT FROM OLD.id AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id AND NEW.account_id IS NOT DISTINCT FROM OLD.account_id
     AND NEW.issue_key IS NOT DISTINCT FROM OLD.issue_key AND NEW.title IS NOT DISTINCT FROM OLD.title AND NEW.severity IS NOT DISTINCT FROM OLD.severity
     AND NEW.summary IS NOT DISTINCT FROM OLD.summary AND NEW.owner_seat_id IS NOT DISTINCT FROM OLD.owner_seat_id AND NEW.due_at IS NOT DISTINCT FROM OLD.due_at
     AND NEW.classification IS NOT DISTINCT FROM OLD.classification AND NEW.definition_sha256 IS NOT DISTINCT FROM OLD.definition_sha256
     AND NEW.recorded_by_user_id IS NOT DISTINCT FROM OLD.recorded_by_user_id AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
     AND NEW.version = OLD.version + 1 AND NEW.last_event_id IS DISTINCT FROM OLD.last_event_id
     AND EXISTS (SELECT 1 FROM eos_customer_success_events event WHERE event.id = NEW.last_event_id AND event.event_type = 'issue_resolved' AND event.subject_type = 'issue' AND event.subject_id = OLD.id AND event.subject_version_before = OLD.version AND event.subject_version_after = NEW.version AND NEW.state = 'resolved' AND NEW.resolution = event.payload->>'resolution' AND NEW.evidence_ids = event.evidence_ids AND NEW.resolved_at IS NOT NULL)
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'EOS customer issue definitions are immutable; resolution requires an exact event receipt';
END;
$$;
DROP TRIGGER IF EXISTS eos_customer_success_issue_guard ON eos_customer_success_issues;
CREATE TRIGGER eos_customer_success_issue_guard BEFORE UPDATE OR DELETE ON eos_customer_success_issues FOR EACH ROW EXECUTE FUNCTION eos_guard_customer_success_issue_mutation();

CREATE OR REPLACE FUNCTION eos_guard_customer_success_report_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'EOS customer reports cannot be deleted'; END IF;
  IF NEW.id IS NOT DISTINCT FROM OLD.id AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id AND NEW.account_id IS NOT DISTINCT FROM OLD.account_id
     AND NEW.report_key IS NOT DISTINCT FROM OLD.report_key AND NEW.title IS NOT DISTINCT FROM OLD.title AND NEW.period_start IS NOT DISTINCT FROM OLD.period_start
     AND NEW.period_end IS NOT DISTINCT FROM OLD.period_end AND NEW.executive_summary IS NOT DISTINCT FROM OLD.executive_summary AND NEW.snapshot IS NOT DISTINCT FROM OLD.snapshot
     AND NEW.evidence_ids IS NOT DISTINCT FROM OLD.evidence_ids AND NEW.proof_consent IS NOT DISTINCT FROM OLD.proof_consent AND NEW.consent_evidence_id IS NOT DISTINCT FROM OLD.consent_evidence_id
     AND NEW.report_sha256 IS NOT DISTINCT FROM OLD.report_sha256 AND NEW.classification IS NOT DISTINCT FROM OLD.classification
     AND NEW.prepared_by_user_id IS NOT DISTINCT FROM OLD.prepared_by_user_id AND NEW.prepared_at IS NOT DISTINCT FROM OLD.prepared_at
     AND NEW.version = OLD.version + 1 AND NEW.last_event_id IS DISTINCT FROM OLD.last_event_id
     AND EXISTS (
       SELECT 1 FROM eos_customer_success_events event
       WHERE event.id = NEW.last_event_id AND event.subject_type = 'report' AND event.subject_id = OLD.id
         AND event.subject_version_before = OLD.version AND event.subject_version_after = NEW.version
         AND (
           (event.event_type = 'report_approved' AND OLD.state = 'prepared' AND NEW.state = 'approved'
             AND NEW.approval_note = event.payload->>'approvalNote' AND NEW.approval_evidence_ids = event.evidence_ids
             AND NEW.approved_by_user_id IS NOT NULL AND NEW.approved_at IS NOT NULL
             AND NEW.delivery_channel IS NOT DISTINCT FROM OLD.delivery_channel AND NEW.receipt_evidence_id IS NOT DISTINCT FROM OLD.receipt_evidence_id)
           OR
           (event.event_type = 'report_delivery_recorded' AND OLD.state = 'approved' AND NEW.state = 'delivery_recorded'
             AND NEW.delivery_channel = event.payload->>'channel' AND NEW.recipient_scope = event.payload->>'recipientScope'
             AND NEW.external_reference = event.payload->>'externalReference' AND NEW.receipt_evidence_id = event.evidence_ids->>0
             AND NEW.delivered_at IS NOT NULL AND NEW.approval_note IS NOT DISTINCT FROM OLD.approval_note AND NEW.approval_evidence_ids IS NOT DISTINCT FROM OLD.approval_evidence_ids)
         )
     )
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'EOS customer report snapshots are immutable; approval and receipt projection require an exact event';
END;
$$;
DROP TRIGGER IF EXISTS eos_customer_success_report_guard ON eos_customer_success_reports;
CREATE TRIGGER eos_customer_success_report_guard BEFORE UPDATE OR DELETE ON eos_customer_success_reports FOR EACH ROW EXECUTE FUNCTION eos_guard_customer_success_report_mutation();
