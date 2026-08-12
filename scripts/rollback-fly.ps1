$ErrorActionPreference = "Stop"

$app = if ($env:EOS_FLY_APP) { $env:EOS_FLY_APP } else { "eos-app" }
$image = $env:EOS_ROLLBACK_IMAGE
$subject = $env:EOS_ROLLBACK_RELEASE_SUBJECT
$environmentSubject = $env:EOS_PRODUCTION_ENVIRONMENT_SUBJECT
$approval = $env:EOS_ROLLBACK_APPROVAL
if ($approval -ne "ROLLBACK $app") { throw "Set EOS_ROLLBACK_APPROVAL to the exact phrase: ROLLBACK $app" }
if ($image -notmatch "^registry\.fly\.io/$([regex]::Escape($app))@sha256:[a-f0-9]{64}$") { throw "EOS_ROLLBACK_IMAGE must be an immutable digest for the target app." }
if ($subject -notmatch '^(git:[a-f0-9]{40}|image:sha256:[a-f0-9]{64})$') { throw "EOS_ROLLBACK_RELEASE_SUBJECT must identify the exact rollback release." }
if ($environmentSubject -notmatch '^environment:[a-z0-9][a-z0-9-]{2,79}$') { throw "EOS_PRODUCTION_ENVIRONMENT_SUBJECT is invalid." }

flyctl deploy --app $app --image $image --strategy rolling `
  --env "EOS_RELEASE_SUBJECT=$subject" `
  --env "EOS_PRODUCTION_ENVIRONMENT_SUBJECT=$environmentSubject" --yes
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$origin = if ($env:EOS_PRODUCTION_ORIGIN) { $env:EOS_PRODUCTION_ORIGIN } elseif ($env:EOS_PUBLIC_ORIGIN) { $env:EOS_PUBLIC_ORIGIN } else { "https://entrepreneuros.net" }
$health = Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/health" -TimeoutSec 30
if ($health.StatusCode -ne 200) { throw "Rollback image did not restore public health." }
Write-Output "Rollback image restored. Re-run signed-in isolation and full 24-layer readiness qualification before closing the incident."
