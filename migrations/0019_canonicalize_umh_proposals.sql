ALTER TABLE umh_commands
  ADD COLUMN IF NOT EXISTS work_packet_id text REFERENCES eos_work_packets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_id text REFERENCES eos_approval_requests(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS umh_commands_work_packet_unique
  ON umh_commands(work_packet_id)
  WHERE work_packet_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS umh_commands_approval_unique
  ON umh_commands(approval_id)
  WHERE approval_id IS NOT NULL;

COMMENT ON COLUMN umh_commands.work_packet_id IS
  'Canonical EOS Work Packet created for a federated proposal. Legacy agent_actions are not used.';

COMMENT ON COLUMN umh_commands.approval_id IS
  'Canonical local approval that governs the federated proposal.';
