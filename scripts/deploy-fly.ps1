$ErrorActionPreference = "Stop"

$required = @(
  "ANTHROPIC_API_KEY",
  "POSTHOG_API_KEY",
  "VITE_CLERK_PUBLISHABLE_KEY",
  "VITE_POSTHOG_API_KEY"
)

foreach ($name in $required) {
  if (-not [Environment]::GetEnvironmentVariable($name)) {
    throw "Missing required release variable: $name"
  }
}

@(
  "ANTHROPIC_API_KEY=$env:ANTHROPIC_API_KEY"
  "POSTHOG_API_KEY=$env:POSTHOG_API_KEY"
) | flyctl secrets import --app eos-app --stage

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

flyctl deploy --app eos-app `
  --build-arg "VITE_CLERK_PUBLISHABLE_KEY=$env:VITE_CLERK_PUBLISHABLE_KEY" `
  --build-arg "VITE_POSTHOG_API_KEY=$env:VITE_POSTHOG_API_KEY"

exit $LASTEXITCODE
