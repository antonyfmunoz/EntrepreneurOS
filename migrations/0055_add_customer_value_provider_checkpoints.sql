CREATE TABLE IF NOT EXISTS eos_customer_value_provider_checkpoints (
  id text PRIMARY KEY,
  cycle_id text NOT NULL REFERENCES eos_customer_value_cycles(id) ON DELETE CASCADE,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_binding_id text NOT NULL REFERENCES eos_integration_bindings(id) ON DELETE RESTRICT,
  provider_key text NOT NULL,
  phase_key text NOT NULL,
  operation_key text NOT NULL,
  state text NOT NULL DEFAULT 'required',
  version integer NOT NULL DEFAULT 1,
  contract_version text NOT NULL DEFAULT 'customer-value-provider-fixture.v1',
  scenario_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  request_hash text NOT NULL DEFAULT '',
  response_hash text NOT NULL DEFAULT '',
  evidence_id text REFERENCES eos_evidence(id) ON DELETE SET NULL,
  live_provider_blocker text NOT NULL,
  live_provider_verified boolean NOT NULL DEFAULT false,
  external_effects_executed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_customer_value_provider_checkpoint_provider_check CHECK (provider_key IN ('gohighlevel','stripe','docusign','google-workspace','notion')),
  CONSTRAINT eos_customer_value_provider_checkpoint_state_check CHECK (state IN ('required','contract_qualified','contract_failed')),
  CONSTRAINT eos_customer_value_provider_checkpoint_version_check CHECK (version > 0),
  CONSTRAINT eos_customer_value_provider_checkpoint_no_live_check CHECK (live_provider_verified = false),
  CONSTRAINT eos_customer_value_provider_checkpoint_no_effect_check CHECK (external_effects_executed = false)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_customer_value_provider_checkpoint_key_idx
  ON eos_customer_value_provider_checkpoints(cycle_id, provider_key);
CREATE INDEX IF NOT EXISTS eos_customer_value_provider_checkpoint_state_idx
  ON eos_customer_value_provider_checkpoints(company_id, state);

CREATE TABLE IF NOT EXISTS eos_customer_value_provider_fixture_runs (
  id text PRIMARY KEY,
  checkpoint_id text NOT NULL REFERENCES eos_customer_value_provider_checkpoints(id) ON DELETE CASCADE,
  cycle_id text NOT NULL REFERENCES eos_customer_value_cycles(id) ON DELETE CASCADE,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  sequence integer NOT NULL,
  result text NOT NULL,
  scenario_results jsonb NOT NULL,
  request_hash text NOT NULL,
  response_hash text NOT NULL,
  evidence_id text NOT NULL REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  trace_id text NOT NULL,
  correlation_id text NOT NULL,
  external_effects_executed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_customer_value_provider_fixture_run_result_check CHECK (result IN ('passed','failed')),
  CONSTRAINT eos_customer_value_provider_fixture_run_sequence_check CHECK (sequence > 0),
  CONSTRAINT eos_customer_value_provider_fixture_run_no_effect_check CHECK (external_effects_executed = false)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_customer_value_provider_fixture_run_sequence_idx
  ON eos_customer_value_provider_fixture_runs(checkpoint_id, sequence);
CREATE INDEX IF NOT EXISTS eos_customer_value_provider_fixture_run_cycle_idx
  ON eos_customer_value_provider_fixture_runs(cycle_id, created_at);

CREATE OR REPLACE FUNCTION eos_reject_customer_value_provider_fixture_run_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'customer value provider fixture runs are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eos_customer_value_provider_fixture_runs_append_only ON eos_customer_value_provider_fixture_runs;
CREATE TRIGGER eos_customer_value_provider_fixture_runs_append_only
BEFORE UPDATE OR DELETE ON eos_customer_value_provider_fixture_runs
FOR EACH ROW EXECUTE FUNCTION eos_reject_customer_value_provider_fixture_run_mutation();
