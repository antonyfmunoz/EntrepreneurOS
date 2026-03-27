---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest@2 (Vite 5 compatible) |
| **Config file** | `vitest.config.ts` at project root (Wave 0 — does not exist yet) |
| **Quick run command** | `npx vitest run tests/unit` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | ORCH-02 | unit | `npx vitest run tests/unit/design-schema.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 0 | ORCH-03 | unit | `npx vitest run tests/unit/design-schema.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 0 | ORCH-04 | unit | `npx vitest run tests/unit/pipeline-schemas.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 0 | INTG-06 | unit | `npx vitest run tests/unit/detect-framework.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-05 | 01 | 0 | ORCH-01/05 | smoke | manual file inspection | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — dual-environment config (node + jsdom projects)
- [ ] `tests/unit/design-schema.test.ts` — stubs for ORCH-02, ORCH-03
- [ ] `tests/unit/pipeline-schemas.test.ts` — stubs for ORCH-04
- [ ] `tests/unit/detect-framework.test.ts` — stubs for INTG-06
- [ ] `tests/setup-dom.ts` — @testing-library/jest-dom import for jsdom project
- [ ] Framework install: `npm install -D vitest@2 jsdom @testing-library/react @testing-library/jest-dom`
- [ ] `package.json` scripts: add `"test": "vitest run"` and `"test:watch": "vitest"`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stitch live generate call | ORCH-05 | Requires STITCH_API_KEY env var | Set STITCH_API_KEY, run `npx vitest run tests/integration/stitch-wrapper.test.ts` |
| Skill SKILL.md frontmatter | ORCH-01/05 | File format validation | Check `.claude/skills/saas-dev/` for valid SKILL.md files with correct frontmatter |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
