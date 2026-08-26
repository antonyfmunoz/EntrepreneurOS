ALTER TABLE eos_integration_bindings
  ADD COLUMN IF NOT EXISTS adapter_version text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS administrator_reference text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS output_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS event_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cost_model text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS latency_budget_ms integer,
  ADD COLUMN IF NOT EXISTS rate_limit_policy text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS idempotency_strategy text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS retry_policy text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS timeout_ms integer,
  ADD COLUMN IF NOT EXISTS cancellation_behavior text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS redaction_policy text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS evidence_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS test_capability text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS revocation_procedure text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS configuration_version integer NOT NULL DEFAULT 1;

ALTER TABLE eos_integration_bindings
  DROP CONSTRAINT IF EXISTS eos_integration_bindings_latency_check,
  DROP CONSTRAINT IF EXISTS eos_integration_bindings_timeout_check,
  DROP CONSTRAINT IF EXISTS eos_integration_bindings_configuration_version_check;

ALTER TABLE eos_integration_bindings
  ADD CONSTRAINT eos_integration_bindings_latency_check
    CHECK (latency_budget_ms IS NULL OR latency_budget_ms > 0),
  ADD CONSTRAINT eos_integration_bindings_timeout_check
    CHECK (timeout_ms IS NULL OR timeout_ms > 0),
  ADD CONSTRAINT eos_integration_bindings_configuration_version_check
    CHECK (configuration_version > 0);

UPDATE eos_integration_bindings
SET schema_version = 'integration-binding-v2.0'
WHERE schema_version = 'integration-binding-v1.0';

CREATE TABLE IF NOT EXISTS eos_integration_binding_revisions (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_binding_id text NOT NULL REFERENCES eos_integration_bindings(id) ON DELETE CASCADE,
  configuration_version integer NOT NULL,
  snapshot jsonb NOT NULL,
  change_summary text NOT NULL,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_by_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  trace_id text NOT NULL,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_integration_binding_revisions_version_check CHECK (configuration_version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_integration_binding_revisions_version_idx
  ON eos_integration_binding_revisions(integration_binding_id, configuration_version);
CREATE INDEX IF NOT EXISTS eos_integration_binding_revisions_company_created_idx
  ON eos_integration_binding_revisions(company_id, created_at);

INSERT INTO eos_integration_binding_revisions (
  id,
  company_id,
  integration_binding_id,
  configuration_version,
  snapshot,
  change_summary,
  recorded_by_user_id,
  recorded_by_seat_id,
  trace_id,
  correlation_id,
  created_at
)
SELECT
  'integration-revision-baseline:' || binding.id,
  binding.company_id,
  binding.id,
  binding.configuration_version,
  to_jsonb(binding) - 'created_at' - 'updated_at',
  'Migration baseline captured before governed configuration editing',
  binding.recorded_by_user_id,
  binding.owner_seat_id,
  'migration:0056:' || binding.id,
  'migration:0056',
  now()
FROM eos_integration_bindings binding
ON CONFLICT (integration_binding_id, configuration_version) DO NOTHING;

CREATE OR REPLACE FUNCTION eos_reject_integration_binding_revision_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'integration binding revisions are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eos_integration_binding_revisions_append_only ON eos_integration_binding_revisions;
CREATE TRIGGER eos_integration_binding_revisions_append_only
BEFORE UPDATE OR DELETE ON eos_integration_binding_revisions
FOR EACH ROW EXECUTE FUNCTION eos_reject_integration_binding_revision_mutation();
