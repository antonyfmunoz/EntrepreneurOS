CREATE TABLE IF NOT EXISTS eos_recovery_call_2_packets (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  session_id text NOT NULL REFERENCES eos_recovery_calculator_sessions(id) ON DELETE RESTRICT,
  commercial_case_id text NOT NULL REFERENCES eos_commercial_cases(id) ON DELETE RESTRICT,
  work_packet_id text NOT NULL REFERENCES eos_work_packets(id) ON DELETE RESTRICT,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  packet_version text NOT NULL DEFAULT 'empyrean-recovery-call2.v1',
  terms_authority text NOT NULL,
  sales_brief_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  buyer_decision_makers jsonb NOT NULL DEFAULT '[]'::jsonb,
  observed_facts text NOT NULL DEFAULT '',
  measured_signals text NOT NULL DEFAULT '',
  unavailable_data text NOT NULL DEFAULT '',
  changes_since_call_1 text NOT NULL DEFAULT '',
  recovery_thesis text NOT NULL DEFAULT '',
  scope_discussion text NOT NULL DEFAULT '',
  measurement_attribution text NOT NULL DEFAULT '',
  client_responsibilities text NOT NULL DEFAULT '',
  objections text NOT NULL DEFAULT '',
  recommended_package text NOT NULL DEFAULT 'standard',
  founding_proof_consideration text NOT NULL DEFAULT '',
  terms_presented jsonb NOT NULL DEFAULT '{}'::jsonb,
  exception_summary text NOT NULL DEFAULT '',
  exception_approval_id text REFERENCES eos_approval_requests(id) ON DELETE RESTRICT,
  disposition text,
  dependency_or_lost_reason text NOT NULL DEFAULT '',
  decision_maker text NOT NULL DEFAULT '',
  next_action text NOT NULL DEFAULT '',
  next_action_at timestamptz,
  agreement_version text NOT NULL DEFAULT '',
  payment_path text NOT NULL DEFAULT '',
  onboarding_trigger text NOT NULL DEFAULT '',
  external_effects_executed boolean NOT NULL DEFAULT false,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'confidential',
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_recovery_call_2_state_check CHECK (state IN ('draft','ready','decision_recorded','handoff_ready','closed')),
  CONSTRAINT eos_recovery_call_2_version_check CHECK (version > 0),
  CONSTRAINT eos_recovery_call_2_package_check CHECK (recommended_package IN ('founding_proof_cohort','standard')),
  CONSTRAINT eos_recovery_call_2_disposition_check CHECK (disposition IS NULL OR disposition IN ('closed_won_pending_agreement_payment','conditional_named_dependency','nurture_not_now','closed_lost_reason')),
  CONSTRAINT eos_recovery_call_2_no_effect_check CHECK (external_effects_executed = false),
  CONSTRAINT eos_recovery_call_2_authority_check CHECK (source_authority = 'native_eos'),
  CONSTRAINT eos_recovery_call_2_classification_check CHECK (classification IN ('confidential','restricted'))
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_recovery_call_2_session_idx ON eos_recovery_call_2_packets(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS eos_recovery_call_2_case_idx ON eos_recovery_call_2_packets(commercial_case_id);
CREATE INDEX IF NOT EXISTS eos_recovery_call_2_company_state_idx ON eos_recovery_call_2_packets(company_id, state, updated_at);

CREATE TABLE IF NOT EXISTS eos_recovery_call_2_events (
  id text PRIMARY KEY,
  packet_id text NOT NULL REFERENCES eos_recovery_call_2_packets(id) ON DELETE CASCADE,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  sequence integer NOT NULL,
  event_type text NOT NULL,
  from_state text NOT NULL,
  to_state text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  trace_id text NOT NULL,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_recovery_call_2_events_sequence_check CHECK (sequence > 0),
  CONSTRAINT eos_recovery_call_2_events_type_check CHECK (event_type IN ('packet_created','packet_updated','packet_ready','exception_requested','decision_recorded','handoff_prepared','closed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_recovery_call_2_events_sequence_idx ON eos_recovery_call_2_events(packet_id, sequence);
CREATE INDEX IF NOT EXISTS eos_recovery_call_2_events_created_idx ON eos_recovery_call_2_events(packet_id, created_at);

CREATE OR REPLACE FUNCTION eos_reject_recovery_call_2_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'recovery call 2 events are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eos_recovery_call_2_events_append_only ON eos_recovery_call_2_events;
CREATE TRIGGER eos_recovery_call_2_events_append_only
BEFORE UPDATE OR DELETE ON eos_recovery_call_2_events
FOR EACH ROW EXECUTE FUNCTION eos_reject_recovery_call_2_event_mutation();

CREATE OR REPLACE FUNCTION eos_reject_recovery_call_2_authority_rewrite()
RETURNS trigger AS $$
BEGIN
  IF NEW.terms_presented IS DISTINCT FROM OLD.terms_presented
     AND NEW.version > OLD.version
     AND NEW.state <> 'draft' THEN
    RAISE EXCEPTION 'presented recovery terms cannot be rewritten after readiness';
  END IF;
  IF OLD.disposition IS NOT NULL AND NEW.disposition IS DISTINCT FROM OLD.disposition THEN
    RAISE EXCEPTION 'recovery call 2 disposition is immutable';
  END IF;
  IF NEW.external_effects_executed THEN
    RAISE EXCEPTION 'recovery call 2 packets cannot execute external effects';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eos_recovery_call_2_authority_guard ON eos_recovery_call_2_packets;
CREATE TRIGGER eos_recovery_call_2_authority_guard
BEFORE UPDATE ON eos_recovery_call_2_packets
FOR EACH ROW EXECUTE FUNCTION eos_reject_recovery_call_2_authority_rewrite();
