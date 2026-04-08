-- Enhancement schema migration: skill enrichment + DESIGN.md storage
-- Idempotent: safe to re-run.

-- Persist component direction across token revisions so design intent
-- (e.g. "futuristic neumorphic") survives page-to-page generation.
ALTER TABLE dm_tokens ADD COLUMN IF NOT EXISTS component_direction TEXT;

-- DESIGN.md export storage — one row per export, immutable, versioned per project.
CREATE TABLE IF NOT EXISTS dm_design_md (
  id SERIAL PRIMARY KEY,
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  exported_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_md_project_version
  ON dm_design_md(project_id, version DESC);
