CREATE TABLE IF NOT EXISTS "umh_identity_bindings" (
  "id" text PRIMARY KEY NOT NULL,
  "installation_id" text NOT NULL REFERENCES "umh_installations"("id") ON DELETE CASCADE,
  "external_actor_id" text NOT NULL,
  "local_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "delegation_id" text NOT NULL,
  "company_id" integer NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "umh_identity_binding_unique_idx"
  ON "umh_identity_bindings" ("installation_id", "external_actor_id", "delegation_id", "company_id");
CREATE INDEX IF NOT EXISTS "umh_identity_binding_local_idx"
  ON "umh_identity_bindings" ("local_user_id", "company_id", "enabled");
