# MCP Component Discovery Cache Redesign

**Date:** 2026-04-09
**Status:** Approved
**Scope:** `lib/ui-generator/component-discovery.ts`, `lib/ui-generator/component-cache.json`, `ui-gen-adapter.ts`, new `saas-dev:warm-cache` skill

## Problem

MCP tools (shadcn-ui, MagicUI, 21st.dev Magic) only exist inside the Claude Code harness. The orchestrator and standalone scripts run as headless `tsx` processes that cannot reach MCP servers. The current code has dead MCP call paths that never execute, and falls back to a manually-populated static cache with no TTL, no spec awareness, and no refresh mechanism.

## Design

### 1. Cache File Format

`lib/ui-generator/component-cache.json` gets three new metadata fields:

```json
{
  "generated_at": "2026-04-09T18:30:00Z",
  "ttl_hours": 24,
  "project_id": "entrepreneuros",
  "spec_hash": "a1b2c3d4...",
  "source": "saas-dev:warm-cache skill — live MCP queries",
  "components": [
    {
      "name": "Button",
      "registry": "shadcn/ui",
      "description": "...",
      "code_snippet": "..."
    }
  ]
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `generated_at` | ISO 8601 string | When the cache was last warmed |
| `ttl_hours` | number | Hours before the cache is considered time-expired (default 24) |
| `project_id` | string | Which project this cache was built for |
| `spec_hash` | string | SHA-256 hex of sorted, deduplicated, lowercased component names from the spec |
| `source` | string | Human-readable provenance |
| `components` | array | Same shape as today plus optional `code_snippet` field |

### 2. Freshness Validation

`component-discovery.ts` exports a new `validateCacheFreshness()` function. Three checks, all must pass:

1. **File exists** — cache file is present on disk
2. **TTL check** — `now - generated_at < ttl_hours`
3. **Spec hash match** — SHA-256 of the current spec's component names matches `spec_hash` in cache

Returns `{ fresh: boolean; reason?: string }`. When stale, `reason` is a human-readable message like:

- `"Cache expired (generated 36h ago, TTL is 24h). Run /saas-dev:warm-cache to refresh."`
- `"Spec changed since cache was built (new components: DataTable, Chart). Run /saas-dev:warm-cache to refresh."`
- `"No component cache found. Run /saas-dev:warm-cache to populate."`

### 3. Component Discovery Module (Simplified)

`component-discovery.ts` becomes a pure cache reader:

- **Remove:** `mcpInvoke` parameter, all live MCP call paths (shadcn_search, mcp__magic21__*, mcp__magicui__*), `McpRegistryResult` interface
- **Keep:** `loadComponentCache()`, `matchCachedComponents()`, `formatDiscoveryForPrompt()`
- **Add:** `validateCacheFreshness(specComponentNames: string[])`, `computeSpecHash(componentNames: string[])`

`discoverComponents()` signature simplifies to:

```typescript
export function discoverComponents(
  componentNames: string[]
): ComponentDiscoveryResult
```

Synchronous. Reads cache, matches components, returns results. No async, no MCP, no fallback logic.

### 4. Orchestrator Integration (`ui-gen-adapter.ts`)

In `prepare()`:
- Compute full component list from all pages in the spec
- Call `validateCacheFreshness(allComponentNames)`
- If not fresh, throw with the reason message (includes the `/saas-dev:warm-cache` command)

In `runPage()`:
- Call `discoverComponents(page.components)` (replaces the current `undefined` pass-through)
- Call `formatDiscoveryForPrompt(discoveryResult)`
- Pass result as `componentReferences` to `buildStitchPrompt()`

### 5. New Skill: `saas-dev:warm-cache`

**Location:** `.claude/skills/saas-dev/skills/warm-cache/SKILL.md`

**Trigger:** User runs `/saas-dev:warm-cache` inside a Claude Code session (where MCPs are available).

**Flow:**

1. Read latest completed spec from `pipeline_pages` (same query as `ui-gen-adapter.ts`)
2. Extract all component names across all pages, deduplicate, sort
3. Compute spec hash (SHA-256 of sorted lowercase names joined by `\n`)
4. For each component, query all three MCP registries:
   - `mcp__magic21__21st_magic_component_inspiration` — visual references
   - `mcp__magicui__searchRegistryItems` — animated component examples
   - shadcn registry (via `mcp__magic21__21st_magic_component_builder` or direct search)
5. Merge results into `ComponentCacheEntry[]` format
6. Write `component-cache.json` with metadata (timestamp, TTL, project ID, spec hash)
7. Print summary: components queried, references found per registry, cache path

**Error handling:** Each MCP query is wrapped in try/catch. If a registry is unavailable, log a warning and continue. The cache is written with whatever was found — partial results are better than no cache.

**TTL default:** 24 hours. User can override with `--ttl <hours>` argument.

### 6. What Does NOT Change

- `ComponentReference` and `ComponentDiscoveryResult` types in `types.ts`
- `formatDiscoveryForPrompt()` function signature and behavior
- `buildStitchPrompt()` — already accepts `componentReferences` string parameter
- `dualReview()`, approval gate, token extraction — untouched
- Database schema — no migrations needed

## File Change Summary

| File | Action |
|------|--------|
| `lib/ui-generator/component-discovery.ts` | Rewrite: remove MCP paths, add freshness validation |
| `lib/ui-generator/component-cache.json` | Format upgrade (new fields, existing components stay) |
| `lib/orchestrator/phases/ui-gen-adapter.ts` | Wire `discoverComponents()` + freshness check |
| `.claude/skills/saas-dev/skills/warm-cache/SKILL.md` | New file: cache-warming skill |
| `.claude/skills/saas-dev/skills/ui-generator/SKILL.md` | Update Step 2a to reference warm-cache |
| `lib/ui-generator/types.ts` | Add `code_snippet` to `CachedComponent` if needed (minor) |
