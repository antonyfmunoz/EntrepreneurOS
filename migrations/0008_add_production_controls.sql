CREATE TABLE IF NOT EXISTS eos_rate_limit_windows (
  namespace text NOT NULL,
  identity_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (namespace, identity_hash, window_start)
);

CREATE INDEX IF NOT EXISTS eos_rate_limit_windows_expires_at_idx
  ON eos_rate_limit_windows (expires_at);
