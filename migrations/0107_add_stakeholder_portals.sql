CREATE TABLE IF NOT EXISTS eos_stakeholder_portals (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portal_key text NOT NULL, name text NOT NULL, portal_type text NOT NULL,
  stakeholder_id text REFERENCES eos_stakeholders(id) ON DELETE RESTRICT, state text NOT NULL DEFAULT 'dormant',
  visible_sections jsonb NOT NULL DEFAULT '[]'::jsonb, activation_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  activation_evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb, owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  activated_by_user_id text REFERENCES users(id) ON DELETE RESTRICT, activated_at timestamptz,
  version integer NOT NULL DEFAULT 1, recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_stakeholder_portals_type_check CHECK (portal_type IN ('client','board','advisor','investor','capital','partner')),
  CONSTRAINT eos_stakeholder_portals_state_check CHECK (state IN ('dormant','configuring','active','paused','retired')),
  CONSTRAINT eos_stakeholder_portals_arrays_check CHECK (jsonb_typeof(visible_sections) = 'array' AND jsonb_typeof(activation_requirements) = 'array' AND jsonb_typeof(activation_evidence_ids) = 'array'),
  CONSTRAINT eos_stakeholder_portals_activation_check CHECK ((state = 'active' AND activated_by_user_id IS NOT NULL AND activated_at IS NOT NULL) OR state <> 'active'),
  CONSTRAINT eos_stakeholder_portals_version_check CHECK (version > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_stakeholder_portals_company_key_idx ON eos_stakeholder_portals(company_id, portal_key);
CREATE INDEX IF NOT EXISTS eos_stakeholder_portals_company_state_idx ON eos_stakeholder_portals(company_id, portal_type, state);

CREATE TABLE IF NOT EXISTS eos_stakeholder_portal_publications (
  id text PRIMARY KEY, portal_id text NOT NULL REFERENCES eos_stakeholder_portals(id) ON DELETE CASCADE,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE, section text NOT NULL, title text NOT NULL, body text NOT NULL,
  data_projection jsonb NOT NULL DEFAULT '{}'::jsonb, evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  state text NOT NULL DEFAULT 'draft', version integer NOT NULL DEFAULT 1,
  published_by_user_id text REFERENCES users(id) ON DELETE RESTRICT, published_at timestamptz,
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_stakeholder_portal_publications_state_check CHECK (state IN ('draft','published','withdrawn')),
  CONSTRAINT eos_stakeholder_portal_publications_evidence_array_check CHECK (jsonb_typeof(evidence_ids) = 'array'),
  CONSTRAINT eos_stakeholder_portal_publications_publish_check CHECK ((state = 'published' AND published_by_user_id IS NOT NULL AND published_at IS NOT NULL AND jsonb_array_length(evidence_ids) > 0) OR state <> 'published')
);
CREATE INDEX IF NOT EXISTS eos_stakeholder_portal_publications_portal_state_idx ON eos_stakeholder_portal_publications(portal_id, state, updated_at);

CREATE TABLE IF NOT EXISTS eos_stakeholder_portal_access_grants (
  id text PRIMARY KEY, portal_id text NOT NULL REFERENCES eos_stakeholder_portals(id) ON DELETE CASCADE,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE, recipient_label text NOT NULL,
  recipient_identity_hash text NOT NULL, token_hash text NOT NULL, state text NOT NULL DEFAULT 'issued',
  expires_at timestamptz NOT NULL, last_accessed_at timestamptz, access_count integer NOT NULL DEFAULT 0,
  revoked_at timestamptz, issued_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_stakeholder_portal_access_state_check CHECK (state IN ('issued','accessed','revoked','expired')),
  CONSTRAINT eos_stakeholder_portal_access_hash_check CHECK (recipient_identity_hash ~ '^[0-9a-f]{64}$' AND token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT eos_stakeholder_portal_access_count_check CHECK (access_count >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS eos_stakeholder_portal_access_token_idx ON eos_stakeholder_portal_access_grants(token_hash);
CREATE INDEX IF NOT EXISTS eos_stakeholder_portal_access_portal_state_idx ON eos_stakeholder_portal_access_grants(portal_id, state, expires_at);

CREATE OR REPLACE FUNCTION eos_portal_publication_immutable_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state = 'published' AND (NEW.body IS DISTINCT FROM OLD.body OR NEW.title IS DISTINCT FROM OLD.title OR NEW.data_projection IS DISTINCT FROM OLD.data_projection OR NEW.evidence_ids IS DISTINCT FROM OLD.evidence_ids) THEN
    RAISE EXCEPTION 'published stakeholder content is immutable; withdraw and create a new version';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS eos_portal_publication_immutable_guard_trigger ON eos_stakeholder_portal_publications;
CREATE TRIGGER eos_portal_publication_immutable_guard_trigger BEFORE UPDATE ON eos_stakeholder_portal_publications FOR EACH ROW EXECUTE FUNCTION eos_portal_publication_immutable_guard();
