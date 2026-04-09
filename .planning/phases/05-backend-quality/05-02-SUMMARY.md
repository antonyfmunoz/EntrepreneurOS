---
phase: 05-backend-quality
plan: 02
subsystem: api
tags: [express, drizzle, tanstack-query, zod, code-generation, tdd]

# Dependency graph
requires:
  - phase: 05-01
    provides: BackendBrownfieldInventory, RouteCodeBlock, SchemaCodeBlock, StorageCodeBlock, HookInjection types
provides:
  - generateRouteCode: Express route handler code matching routes.ts pattern
  - generateStorageCode: Storage class method code matching storage.ts pattern
  - generateSchemaCode: Drizzle table + Zod schema + type export code
  - generateMigrationSQL: Idempotent CREATE TABLE IF NOT EXISTS DDL
  - generateHookInjections: TanStack Query useQuery/useMutation hook code
  - writeMigrationScript: tsx migration script file matching scripts/setup-tables.ts pattern
  - runMigration: Executes migration script via npx tsx
affects: [05-03, 05-04, backend-wirer-integrator]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route code generation: app.{method}(path, async(req,res)) with isAuthenticated guard, try/catch, storage call"
    - "Storage code generation: async {verb}{Resource}(params) with db.select/insert/update/delete and .returning()"
    - "Schema code generation: pgTable + z.object + $inferSelect type export co-located"
    - "Migration script: tsx-executed, db.execute(sql`...`), CREATE TABLE IF NOT EXISTS, client.end() in finally"
    - "Hook code generation: useQuery for GET (queryKey as path), useMutation for mutations with queryClient.invalidateQueries"

key-files:
  created:
    - lib/backend-wirer/route-generator.ts
    - lib/backend-wirer/schema-generator.ts
    - lib/backend-wirer/hook-injector.ts
    - lib/backend-wirer/migration-runner.ts
    - tests/unit/backend-wirer/route-generator.test.ts
    - tests/unit/backend-wirer/schema-generator.test.ts
    - tests/unit/backend-wirer/hook-injector.test.ts
    - tests/unit/backend-wirer/migration-runner.test.ts
  modified: []

key-decisions:
  - "generateRouteCode derives storage function names from path+method: GET->getWidgets, POST->createWidget, PUT/PATCH->updateWidget, DELETE->deleteWidget"
  - "generateSchemaCode always includes id (text PK), companyId, createdAt, updatedAt as standard columns — caller fields are additive"
  - "generateMigrationSQL orders tables alphabetically for v1 — no FK dependencies generated, so ordering is stable"
  - "generateHookInjections returns empty replacePattern — hook injector adds code, page wiring done by executor at write time"
  - "migration-runner uses fs/promises + child_process for I/O, enabling vi.mock in tests without file system side effects"

patterns-established:
  - "Code generators are pure functions (route-generator, schema-generator, hook-injector) — no I/O, testable without mocking"
  - "I/O modules (migration-runner) use named imports from fs/promises and child_process — enables vi.mock in vitest"
  - "PascalCase derivation: singularize(capitalize(camelCase(tableName))) — consistent across all generators"

requirements-completed: [BACK-02, BACK-03, BACK-04]

# Metrics
duration: 18min
completed: 2026-03-29
---

# Phase 5 Plan 02: Code Generators Summary

**Four pure code generator modules producing Express routes, Drizzle schemas, TanStack Query hooks, and idempotent migration scripts from BackendSpec input — all matching exact existing codebase patterns with 25 passing unit tests**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-29T10:03:00Z
- **Completed:** 2026-03-29T10:06:30Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Route generator produces Express handler code and storage class methods matching exact server/routes.ts and server/storage.ts patterns
- Schema generator produces Drizzle pgTable definitions, Zod insert schemas, and type exports matching shared/schema.ts pattern, plus idempotent migration SQL
- Hook injector generates useQuery (GET) and useMutation (POST/PUT/PATCH/DELETE) code with correct queryKey paths and apiRequest calls
- Migration runner writes tsx migration scripts matching scripts/setup-tables.ts pattern and executes them via npx tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: Route generator and schema generator** - `28d8379` (feat)
2. **Task 2: Hook injector and migration runner** - `13de44f` (feat)

**Plan metadata:** _(docs commit to follow)_

_Note: Both tasks used TDD — tests written first (RED), then implementation (GREEN). 25 total new tests added._

## Files Created/Modified
- `lib/backend-wirer/route-generator.ts` - generateRouteCode and generateStorageCode pure functions
- `lib/backend-wirer/schema-generator.ts` - generateSchemaCode and generateMigrationSQL pure functions
- `lib/backend-wirer/hook-injector.ts` - generateHookInjections pure function (GET->useQuery, mutation->useMutation)
- `lib/backend-wirer/migration-runner.ts` - writeMigrationScript and runMigration I/O functions
- `tests/unit/backend-wirer/route-generator.test.ts` - 7 tests for route + storage generation
- `tests/unit/backend-wirer/schema-generator.test.ts` - 6 tests for schema + migration SQL generation
- `tests/unit/backend-wirer/hook-injector.test.ts` - 6 tests for hook generation and page file mapping
- `tests/unit/backend-wirer/migration-runner.test.ts` - 6 tests for script writing and execution with mocked I/O

## Decisions Made
- Route/schema/hook generators are pure functions with no I/O — easier to test, cleaner contracts
- migration-runner uses named imports (writeFile from fs/promises, execSync from child_process) to enable vi.mock in vitest without patching the entire module
- generateMigrationSQL orders tables alphabetically for v1 — deterministic and sufficient since no FK dependencies are generated
- HookInjection.replacePattern is always empty string — hook injector produces code blocks, page wiring done by the executor at write time (separation of concerns)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 code generator modules are implemented and tested
- Generators produce code matching existing codebase patterns exactly
- Ready for Plan 03 (backend wiring executor) which will use these generators to apply changes to actual files
- 56 total tests pass in the backend-wirer suite (including Plan 01's tests)

## Known Stubs
None — all generators produce real code strings, no placeholders or hardcoded empty values.

---
*Phase: 05-backend-quality*
*Completed: 2026-03-29*
