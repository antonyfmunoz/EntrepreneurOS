CREATE TABLE IF NOT EXISTS eos_provider_resource_snapshots (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  registration_id text NOT NULL REFERENCES eos_provider_ingress_registrations(id) ON DELETE RESTRICT,
  event_id text NOT NULL REFERENCES eos_provider_ingress_events(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  provider_revision text NOT NULL,
  title text NOT NULL,
  provider_url text NOT NULL,
  bounded_content_sha256 text NOT NULL,
  truncated boolean NOT NULL DEFAULT false,
  previous_snapshot_sha256 text NOT NULL DEFAULT '',
  snapshot_sha256 text NOT NULL,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_provider_resource_snapshot_provider_check CHECK (provider = 'notion' AND resource_type = 'page'),
  CONSTRAINT eos_provider_resource_snapshot_hash_check CHECK (bounded_content_sha256 ~ '^[0-9a-f]{64}$' AND snapshot_sha256 ~ '^[0-9a-f]{64}$' AND (previous_snapshot_sha256 = '' OR previous_snapshot_sha256 ~ '^[0-9a-f]{64}$')),
  CONSTRAINT eos_provider_resource_snapshot_url_check CHECK (provider_url ~ '^https://')
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_provider_resource_snapshot_event_idx ON eos_provider_resource_snapshots(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS eos_provider_resource_snapshot_hash_idx ON eos_provider_resource_snapshots(snapshot_sha256);
CREATE INDEX IF NOT EXISTS eos_provider_resource_snapshot_resource_idx ON eos_provider_resource_snapshots(registration_id, resource_id, recorded_at DESC);

CREATE OR REPLACE FUNCTION eos_reject_provider_resource_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'EOS provider resource snapshots are append-only'; END $$;
DROP TRIGGER IF EXISTS eos_provider_resource_snapshot_guard ON eos_provider_resource_snapshots;
CREATE TRIGGER eos_provider_resource_snapshot_guard BEFORE UPDATE OR DELETE ON eos_provider_resource_snapshots FOR EACH ROW EXECUTE FUNCTION eos_reject_provider_resource_snapshot_mutation();
