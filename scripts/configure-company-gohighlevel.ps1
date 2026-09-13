param(
  [string]$TargetVault = "EntrepreneurOS",
  [string]$Item = "Production",
  [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"

if ($ValidateOnly) {
  Write-Output "Company GoHighLevel vault workflow syntax loaded."
  exit 0
}

function Read-Required([string]$Prompt, [string]$Pattern) {
  $value = (Read-Host $Prompt).Trim()
  if (-not $value -or $value -notmatch $Pattern) { throw "The supplied value for '$Prompt' is invalid." }
  return $value
}

function Read-Concealed([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if (-not $value -or $value.Trim().Length -lt 20) { throw "A GoHighLevel private integration token is required." }
    return $value.Trim()
  } finally {
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  }
}

function Read-JsonMap([object]$Field) {
  try {
    $parsed = [string]$Field.value | ConvertFrom-Json -AsHashtable
    if ($null -eq $parsed -or $parsed -isnot [Collections.IDictionary]) { throw "invalid" }
    return $parsed
  } catch {
    throw "EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS must contain a JSON object before a company CRM can be configured."
  }
}

op whoami | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Authenticate the 1Password CLI before configuring the company CRM." }

$bindingId = Read-Required "Enter the exact EOS GoHighLevel Integration Binding UUID" '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
$locationId = Read-Required "Enter the GoHighLevel company location ID" '^[A-Za-z0-9_-]{8,200}$'
$privateToken = Read-Concealed "Paste the GoHighLevel private integration token"

$itemJson = op item get $Item --vault $TargetVault --format json
if ($LASTEXITCODE -ne 0 -or -not $itemJson) { throw "Could not read $TargetVault/$Item." }
$itemDocument = $itemJson | ConvertFrom-Json
$executionField = $itemDocument.fields | Where-Object { $_.label -eq "EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS" } | Select-Object -First 1
if (-not $executionField) { throw "The production item is missing EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS." }

$executionMap = Read-JsonMap $executionField
$executionMap[$bindingId] = [ordered]@{ provider = "gohighlevel"; privateIntegrationToken = $privateToken; locationId = $locationId }
$executionField.value = $executionMap | ConvertTo-Json -Depth 10 -Compress

$payload = $itemDocument | ConvertTo-Json -Depth 100 -Compress
$payload | op item edit $Item --vault $TargetVault | Out-Null
if ($LASTEXITCODE -ne 0) { throw "1Password did not accept the company CRM configuration." }

$privateToken = $null
$payload = $null
Write-Output "Configured the GoHighLevel private integration token for EOS Integration Binding $bindingId without writing plaintext credentials to disk or process arguments."
