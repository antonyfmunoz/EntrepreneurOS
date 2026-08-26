-- Finance & Capital control instrument. EOS owns governed plans, scenarios,
-- approvals and reconciliation links. Providers remain authoritative for
-- accounts, settled transactions, balances and regulated financial truth.

CREATE TABLE IF NOT EXISTS eos_financial_sources (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  source_key text NOT NULL,
  name text NOT NULL,
  legal_entity_name text NOT NULL,
  legal_entity_reference text NOT NULL DEFAULT '',
  account_type text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  lifecycle_state text NOT NULL DEFAULT 'draft',
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  source_system text,
  external_id text,
  source_authority text NOT NULL DEFAULT 'native_eos',
  reconciliation_state text NOT NULL DEFAULT 'unreconciled',
  freshness_as_of timestamptz,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  classification text NOT NULL DEFAULT 'confidential',
  schema_version text NOT NULL DEFAULT 'financial-source-v1.0',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_financial_sources_type_check CHECK (account_type IN ('bank','accounting','payment','payroll','tax','investment','receivable','payable','cash_equivalent','other')),
  CONSTRAINT eos_financial_sources_state_check CHECK (lifecycle_state IN ('draft','connected','stale','restricted','disconnected','archived')),
  CONSTRAINT eos_financial_sources_reconciliation_check CHECK (reconciliation_state IN ('unreconciled','pending','reconciled','exception')),
  CONSTRAINT eos_financial_sources_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_financial_sources_classification_check CHECK (classification IN ('public','internal','confidential','restricted')),
  CONSTRAINT eos_financial_sources_external_check CHECK ((external_id IS NULL AND source_system IS NULL) OR (external_id IS NOT NULL AND source_system IS NOT NULL)),
  CONSTRAINT eos_financial_sources_connected_check CHECK (lifecycle_state NOT IN ('connected','stale','restricted','disconnected') OR (external_id IS NOT NULL AND source_system IS NOT NULL)),
  UNIQUE(company_id, source_key),
  UNIQUE(company_id, source_system, external_id)
);
CREATE INDEX IF NOT EXISTS eos_financial_sources_owner_state_idx ON eos_financial_sources(owner_seat_id, lifecycle_state);

CREATE TABLE IF NOT EXISTS eos_financial_plans (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  plan_key text NOT NULL,
  name text NOT NULL,
  plan_type text NOT NULL,
  state text NOT NULL DEFAULT 'draft',
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  financial_source_id text REFERENCES eos_financial_sources(id) ON DELETE SET NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  planned_amount numeric(24,6) NOT NULL,
  actual_amount numeric(24,6),
  variance_amount numeric(24,6),
  assumptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_value_flow_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  metric_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  reconciliation_state text NOT NULL DEFAULT 'unreconciled',
  reconciled_at timestamptz,
  approved_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'confidential',
  schema_version text NOT NULL DEFAULT 'financial-plan-v1.0',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_financial_plans_type_check CHECK (plan_type IN ('budget','forecast','scenario','liquidity','unit_economics','capital_plan')),
  CONSTRAINT eos_financial_plans_state_check CHECK (state IN ('draft','review','approved','active','superseded','archived')),
  CONSTRAINT eos_financial_plans_reconciliation_check CHECK (reconciliation_state IN ('unreconciled','pending','reconciled','exception')),
  CONSTRAINT eos_financial_plans_period_check CHECK (period_end > period_start),
  CONSTRAINT eos_financial_plans_planned_amount_check CHECK (planned_amount >= 0),
  CONSTRAINT eos_financial_plans_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_financial_plans_classification_check CHECK (classification IN ('public','internal','confidential','restricted')),
  UNIQUE(company_id, plan_key)
);
CREATE INDEX IF NOT EXISTS eos_financial_plans_owner_state_idx ON eos_financial_plans(owner_seat_id, state);
CREATE INDEX IF NOT EXISTS eos_financial_plans_period_idx ON eos_financial_plans(company_id, period_start, period_end);

CREATE TABLE IF NOT EXISTS eos_capital_allocations (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  allocation_key text NOT NULL,
  name text NOT NULL,
  allocation_type text NOT NULL,
  state text NOT NULL DEFAULT 'proposed',
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  financial_plan_id text REFERENCES eos_financial_plans(id) ON DELETE SET NULL,
  target_type text NOT NULL,
  target_key text NOT NULL,
  amount numeric(24,6) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  rationale text NOT NULL,
  alternatives jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_outcome text NOT NULL,
  downside_risk text NOT NULL,
  work_packet_id text REFERENCES eos_work_packets(id) ON DELETE SET NULL,
  metric_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  approved_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'confidential',
  schema_version text NOT NULL DEFAULT 'capital-allocation-v1.0',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_capital_allocations_type_check CHECK (allocation_type IN ('operating','growth','reserve','debt_service','asset_purchase','internal_investment','external_investment','distribution','other')),
  CONSTRAINT eos_capital_allocations_state_check CHECK (state IN ('proposed','under_review','approved','committed','deployed','measuring','realized','rejected','cancelled')),
  CONSTRAINT eos_capital_allocations_amount_check CHECK (amount > 0),
  CONSTRAINT eos_capital_allocations_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_capital_allocations_classification_check CHECK (classification IN ('public','internal','confidential','restricted')),
  UNIQUE(company_id, allocation_key)
);
CREATE INDEX IF NOT EXISTS eos_capital_allocations_owner_state_idx ON eos_capital_allocations(owner_seat_id, state);
CREATE INDEX IF NOT EXISTS eos_capital_allocations_plan_state_idx ON eos_capital_allocations(financial_plan_id, state);

CREATE OR REPLACE FUNCTION eos_protect_external_finance_projection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.source_authority = 'external_authoritative' THEN
    RAISE EXCEPTION 'External-authoritative Finance projections are immutable; append a reconciled correction';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS eos_financial_sources_protect_external ON eos_financial_sources;
CREATE TRIGGER eos_financial_sources_protect_external BEFORE UPDATE OR DELETE ON eos_financial_sources FOR EACH ROW EXECUTE FUNCTION eos_protect_external_finance_projection();
DROP TRIGGER IF EXISTS eos_financial_plans_protect_external ON eos_financial_plans;
CREATE TRIGGER eos_financial_plans_protect_external BEFORE UPDATE OR DELETE ON eos_financial_plans FOR EACH ROW EXECUTE FUNCTION eos_protect_external_finance_projection();
DROP TRIGGER IF EXISTS eos_capital_allocations_protect_external ON eos_capital_allocations;
CREATE TRIGGER eos_capital_allocations_protect_external BEFORE UPDATE OR DELETE ON eos_capital_allocations FOR EACH ROW EXECUTE FUNCTION eos_protect_external_finance_projection();
