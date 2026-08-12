ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "founder_profile" jsonb NOT NULL DEFAULT '{}'::jsonb;
