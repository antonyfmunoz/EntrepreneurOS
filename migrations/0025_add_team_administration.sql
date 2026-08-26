ALTER TABLE billing_subscriptions
  ADD COLUMN IF NOT EXISTS seat_limit integer NOT NULL DEFAULT 10;

DO $$ BEGIN
  ALTER TABLE billing_subscriptions
    ADD CONSTRAINT billing_subscriptions_seat_limit_check
    CHECK (seat_limit BETWEEN 1 AND 10000);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS eos_portfolio_memberships (
  id text PRIMARY KEY,
  portfolio_id integer NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'portfolio_executive',
  status text NOT NULL DEFAULT 'active',
  classification_ceiling text NOT NULL DEFAULT 'internal',
  created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_portfolio_memberships_role_check CHECK (role IN ('portfolio_executive')),
  CONSTRAINT eos_portfolio_memberships_status_check CHECK (status IN ('active', 'suspended', 'revoked')),
  CONSTRAINT eos_portfolio_memberships_classification_check CHECK (classification_ceiling IN ('public', 'internal', 'confidential', 'restricted'))
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_portfolio_memberships_portfolio_user_idx
  ON eos_portfolio_memberships (portfolio_id, user_id);
CREATE INDEX IF NOT EXISTS eos_portfolio_memberships_user_status_idx
  ON eos_portfolio_memberships (user_id, status);

ALTER TABLE eos_memberships
  ADD COLUMN IF NOT EXISTS portfolio_membership_id text REFERENCES eos_portfolio_memberships(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS eos_memberships_portfolio_membership_idx
  ON eos_memberships (portfolio_membership_id, status);

ALTER TABLE eos_membership_invitations
  ADD COLUMN IF NOT EXISTS portfolio_scope boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS eos_organization_identity_policies (
  company_id integer PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  allowed_email_domains jsonb NOT NULL DEFAULT '[]'::jsonb,
  allow_external_collaborators boolean NOT NULL DEFAULT true,
  updated_by_user_id text NOT NULL REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
