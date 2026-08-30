ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS legal_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS assumed_business_names jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE companies SET legal_name = name WHERE legal_name IS NULL OR btrim(legal_name) = '';

ALTER TABLE companies
  ALTER COLUMN legal_name SET DEFAULT '',
  ALTER COLUMN legal_name SET NOT NULL;

ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS companies_assumed_business_names_array_check,
  ADD CONSTRAINT companies_assumed_business_names_array_check
    CHECK (jsonb_typeof(assumed_business_names) = 'array');
