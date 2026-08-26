-- Existing baseline seat grants receive the same higher-order disclosure rules
-- used for newly compiled seats. These rules never expose more data: they only
-- describe deterministic minimization when a read exceeds the seat ceiling.
ALTER TABLE eos_authority_grants ALTER COLUMN schema_version SET DEFAULT 'authority-grant-v1.2';

UPDATE eos_authority_grants
SET ceiling_threshold = COALESCE(ceiling_threshold, '{}'::jsonb) || jsonb_build_object(
  'fieldTransformRules',
  jsonb_build_array(
    jsonb_build_object('path', '/authoritySubjects', 'action', 'omit', 'purposes', jsonb_build_array('administer_organization_registry'), 'outputClassification', 'public'),
    jsonb_build_object('path', '/authoritySubjects/*/identityAttributes/credentialReference', 'action', 'omit', 'purposes', jsonb_build_array('administer_organization_registry'), 'outputClassification', 'public'),
    jsonb_build_object('path', '/authoritySubjects/*/externalIdentityKey', 'action', 'redact', 'purposes', jsonb_build_array('administer_organization_registry'), 'outputClassification', 'public'),
    jsonb_build_object('path', '/authoritySubjects/*/evidenceReferences', 'action', 'omit', 'purposes', jsonb_build_array('administer_organization_registry'), 'outputClassification', 'public'),
    jsonb_build_object('path', '/authoritySubjects/*/governanceContract', 'action', 'omit', 'purposes', jsonb_build_array('administer_organization_registry'), 'outputClassification', 'public'),
    jsonb_build_object('path', '/authoritySubjects/*/identityAttributes/memoryScope', 'action', 'omit', 'purposes', jsonb_build_array('administer_organization_registry'), 'outputClassification', 'public'),
    jsonb_build_object('path', '/authoritySubjects/*/identityAttributes/memberPrincipalIds', 'action', 'omit', 'purposes', jsonb_build_array('administer_organization_registry'), 'outputClassification', 'public'),
    jsonb_build_object('path', '/authoritySubjects/*/identityAttributes/externalAccountReference', 'action', 'redact', 'purposes', jsonb_build_array('administer_organization_registry'), 'outputClassification', 'public'),
    jsonb_build_object('path', '/authoritySubjects/*/identityAttributes/providerSystemKeys', 'action', 'omit', 'purposes', jsonb_build_array('administer_organization_registry'), 'outputClassification', 'public')
  )
),
schema_version = 'authority-grant-v1.2',
updated_at = now()
WHERE grantee_type = 'seat'
  AND authority_key LIKE 'seat:%:baseline'
  AND state IN ('active', 'suspended');
