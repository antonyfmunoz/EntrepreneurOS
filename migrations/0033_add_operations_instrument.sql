-- Canonical Operations graph: Capability -> Process/SOP -> Work Packet -> Evidence,
-- with Resources allocated to execution. External-authoritative projections are
-- immutable; corrections are appended as reconciled native records.

CREATE TABLE IF NOT EXISTS eos_capability_instances (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE, portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  capability_instance_key text NOT NULL, capability_key text NOT NULL, name text NOT NULL, state text NOT NULL DEFAULT 'planned', maturity text NOT NULL DEFAULT 'ad_hoc',
  accountable_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT, activation_trigger text NOT NULL DEFAULT '', deactivation_trigger text NOT NULL DEFAULT '',
  agent_keys jsonb NOT NULL DEFAULT '[]'::jsonb, human_operator_key text NOT NULL DEFAULT '', system_keys jsonb NOT NULL DEFAULT '[]'::jsonb, workflow_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  metric_keys jsonb NOT NULL DEFAULT '[]'::jsonb, risk_control_keys jsonb NOT NULL DEFAULT '[]'::jsonb, evidence_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_authority text NOT NULL DEFAULT 'native_eos', classification text NOT NULL DEFAULT 'internal', schema_version text NOT NULL DEFAULT 'capability-instance-v1.0',
  valid_from timestamptz NOT NULL DEFAULT now(), valid_until timestamptz, recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_capability_instances_state_check CHECK (state IN ('planned','activating','active','dormant','blocked','deprecated')),
  CONSTRAINT eos_capability_instances_maturity_check CHECK (maturity IN ('ad_hoc','defined','repeatable','managed','optimizing')),
  CONSTRAINT eos_capability_instances_source_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_capability_instances_classification_check CHECK (classification IN ('public','internal','confidential','restricted')),
  CONSTRAINT eos_capability_instances_valid_window_check CHECK (valid_until IS NULL OR valid_until > valid_from),
  UNIQUE(company_id, capability_instance_key)
);
CREATE INDEX IF NOT EXISTS eos_capability_instances_owner_state_idx ON eos_capability_instances(accountable_seat_id, state);

CREATE TABLE IF NOT EXISTS eos_process_definitions (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE, portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  process_key text NOT NULL, name text NOT NULL, version integer NOT NULL DEFAULT 1, qualification_state text NOT NULL DEFAULT 'mapped', release_state text NOT NULL DEFAULT 'draft',
  capability_instance_id text NOT NULL REFERENCES eos_capability_instances(id) ON DELETE RESTRICT, workflow_key text NOT NULL, purpose text NOT NULL, intended_outcome text NOT NULL,
  template_ancestry text NOT NULL DEFAULT '', applicable_overlays jsonb NOT NULL DEFAULT '[]'::jsonb, trigger_condition text NOT NULL,
  accountable_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT, supporting_actor_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_authority jsonb NOT NULL DEFAULT '[]'::jsonb, disclosure_scope text NOT NULL DEFAULT 'internal', prerequisites jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_inputs jsonb NOT NULL DEFAULT '[]'::jsonb, tool_system_boundaries jsonb NOT NULL DEFAULT '[]'::jsonb, procedure_steps jsonb NOT NULL,
  branch_conditions jsonb NOT NULL DEFAULT '[]'::jsonb, approval_gates jsonb NOT NULL DEFAULT '[]'::jsonb, prohibited_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_outputs jsonb NOT NULL DEFAULT '[]'::jsonb, evidence_requirements jsonb NOT NULL DEFAULT '[]'::jsonb, quality_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  sla text NOT NULL DEFAULT '', emitted_events jsonb NOT NULL DEFAULT '[]'::jsonb, failure_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  terminal_criteria jsonb NOT NULL DEFAULT '[]'::jsonb, training_prerequisites jsonb NOT NULL DEFAULT '[]'::jsonb, acceptance_tests jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewer_keys jsonb NOT NULL DEFAULT '[]'::jsonb, source_authority text NOT NULL DEFAULT 'native_eos', classification text NOT NULL DEFAULT 'internal',
  schema_version text NOT NULL DEFAULT 'canonical-sop-v1.0', effective_from timestamptz NOT NULL DEFAULT now(), effective_until timestamptz,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_process_definitions_version_check CHECK (version > 0),
  CONSTRAINT eos_process_definitions_qualification_check CHECK (qualification_state IN ('mapped','artifact_complete','implemented','pre_live_qualified','field_qualified','retired')),
  CONSTRAINT eos_process_definitions_release_check CHECK (release_state IN ('draft','review','released','paused','retired')),
  CONSTRAINT eos_process_definitions_disclosure_check CHECK (disclosure_scope IN ('public','internal','confidential','restricted')),
  CONSTRAINT eos_process_definitions_source_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_process_definitions_classification_check CHECK (classification IN ('public','internal','confidential','restricted')),
  CONSTRAINT eos_process_definitions_steps_check CHECK (jsonb_typeof(procedure_steps) = 'array' AND jsonb_array_length(procedure_steps) > 0),
  CONSTRAINT eos_process_definitions_effective_window_check CHECK (effective_until IS NULL OR effective_until > effective_from),
  UNIQUE(company_id, process_key, version)
);
CREATE INDEX IF NOT EXISTS eos_process_definitions_capability_state_idx ON eos_process_definitions(capability_instance_id, qualification_state);

CREATE TABLE IF NOT EXISTS eos_resources_assets (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE, portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  asset_key text NOT NULL, name text NOT NULL, asset_type text NOT NULL, lifecycle_state text NOT NULL DEFAULT 'proposed', custodian_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  owner_organization_key text NOT NULL, operator_organization_key text NOT NULL DEFAULT '', data_classification text NOT NULL DEFAULT 'internal',
  external_id_url text, source_system text, rights_usage_license text NOT NULL DEFAULT '', replacement_portability_notes text NOT NULL DEFAULT '',
  tool_entitlement_keys jsonb NOT NULL DEFAULT '[]'::jsonb, evidence_keys jsonb NOT NULL DEFAULT '[]'::jsonb, source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'internal', schema_version text NOT NULL DEFAULT 'resource-asset-v1.0', valid_from timestamptz NOT NULL DEFAULT now(), valid_until timestamptz,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_resources_assets_type_check CHECK (asset_type IN ('intellectual_property','brand_asset','content_asset','channel_account','system_tool','equipment','template','document','dataset','credential_reference','other')),
  CONSTRAINT eos_resources_assets_state_check CHECK (lifecycle_state IN ('proposed','active','restricted','under_review','deprecated','archived')),
  CONSTRAINT eos_resources_assets_data_classification_check CHECK (data_classification IN ('public','internal','confidential','restricted','highly_restricted')),
  CONSTRAINT eos_resources_assets_source_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_resources_assets_classification_check CHECK (classification IN ('public','internal','confidential','restricted')),
  CONSTRAINT eos_resources_assets_external_source_check CHECK (external_id_url IS NULL OR source_system IS NOT NULL),
  CONSTRAINT eos_resources_assets_valid_window_check CHECK (valid_until IS NULL OR valid_until > valid_from),
  UNIQUE(company_id, asset_key)
);
CREATE INDEX IF NOT EXISTS eos_resources_assets_custodian_state_idx ON eos_resources_assets(custodian_seat_id, lifecycle_state);

ALTER TABLE eos_work_packets ADD COLUMN IF NOT EXISTS capability_instance_id text REFERENCES eos_capability_instances(id) ON DELETE RESTRICT;
ALTER TABLE eos_work_packets ADD COLUMN IF NOT EXISTS process_definition_id text REFERENCES eos_process_definitions(id) ON DELETE RESTRICT;
ALTER TABLE eos_work_packets ADD COLUMN IF NOT EXISTS resource_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE eos_work_packets ADD COLUMN IF NOT EXISTS expected_output text NOT NULL DEFAULT '';
ALTER TABLE eos_work_packets ADD COLUMN IF NOT EXISTS acceptance_criteria text NOT NULL DEFAULT '';
ALTER TABLE eos_work_packets ADD COLUMN IF NOT EXISTS constraints_policies text NOT NULL DEFAULT '';
ALTER TABLE eos_work_packets ADD COLUMN IF NOT EXISTS failure_escalation_compensation text NOT NULL DEFAULT '';
ALTER TABLE eos_work_packets ADD COLUMN IF NOT EXISTS human_fallback text NOT NULL DEFAULT '';
ALTER TABLE eos_work_packets ADD COLUMN IF NOT EXISTS source_lineage text NOT NULL DEFAULT '';
ALTER TABLE eos_work_packets ADD COLUMN IF NOT EXISTS output_artifact_keys jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS eos_work_packets_process_status_idx ON eos_work_packets(process_definition_id, status);
CREATE INDEX IF NOT EXISTS eos_work_packets_capability_status_idx ON eos_work_packets(capability_instance_id, status);

ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS evidence_key text;
ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS claim_subject_type text NOT NULL DEFAULT 'work_packet';
ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS claim_subject_key text NOT NULL DEFAULT '';
ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS verification_state text NOT NULL DEFAULT 'unverified';
ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS confidence_quality text NOT NULL DEFAULT 'medium';
ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS data_classification text NOT NULL DEFAULT 'internal';
ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT 'native_eos';
ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS producer_provider_key text NOT NULL DEFAULT '';
ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS consent_rights text NOT NULL DEFAULT '';
ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS supported_claim_summary text NOT NULL DEFAULT '';
ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS verifier_method text NOT NULL DEFAULT '';
ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS template_learning_eligibility text NOT NULL DEFAULT 'not_eligible';
ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS related_event_keys jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS related_decision_keys jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS schema_version text NOT NULL DEFAULT 'evidence-v1.0';
ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS captured_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS valid_from timestamptz NOT NULL DEFAULT now();
ALTER TABLE eos_evidence ADD COLUMN IF NOT EXISTS expires_review_at timestamptz;
UPDATE eos_evidence SET evidence_key = 'evidence:' || id WHERE evidence_key IS NULL;
ALTER TABLE eos_evidence ALTER COLUMN evidence_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS eos_evidence_company_key_idx ON eos_evidence(company_id, evidence_key);
ALTER TABLE eos_evidence DROP CONSTRAINT IF EXISTS eos_evidence_verification_state_check;
ALTER TABLE eos_evidence ADD CONSTRAINT eos_evidence_verification_state_check CHECK (verification_state IN ('unverified','self_reported','observed','verified','disputed','expired','superseded'));
ALTER TABLE eos_evidence DROP CONSTRAINT IF EXISTS eos_evidence_confidence_quality_check;
ALTER TABLE eos_evidence ADD CONSTRAINT eos_evidence_confidence_quality_check CHECK (confidence_quality IN ('low','medium','high','authoritative'));
ALTER TABLE eos_evidence DROP CONSTRAINT IF EXISTS eos_evidence_data_classification_check;
ALTER TABLE eos_evidence ADD CONSTRAINT eos_evidence_data_classification_check CHECK (data_classification IN ('public','internal','confidential','restricted','highly_restricted'));
ALTER TABLE eos_evidence DROP CONSTRAINT IF EXISTS eos_evidence_learning_check;
ALTER TABLE eos_evidence ADD CONSTRAINT eos_evidence_learning_check CHECK (template_learning_eligibility IN ('not_eligible','instance_only','candidate','approved_for_abstraction','rejected'));

CREATE OR REPLACE FUNCTION eos_protect_external_operations_projection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.source_authority = 'external_authoritative' THEN
    RAISE EXCEPTION 'External-authoritative Operations projections are immutable; append a reconciled correction';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS eos_capability_instances_protect_external ON eos_capability_instances;
CREATE TRIGGER eos_capability_instances_protect_external BEFORE UPDATE OR DELETE ON eos_capability_instances FOR EACH ROW EXECUTE FUNCTION eos_protect_external_operations_projection();
DROP TRIGGER IF EXISTS eos_process_definitions_protect_external ON eos_process_definitions;
CREATE TRIGGER eos_process_definitions_protect_external BEFORE UPDATE OR DELETE ON eos_process_definitions FOR EACH ROW EXECUTE FUNCTION eos_protect_external_operations_projection();
DROP TRIGGER IF EXISTS eos_resources_assets_protect_external ON eos_resources_assets;
CREATE TRIGGER eos_resources_assets_protect_external BEFORE UPDATE OR DELETE ON eos_resources_assets FOR EACH ROW EXECUTE FUNCTION eos_protect_external_operations_projection();
