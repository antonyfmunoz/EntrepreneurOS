ALTER TABLE eos_talent_candidate_evidence
  ADD COLUMN IF NOT EXISTS promoted_evidence_id text REFERENCES eos_evidence(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS promoted_at timestamptz,
  ADD COLUMN IF NOT EXISTS promoted_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz;

UPDATE eos_talent_candidate_evidence
SET withdrawn_at = COALESCE(withdrawn_at, updated_at)
WHERE state = 'withdrawn' AND withdrawn_at IS NULL;

ALTER TABLE eos_talent_candidate_evidence
  ALTER COLUMN schema_version SET DEFAULT 'talent-candidate-evidence-v1.3';

CREATE UNIQUE INDEX IF NOT EXISTS eos_talent_candidate_evidence_promoted_evidence_idx
  ON eos_talent_candidate_evidence(promoted_evidence_id)
  WHERE promoted_evidence_id IS NOT NULL;

ALTER TABLE eos_talent_candidate_evidence
  DROP CONSTRAINT IF EXISTS eos_talent_candidate_evidence_promotion_check,
  DROP CONSTRAINT IF EXISTS eos_talent_candidate_evidence_lineage_check,
  DROP CONSTRAINT IF EXISTS eos_talent_candidate_evidence_withdrawal_check;

ALTER TABLE eos_talent_candidate_evidence
  ADD CONSTRAINT eos_talent_candidate_evidence_promotion_check CHECK (
    state <> 'promoted'
    OR (
      promoted_evidence_id IS NOT NULL
      AND promoted_at IS NOT NULL
      AND promoted_by_user_id IS NOT NULL
    )
  ),
  ADD CONSTRAINT eos_talent_candidate_evidence_lineage_check CHECK (
    promoted_evidence_id IS NULL OR promoted_at IS NOT NULL
  ),
  ADD CONSTRAINT eos_talent_candidate_evidence_withdrawal_check CHECK (
    state <> 'withdrawn' OR withdrawn_at IS NOT NULL
  );

COMMENT ON COLUMN eos_talent_candidate_evidence.promoted_evidence_id IS
  'Lineage to the canonical EOS Evidence created by an authorized human verification. Promotion does not create placement, access, payment, assignment, or authority.';

COMMENT ON COLUMN eos_talent_candidate_evidence.withdrawn_at IS
  'Candidate-controlled withdrawal time. Any promoted canonical Evidence is expired by the same transaction before this source becomes unavailable.';
