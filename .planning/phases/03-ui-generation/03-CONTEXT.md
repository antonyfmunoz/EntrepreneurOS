# Phase 3: UI Generation - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate pixel-quality UI for each page via Google Stitch API, extract and progressively build design tokens and component patterns, self-review each page against spec requirements and visual consistency, and route to user only when confidence is below threshold. Page 1 always escalates to user regardless of score.

Requirements covered: UIGEN-01, UIGEN-02, UIGEN-03, UIGEN-04, UIGEN-05, UIGEN-06, UIGEN-07

</domain>

<decisions>
## Implementation Decisions

### Stitch Prompt Design
- **D-01:** Spec-faithful prompt depth — translate PageSpec fields directly into Stitch prompt (components list, layout hints, auth level, empty/loading/error state descriptions) while leaving visual interpretation to Stitch. Not pixel-precise, not minimal.
- **D-02:** Design token injection via inline constraints in prompt text ("Use primary color #1a1a2e, border-radius 8px, Inter font family") PLUS reference screenshots when available (user-provided during spec creation or from prior approved pages).
- **D-03:** Device type is user-configured, not hardcoded. User declares targets at Phase 3 start (desktop only, desktop + mobile, etc.). Default to desktop only. When multiple targets selected, generate one Stitch call per device type per page.
- **D-04:** Feedback-informed retry on rejection — user provides specific feedback ("make sidebar narrower"), system appends to prompt, re-calls Stitch. Up to 3 retries before escalating with full history for manual intervention.

### Design Token Extraction
- **D-05:** AI-based extraction from Stitch HTML output using Claude. Send HTML to Claude with structured prompt to extract color palette, typography, spacing, border radius, shadow style into dmTokens schema shape. Validate against schema, show to user for confirmation, then persist to Neon.
- **D-06:** Extract both design tokens AND component patterns (card style, button variants, nav layout). Patterns stored in dmPatterns for richer Stitch context on subsequent pages.
- **D-07:** Progressive token evolution — tokens grow with each approved page but don't change existing values. Page 1 (e.g., auth) may only set primary color and font. Page 2 (dashboard) adds secondary color, card patterns, chart styles. Uses dmTokens immutable revision model (new version row per extraction, prior values carried forward).
- **D-08:** Pattern conflict detection — when a new page introduces a component pattern that differs from an established one (e.g., different card border radius), AI flags the conflict. User decides: unify to existing pattern, keep both as named variants, or override with new pattern going forward.

### Self-Review & Confidence
- **D-09:** Four-dimension structured self-review checklist:
  1. Spec compliance — all PageSpec components present, auth gates correct, states present
  2. Visual consistency — colors, typography, spacing, patterns match established design tokens
  3. Structural completeness — navigation, responsive layout, accessibility, semantic HTML
  4. Content quality — reasonable placeholder text, appropriate labels/icons, no lorem ipsum in production areas
- **D-10:** High confidence threshold — 90%+ across ALL dimensions for auto-approval. Any single dimension below 90% triggers user escalation. User sees exactly which dimension failed and why.
- **D-11:** AI-based review implementation using Claude Sonnet. Send Stitch HTML + screenshot(s) + PageSpec + design tokens + prior page patterns. Returns per-dimension scores with specific findings as structured JSON.
- **D-12:** When multiple device types are generated per page, desktop and mobile versions are reviewed together in a single Claude call. Reviewer evaluates responsive consistency between the two. One combined score set covers both.

### Approval Gate Flow
- **D-13:** Page 1 always escalates to user regardless of self-review score (UIGEN-06). This sets the design direction for the entire project.
- **D-14:** Approval gate shows: Stitch screenshot(s), self-review scores per dimension with specific findings, original PageSpec with component checklist (found/missing), and three action options.
- **D-15:** Three user actions at gate: Approve (extract tokens, store patterns, mark complete, move to next), Reject+feedback (triggers feedback-informed retry per D-04), Skip (defer page, continue pipeline, return later).
- **D-16:** Brief notification for auto-approved pages — one-line summary ("✓ Page 3 (Settings) auto-approved — all dimensions 90%+"). Full gate displayed only for escalated pages.

### Claude's Discretion
- Stitch prompt template structure and exact wording
- AI extraction prompt engineering for design tokens and patterns
- Self-review prompt engineering and scoring calibration
- How pattern conflict detection determines "same" vs "different" patterns
- Internal page processing order within the suggested generation order
- How feedback is formatted when appended to Stitch retry prompts

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Dependencies
- `.planning/phases/02-spec-layer/02-CONTEXT.md` — Phase 2 decisions (PageSpec shape, layered schemas, confirmation gate pattern)
- `shared/spec-schema.ts` — PageSpecFull, PageSpecUI, PageSpecCore schemas consumed by this phase
- `shared/design-schema.ts` — dmTokens, dmPages, dmPatterns Drizzle tables for design memory persistence

### Stitch Integration
- `lib/stitch/client.ts` — generateScreen() wrapper with retry logic (the API call this phase orchestrates)
- `lib/stitch/types.ts` — StitchGenerateRequest, StitchGenerateResult types

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, target workflow
- `.planning/REQUIREMENTS.md` — UIGEN-01 through UIGEN-07 requirements
- `.planning/ROADMAP.md` — Phase 3 success criteria and Phase 4 dependencies

### Existing Patterns
- `.planning/codebase/CONVENTIONS.md` — Naming patterns and code style
- `.planning/codebase/STRUCTURE.md` — Directory layout conventions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/stitch/client.ts` — generateScreen(projectId, { prompt, deviceType }) with pRetry, returns { htmlUrl, screenshotUrl, projectId, screenId }
- `shared/design-schema.ts` — dmTokens (immutable revision model), dmPages, dmPatterns tables already in Neon
- `UiGenPhaseOutputSchema` — pre-defined Zod schema with htmlUrl, screenshotUrl, tokenVersion, approved
- `shared/spec-schema.ts` — PageSpecFull with all four layers, PageSpecUI for layout hints and state descriptions
- `@anthropic-ai/sdk` — Claude API for self-review and token extraction
- `lib/spec-parser/types.ts` — Type re-exports for spec consumption

### Established Patterns
- Anthropic SDK usage pattern: env vars `AI_INTEGRATIONS_ANTHROPIC_API_KEY` and `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`
- pRetry for resilient API calls (used in stitch/client.ts and spec-parser/restructure-spec.ts)
- Zod schema validation for all structured outputs
- Pure functions in `lib/` directory pattern (detect-framework.ts)
- Skills in `.claude/skills/saas-dev/` with SKILL.md definition files

### Integration Points
- `shared/design-schema.ts` — Write extracted tokens to dmTokens table, patterns to dmPatterns
- `shared/design-schema.ts` — Track page pipeline status in pipelinePages table
- `.claude/skills/saas-dev/orchestrator/SKILL.md` — Phase 3 skill wires into orchestrator
- PageSpecFull consumed via `PageSpecCore.merge(PageSpecUI)` for generation context

</code_context>

<specifics>
## Specific Ideas

- Token evolution mirrors real design system maturation — auth page sets minimal tokens, dashboard enriches with component patterns, feature pages fill in remaining gaps
- Pattern conflict detection prevents subtle visual drift that would compound across many pages
- Screenshot + scores + spec at the approval gate gives user full context without requiring them to read HTML
- Skip action at gate prevents one difficult page from blocking the entire pipeline
- Device type configuration at Phase 3 start (not hardcoded) means the system works for web apps, PWAs, and responsive sites equally

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-ui-generation*
*Context gathered: 2026-03-28*
