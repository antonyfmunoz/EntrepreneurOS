CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_customer_id text NOT NULL,
  provider_subscription_id text NOT NULL UNIQUE,
  plan_key text NOT NULL,
  status text NOT NULL,
  entitlements jsonb NOT NULL DEFAULT '[]'::jsonb,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_subscriptions_user_idx ON billing_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS billing_subscriptions_customer_idx ON billing_subscriptions (provider_customer_id);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  payload_hash text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
