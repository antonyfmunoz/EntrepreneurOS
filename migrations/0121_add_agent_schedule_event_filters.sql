-- Event-triggered Role Agents may subscribe narrowly to a documented,
-- bounded fact from an EOS event. The filter is evaluated only after the
-- source event is durably committed, and it can never add authority or cause
-- an external provider effect by itself.
ALTER TABLE eos_agent_schedules
  ADD COLUMN IF NOT EXISTS event_filter jsonb NOT NULL DEFAULT '{"all":[]}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'eos_agent_schedules_event_filter_check'
      AND conrelid = 'eos_agent_schedules'::regclass
  ) THEN
    ALTER TABLE eos_agent_schedules
      ADD CONSTRAINT eos_agent_schedules_event_filter_check
      CHECK (jsonb_typeof(event_filter) = 'object');
  END IF;
END $$;
