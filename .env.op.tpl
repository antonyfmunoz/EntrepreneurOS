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
NOTION_API_KEY=op://UMH-Production/Notion-Integration/api_key
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
