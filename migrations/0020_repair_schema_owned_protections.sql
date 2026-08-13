-- Repair production protections that an older Drizzle schema could remove
-- after their checksum migrations were already recorded as applied.
CREATE TABLE IF NOT EXISTS eos_rate_limit_windows (
  namespace text NOT NULL,
  identity_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (namespace, identity_hash, window_start)
);

CREATE INDEX IF NOT EXISTS eos_rate_limit_windows_expires_at_idx
  ON eos_rate_limit_windows (expires_at);

CREATE TEMP TABLE eos_founder_seat_repair ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    company_id,
    first_value(id) OVER (PARTITION BY company_id ORDER BY created_at NULLS LAST, id) AS canonical_id,
    row_number() OVER (PARTITION BY company_id ORDER BY created_at NULLS LAST, id) AS seat_rank
  FROM eos_seats
  WHERE kind = 'founder' AND status = 'active'
)
SELECT id AS duplicate_id, canonical_id, company_id
FROM ranked
WHERE seat_rank > 1;

UPDATE eos_seats AS seat
SET supervisor_seat_id = repair.canonical_id
FROM eos_founder_seat_repair AS repair
WHERE seat.supervisor_seat_id = repair.duplicate_id;

UPDATE eos_memberships AS membership
SET seat_id = repair.canonical_id
FROM eos_founder_seat_repair AS repair
WHERE membership.seat_id = repair.duplicate_id;

UPDATE eos_work_packets AS packet
SET accountable_seat_id = repair.canonical_id
FROM eos_founder_seat_repair AS repair
WHERE packet.accountable_seat_id = repair.duplicate_id;

UPDATE eos_approval_requests AS approval
SET assigned_to_seat_id = repair.canonical_id
FROM eos_founder_seat_repair AS repair
WHERE approval.assigned_to_seat_id = repair.duplicate_id;

UPDATE eos_communication_messages AS message
SET sender_seat_id = repair.canonical_id
FROM eos_founder_seat_repair AS repair
WHERE message.sender_seat_id = repair.duplicate_id;

CREATE TEMP TABLE eos_founder_conversation_repair ON COMMIT DROP AS
WITH founder_seat_map AS (
  SELECT duplicate_id AS seat_id, canonical_id FROM eos_founder_seat_repair
  UNION
  SELECT canonical_id AS seat_id, canonical_id FROM eos_founder_seat_repair
), ranked AS (
  SELECT
    conversation.id,
    seat_map.canonical_id AS canonical_seat_id,
    first_value(conversation.id) OVER (
      PARTITION BY conversation.company_id, conversation.channel_type
      ORDER BY CASE WHEN conversation.seat_id = seat_map.canonical_id THEN 0 ELSE 1 END,
        conversation.created_at NULLS LAST,
        conversation.id
    ) AS canonical_conversation_id,
    row_number() OVER (
      PARTITION BY conversation.company_id, conversation.channel_type
      ORDER BY CASE WHEN conversation.seat_id = seat_map.canonical_id THEN 0 ELSE 1 END,
        conversation.created_at NULLS LAST,
        conversation.id
    ) AS conversation_rank
  FROM eos_conversations AS conversation
  JOIN founder_seat_map AS seat_map ON seat_map.seat_id = conversation.seat_id
)
SELECT id AS duplicate_conversation_id, canonical_conversation_id, canonical_seat_id
FROM ranked
WHERE conversation_rank > 1;

UPDATE eos_communication_messages AS message
SET conversation_id = repair.canonical_conversation_id
FROM eos_founder_conversation_repair AS repair
WHERE message.conversation_id = repair.duplicate_conversation_id;

UPDATE eos_advisor_consultations AS consultation
SET conversation_id = repair.canonical_conversation_id
FROM eos_founder_conversation_repair AS repair
WHERE consultation.conversation_id = repair.duplicate_conversation_id;

DELETE FROM eos_conversations AS conversation
USING eos_founder_conversation_repair AS repair
WHERE conversation.id = repair.duplicate_conversation_id;

UPDATE eos_conversations AS conversation
SET seat_id = repair.canonical_id
FROM eos_founder_seat_repair AS repair
WHERE conversation.seat_id = repair.duplicate_id;

DELETE FROM eos_seats AS seat
USING eos_founder_seat_repair AS repair
WHERE seat.id = repair.duplicate_id;

CREATE UNIQUE INDEX IF NOT EXISTS eos_seats_one_active_founder_per_company_idx
  ON eos_seats (company_id)
  WHERE kind = 'founder' AND status = 'active';
