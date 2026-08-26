CREATE TABLE IF NOT EXISTS eos_authority_subjects (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  subject_key text NOT NULL,
  subject_type text NOT NULL,
  display_name text NOT NULL,
  owner_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  supervisor_seat_id text REFERENCES eos_seats(id) ON DELETE SET NULL,
  seat_id text REFERENCES eos_seats(id) ON DELETE SET NULL,
  parent_subject_id text REFERENCES eos_authority_subjects(id) ON DELETE RESTRICT,
  agent_class text,
  external_identity_key text,
  source_authority text NOT NULL,
  identity_attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  governance_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  classification_ceiling text NOT NULL DEFAULT 'internal',
  verification_status text NOT NULL DEFAULT 'pending',
  status text NOT NULL DEFAULT 'proposed',
  schema_version text NOT NULL DEFAULT 'authority-subject-v1.0',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  review_at timestamptz,
  last_reviewed_at timestamptz,
  reviewed_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  suspended_at timestamptz,
  retired_at timestamptz,
  created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_authority_subjects_type_check CHECK (subject_type IN ('agent', 'team', 'provider', 'service_account', 'governing_body')),
  CONSTRAINT eos_authority_subjects_agent_class_check CHECK (agent_class IS NULL OR agent_class IN ('executive_assistant', 'advisor_agent', 'ceo_agent', 'role_agent', 'sub_agent')),
  CONSTRAINT eos_authority_subjects_agent_type_check CHECK ((subject_type = 'agent') = (agent_class IS NOT NULL)),
  CONSTRAINT eos_authority_subjects_agent_context_check CHECK (subject_type <> 'agent' OR agent_class = 'advisor_agent' OR seat_id IS NOT NULL),
  CONSTRAINT eos_authority_subjects_sub_agent_parent_check CHECK (agent_class <> 'sub_agent' OR parent_subject_id IS NOT NULL),
  CONSTRAINT eos_authority_subjects_classification_check CHECK (classification_ceiling IN ('public', 'internal', 'confidential', 'restricted', 'highly_restricted')),
  CONSTRAINT eos_authority_subjects_verification_check CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  CONSTRAINT eos_authority_subjects_status_check CHECK (status IN ('proposed', 'provisioning', 'active', 'suspended', 'retired')),
  CONSTRAINT eos_authority_subjects_effective_window_check CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_authority_subjects_company_key_idx
  ON eos_authority_subjects (company_id, subject_key);
CREATE UNIQUE INDEX IF NOT EXISTS eos_authority_subjects_external_identity_idx
  ON eos_authority_subjects (company_id, subject_type, external_identity_key)
  WHERE external_identity_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS eos_authority_subjects_primary_agent_seat_idx
  ON eos_authority_subjects (seat_id)
  WHERE subject_type = 'agent' AND agent_class <> 'sub_agent' AND status IN ('proposed', 'provisioning', 'active', 'suspended');
CREATE INDEX IF NOT EXISTS eos_authority_subjects_company_type_status_idx
  ON eos_authority_subjects (company_id, subject_type, status);
CREATE INDEX IF NOT EXISTS eos_authority_subjects_owner_status_idx
  ON eos_authority_subjects (owner_user_id, status);
CREATE INDEX IF NOT EXISTS eos_authority_subjects_parent_status_idx
  ON eos_authority_subjects (parent_subject_id, status);
CREATE INDEX IF NOT EXISTS eos_authority_subjects_review_idx
  ON eos_authority_subjects (status, review_at);

ALTER TABLE eos_authority_grants
  ADD COLUMN IF NOT EXISTS grantee_subject_id text REFERENCES eos_authority_subjects(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS eos_authority_grants_subject_state_idx
  ON eos_authority_grants (grantee_subject_id, state);

-- Every live seat receives one stable primary agent identity. This does not
-- grant the agent any operating authority; agent grants remain separate and
-- must be explicitly reviewed and activated.
INSERT INTO eos_authority_subjects (
  id, company_id, portfolio_id, subject_key, subject_type, display_name,
  owner_user_id, supervisor_seat_id, seat_id, agent_class, source_authority,
  identity_attributes, governance_contract, evidence_references,
  classification_ceiling, verification_status, status, effective_from,
  review_at, last_reviewed_at, reviewed_by_user_id, created_by_user_id,
  created_at, updated_at
)
SELECT
  'subject:agent:' || s.id,
  s.company_id,
  c.portfolio_id,
  'agent:' || s.id || ':primary',
  'agent',
  s.agent_name,
  c.owner_user_id,
  s.supervisor_seat_id,
  s.id,
  CASE
    WHEN s.kind = 'founder' THEN 'executive_assistant'
    WHEN s.kind = 'company_ceo' THEN 'ceo_agent'
    ELSE 'role_agent'
  END,
  'native_seat_runtime_v1',
  jsonb_build_object(
    'operatingMode', s.agent_mode,
    'workforceRoleMode', CASE WHEN s.occupant_user_id IS NULL THEN 'primary_role_operator' ELSE 'human_employee_assistant' END,
    'memoryScope', jsonb_build_object('companyId', s.company_id, 'seatId', s.id),
    'modelRuntime', 'configured_reasoning_gateway',
    'humanFallbackUserId', c.owner_user_id,
    'permittedTools', COALESCE(s.tool_entitlements, '[]'::jsonb)
  ),
  jsonb_build_object(
    'authorityRule', 'separate_explicit_grant_required',
    'effectiveCeilingRule', 'lowest_of_agent_work_seat_tool_policy',
    'suspensionRule', 'suspend_dependent_execution'
  ),
  jsonb_build_array('runtime:eos_seats:' || s.id),
  CASE
    WHEN s.kind IN ('founder', 'company_ceo') THEN 'restricted'
    WHEN s.kind IN ('portfolio_executive', 'functional_executive') THEN 'confidential'
    ELSE 'internal'
  END,
  'verified',
  'active',
  COALESCE(s.created_at, now()),
  now() + interval '90 days',
  now(),
  c.owner_user_id,
  c.owner_user_id,
  COALESCE(s.created_at, now()),
  now()
FROM eos_seats s
JOIN companies c ON c.id = s.company_id
WHERE s.status = 'active'
ON CONFLICT (company_id, subject_key) DO NOTHING;
