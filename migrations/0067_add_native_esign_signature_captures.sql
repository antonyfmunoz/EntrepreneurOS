ALTER TABLE eos_esign_recipients
  ADD COLUMN IF NOT EXISTS signature_capture_sha256 text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS signature_capture_storage_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS signature_capture_mime_type text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS signature_capture_size_bytes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signature_capture_width integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signature_capture_height integer NOT NULL DEFAULT 0;

-- Existing typed signatures predate separately persisted capture metadata. Their
-- signed-evidence digest remains the immutable legacy capture reference.
UPDATE eos_esign_recipients
SET signature_capture_sha256 = signature_sha256
WHERE state = 'signed' AND signature_capture_sha256 = '';

ALTER TABLE eos_esign_recipients
  DROP CONSTRAINT IF EXISTS eos_esign_recipient_capture_hash_check;
ALTER TABLE eos_esign_recipients
  ADD CONSTRAINT eos_esign_recipient_capture_hash_check
  CHECK (signature_capture_sha256 = '' OR signature_capture_sha256 ~ '^[0-9a-f]{64}$');

ALTER TABLE eos_esign_recipients
  DROP CONSTRAINT IF EXISTS eos_esign_recipient_capture_shape_check;
ALTER TABLE eos_esign_recipients
  ADD CONSTRAINT eos_esign_recipient_capture_shape_check CHECK (
    (
      signature_method IN ('','typed') AND
      signature_capture_storage_key = '' AND
      signature_capture_mime_type = '' AND
      signature_capture_size_bytes = 0 AND
      signature_capture_width = 0 AND
      signature_capture_height = 0
    ) OR (
      signature_method IN ('drawn','uploaded') AND
      signature_capture_storage_key <> '' AND
      signature_capture_mime_type IN ('image/png','image/jpeg') AND
      signature_capture_size_bytes BETWEEN 1 AND 524288 AND
      signature_capture_width BETWEEN 32 AND 2400 AND
      signature_capture_height BETWEEN 16 AND 1200
    )
  );

ALTER TABLE eos_esign_recipients
  DROP CONSTRAINT IF EXISTS eos_esign_recipient_signed_capture_check;
ALTER TABLE eos_esign_recipients
  ADD CONSTRAINT eos_esign_recipient_signed_capture_check
  CHECK (state <> 'signed' OR (
    signature_capture_sha256 ~ '^[0-9a-f]{64}$' AND
    signature_sha256 ~ '^[0-9a-f]{64}$'
  ));

CREATE OR REPLACE FUNCTION eos_protect_signed_recipient_evidence()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state = 'signed' AND ROW(
    NEW.state,
    NEW.consent_version,
    NEW.consented_at,
    NEW.signature_method,
    NEW.signature_name,
    NEW.signature_sha256,
    NEW.signature_capture_sha256,
    NEW.signature_capture_storage_key,
    NEW.signature_capture_mime_type,
    NEW.signature_capture_size_bytes,
    NEW.signature_capture_width,
    NEW.signature_capture_height,
    NEW.field_values,
    NEW.signed_at,
    NEW.network_fingerprint_sha256,
    NEW.user_agent_sha256
  ) IS DISTINCT FROM ROW(
    OLD.state,
    OLD.consent_version,
    OLD.consented_at,
    OLD.signature_method,
    OLD.signature_name,
    OLD.signature_sha256,
    OLD.signature_capture_sha256,
    OLD.signature_capture_storage_key,
    OLD.signature_capture_mime_type,
    OLD.signature_capture_size_bytes,
    OLD.signature_capture_width,
    OLD.signature_capture_height,
    OLD.field_values,
    OLD.signed_at,
    OLD.network_fingerprint_sha256,
    OLD.user_agent_sha256
  ) THEN
    RAISE EXCEPTION 'Native e-sign signed recipient evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS eos_esign_signed_recipient_evidence_immutable ON eos_esign_recipients;
CREATE TRIGGER eos_esign_signed_recipient_evidence_immutable
BEFORE UPDATE ON eos_esign_recipients
FOR EACH ROW EXECUTE FUNCTION eos_protect_signed_recipient_evidence();
