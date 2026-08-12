CREATE TABLE IF NOT EXISTS ai_budgets (
  company_id integer PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  monthly_limit_micros integer NOT NULL CHECK (monthly_limit_micros > 0),
  per_request_limit_micros integer NOT NULL CHECK (per_request_limit_micros > 0 AND per_request_limit_micros <= monthly_limit_micros),
  enabled boolean NOT NULL DEFAULT true,
  updated_by_user_id text NOT NULL REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_usage_ledger (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  context text NOT NULL,
  model text NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'completed', 'failed')),
  reserved_cost_micros integer NOT NULL CHECK (reserved_cost_micros >= 0),
  actual_cost_micros integer CHECK (actual_cost_micros >= 0),
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ai_usage_company_month_idx ON ai_usage_ledger (company_id, created_at DESC);
