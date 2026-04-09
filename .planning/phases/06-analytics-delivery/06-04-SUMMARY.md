---
phase: 06-analytics-delivery
plan: 04
subsystem: analytics-delivery
tags: [deploy-runner, preflight-validation, confirmation-gate, skill-definition, tdd]
dependency_graph:
  requires: [06-01, 06-02, 06-03]
  provides: [deploy-runner, analytics-delivery-skill]
  affects: [orchestrator]
tech_stack:
  added: []
  patterns: [injectable-execFn-for-testing, structured-DeployOutcome, preflight-before-execution]
key_files:
  created:
    - lib/analytics-delivery/deploy-runner.ts
    - tests/unit/analytics-delivery/deploy-runner.test.ts
    - .claude/skills/saas-dev/analytics-delivery/SKILL.md
  modified: []
decisions:
  - "deploy-runner uses injectable execFn parameter (same as migration-runner pattern) — enables vi.fn() test injection without module mocking"
  - "preflightDeploy separates secret validation from CLI validation — missingSecrets and missingCLI are distinct arrays for precise error messaging"
  - "Windows uses 'where' instead of 'which' for CLI binary detection — cross-platform compatibility"
  - "Render deploy hook uses curl not a dedicated CLI — curl is always available, no install needed"
  - "runDeploy confirmation gate returns immediately without preflight when confirmed=false — no wasted work"
metrics:
  duration_minutes: 5
  completed_date: "2026-03-31"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 06 Plan 04: Deploy Runner + Analytics-Delivery SKILL.md Summary

Deploy runner with preflight validation (secrets + CLI), explicit confirmation gate, and structured `DeployOutcome` modeling — plus the analytics-delivery `SKILL.md` that ties all 8 Phase 6 modules together for the orchestrator.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Deploy runner with preflight validation, confirmation gate, and structured outcomes | 3c00aa4 | `lib/analytics-delivery/deploy-runner.ts`, `tests/unit/analytics-delivery/deploy-runner.test.ts` |
| 2 | Analytics-delivery SKILL.md definition | 717f551 | `.claude/skills/saas-dev/analytics-delivery/SKILL.md` |

## What Was Built

### Task 1: deploy-runner.ts

Three exported functions addressing the review concerns about structured outcomes and credential validation:

**`checkCLIAvailable(target, execFn?)`** — verifies the platform CLI binary is accessible in PATH. Uses `which` on Unix, `where` on Windows. Always returns `true` for `custom` target (no CLI needed). Injectable `execFn` follows the Phase 5 migration-runner pattern for clean test isolation.

**`preflightDeploy(target, env, execFn?)`** — validates secrets (`RAILWAY_TOKEN`, `FLY_API_TOKEN`, `RENDER_DEPLOY_HOOK_URL`) and CLI availability before any deploy attempt. Returns structured `PreflightResult` with separate `missingSecrets` and `missingCLI` arrays. Never throws — always returns.

**`runDeploy(target, confirmed, options?, execFn?)`** — gate 1 returns `skipped` immediately if not confirmed. Gate 2 runs preflight — returns `failed-preflight` with specific error messages if not ready. On execution: `deployed` on success, `failed-runtime` with error message on CLI throw. Handles render hook URL interpolation from env.

CLI command map:
- `railway` → `railway up`
- `fly` → `flyctl deploy --remote-only`
- `render` → `curl -X POST {RENDER_DEPLOY_HOOK_URL}`
- `custom` → user-provided script

### Task 2: analytics-delivery SKILL.md

Complete Phase 6 skill definition following backend-wirer SKILL.md structure:

- **Frontmatter** with `name: saas-dev:analytics-delivery` and description
- **8-module map** covering all `lib/analytics-delivery/` modules with exports and roles
- **9-step pipeline** with TypeScript code snippets matching the orchestrator execution order
- **4 checkpoints**: taxonomy review (Step 1), PostHog setup (Step 2, only if key missing), hosting decision (Step 6), deploy confirmation (Step 9)
- **Error handling table** covering all failure modes with recovery actions
- **Output section** listing modified files, generated files, API side effects, and deployment result

## Decisions Made

- **Injectable execFn pattern** — `checkCLIAvailable` and `preflightDeploy` accept an optional `execFn` parameter defaulting to `execSync`. This is the same pattern established in Phase 5's `migration-runner.ts` and eliminates the need for `vi.mock()` module mocking in tests.
- **Separate secret and CLI arrays** — `PreflightResult.missingSecrets` and `missingCLI` are kept distinct so the orchestrator can surface targeted error messages ("Missing secret: RAILWAY_TOKEN" vs "Missing CLI: flyctl. Install: ...")
- **Render uses curl, not a dedicated CLI** — render deploy hooks are HTTP endpoints. `curl` is always available on Linux/macOS. This means render's `checkCLIAvailable` always passes without any install step.
- **Windows cross-platform** — `process.platform === "win32"` check uses `where` instead of `which` for binary detection.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all three functions are fully implemented with no placeholder logic.

## Self-Check: PASSED

Files exist:
- FOUND: lib/analytics-delivery/deploy-runner.ts
- FOUND: tests/unit/analytics-delivery/deploy-runner.test.ts
- FOUND: .claude/skills/saas-dev/analytics-delivery/SKILL.md

Commits exist:
- FOUND: 3c00aa4 (feat(06-04): deploy runner...)
- FOUND: 717f551 (feat(06-04): analytics-delivery SKILL.md...)

Tests: 15/15 passing
