CREATE TABLE IF NOT EXISTS eos_skill_definitions (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  skill_key text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  state text NOT NULL DEFAULT 'draft',
  handler_kind text NOT NULL,
  handler_reference text NOT NULL,
  provider_binding_id text REFERENCES eos_integration_bindings(id) ON DELETE RESTRICT,
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  allowed_modes jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_authority jsonb NOT NULL DEFAULT '[]'::jsonb,
  tool_entitlements jsonb NOT NULL DEFAULT '[]'::jsonb,
  timeout_ms integer NOT NULL DEFAULT 60000,
  max_attempts integer NOT NULL DEFAULT 3,
  evidence_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  classification text NOT NULL DEFAULT 'confidential',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_skill_definitions_state_check CHECK (state IN ('draft','review','released','paused','retired')),
  CONSTRAINT eos_skill_definitions_handler_check CHECK (handler_kind IN ('manual','native','provider','projection')),
  CONSTRAINT eos_skill_definitions_version_check CHECK (version > 0),
  CONSTRAINT eos_skill_definitions_attempts_check CHECK (max_attempts BETWEEN 1 AND 20),
  CONSTRAINT eos_skill_definitions_timeout_check CHECK (timeout_ms BETWEEN 100 AND 3600000),
  CONSTRAINT eos_skill_definitions_classification_check CHECK (classification IN ('internal','confidential','restricted')),
  CONSTRAINT eos_skill_definitions_modes_array_check CHECK (jsonb_typeof(allowed_modes) = 'array'),
  CONSTRAINT eos_skill_definitions_provider_check CHECK ((handler_kind = 'provider' AND provider_binding_id IS NOT NULL) OR (handler_kind <> 'provider' AND provider_binding_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_skill_definitions_company_key_version_idx ON eos_skill_definitions(company_id, skill_key, version);
CREATE INDEX IF NOT EXISTS eos_skill_definitions_company_state_idx ON eos_skill_definitions(company_id, state);

CREATE TABLE IF NOT EXISTS eos_workflow_runs (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  run_key text NOT NULL,
  process_definition_id text NOT NULL REFERENCES eos_process_definitions(id) ON DELETE RESTRICT,
  work_packet_id text REFERENCES eos_work_packets(id) ON DELETE RESTRICT,
  execution_mode text NOT NULL,
  state text NOT NULL DEFAULT 'queued',
  current_step integer NOT NULL DEFAULT 0,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  delegated_seat_id text REFERENCES eos_seats(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  approval_id text REFERENCES eos_approval_requests(id) ON DELETE SET NULL,
  blocker text NOT NULL DEFAULT '',
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  lease_owner text,
  lease_expires_at timestamptz,
  classification text NOT NULL DEFAULT 'confidential',
  version integer NOT NULL DEFAULT 1,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_workflow_runs_mode_check CHECK (execution_mode IN ('manual','assisted','delegated','autonomous')),
  CONSTRAINT eos_workflow_runs_state_check CHECK (state IN ('queued','running','waiting_input','waiting_approval','blocked','completed','failed','cancelled')),
  CONSTRAINT eos_workflow_runs_version_check CHECK (version > 0),
  CONSTRAINT eos_workflow_runs_step_check CHECK (current_step >= 0),
  CONSTRAINT eos_workflow_runs_delegation_check CHECK ((execution_mode = 'delegated' AND delegated_seat_id IS NOT NULL) OR (execution_mode <> 'delegated' AND delegated_seat_id IS NULL)),
  CONSTRAINT eos_workflow_runs_classification_check CHECK (classification IN ('internal','confidential','restricted')),
  CONSTRAINT eos_workflow_runs_evidence_array_check CHECK (jsonb_typeof(evidence_ids) = 'array'),
  CONSTRAINT eos_workflow_runs_lease_check CHECK ((lease_owner IS NULL AND lease_expires_at IS NULL) OR (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_workflow_runs_company_key_idx ON eos_workflow_runs(company_id, run_key);
CREATE UNIQUE INDEX IF NOT EXISTS eos_workflow_runs_company_idempotency_idx ON eos_workflow_runs(company_id, idempotency_key);
CREATE INDEX IF NOT EXISTS eos_workflow_runs_company_state_schedule_idx ON eos_workflow_runs(company_id, state, scheduled_for);
CREATE INDEX IF NOT EXISTS eos_workflow_runs_owner_state_idx ON eos_workflow_runs(owner_seat_id, state);

CREATE TABLE IF NOT EXISTS eos_workflow_run_events (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES eos_workflow_runs(id) ON DELETE CASCADE,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  action text NOT NULL,
  from_state text NOT NULL,
  to_state text NOT NULL,
  actor_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  event_projection jsonb NOT NULL,
  event_sha256 text NOT NULL,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_workflow_run_events_sequence_check CHECK (sequence > 0),
  CONSTRAINT eos_workflow_run_events_hash_check CHECK (event_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_workflow_run_events_sequence_idx ON eos_workflow_run_events(run_id, sequence);
CREATE INDEX IF NOT EXISTS eos_workflow_run_events_company_time_idx ON eos_workflow_run_events(company_id, recorded_at);

CREATE TABLE IF NOT EXISTS eos_skill_invocations (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  run_id text NOT NULL REFERENCES eos_workflow_runs(id) ON DELETE CASCADE,
  skill_definition_id text NOT NULL REFERENCES eos_skill_definitions(id) ON DELETE RESTRICT,
  step_index integer NOT NULL,
  state text NOT NULL DEFAULT 'queued',
  attempt integer NOT NULL DEFAULT 1,
  idempotency_key text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text NOT NULL DEFAULT '',
  provider_execution_id text REFERENCES eos_provider_executions(id) ON DELETE SET NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_skill_invocations_state_check CHECK (state IN ('queued','running','waiting_approval','completed','failed','cancelled')),
  CONSTRAINT eos_skill_invocations_attempt_check CHECK (attempt > 0),
  CONSTRAINT eos_skill_invocations_step_check CHECK (step_index >= 0),
  CONSTRAINT eos_skill_invocations_evidence_array_check CHECK (jsonb_typeof(evidence_ids) = 'array')
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_skill_invocations_run_idempotency_idx ON eos_skill_invocations(run_id, idempotency_key);
CREATE INDEX IF NOT EXISTS eos_skill_invocations_run_step_idx ON eos_skill_invocations(run_id, step_index, attempt);

CREATE OR REPLACE FUNCTION eos_workflow_run_projection_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE matching_event_count integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.version <> 1 OR NEW.state <> 'queued' THEN RAISE EXCEPTION 'workflow runs must begin queued at version 1'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.portfolio_id IS DISTINCT FROM OLD.portfolio_id
    OR NEW.run_key IS DISTINCT FROM OLD.run_key OR NEW.process_definition_id IS DISTINCT FROM OLD.process_definition_id
    OR NEW.work_packet_id IS DISTINCT FROM OLD.work_packet_id OR NEW.execution_mode IS DISTINCT FROM OLD.execution_mode
    OR NEW.owner_seat_id IS DISTINCT FROM OLD.owner_seat_id OR NEW.delegated_seat_id IS DISTINCT FROM OLD.delegated_seat_id
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR NEW.input IS DISTINCT FROM OLD.input
    OR NEW.classification IS DISTINCT FROM OLD.classification OR NEW.recorded_by_user_id IS DISTINCT FROM OLD.recorded_by_user_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'workflow run identity, input, authority and custody are immutable'; END IF;
  IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'workflow run version must advance exactly once'; END IF;
  SELECT count(*) INTO matching_event_count FROM eos_workflow_run_events
    WHERE run_id = NEW.id AND sequence = NEW.version AND from_state = OLD.state AND to_state = NEW.state
      AND event_projection->>'runId' = NEW.id;
  IF matching_event_count <> 1 THEN RAISE EXCEPTION 'workflow run projection requires one exact immutable event'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS eos_workflow_run_projection_guard_trigger ON eos_workflow_runs;
CREATE TRIGGER eos_workflow_run_projection_guard_trigger BEFORE INSERT OR UPDATE ON eos_workflow_runs
FOR EACH ROW EXECUTE FUNCTION eos_workflow_run_projection_guard();

CREATE OR REPLACE FUNCTION eos_workflow_event_immutable_guard()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'workflow run events are immutable'; END $$;
DROP TRIGGER IF EXISTS eos_workflow_event_immutable_guard_trigger ON eos_workflow_run_events;
CREATE TRIGGER eos_workflow_event_immutable_guard_trigger BEFORE UPDATE OR DELETE ON eos_workflow_run_events
FOR EACH ROW EXECUTE FUNCTION eos_workflow_event_immutable_guard();
