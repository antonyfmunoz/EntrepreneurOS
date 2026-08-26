CREATE TABLE IF NOT EXISTS eos_workforce_review_dialogue (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  review_id text NOT NULL REFERENCES eos_workforce_reviews(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  author_seat_id text NOT NULL REFERENCES eos_seats(id) ON DELETE RESTRICT,
  response_type text NOT NULL,
  body text NOT NULL,
  correction_decision text NOT NULL DEFAULT '',
  recorded_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eos_workforce_review_dialogue_type_check CHECK (
    response_type IN ('employee_response', 'correction_request', 'manager_response', 'correction_resolution')
  ),
  CONSTRAINT eos_workforce_review_dialogue_decision_check CHECK (
    (response_type = 'correction_resolution' AND correction_decision IN ('resolved', 'rejected'))
    OR (response_type <> 'correction_resolution' AND correction_decision = '')
  ),
  CONSTRAINT eos_workforce_review_dialogue_body_check CHECK (length(trim(body)) >= 3),
  CONSTRAINT eos_workforce_review_dialogue_sequence_check CHECK (sequence > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS eos_workforce_review_dialogue_review_sequence_idx
  ON eos_workforce_review_dialogue(review_id, sequence);

CREATE INDEX IF NOT EXISTS eos_workforce_review_dialogue_review_created_idx
  ON eos_workforce_review_dialogue(review_id, created_at);

CREATE INDEX IF NOT EXISTS eos_workforce_review_dialogue_company_created_idx
  ON eos_workforce_review_dialogue(company_id, created_at);

CREATE OR REPLACE FUNCTION eos_protect_workforce_review_dialogue()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Workforce review dialogue is append-only' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS eos_workforce_review_dialogue_append_only ON eos_workforce_review_dialogue;
CREATE TRIGGER eos_workforce_review_dialogue_append_only
  BEFORE UPDATE OR DELETE ON eos_workforce_review_dialogue
  FOR EACH ROW EXECUTE FUNCTION eos_protect_workforce_review_dialogue();

COMMENT ON TABLE eos_workforce_review_dialogue IS
  'Append-only employee and manager review dialogue. Corrections preserve the original review plus the request and attributable resolution; they never silently rewrite evidence or judgment.';
