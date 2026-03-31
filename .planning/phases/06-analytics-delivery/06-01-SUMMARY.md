---
phase: 06-analytics-delivery
plan: 01
subsystem: analytics-delivery
tags: [types, taxonomy-audit, env-scanner, posthog, tdd]
dependency_graph:
  requires: []
  provides:
    - lib/analytics-delivery/types.ts
    - lib/analytics-delivery/taxonomy-auditor.ts
    - lib/analytics-delivery/env-scanner.ts
  affects:
    - lib/analytics-delivery/* (all downstream plan 02-04 modules consume these types)
tech_stack:
  added: []
  patterns:
    - Zod schema + inferred type exports (matching backend-wirer/types.ts pattern)
    - TDD RED->GREEN->REFACTOR for all modules
    - Pure function auditTaxonomy (no I/O, structured result on empty input)
    - Recursive file walker with configurable skip dirs for env scanning
key_files:
  created:
    - lib/analytics-delivery/types.ts
    - lib/analytics-delivery/taxonomy-auditor.ts
    - lib/analytics-delivery/env-scanner.ts
    - tests/unit/analytics-delivery/taxonomy-auditor.test.ts
    - tests/unit/analytics-delivery/env-scanner.test.ts
  modified: []
decisions:
  - "auditTaxonomy returns structured TaxonomyReport on empty input (valid=false, errors array) instead of throwing — addresses Codex review concern"
  - "Collision detection: distinct event names that normalize to same snake_case key produce warnings (not errors) in TaxonomyReport.collisions — user can proceed but is informed"
  - "toSnakeCase: lowercase + replace non-alphanumeric with underscore + collapse + trim — pure normalization, no throw path"
  - "generateEnvExample always includes VITE_POSTHOG_API_KEY (client) and POSTHOG_PERSONAL_API_KEY (server) per D-03, even if not found in scan"
  - "Required detection: env var on same line as ?? or || has required=false, otherwise required=true"
metrics:
  duration_seconds: 246
  completed_date: "2026-03-31"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 0
---

# Phase 6 Plan 1: Foundation Types + Taxonomy Auditor + Env Scanner Summary

**One-liner:** Zod-typed Phase 6 contracts with structured taxonomy audit (collision detection, no-throw empty input) and regex-based env var scanner with .env.example generation.

## What Was Built

### Task 1: Phase 6 type contracts + taxonomy auditor (commit: fca02eb)

**`lib/analytics-delivery/types.ts`** — All shared Phase 6 Zod schemas and TypeScript types:
- `TaxonomyReportSchema` / `TaxonomyReport` — structured audit result with `valid`, `errors`, `warnings`, `collisions`, `allEvents`, `allFlagCandidates`
- `AnalyticsInjectionSchema` / `AnalyticsInjection` — per-page analytics injection descriptor with `manualCaptures` for click/submit events
- `HostingTarget` union type — "railway" | "render" | "fly" | "custom"
- `DeployConfig` interface — includes `dockerignore` field per review feedback
- `EnvVarEntry` interface — env var with source scope, file list, required flag
- `DeployOutcome` type — "skipped" | "staged" | "deployed" | "failed-preflight" | "failed-runtime"
- `DeployRunnerResult` interface — deploy execution result
- `PostHogSetupResult` interface — includes `flagWarnings` per review feedback
- `PreflightResult` interface — credential/config validation before deploy

**`lib/analytics-delivery/taxonomy-auditor.ts`** — Pure taxonomy audit:
- `toSnakeCase(name)` — normalizes event names: lowercase, non-alphanumeric to underscore, collapse + trim
- `auditTaxonomy(pageSpecs)` — returns structured `TaxonomyReport`, never throws. On empty input returns `valid=false` with descriptive error. Detects snake_case collisions (when distinct event names normalize to same key), reports as warnings.

**10 tests pass** covering: gap detection, empty-input structured result, feature flag collection, toSnakeCase transformations, collision detection, no-collision baseline.

### Task 2: Env var scanner + .env.example generator (commit: 15f7456)

**`lib/analytics-delivery/env-scanner.ts`** — Codebase-wide env var analysis:
- `scanEnvVars(projectRoot)` — recursive walker scanning `client/`, `server/`, `shared/` directories. Four regex patterns: `process.env.VAR`, `process.env["VAR"]`, `process.env['VAR']`, `import.meta.env.VAR`. Skips `node_modules/`, `dist/`, `.git/`. Deduplicates by var name, merges file arrays, sets `required=true` if any occurrence has no `??` or `||` fallback on same line.
- `generateEnvExample(entries, extraVars?)` — groups entries by source (server/client), sorts alphabetically within each group, outputs formatted .env.example with `# Server-side` / `# Client-side` section headers. Appends `# REQUIRED` to required entries. Always injects `POSTHOG_PERSONAL_API_KEY` (server) and `VITE_POSTHOG_API_KEY` (client) if not already found.

**9 tests pass** covering: dot notation, import.meta.env, bracket notation, deduplication across 3 files, node_modules/dist skipping, fallback detection (required=false with `??`), section headers, PostHog key injection, REQUIRED markers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed tmpdir import in env-scanner test**
- **Found during:** Task 2 RED phase test run
- **Issue:** Test imported `tmpdir` from `path` module (doesn't exist there) — should import from Node.js `os` module
- **Fix:** Changed `import { join, tmpdir } from "path"` to `import { join } from "path"; import { tmpdir } from "os"`
- **Files modified:** `tests/unit/analytics-delivery/env-scanner.test.ts`
- **Commit:** Included in 15f7456

## Known Stubs

None — all exported functions are fully implemented. No placeholder values, no TODO items in the delivered code.

## Self-Check: PASSED

- [x] `lib/analytics-delivery/types.ts` exists and exports all 14 required types/schemas
- [x] `lib/analytics-delivery/taxonomy-auditor.ts` exists with `toSnakeCase` and `auditTaxonomy` exports
- [x] `lib/analytics-delivery/env-scanner.ts` exists with `scanEnvVars` and `generateEnvExample` exports
- [x] `tests/unit/analytics-delivery/taxonomy-auditor.test.ts` — 10 tests pass
- [x] `tests/unit/analytics-delivery/env-scanner.test.ts` — 9 tests pass
- [x] `taxonomy-auditor.ts` does NOT contain throw statements (only comments mentioning "not throw")
- [x] Commits fca02eb and 15f7456 exist
