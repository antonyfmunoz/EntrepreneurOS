CREATE TABLE IF NOT EXISTS eos_recovery_engagements (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  mode text NOT NULL,
  title text NOT NULL,
  call_2_packet_id text REFERENCES eos_recovery_call_2_packets(id) ON DELETE RESTRICT,
  stakeholder_id text REFERENCES eos_stakeholders(id) ON DELETE RESTRICT,
  relationship_id text REFERENCES eos_stakeholder_relationships(id) ON DELETE RESTRICT,
  customer_success_account_id text REFERENCES eos_customer_success_accounts(id) ON DELETE RESTRICT,
  work_packet_id text NOT NULL REFERENCES eos_work_packets(id) ON DELETE RESTRICT,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'draft',
  return_state text,
  objective text NOT NULL,
  eligible_pool_keys jsonb NOT NULL,
  source_boundary text NOT NULL,
  consent_policy text NOT NULL,
  client_side_owner text NOT NULL DEFAULT '',
  guarantee_window_start text,
  guarantee_window_end text,
  next_action text NOT NULL,
  next_action_at text,
  health_state text NOT NULL DEFAULT 'unknown',
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_effects_executed boolean NOT NULL DEFAULT false,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'confidential',
  version integer NOT NULL DEFAULT 1,
  last_event_id text,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_recovery_engagement_mode_check CHECK (mode IN ('client_zero','paid_client')),
  CONSTRAINT eos_recovery_engagement_state_check CHECK (state IN ('draft','intake','baseline','audit','campaign_approval','bounded_launch','operating','reporting','guarantee_review','renewal_review','paused','recovery_required','closed','cancelled')),
  CONSTRAINT eos_recovery_engagement_return_state_check CHECK (return_state IS NULL OR return_state IN ('intake','baseline','audit','campaign_approval','bounded_launch','operating','reporting','guarantee_review','renewal_review')),
  CONSTRAINT eos_recovery_engagement_mode_source_check CHECK ((mode = 'client_zero' AND call_2_packet_id IS NULL) OR (mode = 'paid_client' AND call_2_packet_id IS NOT NULL AND stakeholder_id IS NOT NULL AND relationship_id IS NOT NULL)),
  CONSTRAINT eos_recovery_engagement_window_check CHECK (guarantee_window_end IS NULL OR guarantee_window_start IS NULL OR guarantee_window_end > guarantee_window_start),
  CONSTRAINT eos_recovery_engagement_json_check CHECK (jsonb_typeof(eligible_pool_keys) = 'array' AND jsonb_array_length(eligible_pool_keys) BETWEEN 1 AND 3 AND jsonb_typeof(blockers) = 'array' AND jsonb_typeof(evidence_ids) = 'array'),
  CONSTRAINT eos_recovery_engagement_effect_check CHECK (external_effects_executed = false),
  CONSTRAINT eos_recovery_engagement_authority_check CHECK (source_authority = 'native_eos'),
  CONSTRAINT eos_recovery_engagement_classification_check CHECK (classification IN ('internal','confidential','restricted')),
  CONSTRAINT eos_recovery_engagement_version_check CHECK (version > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_recovery_engagement_call2_idx ON eos_recovery_engagements(call_2_packet_id) WHERE call_2_packet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS eos_recovery_engagement_company_state_idx ON eos_recovery_engagements(company_id,state,updated_at);
CREATE INDEX IF NOT EXISTS eos_recovery_engagement_owner_idx ON eos_recovery_engagements(owner_seat_id,state);

CREATE TABLE IF NOT EXISTS eos_recovery_delivery_pools (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engagement_id text NOT NULL REFERENCES eos_recovery_engagements(id) ON DELETE RESTRICT,
  pool_key text NOT NULL,
  state text NOT NULL DEFAULT 'unconfigured',
  source_system_reference text NOT NULL DEFAULT '',
  raw_count integer NOT NULL DEFAULT 0,
  eligible_count integer NOT NULL DEFAULT 0,
  excluded_count integer NOT NULL DEFAULT 0,
  activation_ready_count integer NOT NULL DEFAULT 0,
  exclusion_summary text NOT NULL DEFAULT '',
  qualification_note text NOT NULL DEFAULT '',
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_recovery_delivery_pool_key_check CHECK (pool_key IN ('missed_calls','open_estimates','past_customers')),
  CONSTRAINT eos_recovery_delivery_pool_state_check CHECK (state IN ('unconfigured','collecting','qualified','approved','active','paused','completed','blocked')),
  CONSTRAINT eos_recovery_delivery_pool_count_check CHECK (raw_count >= 0 AND eligible_count >= 0 AND excluded_count >= 0 AND activation_ready_count >= 0 AND eligible_count + excluded_count <= raw_count AND activation_ready_count <= eligible_count),
  CONSTRAINT eos_recovery_delivery_pool_evidence_check CHECK (jsonb_typeof(evidence_ids) = 'array'),
  CONSTRAINT eos_recovery_delivery_pool_version_check CHECK (version > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_recovery_delivery_pool_key_idx ON eos_recovery_delivery_pools(engagement_id,pool_key);
CREATE INDEX IF NOT EXISTS eos_recovery_delivery_pool_state_idx ON eos_recovery_delivery_pools(company_id,state,updated_at);

CREATE TABLE IF NOT EXISTS eos_recovery_campaign_controls (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engagement_id text NOT NULL REFERENCES eos_recovery_engagements(id) ON DELETE RESTRICT,
  pool_key text NOT NULL,
  name text NOT NULL,
  channel text NOT NULL,
  integration_binding_id text REFERENCES eos_integration_bindings(id) ON DELETE RESTRICT,
  message_version_reference text NOT NULL,
  consent_basis text NOT NULL,
  quiet_hours text NOT NULL,
  cadence text NOT NULL,
  stop_conditions text NOT NULL,
  opt_out_handling text NOT NULL,
  routing_owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  escalation_owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'draft',
  approval_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  last_event_id text,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_recovery_campaign_pool_check CHECK (pool_key IN ('missed_calls','open_estimates','past_customers')),
  CONSTRAINT eos_recovery_campaign_channel_check CHECK (channel IN ('sms','email','phone','mixed','manual')),
  CONSTRAINT eos_recovery_campaign_state_check CHECK (state IN ('draft','awaiting_approval','approved','tested','active','paused','completed','rejected')),
  CONSTRAINT eos_recovery_campaign_evidence_check CHECK (jsonb_typeof(approval_evidence_ids) = 'array'),
  CONSTRAINT eos_recovery_campaign_version_check CHECK (version > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_recovery_campaign_name_idx ON eos_recovery_campaign_controls(engagement_id,name);
CREATE INDEX IF NOT EXISTS eos_recovery_campaign_state_idx ON eos_recovery_campaign_controls(company_id,state,updated_at);

CREATE TABLE IF NOT EXISTS eos_recovery_opportunities (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engagement_id text NOT NULL REFERENCES eos_recovery_engagements(id) ON DELETE RESTRICT,
  pool_key text NOT NULL,
  external_reference_sha256 text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  state text NOT NULL DEFAULT 'identified',
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  estimated_value_minor integer NOT NULL DEFAULT 0,
  actual_value_minor integer NOT NULL DEFAULT 0,
  attribution_model text NOT NULL DEFAULT 'unattributed',
  next_action text NOT NULL,
  next_action_at text,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  last_event_id text,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_recovery_opportunity_pool_check CHECK (pool_key IN ('missed_calls','open_estimates','past_customers')),
  CONSTRAINT eos_recovery_opportunity_state_check CHECK (state IN ('identified','contacted','replied','qualified','routed','booked','won','lost','suppressed','disputed')),
  CONSTRAINT eos_recovery_opportunity_attribution_check CHECK (attribution_model IN ('direct','assisted','unattributed','disputed')),
  CONSTRAINT eos_recovery_opportunity_value_check CHECK (estimated_value_minor >= 0 AND actual_value_minor >= 0),
  CONSTRAINT eos_recovery_opportunity_hash_check CHECK (external_reference_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_recovery_opportunity_evidence_check CHECK (jsonb_typeof(evidence_ids) = 'array'),
  CONSTRAINT eos_recovery_opportunity_version_check CHECK (version > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_recovery_opportunity_reference_idx ON eos_recovery_opportunities(company_id,engagement_id,pool_key,external_reference_sha256);
CREATE INDEX IF NOT EXISTS eos_recovery_opportunity_state_idx ON eos_recovery_opportunities(engagement_id,state,updated_at);

CREATE TABLE IF NOT EXISTS eos_recovery_engagement_events (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engagement_id text NOT NULL REFERENCES eos_recovery_engagements(id) ON DELETE RESTRICT,
  sequence integer NOT NULL,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  from_state text NOT NULL,
  to_state text NOT NULL,
  engagement_version_before integer NOT NULL,
  engagement_version_after integer NOT NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  policy_decision_id text NOT NULL REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT,
  previous_event_sha256 text NOT NULL DEFAULT '',
  event_sha256 text NOT NULL,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_recovery_engagement_event_sequence_check CHECK (sequence > 0),
  CONSTRAINT eos_recovery_engagement_event_entity_check CHECK (entity_type IN ('engagement','pool','campaign','opportunity','evidence','customer_success')),
  CONSTRAINT eos_recovery_engagement_event_version_check CHECK (engagement_version_before >= 0 AND engagement_version_after >= engagement_version_before),
  CONSTRAINT eos_recovery_engagement_event_json_check CHECK (jsonb_typeof(evidence_ids) = 'array' AND jsonb_typeof(payload) = 'object'),
  CONSTRAINT eos_recovery_engagement_event_hash_check CHECK (event_sha256 ~ '^[0-9a-f]{64}$' AND (previous_event_sha256 = '' OR previous_event_sha256 ~ '^[0-9a-f]{64}$'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_recovery_engagement_event_sequence_idx ON eos_recovery_engagement_events(engagement_id,sequence);
CREATE UNIQUE INDEX IF NOT EXISTS eos_recovery_engagement_event_hash_idx ON eos_recovery_engagement_events(event_sha256);
CREATE INDEX IF NOT EXISTS eos_recovery_engagement_event_company_idx ON eos_recovery_engagement_events(company_id,recorded_at);

CREATE OR REPLACE FUNCTION eos_reject_recovery_engagement_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'EOS Recovery engagement events are append-only'; END $$;
DROP TRIGGER IF EXISTS eos_recovery_engagement_event_guard ON eos_recovery_engagement_events;
CREATE TRIGGER eos_recovery_engagement_event_guard BEFORE UPDATE OR DELETE ON eos_recovery_engagement_events FOR EACH ROW EXECUTE FUNCTION eos_reject_recovery_engagement_event_mutation();

CREATE OR REPLACE FUNCTION eos_guard_recovery_engagement_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'EOS Recovery engagement records cannot be deleted'; END $$;
DROP TRIGGER IF EXISTS eos_recovery_engagement_delete_guard ON eos_recovery_engagements;
CREATE TRIGGER eos_recovery_engagement_delete_guard BEFORE DELETE ON eos_recovery_engagements FOR EACH ROW EXECUTE FUNCTION eos_guard_recovery_engagement_delete();
