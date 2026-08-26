CREATE TABLE IF NOT EXISTS eos_advisor_deliberations (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  founder_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  question text NOT NULL,
  context_packet jsonb NOT NULL,
  panel_mode text NOT NULL,
  advisor_ids jsonb NOT NULL,
  state text NOT NULL DEFAULT 'draft',
  synthesis text NOT NULL DEFAULT '',
  material_dissent jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision_due_at timestamptz,
  classification text NOT NULL DEFAULT 'restricted',
  trace_id text NOT NULL,
  correlation_id text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_advisor_deliberations_panel_check CHECK (panel_mode IN ('relevant','full_council')),
  CONSTRAINT eos_advisor_deliberations_state_check CHECK (state IN ('draft','independent_complete','rebuttal_complete','revision_complete','synthesis_ready','decided','calibrated','failed')),
  CONSTRAINT eos_advisor_deliberations_version_check CHECK (version > 0),
  CONSTRAINT eos_advisor_deliberations_classification_check CHECK (classification = 'restricted'),
  CONSTRAINT eos_advisor_deliberations_advisors_check CHECK (jsonb_typeof(advisor_ids) = 'array' AND jsonb_array_length(advisor_ids) BETWEEN 1 AND 15)
);
CREATE INDEX IF NOT EXISTS eos_advisor_deliberations_company_state_idx ON eos_advisor_deliberations(company_id, state, updated_at);

CREATE TABLE IF NOT EXISTS eos_advisor_contributions (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  deliberation_id text NOT NULL REFERENCES eos_advisor_deliberations(id) ON DELETE CASCADE,
  advisor_id text NOT NULL,
  advisor_name text NOT NULL,
  round text NOT NULL,
  response text NOT NULL,
  claims jsonb NOT NULL DEFAULT '[]'::jsonb,
  assumptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  dissent_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  status text NOT NULL,
  provenance jsonb NOT NULL,
  content_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_advisor_contributions_round_check CHECK (round IN ('independent','rebuttal','revision','synthesis')),
  CONSTRAINT eos_advisor_contributions_status_check CHECK (status IN ('completed','failed')),
  CONSTRAINT eos_advisor_contributions_hash_check CHECK (content_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_advisor_contributions_round_advisor_idx ON eos_advisor_contributions(deliberation_id, round, advisor_id);
CREATE INDEX IF NOT EXISTS eos_advisor_contributions_deliberation_round_idx ON eos_advisor_contributions(deliberation_id, round);

CREATE TABLE IF NOT EXISTS eos_advisor_decision_outcomes (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  deliberation_id text NOT NULL REFERENCES eos_advisor_deliberations(id) ON DELETE CASCADE,
  decision text NOT NULL,
  rationale text NOT NULL,
  accepted_claims jsonb NOT NULL DEFAULT '[]'::jsonb,
  rejected_claims jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  outcome text,
  outcome_summary text NOT NULL DEFAULT '',
  outcome_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  claim_outcomes jsonb NOT NULL DEFAULT '[]'::jsonb,
  learning_proposal text NOT NULL DEFAULT '',
  learning_state text NOT NULL DEFAULT 'not_proposed',
  decided_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decided_at timestamptz NOT NULL DEFAULT now(),
  calibrated_at timestamptz,
  CONSTRAINT eos_advisor_decision_outcomes_outcome_check CHECK (outcome IS NULL OR outcome IN ('better_than_expected','as_expected','worse_than_expected','inconclusive')),
  CONSTRAINT eos_advisor_decision_outcomes_learning_check CHECK (learning_state IN ('not_proposed','proposed','accepted','rejected'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_advisor_decision_outcomes_deliberation_idx ON eos_advisor_decision_outcomes(deliberation_id);
CREATE INDEX IF NOT EXISTS eos_advisor_decision_outcomes_company_decided_idx ON eos_advisor_decision_outcomes(company_id, decided_at);

CREATE OR REPLACE FUNCTION eos_advisor_contribution_immutable_guard()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'advisor contributions are immutable'; END $$;
DROP TRIGGER IF EXISTS eos_advisor_contribution_immutable_guard_trigger ON eos_advisor_contributions;
CREATE TRIGGER eos_advisor_contribution_immutable_guard_trigger BEFORE UPDATE OR DELETE ON eos_advisor_contributions
FOR EACH ROW EXECUTE FUNCTION eos_advisor_contribution_immutable_guard();
