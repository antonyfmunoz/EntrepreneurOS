-- OAuth credentials belong to the authorizing person. This table records the
-- separate, auditable decision to make that authorization usable by exactly
-- one EOS company and its accountable seats.
CREATE TABLE IF NOT EXISTS eos_provider_connections (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider_key text NOT NULL,
  authorization_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  recovery_owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  provider_account_reference text NOT NULL,
  account_scope text NOT NULL DEFAULT '',
  granted_permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  credential_reference text NOT NULL DEFAULT 'encrypted_user_oauth',
  connection_state text NOT NULL DEFAULT 'configured',
  health_state text NOT NULL DEFAULT 'unknown',
  provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_health_at timestamptz,
  revoked_at timestamptz,
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_provider_connections_state_check
    CHECK (connection_state IN ('unconfigured','configured','connected','revoked','failed')),
  CONSTRAINT eos_provider_connections_health_check
    CHECK (health_state IN ('unknown','healthy','degraded','unavailable'))
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_provider_connections_company_provider_account_idx
  ON eos_provider_connections(company_id, provider_key, provider_account_reference);
CREATE INDEX IF NOT EXISTS eos_provider_connections_company_provider_idx
  ON eos_provider_connections(company_id, provider_key);
CREATE INDEX IF NOT EXISTS eos_provider_connections_authorization_user_idx
  ON eos_provider_connections(authorization_user_id);
