-- Native Module 13 control center. EOS preserves attributable source and
-- professional-review claims; it does not verify licenses or determine law.
CREATE TABLE IF NOT EXISTS eos_compliance_source_versions (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  source_version integer NOT NULL,
  version_label text NOT NULL,
  title text NOT NULL,
  source_type text NOT NULL,
  authority_system text NOT NULL,
  authoritative_reference text NOT NULL,
  jurisdiction_regime text NOT NULL,
  summary text NOT NULL,
  effective_from text NOT NULL,
  effective_until text,
  reviewed_through text NOT NULL,
  next_review_at text NOT NULL,
  content_sha256 text NOT NULL,
  classification text NOT NULL DEFAULT 'confidential',
  state text NOT NULL DEFAULT 'draft',
  review_evidence_id text REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  review_authority text,
  reviewer_name text,
  reviewer_organization text,
  reviewer_credential_reference text,
  limitations text NOT NULL DEFAULT '',
  verification_policy_decision_id text REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT,
  prepared_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  prepared_at timestamptz NOT NULL DEFAULT now(),
  verified_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  verified_at timestamptz,
  superseded_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  superseded_at timestamptz,
  supersession_reason text NOT NULL DEFAULT '',
  CONSTRAINT eos_compliance_source_version_check CHECK (source_version > 0),
  CONSTRAINT eos_compliance_source_type_check CHECK (source_type IN ('statute','regulation','contract','internal_policy','standard','professional_guidance','consent_notice','other')),
  CONSTRAINT eos_compliance_source_state_check CHECK (state IN ('draft','verified','superseded')),
  CONSTRAINT eos_compliance_source_hash_check CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_compliance_source_classification_check CHECK (classification IN ('public','internal','confidential','restricted')),
  CONSTRAINT eos_compliance_source_date_check CHECK (effective_from ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND reviewed_through ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND next_review_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND (effective_until IS NULL OR effective_until ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')),
  CONSTRAINT eos_compliance_source_date_order_check CHECK ((effective_until IS NULL OR effective_until > effective_from) AND reviewed_through >= effective_from AND next_review_at > reviewed_through),
  CONSTRAINT eos_compliance_source_verification_check CHECK (
    (state = 'draft' AND review_evidence_id IS NULL AND verification_policy_decision_id IS NULL AND verified_by_user_id IS NULL AND verified_at IS NULL)
    OR
    (state IN ('verified','superseded') AND review_evidence_id IS NOT NULL AND review_authority IS NOT NULL AND length(reviewer_name) >= 2 AND length(reviewer_organization) >= 2 AND length(reviewer_credential_reference) >= 5 AND length(limitations) >= 20 AND verification_policy_decision_id IS NOT NULL AND verified_by_user_id IS NOT NULL AND verified_at IS NOT NULL)
  ),
  CONSTRAINT eos_compliance_source_supersession_check CHECK (
    state <> 'superseded' OR (superseded_by_user_id IS NOT NULL AND superseded_at IS NOT NULL AND length(supersession_reason) >= 20)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_compliance_source_company_version_idx ON eos_compliance_source_versions(company_id, source_key, source_version);
CREATE UNIQUE INDEX IF NOT EXISTS eos_compliance_source_hash_idx ON eos_compliance_source_versions(company_id, content_sha256);
CREATE INDEX IF NOT EXISTS eos_compliance_source_state_idx ON eos_compliance_source_versions(company_id, state, next_review_at);

CREATE TABLE IF NOT EXISTS eos_compliance_requirements (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requirement_key text NOT NULL,
  requirement_version integer NOT NULL,
  requirement_type text NOT NULL,
  source_version_id text NOT NULL REFERENCES eos_compliance_source_versions(id) ON DELETE RESTRICT,
  source_sha256 text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  subject_scope text NOT NULL,
  source_requirement text NOT NULL,
  jurisdiction_regime text NOT NULL,
  processing_purpose text NOT NULL DEFAULT '',
  legal_basis_claim text NOT NULL DEFAULT '',
  retention_trigger text NOT NULL DEFAULT '',
  retention_period text NOT NULL DEFAULT '',
  disposition_method text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'identified',
  version integer NOT NULL DEFAULT 1,
  due_review_at text NOT NULL,
  classification text NOT NULL DEFAULT 'confidential',
  definition_sha256 text NOT NULL,
  last_review_id text,
  last_reviewed_at timestamptz,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_compliance_requirement_type_check CHECK (requirement_type IN ('obligation','right','consent','policy','retention_rule','control')),
  CONSTRAINT eos_compliance_requirement_state_check CHECK (state IN ('identified','under_assessment','applicable_active','monitoring','overdue_breached','remediating','satisfied_closed','superseded')),
  CONSTRAINT eos_compliance_requirement_version_check CHECK (requirement_version > 0 AND version > 0),
  CONSTRAINT eos_compliance_requirement_hash_check CHECK (source_sha256 ~ '^[0-9a-f]{64}$' AND definition_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_compliance_requirement_date_check CHECK (due_review_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  CONSTRAINT eos_compliance_requirement_classification_check CHECK (classification IN ('public','internal','confidential','restricted')),
  CONSTRAINT eos_compliance_requirement_retention_check CHECK (requirement_type <> 'retention_rule' OR (length(retention_trigger) >= 3 AND length(retention_period) >= 3 AND length(disposition_method) >= 3))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_compliance_requirement_company_version_idx ON eos_compliance_requirements(company_id, requirement_key, requirement_version);
CREATE UNIQUE INDEX IF NOT EXISTS eos_compliance_requirement_hash_idx ON eos_compliance_requirements(company_id, definition_sha256);
CREATE INDEX IF NOT EXISTS eos_compliance_requirement_state_idx ON eos_compliance_requirements(company_id, state, due_review_at);
CREATE INDEX IF NOT EXISTS eos_compliance_requirement_owner_idx ON eos_compliance_requirements(owner_seat_id, state);

CREATE TABLE IF NOT EXISTS eos_compliance_requirement_reviews (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requirement_id text NOT NULL REFERENCES eos_compliance_requirements(id) ON DELETE RESTRICT,
  requirement_version integer NOT NULL,
  source_version_id text NOT NULL REFERENCES eos_compliance_source_versions(id) ON DELETE RESTRICT,
  source_sha256 text NOT NULL,
  review_kind text NOT NULL,
  outcome text NOT NULL,
  state_before text NOT NULL,
  state_after text NOT NULL,
  review_evidence_id text NOT NULL REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  review_authority text NOT NULL,
  reviewer_name text NOT NULL,
  reviewer_organization text NOT NULL,
  reviewer_credential_reference text NOT NULL,
  facts_considered text NOT NULL,
  rationale text NOT NULL,
  next_review_at text,
  policy_decision_id text NOT NULL REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT,
  review_sha256 text NOT NULL,
  reviewed_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_compliance_review_kind_check CHECK (review_kind IN ('applicability','periodic_review','control_test','closure')),
  CONSTRAINT eos_compliance_review_outcome_check CHECK (outcome IN ('applicable','not_applicable','needs_revision','effective','ineffective','inconclusive','satisfied','breached')),
  CONSTRAINT eos_compliance_review_authority_check CHECK (review_authority IN ('qualified_counsel','privacy_professional','internal_compliance','business_owner')),
  CONSTRAINT eos_compliance_review_hash_check CHECK (source_sha256 ~ '^[0-9a-f]{64}$' AND review_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_compliance_review_detail_check CHECK (length(reviewer_name) >= 2 AND length(reviewer_organization) >= 2 AND length(reviewer_credential_reference) >= 5 AND length(facts_considered) >= 20 AND length(rationale) >= 20),
  CONSTRAINT eos_compliance_review_next_date_check CHECK (next_review_at IS NULL OR next_review_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_compliance_review_hash_idx ON eos_compliance_requirement_reviews(review_sha256);
CREATE INDEX IF NOT EXISTS eos_compliance_review_requirement_idx ON eos_compliance_requirement_reviews(requirement_id, requirement_version);
CREATE INDEX IF NOT EXISTS eos_compliance_review_company_idx ON eos_compliance_requirement_reviews(company_id, reviewed_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'eos_compliance_requirement_last_review_fk'
      AND conrelid = 'eos_compliance_requirements'::regclass
  ) THEN
    ALTER TABLE eos_compliance_requirements
      ADD CONSTRAINT eos_compliance_requirement_last_review_fk
      FOREIGN KEY (last_review_id) REFERENCES eos_compliance_requirement_reviews(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION eos_guard_compliance_source_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state = 'draft' AND NEW.state = 'verified'
     AND NEW.id IS NOT DISTINCT FROM OLD.id AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id
     AND NEW.source_key IS NOT DISTINCT FROM OLD.source_key AND NEW.source_version IS NOT DISTINCT FROM OLD.source_version
     AND NEW.version_label IS NOT DISTINCT FROM OLD.version_label AND NEW.title IS NOT DISTINCT FROM OLD.title
     AND NEW.source_type IS NOT DISTINCT FROM OLD.source_type AND NEW.authority_system IS NOT DISTINCT FROM OLD.authority_system
     AND NEW.authoritative_reference IS NOT DISTINCT FROM OLD.authoritative_reference AND NEW.jurisdiction_regime IS NOT DISTINCT FROM OLD.jurisdiction_regime
     AND NEW.summary IS NOT DISTINCT FROM OLD.summary AND NEW.effective_from IS NOT DISTINCT FROM OLD.effective_from
     AND NEW.effective_until IS NOT DISTINCT FROM OLD.effective_until AND NEW.reviewed_through IS NOT DISTINCT FROM OLD.reviewed_through
     AND NEW.next_review_at IS NOT DISTINCT FROM OLD.next_review_at AND NEW.content_sha256 IS NOT DISTINCT FROM OLD.content_sha256
     AND NEW.classification IS NOT DISTINCT FROM OLD.classification AND NEW.prepared_by_user_id IS NOT DISTINCT FROM OLD.prepared_by_user_id
     AND NEW.prepared_at IS NOT DISTINCT FROM OLD.prepared_at AND NEW.superseded_by_user_id IS NOT DISTINCT FROM OLD.superseded_by_user_id
     AND NEW.superseded_at IS NOT DISTINCT FROM OLD.superseded_at AND NEW.supersession_reason IS NOT DISTINCT FROM OLD.supersession_reason THEN
    RETURN NEW;
  END IF;
  IF OLD.state = 'verified' AND NEW.state = 'superseded'
     AND NEW.id IS NOT DISTINCT FROM OLD.id AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id
     AND NEW.source_key IS NOT DISTINCT FROM OLD.source_key AND NEW.source_version IS NOT DISTINCT FROM OLD.source_version
     AND NEW.version_label IS NOT DISTINCT FROM OLD.version_label AND NEW.title IS NOT DISTINCT FROM OLD.title
     AND NEW.source_type IS NOT DISTINCT FROM OLD.source_type AND NEW.authority_system IS NOT DISTINCT FROM OLD.authority_system
     AND NEW.authoritative_reference IS NOT DISTINCT FROM OLD.authoritative_reference AND NEW.jurisdiction_regime IS NOT DISTINCT FROM OLD.jurisdiction_regime
     AND NEW.summary IS NOT DISTINCT FROM OLD.summary AND NEW.effective_from IS NOT DISTINCT FROM OLD.effective_from
     AND NEW.effective_until IS NOT DISTINCT FROM OLD.effective_until AND NEW.reviewed_through IS NOT DISTINCT FROM OLD.reviewed_through
     AND NEW.next_review_at IS NOT DISTINCT FROM OLD.next_review_at AND NEW.content_sha256 IS NOT DISTINCT FROM OLD.content_sha256
     AND NEW.classification IS NOT DISTINCT FROM OLD.classification AND NEW.review_evidence_id IS NOT DISTINCT FROM OLD.review_evidence_id
     AND NEW.review_authority IS NOT DISTINCT FROM OLD.review_authority AND NEW.reviewer_name IS NOT DISTINCT FROM OLD.reviewer_name
     AND NEW.reviewer_organization IS NOT DISTINCT FROM OLD.reviewer_organization AND NEW.reviewer_credential_reference IS NOT DISTINCT FROM OLD.reviewer_credential_reference
     AND NEW.limitations IS NOT DISTINCT FROM OLD.limitations AND NEW.verification_policy_decision_id IS NOT DISTINCT FROM OLD.verification_policy_decision_id
     AND NEW.prepared_by_user_id IS NOT DISTINCT FROM OLD.prepared_by_user_id AND NEW.prepared_at IS NOT DISTINCT FROM OLD.prepared_at
     AND NEW.verified_by_user_id IS NOT DISTINCT FROM OLD.verified_by_user_id AND NEW.verified_at IS NOT DISTINCT FROM OLD.verified_at THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'EOS compliance source versions are immutable outside governed verification or supersession';
END;
$$;
DROP TRIGGER IF EXISTS eos_compliance_source_immutable ON eos_compliance_source_versions;
CREATE TRIGGER eos_compliance_source_immutable BEFORE UPDATE OR DELETE ON eos_compliance_source_versions
  FOR EACH ROW EXECUTE FUNCTION eos_guard_compliance_source_mutation();

CREATE OR REPLACE FUNCTION eos_guard_compliance_requirement_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'EOS compliance requirements cannot be deleted'; END IF;
  IF NEW.id IS NOT DISTINCT FROM OLD.id AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id
     AND NEW.requirement_key IS NOT DISTINCT FROM OLD.requirement_key AND NEW.requirement_version IS NOT DISTINCT FROM OLD.requirement_version
     AND NEW.requirement_type IS NOT DISTINCT FROM OLD.requirement_type AND NEW.source_version_id IS NOT DISTINCT FROM OLD.source_version_id
     AND NEW.source_sha256 IS NOT DISTINCT FROM OLD.source_sha256 AND NEW.title IS NOT DISTINCT FROM OLD.title
     AND NEW.description IS NOT DISTINCT FROM OLD.description AND NEW.owner_seat_id IS NOT DISTINCT FROM OLD.owner_seat_id
     AND NEW.subject_scope IS NOT DISTINCT FROM OLD.subject_scope AND NEW.source_requirement IS NOT DISTINCT FROM OLD.source_requirement
     AND NEW.jurisdiction_regime IS NOT DISTINCT FROM OLD.jurisdiction_regime AND NEW.processing_purpose IS NOT DISTINCT FROM OLD.processing_purpose
     AND NEW.legal_basis_claim IS NOT DISTINCT FROM OLD.legal_basis_claim AND NEW.retention_trigger IS NOT DISTINCT FROM OLD.retention_trigger
     AND NEW.retention_period IS NOT DISTINCT FROM OLD.retention_period AND NEW.disposition_method IS NOT DISTINCT FROM OLD.disposition_method
     AND NEW.classification IS NOT DISTINCT FROM OLD.classification AND NEW.definition_sha256 IS NOT DISTINCT FROM OLD.definition_sha256
     AND NEW.recorded_by_user_id IS NOT DISTINCT FROM OLD.recorded_by_user_id AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
     AND NEW.version = OLD.version + 1 AND NEW.last_review_id IS DISTINCT FROM OLD.last_review_id
     AND NEW.last_reviewed_at IS NOT NULL AND EXISTS (
       SELECT 1 FROM eos_compliance_requirement_reviews review
       WHERE review.id = NEW.last_review_id AND review.requirement_id = OLD.id
         AND review.requirement_version = OLD.version AND review.state_before = OLD.state
         AND review.state_after = NEW.state AND review.reviewed_at = NEW.last_reviewed_at
         AND (review.next_review_at IS NULL OR review.next_review_at = NEW.due_review_at)
     ) THEN RETURN NEW;
  END IF;
  RAISE EXCEPTION 'EOS compliance requirement definitions are immutable; only governed lifecycle projection fields may change';
END;
$$;
DROP TRIGGER IF EXISTS eos_compliance_requirement_guard ON eos_compliance_requirements;
CREATE TRIGGER eos_compliance_requirement_guard BEFORE UPDATE OR DELETE ON eos_compliance_requirements
  FOR EACH ROW EXECUTE FUNCTION eos_guard_compliance_requirement_mutation();

CREATE OR REPLACE FUNCTION eos_reject_compliance_review_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'EOS compliance reviews are append-only'; END;
$$;
DROP TRIGGER IF EXISTS eos_compliance_review_immutable ON eos_compliance_requirement_reviews;
CREATE TRIGGER eos_compliance_review_immutable BEFORE UPDATE OR DELETE ON eos_compliance_requirement_reviews
  FOR EACH ROW EXECUTE FUNCTION eos_reject_compliance_review_mutation();
