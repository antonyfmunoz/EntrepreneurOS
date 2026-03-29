---
phase: 05-backend-quality
plan: "01"
subsystem: backend-wirer
tags: [types, brownfield-audit, zod, tdd, phase-5]
dependency_graph:
  requires:
    - shared/spec-schema.ts (BackendEndpointSpec, BackendSpec types)
    - lib/code-integrator/types.ts (Phase 4 pattern reference)
  provides:
    - lib/backend-wirer/types.ts (all Phase 5 type contracts)
    - lib/backend-wirer/brownfield-backend-audit.ts (backend collision detection)
  affects:
    - All downstream Phase 5 modules (route-generator, schema-generator, hook-injector, test-generator)
tech_stack:
  added: []
  patterns:
    - Zod schema-first with z.infer<typeof XSchema> type extraction
    - Regex-based static analysis for brownfield scanning (no AST parser)
    - TDD RED/GREEN cycle per task
key_files:
  created:
    - lib/backend-wirer/types.ts
    - lib/backend-wirer/brownfield-backend-audit.ts
    - tests/unit/backend-wirer/types.test.ts
    - tests/unit/backend-wirer/brownfield-backend-audit.test.ts
  modified: []
decisions:
  - "Regex-based route extraction uses app.(get|post|put|patch|delete)(\"(/api/...\") pattern — covers all HTTP methods in one pass"
  - "routesInsertionOffset returns -1 (not 0) when createServer not found — sentinel value per plan spec"
  - "detectCollisions gaps array always empty at audit time — gaps checked at wiring plan generation time per D-03"
  - "BackendSpec and BackendEndpointSpec re-exported from types.ts for downstream module convenience"
metrics:
  duration_minutes: 7
  completed_date: "2026-03-29"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 05 Plan 01: Backend Wirer Types and Brownfield Audit Summary

Phase 5 type contracts and backend brownfield audit module — 7 Zod schemas defining the full wiring plan data model plus regex-based scanning of routes.ts, storage.ts, and schema.ts for collision-safe code generation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Phase 5 type contracts | 674bb88 | lib/backend-wirer/types.ts, tests/unit/backend-wirer/types.test.ts |
| 2 | Backend brownfield audit | 0de16eb | lib/backend-wirer/brownfield-backend-audit.ts, tests/unit/backend-wirer/brownfield-backend-audit.test.ts |

## What Was Built

### Task 1: Phase 5 type contracts

`lib/backend-wirer/types.ts` defines all 7 Zod schemas required by downstream Phase 5 modules:

1. **BackendBrownfieldInventorySchema** — snapshot of existing backend state (route paths, storage functions, table names, 3 insertion offsets)
2. **RouteCodeBlockSchema** — Express route handler block with optional inline Zod schema
3. **SchemaCodeBlockSchema** — Complete Drizzle table definition (drizzle code + zod insert schema + type export)
4. **StorageCodeBlockSchema** — Single CRUD function to append to storage class
5. **HookInjectionSchema** — TanStack Query hook injection descriptor for Phase 4 page components
6. **WiringValidationResultSchema** — Cross-check result with valid boolean, gaps array, collisions array
7. **BackendWiringPlanSchema** — Composite plan combining all the above arrays

Re-exports `BackendSpec`, `BackendEndpointSpec`, and `BackendSpecSchema` from `@shared/spec-schema.js` for downstream module convenience.

### Task 2: Backend brownfield audit

`lib/backend-wirer/brownfield-backend-audit.ts` exports two functions:

**`auditBackendBrownfield(projectRoot: string)`** — reads `server/routes.ts`, `server/storage.ts`, and `shared/schema.ts` then:
- Extracts all `/api/...` route paths via regex (`app.(get|post|put|patch|delete)("(/api/...)"`
- Extracts all `async functionName(` storage function names
- Extracts all `pgTable("tableName"` table names
- Finds `routesInsertionOffset` as the byte index of `const httpServer = createServer(app)` (returns -1 if absent)
- Finds `storageInsertionOffset` as `lastIndexOf("}")` in storage.ts
- Finds `schemaInsertionOffset` as the full content length (append-at-end)
- Validates result against `BackendBrownfieldInventorySchema` before returning

**`detectCollisions(inventory, spec)`** — cross-checks every `BackendEndpointSpec.path` against `inventory.existingRoutePaths`. Returns `WiringValidationResult` with exact-match collisions flagged. Gaps array is always empty here — gaps are determined at wiring plan generation time per D-03.

## Test Coverage

- **types.test.ts** — 18 tests: valid and invalid input for all 7 schemas
- **brownfield-backend-audit.test.ts** — 13 tests: route extraction (all 5 HTTP methods), storage function extraction, table name extraction, insertion offset detection, collision detection with match and without

Total: 31 tests, all passing.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no stub patterns in the implemented code.

## Self-Check: PASSED

- [x] `lib/backend-wirer/types.ts` exists
- [x] `lib/backend-wirer/brownfield-backend-audit.ts` exists
- [x] `tests/unit/backend-wirer/types.test.ts` exists
- [x] `tests/unit/backend-wirer/brownfield-backend-audit.test.ts` exists
- [x] Commit `674bb88` exists (types)
- [x] Commit `0de16eb` exists (brownfield audit)
- [x] 31 tests pass, 0 failures
- [x] No TypeScript errors in backend-wirer files
