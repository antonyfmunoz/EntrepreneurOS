DO $$
DECLARE
  has_legacy boolean;
  has_bound boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'service_ownership' AND column_name = 'backup_owner_reference'
  ) INTO has_legacy;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'service_ownership' AND column_name = 'backup_owner_user_id'
  ) INTO has_bound;

  IF has_legacy AND NOT has_bound THEN
    ALTER TABLE service_ownership RENAME COLUMN backup_owner_reference TO backup_owner_user_id;
  ELSIF has_legacy AND has_bound THEN
    UPDATE service_ownership
      SET backup_owner_user_id = backup_owner_reference
      WHERE backup_owner_user_id IS NULL AND backup_owner_reference IS NOT NULL;
    ALTER TABLE service_ownership DROP COLUMN backup_owner_reference;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_ownership_backup_owner_user_id_fkey'
  ) THEN
    ALTER TABLE service_ownership
      ADD CONSTRAINT service_ownership_backup_owner_user_id_fkey
      FOREIGN KEY (backup_owner_user_id) REFERENCES users(id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION eos_protect_operational_evidence_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('eos.allow_evidence_history_maintenance', true) = 'true' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION 'operational control evidence history is immutable' USING ERRCODE = '55000';
END
$$;

DROP TRIGGER IF EXISTS operational_control_evidence_history_immutable ON operational_control_evidence_history;
CREATE TRIGGER operational_control_evidence_history_immutable
  BEFORE UPDATE OR DELETE ON operational_control_evidence_history
  FOR EACH ROW EXECUTE FUNCTION eos_protect_operational_evidence_history();
