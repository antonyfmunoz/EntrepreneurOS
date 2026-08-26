CREATE TABLE IF NOT EXISTS eos_esign_retention_policies (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  retention_days integer NOT NULL,
  backup_required boolean NOT NULL DEFAULT true,
  automatic_deletion boolean NOT NULL DEFAULT false,
  state text NOT NULL DEFAULT 'active',
  version integer NOT NULL DEFAULT 1,
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_retention_policy_days_check CHECK (retention_days BETWEEN 1 AND 36500),
  CONSTRAINT eos_esign_retention_policy_state_check CHECK (state IN ('active','retired')),
  CONSTRAINT eos_esign_retention_policy_version_check CHECK (version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_retention_policy_active_idx
  ON eos_esign_retention_policies(company_id) WHERE state = 'active';

CREATE TABLE IF NOT EXISTS eos_esign_artifacts (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  envelope_id text REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT,
  document_version_id text REFERENCES eos_esign_document_versions(id) ON DELETE RESTRICT,
  recipient_id text REFERENCES eos_esign_recipients(id) ON DELETE RESTRICT,
  artifact_kind text NOT NULL,
  storage_provider text NOT NULL,
  storage_key text NOT NULL,
  sha256 text NOT NULL,
  size_bytes integer NOT NULL,
  mime_type text NOT NULL,
  state text NOT NULL DEFAULT 'active',
  retention_policy_id text REFERENCES eos_esign_retention_policies(id) ON DELETE RESTRICT,
  retained_until timestamptz,
  backup_state text NOT NULL DEFAULT 'not_configured',
  backup_provider text NOT NULL DEFAULT '',
  backup_storage_key text NOT NULL DEFAULT '',
  backup_sha256 text NOT NULL DEFAULT '',
  backup_verified_at timestamptz,
  last_verified_at timestamptz,
  last_failure_code text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_artifact_kind_check CHECK (artifact_kind IN ('source_pdf','completed_pdf','audit_json','signature_capture')),
  CONSTRAINT eos_esign_artifact_provider_check CHECK (storage_provider IN ('filesystem','s3')),
  CONSTRAINT eos_esign_artifact_backup_provider_check CHECK (backup_provider IN ('','filesystem','s3')),
  CONSTRAINT eos_esign_artifact_hash_check CHECK (sha256 ~ '^[0-9a-f]{64}$' AND (backup_sha256 = '' OR backup_sha256 ~ '^[0-9a-f]{64}$')),
  CONSTRAINT eos_esign_artifact_size_check CHECK (size_bytes BETWEEN 1 AND 52428800),
  CONSTRAINT eos_esign_artifact_state_check CHECK (state IN ('active','deletion_pending','deleted','recovery_required')),
  CONSTRAINT eos_esign_artifact_backup_state_check CHECK (backup_state IN ('not_configured','pending','verified','failed','deleted')),
  CONSTRAINT eos_esign_artifact_version_check CHECK (version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_artifact_storage_idx
  ON eos_esign_artifacts(company_id, storage_provider, storage_key);
CREATE INDEX IF NOT EXISTS eos_esign_artifact_envelope_idx
  ON eos_esign_artifacts(company_id, envelope_id, artifact_kind);
CREATE INDEX IF NOT EXISTS eos_esign_artifact_custody_schedule_idx
  ON eos_esign_artifacts(state, backup_state, last_verified_at);

CREATE TABLE IF NOT EXISTS eos_esign_legal_holds (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  envelope_id text NOT NULL REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  reference text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'active',
  placed_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  placed_at timestamptz NOT NULL DEFAULT now(),
  released_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  released_at timestamptz,
  release_reason text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT eos_esign_legal_hold_state_check CHECK (state IN ('active','released')),
  CONSTRAINT eos_esign_legal_hold_reason_check CHECK (char_length(reason) BETWEEN 10 AND 1000 AND char_length(release_reason) <= 1000),
  CONSTRAINT eos_esign_legal_hold_release_check CHECK ((state = 'active' AND released_by_user_id IS NULL AND released_at IS NULL AND release_reason = '') OR (state = 'released' AND released_by_user_id IS NOT NULL AND released_at IS NOT NULL AND char_length(release_reason) >= 10)),
  CONSTRAINT eos_esign_legal_hold_version_check CHECK (version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_legal_hold_active_idx
  ON eos_esign_legal_holds(envelope_id) WHERE state = 'active';

CREATE TABLE IF NOT EXISTS eos_esign_deletion_requests (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  envelope_id text NOT NULL REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT,
  requested_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  state text NOT NULL DEFAULT 'pending_approval',
  decided_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  decision_reason text NOT NULL DEFAULT '',
  decided_at timestamptz,
  executed_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  executed_at timestamptz,
  failure_code text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_deletion_request_state_check CHECK (state IN ('pending_approval','approved','rejected','blocked','executing','completed','failed','cancelled')),
  CONSTRAINT eos_esign_deletion_request_reason_check CHECK (char_length(reason) BETWEEN 10 AND 1000 AND char_length(decision_reason) <= 1000),
  CONSTRAINT eos_esign_deletion_request_version_check CHECK (version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_deletion_request_open_idx
  ON eos_esign_deletion_requests(envelope_id) WHERE state IN ('pending_approval','approved','executing');

CREATE TABLE IF NOT EXISTS eos_esign_custody_events (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  envelope_id text REFERENCES eos_esign_envelopes(id) ON DELETE RESTRICT,
  artifact_id text REFERENCES eos_esign_artifacts(id) ON DELETE RESTRICT,
  actor_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  event_projection jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_event_sha256 text NOT NULL DEFAULT '',
  event_sha256 text NOT NULL,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_custody_event_hash_check CHECK (event_sha256 ~ '^[0-9a-f]{64}$' AND (previous_event_sha256 = '' OR previous_event_sha256 ~ '^[0-9a-f]{64}$')),
  CONSTRAINT eos_esign_custody_event_projection_check CHECK (jsonb_typeof(event_projection) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_custody_event_hash_idx
  ON eos_esign_custody_events(company_id, event_sha256);
CREATE INDEX IF NOT EXISTS eos_esign_custody_event_envelope_idx
  ON eos_esign_custody_events(company_id, envelope_id, occurred_at);

CREATE OR REPLACE FUNCTION eos_reject_esign_custody_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Native e-sign custody event history is immutable';
END;
$$;

DROP TRIGGER IF EXISTS eos_esign_custody_events_immutable ON eos_esign_custody_events;
CREATE TRIGGER eos_esign_custody_events_immutable
BEFORE UPDATE OR DELETE ON eos_esign_custody_events
FOR EACH ROW EXECUTE FUNCTION eos_reject_esign_custody_event_mutation();

CREATE OR REPLACE FUNCTION eos_protect_esign_artifact_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.company_id IS DISTINCT FROM OLD.company_id
    OR NEW.envelope_id IS DISTINCT FROM OLD.envelope_id
    OR NEW.document_version_id IS DISTINCT FROM OLD.document_version_id
    OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
    OR NEW.artifact_kind IS DISTINCT FROM OLD.artifact_kind
    OR NEW.storage_provider IS DISTINCT FROM OLD.storage_provider
    OR NEW.storage_key IS DISTINCT FROM OLD.storage_key
    OR NEW.sha256 IS DISTINCT FROM OLD.sha256
    OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes
    OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Native e-sign artifact identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS eos_esign_artifact_identity_immutable ON eos_esign_artifacts;
CREATE TRIGGER eos_esign_artifact_identity_immutable
BEFORE UPDATE ON eos_esign_artifacts
FOR EACH ROW EXECUTE FUNCTION eos_protect_esign_artifact_identity();
