---
phase: 01
reviewers: [gemini, codex]
reviewed_at: 2026-03-27T22:35:00Z
plans_reviewed: [01-01-PLAN.md, 01-02-PLAN.md, 01-03-PLAN.md]
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
- **Schema Rigidity (MEDIUM):** Fixed columns in `dm_tokens` (D-01) provide comparability but may require frequent migrations as the "design language" of the system evolves.
- **Framework Detection Sensitivity (LOW):** The threshold of 3+ `@radix-ui` packages for shadcn detection might yield false positives if a project uses Radix directly without the shadcn/ui CLI/conventions.
- **Database Sync (LOW):** Plan 01 modifies `drizzle.config.ts` to include multiple schema files. Ensure that `drizzle-kit` correctly handles the union of schemas during migration generation to avoid accidental drops.

### Suggestions
- **Token Versioning:** Add a `version` or `checksum` column to `dm_tokens` to allow the system to quickly detect if a page needs a UI refresh without comparing every individual column.
- **Stitch Error Categorization:** In `StitchWrapperError`, map specific Stitch error codes to user-friendly messages.
- **Graceful Framework Fallback:** Modify `detectFramework` to return a list of "missing" components when confidence is MEDIUM.
- **Seed Data:** Include a Task in Plan 03 to create a `seed-design-tokens.ts` script to populate `dm_tokens` with sensible defaults.

### Risk Assessment: MEDIUM
The technical logic is sound. The primary risk is external API instability (Stitch SDK). Smoke tests in Plan 03 mitigate by catching breakage at the Foundation level.

---

## Codex Review (GPT-5.4)

### Plan 01: Design memory + pipeline state schemas

**Summary:** Plan 01 covers the right foundational surface area, but has contract mismatches that will create downstream friction if left unresolved. The main value is establishing typed persistence and Zod validation early. The main weakness is that schema choices do not fully reflect stated decisions around versioning, Neon-only pipeline state, and reusable brownfield support.

**Strengths:**
- Separates design memory and pipeline contracts into shared modules — right boundary for downstream reuse
- Uses `drizzle-zod` insert schemas for consistency between DB and runtime validation
- Captures per-page checkpoint state and error fields, aligning with pause/resume and retry requirements
- Updates Drizzle config to include new schema file instead of inventing a second migration path
- Keeps project scoping explicit via `projectId` for multi-repo reuse

**Concerns:**
- **HIGH — Version history not modeled:** D-03 requires per-project version history. `dm_tokens` references versions loosely but there is no clear versioning strategy or immutable revision model.
- **HIGH — Table naming conflict with D-04:** Requirement says all design memory tables use `dm_` prefix, but plan mixes `dm_*` with `pipeline_*` tables without clarifying whether pipeline tables are exempt.
- **HIGH — Success criteria contradiction:** Success criterion 2 mentions `pipeline-state.json` schema, while D-06 says pipeline state lives in Neon PostgreSQL only. Contract inconsistency needs resolution now.
- **MEDIUM — JSON columns underspecified:** `pipeline_runs.config` and `pipeline_pages.output` are opaque JSON storage that weakens typed handoffs.
- **MEDIUM — Brownfield support incomplete:** `repoPath` exists but no indication of uniqueness, normalization, or repo portability across machines.
- **MEDIUM — Six tables may be too much** if some are only partially specified. Risk of schema churn before consumers exist.
- **LOW — No indexes or unique constraints** on likely hot lookup paths.

**Suggestions:**
- Add explicit versioning model for design memory: either `version` columns on mutable tables plus history tables, or immutable revision rows keyed by `project_id + version`
- Resolve `pipeline-state.json` vs Neon-only contradiction before implementation
- Define JSON column shapes up front for `config` and `output`
- Add uniqueness and lookup constraints: `dm_projects.projectId` unique, `pipeline_pages (runId, pageIndex, phase)` unique
- Include minimal migration acceptance criteria, not just schema definitions

**Risk: MEDIUM-HIGH**

---

### Plan 02: Stitch SDK wrapper and framework detection

**Summary:** Appropriately narrow and mostly well-scoped, but misses a critical alignment issue with success criteria and the external API risk profile. Framework detection is pragmatic and testable. Stitch wrapper response contract and lifecycle assumptions need tightening.

**Strengths:**
- Framework detection is pure and free of file I/O — reusable and easy to test
- Exact pinning for pre-release SDK is appropriate
- Bounded retry with exponential backoff matches stated retry policy
- Avoids overbuilding the wrapper — focused on typed I/O and error mapping
- Confidence scoring for framework detection is simple and predictable

**Concerns:**
- **HIGH — Contract mismatch:** Success criterion 3 says "typed HTML + screenshot URL" but plan returns `htmlUrl` and `screenshotUrl` (both URLs). Material contract mismatch.
- **HIGH — Scope creep:** `createStitchProject()` may be unnecessary unless required by official Stitch flow. Phase 1 proof is a live generate call, not project lifecycle management.
- **HIGH — D-15 not operationalized:** Plan references SDK package but doesn't explicitly anchor implementation to official Stitch API docs, despite D-15 requiring research before code.
- **MEDIUM — Per-call instantiation:** `new Stitch({ apiKey })` per call should be justified against SDK guidance re: connection state or auth refresh.
- **MEDIUM — Retry on non-idempotent ops:** Automatic retries are fine only if API semantics tolerate replay.
- **MEDIUM — Security handling missing:** No mention of API key sourcing, redaction, or how wrapper errors avoid leaking secrets.
- **MEDIUM — shadcn detection is heuristic:** 3+ `@radix-ui/react-*` packages doesn't actually detect shadcn. Brownfield repos may use shadcn selectively.
- **LOW — Too conservative:** Returning `"unknown"` for 2-3 matches may be too conservative if React+Vite+Tailwind is enough for Phase 1 routing.

**Suggestions:**
- Reconcile Stitch response contract before coding — if API returns URLs, update success criteria
- Remove `createStitchProject()` unless official docs show it's necessary
- Add explicit implementation note: wrapper must be derived from official Stitch docs first
- Define error classes more concretely (retryable transport, non-retryable validation, secret-safe messages)
- Add live integration smoke path definition including credential-gating

**Risk: MEDIUM**

---

### Plan 03: Vitest setup, smoke tests, and skill skeletons

**Summary:** Useful for verification and establishing Claude skill surface, but overclaims requirement coverage and leaves the most important verification gap unaddressed. Vitest setup is sensible, smoke tests are the right kind of cheap confidence tests.

**Strengths:**
- Correctly chooses `vitest@2` for Vite 5 compatibility
- Dual environment setup from start matches D-20, prevents later config churn
- Smoke tests focus on contracts and detection logic — exactly what should be hardened in Phase 1
- Skill skeleton scope restrained to orchestrator and framework detection (D-19)
- Adds test scripts early, supporting TDD and later CI wiring

**Concerns:**
- **HIGH — No Stitch wrapper verification:** No plan includes verification for live Stitch call, which is an explicit Phase 1 success criterion.
- **HIGH — Overclaimed requirements:** Claims coverage of ORCH-02 and ORCH-03, but documentation-only skill skeletons don't meaningfully satisfy persisted state or resume/interrupt behavior.
- **MEDIUM — skill-creator constraint:** Creating `SKILL.md` files alone may not satisfy the requirement to be built using the `skill-creator` skill (process constraint, not just output artifact).
- **MEDIUM — Tests too schema-centric:** No retry-policy tests, no checkpoint/resume behavior tests, no migration smoke checks.
- **MEDIUM — test:ui unnecessary** for Phase 1 — adds dependency drag with little payoff.

**Suggestions:**
- Add Stitch client verification: mocked retry/error mapping unit tests + separate gated live integration test
- Narrow requirement mapping — primarily claim ORCH-05 and partial ORCH-01/INTG-06
- Add one test for checkpoint semantics (error field, page granularity, resume eligibility exercised together)
- Validate skills follow `skill-creator` structural requirements
- Include one test that imports actual Drizzle schema modules to surface wiring failures early

**Risk: MEDIUM**

---

### Cross-Plan Risks (Codex)

The three plans are broadly coherent but do not yet fully achieve Phase 1 goals as written. The largest issue is contract alignment, not implementation detail.

**Key Risks:**
- **HIGH:** Contract inconsistency between `pipeline-state.json` success criteria and D-06 Neon-only state
- **HIGH:** Stitch wrapper planned output shape does not match stated success criterion
- **HIGH:** Phase 1 success criteria require a live Stitch call, but no plan includes a credible verification path
- **MEDIUM:** Version history for design memory is not concretely modeled
- **MEDIUM:** Requirement-to-plan mapping is loose; some plans claim requirements they only support indirectly
- **MEDIUM:** The "must use `skill-creator`" process constraint is not operationalized

**Overall: MEDIUM-HIGH.** Decomposition is good and work is sensibly split, but plans need one pass of contract cleanup before implementation.

---

## Consensus Summary

### Agreed Concerns (raised by both Gemini and Codex)

| # | Concern | Gemini | Codex | Consensus Severity |
|---|---------|--------|-------|-------------------|
| 1 | **Stitch API risk** — pre-release SDK volatility, contract uncertainty | HIGH | HIGH | **HIGH** |
| 2 | **shadcn detection heuristic** — Radix count is proxy, not actual shadcn detection | LOW | MEDIUM | **MEDIUM** |
| 3 | **Schema rigidity / token evolution** — structured columns may need migrations as design language evolves | MEDIUM | MEDIUM | **MEDIUM** |
| 4 | **Missing migration / queryable tables step** — schemas defined but no explicit db:push | LOW | MEDIUM | **MEDIUM** |

### Codex-Only Concerns (not raised by Gemini)

| # | Concern | Severity | Worth Addressing? |
|---|---------|----------|-------------------|
| 5 | **Success criteria contradiction** — `pipeline-state.json` text vs D-06 Neon-only decision | HIGH | **YES** — wording fix needed |
| 6 | **Stitch result contract mismatch** — success criterion says "typed HTML" but wrapper returns URLs | HIGH | **YES** — reconcile before implementation |
| 7 | **No Stitch live verification** in any plan | HIGH | **YES** — add gated integration test or manual verification script |
| 8 | **Version history not concretely modeled** (D-03) | HIGH | **YES** — `dm_tokens` has `version` column but no immutable revision model |
| 9 | **`createStitchProject()` scope creep** — may not be needed for Phase 1 proof | HIGH | **INVESTIGATE** — check if required by Stitch generate flow |
| 10 | **Requirement overclaiming** in Plan 03 | HIGH | **YES** — narrow requirement mapping |
| 11 | **`skill-creator` process constraint** not operationalized | MEDIUM | **YES** — validate skills through skill-creator |
| 12 | **JSON columns underspecified** (`config`, `output`) | MEDIUM | **CONSIDER** — define shapes or use typed references |
| 13 | **Security handling missing** in Stitch wrapper | MEDIUM | **YES** — add secret-safe error messages |
| 14 | **Per-call Stitch instantiation** not justified | MEDIUM | **INVESTIGATE** — check SDK guidance |

### Agreed Strengths

Both reviewers confirmed:
- Type-safe design memory with structured columns for drift detection
- p-retry with exponential backoff for pre-release Stitch SDK
- Page-level checkpoint granularity (pipeline_runs + pipeline_pages split)
- Pure function framework detection (no I/O, fully testable)
- Explicit version pinning for all new dependencies
- Plans follow existing codebase patterns (Drizzle, thin wrappers)
- Vitest dual-environment setup from day one

### Divergent Views

| Topic | Gemini | Codex |
|-------|--------|-------|
| **Overall risk** | MEDIUM | MEDIUM-HIGH |
| **Token versioning** | Suggested adding checksum column | Demanded explicit immutable revision model |
| **Plan 01 scope** | Appropriate | Potentially over-scoped (6 tables before consumers exist) |
| **createStitchProject** | Not flagged | Flagged as scope creep |
| **Requirement mapping** | Not scrutinized | Heavily scrutinized — plans overclaim |

### Priority Actions Before Implementation

1. **Resolve success criteria wording** — update `pipeline-state.json` reference to match D-06 Neon-only decision, and clarify "typed HTML" vs URL in Stitch success criterion
2. **Add Stitch verification path** — at minimum: mocked retry/error unit tests + gated live smoke test script
3. **Clarify version history model** — confirm `dm_tokens.version` column + immutable rows is the strategy, or define alternative
4. **Validate `createStitchProject` necessity** — check official Stitch docs before implementing
5. **Use `skill-creator` skill** to generate SKILL.md files (process constraint, not just output)
6. **Narrow Plan 03 requirement claims** — primarily ORCH-05, partial ORCH-01/INTG-06
7. **Add database constraints** — unique on `dm_projects.projectId`, composite unique on `pipeline_pages`
