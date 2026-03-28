# Phase 2: Spec Layer - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver spec ingestion (paste or collaborate) that produces a validated, layered PageSpec[] output. Supports format-agnostic input with AI restructuring, collaborative spec creation through domain-first questioning, and backend spec generation. All downstream phases (3-6) consume PageSpec[] as their input contract.

Requirements covered: SPEC-01, SPEC-02, SPEC-03, SPEC-04, SPEC-05

</domain>

<decisions>
## Implementation Decisions

### Spec Input & Parsing
- **D-01:** Format-agnostic input — accept markdown, plain text, Notion exports, any format. AI interprets intent and restructures into PageSpec[] regardless of input quality.
- **D-02:** AI restructuring fills technical gaps even when the user's spec has them. If user writes "dashboard with analytics" without specifying components, the AI infers data visualization components, auth protection, loading states, etc.
- **D-03:** Full restructured spec shown to user for confirmation. Inferred/added items are visually distinct from explicit content. One confirmation gate, full visibility.
- **D-04:** Two-step flow: parse → restructure → confirm. User sees everything the AI understood and approves, edits, or kicks back for re-interpretation before anything gets locked.

### PageSpec Output Shape
- **D-05:** Layered PageSpec structure with four layers:
  - **Core layer** (all phases read): name, route, purpose, components[], authLevel, priority, dependsOn
  - **UI layer** (Phase 3-4 consume): layout hints, empty/loading/error state descriptions, mobile considerations
  - **Data layer** (Phase 5 consumes): data requirements per component, API endpoints implied, validation rules
  - **Analytics layer** (Phase 6 consumes): event taxonomy, tracking points, feature flag candidates
- **D-06:** Zod contracts are composable — `PageSpecCore.merge(PageSpecUI)` for Phase 3, `PageSpecCore.merge(PageSpecData)` for Phase 5. Each phase reads core + its layer, no wasted fields.

### Collaborative Spec Flow
- **D-07:** Domain-first questioning as primary flow — vision → user flows → pages → per-page detail → implied requirements. Mirrors `superpowers:brainstorming` pattern.
- **D-08:** References accepted at any point during collaboration — URLs, screenshots, "make it like X". References inform the spec being built but don't replace structured questioning.

### Backend Spec Relationship
- **D-09:** All three input paths supported — auto-derived from UI spec, paste standalone, or collaborate. System adapts to how the user works.
- **D-10:** Auto-generation always runs when UI spec exists. Even if user also pastes or collaborates on backend, the system shows what it derived from UI PageSpec[] data layer and lets user reconcile.
- **D-11:** All paths converge to the same validated backend spec structure. Cross-references against UI spec when both exist, flags mismatches.
- **D-12:** Backend-only concerns (webhooks, cron jobs, third-party integrations, background tasks) captured through user overrides after auto-generation.

### Multi-Page Ordering & Dependencies
- **D-13:** Parser auto-detects page dependencies from spec content (e.g., profile page referenced by settings page). Each PageSpec includes a `dependsOn` field.
- **D-14:** Default generation order: foundational pages (auth, layout shell, dashboard) → feature pages → settings/admin. User can override.
- **D-15:** Suggested generation order output alongside PageSpec[] for Phase 3 consumption.

### Spec Versioning & Iteration
- **D-16:** Surgical edits — change one page's spec without invalidating the rest. Modified PageSpec gets a version bump.
- **D-17:** Downstream phases that consumed old version get flagged ("Page 3 spec changed — Phase 3 output may be stale"). Dependent pages also flagged for review.
- **D-18:** Pages with no relationship to the change are untouched. No full re-parse needed.
- **D-19:** Per-page status tracking in pipeline state (Neon) supports marking individual pages as "spec-changed, needs re-generation."

### Shared Components
- **D-20:** Deduplication pass after restructuring all pages. Similar components described with different language across pages get unified into a single shared component definition.
- **D-21:** Top-level `sharedComponents[]` in spec output. Each PageSpec references shared components by ID, not re-description.
- **D-22:** Deduplication shown to user: "I merged these 3 descriptions into one shared component: `SidebarNav`." User confirms or splits apart.

### Spec Size Handling
- **D-23:** No hard cap on page count.
- **D-24:** 1-25 pages: single AI pass for restructuring. No chunking needed.
- **D-25:** 26+ pages: parser chunks into groups of ~15 pages by domain (e.g., "auth & onboarding", "core features", "admin & settings"). Each chunk restructured, then merge pass unifies shared components and resolves cross-chunk dependencies.
- **D-26:** Chunking is internal — user pastes one spec, gets one PageSpec[] back. They don't see or manage chunks.

### Claude's Discretion
- Exact Zod field names and types for each PageSpec layer
- AI prompt engineering for restructuring and gap-filling
- Deduplication similarity threshold for shared component detection
- Domain grouping logic for chunked parsing
- Questioning depth/sequence in collaborative flow

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, skill mapping, build approach
- `.planning/REQUIREMENTS.md` — SPEC-01 through SPEC-05 requirements
- `.planning/ROADMAP.md` — Phase 2 success criteria and dependencies

### Phase 1 Artifacts (dependencies)
- `shared/design-schema.ts` — Drizzle table definitions and Zod contract patterns to follow
- `lib/stitch/types.ts` — Type definition patterns (StitchGenerateRequest, StitchGenerateResult)
- `lib/detect-framework.ts` — Pure function pattern for utility modules
- `.claude/skills/saas-dev/orchestrator/SKILL.md` — Orchestrator skill skeleton to extend
- `.planning/phases/01-foundation/01-CONTEXT.md` — Phase 1 decisions (pipeline state in Neon, skill namespace, Zod patterns)

### Existing Codebase
- `shared/schema.ts` — Current Drizzle + Zod patterns
- `.planning/codebase/CONVENTIONS.md` — Naming patterns and code style
- `.planning/codebase/STRUCTURE.md` — Directory layout conventions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `zod` — Validation library for PageSpec contracts
- `drizzle-zod` + `createInsertSchema` — Pattern for generating Zod schemas from Drizzle tables
- `shared/design-schema.ts` — Pipeline state tables already exist for tracking per-page status (D-19)
- `lib/stitch/types.ts` — Pattern for typed request/response interfaces
- `@anthropic-ai/sdk` — Claude API for spec restructuring and collaborative questioning
- `superpowers:brainstorming` skill — Pattern reference for domain-first questioning flow

### Established Patterns
- Layered Zod schemas with `.merge()` composition (drizzle-zod pattern)
- Pure utility functions in `lib/` directory (detect-framework.ts pattern)
- Skills in `.claude/skills/saas-dev/` with SKILL.md definition files
- kebab-case files, camelCase functions, PascalCase types

### Integration Points
- `shared/design-schema.ts` — Add PageSpec Zod contracts alongside design memory schemas (or new file)
- `.claude/skills/saas-dev/` — Create spec-parser skill
- Pipeline state tables in Neon — Track per-page spec status and version

</code_context>

<specifics>
## Specific Ideas

- Full restructured spec confirmation mirrors Phase 3's page-by-page approval pattern but at spec level — one gate, full visibility, inferred items visually distinct
- Layered PageSpec with composable Zod contracts means each downstream phase gets a typed, minimal interface — no parsing irrelevant fields
- Shared component deduplication prevents Phase 4 from creating duplicate components when multiple pages describe the same sidebar/nav/header differently
- Domain-first collaborative flow follows the same rhythm as `superpowers:brainstorming` — structured questioning from intent to specifics, with references accepted at any point
- Backend auto-generation from UI data layer ensures backend serves exactly what frontend requests — no spec drift

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-spec-layer*
*Context gathered: 2026-03-27*
