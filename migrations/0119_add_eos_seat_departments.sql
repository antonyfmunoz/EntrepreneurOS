-- A seat is the live organizational role.  Department ownership belongs on
-- that role, rather than being inferred from title text or a UI grouping.
-- Existing seats receive the neutral value and are only upgraded to a
-- blueprint department by an explicit later compilation pass.
ALTER TABLE eos_seats
  ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT 'General Management';

CREATE INDEX IF NOT EXISTS eos_seats_company_department_status_idx
  ON eos_seats (company_id, department, status);
