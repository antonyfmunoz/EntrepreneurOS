-- Jurisdiction packs preserve counsel-attributed source, review, and company
-- applicability evidence. EOS records those claims but does not verify a
-- professional license, determine the law, or silently apply a pack.

CREATE TABLE IF NOT EXISTS eos_esign_jurisdiction_packs (
  id text PRIMARY KEY,
  portfolio_id integer NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  source_company_id integer NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  pack_key text NOT NULL,
  pack_version integer NOT NULL,
  name text NOT NULL,
  country_code text NOT NULL,
  subdivision text NOT NULL DEFAULT '',
  governing_law_label text NOT NULL,
  scope_summary text NOT NULL,
  applicability_criteria text NOT NULL,
  exclusions text NOT NULL,
  required_reviews jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  effective_from text NOT NULL,
  reviewed_through text NOT NULL,
  next_review_at text NOT NULL,
  content_sha256 text NOT NULL,
  classification text NOT NULL DEFAULT 'confidential',
  state text NOT NULL DEFAULT 'draft',
  prepared_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  prepared_at timestamptz NOT NULL,
  review_evidence_id text REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  reviewer_name text NOT NULL DEFAULT '',
  reviewer_organization text NOT NULL DEFAULT '',
  reviewer_credential_reference text NOT NULL DEFAULT '',
  publication_note text NOT NULL DEFAULT '',
  publication_policy_decision_id text REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT,
  published_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  published_at timestamptz,
  withdrawn_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  withdrawn_at timestamptz,
  withdrawal_reason text NOT NULL DEFAULT '',
  CONSTRAINT eos_esign_jurisdiction_pack_state_check CHECK (state IN ('draft','published','withdrawn')),
  CONSTRAINT eos_esign_jurisdiction_pack_classification_check CHECK (classification IN ('internal','confidential','restricted')),
  CONSTRAINT eos_esign_jurisdiction_pack_hash_check CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_esign_jurisdiction_pack_version_check CHECK (pack_version > 0),
  CONSTRAINT eos_esign_jurisdiction_pack_country_check CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT eos_esign_jurisdiction_pack_dates_check CHECK (effective_from ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND reviewed_through ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND next_review_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND reviewed_through >= effective_from AND next_review_at > reviewed_through),
  CONSTRAINT eos_esign_jurisdiction_pack_json_check CHECK (jsonb_typeof(required_reviews) = 'array' AND jsonb_array_length(required_reviews) > 0 AND jsonb_typeof(source_references) = 'array' AND jsonb_array_length(source_references) > 0),
  CONSTRAINT eos_esign_jurisdiction_pack_publication_check CHECK ((state = 'draft' AND review_evidence_id IS NULL AND publication_policy_decision_id IS NULL AND published_by_user_id IS NULL AND published_at IS NULL) OR (state IN ('published','withdrawn') AND review_evidence_id IS NOT NULL AND length(reviewer_name) >= 2 AND length(reviewer_organization) >= 2 AND length(reviewer_credential_reference) >= 5 AND length(publication_note) >= 20 AND publication_policy_decision_id IS NOT NULL AND published_by_user_id IS NOT NULL AND published_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_jurisdiction_pack_version_idx ON eos_esign_jurisdiction_packs(portfolio_id, pack_key, pack_version);
CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_jurisdiction_pack_hash_idx ON eos_esign_jurisdiction_packs(portfolio_id, content_sha256);
CREATE INDEX IF NOT EXISTS eos_esign_jurisdiction_pack_state_idx ON eos_esign_jurisdiction_packs(portfolio_id, state, prepared_at);

CREATE TABLE IF NOT EXISTS eos_esign_jurisdiction_pack_applicability_decisions (
  id text PRIMARY KEY,
  pack_id text NOT NULL REFERENCES eos_esign_jurisdiction_packs(id) ON DELETE RESTRICT,
  portfolio_id integer NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  pack_sha256 text NOT NULL,
  outcome text NOT NULL,
  facts_considered text NOT NULL,
  decision_rationale text NOT NULL,
  review_evidence_id text NOT NULL REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  reviewer_name text NOT NULL,
  reviewer_organization text NOT NULL,
  reviewer_credential_reference text NOT NULL,
  policy_decision_id text NOT NULL REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT,
  decision_sha256 text NOT NULL,
  decided_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decided_at timestamptz NOT NULL,
  CONSTRAINT eos_esign_jurisdiction_applicability_outcome_check CHECK (outcome IN ('applicable','not_applicable','needs_revision')),
  CONSTRAINT eos_esign_jurisdiction_applicability_hash_check CHECK (pack_sha256 ~ '^[0-9a-f]{64}$' AND decision_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_esign_jurisdiction_applicability_review_check CHECK (length(reviewer_name) >= 2 AND length(reviewer_organization) >= 2 AND length(reviewer_credential_reference) >= 5 AND length(facts_considered) >= 20 AND length(decision_rationale) >= 20)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_jurisdiction_applicability_company_idx ON eos_esign_jurisdiction_pack_applicability_decisions(pack_id, company_id);
CREATE INDEX IF NOT EXISTS eos_esign_jurisdiction_applicability_portfolio_idx ON eos_esign_jurisdiction_pack_applicability_decisions(portfolio_id, company_id, decided_at);

ALTER TABLE eos_esign_portfolio_template_proposals
  ADD COLUMN IF NOT EXISTS jurisdiction_pack_id text REFERENCES eos_esign_jurisdiction_packs(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS jurisdiction_pack_sha256 text;
ALTER TABLE eos_esign_portfolio_template_proposals DROP CONSTRAINT IF EXISTS eos_esign_portfolio_proposal_pack_check;
ALTER TABLE eos_esign_portfolio_template_proposals ADD CONSTRAINT eos_esign_portfolio_proposal_pack_check CHECK ((jurisdiction_pack_id IS NULL AND jurisdiction_pack_sha256 IS NULL) OR (jurisdiction_pack_id IS NOT NULL AND jurisdiction_pack_sha256 ~ '^[0-9a-f]{64}$'));

CREATE OR REPLACE FUNCTION eos_protect_jurisdiction_packs()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'EOS jurisdiction packs cannot be deleted'; END IF;
  IF OLD.state = 'draft' AND NEW.state = 'published' AND
     NEW.id IS NOT DISTINCT FROM OLD.id AND NEW.portfolio_id IS NOT DISTINCT FROM OLD.portfolio_id AND NEW.source_company_id IS NOT DISTINCT FROM OLD.source_company_id AND
     NEW.pack_key IS NOT DISTINCT FROM OLD.pack_key AND NEW.pack_version IS NOT DISTINCT FROM OLD.pack_version AND NEW.name IS NOT DISTINCT FROM OLD.name AND
     NEW.country_code IS NOT DISTINCT FROM OLD.country_code AND NEW.subdivision IS NOT DISTINCT FROM OLD.subdivision AND NEW.governing_law_label IS NOT DISTINCT FROM OLD.governing_law_label AND
     NEW.scope_summary IS NOT DISTINCT FROM OLD.scope_summary AND NEW.applicability_criteria IS NOT DISTINCT FROM OLD.applicability_criteria AND NEW.exclusions IS NOT DISTINCT FROM OLD.exclusions AND
     NEW.required_reviews IS NOT DISTINCT FROM OLD.required_reviews AND NEW.source_references IS NOT DISTINCT FROM OLD.source_references AND
     NEW.effective_from IS NOT DISTINCT FROM OLD.effective_from AND NEW.reviewed_through IS NOT DISTINCT FROM OLD.reviewed_through AND NEW.next_review_at IS NOT DISTINCT FROM OLD.next_review_at AND
     NEW.content_sha256 IS NOT DISTINCT FROM OLD.content_sha256 AND NEW.classification IS NOT DISTINCT FROM OLD.classification AND
     NEW.prepared_by_user_id IS NOT DISTINCT FROM OLD.prepared_by_user_id AND NEW.prepared_at IS NOT DISTINCT FROM OLD.prepared_at AND
     NEW.review_evidence_id IS NOT NULL AND length(NEW.reviewer_name) >= 2 AND length(NEW.reviewer_organization) >= 2 AND length(NEW.reviewer_credential_reference) >= 5 AND length(NEW.publication_note) >= 20 AND
     NEW.publication_policy_decision_id IS NOT NULL AND NEW.published_by_user_id IS NOT NULL AND NEW.published_at IS NOT NULL AND
     NEW.withdrawn_by_user_id IS NULL AND NEW.withdrawn_at IS NULL AND NEW.withdrawal_reason = ''
  THEN RETURN NEW; END IF;
  IF OLD.state = 'published' AND NEW.state = 'withdrawn' AND
     NEW.id IS NOT DISTINCT FROM OLD.id AND NEW.portfolio_id IS NOT DISTINCT FROM OLD.portfolio_id AND NEW.source_company_id IS NOT DISTINCT FROM OLD.source_company_id AND
     NEW.pack_key IS NOT DISTINCT FROM OLD.pack_key AND NEW.pack_version IS NOT DISTINCT FROM OLD.pack_version AND NEW.name IS NOT DISTINCT FROM OLD.name AND
     NEW.country_code IS NOT DISTINCT FROM OLD.country_code AND NEW.subdivision IS NOT DISTINCT FROM OLD.subdivision AND NEW.governing_law_label IS NOT DISTINCT FROM OLD.governing_law_label AND
     NEW.scope_summary IS NOT DISTINCT FROM OLD.scope_summary AND NEW.applicability_criteria IS NOT DISTINCT FROM OLD.applicability_criteria AND NEW.exclusions IS NOT DISTINCT FROM OLD.exclusions AND
     NEW.required_reviews IS NOT DISTINCT FROM OLD.required_reviews AND NEW.source_references IS NOT DISTINCT FROM OLD.source_references AND
     NEW.effective_from IS NOT DISTINCT FROM OLD.effective_from AND NEW.reviewed_through IS NOT DISTINCT FROM OLD.reviewed_through AND NEW.next_review_at IS NOT DISTINCT FROM OLD.next_review_at AND
     NEW.content_sha256 IS NOT DISTINCT FROM OLD.content_sha256 AND NEW.classification IS NOT DISTINCT FROM OLD.classification AND
     NEW.prepared_by_user_id IS NOT DISTINCT FROM OLD.prepared_by_user_id AND NEW.prepared_at IS NOT DISTINCT FROM OLD.prepared_at AND
     NEW.review_evidence_id IS NOT DISTINCT FROM OLD.review_evidence_id AND NEW.reviewer_name IS NOT DISTINCT FROM OLD.reviewer_name AND NEW.reviewer_organization IS NOT DISTINCT FROM OLD.reviewer_organization AND
     NEW.reviewer_credential_reference IS NOT DISTINCT FROM OLD.reviewer_credential_reference AND NEW.publication_note IS NOT DISTINCT FROM OLD.publication_note AND
     NEW.publication_policy_decision_id IS NOT DISTINCT FROM OLD.publication_policy_decision_id AND NEW.published_by_user_id IS NOT DISTINCT FROM OLD.published_by_user_id AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at AND
     NEW.withdrawn_by_user_id IS NOT NULL AND NEW.withdrawn_at IS NOT NULL AND length(NEW.withdrawal_reason) >= 20
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'EOS jurisdiction pack content and review custody are immutable';
END;
$$;

DROP TRIGGER IF EXISTS eos_esign_jurisdiction_packs_immutable ON eos_esign_jurisdiction_packs;
CREATE TRIGGER eos_esign_jurisdiction_packs_immutable BEFORE UPDATE OR DELETE ON eos_esign_jurisdiction_packs
  FOR EACH ROW EXECUTE FUNCTION eos_protect_jurisdiction_packs();

CREATE OR REPLACE FUNCTION eos_reject_jurisdiction_applicability_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'EOS jurisdiction applicability decisions are append-only'; END;
$$;

DROP TRIGGER IF EXISTS eos_esign_jurisdiction_applicability_immutable ON eos_esign_jurisdiction_pack_applicability_decisions;
CREATE TRIGGER eos_esign_jurisdiction_applicability_immutable BEFORE UPDATE OR DELETE ON eos_esign_jurisdiction_pack_applicability_decisions
  FOR EACH ROW EXECUTE FUNCTION eos_reject_jurisdiction_applicability_mutation();

-- Replace the proposal guard so pack lineage cannot be attached or changed
-- after the immutable proposal snapshot is created.
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
     NEW.review_evidence_id IS NOT DISTINCT FROM OLD.review_evidence_id AND NEW.review_authority IS NOT DISTINCT FROM OLD.review_authority AND
     NEW.jurisdiction_pack_id IS NOT DISTINCT FROM OLD.jurisdiction_pack_id AND NEW.jurisdiction_pack_sha256 IS NOT DISTINCT FROM OLD.jurisdiction_pack_sha256 AND
     NEW.classification IS NOT DISTINCT FROM OLD.classification AND NEW.created_by_user_id IS NOT DISTINCT FROM OLD.created_by_user_id AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at AND
     NEW.withdrawn_by_user_id IS NOT NULL AND NEW.withdrawn_at IS NOT NULL AND length(NEW.withdrawal_reason) >= 20
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'EOS portfolio contract proposal content is immutable';
END;
$$;
