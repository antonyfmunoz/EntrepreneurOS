ALTER TABLE eos_esign_envelopes
  ADD COLUMN IF NOT EXISTS assurance_mode text NOT NULL DEFAULT 'link';

ALTER TABLE eos_esign_envelopes
  DROP CONSTRAINT IF EXISTS eos_esign_envelope_assurance_mode_check;
ALTER TABLE eos_esign_envelopes
  ADD CONSTRAINT eos_esign_envelope_assurance_mode_check
  CHECK (assurance_mode IN ('link','email_otp'));

ALTER TABLE eos_esign_recipients
  ADD COLUMN IF NOT EXISTS identity_assurance_state text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS otp_digest text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS otp_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS otp_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otp_send_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otp_last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_token_digest text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completion_delivery_state text NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS completion_delivery_attempt_count integer NOT NULL DEFAULT 0;

ALTER TABLE eos_esign_recipients
  DROP CONSTRAINT IF EXISTS eos_esign_recipient_identity_assurance_state_check;
ALTER TABLE eos_esign_recipients
  ADD CONSTRAINT eos_esign_recipient_identity_assurance_state_check
  CHECK (identity_assurance_state IN ('not_required','pending','verified','locked'));
ALTER TABLE eos_esign_recipients
  DROP CONSTRAINT IF EXISTS eos_esign_recipient_otp_digest_check;
ALTER TABLE eos_esign_recipients
  ADD CONSTRAINT eos_esign_recipient_otp_digest_check
  CHECK (otp_digest = '' OR otp_digest ~ '^[0-9a-f]{64}$');
ALTER TABLE eos_esign_recipients
  DROP CONSTRAINT IF EXISTS eos_esign_recipient_otp_count_check;
ALTER TABLE eos_esign_recipients
  ADD CONSTRAINT eos_esign_recipient_otp_count_check
  CHECK (otp_attempt_count BETWEEN 0 AND 5 AND otp_send_count BETWEEN 0 AND 5);
ALTER TABLE eos_esign_recipients
  DROP CONSTRAINT IF EXISTS eos_esign_recipient_completion_token_check;
ALTER TABLE eos_esign_recipients
  ADD CONSTRAINT eos_esign_recipient_completion_token_check
  CHECK (completion_token_digest = '' OR completion_token_digest ~ '^[0-9a-f]{64}$');
ALTER TABLE eos_esign_recipients
  DROP CONSTRAINT IF EXISTS eos_esign_recipient_completion_delivery_check;
ALTER TABLE eos_esign_recipients
  ADD CONSTRAINT eos_esign_recipient_completion_delivery_check
  CHECK (completion_delivery_state IN ('not_requested','pending','delivering','delivered','retry','dead_letter'));
ALTER TABLE eos_esign_recipients
  DROP CONSTRAINT IF EXISTS eos_esign_recipient_completion_attempt_count_check;
ALTER TABLE eos_esign_recipients
  ADD CONSTRAINT eos_esign_recipient_completion_attempt_count_check
  CHECK (completion_delivery_attempt_count >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_recipient_completion_token_idx
  ON eos_esign_recipients (completion_token_digest)
  WHERE completion_token_digest <> '';

CREATE TABLE IF NOT EXISTS eos_esign_webhook_subscriptions (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  endpoint_url text NOT NULL,
  description text NOT NULL DEFAULT '',
  event_types jsonb NOT NULL DEFAULT '["*"]'::jsonb,
  secret_ciphertext text NOT NULL,
  secret_fingerprint text NOT NULL,
  state text NOT NULL DEFAULT 'active',
  version integer NOT NULL DEFAULT 1,
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_webhook_subscription_state_check CHECK (state IN ('active','paused','revoked')),
  CONSTRAINT eos_esign_webhook_subscription_version_check CHECK (version > 0),
  CONSTRAINT eos_esign_webhook_subscription_secret_check CHECK (secret_ciphertext LIKE 'enc:v1:%' AND secret_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_esign_webhook_subscription_event_types_check CHECK (jsonb_typeof(event_types) = 'array')
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_webhook_subscription_endpoint_idx
  ON eos_esign_webhook_subscriptions (company_id, endpoint_url)
  WHERE state <> 'revoked';
CREATE INDEX IF NOT EXISTS eos_esign_webhook_subscription_state_idx
  ON eos_esign_webhook_subscriptions (company_id, state, updated_at);

CREATE TABLE IF NOT EXISTS eos_esign_webhook_deliveries (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id text NOT NULL REFERENCES eos_esign_webhook_subscriptions(id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES eos_esign_events(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  replay_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  leased_at timestamptz,
  delivered_at timestamptz,
  last_http_status integer,
  last_failure_code text NOT NULL DEFAULT '',
  last_failure_message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_webhook_delivery_state_check CHECK (state IN ('pending','delivering','retry','delivered','dead_letter')),
  CONSTRAINT eos_esign_webhook_delivery_count_check CHECK (attempt_count >= 0 AND replay_count >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_webhook_delivery_event_idx
  ON eos_esign_webhook_deliveries (subscription_id, event_id);
CREATE INDEX IF NOT EXISTS eos_esign_webhook_delivery_queue_idx
  ON eos_esign_webhook_deliveries (state, next_attempt_at, created_at);

CREATE TABLE IF NOT EXISTS eos_esign_webhook_attempts (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  delivery_id text NOT NULL REFERENCES eos_esign_webhook_deliveries(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  request_sha256 text NOT NULL,
  outcome text NOT NULL,
  http_status integer,
  failure_code text NOT NULL DEFAULT '',
  attempted_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NOT NULL,
  CONSTRAINT eos_esign_webhook_attempt_number_check CHECK (attempt_number > 0),
  CONSTRAINT eos_esign_webhook_attempt_hash_check CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_esign_webhook_attempt_outcome_check CHECK (outcome IN ('delivered','retry','dead_letter'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_webhook_attempt_number_idx
  ON eos_esign_webhook_attempts (delivery_id, attempt_number);

CREATE TABLE IF NOT EXISTS eos_esign_completion_deliveries (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  envelope_id text NOT NULL REFERENCES eos_esign_envelopes(id) ON DELETE CASCADE,
  recipient_id text NOT NULL REFERENCES eos_esign_recipients(id) ON DELETE CASCADE,
  requested_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token_ciphertext text NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  replay_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  leased_at timestamptz,
  provider_message_reference text NOT NULL DEFAULT '',
  delivered_at timestamptz,
  last_failure_code text NOT NULL DEFAULT '',
  last_failure_message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_esign_completion_delivery_state_check CHECK (state IN ('pending','delivering','retry','delivered','dead_letter')),
  CONSTRAINT eos_esign_completion_delivery_count_check CHECK (attempt_count >= 0 AND replay_count >= 0),
  CONSTRAINT eos_esign_completion_delivery_token_check CHECK (token_ciphertext = '' OR token_ciphertext LIKE 'enc:v1:%')
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_completion_delivery_recipient_idx
  ON eos_esign_completion_deliveries (recipient_id);
CREATE INDEX IF NOT EXISTS eos_esign_completion_delivery_queue_idx
  ON eos_esign_completion_deliveries (state, next_attempt_at, created_at);

CREATE TABLE IF NOT EXISTS eos_esign_completion_delivery_attempts (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  delivery_id text NOT NULL REFERENCES eos_esign_completion_deliveries(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  outcome text NOT NULL,
  provider_message_reference text NOT NULL DEFAULT '',
  failure_code text NOT NULL DEFAULT '',
  attempted_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NOT NULL,
  CONSTRAINT eos_esign_completion_attempt_number_check CHECK (attempt_number > 0),
  CONSTRAINT eos_esign_completion_attempt_outcome_check CHECK (outcome IN ('delivered','retry','dead_letter'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_completion_attempt_number_idx
  ON eos_esign_completion_delivery_attempts (delivery_id, attempt_number);

CREATE OR REPLACE FUNCTION eos_reject_esign_attempt_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Native e-sign delivery attempt history is immutable';
END;
$$;
DROP TRIGGER IF EXISTS eos_esign_webhook_attempts_immutable ON eos_esign_webhook_attempts;
CREATE TRIGGER eos_esign_webhook_attempts_immutable
BEFORE UPDATE OR DELETE ON eos_esign_webhook_attempts
FOR EACH ROW EXECUTE FUNCTION eos_reject_esign_attempt_mutation();
DROP TRIGGER IF EXISTS eos_esign_completion_attempts_immutable ON eos_esign_completion_delivery_attempts;
CREATE TRIGGER eos_esign_completion_attempts_immutable
BEFORE UPDATE OR DELETE ON eos_esign_completion_delivery_attempts
FOR EACH ROW EXECUTE FUNCTION eos_reject_esign_attempt_mutation();

ALTER TABLE eos_esign_events DROP CONSTRAINT IF EXISTS eos_esign_events_event_type_check;
ALTER TABLE eos_esign_events ADD CONSTRAINT eos_esign_events_event_type_check CHECK (event_type IN (
  'document_registered',
  'envelope_created',
  'envelope_revised',
  'envelope_issued',
  'envelope_completed',
  'envelope_voided',
  'envelope_expired',
  'recipient_sent',
  'recipient_opened',
  'recipient_corrected',
  'recipient_declined',
  'identity_otp_requested',
  'identity_verified',
  'consent_recorded',
  'signature_recorded',
  'delivery_prepared',
  'delivery_succeeded',
  'delivery_failed',
  'completion_delivery_prepared',
  'completion_delivery_succeeded',
  'completion_delivery_failed',
  'recovery_required',
  'recovery_attempt_failed'
));
