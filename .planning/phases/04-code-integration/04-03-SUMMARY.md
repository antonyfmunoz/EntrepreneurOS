---
phase: "04-code-integration"
plan: "03"
subsystem: "code-integrator"
tags: ["route-injection", "nav-injection", "git-workflow", "skill", "tdd"]
dependency_graph:
  requires: ["04-01"]
  provides: ["INTG-04", "INTG-05", "GIT-01", "GIT-02", "GIT-03"]
  affects: ["client/src/App.tsx injection", "client/src/components/sidebar.tsx injection", "git branch lifecycle"]
tech_stack:
  added: []
  patterns:
    - "string-based insertion for App.tsx and sidebar.tsx (stable anchors: NotFound route, space-y-2 ul)"
    - "injectable ExecFn parameter pattern for git operations (enables test isolation without vi.mock)"
    - "real tmpdir tests for file mutation tests (no memfs dependency needed)"
key_files:
  created:
    - lib/code-integrator/route-injector.ts
    - lib/code-integrator/nav-injector.ts
    - lib/code-integrator/git-workflow.ts
    - tests/unit/code-integrator/route-injector.test.ts
    - tests/unit/code-integrator/nav-injector.test.ts
    - tests/unit/code-integrator/git-workflow.test.ts
    - .claude/skills/saas-dev/integrator/SKILL.md
  modified: []
decisions:
  - "ExecFn injectable parameter instead of vi.mock(child_process) — promisify captures the function reference at module init, so vi.mockImplementation in tests would not be visible to execAsync. Injectable execFn avoids this entirely."
  - "Real tmpdir tests for file mutation — follows same pattern as brownfield-audit tests (Plan 01), no memfs dependency needed."
  - "detectBaseBranch accepts execFn parameter — consistent with other git-workflow functions, enables clean test isolation for the 3 D-16 branch-detection cases."
metrics:
  duration: "6 minutes"
  completed_date: "2026-03-29"
  tasks_completed: 2
  files_created: 7
---

# Phase 4 Plan 03: Route Injector, Nav Injector, Git Workflow, and Integrator SKILL.md Summary

Route injection (INTG-04), nav injection (INTG-05), git workflow (GIT-01/02/03) implemented with TDD, and the integrator SKILL.md written to orchestrate the full per-page integration pipeline.

## Tasks Completed

### Task 1: Route injector and nav injector with TDD

**Commit:** `54d6b25`

- `injectRoute` reads App.tsx, inserts import after last existing import, inserts ProtectedRoute + CompanyGate block before `<Route component={NotFound}` anchor
- `detectRouteConflict` checks routePath against BrownfieldInventory.existingRoutes, returns RouteConflict or null
- `injectNavItem` reads sidebar.tsx, inserts `<li>` block with Link/div/cn()/i/span pattern before closing `</ul>` of `<ul className="space-y-2">`
- All insertion uses string-based approach with stable anchors (per Research recommendation for App.tsx and sidebar.tsx)
- 10 unit tests pass (6 route-injector, 4 nav-injector) using real tmpdir pattern

### Task 2: Git workflow module and integrator SKILL.md

**Commit:** `504483d`

- `createBranch(baseBranch, execFn)` — checks out base, creates feature/ui-integration
- `commitPage(pageName, files, execFn)` — stages specified files, commits "feat(ui): integrate {pageName} page", returns short hash
- `pushAndCreatePR(pagesSummary, execFn)` — pushes to origin, creates PR via gh CLI, returns PR URL
- `detectBaseBranch(projectRoot, execFn)` — D-16: checks company-guard.tsx/use-company.ts existence, then git branch list, returns "main" or "feature/company-system"
- All functions accept injectable ExecFn for test isolation
- 10 unit tests pass (full detectBaseBranch 3-case coverage)
- integrator SKILL.md documents 5-step pipeline (Initialize, Brownfield Audit, Per-Page Loop, Push+PR, Completion) with all 7 modules referenced, D-10 conflict resolution wired via checkFileConflict, D-16 base branch detection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced vi.mock(child_process) pattern with injectable ExecFn**

- **Found during:** Task 2 (git-workflow tests, 6 failures)
- **Issue:** `promisify(exec)` captures the exec reference at module load time. `vi.clearAllMocks()` between tests clears the `mockImplementation`, so `execAsync` calls the cleared mock, returning undefined stdout. `stdout.trim()` then throws.
- **Fix:** Added `ExecFn` type and optional `execFn` parameter to all git-workflow functions (defaulting to `promisify(exec)`). Tests pass a locally constructed execFn with controlled responses instead of relying on module-level mock patching.
- **Files modified:** `lib/code-integrator/git-workflow.ts`, `tests/unit/code-integrator/git-workflow.test.ts`
- **Commit:** `504483d`

## Known Stubs

None — all code paths are implemented. The SKILL.md references `translateHtmlToShadcn`, `mergeWithClaude`, and `getUserInput` as orchestration call-sites that will be implemented in subsequent plans (html-to-shadcn.ts is Phase 4 Plan 02 territory).

## Self-Check: PASSED

Files created:
- lib/code-integrator/route-injector.ts — EXISTS
- lib/code-integrator/nav-injector.ts — EXISTS
- lib/code-integrator/git-workflow.ts — EXISTS
- tests/unit/code-integrator/route-injector.test.ts — EXISTS
- tests/unit/code-integrator/nav-injector.test.ts — EXISTS
- tests/unit/code-integrator/git-workflow.test.ts — EXISTS
- .claude/skills/saas-dev/integrator/SKILL.md — EXISTS

Commits:
- 54d6b25 — feat(04-03): implement route injector and nav injector with TDD
- 504483d — feat(04-03): implement git workflow module and integrator SKILL.md

Tests: 27/27 passing across 4 test files
