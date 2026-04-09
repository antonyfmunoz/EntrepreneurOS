---
phase: 05-backend-quality
plan: 03
subsystem: test-runner
tags: [testing, integration-tests, tdd, fix-loop, supertest, vitest]
dependency_graph:
  requires: ["05-01"]
  provides: ["lib/test-runner/types.ts", "lib/test-runner/test-generator.ts", "lib/test-runner/fix-loop.ts", "tests/integration/helpers/test-db.ts", "tests/integration/helpers/auth-smoke.test.ts"]
  affects: ["05-04"]
tech_stack:
  added: ["supertest@^7.2.2", "@types/supertest@^7.2.0"]
  patterns: ["TDD (RED-GREEN)", "transaction rollback isolation", "auth mock middleware injection", "3-cycle fix loop with escalation"]
key_files:
  created:
    - lib/test-runner/types.ts
    - lib/test-runner/test-generator.ts
    - lib/test-runner/fix-loop.ts
    - tests/integration/helpers/test-db.ts
    - tests/integration/helpers/auth-smoke.test.ts
    - tests/unit/test-runner/test-generator.test.ts
    - tests/unit/test-runner/fix-loop.test.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - "generateIntegrationTest derives resource name by stripping api/ prefix and path params, replacing slashes with dashes"
  - "RollbackSentinel is a class not a string — prevents accidental catch-and-swallow of rollback signal (Pitfall 3)"
  - "fixFn receives raw test output string only — no file paths passed to preserve D-11 contract"
  - "generateHypothesis distinguishes same-test vs different-test failure patterns for D-14 structured escalation"
metrics:
  duration_minutes: 10
  completed_date: "2026-03-29"
  tasks_completed: 3
  files_created: 7
  files_modified: 2
---

# Phase 05 Plan 03: Test Infrastructure Summary

Supertest-based integration test generator, transaction rollback isolation helper, auth smoke test, and 3-cycle fix loop with structured escalation reports.

## What Was Built

### Task 0: Install supertest

`supertest@^7.2.2` and `@types/supertest@^7.2.0` added as dev dependencies. Required for HTTP-level integration tests per D-12.

### Task 1: Types, test generator, transaction helper, auth smoke test (TDD)

**`lib/test-runner/types.ts`** — Zod schemas and TypeScript types for all test runner contracts:
- `TestRunResultSchema` — passed, output, failingTests[]
- `FixAttemptSchema` — cycle, output, fixApplied
- `EscalationReportSchema` — failingTest, errorMessage, attemptsLog[], hypothesis
- `FixLoopResultSchema` — passed, cycles, lastOutput, optional escalationReport
- `TestFileSpecSchema` — filePath, content

**`lib/test-runner/test-generator.ts`** — `generateIntegrationTest(endpoint: BackendEndpointSpec): TestFileSpec`
- Produces a complete Vitest integration test file as a string
- File path: `tests/integration/backend/{resource}.integration.test.ts`
- Auth mock middleware injected before routes (req.isAuthenticated pattern)
- For authRequired=true: generates both 401 (unauthenticated) and success tests
- For authRequired=false: generates success test only, no auth middleware
- POST/PUT/PATCH with requestBody fields: generates .send({ field: "test-field" })
- Expected status: GET=200, POST=201, PUT/PATCH=200, DELETE=204

**`tests/integration/helpers/test-db.ts`** — `withTestTransaction()` and `closeTestConnection()`
- Uses `sql.begin()` (postgres driver) for transaction-scoped test isolation
- `RollbackSentinel` class (not string) forces rollback after test code completes
- Returns undefined after rollback, re-throws all non-sentinel errors

**`tests/integration/helpers/auth-smoke.test.ts`** — Validates auth mocking pattern
- Tests unauthenticated GET /api/company returns 401
- Tests mock-authenticated GET /api/company returns non-401
- Must pass before bulk integration test generation is used

**`tests/unit/test-runner/test-generator.test.ts`** — 5 unit tests covering all acceptance criteria

### Task 2: Fix loop (TDD)

**`lib/test-runner/fix-loop.ts`** — `runWithFixLoop()`:
- Runs `npx vitest run {testGlob} --reporter=verbose` via `execSync`
- Retries up to `maxCycles` (default: 3) on failure
- Calls `fixFn(output, cycle)` between cycles — receives only test output string (D-11)
- Early escalation when `fixFn` returns false
- Structured `EscalationReport` on failure: failingTest, errorMessage, attemptsLog[], hypothesis
- `generateHypothesis()` distinguishes same-test vs different-test failure patterns

**`tests/unit/test-runner/fix-loop.test.ts`** — 6 unit tests with `vi.mock("child_process")`:
- Pass on first run → cycles=1, no escalationReport
- Fail 3 times → cycles=3, escalationReport with all 4 fields
- Fail then pass → cycles=2, passed=true
- fixFn returns false → early escalation, cycles < MAX_CYCLES
- hypothesis never empty string
- fixFn receives output string not file paths (D-11 compliance)

## Decisions Made

1. Resource name derived by stripping `/api/` prefix and `:param` segments, replacing slashes with dashes — produces clean filenames like `user-settings.integration.test.ts`
2. `RollbackSentinel` as a class prevents accidental swallowing when application code has generic `catch(err)` blocks
3. `fixFn` receives raw vitest stdout+stderr string — never a file path — to enforce D-11 (fix loop only modifies implementation, never tests)
4. `generateHypothesis` has two branches: same test failing (schema/migration issue) vs different tests (shared state/import error) — always returns a non-empty string

## Verification Results

```
 PASS  tests/unit/test-runner/test-generator.test.ts (5 tests)
 PASS  tests/unit/test-runner/fix-loop.test.ts (6 tests)
 Total: 11 tests passed
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

Files confirmed:
- FOUND: lib/test-runner/types.ts
- FOUND: lib/test-runner/test-generator.ts
- FOUND: lib/test-runner/fix-loop.ts
- FOUND: tests/integration/helpers/test-db.ts
- FOUND: tests/integration/helpers/auth-smoke.test.ts
- FOUND: tests/unit/test-runner/test-generator.test.ts
- FOUND: tests/unit/test-runner/fix-loop.test.ts

Commits confirmed:
- 8ff7609: chore(05-03): install supertest and @types/supertest as dev dependencies
- cadee20: test(05-03): add failing tests for test-generator (RED)
- 014e018: feat(05-03): test runner types, integration test generator, transaction helper, and auth smoke test
- 189f797: test(05-03): add failing tests for fix-loop (RED)
- e14b48e: feat(05-03): fix loop — 3-cycle test-fix-rerun with structured escalation
