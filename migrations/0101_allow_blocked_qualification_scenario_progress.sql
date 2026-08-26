-- Recording another scenario while one blocker remains must retain the blocked
-- run state. The original integrity guard allowed recovery to in_progress but
-- omitted this legitimate blocked-to-blocked, event-backed transition.
CREATE OR REPLACE FUNCTION eos_guard_pre_live_qualification_run_projection()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE matching_event_count integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' OR NEW.version <> 1 THEN
      RAISE EXCEPTION 'pre-live qualification runs must begin as draft version 1';
    END IF;
    SELECT count(*) INTO matching_event_count FROM eos_pre_live_qualification_events
      WHERE run_id = NEW.id AND sequence = 1 AND action = 'created' AND from_status = 'none' AND to_status = 'draft'
        AND event_projection->>'runId' = NEW.id;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.portfolio_id IS DISTINCT FROM OLD.portfolio_id
      OR NEW.run_key IS DISTINCT FROM OLD.run_key OR NEW.title IS DISTINCT FROM OLD.title OR NEW.objective IS DISTINCT FROM OLD.objective
      OR NEW.module_ids IS DISTINCT FROM OLD.module_ids OR NEW.capability_keys IS DISTINCT FROM OLD.capability_keys
      OR NEW.owner_seat_id IS DISTINCT FROM OLD.owner_seat_id OR NEW.classification IS DISTINCT FROM OLD.classification
      OR NEW.recorded_by_user_id IS DISTINCT FROM OLD.recorded_by_user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'pre-live qualification run identity and declared scope are immutable';
    END IF;
    IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'pre-live qualification run version must advance exactly once'; END IF;
    IF NOT (
      (OLD.status = 'draft' AND NEW.status = 'in_progress') OR
      (OLD.status = 'blocked' AND NEW.status IN ('blocked','in_progress')) OR
      (OLD.status = 'in_progress' AND NEW.status IN ('in_progress','blocked','qualified')) OR
      (OLD.status = 'qualified' AND NEW.status IN ('released','rejected'))
    ) THEN RAISE EXCEPTION 'invalid pre-live qualification run transition'; END IF;
    SELECT count(*) INTO matching_event_count FROM eos_pre_live_qualification_events
      WHERE run_id = NEW.id AND sequence = NEW.version AND from_status = OLD.status AND to_status = NEW.status
        AND event_projection->>'runId' = NEW.id
        AND (
          (OLD.status = 'draft' AND NEW.status = 'in_progress' AND action = 'started') OR
          (OLD.status = 'blocked' AND NEW.status = 'blocked' AND action = 'scenario_recorded') OR
          (OLD.status = 'blocked' AND NEW.status = 'in_progress' AND action IN ('reopened','scenario_recorded')) OR
          (OLD.status = 'in_progress' AND NEW.status IN ('in_progress','blocked') AND action = 'scenario_recorded') OR
          (OLD.status = 'in_progress' AND NEW.status = 'qualified' AND action = 'qualified') OR
          (OLD.status = 'qualified' AND NEW.status = 'released' AND action = 'released') OR
          (OLD.status = 'qualified' AND NEW.status = 'rejected' AND action = 'rejected')
        );
  END IF;
  IF matching_event_count <> 1 THEN RAISE EXCEPTION 'pre-live qualification projection requires one exact immutable event'; END IF;
  RETURN NEW;
END $$;
