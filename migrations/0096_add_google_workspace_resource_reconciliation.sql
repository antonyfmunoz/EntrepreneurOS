ALTER TABLE eos_provider_ingress_registrations
  ADD COLUMN IF NOT EXISTS resource_collection_reference text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS provider_resource_reference text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reconciliation_cursor text NOT NULL DEFAULT '';

ALTER TABLE eos_provider_ingress_registrations
  DROP CONSTRAINT IF EXISTS eos_provider_ingress_provider_check,
  DROP CONSTRAINT IF EXISTS eos_provider_ingress_auth_check,
  DROP CONSTRAINT IF EXISTS eos_provider_ingress_provider_config_check;

ALTER TABLE eos_provider_ingress_registrations
  ADD CONSTRAINT eos_provider_ingress_provider_check CHECK (provider IN ('notion','gmail','google_drive','google_calendar')),
  ADD CONSTRAINT eos_provider_ingress_auth_check CHECK (
    (provider = 'notion' AND authentication_mode = 'notion_hmac_sha256') OR
    (provider = 'gmail' AND authentication_mode = 'google_pubsub_oidc') OR
    (provider IN ('google_drive','google_calendar') AND authentication_mode = 'google_channel_token')
  ),
  ADD CONSTRAINT eos_provider_ingress_provider_config_check CHECK (
    (provider = 'notion' AND topic_name = '' AND audience = '' AND service_account_email = '' AND resource_collection_reference = '') OR
    (provider = 'gmail' AND length(topic_name) >= 10 AND length(audience) >= 8 AND service_account_email LIKE '%@%.%' AND resource_collection_reference = '') OR
    (provider = 'google_drive' AND resource_collection_reference = 'changes' AND topic_name = '' AND audience = '' AND service_account_email = '') OR
    (provider = 'google_calendar' AND resource_collection_reference <> '' AND topic_name = '' AND audience = '' AND service_account_email = '')
  );

ALTER TABLE eos_provider_ingress_events
  DROP CONSTRAINT IF EXISTS eos_provider_ingress_event_provider_check,
  DROP CONSTRAINT IF EXISTS eos_provider_ingress_event_verification_check;

ALTER TABLE eos_provider_ingress_events
  ADD CONSTRAINT eos_provider_ingress_event_provider_check CHECK (provider IN ('notion','gmail','google_drive','google_calendar')),
  ADD CONSTRAINT eos_provider_ingress_event_verification_check CHECK (verification_method IN ('notion_hmac_sha256','google_pubsub_oidc','google_channel_token'));

ALTER TABLE eos_provider_resource_snapshots
  ADD COLUMN IF NOT EXISTS resource_state text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS metadata_projection jsonb NOT NULL DEFAULT '{}'::jsonb;

DROP INDEX IF EXISTS eos_provider_resource_snapshot_event_idx;
CREATE UNIQUE INDEX eos_provider_resource_snapshot_event_idx
  ON eos_provider_resource_snapshots(event_id, resource_type, resource_id);

ALTER TABLE eos_provider_resource_snapshots
  DROP CONSTRAINT IF EXISTS eos_provider_resource_snapshot_provider_check,
  DROP CONSTRAINT IF EXISTS eos_provider_resource_snapshot_state_check,
  DROP CONSTRAINT IF EXISTS eos_provider_resource_snapshot_url_check,
  DROP CONSTRAINT IF EXISTS eos_provider_resource_snapshot_projection_check,
  ADD CONSTRAINT eos_provider_resource_snapshot_provider_check CHECK (
    (provider = 'notion' AND resource_type = 'page') OR
    (provider = 'google_drive' AND resource_type = 'file') OR
    (provider = 'google_calendar' AND resource_type = 'event')
  ),
  ADD CONSTRAINT eos_provider_resource_snapshot_state_check CHECK (resource_state IN ('active','deleted')),
  ADD CONSTRAINT eos_provider_resource_snapshot_url_check CHECK (provider_url = '' OR provider_url ~ '^https://'),
  ADD CONSTRAINT eos_provider_resource_snapshot_projection_check CHECK (jsonb_typeof(metadata_projection) = 'object');
