---
phase: 3
slug: ui-generation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-28
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | UIGEN-01, UIGEN-03 | unit | `npx vitest run tests/unit/ui-generator/build-stitch-prompt.test.ts` | W0 | pending |
| 03-01-02 | 01 | 1 | UIGEN-06, UIGEN-07 | unit | `npx vitest run tests/unit/ui-generator/approval-gate.test.ts` | W0 | pending |
| 03-02-01 | 02 | 2 | UIGEN-02 | unit | `npx vitest run tests/unit/ui-generator/extract-tokens.test.ts` | W0 | pending |
| 03-02-02 | 02 | 2 | UIGEN-05 | unit | `npx vitest run tests/unit/ui-generator/conflict-detector.test.ts` | W0 | pending |
| 03-03-01 | 03 | 3 | UIGEN-04, UIGEN-05 | unit | `npx vitest run tests/unit/ui-generator/self-review.test.ts` | W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/ui-generator/build-stitch-prompt.test.ts` — stubs for UIGEN-01, UIGEN-03
- [ ] `tests/unit/ui-generator/approval-gate.test.ts` — stubs for UIGEN-06, UIGEN-07
- [ ] `tests/unit/ui-generator/extract-tokens.test.ts` — stubs for UIGEN-02
- [ ] `tests/unit/ui-generator/conflict-detector.test.ts` — stubs for UIGEN-05
- [ ] `tests/unit/ui-generator/self-review.test.ts` — stubs for UIGEN-04, UIGEN-05

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stitch API returns valid HTML and screenshot | UIGEN-01 | Requires live Stitch API key and network access | Call generateScreen() with a test prompt, verify htmlUrl and screenshotUrl are accessible |
| Visual consistency across pages | UIGEN-04 | Subjective visual quality cannot be automated | Compare screenshots of generated pages side-by-side |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
