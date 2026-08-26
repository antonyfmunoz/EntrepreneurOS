CREATE TABLE IF NOT EXISTS eos_role_support_plans (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  support_key text NOT NULL,
  subject_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  assignment_id text REFERENCES eos_assignments(id) ON DELETE SET NULL,
  manager_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  responsibility text NOT NULL,
  objective text NOT NULL,
  support_mode text NOT NULL,
  state text NOT NULL DEFAULT 'draft',
  human_ownership text NOT NULL,
  support_instructions text NOT NULL,
  guardrails jsonb NOT NULL DEFAULT '[]'::jsonb,
  proof_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  transfer_target text NOT NULL DEFAULT '',
  review_at timestamptz,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'internal',
  schema_version text NOT NULL DEFAULT 'role-support-plan-v1.0',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_role_support_plans_mode_check CHECK (support_mode IN ('assist', 'teach', 'guard', 'transfer')),
  CONSTRAINT eos_role_support_plans_state_check CHECK (state IN ('draft', 'active', 'ready_for_review', 'completed', 'cancelled')),
  CONSTRAINT eos_role_support_plans_guardrails_check CHECK (support_mode NOT IN ('guard', 'transfer') OR jsonb_array_length(guardrails) > 0),
  CONSTRAINT eos_role_support_plans_proof_check CHECK (support_mode NOT IN ('teach', 'transfer') OR jsonb_array_length(proof_requirements) > 0),
  CONSTRAINT eos_role_support_plans_transfer_target_check CHECK (support_mode <> 'transfer' OR length(trim(transfer_target)) >= 3),
  CONSTRAINT eos_role_support_plans_authority_check CHECK (source_authority IN ('native_eos', 'notion_runtime', 'external_authoritative', 'reconciled')),
  CONSTRAINT eos_role_support_plans_classification_check CHECK (classification IN ('internal', 'confidential', 'restricted'))
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_role_support_plans_company_key_idx
  ON eos_role_support_plans(company_id, support_key);

CREATE INDEX IF NOT EXISTS eos_role_support_plans_subject_state_idx
  ON eos_role_support_plans(subject_seat_id, state, review_at);

CREATE INDEX IF NOT EXISTS eos_role_support_plans_manager_state_idx
  ON eos_role_support_plans(manager_seat_id, state);

COMMENT ON TABLE eos_role_support_plans IS
  'Governed Assist, Teach, Guard, and Transfer support decisions for a seat responsibility. Completing a support plan records proof only; it never mutates assignment or authority state.';
