---
phase: 01-foundation
plan: 02
subsystem: stitch-integration
tags: [stitch-sdk, framework-detection, utility-library, typescript]
dependency_graph:
  requires: []
  provides: [lib/stitch/client.ts, lib/stitch/types.ts, lib/detect-framework.ts]
  affects: [01-03-PLAN.md]
tech_stack:
  added: ["@google/stitch-sdk@0.0.3"]
  patterns: [thin-wrapper, pure-function, p-retry-exponential-backoff]
key_files:
  created:
    - lib/stitch/types.ts
    - lib/stitch/client.ts
    - lib/detect-framework.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - "Use new Stitch(new StitchToolClient({ apiKey })) not new Stitch({ apiKey }) — actual SDK constructor requires StitchToolClient"
  - "Per-call instantiation in getStitchClient() for env-var testability"
  - "stitch singleton not used — explicit key injection needed for non-env contexts"
metrics:
  duration: "~4 minutes"
  completed: "2026-03-27"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
---

# Phase 01 Plan 02: Stitch SDK Wrapper and Framework Detection Summary

Thin Stitch SDK wrapper with typed interfaces, p-retry exponential backoff, and secret-safe error handling; plus a pure-function framework detector that identifies react-vite-tailwind-shadcn stacks from package.json with improved shadcn heuristic.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install Stitch SDK and create typed wrapper | f8c0dea | lib/stitch/types.ts, lib/stitch/client.ts, package.json |
| 2 | Framework detection with improved shadcn heuristic | 7eab766 | lib/detect-framework.ts |

## What Was Built

### lib/stitch/types.ts
Three exports:
- `StitchGenerateRequest` — prompt + optional deviceType enum
- `StitchGenerateResult` — htmlUrl, screenshotUrl, projectId, screenId (presigned URLs, not raw content)
- `StitchWrapperError extends Error` — with `recoverable: boolean` and `code: string` properties

### lib/stitch/client.ts
One export: `generateScreen(projectId, request)` — wraps the Stitch SDK with:
- Per-call client instantiation via `getStitchClient()` for testability
- p-retry with 3 total attempts (retries: 2), exponential backoff (factor: 2, minTimeout: 1000ms)
- AbortError wrapping for non-recoverable StitchErrors (stops retry loop immediately)
- Secret-safe error messages — API key value never appears in any error string
- No `createStitchProject` function (deferred to Phase 3 per review concern #9)

### lib/detect-framework.ts
Two exports:
- `FrameworkDetectionResult` — framework, detected flags, confidence ("HIGH"|"MEDIUM"|"LOW"), missing list
- `detectFramework(pkg, hasComponentsJson?)` — pure function, no I/O

Detection logic:
- react: `"react"` key in deps+devDeps
- vite: `"vite"` key
- tailwind: `"tailwindcss"` key
- shadcn: `components.json` exists (definitive) OR 3+ `@radix-ui/react-*` packages (heuristic)
- Score 4/4 = HIGH confidence + "react-vite-tailwind-shadcn" framework
- Score 2-3 = MEDIUM, score 0-1 = LOW; both return "unknown" + missing list

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected Stitch client constructor API**
- **Found during:** Task 1 — inspecting @google/stitch-sdk@0.0.3 type definitions
- **Issue:** Plan specified `new Stitch({ apiKey })` but the actual Stitch class constructor takes a `StitchToolClient` object, not a config object. Using `new Stitch({ apiKey })` would fail at runtime with a type error.
- **Fix:** Changed to `new Stitch(new StitchToolClient({ apiKey }))` per the SDK's actual API surface (confirmed in README.md explicit configuration example)
- **Files modified:** lib/stitch/client.ts
- **Commit:** f8c0dea

## Self-Check

All files verified to exist:
- lib/stitch/types.ts — FOUND
- lib/stitch/client.ts — FOUND
- lib/detect-framework.ts — FOUND

All commits verified:
- f8c0dea — FOUND
- 7eab766 — FOUND

Acceptance criteria spot-check:
- `@google/stitch-sdk`: "0.0.3" in package.json — PASS (exact pin, no caret)
- No `createStitchProject` in client.ts — PASS (0 occurrences)
- No `from "fs"` or `from "path"` in detect-framework.ts — PASS (pure function)
- `htmlUrl: string` in StitchGenerateResult — PASS (not `html: string`)
- `hasComponentsJson` parameter — PASS
- `radixKeys.length >= 3` — PASS
- `retries: 2` — PASS

## Self-Check: PASSED
