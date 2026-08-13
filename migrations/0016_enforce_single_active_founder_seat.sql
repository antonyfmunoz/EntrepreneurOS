CREATE TEMP TABLE eos_founder_seat_merge ON COMMIT DROP AS
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
SET supervisor_seat_id = merge.canonical_id
FROM eos_founder_seat_merge AS merge
WHERE seat.supervisor_seat_id = merge.duplicate_id;

UPDATE eos_memberships AS membership
SET seat_id = merge.canonical_id
FROM eos_founder_seat_merge AS merge
WHERE membership.seat_id = merge.duplicate_id;

UPDATE eos_work_packets AS packet
SET accountable_seat_id = merge.canonical_id
FROM eos_founder_seat_merge AS merge
WHERE packet.accountable_seat_id = merge.duplicate_id;

UPDATE eos_approval_requests AS approval
SET assigned_to_seat_id = merge.canonical_id
FROM eos_founder_seat_merge AS merge
WHERE approval.assigned_to_seat_id = merge.duplicate_id;

UPDATE eos_communication_messages AS message
SET sender_seat_id = merge.canonical_id
FROM eos_founder_seat_merge AS merge
WHERE message.sender_seat_id = merge.duplicate_id;

CREATE TEMP TABLE eos_founder_conversation_merge ON COMMIT DROP AS
WITH founder_seat_map AS (
  SELECT duplicate_id AS seat_id, canonical_id FROM eos_founder_seat_merge
  UNION
  SELECT canonical_id AS seat_id, canonical_id FROM eos_founder_seat_merge
), ranked AS (
  SELECT
    conversation.id,
    seat_map.canonical_id AS canonical_seat_id,
    first_value(conversation.id) OVER (
      PARTITION BY conversation.company_id, conversation.channel_type
      ORDER BY CASE WHEN conversation.seat_id = seat_map.canonical_id THEN 0 ELSE 1 END, conversation.created_at NULLS LAST, conversation.id
    ) AS canonical_conversation_id,
    row_number() OVER (
      PARTITION BY conversation.company_id, conversation.channel_type
      ORDER BY CASE WHEN conversation.seat_id = seat_map.canonical_id THEN 0 ELSE 1 END, conversation.created_at NULLS LAST, conversation.id
    ) AS conversation_rank
  FROM eos_conversations AS conversation
  JOIN founder_seat_map AS seat_map ON seat_map.seat_id = conversation.seat_id
)
SELECT id AS duplicate_conversation_id, canonical_conversation_id, canonical_seat_id
FROM ranked
WHERE conversation_rank > 1;

UPDATE eos_communication_messages AS message
SET conversation_id = merge.canonical_conversation_id
FROM eos_founder_conversation_merge AS merge
WHERE message.conversation_id = merge.duplicate_conversation_id;

UPDATE eos_advisor_consultations AS consultation
SET conversation_id = merge.canonical_conversation_id
FROM eos_founder_conversation_merge AS merge
WHERE consultation.conversation_id = merge.duplicate_conversation_id;

DELETE FROM eos_conversations AS conversation
USING eos_founder_conversation_merge AS merge
WHERE conversation.id = merge.duplicate_conversation_id;

UPDATE eos_conversations AS conversation
SET seat_id = merge.canonical_id
FROM eos_founder_seat_merge AS merge
WHERE conversation.seat_id = merge.duplicate_id;

DELETE FROM eos_seats AS seat
USING eos_founder_seat_merge AS merge
WHERE seat.id = merge.duplicate_id;

CREATE UNIQUE INDEX IF NOT EXISTS eos_seats_one_active_founder_per_company_idx
  ON eos_seats (company_id)
  WHERE kind = 'founder' AND status = 'active';
