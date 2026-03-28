---
phase: 02
slug: spec-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/unit/spec-` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/spec-`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SPEC-03 | unit | `npx vitest run tests/unit/spec-schema.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | SPEC-01 | unit | `npx vitest run tests/unit/spec-parser.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | SPEC-05 | unit | `npx vitest run tests/unit/spec-enrichment.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | SPEC-04 | unit | `npx vitest run tests/unit/backend-spec.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | SPEC-02 | manual | N/A — collaborative flow | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/spec-schema.test.ts` — stubs for PageSpec Zod contract validation
- [ ] `tests/unit/spec-parser.test.ts` — stubs for format-agnostic parsing
- [ ] `tests/unit/spec-enrichment.test.ts` — stubs for implied requirement extraction
- [ ] `tests/unit/backend-spec.test.ts` — stubs for backend spec derivation

*Existing vitest infrastructure covers test framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Collaborative spec creation flow | SPEC-02 | Requires interactive AI questioning loop — cannot be automated with unit tests | Run skill with no spec input, verify structured questioning produces valid PageSpec[] |
| Full restructured spec confirmation gate | SPEC-01 | Requires human review of AI-inferred items | Paste a raw spec, verify inferred items are visually distinct in output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
