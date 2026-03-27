# Phase 1: Foundation - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver all infrastructure contracts, schemas, SDK wrappers, test harness, and framework detection that downstream phases (2-6) depend on. Nothing in this phase is user-facing — it's the typed foundation that every subsequent phase consumes.

Requirements covered: ORCH-01, ORCH-02, ORCH-03, ORCH-04, ORCH-05, INTG-06

</domain>

<decisions>
## Implementation Decisions

### Design Memory Schema
- **D-01:** Design tokens stored as structured columns (color_palette, type_scale, spacing, border_radius, etc.) — not JSONB. Enables machine-comparable drift detection for Phase 3 confidence scoring.
- **D-02:** Component patterns store metadata only (name, variant info, props shape, usage context). Actual component code stays in the repo.
- **D-03:** Design memory is scoped per-project with version history. Each token update creates a new version so design evolution is auditable and rollback-friendly.
- **D-04:** All design memory tables use `dm_` prefix (dm_projects, dm_pages, dm_tokens, dm_patterns) to avoid collision with app tables.
- **D-05:** Multi-project isolation via `project_id` column on all design memory tables. EntrepreneurOS tokens must not bleed into other projects.

### Pipeline State Contract
- **D-06:** Pipeline state lives in Neon PostgreSQL only — no JSON file in repo. Matches ORCH-02 requirement.
- **D-07:** Checkpoints are per-page within phase. Pausing after page 7 of 12 resumes at page 8, not page 1.
- **D-08:** State schemas are modular and composable — each phase defines its own input/output Zod shape. Pipeline state is a union/intersection of phase schemas.
- **D-09:** User interrupts happen at checkpoints only (after each page completes its current phase step). No anytime injection.
- **D-10:** Page entries in pipeline state include an `error` field for failed operations — enables auto-retry with context and clear issue surfacing.
- **D-11:** Pipeline state tables scoped by `project_id` for multi-project isolation (same as design memory).

### Stitch SDK Wrapper
- **D-12:** Thin typed wrapper — handles auth, typed request/response, error mapping only. No design token injection or prompt construction (that's Phase 3's concern).
- **D-13:** Automatic retry with exponential backoff (3 attempts) for transient errors. Uses p-retry (already in deps). Permanent errors surface immediately.
- **D-14:** Wrapper lives in standalone `lib/stitch/` directory — not in server/integrations/. Emphasizes reusability across repos.
- **D-15:** Research Stitch API docs BEFORE writing wrapper code. API contract must come from official documentation, not assumptions.

### Skill Organization
- **D-16:** Architecture: one orchestrator skill + phase-specific sub-skills. Orchestrator routes to the right skill at the right pipeline stage.
- **D-17:** Skills live in this repo's `.claude/skills/` directory. Portable to other repos by copying the directory.
- **D-18:** All skills namespaced as `saas-dev:*` (e.g., saas-dev:orchestrator, saas-dev:detect-framework).
- **D-19:** Phase 1 creates orchestrator skeleton + detect-framework skill only. Phase-specific skills (spec-parser, ui-generator, etc.) created in their own phases.

### Vitest Setup
- **D-20:** Configure Vitest for both server (Node) and client (jsdom) environments from the start. Phase 1 smoke tests are server-side, but config is ready for React component tests in Phase 4+.

### Database Migration Strategy
- **D-21:** Design memory tables use the same Drizzle config and migration pipeline as app tables. One `db:push` handles everything.
- **D-22:** Schema definitions in a separate file (e.g., `shared/design-schema.ts`) but referenced from the same `drizzle.config.ts`. Clean code separation, single migration pipeline.

### Claude's Discretion
- Schema file location: separate file vs same file (leaning separate for portability)
- Phase 1 smoke test targets: schema validation, framework detection, or both
- Exact Zod field names and types for pipeline state schemas
- Stitch wrapper internal implementation patterns

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, skill mapping, build approach
- `.planning/REQUIREMENTS.md` — All 42 v1 requirements with phase mapping
- `.planning/ROADMAP.md` — Phase 1 success criteria and dependencies

### Existing Codebase
- `shared/schema.ts` — Current Drizzle table definitions and Zod schemas (pattern to follow)
- `server/db.ts` — Drizzle ORM instance configuration
- `drizzle.config.ts` — Migration pipeline config (add design schema reference here)
- `server/ai/index.ts` — AI provider abstraction pattern (thin wrapper reference)
- `server/integrations/gmail.ts` — Integration client pattern
- `package.json` — Current dependencies (framework detection target, Vitest to add)
- `vite.config.ts` — Build config (Vitest integration point)
- `tsconfig.json` — Path aliases and compiler options

### Codebase Analysis
- `.planning/codebase/STACK.md` — Full technology stack inventory
- `.planning/codebase/STRUCTURE.md` — Directory layout and conventions
- `.planning/codebase/CONVENTIONS.md` — Naming patterns and code style

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@neondatabase/serverless` + `postgres` driver — already configured for Neon PostgreSQL
- `drizzle-orm` + `drizzle-zod` — ORM and Zod schema generation already in use
- `p-retry` — retry logic package already in dependencies
- `zod` — validation library extensively used throughout codebase

### Established Patterns
- Drizzle table definitions with `insertXSchema` Zod exports in `shared/schema.ts`
- Thin AI service wrappers in `server/ai/` implementing common interface
- Integration clients in `server/integrations/` with OAuth and error handling
- Path aliases: `@/*` → `client/src/*`, `@shared/*` → `shared/*`
- kebab-case files, camelCase functions, PascalCase types

### Integration Points
- `drizzle.config.ts` — add design schema file reference
- `package.json` — add Vitest, @testing-library deps
- `vite.config.ts` — add Vitest config or separate vitest.config.ts
- `.claude/skills/` — create skill directory and files

</code_context>

<specifics>
## Specific Ideas

- Design token drift detection needs machine-comparable values (hex colors, numeric spacing) — schema design must support this for Phase 3's 15% drift tolerance scoring
- Stitch wrapper follows the same thin-wrapper pattern as existing AI service files in `server/ai/`
- Skill namespace `saas-dev:*` matches existing patterns (`gsd:*`, `posthog:*`, `superpowers:*`)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-27*
