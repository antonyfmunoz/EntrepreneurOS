---
phase: 05-backend-quality
plan: "04"
subsystem: backend-wirer
tags: [wiring-applier, skill, tdd, file-mutation, backend-wiring]
dependency_graph:
  requires: ["05-01", "05-02", "05-03"]
  provides: ["lib/backend-wirer/wiring-applier.ts", ".claude/skills/saas-dev/backend-wirer/SKILL.md"]
  affects: ["server/routes.ts", "server/storage.ts", "shared/schema.ts", "client/src/pages/*"]
tech_stack:
  added: []
  patterns: ["offset-based string splice", "read-once write-once per file", "forward-slash normalization for cross-platform paths"]
key_files:
  created:
    - lib/backend-wirer/wiring-applier.ts
    - tests/unit/backend-wirer/wiring-applier.test.ts
    - .claude/skills/saas-dev/backend-wirer/SKILL.md
  modified: []
decisions:
  - "WiringApplyResult.filesModified uses forward-slash normalized paths — cross-platform consistency between OS path.join output and test expectations"
  - "Empty plan short-circuits before any file reads — no I/O cost for no-op calls"
  - "Schema blocks applied first (before routes/storage) per D-15 — routes and storage may reference new tables"
  - "Storage functions inserted sequentially with advancing offset — each function placed after the previous, all before class closing brace"
metrics:
  duration_minutes: 44
  completed_date: "2026-03-29"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
requirements_satisfied: [BACK-02, BACK-03, BACK-04, BACK-05]
---

# Phase 05 Plan 04: Wiring Applier and backend-wirer SKILL.md Summary

**One-liner:** Offset-based file mutation applier that writes generated routes, schema tables, storage functions, and TanStack Query hook injections into the existing codebase — with pre-write collision validation and a backend-wirer SKILL.md documenting the full 9-module, 10-step pipeline.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for wiring-applier | 4e06286 | tests/unit/backend-wirer/wiring-applier.test.ts |
| 1 (GREEN) | Wiring applier module | b97384d | lib/backend-wirer/wiring-applier.ts |
| 2 | backend-wirer SKILL.md | 25559e6 | .claude/skills/saas-dev/backend-wirer/SKILL.md |

## Decisions Made

**1. Forward-slash path normalization in filesModified**

`path.join` uses OS-native separators (backslashes on Windows). `WiringApplyResult.filesModified` normalizes all paths to forward slashes via `.replace(/\\/g, "/")`. This keeps the result predictable across Linux VPS and Windows dev environments without requiring callers to handle both forms.

**2. Schema-first application order**

Schema blocks are applied to `shared/schema.ts` before storage functions and routes. This matches D-15 and prevents import resolution issues if generated route or storage code references the new table names.

**3. Sequential offset advancement for same-anchor insertions**

Storage functions and routes both insert at a single anchor point (class closing brace; `createServer(app)` line). After each insertion the offset advances by the inserted code length — so the second function appears after the first, all before the anchor.

**4. Empty plan short-circuit**

When all four collections are empty, `applyWiringPlan` returns immediately without reading any files. No I/O for a no-op call.

## Test Results

```
9/9 tests pass
- throws when validationResult.valid is false
- throws when validationResult.valid is false and includes gap details
- inserts route code before createServer anchor at correct offset
- appends schema code at end of schema content
- inserts storage function before closing brace at correct offset
- adds hook import and hook code to page file content
- throws when routesInsertionOffset is -1
- returns correct WiringApplyResult with file counts
- empty plan returns empty result without writing files
```

## Deviations from Plan

**1. [Rule 1 - Bug] Windows path separator normalization**

- **Found during:** Task 1 GREEN phase (first test run showed 8/9 passing)
- **Issue:** `path.join("/project", "server", "routes.ts")` returns `\project\server\routes.ts` on Windows, but test expectations used forward-slash paths `/project/server/routes.ts`
- **Fix:** Added `toForwardSlash` helper in wiring-applier.ts that normalizes all `filesModified` entries via `.replace(/\\/g, "/")`
- **Files modified:** lib/backend-wirer/wiring-applier.ts
- **Commit:** b97384d

## Known Stubs

None. wiring-applier.ts performs real file I/O using `fs/promises` readFile/writeFile. SKILL.md documents the actual module exports and pipeline steps without placeholder content.
