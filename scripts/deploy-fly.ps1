$ErrorActionPreference = "Stop"

$required = @(
  "ANTHROPIC_API_KEY",
  "VITE_CLERK_PUBLISHABLE_KEY"
)

foreach ($name in $required) {
  if (-not [Environment]::GetEnvironmentVariable($name)) {
    throw "Missing required release variable: $name"
  }
}

$posthogKey = [string]$env:POSTHOG_API_KEY
$validPosthogKey = $posthogKey.StartsWith("phc_") -and -not $posthogKey.ToLowerInvariant().Contains("placeholder")
if ($validPosthogKey) {
  flyctl secrets set --app eos-app --stage `
    "ANTHROPIC_API_KEY=$env:ANTHROPIC_API_KEY" `
    "POSTHOG_API_KEY=$posthogKey"
} else {
  flyctl secrets set --app eos-app --stage "ANTHROPIC_API_KEY=$env:ANTHROPIC_API_KEY"
  if ($LASTEXITCODE -eq 0) { flyctl secrets unset --app eos-app --stage POSTHOG_API_KEY }
}

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

flyctl deploy --app eos-app `
  --build-arg "VITE_CLERK_PUBLISHABLE_KEY=$env:VITE_CLERK_PUBLISHABLE_KEY" `
  --build-arg "VITE_POSTHOG_API_KEY=$env:VITE_POSTHOG_API_KEY"

exit $LASTEXITCODE
