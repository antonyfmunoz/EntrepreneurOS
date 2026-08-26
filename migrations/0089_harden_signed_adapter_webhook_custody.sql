ALTER TABLE eos_integration_webhook_endpoints DROP CONSTRAINT IF EXISTS eos_integration_webhook_secret_cipher_check;
ALTER TABLE eos_integration_webhook_endpoints
  ADD CONSTRAINT eos_integration_webhook_secret_cipher_check
  CHECK (secret_ciphertext LIKE 'enc:v1:%');

ALTER TABLE eos_integration_webhook_endpoints DROP CONSTRAINT IF EXISTS eos_integration_webhook_previous_secret_check;
ALTER TABLE eos_integration_webhook_endpoints
  ADD CONSTRAINT eos_integration_webhook_previous_secret_check
  CHECK (
    (previous_secret_ciphertext IS NULL AND previous_secret_expires_at IS NULL)
    OR
    (previous_secret_ciphertext LIKE 'enc:v1:%' AND previous_secret_expires_at IS NOT NULL)
  );

ALTER TABLE eos_integration_webhook_endpoints DROP CONSTRAINT IF EXISTS eos_integration_webhook_event_types_check;
ALTER TABLE eos_integration_webhook_endpoints
  ADD CONSTRAINT eos_integration_webhook_event_types_check
  CHECK (jsonb_typeof(accepted_event_types) = 'array' AND jsonb_array_length(accepted_event_types) > 0);

ALTER TABLE eos_integration_webhook_events DROP CONSTRAINT IF EXISTS eos_integration_webhook_signature_version_check;
ALTER TABLE eos_integration_webhook_events
  ADD CONSTRAINT eos_integration_webhook_signature_version_check
  CHECK (signature_version = 'v1');

ALTER TABLE eos_integration_webhook_events DROP CONSTRAINT IF EXISTS eos_integration_webhook_payload_projection_check;
ALTER TABLE eos_integration_webhook_events
  ADD CONSTRAINT eos_integration_webhook_payload_projection_check
  CHECK (jsonb_typeof(payload_projection) = 'object');
