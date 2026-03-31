---
phase: 3
reviewers: [gemini, codex]
reviewed_at: 2026-03-31T06:21:00Z
plans_reviewed: [03-01-PLAN.md, 03-02-PLAN.md, 03-03-PLAN.md, 03-04-PLAN.md, 03-05-PLAN.md, 03-06-PLAN.md]
---

# Cross-AI Plan Review — Phase 3

## Gemini Review

### Phase 3: UI Generation Plan Review

#### Overall Summary
The phase plans are logically structured, cover all specified UIGEN requirements, and generally adhere to the project context and user decisions. The wave ordering is sensible, prioritizing foundational elements before parallel enhancements and dependent core logic. However, the heavy reliance on LLMs for critical extraction, review, and semantic comparison tasks introduces significant complexity and potential robustness challenges, particularly regarding HTML truncation and the reliability of LLM outputs.

#### Plan 03-01: Type contracts + buildStitchPrompt + approval gate (Wave 1)

*   **Summary:** This plan establishes core type contracts and foundational pure functions for building Stitch API prompts and evaluating UI generation approval status, including the initial page escalation logic.
*   **Strengths:**
    *   Clear type definitions set a strong base for consistency.
    *   `buildStitchPrompt` and `evaluateApprovalGate` as pure functions enhance testability.
    *   Explicitly addresses UIGEN-06, UIGEN-07, and parts of UIGEN-01, aligning with user decisions D-10 and D-13.
    *   Good emphasis on TDD with adequate test cases.
*   **Concerns:**
    *   **LOW:** The mechanism for `evaluateApprovalGate` to always escalate Page 1 (D-13) should be explicitly designed to override any self-review score, ensuring no ambiguity.
    *   **MEDIUM:** The plan does not explicitly address the actual Stitch API call or handling of the presigned URLs returned by Stitch, a pitfall highlighted in research. While an orchestration detail, acknowledging it would be beneficial.
*   **Suggestions:**
    *   Ensure `evaluateApprovalGate` explicitly prioritizes the "Page 1 always escalates" rule, irrespective of calculated scores.
    *   Add a note to `SKILL.md` or a subsequent plan clarifying how the Stitch API call and presigned URL fetching will be orchestrated.
*   **Risk Assessment:** **LOW**. This plan is foundational and well-defined, with minimal inherent complexity.

#### Plan 03-02: Token extraction + conflict detection (Wave 2)

*   **Summary:** This plan introduces the logic for extracting design tokens and patterns from generated HTML using Claude, merging new tokens, and detecting semantic pattern conflicts.
*   **Strengths:**
    *   Directly addresses UIGEN-02 and implicitly UIGEN-03, aligning with D-05, D-06, D-07, and D-08.
    *   `mergeTokens` correctly implements the nullish coalescing merge strategy.
    *   Separating extraction from merge from conflict detection is clean design.
*   **Concerns:**
    *   **HIGH:** The "HTML truncation for Claude context limits" pitfall is critical here. The plan *must* explicitly detail the strategy for handling large HTML inputs.
    *   **MEDIUM:** The "semantic comparison" for `detectPatternConflicts()` is complex and lacks specific implementation details.
*   **Suggestions:**
    *   Define a robust strategy for handling HTML truncation in `extractTokensFromHtml()`.
    *   Elaborate on the methodology for `detectPatternConflicts()` semantic comparison.
*   **Risk Assessment:** **MEDIUM**.

#### Plan 03-03: Self-review scorer + SKILL.md (Wave 3)

*   **Summary:** This plan implements the core self-review mechanism using Claude Sonnet and outlines the full page-by-page orchestration pipeline in `SKILL.md`.
*   **Strengths:**
    *   Directly addresses UIGEN-04, UIGEN-05, UIGEN-06, and UIGEN-07.
    *   Explicitly mentions HTML truncation (`MAX_HTML_FOR_REVIEW`).
    *   Includes the user confirmation gate for token persistence (D-05).
*   **Concerns:**
    *   **MEDIUM:** HTML truncation could still lead to loss of critical review information.
    *   **MEDIUM:** The `SKILL.md`'s complexity makes exhaustive verification challenging.
    *   **LOW:** 6 test cases for `selfReview()` may be insufficient.
*   **Risk Assessment:** **MEDIUM**.

#### Plan 03-04: Design system seeder + Gemini mockup (Wave 1, Enhancement)

*   **Summary:** Enhancement adds initial design token seeding and Gemini reference mockup generation.
*   **Strengths:**
    *   Addresses Success Criteria 6.
    *   Backwards-compatible enhancement.
    *   Properly scoped as non-blocking.
*   **Concerns:**
    *   **LOW:** Quality of seeded tokens depends on project description quality.
    *   **LOW:** Mockup's influence on Stitch generation unclear.
*   **Risk Assessment:** **LOW**.

#### Plan 03-05: Component discovery (Wave 1, Enhancement)

*   **Summary:** Multi-registry component lookup with graceful degradation.
*   **Strengths:**
    *   Addresses Success Criteria 7.
    *   Graceful degradation for MCP tool unavailability.
*   **Concerns:**
    *   **MEDIUM:** Effectiveness depends on Stitch's prompt interpretation of component references.
    *   **LOW:** `COMPLEX_COMPONENT_PATTERNS` list needs maintenance.
*   **Risk Assessment:** **LOW-MEDIUM**.

#### Plan 03-06: Dual reviewer + targeted refiner (Wave 1, Enhancement)

*   **Summary:** Dual Claude + Gemini review with worst-of-both scoring, plus targeted component refinement.
*   **Strengths:**
    *   Addresses Success Criteria 8 and 9.
    *   `dualReview()` with worst-of-both is a robust conservative approach.
    *   `selfReview()` preserved for backwards compatibility.
*   **Concerns:**
    *   **MEDIUM:** Gemini visual input mechanism needs specification.
    *   **MEDIUM:** Worst-of-both scoring will increase rejection rates — needs actionable feedback strategy.
    *   **LOW:** 21st.dev MCP refiner reliability is an external dependency.
*   **Risk Assessment:** **MEDIUM**.

**Gemini Overall: MEDIUM risk.** LLM interaction robustness, external dependencies, semantic complexity, and orchestration intricacy are the main factors.

---

## Codex Review

### Overall Assessment

The plan set is directionally strong and mostly coherent. The core Phase 3 flow is covered by `03-01` through `03-03`, while `03-04` through `03-06` are reasonable enhancements. The main strengths are clear separation of concerns, good use of pure functions at the boundaries, and explicit TDD intent. The main risks are not architectural but operational: prompt-size/control issues, brittle structured extraction from model outputs, ambiguity around persistence and revision semantics, and some dependency mismatch between orchestration described in `SKILL.md` and code-level contracts.

### Plan 03-01: Type Contracts + buildStitchPrompt + Approval Gate

*   **Summary:** Solid Wave 1 foundation. Putting types, prompt construction, and approval logic first is the right move. The main issue is under-specified interfaces for later plans.
*   **Strengths:**
    *   Good choice to front-load shared types.
    *   Pure functions enhance testability.
    *   `CONFIDENCE_THRESHOLD = 0.9` aligns with D-10.
    *   TDD with 13+ tests is appropriate.
*   **Concerns:**
    *   **HIGH:** Types listed are not enough. Core contracts for Stitch request/response normalization, prompt inputs, review dimension names, and escalation reasons appear missing.
    *   **HIGH:** Approval gate may be too simple if it only checks numeric thresholds.
    *   **MEDIUM:** No explicit handling of missing/partial review scores, malformed model output, or unavailable screenshots.
*   **Risk Assessment:** **LOW-MEDIUM**.

### Plan 03-02: Token Extraction + Conflict Detection

*   **Strengths:**
    *   Strong alignment with D-05 through D-08.
    *   `mergeTokens()` with null-preserving semantics is correct.
    *   Separating extraction from merge from conflict detection is clean.
*   **Concerns:**
    *   **HIGH:** "Semantic comparison" for conflicts is underspecified.
    *   **HIGH:** No explicit plan for token schema validation after extraction.
    *   **MEDIUM:** Potential security issue if raw HTML contains prompt-injection text sent directly to Claude.
    *   **MEDIUM:** Revision model from D-07 only partially reflected.
*   **Risk Assessment:** **MEDIUM**.

### Plan 03-03: Self-Review Scorer + SKILL.md

*   **Strengths:**
    *   Directly addresses UIGEN-04 and UIGEN-05.
    *   User confirmation between extraction and persistence implements D-05.
*   **Concerns:**
    *   **HIGH:** UIGEN-01 is still only implicitly handled via SKILL.md; no explicit code plan for Stitch API wrapper/response parsing.
    *   **HIGH:** Review quality depends heavily on what artifacts are supplied; screenshot/preview usage not specified.
    *   **HIGH:** SKILL.md may become sole source of critical control flow without mirroring code contracts.
    *   **MEDIUM:** Six tests for selfReview() feels light.
    *   **MEDIUM:** No explicit fail-closed behavior if review model times out or returns partial JSON.
*   **Risk Assessment:** **MEDIUM-HIGH**.

### Plan 03-04: Design System Seeder + Gemini Mockup

*   **Concerns:**
    *   **MEDIUM:** Combining seed generation and mockup generation increases scope.
    *   **MEDIUM:** Mockups may bias Stitch unhelpfully.
    *   **MEDIUM:** No clear handling for conflicts between seeded and user-approved tokens.
*   **Risk Assessment:** **MEDIUM**.

### Plan 03-05: Component Discovery

*   **Concerns:**
    *   **HIGH:** MCP-based registry querying is unstable if not strictly optional.
    *   **MEDIUM:** No ranking/deduplication strategy across registries.
    *   **MEDIUM:** Prompt bloat risk from raw discovery output.
    *   **MEDIUM:** License/provenance/security concerns not mentioned.
*   **Risk Assessment:** **MEDIUM**.

### Plan 03-06: Dual Reviewer + Targeted Refiner

*   **Concerns:**
    *   **HIGH:** Combines three hard problems: vision review, score fusion, and component remediation — substantial scope.
    *   **HIGH:** "Worst-of-both" can create chronic false negatives without calibration.
    *   **HIGH:** `refineComponent()` via 21st.dev MCP is operationally speculative.
    *   **MEDIUM:** No explicit retry budget interaction with D-04.
    *   **MEDIUM:** Classification of component-level vs page-level issue is error-prone.
*   **Risk Assessment:** **HIGH**.

### Cross-Plan Concerns

*   Enhancement plans `03-04`, `03-05`, `03-06` all update SKILL.md introduced in `03-03` — they have an implicit dependency not formally declared.
*   Presigned URL expiry/fetch failure not explicitly planned anywhere.
*   LLM structured output may be partial, invalid, or inconsistent — fail-closed behavior needed.
*   Raw HTML from generated pages can contain prompt-injection content.
*   Prompt growth across tokens, patterns, component refs, and prior-page context is a serious concern.

### Codex Recommendations

1. Add explicit core plan for Stitch API integration and presigned URL normalization.
2. Formalize shared contracts before implementation.
3. Reclassify enhancements — `03-06` should be split, targeted refinement deferred.
4. Add fail-closed behavior everywhere model output is consumed.
5. Constrain prompt size deliberately.
6. Treat SKILL.md as documentation, not sole source of business logic.

**Codex Overall: MEDIUM risk.** Fundamentally sound but operational concerns under-specified.

---

## Consensus Summary

### Agreed Strengths
- **Sound decomposition:** Both reviewers praise the separation of pure functions (prompt builder, approval gate, token merge) from I/O-bound operations (Claude extraction, Stitch calls)
- **Correct wave ordering:** Core 03-01 -> 03-02 -> 03-03 dependency chain is logical and well-structured
- **TDD emphasis:** Both reviewers note the explicit TDD approach with adequate minimum test counts for most plans
- **Decision alignment:** Plans correctly implement all 16 locked decisions (D-01 through D-16) from CONTEXT.md
- **Backwards compatibility:** Enhancement plans (04, 05, 06) properly extend existing functions without breaking existing interfaces
- **Graceful degradation:** Enhancement plans handle unavailable external tools (MCP, Gemini) without blocking the pipeline

### Agreed Concerns
1. **HIGH — HTML truncation strategy underspecified:** Both reviewers flag that HTML truncation for Claude context limits (extraction and review) needs a more robust strategy beyond simple character truncation. Risk of losing critical design information.
2. **HIGH — UIGEN-01 Stitch integration gap:** Both note that no explicit code plan covers Stitch API call orchestration, presigned URL fetching, and response normalization. This is only implicitly handled via SKILL.md.
3. **HIGH — LLM output robustness:** Both flag that structured extraction from Claude/Gemini responses needs fail-closed behavior for malformed, partial, or invalid JSON outputs. No explicit error handling strategy for model output failures.
4. **HIGH — Semantic conflict detection underspecified:** Both note that "semantic comparison" for pattern conflicts lacks clear implementation methodology and risks being unreliable or nondeterministic.
5. **MEDIUM — Plan 03-06 overscoped:** Both reviewers identify Plan 03-06 as the riskiest, combining three hard problems (vision review, score fusion, targeted refinement). Codex recommends splitting it.
6. **MEDIUM — Prompt size growth:** Both flag that accumulating tokens, patterns, component references, and prior page context across pages will cause prompt bloat without explicit caps or summarization.
7. **MEDIUM — SKILL.md complexity:** Both note the orchestration document's complexity (16 decisions, database ops, conditional flows) makes exhaustive verification challenging and risks becoming sole source of business logic.
8. **MEDIUM — Security (prompt injection):** Codex specifically flags that raw HTML sent to Claude/Gemini could contain prompt-injection content; delimiters and sanitization needed.

### Divergent Views
- **Plan 03-01 risk:** Gemini rates it LOW, Codex rates LOW-MEDIUM. Codex wants more contract types (dimension names, escalation reasons, Stitch input/output normalization) that Gemini considers minor.
- **Plan 03-04 risk:** Gemini rates LOW, Codex rates MEDIUM. Codex has stronger concerns about mockup-to-Stitch influence and seed/user-token conflicts.
- **Plan 03-05 MCP stability:** Codex rates the MCP registry dependency as HIGH concern, Gemini as MEDIUM. Codex is more cautious about external tool reliability.
- **Enhancement blocking status:** Codex notes that enhancements 03-04/05/06 are "not non-blocking relative to the broader roadmap" because success criteria 6-9 depend on them. Gemini accepts them as non-blocking.
- **Test adequacy for selfReview:** Both flag it as potentially light, but Codex is more emphatic (wants malformed JSON, missing dimensions, timeout, multi-device packaging tests).
- **Overall risk:** Both arrive at MEDIUM overall, but Codex rates Plan 03-06 as HIGH individually while Gemini rates it MEDIUM.

---

*Reviewed by: Gemini (2.5 Flash), Codex (OpenAI)*
*Review date: 2026-03-31*
