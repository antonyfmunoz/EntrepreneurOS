---
phase: 03-ui-generation
plan: 02
subsystem: ui-generator
tags: [token-extraction, conflict-detection, claude-api, design-memory, tdd]
dependency_graph:
  requires: [03-01]
  provides: [extract-tokens, conflict-detector]
  affects: [03-03]
tech_stack:
  added: []
  patterns: [pRetry wrapping Claude API calls, nullish coalescing for immutable token merge, semantic substring comparison for conflict detection]
key_files:
  created:
    - lib/ui-generator/extract-tokens.ts
    - lib/ui-generator/conflict-detector.ts
    - tests/unit/ui-generator/extract-tokens.test.ts
    - tests/unit/ui-generator/conflict-detector.test.ts
  modified: []
decisions:
  - "extractPatternsFromHtml is not a separate function — patterns are returned alongside tokens in extractTokensFromHtml per D-06 (one Claude call, both token and pattern data)"
  - "mergeTokens uses TOKEN_FIELDS const array to enumerate exactly the 12 dmTokens columns — prevents accidental field drift if schema changes"
  - "usageContextsDiffer uses substring inclusion rather than strict equality — 'metric display' and 'dashboard metric display' should not conflict (Pitfall 5)"
  - "variant mismatch is not a conflict — button:primary vs button:destructive are intentionally different variants"
metrics:
  duration_seconds: 175
  completed_date: "2026-03-29"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
requirements:
  - UIGEN-02
  - UIGEN-05
---

# Phase 3 Plan 02: Token Extraction and Conflict Detection Summary

**One-liner:** Claude-powered design token and pattern extraction from Stitch HTML output with semantic conflict detection using nullish coalescing for immutable prior value preservation.

## What Was Built

### lib/ui-generator/extract-tokens.ts

Three exported functions implementing the design memory write path:

1. **`mergeTokens(prior, extracted)`** — Pure function. Iterates the 12 `TOKEN_FIELDS` constants (matching `dmTokens` columns). Uses `extracted[field] !== null ? extractedVal : priorVal` logic — prior non-null values are never overwritten by null extractions (D-07). Returns a plain `Record<string, string | number | null>`.

2. **`extractTokensFromHtml({ htmlContent, projectId, priorTokens })`** — Async function. Truncates `htmlContent` to `MAX_HTML_FOR_EXTRACTION` chars, calls Claude `claude-sonnet-4-5` with a structured extraction prompt, parses the response with `extractJsonFromResponse` (handles markdown fences), validates against an inline Zod schema, then calls `mergeTokens` before returning `{ tokens, patterns }`.

3. **pRetry wrapping** — Claude API call wrapped with `{ retries: 2, minTimeout: 1000, factor: 2 }` for resilience against transient API errors.

### lib/ui-generator/conflict-detector.ts

One exported function implementing semantic pattern conflict detection:

**`detectPatternConflicts(existingPatterns, newPatterns)`** — Pure function, no AI dependency. For each new pattern:
- Normalizes names (lowercase, trim) for case-insensitive matching
- Skips if no existing pattern has the same name
- Skips if both have variants defined and variants differ (intentional variant separation)
- Flags conflict if `shadcnComponent` values differ (structural conflict — different base component)
- Flags conflict if `usageContext` values differ semantically (substring inclusion check prevents false positives per Pitfall 5)
- Returns `ConflictDetectionResult` with `hasConflicts` boolean and `conflicts` array with actionable `recommendation` strings per D-08

## Tests

- **extract-tokens.test.ts** — 8 tests: mergeTokens null coalescing, page-1 (no prior), field preservation, Claude mock response parsing, HTML truncation assertion, pattern field shapes, markdown-fenced JSON handling, prior merge with null extractions
- **conflict-detector.test.ts** — 8 tests: empty existing, new pattern name, same semantics (no conflict), shadcnComponent mismatch, multi-pattern (one conflict one new), variant separation, usageContext difference, case-insensitive name normalization

**Full suite result:** 140 tests, 14 test files, all pass. No regressions from Plan 01.

## Deviations from Plan

None — plan executed exactly as written.

The plan noted `extractPatternsFromHtml` as "no separate function needed" (D-06 — one call returns both). This was followed — patterns are returned as part of `extractTokensFromHtml`'s `TokenExtractionResult`.

## Known Stubs

None. Both modules are fully implemented with real logic, no hardcoded empty values or placeholder returns.

## Self-Check: PASSED

Files exist:
- lib/ui-generator/extract-tokens.ts — FOUND
- lib/ui-generator/conflict-detector.ts — FOUND
- tests/unit/ui-generator/extract-tokens.test.ts — FOUND
- tests/unit/ui-generator/conflict-detector.test.ts — FOUND

Commits exist:
- 34b7804 — feat(03-02): Claude-based token and pattern extraction with TDD — FOUND
- 8065ec8 — feat(03-02): pattern conflict detection — semantic comparison without false positives — FOUND
