CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  clerk_user_id text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'executing', 'blocked', 'cancelled', 'executed', 'failed')),
  delete_owned_organizations boolean NOT NULL DEFAULT false,
  scheduled_for timestamptz NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  executed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text
);

CREATE INDEX IF NOT EXISTS account_deletion_due_idx ON account_deletion_requests (scheduled_for) WHERE status IN ('scheduled', 'failed');
