-- Replace direct local-principal seat assignment with an explicit, expiring
-- invitation lifecycle and enforce one active human per organizational seat.

WITH ranked AS (
  SELECT
    membership.id,
    row_number() OVER (
      PARTITION BY membership.seat_id
      ORDER BY
        CASE WHEN seat.occupant_user_id = membership.user_id THEN 0 ELSE 1 END,
        membership.created_at NULLS LAST,
        membership.id
    ) AS membership_rank
  FROM eos_memberships AS membership
  JOIN eos_seats AS seat ON seat.id = membership.seat_id
  WHERE membership.seat_id IS NOT NULL AND membership.status = 'active'
)
UPDATE eos_memberships AS membership
SET status = 'revoked', updated_at = now()
FROM ranked
WHERE membership.id = ranked.id AND ranked.membership_rank > 1;

UPDATE eos_seats AS seat
SET occupant_user_id = membership.user_id,
    agent_mode = 'assistant',
    updated_at = now()
FROM eos_memberships AS membership
WHERE membership.seat_id = seat.id AND membership.status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS eos_memberships_one_active_human_per_seat_idx
  ON eos_memberships (seat_id)
  WHERE seat_id IS NOT NULL AND status = 'active';

CREATE TABLE IF NOT EXISTS eos_membership_invitations (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE CASCADE,
  invited_email text,
  email_hash text NOT NULL,
  token_hash text NOT NULL,
  invited_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  provider_invitation_id text,
  status text NOT NULL DEFAULT 'pending_delivery'
    CHECK (status IN ('pending_delivery', 'pending', 'accepted', 'revoked', 'expired', 'delivery_failed')),
  purpose text NOT NULL DEFAULT 'operate',
  classification_ceiling text NOT NULL DEFAULT 'internal'
    CHECK (classification_ceiling IN ('public', 'internal', 'confidential', 'restricted')),
  expires_at timestamptz NOT NULL,
  accepted_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'eos_membership_invitations_status_check') THEN
    ALTER TABLE eos_membership_invitations
      ADD CONSTRAINT eos_membership_invitations_status_check
      CHECK (status IN ('pending_delivery', 'pending', 'accepted', 'revoked', 'expired', 'delivery_failed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'eos_membership_invitations_classification_check') THEN
    ALTER TABLE eos_membership_invitations
      ADD CONSTRAINT eos_membership_invitations_classification_check
      CHECK (classification_ceiling IN ('public', 'internal', 'confidential', 'restricted'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS eos_membership_invitations_token_hash_idx
  ON eos_membership_invitations (token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS eos_membership_invitations_one_pending_per_seat_idx
  ON eos_membership_invitations (seat_id)
  WHERE status IN ('pending_delivery', 'pending');

CREATE UNIQUE INDEX IF NOT EXISTS eos_membership_invitations_one_pending_email_per_company_idx
  ON eos_membership_invitations (company_id, email_hash)
  WHERE status IN ('pending_delivery', 'pending');

CREATE INDEX IF NOT EXISTS eos_membership_invitations_expiry_idx
  ON eos_membership_invitations (status, expires_at);
