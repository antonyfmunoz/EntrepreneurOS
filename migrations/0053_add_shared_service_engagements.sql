CREATE TABLE IF NOT EXISTS eos_shared_service_engagements (
  id text PRIMARY KEY,
  engagement_key text NOT NULL,
  portfolio_id integer NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  beneficiary_company_id integer NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  provider_company_id integer NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  beneficiary_relationship_id text NOT NULL REFERENCES eos_stakeholder_relationships(id) ON DELETE RESTRICT,
  beneficiary_work_packet_id text NOT NULL REFERENCES eos_work_packets(id) ON DELETE RESTRICT,
  beneficiary_approval_id text NOT NULL REFERENCES eos_approval_requests(id) ON DELETE RESTRICT,
  provider_work_packet_id text REFERENCES eos_work_packets(id) ON DELETE RESTRICT,
  beneficiary_owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  provider_owner_seat_id text REFERENCES eos_seats(id) ON DELETE RESTRICT,
  title text NOT NULL,
  service_type text NOT NULL DEFAULT 'production',
  state text NOT NULL DEFAULT 'awaiting_beneficiary_approval',
  version integer NOT NULL DEFAULT 1,
  scope text NOT NULL,
  beneficiary text NOT NULL,
  priority text NOT NULL DEFAULT 'high',
  inputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  acceptance_criteria text NOT NULL,
  due_at timestamptz NOT NULL,
  cost_capacity_treatment text NOT NULL,
  provider_response text NOT NULL DEFAULT '',
  clarification_response text NOT NULL DEFAULT '',
  delivery_summary text NOT NULL DEFAULT '',
  provider_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  beneficiary_disposition text NOT NULL DEFAULT '',
  beneficiary_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  cost_capacity_outcome text NOT NULL DEFAULT '',
  external_effects_executed boolean NOT NULL DEFAULT false,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'confidential',
  schema_version text NOT NULL DEFAULT 'shared-service-engagement-v1.0',
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_shared_service_distinct_companies_check CHECK (beneficiary_company_id <> provider_company_id),
  CONSTRAINT eos_shared_service_version_check CHECK (version > 0),
  CONSTRAINT eos_shared_service_priority_check CHECK (priority IN ('low','medium','high','urgent')),
  CONSTRAINT eos_shared_service_state_check CHECK (state IN ('awaiting_beneficiary_approval','beneficiary_rejected','provider_review','clarification_requested','provider_accepted','provider_rejected','in_progress','delivered','rework_requested','accepted','rejected','cancelled')),
  CONSTRAINT eos_shared_service_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_shared_service_classification_check CHECK (classification IN ('public','internal','confidential','restricted')),
  CONSTRAINT eos_shared_service_no_effect_check CHECK (external_effects_executed = false)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_shared_service_engagements_key_idx
  ON eos_shared_service_engagements(portfolio_id, engagement_key);
CREATE INDEX IF NOT EXISTS eos_shared_service_beneficiary_state_idx
  ON eos_shared_service_engagements(beneficiary_company_id, state);
CREATE INDEX IF NOT EXISTS eos_shared_service_provider_state_idx
  ON eos_shared_service_engagements(provider_company_id, state);

CREATE TABLE IF NOT EXISTS eos_shared_service_events (
  id text PRIMARY KEY,
  engagement_id text NOT NULL REFERENCES eos_shared_service_engagements(id) ON DELETE CASCADE,
  actor_company_id integer NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  actor_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  sequence integer NOT NULL,
  event_type text NOT NULL,
  from_state text NOT NULL,
  to_state text NOT NULL,
  note text NOT NULL DEFAULT '',
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  trace_id text NOT NULL,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_shared_service_events_sequence_check CHECK (sequence > 0),
  CONSTRAINT eos_shared_service_events_type_check CHECK (event_type IN ('request_created','beneficiary_approved','beneficiary_rejected','provider_clarification_requested','beneficiary_clarified','provider_accepted','provider_rejected','provider_started','provider_delivered','beneficiary_rework_requested','beneficiary_accepted','beneficiary_rejected_delivery','cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_shared_service_events_sequence_idx
  ON eos_shared_service_events(engagement_id, sequence);
CREATE INDEX IF NOT EXISTS eos_shared_service_events_created_idx
  ON eos_shared_service_events(engagement_id, created_at);

CREATE OR REPLACE FUNCTION eos_reject_shared_service_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'shared service events are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eos_shared_service_events_append_only ON eos_shared_service_events;
CREATE TRIGGER eos_shared_service_events_append_only
BEFORE UPDATE OR DELETE ON eos_shared_service_events
FOR EACH ROW EXECUTE FUNCTION eos_reject_shared_service_event_mutation();
