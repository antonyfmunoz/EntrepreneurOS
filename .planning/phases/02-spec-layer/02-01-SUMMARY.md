---
phase: 02-spec-layer
plan: "01"
subsystem: spec-parser
tags: [zod-schemas, provenance-tracking, ai-parsing, tdd]
dependency_graph:
  requires: []
  provides: [shared/spec-schema.ts, lib/spec-parser/parse-spec.ts, lib/spec-parser/restructure-spec.ts, lib/spec-parser/types.ts]
  affects: [02-02, 02-03, phase-03, phase-04, phase-05, phase-06]
tech_stack:
  added: []
  patterns: [composable-zod-merge, provenance-enum, pRetry-with-self-correction, tdd-red-green]
key_files:
  created:
    - shared/spec-schema.ts
    - lib/spec-parser/types.ts
    - lib/spec-parser/restructure-spec.ts
    - lib/spec-parser/parse-spec.ts
    - tests/unit/spec-parser/parse-spec.test.ts
    - tests/unit/spec-parser/restructure-spec.test.ts
  modified:
    - shared/design-schema.ts
decisions:
  - "PageSpecFull uses .merge() chain (Core -> UI -> Data -> Analytics) for composability, not a monolithic z.object"
  - "Source: 'inferred' is the default across all provenance fields (safe default for AI outputs)"
  - "Self-correction loop inside pRetry: Zod errors sent back to Claude (up to 2 corrections) before pRetry triggers"
  - "MAX_RAW_INPUT_SIZE = 100_000 chars (100KB) — size guard fires before any AI call per review feedback"
metrics:
  duration_seconds: 305
  completed_date: "2026-03-28"
  tasks_completed: 2
  files_created: 6
  files_modified: 1
  tests_added: 44
requirements: [SPEC-01, SPEC-03, SPEC-05]
---

# Phase 02 Plan 01: PageSpec Schemas and Spec Parsing Pipeline Summary

**One-liner:** Composable Zod PageSpec schemas with SpecItemSource provenance tracking and a Claude-powered restructuring pipeline (pRetry + self-correction + 100KB size guard).

## What Was Built

### shared/spec-schema.ts

Four composable PageSpec layer schemas using `.merge()`:

- `PageSpecCore` — name, route (regex enforces `/` prefix), purpose, components, authLevel, priority, dependsOn, specVersion, `source: SpecItemSource.default("inferred")`
- `PageSpecUI` — layoutHint, emptyState, loadingState, errorState, mobileConsiderations (all optional)
- `PageSpecData` — dataRequirements[], apiEndpoints[] (each with source), validationRules[]
- `PageSpecAnalytics` — events[] (each with source), featureFlagCandidates[]
- `PageSpecFull = PageSpecCore.merge(PageSpecUI).merge(PageSpecData).merge(PageSpecAnalytics)`

Additional schemas:
- `SpecItemSource` — z.enum(["explicit", "inferred"]) provenance tracking per D-03 confirmation gate
- `SharedComponentSpec` — shared components extracted across pages with source field
- `BackendEndpointSpec` — method, path (regex enforces `/` prefix), description, authRequired, source
- `BackendSpecSchema` — endpoints[], drizzleTableHints[], backgroundJobs[], mismatches[]
- `SpecOutputSchema` — pages[] (min 1), sharedComponents[], suggestedOrder[], optional backendSpec

All type inferences exported (`PageSpecFull`, `SpecOutput`, `SharedComponentSpec`, etc.).

### lib/spec-parser/types.ts

Re-exports all types and schemas from `@shared/spec-schema.js` for internal module use.

### lib/spec-parser/restructure-spec.ts

- `extractJsonFromResponse` — strips markdown fences (` ```json ` or ` ``` `), calls JSON.parse
- `RESTRUCTURE_SYSTEM_PROMPT` — instructs Claude to: populate all 4 layers per page, infer auth gates, set provenance (`source: "explicit" | "inferred"`), detect shared components, generate suggestedOrder, fill empty/loading/error states, derive API endpoints from data requirements
- `restructureSpec` — calls `claude-sonnet-4-5` via pRetry (3 retries, 1s initial, 2x factor); on Zod validation failure, sends errors back to Claude for self-correction (up to 2 rounds) before re-throwing to trigger pRetry

### lib/spec-parser/parse-spec.ts

- `MAX_RAW_INPUT_SIZE = 100_000` (100KB)
- `parseSpec` — validates non-empty, enforces size guard before AI call, delegates to restructureSpec

### shared/design-schema.ts (modified)

Added `@deprecated` JSDoc comment to `SpecPhaseOutputSchema` — now superseded by `SpecOutputSchema` from `shared/spec-schema.ts`.

## Test Results

| File | Tests | Status |
|------|-------|--------|
| tests/unit/spec-parser/parse-spec.test.ts | 32 | PASS |
| tests/unit/spec-parser/restructure-spec.test.ts | 12 | PASS |
| tests/unit/design-schema.test.ts | 11 | PASS |
| tests/unit/detect-framework.test.ts | 4 | PASS |
| tests/unit/stitch-wrapper.test.ts | 4 | PASS |
| **Total** | **63** | **ALL PASS** |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 5f363ad | feat(02-01): add PageSpec Zod schemas with provenance tracking and unit tests |
| Task 2 | 5fbba51 | feat(02-01): implement spec parsing pipeline with AI restructuring and input size guard |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all exports are wired and functional. The AI integration (`restructureSpec`) uses the real Anthropic SDK in production and is fully mocked in tests.

## Self-Check: PASSED

- [x] shared/spec-schema.ts exists
- [x] lib/spec-parser/types.ts exists
- [x] lib/spec-parser/restructure-spec.ts exists
- [x] lib/spec-parser/parse-spec.ts exists
- [x] tests/unit/spec-parser/parse-spec.test.ts exists (32 tests)
- [x] tests/unit/spec-parser/restructure-spec.test.ts exists (12 tests)
- [x] Commit 5f363ad exists (Task 1)
- [x] Commit 5fbba51 exists (Task 2)
- [x] Full suite: 63/63 passing
