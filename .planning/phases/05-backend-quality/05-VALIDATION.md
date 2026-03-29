---
phase: 5
slug: backend-quality
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` (already includes `tests/integration/**/*.test.ts`) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 0 | TEST-01 | integration | `npx vitest run tests/integration/` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | BACK-01 | integration | `npx vitest run tests/integration/` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | BACK-02 | integration | `npx vitest run tests/integration/` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 1 | BACK-03 | integration | `npx vitest run tests/integration/` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 1 | BACK-04 | integration | `npx vitest run tests/integration/` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 2 | BACK-05 | integration | `npx vitest run tests/integration/` | ❌ W0 | ⬜ pending |
| 05-04-02 | 04 | 2 | TEST-02 | integration | `npx vitest run tests/integration/` | ❌ W0 | ⬜ pending |
| 05-05-01 | 05 | 2 | TEST-03 | integration | `npx vitest run tests/integration/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supertest` — install as dev dependency for HTTP integration tests
- [ ] `tests/integration/setup.ts` — shared test fixtures (auth mocking, transaction rollback, app bootstrap)
- [ ] `tests/integration/smoke.test.ts` — smoke test against one existing endpoint to validate auth mocking approach

*Wave 0 validates the auth middleware injection and transaction rollback isolation patterns before bulk endpoint generation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Existing routes untouched | BACK-02 | Brownfield audit is code-level, but visual confirmation of unchanged routes needed | Diff `server/routes.ts` before/after — only appended sections |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
