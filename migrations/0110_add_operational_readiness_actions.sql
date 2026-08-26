CREATE TABLE IF NOT EXISTS operational_readiness_actions (
  blocker_key text PRIMARY KEY CHECK (blocker_key ~ '^(control|configuration|vendor|ownership):[a-z0-9_-]{2,120}$'),
  blocker_type text NOT NULL CHECK (blocker_type IN ('control','configuration','vendor','ownership')),
  layer integer NOT NULL CHECK (layer BETWEEN 1 AND 24),
  title text NOT NULL CHECK (length(title) BETWEEN 2 AND 200),
  evidence_class text NOT NULL CHECK (length(evidence_class) BETWEEN 3 AND 80),
  next_action text NOT NULL CHECK (length(next_action) BETWEEN 20 AND 2000),
  operator_state text NOT NULL DEFAULT 'unassigned' CHECK (operator_state IN ('unassigned','planned','in_progress','waiting_external')),
  owner_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  due_at timestamptz,
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((operator_state = 'unassigned' AND owner_user_id IS NULL AND due_at IS NULL) OR (operator_state <> 'unassigned' AND owner_user_id IS NOT NULL AND due_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS operational_readiness_actions_layer_state_idx ON operational_readiness_actions(layer, operator_state, due_at);
CREATE INDEX IF NOT EXISTS operational_readiness_actions_owner_idx ON operational_readiness_actions(owner_user_id, operator_state);

CREATE TABLE IF NOT EXISTS operational_readiness_action_events (
  id text PRIMARY KEY,
  blocker_key text NOT NULL REFERENCES operational_readiness_actions(blocker_key) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('initialized','updated')),
  from_state text CHECK (from_state IS NULL OR from_state IN ('unassigned','planned','in_progress','waiting_external')),
  to_state text NOT NULL CHECK (to_state IN ('unassigned','planned','in_progress','waiting_external')),
  owner_user_id text REFERENCES users(id) ON DELETE RESTRICT,
  due_at timestamptz,
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  action_version integer NOT NULL CHECK (action_version > 0),
  actor_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_key, action_version)
);

CREATE INDEX IF NOT EXISTS operational_readiness_action_events_time_idx ON operational_readiness_action_events(blocker_key, created_at);

CREATE OR REPLACE FUNCTION operational_readiness_action_projection_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.blocker_key IS DISTINCT FROM OLD.blocker_key
     OR NEW.blocker_type IS DISTINCT FROM OLD.blocker_type
     OR NEW.layer IS DISTINCT FROM OLD.layer
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.evidence_class IS DISTINCT FROM OLD.evidence_class
     OR NEW.next_action IS DISTINCT FROM OLD.next_action
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'operational readiness action identity is immutable';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'operational readiness action version must advance by one';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS operational_readiness_action_projection_guard_trigger ON operational_readiness_actions;
CREATE TRIGGER operational_readiness_action_projection_guard_trigger
BEFORE UPDATE ON operational_readiness_actions
FOR EACH ROW EXECUTE FUNCTION operational_readiness_action_projection_guard();

CREATE OR REPLACE FUNCTION operational_readiness_action_event_immutable_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('eos.allow_readiness_action_maintenance', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'operational readiness action events are immutable';
END;
$$;

DROP TRIGGER IF EXISTS operational_readiness_action_event_immutable_guard_trigger ON operational_readiness_action_events;
CREATE TRIGGER operational_readiness_action_event_immutable_guard_trigger
BEFORE UPDATE OR DELETE ON operational_readiness_action_events
FOR EACH ROW EXECUTE FUNCTION operational_readiness_action_event_immutable_guard();
