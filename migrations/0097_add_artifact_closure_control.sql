CREATE TABLE IF NOT EXISTS eos_artifact_closure_records (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  module_id integer NOT NULL CHECK (module_id BETWEEN 1 AND 14),
  capability_key text NOT NULL,
  capability_instance_id text REFERENCES eos_capability_instances(id) ON DELETE RESTRICT,
  artifact_class text NOT NULL CHECK (artifact_class IN ('capability_definition','template_ancestry_overlays','role_seat','position_agreement','role_agent_specialists','authority_permission_disclosure','sops','workflow_state_machine','work_packet_templates','kpis_scorecard_thresholds','meetings_cadences','interactive_instrument_read_model','forms_intake_checklists','scripts_messages_documents','tools_integrations_provider_bindings','events_telemetry','evidence_provenance_requirements','exception_escalation_rollback','training_onboarding_development','acceptance_tests_rehearsal_fixtures','instance_values_owners_live_configuration','template_learning_versioning')),
  applicability text NOT NULL DEFAULT 'missing' CHECK (applicability IN ('inherited','instantiated','missing','not_applicable','deferred_by_trigger')),
  maturity text NOT NULL DEFAULT 'doctrine' CHECK (maturity IN ('doctrine','mapped','artifact_complete','implemented','pre_live_qualified','field_qualified','native_qualified')),
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  template_stack jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  blocker text NOT NULL DEFAULT 'Artifact state has not been reconciled.',
  next_action text NOT NULL DEFAULT 'Reconcile this artifact class against the canonical runtime and attach attributable evidence.',
  rationale text NOT NULL DEFAULT 'Initialized from the canonical 22-class artifact closure contract; no maturity claim has been earned.',
  trigger_condition text NOT NULL DEFAULT '',
  classification text NOT NULL DEFAULT 'confidential' CHECK (classification IN ('internal','confidential','restricted')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_artifact_closure_missing_check CHECK (applicability <> 'missing' OR (blocker <> '' AND maturity IN ('doctrine','mapped'))),
  CONSTRAINT eos_artifact_closure_trigger_check CHECK (applicability NOT IN ('not_applicable','deferred_by_trigger') OR trigger_condition <> ''),
  CONSTRAINT eos_artifact_closure_qualified_check CHECK (maturity NOT IN ('pre_live_qualified','field_qualified','native_qualified') OR (jsonb_array_length(evidence_ids) > 0 AND blocker = ''))
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_artifact_closure_company_capability_class_idx ON eos_artifact_closure_records(company_id, module_id, capability_key, artifact_class);
CREATE INDEX IF NOT EXISTS eos_artifact_closure_owner_maturity_idx ON eos_artifact_closure_records(owner_seat_id, maturity);
CREATE INDEX IF NOT EXISTS eos_artifact_closure_company_module_idx ON eos_artifact_closure_records(company_id, module_id, updated_at);

CREATE TABLE IF NOT EXISTS eos_artifact_closure_events (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  record_id text NOT NULL REFERENCES eos_artifact_closure_records(id) ON DELETE RESTRICT,
  sequence integer NOT NULL CHECK (sequence > 0),
  action text NOT NULL CHECK (action IN ('initialized','updated','advanced','regressed','reopened')),
  from_maturity text NOT NULL CHECK (from_maturity IN ('doctrine','mapped','artifact_complete','implemented','pre_live_qualified','field_qualified','native_qualified')),
  to_maturity text NOT NULL CHECK (to_maturity IN ('doctrine','mapped','artifact_complete','implemented','pre_live_qualified','field_qualified','native_qualified')),
  change_projection jsonb NOT NULL,
  change_sha256 text NOT NULL CHECK (length(change_sha256) = 64),
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_artifact_closure_events_record_sequence_idx ON eos_artifact_closure_events(record_id, sequence);
CREATE INDEX IF NOT EXISTS eos_artifact_closure_events_company_recorded_idx ON eos_artifact_closure_events(company_id, recorded_at);

CREATE OR REPLACE FUNCTION eos_reject_artifact_closure_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'EOS artifact closure events are append-only'; END $$;
DROP TRIGGER IF EXISTS eos_artifact_closure_event_guard ON eos_artifact_closure_events;
CREATE TRIGGER eos_artifact_closure_event_guard BEFORE UPDATE OR DELETE ON eos_artifact_closure_events FOR EACH ROW EXECUTE FUNCTION eos_reject_artifact_closure_event_mutation();

CREATE OR REPLACE FUNCTION eos_guard_artifact_closure_record_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'EOS artifact closure records cannot be deleted'; END IF;
  IF NEW.company_id <> OLD.company_id OR NEW.module_id <> OLD.module_id OR NEW.capability_key <> OLD.capability_key OR NEW.artifact_class <> OLD.artifact_class OR NEW.recorded_by_user_id <> OLD.recorded_by_user_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'EOS artifact closure identity and custody fields are immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS eos_artifact_closure_record_guard ON eos_artifact_closure_records;
CREATE TRIGGER eos_artifact_closure_record_guard BEFORE UPDATE OR DELETE ON eos_artifact_closure_records FOR EACH ROW EXECUTE FUNCTION eos_guard_artifact_closure_record_mutation();
