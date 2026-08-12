CREATE TABLE IF NOT EXISTS legal_documents (
  id text PRIMARY KEY,
  document_type text NOT NULL CHECK (document_type IN ('terms', 'privacy', 'acceptable_use', 'cookie', 'dpa')),
  title text NOT NULL,
  version text NOT NULL,
  url text NOT NULL,
  checksum text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'superseded', 'withdrawn')),
  effective_at timestamptz NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_type, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS legal_documents_one_current_type_idx
  ON legal_documents (document_type) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS legal_acceptances (
  id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES legal_documents(id),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_checksum text NOT NULL,
  ip_hash text NOT NULL,
  user_agent_hash text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, user_id)
);
