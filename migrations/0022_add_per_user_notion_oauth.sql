-- Public provider OAuth credentials belong to exactly one EOS user/provider
-- pair. Repair any legacy duplicates before enforcing the invariant.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, provider
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
         ) AS duplicate_rank
  FROM oauth_tokens
)
DELETE FROM oauth_tokens
WHERE id IN (SELECT id FROM ranked WHERE duplicate_rank > 1);

ALTER TABLE oauth_tokens
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS oauth_tokens_user_provider_idx
  ON oauth_tokens (user_id, provider);
