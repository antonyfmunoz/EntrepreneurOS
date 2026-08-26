CREATE TABLE IF NOT EXISTS eos_customer_value_cycles (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  cycle_key text NOT NULL,
  title text NOT NULL,
  mode text NOT NULL DEFAULT 'prelive_fixture',
  synthetic_label text NOT NULL DEFAULT 'Synthetic / Non-Production',
  state text NOT NULL DEFAULT 'awaiting_commercial_approval',
  version integer NOT NULL DEFAULT 1,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  stakeholder_id text NOT NULL REFERENCES eos_stakeholders(id) ON DELETE RESTRICT,
  relationship_id text NOT NULL REFERENCES eos_stakeholder_relationships(id) ON DELETE RESTRICT,
  offer_id text NOT NULL REFERENCES eos_offer_programs(id) ON DELETE RESTRICT,
  commercial_case_id text NOT NULL REFERENCES eos_commercial_cases(id) ON DELETE RESTRICT,
  work_packet_id text NOT NULL REFERENCES eos_work_packets(id) ON DELETE RESTRICT,
  approval_id text NOT NULL REFERENCES eos_approval_requests(id) ON DELETE RESTRICT,
  objective text NOT NULL,
  acceptance_criteria text NOT NULL,
  cleanup_criteria text NOT NULL,
  phase_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  recovery_from_state text NOT NULL DEFAULT '',
  failure_summary text NOT NULL DEFAULT '',
  excluded_from_metrics boolean NOT NULL DEFAULT true,
  external_effects_executed boolean NOT NULL DEFAULT false,
  restored_safe_state_at timestamptz,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'confidential',
  schema_version text NOT NULL DEFAULT 'customer-value-cycle-v1.0',
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_customer_value_cycles_mode_check CHECK (mode = 'prelive_fixture'),
  CONSTRAINT eos_customer_value_cycles_namespace_check CHECK (cycle_key LIKE 'TEST-PRELIVE-%'),
  CONSTRAINT eos_customer_value_cycles_label_check CHECK (synthetic_label = 'Synthetic / Non-Production'),
  CONSTRAINT eos_customer_value_cycles_version_check CHECK (version > 0),
  CONSTRAINT eos_customer_value_cycles_state_check CHECK (state IN ('awaiting_commercial_approval','commercial_approved','commercial_rejected','agreement_ready','onboarding','delivery','reporting','renewal_review','renewed','closed','recovery_required','cancelled')),
  CONSTRAINT eos_customer_value_cycles_no_effect_check CHECK (external_effects_executed = false),
  CONSTRAINT eos_customer_value_cycles_metric_exclusion_check CHECK (excluded_from_metrics = true),
  CONSTRAINT eos_customer_value_cycles_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_customer_value_cycles_classification_check CHECK (classification IN ('public','internal','confidential','restricted'))
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_customer_value_cycles_company_key_idx
  ON eos_customer_value_cycles(company_id, cycle_key);
CREATE INDEX IF NOT EXISTS eos_customer_value_cycles_owner_state_idx
  ON eos_customer_value_cycles(owner_seat_id, state);
CREATE INDEX IF NOT EXISTS eos_customer_value_cycles_case_state_idx
  ON eos_customer_value_cycles(commercial_case_id, state);

CREATE TABLE IF NOT EXISTS eos_customer_value_cycle_events (
  id text PRIMARY KEY,
  cycle_id text NOT NULL REFERENCES eos_customer_value_cycles(id) ON DELETE CASCADE,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
  CONSTRAINT eos_customer_value_cycle_events_sequence_check CHECK (sequence > 0),
  CONSTRAINT eos_customer_value_cycle_events_type_check CHECK (event_type IN ('cycle_created','commercial_approved','commercial_rejected','agreement_verified','onboarding_started','delivery_started','reporting_started','renewal_review_started','renewed','closed','failure_reported','safe_state_restored','cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_customer_value_cycle_events_sequence_idx
  ON eos_customer_value_cycle_events(cycle_id, sequence);
CREATE INDEX IF NOT EXISTS eos_customer_value_cycle_events_created_idx
  ON eos_customer_value_cycle_events(cycle_id, created_at);

CREATE OR REPLACE FUNCTION eos_reject_customer_value_cycle_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'customer value cycle events are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eos_customer_value_cycle_events_append_only ON eos_customer_value_cycle_events;
CREATE TRIGGER eos_customer_value_cycle_events_append_only
BEFORE UPDATE OR DELETE ON eos_customer_value_cycle_events
FOR EACH ROW EXECUTE FUNCTION eos_reject_customer_value_cycle_event_mutation();
