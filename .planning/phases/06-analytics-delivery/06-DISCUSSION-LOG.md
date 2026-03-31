# Phase 6: Analytics + Delivery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 06-analytics-delivery
**Areas discussed:** PostHog instrumentation, Hosting target, CI/CD pipeline shape, Feature flags + dashboards

---

## PostHog Instrumentation

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side only | PostHog JS SDK in React. Captures page views, clicks, form submissions from browser. | ✓ |
| Both client + server | JS SDK for UI events, Node SDK for backend events. | |
| You decide | Claude picks based on PageSpec events. | |

**User's choice:** Client-side only (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-inject via code mod | Generate module that adds posthog.capture() calls at trigger points. Same append-model as Phase 5. | ✓ |
| Wrapper component | TrackedPage wrapper with lifecycle-based tracking. | |
| You decide | Claude picks per PageSpec. | |

**User's choice:** Auto-inject via code mod (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Generate setup guide | Check for POSTHOG_API_KEY, guide user if missing. | ✓ |
| Assume pre-configured | User handles PostHog setup externally. | |
| You decide | Claude decides based on env detection. | |

**User's choice:** "depends on the user" — system detects env and branches accordingly
**Notes:** Setup guide generation depends on end user's configuration state, not a fixed choice.

---

**Additional context from user Q&A:**
- User asked "anything I'm missing?" — Claude flagged: (1) event naming convention (snake_case locked in), (2) auth-aware user identification (detect auth provider from codebase, generate appropriate posthog.identify() call).

---

## Hosting Target

| Option | Description | Selected |
|--------|-------------|----------|
| Interactive menu | Present hosting options with trade-offs, user picks, system generates configs. | ✓ |
| Config file driven | User specifies target in deploy.config.json. | |
| You decide | Claude picks hosting UX. | |

**User's choice:** Interactive menu (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Replit Autoscale | Current deployment target. | |
| VPS via Docker | Docker + docker-compose + SSH deploy. | |
| Railway/Render/Fly | PaaS platforms with Git-push deploy. | ✓ |
| Custom (user-defined) | User provides deploy script, system generates Docker image only. | ✓ |

**User's choice:** Railway/Render/Fly + Custom (user-defined)
**Notes:** No Replit Autoscale or raw VPS in v1.

---

**Additional context from user Q&A:**
- User asked "anything I'm missing?" — Claude flagged: (1) multi-stage Dockerfile generation, (2) platform-specific config files (railway.toml, render.yaml, fly.toml), (3) .env.example generation from codebase env scan. All locked in.

---

## CI/CD Pipeline Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Lint + type-check | tsc --noEmit | ✓ |
| Run test suite | npx vitest run | ✓ |
| Build | Vite + esbuild | ✓ |
| Deploy on merge to main | Auto-deploy with DEPLOY-05 gate | ✓ |

**User's choice:** "what do you think would be best?" — Claude recommended all four: type-check + test + build on PR, deploy on merge with staging gate.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Production only | Single environment. | |
| Staging + production | Two environments with promotion flow. | ✓ |
| You decide | Claude decides based on hosting target. | |

**User's choice:** Staging + production

---

**Additional context from user Q&A:**
- User asked "anything I'm missing?" — Claude flagged: deployment confirmation gate mechanism. Locked in dual gate: GitHub environment protection rule for CI deploys + CLI confirmation for manual deploys.

---

## Feature Flags + Dashboards

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-create via API | PostHog API creates flags from featureFlagCandidates. Start disabled. | ✓ |
| Generate flag config file | JSON/YAML for manual import. | |
| You decide | Claude picks based on PostHog API. | |

**User's choice:** Auto-create via API (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Page views per page | Track page traffic from PageSpec routes. | ✓ |
| Event counts | Track custom events from PageSpec analytics layer. | ✓ |
| Error tracking | Unhandled exceptions + API errors. | ✓ |
| User retention | DAU/WAU, requires posthog.identify(). | ✓ |

**User's choice:** All four dashboard components selected.

---

## Final Items

- Taxonomy audit before instrumentation — locked in (validates completeness of PageSpec analytics across all pages)
- Full deployment execution — locked in (system runs platform CLI, not just generates configs)

## Claude's Discretion

- PostHog SDK initialization placement (App.tsx provider vs individual page init)
- Error tracking configuration depth
- Dashboard layout and widget arrangement
- Whether to generate a health check endpoint
- Staging environment naming convention

## Deferred Ideas

None — discussion stayed within phase scope.
