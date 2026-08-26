ALTER TABLE eos_authority_grants ADD COLUMN IF NOT EXISTS effect text NOT NULL DEFAULT 'allow';
ALTER TABLE eos_authority_grants ADD COLUMN IF NOT EXISTS condition_rules jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE eos_authority_grants ADD COLUMN IF NOT EXISTS approval_policy jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE eos_authority_grants ADD COLUMN IF NOT EXISTS separation_of_duties jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE eos_authority_grants ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz;
ALTER TABLE eos_authority_grants ADD COLUMN IF NOT EXISTS reviewed_by_user_id text REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE eos_authority_grants ALTER COLUMN schema_version SET DEFAULT 'authority-grant-v1.1';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'eos_authority_grants_effect_check') THEN
    ALTER TABLE eos_authority_grants ADD CONSTRAINT eos_authority_grants_effect_check CHECK (effect IN ('allow', 'deny'));
  END IF;
END $$;

UPDATE eos_authority_grants
SET last_reviewed_at = COALESCE(last_reviewed_at, created_at),
    reviewed_by_user_id = COALESCE(reviewed_by_user_id, created_by_user_id),
    review_at = COALESCE(review_at, created_at + interval '90 days'),
    schema_version = 'authority-grant-v1.1'
WHERE state = 'active';

UPDATE eos_authority_grants g
SET ceiling_threshold = COALESCE(g.ceiling_threshold, '{}'::jsonb) || jsonb_build_object('consequence', CASE
      WHEN s.kind = 'founder' THEN 'emergency'
      WHEN s.kind = 'company_ceo' THEN 'irreversible'
      WHEN s.kind IN ('portfolio_executive', 'functional_executive', 'manager') THEN 'material'
      ELSE 'routine' END),
    approval_policy = jsonb_build_object(
      'minimumApprovals', 0,
      'approverSeatIds', '[]'::jsonb,
      'approverAuthorityClasses', jsonb_build_array('approve'),
      'disallowRequester', true,
      'requireDistinctPrincipals', true,
      'requireDistinctSeats', false
    ),
    separation_of_duties = CASE WHEN s.kind IN ('founder', 'portfolio_executive', 'company_ceo', 'functional_executive', 'manager')
      THEN jsonb_build_array(jsonb_build_object('authorityClass', 'approve', 'distinctFrom', jsonb_build_array('initiator'), 'requireDistinctSeat', false))
      ELSE '[]'::jsonb END
FROM eos_seats s
WHERE g.seat_id = s.id AND g.authority_key LIKE 'seat:%:baseline';

CREATE TABLE IF NOT EXISTS eos_policy_decisions (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  principal_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  evaluated_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  authority_class text NOT NULL,
  resource text NOT NULL,
  action_key text,
  purpose text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome text NOT NULL,
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  matched_grant_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  satisfied_grant_id text REFERENCES eos_authority_grants(id) ON DELETE SET NULL,
  requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  trace_id text NOT NULL,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_policy_decisions_authority_class_check CHECK (authority_class IN ('view', 'recommend', 'execute', 'decide', 'approve', 'spend', 'sign', 'grant_access', 'delegate', 'override_emergency')),
  CONSTRAINT eos_policy_decisions_outcome_check CHECK (outcome IN ('permit', 'deny', 'require_approval', 'require_evidence', 'transform_minimize', 'escalate'))
);
CREATE INDEX IF NOT EXISTS eos_policy_decisions_company_created_idx ON eos_policy_decisions (company_id, created_at);
CREATE INDEX IF NOT EXISTS eos_policy_decisions_principal_created_idx ON eos_policy_decisions (principal_user_id, created_at);
CREATE INDEX IF NOT EXISTS eos_policy_decisions_outcome_created_idx ON eos_policy_decisions (outcome, created_at);

CREATE OR REPLACE FUNCTION prevent_eos_policy_decision_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'EOS policy decision history is immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eos_policy_decisions_immutable ON eos_policy_decisions;
CREATE TRIGGER eos_policy_decisions_immutable
  BEFORE UPDATE OR DELETE ON eos_policy_decisions
  FOR EACH ROW EXECUTE FUNCTION prevent_eos_policy_decision_mutation();
