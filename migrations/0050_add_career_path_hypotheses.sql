CREATE TABLE IF NOT EXISTS eos_career_path_hypotheses (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  path_key text NOT NULL,
  subject_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  assignment_id text REFERENCES eos_assignments(id) ON DELETE SET NULL,
  sponsor_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  origin text NOT NULL,
  from_position_agreement_id text REFERENCES eos_position_agreements(id) ON DELETE SET NULL,
  target_position_agreement_id text REFERENCES eos_position_agreements(id) ON DELETE SET NULL,
  target_role text NOT NULL DEFAULT '',
  transition_type text NOT NULL,
  career_track text NOT NULL,
  state text NOT NULL DEFAULT 'proposed',
  aspiration_statement text NOT NULL,
  business_need text NOT NULL DEFAULT '',
  seat_availability text NOT NULL DEFAULT 'unknown',
  transition_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  training_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  proof_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  authority_change_proposal text NOT NULL DEFAULT '',
  compensation_change_proposal text NOT NULL DEFAULT '',
  review_at timestamptz,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'internal',
  schema_version text NOT NULL DEFAULT 'career-path-hypothesis-v1.0',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_career_path_hypotheses_origin_check CHECK (origin IN ('employee', 'manager')),
  CONSTRAINT eos_career_path_hypotheses_transition_type_check CHECK (transition_type IN ('level_promotion', 'management_path', 'senior_ic_path', 'leadership_path', 'lateral_adjacent', 'cross_functional', 'recovery_reposition')),
  CONSTRAINT eos_career_path_hypotheses_track_check CHECK (career_track IN ('individual_contributor', 'management', 'leadership', 'executive', 'cross_functional')),
  CONSTRAINT eos_career_path_hypotheses_state_check CHECK (state IN ('proposed', 'under_review', 'development_active', 'evidence_ready', 'endorsed', 'declined', 'withdrawn')),
  CONSTRAINT eos_career_path_hypotheses_seat_check CHECK (seat_availability IN ('unknown', 'available', 'unavailable', 'not_required')),
  CONSTRAINT eos_career_path_hypotheses_target_check CHECK (length(trim(target_role)) >= 3 OR target_position_agreement_id IS NOT NULL),
  CONSTRAINT eos_career_path_hypotheses_criteria_check CHECK (jsonb_array_length(transition_criteria) > 0),
  CONSTRAINT eos_career_path_hypotheses_proof_check CHECK (jsonb_array_length(proof_requirements) > 0),
  CONSTRAINT eos_career_path_hypotheses_authority_check CHECK (source_authority IN ('native_eos', 'notion_runtime', 'external_authoritative', 'reconciled')),
  CONSTRAINT eos_career_path_hypotheses_classification_check CHECK (classification IN ('internal', 'confidential', 'restricted'))
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_career_path_hypotheses_company_key_idx
  ON eos_career_path_hypotheses(company_id, path_key);

CREATE INDEX IF NOT EXISTS eos_career_path_hypotheses_subject_state_idx
  ON eos_career_path_hypotheses(subject_seat_id, state, review_at);

CREATE INDEX IF NOT EXISTS eos_career_path_hypotheses_sponsor_state_idx
  ON eos_career_path_hypotheses(sponsor_seat_id, state);

COMMENT ON TABLE eos_career_path_hypotheses IS
  'Employee-visible, evidence-backed career and mobility hypotheses. Endorsement never inserts or updates a seat, assignment, Authority Grant, compensation, or employment decision.';
