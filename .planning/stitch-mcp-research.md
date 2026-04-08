# Stitch MCP Research

**Date:** 2026-04-07
**SDK pinned:** `@google/stitch-sdk@0.0.3`
**Source of truth:** `node_modules/@google/stitch-sdk/dist/generated/src/tool-definitions.js`

## TL;DR

Stitch IS an MCP. `@google/stitch-sdk` is a thin in-process wrapper around the
official hosted MCP server at `https://stitch.googleapis.com/mcp`, built on
`@modelcontextprotocol/sdk`. We consume it via `StitchToolClient.callTool(...)`
in `lib/stitch/client.ts` and `lib/stitch/mcp-invoker.ts`.

There is **no stdio MCP server to add to `.mcp.json`** — the SDK is the
transport. Anyone who tries to add a `stitch:` entry to `.mcp.json` is
chasing a tool that doesn't exist as a separate process.

## Confirmed tool inventory (8 tools total)

| Tool | Required args | Notes |
|---|---|---|
| `create_project` | `title?` | Returns new `projects/{id}` resource |
| `get_project` | `name` | `name = projects/{id}` |
| `list_projects` | `filter?` | `view=owned` (default) or `view=shared` |
| `list_screens` | `projectId` | Returns `{ screens: [{ name, displayName, createTime, ... }] }`. **Wired in `screen-management.ts`.** |
| `get_screen` | `name`, `projectId`, `screenId` | `projectId`/`screenId` are deprecated but still required |
| `generate_screen_from_text` | `projectId`, `prompt`, `deviceType?`, `modelId?` | **Wired in `client.ts`.** Long-running. SDK 0.0.3 has an indexing bug — we scan `outputComponents` manually instead of trusting `[0]` |
| `edit_screens` | `projectId`, `prompt`, `selectedScreenIds`, `deviceType?`, `modelId?` | NOT YET wired |
| `generate_variants` | `projectId`, `prompt`, `selectedScreenIds`, `variantOptions`, `deviceType?`, `modelId?` | NOT YET wired |

`deviceType` enum: `DEVICE_TYPE_UNSPECIFIED | MOBILE | DESKTOP | TABLET | AGNOSTIC`
`modelId` enum: `MODEL_ID_UNSPECIFIED | GEMINI_3_PRO | GEMINI_3_FLASH`

## Tools that DO NOT EXIST

These were assumed to exist in earlier planning but are absent from the SDK
manifest. **Do not implement code that calls them — it will 404.**

- `delete_screen`
- `delete_project`
- `export_design_system`
- `import_design_system`
- `generate_design_system`
- `get_design_system`
- `set_design_system`

What we do instead:

- **Screen cleanup after rejection** — `deleteScreen` in `screen-management.ts`
  is a no-op stub that returns `{ deleted: false, error: "..." }`. The
  ui-generator skill calls it inside a try/catch + warn, so the pipeline
  continues without blocking. Rejected screens stay in the Stitch project as
  orphans. Acceptable cost given the alternative (re-creating the entire
  project) would burn more credits.
- **DESIGN.md export** — `lib/stitch/design-md.ts` `generateDesignMDFromTokens`
  builds the markdown locally from `dm_tokens`. Persisted to `dm_design_md`
  table in Neon. This is the durable record.
- **DESIGN.md import** — `importDesignMD` is a no-op. Cross-page design
  consistency is achieved via the existing token carry-forward in Step 4e
  of the ui-generator skill (`componentDirection` is preserved across
  revisions, color/font tokens are injected as constraints in `buildStitchPrompt`).

## Authentication

`STITCH_API_KEY` is the documented primary auth path as of SDK 0.0.3. The
older "API keys are not supported" error message we saw in earlier test runs
is no longer current — that was either a stale API endpoint or a regional
rollout issue. Both API key and OAuth2 (`STITCH_ACCESS_TOKEN` +
`GOOGLE_CLOUD_PROJECT`) are accepted.

Optional: `STITCH_HOST` to override the default `https://stitch.googleapis.com/mcp`.

## Installation

Already installed:

```bash
npm install @google/stitch-sdk@0.0.3
```

No global binary. No `.mcp.json` entry. Set `STITCH_API_KEY` in `.env` and
import from the SDK.

## How we wire it

```
lib/stitch/
  types.ts              — McpInvokeFn, STITCH_MCP_TOOLS constant, StitchWrapperError
  mcp-invoker.ts        — getStitchToolClient() singleton + defaultStitchMcpInvoke
  client.ts             — generateScreen() — uses GENERATE_SCREEN_FROM_TEXT
  screen-management.ts  — listScreens() (real) + deleteScreen() (stub)
  design-md.ts          — local generation from dmTokens (stub MCP path)
```

The `STITCH_MCP_TOOLS` constant in `types.ts` is the single allowlist of valid
tool names. If you add a tool name there that isn't in the SDK manifest, the
TypeScript compiler won't catch it but the next call will 404 — the watcher
script below catches that at lint-time.

## Tool drift watcher

`scripts/check-stitch-tools.ts` reads `node_modules/@google/stitch-sdk/dist/generated/src/tool-definitions.js`
and diffs the tool names against `STITCH_MCP_TOOLS`. Run it after any SDK
upgrade:

```bash
npx tsx scripts/check-stitch-tools.ts
```

Exit code 0 if our constant matches the SDK exactly. Non-zero with a diff
report if Google added or removed tools — that's the signal to revisit
`screen-management.ts` and `design-md.ts` for new wiring opportunities.

## Smoke test

```bash
STITCH_PROJECT_ID=4044680601076201931 npx tsx scripts/test-stitch-workflow.ts
```

Exercises `list_projects` and `list_screens` against a real project. Skips
delete and design-system tests because those tools don't exist. Output should
show your project list and the screens for the given project.

## Rollback procedure

If a future SDK upgrade breaks something:

1. Pin back: `npm install @google/stitch-sdk@0.0.3`
2. Re-run `npx tsx scripts/check-stitch-tools.ts` — confirms the manifest matches our constant
3. Re-run `npx vitest run tests/unit/stitch` — all 28 tests should pass
4. Re-run smoke script

`mcp-invoker.ts` exposes `__resetStitchToolClientForTests()` so the singleton
can be cleared between SDK swaps without restarting the process.
