-- Native operational events are committed with their source transition and
-- dispatched idempotently to Role Agent schedules after commit.
CREATE TABLE IF NOT EXISTS eos_agent_event_outbox (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  dispatched_run_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_error text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL,
  dispatched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_agent_event_outbox_state_check CHECK (state IN ('pending','dispatched','failed')),
  CONSTRAINT eos_agent_event_outbox_attempts_check CHECK (attempts >= 0),
  CONSTRAINT eos_agent_event_outbox_payload_check CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT eos_agent_event_outbox_run_ids_check CHECK (jsonb_typeof(dispatched_run_ids) = 'array')
);

CREATE INDEX IF NOT EXISTS eos_agent_event_outbox_pending_idx
  ON eos_agent_event_outbox(state, occurred_at);
CREATE INDEX IF NOT EXISTS eos_agent_event_outbox_company_type_idx
  ON eos_agent_event_outbox(company_id, event_type, occurred_at);
