# Managed by 1Password (WP-P4-SECRETS-001). Load with: op run --env-file=.env.op.tpl -- <cmd>
# Real secrets live in the 'EntrepreneurOS' 1Password vault. NO plaintext values here.
DATABASE_URL=op://EntrepreneurOS/Production/DATABASE_URL
SESSION_SECRET=op://EntrepreneurOS/Production/SESSION_SECRET
ANTHROPIC_API_KEY=op://EntrepreneurOS/Production/ANTHROPIC_API_KEY
VITE_POSTHOG_API_KEY=op://EntrepreneurOS/Production/VITE_POSTHOG_API_KEY
POSTHOG_API_KEY=op://EntrepreneurOS/Production/VITE_POSTHOG_API_KEY
VITE_CLERK_PUBLISHABLE_KEY=op://EntrepreneurOS/Production/VITE_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY=op://EntrepreneurOS/Production/CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY=op://EntrepreneurOS/Production/CLERK_PUBLISHABLE_KEY
# Base64-encoded 32-byte AES key used only to envelope-encrypt provider tokens
# before persistence. Rotation requires a controlled credential rewrap.
EOS_CREDENTIAL_ENCRYPTION_KEY=op://EntrepreneurOS/Production/EOS_CREDENTIAL_ENCRYPTION_KEY
MIGRATION_DATABASE_URL=op://EntrepreneurOS/Production/MIGRATION_DATABASE_URL

# Release binding and controlled production boundary.
EOS_PRODUCTION_ENVIRONMENT_SUBJECT=environment:entrepreneuros-production
EOS_PRODUCTION_RELEASE_BRANCH=feature/company-system
EOS_GITHUB_REPOSITORY=antonyfmunoz/EntrepreneurOS
EOS_PRODUCTION_COMPANY_ID=op://EntrepreneurOS/Production/EOS_PRODUCTION_COMPANY_ID
EOS_PRODUCTION_FORBIDDEN_COMPANY_ID=op://EntrepreneurOS/Production/EOS_PRODUCTION_FORBIDDEN_COMPANY_ID
EOS_PLATFORM_ADMIN_USER_IDS=op://EntrepreneurOS/Production/EOS_PLATFORM_ADMIN_USER_IDS
EOS_DATABASE_VENDOR_NAME=op://EntrepreneurOS/Production/EOS_DATABASE_VENDOR_NAME
EOS_DNS_VENDOR_NAME=op://EntrepreneurOS/Production/EOS_DNS_VENDOR_NAME
EOS_SECRET_VAULT_VENDOR_NAME=op://EntrepreneurOS/Production/EOS_SECRET_VAULT_VENDOR_NAME
EOS_ACCOUNT_DELETION_ENABLED=true
EOS_LEGAL_ENFORCEMENT=false
EOS_PUBLIC_PAID_SAAS=false

# Operational alerting and recovery credentials remain 1Password-managed.
EOS_ALERT_WEBHOOK_URL=op://EntrepreneurOS/Production/EOS_ALERT_WEBHOOK_URL
EOS_ALERT_WEBHOOK_SECRET=op://EntrepreneurOS/Production/EOS_ALERT_WEBHOOK_SECRET
EOS_ALERT_EMAIL_SENDER_USER_ID=op://EntrepreneurOS/Production/EOS_ALERT_EMAIL_SENDER_USER_ID
EOS_ALERT_EMAIL_SENDER_ADDRESS=op://EntrepreneurOS/Production/EOS_ALERT_EMAIL_SENDER_ADDRESS
EOS_ALERT_EMAIL_RECIPIENT=op://EntrepreneurOS/Production/EOS_ALERT_EMAIL_RECIPIENT
EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS=op://EntrepreneurOS/Production/EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS
EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS=op://EntrepreneurOS/Production/EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS

# External provider credentials. Google OAuth is user-authorized in EOS; the
# shared refresh token is available only for a controlled one-time owner import.
GOOGLE_CLIENT_ID=op://UMH-Production/Google-Workspace-OAuth/client_id
GOOGLE_CLIENT_SECRET=op://UMH-Production/Google-Workspace-OAuth/client_secret
GOOGLE_WORKSPACE_REFRESH_TOKEN=op://UMH-Production/Google-Workspace-OAuth/refresh_token
GOOGLE_REDIRECT_URI=https://entrepreneuros.net/api/auth/google/callback
NOTION_CLIENT_ID=op://EntrepreneurOS/Production/NOTION_CLIENT_ID
NOTION_CLIENT_SECRET=op://EntrepreneurOS/Production/NOTION_CLIENT_SECRET
NOTION_REDIRECT_URI=https://entrepreneuros.net/api/auth/notion/callback
# Optional company-owned QuickBooks Online OAuth. Do not enable a company
# connection until the Intuit app has this exact callback URL registered.
# QUICKBOOKS_CLIENT_ID=1Password Production QUICKBOOKS_CLIENT_ID
# QUICKBOOKS_CLIENT_SECRET=1Password Production QUICKBOOKS_CLIENT_SECRET
# QUICKBOOKS_REDIRECT_URI=https://entrepreneuros.net/api/auth/quickbooks/callback
# QUICKBOOKS_ENVIRONMENT=sandbox
# Slack authorization is tenant-scoped in EOS; this config only supplies the
# shared OAuth application identity and exact callback.
SLACK_CLIENT_ID=op://EntrepreneurOS/Production/SLACK_CLIENT_ID
SLACK_CLIENT_SECRET=op://EntrepreneurOS/Production/SLACK_CLIENT_SECRET
SLACK_REDIRECT_URI=https://entrepreneuros.net/api/auth/slack/callback
# Optional company-owned GoHighLevel OAuth. Configure a private Marketplace app
# for the exact company sub-account/location and use its generated install URL.
# GOHIGHLEVEL_CLIENT_ID=1Password Production GOHIGHLEVEL_CLIENT_ID
# GOHIGHLEVEL_CLIENT_SECRET=1Password Production GOHIGHLEVEL_CLIENT_SECRET
# GOHIGHLEVEL_INSTALLATION_URL=https://marketplace.gohighlevel.com/oauth/chooselocation?...
# GOHIGHLEVEL_REDIRECT_URI=https://localhost:5000/api/auth/gohighlevel/callback
# DocuSign is a company-scoped OAuth connection. The exact registered callback
# returns to the Systems workspace, where EOS attaches the selected DocuSign
# account under role, approval, audit, and recovery controls.
DOCUSIGN_CLIENT_ID=op://EntrepreneurOS/Production/DOCUSIGN_CLIENT_ID
DOCUSIGN_CLIENT_SECRET=op://EntrepreneurOS/Production/DOCUSIGN_CLIENT_SECRET
DOCUSIGN_REDIRECT_URI=op://EntrepreneurOS/Production/DOCUSIGN_REDIRECT_URI
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
# STRIPE_RESTRICTED_KEY=1Password Production STRIPE_RESTRICTED_KEY
# STRIPE_WEBHOOK_SECRET=1Password Production STRIPE_WEBHOOK_SECRET
# EOS_STRIPE_PLANS=1Password Production EOS_STRIPE_PLANS
# JSON object keyed by the exact DocuSign/Stripe Integration Binding UUID. Each
# value is a secret string or rotation array. The referenced 1Password field
# contains the JSON value; EOS stores neither the provider secrets nor payloads.
# Provider issuance/compensation is separately kill-switched. The JSON map is
# keyed by Integration Binding UUID or its credentialReference. Keep false until
# counsel authority, exact accounts, callbacks, and recovery drills are qualified.
EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED=false
# Generic Systems control-center dispatch remains separately kill-switched.
# When enabled, EOS executes only audited Gmail, Notion, QuickBooks, and
# GoHighLevel operations attached to an entitled company provider binding.
# allowlists and requires each operator's encrypted OAuth authorization.
EOS_INTEGRATION_PROVIDER_EFFECTS_ENABLED=false
EOS_PROVIDER_INGRESS_WORKER_INTERVAL_MS=60000
EOS_INTEGRATION_DISPATCH_RECOVERY_AFTER_MS=300000
EOS_INTEGRATION_DISPATCH_RECOVERY_INTERVAL_MS=60000
EOS_ARTIFACT_STORAGE_PROVIDER=s3
EOS_ARTIFACT_S3_BUCKET=op://EntrepreneurOS/Production/EOS_ARTIFACT_S3_BUCKET
EOS_ARTIFACT_S3_REGION=op://EntrepreneurOS/Production/EOS_ARTIFACT_S3_REGION
EOS_ARTIFACT_S3_ENDPOINT=op://EntrepreneurOS/Production/EOS_ARTIFACT_S3_ENDPOINT
EOS_ARTIFACT_S3_FORCE_PATH_STYLE=false
EOS_ARTIFACT_S3_PREFIX=native-esign
EOS_ARTIFACT_S3_SSE_CUSTOMER_KEY=op://EntrepreneurOS/Production/EOS_ARTIFACT_S3_SSE_CUSTOMER_KEY
EOS_ARTIFACT_S3_ACCESS_KEY_ID=op://EntrepreneurOS/Production/EOS_ARTIFACT_S3_ACCESS_KEY_ID
EOS_ARTIFACT_S3_SECRET_ACCESS_KEY=op://EntrepreneurOS/Production/EOS_ARTIFACT_S3_SECRET_ACCESS_KEY
EOS_ARTIFACT_BACKUP_STORAGE_PROVIDER=s3
EOS_ARTIFACT_BACKUP_S3_BUCKET=op://EntrepreneurOS/Production/EOS_ARTIFACT_BACKUP_S3_BUCKET
EOS_ARTIFACT_BACKUP_S3_REGION=op://EntrepreneurOS/Production/EOS_ARTIFACT_BACKUP_S3_REGION
EOS_ARTIFACT_BACKUP_S3_ENDPOINT=op://EntrepreneurOS/Production/EOS_ARTIFACT_BACKUP_S3_ENDPOINT
EOS_ARTIFACT_BACKUP_S3_FORCE_PATH_STYLE=false
EOS_ARTIFACT_BACKUP_S3_PREFIX=native-esign
EOS_ARTIFACT_BACKUP_S3_SSE_CUSTOMER_KEY=op://EntrepreneurOS/Production/EOS_ARTIFACT_BACKUP_S3_SSE_CUSTOMER_KEY
EOS_ARTIFACT_BACKUP_S3_ACCESS_KEY_ID=op://EntrepreneurOS/Production/EOS_ARTIFACT_BACKUP_S3_ACCESS_KEY_ID
EOS_ARTIFACT_BACKUP_S3_SECRET_ACCESS_KEY=op://EntrepreneurOS/Production/EOS_ARTIFACT_BACKUP_S3_SECRET_ACCESS_KEY
EOS_CANDIDATE_STT_ENABLED=false
EOS_CANDIDATE_STT_MODEL=gpt-4o-mini-transcribe
EOS_UNTRUSTED_UPLOADS_ENABLED=false
EOS_PUBLIC_ORIGIN=https://entrepreneuros.net
