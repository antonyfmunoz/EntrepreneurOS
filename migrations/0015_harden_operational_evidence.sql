ALTER TABLE operational_controls
  ADD COLUMN IF NOT EXISTS evidence_scope text NOT NULL DEFAULT 'production',
  ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT 'legacy-unspecified';

UPDATE operational_controls
SET status = 'fail',
    notes = concat_ws(E'\n', notes, 'Invalidated by evidence-standard hardening: re-review with explicit scope, subject, and expiry.'),
    expires_at = COALESCE(expires_at, now())
WHERE expires_at IS NULL
   OR subject = 'legacy-unspecified';

ALTER TABLE operational_controls
  ALTER COLUMN expires_at SET NOT NULL;
