---
phase: 04-code-integration
plan: 01
subsystem: code-integrator
tags: [types, brownfield-audit, tdd, zod]
dependency_graph:
  requires: []
  provides: [BrownfieldInventory, TranslationInput, RouteInjectionInput, NavInjectionInput, IntegrationPhaseOutput]
  affects: [04-02, 04-03]
tech_stack:
  added: []
  patterns: [zod-schema-validation, regex-parsing, tdd-red-green]
key_files:
  created:
    - lib/code-integrator/types.ts
    - lib/code-integrator/brownfield-audit.ts
    - tests/unit/code-integrator/brownfield-audit.test.ts
  modified: []
decisions:
  - "BrownfieldInventory extracts isProtected/hasCompanyGate via per-block regex parsing (not line-by-line) — handles multi-line ProtectedRoute blocks correctly"
  - "Nav items parsed using li block isolation — prevents false positives from other icon/link patterns in sidebar"
  - "extractExportName reads only first 20 lines — perf guard for large page files"
metrics:
  duration_minutes: 5
  completed_date: "2026-03-29"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 4 Plan 01: Type Contracts and Brownfield Audit Summary

**One-liner:** Zod-validated type contracts for all Phase 4 modules plus a regex-based codebase scanner that returns a typed BrownfieldInventory before any files are written.

## What Was Built

### lib/code-integrator/types.ts
All 7 sections of shared Phase 4 type contracts:
1. `BrownfieldInventorySchema` — Zod schema validating the codebase snapshot
2. `TranslationInput` / `TranslationResult` — shapes for HTML-to-TSX conversion
3. `RouteInjectionInput` — shape for App.tsx route injection
4. `NavInjectionInput` — shape for sidebar.tsx nav injection (remixicon iconClass)
5. `PageIntegrationResult` — summary of one completed page integration
6. `IntegrationPhaseOutputSchema` — Zod schema for DB pipeline_pages.output
7. `RouteConflict` / `ConflictResolution` — conflict detection types

12 total exports — meets the >= 12 verification requirement.

### lib/code-integrator/brownfield-audit.ts
`auditBrownfield(projectRoot)` scans:
- `client/src/App.tsx` — extracts ProtectedRoute blocks via block-level regex, parses path, componentName, isProtected (always true for ProtectedRoute), hasCompanyGate
- `client/src/components/sidebar.tsx` — extracts nav items from `<li>` blocks containing Link, icon, and span
- `client/src/components/ui/` — filenames stripped of .tsx extension for installedShadcnComponents
- `client/src/pages/` — page files with export names extracted from first 20 lines
- `client/src/hooks/` — hook files (.ts + .tsx)
- `client/src/components/` (top-level only) — shared components excluding ui/ subdirectory

Result validated with `BrownfieldInventorySchema.parse()` before returning.

### tests/unit/code-integrator/brownfield-audit.test.ts
7 tests using a temp directory with mock project structure:
1. Schema validation passes on result
2. Route extraction (CompanyGate + standalone variants)
3. Page file listing
4. shadcn component listing
5. Nav item extraction (label + href + iconClass)
6. Shared components (top-level only, not ui/)
7. Hook listing

All 7 tests pass.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — all fields return real data from file system, validated by schema.

## Self-Check: PASSED

- [x] `lib/code-integrator/types.ts` exists — FOUND
- [x] `lib/code-integrator/brownfield-audit.ts` exists — FOUND
- [x] `tests/unit/code-integrator/brownfield-audit.test.ts` exists — FOUND
- [x] Commit b6206fe (feat(04-01): types) — FOUND
- [x] Commit fa0c873 (feat(04-01): brownfield audit) — FOUND
- [x] All 7 tests pass — CONFIRMED
