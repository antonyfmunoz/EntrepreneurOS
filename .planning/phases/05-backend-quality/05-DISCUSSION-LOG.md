# Phase 5: Backend + Quality - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 05-backend-quality
**Areas discussed:** Contract extraction strategy, Monolith wiring approach, Test-fix loop behavior, Schema migration strategy

---

## Contract Extraction Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| PageSpec-driven | Use deriveBackendSpec() from Phase 2 as source of truth. No TSX scanning. | ✓ |
| TSX scan + PageSpec hybrid | Scan TSX files AND cross-reference with PageSpec | |
| TSX scan only | Scan integrated components for fetch/query patterns | |

**User's choice:** PageSpec-driven (Recommended)
**Notes:** Phase 4 components are static (no data fetching), so TSX scanning would find nothing useful.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-inject useQuery hooks | Generate TanStack Query hooks and inject into page components | ✓ |
| Separate data layer files | Create dedicated hook files pages import | |
| Claude's discretion | Decide per-page based on complexity | |

**User's choice:** Auto-inject useQuery hooks (Recommended)
**Notes:** Matches existing codebase pattern.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Strict validation | Cross-check PageSpec data fields against generated endpoints, flag gaps | ✓ |
| Best-effort with warnings | Wire what it can, warn about gaps | |
| No validation | Trust the pipeline | |

**User's choice:** Yes, strict validation (Recommended)
**Notes:** Prevents broken pages at runtime.

---

**Additional context from user Q&A:**
- User asked "anything I'm missing?" — Claude flagged: (1) backend endpoint collision detection needed (routes.ts has 40+ existing endpoints), (2) auth context propagation (all endpoints should default to authenticated + company scope per Phase 4 D-07).

---

## Monolith Wiring Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Append to routes.ts | Add to existing monolithic file, no architectural change | ✓ |
| Separate generated-routes.ts | New file for generated routes, imported by routes.ts | |
| Domain-split route modules | Split into server/routes/reports.ts etc. | |

**User's choice:** Append to routes.ts (Recommended)
**Notes:** Phase 5 isn't about refactoring.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Append to storage.ts | Keep all CRUD in one place | ✓ |
| Separate generated-storage.ts | New CRUD in separate file | |
| Claude's discretion | Split if too large | |

**User's choice:** Append to storage.ts (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, backend brownfield scan | Scan routes.ts and storage.ts for duplicates before generating | ✓ |
| No, trust the pipeline | Just add endpoints if spec says they're needed | |

**User's choice:** Yes, backend brownfield scan (Recommended)

---

**Additional context from user Q&A:**
- User asked "anything I'm missing?" — Claude flagged: insertion position matters (Express routes are order-sensitive, insert before catch-all), and follow existing inline Zod validation pattern.

---

## Test-Fix Loop Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| 3 cycles | Matches existing retry patterns (Stitch, action executor) | ✓ |
| 5 cycles | More aggressive, burns more tokens | |
| 1 cycle | Conservative, may escalate prematurely | |

**User's choice:** 3 cycles (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Implementation only | Fix code, never tests. TDD principle — tests are source of truth. | ✓ |
| Both, with constraints | Allow test adjustments for clearly incorrect assertions | |
| Implementation + generated tests | Allow regenerating tests | |

**User's choice:** Implementation only (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Integration tests | Test HTTP requests to Express endpoints with real Drizzle queries | ✓ |
| Integration + unit tests | Both integration and unit tests | |
| Claude's discretion | Per-endpoint decision | |

**User's choice:** Integration tests (Recommended)

---

**Additional context from user Q&A:**
- User asked "anything I'm missing?" — Claude flagged: (1) test database isolation via transaction rollback (wrap each test, roll back after), (2) escalation format should include hypothesis about root cause, not just "test failed."

---

## Schema Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Append to shared/schema.ts | Single source of truth, 521 lines manageable | ✓ |
| Split into domain files | More organized but breaks imports | |
| Claude's discretion | Append until threshold, then split | |

**User's choice:** "What do you think is best" → Claude recommended append to shared/schema.ts. Reasoning: 521 lines is small, splitting would break all existing @shared/schema imports, co-location is the established pattern.

---

| Option | Description | Selected |
|--------|-------------|----------|
| SQL scripts via tsx | Same as Phase 1 pattern. Idempotent, non-interactive, Neon-proven. | ✓ |
| Drizzle-kit generate + push | Standard Drizzle workflow but push is interactive | |
| Claude's discretion | Simplest approach per-migration | |

**User's choice:** "What will be best?" → Claude recommended SQL scripts via tsx. Reasoning: Phase 1 proved it works, drizzle-kit push is interactive (kills automation), idempotent DDL is safe to re-run.

---

**Additional context from user Q&A:**
- User asked "anything I'm missing?" — Claude flagged: dependency-ordered migration execution for tables with foreign key references. Forward-only migrations, no rollback in v1.

---

## Claude's Discretion

- Auth level override per-endpoint when PageSpec specifies non-default authLevel
- Escalation format details beyond the required 4 fields
- Whether to investigate Neon branching for test isolation vs. transaction rollback

## Deferred Ideas

None — discussion stayed within phase scope.
