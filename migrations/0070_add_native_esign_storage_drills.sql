CREATE TABLE IF NOT EXISTS eos_esign_storage_drills (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requested_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  state text NOT NULL DEFAULT 'running',
  primary_provider text NOT NULL,
  backup_provider text NOT NULL,
  primary_identity_sha256 text NOT NULL,
  backup_identity_sha256 text NOT NULL,
  capability_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  receipt_sha256 text NOT NULL DEFAULT '',
  failure_code text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_storage_drill_reason_check CHECK (char_length(reason) BETWEEN 8 AND 1000),
  CONSTRAINT eos_esign_storage_drill_state_check CHECK (state IN ('running','passed','failed')),
  CONSTRAINT eos_esign_storage_drill_provider_check CHECK (primary_provider IN ('filesystem','s3') AND backup_provider IN ('filesystem','s3')),
  CONSTRAINT eos_esign_storage_drill_identity_check CHECK (primary_identity_sha256 ~ '^[0-9a-f]{64}$' AND backup_identity_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_esign_storage_drill_json_check CHECK (jsonb_typeof(capability_snapshot) = 'object' AND jsonb_typeof(steps) = 'array'),
  CONSTRAINT eos_esign_storage_drill_completion_check CHECK (
    (state = 'running' AND completed_at IS NULL AND receipt_sha256 = '' AND failure_code = '')
    OR
    (state = 'passed' AND completed_at IS NOT NULL AND receipt_sha256 ~ '^[0-9a-f]{64}$' AND failure_code = '')
    OR
    (state = 'failed' AND completed_at IS NOT NULL AND receipt_sha256 ~ '^[0-9a-f]{64}$' AND char_length(failure_code) BETWEEN 1 AND 200)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_storage_drill_running_idx
  ON eos_esign_storage_drills(company_id) WHERE state = 'running';
CREATE INDEX IF NOT EXISTS eos_esign_storage_drill_history_idx
  ON eos_esign_storage_drills(company_id, started_at DESC);

CREATE OR REPLACE FUNCTION eos_protect_esign_storage_drill_receipt()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Native e-sign storage drill history is immutable';
  END IF;
  IF OLD.state IN ('passed','failed') THEN
    RAISE EXCEPTION 'Native e-sign storage drill receipt is immutable';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.company_id IS DISTINCT FROM OLD.company_id
    OR NEW.requested_by_user_id IS DISTINCT FROM OLD.requested_by_user_id
    OR NEW.reason IS DISTINCT FROM OLD.reason
    OR NEW.primary_provider IS DISTINCT FROM OLD.primary_provider
    OR NEW.backup_provider IS DISTINCT FROM OLD.backup_provider
    OR NEW.primary_identity_sha256 IS DISTINCT FROM OLD.primary_identity_sha256
    OR NEW.backup_identity_sha256 IS DISTINCT FROM OLD.backup_identity_sha256
    OR NEW.started_at IS DISTINCT FROM OLD.started_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Native e-sign storage drill identity is immutable';
  END IF;
  IF NEW.state NOT IN ('passed','failed') THEN
    RAISE EXCEPTION 'Native e-sign storage drill must finish exactly once';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS eos_esign_storage_drills_immutable ON eos_esign_storage_drills;
CREATE TRIGGER eos_esign_storage_drills_immutable
BEFORE UPDATE OR DELETE ON eos_esign_storage_drills
FOR EACH ROW EXECUTE FUNCTION eos_protect_esign_storage_drill_receipt();
