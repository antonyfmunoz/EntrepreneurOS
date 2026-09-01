param(
  [string]$TargetVault = "EntrepreneurOS",
  [string]$Item = "Production",
  [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"

if ($ValidateOnly) {
  Write-Output "Company Stripe vault workflow syntax loaded."
  exit 0
}

function Read-Concealed([string]$Prompt, [string]$Pattern, [string]$InvalidMessage) {
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

function Read-Required([string]$Prompt, [string]$Pattern) {
  $value = (Read-Host $Prompt).Trim()
  if (-not $value -or $value -notmatch $Pattern) { throw "The supplied value for '$Prompt' is invalid." }
  return $value
}

function Read-JsonMap([object]$Field, [string]$Label) {
  try {
    $parsed = [string]$Field.value | ConvertFrom-Json -AsHashtable
    if ($null -eq $parsed -or $parsed -isnot [Collections.IDictionary]) { throw "invalid" }
    return $parsed
  } catch {
    throw "$Label must contain a JSON object before company payments can be configured."
  }
}

op whoami | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Authenticate the 1Password CLI before configuring company payments." }

$bindingId = Read-Required "Enter the exact EOS Stripe Integration Binding UUID" '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
$restrictedKey = Read-Concealed "Paste the operating company's Stripe live restricted key" '^rk_live_[A-Za-z0-9_-]+$' "A Stripe rk_live_ restricted key is required."
$webhookSecret = Read-Concealed "Paste the binding-specific Stripe live webhook signing secret" '^whsec_[A-Za-z0-9_-]+$' "A Stripe whsec_ webhook signing secret is required."

$itemJson = op item get $Item --vault $TargetVault --format json
if ($LASTEXITCODE -ne 0 -or -not $itemJson) { throw "Could not read $TargetVault/$Item." }
$itemDocument = $itemJson | ConvertFrom-Json
$executionField = $itemDocument.fields | Where-Object { $_.label -eq "EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS" } | Select-Object -First 1
$webhookField = $itemDocument.fields | Where-Object { $_.label -eq "EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS" } | Select-Object -First 1
if (-not $executionField -or -not $webhookField) { throw "The production item is missing the company-payment credential fields." }

$executionMap = Read-JsonMap $executionField "EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS"
$webhookMap = Read-JsonMap $webhookField "EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS"
$executionMap[$bindingId] = [ordered]@{ provider = "stripe"; secretKey = $restrictedKey }
$webhookMap[$bindingId] = @($webhookSecret)
$executionField.value = $executionMap | ConvertTo-Json -Depth 10 -Compress
$webhookField.value = $webhookMap | ConvertTo-Json -Depth 10 -Compress

$payload = $itemDocument | ConvertTo-Json -Depth 100 -Compress
$payload | op item edit $Item --vault $TargetVault | Out-Null
if ($LASTEXITCODE -ne 0) { throw "1Password did not accept the company-payment configuration." }

$restrictedKey = $null
$webhookSecret = $null
$payload = $null
Write-Output "Configured the Stripe credential and webhook secret for EOS Integration Binding $bindingId without writing plaintext secrets to disk or process arguments."
