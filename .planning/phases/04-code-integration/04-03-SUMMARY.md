---
phase: 04-code-integration
plan: 03
subsystem: code-integrator
tags: [route-injection, nav-injection, git-workflow, skill, tdd]
dependency_graph:
  requires: [04-01]
  provides: [INTG-04, INTG-05, GIT-01, GIT-02, GIT-03]
  affects: [client/src/App.tsx, client/src/components/sidebar.tsx, feature/ui-integration branch]
tech_stack:
  added: []
  patterns: [string-based-insertion, injectable-exec, tdd-red-green]
key_files:
  created:
    - lib/code-integrator/route-injector.ts
    - lib/code-integrator/nav-injector.ts
    - lib/code-integrator/git-workflow.ts
    - lib/code-integrator/types.ts
    - tests/unit/code-integrator/route-injector.test.ts
    - tests/unit/code-integrator/nav-injector.test.ts
    - tests/unit/code-integrator/git-workflow.test.ts
    - .claude/skills/saas-dev/integrator/SKILL.md
    - vitest.config.ts
  modified: []
decisions:
  - "route-injector uses string-based insertion anchored on NotFound route — App.tsx structure is stable and predictable"
  - "nav-injector uses string-based insertion anchored on space-y-2 ul close tag — sidebar structure is stable"
  - "git-workflow uses injectable execFn parameter (same pattern as migration-runner and deploy-runner) for clean test isolation"
  - "detectBaseBranch checks client/src/lib/company-guard.tsx existence for D-16 base branch decision"
  - "SKILL.md step 3e wires checkFileConflict before writePage for D-10 file conflict resolution"
metrics:
  duration_minutes: 9
  completed_date: "2026-04-02"
  tasks_completed: 2
  files_created: 9
---

# Phase 4 Plan 03: Route Injector, Nav Injector, Git Workflow, and Integrator SKILL.md Summary

**One-liner:** Route/nav injection via string-based anchors (NotFound, space-y-2) plus git workflow with injectable execFn and detectBaseBranch D-16 logic, tied together by integrator SKILL.md.

## What Was Built

### Task 1: Route Injector + Nav Injector (TDD)

**`lib/code-integrator/route-injector.ts`** — `injectRoute` and `detectRouteConflict`

- `injectRoute` reads App.tsx, finds the last import line and inserts the new import after it, then locates `<Route component={NotFound}` anchor and inserts the ProtectedRoute block before it
- When `wrapCompanyGate=true && !isStandalone`: generates full `<ProtectedRoute><CompanyGate>` wrapper block
- When `isStandalone=true` or `wrapCompanyGate=false`: generates `<ProtectedRoute component={X} />` inline form
- `detectRouteConflict` scans `BrownfieldInventory.existingRoutes` for path match, returns `RouteConflict` or null

**`lib/code-integrator/nav-injector.ts`** — `injectNavItem`

- Finds `<ul className="space-y-2">` open tag, then locates closing `</ul>` and inserts li block before it
- Generated nav item: `Link > div.cn() > i.ri-* > span` — matches exact existing sidebar.tsx pattern
- Uses `location` variable already in scope for active state detection
- Per Research Pitfall 7: uses remixicon `ri-*` class strings, not Lucide React components

6 route-injector tests + 4 nav-injector tests — all pass.

### Task 2: Git Workflow + Integrator SKILL.md (TDD)

**`lib/code-integrator/git-workflow.ts`** — `createBranch`, `commitPage`, `pushAndCreatePR`, `detectBaseBranch`

- All functions accept optional `execFn: ExecFn` parameter defaulting to `promisify(child_process.exec)` — enables clean test injection without module mocking
- `createBranch(baseBranch, execFn)`: `git checkout {base}` then `git checkout -b feature/ui-integration`
- `commitPage(pageName, files, execFn)`: stages files with quoted paths, commits with `feat(ui): integrate {name} page`, returns short hash from `git log -1 --format=%h`
- `pushAndCreatePR(pagesSummary, execFn)`: pushes branch, runs `gh pr create`, returns PR URL
- `detectBaseBranch(projectRoot, execFn)`: checks `client/src/lib/company-guard.tsx` existence — returns "main" if present, "feature/company-system" if that branch exists, "main" as final fallback (D-16)

10 git-workflow tests — all pass.

**`.claude/skills/saas-dev/integrator/SKILL.md`** — Full pipeline orchestration skill

5-step pipeline: Initialize (detectBaseBranch + createBranch + DB query) → Brownfield Audit → Per-Page Loop (3a-3j) → Push and PR → Completion Summary.

Per-page loop wires: HTML fetch (expiry guard) → translateHtmlToShadcn → ensureShadcnComponents → detectRouteConflict → checkFileConflict (D-10) → writePage → injectRoute → injectNavItem → commitPage → inventory update → DB write.

7 pitfalls, error handling table, remixicon icon selection guide.

## Test Results

```
Test Files  3 passed (3)
      Tests  20 passed (20)
   Duration  1.64s
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all implementations are complete and functional.

## Self-Check: PASSED

Files exist:
- lib/code-integrator/route-injector.ts: FOUND
- lib/code-integrator/nav-injector.ts: FOUND
- lib/code-integrator/git-workflow.ts: FOUND
- tests/unit/code-integrator/route-injector.test.ts: FOUND
- tests/unit/code-integrator/nav-injector.test.ts: FOUND
- tests/unit/code-integrator/git-workflow.test.ts: FOUND
- .claude/skills/saas-dev/integrator/SKILL.md: FOUND

Commits exist:
- aa94ced: test(04-03): add failing tests for route injector and nav injector
- 334d6bd: feat(04-03): implement route injector and nav injector with TDD
- 0a0606d: test(04-03): add failing tests for git workflow module
- 975400b: feat(04-03): implement git workflow module and integrator SKILL.md
