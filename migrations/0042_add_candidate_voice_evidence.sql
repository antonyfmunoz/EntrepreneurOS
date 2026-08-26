ALTER TABLE eos_talent_candidate_evidence
  ADD COLUMN IF NOT EXISTS transcription_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transcription_state text NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS transcript text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transcription_provider text,
  ADD COLUMN IF NOT EXISTS transcription_model text,
  ADD COLUMN IF NOT EXISTS transcription_completed_at timestamptz;

ALTER TABLE eos_talent_candidate_evidence
  DROP CONSTRAINT IF EXISTS eos_talent_candidate_evidence_type_check,
  ADD CONSTRAINT eos_talent_candidate_evidence_type_check CHECK (evidence_type IN ('portfolio_link','resume_link','work_sample_link','reference_link','candidate_statement','other_link','portfolio_file','resume_file','work_sample_file','assessment_file','other_file','voice_response_file')),
  DROP CONSTRAINT IF EXISTS eos_talent_candidate_evidence_transcription_state_check,
  ADD CONSTRAINT eos_talent_candidate_evidence_transcription_state_check CHECK (transcription_state IN ('not_requested','awaiting_scan','completed','unavailable','failed','declined')),
  DROP CONSTRAINT IF EXISTS eos_talent_candidate_evidence_transcription_scope_check,
  ADD CONSTRAINT eos_talent_candidate_evidence_transcription_scope_check CHECK (transcription_requested = false OR evidence_type = 'voice_response_file');

ALTER TABLE eos_talent_portal_events
  DROP CONSTRAINT IF EXISTS eos_talent_portal_events_type_check,
  ADD CONSTRAINT eos_talent_portal_events_type_check CHECK (event_type IN ('portal_viewed','intake_saved','intake_submitted','assessment_submitted','evidence_submitted','evidence_withdrawn','candidate_question_submitted','team_message_sent','correction_requested','consent_withdrawn','application_withdrawn','deletion_requested','scheduling_responded','voice_processing_consented','voice_processing_withdrawn','voice_transcription_completed','voice_transcription_failed'));
