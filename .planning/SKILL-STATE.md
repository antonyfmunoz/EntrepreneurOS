# SaaS Dev Skill — Current State
Date: April 2026
Branch: feature/company-system

## What Works
- Full pipeline runs end-to-end: spec → copy → react-gen → integration → backend → deploy
- Intake phase: detects greenfield/docs/existing-codebase modes, extracts visual intent, researches competitors
- Spec phase: gap analysis, validates against schema
- Copy phase: brand voice applied, reviewed
- React-gen phase: generates React components directly via Claude, parallel sub-agents, live preview via Vite HMR
- Backend phase: generates route files to server/generated/
- Deploy phase: PostHog injection
- Orchestrator: phase routing, Postgres checkpoints, resume from failure, approval gates
- Auth: Clerk login/signup working
- App shell: header, left-rail, routing all functional

## What Doesn't Work

### Skill-Level Problems
1. Generated components have null reference errors on first render
   - Root cause: react-gen writes components assuming data is always present
   - No null safety enforcement in generation prompt
   - No compile-test after generation — marks complete based on code review score only

2. Generated components import wrong dependencies
   - firebase/auth instead of Clerk
   - posthog-js/react instead of posthog-js
   - next/link instead of wouter
   - Root cause: generation prompt doesn't enforce allowed import list strictly enough

3. No end-to-end validation
   - After react-gen writes a file, Vite may fail to compile it
   - Skill doesn't detect Vite compilation errors and fix them
   - Result: build "succeeds" but app crashes at runtime

4. Shared components are generated without knowing what pages need
   - header.tsx, left-rail.tsx were generated with wrong prop interfaces
   - Had to be manually rewritten after the fact
   - Root cause: shared components should be written with full context of how every page uses them

5. Design system enforcement is prompt-based only
   - No programmatic check that generated code actually uses correct colors
   - Gradient detection works but doesn't block generation if detected
   - Result: visual inconsistency across pages

6. Screenshot quality gate doesn't work reliably
   - Dev server crashes during parallel generation due to Vite HMR churn
   - Playwright can't screenshot a crashed server
   - Score falls back to 1.0 (passes everything)

### App-Level Problems (EOS specific)
1. Portfolio list page returns 401 — Clerk session cookie not propagating to API calls
2. Several pages have pre-existing TS errors from react-gen output
3. Old prototype pages still exist as files (not routed, but polluting the codebase)
4. task-board-page-new.tsx needs manual merge with task-board-page.tsx

## Required Skill Fixes (Priority Order)

### P0 — Blocks end-to-end functionality
1. Compile validation after each component write
   - After writing a .tsx file, run: npx tsc --noEmit --skipLibCheck on that file
   - If errors: extract error messages, pass back to Claude as "fix these specific errors", rewrite
   - Maximum 3 fix attempts before marking page as failed
   - Never mark a page complete if it has TypeScript errors

2. Enforced import allowlist
   - Before writing any component, inject: "ALLOWED IMPORTS ONLY: react, lucide-react, @/components/ui/*, @/components/*, wouter, @tanstack/react-query, @clerk/clerk-react. ANY other import is a build failure."
   - After generation, parse imports and reject any not on the allowlist
   - Auto-fix: replace known bad imports (firebase → clerk, next/link → wouter Link, posthog-js/react → posthog-js)

3. Null safety enforcement
   - Add to generation prompt: "Every prop must be typed as optional (?) unless explicitly required. Every array access must be guarded with ?? []. Every object property access must use optional chaining (?.). Components must handle loading and null states."
   - After generation, scan for .map( .reduce( .filter( without optional chaining — flag and regenerate

### P1 — Significantly improves output quality
4. Shared components context pass
   - Before generating any page, generate shared components first
   - After generating shared components, extract their actual TypeScript interfaces
   - Pass exact interfaces to every page that imports them
   - Pages must use the exact prop signatures, not assumed ones

5. Dev server stability during build
   - During react-gen parallel generation, don't run the dev server
   - After all files are written, start the dev server once
   - Run compilation check: npx tsc --noEmit
   - Fix all errors before declaring build complete

6. Post-build health check
   - After all phases complete, run: npx tsc --noEmit on full repo
   - If errors exist: attempt auto-fix on each file with errors
   - Report: X pages compile clean, Y pages have errors (list them)
   - Build is not "complete" until zero TypeScript errors

### P2 — Polish and experience
7. Better progress visibility
   - Each page generation should show: generating → compiling → fixing errors (N attempts) → done
   - User should never see a "build complete" message if there are TS errors

8. Edit mode that actually works
   - After build, user says "fix the portfolio page"
   - Skill reads the file, identifies errors, fixes them
   - Verifies fix compiles before reporting done

## Architecture Decisions That Are Correct (Don't Change)
- Direct React generation (no Stitch) ✓
- Parallel page generation with p-limit 5 ✓  
- Vite hot-reload for live preview ✓
- Postgres for pipeline state ✓
- Per-page checkpoints and resume ✓
- Copy phase before react-gen ✓
- Intake with visual intent extraction ✓
- Competitive intelligence in intake ✓
- Clerk for auth ✓
- Neon + Drizzle for DB ✓

## Next Session Goal
Fix P0 items (compile validation, import allowlist, null safety) in the skill.
Then re-run the full pipeline on EOS and confirm zero TypeScript errors after build completes.
Then fix the EOS-specific issues (portfolio 401, old files cleanup).
