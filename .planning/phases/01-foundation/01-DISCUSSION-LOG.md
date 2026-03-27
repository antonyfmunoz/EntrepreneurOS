# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 01-foundation
**Areas discussed:** Design memory schema, Pipeline state contract, Stitch SDK wrapper, Skill organization, Vitest setup strategy, Database migration strategy

---

## Design Memory Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Separate schema file | New file like shared/design-schema.ts — keeps system portable | |
| Same shared/schema.ts | Keep everything in one file — matches current pattern | |
| You decide | Claude's discretion | ✓ |

**User's choice:** You decide
**Notes:** User deferred schema file location to Claude

---

| Option | Description | Selected |
|--------|-------------|----------|
| Structured columns | Explicit fields for each token type. Queryable, type-safe | ✓ |
| JSONB blob | Single tokens JSON column. Flexible but less type-safe | |
| Hybrid | Core tokens as columns + extras JSONB field | |

**User's choice:** Structured columns

---

| Option | Description | Selected |
|--------|-------------|----------|
| Metadata only | Component name, variant info, where used, props shape | ✓ |
| Full code snippets | Store actual component code in DB | |
| You decide | Claude's discretion | |

**User's choice:** Metadata only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Per-project | One canonical set of tokens per project | |
| Per-project versioned | Per-project with version history for rollback | ✓ |
| Per-page | Each page stores its own token snapshot | |

**User's choice:** Per-project versioned

---

## Pipeline State Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Neon DB only | State lives in PostgreSQL. Skills query directly | ✓ |
| JSON file + Neon sync | pipeline-state.json in repo, synced to Neon | |
| JSON file only | State as a file in the project | |

**User's choice:** Neon DB only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Per-phase | Checkpoint at phase boundaries | |
| Per-page within phase | Checkpoint after each page is processed | ✓ |
| Per-step within page | Checkpoint at every step | |

**User's choice:** Asked Claude's recommendation — Claude recommended per-page within phase

---

| Option | Description | Selected |
|--------|-------------|----------|
| Modular composable | Each phase defines its own Zod shape. Pipeline state is union/intersection | ✓ |
| Single unified schema | One PipelineState Zod object with all fields | |
| You decide | Claude's discretion | |

**User's choice:** Modular composable

---

| Option | Description | Selected |
|--------|-------------|----------|
| Checkpoint-only | System pauses at defined checkpoints | ✓ |
| Anytime injection | User can type feedback at any point | |
| You decide | Claude's discretion | |

**User's choice:** Checkpoint-only

---

## Stitch SDK Wrapper

| Option | Description | Selected |
|--------|-------------|----------|
| Thin typed wrapper | Minimal abstraction: typed request/response, auth, error mapping | ✓ |
| Opinionated client | Handles design token injection, prompt construction, retry | |
| You decide | Claude's discretion | |

**User's choice:** Asked Claude's recommendation — Claude recommended thin typed wrapper

---

| Option | Description | Selected |
|--------|-------------|----------|
| Retry with backoff | Automatic retry (3 attempts, exponential backoff) | ✓ |
| Surface all errors | No automatic retry — caller decides | |
| You decide | Claude's discretion | |

**User's choice:** Retry with backoff

---

| Option | Description | Selected |
|--------|-------------|----------|
| server/integrations/stitch.ts | Follows existing integration pattern | |
| Standalone package | Separate directory like lib/stitch/ | ✓ |
| You decide | Claude's discretion | |

**User's choice:** Standalone package (lib/stitch/)

---

## Skill Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Orchestrator + phase skills | One orchestrator routes to phase-specific skills | ✓ |
| Single orchestrator skill | One big skill handles entire pipeline | |
| You decide | Claude's discretion | |

**User's choice:** Orchestrator + phase skills

---

| Option | Description | Selected |
|--------|-------------|----------|
| This repo .claude/skills/ | Skills alongside the project | ✓ |
| Global ~/.claude/skills/ | Skills available across all repos | |
| Separate repo | Dedicated skill repo | |

**User's choice:** Asked Claude's recommendation — Claude recommended .claude/skills/

---

| Option | Description | Selected |
|--------|-------------|----------|
| Namespaced (saas-dev:*) | Avoids collisions, matches existing patterns | ✓ |
| Flat names | Simpler but could collide | |
| You decide | Claude's discretion | |

**User's choice:** Namespaced

---

| Option | Description | Selected |
|--------|-------------|----------|
| Orchestrator skeleton only | Orchestrator + detect-framework in Phase 1 | ✓ |
| Orchestrator + all stubs | All skill files as empty shells | |
| You decide | Claude's discretion | |

**User's choice:** Asked Claude's recommendation — Claude recommended orchestrator skeleton only

---

## Vitest Setup Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Server + client from start | Configure with both Node and jsdom environments | ✓ |
| Server-only for now | Minimal config, Node environment only | |
| You decide | Claude's discretion | |

**User's choice:** Server + client from start

---

| Option | Description | Selected |
|--------|-------------|----------|
| Schema validation | Validates pipeline state Zod schemas + design memory Drizzle schemas | |
| Framework detection | Runs detection against this repo's package.json | |
| Both + Stitch wrapper | All above plus Stitch API call test | |
| You decide | Claude's discretion | ✓ |

**User's choice:** You decide
**Notes:** Smoke test targets deferred to Claude

---

## Database Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Same pipeline | Same Drizzle config, same migration folder | ✓ |
| Separate Drizzle config | New config pointing to same DB, separate migration folder | |
| You decide | Claude's discretion | |

**User's choice:** Asked Claude's recommendation — Claude recommended same pipeline

---

| Option | Description | Selected |
|--------|-------------|----------|
| dm_ prefix | dm_projects, dm_pages, dm_tokens, dm_patterns | ✓ |
| design_ prefix | design_projects, design_pages, design_tokens | |
| No prefix | projects, pages, tokens, patterns | |
| You decide | Claude's discretion | |

**User's choice:** dm_ prefix

---

## Claude's Discretion

- Schema file location (separate vs same file)
- Phase 1 smoke test targets
- Exact Zod field names and types
- Stitch wrapper implementation patterns

## Deferred Ideas

None — discussion stayed within phase scope
