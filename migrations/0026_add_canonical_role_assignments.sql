CREATE TABLE IF NOT EXISTS eos_assignments (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  membership_id text REFERENCES eos_memberships(id) ON DELETE CASCADE,
  principal_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE CASCADE,
  assignment_type text NOT NULL DEFAULT 'occupant',
  operating_grant text NOT NULL DEFAULT 'operate',
  purpose text NOT NULL DEFAULT 'operate',
  classification_ceiling text NOT NULL DEFAULT 'internal',
  status text NOT NULL DEFAULT 'active',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  ended_at timestamptz,
  created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_assignments_type_check CHECK (assignment_type IN ('occupant', 'acting', 'observer')),
  CONSTRAINT eos_assignments_operating_grant_check CHECK (operating_grant IN ('observe', 'operate')),
  CONSTRAINT eos_assignments_classification_check CHECK (classification_ceiling IN ('public', 'internal', 'confidential', 'restricted')),
  CONSTRAINT eos_assignments_status_check CHECK (status IN ('active', 'suspended', 'ended')),
  CONSTRAINT eos_assignments_effective_window_check CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_assignments_one_active_principal_per_seat_idx
  ON eos_assignments (seat_id)
  WHERE status = 'active' AND operating_grant = 'operate';
CREATE UNIQUE INDEX IF NOT EXISTS eos_assignments_active_principal_seat_idx
  ON eos_assignments (company_id, principal_user_id, seat_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS eos_assignments_principal_context_idx
  ON eos_assignments (company_id, principal_user_id, status);
CREATE INDEX IF NOT EXISTS eos_assignments_membership_status_idx
  ON eos_assignments (membership_id, status);

-- Backfill every currently occupied seat. Existing membership IDs are reused
-- where possible so the migration is deterministic and can be audited without
-- manufacturing a second identity for the same historical assignment.
INSERT INTO eos_assignments (
  id,
  company_id,
  membership_id,
  principal_user_id,
  seat_id,
  assignment_type,
  operating_grant,
  purpose,
  classification_ceiling,
  status,
  effective_from,
  created_by_user_id,
  metadata,
  created_at,
  updated_at
)
SELECT
  COALESCE(m.id, 'founder:' || s.id),
  s.company_id,
  m.id,
  s.occupant_user_id,
  s.id,
  'occupant',
  'operate',
  COALESCE(m.purpose, 'operate'),
  COALESCE(m.classification_ceiling, 'restricted'),
  CASE WHEN m.status = 'suspended' THEN 'suspended' ELSE 'active' END,
  COALESCE(m.created_at, s.created_at, now()),
  CASE WHEN m.id IS NULL THEN s.occupant_user_id ELSE NULL END,
  jsonb_build_object('backfilledFrom', CASE WHEN m.id IS NULL THEN 'founder_seat' ELSE 'legacy_membership' END),
  COALESCE(m.created_at, s.created_at, now()),
  COALESCE(m.updated_at, s.updated_at, now())
FROM eos_seats s
LEFT JOIN eos_memberships m
  ON m.company_id = s.company_id
 AND m.user_id = s.occupant_user_id
 AND m.seat_id = s.id
WHERE s.occupant_user_id IS NOT NULL
ON CONFLICT DO NOTHING;
