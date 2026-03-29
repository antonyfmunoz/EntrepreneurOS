---
phase: 5
slug: backend-quality
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-29
updated: 2026-03-29
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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 05-01-01 | 01 | 1 | BACK-01, BACK-05 | unit | `npx vitest run tests/unit/backend-wirer/types.test.ts -x` | pending |
| 05-01-02 | 01 | 1 | BACK-05 | unit | `npx vitest run tests/unit/backend-wirer/brownfield-backend-audit.test.ts -x` | pending |
| 05-02-01 | 02 | 2 | BACK-02, BACK-03, BACK-04 | unit | `npx vitest run tests/unit/backend-wirer/route-generator.test.ts tests/unit/backend-wirer/schema-generator.test.ts -x` | pending |
| 05-02-02 | 02 | 2 | BACK-02, BACK-04 | unit | `npx vitest run tests/unit/backend-wirer/hook-injector.test.ts tests/unit/backend-wirer/migration-runner.test.ts -x` | pending |
| 05-03-00 | 03 | 2 | TEST-02 | setup | `node -e "require('supertest'); console.log('OK')"` | pending |
| 05-03-01 | 03 | 2 | TEST-01, TEST-02 | unit | `npx vitest run tests/unit/test-runner/test-generator.test.ts -x` | pending |
| 05-03-02 | 03 | 2 | TEST-01, TEST-03 | unit | `npx vitest run tests/unit/test-runner/fix-loop.test.ts -x` | pending |
| 05-04-01 | 04 | 3 | BACK-02, BACK-03, BACK-04, BACK-05 | unit | `npx vitest run tests/unit/backend-wirer/wiring-applier.test.ts -x` | pending |
| 05-04-02 | 04 | 3 | — | file check | `test -f .claude/skills/saas-dev/backend-wirer/SKILL.md` | pending |

*Status: pending -- green -- red -- flaky*

---

## Requirement Coverage

| Req ID | Description | Plans Covering | Verified By |
|--------|-------------|----------------|-------------|
| BACK-01 | Contract extraction from BackendSpec | 01 | types.test.ts + brownfield-backend-audit.test.ts |
| BACK-02 | Add Express routes | 02, 04 | route-generator.test.ts + wiring-applier.test.ts |
| BACK-03 | Extend Drizzle schema | 02, 04 | schema-generator.test.ts + wiring-applier.test.ts |
| BACK-04 | Add Zod validation | 02, 04 | route-generator.test.ts (inline Zod) + wiring-applier.test.ts |
| BACK-05 | Brownfield-aware wiring | 01, 04 | brownfield-backend-audit.test.ts + wiring-applier.test.ts |
| TEST-01 | Test-fix loop | 03 | fix-loop.test.ts |
| TEST-02 | Integration tests | 03 | test-generator.test.ts + auth-smoke.test.ts |
| TEST-03 | Passing suite gate | 03 | fix-loop.test.ts (escalation behavior) |

All 8 requirements covered by at least one plan.

---

## Wave Structure

| Wave | Plans | Description |
|------|-------|-------------|
| 1 | 05-01 | Type contracts + brownfield audit |
| 2 | 05-02, 05-03 | Code generators + test infrastructure (parallel) |
| 3 | 05-04 | Wiring applier + SKILL.md (depends on 02 + 03) |

---

## Auth Mocking Validation (Open Question 1 from RESEARCH.md)

Plan 03 Task 1 includes `tests/integration/helpers/auth-smoke.test.ts` — a dedicated smoke test that validates the pre-auth middleware injection pattern against the existing `GET /api/company` endpoint before bulk test generation. This resolves Open Question 1.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Existing routes untouched | BACK-02 | Brownfield audit is code-level, but visual confirmation of unchanged routes needed | Diff `server/routes.ts` before/after — only appended sections |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] All requirements mapped to at least one plan
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
