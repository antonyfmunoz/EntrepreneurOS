$ErrorActionPreference = "Stop"

function Get-FlyMachines([string]$App) {
  $raw = flyctl machines list --app $App --json
  if ($LASTEXITCODE -ne 0) { throw "Could not inspect Fly machines for $App." }
  $items = @($raw | ConvertFrom-Json | ForEach-Object { $_ })
  if (-not $items.Count) { throw "Fly returned no machines for $App." }
  return $items
}

$app = if ($env:EOS_FLY_APP) { $env:EOS_FLY_APP } else { "eos-app" }
$image = $env:EOS_ROLLBACK_IMAGE
$subject = $env:EOS_ROLLBACK_RELEASE_SUBJECT
$environmentSubject = $env:EOS_PRODUCTION_ENVIRONMENT_SUBJECT
$approval = $env:EOS_ROLLBACK_APPROVAL
$required = @(
  "EOS_DATABASE_VENDOR_NAME",
  "EOS_DNS_VENDOR_NAME",
  "EOS_SECRET_VAULT_VENDOR_NAME",
  "EOS_PRODUCTION_BEARER_TOKEN",
  "EOS_PRODUCTION_COMPANY_ID",
  "EOS_PRODUCTION_FORBIDDEN_COMPANY_ID"
)
foreach ($name in $required) {
  if (-not [Environment]::GetEnvironmentVariable($name)) { throw "Missing required rollback qualification variable: $name" }
}
if ($approval -ne "ROLLBACK $app") { throw "Set EOS_ROLLBACK_APPROVAL to the exact phrase: ROLLBACK $app" }
if ($image -notmatch "^registry\.fly\.io/$([regex]::Escape($app))@sha256:[a-f0-9]{64}$") { throw "EOS_ROLLBACK_IMAGE must be an immutable digest for the target app." }
if ($subject -notmatch '^(git:[a-f0-9]{40}|image:sha256:[a-f0-9]{64})$') { throw "EOS_ROLLBACK_RELEASE_SUBJECT must identify the exact rollback release." }
if ($environmentSubject -notmatch '^environment:[a-z0-9][a-z0-9-]{2,79}$') { throw "EOS_PRODUCTION_ENVIRONMENT_SUBJECT is invalid." }

flyctl deploy --app $app --image $image --strategy rolling `
  --env "EOS_RELEASE_SUBJECT=$subject" `
  --env "EOS_PRODUCTION_ENVIRONMENT_SUBJECT=$environmentSubject" `
  --env "EOS_DATABASE_VENDOR_NAME=$env:EOS_DATABASE_VENDOR_NAME" `
  --env "EOS_DNS_VENDOR_NAME=$env:EOS_DNS_VENDOR_NAME" `
  --env "EOS_SECRET_VAULT_VENDOR_NAME=$env:EOS_SECRET_VAULT_VENDOR_NAME" --yes
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$machines = @(Get-FlyMachines -App $app)
$images = @($machines | ForEach-Object { "$($_.image_ref.registry)/$($_.image_ref.repository)@$($_.image_ref.digest)" } | Select-Object -Unique)
$subjects = @($machines | ForEach-Object { $_.config.env.EOS_RELEASE_SUBJECT } | Select-Object -Unique)
if ($images.Count -ne 1 -or $images[0] -ne $image -or $subjects.Count -ne 1 -or $subjects[0] -ne $subject) { throw "Rollback returned without proving the requested immutable image and release subject." }

$origin = if ($env:EOS_PRODUCTION_ORIGIN) { $env:EOS_PRODUCTION_ORIGIN } elseif ($env:EOS_PUBLIC_ORIGIN) { $env:EOS_PUBLIC_ORIGIN } else { "https://entrepreneuros.net" }
$env:EOS_PRODUCTION_ORIGIN = $origin
$env:EOS_EXPECTED_RELEASE_SUBJECT = $subject
npm run test:e2e:production
if ($LASTEXITCODE -ne 0) { throw "Rollback image failed public health, identity, or security smoke." }
npm run test:e2e:production:authenticated
if ($LASTEXITCODE -ne 0) { throw "Rollback image failed signed-in role or tenant-isolation smoke." }
Write-Output "Rollback image restored and smoke-qualified. Re-run full 24-layer readiness qualification before closing the incident."
