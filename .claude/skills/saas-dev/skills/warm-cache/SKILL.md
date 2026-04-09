---
name: saas-dev:warm-cache
description: Warm the component discovery cache by querying live MCP registries (shadcn, MagicUI, 21st.dev). Must run inside a Claude Code session where MCP tools are available. Run this before executing the ui-gen phase.
---

# Skill: saas-dev:warm-cache

Populate the component discovery cache with fresh MCP data so the headless ui-gen pipeline has production-grade component references for every Stitch prompt.

## Why This Exists

MCP tools (shadcn-ui, MagicUI, 21st.dev Magic) only exist inside the Claude Code harness. The ui-gen orchestrator runs as headless `tsx` and cannot reach MCP servers. This skill bridges the gap: run it interactively to warm the cache, then the orchestrator reads from it.

## Prerequisites

- Running inside a Claude Code session (MCPs must be available)
- Phase 2 (spec) complete: a SpecOutput must exist in `pipeline_pages`
- **Spec approved (no blocking gaps):** If `.planning/output/spec/GAP-ANALYSIS.md` exists and contains blocking issues, warm-cache refuses to run. Resolve blocking gaps in the spec first.
- `DATABASE_URL` configured in .env

## Arguments

- `--ttl <hours>` — override default TTL (default: 24 hours)
- `--project-id <id>` — override project ID (default: read from `.planning/project.config.json`)

## Flow

### Step 0 — Check Spec Approval

Before doing anything, check if the spec has blocking gaps:

```typescript
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const gapReportPath = resolve(process.cwd(), ".planning/output/spec/GAP-ANALYSIS.md");
if (existsSync(gapReportPath)) {
  const report = readFileSync(gapReportPath, "utf-8");
  if (report.includes("Blocking Issues")) {
    throw new Error(
      "Spec has blocking gaps — resolve them before warming the cache.\n" +
      "See: .planning/output/spec/GAP-ANALYSIS.md"
    );
  }
}
```

### Step 1 — Load Spec

Read the latest completed spec from the database:

```typescript
import { and, desc, eq } from "drizzle-orm";
import { pipelinePages } from "@shared/design-schema.js";
import { getOrchestratorDb } from "../../lib/orchestrator/db.js";

const db = getOrchestratorDb();
const [specRow] = await db
  .select()
  .from(pipelinePages)
  .where(
    and(
      eq(pipelinePages.projectId, projectId),
      eq(pipelinePages.phase, "spec"),
      eq(pipelinePages.status, "complete"),
    ),
  )
  .orderBy(desc(pipelinePages.completedAt))
  .limit(1);

if (!specRow?.output) {
  throw new Error("No completed spec found. Run the spec phase first.");
}

const spec = JSON.parse(specRow.output);
```

### Step 2 — Extract Component Names

Deduplicate and sort all component names across all pages:

```typescript
const allComponents = [
  ...new Set(spec.pages.flatMap((p) => p.components)),
].sort();

console.log(`Found ${allComponents.length} unique components across ${spec.pages.length} pages:`);
console.log(`  ${allComponents.join(", ")}`);
```

### Step 3 — Compute Spec Hash

```typescript
import { createHash } from "node:crypto";

const normalized = allComponents.map((n) => n.toLowerCase()).sort();
const specHash = createHash("sha256").update(normalized.join("\n")).digest("hex");
```

### Step 4 — Query MCP Registries

For each component, query all three registries. Each query is wrapped in try/catch — partial results are fine.

```typescript
const components = [];

for (const name of allComponents) {
  const entry = { name, registry: "", description: "", code_snippet: undefined };

  // 4a. 21st.dev — visual inspiration
  try {
    const result = await mcp__magic21__21st_magic_component_inspiration({
      message: `${name} component for SaaS application`,
    });
    if (result?.description) {
      components.push({
        name,
        registry: "21st.dev",
        description: String(result.description),
        code_snippet: undefined,
      });
    }
  } catch {
    console.warn(`  ⚠ 21st.dev unavailable for ${name}`);
  }

  // 4b. MagicUI — animated components
  try {
    const result = await mcp__magicui__searchRegistryItems({ query: name });
    if (result?.description) {
      components.push({
        name,
        registry: "MagicUI",
        description: String(result.description),
        code_snippet: typeof result.code === "string" ? result.code.slice(0, 500) : undefined,
      });
    }
  } catch {
    console.warn(`  ⚠ MagicUI unavailable for ${name}`);
  }

  // 4c. shadcn — use 21st.dev builder as proxy for shadcn registry data
  try {
    const result = await mcp__magic21__21st_magic_component_builder({
      message: `shadcn/ui ${name} component implementation`,
    });
    if (result?.description || result?.code) {
      components.push({
        name,
        registry: "shadcn/ui",
        description: typeof result.description === "string" ? result.description : `shadcn ${name}`,
        code_snippet: typeof result.code === "string" ? result.code.slice(0, 500) : undefined,
      });
    }
  } catch {
    console.warn(`  ⚠ shadcn lookup unavailable for ${name}`);
  }

  console.log(`  ✓ ${name}: ${components.filter(c => c.name === name).length} references found`);
}
```

### Step 5 — Write Cache File

```typescript
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const cachePath = resolve(process.cwd(), "lib/ui-generator/component-cache.json");
const ttlHours = args.ttl ?? 24;

const cacheFile = {
  generated_at: new Date().toISOString(),
  ttl_hours: ttlHours,
  project_id: projectId,
  spec_hash: specHash,
  source: "saas-dev:warm-cache skill — live MCP queries",
  components,
};

writeFileSync(cachePath, JSON.stringify(cacheFile, null, 2) + "\n");
```

### Step 6 — Print Summary

```
Component Cache Warmed ✓

  Components queried:  {allComponents.length}
  References found:    {components.length}
  Cache TTL:           {ttlHours}h
  Spec hash:           {specHash.slice(0, 12)}...
  Written to:          lib/ui-generator/component-cache.json

  By registry:
    shadcn/ui:  {count}
    MagicUI:    {count}
    21st.dev:   {count}

The ui-gen phase will now use this cache for component discovery.
```

## Error Handling

| Error | Cause | Action |
|-------|-------|--------|
| No completed spec | Spec phase not run | Stop. Tell user to run spec phase first. |
| All MCP queries fail | MCPs not configured | Stop. Tell user to check MCP configuration in Claude Code settings. |
| Some MCP queries fail | Individual registry down | Continue. Write partial cache. Warn user which registries were unavailable. |
| Database connection error | DATABASE_URL not set | Stop. Tell user to configure DATABASE_URL. |

## When to Run

- **Before first ui-gen execution** — mandatory, no cache exists yet
- **After spec changes** — the orchestrator's freshness gate will reject a stale cache
- **After 24h** — TTL expires, orchestrator will reject
- **Manually** — user wants fresher component data from registries
