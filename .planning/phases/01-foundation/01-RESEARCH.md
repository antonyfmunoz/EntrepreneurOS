# Phase 1: Foundation - Research

**Researched:** 2026-03-27
**Domain:** Drizzle schema extensions, Zod pipeline state contracts, @google/stitch-sdk wrapper, Vitest dual-environment setup, Claude Code skill structure
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Design Memory Schema**
- D-01: Design tokens stored as structured columns (color_palette, type_scale, spacing, border_radius, etc.) — not JSONB. Enables machine-comparable drift detection for Phase 3 confidence scoring.
- D-02: Component patterns store metadata only (name, variant info, props shape, usage context). Actual component code stays in the repo.
- D-03: Design memory is scoped per-project with version history. Each token update creates a new version so design evolution is auditable and rollback-friendly.
- D-04: All design memory tables use `dm_` prefix (dm_projects, dm_pages, dm_tokens, dm_patterns) to avoid collision with app tables.
- D-05: Multi-project isolation via `project_id` column on all design memory tables. EntrepreneurOS tokens must not bleed into other projects.

**Pipeline State Contract**
- D-06: Pipeline state lives in Neon PostgreSQL only — no JSON file in repo. Matches ORCH-02 requirement.
- D-07: Checkpoints are per-page within phase. Pausing after page 7 of 12 resumes at page 8, not page 1.
- D-08: State schemas are modular and composable — each phase defines its own input/output Zod shape. Pipeline state is a union/intersection of phase schemas.
- D-09: User interrupts happen at checkpoints only (after each page completes its current phase step). No anytime injection.
- D-10: Page entries in pipeline state include an `error` field for failed operations — enables auto-retry with context and clear issue surfacing.
- D-11: Pipeline state tables scoped by `project_id` for multi-project isolation (same as design memory).

**Stitch SDK Wrapper**
- D-12: Thin typed wrapper — handles auth, typed request/response, error mapping only. No design token injection or prompt construction (that's Phase 3's concern).
- D-13: Automatic retry with exponential backoff (3 attempts) for transient errors. Uses p-retry (already in deps). Permanent errors surface immediately.
- D-14: Wrapper lives in standalone `lib/stitch/` directory — not in server/integrations/. Emphasizes reusability across repos.
- D-15: Research Stitch API docs BEFORE writing wrapper code. API contract must come from official documentation, not assumptions.

**Skill Organization**
- D-16: Architecture: one orchestrator skill + phase-specific sub-skills. Orchestrator routes to the right skill at the right pipeline stage.
- D-17: Skills live in this repo's `.claude/skills/` directory. Portable to other repos by copying the directory.
- D-18: All skills namespaced as `saas-dev:*` (e.g., saas-dev:orchestrator, saas-dev:detect-framework).
- D-19: Phase 1 creates orchestrator skeleton + detect-framework skill only. Phase-specific skills created in their own phases.

**Vitest Setup**
- D-20: Configure Vitest for both server (Node) and client (jsdom) environments from the start. Phase 1 smoke tests are server-side, but config is ready for React component tests in Phase 4+.

**Database Migration Strategy**
- D-21: Design memory tables use the same Drizzle config and migration pipeline as app tables. One `db:push` handles everything.
- D-22: Schema definitions in a separate file (`shared/design-schema.ts`) but referenced from the same `drizzle.config.ts`. Clean code separation, single migration pipeline.

### Claude's Discretion
- Schema file location: separate file vs same file (leaning separate for portability)
- Phase 1 smoke test targets: schema validation, framework detection, or both
- Exact Zod field names and types for pipeline state schemas
- Stitch wrapper internal implementation patterns

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ORCH-01 | System orchestrates existing Claude Code skills at correct lifecycle phase | Claude Code skill format (SKILL.md frontmatter + body), saas-dev:orchestrator skeleton pattern |
| ORCH-02 | Pipeline state persisted in Neon PostgreSQL (not conversation context) | Drizzle table pattern for pipeline_runs + pipeline_pages; same db.ts/drizzle.config.ts pipeline already proven |
| ORCH-03 | System supports pause/resume/interrupt — resumes from last checkpoint | Per-page checkpoint columns (phase, status, error); query pattern to find last completed page |
| ORCH-04 | System is reusable across SaaS repos (no hardcoded paths, accepts project config) | Project config Zod schema with repo_path, framework, project_id fields |
| ORCH-05 | System is built as Claude Code skills using skill-creator | SKILL.md structure confirmed; .claude/skills/ directory convention |
| INTG-06 | System detects React + Vite + Tailwind + shadcn/ui framework via package.json | package.json parsing pattern; detect-framework skill reads dependencies and devDependencies keys |
</phase_requirements>

---

## Summary

Phase 1 is a pure infrastructure phase — no user-facing features, no UI changes. It creates five independent but sequentially deliverable artifacts: (1) Neon design memory tables, (2) Neon pipeline state tables, (3) the Stitch SDK wrapper, (4) Vitest harness, and (5) the detect-framework skill. Every downstream phase depends on at least one of these.

The existing codebase provides every building block needed. `shared/schema.ts` + `server/db.ts` + `drizzle.config.ts` give a proven migration pipeline to extend. The AI service wrappers in `server/ai/` give the thin-wrapper pattern to clone for Stitch. `p-retry` is already in `package.json` at `^7.1.1` — no new retry infrastructure needed. The only net-new package installs are `vitest`, `@vitest/ui` (optional), `@testing-library/react`, `jsdom`, and `@google/stitch-sdk`.

The critical research finding is that `@google/stitch-sdk` v0.0.3 was published 2026-03-12 — it is very new and only at a pre-release version. The `StitchError.recoverable` boolean maps cleanly to p-retry's `shouldRetry` pattern. The wrapper must expose typed inputs/outputs from day one so Phase 3 can call it without touching internals.

**Primary recommendation:** Build the five artifacts in strict dependency order — schema first (tables must exist before state can be written), then Stitch wrapper (validates live API access before Phase 3 depends on it), then Vitest config (smoke tests confirm everything else works), then skills skeleton last (no external dependencies).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.39.1 (already installed) | ORM for design memory + pipeline state tables | Already in use throughout codebase — no new pattern |
| drizzle-kit | 0.30.4 (already installed) | `db:push` migration pipeline | Same migration command extends to new schema file |
| drizzle-zod | 0.7.1 (already installed) | Auto-generate insert/select Zod schemas from tables | Used in shared/schema.ts — same pattern for design-schema.ts |
| zod | 3.25.76 (already installed) | Pipeline state contracts, phase I/O validation | Used extensively across all routes and schemas |
| @google/stitch-sdk | 0.0.3 (NEW — install required) | Stitch API client for UI generation | Official Google SDK; only supported API access path |
| p-retry | 7.1.1 (already installed) | Retry with exponential backoff for Stitch wrapper | Already in deps; maps to StitchError.recoverable flag |
| vitest | 4.1.2 (NEW — install required) | Test runner for both Node and jsdom environments | Vite-native; no separate babel config; supports dual environments via projects |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitest/ui | latest | Vitest browser UI for test visualization | Optional dev tool; install alongside vitest |
| jsdom | latest (via vitest) | DOM simulation for React component tests | Required for jsdom environment in vitest projects config |
| @testing-library/react | latest | React component test utilities | Phase 4+ React component tests; install now per D-20 |
| @types/node | 20.16.11 (already installed) | Node.js type definitions for server-side test files | Already present |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vitest | jest | Jest requires babel transform for ESM; this project uses `"type": "module"` — Vitest is the correct choice |
| drizzle columns for tokens | JSONB | JSONB chosen against (D-01) — structured columns are required for Phase 3 drift detection math |
| p-retry | custom retry loop | p-retry already in deps, handles jitter and max retries cleanly |

**Installation (new packages only):**
```bash
npm install @google/stitch-sdk
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

**Version verification (confirmed against npm registry 2026-03-27):**
- vitest: 4.1.2
- @google/stitch-sdk: 0.0.3 (published 2026-03-12 — pre-release, pin exactly)

---

## Architecture Patterns

### Recommended Project Structure (Phase 1 additions)
```
shared/
├── schema.ts              # Existing app tables — DO NOT MODIFY structure
└── design-schema.ts       # NEW: dm_* tables + pipeline state tables (D-22)

lib/
└── stitch/
    ├── client.ts          # NEW: thin wrapper (D-14)
    └── types.ts           # NEW: typed request/response interfaces

.claude/
└── skills/
    └── saas-dev/
        ├── orchestrator/
        │   └── SKILL.md   # NEW: orchestrator skeleton (D-19)
        └── detect-framework/
            └── SKILL.md   # NEW: detect-framework skill (D-19)

tests/
├── unit/
│   ├── design-schema.test.ts    # Phase 1 smoke test
│   └── detect-framework.test.ts # Phase 1 smoke test
└── vitest.config.ts       # OR root-level vitest.config.ts
```

### Pattern 1: Drizzle Schema Extension (Design Memory)
**What:** Add `shared/design-schema.ts` following exact pattern of `shared/schema.ts`. Update `drizzle.config.ts` to reference both files via array.
**When to use:** Whenever adding tables that must not collide with app tables.

```typescript
// shared/design-schema.ts
// Source: existing shared/schema.ts pattern + D-01 through D-05

import { pgTable, text, serial, integer, timestamp, varchar, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const dmProjects = pgTable("dm_projects", {
  id: serial("id").primaryKey(),
  projectId: text("project_id").notNull().unique(),   // external key — repo path hash or user-defined
  name: text("name").notNull(),
  repoPath: text("repo_path").notNull(),
  framework: text("framework").notNull(),             // "react-vite-tailwind-shadcn" for v1
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const dmTokens = pgTable("dm_tokens", {
  id: serial("id").primaryKey(),
  projectId: text("project_id").notNull(),            // FK to dm_projects.project_id
  version: integer("version").notNull().default(1),   // incremented on each update (D-03)
  colorPrimary: varchar("color_primary", { length: 9 }),   // hex, e.g. #1a1a2e
  colorSecondary: varchar("color_secondary", { length: 9 }),
  colorBackground: varchar("color_background", { length: 9 }),
  colorSurface: varchar("color_surface", { length: 9 }),
  colorText: varchar("color_text", { length: 9 }),
  colorAccent: varchar("color_accent", { length: 9 }),
  typeFontFamily: text("type_font_family"),           // "Inter, sans-serif"
  typeSizeBase: numeric("type_size_base"),            // numeric for drift math (D-01)
  typeScaleRatio: numeric("type_scale_ratio"),
  spacingUnit: numeric("spacing_unit"),               // base spacing unit in px
  borderRadius: numeric("border_radius"),             // base radius in px
  shadowStyle: text("shadow_style"),                  // "none" | "soft" | "sharp"
  createdAt: timestamp("created_at").defaultNow(),
});

export const dmPages = pgTable("dm_pages", {
  id: serial("id").primaryKey(),
  projectId: text("project_id").notNull(),
  pageName: text("page_name").notNull(),
  pageSlug: text("page_slug").notNull(),
  purpose: text("purpose"),
  approvedAt: timestamp("approved_at"),
  tokenVersionRef: integer("token_version_ref"),       // which token version was active at approval
  screenshotUrl: text("screenshot_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const dmPatterns = pgTable("dm_patterns", {
  id: serial("id").primaryKey(),
  projectId: text("project_id").notNull(),
  name: text("name").notNull(),                       // e.g. "PrimaryButton"
  variant: text("variant"),                           // e.g. "destructive"
  propsShape: text("props_shape"),                    // JSON string describing prop types (D-02)
  usageContext: text("usage_context"),
  shadcnComponent: text("shadcn_component"),          // maps to shadcn component name
  pageSlugRef: text("page_slug_ref"),                 // first page where pattern appeared
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDmProjectSchema = createInsertSchema(dmProjects);
export const insertDmTokenSchema = createInsertSchema(dmTokens);
export const insertDmPageSchema = createInsertSchema(dmPages);
export const insertDmPatternSchema = createInsertSchema(dmPatterns);
```

### Pattern 2: Pipeline State Tables
**What:** Neon-persisted pipeline state (D-06). Two tables: `pipeline_runs` (one per project-phase invocation) and `pipeline_pages` (one per page per run, checkpoint granularity per D-07).

```typescript
// In shared/design-schema.ts (continued)

export const pipelineRuns = pgTable("pipeline_runs", {
  id: serial("id").primaryKey(),
  projectId: text("project_id").notNull(),           // D-11 multi-project isolation
  phase: text("phase").notNull(),                    // "spec" | "ui-gen" | "integration" | "backend" | "deploy"
  status: text("status").notNull().default("running"), // "running" | "paused" | "complete" | "failed"
  config: text("config").notNull(),                  // JSON: ProjectConfig Zod schema value
  startedAt: timestamp("started_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const pipelinePages = pgTable("pipeline_pages", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull(),                // FK to pipeline_runs.id
  projectId: text("project_id").notNull(),           // D-11 denormalized for query convenience
  pageName: text("page_name").notNull(),
  pageIndex: integer("page_index").notNull(),        // 0-based order in spec
  phase: text("phase").notNull(),                    // current phase this row tracks
  status: text("status").notNull().default("pending"), // "pending" | "in_progress" | "complete" | "failed"
  error: text("error"),                              // D-10: serialized error for retry context
  output: text("output"),                            // JSON: phase output data for this page
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});
```

### Pattern 3: Drizzle Config Multi-Schema Reference
**What:** Update `drizzle.config.ts` to accept an array of schema files (D-21/D-22).

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: ["./shared/schema.ts", "./shared/design-schema.ts"],  // array — both files
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Verified:** Drizzle Kit 0.30.4 supports array of schema file paths in the `schema` field. (MEDIUM confidence — based on Drizzle docs convention; existing single-file config works today.)

### Pattern 4: Stitch SDK Wrapper
**What:** Thin wrapper in `lib/stitch/client.ts` that exposes `generate()` with typed inputs/outputs. Follows the same interface pattern as `server/ai/index.ts` — single exported async function, no class required.

```typescript
// lib/stitch/types.ts
export interface StitchGenerateRequest {
  prompt: string;
  deviceType?: "DESKTOP" | "MOBILE" | "TABLET" | "AGNOSTIC";
}

export interface StitchGenerateResult {
  htmlUrl: string;       // presigned URL returned by screen.getHtml()
  screenshotUrl: string; // presigned URL returned by screen.getImage()
  projectId: string;
  screenId: string;
}

export class StitchWrapperError extends Error {
  constructor(
    message: string,
    public readonly recoverable: boolean,
    public readonly code: string
  ) {
    super(message);
    this.name = "StitchWrapperError";
  }
}
```

```typescript
// lib/stitch/client.ts
// Source: @google/stitch-sdk 0.0.3 API + p-retry 7.1.1 (both already researched)
import { Stitch, StitchError } from "@google/stitch-sdk";
import pRetry, { AbortError } from "p-retry";
import type { StitchGenerateRequest, StitchGenerateResult } from "./types.js";

function getStitchClient(): Stitch {
  const apiKey = process.env.STITCH_API_KEY;
  if (!apiKey) {
    throw new Error("STITCH_API_KEY environment variable is not set");
  }
  return new Stitch({ apiKey });
}

export async function generateScreen(
  projectId: string,
  request: StitchGenerateRequest
): Promise<StitchGenerateResult> {
  return pRetry(
    async () => {
      try {
        const client = getStitchClient();
        const project = client.project(projectId);
        const screen = await project.generate(request.prompt, request.deviceType);
        const [htmlUrl, screenshotUrl] = await Promise.all([
          screen.getHtml(),
          screen.getImage(),
        ]);
        return {
          htmlUrl,
          screenshotUrl,
          projectId: screen.projectId,
          screenId: screen.screenId,
        };
      } catch (err) {
        if (err instanceof StitchError) {
          if (!err.recoverable) {
            // Non-recoverable: AUTH_FAILED, NOT_FOUND, PERMISSION_DENIED, VALIDATION_ERROR
            throw new AbortError(err.message);
          }
          // Recoverable: RATE_LIMITED, NETWORK_ERROR — let p-retry handle
          throw err;
        }
        throw err;
      }
    },
    {
      retries: 2,        // 3 total attempts (D-13)
      minTimeout: 1000,
      factor: 2,
      onFailedAttempt: (error) => {
        console.error(`Stitch attempt ${error.attemptNumber} failed: ${error.message}`);
      },
    }
  );
}

export async function createStitchProject(title: string): Promise<string> {
  const client = getStitchClient();
  const project = await client.createProject(title);
  return project.projectId;
}
```

### Pattern 5: Vitest Dual-Environment Config
**What:** Separate `vitest.config.ts` at project root using the `projects` array to define Node (server tests) and jsdom (React component tests) environments independently. Takes priority over vite.config.ts per Vitest docs.

**Critical:** Vitest 4.1.2 requires Vite >=6.0.0 as a peer dependency, but this project uses Vite 5.4.15. Use Vitest 2.x instead, which supports Vite 5.

**Correct install for this project:**
```bash
npm install -D vitest@2 @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

Vitest 2.x is the last line compatible with Vite 5.x. Verify: `npm view vitest@2 version` → 2.2.x.

```typescript
// vitest.config.ts (root level)
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "server",
          environment: "node",
          include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
          setupFiles: [],
        },
        resolve: {
          alias: {
            "@shared": path.resolve(__dirname, "shared"),
          },
        },
      },
      {
        test: {
          name: "client",
          environment: "jsdom",
          include: ["client/src/**/*.test.tsx", "client/src/**/*.test.ts"],
          setupFiles: ["./tests/setup-dom.ts"],
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "client/src"),
            "@shared": path.resolve(__dirname, "shared"),
          },
        },
      },
    ],
  },
});
```

```typescript
// tests/setup-dom.ts
import "@testing-library/jest-dom";
```

### Pattern 6: Claude Code Skill Structure (SKILL.md)
**What:** Each skill is a directory inside `.claude/skills/` containing a `SKILL.md` with YAML frontmatter + markdown body.

```
.claude/skills/
└── saas-dev/
    ├── orchestrator/
    │   └── SKILL.md
    └── detect-framework/
        ├── SKILL.md
        └── scripts/
            └── detect-framework.ts  (optional — skill can instruct Claude directly)
```

```markdown
<!-- .claude/skills/saas-dev/detect-framework/SKILL.md -->
---
name: saas-dev:detect-framework
description: Detects the frontend framework stack of a SaaS project by reading its package.json. Use when the saas-dev pipeline needs to identify whether a project uses React+Vite+Tailwind+shadcn/ui or another supported framework configuration before integration or code generation steps.
---

# detect-framework

Reads `package.json` from the project root and identifies the framework stack.

## Output

Returns a structured detection result:
- `framework`: "react-vite-tailwind-shadcn" | "unknown"
- `detected`: object with boolean flags per technology
- `confidence`: "HIGH" | "MEDIUM" | "LOW"

## Steps

1. Read `{project_root}/package.json`
2. Check `dependencies` and `devDependencies` for presence of:
   - React: `react` key exists
   - Vite: `vite` key in devDependencies
   - Tailwind: `tailwindcss` key in devDependencies
   - shadcn/ui: presence of `@radix-ui/react-*` packages (3+ packages = HIGH confidence)
3. Return structured result
```

### Pattern 7: Zod Pipeline State Schemas (D-08)
**What:** Each phase owns its I/O Zod schema. The pipeline runner composes them at runtime.

```typescript
// shared/pipeline-schemas.ts (or inline in design-schema.ts)

import { z } from "zod";

// Reusable sub-schemas
export const PageStateSchema = z.object({
  pageName: z.string(),
  pageIndex: z.number().int().min(0),
  status: z.enum(["pending", "in_progress", "complete", "failed"]),
  error: z.string().nullable().default(null),         // D-10
  output: z.unknown().nullable().default(null),       // phase-specific output blob
});

export const ProjectConfigSchema = z.object({
  projectId: z.string().min(1),                       // D-04/D-11 scoping key
  repoPath: z.string().min(1),                        // absolute path to target repo
  framework: z.enum(["react-vite-tailwind-shadcn"]),  // extensible via union later
  stitchProjectId: z.string().optional(),             // populated after Phase 3 first run
});

// Phase output shapes (each phase defines its own)
export const SpecPhaseOutputSchema = z.object({
  pages: z.array(z.object({
    name: z.string(),
    purpose: z.string(),
    components: z.array(z.string()),
    dataRequirements: z.array(z.string()),
  })),
});

export const UiGenPhaseOutputSchema = z.object({
  htmlUrl: z.string().url(),
  screenshotUrl: z.string().url(),
  tokenVersion: z.number().int(),
  approved: z.boolean(),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type PageState = z.infer<typeof PageStateSchema>;
```

### Anti-Patterns to Avoid
- **Putting pipeline state in a JSON file in the repo:** Explicitly rejected in D-06. File-based state breaks multi-device usage and is not auditable.
- **Using JSONB for design tokens:** Rejected in D-01. JSONB cannot support column-level numeric comparisons needed for Phase 3 drift detection.
- **Adding Vitest to vite.config.ts `test` property:** Works but creates coupling. Separate `vitest.config.ts` is cleaner and takes priority — use that.
- **Importing @google/stitch-sdk singleton `stitch` in wrapper:** Use `new Stitch({ apiKey })` explicitly so the wrapper is testable without env vars being set at module load time.
- **Installing vitest@latest (4.x) with Vite 5:** Vitest 4.x requires Vite >=6. This project uses Vite 5.4.15. Install vitest@2 instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retry with backoff | Custom setTimeout loop | p-retry (already in deps) | Handles jitter, AbortError for non-recoverable, onFailedAttempt hook |
| Schema validation for DB inserts | Manual type guards | drizzle-zod createInsertSchema | Auto-syncs with table definition changes; same pattern used in shared/schema.ts |
| Test environment switching | babel/jest config | Vitest projects array | Native to Vite ecosystem; zero babel config required for ESM |
| Stitch API auth | Manual fetch() to stitch.googleapis.com | @google/stitch-sdk | Official SDK handles MCP transport, auth headers, tool protocol |
| Token drift comparison | String comparison | Numeric columns in Drizzle | SQL numeric comparisons (ABS(a - b) / b > 0.15) are the whole point of D-01 |

**Key insight:** The existing repo's patterns — thin wrappers, Drizzle + Zod, named exports — are the right patterns. Phase 1 extends, not reinvents.

---

## Common Pitfalls

### Pitfall 1: Vitest Version vs Vite Version Mismatch
**What goes wrong:** Installing `vitest@latest` (4.x) into a Vite 5 project causes peer dependency errors and potential silent test failures. npm may install it without error but tests will not run correctly.
**Why it happens:** Vitest 4.x dropped Vite 5 support; Vitest 3.x was the last to support both Vite 5 and 6. Vitest 2.x is confirmed stable with Vite 5.
**How to avoid:** Install `vitest@2` explicitly. Do not rely on npm's auto-resolution.
**Warning signs:** Peer dependency warning during install; "Cannot find module 'vite'" during test run.

### Pitfall 2: Stitch SDK is Pre-Release (v0.0.3)
**What goes wrong:** The SDK was published 2026-03-12 (15 days before this research). API surface may change between patch versions without semver guarantees.
**Why it happens:** Pre-1.0 packages are exempt from semver stability commitments.
**How to avoid:** Pin the exact version in package.json (`"@google/stitch-sdk": "0.0.3"` not `"^0.0.3"`). The wrapper's typed interface acts as a shim — if the SDK changes, only the wrapper changes, not callers.
**Warning signs:** npm outdated shows a newer patch; getHtml()/getImage() return shape changes.

### Pitfall 3: `drizzle.config.ts` Single Schema String
**What goes wrong:** Drizzle Kit `db:push` only migrates tables in the file listed in `schema:`. If `design-schema.ts` is not added to the array, the dm_* and pipeline tables are silently skipped.
**Why it happens:** Default Drizzle config uses a string, not an array. Adding a second schema file requires converting to an array.
**How to avoid:** Change `schema: "./shared/schema.ts"` to `schema: ["./shared/schema.ts", "./shared/design-schema.ts"]` before running `db:push`.
**Warning signs:** `db:push` completes with no new tables; querying `dm_projects` throws "relation does not exist".

### Pitfall 4: Stitch `getHtml()` Returns a URL, Not HTML
**What goes wrong:** Code that calls `await screen.getHtml()` and expects raw HTML string receives a presigned download URL instead. Feeding this URL directly to a file write produces a URL string in the file, not HTML.
**Why it happens:** SDK naming is misleading. Both `getHtml()` and `getImage()` return presigned URLs to download the artifact.
**How to avoid:** The wrapper's `StitchGenerateResult` type names these fields `htmlUrl` and `screenshotUrl` explicitly. To get actual HTML, make a second `fetch(htmlUrl)` call and read the response body.
**Warning signs:** Generated "HTML" files contain a URL string starting with `https://`.

### Pitfall 5: Skill Naming Conflicts
**What goes wrong:** Skill name `saas-dev:orchestrator` collides with another skill if the `.claude/skills/` directory is shared across repos.
**Why it happens:** Skills are portable by design (D-17) but namespace is a flat string — no automatic scoping.
**How to avoid:** The `saas-dev:` prefix (D-18) provides sufficient namespacing. Document that all skills in this system use this prefix consistently.
**Warning signs:** Claude triggers the wrong skill for a command.

### Pitfall 6: ESM Imports in Test Files
**What goes wrong:** Test files that use `import` from packages with `"type": "module"` in package.json may fail with "Cannot use import statement" if Vitest is not configured with the correct `environment` and module resolution.
**Why it happens:** The project uses `"type": "module"` (confirmed in package.json). CommonJS `require()` will not work.
**How to avoid:** All test files must use ESM `import` syntax. Vitest handles ESM natively — no `.babelrc` needed. The `vitest.config.ts` must not override `transformMode` away from ESM.
**Warning signs:** Test files throw SyntaxError on `import` keyword.

---

## Code Examples

### Smoke Test: Schema Validation
```typescript
// tests/unit/design-schema.test.ts
// Source: existing shared/schema.ts insertUserSchema pattern

import { describe, it, expect } from "vitest";
import { insertDmProjectSchema, insertDmTokenSchema } from "@shared/design-schema";

describe("design memory schema validation", () => {
  it("accepts a valid dm_projects insert", () => {
    const result = insertDmProjectSchema.safeParse({
      projectId: "test-project-01",
      name: "Test Project",
      repoPath: "/opt/projects/test",
      framework: "react-vite-tailwind-shadcn",
    });
    expect(result.success).toBe(true);
  });

  it("rejects dm_tokens insert with missing projectId", () => {
    const result = insertDmTokenSchema.safeParse({
      version: 1,
      colorPrimary: "#1a1a2e",
    });
    expect(result.success).toBe(false);
  });
});
```

### Smoke Test: Framework Detection
```typescript
// tests/unit/detect-framework.test.ts

import { describe, it, expect } from "vitest";
import { detectFramework } from "../../lib/detect-framework.js";

describe("detectFramework", () => {
  it("identifies react-vite-tailwind-shadcn from package.json content", () => {
    const pkg = {
      dependencies: {
        react: "^18.3.1",
        "@radix-ui/react-dialog": "^1.1.2",
        "@radix-ui/react-dropdown-menu": "^2.1.2",
        "@radix-ui/react-select": "^2.1.2",
      },
      devDependencies: {
        vite: "^5.4.15",
        tailwindcss: "^3.4.14",
      },
    };
    const result = detectFramework(pkg);
    expect(result.framework).toBe("react-vite-tailwind-shadcn");
    expect(result.confidence).toBe("HIGH");
  });
});
```

### Framework Detection Implementation
```typescript
// lib/detect-framework.ts

interface FrameworkDetectionResult {
  framework: "react-vite-tailwind-shadcn" | "unknown";
  detected: {
    react: boolean;
    vite: boolean;
    tailwind: boolean;
    shadcn: boolean;
  };
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export function detectFramework(pkg: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}): FrameworkDetectionResult {
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  const react = "react" in allDeps;
  const vite = "vite" in allDeps;
  const tailwind = "tailwindcss" in allDeps;
  const radixKeys = Object.keys(allDeps).filter((k) => k.startsWith("@radix-ui/react-"));
  const shadcn = radixKeys.length >= 3;   // 3+ Radix packages = HIGH confidence shadcn

  const detected = { react, vite, tailwind, shadcn };
  const score = [react, vite, tailwind, shadcn].filter(Boolean).length;
  const framework = score === 4 ? "react-vite-tailwind-shadcn" : "unknown";
  const confidence = score === 4 ? "HIGH" : score >= 2 ? "MEDIUM" : "LOW";

  return { framework, detected, confidence };
}
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All JS/TS execution | Yes | v24.14.0 | — |
| npm | Package install | Yes | bundled with Node | — |
| PostgreSQL (Neon) | dm_* tables, pipeline state | Assumed yes (DATABASE_URL in .env) | Neon serverless | — |
| STITCH_API_KEY | Stitch wrapper live test | Unknown — not in .env yet | — | Add to .env before live test; smoke test can mock |
| vitest@2 | Test harness (D-20) | Not installed | — | None; must install |
| @google/stitch-sdk | Stitch wrapper (D-12) | Not installed | — | None; must install |

**Missing dependencies with no fallback:**
- `vitest@2` — must be installed before any tests can run
- `@google/stitch-sdk` — must be installed before wrapper can be written

**Missing dependencies with fallback:**
- `STITCH_API_KEY` — wrapper smoke test can use a mock/stub; live API validation can be a manual step or deferred to Phase 3

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest@2 (Vite 5 compatible) |
| Config file | `vitest.config.ts` at project root (Wave 0 — does not exist yet) |
| Quick run command | `npx vitest run tests/unit` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ORCH-02 | Pipeline state Zod schemas validate correct shapes | unit | `npx vitest run tests/unit/design-schema.test.ts` | Wave 0 |
| ORCH-03 | PageState schema accepts error field | unit | `npx vitest run tests/unit/design-schema.test.ts` | Wave 0 |
| ORCH-04 | ProjectConfig Zod schema validates and rejects correctly | unit | `npx vitest run tests/unit/pipeline-schemas.test.ts` | Wave 0 |
| INTG-06 | detectFramework returns correct result for React+Vite+Tailwind+shadcn | unit | `npx vitest run tests/unit/detect-framework.test.ts` | Wave 0 |
| ORCH-01/05 | Skill SKILL.md files exist and have valid frontmatter | smoke/manual | manual file inspection | Wave 0 |

Note: Stitch wrapper live API test (success criteria #3) requires STITCH_API_KEY. This is a manual smoke test or a separate integration test tagged to skip in CI unless the env var is present.

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — dual-environment config (node + jsdom projects)
- [ ] `tests/unit/design-schema.test.ts` — covers ORCH-02, ORCH-03
- [ ] `tests/unit/pipeline-schemas.test.ts` — covers ORCH-04
- [ ] `tests/unit/detect-framework.test.ts` — covers INTG-06
- [ ] `tests/setup-dom.ts` — @testing-library/jest-dom import for jsdom project
- [ ] Framework install: `npm install -D vitest@2 jsdom @testing-library/react @testing-library/jest-dom`
- [ ] `package.json` scripts: add `"test": "vitest run"` and `"test:watch": "vitest"`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest + babel for ESM | Vitest (no babel) | 2023+ | No config overhead; works natively with Vite |
| jest.projects for multi-env | vitest `test.projects` array | Vitest 1.3+ | Same pattern, different key name |
| JSON file for pipeline state | PostgreSQL via Drizzle | Decision D-06 | Multi-device safe, auditable, queryable |

**Deprecated/outdated:**
- `pipeline-state.json` in repo: explicitly rejected (D-06)
- JSONB tokens: explicitly rejected (D-01) in favor of structured columns

---

## Open Questions

1. **Drizzle Kit array schema support in db:push**
   - What we know: Drizzle Kit `out` and `schema` fields accept strings; array syntax appears in docs
   - What's unclear: Whether `db:push` (not `generate`) supports array schema in v0.30.4 specifically
   - Recommendation: Test `db:push` with array config immediately after editing `drizzle.config.ts`. If it fails, use a barrel re-export file (`shared/all-schemas.ts`) that imports and re-exports from both schema files, and point `schema:` to that single file.

2. **Stitch API key availability**
   - What we know: `STITCH_API_KEY` must come from stitch.withgoogle.com account settings
   - What's unclear: Whether a key has been created for this project
   - Recommendation: Flag as a manual prerequisite step in the plan. The wrapper can be written and unit-tested (with mocks) before the key exists. The live generate() smoke test is a separate task that requires the key.

3. **Vitest `projects` array in v2.x**
   - What we know: `test.projects` is documented for Vitest. The dual-env pattern is confirmed in official docs.
   - What's unclear: Whether `test.projects` was available in Vitest 2.x or only 3.x+
   - Recommendation: Fallback: if `test.projects` is not available in vitest@2, use a single config with `environment: "node"` for Phase 1 (all smoke tests are server-side), and add the jsdom project config when React component tests are needed in Phase 4. Use `@vitest-environment jsdom` docblock per-file in the interim.

---

## Sources

### Primary (HIGH confidence)
- @google/stitch-sdk npm registry — version 0.0.3, published 2026-03-12, peer dependencies, exports map
- deepwiki.com/google-labs-code/stitch-sdk — full API surface: Stitch, Project, Screen, StitchError classes and all methods with signatures
- vitest.dev/guide/ — installation, dual-environment projects pattern, separate config file priority
- Existing codebase — shared/schema.ts, server/db.ts, drizzle.config.ts, package.json, vite.config.ts, server/ai/index.ts

### Secondary (MEDIUM confidence)
- github.com/anthropics/skills skill-creator SKILL.md — frontmatter format, directory layout, description guidelines
- developers.googleblog.com Stitch announcement — confirms MCP-based architecture
- Vitest Vite compatibility research — Vitest 3.x supports Vite 5+6; Vitest 4.x from Vitest 3.2+ supports Vite 7

### Tertiary (LOW confidence)
- WebSearch result claiming `stitch.createProject()` exists as a method on the singleton — verified against deepwiki (confirmed as `client.createProject()` on Stitch class instance)

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies To Phase 1 |
|-----------|-------------------|
| Build tool: must use skill-creator | Skills (ORCH-05) — skill SKILL.md files must follow skill-creator format |
| Stitch API: must use official docs | Stitch wrapper — confirmed against SDK README and deepwiki; no guessing |
| Database: Neon PostgreSQL | Design memory tables + pipeline state — already confirmed as same provider |
| Framework v1: React+Vite+Tailwind+shadcn | INTG-06 detect-framework — only v1 framework to detect |
| Brownfield-first | drizzle.config.ts edit must not break existing schema.ts migration |
| Best practices: TDD, code review, git | Vitest setup required before implementation; smoke tests first |
| Secrets always in .env | STITCH_API_KEY goes in .env only; never hardcoded in wrapper |
| Commit messages: lowercase imperative | e.g., `feat(foundation): add design memory schema` |
| GSD workflow enforcement | All file changes go through gsd:execute-phase |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against npm registry (2026-03-27); versions confirmed
- Architecture: HIGH — all patterns derived from existing codebase + official docs
- Stitch API contract: MEDIUM — SDK is v0.0.3 pre-release; API shape confirmed via README + deepwiki but subject to change
- Pitfalls: HIGH — Vitest version mismatch and Stitch URL vs HTML pitfalls verified via official sources
- Skill format: MEDIUM — confirmed via anthropics/skills repo but skill-creator is itself a skill; format is stable

**Research date:** 2026-03-27
**Valid until:** 2026-04-10 (14 days — Stitch SDK is pre-release and could ship v0.0.4 with breaking changes; re-verify before Phase 3)
