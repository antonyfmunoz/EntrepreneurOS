CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id text PRIMARY KEY,
  ticket_id text NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_user_id text REFERENCES users(id) ON DELETE SET NULL,
  author_kind text NOT NULL CHECK (author_kind IN ('customer', 'support')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_created_idx
  ON support_ticket_messages (ticket_id, created_at ASC);

INSERT INTO support_ticket_messages (id, ticket_id, author_user_id, author_kind, body, request_id, created_at)
SELECT 'support_initial_' || id, id, user_id, 'customer', message, request_id, created_at
FROM support_tickets
ON CONFLICT (id) DO NOTHING;
