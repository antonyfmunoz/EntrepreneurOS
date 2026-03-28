---
phase: 02
reviewers: [gemini, codex]
reviewed_at: 2026-03-27T21:30:00-07:00
plans_reviewed: [02-01-PLAN.md, 02-02-PLAN.md, 02-03-PLAN.md]
---

# Cross-AI Plan Review — Phase 02

## Gemini Review

**Model:** Gemini CLI 0.35.2

### Summary
The implementation plans for Phase 2 are exceptionally well-structured, directly addressing the complex requirements of format-agnostic spec parsing and collaborative creation. The strategy of using composable Zod schemas for the "layered" page specs is a highlight, ensuring that downstream phases only consume the data they need while maintaining a strict contract. The post-processing pipeline (deduplication, backend derivation, and chunking) effectively mitigates the risks of LLM hallucinations and context window limitations.

### Strengths
- **Layered Schema Composition**: The use of `PageSpecCore.merge(PageSpecUI)` etc. is an elegant architectural choice that follows DRY principles and provides type safety for specific lifecycle phases (D-05, D-06).
- **AI Self-Correction Loop**: Plan 01 includes a Zod validation loop that sends errors back to Claude for correction. This significantly increases the reliability of structured output.
- **Semantic Deduplication**: Using LLMs for component deduplication rather than string matching is a high-signal approach that correctly handles natural language variations (D-20).
- **Domain-First Questioning**: The collaborative flow (Plan 03) correctly replicates proven brainstorming patterns (vision -> flows -> pages -> detail), ensuring high-quality specs from scratch (D-07).
- **Context-Aware Chunking**: The partitioning logic for 26+ pages (Plan 02) includes domain-aware grouping (e.g., auth pages stay together), which preserves local context for the AI during restructuring (D-25).

### Concerns
- **MEDIUM** — Persistence of Collaborative State: Plan 03 defines `CollaborativeState` but doesn't explicitly state how this is persisted between user turns. If a session is interrupted, the system should ideally be able to resume.
- **MEDIUM** — Backend Spec Reconciliation: The actual "reconciliation" logic (diffing/merging pasted vs derived backend specs) is left to the Skill prompt in Plan 03. This might be too complex for a single prompt.
- **LOW** — Shared Component Property Merging: `deduplicateComponents` merges IDs and `usedByPages` but should also ensure that `props` and `purpose` are merged/synthesized.
- **LOW** — Large Spec Merge Pass: When merging chunks, `dependsOn` references should be updated if a component ID changes during the global merge.

### Suggestions
- Add a utility function for surgical edit validation (D-16) that checks `dependsOn` references.
- Use specific markdown syntax (blockquotes or emoji) to highlight INFERRED requirements in the confirmation gate.
- Add "Context Summary" of previous chunks to subsequent chunk calls for global consistency.

### Risk Assessment
**LOW** — Plans are grounded in Phase 1's established patterns. AI usage is targeted at semantic problems while deterministic logic is handled via pure TypeScript. TDD and self-correction loop mitigate common LLM failure modes.

---

## Codex Review

**Model:** OpenAI Codex v0.117.0 (GPT-5.4)

### Summary
The Spec Layer plans are ambitious and cover the right product behaviors, but they currently mix core scope with several AI-dependent post-processing features and leave important contract/security gaps unresolved. The plans are directionally correct, but as written they are likely to miss the phase goal under real-world large inputs, noisy specs, and security constraints.

### Strengths
- 02-01 defines a sensible layered schema that aligns well with downstream phases.
- 02-02 correctly identifies deduplication and backend derivation as real needs, not nice-to-haves.
- 02-03 has a strong user-flow model for collaborative spec creation.

### Concerns
- **HIGH** — No provenance fields for inferred content: 02-01 does not add `source: "explicit" | "inferred"` metadata to spec items, despite confirmation-gate requirements in CONTEXT.md (D-03).
- **HIGH** — Chunking sequenced too late: 02-01 parses raw input with Anthropic first, but 02-02 only chunks after `PageSpecFull[]` already exists. Very large source specs can fail before chunking ever runs.
- **HIGH** — Confirmation/edit flow under-modeled: 02-03 requires explicit vs inferred labeling, surgical edits, and `spec-changed` handling, but the code modules don't support these state transitions.
- **HIGH** — Security/privacy controls missing: All three plans send raw specs, page details, and references to Anthropic with no redaction, size limits, tenant isolation, or prompt-injection policy for URLs/screenshots.
- **MEDIUM** — Route validation: Schema says "must start with `/`" but the Zod definition shown doesn't enforce it with `.startsWith("/")`.
- **MEDIUM** — Backend spec "all three input paths" from context not fully implemented; pasted standalone backend specs are still mostly procedural text.
- **MEDIUM** — Accepting arbitrary references "at any point" has no fetch/sanitization policy.

### Suggestions
- Add `source: "explicit" | "inferred"` and maybe `confidence` metadata to spec items before building the confirmation gate.
- Move chunking to a raw-input preprocessor, or add section-based recursive parsing before the first LLM call.
- Add privacy rules: redaction pass, max input size, allowed reference types, no automatic remote fetch without explicit approval.
- Add a real persistence/orchestration module for collaborative flow instead of leaving DB behavior in skill prose.

### Risk Assessment
**HIGH** — Plans are directionally correct but most failure-prone parts are under-specified: provenance, oversized inputs, AI safety/privacy, and state transitions for edits/resume.

---

## Consensus Summary

### Agreed Strengths
- **Layered Zod schema composition** is well-designed (both reviewers)
- **Backend spec derivation and deduplication** correctly identified as real needs (both reviewers)
- **Collaborative flow model** is strong (both reviewers)

### Agreed Concerns
1. **Provenance/inferred tracking missing** — Both reviewers flag that spec items need a `source: "explicit" | "inferred"` field to support the confirmation gate (D-03). Currently no schema field distinguishes AI-inferred content from user-explicit content. **Priority: HIGH**
2. **Chunking sequence issue** — Codex flags that chunking runs after parsing, meaning oversized raw inputs could fail before chunking helps. Gemini notes chunk merge needs dependency reference updates. **Priority: HIGH**
3. **Confirmation/edit flow gaps** — Both note that surgical edits, spec versioning, and state transitions are described in the skill prose but not in actual code modules. **Priority: MEDIUM-HIGH**

### Divergent Views
- **Overall risk**: Gemini rates LOW, Codex rates HIGH. Gemini sees TDD and self-correction as sufficient mitigation; Codex sees under-specified security and edge cases as blockers.
- **Security**: Codex raises HIGH concerns about sending raw specs to Anthropic without redaction/privacy controls. Gemini does not mention security. Worth investigating — this is a personal tool, not multi-tenant, which reduces but doesn't eliminate the concern.
- **Persistence module**: Codex wants a dedicated persistence module for collaborative flow state. Gemini suggests it could use existing Neon tables. The skill-driven approach (persisting via Claude Code conversation context) may be sufficient for v1.
