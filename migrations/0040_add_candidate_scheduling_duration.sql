ALTER TABLE eos_talent_scheduling_requests
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 45;

ALTER TABLE eos_talent_scheduling_requests DROP CONSTRAINT IF EXISTS eos_talent_scheduling_duration_check;
ALTER TABLE eos_talent_scheduling_requests ADD CONSTRAINT eos_talent_scheduling_duration_check CHECK (duration_minutes BETWEEN 15 AND 240);
