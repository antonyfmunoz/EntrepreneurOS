---
phase: 4
slug: code-integration
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-28
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (existing project config) |
| **Quick run command** | `npx vitest run tests/unit/code-integrator/ --reporter=verbose` |
| **Full suite command** | `npx vitest run tests/unit/code-integrator/ --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/code-integrator/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run tests/unit/code-integrator/ --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | INTG-01 | unit | `npx vitest run tests/unit/code-integrator/brownfield-audit.test.ts --reporter=verbose` | W0 (created in task) | pending |
| 04-01-02 | 01 | 1 | INTG-01 | unit | `npx vitest run tests/unit/code-integrator/brownfield-audit.test.ts --reporter=verbose` | W0 (created in task) | pending |
| 04-02-01 | 02 | 2 | INTG-02 | unit | `npx vitest run tests/unit/code-integrator/html-to-shadcn.test.ts --reporter=verbose` | W0 (created in task) | pending |
| 04-02-02 | 02 | 2 | INTG-03 | unit | `npx vitest run tests/unit/code-integrator/page-writer.test.ts --reporter=verbose` | W0 (created in task) | pending |
| 04-03-01 | 03 | 2 | INTG-04, INTG-05 | unit | `npx vitest run tests/unit/code-integrator/route-injector.test.ts tests/unit/code-integrator/nav-injector.test.ts --reporter=verbose` | W0 (created in task) | pending |
| 04-03-02 | 03 | 2 | GIT-01, GIT-02, GIT-03 | unit | `npx vitest run tests/unit/code-integrator/git-workflow.test.ts --reporter=verbose` | W0 (created in task) | pending |

*Status: pending - all tasks use TDD so tests are created within each task*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements:
- vitest is already configured in the project
- All test files are created as part of each TDD task (tests written FIRST)
- No additional test framework installation needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SKILL.md documents full pipeline | All | Structural document review | Read `.claude/skills/saas-dev/integrator/SKILL.md`, verify it references all 7 modules and covers D-10 conflict resolution and D-16 base branch |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none needed — TDD creates tests inline)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
