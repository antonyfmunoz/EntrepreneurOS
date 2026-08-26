$ErrorActionPreference = "Stop"

function Get-FlyMachines([string]$App) {
  $raw = flyctl machines list --app $App --json
  if ($LASTEXITCODE -ne 0) { throw "Could not inspect Fly machines for $App." }
  $items = @($raw | ConvertFrom-Json | ForEach-Object { $_ })
  if (-not $items.Count) { throw "Fly returned no machines for $App." }
  return $items
}

function Get-FlySecrets([string]$App) {
  $raw = flyctl secrets list --app $App --json
  if ($LASTEXITCODE -ne 0) { throw "Could not inspect Fly secret deployment state for $App." }
  return @($raw | ConvertFrom-Json | ForEach-Object { $_ })
}

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
  "EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS",
  "EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED",
  "EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS",
  "EOS_PLATFORM_ADMIN_USER_IDS",
  "EOS_DATABASE_VENDOR_NAME",
  "EOS_DNS_VENDOR_NAME",
  "EOS_SECRET_VAULT_VENDOR_NAME",
  "EOS_ACCOUNT_DELETION_ENABLED",
  "EOS_LEGAL_ENFORCEMENT",
  "EOS_PUBLIC_PAID_SAAS",
  "VITE_POSTHOG_API_KEY",
  "POSTHOG_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "NOTION_CLIENT_ID",
  "NOTION_CLIENT_SECRET",
  "NOTION_REDIRECT_URI"
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
$dirtyPaths = @(git status --porcelain)
if ($LASTEXITCODE -ne 0) { throw "Could not inspect the release worktree." }
if ($dirtyPaths.Count -gt 0) { throw "Production releases require a clean worktree because the immutable image is built from the committed release subject." }
$expectedCutoverApproval = "CUTOVER $app $releaseCommit"
if ($env:EOS_SECRET_CUTOVER_APPROVAL -cne $expectedCutoverApproval) {
  throw "Secret cutover approval is missing or incorrect. Set EOS_SECRET_CUTOVER_APPROVAL to the exact release-specific phrase: $expectedCutoverApproval"
}
$releaseBranch = (git branch --show-current).Trim()
if ($releaseBranch -ne $env:EOS_PRODUCTION_RELEASE_BRANCH) { throw "Production releases must run from the configured release branch." }
$escapedReleaseBranch = [Uri]::EscapeDataString($releaseBranch)
$remoteReleaseCommit = (gh api "repos/$env:EOS_GITHUB_REPOSITORY/commits/$escapedReleaseBranch" --jq '.sha').Trim().ToLowerInvariant()
if ($LASTEXITCODE -ne 0 -or $remoteReleaseCommit -notmatch '^[a-f0-9]{40}$') { throw "Could not resolve the configured GitHub release-branch head." }
if ($remoteReleaseCommit -ne $releaseCommit) { throw "The release commit is not the current remote release-branch head." }
$qualificationRuns = @(gh run list --repo $env:EOS_GITHUB_REPOSITORY --workflow "Production qualification" --event push --commit $releaseCommit --limit 10 --json status,conclusion,headSha,url | ConvertFrom-Json)
$qualifiedRun = $qualificationRuns | Where-Object { $_.headSha -eq $releaseCommit -and $_.status -eq "completed" -and $_.conclusion -eq "success" } | Select-Object -First 1
if (-not $qualifiedRun) { throw "The exact release commit does not have a successful push-triggered production qualification run." }
$env:EOS_RELEASE_SUBJECT = "git:$releaseCommit"
$imageLabel = "eos-$releaseCommit"
$imageReference = "registry.fly.io/${app}:$imageLabel"

$machines = @(Get-FlyMachines -App $app)
$rollbackImages = @($machines | ForEach-Object { "$($_.image_ref.registry)/$($_.image_ref.repository)@$($_.image_ref.digest)" } | Select-Object -Unique)
if ($rollbackImages.Count -ne 1 -or $rollbackImages[0] -notmatch '^registry\.fly\.io/[a-z0-9-]+@sha256:[a-f0-9]{64}$') { throw "Production machines do not share one immutable rollback image." }
$rollbackImage = $rollbackImages[0]
$rollbackSubjects = @($machines | ForEach-Object { $_.config.env.EOS_RELEASE_SUBJECT } | Where-Object { $_ } | Select-Object -Unique)
$rollbackSubject = if ($rollbackSubjects.Count -eq 1) { $rollbackSubjects[0] } else { "image:$($machines[0].image_ref.digest)" }
if ($rollbackSubject -notmatch '^(git:[a-f0-9]{40}|image:sha256:[a-f0-9]{64})$') { throw "Could not determine an immutable rollback subject." }
$secretsBeforeRelease = @(Get-FlySecrets -App $app)
$pendingSecrets = @($secretsBeforeRelease | Where-Object { $_.status -ne "Deployed" })
if ($pendingSecrets.Count -gt 0) {
  $pendingNames = ($pendingSecrets | ForEach-Object { $_.name } | Sort-Object -Unique) -join ", "
  throw "Fly already has secrets outside the Deployed state ($pendingNames). Resolve that pending cutover before starting another release."
}

npm run release:verify
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
    --build-arg "CLERK_PUBLISHABLE_BUILD_VALUE=$env:VITE_CLERK_PUBLISHABLE_KEY" `
    --build-arg "POSTHOG_PUBLIC_BUILD_VALUE=$env:VITE_POSTHOG_API_KEY" --yes
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
    "EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS=$env:EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS" `
    "EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED=$env:EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED" `
    "EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS=$env:EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS" `
    "EOS_PLATFORM_ADMIN_USER_IDS=$env:EOS_PLATFORM_ADMIN_USER_IDS" `
    "EOS_ACCOUNT_DELETION_ENABLED=$env:EOS_ACCOUNT_DELETION_ENABLED" `
    "EOS_LEGAL_ENFORCEMENT=$env:EOS_LEGAL_ENFORCEMENT" `
    "EOS_PUBLIC_PAID_SAAS=$env:EOS_PUBLIC_PAID_SAAS" `
    "POSTHOG_API_KEY=$env:POSTHOG_API_KEY" `
    "GOOGLE_CLIENT_ID=$env:GOOGLE_CLIENT_ID" `
    "GOOGLE_CLIENT_SECRET=$env:GOOGLE_CLIENT_SECRET" `
    "GOOGLE_REDIRECT_URI=$env:GOOGLE_REDIRECT_URI" `
    "NOTION_CLIENT_ID=$env:NOTION_CLIENT_ID" `
    "NOTION_CLIENT_SECRET=$env:NOTION_CLIENT_SECRET" `
    "NOTION_REDIRECT_URI=$env:NOTION_REDIRECT_URI"
  if ($LASTEXITCODE -ne 0) { throw "Staging the release secret set failed. Resolve any partially staged Fly secrets before retrying." }

  try {
    flyctl deploy $releaseContext --app $app --image $imageReference --strategy canary `
      --env "EOS_RELEASE_SUBJECT=$env:EOS_RELEASE_SUBJECT" `
      --env "EOS_PRODUCTION_ENVIRONMENT_SUBJECT=$env:EOS_PRODUCTION_ENVIRONMENT_SUBJECT" `
      --env "EOS_DATABASE_VENDOR_NAME=$env:EOS_DATABASE_VENDOR_NAME" `
      --env "EOS_DNS_VENDOR_NAME=$env:EOS_DNS_VENDOR_NAME" `
      --env "EOS_SECRET_VAULT_VENDOR_NAME=$env:EOS_SECRET_VAULT_VENDOR_NAME" --yes
    if ($LASTEXITCODE -ne 0) { throw "Fly promotion did not complete successfully." }

    $promotedMachines = @(Get-FlyMachines -App $app)
    $promotedImages = @($promotedMachines | ForEach-Object { "$($_.image_ref.registry)/$($_.image_ref.repository)@$($_.image_ref.digest)" } | Select-Object -Unique)
    $promotedSubjects = @($promotedMachines | ForEach-Object { $_.config.env.EOS_RELEASE_SUBJECT } | Select-Object -Unique)
    if ($promotedImages.Count -ne 1 -or $promotedImages[0] -notmatch '^registry\.fly\.io/[a-z0-9-]+@sha256:[a-f0-9]{64}$') { throw "Promoted machines do not share one immutable image digest." }
    if ($promotedSubjects.Count -ne 1 -or $promotedSubjects[0] -ne $env:EOS_RELEASE_SUBJECT) { throw "Promoted machines do not report the exact release subject." }
    $promotedImage = $promotedImages[0]

    $env:EOS_PRODUCTION_ORIGIN = $env:EOS_PUBLIC_ORIGIN
    $env:EOS_EXPECTED_RELEASE_SUBJECT = $env:EOS_RELEASE_SUBJECT
    npm run test:e2e:production
    if ($LASTEXITCODE -ne 0) { throw "Public production smoke failed." }
    npm run test:e2e:production:authenticated
    if ($LASTEXITCODE -ne 0) { throw "Signed-in role and isolation smoke failed." }
  } catch {
    $promotionError = $_.Exception.Message
    Write-Warning "Promotion or smoke qualification failed; restoring the exact prior image."
    flyctl deploy $releaseContext --app $app --image $rollbackImage --strategy rolling `
      --env "EOS_RELEASE_SUBJECT=$rollbackSubject" `
      --env "EOS_PRODUCTION_ENVIRONMENT_SUBJECT=$env:EOS_PRODUCTION_ENVIRONMENT_SUBJECT" `
      --env "EOS_DATABASE_VENDOR_NAME=$env:EOS_DATABASE_VENDOR_NAME" `
      --env "EOS_DNS_VENDOR_NAME=$env:EOS_DNS_VENDOR_NAME" `
      --env "EOS_SECRET_VAULT_VENDOR_NAME=$env:EOS_SECRET_VAULT_VENDOR_NAME" --yes
    if ($LASTEXITCODE -ne 0) { throw "Promotion failed and automatic rollback also failed. Escalate immediately." }
    $restoredMachines = @(Get-FlyMachines -App $app)
    $restoredImages = @($restoredMachines | ForEach-Object { "$($_.image_ref.registry)/$($_.image_ref.repository)@$($_.image_ref.digest)" } | Select-Object -Unique)
    $restoredSubjects = @($restoredMachines | ForEach-Object { $_.config.env.EOS_RELEASE_SUBJECT } | Select-Object -Unique)
    if ($restoredImages.Count -ne 1 -or $restoredImages[0] -ne $rollbackImage -or $restoredSubjects.Count -ne 1 -or $restoredSubjects[0] -ne $rollbackSubject) { throw "Promotion failed and rollback returned without proving the prior immutable image and subject. Escalate immediately." }
    $env:EOS_EXPECTED_RELEASE_SUBJECT = $rollbackSubject
    npm run test:e2e:production
    if ($LASTEXITCODE -ne 0) { throw "Promotion failed and the restored image failed public health, identity, or security smoke. Escalate immediately." }
    npm run test:e2e:production:authenticated
    if ($LASTEXITCODE -ne 0) { throw "Promotion failed and the restored image failed signed-in role or tenant-isolation smoke. Escalate immediately." }
    throw "Promotion failed: $promotionError The prior immutable image was restored; inspect evidence before retrying."
  }

  New-Item -ItemType Directory -Force -Path ".tmp" | Out-Null
  @{
    standard = "eos.fly-promotion.v1"
    promotedAt = (Get-Date).ToUniversalTime().ToString("o")
    app = $app
    releaseCommit = $releaseCommit
    releaseSubject = $env:EOS_RELEASE_SUBJECT
    image = $promotedImage
    imageTag = $imageReference
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
