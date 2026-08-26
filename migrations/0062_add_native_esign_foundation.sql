-- EOS-native electronic signing foundation.
-- Binary PDFs are stored in private artifact storage; Postgres retains bounded
-- metadata, immutable hashes, lifecycle state, and an append-only hash chain.

CREATE TABLE IF NOT EXISTS eos_esign_document_versions (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_key text NOT NULL,
  document_version text NOT NULL,
  title text NOT NULL,
  source_reference text NOT NULL,
  source_storage_key text NOT NULL,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  mime_type text NOT NULL DEFAULT 'application/pdf' CHECK (mime_type = 'application/pdf'),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 52428800),
  field_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  counsel_evidence_id text REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_document_version_key_unique UNIQUE (company_id, document_key, document_version)
);

CREATE INDEX IF NOT EXISTS eos_esign_document_version_evidence_idx
  ON eos_esign_document_versions(company_id, counsel_evidence_id);

CREATE TABLE IF NOT EXISTS eos_esign_envelopes (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_version_id text NOT NULL REFERENCES eos_esign_document_versions(id) ON DELETE RESTRICT,
  recovery_agreement_instance_id text,
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','issued','in_progress','completed','declined','voided','expired','recovery_required')),
  routing_mode text NOT NULL DEFAULT 'sequential' CHECK (routing_mode IN ('sequential','parallel')),
  subject text NOT NULL,
  message text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL,
  issued_at timestamptz,
  completed_at timestamptz,
  declined_at timestamptz,
  voided_at timestamptz,
  void_reason text NOT NULL DEFAULT '',
  final_storage_key text NOT NULL DEFAULT '',
  final_sha256 text NOT NULL DEFAULT '' CHECK (final_sha256 = '' OR final_sha256 ~ '^[0-9a-f]{64}$'),
  audit_storage_key text NOT NULL DEFAULT '',
  audit_sha256 text NOT NULL DEFAULT '' CHECK (audit_sha256 = '' OR audit_sha256 ~ '^[0-9a-f]{64}$'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eos_esign_envelope_state_idx
  ON eos_esign_envelopes(company_id, state, updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_envelope_recovery_idx
  ON eos_esign_envelopes(company_id, recovery_agreement_instance_id);

CREATE TABLE IF NOT EXISTS eos_esign_recipients (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  envelope_id text NOT NULL REFERENCES eos_esign_envelopes(id) ON DELETE CASCADE,
  role_key text NOT NULL,
  routing_order integer NOT NULL DEFAULT 1 CHECK (routing_order > 0),
  signer_name text NOT NULL,
  signer_email text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sent','opened','consented','signed','declined','expired')),
  token_digest text NOT NULL UNIQUE CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  token_expires_at timestamptz NOT NULL,
  token_used_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  consent_version text NOT NULL DEFAULT '',
  consented_at timestamptz,
  signature_method text NOT NULL DEFAULT '' CHECK (signature_method IN ('','typed','drawn','uploaded')),
  signature_name text NOT NULL DEFAULT '',
  signature_sha256 text NOT NULL DEFAULT '' CHECK (signature_sha256 = '' OR signature_sha256 ~ '^[0-9a-f]{64}$'),
  field_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  signed_at timestamptz,
  declined_at timestamptz,
  decline_reason text NOT NULL DEFAULT '',
  network_fingerprint_sha256 text NOT NULL DEFAULT '',
  user_agent_sha256 text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_recipient_role_unique UNIQUE (envelope_id, role_key)
);

CREATE INDEX IF NOT EXISTS eos_esign_recipient_state_idx
  ON eos_esign_recipients(company_id, state, updated_at);

CREATE TABLE IF NOT EXISTS eos_esign_events (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  envelope_id text NOT NULL REFERENCES eos_esign_envelopes(id) ON DELETE CASCADE,
  recipient_id text REFERENCES eos_esign_recipients(id) ON DELETE RESTRICT,
  sequence integer NOT NULL CHECK (sequence > 0),
  event_type text NOT NULL CHECK (event_type IN ('document_registered','envelope_created','envelope_issued','recipient_sent','recipient_opened','consent_recorded','signature_recorded','recipient_declined','envelope_completed','envelope_voided','envelope_expired','delivery_failed','recovery_required')),
  actor_type text NOT NULL CHECK (actor_type IN ('operator','signer','system','provider')),
  actor_reference text NOT NULL DEFAULT '',
  event_projection jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_event_sha256 text NOT NULL DEFAULT '' CHECK (previous_event_sha256 = '' OR previous_event_sha256 ~ '^[0-9a-f]{64}$'),
  event_sha256 text NOT NULL CHECK (event_sha256 ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_event_sequence_unique UNIQUE (envelope_id, sequence),
  CONSTRAINT eos_esign_event_hash_unique UNIQUE (envelope_id, event_sha256)
);

CREATE INDEX IF NOT EXISTS eos_esign_event_company_idx
  ON eos_esign_events(company_id, occurred_at);

CREATE OR REPLACE FUNCTION eos_protect_native_esign_immutable_records()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'EOS native e-sign document versions and events are append-only';
END;
$$;

DROP TRIGGER IF EXISTS eos_esign_document_versions_immutable ON eos_esign_document_versions;
CREATE TRIGGER eos_esign_document_versions_immutable
BEFORE UPDATE OR DELETE ON eos_esign_document_versions
FOR EACH ROW EXECUTE FUNCTION eos_protect_native_esign_immutable_records();

DROP TRIGGER IF EXISTS eos_esign_events_immutable ON eos_esign_events;
CREATE TRIGGER eos_esign_events_immutable
BEFORE UPDATE OR DELETE ON eos_esign_events
FOR EACH ROW EXECUTE FUNCTION eos_protect_native_esign_immutable_records();

ALTER TABLE eos_recovery_agreement_instances
  ADD COLUMN IF NOT EXISTS e_sign_provider text NOT NULL DEFAULT 'eos_native',
  ADD COLUMN IF NOT EXISTS native_envelope_id text;

UPDATE eos_recovery_agreement_instances
SET e_sign_provider = 'docusign'
WHERE e_sign_binding_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'eos_recovery_agreement_instance_provider_check'
      AND conrelid = 'eos_recovery_agreement_instances'::regclass
  ) THEN
    ALTER TABLE eos_recovery_agreement_instances
      ADD CONSTRAINT eos_recovery_agreement_instance_provider_check
      CHECK (e_sign_provider IN ('eos_native','docusign'));
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'eos_recovery_agreement_instances'::regclass
      AND c.contype = 'f'
      AND a.attname = 'native_envelope_id'
  ) THEN
    ALTER TABLE eos_recovery_agreement_instances
      ADD CONSTRAINT eos_recovery_agreement_instance_native_envelope_fk
      FOREIGN KEY (native_envelope_id) REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'eos_esign_envelopes'::regclass
      AND c.contype = 'f'
      AND a.attname = 'recovery_agreement_instance_id'
  ) THEN
    ALTER TABLE eos_esign_envelopes
      ADD CONSTRAINT eos_esign_envelope_recovery_agreement_fk
      FOREIGN KEY (recovery_agreement_instance_id) REFERENCES eos_recovery_agreement_instances(id) ON DELETE RESTRICT;
  END IF;
END;
$$;
