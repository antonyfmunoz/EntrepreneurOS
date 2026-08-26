ALTER TABLE eos_agent_schedules
  ADD COLUMN IF NOT EXISTS activation_policy_decision_id text REFERENCES eos_policy_decisions(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS eos_agent_schedules_activation_policy_idx
  ON eos_agent_schedules(activation_policy_decision_id)
  WHERE state = 'active';
