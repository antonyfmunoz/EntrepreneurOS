-- Workforce control instrument. Reviews, development and succession extend the
-- canonical seat/assignment graph and measure role outcomes, not private human
-- activity. Sensitive projections stay tenant-bound and disclosure-governed.

CREATE TABLE IF NOT EXISTS eos_workforce_reviews (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  review_key text NOT NULL,
  subject_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  assignment_id text REFERENCES eos_assignments(id) ON DELETE SET NULL,
  reviewer_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'draft',
  performance_attribution text NOT NULL DEFAULT 'undetermined',
  outcome_summary text NOT NULL,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  manager_obligations jsonb NOT NULL DEFAULT '[]'::jsonb,
  employee_response text NOT NULL DEFAULT '',
  correction_status text NOT NULL DEFAULT 'none',
  metric_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  work_packet_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'internal',
  schema_version text NOT NULL DEFAULT 'workforce-review-v1.0',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_workforce_reviews_state_check CHECK (state IN ('draft','self_review','manager_review','calibrated','acknowledged','closed')),
  CONSTRAINT eos_workforce_reviews_attribution_check CHECK (performance_attribution IN ('undetermined','person','role_design','process','management','capacity','fit','mixed')),
  CONSTRAINT eos_workforce_reviews_correction_check CHECK (correction_status IN ('none','requested','resolved','rejected')),
  CONSTRAINT eos_workforce_reviews_window_check CHECK (period_end > period_start),
  CONSTRAINT eos_workforce_reviews_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_workforce_reviews_classification_check CHECK (classification IN ('internal','confidential','restricted')),
  UNIQUE(company_id, review_key)
);
CREATE INDEX IF NOT EXISTS eos_workforce_reviews_subject_state_idx ON eos_workforce_reviews(subject_seat_id, state, period_end DESC);
CREATE INDEX IF NOT EXISTS eos_workforce_reviews_reviewer_state_idx ON eos_workforce_reviews(reviewer_seat_id, state);

CREATE TABLE IF NOT EXISTS eos_development_plans (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  plan_key text NOT NULL,
  subject_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  assignment_id text REFERENCES eos_assignments(id) ON DELETE SET NULL,
  manager_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  target_position_agreement_id text REFERENCES eos_position_agreements(id) ON DELETE SET NULL,
  target_role text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'draft',
  capability_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  development_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  success_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  work_packet_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_at timestamptz,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'internal',
  schema_version text NOT NULL DEFAULT 'development-plan-v1.0',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_development_plans_state_check CHECK (state IN ('draft','active','paused','completed','cancelled')),
  CONSTRAINT eos_development_plans_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_development_plans_classification_check CHECK (classification IN ('internal','confidential','restricted')),
  UNIQUE(company_id, plan_key)
);
CREATE INDEX IF NOT EXISTS eos_development_plans_subject_state_idx ON eos_development_plans(subject_seat_id, state, review_at);
CREATE INDEX IF NOT EXISTS eos_development_plans_manager_state_idx ON eos_development_plans(manager_seat_id, state);

CREATE TABLE IF NOT EXISTS eos_succession_hypotheses (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  succession_key text NOT NULL,
  critical_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  candidate_seat_id text REFERENCES eos_seats(id) ON DELETE RESTRICT,
  candidate_assignment_id text REFERENCES eos_assignments(id) ON DELETE SET NULL,
  sponsor_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'hypothesis',
  readiness_window text NOT NULL DEFAULT 'unassessed',
  rationale text NOT NULL,
  proof_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  developmental_assignments jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_hiring_required boolean NOT NULL DEFAULT false,
  work_packet_id text REFERENCES eos_work_packets(id) ON DELETE SET NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'restricted',
  schema_version text NOT NULL DEFAULT 'succession-hypothesis-v1.0',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_succession_hypotheses_state_check CHECK (state IN ('hypothesis','assessed','development_active','ready','selected','rejected','withdrawn')),
  CONSTRAINT eos_succession_hypotheses_readiness_check CHECK (readiness_window IN ('unassessed','ready_now','within_6_months','within_12_months','within_18_months','not_ready')),
  CONSTRAINT eos_succession_hypotheses_distinct_seats_check CHECK (candidate_seat_id IS NULL OR candidate_seat_id <> critical_seat_id),
  CONSTRAINT eos_succession_hypotheses_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_succession_hypotheses_classification_check CHECK (classification IN ('internal','confidential','restricted')),
  UNIQUE(company_id, succession_key)
);
CREATE INDEX IF NOT EXISTS eos_succession_hypotheses_critical_state_idx ON eos_succession_hypotheses(critical_seat_id, state, readiness_window);
CREATE INDEX IF NOT EXISTS eos_succession_hypotheses_candidate_state_idx ON eos_succession_hypotheses(candidate_seat_id, state);

CREATE OR REPLACE FUNCTION eos_protect_external_workforce_projection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.source_authority = 'external_authoritative' THEN
    RAISE EXCEPTION 'External-authoritative Workforce projections are immutable; append a reconciled correction';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS eos_workforce_reviews_protect_external ON eos_workforce_reviews;
CREATE TRIGGER eos_workforce_reviews_protect_external BEFORE UPDATE OR DELETE ON eos_workforce_reviews FOR EACH ROW EXECUTE FUNCTION eos_protect_external_workforce_projection();
DROP TRIGGER IF EXISTS eos_development_plans_protect_external ON eos_development_plans;
CREATE TRIGGER eos_development_plans_protect_external BEFORE UPDATE OR DELETE ON eos_development_plans FOR EACH ROW EXECUTE FUNCTION eos_protect_external_workforce_projection();
DROP TRIGGER IF EXISTS eos_succession_hypotheses_protect_external ON eos_succession_hypotheses;
CREATE TRIGGER eos_succession_hypotheses_protect_external BEFORE UPDATE OR DELETE ON eos_succession_hypotheses FOR EACH ROW EXECUTE FUNCTION eos_protect_external_workforce_projection();
