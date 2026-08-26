CREATE TABLE IF NOT EXISTS eos_instrument_objects (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  instrument_key text NOT NULL CHECK (instrument_key IN ('docs','files','sheets','slides','tables','forms','calendar','search','canvas','tasks','projects','workflows','crm','messages','conference_rooms','ai','knowledge','memory','analytics','learning','progression','commerce','finance','ads','reputation')),
  object_type text NOT NULL,
  object_key text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','active','paused','completed','cancelled','archived')),
  classification text NOT NULL DEFAULT 'confidential' CHECK (classification IN ('internal','confidential','restricted')),
  visibility text NOT NULL DEFAULT 'organization' CHECK (visibility IN ('seat','team','organization','portfolio')),
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  parent_object_id text REFERENCES eos_instrument_objects(id) ON DELETE RESTRICT,
  data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object'),
  source_reference jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_reference) = 'object'),
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_ids) = 'array'),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (company_id, instrument_key, object_key)
);

CREATE INDEX IF NOT EXISTS eos_instrument_objects_company_state_idx ON eos_instrument_objects(company_id, instrument_key, state, updated_at);
CREATE INDEX IF NOT EXISTS eos_instrument_objects_parent_idx ON eos_instrument_objects(company_id, parent_object_id);

CREATE TABLE IF NOT EXISTS eos_instrument_commands (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  instrument_key text NOT NULL,
  object_id text REFERENCES eos_instrument_objects(id) ON DELETE RESTRICT,
  command_type text NOT NULL,
  idempotency_key text NOT NULL,
  expected_version integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  state text NOT NULL CHECK (state IN ('accepted','completed','rejected')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(result) = 'object'),
  policy_decision_id text NOT NULL REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT,
  requested_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (company_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS eos_instrument_commands_object_idx ON eos_instrument_commands(company_id, object_id, created_at);

CREATE TABLE IF NOT EXISTS eos_instrument_events (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  instrument_key text NOT NULL,
  object_id text NOT NULL REFERENCES eos_instrument_objects(id) ON DELETE RESTRICT,
  command_id text NOT NULL UNIQUE REFERENCES eos_instrument_commands(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  from_state text CHECK (from_state IS NULL OR from_state IN ('draft','active','paused','completed','cancelled','archived')),
  to_state text NOT NULL CHECK (to_state IN ('draft','active','paused','completed','cancelled','archived')),
  object_version integer NOT NULL CHECK (object_version > 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_ids) = 'array'),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eos_instrument_events_object_version_idx ON eos_instrument_events(object_id, object_version);

CREATE TABLE IF NOT EXISTS eos_instrument_links (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_object_id text NOT NULL REFERENCES eos_instrument_objects(id) ON DELETE CASCADE,
  target_object_id text NOT NULL REFERENCES eos_instrument_objects(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_object_id <> target_object_id),
  UNIQUE (company_id, source_object_id, target_object_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS eos_instrument_links_target_idx ON eos_instrument_links(company_id, target_object_id);

CREATE OR REPLACE FUNCTION eos_instrument_projection_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.instrument_key IS DISTINCT FROM OLD.instrument_key
     OR NEW.object_type IS DISTINCT FROM OLD.object_type
     OR NEW.object_key IS DISTINCT FROM OLD.object_key
     OR NEW.owner_seat_id IS DISTINCT FROM OLD.owner_seat_id
     OR NEW.recorded_by_user_id IS DISTINCT FROM OLD.recorded_by_user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'instrument object identity is immutable';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'instrument object version must advance by one';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS eos_instrument_projection_guard_trigger ON eos_instrument_objects;
CREATE TRIGGER eos_instrument_projection_guard_trigger BEFORE UPDATE ON eos_instrument_objects
FOR EACH ROW EXECUTE FUNCTION eos_instrument_projection_guard();

CREATE OR REPLACE FUNCTION eos_instrument_append_only_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'instrument command, event, and relationship ledgers are append-only';
END;
$$;

DROP TRIGGER IF EXISTS eos_instrument_commands_immutable_trigger ON eos_instrument_commands;
CREATE TRIGGER eos_instrument_commands_immutable_trigger BEFORE UPDATE OR DELETE ON eos_instrument_commands
FOR EACH ROW EXECUTE FUNCTION eos_instrument_append_only_guard();
DROP TRIGGER IF EXISTS eos_instrument_events_immutable_trigger ON eos_instrument_events;
CREATE TRIGGER eos_instrument_events_immutable_trigger BEFORE UPDATE OR DELETE ON eos_instrument_events
FOR EACH ROW EXECUTE FUNCTION eos_instrument_append_only_guard();
DROP TRIGGER IF EXISTS eos_instrument_links_immutable_trigger ON eos_instrument_links;
CREATE TRIGGER eos_instrument_links_immutable_trigger BEFORE UPDATE OR DELETE ON eos_instrument_links
FOR EACH ROW EXECUTE FUNCTION eos_instrument_append_only_guard();
