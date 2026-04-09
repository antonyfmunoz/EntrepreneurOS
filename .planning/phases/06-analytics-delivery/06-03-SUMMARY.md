---
phase: 06-analytics-delivery
plan: "03"
subsystem: analytics-delivery
tags: [posthog, analytics, feature-flags, tdd, instrumentation]
dependency_graph:
  requires: ["06-01"]
  provides: ["analytics-injector", "posthog-setup"]
  affects: ["06-04"]
tech_stack:
  added: ["posthog-js@^1.364.2"]
  patterns: ["useRef dedupe guard for React 18 Strict Mode", "injectable fetchFn for testability", "structured manualCaptures over comment markers"]
key_files:
  created:
    - lib/analytics-delivery/analytics-injector.ts
    - lib/analytics-delivery/posthog-setup.ts
    - tests/unit/analytics-delivery/analytics-injector.test.ts
    - tests/unit/analytics-delivery/posthog-setup.test.ts
  modified:
    - package.json (added posthog-js dependency)
decisions:
  - "captureCode includes useRef(false) initialization inline — makes it self-contained for injection (vs hookCode)"
  - "manualCaptures replaces comment markers for click/submit events — structured objects with copy-paste captureSnippet"
  - "createFeatureFlags takes fetchFn parameter defaulting to global fetch — enables clean vi.fn() injection in tests without module mocking"
metrics:
  duration: 339
  completed_date: "2026-03-31"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 6 Plan 3: Analytics Injector + PostHog Setup Summary

PostHog capture code generation with structured manualCaptures, React 18 Strict Mode useRef dedupe, posthog-js install, setup guide with credential type disambiguation (phc_/phx_), D-16 dashboard guide, and feature flag creation with warning surfacing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Analytics injector + posthog-js install | 08dd7c0 | analytics-injector.ts, analytics-injector.test.ts, package.json |
| 2 | PostHog setup detection, guide, dashboard guide, feature flags | 0da6216 | posthog-setup.ts, posthog-setup.test.ts |

## Verification

```
Test Files  2 passed (2)
     Tests  29 passed (29)
  Duration  907ms
```

All 29 tests passing across both test files.

## Acceptance Criteria

- [x] posthog-js appears in package.json dependencies (^1.364.2)
- [x] generateAnalyticsInjections produces AnalyticsInjection with auto useEffect for load events with useRef dedupe
- [x] Click/submit events produce structured manualCaptures with copy-paste-ready captureSnippet (NOT comment markers)
- [x] Event names normalized to snake_case via toSnakeCase
- [x] buildProviderCode returns PostHogProvider initialization for App.tsx with VITE_POSTHOG_API_KEY guard
- [x] buildIdentifyCode handles firebase, passport, and null auth providers
- [x] checkPostHogSetup detects all 3 PostHog env vars
- [x] generateSetupGuide distinguishes Project API Key (phc_) from Personal API Key (phx_)
- [x] generateDashboardGuide returns PostHog dashboard setup instructions for D-16 baseline
- [x] createFeatureFlags calls PostHog API correctly and surfaces failures as flagWarnings

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useRef(false) moved from hookCode to captureCode**
- **Found during:** Task 1 GREEN phase — Test 4 expected `useRef(false)` in captureCode
- **Issue:** Initial implementation put `useRef(false)` in hookCode, but test expects it in captureCode for self-contained injection
- **Fix:** Moved `const hasFired = useRef(false)` to be the first line of captureCode — makes captureCode self-contained for injection into page components
- **Files modified:** lib/analytics-delivery/analytics-injector.ts
- **Commit:** 08dd7c0

## Key Decisions

1. **captureCode is self-contained** — includes `const hasFired = useRef(false)` as first line so the code block can be injected into a component without depending on hookCode ordering.

2. **manualCaptures over comment markers** — click/submit events appear as structured `{ eventName, trigger, captureSnippet, properties }` objects. The `captureSnippet` is a copy-paste-ready `posthog?.capture(...)` call with property keys included. Addresses the #1 consensus review concern.

3. **fetchFn injectable** — `createFeatureFlags` accepts a `fetchFn` parameter defaulting to global `fetch`. Enables `vi.fn()` test injection without `vi.mock()` module replacement — cleaner test pattern.

## Known Stubs

None. All functions are fully implemented with real logic.

## Self-Check: PASSED

Files exist:
- lib/analytics-delivery/analytics-injector.ts: FOUND
- lib/analytics-delivery/posthog-setup.ts: FOUND
- tests/unit/analytics-delivery/analytics-injector.test.ts: FOUND
- tests/unit/analytics-delivery/posthog-setup.test.ts: FOUND

Commits exist:
- 08dd7c0: FOUND
- 0da6216: FOUND
