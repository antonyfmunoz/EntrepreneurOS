-- External candidate portal boundary. Raw invitation tokens are never stored;
-- candidate actions are logged separately from internal user-attributed audit.

ALTER TABLE eos_talent_applications
  ADD COLUMN IF NOT EXISTS portal_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_last_accessed_at timestamptz,
  ADD COLUMN IF NOT EXISTS retention_until timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_issue_count integer NOT NULL DEFAULT 0;

ALTER TABLE eos_talent_applications
  ALTER COLUMN schema_version SET DEFAULT 'talent-application-v1.1';

CREATE TABLE IF NOT EXISTS eos_talent_candidate_evidence (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  application_id text NOT NULL REFERENCES eos_talent_applications(id) ON DELETE CASCADE,
  evidence_key text NOT NULL,
  title text NOT NULL,
  evidence_type text NOT NULL,
  source_url text NOT NULL DEFAULT '',
  candidate_statement text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'submitted',
  classification text NOT NULL DEFAULT 'confidential',
  schema_version text NOT NULL DEFAULT 'talent-candidate-evidence-v1.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_talent_candidate_evidence_type_check CHECK (evidence_type IN ('portfolio_link','resume_link','work_sample_link','reference_link','candidate_statement','other_link')),
  CONSTRAINT eos_talent_candidate_evidence_state_check CHECK (state IN ('submitted','withdrawn','promoted')),
  CONSTRAINT eos_talent_candidate_evidence_payload_check CHECK (source_url <> '' OR candidate_statement <> ''),
  CONSTRAINT eos_talent_candidate_evidence_classification_check CHECK (classification IN ('confidential','restricted')),
  UNIQUE(company_id, evidence_key)
);
CREATE INDEX IF NOT EXISTS eos_talent_candidate_evidence_application_state_idx ON eos_talent_candidate_evidence(application_id, state);

CREATE TABLE IF NOT EXISTS eos_talent_candidate_messages (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  application_id text NOT NULL REFERENCES eos_talent_applications(id) ON DELETE CASCADE,
  direction text NOT NULL,
  body text NOT NULL,
  sent_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_talent_candidate_messages_direction_check CHECK (direction IN ('candidate_to_team','team_to_candidate'))
);
CREATE INDEX IF NOT EXISTS eos_talent_candidate_messages_application_created_idx ON eos_talent_candidate_messages(application_id, created_at);

CREATE TABLE IF NOT EXISTS eos_talent_portal_events (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  application_id text NOT NULL REFERENCES eos_talent_applications(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  trace_id text NOT NULL,
  correlation_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_talent_portal_events_type_check CHECK (event_type IN ('portal_viewed','intake_saved','intake_submitted','assessment_submitted','evidence_submitted','evidence_withdrawn','candidate_question_submitted','team_message_sent','correction_requested','consent_withdrawn','application_withdrawn','deletion_requested'))
);
CREATE INDEX IF NOT EXISTS eos_talent_portal_events_application_created_idx ON eos_talent_portal_events(application_id, created_at);

CREATE OR REPLACE FUNCTION eos_protect_talent_portal_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Talent portal events are append-only';
END $$;
DROP TRIGGER IF EXISTS eos_talent_portal_events_append_only ON eos_talent_portal_events;
CREATE TRIGGER eos_talent_portal_events_append_only BEFORE UPDATE OR DELETE ON eos_talent_portal_events FOR EACH ROW EXECUTE FUNCTION eos_protect_talent_portal_event();
