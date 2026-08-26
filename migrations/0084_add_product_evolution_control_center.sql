-- Module 11 product, offer, and template evolution. eos_offer_programs remains
-- canonical. Draft hypotheses never become released truth without a separate
-- compatibility review, experiment, release decision, rollout, and apply event.
CREATE TABLE IF NOT EXISTS eos_product_feedback_signals (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  offer_id text NOT NULL REFERENCES eos_offer_programs(id) ON DELETE RESTRICT,
  source text NOT NULL, source_reference text NOT NULL, summary text NOT NULL,
  observed_at timestamptz NOT NULL, evidence_ids jsonb NOT NULL,
  classification text NOT NULL DEFAULT 'confidential', signal_sha256 text NOT NULL,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_product_feedback_source_check CHECK (source IN ('customer','sales','delivery','support','operations','analytics','provider')),
  CONSTRAINT eos_product_feedback_hash_check CHECK (signal_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_product_feedback_classification_check CHECK (classification IN ('public','internal','confidential','restricted'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_product_feedback_signal_hash_idx ON eos_product_feedback_signals(signal_sha256);
CREATE INDEX IF NOT EXISTS eos_product_feedback_offer_idx ON eos_product_feedback_signals(offer_id, observed_at);

CREATE TABLE IF NOT EXISTS eos_product_change_proposals (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  offer_id text NOT NULL REFERENCES eos_offer_programs(id) ON DELETE RESTRICT,
  proposal_key text NOT NULL, title text NOT NULL, hypothesis text NOT NULL,
  baseline_offer_snapshot jsonb NOT NULL, baseline_offer_sha256 text NOT NULL,
  proposed_patch jsonb NOT NULL, proposal_sha256 text NOT NULL,
  rollback_plan text NOT NULL, success_metric text NOT NULL, guardrail_metric text NOT NULL,
  feedback_signal_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  compatibility_outcome text NOT NULL DEFAULT 'pending', compatibility_rationale text NOT NULL DEFAULT '',
  compatibility_scope jsonb NOT NULL DEFAULT '{}'::jsonb, migration_plan text NOT NULL DEFAULT '',
  compatibility_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  release_decision text NOT NULL DEFAULT 'pending', release_rationale text NOT NULL DEFAULT '',
  release_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  rollout_state text NOT NULL DEFAULT 'not_started', rollout_stage text, rollout_percent integer,
  rollback_threshold text NOT NULL DEFAULT '', rollout_external_reference text NOT NULL DEFAULT '',
  rollout_receipt_evidence_id text REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  classification text NOT NULL DEFAULT 'confidential', version integer NOT NULL DEFAULT 1,
  last_event_id text, applied_at timestamptz,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_product_proposal_hash_check CHECK (baseline_offer_sha256 ~ '^[0-9a-f]{64}$' AND proposal_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_product_proposal_compatibility_check CHECK (compatibility_outcome IN ('pending','compatible','breaking','unknown')),
  CONSTRAINT eos_product_proposal_release_check CHECK (release_decision IN ('pending','ship','iterate','reject')),
  CONSTRAINT eos_product_proposal_rollout_check CHECK (rollout_state IN ('not_started','running','completed','rolled_back') AND (rollout_stage IS NULL OR rollout_stage IN ('internal','pilot','limited','general')) AND (rollout_percent IS NULL OR rollout_percent BETWEEN 1 AND 100)),
  CONSTRAINT eos_product_proposal_version_check CHECK (version > 0),
  CONSTRAINT eos_product_proposal_classification_check CHECK (classification IN ('public','internal','confidential','restricted'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_product_proposal_key_idx ON eos_product_change_proposals(company_id, proposal_key);
CREATE UNIQUE INDEX IF NOT EXISTS eos_product_proposal_hash_idx ON eos_product_change_proposals(proposal_sha256);
CREATE INDEX IF NOT EXISTS eos_product_proposal_offer_idx ON eos_product_change_proposals(offer_id, release_decision, rollout_state);

CREATE TABLE IF NOT EXISTS eos_product_experiments (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  proposal_id text NOT NULL REFERENCES eos_product_change_proposals(id) ON DELETE RESTRICT,
  question text NOT NULL, cohort_scope text NOT NULL, allocation_percent integer NOT NULL,
  starts_at text NOT NULL, ends_at text NOT NULL, success_metric text NOT NULL, guardrail_metric text NOT NULL,
  state text NOT NULL DEFAULT 'planned', result text NOT NULL DEFAULT 'pending', conclusion text NOT NULL DEFAULT '',
  conclusion_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb, experiment_sha256 text NOT NULL,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  classification text NOT NULL DEFAULT 'confidential', version integer NOT NULL DEFAULT 1, last_event_id text,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_product_experiment_state_check CHECK (state IN ('planned','running','concluded','stopped') AND result IN ('pending','met','not_met','inconclusive')),
  CONSTRAINT eos_product_experiment_allocation_check CHECK (allocation_percent BETWEEN 1 AND 100),
  CONSTRAINT eos_product_experiment_date_check CHECK (starts_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND ends_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND ends_at >= starts_at),
  CONSTRAINT eos_product_experiment_hash_check CHECK (experiment_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_product_experiment_version_check CHECK (version > 0),
  CONSTRAINT eos_product_experiment_classification_check CHECK (classification IN ('public','internal','confidential','restricted'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_product_experiment_proposal_idx ON eos_product_experiments(proposal_id);
CREATE UNIQUE INDEX IF NOT EXISTS eos_product_experiment_hash_idx ON eos_product_experiments(experiment_sha256);
CREATE INDEX IF NOT EXISTS eos_product_experiment_state_idx ON eos_product_experiments(company_id, state, ends_at);

CREATE TABLE IF NOT EXISTS eos_product_experiment_observations (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  proposal_id text NOT NULL REFERENCES eos_product_change_proposals(id) ON DELETE RESTRICT,
  experiment_id text NOT NULL REFERENCES eos_product_experiments(id) ON DELETE RESTRICT,
  metric_key text NOT NULL, value text NOT NULL, unit text NOT NULL,
  window_start text NOT NULL, window_end text NOT NULL, source_authority text NOT NULL,
  external_reference text NOT NULL DEFAULT '', evidence_ids jsonb NOT NULL,
  observation_sha256 text NOT NULL, recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_product_observation_authority_check CHECK (source_authority IN ('internal_observation','manual_attestation','provider_receipt','reconciled')),
  CONSTRAINT eos_product_observation_date_check CHECK (window_start ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND window_end ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND window_end >= window_start),
  CONSTRAINT eos_product_observation_hash_check CHECK (observation_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_product_observation_hash_idx ON eos_product_experiment_observations(observation_sha256);
CREATE INDEX IF NOT EXISTS eos_product_observation_experiment_idx ON eos_product_experiment_observations(experiment_id, recorded_at);

CREATE TABLE IF NOT EXISTS eos_product_evolution_events (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  proposal_id text REFERENCES eos_product_change_proposals(id) ON DELETE RESTRICT,
  offer_id text NOT NULL REFERENCES eos_offer_programs(id) ON DELETE RESTRICT,
  event_type text NOT NULL, subject_type text NOT NULL, subject_id text NOT NULL,
  version_before integer NOT NULL, version_after integer NOT NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb, payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  policy_decision_id text NOT NULL REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT,
  previous_event_sha256 text NOT NULL DEFAULT '', event_sha256 text NOT NULL,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_product_evolution_event_type_check CHECK (event_type IN ('feedback_recorded','proposal_created','compatibility_reviewed','experiment_created','experiment_started','experiment_stopped','observation_recorded','experiment_concluded','release_decided','rollout_started','rollout_advanced','rollout_completed','rollout_rolled_back','canonical_offer_applied')),
  CONSTRAINT eos_product_evolution_subject_check CHECK (subject_type IN ('feedback','proposal','experiment','observation','offer')),
  CONSTRAINT eos_product_evolution_event_version_check CHECK (version_before >= 0 AND version_after >= version_before),
  CONSTRAINT eos_product_evolution_event_hash_check CHECK (event_sha256 ~ '^[0-9a-f]{64}$' AND (previous_event_sha256 = '' OR previous_event_sha256 ~ '^[0-9a-f]{64}$'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_product_evolution_event_hash_idx ON eos_product_evolution_events(event_sha256);
CREATE INDEX IF NOT EXISTS eos_product_evolution_event_proposal_idx ON eos_product_evolution_events(proposal_id, recorded_at);

CREATE OR REPLACE FUNCTION eos_reject_product_evolution_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'EOS product-evolution ledger records are append-only'; END; $$;
DROP TRIGGER IF EXISTS eos_product_feedback_immutable ON eos_product_feedback_signals;
CREATE TRIGGER eos_product_feedback_immutable BEFORE UPDATE OR DELETE ON eos_product_feedback_signals FOR EACH ROW EXECUTE FUNCTION eos_reject_product_evolution_ledger_mutation();
DROP TRIGGER IF EXISTS eos_product_observation_immutable ON eos_product_experiment_observations;
CREATE TRIGGER eos_product_observation_immutable BEFORE UPDATE OR DELETE ON eos_product_experiment_observations FOR EACH ROW EXECUTE FUNCTION eos_reject_product_evolution_ledger_mutation();
DROP TRIGGER IF EXISTS eos_product_event_immutable ON eos_product_evolution_events;
CREATE TRIGGER eos_product_event_immutable BEFORE UPDATE OR DELETE ON eos_product_evolution_events FOR EACH ROW EXECUTE FUNCTION eos_reject_product_evolution_ledger_mutation();

CREATE OR REPLACE FUNCTION eos_guard_product_proposal_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event eos_product_evolution_events%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'EOS product proposals cannot be deleted'; END IF;
  IF NEW.offer_id <> OLD.offer_id OR NEW.proposal_key <> OLD.proposal_key OR NEW.hypothesis <> OLD.hypothesis
    OR NEW.baseline_offer_snapshot <> OLD.baseline_offer_snapshot OR NEW.baseline_offer_sha256 <> OLD.baseline_offer_sha256
    OR NEW.proposed_patch <> OLD.proposed_patch OR NEW.proposal_sha256 <> OLD.proposal_sha256
    OR NEW.rollback_plan <> OLD.rollback_plan OR NEW.success_metric <> OLD.success_metric OR NEW.guardrail_metric <> OLD.guardrail_metric
    OR NEW.owner_seat_id <> OLD.owner_seat_id OR NEW.classification <> OLD.classification
  THEN RAISE EXCEPTION 'EOS product proposal definitions are immutable'; END IF;
  SELECT * INTO event FROM eos_product_evolution_events WHERE id = NEW.last_event_id;
  IF event.id IS NULL OR event.proposal_id <> OLD.id OR event.version_before <> OLD.version OR event.version_after <> NEW.version OR NEW.version <> OLD.version + 1
  THEN RAISE EXCEPTION 'EOS product proposal projection changes require an exact immutable event'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS eos_product_proposal_guard ON eos_product_change_proposals;
CREATE TRIGGER eos_product_proposal_guard BEFORE UPDATE OR DELETE ON eos_product_change_proposals FOR EACH ROW EXECUTE FUNCTION eos_guard_product_proposal_mutation();

CREATE OR REPLACE FUNCTION eos_guard_product_experiment_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event eos_product_evolution_events%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'EOS product experiments cannot be deleted'; END IF;
  IF NEW.proposal_id <> OLD.proposal_id OR NEW.question <> OLD.question OR NEW.cohort_scope <> OLD.cohort_scope
    OR NEW.allocation_percent <> OLD.allocation_percent OR NEW.starts_at <> OLD.starts_at OR NEW.ends_at <> OLD.ends_at
    OR NEW.success_metric <> OLD.success_metric OR NEW.guardrail_metric <> OLD.guardrail_metric OR NEW.experiment_sha256 <> OLD.experiment_sha256
    OR NEW.owner_seat_id <> OLD.owner_seat_id OR NEW.classification <> OLD.classification
  THEN RAISE EXCEPTION 'EOS product experiment definitions are immutable'; END IF;
  SELECT * INTO event FROM eos_product_evolution_events WHERE id = NEW.last_event_id;
  IF event.id IS NULL OR event.subject_type <> 'experiment' OR event.subject_id <> OLD.id OR event.version_before <> OLD.version OR event.version_after <> NEW.version OR NEW.version <> OLD.version + 1
  THEN RAISE EXCEPTION 'EOS product experiment projection changes require an exact immutable event'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS eos_product_experiment_guard ON eos_product_experiments;
CREATE TRIGGER eos_product_experiment_guard BEFORE UPDATE OR DELETE ON eos_product_experiments FOR EACH ROW EXECUTE FUNCTION eos_guard_product_experiment_mutation();
