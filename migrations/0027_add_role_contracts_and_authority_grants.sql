CREATE TABLE IF NOT EXISTS eos_position_families (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  canonical_key text NOT NULL,
  name text NOT NULL,
  title_root text NOT NULL,
  department text NOT NULL DEFAULT 'General Management',
  dominant_result text NOT NULL,
  applicability jsonb NOT NULL DEFAULT '{}'::jsonb,
  activation_conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  split_conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  track_options jsonb NOT NULL DEFAULT '["individual_contributor"]'::jsonb,
  source_type text NOT NULL DEFAULT 'custom',
  template_ancestry jsonb NOT NULL DEFAULT '[]'::jsonb,
  schema_version text NOT NULL DEFAULT 'position-family-v1.0',
  status text NOT NULL DEFAULT 'active',
  created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_position_families_source_check CHECK (source_type IN ('template', 'custom', 'imported', 'legacy_backfill')),
  CONSTRAINT eos_position_families_status_check CHECK (status IN ('draft', 'active', 'deprecated'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_position_families_company_key_idx ON eos_position_families (company_id, canonical_key);
CREATE INDEX IF NOT EXISTS eos_position_families_company_status_idx ON eos_position_families (company_id, status);

CREATE TABLE IF NOT EXISTS eos_position_agreements (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  position_family_id text NOT NULL REFERENCES eos_position_families(id) ON DELETE CASCADE,
  level_code text NOT NULL,
  title text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  contract jsonb NOT NULL,
  content_hash text NOT NULL,
  source_type text NOT NULL DEFAULT 'custom',
  template_ancestry jsonb NOT NULL DEFAULT '[]'::jsonb,
  schema_version text NOT NULL DEFAULT 'position-agreement-v1.0',
  status text NOT NULL DEFAULT 'draft',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_position_agreements_source_check CHECK (source_type IN ('template', 'custom', 'imported', 'legacy_backfill')),
  CONSTRAINT eos_position_agreements_status_check CHECK (status IN ('draft', 'active', 'superseded', 'deprecated')),
  CONSTRAINT eos_position_agreements_effective_window_check CHECK (effective_until IS NULL OR effective_until > effective_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_position_agreements_family_level_version_idx ON eos_position_agreements (position_family_id, level_code, version);
CREATE UNIQUE INDEX IF NOT EXISTS eos_position_agreements_one_active_level_idx ON eos_position_agreements (position_family_id, level_code) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS eos_position_agreements_company_status_idx ON eos_position_agreements (company_id, status);

ALTER TABLE eos_seats ADD COLUMN IF NOT EXISTS position_agreement_id text REFERENCES eos_position_agreements(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS eos_role_operating_packs (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE CASCADE,
  position_agreement_id text NOT NULL REFERENCES eos_position_agreements(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  contract jsonb NOT NULL,
  content_hash text NOT NULL,
  compiled_from jsonb NOT NULL DEFAULT '[]'::jsonb,
  schema_version text NOT NULL DEFAULT 'role-operating-pack-v1.0',
  status text NOT NULL DEFAULT 'active',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  compiled_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_role_packs_status_check CHECK (status IN ('draft', 'active', 'superseded', 'deprecated')),
  CONSTRAINT eos_role_packs_effective_window_check CHECK (effective_until IS NULL OR effective_until > effective_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_role_packs_seat_version_idx ON eos_role_operating_packs (seat_id, version);
CREATE UNIQUE INDEX IF NOT EXISTS eos_role_packs_one_active_seat_idx ON eos_role_operating_packs (seat_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS eos_role_packs_company_status_idx ON eos_role_operating_packs (company_id, status);

CREATE TABLE IF NOT EXISTS eos_authority_grants (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  authority_key text NOT NULL,
  grantee_type text NOT NULL,
  grantee_key text NOT NULL,
  grantor_type text NOT NULL,
  grantor_key text NOT NULL,
  seat_id text REFERENCES eos_seats(id) ON DELETE CASCADE,
  capability_key text,
  authority_classes jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_resource_scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  ceiling_threshold jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_approvals jsonb NOT NULL DEFAULT '[]'::jsonb,
  delegable boolean NOT NULL DEFAULT false,
  tool_entitlements jsonb NOT NULL DEFAULT '[]'::jsonb,
  policy_decision_source text NOT NULL,
  evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  revocation_dependent_work jsonb NOT NULL DEFAULT '[]'::jsonb,
  schema_version text NOT NULL DEFAULT 'authority-grant-v1.0',
  state text NOT NULL DEFAULT 'proposed',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  review_at timestamptz,
  revoked_at timestamptz,
  created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  revoked_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_authority_grants_grantee_type_check CHECK (grantee_type IN ('principal', 'agent', 'team', 'provider', 'seat', 'governing_body', 'service_account', 'other')),
  CONSTRAINT eos_authority_grants_state_check CHECK (state IN ('proposed', 'active', 'changing', 'suspended', 'expired', 'revoked')),
  CONSTRAINT eos_authority_grants_effective_window_check CHECK (effective_until IS NULL OR effective_until > effective_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_authority_grants_company_key_idx ON eos_authority_grants (company_id, authority_key);
CREATE INDEX IF NOT EXISTS eos_authority_grants_grantee_state_idx ON eos_authority_grants (company_id, grantee_type, grantee_key, state);
CREATE INDEX IF NOT EXISTS eos_authority_grants_seat_state_idx ON eos_authority_grants (seat_id, state);
CREATE INDEX IF NOT EXISTS eos_authority_grants_review_idx ON eos_authority_grants (state, review_at);

-- Compile every legacy seat into a family, agreement, operating pack, and
-- bounded baseline grant. These records retain legacy lineage and can be
-- superseded through the native versioned APIs without changing seat identity.
INSERT INTO eos_position_families (
  id, company_id, canonical_key, name, title_root, dominant_result,
  applicability, activation_conditions, split_conditions, track_options,
  source_type, template_ancestry, status, created_by_user_id
)
SELECT DISTINCT ON (s.company_id, s.kind)
  'family:' || s.company_id::text || ':' || s.kind,
  s.company_id,
  s.kind,
  initcap(replace(s.kind, '_', ' ')),
  initcap(replace(s.kind, '_', ' ')),
  COALESCE(NULLIF(s.mandate, ''), 'Produce the accountable result for the ' || s.title || ' position family.'),
  jsonb_build_object('companyId', s.company_id, 'legacyKind', s.kind),
  jsonb_build_array('Activated because an accountable legacy seat already exists.'),
  '[]'::jsonb,
  CASE WHEN s.kind IN ('founder', 'portfolio_executive', 'company_ceo', 'functional_executive', 'manager')
    THEN '["leadership","management"]'::jsonb ELSE '["individual_contributor"]'::jsonb END,
  'legacy_backfill',
  jsonb_build_array('legacy:eos_seats:' || s.kind),
  'active',
  c.owner_user_id
FROM eos_seats s
JOIN companies c ON c.id = s.company_id
ORDER BY s.company_id, s.kind, s.created_at
ON CONFLICT DO NOTHING;

INSERT INTO eos_position_agreements (
  id, company_id, position_family_id, level_code, title, version, contract,
  content_hash, source_type, template_ancestry, status, created_by_user_id
)
SELECT
  'agreement:' || s.id,
  s.company_id,
  'family:' || s.company_id::text || ':' || s.kind,
  'seat-' || substring(md5(s.id), 1, 8),
  s.title,
  1,
  jsonb_build_object(
    'resultStatement', COALESCE(NULLIF(s.mandate, ''), 'Produce the accountable result for ' || s.title || '.'),
    'responsibilities', jsonb_build_array(COALESCE(NULLIF(s.mandate, ''), 'Own the declared work of ' || s.title || '.')),
    'nonResponsibilities', jsonb_build_array('Do not exceed explicit Authority Grants or bypass required approvals.'),
    'acceptanceStandards', jsonb_build_array('Named outputs meet their evidence and review requirements.'),
    'scorecard', jsonb_build_array(jsonb_build_object('metric', 'Accountable outcomes accepted', 'target', 'Defined by active Work Packets and company cadence', 'cadence', 'weekly')),
    'managerRelationship', CASE WHEN s.supervisor_seat_id IS NULL THEN 'Reports to the governing founder context.' ELSE 'Reports through supervisor seat ' || s.supervisor_seat_id || '.' END,
    'schedule', 'Defined by the organization operating cadence and active work.',
    'toolRequirements', COALESCE(s.tool_entitlements, '[]'::jsonb),
    'decisionRights', jsonb_build_array('Only decisions covered by an effective Authority Grant.'),
    'authorityCeiling', COALESCE(s.authority, '{}'::jsonb),
    'trainingRequirements', jsonb_build_array('Complete role-entry qualification before expanded authority.'),
    'evidenceRequirements', jsonb_build_array('Accepted output or reviewed operating evidence.'),
    'compensationPlaceholder', 'Defined before human employment or contractor activation.',
    'promotionCriteria', jsonb_build_array('Sustained evidence at the next level of complexity and judgment.'),
    'releaseCriteria', jsonb_build_array('Repeated failure, material authority breach, or role deactivation after governed review.')
  ),
  md5(s.id || '|' || COALESCE(s.mandate, '') || '|' || COALESCE(s.authority::text, '{}') || '|' || COALESCE(s.tool_entitlements::text, '[]')),
  'legacy_backfill',
  jsonb_build_array('legacy:eos_seats:' || s.id),
  'active',
  c.owner_user_id
FROM eos_seats s
JOIN companies c ON c.id = s.company_id
ON CONFLICT DO NOTHING;

UPDATE eos_seats s
SET position_agreement_id = 'agreement:' || s.id
WHERE s.position_agreement_id IS NULL
  AND EXISTS (SELECT 1 FROM eos_position_agreements a WHERE a.id = 'agreement:' || s.id);

INSERT INTO eos_role_operating_packs (
  id, company_id, seat_id, position_agreement_id, version, contract,
  content_hash, compiled_from, status, compiled_by_user_id
)
SELECT
  'pack:' || s.id,
  s.company_id,
  s.id,
  s.position_agreement_id,
  1,
  jsonb_build_object(
    'mission', COALESCE(NULLIF(s.mandate, ''), 'Produce the accountable result for ' || s.title || '.'),
    'responsibilities', jsonb_build_array(COALESCE(NULLIF(s.mandate, ''), 'Own the declared work of ' || s.title || '.')),
    'nonResponsibilities', jsonb_build_array('Do not exceed effective authority, disclosure, approval, or reporting boundaries.'),
    'outputs', jsonb_build_array('Accepted evidence-bearing outputs from the active queue.'),
    'acceptanceStandards', jsonb_build_array('Outputs satisfy declared Work Packet evidence and review criteria.'),
    'scorecard', jsonb_build_array(jsonb_build_object('metric', 'Accountable outcomes accepted', 'target', 'Defined by active Work Packets', 'cadence', 'weekly')),
    'reviewCadence', 'weekly',
    'authorityRequirements', '[]'::jsonb,
    'requiredTools', COALESCE(s.tool_entitlements, '[]'::jsonb),
    'allowedSpecialists', '[]'::jsonb,
    'workflows', jsonb_build_array('Work Packet lifecycle', 'Evidence and review lifecycle'),
    'sops', '[]'::jsonb,
    'queueTypes', jsonb_build_array('work_packets', 'approvals', 'exceptions'),
    'meetingObligations', '[]'::jsonb,
    'handoffs', jsonb_build_array('Use declared supervisor and downstream seat relationships.'),
    'dependencies', '[]'::jsonb,
    'escalationPaths', jsonb_build_array(CASE WHEN s.supervisor_seat_id IS NULL THEN 'Escalate to governing founder context.' ELSE 'Escalate to supervisor seat ' || s.supervisor_seat_id || '.' END),
    'exceptions', jsonb_build_array('Pause and escalate when authority, evidence, source ownership, or classification is ambiguous.'),
    'trainingRequirements', jsonb_build_array('Complete role-entry qualification and tool-specific safety checks.'),
    'evidenceRequirements', jsonb_build_array('Accepted output or reviewed operating evidence.'),
    'occupancyModes', CASE WHEN s.kind = 'founder' THEN '["founder_held","human_led","hybrid"]'::jsonb ELSE '["agent_operated","human_led","provider_led","team","hybrid"]'::jsonb END,
    'entryRules', jsonb_build_array('An active assignment and effective operating grant are required.'),
    'exitRules', jsonb_build_array('Exit preserves role identity, queue, evidence, and Role Agent continuity.'),
    'transferRules', jsonb_build_array('Transfer changes occupancy without rewriting the institutional role contract.'),
    'qualificationTests', jsonb_build_array('Occupant can explain mission, authority, boundaries, next action, and required proof.')
  ),
  md5(s.id || '|role-pack-v1|' || COALESCE(s.mandate, '') || '|' || COALESCE(s.tool_entitlements::text, '[]')),
  jsonb_build_array(s.position_agreement_id, 'legacy:eos_seats:' || s.id),
  'active',
  c.owner_user_id
FROM eos_seats s
JOIN companies c ON c.id = s.company_id
WHERE s.position_agreement_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO eos_authority_grants (
  id, company_id, portfolio_id, authority_key, grantee_type, grantee_key,
  grantor_type, grantor_key, seat_id, capability_key, authority_classes,
  action_resource_scope, ceiling_threshold, conditions, required_approvals,
  delegable, tool_entitlements, policy_decision_source, evidence_references,
  state, created_by_user_id
)
SELECT
  'grant:' || s.id || ':baseline',
  s.company_id,
  c.portfolio_id,
  'seat:' || s.id || ':baseline',
  'seat',
  s.id,
  'principal',
  c.owner_user_id,
  s.id,
  s.kind,
  CASE s.kind
    WHEN 'founder' THEN '["view","recommend","execute","decide","approve","spend","sign","grant_access","delegate","override_emergency"]'::jsonb
    WHEN 'company_ceo' THEN '["view","recommend","execute","decide","approve","spend","sign","grant_access","delegate"]'::jsonb
    WHEN 'portfolio_executive' THEN '["view","recommend","execute","decide","approve","delegate"]'::jsonb
    WHEN 'functional_executive' THEN '["view","recommend","execute","decide","approve","delegate"]'::jsonb
    WHEN 'manager' THEN '["view","recommend","execute","decide","approve"]'::jsonb
    WHEN 'external' THEN '["view","recommend"]'::jsonb
    ELSE '["view","recommend","execute"]'::jsonb
  END,
  jsonb_build_object('companyId', s.company_id, 'seatId', s.id, 'resource', '*'),
  jsonb_build_object('classification', CASE
    WHEN s.kind IN ('founder', 'company_ceo') THEN 'restricted'
    WHEN s.kind IN ('portfolio_executive', 'functional_executive') THEN 'confidential'
    WHEN s.kind = 'external' THEN 'public'
    ELSE 'internal' END),
  jsonb_build_array('Authority is effective only while the seat and entering assignment remain active.'),
  CASE WHEN s.kind IN ('founder', 'company_ceo') THEN '[]'::jsonb ELSE jsonb_build_array('Escalate consequential effects outside the declared scope.') END,
  s.kind IN ('founder', 'company_ceo', 'portfolio_executive', 'functional_executive'),
  COALESCE(s.tool_entitlements, '[]'::jsonb),
  'legacy_role_policy_v1',
  jsonb_build_array('legacy:eos_seats:' || s.id),
  'active',
  c.owner_user_id
FROM eos_seats s
JOIN companies c ON c.id = s.company_id
ON CONFLICT DO NOTHING;
