---
phase: 04-code-integration
plan: "02"
subsystem: code-integrator
tags: [translation, page-writer, ai, shadcn, tdd, conflict-detection]
dependency_graph:
  requires: [04-01]
  provides: [INTG-02, INTG-03]
  affects: [04-03]
tech_stack:
  added: []
  patterns: [lazy-anthropic-client, pRetry-2-retries, optional-client-injection-for-tests, p-limit-sequential-install]
key_files:
  created:
    - lib/code-integrator/html-to-shadcn.ts
    - lib/code-integrator/page-writer.ts
    - tests/unit/code-integrator/html-to-shadcn.test.ts
    - tests/unit/code-integrator/page-writer.test.ts
  modified: []
decisions:
  - translateHtmlToShadcn accepts optional Anthropic client parameter for test injection — avoids env var requirement in unit tests
  - ensureShadcnComponents test uses vi.mock("child_process") to prevent real npx execution
  - toKebabCase treats each uppercase letter as a word boundary — "CRM" becomes "c-r-m" (consistent with regex approach)
  - Post-translation data-fetch guard uses one re-prompt then regex strip as final fallback
metrics:
  duration_seconds: 251
  completed_date: "2026-03-28"
  tasks_completed: 2
  files_created: 4
  tests_added: 17
---

# Phase 4 Plan 02: HTML-to-shadcn Translation and Page File Writer Summary

**One-liner:** Claude Sonnet 4-5 HTML-to-shadcn translator with data-fetch guard and page file writer with D-10 conflict detection.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | HTML-to-shadcn Claude AI translation module | b2b626b | lib/code-integrator/html-to-shadcn.ts, tests/unit/code-integrator/html-to-shadcn.test.ts |
| 2 | Page file writer with shadcn auto-install and conflict detection | f1e1c13 | lib/code-integrator/page-writer.ts, tests/unit/code-integrator/page-writer.test.ts |

## What Was Built

### Task 1: HTML-to-shadcn Translation (INTG-02)

`lib/code-integrator/html-to-shadcn.ts` — Core AI translation module:

- `translateHtmlToShadcn(input, client?)` — sends Stitch HTML + installed component list to Claude Sonnet 4-5 with a strict system prompt forbidding data-fetching code
- Lazy singleton Anthropic client using `AI_INTEGRATIONS_ANTHROPIC_API_KEY` (same pattern as extract-tokens.ts and self-review.ts)
- Optional `client` parameter for test injection — bypasses `getClient()` entirely
- pRetry wrapping: 2 retries, minTimeout 1000ms, factor 2
- Post-translation data-fetch guard: regex scan for `useQuery|useMutation|fetch\(|axios\.` — triggers one re-prompt with stricter instructions, then regex-strips as final fallback
- Strips markdown fences from Claude output before returning
- Extracts `extractedImports[]` from `@/components/ui/([\w-]+)` pattern in generated TSX
- Sets `layoutWrapped: true` when output contains `<Layout`

### Task 2: Page File Writer (INTG-03)

`lib/code-integrator/page-writer.ts` — Mechanical page file creation:

- `writePage(options)` — writes TSX to `client/src/pages/{kebab}-page.tsx`, throws "already exists" without `overwrite: true`
- `checkFileConflict(options)` — non-destructive check used by SKILL.md orchestrator before writing (D-10)
- `ensureShadcnComponents(options)` — compares extracted imports against installed components, runs `npx shadcn@latest add [component] --overwrite` for each missing one using p-limit(1) for sequential installs (D-03)
- `toKebabCase(name)` — converts PascalCase to kebab-case ("ReportsPage" → "reports-page")

## Test Results

```
tests/unit/code-integrator/html-to-shadcn.test.ts  5 tests   PASS
tests/unit/code-integrator/page-writer.test.ts    12 tests   PASS
tests/unit/code-integrator/brownfield-audit.test.ts 7 tests  PASS (pre-existing)
Total: 24 tests, 0 failures
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test injection pattern required for Anthropic client mock**
- **Found during:** Task 1 — first test run
- **Issue:** The lazy singleton `_client` calls `getClient()` which throws `AI_INTEGRATIONS_ANTHROPIC_API_KEY is required` before the mocked Anthropic constructor can run. The `vi.mock("@anthropic-ai/sdk")` approach failed because the env check fires before instantiation.
- **Fix:** Tests pass the mock client via the `client?` parameter on `translateHtmlToShadcn`, bypassing `getClient()` entirely. No env var needed in tests.
- **Files modified:** tests/unit/code-integrator/html-to-shadcn.test.ts
- **Commit:** b2b626b (GREEN phase — implementation + corrected tests)

**2. [Rule 1 - Bug] ensureShadcnComponents test timed out running real npx**
- **Found during:** Task 2 — first test run
- **Issue:** The test tried to call real `npx shadcn@latest` in a temp directory, timing out at 5000ms.
- **Fix:** Added `vi.mock("child_process")` with a no-op callback before importing the module. The mock intercepts `exec()` calls and returns immediately.
- **Files modified:** tests/unit/code-integrator/page-writer.test.ts
- **Commit:** f1e1c13 (GREEN phase — implementation + corrected tests)

## Known Stubs

None — both modules produce real functional output. The `ensureShadcnComponents` npx execution uses real `child_process.exec` in production (only mocked in tests).

## Self-Check: PASSED

- FOUND: lib/code-integrator/html-to-shadcn.ts
- FOUND: lib/code-integrator/page-writer.ts
- FOUND: tests/unit/code-integrator/html-to-shadcn.test.ts
- FOUND: tests/unit/code-integrator/page-writer.test.ts
- FOUND commit: b2b626b (feat: html-to-shadcn implementation)
- FOUND commit: f1e1c13 (feat: page-writer implementation)
