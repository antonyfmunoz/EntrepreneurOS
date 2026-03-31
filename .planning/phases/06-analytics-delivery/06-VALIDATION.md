---
phase: 6
slug: analytics-delivery
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-30
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npx vitest run tests/unit/analytics-delivery/` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/analytics-delivery/`
- **After every plan wave:** Run `npm test` (full suite — must keep 268+ passing)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-T1 | 01 | 1 | ANLYT-01 | unit | `npx vitest run tests/unit/analytics-delivery/taxonomy-auditor.test.ts -x` | W0 | pending |
| 06-01-T2 | 01 | 1 | ANLYT-01 | unit | `npx vitest run tests/unit/analytics-delivery/env-scanner.test.ts -x` | W0 | pending |
| 06-02-T1 | 02 | 2 | DEPLOY-01, DEPLOY-02 | unit | `npx vitest run tests/unit/analytics-delivery/docker-config-generator.test.ts -x` | W0 | pending |
| 06-02-T2 | 02 | 2 | DEPLOY-03 | unit | `npx vitest run tests/unit/analytics-delivery/github-actions-generator.test.ts -x` | W0 | pending |
| 06-03-T1 | 03 | 2 | ANLYT-02 | unit | `npx vitest run tests/unit/analytics-delivery/analytics-injector.test.ts -x` | W0 | pending |
| 06-03-T2 | 03 | 2 | ANLYT-03 | unit | `npx vitest run tests/unit/analytics-delivery/posthog-setup.test.ts -x` | W0 | pending |
| 06-04-T1 | 04 | 3 | DEPLOY-04, DEPLOY-05 | unit (mock exec) | `npx vitest run tests/unit/analytics-delivery/deploy-runner.test.ts -x` | W0 | pending |
| 06-04-T2 | 04 | 3 | — | file check | `test -f ".claude/skills/saas-dev/analytics-delivery/SKILL.md" && grep -q "saas-dev:analytics-delivery" ".claude/skills/saas-dev/analytics-delivery/SKILL.md" && echo "PASS"` | — | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/analytics-delivery/taxonomy-auditor.test.ts` — stubs for ANLYT-01 (Plan 01 T1)
- [ ] `tests/unit/analytics-delivery/env-scanner.test.ts` — stubs for env scanning (Plan 01 T2)
- [ ] `tests/unit/analytics-delivery/docker-config-generator.test.ts` — stubs for DEPLOY-01, DEPLOY-02 (Plan 02 T1)
- [ ] `tests/unit/analytics-delivery/github-actions-generator.test.ts` — stubs for DEPLOY-03 (Plan 02 T2)
- [ ] `tests/unit/analytics-delivery/analytics-injector.test.ts` — stubs for ANLYT-02 (Plan 03 T1)
- [ ] `tests/unit/analytics-delivery/posthog-setup.test.ts` — stubs for ANLYT-03 (Plan 03 T2)
- [ ] `tests/unit/analytics-delivery/deploy-runner.test.ts` — stubs for DEPLOY-04, DEPLOY-05 (Plan 04 T1)

*Existing infrastructure covers framework — only test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GitHub environment Required Reviewers gate | DEPLOY-05 | GitHub Settings UI — cannot be automated via code | Verify repo Settings > Environments > production > Required Reviewers is enabled |
| PostHog dashboard widget layout | ANLYT-03 | PostHog dashboard API undocumented; generateDashboardGuide() produces instructions | Follow generated dashboard guide markdown in PostHog UI |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
