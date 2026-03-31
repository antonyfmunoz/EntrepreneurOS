# Phase 6: Analytics + Delivery - Research

**Researched:** 2026-03-30
**Domain:** PostHog instrumentation (posthog-js React SDK), multi-platform deployment (Railway / Render / Fly.io), GitHub Actions CI/CD
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**PostHog Instrumentation Strategy**
- D-01: Client-side capture only. PostHog JS SDK in React. No server-side Node SDK in v1.
- D-02: Auto-inject via code mod. Generate a module that reads PageSpec `events` array and programmatically adds `posthog.capture()` calls. Same append-model as Phase 5 hook injection.
- D-03: PostHog setup detection. Check `POSTHOG_API_KEY` in `.env`. If missing, generate step-by-step setup guide. Deployment gate blocks without valid key.
- D-04: snake_case event naming convention. Normalize `events[].name` to snake_case during instrumentation.
- D-05: Auth-aware user identification. Detect auth provider from codebase and generate appropriate `posthog.identify(userId)` call on auth state change. If no auth detected, skip identify.

**Taxonomy Audit**
- D-06: Taxonomy audit before instrumentation. Read stored PageSpec analytics layers, validate completeness, flag gaps, generate taxonomy report for user review.

**Hosting Target**
- D-07: Interactive hosting menu with trade-offs shown before config generation.
- D-08: v1 targets: Railway, Render, Fly.io, Custom (Docker only). No Replit Autoscale or raw VPS.
- D-09: Multi-stage Dockerfile. Stage 1: Vite client + esbuild server build. Stage 2: Node.js production runtime with dist/ + node_modules.
- D-10: Platform-specific config generation: `railway.toml`, `render.yaml`, or `fly.toml` alongside Dockerfile.
- D-11: `.env.example` generation via scanning all `process.env.*` and `import.meta.env.*` references.

**CI/CD Pipeline**
- D-12: GitHub Actions CI: type-check (`tsc --noEmit`) + test (`npx vitest run`) + build (Vite + esbuild). All three on every PR push.
- D-13: Staging + production environments. Merge to main: auto-deploy staging. Promote to production: manual approval gate via GitHub environment protection rule.
- D-14: Dual gate: GitHub environment protection rule for CI deploys, CLI confirmation before manual deploys.

**Feature Flags + Dashboard**
- D-15: Auto-create feature flags via PostHog API from `featureFlagCandidates` in PageSpec. Flags start disabled (0% rollout).
- D-16: Baseline dashboard: page views per page, event counts, error tracking, user retention (DAU/WAU).

**Deployment Execution**
- D-17: Full deployment execution — runs actual platform CLI (`railway up`, `render deploy`, `fly deploy`) or custom script. Confirmation gate fires immediately before.

### Claude's Discretion
- PostHog SDK initialization placement (App.tsx provider vs individual page init)
- Error tracking configuration depth (just capture vs custom error boundaries)
- Dashboard layout and widget arrangement
- Whether to generate a health check endpoint for the hosting platform
- Staging environment naming convention

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANLYT-01 | System defines event taxonomy during spec parsing (before implementation) | D-06 taxonomy audit reads existing PageSpec analytics layers from pipeline_pages; validated completeness check, gap report |
| ANLYT-02 | System instruments PostHog event capture during page integration (not as afterthought) | D-02 code-mod injection into page components following Phase 5 hook-injector pattern; posthog-js 1.364.2 client-side capture API |
| ANLYT-03 | System sets up PostHog feature flags, error tracking, and dashboards | D-15 API-driven flag creation; PostHog captureException for error tracking; D-16 baseline dashboard config |
| DEPLOY-01 | System guides user through hosting decisions | D-07/D-08 interactive hosting menu — Railway/Render/Fly.io/Custom with trade-off display |
| DEPLOY-02 | System generates Docker/docker-compose configs for chosen hosting | D-09/D-10 multi-stage Dockerfile + platform config (railway.toml / render.yaml / fly.toml / docker-compose.yml) |
| DEPLOY-03 | System generates CI/CD pipeline (GitHub Actions) | D-12/D-13/D-14 three-job CI workflow + environment protection gate for production |
| DEPLOY-04 | System can execute full deployment to configured target | D-17 run platform CLI after config generation |
| DEPLOY-05 | Deployment requires explicit user confirmation gate | D-14 dual gate: GitHub environment protection rule + CLI prompt before execution |
</phase_requirements>

---

## Summary

Phase 6 has two independent tracks that merge into a single commit: analytics instrumentation and deployment infrastructure. The analytics track reads PageSpec analytics layers already defined in Phases 2-5, validates their completeness, injects `posthog.capture()` calls into page components (same code-mod append model as Phase 5), sets up PostHog via its REST API (feature flags, error tracking), and writes a baseline dashboard. The deployment track presents a hosting menu, generates a multi-stage Dockerfile plus platform config, generates a GitHub Actions workflow, and executes the actual deploy after an explicit confirmation gate.

The codebase already has the full foundation: PageSpecAnalytics schema in `shared/spec-schema.ts`, the wiring-applier pattern in `lib/backend-wirer/wiring-applier.ts`, the hook-injector append model in `lib/backend-wirer/hook-injector.ts`, auth via Firebase in `client/src/hooks/use-auth.tsx`, and the App.tsx root in `client/src/App.tsx` where PostHogProvider should wrap. No CI/CD infrastructure, no Dockerfile, and no posthog-js dependency exist yet — all are Wave 0 or Wave 1 additions.

**Primary recommendation:** Build `lib/analytics-delivery/` with six modules mirroring the backend-wirer structure, using posthog-js 1.364.2 (latest verified 2026-03-30), and generate config files for all three hosting targets as static templates rather than AI-generated output — config files are small, deterministic, and testable without live platform credentials.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| posthog-js | 1.364.2 | PostHog client SDK, event capture, identify, feature flags, error tracking | Official PostHog React SDK — PostHogProvider wraps app, usePostHog hook for captures |
| posthog-js (React subpackage) | bundled with posthog-js | PostHogProvider component, usePostHog hook | React integration layer is part of the main posthog-js package as of v1 |

**Version verified:** `npm view posthog-js version` returned `1.364.2` on 2026-03-30.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node-fetch / https (stdlib) | stdlib | PostHog Management API calls for feature flag creation | Script-only; no new dep needed — Node 20 has native fetch |
| @actions/core | latest | GitHub Actions output helpers | Only if generating custom Actions scripts (not needed for yaml generation) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| posthog-js client-side only | posthog-node server-side | D-01 locked client-side only for v1 |
| GitHub Actions manual gate | Separate approval tool | GitHub environment protection rules are free, native to the repo — no external service needed |

**Installation:**
```bash
npm install posthog-js
```

**Version verification:**
```bash
npm view posthog-js version
# Returns: 1.364.2
```

---

## Architecture Patterns

### Recommended Project Structure

```
lib/
└── analytics-delivery/
    ├── types.ts                    # AnalyticsInjection, AnalyticsPlan, TaxonomyReport, DeployConfig types
    ├── taxonomy-auditor.ts         # Read PageSpec analytics layers, validate completeness, produce TaxonomyReport
    ├── analytics-injector.ts       # Code-mod: inject posthog.capture() into page components (extends hook-injector pattern)
    ├── posthog-setup.ts            # Check POSTHOG_API_KEY, create feature flags via API, generate setup guide
    ├── docker-config-generator.ts  # Generate Dockerfile + platform configs (railway.toml / render.yaml / fly.toml / docker-compose.yml)
    ├── github-actions-generator.ts # Generate .github/workflows/ci.yml and cd.yml
    ├── env-scanner.ts              # Scan process.env.* and import.meta.env.* references, generate .env.example
    └── deploy-runner.ts            # Confirmation gate + platform CLI execution

.github/
└── workflows/
    ├── ci.yml                      # type-check + test + build on PR push (generated)
    └── cd.yml                      # staging auto-deploy + production manual gate (generated)

Dockerfile                          # multi-stage build (generated)
docker-compose.yml                  # custom target only (generated)
railway.toml | render.yaml | fly.toml  # platform config (generated, one per target)
.env.example                        # scanned env vars (generated)

.claude/skills/saas-dev/
└── analytics-delivery/
    └── SKILL.md                    # Phase 6 skill definition
```

### Pattern 1: PostHog Provider in App.tsx (Claude's discretion — recommended)

**What:** Wrap the React root with PostHogProvider in `client/src/App.tsx`, injecting VITE_POSTHOG_API_KEY and VITE_POSTHOG_HOST from env.
**When to use:** Always. Centralizing PostHog init in App.tsx ensures it is available before any page renders, enabling auto-capture from first navigation.

```typescript
// Source: PostHog React docs (posthog.com/docs/libraries/react)
// Injected at top of client/src/App.tsx using the same append-model as Phase 5

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

// Init before provider (D-01: client-side only)
if (import.meta.env.VITE_POSTHOG_API_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_API_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? "https://app.posthog.com",
    defaults: "2025-05-24",         // recommended defaults preset
    capture_pageview: true,          // auto-capture page views
    capture_pageleave: true,
  });
}

// In the JSX tree: wrap QueryClientProvider (or root) with PostHogProvider
<PostHogProvider client={posthog}>
  {/* existing tree */}
</PostHogProvider>
```

### Pattern 2: Analytics Injection (extends hook-injector)

**What:** For each page file that has `events` in its PageSpec, inject `posthog.capture()` calls into the component body and add the posthog import — same offset-based string splicing as `wiring-applier.ts`.
**When to use:** During instrumentation pass over all page components.

```typescript
// Source: lib/backend-wirer/hook-injector.ts pattern (verified in codebase)
// Key: normalize event names to snake_case per D-04

function toSnakeCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

// Import to inject (after last import in file)
const analyticsImport = `import { usePostHog } from "posthog-js/react";`;

// Hook code to inject (after component function body open "{")
const hookCode = `const posthog = usePostHog();`;

// Event capture to inject at trigger site — currently: append as useEffect for page_viewed events
// For trigger-specific events (button clicks): document in TaxonomyReport as manual placement needed
const pageViewCapture = `
useEffect(() => {
  posthog?.capture("${toSnakeCase(event.name)}", { ${event.properties.map(p => `${p}: undefined`).join(", ")} });
}, []);
`;
```

### Pattern 3: Auth-Aware identify (D-05)

**What:** System detects Firebase in codebase (check for `use-auth.tsx` importing `firebase/auth`) and injects `posthog.identify()` into the auth state change listener.
**When to use:** When Firebase or Passport auth is detected.

```typescript
// Source: PostHog docs identify + existing use-auth.tsx pattern
// Inject into the onAuthStateChanged callback (or useEffect that watches user state)

// Detection: grep for "onAuthStateChanged" OR "useEffect.*user" in hooks/use-auth.tsx
// Injection location: inside the callback where user object becomes available

posthog.identify(user.id, {
  email: user.email,
  name: user.username,
});

// On logout: call posthog.reset() to clear identity
posthog.reset();
```

### Pattern 4: Feature Flag Creation via PostHog REST API (D-15)

**What:** Use Node's native fetch (Node 20+) to POST to PostHog management API, creating one flag per `featureFlagCandidates` entry.
**When to use:** After POSTHOG_API_KEY + POSTHOG_PROJECT_ID are confirmed present.

```typescript
// Source: PostHog feature flags API docs (posthog.com/docs/api/feature-flags)
// Auth: Authorization: Bearer {POSTHOG_PERSONAL_API_KEY}
// Endpoint: POST /api/projects/{project_id}/feature_flags/

const response = await fetch(
  `https://app.posthog.com/api/projects/${projectId}/feature_flags/`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${personalApiKey}`,
    },
    body: JSON.stringify({
      key: toSnakeCase(flagName),
      name: flagName,
      active: false,               // starts disabled per D-15
      filters: {
        groups: [{ rollout_percentage: 0 }],  // 0% rollout
      },
    }),
  }
);
```

**Important:** Two separate PostHog keys are needed:
- `VITE_POSTHOG_API_KEY` — project (public) key for client-side capture
- `POSTHOG_PERSONAL_API_KEY` — personal API key (prefixed `phx_`) for management API (flag creation). Never exposed to client; server/script only.
- `POSTHOG_PROJECT_ID` — numeric project ID found in PostHog Project Settings

### Pattern 5: Multi-Stage Dockerfile for Vite + Express + Node 20

**What:** Two-stage build: builder installs and compiles, runner copies only dist/ artifacts.
**When to use:** All hosting targets except Custom (which gets docker-compose.yml instead of platform config).

```dockerfile
# Source: Standard Node.js multi-stage pattern (multiple verified sources 2025-2026)
# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# npm run build = vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Stage 2: Run
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 5000
CMD ["node", "dist/index.js"]
```

**Note:** The existing `npm run build` script in package.json is `vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`. The Vite client builds to `dist/public/`, server to `dist/index.js`. The runner stage needs both.

### Pattern 6: GitHub Actions CI/CD Workflow

**What:** Two workflow files — `ci.yml` for type-check/test/build on every PR push, `cd.yml` for staging + production deployment with environment gate.

```yaml
# Source: GitHub Actions docs + verified CI patterns 2025-2026
# .github/workflows/ci.yml

name: CI
on:
  push:
    branches-ignore: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run check          # tsc --noEmit (existing "check" script in package.json)
      - run: npm test               # npx vitest run
      - run: npm run build          # vite build + esbuild
```

```yaml
# .github/workflows/cd.yml

name: CD
on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging           # GitHub environment — no protection rules by default
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run build
      # Platform CLI deploy step (Railway / Render / Fly / custom)

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production        # GitHub environment — required reviewers set here (D-13/D-14)
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run build
      # Platform CLI deploy step
```

**Key:** The `environment: production` job field paired with a GitHub "production" environment configured with Required Reviewers is the mechanism for D-14's deployment gate. GitHub pauses the job and notifies reviewers. No deploy executes until approved.

### Pattern 7: Platform Config Files

**railway.toml:**
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "node dist/index.js"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

**render.yaml:**
```yaml
services:
  - type: web
    name: app
    runtime: docker
    dockerfilePath: ./Dockerfile
    envVars:
      - key: NODE_ENV
        value: production
    healthCheckPath: /health
```

**fly.toml:**
```toml
[build]

[http_service]
  internal_port = 5000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
```

### Anti-Patterns to Avoid

- **PostHog initialized multiple times:** Calling `posthog.init()` more than once per page load causes duplicate events. Guard with `if (!posthog.__loaded)` or the `PostHogProvider client=` prop approach — only init once, in App.tsx.
- **Hardcoding POSTHOG_API_KEY in source:** Must use `VITE_POSTHOG_API_KEY` env var. Never hardcode. The `.env.example` generator (D-11) reminds users to add these.
- **Using personal API key on the client:** `POSTHOG_PERSONAL_API_KEY` is for server/script use only. The client-side SDK uses the project (public) API key.
- **Blocking deployment on PostHog API failure:** Feature flag creation failures should log a warning and continue — the app must deploy even if flag creation fails. PostHog is observability, not a hard dependency.
- **snake_case normalization happening after storage:** Per D-04, normalize event names to snake_case at instrumentation time (when writing the code), not at capture time. This ensures the stored code and the PostHog dashboard keys match.
- **CI running `npm install` instead of `npm ci`:** The `npm ci` command is required in CI because it uses package-lock.json exactly; `npm install` can silently resolve to different versions.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event capture in React | Custom window.addEventListener wrapper | `usePostHog()` hook + `posthog.capture()` | PostHog handles session replay, person profiles, properties automatically |
| Error tracking | Custom try/catch with window.onerror | `posthog.captureException(error)` or PostHogErrorBoundary | Handles stack trace processing, source map integration, correct `$exception` event format |
| Feature flag evaluation client-side | Custom localStorage flags | `posthog.isFeatureEnabled(flag)` | PostHog evaluates flags with rollout %, user targeting, A/B groups built-in |
| CI/CD approval gates | Custom Slack bot or webhook | GitHub environment protection rules (Required Reviewers) | Native to GitHub, free on all plans, no external service needed |
| env var scanning | Manual audit | Regex scan of `process\.env\.(\w+)` and `import\.meta\.env\.(\w+)` | Brown-field audit pattern established in Phase 5 (`brownfield-backend-audit.ts`) |

**Key insight:** PostHog is full-stack analytics in one SDK. Every custom implementation of events, flags, or errors will diverge from PostHog's event schema and break dashboard widgets. Always delegate to the SDK.

---

## Common Pitfalls

### Pitfall 1: posthog.capture() Called Before init()
**What goes wrong:** Events silently drop — no error, no network call, nothing in PostHog.
**Why it happens:** Page component mounts before App.tsx PostHogProvider tree is ready, or posthog-js imported directly (not via `usePostHog`) in a component that renders before provider.
**How to avoid:** Always use `usePostHog()` hook — it returns null until provider is ready, enabling null guard. Never import `posthog` directly from `posthog-js` in components.
**Warning signs:** Events missing in PostHog Live Events view despite successful init log.

### Pitfall 2: Taxonomy Gaps — Pages With No Events Defined
**What goes wrong:** Instrumentation pass completes, no posthog.capture() calls injected for pages with empty `events: []`, user gets a PostHog dashboard with blank cards.
**Why it happens:** Phase 2 spec parser may have set events to default empty array for some pages.
**How to avoid:** D-06 taxonomy audit runs before instrumentation. TaxonomyReport flags every page where `events.length === 0` and presents it to user before injection begins. User can abort and add events manually to the spec.
**Warning signs:** TaxonomyReport shows pages with 0 events.

### Pitfall 3: Docker Build Fails — dist/public/ Missing
**What goes wrong:** Vite output goes to `dist/public/` (static assets), but Node server expects to serve from that path. If Vite build is skipped or misconfigured, the runner stage has no static files.
**Why it happens:** The existing `npm run build` command runs `vite build && esbuild server/index.ts`. If either fails, dist/index.js may exist but dist/public/ is empty.
**How to avoid:** The Dockerfile RUN step must be `RUN npm run build` not `RUN npx esbuild...` directly. Validate build step locally before pushing. Add a health check endpoint that returns 200 — Docker / hosting platform will surface a 502 if static files are broken.
**Warning signs:** Platform reports container started but returns 5xx on all routes.

### Pitfall 4: GitHub Environment Protection Rules Require Repository Settings Access
**What goes wrong:** The generated CD workflow references `environment: production`, but the GitHub repository has no "production" environment configured. The workflow runs without pausing — no approval gate fires.
**Why it happens:** GitHub environment protection rules are configured per-repo in Settings > Environments, not in the workflow YAML itself. The YAML only references an environment name.
**How to avoid:** The SKILL.md / deployer output must include explicit instructions (not just YAML) telling the user to: (1) go to repo Settings > Environments, (2) create `production` environment, (3) add Required Reviewers. This is a manual human step — it cannot be automated by the system.
**Warning signs:** CD workflow completes `deploy-production` without pausing for approval.

### Pitfall 5: .env.example Scanner Misses Nested process.env References
**What goes wrong:** Some env vars are accessed as `process.env["SOME_KEY"]` (bracket notation) instead of `process.env.SOME_KEY`. Regex that only matches dot notation misses them.
**Why it happens:** Bracket notation is valid JavaScript and used in some patterns in the codebase.
**How to avoid:** Extend `brownfield-backend-audit.ts` env var scanning pattern to include both `process\.env\.(\w+)` and `process\.env\["(\w+)"\]` and `import\.meta\.env\.(\w+)`. Also scan `.env.example` if it already exists to merge, not overwrite.
**Warning signs:** Deployed app fails at startup with `undefined` for required env var that wasn't in `.env.example`.

### Pitfall 6: Railway/Render/Fly CLI Not Available on Target Machine
**What goes wrong:** D-17 calls `railway up` or `fly deploy` but the CLI is not installed locally or in the CI runner.
**Why it happens:** Railway CLI and Fly CLI require separate installs. They are not in npm packages.
**How to avoid:** For CI deployment, install platform CLI in the GitHub Actions step (e.g., `npm install -g @railway/cli` for Railway). For local/manual deploy, the SKILL.md must document CLI install steps per platform. The deploy-runner.ts should check if CLI binary exists before attempting execution, and fail gracefully with install instructions if missing.
**Warning signs:** `Error: command not found: railway`.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Taxonomy Audit — Read PageSpec Analytics from pipeline_pages
```typescript
// Source: Phase 5 backend-wirer pipeline Step 1 pattern (verified in SKILL.md)
// Query all complete spec-phase pages and extract analytics layers

const pages = await db.select().from(pipelinePages)
  .where(and(
    eq(pipelinePages.runId, runId),
    eq(pipelinePages.phase, "spec"),
    eq(pipelinePages.status, "complete")
  ));

const pageSpecs: PageSpecFull[] = pages.map(p =>
  PageSpecFull.parse(JSON.parse(p.output))
);

// Audit
const gaps = pageSpecs.filter(p => p.events.length === 0).map(p => p.name);
const report: TaxonomyReport = {
  totalPages: pageSpecs.length,
  pagesWithEvents: pageSpecs.filter(p => p.events.length > 0).length,
  pagesWithoutEvents: gaps,
  totalEvents: pageSpecs.flatMap(p => p.events).length,
  allFlagCandidates: pageSpecs.flatMap(p => p.featureFlagCandidates),
};
```

### Event Name Normalization — snake_case (D-04)
```typescript
// Source: D-04 decision + standard snake_case convention
function toSnakeCase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}
// "Page Viewed" → "page_viewed"
// "form-submitted" → "form_submitted"
// "Button Click!" → "button_click"
```

### Analytics Injection — Reusing wiring-applier append model
```typescript
// Source: lib/backend-wirer/wiring-applier.ts findComponentBodyOpen pattern (verified)
// Inject posthog import + usePostHog hook + useEffect captures into page files

export interface AnalyticsInjection {
  pageFilePath: string;
  importCode: string;    // "import { usePostHog } from 'posthog-js/react';"
  hookCode: string;      // "const posthog = usePostHog();"
  captureCode: string;   // useEffect blocks for each event
}

// Insertion uses same pattern as wiring-applier.ts:
// 1. Add importCode after last import (lastIndexOf("\nimport "))
// 2. Add hookCode + captureCode after component body open "{"
//    (findComponentBodyOpen from wiring-applier.ts can be reused directly)
```

### env Var Scanner
```typescript
// Source: D-11 + brownfield-backend-audit.ts scanning pattern (verified in codebase)
import { readdir, readFile } from "fs/promises";
import { join } from "path";

const ENV_PATTERNS = [
  /process\.env\.(\w+)/g,
  /process\.env\["(\w+)"\]/g,
  /import\.meta\.env\.(\w+)/g,
];

async function scanEnvVars(projectRoot: string): Promise<Set<string>> {
  const vars = new Set<string>();
  // Recursively walk .ts, .tsx, .js files in client/ and server/
  // For each file, apply all ENV_PATTERNS and collect matches
  return vars;
}
```

### Feature Flag Creation via PostHog API
```typescript
// Source: PostHog Feature Flags API reference (posthog.com/docs/api/feature-flags)
// Requires: POSTHOG_PERSONAL_API_KEY (phx_...) + POSTHOG_PROJECT_ID

async function createFeatureFlag(
  flagName: string,
  personalApiKey: string,
  projectId: string,
): Promise<void> {
  const key = toSnakeCase(flagName);
  const res = await fetch(
    `https://app.posthog.com/api/projects/${projectId}/feature_flags/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${personalApiKey}`,
      },
      body: JSON.stringify({
        key,
        name: flagName,
        active: false,
        filters: { groups: [{ rollout_percentage: 0 }] },
      }),
    }
  );
  if (!res.ok) {
    console.warn(`Failed to create flag "${key}": ${res.status}`);
    // Non-blocking — continue even if flag creation fails (Pitfall note)
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| posthog.init() directly in index.html | PostHogProvider wrapper in App.tsx root | posthog-js v1 React package | Provider pattern ensures hooks work throughout tree |
| posthog.init() per-page | Single init in PostHogProvider at app root | posthog-js React package | Prevents duplicate initialization |
| Custom Dockerfile CMD with node | Multi-stage build with `node:20-slim` | Node 20 LTS (2023+) | Smaller image, --omit=dev removes devDependencies |
| Heroku for Node.js hosting | Railway / Render / Fly.io | Heroku ended free tier 2022 | These three are the current standard for affordable Node PaaS |
| GitHub Actions `set-output` | `$GITHUB_OUTPUT` env file | GitHub Actions 2022 | Old set-output deprecated |

**Deprecated/outdated:**
- `posthog.people.set()`: replaced by `posthog.identify(id, properties)` in current SDK
- `posthog.alias()`: still exists but rarely needed for SaaS use case — identify handles the common case
- Railway NIXPACKS builder for Dockerfile: railway.toml with `builder = "DOCKERFILE"` required when Dockerfile exists, else Railway auto-selects NIXPACKS

---

## Open Questions

1. **Health check endpoint availability**
   - What we know: All three hosting platforms (Railway, Render, Fly.io) support configuring a health check HTTP path. The existing `server/index.ts` has no `/health` endpoint.
   - What's unclear: Whether the planner should add health check endpoint generation as a sub-task (Claude's discretion per CONTEXT.md).
   - Recommendation: Generate a simple `/health` endpoint as part of Docker config generation — it is trivial (5 lines in routes.ts), dramatically improves platform reliability, and all three platform configs reference it.

2. **posthog.identify() injection location in use-auth.tsx**
   - What we know: `use-auth.tsx` uses `onAuthStateChanged` for Firebase auth state and a separate `useQuery` for session auth. Both paths must call identify.
   - What's unclear: Whether both paths need separate injection points or a single effect watching the `user` state is sufficient.
   - Recommendation: Use the auth context's existing `user` state — inject a `useEffect(() => { if (user) posthog.identify(user.id, ...); else posthog.reset(); }, [user])` at the AuthProvider level. This covers both Firebase and Passport auth paths since both set the same `user` state.

3. **PostHog dashboard creation via API vs manual**
   - What we know: D-16 requires a baseline dashboard. PostHog has a dashboards API, but creating dashboard widgets programmatically requires complex nested JSON structures that are undocumented in official API reference.
   - What's unclear: Whether the API can reliably create a complete pre-configured dashboard with multiple insight widgets.
   - Recommendation: Generate dashboard creation instructions as a human-readable markdown doc (e.g., `docs/posthog-dashboard-setup.md`) rather than attempting API automation for the dashboard. Feature flags (simpler API) get automated; dashboard setup gets documented. This avoids brittle undocumented API usage.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20+ | Build, server runtime | ✓ | v24.14.0 | — |
| npm | Dependency install | ✓ | present | — |
| vitest | Test runner (CI) | ✓ | ^2.1.9 | — |
| TypeScript tsc | Type check (CI, D-12) | ✓ | 5.6.3 | — |
| Docker | Container build (DEPLOY-02) | not checked | — | Fallback: generate Dockerfile, document `docker build` steps |
| railway CLI | Deploy to Railway (D-17) | not checked | — | Document install: `npm install -g @railway/cli` |
| fly CLI (flyctl) | Deploy to Fly.io (D-17) | not checked | — | Document install: `curl -L https://fly.io/install.sh | sh` |
| render CLI | Deploy to Render (D-17) | not checked | — | Render supports GitHub auto-deploy; CLI is optional |
| POSTHOG_API_KEY | Analytics capture | not checked | — | D-03: generate setup guide if missing; gate deployment |
| POSTHOG_PERSONAL_API_KEY | Flag creation API | not checked | — | Non-blocking if absent — log warning, skip flag creation |
| POSTHOG_PROJECT_ID | Flag creation API | not checked | — | Same — skip flag creation, surface warning |

**Missing dependencies with no fallback:**
- None that would block the code generation tasks. The system generates config files and code whether or not platform CLIs are available.

**Missing dependencies with fallback:**
- Platform CLIs (Railway, Fly, Render): deploy-runner.ts checks for binary before executing, surfaces install instructions if missing.
- PostHog credentials: setup detection (D-03) handles missing keys gracefully.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vitest.config.ts` (exists — single node env) |
| Quick run command | `npx vitest run tests/unit/analytics-delivery/` |
| Full suite command | `npm test` (runs all 268+ tests) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANLYT-01 | `taxonomyAuditor` reads PageSpec analytics, produces TaxonomyReport with correct gap counts | unit | `npx vitest run tests/unit/analytics-delivery/taxonomy-auditor.test.ts -x` | ❌ Wave 0 |
| ANLYT-02 | `analyticsInjector` injects posthog import + hook + capture into page file | unit | `npx vitest run tests/unit/analytics-delivery/analytics-injector.test.ts -x` | ❌ Wave 0 |
| ANLYT-03 | `posthogSetup` detects missing key, generates guide; creates feature flags via API mock | unit | `npx vitest run tests/unit/analytics-delivery/posthog-setup.test.ts -x` | ❌ Wave 0 |
| DEPLOY-01 | Hosting menu returns correct target config type per user selection | unit | `npx vitest run tests/unit/analytics-delivery/docker-config-generator.test.ts -x` | ❌ Wave 0 |
| DEPLOY-02 | Dockerfile + platform config files generated with correct content per target | unit | `npx vitest run tests/unit/analytics-delivery/docker-config-generator.test.ts -x` | ❌ Wave 0 |
| DEPLOY-03 | GitHub Actions YAML generated with correct jobs, steps, environment references | unit | `npx vitest run tests/unit/analytics-delivery/github-actions-generator.test.ts -x` | ❌ Wave 0 |
| DEPLOY-04 | `deployRunner` invokes correct CLI command for selected target | unit (mock exec) | `npx vitest run tests/unit/analytics-delivery/deploy-runner.test.ts -x` | ❌ Wave 0 |
| DEPLOY-05 | `deployRunner` prompts for confirmation and aborts if not confirmed | unit | `npx vitest run tests/unit/analytics-delivery/deploy-runner.test.ts -x` | ❌ Wave 0 |
| ANLYT-01/02 | `envScanner` finds process.env + import.meta.env vars, generates .env.example | unit | `npx vitest run tests/unit/analytics-delivery/env-scanner.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/analytics-delivery/`
- **Per wave merge:** `npm test` (full suite — must keep 268+ passing)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/analytics-delivery/taxonomy-auditor.test.ts` — covers ANLYT-01
- [ ] `tests/unit/analytics-delivery/analytics-injector.test.ts` — covers ANLYT-02
- [ ] `tests/unit/analytics-delivery/posthog-setup.test.ts` — covers ANLYT-03
- [ ] `tests/unit/analytics-delivery/docker-config-generator.test.ts` — covers DEPLOY-01, DEPLOY-02
- [ ] `tests/unit/analytics-delivery/github-actions-generator.test.ts` — covers DEPLOY-03
- [ ] `tests/unit/analytics-delivery/deploy-runner.test.ts` — covers DEPLOY-04, DEPLOY-05
- [ ] `tests/unit/analytics-delivery/env-scanner.test.ts` — covers D-11 (.env.example generation)

---

## Project Constraints (from CLAUDE.md)

Directives from `./CLAUDE.md` that the planner must enforce:

| Directive | Impact on Phase 6 |
|-----------|-------------------|
| Real code only — never pseudocode, never placeholders | All generated files (Dockerfile, YAML, platform configs) must be fully executable, not template stubs |
| Secrets always in .env — never committed, never hardcoded | POSTHOG_API_KEY, POSTHOG_PERSONAL_API_KEY must never appear in generated source files; only in .env.example with placeholder values |
| TypeScript 5.6.3 + strict: true | All new lib/analytics-delivery/*.ts files must pass `tsc --noEmit` with existing tsconfig.json |
| Vitest ^2.1.9 pinned | Tests use vitest@2 API only — no `test.projects`, no `vitest@4` features |
| Express 4.21.2 | Health check endpoint (if generated) uses Express router, not Hono or other |
| Kebab-case for files | lib/analytics-delivery/taxonomy-auditor.ts, not taxonomyAuditor.ts |
| Named exports for utilities | `export function auditTaxonomy()` not `export default` |
| GSD workflow enforcement | Changes go through GSD plan before execution |
| VITE_ prefix for client env vars | `VITE_POSTHOG_API_KEY` on client, `POSTHOG_PERSONAL_API_KEY` server-only |
| Append-model (Phases 4-5 established) | Analytics injection is additive — never refactors existing page component code |

---

## Sources

### Primary (HIGH confidence)
- PostHog React docs (posthog.com/docs/libraries/react) — PostHogProvider API, usePostHog hook, capture, identify patterns
- PostHog feature flags API (posthog.com/docs/api/feature-flags) — create endpoint, personal API key auth, 0% rollout body
- PostHog error tracking (posthog.com/docs/error-tracking/capture) — captureException, PostHogErrorBoundary
- GitHub Actions environments docs (docs.github.com/en/actions) — Required Reviewers gate mechanism
- `lib/backend-wirer/wiring-applier.ts` — append-model, offset-based injection (verified in codebase)
- `lib/backend-wirer/hook-injector.ts` — import injection pattern (verified in codebase)
- `shared/spec-schema.ts` — PageSpecAnalytics.events, featureFlagCandidates (verified in codebase)
- `package.json` — existing scripts: `check` (tsc), `test` (vitest run), `build` (vite + esbuild)
- `npm view posthog-js version` → 1.364.2 (verified 2026-03-30)

### Secondary (MEDIUM confidence)
- pkgpulse.com/blog/railway-vs-render-vs-fly-io (2026) — platform comparison, current status of Railway/Render/Fly as standard Node.js PaaS
- Multiple 2025-2026 sources on multi-stage Dockerfile for Vite + Node.js — consistent two-stage pattern (builder + runner)
- GitHub Actions CI patterns with `npm ci`, Node 20, vitest — cross-verified across 3+ sources

### Tertiary (LOW confidence)
- PostHog dashboard API programmatic creation — no official documented endpoint found for full dashboard widget creation; marked as manual step recommendation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — posthog-js version verified from npm registry; platform choices verified via multiple 2025-2026 sources
- Architecture: HIGH — module structure mirrors existing Phase 5 backend-wirer pattern directly; patterns verified in codebase
- Pitfalls: HIGH — pitfalls 1-4 from official docs/codebase inspection; pitfalls 5-6 from verified community sources
- PostHog Management API: MEDIUM — endpoint structure verified, but dashboard widget API is LOW (undocumented)

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (posthog-js releases frequently; verify version before install)
