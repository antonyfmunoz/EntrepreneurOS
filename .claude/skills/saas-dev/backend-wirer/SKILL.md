---
name: saas-dev:backend-wirer
description: Takes BackendSpec from Phase 2 (spec-parser) and wires Express routes, Drizzle schemas, storage functions, and TanStack Query hooks into the existing codebase — brownfield-aware, with autonomous test-fix loop. Use when executing Phase 5 (backend-quality) of the SaaS development pipeline.
---

# Skill: saas-dev:backend-wirer

Takes a BackendSpec and writes generated Express routes, Drizzle schema tables, storage class functions, and TanStack Query hook injections directly into the existing project files — with collision detection before any write, a Drizzle migration run after schema changes, and a 3-cycle test-fix loop to validate the result.

## Prerequisites

- Phase 4 (saas-dev:integrator) complete
- Phase 2 (saas-dev:spec-parser) complete with BackendSpec stored in `pipeline_pages`
- `DATABASE_URL` configured for Neon PostgreSQL
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` env var set (required for fix-loop AI fixes)
- `supertest` installed as dev dependency (required for integration test generation)

## Inputs

- `projectRoot: string` — absolute path to the SaaS project repo
- `runId: string` — pipeline run ID (used to query `pipeline_pages` for BackendSpec)

## Module Map

All modules live under `lib/backend-wirer/`:

| Module | Export | Role |
|--------|--------|------|
| `lib/backend-wirer/types.js` | All shared types | BackendWiringPlan, BackendBrownfieldInventory, RouteCodeBlock, etc. |
| `lib/backend-wirer/brownfield-backend-audit.js` | `auditBackendBrownfield`, `detectCollisions` | Scan existing routes, storage, schema for collisions |
| `lib/backend-wirer/route-generator.js` | `generateRouteCode`, `generateStorageCode` | Generate Express route + storage function code strings |
| `lib/backend-wirer/schema-generator.js` | `generateSchemaCode`, `generateMigrationSQL` | Generate Drizzle table + Zod schema code strings |
| `lib/backend-wirer/hook-injector.js` | `generateHookInjections` | Generate TanStack Query hook code for page files |
| `lib/backend-wirer/migration-runner.js` | `writeMigrationScript`, `runMigration` | Write and execute idempotent DDL migration scripts |
| `lib/backend-wirer/wiring-applier.js` | `applyWiringPlan` | Write generated code into target files at correct offsets |
| `lib/test-runner/test-generator.js` | `generateIntegrationTest` | Generate integration test files from endpoint specs |
| `lib/test-runner/fix-loop.js` | `runWithFixLoop` | 3-cycle test-fix-rerun with structured escalation |

## Pipeline

**Step 1 — Query BackendSpec from pipeline_pages**
```typescript
const pages = await db.select().from(pipelinePages)
  .where(and(eq(pipelinePages.runId, runId), eq(pipelinePages.phase, "spec"), eq(pipelinePages.status, "complete")));
const backendSpec = BackendSpecSchema.parse(JSON.parse(pages[0].output));
```

**Step 2 — Brownfield audit**
```typescript
const inventory = await auditBackendBrownfield(projectRoot);
```

**Step 3 — Collision detection**
```typescript
const validation = detectCollisions(inventory, backendSpec);
if (!validation.valid) { /* log warnings, filter colliding endpoints */ }
```

**Step 4 — Generate code blocks**
```typescript
const newRoutes = backendSpec.endpoints.map(ep => generateRouteCode(ep, inventory));
const newStorage = backendSpec.endpoints.map(ep => generateStorageCode(ep));
const newSchema = backendSpec.drizzleTableHints.map(t => generateSchemaCode(t, backendSpec.fields[t] ?? []));
const hookInjections = generateHookInjections(backendSpec.endpoints, pageSpecs);
```

**Step 5 — Assemble BackendWiringPlan**
```typescript
const plan: BackendWiringPlan = { newRoutes, newSchemaBlocks: newSchema, newStorageFunctions: newStorage, hookInjections, validationResult: validation };
```

**Step 6 — Generate and run migration**
```typescript
const sql = generateMigrationSQL(newSchema);
const scriptPath = await writeMigrationScript(projectRoot, sql, runId);
const migResult = await runMigration(scriptPath, projectRoot);
if (!migResult.success) throw new Error(migResult.output);
```

**Step 7 — Apply wiring plan**
```typescript
const result = await applyWiringPlan(projectRoot, plan, inventory);
console.log(`Modified: ${result.filesModified.join(", ")}`);
```

**Step 8 — Generate integration tests**
```typescript
const tests = backendSpec.endpoints.map(ep => generateIntegrationTest(ep));
```

**Step 9 — Run test-fix loop**
```typescript
const loopResult = await runWithFixLoop(tests, projectRoot, fixFn, { maxCycles: 3 });
```

**Step 10 — Commit or escalate**
```typescript
if (loopResult.passed) { await commitChanges(projectRoot, result.filesModified); }
else { return { escalation: loopResult.escalationReport }; }
```

## Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| Collision detected | New endpoint path matches existing route | Skip colliding endpoint, log warning, continue |
| Missing createServer anchor | routes.ts structure changed from expected | Abort route insertion, escalate to user |
| Migration failure | DDL error against Neon PostgreSQL | Present error + SQL to user for manual resolution |
| Test fix loop exhausted | 3 cycles failed to produce passing tests | Return EscalationReport with failing tests and last hypothesis |

## Pitfall Reference

| # | Pitfall | Detection | Action |
|---|---------|-----------|--------|
| 1 | Route inserted after createServer | routesInsertionOffset points past anchor | Always locate anchor fresh via `indexOf("createServer(app)")` in audit |
| 2 | Auth mocking missing in tests | 401 response in integration tests | generateIntegrationTest injects `agent.set("Cookie", authCookie)` for authRequired endpoints |
| 5 | Handwritten Zod vs drizzle-zod | Schema types diverge over time | Always use handwritten Zod schemas (insertXSchema pattern) — not drizzle-zod auto-gen |
| 6 | drizzleTableHints overlap existing | Migration fails with "already exists" | generateSchemaCode uses `CREATE TABLE IF NOT EXISTS`; audit checks existingTableNames before adding |
