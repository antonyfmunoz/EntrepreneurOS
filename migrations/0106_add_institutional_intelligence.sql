CREATE TABLE IF NOT EXISTS eos_reality_observations (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  observation_key text NOT NULL, subject text NOT NULL, statement text NOT NULL,
  source_kind text NOT NULL, source_reference text NOT NULL DEFAULT '', observed_at timestamptz NOT NULL,
  freshness_expires_at timestamptz, confidence integer NOT NULL, state text NOT NULL DEFAULT 'asserted',
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  supersedes_observation_id text REFERENCES eos_reality_observations(id) ON DELETE RESTRICT,
  classification text NOT NULL DEFAULT 'confidential', content_sha256 text NOT NULL,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_reality_observations_source_check CHECK (source_kind IN ('human','integration','document','workflow','metric','external')),
  CONSTRAINT eos_reality_observations_state_check CHECK (state IN ('asserted','verified','disputed','superseded')),
  CONSTRAINT eos_reality_observations_confidence_check CHECK (confidence BETWEEN 0 AND 100),
  CONSTRAINT eos_reality_observations_evidence_array_check CHECK (jsonb_typeof(evidence_ids) = 'array'),
  CONSTRAINT eos_reality_observations_hash_check CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_reality_observations_classification_check CHECK (classification IN ('internal','confidential','restricted'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_reality_observations_company_key_idx ON eos_reality_observations(company_id, observation_key);
CREATE INDEX IF NOT EXISTS eos_reality_observations_company_subject_idx ON eos_reality_observations(company_id, subject, observed_at);

CREATE TABLE IF NOT EXISTS eos_scenario_models (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  scenario_key text NOT NULL, name text NOT NULL, decision_question text NOT NULL,
  assumptions jsonb NOT NULL DEFAULT '[]'::jsonb, variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  branches jsonb NOT NULL DEFAULT '[]'::jsonb, result jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'draft', evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  classification text NOT NULL DEFAULT 'restricted', version integer NOT NULL DEFAULT 1,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_scenario_models_state_check CHECK (state IN ('draft','analyzed','selected','rejected','archived')),
  CONSTRAINT eos_scenario_models_arrays_check CHECK (jsonb_typeof(assumptions) = 'array' AND jsonb_typeof(variables) = 'array' AND jsonb_typeof(branches) = 'array' AND jsonb_typeof(evidence_ids) = 'array'),
  CONSTRAINT eos_scenario_models_version_check CHECK (version > 0),
  CONSTRAINT eos_scenario_models_classification_check CHECK (classification IN ('confidential','restricted'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_scenario_models_company_key_idx ON eos_scenario_models(company_id, scenario_key);
CREATE INDEX IF NOT EXISTS eos_scenario_models_company_state_idx ON eos_scenario_models(company_id, state, updated_at);

CREATE TABLE IF NOT EXISTS eos_postmortems (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title text NOT NULL, event_type text NOT NULL, event_reference text NOT NULL DEFAULT '',
  summary text NOT NULL, impact text NOT NULL, timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  contributing_factors jsonb NOT NULL DEFAULT '[]'::jsonb, root_causes jsonb NOT NULL DEFAULT '[]'::jsonb,
  corrective_actions jsonb NOT NULL DEFAULT '[]'::jsonb, evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  state text NOT NULL DEFAULT 'draft', owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  classification text NOT NULL DEFAULT 'confidential', reviewed_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz, recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_postmortems_event_type_check CHECK (event_type IN ('incident','failed_workflow','missed_outcome','provider_failure','security','customer','other')),
  CONSTRAINT eos_postmortems_state_check CHECK (state IN ('draft','review','accepted','rejected')),
  CONSTRAINT eos_postmortems_arrays_check CHECK (jsonb_typeof(timeline) = 'array' AND jsonb_typeof(contributing_factors) = 'array' AND jsonb_typeof(root_causes) = 'array' AND jsonb_typeof(corrective_actions) = 'array' AND jsonb_typeof(evidence_ids) = 'array'),
  CONSTRAINT eos_postmortems_review_check CHECK ((state IN ('accepted','rejected') AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL) OR state IN ('draft','review')),
  CONSTRAINT eos_postmortems_classification_check CHECK (classification IN ('confidential','restricted'))
);
CREATE INDEX IF NOT EXISTS eos_postmortems_company_state_idx ON eos_postmortems(company_id, state, updated_at);

CREATE TABLE IF NOT EXISTS eos_learning_proposals (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_type text NOT NULL, source_id text NOT NULL, title text NOT NULL, proposal text NOT NULL,
  target_type text NOT NULL, target_reference text NOT NULL DEFAULT '', evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  state text NOT NULL DEFAULT 'proposed', decision_rationale text NOT NULL DEFAULT '',
  decided_by_user_id text REFERENCES users(id) ON DELETE RESTRICT, decided_at timestamptz,
  classification text NOT NULL DEFAULT 'restricted', recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_learning_proposals_source_check CHECK (source_type IN ('postmortem','agent_evaluation','advisor_calibration','workflow','human_review')),
  CONSTRAINT eos_learning_proposals_target_check CHECK (target_type IN ('memory','process','skill','policy','template','model_route')),
  CONSTRAINT eos_learning_proposals_state_check CHECK (state IN ('proposed','accepted','rejected','implemented')),
  CONSTRAINT eos_learning_proposals_evidence_array_check CHECK (jsonb_typeof(evidence_ids) = 'array'),
  CONSTRAINT eos_learning_proposals_decision_check CHECK ((state = 'proposed' AND decided_by_user_id IS NULL AND decided_at IS NULL) OR (state <> 'proposed' AND decided_by_user_id IS NOT NULL AND decided_at IS NOT NULL)),
  CONSTRAINT eos_learning_proposals_classification_check CHECK (classification = 'restricted')
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_learning_proposals_source_target_idx ON eos_learning_proposals(company_id, source_type, source_id, target_type);
CREATE INDEX IF NOT EXISTS eos_learning_proposals_company_state_idx ON eos_learning_proposals(company_id, state, created_at);

CREATE TABLE IF NOT EXISTS eos_institutional_memory_records (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  memory_key text NOT NULL, kind text NOT NULL, title text NOT NULL, content text NOT NULL,
  source_type text NOT NULL, source_id text NOT NULL, evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  valid_from timestamptz NOT NULL, valid_until timestamptz, state text NOT NULL DEFAULT 'verified',
  supersedes_memory_id text REFERENCES eos_institutional_memory_records(id) ON DELETE RESTRICT,
  classification text NOT NULL DEFAULT 'restricted', content_sha256 text NOT NULL,
  approved_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_institutional_memory_kind_check CHECK (kind IN ('fact','decision','lesson','pattern','policy')),
  CONSTRAINT eos_institutional_memory_state_check CHECK (state IN ('verified','superseded','retracted')),
  CONSTRAINT eos_institutional_memory_evidence_array_check CHECK (jsonb_typeof(evidence_ids) = 'array'),
  CONSTRAINT eos_institutional_memory_hash_check CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_institutional_memory_classification_check CHECK (classification IN ('confidential','restricted'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_institutional_memory_company_key_idx ON eos_institutional_memory_records(company_id, memory_key);
CREATE INDEX IF NOT EXISTS eos_institutional_memory_company_kind_idx ON eos_institutional_memory_records(company_id, kind, created_at);

CREATE OR REPLACE FUNCTION eos_intelligence_immutable_guard()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'institutional intelligence evidence is append-only'; END $$;
DROP TRIGGER IF EXISTS eos_reality_observations_immutable_guard_trigger ON eos_reality_observations;
CREATE TRIGGER eos_reality_observations_immutable_guard_trigger BEFORE UPDATE OR DELETE ON eos_reality_observations FOR EACH ROW EXECUTE FUNCTION eos_intelligence_immutable_guard();
DROP TRIGGER IF EXISTS eos_institutional_memory_immutable_guard_trigger ON eos_institutional_memory_records;
CREATE TRIGGER eos_institutional_memory_immutable_guard_trigger BEFORE UPDATE OR DELETE ON eos_institutional_memory_records FOR EACH ROW EXECUTE FUNCTION eos_intelligence_immutable_guard();
