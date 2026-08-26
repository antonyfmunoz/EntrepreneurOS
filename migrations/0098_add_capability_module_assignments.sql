ALTER TABLE eos_capability_instances
  ADD COLUMN IF NOT EXISTS module_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE eos_capability_instances SET module_ids = '[2,3,4,5,6,7]'::jsonb
  WHERE capability_key = 'CAP-EMPYREAN-RECOVERY-SYSTEM' AND module_ids = '[]'::jsonb;
UPDATE eos_capability_instances SET module_ids = '[12]'::jsonb
  WHERE capability_key = 'CAP-EMPYREAN-PROVIDER-OPERATIONS' AND module_ids = '[]'::jsonb;
UPDATE eos_capability_instances SET module_ids = '[6,10,14]'::jsonb
  WHERE capability_key = 'CAP-EMPYREAN-AFM-SHARED-SERVICES' AND module_ids = '[]'::jsonb;

UPDATE eos_capability_instances SET module_ids = CASE capability_key
  WHEN 'recruiting-candidate-portal' THEN '[1]'::jsonb
  WHEN 'lead-capture-marketing-qualification' THEN '[2]'::jsonb
  WHEN 'sales-opportunity-commercial-decision' THEN '[3]'::jsonb
  WHEN 'contracting-payment-activation' THEN '[4]'::jsonb
  WHEN 'client-onboarding-portal' THEN '[5]'::jsonb
  WHEN 'fulfillment-work-delivery' THEN '[6]'::jsonb
  WHEN 'customer-success-reporting-renewal' THEN '[7]'::jsonb
  WHEN 'executive-command-operating-cadence' THEN '[8]'::jsonb
  WHEN 'finance-control-commercial-events' THEN '[9]'::jsonb
  WHEN 'operations-administration-vendor-control' THEN '[10]'::jsonb
  WHEN 'product-offer-template-evolution' THEN '[11]'::jsonb
  WHEN 'technology-integrations-automation-control' THEN '[12]'::jsonb
  WHEN 'legal-obligations-rights-compliance' THEN '[13]'::jsonb
  WHEN 'brand-media-proof-distribution' THEN '[14]'::jsonb
  ELSE module_ids END
WHERE capability_key IN ('recruiting-candidate-portal','lead-capture-marketing-qualification','sales-opportunity-commercial-decision','contracting-payment-activation','client-onboarding-portal','fulfillment-work-delivery','customer-success-reporting-renewal','executive-command-operating-cadence','finance-control-commercial-events','operations-administration-vendor-control','product-offer-template-evolution','technology-integrations-automation-control','legal-obligations-rights-compliance','brand-media-proof-distribution')
  AND module_ids = '[]'::jsonb;

UPDATE eos_capability_instances SET module_ids = CASE capability_key
  WHEN 'executive-assistance' THEN '[8]'::jsonb
  WHEN 'creator-operations' THEN '[10,14]'::jsonb
  WHEN 'content-strategy' THEN '[11,14]'::jsonb
  WHEN 'brand-intelligence' THEN '[14]'::jsonb
  WHEN 'content-production' THEN '[6,14]'::jsonb
  WHEN 'post-production' THEN '[6,14]'::jsonb
  WHEN 'distribution-publication' THEN '[14]'::jsonb
  WHEN 'rights-confidentiality' THEN '[13,14]'::jsonb
  WHEN 'audience-performance-learning' THEN '[7,11,14]'::jsonb
  WHEN 'brand-monetization' THEN '[2,3,14]'::jsonb
  WHEN 'shared-service-procurement' THEN '[10,12]'::jsonb
  ELSE module_ids END
WHERE capability_key IN ('executive-assistance','creator-operations','content-strategy','brand-intelligence','content-production','post-production','distribution-publication','rights-confidentiality','audience-performance-learning','brand-monetization','shared-service-procurement')
  AND module_ids = '[]'::jsonb;

CREATE OR REPLACE FUNCTION eos_valid_capability_module_ids(value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE item jsonb; number_value numeric;
BEGIN
  IF jsonb_typeof(value) <> 'array' OR jsonb_array_length(value) > 14 THEN RETURN false; END IF;
  FOR item IN SELECT value_item FROM jsonb_array_elements(value) AS values_table(value_item) LOOP
    IF jsonb_typeof(item) <> 'number' THEN RETURN false; END IF;
    number_value := (item #>> '{}')::numeric;
    IF number_value <> trunc(number_value) OR number_value < 1 OR number_value > 14 THEN RETURN false; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(value) AS values_table(value_item) GROUP BY value_item HAVING count(*) > 1) THEN RETURN false; END IF;
  RETURN true;
END $$;

ALTER TABLE eos_capability_instances
  DROP CONSTRAINT IF EXISTS eos_capability_instances_modules_check,
  ADD CONSTRAINT eos_capability_instances_modules_check CHECK (eos_valid_capability_module_ids(module_ids));

CREATE INDEX IF NOT EXISTS eos_capability_instances_modules_idx
  ON eos_capability_instances USING gin(module_ids jsonb_path_ops);
