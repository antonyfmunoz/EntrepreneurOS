CREATE TABLE IF NOT EXISTS eos_alert_email_receipts (
  id text PRIMARY KEY,
  event text NOT NULL,
  severity text NOT NULL,
  sender_user_id text NOT NULL,
  recipient text NOT NULL,
  state text NOT NULL DEFAULT 'dispatching',
  provider_message_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  CONSTRAINT eos_alert_email_id_check CHECK (id ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_alert_email_state_check CHECK (state IN ('dispatching','delivered','uncertain')),
  CONSTRAINT eos_alert_email_receipt_check CHECK (state <> 'delivered' OR (provider_message_id IS NOT NULL AND length(provider_message_id) > 0))
);
CREATE INDEX IF NOT EXISTS eos_alert_email_received_idx ON eos_alert_email_receipts(received_at);
