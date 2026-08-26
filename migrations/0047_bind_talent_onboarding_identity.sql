ALTER TABLE eos_membership_invitations
  ADD COLUMN IF NOT EXISTS talent_application_id text
  REFERENCES eos_talent_applications(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS eos_membership_invitations_one_pending_talent_application_idx
  ON eos_membership_invitations(talent_application_id)
  WHERE talent_application_id IS NOT NULL
    AND status IN ('pending_delivery', 'pending');

CREATE INDEX IF NOT EXISTS eos_membership_invitations_talent_application_status_idx
  ON eos_membership_invitations(talent_application_id, status)
  WHERE talent_application_id IS NOT NULL;

COMMENT ON COLUMN eos_membership_invitations.talent_application_id IS
  'Optional governed recruiting continuity link. Verified invitation acceptance binds the existing canonical candidate application to the accepted principal and generated assignment; it does not activate placement or grant authority beyond the invitation.';
