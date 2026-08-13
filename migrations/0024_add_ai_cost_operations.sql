ALTER TABLE ai_budgets
  ADD COLUMN IF NOT EXISTS alert_threshold_percent integer NOT NULL DEFAULT 80;

DO $$ BEGIN
  ALTER TABLE ai_budgets ADD CONSTRAINT ai_budgets_alert_threshold_check
    CHECK (alert_threshold_percent BETWEEN 1 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ai_usage_ledger
  ADD COLUMN IF NOT EXISTS reconciliation_evidence_uri text,
  ADD COLUMN IF NOT EXISTS reconciled_by_user_id text REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;

CREATE TABLE IF NOT EXISTS ai_budget_alerts (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  month_start timestamptz NOT NULL,
  threshold_percent integer NOT NULL CHECK (threshold_percent BETWEEN 1 AND 100),
  usage_micros integer NOT NULL CHECK (usage_micros >= 0),
  limit_micros integer NOT NULL CHECK (limit_micros > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, month_start, threshold_percent)
);
