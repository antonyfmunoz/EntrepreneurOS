-- Native outreach is a company-scoped planning and outcome ledger. It does
-- not grant telephony access or create provider-side calls.
CREATE TABLE IF NOT EXISTS eos_outreach_sequences (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  sequence_key text NOT NULL,
  title text NOT NULL,
  relationship_id text NOT NULL REFERENCES eos_stakeholder_relationships(id) ON DELETE RESTRICT,
  commercial_case_id text REFERENCES eos_commercial_cases(id) ON DELETE SET NULL,
  channel text NOT NULL,
  state text NOT NULL DEFAULT 'draft',
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  purpose text NOT NULL,
  script text NOT NULL DEFAULT '',
  consent_basis text NOT NULL,
  quiet_hours text NOT NULL DEFAULT '',
  cadence text NOT NULL DEFAULT '',
  next_attempt_at timestamptz,
  evidence_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_authority text NOT NULL DEFAULT 'native_eos',
  classification text NOT NULL DEFAULT 'internal',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_outreach_sequences_company_key UNIQUE (company_id, sequence_key),
  CONSTRAINT eos_outreach_sequences_channel_check CHECK (channel IN ('phone','email','sms','social','mixed','manual')),
  CONSTRAINT eos_outreach_sequences_state_check CHECK (state IN ('draft','active','paused','completed','cancelled')),
  CONSTRAINT eos_outreach_sequences_classification_check CHECK (classification IN ('public','internal','confidential','restricted')),
  CONSTRAINT eos_outreach_sequences_authority_check CHECK (source_authority IN ('native_eos','notion_runtime','external_authoritative','reconciled')),
  CONSTRAINT eos_outreach_sequences_evidence_check CHECK (jsonb_typeof(evidence_keys) = 'array')
);
CREATE INDEX IF NOT EXISTS eos_outreach_sequences_owner_state_idx ON eos_outreach_sequences(owner_seat_id, state);
CREATE INDEX IF NOT EXISTS eos_outreach_sequences_relationship_idx ON eos_outreach_sequences(relationship_id, updated_at);

CREATE TABLE IF NOT EXISTS eos_outreach_attempts (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sequence_id text NOT NULL REFERENCES eos_outreach_sequences(id) ON DELETE CASCADE,
  owner_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  outcome text NOT NULL,
  note text NOT NULL DEFAULT '',
  attempted_at timestamptz NOT NULL,
  next_attempt_at timestamptz,
  provider_receipt_reference text NOT NULL DEFAULT '',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_outreach_attempts_outcome_check CHECK (outcome IN ('planned','no_answer','voicemail','reached','meeting_booked','follow_up','not_interested','do_not_contact','invalid_contact'))
);
CREATE INDEX IF NOT EXISTS eos_outreach_attempts_sequence_created_idx ON eos_outreach_attempts(sequence_id, created_at);
CREATE INDEX IF NOT EXISTS eos_outreach_attempts_company_owner_idx ON eos_outreach_attempts(company_id, owner_seat_id, created_at);
