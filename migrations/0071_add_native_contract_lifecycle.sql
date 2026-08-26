-- Governed native contract content and instance lineage.
-- Reusable clauses/templates are versioned separately from generated document
-- instances. Completed envelopes may cross into canonical Evidence only through
-- an explicit, attributable promotion receipt.

CREATE TABLE IF NOT EXISTS eos_esign_clauses (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  clause_key text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','retired')),
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  CONSTRAINT eos_esign_clause_key_unique UNIQUE (company_id, clause_key)
);

CREATE TABLE IF NOT EXISTS eos_esign_clause_versions (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  clause_id text NOT NULL REFERENCES eos_esign_clauses(id) ON DELETE RESTRICT,
  version_label text NOT NULL,
  body_text text NOT NULL,
  body_sha256 text NOT NULL CHECK (body_sha256 ~ '^[0-9a-f]{64}$'),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','approved','superseded')),
  counsel_evidence_id text REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  approved_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_clause_version_unique UNIQUE (clause_id, version_label),
  CONSTRAINT eos_esign_clause_approval_check CHECK (
    (state = 'draft' AND approved_by_user_id IS NULL AND approved_at IS NULL) OR
    (state IN ('approved','superseded') AND approved_by_user_id IS NOT NULL AND approved_at IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_clause_approved_idx
  ON eos_esign_clause_versions(clause_id) WHERE state = 'approved';

CREATE TABLE IF NOT EXISTS eos_esign_templates (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','retired')),
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  CONSTRAINT eos_esign_template_key_unique UNIQUE (company_id, template_key)
);

CREATE TABLE IF NOT EXISTS eos_esign_template_versions (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_id text NOT NULL REFERENCES eos_esign_templates(id) ON DELETE RESTRICT,
  version_label text NOT NULL,
  title_template text NOT NULL,
  body_template text NOT NULL,
  variable_schema jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(variable_schema) = 'array'),
  recipient_schema jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(recipient_schema) = 'array'),
  field_schema jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(field_schema) = 'array'),
  clause_version_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(clause_version_ids) = 'array'),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','approved','superseded')),
  counsel_evidence_id text REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  approved_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_template_version_unique UNIQUE (template_id, version_label),
  CONSTRAINT eos_esign_template_approval_check CHECK (
    (state = 'draft' AND approved_by_user_id IS NULL AND approved_at IS NULL) OR
    (state IN ('approved','superseded') AND approved_by_user_id IS NOT NULL AND approved_at IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_template_approved_idx
  ON eos_esign_template_versions(template_id) WHERE state = 'approved';

CREATE TABLE IF NOT EXISTS eos_esign_counterparties (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  party_type text NOT NULL CHECK (party_type IN ('person','organization')),
  legal_name text NOT NULL,
  display_name text NOT NULL,
  signer_name text NOT NULL DEFAULT '',
  signer_email text NOT NULL DEFAULT '',
  external_reference text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','archived')),
  data_classification text NOT NULL DEFAULT 'confidential' CHECK (data_classification IN ('internal','confidential','restricted')),
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE INDEX IF NOT EXISTS eos_esign_counterparty_lookup_idx
  ON eos_esign_counterparties(company_id, state, display_name);

ALTER TABLE eos_esign_document_versions
  ADD COLUMN IF NOT EXISTS template_version_id text REFERENCES eos_esign_template_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS counterparty_id text REFERENCES eos_esign_counterparties(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS work_packet_id text REFERENCES eos_work_packets(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS generation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE eos_esign_envelopes
  ADD COLUMN IF NOT EXISTS template_version_id text REFERENCES eos_esign_template_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS counterparty_id text REFERENCES eos_esign_counterparties(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS work_packet_id text REFERENCES eos_work_packets(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS evidence_id text REFERENCES eos_evidence(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS eos_esign_evidence_promotions (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  envelope_id text NOT NULL UNIQUE REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT,
  evidence_id text NOT NULL UNIQUE REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  work_packet_id text NOT NULL REFERENCES eos_work_packets(id) ON DELETE RESTRICT,
  promoted_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  supported_claim_summary text NOT NULL,
  verifier_method text NOT NULL,
  receipt_sha256 text NOT NULL UNIQUE CHECK (receipt_sha256 ~ '^[0-9a-f]{64}$'),
  promoted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION eos_protect_native_contract_versions()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'EOS native contract versions are append-only';
  END IF;
  IF TG_TABLE_NAME = 'eos_esign_clause_versions' THEN
    IF (OLD.id, OLD.company_id, OLD.clause_id, OLD.version_label, OLD.body_text, OLD.body_sha256,
      OLD.counsel_evidence_id, OLD.created_by_user_id, OLD.created_at) IS DISTINCT FROM
      (NEW.id, NEW.company_id, NEW.clause_id, NEW.version_label, NEW.body_text, NEW.body_sha256,
      NEW.counsel_evidence_id, NEW.created_by_user_id, NEW.created_at)
    THEN RAISE EXCEPTION 'EOS native clause version content is immutable'; END IF;
  ELSIF TG_TABLE_NAME = 'eos_esign_template_versions' THEN
    IF (OLD.id, OLD.company_id, OLD.template_id, OLD.version_label, OLD.title_template, OLD.body_template,
      OLD.variable_schema, OLD.recipient_schema, OLD.field_schema, OLD.clause_version_ids,
      OLD.content_sha256, OLD.counsel_evidence_id, OLD.created_by_user_id, OLD.created_at) IS DISTINCT FROM
      (NEW.id, NEW.company_id, NEW.template_id, NEW.version_label, NEW.title_template, NEW.body_template,
      NEW.variable_schema, NEW.recipient_schema, NEW.field_schema, NEW.clause_version_ids,
      NEW.content_sha256, NEW.counsel_evidence_id, NEW.created_by_user_id, NEW.created_at)
    THEN RAISE EXCEPTION 'EOS native template version content is immutable'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS eos_esign_clause_versions_immutable ON eos_esign_clause_versions;
CREATE TRIGGER eos_esign_clause_versions_immutable BEFORE UPDATE OR DELETE ON eos_esign_clause_versions
FOR EACH ROW EXECUTE FUNCTION eos_protect_native_contract_versions();
DROP TRIGGER IF EXISTS eos_esign_template_versions_immutable ON eos_esign_template_versions;
CREATE TRIGGER eos_esign_template_versions_immutable BEFORE UPDATE OR DELETE ON eos_esign_template_versions
FOR EACH ROW EXECUTE FUNCTION eos_protect_native_contract_versions();
DROP TRIGGER IF EXISTS eos_esign_evidence_promotions_immutable ON eos_esign_evidence_promotions;
CREATE TRIGGER eos_esign_evidence_promotions_immutable BEFORE UPDATE OR DELETE ON eos_esign_evidence_promotions
FOR EACH ROW EXECUTE FUNCTION eos_protect_native_esign_immutable_records();

ALTER TABLE eos_esign_events DROP CONSTRAINT IF EXISTS eos_esign_events_event_type_check;
ALTER TABLE eos_esign_events ADD CONSTRAINT eos_esign_events_event_type_check CHECK (event_type IN (
  'document_registered','document_generated','envelope_created','envelope_revised','envelope_issued','envelope_completed',
  'envelope_voided','envelope_expired','recipient_sent','recipient_opened','recipient_corrected','recipient_declined',
  'identity_otp_requested','identity_verified','consent_recorded','signature_recorded','delivery_prepared',
  'delivery_succeeded','delivery_failed','completion_delivery_prepared','completion_delivery_succeeded',
  'completion_delivery_failed','evidence_promoted','recovery_required','recovery_attempt_failed'
));
