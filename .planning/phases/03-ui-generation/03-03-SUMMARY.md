---
phase: 03-ui-generation
plan: 03
subsystem: ui-generator
tags: [self-review, skill-definition, claude-api, tdd, pipeline-orchestration]
dependency_graph:
  requires:
    - 03-01 (types, build-stitch-prompt, approval-gate)
    - 03-02 (extract-tokens, conflict-detector)
    - lib/spec-parser/restructure-spec.ts (extractJsonFromResponse helper)
    - shared/spec-schema.ts (PageSpecFull type)
    - shared/design-schema.ts (dmTokens, dmPatterns, dmPages, pipelinePages tables)
  provides:
    - lib/ui-generator/self-review.ts (selfReview function)
    - .claude/skills/saas-dev/ui-generator/SKILL.md (full page pipeline skill)
  affects:
    - .claude/skills/saas-dev/orchestrator/SKILL.md (now has a concrete ui-generator sub-skill to route to)
tech_stack:
  added:
    - selfReview: Claude Sonnet 4-5 API call with pRetry (2 retries, minTimeout 1000ms, factor 2)
  patterns:
    - TDD: RED (failing import) -> GREEN (implementation) -> REFACTOR (test assertion precision fix)
    - Same Anthropic client pattern as extract-tokens.ts: lazy getClient(), env vars AI_INTEGRATIONS_ANTHROPIC_API_KEY and AI_INTEGRATIONS_ANTHROPIC_BASE_URL
    - Same pRetry pattern as extract-tokens.ts and stitch/client.ts
    - extractJsonFromResponse reused from spec-parser/restructure-spec.ts for JSON parsing
key_files:
  created:
    - lib/ui-generator/self-review.ts
    - tests/unit/ui-generator/self-review.test.ts
    - .claude/skills/saas-dev/ui-generator/SKILL.md
  modified: []
decisions:
  - D-11 applied: Claude Sonnet 4-5 with max_tokens 2048 (review response smaller than extraction)
  - D-09 applied: Four dimensions (specCompliance, visualConsistency, structuralCompleteness, contentQuality) with per-dimension findings arrays
  - D-12 applied: Multi-device support handled by passing all screenshotUrls in single selfReview call
  - TDD test assertion precision: Test 5 (HTML truncation) initially used total x-char counting which included token field values (px units in shadowStyle). Fixed to use HTML section extraction via split("## Generated HTML\n") and unique marker pattern.
metrics:
  duration_minutes: 7
  completed_date: "2026-03-29"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
  tests_added: 6
  tests_total: 146
  test_files_passing: 15
---

# Phase 3 Plan 03: Self-Review Scorer and UI Generator Skill Summary

**One-liner:** Claude Sonnet 4-dimension self-review scorer with pRetry validation and saas-dev:ui-generator SKILL.md wiring all Phase 3 modules into a page-by-page pipeline with user confirmation gates.

## Tasks Completed

### Task 1: Self-review scorer with Claude API (TDD)

**RED:** Wrote 6 failing tests in `tests/unit/ui-generator/self-review.test.ts` covering all behaviors before implementation existed. Tests failed with "file not found" error confirming RED state.

**GREEN:** Implemented `lib/ui-generator/self-review.ts` with `selfReview()` function that:
- Accepts `SelfReviewInput` (htmlContent, screenshotUrls, spec, tokens, priorPatterns)
- Truncates HTML to `MAX_HTML_FOR_REVIEW` (120,000 chars) before sending to Claude
- Builds a structured user message with 4 sections: Page Specification, Design Tokens, Prior Component Patterns, Generated HTML
- When `tokens === null` (page 1): writes "No design tokens established yet (first page)."
- Calls Claude Sonnet 4-5 with `max_tokens: 2048`
- Validates response against `ReviewScoreSchema.parse()` from `./types.js`
- Wraps entire Claude call in pRetry with 2 retries, minTimeout 1000ms, factor 2
- Returns validated `ReviewScore` with 4 dimensions

All 6 tests pass.

### Task 2: UI Generator SKILL.md definition

Created `.claude/skills/saas-dev/ui-generator/SKILL.md` as a complete Claude Code skill definition that a Claude Code executor can run to perform the full page-by-page UI generation pipeline.

Skill covers:
- **5 pipeline steps**: Device type configuration, page order, per-page generation loop, gate handling, completion
- **All module references**: `buildStitchPrompt`, `generateScreen`, `selfReview`, `evaluateApprovalGate`, `formatApprovalGateDisplay`, `formatAutoApproveNotice`, `extractTokensFromHtml`, `detectPatternConflicts`
- **Critical pitfall documented**: Stitch returns presigned URLs — must fetch HTML content separately before passing to review/extraction
- **D-03 device configuration**: Interactive user prompt with DESKTOP/MOBILE/TABLET options
- **D-04 rejection retries**: 3-retry limit with full feedback history escalation
- **D-05 confirmation gate**: Mandatory user confirmation between token extraction and database persistence, with token diff table, edit option, and skip option
- **D-08 conflict resolution**: Per-conflict resolution choices (unify, keep variants, override)
- **D-13 first-page rule**: Page 0 always escalates regardless of score
- **D-16 auto-approve notice**: One-line summary for auto-approved pages
- **Complete Drizzle ORM patterns**: Insert/update operations for dmTokens, dmPatterns, dmPages, pipelinePages
- **Error handling table**: ENV_MISSING, recoverable: false, Claude exhaustion, DB write errors, presigned URL expiry

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test 5 assertion was overly broad for HTML truncation check**
- **Found during:** Task 1 GREEN phase
- **Issue:** Test 5 counted all "x" characters in the full user message (including "px" units in shadowStyle token value: "0 4px 6px -1px rgba(0,0,0,0.5)" = 3 extra "x" chars + 1 more from token JSON), resulting in count > MAX_HTML_FOR_REVIEW
- **Fix:** Replaced total x-char counting with section-based extraction: split on "## Generated HTML\n", measure section length directly, use unique marker pattern (ZZZZ prefix only appears once at truncation boundary)
- **Files modified:** `tests/unit/ui-generator/self-review.test.ts`
- **Commit:** a046d74 (included in Task 1 commit)

## Known Stubs

None — all exported functions are fully implemented. The SKILL.md documents runtime patterns (Drizzle inserts, user interaction) that a Claude Code executor implements at runtime, not stubs in the library code.

## Self-Check: PASSED

Files verified to exist:
- lib/ui-generator/self-review.ts: FOUND
- tests/unit/ui-generator/self-review.test.ts: FOUND
- .claude/skills/saas-dev/ui-generator/SKILL.md: FOUND

Commits verified:
- a046d74: feat(03-03): implement Claude-based self-review scorer with TDD — FOUND
- ca81cb5: feat(03-03): add saas-dev:ui-generator SKILL.md orchestration definition — FOUND

Tests: 146/146 passing across 15 test files.
