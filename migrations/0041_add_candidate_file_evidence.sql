ALTER TABLE eos_talent_candidate_evidence
  ADD COLUMN IF NOT EXISTS file_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS file_mime_type text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS file_size_bytes integer,
  ADD COLUMN IF NOT EXISTS content_sha256 text,
  ADD COLUMN IF NOT EXISTS storage_provider text,
  ADD COLUMN IF NOT EXISTS storage_key text,
  ADD COLUMN IF NOT EXISTS scan_state text NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS scan_engine text,
  ADD COLUMN IF NOT EXISTS scan_completed_at timestamptz;

ALTER TABLE eos_talent_candidate_evidence
  DROP CONSTRAINT IF EXISTS eos_talent_candidate_evidence_type_check,
  ADD CONSTRAINT eos_talent_candidate_evidence_type_check CHECK (evidence_type IN ('portfolio_link','resume_link','work_sample_link','reference_link','candidate_statement','other_link','portfolio_file','resume_file','work_sample_file','assessment_file','other_file')),
  DROP CONSTRAINT IF EXISTS eos_talent_candidate_evidence_payload_check,
  ADD CONSTRAINT eos_talent_candidate_evidence_payload_check CHECK (source_url <> '' OR candidate_statement <> '' OR storage_key IS NOT NULL),
  DROP CONSTRAINT IF EXISTS eos_talent_candidate_evidence_file_metadata_check,
  ADD CONSTRAINT eos_talent_candidate_evidence_file_metadata_check CHECK (
    storage_key IS NULL OR (
      storage_provider IS NOT NULL AND file_name <> '' AND file_mime_type <> '' AND
      file_size_bytes BETWEEN 1 AND 10485760 AND content_sha256 ~ '^[a-f0-9]{64}$'
    )
  ),
  DROP CONSTRAINT IF EXISTS eos_talent_candidate_evidence_scan_state_check,
  ADD CONSTRAINT eos_talent_candidate_evidence_scan_state_check CHECK (scan_state IN ('not_applicable','pending','clean','infected','failed'));

CREATE INDEX IF NOT EXISTS eos_talent_candidate_evidence_scan_idx
  ON eos_talent_candidate_evidence (company_id, scan_state, updated_at);
