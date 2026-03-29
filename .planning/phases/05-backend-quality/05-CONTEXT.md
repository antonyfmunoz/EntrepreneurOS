# Phase 5: Backend + Quality - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

The backend serves exactly what the integrated UI requests, tests verify what was built, and nothing ships until the test suite passes. This phase takes the pure presentational React components from Phase 4 and wires them to real Express endpoints, Drizzle schema extensions, Zod validation, and TanStack Query hooks — then writes integration tests with an autonomous fix loop.

Does NOT include: analytics instrumentation (Phase 6), deployment automation (Phase 6), frontend changes beyond injecting useQuery/useMutation hooks into existing Phase 4 components, or refactoring existing backend architecture.

</domain>

<decisions>
## Implementation Decisions

### Contract Extraction Strategy
- **D-01:** PageSpec-driven endpoint generation. Use `deriveBackendSpec()` output from Phase 2 as the source of truth for what endpoints to create. No TSX scanning needed — Phase 4 components are static (no data fetching) and the spec IS the contract.
- **D-02:** Auto-inject useQuery/useMutation hooks into existing Phase 4 page components. System reads PageSpec data requirements, generates TanStack Query hooks, and injects them directly into the page files. Matches existing codebase pattern.
- **D-03:** Strict validation before wiring. Cross-check every PageSpec data requirement against generated endpoints. Flag any gaps before wiring begins — prevents broken pages at runtime.
- **D-04:** Backend brownfield scan for endpoint collision. Before generating new endpoints, scan routes.ts for existing endpoint paths and storage.ts for existing function names. Same philosophy as Phase 4 D-10 (conflict detection) but for the API layer.
- **D-05:** Auth context follows Phase 4 D-07 default. Every generated endpoint requires authenticated user + company scope (matching ProtectedRoute + CompanyGuard default). PageSpec `authLevel` field can override for edge cases.

### Monolith Wiring Approach
- **D-06:** Append new endpoints to existing routes.ts. No architectural refactoring — Phase 5 is about serving the UI, not restructuring the backend. Matches current monolithic pattern.
- **D-07:** Append new CRUD functions to existing storage.ts. Consistent with D-06 — single source of truth for data access.
- **D-08:** Order-aware insertion. New routes inserted before any catch-all/error handler but after auth middleware. Express routes are first-match-wins — insertion position matters.
- **D-09:** Follow existing inline Zod validation pattern. No separate validation middleware layer — consistency with what's already in routes.ts.

### Test-Fix Loop Behavior
- **D-10:** 3 auto-fix cycles before escalation. Matches retry pattern from Phase 1 (Stitch wrapper) and action executor. After 3 failures, escalate to user with: which test failed, error message, fixes attempted, and hypothesis about root cause.
- **D-11:** Fix implementation only, never tests. Tests represent the spec contract (TDD principle). If tests fail, the implementation is wrong. Tests are the source of truth.
- **D-12:** Integration tests, not unit tests. TEST-02 explicitly requires integration tests. Test actual HTTP requests to Express endpoints with real Drizzle queries. Validates the full request→route→storage→database→response stack.
- **D-13:** Test database isolation via transaction rollback. Wrap each integration test in a transaction, roll back after. No separate test database needed. Researcher should investigate Neon branching as alternative if transaction isolation proves insufficient.
- **D-14:** Escalation includes hypothesis. When escalating after 3 cycles, include: (a) which test failed, (b) error message, (c) what fixes were attempted, (d) system's hypothesis about why it can't fix it. Not just "test failed, please help."

### Schema Migration Strategy
- **D-15:** Append new table definitions to shared/schema.ts. Single source of truth pattern. 521 lines is manageable. All Zod insert schemas and type exports stay co-located.
- **D-16:** SQL scripts via tsx for migrations. Same pattern Phase 1 established. Generate idempotent DDL (CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS). Non-interactive, CI-safe, proven with Neon.
- **D-17:** Dependency-ordered migration execution. When multiple new tables reference each other, detect the dependency graph and order CREATE statements correctly. Forward-only migrations — no rollback mechanism in v1.

### Claude's Discretion
- D-05: Auth level override per-endpoint when PageSpec specifies non-default authLevel
- Escalation format details beyond the required 4 fields (D-14)
- Whether to investigate Neon branching for test isolation vs. transaction rollback

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Backend
- `server/routes.ts` — 2526-line monolithic route handler with 40+ endpoints, insertion target for new routes
- `server/storage.ts` — 1518-line CRUD operations layer, insertion target for new data access functions
- `shared/schema.ts` — 521-line Drizzle table definitions + Zod schemas + type exports, extension target
- `server/db.ts` — Database connection setup (Neon serverless)
- `server/auth.ts` — Passport.js + Firebase Auth setup, middleware patterns

### Phase 2 Outputs (Consumed by Phase 5)
- `lib/spec-parser/backend-spec.ts` — `deriveBackendSpec()` generates CRUD endpoints from PageSpec data layer
- `lib/spec-parser/types.ts` — PageSpecFull including data requirements, auth level, route paths

### Phase 4 Outputs (Modified by Phase 5)
- `lib/code-integrator/types.ts` — BrownfieldInventory, integration result types
- `lib/code-integrator/brownfield-audit.ts` — Frontend brownfield audit (extend pattern to backend)
- Page files in `client/src/pages/` — Phase 5 injects useQuery/useMutation hooks into these

### Phase 1 Patterns
- `lib/foundation/` — Migration script pattern (SQL via tsx), Vitest config, Zod schema patterns

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` — Layer diagram, data flow, existing patterns
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, import organization, code style
- `.planning/codebase/STRUCTURE.md` — Directory layout and file purposes
- `.planning/codebase/TESTING.md` — Current test state and validation patterns

### Requirements
- `.planning/REQUIREMENTS.md` — BACK-01 through BACK-05, TEST-01 through TEST-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/routes.ts` — Existing endpoint patterns (auth middleware, Zod validation, error handling) to follow
- `server/storage.ts` — Existing CRUD function patterns (Drizzle query builders, in-memory cache layer)
- `shared/schema.ts` — Existing table + Zod schema + type export pattern
- `lib/spec-parser/backend-spec.ts` — `deriveBackendSpec()` already generates endpoint specifications from PageSpec
- `lib/code-integrator/brownfield-audit.ts` — Pattern for brownfield scanning, extend to backend
- TanStack Query hooks in existing pages — Pattern for useQuery/useMutation wiring

### Established Patterns
- Express routes use inline Zod validation (not separate middleware)
- Passport.js `req.isAuthenticated()` + company ownership check on every endpoint
- Storage functions use Drizzle ORM query builders with optional in-memory cache
- Vitest for all testing (190 tests across 21 files currently passing)
- Phase 1 migration pattern: idempotent SQL via tsx script with `@neondatabase/serverless`

### Integration Points
- `server/routes.ts` — Insert new route handlers (order-aware, before catch-all)
- `server/storage.ts` — Insert new CRUD functions
- `shared/schema.ts` — Insert new table definitions + Zod schemas + types
- `client/src/pages/*.tsx` — Inject useQuery/useMutation hooks into existing static components
- `server/index.ts` — May need new middleware registration (unlikely given append strategy)

</code_context>

<specifics>
## Specific Ideas

No specific references or "I want it like X" moments. Standard backend wiring approach with decisions captured above. User consistently chose recommended/pragmatic options — append to existing files, PageSpec as source of truth, strict validation, TDD-first testing.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-backend-quality*
*Context gathered: 2026-03-29*
