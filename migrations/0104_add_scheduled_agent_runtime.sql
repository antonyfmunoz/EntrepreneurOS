CREATE TABLE IF NOT EXISTS eos_agent_schedules (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  schedule_key text NOT NULL,
  name text NOT NULL,
  seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  authority_subject_id text NOT NULL REFERENCES eos_authority_subjects(id) ON DELETE RESTRICT,
  process_definition_id text NOT NULL REFERENCES eos_process_definitions(id) ON DELETE RESTRICT,
  trigger_kind text NOT NULL,
  cadence text NOT NULL,
  event_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  execution_mode text NOT NULL,
  input_template jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'draft',
  next_run_at timestamptz,
  last_run_at timestamptz,
  max_runs_per_day integer NOT NULL DEFAULT 24,
  evaluation_required boolean NOT NULL DEFAULT true,
  classification text NOT NULL DEFAULT 'confidential',
  version integer NOT NULL DEFAULT 1,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_agent_schedules_trigger_check CHECK (trigger_kind IN ('schedule','event','manual')),
  CONSTRAINT eos_agent_schedules_cadence_check CHECK (cadence IN ('once','hourly','daily','weekly','monthly','event','manual')),
  CONSTRAINT eos_agent_schedules_mode_check CHECK (execution_mode IN ('manual','assisted','delegated','autonomous')),
  CONSTRAINT eos_agent_schedules_no_delegated_mode_check CHECK (execution_mode <> 'delegated'),
  CONSTRAINT eos_agent_schedules_state_check CHECK (state IN ('draft','active','paused','retired')),
  CONSTRAINT eos_agent_schedules_version_check CHECK (version > 0),
  CONSTRAINT eos_agent_schedules_daily_limit_check CHECK (max_runs_per_day BETWEEN 1 AND 1440),
  CONSTRAINT eos_agent_schedules_classification_check CHECK (classification IN ('internal','confidential','restricted')),
  CONSTRAINT eos_agent_schedules_event_array_check CHECK (jsonb_typeof(event_types) = 'array'),
  CONSTRAINT eos_agent_schedules_trigger_configuration_check CHECK (
    (trigger_kind = 'event' AND cadence = 'event' AND jsonb_array_length(event_types) > 0 AND next_run_at IS NULL) OR
    (trigger_kind = 'manual' AND cadence = 'manual' AND jsonb_array_length(event_types) = 0 AND next_run_at IS NULL) OR
    (trigger_kind = 'schedule' AND cadence IN ('once','hourly','daily','weekly','monthly') AND jsonb_array_length(event_types) = 0 AND next_run_at IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_agent_schedules_company_key_idx ON eos_agent_schedules(company_id, schedule_key);
CREATE INDEX IF NOT EXISTS eos_agent_schedules_due_idx ON eos_agent_schedules(state, next_run_at);
CREATE INDEX IF NOT EXISTS eos_agent_schedules_event_idx ON eos_agent_schedules(company_id, trigger_kind, state);

CREATE TABLE IF NOT EXISTS eos_agent_run_evaluations (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workflow_run_id text NOT NULL REFERENCES eos_workflow_runs(id) ON DELETE CASCADE,
  schedule_id text REFERENCES eos_agent_schedules(id) ON DELETE SET NULL,
  evaluator_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  outcome text NOT NULL,
  scores jsonb NOT NULL,
  rationale text NOT NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  learning_proposal text NOT NULL DEFAULT '',
  learning_state text NOT NULL DEFAULT 'not_proposed',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_agent_run_evaluations_outcome_check CHECK (outcome IN ('passed','needs_review','failed')),
  CONSTRAINT eos_agent_run_evaluations_learning_check CHECK (learning_state IN ('not_proposed','proposed','accepted','rejected')),
  CONSTRAINT eos_agent_run_evaluations_evidence_array_check CHECK (jsonb_typeof(evidence_ids) = 'array'),
  CONSTRAINT eos_agent_run_evaluations_scores_check CHECK (
    scores ?& ARRAY['correctness','authorityCompliance','evidenceQuality','usefulness','efficiency']
    AND (scores->>'correctness')::numeric BETWEEN 0 AND 1
    AND (scores->>'authorityCompliance')::numeric BETWEEN 0 AND 1
    AND (scores->>'evidenceQuality')::numeric BETWEEN 0 AND 1
    AND (scores->>'usefulness')::numeric BETWEEN 0 AND 1
    AND (scores->>'efficiency')::numeric BETWEEN 0 AND 1
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_agent_run_evaluations_run_idx ON eos_agent_run_evaluations(workflow_run_id);
CREATE INDEX IF NOT EXISTS eos_agent_run_evaluations_company_outcome_idx ON eos_agent_run_evaluations(company_id, outcome, created_at);
