-- EOS owns website and funnel records natively. The provider-agnostic
-- instrument key means a company can publish an EOS funnel without an
-- external page builder, while future provider imports can reconcile into the
-- same governed object model.
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'eos_instrument_objects'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%instrument_key%'
  LOOP
    EXECUTE format('ALTER TABLE eos_instrument_objects DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END;
$$;

ALTER TABLE eos_instrument_objects
  ADD CONSTRAINT eos_instrument_objects_instrument_check
  CHECK (instrument_key IN (
    'docs','files','sheets','slides','tables','forms','calendar','search','canvas',
    'tasks','projects','workflows','crm','messages','conference_rooms','ai','knowledge',
    'memory','analytics','learning','progression','commerce','finance','ads','reputation',
    'websites'
  ));
