# Managed by 1Password (WP-P4-SECRETS-001). Load with: op run --env-file=.env.op.tpl -- <cmd>
# Real secrets live in the 'EntrepreneurOS' 1Password vault. NO plaintext values here.
DATABASE_URL=op://EntrepreneurOS/Development/DATABASE_URL
GEMINI_API_KEY=op://EntrepreneurOS/Development/GEMINI_API_KEY
SESSION_SECRET=op://EntrepreneurOS/Development/SESSION_SECRET
ANTHROPIC_API_KEY=op://EntrepreneurOS/Development/ANTHROPIC_API_KEY
OPENAI_API_KEY=op://EntrepreneurOS/Development/OPENAI_API_KEY
STITCH_API_KEY=op://EntrepreneurOS/Development/STITCH_API_KEY
STITCH_PROJECT_ID=op://EntrepreneurOS/Development/STITCH_PROJECT_ID
VITE_POSTHOG_API_KEY=op://EntrepreneurOS/Development/VITE_POSTHOG_API_KEY
POSTHOG_API_KEY=op://EntrepreneurOS/Development/VITE_POSTHOG_API_KEY
VITE_CLERK_PUBLISHABLE_KEY=op://EntrepreneurOS/Development/VITE_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY=op://EntrepreneurOS/Development/CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY=op://EntrepreneurOS/Development/CLERK_PUBLISHABLE_KEY
# Base64-encoded 32-byte AES key used only to envelope-encrypt provider tokens
# before persistence. Rotation requires a controlled credential rewrap.
EOS_CREDENTIAL_ENCRYPTION_KEY=op://EntrepreneurOS/Development/EOS_CREDENTIAL_ENCRYPTION_KEY

# External provider credentials. Google OAuth is user-authorized in EOS; the
# shared refresh token is available only for a controlled one-time owner import.
GOOGLE_CLIENT_ID=op://UMH-Production/Google-Workspace-OAuth/client_id
GOOGLE_CLIENT_SECRET=op://UMH-Production/Google-Workspace-OAuth/client_secret
GOOGLE_WORKSPACE_REFRESH_TOKEN=op://UMH-Production/Google-Workspace-OAuth/refresh_token
GOOGLE_REDIRECT_URI=https://entrepreneuros.net/api/auth/google/callback
NOTION_CLIENT_ID=op://EntrepreneurOS/Development/NOTION_CLIENT_ID
NOTION_CLIENT_SECRET=op://EntrepreneurOS/Development/NOTION_CLIENT_SECRET
NOTION_REDIRECT_URI=https://entrepreneuros.net/api/auth/notion/callback
# Projection-owned UMH federation. Leave UMH_FEDERATION_ENABLED false until a
# local installation row and the corresponding UMH public signing key exist.
UMH_FEDERATION_ENABLED=false
UMH_INSTALLATION_ID=
UMH_ISSUER=
UMH_COMMAND_PUBLIC_KEY_PEM=
# The projection signs its own immutable outbox events; the private key remains
# in EntrepreneurOS secrets and is never sent to UMH.
UMH_EVENT_ENDPOINT=
EOS_EVENT_PRIVATE_KEY_PEM=

# Paid SaaS activation. These references may remain absent until pricing,
# customer terms, tax registrations, and the production Stripe account are approved.
# STRIPE_RESTRICTED_KEY=op://EntrepreneurOS/Production/STRIPE_RESTRICTED_KEY
# STRIPE_WEBHOOK_SECRET=op://EntrepreneurOS/Production/STRIPE_WEBHOOK_SECRET
# EOS_STRIPE_PLANS=op://EntrepreneurOS/Production/EOS_STRIPE_PLANS
# JSON object keyed by the exact DocuSign/Stripe Integration Binding UUID. Each
# value is a secret string or rotation array. The referenced 1Password field
# contains the JSON value; EOS stores neither the provider secrets nor payloads.
# EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS=op://EntrepreneurOS/Development/EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS
# Provider issuance/compensation is separately kill-switched. The JSON map is
# keyed by Integration Binding UUID or its credentialReference. Keep false until
# counsel authority, exact accounts, callbacks, and recovery drills are qualified.
EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED=false
# Generic Systems control-center dispatch remains separately kill-switched.
# When enabled, EOS still executes only the audited Gmail/Notion allowlist and
# requires each operator's encrypted OAuth authorization.
EOS_INTEGRATION_PROVIDER_EFFECTS_ENABLED=false
EOS_PROVIDER_INGRESS_WORKER_INTERVAL_MS=60000
EOS_INTEGRATION_DISPATCH_RECOVERY_AFTER_MS=300000
EOS_INTEGRATION_DISPATCH_RECOVERY_INTERVAL_MS=60000
# EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS=op://EntrepreneurOS/Development/EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS
EOS_PUBLIC_ORIGIN=https://entrepreneuros.net
