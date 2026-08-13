ALTER TABLE service_ownership
  ADD COLUMN IF NOT EXISTS backup_owner_reference text,
  ADD COLUMN IF NOT EXISTS escalation_reference text,
  ADD COLUMN IF NOT EXISTS access_review_evidence_uri text,
  ADD COLUMN IF NOT EXISTS access_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_access_review_at timestamptz;

CREATE TABLE IF NOT EXISTS operational_control_evidence_history (
  id text PRIMARY KEY,
  control_key text NOT NULL REFERENCES operational_controls(control_key),
  status text NOT NULL CHECK (status IN ('pass', 'fail')),
  evidence_uri text NOT NULL,
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
  evidence_scope text NOT NULL CHECK (evidence_scope IN ('repository', 'staging', 'production', 'professional')),
  subject text NOT NULL,
  notes text,
  owner_user_id text NOT NULL REFERENCES users(id),
  reviewed_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operational_control_evidence_history_control_recorded_idx
  ON operational_control_evidence_history (control_key, recorded_at DESC);
