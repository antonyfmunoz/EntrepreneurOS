CREATE TABLE IF NOT EXISTS eos_company_package_installations (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  package_key text NOT NULL,
  organization_key text NOT NULL,
  installed_version text,
  desired_version text NOT NULL,
  state text NOT NULL DEFAULT 'planned',
  compatibility_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  compiled_instance jsonb NOT NULL DEFAULT '{}'::jsonb,
  rollback_snapshots jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot_sha256 text NOT NULL,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  classification text NOT NULL DEFAULT 'restricted',
  version integer NOT NULL DEFAULT 1,
  last_action text NOT NULL DEFAULT 'planned',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_company_package_installations_state_check CHECK (state IN ('planned','installed','upgrade_planned','rollback_planned','blocked','retired')),
  CONSTRAINT eos_company_package_installations_version_check CHECK (version > 0),
  CONSTRAINT eos_company_package_installations_classification_check CHECK (classification IN ('internal','confidential','restricted')),
  CONSTRAINT eos_company_package_installations_hash_check CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_company_package_installations_rollback_array_check CHECK (jsonb_typeof(rollback_snapshots) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_company_package_installations_company_package_idx
  ON eos_company_package_installations(company_id, package_key);
CREATE INDEX IF NOT EXISTS eos_company_package_installations_company_state_idx
  ON eos_company_package_installations(company_id, state);

CREATE TABLE IF NOT EXISTS eos_company_package_installation_events (
  id text PRIMARY KEY,
  installation_id text NOT NULL REFERENCES eos_company_package_installations(id) ON DELETE CASCADE,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  action text NOT NULL,
  from_version text,
  to_version text,
  event_projection jsonb NOT NULL,
  event_sha256 text NOT NULL,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_company_package_installation_events_action_check CHECK (action IN ('planned','installed','upgrade_planned','upgraded','rollback_planned','rolled_back','blocked','retired','replication_exported')),
  CONSTRAINT eos_company_package_installation_events_sequence_check CHECK (sequence > 0),
  CONSTRAINT eos_company_package_installation_events_hash_check CHECK (event_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_company_package_installation_events_sequence_idx
  ON eos_company_package_installation_events(installation_id, sequence);
CREATE INDEX IF NOT EXISTS eos_company_package_installation_events_company_time_idx
  ON eos_company_package_installation_events(company_id, recorded_at);

CREATE OR REPLACE FUNCTION eos_package_installation_projection_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE matching_event_count integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.version <> 1 OR NEW.state NOT IN ('planned','installed','blocked') THEN
      RAISE EXCEPTION 'package installation must begin at version 1 in planned, installed, or blocked state';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.company_id IS DISTINCT FROM OLD.company_id
    OR NEW.portfolio_id IS DISTINCT FROM OLD.portfolio_id OR NEW.package_key IS DISTINCT FROM OLD.package_key
    OR NEW.organization_key IS DISTINCT FROM OLD.organization_key OR NEW.owner_seat_id IS DISTINCT FROM OLD.owner_seat_id
    OR NEW.recorded_by_user_id IS DISTINCT FROM OLD.recorded_by_user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'package installation tenant identity and custody are immutable';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'package installation version must advance exactly once';
  END IF;
  SELECT count(*) INTO matching_event_count
  FROM eos_company_package_installation_events
  WHERE installation_id = NEW.id AND sequence = NEW.version
    AND action = NEW.last_action AND from_version IS NOT DISTINCT FROM OLD.installed_version
    AND to_version IS NOT DISTINCT FROM NEW.installed_version
    AND event_projection->>'installationId' = NEW.id;
  IF matching_event_count <> 1 THEN
    RAISE EXCEPTION 'package installation projection requires one exact immutable event';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS eos_package_installation_projection_guard_trigger ON eos_company_package_installations;
CREATE TRIGGER eos_package_installation_projection_guard_trigger
BEFORE INSERT OR UPDATE ON eos_company_package_installations
FOR EACH ROW EXECUTE FUNCTION eos_package_installation_projection_guard();

CREATE OR REPLACE FUNCTION eos_package_installation_event_immutable_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'package installation events are immutable';
END $$;

DROP TRIGGER IF EXISTS eos_package_installation_event_immutable_guard_trigger ON eos_company_package_installation_events;
CREATE TRIGGER eos_package_installation_event_immutable_guard_trigger
BEFORE UPDATE OR DELETE ON eos_company_package_installation_events
FOR EACH ROW EXECUTE FUNCTION eos_package_installation_event_immutable_guard();
