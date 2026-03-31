---
phase: 03-ui-generation
plan: 05
subsystem: ui-generator
tags: [component-discovery, prompt-engineering, mcp-tools, prompt-budgeting, tdd]
dependency_graph:
  requires: [03-03]
  provides: [component-discovery-module, prompt-size-cap]
  affects: [build-stitch-prompt, skill-md-ui-generator]
tech_stack:
  added: []
  patterns: [injectable-mcp-invoke, graceful-mcp-failure, prompt-budget-enforcement]
key_files:
  created:
    - lib/ui-generator/component-discovery.ts
    - tests/unit/ui-generator/component-discovery.test.ts
  modified:
    - lib/ui-generator/types.ts
    - lib/ui-generator/build-stitch-prompt.ts
    - .claude/skills/saas-dev/ui-generator/SKILL.md
decisions:
  - "discoverComponents accepts optional mcpInvoke parameter for test injection — no env var or module mocking required"
  - "All three MCP registries wrapped in separate try/catch — missing any one tool never blocks the others"
  - "componentDirection param added as 4th arg in buildStitchPrompt for 03-04 integration (parallel wave)"
  - "MAX_PROMPT_TOTAL_CHARS = 30,000 chars enforced at end of buildStitchPrompt before return"
  - "SKILL.md Component Discovery enhancement lives in worktree to avoid main-repo conflicts in parallel execution"
metrics:
  duration_seconds: 1367
  completed_date: "2026-03-31"
  tasks_completed: 2
  files_created_or_modified: 5
---

# Phase 03 Plan 05: Component Discovery and Prompt Size Cap Summary

Component discovery layer with injectable MCP invocation, three-registry lookup (shadcn, 21st.dev, MagicUI), per-snippet 500-char cap, 8000-char output cap, and 30,000-char total prompt enforcement in buildStitchPrompt.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Component discovery module with multi-registry lookup and prompt budgeting (TDD) | b2879a6 |
| 2 | Wire component discovery into prompt builder with total size cap and update SKILL.md | 5cf5757 |

## What Was Built

### Task 1: component-discovery.ts

New module `lib/ui-generator/component-discovery.ts` with:

- `COMPLEX_COMPONENT_PATTERNS` — 30-entry list covering DataTable, KanbanBoard, Calendar, Chart, Timeline, CommandPalette, and other complex component types
- `discoverComponents(componentNames, mcpInvoke?)` — iterates component list, skips simple ones, queries three registries for complex ones via injectable mcpInvoke
- `formatDiscoveryForPrompt(result, maxChars=8000)` — groups references by component, truncates snippets at 500 chars, truncates total output at maxChars with explicit truncation notice

Two new types added to `lib/ui-generator/types.ts`:

- `ComponentReference` — source, codeSnippet (max 500 chars), description, visualRef
- `ComponentDiscoveryResult` — references, queriedComponents, skippedComponents

`MAX_PROMPT_TOTAL_CHARS = 30_000` added as Section 15.

10 TDD tests cover: complex vs simple component routing, empty results, three-registry success, graceful MCP failures (all three registries throw), no-mcpInvoke path, COMPLEX_COMPONENT_PATTERNS list, snippet truncation, and maxChars total truncation.

### Task 2: buildStitchPrompt with size cap

`lib/ui-generator/build-stitch-prompt.ts` updated:

- 5-param signature: `(spec, tokens, priorScreenshotUrl?, componentDirection?, componentReferences?)`
- Section 11 injects `componentDirection` (from 03-04 design system seeder)
- Section 12 injects `componentReferences` (from component discovery)
- Final cap: `result.slice(0, MAX_PROMPT_TOTAL_CHARS)` before return
- All 6 existing tests pass unchanged (backwards compatible, 3-arg calls still work)

SKILL.md updated with:
- `component-discovery.ts` row in Module Map table (includes `MAX_PROMPT_TOTAL_CHARS` in types.ts entry)
- Component Discovery subsection in Step 2a documenting usage pattern, mcpInvoke wiring, and budget note

## Deviations from Plan

### Auto-implemented

**1. [Rule 2 - Missing Functionality] Added componentDirection param alongside componentReferences**

- **Found during:** Task 2
- **Issue:** 03-04 runs in parallel (same wave) and adds `componentDirection` param to `buildStitchPrompt`. To avoid merge conflicts, both params were added together in this plan's implementation
- **Fix:** Extended signature to 5 params with `componentDirection` as 4th and `componentReferences` as 5th — matches final state described in plan interfaces section
- **Files modified:** lib/ui-generator/build-stitch-prompt.ts

**2. [Rule 3 - Blocking Issue] Worktree missing lib/ and shared/ directories**

- **Found during:** Task 1 setup
- **Issue:** This worktree (forked from old `feature/company-system`) lacked `lib/`, `shared/design-schema.ts`, `shared/spec-schema.ts`, and `vitest.config.ts` needed by Phase 3 modules
- **Fix:** Copied shared schema files from main repo, created vitest.config.ts, installed vitest@2.1.9 locally, created lib/ directory structure
- **Files modified:** shared/design-schema.ts, shared/spec-schema.ts, vitest.config.ts, package.json

**3. [Rule 3 - Blocking Issue] SKILL.md lives in main repo checkout, not worktree**

- **Issue:** `.claude/skills/saas-dev/ui-generator/SKILL.md` is tracked in `feature/company-system` branch, not in this worktree's branch. Editing it in main repo would conflict with parallel agents
- **Fix:** Created `.claude/skills/saas-dev/ui-generator/SKILL.md` within the worktree directory, making it tracked in `worktree-agent-a1d82497` branch instead. Reverted main-repo edit.

## Known Stubs

None — all functions are fully implemented. Discovery is best-effort by design (missing MCP tools return empty results, not stubs).

## Self-Check: PASSED

### Files created/exist:

- FOUND: lib/ui-generator/component-discovery.ts
- FOUND: lib/ui-generator/types.ts
- FOUND: lib/ui-generator/build-stitch-prompt.ts
- FOUND: tests/unit/ui-generator/component-discovery.test.ts
- FOUND: .claude/skills/saas-dev/ui-generator/SKILL.md

### Commits:

- b2879a6: feat(03-05): component discovery module with multi-registry lookup and prompt budgeting
- 5cf5757: feat(03-05): wire component discovery into prompt builder with total size cap and update SKILL.md
