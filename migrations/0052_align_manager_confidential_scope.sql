-- Manager workspaces include governed Talent and may contain confidential
-- reporting-tree records. Align only EOS-generated manager policy; explicit
-- membership and assignment ceilings remain administrator-controlled.
UPDATE eos_authority_grants
SET
  ceiling_threshold = jsonb_set(
    COALESCE(ceiling_threshold, '{}'::jsonb),
    '{classification}',
    '"confidential"'::jsonb,
    true
  ),
  updated_at = now()
WHERE capability_key = 'manager'
  AND policy_decision_source = 'native_default_role_policy_v1'
  AND authority_key LIKE 'seat:%:baseline';

UPDATE eos_authority_subjects
SET
  classification_ceiling = 'confidential',
  updated_at = now()
WHERE agent_class = 'role_agent'
  AND seat_id IN (
    SELECT id
    FROM eos_seats
    WHERE kind = 'manager'
  )
  AND source_authority = 'native_seat_runtime_v1';
