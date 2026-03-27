---
phase: 01-foundation
plan: "01"
subsystem: design-memory-schema
tags: [drizzle, schema, zod, neon, postgresql, pipeline-state]
dependency_graph:
  requires: []
  provides: [design-memory-tables, pipeline-state-tables, zod-pipeline-contracts]
  affects: [all-downstream-phases]
tech_stack:
  added: []
  patterns: [immutable-revision-model, composite-unique-index, drizzle-zod-insert-schemas, zod-pipeline-contracts]
key_files:
  created:
    - shared/design-schema.ts
    - migrations/0000_add_design_memory_schema.sql
    - migrations/meta/_journal.json
    - migrations/meta/0000_snapshot.json
  modified:
    - drizzle.config.ts
decisions:
  - "Inline table config function (3rd arg of pgTable) used for uniqueIndex — standalone uniqueIndex export causes JSON.parse error in drizzle-orm 0.39.1 when columns lack defaultConfig"
  - "Used direct SQL via tsx script for db:push because drizzle-kit push is interactive when disambiguating new tables from existing ones (create vs rename)"
  - "Migration snapshot generated via drizzle-kit generate to document schema state; tables applied via CREATE TABLE IF NOT EXISTS script"
metrics:
  duration: "7 minutes"
  completed_date: "2026-03-27"
  tasks_completed: 2
  files_changed: 5
---

# Phase 01 Plan 01: Design Memory Schema Summary

Design memory schema (dm_* tables), pipeline state tables, and Zod pipeline contracts created in `shared/design-schema.ts`. Drizzle config updated to reference both schema files. All 6 tables created in Neon with composite unique indexes.

## What Was Built

**`shared/design-schema.ts`** — single file containing:
- 4 design memory tables: `dm_projects`, `dm_tokens`, `dm_pages`, `dm_patterns`
- 2 pipeline state tables: `pipeline_runs`, `pipeline_pages`
- `dm_tokens` uses immutable revision model (new row per version, composite unique index on `projectId + version`)
- `pipeline_pages` has composite unique index on `runId + pageIndex + phase`, plus `error` field for retry context
- 6 `drizzle-zod` insert schemas
- 5 Zod pipeline contracts: `PageStateSchema`, `ProjectConfigSchema`, `PipelineRunSchema`, `SpecPhaseOutputSchema`, `UiGenPhaseOutputSchema`
- 5 TypeScript type exports
- `UiGenPhaseOutputSchema` uses `htmlUrl`/`screenshotUrl` (URL fields, not raw HTML)

**`drizzle.config.ts`** — updated `schema:` field from single string to array referencing both `./shared/schema.ts` and `./shared/design-schema.ts`

**Neon database** — all 6 tables and 2 unique indexes created and confirmed

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `01bfd08` | feat(01-01): create design memory and pipeline state schema |
| Task 2 | `a269bfa` | feat(01-01): update drizzle config and push 6 new tables to Neon |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed uniqueIndex placement for drizzle-orm 0.39.1 compatibility**
- **Found during:** Task 1 verification
- **Issue:** Standalone `uniqueIndex("name").on(table.col1, table.col2)` exports cause `JSON.parse(JSON.stringify(undefined))` error because columns outside a table definition lack `defaultConfig`. The plan specified standalone export pattern.
- **Fix:** Moved uniqueIndex definitions into the table config function (3rd argument of `pgTable`), which is the supported Drizzle pattern.
- **Files modified:** `shared/design-schema.ts`
- **Commit:** `01bfd08`

**2. [Rule 3 - Blocking] Used direct SQL for db:push due to interactive prompt**
- **Found during:** Task 2
- **Issue:** `drizzle-kit push` shows interactive "create or rename table?" prompts when new tables have similar names to existing ones (e.g., `dm_pages` matching `pages` pattern). `--force` flag only suppresses data loss confirmations, not disambiguation prompts.
- **Fix:** Generated migration SQL via `drizzle-kit generate` to document schema state, then applied tables directly via a `tsx` script using `CREATE TABLE IF NOT EXISTS`. Tables confirmed present in Neon.
- **Files modified:** none (temp script deleted post-execution)
- **Commit:** `a269bfa`

## Known Stubs

None — this plan creates only schema definitions and database tables. No UI rendering, no placeholder text, no data sources.

## Verification Results

- `npx tsx -e "import './shared/design-schema.ts'"` — exits 0
- 6 pgTable definitions confirmed
- 6 insert schemas confirmed
- 5 Zod schemas confirmed
- 5 TypeScript type exports confirmed
- `UiGenPhaseOutputSchema` uses `htmlUrl: z.string().url()` — confirmed
- No `pipeline-state.json` references in codebase — D-06 compliant
- All 6 tables + 2 unique indexes confirmed in Neon database

## Self-Check: PASSED

Files confirmed present:
- `shared/design-schema.ts` — FOUND
- `migrations/0000_add_design_memory_schema.sql` — FOUND
- `drizzle.config.ts` — FOUND (modified)

Commits confirmed:
- `01bfd08` — FOUND
- `a269bfa` — FOUND
