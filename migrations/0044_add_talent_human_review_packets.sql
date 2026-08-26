CREATE TABLE IF NOT EXISTS eos_talent_review_packets (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  application_id text NOT NULL REFERENCES eos_talent_applications(id) ON DELETE CASCADE,
  packet_key text NOT NULL,
  version integer NOT NULL,
  state text NOT NULL DEFAULT 'draft',
  stage_snapshot text NOT NULL,
  source_application_updated_at timestamptz NOT NULL,
  role_hypotheses_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_outcomes_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  role_assessments jsonb NOT NULL DEFAULT '[]'::jsonb,
  outcome_coverage jsonb NOT NULL DEFAULT '[]'::jsonb,
  proof_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_assessment jsonb,
  interview_focus jsonb NOT NULL DEFAULT '[]'::jsonb,
  team_fit_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  packet_summary text NOT NULL DEFAULT '',
  assessment_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  candidate_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  verified_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  materialized_assessment_id text REFERENCES eos_talent_assessments(id) ON DELETE SET NULL,
  reviewer_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  reviewer_decision text NOT NULL DEFAULT '',
  reviewer_rationale text NOT NULL DEFAULT '',
  signed_off_at timestamptz,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'restricted',
  schema_version text NOT NULL DEFAULT 'talent-review-packet-v1.0',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_talent_review_packets_state_check CHECK (state IN ('draft','ready_for_review','in_review','signed_off','superseded','cancelled')),
  CONSTRAINT eos_talent_review_packets_version_check CHECK (version > 0),
  CONSTRAINT eos_talent_review_packets_json_check CHECK (
    jsonb_typeof(role_hypotheses_snapshot) = 'array' AND
    jsonb_typeof(required_outcomes_snapshot) = 'array' AND
    jsonb_typeof(role_assessments) = 'array' AND
    jsonb_typeof(outcome_coverage) = 'array' AND
    jsonb_typeof(proof_gaps) = 'array' AND
    jsonb_typeof(interview_focus) = 'array' AND
    jsonb_typeof(team_fit_questions) = 'array' AND
    jsonb_typeof(assessment_ids) = 'array' AND
    jsonb_typeof(candidate_evidence_ids) = 'array' AND
    jsonb_typeof(verified_evidence_ids) = 'array' AND
    (next_assessment IS NULL OR jsonb_typeof(next_assessment) = 'object')
  ),
  CONSTRAINT eos_talent_review_packets_recommendation_check CHECK (reviewer_decision IN ('','collect_more_evidence','interview_ready','trial_recommended','decision_ready','hold','do_not_advance_recommendation')),
  CONSTRAINT eos_talent_review_packets_signoff_check CHECK (state <> 'signed_off' OR (signed_off_at IS NOT NULL AND reviewer_decision <> '' AND reviewer_rationale <> '')),
  CONSTRAINT eos_talent_review_packets_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_talent_review_packets_classification_check CHECK (classification IN ('confidential','restricted')),
  UNIQUE(company_id, packet_key),
  UNIQUE(application_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_talent_review_packets_open_idx
  ON eos_talent_review_packets(application_id)
  WHERE state IN ('draft','ready_for_review','in_review');

CREATE INDEX IF NOT EXISTS eos_talent_review_packets_reviewer_state_idx
  ON eos_talent_review_packets(reviewer_seat_id, state, updated_at);

DROP TRIGGER IF EXISTS eos_talent_review_packets_protect_external ON eos_talent_review_packets;
CREATE TRIGGER eos_talent_review_packets_protect_external
  BEFORE UPDATE OR DELETE ON eos_talent_review_packets
  FOR EACH ROW EXECUTE FUNCTION eos_protect_external_talent_projection();
