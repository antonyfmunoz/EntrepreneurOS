# Phase 6: Analytics + Delivery - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

The finished, tested app is instrumented with meaningful PostHog analytics (events, feature flags, error tracking, baseline dashboard) and deployed to the user's chosen hosting target with explicit confirmation gates at every deployment step. This phase takes the wired backend+frontend from Phase 5 and adds observability + delivery infrastructure.

Does NOT include: app feature development (Phases 1-5 handle this), monitoring/alerting beyond PostHog error tracking, multi-region deployment, CDN configuration, or custom domain setup.

</domain>

<decisions>
## Implementation Decisions

### PostHog Instrumentation Strategy
- **D-01:** Client-side capture only. PostHog JS SDK in React. Captures page views, clicks, form submissions from the browser. No server-side Node SDK in v1.
- **D-02:** Auto-inject via code mod. Generate a module that reads PageSpec `events` array and programmatically adds `posthog.capture()` calls at the right trigger points in existing page components. Same append-model as Phase 5 hook injection.
- **D-03:** PostHog setup detection. System checks for `POSTHOG_API_KEY` in `.env`. If missing, generates a step-by-step setup guide (create PostHog project, get API key, add to .env). If present, skips setup. Deployment gate blocks without a valid key.
- **D-04:** snake_case event naming convention. All PostHog events use snake_case (e.g., `page_viewed`, `form_submitted`). PostHog default, avoids dashboard formatting issues. PageSpec `events[].name` values are normalized to snake_case during instrumentation.
- **D-05:** Auth-aware user identification. System detects auth provider from codebase (Firebase, Passport, etc.) and generates appropriate `posthog.identify(userId)` call on auth state change. If no auth detected, skip identify and capture anonymous events only.

### Taxonomy Audit
- **D-06:** Taxonomy audit before instrumentation. Module reads stored PageSpec analytics layers across all pages, validates completeness (every page has events defined), flags gaps, and generates a taxonomy report the user can review before events get wired. Prevents silently instrumenting an incomplete taxonomy.

### Hosting Target
- **D-07:** Interactive hosting menu. System presents hosting options with trade-offs (cost, complexity, scaling), user picks one, system generates configs for that target. Matches the human-oversight philosophy.
- **D-08:** v1 hosting targets: Railway, Render, Fly.io, and Custom (user-defined). No Replit Autoscale or raw VPS in v1. Custom target means system generates Docker image only; user provides their own deploy script.
- **D-09:** Multi-stage Dockerfile. Stage 1 builds Vite client + esbuild server. Stage 2 runs production Node image with just `dist/` and `node_modules`. Standard for Node.js + Vite + Express stack.
- **D-10:** Platform-specific config generation. System generates `railway.toml`, `render.yaml`, or `fly.toml` alongside Dockerfile based on user's hosting choice. Custom target gets Dockerfile + `docker-compose.yml` only.
- **D-11:** `.env.example` generation. System scans codebase for all `process.env.*` and `import.meta.env.*` references and generates a `.env.example` listing all required vars with descriptions.

### CI/CD Pipeline
- **D-12:** GitHub Actions CI steps: type-check (`tsc --noEmit`) + test (`npx vitest run`) + build (Vite + esbuild). All three run on every PR push. Blocks merge if any fail.
- **D-13:** Staging + production environments. On merge to main: auto-deploy to staging. Promote to production: manual approval gate via GitHub environment protection rule.
- **D-14:** Dual deployment gate (DEPLOY-05). GitHub environment protection rule blocks CI deploys without reviewer approval. CLI deploy script confirms before manual deploys. Gate is impossible to bypass regardless of deploy method.

### Feature Flags + Dashboard
- **D-15:** Auto-create feature flags via PostHog API. System reads `featureFlagCandidates` from PageSpec and creates flags programmatically. Flags start disabled (0% rollout). User toggles them in PostHog dashboard.
- **D-16:** Baseline dashboard includes: page views per page (from PageSpec routes), event counts (from PageSpec events), error tracking (unhandled exceptions + API errors), user retention (DAU/WAU, requires identify).

### Deployment Execution
- **D-17:** Full deployment execution, not just config generation. System runs the actual platform CLI (`railway up`, `render deploy`, `fly deploy`) or user's custom script. Confirmation gate (D-14) fires immediately before execution.

### Claude's Discretion
- PostHog SDK initialization placement (App.tsx provider vs individual page init)
- Error tracking configuration depth (just capture vs custom error boundaries)
- Dashboard layout and widget arrangement
- Whether to generate a health check endpoint for the hosting platform
- Staging environment naming convention

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 2 Outputs (Consumed by Phase 6)
- `shared/spec-schema.ts` — PageSpecAnalytics schema (events, featureFlagCandidates), PageSpecFull composite type
- `lib/spec-parser/types.ts` — TypeScript type re-exports for PageSpecAnalytics and related types

### Phase 5 Outputs (Patterns to follow)
- `lib/backend-wirer/hook-injector.ts` — Code mod injection pattern (Phase 6 analytics injection follows same approach)
- `lib/backend-wirer/wiring-applier.ts` — File mutation via offset-based string splicing (reuse for instrumentation injection)
- `lib/backend-wirer/brownfield-backend-audit.ts` — Codebase scanning pattern (extend for env var detection)

### Existing Backend
- `server/routes.ts` — Express route handler (context for error tracking instrumentation)
- `server/index.ts` — App bootstrap (Docker entrypoint, health check location)
- `client/src/App.tsx` — React app root (PostHog provider placement)
- `client/src/hooks/use-auth.tsx` — Auth hook (identify call integration point)

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` — Layer diagram, data flow
- `.planning/codebase/INTEGRATIONS.md` — Current CI/CD state (none detected), environment vars
- `.planning/codebase/STACK.md` — Full technology stack

### Requirements
- `.planning/REQUIREMENTS.md` — ANLYT-01 through ANLYT-03, DEPLOY-01 through DEPLOY-05

### Skill Pattern
- `.claude/skills/saas-dev/orchestrator/SKILL.md` — Orchestrator references saas-dev:analytics-delivery as Phase 6 skill
- `.claude/skills/saas-dev/backend-wirer/SKILL.md` — Phase 5 skill pattern to follow for Phase 6 SKILL.md

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shared/spec-schema.ts` — PageSpecAnalytics already defines events (name, trigger, properties, source) and featureFlagCandidates
- `lib/backend-wirer/hook-injector.ts` — Code mod injection pattern that reads specs and programmatically modifies page files
- `lib/backend-wirer/wiring-applier.ts` — File mutation at calculated offsets (reusable for analytics injection)
- `lib/backend-wirer/brownfield-backend-audit.ts` — Regex-based codebase scanning (extend for env var detection)

### Established Patterns
- Append-model: all file modifications are additive, never refactoring (Phases 4-5)
- Zod schemas as source of truth with inferred TypeScript types
- Vitest for all testing (268 tests currently passing)
- Idempotent SQL migrations via tsx scripts with Neon

### Integration Points
- `client/src/App.tsx` — PostHog provider wraps the app
- `client/src/hooks/use-auth.tsx` — posthog.identify() on auth state change
- `client/src/pages/*.tsx` — posthog.capture() injected into page components
- `package.json` — posthog-js dependency addition
- Root directory — Dockerfile, docker-compose.yml, .github/workflows/

</code_context>

<specifics>
## Specific Ideas

No specific "I want it like X" references. User consistently chose recommended/pragmatic options. Key emphasis: system must work for end users with varying setups (auth detection, env detection, hosting choice), not just for one specific configuration.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-analytics-delivery*
*Context gathered: 2026-03-30*
