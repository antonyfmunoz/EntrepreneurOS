ALTER TABLE eos_esign_recipients
  ADD COLUMN IF NOT EXISTS delivery_state text NOT NULL DEFAULT 'manual_ready',
  ADD COLUMN IF NOT EXISTS delivery_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_delivery_attempt_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_message_reference text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'eos_esign_recipient_delivery_state_check') THEN
    ALTER TABLE eos_esign_recipients ADD CONSTRAINT eos_esign_recipient_delivery_state_check
      CHECK (delivery_state IN ('manual_ready','sending','delivered','failed','uncertain'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'eos_esign_recipient_delivery_attempt_check') THEN
    ALTER TABLE eos_esign_recipients ADD CONSTRAINT eos_esign_recipient_delivery_attempt_check
      CHECK (delivery_attempt_count >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS eos_esign_delivery_attempts (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  envelope_id text NOT NULL REFERENCES eos_esign_envelopes(id) ON DELETE CASCADE,
  recipient_id text NOT NULL REFERENCES eos_esign_recipients(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  channel text NOT NULL DEFAULT 'gmail',
  state text NOT NULL DEFAULT 'prepared',
  token_digest text NOT NULL,
  requested_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider_message_reference text NOT NULL DEFAULT '',
  failure_code text NOT NULL DEFAULT '',
  failure_message text NOT NULL DEFAULT '',
  prepared_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT eos_esign_delivery_attempt_number_check CHECK (attempt_number > 0),
  CONSTRAINT eos_esign_delivery_channel_check CHECK (channel IN ('gmail')),
  CONSTRAINT eos_esign_delivery_state_check CHECK (state IN ('prepared','delivered','failed','uncertain')),
  CONSTRAINT eos_esign_delivery_token_hash_check CHECK (token_digest ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_esign_delivery_attempt_number_idx
  ON eos_esign_delivery_attempts(recipient_id, attempt_number);
CREATE INDEX IF NOT EXISTS eos_esign_delivery_attempt_state_idx
  ON eos_esign_delivery_attempts(company_id, state, prepared_at);

CREATE OR REPLACE FUNCTION eos_esign_delivery_attempt_transition_guard()
RETURNS trigger AS $$
BEGIN
  IF OLD.state <> 'prepared' THEN
    RAISE EXCEPTION 'native e-sign delivery attempts are immutable after terminal reconciliation';
  END IF;
  IF NEW.state NOT IN ('delivered','failed','uncertain') OR NEW.completed_at IS NULL THEN
    RAISE EXCEPTION 'native e-sign delivery attempts require one terminal reconciliation transition';
  END IF;
  IF ROW(NEW.id, NEW.company_id, NEW.envelope_id, NEW.recipient_id, NEW.attempt_number, NEW.channel, NEW.token_digest, NEW.requested_by_user_id, NEW.prepared_at)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.company_id, OLD.envelope_id, OLD.recipient_id, OLD.attempt_number, OLD.channel, OLD.token_digest, OLD.requested_by_user_id, OLD.prepared_at) THEN
    RAISE EXCEPTION 'native e-sign delivery attempt identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eos_esign_delivery_attempt_transition ON eos_esign_delivery_attempts;
CREATE TRIGGER eos_esign_delivery_attempt_transition
  BEFORE UPDATE ON eos_esign_delivery_attempts
  FOR EACH ROW EXECUTE FUNCTION eos_esign_delivery_attempt_transition_guard();
