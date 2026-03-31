---
phase: 03-ui-generation
plan: "04"
subsystem: ui-generator
tags: [security, html-sanitization, design-system-seeding, gemini-mockup, fail-closed]
dependency_graph:
  requires: ["03-03"]
  provides: ["html-sanitizer", "design-system-seeder", "gemini-mockup"]
  affects: ["03-05", "03-06"]
tech_stack:
  added: []
  patterns:
    - fail-closed defaults (DEFAULT_DESIGN_SEED on malformed Claude response)
    - null-return on missing env key (generateReferenceMockup)
    - security boundary via sanitizeHtmlForModel before all LLM input
key_files:
  created:
    - lib/ui-generator/html-sanitizer.ts
    - lib/ui-generator/design-system-seeder.ts
    - lib/ui-generator/gemini-mockup.ts
    - tests/unit/ui-generator/html-sanitizer.test.ts
    - tests/unit/ui-generator/design-system-seeder.test.ts
    - tests/unit/ui-generator/gemini-mockup.test.ts
  modified:
    - lib/ui-generator/types.ts
    - lib/ui-generator/build-stitch-prompt.ts
    - .claude/skills/saas-dev/ui-generator/SKILL.md
decisions:
  - "html-sanitizer strips script tags, event handlers, and prompt-injection markers (SYSTEM:, IGNORE PREVIOUS, YOU ARE) in HTML comments before any LLM input"
  - "seedDesignSystem uses pRetry(retries=2) + DEFAULT_DESIGN_SEED fail-closed fallback — never throws, never crashes pipeline"
  - "generateReferenceMockup returns null when GEMINI_API_KEY unset or on any error — best-effort enhancement, not pipeline requirement"
  - "buildStitchPrompt 4th param componentDirection is optional — all existing 3-arg callers unaffected"
  - "MAX_PROMPT_TOTAL_CHARS = 30_000 addresses review concern about prompt size growth across tokens, patterns, component refs"
metrics:
  duration_seconds: 1083
  completed_date: "2026-03-31"
  tasks_completed: 2
  files_created: 6
  files_modified: 3
---

# Phase 03 Plan 04: Pre-Generation and HTML Safety Layer Summary

HTML sanitization security boundary, design system seeding before page generation, and Gemini reference mockup — all fail-closed.

## What Was Built

### Task 1: Three New Library Modules + Types (TDD)

**`lib/ui-generator/html-sanitizer.ts`** — Security boundary for all LLM-bound HTML.
- `sanitizeHtmlForModel(html, maxChars?)` strips: `<script>` tags, `on*` event handler attributes, HTML comments with injection markers (SYSTEM:, IGNORE PREVIOUS, YOU ARE, ASSISTANT:, HUMAN:), oversized data-* attributes (200+ chars), then truncates.
- Addresses Codex HIGH + Gemini MEDIUM review concern: raw Stitch HTML could contain prompt injection.

**`lib/ui-generator/design-system-seeder.ts`** — Initial design context before Page 1 goes to Stitch.
- `seedDesignSystem(input)` calls Claude Sonnet 4-5 with pRetry(2), validates via `DesignSystemSeedSchema`, returns `DEFAULT_DESIGN_SEED` on any failure (fail-closed).
- `seedToTokens(seed)` maps colorPalette/fontPairing/spacingSystem to partial DmTokenRow — pure function, no I/O.
- `DesignSystemSeedSchema` exported for external validation.

**`lib/ui-generator/gemini-mockup.ts`** — Best-effort reference mockup via Gemini 2.0 Flash.
- `generateReferenceMockup(input)` returns `MockupResult | null`. Returns null if `GEMINI_API_KEY` unset, or on any Gemini error — never throws, never blocks pipeline.

**`lib/ui-generator/types.ts`** — Extended with 4 new sections:
- Section 10: `MAX_PROMPT_TOTAL_CHARS = 30_000`
- Section 11: `DesignSystemSeed` interface
- Section 12: `MockupResult` interface
- Section 13: `DEFAULT_DESIGN_SEED` constant

### Task 2: buildStitchPrompt Enhancement + SKILL.md Documentation

**`lib/ui-generator/build-stitch-prompt.ts`** — Added optional 4th parameter `componentDirection?: string`. When provided, appended as "Component style direction: ..." line. Backwards compatible — all existing callers unaffected (6 existing tests still pass).

**`.claude/skills/saas-dev/ui-generator/SKILL.md`** — Three additions:
- Module Map table: 3 new rows (design-system-seeder, gemini-mockup, html-sanitizer)
- Step 0.5: Design System Seeding — runs once before page loop when currentTokens is null
- Step 2a.5: Reference Mockup Generation — per-page best-effort Gemini call
- Security: HTML Sanitization section — mandate with code examples

## Test Results

- 23 new tests added (8 html-sanitizer, 10 design-system-seeder, 5 gemini-mockup)
- All 59 tests in `tests/unit/ui-generator/` pass
- No regressions in existing test suite

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All modules are fully wired. The `generateReferenceMockup` null-return path is intentional design, not a stub.

## Self-Check: PASSED

Files created:
- lib/ui-generator/html-sanitizer.ts — FOUND
- lib/ui-generator/design-system-seeder.ts — FOUND
- lib/ui-generator/gemini-mockup.ts — FOUND
- tests/unit/ui-generator/html-sanitizer.test.ts — FOUND
- tests/unit/ui-generator/design-system-seeder.test.ts — FOUND
- tests/unit/ui-generator/gemini-mockup.test.ts — FOUND

Commits:
- 52b57e0 — test(03-04): add failing tests
- c7e26df — feat(03-04): implement modules
- b6e4c1d — feat(03-04): enhance buildStitchPrompt + SKILL.md
