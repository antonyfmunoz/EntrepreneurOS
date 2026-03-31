---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 03-ui-generation 03-05-PLAN.md
last_updated: "2026-03-31T07:09:37.234Z"
last_activity: 2026-03-31
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 23
  completed_plans: 21
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** One system that takes a SaaS product from spec document to deployed, tested, hosted application — page by page, with human oversight at critical points and autonomous execution everywhere else.
**Current focus:** Phase 03 — ui-generation

## Current Position

Phase: 03 (ui-generation) — EXECUTING
Plan: 2 of 6
Status: Ready to execute
Last activity: 2026-03-31

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-foundation P02 | 4 | 2 tasks | 3 files |
| Phase 01-foundation P01 | 7 | 2 tasks | 5 files |
| Phase 01-foundation P03 | 328 | 3 tasks | 8 files |
| Phase 02-spec-layer P01 | 305 | 2 tasks | 7 files |
| Phase 02-spec-layer P02 | 273 | 2 tasks | 6 files |
| Phase 02-spec-layer P03 | 5 | 2 tasks | 6 files |
| Phase 03-ui-generation P03 | 7 | 2 tasks | 3 files |
| Phase 04-code-integration P01 | 5 | 2 tasks | 3 files |
| Phase 04-code-integration P02 | 251 | 2 tasks | 4 files |
| Phase 05-backend-quality P03 | 10 | 3 tasks | 9 files |
| Phase 05-backend-quality P02 | 18 | 2 tasks | 8 files |
| Phase 05-backend-quality P04 | 44 | 2 tasks | 3 files |
| Phase 06-analytics-delivery P01 | 246 | 2 tasks | 5 files |
| Phase 06-analytics-delivery P02 | 215 | 2 tasks | 5 files |
| Phase 06-analytics-delivery P03 | 339 | 2 tasks | 5 files |
| Phase 06-analytics-delivery P04 | 6 | 2 tasks | 3 files |
| Phase 03-ui-generation P05 | 1367 | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Build as Claude Code skills using skill-creator — not a standalone app
- [Init]: Page-by-page Stitch generation (not full-app) — quality is better per page
- [Init]: Neon PostgreSQL for design memory — consistent with existing stack
- [Init]: First page always requires user approval — sets design anchor for consistency
- [Phase 01-foundation]: Stitch client constructor uses new Stitch(new StitchToolClient({ apiKey })) not new Stitch({ apiKey }) — SDK requires StitchToolClient wrapper
- [Phase 01-foundation]: detectFramework is a pure function — caller passes pkg and hasComponentsJson, no file I/O in the function
- [Phase 01-foundation]: uniqueIndex must be defined inside pgTable config function (3rd arg) in drizzle-orm 0.39.1 — standalone export causes JSON.parse error
- [Phase 01-foundation]: drizzle-kit push is interactive for table disambiguation — use direct SQL via tsx script with CREATE TABLE IF NOT EXISTS for non-interactive CI environments
- [Phase 01-foundation]: vitest@2 pinned — Vite 5.4.15 incompatible with vitest@4 (requires Vite 6+)
- [Phase 01-foundation]: Single-env vitest config used — vitest@2 test.projects API unavailable, fallback node env config
- [Phase 02-spec-layer]: PageSpecFull uses .merge() chain (Core -> UI -> Data -> Analytics) for composability over monolithic z.object
- [Phase 02-spec-layer]: source: 'inferred' is default across all SpecItemSource provenance fields — safe default for AI outputs
- [Phase 02-spec-layer]: MAX_RAW_INPUT_SIZE = 100_000 chars (100KB) — size guard fires before AI call per review feedback
- [Phase 02-spec-layer]: deduplicateComponents returns merges array alongside deduplicated list for D-22 user confirmation flow
- [Phase 02-spec-layer]: chunkSpecByDomain uses DOMAIN_PATTERNS map with auth-onboarding / admin-settings / core-features for page classification
- [Phase 02-spec-layer]: chunkRawText splits at markdown heading boundaries before paragraph fallback — pure function no AI dependency
- [Phase 02-spec-layer]: Collaborative flow v1 manages state in Claude Code conversation context — CollaborativeState design notes future Neon serialization path for cross-session resume
- [Phase 02-spec-layer]: applySpecEdit is immutable — returns new SpecOutput, never mutates input; edit state transitions implemented in code not just skill prose
- [Phase 03-ui-generation]: selfReview uses Claude Sonnet 4-5 with max_tokens 2048 — review response is smaller than extraction, lazy Anthropic client pattern matches extract-tokens.ts
- [Phase 03-ui-generation]: SKILL.md user confirmation gate (D-05) documents three options: Confirm, Edit, Skip persistence — token diff table shown when prior tokens exist
- [Phase 04-code-integration]: BrownfieldInventory uses per-block regex parsing for ProtectedRoute blocks — handles multi-line JSX correctly
- [Phase 04-code-integration]: translateHtmlToShadcn accepts optional Anthropic client for test injection — avoids env var requirement in unit tests
- [Phase 04-code-integration]: Post-translation data-fetch guard: one re-prompt with stricter instructions, then regex strip as final fallback (useQuery, useMutation, fetch, axios)
- [Phase 05-backend-quality]: generateIntegrationTest derives resource name by stripping api/ prefix and path params, replacing slashes with dashes
- [Phase 05-backend-quality]: RollbackSentinel is a class not a string — prevents accidental catch-and-swallow of rollback signal (Pitfall 3)
- [Phase 05-backend-quality]: fixFn receives raw test output string only — no file paths passed to preserve D-11 contract (fix loop never modifies tests)
- [Phase 05-backend-quality]: generateRouteCode derives storage function names from path+method: GET->getWidgets, POST->createWidget, PUT/PATCH->updateWidget, DELETE->deleteWidget
- [Phase 05-backend-quality]: generateSchemaCode always includes id (text PK), companyId, createdAt, updatedAt as standard columns
- [Phase 05-backend-quality]: migration-runner uses named imports from fs/promises and child_process enabling vi.mock in tests
- [Phase 05-backend-quality]: WiringApplyResult.filesModified normalizes paths to forward slashes for cross-platform consistency between OS path.join and test expectations
- [Phase 05-backend-quality]: applyWiringPlan applies schema blocks first (before routes/storage) per D-15 — routes and storage may reference new tables
- [Phase 06-analytics-delivery]: auditTaxonomy returns structured TaxonomyReport on empty input (valid=false) instead of throwing — addresses Codex review concern
- [Phase 06-analytics-delivery]: Collision detection: distinct event names normalizing to same snake_case key produce warnings in TaxonomyReport.collisions — user informed but not blocked
- [Phase 06-analytics-delivery]: generateEnvExample always injects VITE_POSTHOG_API_KEY (client) and POSTHOG_PERSONAL_API_KEY (server) per D-03 regardless of scan results
- [Phase 06-analytics-delivery]: Dockerfile curl install goes before HEALTHCHECK directive — node:20-slim has no curl; apt-get installs it in runner stage
- [Phase 06-analytics-delivery]: GET /health placed before registerRoutes in server/index.ts — health responds even if route registration fails
- [Phase 06-analytics-delivery]: PORT env var: parseInt(process.env.PORT ?? '5000', 10) — Railway/Render/Fly inject at runtime, defaults 5000 for local dev
- [Phase 06-analytics-delivery]: captureCode includes useRef(false) inline — self-contained for injection without hookCode ordering dependency
- [Phase 06-analytics-delivery]: manualCaptures replaces comment markers for click/submit events — structured objects with copy-paste captureSnippet addresses review concern
- [Phase 06-analytics-delivery]: createFeatureFlags takes injectable fetchFn parameter defaulting to global fetch — clean vi.fn() test injection without module mocking
- [Phase 06-analytics-delivery]: deploy-runner uses injectable execFn parameter (same as migration-runner pattern) — enables vi.fn() test injection without module mocking
- [Phase 06-analytics-delivery]: preflightDeploy separates missingSecrets and missingCLI into distinct arrays for precise error messaging per target
- [Phase 06-analytics-delivery]: Render deploy uses curl (not dedicated CLI) — render deploy hooks are HTTP endpoints, curl always available on Linux/macOS
- [Phase 03-ui-generation]: discoverComponents uses injectable mcpInvoke parameter for test injection — all three registry calls wrapped in separate try/catch for graceful failures
- [Phase 03-ui-generation]: MAX_PROMPT_TOTAL_CHARS = 30,000 enforced at end of buildStitchPrompt — slices result before return to prevent unbounded prompt growth

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 3 flag]: Stitch SDK is recent and evolving — pin version at install, test against live API early. Confidence scoring thresholds need empirical tuning (default: 15% drift tolerance, adjust after first real run).

## Session Continuity

Last session: 2026-03-31T07:09:37.229Z
Stopped at: Completed 03-ui-generation 03-05-PLAN.md
Resume file: None
