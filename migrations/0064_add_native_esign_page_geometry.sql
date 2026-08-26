-- Persist the immutable source PDF page count so authored normalized fields can
-- be validated against the exact document version before registration.

ALTER TABLE eos_esign_document_versions
  ADD COLUMN IF NOT EXISTS page_count integer NOT NULL DEFAULT 1;

ALTER TABLE eos_esign_document_versions
  DROP CONSTRAINT IF EXISTS eos_esign_document_version_page_count_check;

ALTER TABLE eos_esign_document_versions
  ADD CONSTRAINT eos_esign_document_version_page_count_check
  CHECK (page_count BETWEEN 1 AND 2000);
