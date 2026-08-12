CREATE TABLE IF NOT EXISTS operational_controls (
  control_key text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('pass', 'fail', 'not_applicable')),
  evidence_uri text NOT NULL,
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
  notes text,
  owner_user_id text NOT NULL REFERENCES users(id),
  reviewed_at timestamptz NOT NULL,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendor_registry (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  service_category text NOT NULL,
  risk_tier text NOT NULL CHECK (risk_tier IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL CHECK (status IN ('proposed', 'approved', 'restricted', 'retiring', 'retired')),
  data_classes jsonb NOT NULL DEFAULT '[]'::jsonb,
  dpa_status text NOT NULL CHECK (dpa_status IN ('not_required', 'pending', 'executed', 'rejected')),
  subprocessor_status text NOT NULL CHECK (subprocessor_status IN ('not_applicable', 'pending', 'reviewed')),
  owner_user_id text NOT NULL REFERENCES users(id),
  review_evidence_uri text,
  exit_plan text NOT NULL,
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_ownership (
  service_key text PRIMARY KEY,
  display_name text NOT NULL,
  owner_user_id text NOT NULL REFERENCES users(id),
  on_call_reference text NOT NULL,
  availability_target text NOT NULL,
  latency_target text NOT NULL,
  error_budget_policy text NOT NULL,
  incident_runbook_uri text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
