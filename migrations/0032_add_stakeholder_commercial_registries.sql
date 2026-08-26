-- Canonical stakeholder and commercial graph. Provider-owned facts are
-- immutable projections; corrections are appended as reconciled records.

CREATE TABLE IF NOT EXISTS eos_stakeholders (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE, portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  stakeholder_key text NOT NULL, name text NOT NULL, party_type text NOT NULL, state text NOT NULL DEFAULT 'proposed', owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  identity_reference text NOT NULL, identity_reference_hash text NOT NULL, external_id text, source_system text, consent_legal_basis text NOT NULL DEFAULT '', relationship_role text NOT NULL DEFAULT '', evidence_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_authority text NOT NULL DEFAULT 'native_eos', classification text NOT NULL DEFAULT 'internal', schema_version text NOT NULL DEFAULT 'stakeholder-party-v1.0', valid_from timestamptz NOT NULL DEFAULT now(), valid_until timestamptz,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_stakeholders_party_type_check CHECK (party_type IN ('person','organization','audience_segment','customer_segment','customer','prospect','partner','vendor_provider','employee','candidate','collaborator','community','investor','regulator','other')),
  CONSTRAINT eos_stakeholders_state_check CHECK (state IN ('proposed','active','dormant','restricted','closed')),
  CONSTRAINT eos_stakeholders_classification_check CHECK (classification IN ('public','internal','confidential','restricted')),
  CONSTRAINT eos_stakeholders_source_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_stakeholders_external_source_check CHECK (external_id IS NULL OR source_system IS NOT NULL),
  CONSTRAINT eos_stakeholders_valid_window_check CHECK (valid_until IS NULL OR valid_until > valid_from), UNIQUE(company_id, stakeholder_key), UNIQUE(company_id, identity_reference_hash)
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_stakeholders_external_identity_idx ON eos_stakeholders(company_id, source_system, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS eos_stakeholders_owner_state_idx ON eos_stakeholders(owner_seat_id, state);

CREATE TABLE IF NOT EXISTS eos_stakeholder_relationships (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE, portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL, relationship_key text NOT NULL,
  stakeholder_id text NOT NULL REFERENCES eos_stakeholders(id) ON DELETE CASCADE, relationship_type text NOT NULL, title text NOT NULL, state text NOT NULL DEFAULT 'proposed', owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  need_constraint text NOT NULL DEFAULT '', fit_hypothesis text NOT NULL DEFAULT '', next_best_action text NOT NULL DEFAULT '', evidence_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_authority text NOT NULL DEFAULT 'native_eos', classification text NOT NULL DEFAULT 'internal', schema_version text NOT NULL DEFAULT 'stakeholder-relationship-v1.0', recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_stakeholder_relationships_type_check CHECK (relationship_type IN ('prospect','customer','partner','vendor_provider','employee','candidate','collaborator','community','investor','regulator','beneficiary','donor','alumni','other')),
  CONSTRAINT eos_stakeholder_relationships_state_check CHECK (state IN ('proposed','active','dormant','restricted','closed')),
  CONSTRAINT eos_stakeholder_relationships_classification_check CHECK (classification IN ('public','internal','confidential','restricted')), UNIQUE(company_id, relationship_key)
  ,CONSTRAINT eos_stakeholder_relationships_source_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled'))
);
CREATE INDEX IF NOT EXISTS eos_stakeholder_relationships_party_state_idx ON eos_stakeholder_relationships(stakeholder_id, state);
CREATE INDEX IF NOT EXISTS eos_stakeholder_relationships_owner_state_idx ON eos_stakeholder_relationships(owner_seat_id, state);

CREATE TABLE IF NOT EXISTS eos_offer_programs (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE, portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL, offer_key text NOT NULL, name text NOT NULL,
  offer_type text NOT NULL, state text NOT NULL DEFAULT 'thesis', owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT, problem_need text NOT NULL, promise_outcome text NOT NULL,
  audience_stakeholder_ids jsonb NOT NULL DEFAULT '[]'::jsonb, scope_inclusions text NOT NULL DEFAULT '', exclusions_constraints text NOT NULL DEFAULT '', delivery_model text NOT NULL DEFAULT '', pricing_economic_model text NOT NULL DEFAULT '', commercial_terms_authority text NOT NULL DEFAULT '', metric_keys jsonb NOT NULL DEFAULT '[]'::jsonb, workflow_keys jsonb NOT NULL DEFAULT '[]'::jsonb, evidence_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_authority text NOT NULL DEFAULT 'native_eos', classification text NOT NULL DEFAULT 'internal', schema_version text NOT NULL DEFAULT 'offer-program-v1.0', recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_offer_programs_type_check CHECK (offer_type IN ('service','product','program','subscription','engagement','content_series','internal_capability','other')),
  CONSTRAINT eos_offer_programs_state_check CHECK (state IN ('thesis','validation','active','paused','scaling','retired')),
  CONSTRAINT eos_offer_programs_classification_check CHECK (classification IN ('public','internal','confidential','restricted')), UNIQUE(company_id, offer_key)
  ,CONSTRAINT eos_offer_programs_source_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled'))
);
CREATE INDEX IF NOT EXISTS eos_offer_programs_owner_state_idx ON eos_offer_programs(owner_seat_id, state);

CREATE TABLE IF NOT EXISTS eos_commercial_cases (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE, portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL, case_key text NOT NULL, title text NOT NULL,
  object_class text NOT NULL, state text NOT NULL DEFAULT 'identified', owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT, stakeholder_ids jsonb NOT NULL DEFAULT '[]'::jsonb, offer_id text REFERENCES eos_offer_programs(id) ON DELETE SET NULL,
  value_estimate numeric(24,6), currency text NOT NULL DEFAULT 'USD', probability_confidence numeric(6,2), next_action text NOT NULL DEFAULT '', target_date timestamptz, result_outcome text NOT NULL DEFAULT '', risk_exception_keys jsonb NOT NULL DEFAULT '[]'::jsonb, evidence_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_id text, source_system text, source_authority text NOT NULL DEFAULT 'native_eos', classification text NOT NULL DEFAULT 'internal', schema_version text NOT NULL DEFAULT 'opportunity-engagement-case-v1.0', recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_commercial_cases_class_check CHECK (object_class IN ('commercial_opportunity','client_engagement','delivery_case','partnership','recruiting','content_campaign','internal_initiative','other')),
  CONSTRAINT eos_commercial_cases_state_check CHECK (state IN ('identified','qualifying','qualified','proposal','negotiation','committed','active','on_hold','won','lost','disqualified','completed','closed')),
  CONSTRAINT eos_commercial_cases_probability_check CHECK (probability_confidence IS NULL OR (probability_confidence >= 0 AND probability_confidence <= 100)),
  CONSTRAINT eos_commercial_cases_classification_check CHECK (classification IN ('public','internal','confidential','restricted')), UNIQUE(company_id, case_key)
  ,CONSTRAINT eos_commercial_cases_source_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled'))
  ,CONSTRAINT eos_commercial_cases_external_source_check CHECK (external_id IS NULL OR source_system IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_commercial_cases_external_idx ON eos_commercial_cases(company_id, source_system, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS eos_commercial_cases_owner_state_idx ON eos_commercial_cases(owner_seat_id, state);

CREATE TABLE IF NOT EXISTS eos_value_flows (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE, portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL, value_flow_key text NOT NULL, title text NOT NULL,
  flow_type text NOT NULL, state text NOT NULL DEFAULT 'proposed', owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT, from_stakeholder_id text REFERENCES eos_stakeholders(id) ON DELETE RESTRICT, to_stakeholder_id text REFERENCES eos_stakeholders(id) ON DELETE RESTRICT,
  offer_id text REFERENCES eos_offer_programs(id) ON DELETE SET NULL, commercial_case_id text REFERENCES eos_commercial_cases(id) ON DELETE SET NULL, amount numeric(24,6), currency text NOT NULL DEFAULT 'USD', due_effective_at timestamptz, attribution_notes text NOT NULL DEFAULT '', agreement_reference text NOT NULL DEFAULT '', evidence_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_id text, source_system text, source_authority text NOT NULL DEFAULT 'native_eos', classification text NOT NULL DEFAULT 'internal', schema_version text NOT NULL DEFAULT 'value-flow-commitment-v1.0', recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_value_flows_type_check CHECK (flow_type IN ('commitment','proposal','invoice','payment','refund','cost','revenue','referral','lead_attribution','outcome','resource_allocation','other')),
  CONSTRAINT eos_value_flows_state_check CHECK (state IN ('proposed','committed','invoiced','paid_settled','partially_settled','failed','cancelled','reconciled')),
  CONSTRAINT eos_value_flows_endpoint_check CHECK (from_stakeholder_id IS NOT NULL OR to_stakeholder_id IS NOT NULL), CONSTRAINT eos_value_flows_amount_check CHECK (amount IS NULL OR amount >= 0),
  CONSTRAINT eos_value_flows_classification_check CHECK (classification IN ('public','internal','confidential','restricted')), UNIQUE(company_id, value_flow_key)
  ,CONSTRAINT eos_value_flows_source_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled'))
  ,CONSTRAINT eos_value_flows_provider_fact_check CHECK (flow_type NOT IN ('invoice','payment','refund','cost','revenue') OR (source_authority IN ('external_authoritative','reconciled') AND source_system IS NOT NULL AND external_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_value_flows_external_idx ON eos_value_flows(company_id, source_system, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS eos_value_flows_owner_state_idx ON eos_value_flows(owner_seat_id, state);
CREATE INDEX IF NOT EXISTS eos_value_flows_case_state_idx ON eos_value_flows(commercial_case_id, state);

CREATE OR REPLACE FUNCTION eos_protect_external_commercial_projection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.source_authority = 'external_authoritative' THEN
    RAISE EXCEPTION 'External-authoritative commercial projections are immutable; append a reconciled correction';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS eos_stakeholders_protect_external ON eos_stakeholders;
CREATE TRIGGER eos_stakeholders_protect_external BEFORE UPDATE OR DELETE ON eos_stakeholders FOR EACH ROW EXECUTE FUNCTION eos_protect_external_commercial_projection();
DROP TRIGGER IF EXISTS eos_stakeholder_relationships_protect_external ON eos_stakeholder_relationships;
CREATE TRIGGER eos_stakeholder_relationships_protect_external BEFORE UPDATE OR DELETE ON eos_stakeholder_relationships FOR EACH ROW EXECUTE FUNCTION eos_protect_external_commercial_projection();
DROP TRIGGER IF EXISTS eos_offer_programs_protect_external ON eos_offer_programs;
CREATE TRIGGER eos_offer_programs_protect_external BEFORE UPDATE OR DELETE ON eos_offer_programs FOR EACH ROW EXECUTE FUNCTION eos_protect_external_commercial_projection();
DROP TRIGGER IF EXISTS eos_commercial_cases_protect_external ON eos_commercial_cases;
CREATE TRIGGER eos_commercial_cases_protect_external BEFORE UPDATE OR DELETE ON eos_commercial_cases FOR EACH ROW EXECUTE FUNCTION eos_protect_external_commercial_projection();
DROP TRIGGER IF EXISTS eos_value_flows_protect_external ON eos_value_flows;
CREATE TRIGGER eos_value_flows_protect_external BEFORE UPDATE OR DELETE ON eos_value_flows FOR EACH ROW EXECUTE FUNCTION eos_protect_external_commercial_projection();
