-- Founder-originated work has no higher organizational principal to satisfy a
-- blanket initiator/approver separation rule. Keep explicit approval records,
-- policy decisions, and audit receipts, while allowing the founder to decide
-- approvals assigned to the founder seat. Non-founder baseline grants retain
-- their upward separation-of-duties boundary.
UPDATE eos_authority_grants
SET
  separation_of_duties = '[]'::jsonb,
  updated_at = now()
WHERE capability_key = 'founder'
  AND policy_decision_source = 'native_default_role_policy_v1'
  AND authority_key LIKE 'seat:%:baseline';
