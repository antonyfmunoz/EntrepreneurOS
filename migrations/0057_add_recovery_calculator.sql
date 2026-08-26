CREATE TABLE IF NOT EXISTS eos_recovery_calculator_sessions (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  public_token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'started',
  assumption_version text NOT NULL,
  report_version text NOT NULL,
  input_revision integer NOT NULL DEFAULT 0,
  raw_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  sales_brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  recovery_score integer,
  dominant_pool text,
  fit_classification text,
  route text,
  intent text,
  first_name text,
  work_email text,
  company_name text,
  phone text,
  communication_preference text,
  consent_granted boolean NOT NULL DEFAULT false,
  consent_version text,
  consent_granted_at timestamptz,
  contact_captured_at timestamptz,
  stakeholder_id text REFERENCES eos_stakeholders(id) ON DELETE SET NULL,
  relationship_id text REFERENCES eos_stakeholder_relationships(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'direct',
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  external_writeback_state text NOT NULL DEFAULT 'not_configured',
  external_writeback_attempts integer NOT NULL DEFAULT 0,
  external_writeback_error text NOT NULL DEFAULT '',
  calendar_booked boolean NOT NULL DEFAULT false,
  calendar_reference text NOT NULL DEFAULT '',
  last_idempotency_key text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_recovery_sessions_status_check CHECK (status IN ('started','partial_result','contact_captured','report_ready','routed','booked','expired')),
  CONSTRAINT eos_recovery_sessions_revision_check CHECK (input_revision >= 0),
  CONSTRAINT eos_recovery_sessions_score_check CHECK (recovery_score IS NULL OR recovery_score BETWEEN 0 AND 100),
  CONSTRAINT eos_recovery_sessions_pool_check CHECK (dominant_pool IS NULL OR dominant_pool IN ('open_estimates','missed_response','past_customers')),
  CONSTRAINT eos_recovery_sessions_fit_check CHECK (fit_classification IS NULL OR fit_classification IN ('high_fit','fit_not_ready','growth_constrained','early_or_insufficient')),
  CONSTRAINT eos_recovery_sessions_route_check CHECK (route IS NULL OR route IN ('recovery_diagnostic','diy_nurture','growth_education','guidance_recheck')),
  CONSTRAINT eos_recovery_sessions_writeback_check CHECK (external_writeback_state IN ('not_configured','pending','succeeded','failed')),
  CONSTRAINT eos_recovery_sessions_writeback_attempts_check CHECK (external_writeback_attempts >= 0),
  CONSTRAINT eos_recovery_sessions_consent_check CHECK (consent_granted = false OR (consent_version IS NOT NULL AND consent_granted_at IS NOT NULL AND work_email IS NOT NULL)),
  CONSTRAINT eos_recovery_sessions_expiry_check CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_recovery_sessions_token_idx
  ON eos_recovery_calculator_sessions(public_token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS eos_recovery_sessions_company_idempotency_idx
  ON eos_recovery_calculator_sessions(company_id, last_idempotency_key)
  WHERE last_idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS eos_recovery_sessions_company_status_idx
  ON eos_recovery_calculator_sessions(company_id, status, updated_at);
CREATE INDEX IF NOT EXISTS eos_recovery_sessions_contact_idx
  ON eos_recovery_calculator_sessions(company_id, work_email);

CREATE TABLE IF NOT EXISTS eos_recovery_calculator_events (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  session_id text NOT NULL REFERENCES eos_recovery_calculator_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  trace_id text NOT NULL,
  correlation_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_recovery_events_type_check CHECK (event_type IN ('session_started','inputs_submitted','partial_result_viewed','contact_captured','report_unlocked','route_assigned','calendar_opened','calendar_booked','external_writeback_pending','external_writeback_succeeded','external_writeback_failed'))
);

CREATE INDEX IF NOT EXISTS eos_recovery_events_session_created_idx
  ON eos_recovery_calculator_events(session_id, created_at);

CREATE OR REPLACE FUNCTION eos_reject_recovery_calculator_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'recovery calculator events are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eos_recovery_calculator_events_append_only ON eos_recovery_calculator_events;
CREATE TRIGGER eos_recovery_calculator_events_append_only
BEFORE UPDATE OR DELETE ON eos_recovery_calculator_events
FOR EACH ROW EXECUTE FUNCTION eos_reject_recovery_calculator_event_mutation();
