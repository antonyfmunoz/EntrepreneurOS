param(
  [string]$TargetVault = "EntrepreneurOS",
  [string]$SourceVault = "UMH-Production"
)

$ErrorActionPreference = "Stop"

function Read-Concealed([string]$Prompt, [string]$Pattern = ".+", [string]$InvalidMessage = "The supplied value is invalid.") {
  $secure = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if (-not $value -or $value -notmatch $Pattern) { throw $InvalidMessage }
    return $value
  } finally {
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  }
}

function Read-Required([string]$Prompt, [string]$Pattern = ".+") {
  $value = (Read-Host $Prompt).Trim()
  if (-not $value -or $value -notmatch $Pattern) { throw "The supplied value for '$Prompt' is invalid." }
  return $value
}

function Read-Managed([string]$Reference) {
  $value = op read $Reference
  if ($LASTEXITCODE -ne 0 -or -not $value) { throw "Could not read required managed source reference: $Reference" }
  return ([string]$value).Trim()
}

function New-RandomBase64([int]$Bytes) {
  $buffer = [byte[]]::new($Bytes)
  [Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
  return [Convert]::ToBase64String($buffer)
}

function New-RandomHex([int]$Bytes) {
  $buffer = [byte[]]::new($Bytes)
  [Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
  return [Convert]::ToHexString($buffer).ToLowerInvariant()
}

function New-Field([string]$Label, [string]$Value, [string]$Type = "CONCEALED") {
  return [ordered]@{
    id = $Label
    label = $Label
    type = $Type
    value = $Value
  }
}

op whoami | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Authenticate the 1Password CLI before bootstrapping production custody." }

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$null = op item get Production --vault $TargetVault --format json 2>$null
$productionItemLookupExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
if ($productionItemLookupExitCode -eq 0) {
  throw "The $TargetVault/Production item already exists. This bootstrap is create-only so it cannot silently overwrite production custody."
}

Write-Output "Collecting production values. Concealed prompts do not echo or enter shell history. Nothing is written until every value validates."

$databaseUrl = Read-Concealed "Paste the exact production Neon application-role DATABASE_URL" '^postgres(?:ql)?://.+' "A managed PostgreSQL connection URL is required."
try {
  $databaseUri = [Uri]$databaseUrl
  $databaseName = $databaseUri.AbsolutePath.Trim('/')
  $databaseRole = [Uri]::UnescapeDataString($databaseUri.UserInfo.Split(':')[0])
  if ($databaseUri.Scheme -notin @('postgres', 'postgresql') -or -not $databaseUri.Host -or $databaseUri.Host -in @('localhost', '127.0.0.1', '::1') -or $databaseName -ne 'eos_db' -or $databaseRole -ne 'eos_app') {
    throw "mismatch"
  }
} catch {
  throw "The production DATABASE_URL must target the managed eos_db database through the eos_app application role."
}
$migrationDatabaseSource = Read-Managed "op://$SourceVault/Database-Neon/url"
try {
  $migrationDatabaseUri = [Uri]$migrationDatabaseSource
  $migrationDatabaseRole = [Uri]::UnescapeDataString($migrationDatabaseUri.UserInfo.Split(':')[0])
  if ($migrationDatabaseUri.Scheme -notin @('postgres', 'postgresql') -or -not $migrationDatabaseUri.Host -or $migrationDatabaseRole -ne 'neondb_owner') { throw "mismatch" }
  $migrationDatabaseBuilder = [UriBuilder]$migrationDatabaseUri
  $migrationDatabaseBuilder.Path = 'eos_db'
  $migrationDatabaseUrl = $migrationDatabaseBuilder.Uri.AbsoluteUri
} catch {
  throw "The managed Database-Neon source must contain the production Neon owner credential used only for migrations."
}
$anthropicKey = Read-Managed "op://$SourceVault/AI-Anthropic/api_key"
$posthogKey = Read-Managed "op://$SourceVault/EOS-PostHog/POSTHOG_KEY"
$clerkPublishable = Read-Managed "op://$SourceVault/EOS-Clerk/publishable_key"
$clerkSecret = Read-Managed "op://$SourceVault/EOS-Clerk/secret_key"
if ($clerkPublishable -notmatch '^pk_live_[A-Za-z0-9_$-]+$' -or $clerkSecret -notmatch '^sk_live_[A-Za-z0-9_$-]+$') {
  throw "The managed EOS-Clerk source item must contain Clerk production keys."
}
$googleClientId = Read-Concealed "Paste the EOS production Google OAuth client ID"
$googleClientSecret = Read-Concealed "Paste the EOS production Google OAuth client secret"
$notionClientId = Read-Concealed "Paste the public Notion OAuth client ID"
$notionClientSecret = Read-Concealed "Paste the public Notion OAuth client secret"
$companyId = Read-Required "Enter the authorized production company ID" '^\d+$'
$forbiddenCompanyId = Read-Required "Enter a different production company ID used for tenant-denial smoke" '^\d+$'
if ($companyId -eq $forbiddenCompanyId) { throw "The authorized and forbidden company IDs must differ." }
$platformAdministrators = Read-Required "Enter comma-separated Clerk user IDs for production platform administrators" '^user_[A-Za-z0-9_-]+(?:,\s*user_[A-Za-z0-9_-]+)*$'
$alertWebhookUrl = Read-Required "Enter the HTTPS operational alert receiver URL" '^https://[^\s]+$'
$alertWebhookSecret = Read-Concealed "Paste the alert receiver HMAC secret (32+ characters)" '^.{32,}$'
$stripeRestrictedKey = Read-Concealed "Paste the Stripe live restricted key" '^rk_live_[A-Za-z0-9_-]+$' "A Stripe rk_live_ restricted key is required."
$stripeWebhookSecret = Read-Concealed "Paste the Stripe live webhook signing secret" '^whsec_[A-Za-z0-9_-]+$'
$stripePlans = Read-Concealed "Paste the EOS_STRIPE_PLANS JSON map"
try {
  $parsedPlans = $stripePlans | ConvertFrom-Json
  if (-not $parsedPlans.PSObject.Properties.Count) { throw "empty" }
} catch { throw "EOS_STRIPE_PLANS must be a non-empty JSON object." }

$primaryBucket = Read-Required "Enter the primary S3 artifact bucket"
$primaryRegion = Read-Required "Enter the primary S3 region"
$primaryEndpoint = Read-Required "Enter the primary S3-compatible HTTPS endpoint" '^https://[^\s]+$'
$primaryAccessKey = Read-Concealed "Paste the primary S3 least-privilege access key ID"
$primarySecretKey = Read-Concealed "Paste the primary S3 secret access key"
$backupBucket = Read-Required "Enter the independent backup S3 artifact bucket"
if ($backupBucket -eq $primaryBucket) { throw "Primary and backup artifact buckets must be different." }
$backupRegion = Read-Required "Enter the backup S3 region"
$backupEndpoint = Read-Required "Enter the backup S3-compatible HTTPS endpoint" '^https://[^\s]+$'
$backupAccessKey = Read-Concealed "Paste the backup S3 least-privilege access key ID"
$backupSecretKey = Read-Concealed "Paste the backup S3 secret access key"
$malwareEndpoint = Read-Required "Enter the HTTPS malware-scanner endpoint" '^https://[^\s]+$'
$malwareSecret = Read-Concealed "Paste the malware-scanner bearer secret (32+ characters)" '^.{32,}$'

$template = op item template get "Secure Note" --format json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Could not load the 1Password Secure Note template." }
$template.title = "Production"
$template.fields = @($template.fields | Where-Object { $_.id -eq "notesPlain" })
$template.fields += @(
  New-Field "DATABASE_URL" $databaseUrl
  New-Field "MIGRATION_DATABASE_URL" $migrationDatabaseUrl
  New-Field "SESSION_SECRET" (New-RandomBase64 48)
  New-Field "ANTHROPIC_API_KEY" $anthropicKey
  New-Field "VITE_CLERK_PUBLISHABLE_KEY" $clerkPublishable
  New-Field "CLERK_PUBLISHABLE_KEY" $clerkPublishable
  New-Field "CLERK_SECRET_KEY" $clerkSecret
  New-Field "EOS_CREDENTIAL_ENCRYPTION_KEY" (New-RandomBase64 32)
  New-Field "VITE_POSTHOG_API_KEY" $posthogKey
  New-Field "GOOGLE_CLIENT_ID" $googleClientId
  New-Field "GOOGLE_CLIENT_SECRET" $googleClientSecret
  New-Field "NOTION_CLIENT_ID" $notionClientId
  New-Field "NOTION_CLIENT_SECRET" $notionClientSecret
  New-Field "EOS_PRODUCTION_COMPANY_ID" $companyId "STRING"
  New-Field "EOS_PRODUCTION_FORBIDDEN_COMPANY_ID" $forbiddenCompanyId "STRING"
  New-Field "EOS_ALERT_WEBHOOK_URL" $alertWebhookUrl "STRING"
  New-Field "EOS_ALERT_WEBHOOK_SECRET" $alertWebhookSecret
  New-Field "STRIPE_RESTRICTED_KEY" $stripeRestrictedKey
  New-Field "STRIPE_WEBHOOK_SECRET" $stripeWebhookSecret
  New-Field "EOS_STRIPE_PLANS" $stripePlans
  New-Field "EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS" "{}"
  New-Field "EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS" "{}"
  New-Field "EOS_PLATFORM_ADMIN_USER_IDS" $platformAdministrators "STRING"
  New-Field "EOS_DATABASE_VENDOR_NAME" "Neon" "STRING"
  New-Field "EOS_DNS_VENDOR_NAME" "Squarespace Domains" "STRING"
  New-Field "EOS_SECRET_VAULT_VENDOR_NAME" "1Password" "STRING"
  New-Field "EOS_ARTIFACT_S3_BUCKET" $primaryBucket "STRING"
  New-Field "EOS_ARTIFACT_S3_REGION" $primaryRegion "STRING"
  New-Field "EOS_ARTIFACT_S3_ENDPOINT" $primaryEndpoint "STRING"
  New-Field "EOS_ARTIFACT_S3_SSE_CUSTOMER_KEY" (New-RandomBase64 32)
  New-Field "EOS_ARTIFACT_S3_ACCESS_KEY_ID" $primaryAccessKey
  New-Field "EOS_ARTIFACT_S3_SECRET_ACCESS_KEY" $primarySecretKey
  New-Field "EOS_ARTIFACT_BACKUP_S3_BUCKET" $backupBucket "STRING"
  New-Field "EOS_ARTIFACT_BACKUP_S3_REGION" $backupRegion "STRING"
  New-Field "EOS_ARTIFACT_BACKUP_S3_ENDPOINT" $backupEndpoint "STRING"
  New-Field "EOS_ARTIFACT_BACKUP_S3_SSE_CUSTOMER_KEY" (New-RandomBase64 32)
  New-Field "EOS_ARTIFACT_BACKUP_S3_ACCESS_KEY_ID" $backupAccessKey
  New-Field "EOS_ARTIFACT_BACKUP_S3_SECRET_ACCESS_KEY" $backupSecretKey
  New-Field "EOS_MALWARE_SCAN_ENDPOINT" $malwareEndpoint "STRING"
  New-Field "EOS_MALWARE_SCAN_SECRET" $malwareSecret
  New-Field "EOS_PRODUCTION_VAULT_BOOTSTRAP_RECEIPT" ("receipt:1password/" + (New-RandomHex 16)) "STRING"
)

$payload = $template | ConvertTo-Json -Depth 20 -Compress
$null = $payload | op item create --vault $TargetVault -
if ($LASTEXITCODE -ne 0) { throw "1Password rejected the production item. No values were printed." }

Write-Output "Created $TargetVault/Production with $($template.fields.Count - 1) managed fields. Values were neither echoed nor written to disk."
