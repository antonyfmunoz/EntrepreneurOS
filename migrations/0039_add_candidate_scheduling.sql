-- Candidate-visible scheduling loop. Calendar event creation remains a
-- provider adapter concern; this native record is the standalone-safe source
-- of proposed slots, candidate choice, and reconciliation state.

CREATE TABLE IF NOT EXISTS eos_talent_scheduling_requests (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  application_id text NOT NULL REFERENCES eos_talent_applications(id) ON DELETE CASCADE,
  scheduling_kind text NOT NULL DEFAULT 'interview',
  state text NOT NULL DEFAULT 'proposed',
  proposed_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_slot text,
  scheduling_url text NOT NULL DEFAULT '',
  team_note text NOT NULL DEFAULT '',
  candidate_timezone text NOT NULL DEFAULT '',
  candidate_availability text NOT NULL DEFAULT '',
  candidate_message text NOT NULL DEFAULT '',
  source_system text NOT NULL DEFAULT 'native_eos',
  external_event_reference text,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_talent_scheduling_kind_check CHECK (scheduling_kind IN ('intro','interview','work_sample','trial','decision_conversation')),
  CONSTRAINT eos_talent_scheduling_state_check CHECK (state IN ('proposed','accepted','alternative_requested','declined','cancelled','completed')),
  CONSTRAINT eos_talent_scheduling_slots_check CHECK (jsonb_typeof(proposed_slots) = 'array'),
  CONSTRAINT eos_talent_scheduling_source_check CHECK (source_system IN ('native_eos','google_calendar','external_scheduling'))
);
CREATE INDEX IF NOT EXISTS eos_talent_scheduling_application_state_idx ON eos_talent_scheduling_requests(application_id, state, created_at);

ALTER TABLE eos_talent_portal_events DROP CONSTRAINT IF EXISTS eos_talent_portal_events_type_check;
ALTER TABLE eos_talent_portal_events ADD CONSTRAINT eos_talent_portal_events_type_check CHECK (event_type IN ('portal_viewed','intake_saved','intake_submitted','assessment_submitted','evidence_submitted','evidence_withdrawn','candidate_question_submitted','team_message_sent','correction_requested','consent_withdrawn','application_withdrawn','deletion_requested','scheduling_responded'));
