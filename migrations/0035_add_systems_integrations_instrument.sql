-- Systems, Integrations & Automation instrument. EOS owns the governed
-- architecture, authority, health, fallback and replacement records. Provider
-- credentials and native provider permissions remain authoritative outside EOS.

CREATE TABLE IF NOT EXISTS eos_systems (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  system_key text NOT NULL,
  name text NOT NULL,
  system_type text NOT NULL,
  lifecycle_state text NOT NULL DEFAULT 'proposed',
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  vendor_stakeholder_id text REFERENCES eos_stakeholders(id) ON DELETE SET NULL,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_domains jsonb NOT NULL DEFAULT '[]'::jsonb,
  authoritative_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  native_admin_url text,
  monthly_cost numeric(18,2),
  currency text NOT NULL DEFAULT 'USD',
  risk_notes text NOT NULL DEFAULT '',
  contract_renewal_at timestamptz,
  replacement_intent text NOT NULL DEFAULT 'unknown',
  source_authority text NOT NULL DEFAULT 'native_eos',
  source_system text,
  external_id text,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  classification text NOT NULL DEFAULT 'restricted',
  schema_version text NOT NULL DEFAULT 'system-registry-v1.0',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_systems_type_check CHECK (system_type IN ('system','application','service','tool','data_platform','infrastructure','provider')),
  CONSTRAINT eos_systems_state_check CHECK (lifecycle_state IN ('proposed','selected','implementing','active','degraded','replacement_planned','migrating','retired')),
  CONSTRAINT eos_systems_replacement_check CHECK (replacement_intent IN ('keep','integrate','migrate','replace','retire','unknown')),
  CONSTRAINT eos_systems_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_systems_classification_check CHECK (classification IN ('public','internal','confidential','restricted')),
  CONSTRAINT eos_systems_cost_check CHECK (monthly_cost IS NULL OR monthly_cost >= 0),
  CONSTRAINT eos_systems_external_check CHECK ((source_system IS NULL AND external_id IS NULL) OR (source_system IS NOT NULL AND external_id IS NOT NULL)),
  UNIQUE(company_id, system_key),
  UNIQUE(company_id, source_system, external_id)
);
CREATE INDEX IF NOT EXISTS eos_systems_owner_state_idx ON eos_systems(owner_seat_id, lifecycle_state);

CREATE TABLE IF NOT EXISTS eos_integration_bindings (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  integration_key text NOT NULL,
  name text NOT NULL,
  from_system_id text REFERENCES eos_systems(id) ON DELETE SET NULL,
  to_system_id text REFERENCES eos_systems(id) ON DELETE SET NULL,
  provider_key text NOT NULL,
  provider_account_reference text NOT NULL DEFAULT '',
  adapter_kind text NOT NULL,
  adapter_reference text NOT NULL,
  lifecycle_state text NOT NULL DEFAULT 'proposed',
  connection_state text NOT NULL DEFAULT 'unconfigured',
  health_state text NOT NULL DEFAULT 'unknown',
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  recovery_owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  account_scope text NOT NULL DEFAULT '',
  native_permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  credential_reference text,
  execution_authority text NOT NULL DEFAULT '',
  operations jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  manual_fallback text NOT NULL,
  failure_recovery text NOT NULL,
  replacement_status text NOT NULL DEFAULT 'unknown',
  parity_state text NOT NULL DEFAULT 'not_tested',
  work_packet_id text REFERENCES eos_work_packets(id) ON DELETE SET NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_health_at timestamptz,
  source_authority text NOT NULL DEFAULT 'native_eos',
  source_system text,
  external_id text,
  classification text NOT NULL DEFAULT 'restricted',
  schema_version text NOT NULL DEFAULT 'integration-binding-v1.0',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_integration_bindings_adapter_check CHECK (adapter_kind IN ('oauth','api_key','webhook','signed_https','service_account','database','file_exchange','manual','native')),
  CONSTRAINT eos_integration_bindings_state_check CHECK (lifecycle_state IN ('proposed','selected','implementing','active','degraded','replacement_planned','migrating','retired')),
  CONSTRAINT eos_integration_bindings_connection_check CHECK (connection_state IN ('unconfigured','configured','connected','revoked','failed')),
  CONSTRAINT eos_integration_bindings_health_check CHECK (health_state IN ('unknown','healthy','degraded','unavailable')),
  CONSTRAINT eos_integration_bindings_replacement_check CHECK (replacement_status IN ('keep','integrate','migrate','replace','retire','unknown')),
  CONSTRAINT eos_integration_bindings_parity_check CHECK (parity_state IN ('not_tested','test_planned','passing','failing','accepted_exception')),
  CONSTRAINT eos_integration_bindings_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_integration_bindings_classification_check CHECK (classification IN ('public','internal','confidential','restricted')),
  CONSTRAINT eos_integration_bindings_endpoint_check CHECK (from_system_id IS NOT NULL OR to_system_id IS NOT NULL),
  CONSTRAINT eos_integration_bindings_external_check CHECK ((source_system IS NULL AND external_id IS NULL) OR (source_system IS NOT NULL AND external_id IS NOT NULL)),
  UNIQUE(company_id, integration_key),
  UNIQUE(company_id, source_system, external_id)
);
CREATE INDEX IF NOT EXISTS eos_integration_bindings_owner_state_idx ON eos_integration_bindings(owner_seat_id, lifecycle_state);
CREATE INDEX IF NOT EXISTS eos_integration_bindings_health_idx ON eos_integration_bindings(company_id, health_state, last_health_at);

CREATE TABLE IF NOT EXISTS eos_tool_entitlements (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  entitlement_key text NOT NULL,
  system_id text NOT NULL REFERENCES eos_systems(id) ON DELETE RESTRICT,
  integration_binding_id text REFERENCES eos_integration_bindings(id) ON DELETE SET NULL,
  grantee_seat_id text REFERENCES eos_seats(id) ON DELETE RESTRICT,
  grantee_subject_id text REFERENCES eos_authority_subjects(id) ON DELETE RESTRICT,
  provider_resource_reference text NOT NULL,
  native_permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  authority_grant_id text REFERENCES eos_authority_grants(id) ON DELETE SET NULL,
  credential_reference text,
  mastery_state text NOT NULL DEFAULT 'unverified',
  state text NOT NULL DEFAULT 'proposed',
  revocation_owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  last_reviewed_at timestamptz,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'restricted',
  schema_version text NOT NULL DEFAULT 'tool-entitlement-v1.0',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_tool_entitlements_grantee_check CHECK ((grantee_seat_id IS NOT NULL)::int + (grantee_subject_id IS NOT NULL)::int = 1),
  CONSTRAINT eos_tool_entitlements_mastery_check CHECK (mastery_state IN ('unverified','training','qualified','expired')),
  CONSTRAINT eos_tool_entitlements_state_check CHECK (state IN ('proposed','pending','active','suspended','revoked','expired')),
  CONSTRAINT eos_tool_entitlements_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_tool_entitlements_classification_check CHECK (classification IN ('public','internal','confidential','restricted')),
  CONSTRAINT eos_tool_entitlements_effective_check CHECK (effective_until IS NULL OR effective_until > effective_from),
  UNIQUE(company_id, entitlement_key)
);
CREATE INDEX IF NOT EXISTS eos_tool_entitlements_grantee_state_idx ON eos_tool_entitlements(grantee_seat_id, grantee_subject_id, state);

CREATE TABLE IF NOT EXISTS eos_automations (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  automation_key text NOT NULL,
  name text NOT NULL,
  integration_binding_id text NOT NULL REFERENCES eos_integration_bindings(id) ON DELETE RESTRICT,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  trigger_contract text NOT NULL,
  action_contract text NOT NULL,
  lifecycle_state text NOT NULL DEFAULT 'proposed',
  consequence text NOT NULL DEFAULT 'routine',
  failure_behavior text NOT NULL,
  manual_fallback text NOT NULL,
  work_packet_id text REFERENCES eos_work_packets(id) ON DELETE SET NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_run_state text NOT NULL DEFAULT 'never',
  last_run_at timestamptz,
  next_run_at timestamptz,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'restricted',
  schema_version text NOT NULL DEFAULT 'automation-v1.0',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_automations_state_check CHECK (lifecycle_state IN ('proposed','design','review','enabled','paused','degraded','disabled','retired')),
  CONSTRAINT eos_automations_consequence_check CHECK (consequence IN ('routine','material','high_consequence')),
  CONSTRAINT eos_automations_run_state_check CHECK (last_run_state IN ('never','queued','running','succeeded','failed','partial','cancelled')),
  CONSTRAINT eos_automations_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_automations_classification_check CHECK (classification IN ('public','internal','confidential','restricted')),
  UNIQUE(company_id, automation_key)
);
CREATE INDEX IF NOT EXISTS eos_automations_owner_state_idx ON eos_automations(owner_seat_id, lifecycle_state);

CREATE TABLE IF NOT EXISTS eos_integration_health_observations (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_binding_id text NOT NULL REFERENCES eos_integration_bindings(id) ON DELETE CASCADE,
  observed_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  health_state text NOT NULL,
  check_type text NOT NULL,
  summary text NOT NULL,
  external_reference text,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  trace_id text NOT NULL,
  correlation_id text NOT NULL,
  observed_at timestamptz NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_integration_health_state_check CHECK (health_state IN ('healthy','degraded','unavailable','unknown')),
  CONSTRAINT eos_integration_health_type_check CHECK (check_type IN ('live_provider','monitoring','manual_test','fixture','recovery_test','parity_test')),
  CONSTRAINT eos_integration_health_expiry_check CHECK (expires_at IS NULL OR expires_at > observed_at)
);
CREATE INDEX IF NOT EXISTS eos_integration_health_binding_time_idx ON eos_integration_health_observations(integration_binding_id, observed_at DESC);

CREATE OR REPLACE FUNCTION eos_protect_external_system_projection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.source_authority = 'external_authoritative' THEN
    RAISE EXCEPTION 'External-authoritative Systems projections are immutable; append a reconciled correction';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS eos_systems_protect_external ON eos_systems;
CREATE TRIGGER eos_systems_protect_external BEFORE UPDATE OR DELETE ON eos_systems FOR EACH ROW EXECUTE FUNCTION eos_protect_external_system_projection();
DROP TRIGGER IF EXISTS eos_integration_bindings_protect_external ON eos_integration_bindings;
CREATE TRIGGER eos_integration_bindings_protect_external BEFORE UPDATE OR DELETE ON eos_integration_bindings FOR EACH ROW EXECUTE FUNCTION eos_protect_external_system_projection();
DROP TRIGGER IF EXISTS eos_tool_entitlements_protect_external ON eos_tool_entitlements;
CREATE TRIGGER eos_tool_entitlements_protect_external BEFORE UPDATE OR DELETE ON eos_tool_entitlements FOR EACH ROW EXECUTE FUNCTION eos_protect_external_system_projection();
DROP TRIGGER IF EXISTS eos_automations_protect_external ON eos_automations;
CREATE TRIGGER eos_automations_protect_external BEFORE UPDATE OR DELETE ON eos_automations FOR EACH ROW EXECUTE FUNCTION eos_protect_external_system_projection();

CREATE OR REPLACE FUNCTION eos_protect_integration_health_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Integration health history is append-only';
END $$;
DROP TRIGGER IF EXISTS eos_integration_health_observations_immutable ON eos_integration_health_observations;
CREATE TRIGGER eos_integration_health_observations_immutable BEFORE UPDATE OR DELETE ON eos_integration_health_observations FOR EACH ROW EXECUTE FUNCTION eos_protect_integration_health_history();
