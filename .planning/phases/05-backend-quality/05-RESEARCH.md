# Phase 5: Backend + Quality - Research

**Researched:** 2026-03-29
**Domain:** Express route generation, Drizzle schema extension, TanStack Query hook injection, Vitest integration testing with Neon PostgreSQL
**Confidence:** HIGH

## Summary

Phase 5 wires the static React components produced in Phase 4 to real Express endpoints, Drizzle schema additions, and Zod validators — then writes integration tests with an autonomous fix loop. The source of truth for what to build is `deriveBackendSpec()` output (a `BackendSpec` object), which already exists from Phase 2. Phase 5 does not scan TSX files for API calls; it reads the spec.

The codebase has a clear, well-established pattern for every operation this phase touches. `server/routes.ts` (2526 lines) ends with a single `return createServer(app)` — the last real route is `/api/agents/:id/metrics` at line 2513. New routes append before the `createServer` call. `server/storage.ts` exports a singleton `storage` object from a class. `shared/schema.ts` uses inline Zod objects rather than drizzle-zod for insert schemas. Migration scripts use `db.execute(sql\`CREATE TABLE IF NOT EXISTS\`)` via tsx. Vitest@2 is pinned, tests live in `tests/unit/` and the config already includes `tests/integration/**/*.test.ts`.

The single biggest risk is the integration test database strategy. The project uses `postgres` (the native driver) behind Drizzle — not `@neondatabase/serverless`. Transaction rollback isolation is straightforward with this driver. A separate `tests/integration/` directory does not yet exist; it needs to be created in Wave 0.

**Primary recommendation:** Build four modules under `lib/backend-wirer/` (types, brownfield-backend-audit, route-generator, hook-injector) and one under `lib/test-runner/` (integration-test-runner with fix-loop). All test utilities go under `tests/integration/`. No new npm packages are required for the backend wiring itself; `supertest` is needed for HTTP-level integration tests.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Contract Extraction Strategy**
- D-01: PageSpec-driven endpoint generation. Use `deriveBackendSpec()` output from Phase 2 as source of truth. No TSX scanning.
- D-02: Auto-inject useQuery/useMutation hooks into existing Phase 4 page components.
- D-03: Strict validation before wiring. Cross-check every PageSpec data requirement against generated endpoints. Flag gaps before wiring begins.
- D-04: Backend brownfield scan for endpoint collision. Scan `routes.ts` for existing paths and `storage.ts` for existing function names before generating.
- D-05: Auth context follows Phase 4 D-07 default. Every generated endpoint requires authenticated user + company scope. PageSpec `authLevel` can override.

**Monolith Wiring Approach**
- D-06: Append new endpoints to existing `routes.ts`. No refactoring.
- D-07: Append new CRUD functions to existing `storage.ts`.
- D-08: Order-aware insertion. New routes inserted before `createServer(app)` call. Express is first-match-wins.
- D-09: Follow existing inline Zod validation pattern. No separate validation middleware.

**Test-Fix Loop Behavior**
- D-10: 3 auto-fix cycles before escalation.
- D-11: Fix implementation only, never tests. Tests are the spec contract.
- D-12: Integration tests, not unit tests. Test actual HTTP requests to Express endpoints with real Drizzle queries.
- D-13: Test database isolation via transaction rollback. No separate test database.
- D-14: Escalation includes hypothesis: (a) which test failed, (b) error message, (c) fixes attempted, (d) root cause hypothesis.

**Schema Migration Strategy**
- D-15: Append new table definitions to `shared/schema.ts`.
- D-16: SQL scripts via tsx. Idempotent DDL (CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS).
- D-17: Dependency-ordered migration execution. Forward-only.

### Claude's Discretion
- D-05: Auth level override per-endpoint when PageSpec specifies non-default authLevel
- Escalation format details beyond the required 4 fields (D-14)
- Whether to investigate Neon branching for test isolation vs. transaction rollback

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BACK-01 | System extracts actual API calls from integrated frontend components (contract extraction) | D-01: BackendSpec from deriveBackendSpec() is the contract. BackendEndpointSpec has method, path, requestBody, responseFields, authRequired. No TSX scanning needed. |
| BACK-02 | System adds Express routes for endpoints the new UI requires | D-06/D-08: Append to routes.ts before createServer(app) at line 2524. Pattern established by existing 40+ endpoints. |
| BACK-03 | System extends Drizzle schema for new data requirements | D-15: Append to shared/schema.ts. drizzleTableHints in BackendSpec drives table names. D-16: tsx migration script. |
| BACK-04 | System adds Zod validation for new endpoints | D-09: Inline Zod .parse()/.safeParse() inside route handlers. Follow existing insertAgentSchema pattern. |
| BACK-05 | Backend wiring is brownfield-aware (checks existing routes, migrations, middleware) | D-04: Brownfield backend audit scans routes.ts for path collisions and storage.ts for function name collisions before any write. |
| TEST-01 | System runs tests after each phase, parses failures, attempts fixes, re-runs until pass or escalates | D-10/D-11: 3-cycle fix loop. `npm run test` runs vitest. Parse exit code + stderr for failures. Fix implementation files, never test files. |
| TEST-02 | System writes integration tests per phase (not just unit tests) | D-12/D-13: HTTP-level tests using supertest + Express app. Transaction rollback isolation per test. Live Drizzle queries against DATABASE_URL. |
| TEST-03 | System requires passing test suite before deployment gate | D-10: Phase 5 never marks itself complete with failing tests. Full vitest run must be green. |
</phase_requirements>

---

## Standard Stack

### Core (all already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express | 4.21.2 | HTTP server framework | Already used — append only |
| Drizzle ORM | 0.39.1 | Type-safe DB queries | Already used — extend only |
| Zod | 3.25.76 | Schema validation | Already used inline in routes.ts |
| TanStack Query | 5.60.5 | Client server state | Already used in existing hooks |
| Vitest | 2.1.9 (pinned) | Test runner | Already used — 190 tests passing |
| postgres | 3.4.5 | Native PG driver | Used by db.ts — enables transaction rollback |

### New Dependencies Required
| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| supertest | ^7.x | HTTP assertion for Express | Integration tests fire real HTTP requests against Express app — no browser needed |
| @types/supertest | ^6.x | TypeScript types for supertest | TypeScript strict mode requires types |

**Installation:**
```bash
npm install --save-dev supertest @types/supertest
```

**Version verification:**
```bash
npm view supertest version        # verify current: 7.x
npm view @types/supertest version # verify current: 6.x
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| supertest | vitest's fetch mock | supertest fires real HTTP through Express middleware stack including Passport.js — mocks would miss auth integration failures |
| Transaction rollback | Neon branching | Neon branches are per-environment, not per-test — transaction rollback is simpler and already supported by postgres driver |
| Append to routes.ts | Separate router file | Would require wiring new router into server/index.ts — D-06 explicitly bans architectural changes |

---

## Architecture Patterns

### Recommended Project Structure

New Phase 5 modules:

```
lib/
├── backend-wirer/           # Phase 5 new modules
│   ├── types.ts             # BackendWiringResult, BackendBrownfieldInventory, etc.
│   ├── brownfield-backend-audit.ts  # Scan routes.ts + storage.ts for collisions
│   ├── route-generator.ts   # Generate Express route code from BackendEndpointSpec[]
│   ├── schema-generator.ts  # Generate Drizzle table + Zod insert schema from drizzleTableHints
│   ├── hook-injector.ts     # Inject useQuery/useMutation into Phase 4 page files
│   └── migration-runner.ts  # Write and execute idempotent DDL via tsx
├── test-runner/             # Phase 5 test infrastructure
│   ├── types.ts             # TestRunResult, FixAttempt, EscalationReport
│   ├── test-generator.ts    # Generate integration test files from BackendSpec
│   └── fix-loop.ts          # 3-cycle run → parse → fix → re-run loop
tests/
├── unit/                    # Existing — 190 tests, do not disturb
├── integration/             # New — Phase 5 creates this directory
│   ├── helpers/
│   │   └── test-db.ts       # Transaction isolation helper (beginTestTx, rollbackTestTx)
│   └── backend/
│       └── *.integration.test.ts  # Generated per BackendEndpointSpec
```

### Pattern 1: Express Route — Authenticated + Company-scoped

All generated routes follow the exact pattern used in the existing 40+ endpoints:

```typescript
// Source: server/routes.ts — existing endpoint pattern (e.g., lines 2511-2522)
app.get("/api/agents/:id/metrics", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  try {
    const userId = (req.user as any).id;
    // company ownership check via storage or direct DB query
    const data = await storage.getAgentMetrics(req.params.id, userId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
```

Generated routes use the same structure. `req.isAuthenticated()` is the auth gate. `(req.user as any).id` is how userId is accessed. Company ownership is checked via storage functions or direct `db.select().from(companiesTable).where(eq(...ownerUserId, userId))`.

### Pattern 2: Inline Zod Validation (D-09)

No separate middleware — validate inline per route:

```typescript
// Source: server/routes.ts — existing POST pattern
app.post("/api/widgets", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
  try {
    const parsed = insertWidgetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const widget = await storage.createWidget(parsed.data);
    res.status(201).json(widget);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
```

### Pattern 3: Drizzle Schema + Zod — Existing Style

```typescript
// Source: shared/schema.ts — existing table + inline Zod pattern
export const widgets = pgTable("widgets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  companyId: text("company_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWidgetSchema = z.object({
  name: z.string().min(1, "Name is required"),
  companyId: z.string().min(1),
});

export type Widget = typeof widgets.$inferSelect;
export type InsertWidget = z.infer<typeof insertWidgetSchema>;
```

Note: The existing pattern in `shared/schema.ts` uses handwritten `z.object()` for insert schemas (NOT `createInsertSchema(table)` from drizzle-zod), even though drizzle-zod is imported in `design-schema.ts`. Match the handwritten pattern.

### Pattern 4: Storage Function — CRUD Style

```typescript
// Source: server/storage.ts — existing CRUD function pattern
async createWidget(widget: InsertWidget): Promise<Widget> {
  const id = crypto.randomUUID();
  const [created] = await db
    .insert(widgetsTable)
    .values({ id, ...widget })
    .returning();
  return created;
}

async getWidgets(companyId: string): Promise<Widget[]> {
  return db
    .select()
    .from(widgetsTable)
    .where(eq(widgetsTable.companyId, companyId));
}
```

### Pattern 5: TanStack Query Hook Injection

Phase 4 components are static (no data fetching). Phase 5 injects hooks into existing page files. Pattern from existing pages:

```typescript
// Source: client/src/hooks/use-company.ts — existing useQuery pattern
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useWidgets() {
  return useQuery({
    queryKey: ["/api/widgets"],
    queryFn: () => apiRequest("/api/widgets"),
  });
}
```

Hook files live in `client/src/hooks/`. Page components import them. Injection into page files means: add import at top, replace static placeholder data with hook call result.

### Pattern 6: Integration Test With Transaction Isolation (D-13)

```typescript
// Source: Derived from postgres driver capabilities (verified: postgres 3.x supports sql.begin())
// tests/integration/helpers/test-db.ts
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const sql = postgres(process.env.DATABASE_URL as string);

export async function withTestTransaction<T>(
  fn: (db: ReturnType<typeof drizzle>) => Promise<T>
): Promise<T> {
  return sql.begin(async (txSql) => {
    const txDb = drizzle(txSql);
    const result = await fn(txDb);
    throw new Error("ROLLBACK_SENTINEL"); // forces rollback
  }).catch((err) => {
    if (err.message === "ROLLBACK_SENTINEL") return undefined as unknown as T;
    throw err;
  });
}
```

Alternative approach using explicit transaction and forced rollback — no test database needed, no seeds to clean up.

### Pattern 7: supertest Integration Test Structure

```typescript
// tests/integration/backend/widgets.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { registerRoutes } from "../../../server/routes.js";
import express from "express";

describe("GET /api/widgets", () => {
  let app: express.Express;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    // Note: integration tests mock Passport session for auth context
    // Set req.user directly via test middleware before routes register
    await registerRoutes(app);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/widgets");
    expect(res.status).toBe(401);
  });

  it("returns 200 with authenticated session", async () => {
    // inject test session middleware before registerRoutes
    const res = await request(app)
      .get("/api/widgets")
      .set("Cookie", "...test-session...");
    expect(res.status).toBe(200);
  });
});
```

**Auth mocking for integration tests:** The biggest integration testing complexity. Passport.js uses `req.isAuthenticated()`. For tests, inject middleware before routes that sets `req.user` and `req.isAuthenticated = () => true`. This is simpler than full session setup and sufficient for testing route logic.

### Anti-Patterns to Avoid

- **Scanning TSX for API calls:** D-01 locks PageSpec as source of truth. TSX scanning is fragile and unnecessary.
- **Refactoring routes.ts into separate files:** D-06 explicitly bans this. Append only.
- **Using `drizzle-kit push` for migrations:** Phase 1 established that `drizzle-kit push` is interactive. Use idempotent SQL via tsx scripts.
- **Writing tests that modify test files:** D-11 is absolute. The fix loop touches only implementation files.
- **createInsertSchema from drizzle-zod in shared/schema.ts:** The existing pattern is handwritten `z.object()`. `createInsertSchema` is used in `design-schema.ts` but NOT in `schema.ts`. Match the existing pattern per file.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP assertion in integration tests | Custom fetch wrapper | supertest | supertest handles Express app binding, keeps tests in-process, no port binding needed |
| Auth session simulation | Full Passport session bootstrap | Middleware injection that sets req.user + req.isAuthenticated | Full session needs session store, cookie parsing, connect-pg-simple — massive setup cost for tests |
| Endpoint deduplication | Custom diff logic | BackendSpec `source` field already marks explicit vs inferred | The spec layer already did this work |
| Zod schema from table | Custom reflection | Handwritten z.object() per existing schema.ts pattern | drizzle-zod's createInsertSchema is used in design-schema.ts but schema.ts uses handwritten Zod — must match file-level pattern |

**Key insight:** Every hard problem in this phase has either an existing codebase pattern to follow or a well-established npm library. The phase is about code generation and test execution, not novel infrastructure.

---

## Common Pitfalls

### Pitfall 1: Route Insertion Position (D-08)

**What goes wrong:** New routes appended after `const httpServer = createServer(app)` silently fail — the route is registered but unreachable since createServer already captured the app state.

**Why it happens:** `createServer(app)` at line 2524 ends the registration window. Anything after it is too late.

**How to avoid:** Brownfield audit captures the exact byte offset of `const httpServer = createServer(app)`. Code generator inserts before that position.

**Warning signs:** Routes exist in routes.ts but return 404 at runtime.

### Pitfall 2: Auth Mocking in Integration Tests

**What goes wrong:** Tests either fail 401 (session not injected) or fail because full Passport bootstrap requires DATABASE_URL, session store, bcrypt, etc.

**Why it happens:** `req.isAuthenticated()` is a Passport method added by `setupAuth(app)`. Without Passport middleware, it doesn't exist.

**How to avoid:** Call `setupAuth(app)` in test beforeAll (it tolerates missing env vars at init time) OR inject a pre-auth middleware before setupAuth that sets `req.isAuthenticated = () => true` and `req.user = { id: 'test-user-id' }`. The second approach avoids the session store dependency entirely.

**Warning signs:** Tests throw `TypeError: req.isAuthenticated is not a function`.

### Pitfall 3: postgres Driver Transaction Rollback

**What goes wrong:** `withTestTransaction` silently commits instead of rolling back if the sentinel error is caught somewhere unexpected.

**Why it happens:** postgres's `sql.begin()` only rolls back on unhandled promise rejection. If the sentinel is caught and swallowed, the transaction commits.

**How to avoid:** Use a unique error class (not a string message) as the sentinel. Catch only that class explicitly. Let all other errors propagate.

**Warning signs:** Test data persists in the database after tests complete.

### Pitfall 4: Hook Injection — Static Import Order

**What goes wrong:** Injecting a useQuery import into a page file that already has all imports grouped creates a TypeScript import-order error if the tool inserts in the wrong position.

**Why it happens:** Existing convention groups imports: 3rd-party → type-only → @/* aliases → relative.

**How to avoid:** Inject new `@tanstack/react-query` import within the third-party block (near the top). Inject custom hook imports within the `@/` alias block.

**Warning signs:** TypeScript compiler reports import-order issues (even without ESLint, strict mode may flag it if tsconfig has `module` settings that affect resolution).

### Pitfall 5: schema.ts — Handwritten Zod vs. drizzle-zod

**What goes wrong:** Generator uses `createInsertSchema(table)` from drizzle-zod because it saw this in `design-schema.ts`, but `schema.ts` uses handwritten `z.object()` exclusively.

**Why it happens:** Two files in `shared/` use different patterns. `design-schema.ts` uses drizzle-zod. `schema.ts` does not.

**How to avoid:** Phase 5 appends to `shared/schema.ts` — always use handwritten `z.object()`. Never call `createInsertSchema` in schema.ts.

**Warning signs:** Import errors for `createInsertSchema` if it wasn't already imported, or type mismatches if the generated Zod type doesn't perfectly match the table.

### Pitfall 6: drizzleTableHints Are Hints, Not Guarantees

**What goes wrong:** BackendSpec's `drizzleTableHints` lists table names like `["widgets", "widget_settings"]`, but the generator creates a single table for both — or creates tables that already exist.

**Why it happens:** `deriveBackendSpec()` infers table names from data models. They may overlap with existing tables in `schema.ts`.

**How to avoid:** Brownfield backend audit also scans `shared/schema.ts` for existing table names (pgTable calls). Cross-check drizzleTableHints against existing tables before generating CREATE TABLE DDL.

**Warning signs:** Migration script fails with `table already exists` (mitigated by IF NOT EXISTS, but semantic duplication is still a problem).

### Pitfall 7: vitest.config.ts already covers integration/ directory

**What goes wrong:** Developer adds a separate vitest config for integration tests, breaking the unified test run.

**Why it happens:** Assumption that integration tests need a different environment.

**How to avoid:** `vitest.config.ts` already includes `tests/integration/**/*.test.ts`. No config change needed. Both unit and integration tests run under the same `node` environment. DATABASE_URL must be set when running integration tests.

**Warning signs:** Running `npm run test` misses integration tests.

---

## Code Examples

### Brownfield Backend Audit — Scan Pattern

```typescript
// lib/backend-wirer/brownfield-backend-audit.ts
import { readFile } from "fs/promises";
import { join } from "path";

export interface BackendBrownfieldInventory {
  existingRoutePaths: string[];       // all "/api/..." paths already in routes.ts
  existingStorageFunctions: string[]; // all function names already in storage.ts
  existingTableNames: string[];       // all pgTable names in shared/schema.ts
  routesInsertionOffset: number;      // byte offset just before createServer(app)
  storageInsertionOffset: number;     // byte offset just before closing } of class
}

export async function auditBackendBrownfield(projectRoot: string): Promise<BackendBrownfieldInventory> {
  const routesContent = await readFile(join(projectRoot, "server/routes.ts"), "utf-8");
  const storageContent = await readFile(join(projectRoot, "server/storage.ts"), "utf-8");
  const schemaContent = await readFile(join(projectRoot, "shared/schema.ts"), "utf-8");

  // Extract existing route paths via regex
  const routePathRegex = /app\.(get|post|put|patch|delete)\("(\/api\/[^"]+)"/g;
  const existingRoutePaths: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = routePathRegex.exec(routesContent)) !== null) {
    existingRoutePaths.push(m[2]);
  }

  // Extract storage function names
  const funcRegex = /async (\w+)\s*\(/g;
  const existingStorageFunctions: string[] = [];
  while ((m = funcRegex.exec(storageContent)) !== null) {
    existingStorageFunctions.push(m[1]);
  }

  // Extract existing table names from pgTable calls
  const tableRegex = /pgTable\("([^"]+)"/g;
  const existingTableNames: string[] = [];
  while ((m = tableRegex.exec(schemaContent)) !== null) {
    existingTableNames.push(m[1]);
  }

  // Find insertion offset — just before `const httpServer = createServer(app)`
  const insertionMarker = "const httpServer = createServer(app)";
  const routesInsertionOffset = routesContent.indexOf(insertionMarker);

  return {
    existingRoutePaths,
    existingStorageFunctions,
    existingTableNames,
    routesInsertionOffset,
    storageInsertionOffset: storageContent.lastIndexOf("}"), // end of class
  };
}
```

### Fix Loop — 3 Cycle Structure

```typescript
// lib/test-runner/fix-loop.ts
import { execSync } from "child_process";

export interface FixLoopResult {
  passed: boolean;
  cycles: number;
  lastOutput: string;
  escalationReport?: EscalationReport;
}

export interface EscalationReport {
  failingTest: string;
  errorMessage: string;
  attemptsLog: string[];
  hypothesis: string;
}

const MAX_CYCLES = 3;

export async function runWithFixLoop(
  projectRoot: string,
  fixFn: (output: string, cycle: number) => Promise<boolean>
): Promise<FixLoopResult> {
  const attemptsLog: string[] = [];

  for (let cycle = 1; cycle <= MAX_CYCLES; cycle++) {
    let output = "";
    let passed = false;
    try {
      execSync("npm run test", { cwd: projectRoot, stdio: "pipe" });
      passed = true;
      return { passed: true, cycles: cycle, lastOutput: output };
    } catch (err: any) {
      output = err.stdout?.toString() + err.stderr?.toString();
      attemptsLog.push(`Cycle ${cycle}: ${parseFailingSummary(output)}`);

      if (cycle < MAX_CYCLES) {
        const fixed = await fixFn(output, cycle);
        if (!fixed) break; // fix fn gave up — escalate early
      }
    }
  }

  const lastOutput = attemptsLog[attemptsLog.length - 1] ?? "";
  return {
    passed: false,
    cycles: MAX_CYCLES,
    lastOutput,
    escalationReport: {
      failingTest: parseFailingTestName(lastOutput),
      errorMessage: parseErrorMessage(lastOutput),
      attemptsLog,
      hypothesis: "Unable to resolve — likely a schema mismatch or missing migration. Check if table exists in database.",
    },
  };
}
```

### Migration Script — Idempotent DDL Pattern

```typescript
// scripts/phase5-migration-[slug].ts — generated per run
// Source: scripts/setup-tables.ts — existing pattern
import { db, client } from "../server/db.js";
import { sql } from "drizzle-orm";

async function runMigration() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "widgets" (
        "id" text PRIMARY KEY,
        "name" text NOT NULL,
        "company_id" text NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );
    `);
    console.log("widgets table: ok");

    await db.execute(sql`
      ALTER TABLE "widgets" ADD COLUMN IF NOT EXISTS "description" text;
    `);
    console.log("widgets.description column: ok");
  } finally {
    await client.end();
  }
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Run via: `npx tsx scripts/phase5-migration-[slug].ts`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest + supertest for Express | Vitest + supertest (vitest@2 pinned) | Phase 1 established vitest@2 | vitest@2 lacks `test.projects` multi-env API — single node env config used |
| drizzle-kit push for schema changes | Direct SQL via tsx (idempotent DDL) | Phase 1 established | drizzle-kit push is interactive — not CI-safe |
| Separate test database | Transaction rollback isolation | D-13 decision | Avoids managing test env config, works with existing DATABASE_URL |
| Separate router files per domain | Append to monolithic routes.ts | D-06 decision | Matches existing architectural pattern, no new middleware registration |

**Deprecated/outdated:**
- Jest: Not used in this project. All tests use Vitest.
- drizzle-kit push: Interactive mode makes it unsuitable for automated migrations. Use tsx scripts.
- vitest@4: Requires Vite 6+. Project uses Vite 5.4.15. vitest@2 is pinned.

---

## Open Questions

1. **Auth mocking approach for integration tests**
   - What we know: Passport adds `req.isAuthenticated()`. Tests need authenticated requests. Full Passport bootstrap requires session store + DATABASE_URL.
   - What's unclear: Whether injecting pre-auth middleware before `setupAuth(app)` in tests correctly bypasses all Passport checks, or whether some routes do additional session validation.
   - Recommendation: Implement the pre-auth middleware approach. Test it against one existing endpoint (e.g., `GET /api/company`) in Wave 0 before generating all tests.

2. **Neon branching for test isolation (Claude's Discretion per D-13)**
   - What we know: Neon supports database branching. The project uses `@neondatabase/serverless` for design-schema operations but `postgres` (native driver) for the main db.
   - What's unclear: Whether transaction rollback via `sql.begin()` is reliable enough for this use case, or if test data pollution is a real risk.
   - Recommendation: Use transaction rollback (simpler, no extra config). If test pollution is detected during execution, escalate to Neon branching as Phase 5.1 work. Do not block Phase 5 on this.

3. **BackendSpec storage in pipelinePages**
   - What we know: Phase 2 stores SpecOutput (which contains `backendSpec`) in Neon via pipelinePages. Phase 5 needs to read this.
   - What's unclear: Exact query to retrieve the Phase 2 BackendSpec from pipelinePages for a given runId.
   - Recommendation: Query `pipeline_pages` where `phase = 'spec'` and `status = 'complete'` for the given runId. Parse `output` JSON field as `SpecOutput` and access `.backendSpec`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All modules | Yes | 20+ | — |
| npm | Package install | Yes | Current | — |
| vitest | Test runner | Yes | 2.1.9 | — |
| postgres driver | Transaction isolation | Yes | 3.4.5 | — |
| DATABASE_URL | Integration tests | Assumed (env var) | — | Tests skip gracefully if unset |
| supertest | Integration tests | Not yet installed | — | Must install (no fallback) |
| @types/supertest | TypeScript types | Not yet installed | — | Must install alongside supertest |
| tsx | Migration scripts | Yes (4.19.1) | — | — |

**Missing dependencies with no fallback:**
- `supertest` and `@types/supertest` — required for HTTP-level integration tests (D-12). Must be installed in Wave 0.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm run test -- tests/integration/backend --reporter=verbose` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BACK-01 | BackendSpec read correctly from pipelinePages and converted to wiring plan | unit | `npm run test -- tests/unit/backend-wirer/types.test.ts -x` | No — Wave 0 |
| BACK-02 | Generated route code compiles and responds correctly to HTTP requests | integration | `npm run test -- tests/integration/backend -x` | No — Wave 0 |
| BACK-03 | Generated Drizzle table definitions compile and migrations run idempotently | unit | `npm run test -- tests/unit/backend-wirer/schema-generator.test.ts -x` | No — Wave 0 |
| BACK-04 | Generated Zod inline validation correctly rejects malformed request bodies | integration | `npm run test -- tests/integration/backend -x` | No — Wave 0 |
| BACK-05 | Brownfield audit detects existing routes and prevents collision | unit | `npm run test -- tests/unit/backend-wirer/brownfield-backend-audit.test.ts -x` | No — Wave 0 |
| TEST-01 | Fix loop retries 3 times then escalates with structured report | unit | `npm run test -- tests/unit/test-runner/fix-loop.test.ts -x` | No — Wave 0 |
| TEST-02 | Integration tests fire actual HTTP against Express + live Drizzle | integration | `npm run test -- tests/integration -x` | No — Wave 0 |
| TEST-03 | Full suite green before phase marked complete | all | `npm run test` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- tests/unit/backend-wirer --reporter=verbose`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green (`npm run test` exits 0) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/integration/` directory — create with `helpers/test-db.ts` and `backend/` subdirectory
- [ ] `npm install --save-dev supertest @types/supertest` — required before any integration tests can run
- [ ] `tests/unit/backend-wirer/brownfield-backend-audit.test.ts` — covers BACK-05
- [ ] `tests/unit/backend-wirer/schema-generator.test.ts` — covers BACK-03
- [ ] `tests/unit/backend-wirer/route-generator.test.ts` — covers BACK-02 at unit level
- [ ] `tests/unit/test-runner/fix-loop.test.ts` — covers TEST-01
- [ ] `tests/integration/helpers/test-db.ts` — transaction rollback helper for all integration tests

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies to Phase 5 |
|-----------|-------------------|
| Real code only — never pseudocode, never placeholders | All generated route code, storage functions, and test files must be complete TypeScript |
| Secrets always in .env — never committed, never hardcoded | DATABASE_URL for integration tests reads from process.env, never hardcoded |
| Generated files always use YYYY-MM-DD in filename | Migration scripts: `scripts/phase5-migration-YYYY-MM-DD-[slug].ts` |
| TypeScript strict mode: strict: true | All new modules must compile under strict mode — no `any` except where existing codebase uses it (storage.ts uses `(req.user as any).id`) |
| Kebab-case for files | `brownfield-backend-audit.ts`, `route-generator.ts`, `hook-injector.ts`, `fix-loop.ts` |
| camelCase for function names | `auditBackendBrownfield()`, `generateRouteCode()`, `injectQueryHooks()` |
| No external formatter (no prettier) | Do not add prettier or ESLint in this phase |
| GSD workflow enforcement | All edits through GSD execute-phase, no direct repo edits |

---

## Sources

### Primary (HIGH confidence)
- `server/routes.ts` lines 1–2526 — direct inspection of insertion target, auth patterns, Zod patterns
- `server/storage.ts` lines 1–80 — direct inspection of CRUD pattern, IStorage interface
- `shared/schema.ts` — direct inspection of table definition + inline Zod pattern
- `shared/spec-schema.ts` — BackendSpec and BackendEndpointSpec shapes (verified)
- `vitest.config.ts` — confirmed integration test directory is already in `include` list
- `package.json` — confirmed vitest@2.1.9, no supertest present
- `tests/unit/` — confirmed 190 tests, all passing, test structure verified

### Secondary (MEDIUM confidence)
- `lib/spec-parser/derive-backend-spec.ts` — confirmed BackendSpec is the contract output from Phase 2
- `scripts/setup-tables.ts` — confirmed idempotent SQL via tsx migration pattern
- `shared/design-schema.ts` — confirmed pipelinePages table schema for Phase 2 output retrieval
- postgres 3.x documentation — `sql.begin()` for transaction management (standard API, HIGH confidence)

### Tertiary (LOW confidence)
- supertest version numbers (7.x, @types/supertest 6.x) — should be verified with `npm view supertest version` before installation
- Auth middleware injection approach for bypassing Passport in tests — viable pattern but needs empirical validation in Wave 0

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing dependencies verified from package.json directly
- Architecture patterns: HIGH — all patterns extracted from actual codebase files
- Pitfalls: HIGH for insertion position, Zod pattern, migration approach (derived from codebase); MEDIUM for auth mocking in tests (needs Wave 0 validation)
- Integration test isolation: MEDIUM — transaction rollback approach is standard postgres driver behavior, confirmed viable

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (30 days — stable stack)
