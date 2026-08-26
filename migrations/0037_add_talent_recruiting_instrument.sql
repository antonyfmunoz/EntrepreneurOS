-- Talent and recruiting control instrument. The lifecycle starts with an
-- institutional capability gap and preserves one stakeholder/person identity
-- through assessment, placement, onboarding, and assignment activation.

CREATE TABLE IF NOT EXISTS eos_talent_needs (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  need_key text NOT NULL,
  title text NOT NULL,
  target_seat_id text REFERENCES eos_seats(id) ON DELETE SET NULL,
  capability_instance_id text REFERENCES eos_capability_instances(id) ON DELETE SET NULL,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'identified',
  urgency text NOT NULL DEFAULT 'planned',
  rationale text NOT NULL,
  required_outcomes jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_now boolean NOT NULL DEFAULT false,
  budget_constraint text NOT NULL DEFAULT '',
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'confidential',
  schema_version text NOT NULL DEFAULT 'talent-need-v1.0',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_talent_needs_state_check CHECK (state IN ('identified','validated','open','paused','filled','closed')),
  CONSTRAINT eos_talent_needs_urgency_check CHECK (urgency IN ('planned','soon','urgent','critical')),
  CONSTRAINT eos_talent_needs_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_talent_needs_classification_check CHECK (classification IN ('internal','confidential','restricted')),
  UNIQUE(company_id, need_key)
);
CREATE INDEX IF NOT EXISTS eos_talent_needs_owner_state_idx ON eos_talent_needs(owner_seat_id, state, urgency);
CREATE INDEX IF NOT EXISTS eos_talent_needs_target_state_idx ON eos_talent_needs(target_seat_id, state);

CREATE TABLE IF NOT EXISTS eos_talent_applications (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  application_key text NOT NULL,
  candidate_stakeholder_id text NOT NULL REFERENCES eos_stakeholders(id) ON DELETE RESTRICT,
  candidate_user_id text REFERENCES users(id) ON DELETE SET NULL,
  talent_need_id text NOT NULL REFERENCES eos_talent_needs(id) ON DELETE RESTRICT,
  target_seat_id text REFERENCES eos_seats(id) ON DELETE SET NULL,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'invited',
  candidate_summary text NOT NULL DEFAULT '',
  candidate_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  candidate_correction text NOT NULL DEFAULT '',
  correction_status text NOT NULL DEFAULT 'none',
  consent_state text NOT NULL DEFAULT 'pending',
  consent_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  role_hypotheses jsonb NOT NULL DEFAULT '[]'::jsonb,
  proof_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  internal_notes text NOT NULL DEFAULT '',
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  portal_token_hash text,
  portal_expires_at timestamptz,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'confidential',
  schema_version text NOT NULL DEFAULT 'talent-application-v1.0',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_talent_applications_state_check CHECK (state IN ('invited','intake_started','intake_submitted','assessments_incomplete','assessments_complete','internal_review','interview_ready','trial_recommended','trial_active','decision','onboarding','activated','rejected','hold','withdrawn')),
  CONSTRAINT eos_talent_applications_correction_check CHECK (correction_status IN ('none','requested','resolved','rejected')),
  CONSTRAINT eos_talent_applications_consent_check CHECK (consent_state IN ('pending','granted','limited','withdrawn')),
  CONSTRAINT eos_talent_applications_portal_window_check CHECK (portal_token_hash IS NULL OR portal_expires_at IS NOT NULL),
  CONSTRAINT eos_talent_applications_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_talent_applications_classification_check CHECK (classification IN ('confidential','restricted')),
  UNIQUE(company_id, application_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_talent_applications_portal_token_idx ON eos_talent_applications(portal_token_hash) WHERE portal_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS eos_talent_applications_candidate_state_idx ON eos_talent_applications(candidate_stakeholder_id, state);
CREATE INDEX IF NOT EXISTS eos_talent_applications_need_state_idx ON eos_talent_applications(talent_need_id, state);
CREATE INDEX IF NOT EXISTS eos_talent_applications_owner_state_idx ON eos_talent_applications(owner_seat_id, state);

CREATE TABLE IF NOT EXISTS eos_talent_assessments (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  application_id text NOT NULL REFERENCES eos_talent_applications(id) ON DELETE CASCADE,
  assessment_key text NOT NULL,
  assessment_type text NOT NULL,
  title text NOT NULL,
  state text NOT NULL DEFAULT 'planned',
  decision_question text NOT NULL,
  evidence_expected text NOT NULL,
  validity_scope text NOT NULL DEFAULT '',
  candidate_burden text NOT NULL DEFAULT '',
  candidate_submission text NOT NULL DEFAULT '',
  internal_evaluation text NOT NULL DEFAULT '',
  consent_required boolean NOT NULL DEFAULT false,
  consent_captured boolean NOT NULL DEFAULT false,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'confidential',
  schema_version text NOT NULL DEFAULT 'talent-assessment-v1.0',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_talent_assessments_type_check CHECK (assessment_type IN ('eligibility','evidence_review','structured_interview','work_sample','simulation','reference','skills_test','job_relevant_cognitive','consented_contextual','paid_trial','other')),
  CONSTRAINT eos_talent_assessments_state_check CHECK (state IN ('planned','candidate_action','submitted','verified','reviewed','waived','cancelled')),
  CONSTRAINT eos_talent_assessments_consent_check CHECK (consent_required = false OR state IN ('planned','candidate_action','cancelled') OR consent_captured = true),
  CONSTRAINT eos_talent_assessments_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_talent_assessments_classification_check CHECK (classification IN ('confidential','restricted')),
  UNIQUE(company_id, assessment_key)
);
CREATE INDEX IF NOT EXISTS eos_talent_assessments_application_state_idx ON eos_talent_assessments(application_id, state, assessment_type);

CREATE TABLE IF NOT EXISTS eos_talent_placements (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  placement_key text NOT NULL,
  application_id text NOT NULL REFERENCES eos_talent_applications(id) ON DELETE RESTRICT,
  target_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  decided_by_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'pending',
  rationale text NOT NULL,
  offer_summary text NOT NULL DEFAULT '',
  candidate_response text NOT NULL DEFAULT '',
  onboarding_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  access_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  assignment_id text REFERENCES eos_assignments(id) ON DELETE SET NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'restricted',
  schema_version text NOT NULL DEFAULT 'talent-placement-v1.0',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_talent_placements_state_check CHECK (state IN ('pending','offer_approved','offer_accepted','offer_declined','rejected','hold','onboarding','activated','withdrawn')),
  CONSTRAINT eos_talent_placements_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_talent_placements_classification_check CHECK (classification IN ('confidential','restricted')),
  UNIQUE(company_id, placement_key),
  UNIQUE(application_id)
);
CREATE INDEX IF NOT EXISTS eos_talent_placements_target_state_idx ON eos_talent_placements(target_seat_id, state);

CREATE OR REPLACE FUNCTION eos_protect_external_talent_projection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.source_authority = 'external_authoritative' THEN
    RAISE EXCEPTION 'External-authoritative Talent projections are immutable; append a reconciled correction';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS eos_talent_needs_protect_external ON eos_talent_needs;
CREATE TRIGGER eos_talent_needs_protect_external BEFORE UPDATE OR DELETE ON eos_talent_needs FOR EACH ROW EXECUTE FUNCTION eos_protect_external_talent_projection();
DROP TRIGGER IF EXISTS eos_talent_applications_protect_external ON eos_talent_applications;
CREATE TRIGGER eos_talent_applications_protect_external BEFORE UPDATE OR DELETE ON eos_talent_applications FOR EACH ROW EXECUTE FUNCTION eos_protect_external_talent_projection();
DROP TRIGGER IF EXISTS eos_talent_assessments_protect_external ON eos_talent_assessments;
CREATE TRIGGER eos_talent_assessments_protect_external BEFORE UPDATE OR DELETE ON eos_talent_assessments FOR EACH ROW EXECUTE FUNCTION eos_protect_external_talent_projection();
DROP TRIGGER IF EXISTS eos_talent_placements_protect_external ON eos_talent_placements;
CREATE TRIGGER eos_talent_placements_protect_external BEFORE UPDATE OR DELETE ON eos_talent_placements FOR EACH ROW EXECUTE FUNCTION eos_protect_external_talent_projection();
