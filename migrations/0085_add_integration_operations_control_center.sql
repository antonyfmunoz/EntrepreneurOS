-- Module 12 native adapter operations plane. Configuration remains in
-- eos_integration_bindings; these tables preserve execution and cutover truth.
CREATE TABLE IF NOT EXISTS eos_adapter_capability_manifests (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_binding_id text NOT NULL REFERENCES eos_integration_bindings(id) ON DELETE RESTRICT,
  binding_configuration_version integer NOT NULL, contract_version text NOT NULL,
  operations jsonb NOT NULL, expected_events jsonb NOT NULL,
  input_schema_sha256 text NOT NULL, output_schema_sha256 text NOT NULL, event_schema_sha256 text NOT NULL,
  manifest_sha256 text NOT NULL, evidence_ids jsonb NOT NULL,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT, recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_adapter_manifest_version_check CHECK (binding_configuration_version > 0),
  CONSTRAINT eos_adapter_manifest_hash_check CHECK (input_schema_sha256 ~ '^[0-9a-f]{64}$' AND output_schema_sha256 ~ '^[0-9a-f]{64}$' AND event_schema_sha256 ~ '^[0-9a-f]{64}$' AND manifest_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_adapter_manifest_binding_version_idx ON eos_adapter_capability_manifests(integration_binding_id, binding_configuration_version, contract_version);
CREATE UNIQUE INDEX IF NOT EXISTS eos_adapter_manifest_hash_idx ON eos_adapter_capability_manifests(manifest_sha256);
CREATE INDEX IF NOT EXISTS eos_adapter_manifest_company_idx ON eos_adapter_capability_manifests(company_id, recorded_at);

CREATE TABLE IF NOT EXISTS eos_integration_operational_states (
  integration_binding_id text PRIMARY KEY REFERENCES eos_integration_bindings(id) ON DELETE CASCADE,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  traffic_mode text NOT NULL DEFAULT 'provider', consecutive_failures integer NOT NULL DEFAULT 0,
  last_run_at timestamptz, last_success_at timestamptz, active_incident_id text, current_qualification_id text,
  version integer NOT NULL DEFAULT 1, last_event_id text, updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_integration_operational_mode_check CHECK (traffic_mode IN ('provider','native','manual_fallback','paused')),
  CONSTRAINT eos_integration_operational_version_check CHECK (version > 0 AND consecutive_failures >= 0)
);
CREATE INDEX IF NOT EXISTS eos_integration_operational_company_idx ON eos_integration_operational_states(company_id, traffic_mode, updated_at);

CREATE TABLE IF NOT EXISTS eos_integration_runs (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_binding_id text NOT NULL REFERENCES eos_integration_bindings(id) ON DELETE RESTRICT,
  automation_id text REFERENCES eos_automations(id) ON DELETE SET NULL,
  manifest_id text NOT NULL REFERENCES eos_adapter_capability_manifests(id) ON DELETE RESTRICT,
  operation text NOT NULL, idempotency_key text NOT NULL, request_reference text NOT NULL,
  request_shape jsonb NOT NULL DEFAULT '{}'::jsonb, request_sha256 text NOT NULL,
  state text NOT NULL DEFAULT 'planned', attempt_count integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 3,
  latest_receipt_id text, owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  classification text NOT NULL DEFAULT 'restricted', version integer NOT NULL DEFAULT 1, last_event_id text,
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_integration_run_state_check CHECK (state IN ('planned','retry_ready','succeeded','failed','uncertain','dead_letter')),
  CONSTRAINT eos_integration_run_attempt_check CHECK (attempt_count >= 0 AND max_attempts BETWEEN 1 AND 20 AND attempt_count <= max_attempts),
  CONSTRAINT eos_integration_run_hash_check CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_integration_run_version_check CHECK (version > 0),
  CONSTRAINT eos_integration_run_classification_check CHECK (classification IN ('public','internal','confidential','restricted'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_integration_run_idempotency_idx ON eos_integration_runs(integration_binding_id, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS eos_integration_run_request_hash_idx ON eos_integration_runs(integration_binding_id, request_sha256);
CREATE INDEX IF NOT EXISTS eos_integration_run_state_idx ON eos_integration_runs(company_id, state, updated_at);

CREATE TABLE IF NOT EXISTS eos_integration_run_receipts (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  run_id text NOT NULL REFERENCES eos_integration_runs(id) ON DELETE RESTRICT, attempt_number integer NOT NULL,
  outcome text NOT NULL, authority text NOT NULL, external_reference text NOT NULL, summary text NOT NULL,
  response_shape jsonb NOT NULL DEFAULT '{}'::jsonb, response_sha256 text NOT NULL, latency_ms integer,
  evidence_ids jsonb NOT NULL, previous_receipt_sha256 text NOT NULL DEFAULT '', receipt_sha256 text NOT NULL,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT, recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_integration_receipt_outcome_check CHECK (outcome IN ('succeeded','failed','uncertain')),
  CONSTRAINT eos_integration_receipt_authority_check CHECK (authority IN ('provider_receipt','reconciled','manual_attestation','fixture')),
  CONSTRAINT eos_integration_receipt_hash_check CHECK (response_sha256 ~ '^[0-9a-f]{64}$' AND receipt_sha256 ~ '^[0-9a-f]{64}$' AND (previous_receipt_sha256 = '' OR previous_receipt_sha256 ~ '^[0-9a-f]{64}$')),
  CONSTRAINT eos_integration_receipt_latency_check CHECK (latency_ms IS NULL OR latency_ms >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_integration_receipt_attempt_idx ON eos_integration_run_receipts(run_id, attempt_number);
CREATE UNIQUE INDEX IF NOT EXISTS eos_integration_receipt_hash_idx ON eos_integration_run_receipts(receipt_sha256);
CREATE INDEX IF NOT EXISTS eos_integration_receipt_company_idx ON eos_integration_run_receipts(company_id, recorded_at);

CREATE TABLE IF NOT EXISTS eos_integration_incidents (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_binding_id text NOT NULL REFERENCES eos_integration_bindings(id) ON DELETE RESTRICT,
  run_id text REFERENCES eos_integration_runs(id) ON DELETE RESTRICT, severity text NOT NULL,
  state text NOT NULL DEFAULT 'open', summary text NOT NULL, recovery_plan text NOT NULL,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT, evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolution text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1, last_event_id text,
  opened_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_integration_incident_state_check CHECK (state IN ('open','acknowledged','resolved')),
  CONSTRAINT eos_integration_incident_severity_check CHECK (severity IN ('warning','material','critical')),
  CONSTRAINT eos_integration_incident_version_check CHECK (version > 0)
);
CREATE INDEX IF NOT EXISTS eos_integration_incident_state_idx ON eos_integration_incidents(company_id, state, updated_at);
CREATE INDEX IF NOT EXISTS eos_integration_incident_binding_idx ON eos_integration_incidents(integration_binding_id, opened_at);

CREATE TABLE IF NOT EXISTS eos_integration_qualifications (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_binding_id text NOT NULL REFERENCES eos_integration_bindings(id) ON DELETE RESTRICT,
  manifest_id text NOT NULL REFERENCES eos_adapter_capability_manifests(id) ON DELETE RESTRICT,
  qualification_key text NOT NULL, environment text NOT NULL, outcome text NOT NULL,
  tested_operations jsonb NOT NULL, missing_capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  test_summary text NOT NULL, rollback_validated boolean NOT NULL DEFAULT false, evidence_ids jsonb NOT NULL,
  qualification_sha256 text NOT NULL, recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_integration_qualification_environment_check CHECK (environment IN ('fixture','sandbox','production')),
  CONSTRAINT eos_integration_qualification_outcome_check CHECK (outcome IN ('passing','failing','accepted_exception')),
  CONSTRAINT eos_integration_qualification_hash_check CHECK (qualification_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_integration_qualification_key_idx ON eos_integration_qualifications(integration_binding_id, qualification_key);
CREATE UNIQUE INDEX IF NOT EXISTS eos_integration_qualification_hash_idx ON eos_integration_qualifications(qualification_sha256);
CREATE INDEX IF NOT EXISTS eos_integration_qualification_company_idx ON eos_integration_qualifications(company_id, recorded_at);

CREATE TABLE IF NOT EXISTS eos_integration_cutover_decisions (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_binding_id text NOT NULL REFERENCES eos_integration_bindings(id) ON DELETE RESTRICT,
  qualification_id text NOT NULL REFERENCES eos_integration_qualifications(id) ON DELETE RESTRICT,
  decision text NOT NULL, rationale text NOT NULL, evidence_ids jsonb NOT NULL, decision_sha256 text NOT NULL,
  policy_decision_id text NOT NULL REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT,
  decided_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT, decided_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_integration_cutover_decision_check CHECK (decision IN ('approve_native','retain_provider','rollback_to_provider')),
  CONSTRAINT eos_integration_cutover_hash_check CHECK (decision_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_integration_cutover_hash_idx ON eos_integration_cutover_decisions(decision_sha256);
CREATE INDEX IF NOT EXISTS eos_integration_cutover_binding_idx ON eos_integration_cutover_decisions(integration_binding_id, decided_at);

CREATE TABLE IF NOT EXISTS eos_integration_operation_events (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_binding_id text NOT NULL REFERENCES eos_integration_bindings(id) ON DELETE RESTRICT,
  event_type text NOT NULL, subject_type text NOT NULL, subject_id text NOT NULL,
  version_before integer NOT NULL, version_after integer NOT NULL, evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb, policy_decision_id text NOT NULL REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT,
  previous_event_sha256 text NOT NULL DEFAULT '', event_sha256 text NOT NULL,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT, recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_integration_operation_event_type_check CHECK (event_type IN ('manifest_frozen','run_planned','receipt_recorded','retry_authorized','incident_opened','incident_acknowledged','incident_resolved','fallback_changed','qualification_recorded','cutover_decided')),
  CONSTRAINT eos_integration_operation_event_subject_check CHECK (subject_type IN ('manifest','run','incident','operational_state','qualification','cutover')),
  CONSTRAINT eos_integration_operation_event_version_check CHECK (version_before >= 0 AND version_after >= version_before),
  CONSTRAINT eos_integration_operation_event_hash_check CHECK (event_sha256 ~ '^[0-9a-f]{64}$' AND (previous_event_sha256 = '' OR previous_event_sha256 ~ '^[0-9a-f]{64}$'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_integration_operation_event_hash_idx ON eos_integration_operation_events(event_sha256);
CREATE INDEX IF NOT EXISTS eos_integration_operation_event_binding_idx ON eos_integration_operation_events(integration_binding_id, recorded_at);

-- These references are added after all six tables exist because the operational
-- projection, runs, receipts, and immutable events intentionally form cycles.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) WHERE c.contype = 'f' AND c.conrelid = 'eos_integration_operational_states'::regclass AND a.attname = 'active_incident_id') THEN
    ALTER TABLE eos_integration_operational_states ADD CONSTRAINT eos_integration_operational_active_incident_fk FOREIGN KEY (active_incident_id) REFERENCES eos_integration_incidents(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) WHERE c.contype = 'f' AND c.conrelid = 'eos_integration_operational_states'::regclass AND a.attname = 'current_qualification_id') THEN
    ALTER TABLE eos_integration_operational_states ADD CONSTRAINT eos_integration_operational_qualification_fk FOREIGN KEY (current_qualification_id) REFERENCES eos_integration_qualifications(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) WHERE c.contype = 'f' AND c.conrelid = 'eos_integration_operational_states'::regclass AND a.attname = 'last_event_id') THEN
    ALTER TABLE eos_integration_operational_states ADD CONSTRAINT eos_integration_operational_event_fk FOREIGN KEY (last_event_id) REFERENCES eos_integration_operation_events(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) WHERE c.contype = 'f' AND c.conrelid = 'eos_integration_runs'::regclass AND a.attname = 'latest_receipt_id') THEN
    ALTER TABLE eos_integration_runs ADD CONSTRAINT eos_integration_run_latest_receipt_fk FOREIGN KEY (latest_receipt_id) REFERENCES eos_integration_run_receipts(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) WHERE c.contype = 'f' AND c.conrelid = 'eos_integration_runs'::regclass AND a.attname = 'last_event_id') THEN
    ALTER TABLE eos_integration_runs ADD CONSTRAINT eos_integration_run_event_fk FOREIGN KEY (last_event_id) REFERENCES eos_integration_operation_events(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) WHERE c.contype = 'f' AND c.conrelid = 'eos_integration_incidents'::regclass AND a.attname = 'last_event_id') THEN
    ALTER TABLE eos_integration_incidents ADD CONSTRAINT eos_integration_incident_event_fk FOREIGN KEY (last_event_id) REFERENCES eos_integration_operation_events(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION eos_reject_integration_operation_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'EOS integration operation ledger records are append-only'; END; $$;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['eos_adapter_capability_manifests','eos_integration_run_receipts','eos_integration_qualifications','eos_integration_cutover_decisions','eos_integration_operation_events'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', table_name || '_immutable', table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION eos_reject_integration_operation_ledger_mutation()', table_name || '_immutable', table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION eos_guard_integration_run_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event eos_integration_operation_events%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'EOS integration runs cannot be deleted'; END IF;
  IF NEW.integration_binding_id <> OLD.integration_binding_id OR NEW.manifest_id <> OLD.manifest_id OR NEW.operation <> OLD.operation OR NEW.idempotency_key <> OLD.idempotency_key OR NEW.request_sha256 <> OLD.request_sha256 OR NEW.owner_seat_id <> OLD.owner_seat_id OR NEW.classification <> OLD.classification THEN RAISE EXCEPTION 'EOS integration run definitions are immutable'; END IF;
  SELECT * INTO event FROM eos_integration_operation_events WHERE id = NEW.last_event_id;
  IF event.id IS NULL OR event.subject_type <> 'run' OR event.subject_id <> OLD.id OR event.version_before <> OLD.version OR event.version_after <> NEW.version OR NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'EOS integration run changes require an exact immutable event'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS eos_integration_run_guard ON eos_integration_runs;
CREATE TRIGGER eos_integration_run_guard BEFORE UPDATE OR DELETE ON eos_integration_runs FOR EACH ROW EXECUTE FUNCTION eos_guard_integration_run_mutation();

CREATE OR REPLACE FUNCTION eos_guard_integration_operational_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event eos_integration_operation_events%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'EOS integration operational state cannot be deleted'; END IF;
  SELECT * INTO event FROM eos_integration_operation_events WHERE id = NEW.last_event_id;
  IF event.id IS NULL OR event.subject_type <> 'operational_state' OR event.subject_id <> OLD.integration_binding_id OR event.version_before <> OLD.version OR event.version_after <> NEW.version OR NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'EOS integration operational changes require an exact immutable event'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS eos_integration_operational_guard ON eos_integration_operational_states;
CREATE TRIGGER eos_integration_operational_guard BEFORE UPDATE OR DELETE ON eos_integration_operational_states FOR EACH ROW EXECUTE FUNCTION eos_guard_integration_operational_mutation();

CREATE OR REPLACE FUNCTION eos_guard_integration_incident_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event eos_integration_operation_events%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'EOS integration incidents cannot be deleted'; END IF;
  IF NEW.integration_binding_id <> OLD.integration_binding_id OR NEW.run_id IS DISTINCT FROM OLD.run_id OR NEW.severity <> OLD.severity OR NEW.summary <> OLD.summary OR NEW.recovery_plan <> OLD.recovery_plan OR NEW.owner_seat_id <> OLD.owner_seat_id THEN RAISE EXCEPTION 'EOS integration incident definitions are immutable'; END IF;
  SELECT * INTO event FROM eos_integration_operation_events WHERE id = NEW.last_event_id;
  IF event.id IS NULL OR event.subject_type <> 'incident' OR event.subject_id <> OLD.id OR event.version_before <> OLD.version OR event.version_after <> NEW.version OR NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'EOS integration incident changes require an exact immutable event'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS eos_integration_incident_guard ON eos_integration_incidents;
CREATE TRIGGER eos_integration_incident_guard BEFORE UPDATE OR DELETE ON eos_integration_incidents FOR EACH ROW EXECUTE FUNCTION eos_guard_integration_incident_mutation();
