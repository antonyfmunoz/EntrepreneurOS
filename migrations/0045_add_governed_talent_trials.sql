CREATE TABLE IF NOT EXISTS eos_talent_trials (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  application_id text NOT NULL REFERENCES eos_talent_applications(id) ON DELETE CASCADE,
  target_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  review_packet_id text NOT NULL REFERENCES eos_talent_review_packets(id) ON DELETE RESTRICT,
  trial_key text NOT NULL,
  version integer NOT NULL,
  state text NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  question text NOT NULL,
  duration_days integer NOT NULL,
  compensation_amount_minor integer NOT NULL,
  compensation_currency text NOT NULL,
  compensation_terms text NOT NULL,
  legal_agreement_reference text NOT NULL,
  jurisdiction text NOT NULL,
  inputs_support jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_outputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  scorecard jsonb NOT NULL DEFAULT '[]'::jsonb,
  constraints_decision_rights jsonb NOT NULL DEFAULT '[]'::jsonb,
  observation_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_at timestamptz NOT NULL,
  outcome_criteria jsonb NOT NULL,
  candidate_instructions text NOT NULL,
  predicted_outcome text NOT NULL,
  predicted_confidence text NOT NULL DEFAULT 'insufficient',
  work_packet_id text NOT NULL REFERENCES eos_work_packets(id) ON DELETE RESTRICT,
  approval_id text NOT NULL REFERENCES eos_approval_requests(id) ON DELETE RESTRICT,
  candidate_acceptance text NOT NULL DEFAULT '',
  accepted_at timestamptz,
  candidate_submission text NOT NULL DEFAULT '',
  candidate_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  submitted_at timestamptz,
  scorecard_observations jsonb NOT NULL DEFAULT '[]'::jsonb,
  outcome text NOT NULL DEFAULT '',
  outcome_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  actual_outcome_summary text NOT NULL DEFAULT '',
  reviewer_seat_id text REFERENCES eos_seats(id) ON DELETE RESTRICT,
  reviewer_rationale text NOT NULL DEFAULT '',
  candidate_feedback text NOT NULL DEFAULT '',
  reviewed_at timestamptz,
  learning_proposal text NOT NULL DEFAULT '',
  learning_status text NOT NULL DEFAULT 'not_proposed',
  learning_decision_rationale text NOT NULL DEFAULT '',
  learning_reviewed_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  learning_reviewed_at timestamptz,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'restricted',
  schema_version text NOT NULL DEFAULT 'talent-trial-v1.0',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_talent_trials_state_check CHECK (state IN ('draft','approved','offered','accepted','active','submitted','under_review','passed','redirected','extended','failed','declined','cancelled')),
  CONSTRAINT eos_talent_trials_version_check CHECK (version > 0),
  CONSTRAINT eos_talent_trials_duration_check CHECK (duration_days BETWEEN 1 AND 30),
  CONSTRAINT eos_talent_trials_compensation_check CHECK (compensation_amount_minor > 0 AND compensation_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT eos_talent_trials_confidence_check CHECK (predicted_confidence IN ('insufficient','emerging','supported','contradicted')),
  CONSTRAINT eos_talent_trials_outcome_check CHECK (outcome IN ('','pass','redirect','extend','fail')),
  CONSTRAINT eos_talent_trials_learning_check CHECK (learning_status IN ('not_proposed','proposed','accepted','rejected')),
  CONSTRAINT eos_talent_trials_json_check CHECK (
    jsonb_typeof(inputs_support) = 'array'
    AND jsonb_typeof(required_outputs) = 'array'
    AND jsonb_typeof(scorecard) = 'array'
    AND jsonb_typeof(constraints_decision_rights) = 'array'
    AND jsonb_typeof(observation_points) = 'array'
    AND jsonb_typeof(outcome_criteria) = 'object'
    AND jsonb_typeof(candidate_evidence_ids) = 'array'
    AND jsonb_typeof(scorecard_observations) = 'array'
    AND jsonb_typeof(outcome_evidence_ids) = 'array'
  ),
  CONSTRAINT eos_talent_trials_review_check CHECK (
    state NOT IN ('passed','redirected','extended','failed')
    OR (
      reviewed_at IS NOT NULL
      AND reviewer_seat_id IS NOT NULL
      AND outcome <> ''
      AND actual_outcome_summary <> ''
      AND reviewer_rationale <> ''
      AND candidate_feedback <> ''
      AND learning_proposal <> ''
    )
  ),
  CONSTRAINT eos_talent_trials_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_talent_trials_classification_check CHECK (classification IN ('confidential','restricted'))
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_talent_trials_company_key_idx
  ON eos_talent_trials(company_id, trial_key);

CREATE UNIQUE INDEX IF NOT EXISTS eos_talent_trials_application_version_idx
  ON eos_talent_trials(application_id, version);

CREATE UNIQUE INDEX IF NOT EXISTS eos_talent_trials_open_idx
  ON eos_talent_trials(application_id)
  WHERE state IN ('draft','approved','offered','accepted','active','submitted','under_review');

CREATE INDEX IF NOT EXISTS eos_talent_trials_reviewer_state_idx
  ON eos_talent_trials(reviewer_seat_id, state, updated_at);

DROP TRIGGER IF EXISTS eos_talent_trials_protect_external ON eos_talent_trials;
CREATE TRIGGER eos_talent_trials_protect_external
  BEFORE UPDATE OR DELETE ON eos_talent_trials
  FOR EACH ROW EXECUTE FUNCTION eos_protect_external_talent_projection();

COMMENT ON TABLE eos_talent_trials IS
  'Governed paid-trial contracts. Reuses Work Packet approval and Evidence; never grants employment, payment, assignment, access, or authority.';

ALTER TABLE eos_talent_portal_events
  DROP CONSTRAINT IF EXISTS eos_talent_portal_events_type_check;

ALTER TABLE eos_talent_portal_events
  ADD CONSTRAINT eos_talent_portal_events_type_check CHECK (
    event_type IN (
      'portal_viewed','intake_saved','intake_submitted','assessment_submitted',
      'evidence_submitted','evidence_withdrawn','candidate_question_submitted',
      'team_message_sent','correction_requested','consent_withdrawn',
      'application_withdrawn','deletion_requested','scheduling_responded',
      'voice_processing_consented','voice_processing_withdrawn',
      'voice_transcription_completed','voice_transcription_failed',
      'adaptive_questioning_consented','adaptive_question_generated',
      'adaptive_question_answered','adaptive_questioning_withdrawn',
      'trial_accepted','trial_declined','trial_submitted'
    )
  );
