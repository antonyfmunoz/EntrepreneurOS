ALTER TABLE eos_talent_assessments
  ADD COLUMN IF NOT EXISTS generation_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS generated_sequence integer,
  ADD COLUMN IF NOT EXISTS generation_model text,
  ADD COLUMN IF NOT EXISTS generation_governance_version text,
  ADD COLUMN IF NOT EXISTS generation_input_sha256 text,
  ADD COLUMN IF NOT EXISTS generation_rationale text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS information_gap text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS role_hypotheses_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE eos_talent_assessments
  DROP CONSTRAINT IF EXISTS eos_talent_assessments_generation_mode_check,
  ADD CONSTRAINT eos_talent_assessments_generation_mode_check CHECK (generation_mode IN ('manual','ai','deterministic_fallback')),
  DROP CONSTRAINT IF EXISTS eos_talent_assessments_generation_sequence_check,
  ADD CONSTRAINT eos_talent_assessments_generation_sequence_check CHECK ((generation_mode = 'manual' AND generated_sequence IS NULL) OR (generation_mode <> 'manual' AND generated_sequence BETWEEN 1 AND 5)),
  DROP CONSTRAINT IF EXISTS eos_talent_assessments_generation_hash_check,
  ADD CONSTRAINT eos_talent_assessments_generation_hash_check CHECK (generation_input_sha256 IS NULL OR generation_input_sha256 ~ '^[a-f0-9]{64}$');

CREATE UNIQUE INDEX IF NOT EXISTS eos_talent_assessments_adaptive_sequence_idx
  ON eos_talent_assessments (application_id, generated_sequence)
  WHERE generation_mode <> 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS eos_talent_assessments_adaptive_open_idx
  ON eos_talent_assessments (application_id)
  WHERE generation_mode <> 'manual' AND state IN ('planned','candidate_action');

ALTER TABLE eos_talent_portal_events
  DROP CONSTRAINT IF EXISTS eos_talent_portal_events_type_check,
  ADD CONSTRAINT eos_talent_portal_events_type_check CHECK (event_type IN ('portal_viewed','intake_saved','intake_submitted','assessment_submitted','evidence_submitted','evidence_withdrawn','candidate_question_submitted','team_message_sent','correction_requested','consent_withdrawn','application_withdrawn','deletion_requested','scheduling_responded','voice_processing_consented','voice_processing_withdrawn','voice_transcription_completed','voice_transcription_failed','adaptive_questioning_consented','adaptive_question_generated','adaptive_question_answered','adaptive_questioning_withdrawn'));
