CREATE TABLE IF NOT EXISTS eos_pre_live_qualification_runs (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  run_key text NOT NULL,
  title text NOT NULL,
  objective text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_progress','blocked','qualified','released','rejected','aborted')),
  module_ids jsonb NOT NULL CHECK (jsonb_typeof(module_ids) = 'array' AND jsonb_array_length(module_ids) BETWEEN 1 AND 14),
  capability_keys jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(capability_keys) = 'array'),
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  closure_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  blocker_summary text NOT NULL DEFAULT '',
  decision_rationale text NOT NULL DEFAULT '',
  decision_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(decision_evidence_ids) = 'array'),
  classification text NOT NULL DEFAULT 'confidential' CHECK (classification IN ('internal','confidential','restricted')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  started_at timestamptz,
  qualified_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_pre_live_runs_release_check CHECK (status NOT IN ('released','rejected') OR (decided_at IS NOT NULL AND decision_rationale <> '' AND jsonb_array_length(decision_evidence_ids) > 0))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_pre_live_runs_company_key_idx ON eos_pre_live_qualification_runs(company_id, run_key);
CREATE INDEX IF NOT EXISTS eos_pre_live_runs_owner_status_idx ON eos_pre_live_qualification_runs(owner_seat_id, status);
CREATE INDEX IF NOT EXISTS eos_pre_live_runs_company_updated_idx ON eos_pre_live_qualification_runs(company_id, updated_at);

CREATE TABLE IF NOT EXISTS eos_pre_live_qualification_scenarios (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  run_id text NOT NULL REFERENCES eos_pre_live_qualification_runs(id) ON DELETE CASCADE,
  scenario_key text NOT NULL,
  scenario_type text NOT NULL CHECK (scenario_type IN ('normal_flow','authority_denial','provider_unavailable','failure_recovery','rollback','tenant_isolation','audit_replay')),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','passed','failed','blocked')),
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_ids) = 'array'),
  result_summary text NOT NULL DEFAULT '',
  blocker text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_pre_live_scenarios_result_check CHECK (status = 'planned' OR (jsonb_array_length(evidence_ids) > 0 AND result_summary <> '')),
  CONSTRAINT eos_pre_live_scenarios_blocker_check CHECK ((status = 'passed' AND blocker = '') OR (status IN ('failed','blocked') AND blocker <> '') OR status = 'planned')
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_pre_live_scenarios_run_type_idx ON eos_pre_live_qualification_scenarios(run_id, scenario_type);
CREATE INDEX IF NOT EXISTS eos_pre_live_scenarios_company_status_idx ON eos_pre_live_qualification_scenarios(company_id, status);

CREATE TABLE IF NOT EXISTS eos_pre_live_qualification_events (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  run_id text NOT NULL REFERENCES eos_pre_live_qualification_runs(id) ON DELETE RESTRICT,
  sequence integer NOT NULL CHECK (sequence > 0),
  action text NOT NULL CHECK (action IN ('created','started','scenario_recorded','qualified','released','rejected','reopened','aborted')),
  from_status text NOT NULL CHECK (from_status IN ('none','draft','in_progress','blocked','qualified','released','rejected','aborted')),
  to_status text NOT NULL CHECK (to_status IN ('draft','in_progress','blocked','qualified','released','rejected','aborted')),
  event_projection jsonb NOT NULL,
  event_sha256 text NOT NULL CHECK (length(event_sha256) = 64),
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_ids) = 'array'),
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_pre_live_events_run_sequence_idx ON eos_pre_live_qualification_events(run_id, sequence);
CREATE INDEX IF NOT EXISTS eos_pre_live_events_company_recorded_idx ON eos_pre_live_qualification_events(company_id, recorded_at);

CREATE OR REPLACE FUNCTION eos_prevent_pre_live_qualification_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'pre-live qualification events are append-only'; END $$;
DROP TRIGGER IF EXISTS eos_pre_live_qualification_events_immutable ON eos_pre_live_qualification_events;
CREATE TRIGGER eos_pre_live_qualification_events_immutable BEFORE UPDATE OR DELETE ON eos_pre_live_qualification_events FOR EACH ROW EXECUTE FUNCTION eos_prevent_pre_live_qualification_event_mutation();
