-- Portfolio contract standards are proposals, never cross-company authority.
-- Adoption copies an immutable snapshot into a company-local draft that still
-- requires the company's existing founder approval before it can generate.

CREATE TABLE IF NOT EXISTS eos_esign_portfolio_template_proposals (
  id text PRIMARY KEY,
  portfolio_id integer NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  source_company_id integer NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  source_template_version_id text NOT NULL REFERENCES eos_esign_template_versions(id) ON DELETE RESTRICT,
  proposal_key text NOT NULL,
  proposal_version integer NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  source_version_label text NOT NULL,
  jurisdiction text NOT NULL,
  applicability_summary text NOT NULL,
  limitations text NOT NULL,
  title_template text NOT NULL,
  body_template text NOT NULL,
  variable_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  recipient_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  clause_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_content_sha256 text NOT NULL,
  proposal_sha256 text NOT NULL,
  review_evidence_id text NOT NULL REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  review_authority text NOT NULL,
  classification text NOT NULL DEFAULT 'confidential',
  state text NOT NULL DEFAULT 'proposed',
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  withdrawn_at timestamptz,
  withdrawal_reason text NOT NULL DEFAULT '',
  CONSTRAINT eos_esign_portfolio_proposal_state_check CHECK (state IN ('proposed','withdrawn')),
  CONSTRAINT eos_esign_portfolio_proposal_classification_check CHECK (classification IN ('internal','confidential','restricted')),
  CONSTRAINT eos_esign_portfolio_proposal_review_authority_check CHECK (review_authority IN ('qualified_counsel','internal_legal','business_review')),
  CONSTRAINT eos_esign_portfolio_proposal_hash_check CHECK (source_content_sha256 ~ '^[0-9a-f]{64}$' AND proposal_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_esign_portfolio_proposal_version_check CHECK (proposal_version > 0),
  CONSTRAINT eos_esign_portfolio_proposal_json_check CHECK (jsonb_typeof(variable_schema) = 'array' AND jsonb_typeof(recipient_schema) = 'array' AND jsonb_typeof(clause_snapshot) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_portfolio_proposal_version_idx ON eos_esign_portfolio_template_proposals(portfolio_id, proposal_key, proposal_version);
CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_portfolio_proposal_hash_idx ON eos_esign_portfolio_template_proposals(portfolio_id, proposal_sha256);
CREATE INDEX IF NOT EXISTS eos_esign_portfolio_proposal_state_idx ON eos_esign_portfolio_template_proposals(portfolio_id, state, created_at);

CREATE TABLE IF NOT EXISTS eos_esign_portfolio_template_adoptions (
  id text PRIMARY KEY,
  proposal_id text NOT NULL REFERENCES eos_esign_portfolio_template_proposals(id) ON DELETE RESTRICT,
  portfolio_id integer NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  decision text NOT NULL,
  decision_rationale text NOT NULL,
  review_evidence_id text NOT NULL REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  review_authority text NOT NULL,
  proposal_sha256 text NOT NULL,
  local_template_id text REFERENCES eos_esign_templates(id) ON DELETE RESTRICT,
  local_template_version_id text REFERENCES eos_esign_template_versions(id) ON DELETE RESTRICT,
  policy_decision_id text NOT NULL REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT,
  decision_sha256 text NOT NULL,
  decided_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decided_at timestamptz NOT NULL,
  CONSTRAINT eos_esign_portfolio_adoption_decision_check CHECK (decision IN ('accepted','rejected')),
  CONSTRAINT eos_esign_portfolio_adoption_review_authority_check CHECK (review_authority IN ('qualified_counsel','internal_legal','business_review')),
  CONSTRAINT eos_esign_portfolio_adoption_hash_check CHECK (proposal_sha256 ~ '^[0-9a-f]{64}$' AND decision_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_esign_portfolio_adoption_output_check CHECK ((decision = 'accepted' AND local_template_id IS NOT NULL AND local_template_version_id IS NOT NULL) OR (decision = 'rejected' AND local_template_id IS NULL AND local_template_version_id IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_portfolio_adoption_company_idx ON eos_esign_portfolio_template_adoptions(proposal_id, company_id);
CREATE INDEX IF NOT EXISTS eos_esign_portfolio_adoption_portfolio_idx ON eos_esign_portfolio_template_adoptions(portfolio_id, company_id, decided_at);

CREATE OR REPLACE FUNCTION eos_protect_portfolio_template_proposals()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state = 'proposed' AND NEW.state = 'withdrawn' AND
     NEW.id IS NOT DISTINCT FROM OLD.id AND NEW.portfolio_id IS NOT DISTINCT FROM OLD.portfolio_id AND
     NEW.source_company_id IS NOT DISTINCT FROM OLD.source_company_id AND NEW.source_template_version_id IS NOT DISTINCT FROM OLD.source_template_version_id AND
     NEW.proposal_key IS NOT DISTINCT FROM OLD.proposal_key AND NEW.proposal_version IS NOT DISTINCT FROM OLD.proposal_version AND
     NEW.name IS NOT DISTINCT FROM OLD.name AND NEW.description IS NOT DISTINCT FROM OLD.description AND NEW.source_version_label IS NOT DISTINCT FROM OLD.source_version_label AND
     NEW.jurisdiction IS NOT DISTINCT FROM OLD.jurisdiction AND NEW.applicability_summary IS NOT DISTINCT FROM OLD.applicability_summary AND NEW.limitations IS NOT DISTINCT FROM OLD.limitations AND
     NEW.title_template IS NOT DISTINCT FROM OLD.title_template AND NEW.body_template IS NOT DISTINCT FROM OLD.body_template AND
     NEW.variable_schema IS NOT DISTINCT FROM OLD.variable_schema AND NEW.recipient_schema IS NOT DISTINCT FROM OLD.recipient_schema AND NEW.clause_snapshot IS NOT DISTINCT FROM OLD.clause_snapshot AND
     NEW.source_content_sha256 IS NOT DISTINCT FROM OLD.source_content_sha256 AND NEW.proposal_sha256 IS NOT DISTINCT FROM OLD.proposal_sha256 AND
     NEW.review_evidence_id IS NOT DISTINCT FROM OLD.review_evidence_id AND NEW.review_authority IS NOT DISTINCT FROM OLD.review_authority AND NEW.classification IS NOT DISTINCT FROM OLD.classification AND
     NEW.created_by_user_id IS NOT DISTINCT FROM OLD.created_by_user_id AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at AND
     NEW.withdrawn_by_user_id IS NOT NULL AND NEW.withdrawn_at IS NOT NULL AND length(NEW.withdrawal_reason) >= 20
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'EOS portfolio contract proposal content is immutable';
END;
$$;

DROP TRIGGER IF EXISTS eos_esign_portfolio_template_proposals_immutable ON eos_esign_portfolio_template_proposals;
CREATE TRIGGER eos_esign_portfolio_template_proposals_immutable BEFORE UPDATE OR DELETE ON eos_esign_portfolio_template_proposals
  FOR EACH ROW EXECUTE FUNCTION eos_protect_portfolio_template_proposals();

CREATE OR REPLACE FUNCTION eos_reject_portfolio_template_adoption_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'EOS portfolio contract adoption decisions are append-only'; END;
$$;

DROP TRIGGER IF EXISTS eos_esign_portfolio_template_adoptions_immutable ON eos_esign_portfolio_template_adoptions;
CREATE TRIGGER eos_esign_portfolio_template_adoptions_immutable BEFORE UPDATE OR DELETE ON eos_esign_portfolio_template_adoptions
  FOR EACH ROW EXECUTE FUNCTION eos_reject_portfolio_template_adoption_mutation();
