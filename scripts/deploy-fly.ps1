$ErrorActionPreference = "Stop"

$required = @(
  "ANTHROPIC_API_KEY",
  "VITE_CLERK_PUBLISHABLE_KEY",
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "DATABASE_URL",
  "SESSION_SECRET",
  "EOS_CREDENTIAL_ENCRYPTION_KEY",
  "EOS_PUBLIC_ORIGIN",
  "EOS_PRODUCTION_ENVIRONMENT_SUBJECT",
  "EOS_PRODUCTION_RELEASE_BRANCH",
  "EOS_GITHUB_REPOSITORY",
  "EOS_ALERT_WEBHOOK_URL",
  "EOS_ALERT_WEBHOOK_SECRET",
  "STRIPE_RESTRICTED_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "EOS_STRIPE_PLANS",
  "EOS_PLATFORM_ADMIN_USER_IDS",
  "EOS_ACCOUNT_DELETION_ENABLED",
  "EOS_LEGAL_ENFORCEMENT",
  "EOS_PUBLIC_PAID_SAAS",
  "VITE_POSTHOG_API_KEY",
  "POSTHOG_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "NOTION_API_KEY"
)

$smokeRequired = @(
  "EOS_PRODUCTION_BEARER_TOKEN",
  "EOS_PRODUCTION_COMPANY_ID",
  "EOS_PRODUCTION_FORBIDDEN_COMPANY_ID"
)

foreach ($name in $required) {
  if (-not [Environment]::GetEnvironmentVariable($name)) {
    throw "Missing required release variable: $name"
  }
}

foreach ($name in $smokeRequired) {
  if (-not [Environment]::GetEnvironmentVariable($name)) {
    throw "Missing required signed-in qualification variable: $name"
  }
}

$app = if ($env:EOS_FLY_APP) { $env:EOS_FLY_APP } else { "eos-app" }
$releaseCommit = (git rev-parse HEAD).Trim().ToLowerInvariant()
if ($releaseCommit -notmatch '^[a-f0-9]{40}$') { throw "Could not resolve an immutable release commit." }
$releaseBranch = (git branch --show-current).Trim()
if ($releaseBranch -ne $env:EOS_PRODUCTION_RELEASE_BRANCH) { throw "Production releases must run from the configured release branch." }
$remoteReleaseCommit = (git ls-remote origin "refs/heads/$releaseBranch").Split("`t")[0].Trim().ToLowerInvariant()
if ($remoteReleaseCommit -ne $releaseCommit) { throw "The release commit is not the current remote release-branch head." }
$qualificationRuns = @(gh run list --repo $env:EOS_GITHUB_REPOSITORY --workflow "Production qualification" --event push --commit $releaseCommit --limit 10 --json status,conclusion,headSha,url | ConvertFrom-Json)
$qualifiedRun = $qualificationRuns | Where-Object { $_.headSha -eq $releaseCommit -and $_.status -eq "completed" -and $_.conclusion -eq "success" } | Select-Object -First 1
if (-not $qualifiedRun) { throw "The exact release commit does not have a successful push-triggered production qualification run." }
$env:EOS_RELEASE_SUBJECT = "git:$releaseCommit"
$imageLabel = "eos-$releaseCommit"
$imageReference = "registry.fly.io/${app}:$imageLabel"

$machines = @(flyctl machines list --app $app --json | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0 -or -not $machines.Count) { throw "Could not determine the currently deployed rollback image." }
$rollbackImages = @($machines | ForEach-Object { "$($_.image_ref.registry)/$($_.image_ref.repository)@$($_.image_ref.digest)" } | Select-Object -Unique)
if ($rollbackImages.Count -ne 1 -or $rollbackImages[0] -notmatch '^registry\.fly\.io/[a-z0-9-]+@sha256:[a-f0-9]{64}$') { throw "Production machines do not share one immutable rollback image." }
$rollbackImage = $rollbackImages[0]
$rollbackSubjects = @($machines | ForEach-Object { $_.config.env.EOS_RELEASE_SUBJECT } | Where-Object { $_ } | Select-Object -Unique)
$rollbackSubject = if ($rollbackSubjects.Count -eq 1) { $rollbackSubjects[0] } else { "image:$($machines[0].image_ref.digest)" }
if ($rollbackSubject -notmatch '^(git:[a-f0-9]{40}|image:sha256:[a-f0-9]{64})$') { throw "Could not determine an immutable rollback subject." }

npm run release:verify
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

flyctl secrets set --app $app --stage `
  "ANTHROPIC_API_KEY=$env:ANTHROPIC_API_KEY" `
  "CLERK_PUBLISHABLE_KEY=$env:CLERK_PUBLISHABLE_KEY" `
  "CLERK_SECRET_KEY=$env:CLERK_SECRET_KEY" `
  "DATABASE_URL=$env:DATABASE_URL" `
  "SESSION_SECRET=$env:SESSION_SECRET" `
  "EOS_CREDENTIAL_ENCRYPTION_KEY=$env:EOS_CREDENTIAL_ENCRYPTION_KEY" `
  "EOS_PUBLIC_ORIGIN=$env:EOS_PUBLIC_ORIGIN" `
  "EOS_ALERT_WEBHOOK_URL=$env:EOS_ALERT_WEBHOOK_URL" `
  "EOS_ALERT_WEBHOOK_SECRET=$env:EOS_ALERT_WEBHOOK_SECRET" `
  "STRIPE_RESTRICTED_KEY=$env:STRIPE_RESTRICTED_KEY" `
  "STRIPE_WEBHOOK_SECRET=$env:STRIPE_WEBHOOK_SECRET" `
  "EOS_STRIPE_PLANS=$env:EOS_STRIPE_PLANS" `
  "EOS_PLATFORM_ADMIN_USER_IDS=$env:EOS_PLATFORM_ADMIN_USER_IDS" `
  "EOS_ACCOUNT_DELETION_ENABLED=$env:EOS_ACCOUNT_DELETION_ENABLED" `
  "EOS_LEGAL_ENFORCEMENT=$env:EOS_LEGAL_ENFORCEMENT" `
  "EOS_PUBLIC_PAID_SAAS=$env:EOS_PUBLIC_PAID_SAAS" `
  "POSTHOG_API_KEY=$env:POSTHOG_API_KEY" `
  "GOOGLE_CLIENT_ID=$env:GOOGLE_CLIENT_ID" `
  "GOOGLE_CLIENT_SECRET=$env:GOOGLE_CLIENT_SECRET" `
  "GOOGLE_REDIRECT_URI=$env:GOOGLE_REDIRECT_URI" `
  "NOTION_API_KEY=$env:NOTION_API_KEY"

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$releaseContext = Join-Path ([IO.Path]::GetTempPath()) "eos-release-$releaseCommit-$PID"
$archivePath = Join-Path $releaseContext "source.tar"
New-Item -ItemType Directory -Path $releaseContext | Out-Null
try {
  git archive --format=tar --output=$archivePath $releaseCommit
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  tar -xf $archivePath -C $releaseContext
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Remove-Item -LiteralPath $archivePath

  flyctl deploy $releaseContext --app $app --remote-only --build-only --push --image-label $imageLabel `
    --build-arg "VITE_CLERK_PUBLISHABLE_KEY=$env:VITE_CLERK_PUBLISHABLE_KEY" `
    --build-arg "VITE_POSTHOG_API_KEY=$env:VITE_POSTHOG_API_KEY" --yes
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  try {
    flyctl deploy $releaseContext --app $app --image $imageReference --strategy canary `
      --env "EOS_RELEASE_SUBJECT=$env:EOS_RELEASE_SUBJECT" `
      --env "EOS_PRODUCTION_ENVIRONMENT_SUBJECT=$env:EOS_PRODUCTION_ENVIRONMENT_SUBJECT" --yes
    if ($LASTEXITCODE -ne 0) { throw "Fly promotion did not complete successfully." }

    $env:EOS_PRODUCTION_ORIGIN = $env:EOS_PUBLIC_ORIGIN
    npm run test:e2e:production
    if ($LASTEXITCODE -ne 0) { throw "Public production smoke failed." }
    npm run test:e2e:production:authenticated
    if ($LASTEXITCODE -ne 0) { throw "Signed-in role and isolation smoke failed." }
  } catch {
    $promotionError = $_.Exception.Message
    Write-Warning "Promotion or smoke qualification failed; restoring the exact prior image."
    flyctl deploy $releaseContext --app $app --image $rollbackImage --strategy rolling `
      --env "EOS_RELEASE_SUBJECT=$rollbackSubject" `
      --env "EOS_PRODUCTION_ENVIRONMENT_SUBJECT=$env:EOS_PRODUCTION_ENVIRONMENT_SUBJECT" --yes
    if ($LASTEXITCODE -ne 0) { throw "Promotion failed and automatic rollback also failed. Escalate immediately." }
    throw "Promotion failed: $promotionError The prior immutable image was restored; inspect evidence before retrying."
  }

  New-Item -ItemType Directory -Force -Path ".tmp" | Out-Null
  @{
    standard = "eos.fly-promotion.v1"
    promotedAt = (Get-Date).ToUniversalTime().ToString("o")
    app = $app
    releaseCommit = $releaseCommit
    releaseSubject = $env:EOS_RELEASE_SUBJECT
    image = $imageReference
    rollbackImage = $rollbackImage
    rollbackSubject = $rollbackSubject
    qualificationRun = $qualifiedRun.url
    publicSmoke = $true
    authenticatedSmoke = $true
    finalReadinessPending = $true
  } | ConvertTo-Json | Set-Content -Encoding utf8 ".tmp/eos-last-deployment.json"
} finally {
  $resolvedContext = [IO.Path]::GetFullPath($releaseContext)
  $resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if ($resolvedContext.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedContext)) {
    Remove-Item -LiteralPath $resolvedContext -Recurse -Force
  }
}

Write-Output "Exact image promoted and smoke-qualified. Record release-bound evidence and run npm run test:e2e:production:readiness before declaring the release ready."
