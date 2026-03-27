---
phase: 01
reviewers: [gemini]
reviewed_at: 2026-03-27T22:28:00Z
plans_reviewed: [01-01-PLAN.md, 01-02-PLAN.md, 01-03-PLAN.md]
codex_status: "failed — OpenAI API 500/401 errors, not authenticated"
---

# Cross-AI Plan Review — Phase 1

## Gemini Review

This review covers the foundational plans for the SaaS development system, focusing on database schema, API integration, and framework detection.

### Summary
The implementation plans for Phase 1 are comprehensive and strictly adhere to the established design decisions (D-01 to D-22). The strategy of using structured Drizzle tables for design memory instead of generic JSONB ensures high-integrity drift detection, while the modular approach to pipeline state allows for the required pause/resume functionality. The Stitch SDK wrapper correctly addresses the pre-release nature of the API by pinning versions and handling presigned URLs, and the framework detection logic provides a pragmatic heuristic for identifying the target tech stack.

### Strengths
- **Structured Design Memory:** Using specific columns in `dm_tokens` enables robust SQL-level comparison for design consistency, fulfilling ORCH-02.
- **Resilient API Integration:** The use of `p-retry` with exponential backoff and explicit handling of `StitchError.recoverable` demonstrates a production-grade approach to flaky pre-release APIs.
- **Deterministic State Management:** Separating `pipeline_runs` (metadata) from `pipeline_pages` (checkpoints) directly supports the ORCH-03 requirement for page-level granularity in pause/resume.
- **Heuristic-Based Detection:** Identifying shadcn/ui via Radix primitive counts is a clever, zero-dependency way to detect the framework without complex file parsing.
- **Environment Parity:** Setting up dual Node/jsdom environments in Vitest from the start ensures that both logic and UI-related code (like HTML parsing from Stitch) can be tested effectively.

### Concerns
- **Stitch API Volatility (HIGH):** The reliance on `@google/stitch-sdk@0.0.3` is a significant risk given its pre-release status; any breaking changes in the presigned URL behavior could invalidate the `UiGenPhaseOutputSchema`.
- **Schema Rigidity (MEDIUM):** Fixed columns in `dm_tokens` (D-01) provide comparability but may require frequent migrations as the "design language" of the system evolves (e.g., adding border-radius tokens).
- **Framework Detection Sensitivity (LOW):** The threshold of 3+ `@radix-ui` packages for shadcn detection might yield false positives if a project uses Radix directly without the shadcn/ui CLI/conventions.
- **Database Sync (LOW):** Plan 01 modifies `drizzle.config.ts` to include multiple schema files. Ensure that `drizzle-kit` correctly handles the union of schemas during migration generation to avoid accidental drops.

### Suggestions
- **Token Versioning:** Add a `version` or `checksum` column to `dm_tokens` to allow the system to quickly detect if a page needs a UI refresh without comparing every individual column.
- **Stitch Error Categorization:** In `StitchWrapperError`, map specific Stitch error codes to user-friendly messages, as this will be surface-level feedback in the `pipeline_pages.error` field.
- **Graceful Framework Fallback:** Modify `detectFramework` to return a list of "missing" components when confidence is MEDIUM, allowing the Orchestrator to prompt the user to install missing dependencies.
- **Seed Data:** Include a Task in Plan 03 to create a `seed-design-tokens.ts` script to populate `dm_tokens` with sensible defaults for the first run.

### Risk Assessment: MEDIUM
The technical logic is sound and the dependency on Claude Code skills is well-contained. The primary risk is **external API instability** (Stitch SDK). If the SDK's contract for `getHtml()` or `getImage()` changes during Phase 1, the typed wrappers and schemas will immediately break. However, the plan's inclusion of immediate smoke tests (Plan 03) mitigates this by ensuring failures are caught at the "Foundation" level before downstream phases are built.

---

## Codex Review

**Status: FAILED** — OpenAI API returned 500 Internal Server Error followed by 401 Unauthorized. Codex CLI (v0.117.0) could not connect to `wss://api.openai.com/v1/responses`. This is likely an authentication or API availability issue. To retry:

1. Run `codex login` to authenticate
2. Verify `OPENAI_API_KEY` is set and valid
3. Re-run `/gsd:review --phase 1 --codex`

---

## Consensus Summary

_Single successful reviewer (Gemini). Codex failed to connect. Consensus analysis limited._

### Gemini's Key Concerns (prioritized)

1. **HIGH — Stitch API volatility:** Pre-release SDK (v0.0.3) poses breaking change risk. Exact-pin mitigates but doesn't eliminate. Smoke tests in Plan 03 provide early detection.

2. **MEDIUM — Schema rigidity:** Structured columns are correct for drift detection (D-01) but may need migrations as design language evolves. A `metadata` JSONB escape hatch or `checksum` column could reduce future churn.

3. **LOW — shadcn detection false positives:** Radix-only projects (no shadcn CLI) could trigger false positive. Consider also checking for `components.json`.

4. **LOW — Database sync risk:** Multi-schema `drizzle.config.ts` needs verification that `drizzle-kit` handles union correctly without accidental table drops.

### Confirmed Strengths (across both Gemini runs)

- Type-safe design memory with structured columns for drift detection
- p-retry with exponential backoff for pre-release Stitch SDK
- Page-level checkpoint granularity (pipeline_runs + pipeline_pages split)
- Pure function framework detection (no I/O, fully testable)
- Dual Node/jsdom Vitest environments from day one
- Explicit version pinning for all new dependencies
- Plans strictly follow existing codebase patterns (Drizzle, thin wrappers)

### Actionable Items for Planning

| # | Concern | Severity | Suggested Action |
|---|---------|----------|-----------------|
| 1 | Stitch SDK volatility | HIGH | Pin exact version (already planned), add integration test that validates SDK contract shape |
| 2 | Token schema rigidity | MEDIUM | Consider adding `metadata` JSONB column as escape hatch for unforeseen token types |
| 3 | Missing migration step | MEDIUM | Add explicit `drizzle-kit push` task to Plan 01 or note it as post-plan step |
| 4 | shadcn detection | LOW | Also check for `components.json` file presence |
| 5 | Stitch error messages | LOW | Map StitchError codes to user-friendly messages in wrapper |
