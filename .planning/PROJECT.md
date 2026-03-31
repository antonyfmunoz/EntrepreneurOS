# SaaS Development System

## What This Is

An end-to-end SaaS development system built as a set of Claude Code skills. It takes a product from spec to deployed, hosted app — orchestrating UI generation (via Google Stitch API), code integration, backend wiring, testing, analytics, and deployment. The system calls existing Claude Code skills at each phase (frontend-design, PostHog, GSD, TDD, debugging, code review, git workflows, etc.) and stores design consistency context in a Neon PostgreSQL database. Built for personal use first across multiple SaaS projects, with learnings informing a future productized version.

## Core Value

One system that takes a SaaS product from spec document to deployed, tested, hosted application — page by page, with human oversight at critical points and autonomous execution everywhere else.

## Requirements

### Validated

- [x] Design consistency memory — Neon PostgreSQL schema created with 6 tables (dm_projects, dm_pages, dm_tokens, dm_components, dm_layouts, pipeline_states) and Zod validation contracts. Validated in Phase 01: Foundation.
- [x] Stitch API integration — typed SDK wrapper with retry logic, secret-safe error handling. Validated in Phase 01: Foundation.
- [x] Framework-aware — framework detection function identifies React+Vite+Tailwind+shadcn/ui with confidence scoring. Validated in Phase 01: Foundation.
- [x] Spec ingestion — parseSpec() accepts raw text, restructures via Claude AI into validated PageSpec[] with 4 composable layers and provenance tracking. Validated in Phase 02: Spec Layer.
- [x] Spec collaboration — 5-stage domain-first collaborative flow (vision → user-flows → pages → page-detail → implied) produces complete PageSpec[] through guided questioning. Validated in Phase 02: Spec Layer.
- [x] Backend spec ingestion — deriveBackendSpec() auto-generates CRUD endpoints from PageSpec data layer with provenance propagation. Validated in Phase 02: Spec Layer.
- [x] Stitch API integration — buildStitchPrompt with 5-param signature (spec, tokens, screenshot, componentDirection, componentReferences), prompt size capping at 30K chars, HTML sanitization pipeline. Validated in Phase 03: UI Generation.
- [x] Design consistency memory — design system seeding from project spec, token extraction via Claude, mergeTokens with nullish coalescing, conflict detection. Validated in Phase 03: UI Generation.
- [x] Self-review — Claude Sonnet 4-dimension review (specCompliance, visualConsistency, structuralCompleteness, contentQuality) + Gemini 2.0 Pro vision-based dual reviewer with worst-of-both scoring. Validated in Phase 03: UI Generation.
- [x] Approval gates — evaluateApprovalGate with page-1-always-escalates, 90% threshold across all dimensions, auto-approve notice for high-confidence pages. Validated in Phase 03: UI Generation.

### Active
- [ ] Pause/resume/interrupt — user can inject feedback, pause, or resume at any point in the pipeline
- [x] Frontend code integration — take approved Stitch output and integrate it into the project (create/update files, update routing, respect existing code). Validated in Phase 04: Code Integration.
- [x] Brownfield awareness — check what exists before adding, avoid duplicates and redundancy. Validated in Phase 04: Code Integration.
- [ ] Backend wiring — upgrade existing Express/Drizzle backend (routes, schema, validation) to serve what the new UI needs
- [ ] Testing — test what gets built, not just generate code; fix errors when tests fail
- [ ] Analytics setup — PostHog integration (event tracking, feature flags, dashboards, error tracking)
- [x] Git workflow — branch management, push/pull, GitHub repository integration. Validated in Phase 04: Code Integration.
- [ ] Hosting/deployment — guided setup for hosting decisions + full deploy automation (Docker, CI/CD, VPS/cloud)
- [ ] Reusable across projects — works with any SaaS repo, not tied to EntrepreneurOS
- [ ] Framework-aware — v1 targets React + Vite, designed to extend to Next.js, Vue/Nuxt, and others
- [ ] Skill orchestration — the system knows which existing Claude Code skills to invoke at which phase

### Out of Scope

- Productized version for external users — learnings inform that, but it's a separate future project
- Mobile app generation — web-first
- Non-SaaS project types — this is specifically for SaaS product development
- Custom Stitch model training — use Stitch as-is via its API

## Context

**Existing codebase:** EntrepreneurOS is a partially-built SaaS app (React + Vite + Tailwind + shadcn/ui frontend, Express + Drizzle + Neon Postgres backend, Passport.js session auth). Currently on `feature/company-system` branch with company management in progress. Originally built on Replit, moved to GitHub for local Claude Code development.

**Google Stitch:** User has API access/key. Stitch generates both code and a visual preview from prompts. Works best one page at a time rather than generating an entire app at once. Research needed on exact API contract, what context it accepts, and how to maintain design consistency across calls.

**Design consistency:** Neon PostgreSQL database schema is live with 6 tables for storing approved page context (design tokens, component patterns, layout decisions). Phase 01 created the schema and validation contracts; subsequent phases will wire the storage layer and query logic.

**Skill ecosystem:** 30+ existing Claude Code skills map into this system's lifecycle — from brainstorming and planning through code review, testing, debugging, analytics, and deployment. The system is an orchestrator that calls the right skill at the right time.

**Target workflow:**
1. User provides (or collaborates on) a UI design spec document
2. System parses spec into individual pages
3. For each page: call Stitch → self-review → approve/escalate → integrate code
4. User provides (or collaborates on) a backend spec document
5. System upgrades backend to serve the new UI
6. System runs tests, fixes errors
7. System sets up analytics (PostHog)
8. System handles hosting/deployment setup
9. System manages git workflow (branches, PRs, push)

**First target:** EntrepreneurOS (this repo). Then LYFEOS, CreatorOS, and future projects.

**Build approach:** Use `skill-creator` skill to build this as proper Claude Code skills. Research Google Stitch API docs for correct integration patterns. Follow best practices throughout.

## Constraints

- **Build tool:** Must be built using `skill-creator` skill — this is a skill creation project
- **Stitch API:** Must use official Google Stitch API documentation — no guessing at API contracts
- **Database:** Neon PostgreSQL for design consistency memory (same provider as SaaS products)
- **Framework v1:** React + Vite + Tailwind + shadcn/ui (extend to others post-v1)
- **Existing code:** Must work with partially-built projects — brownfield-first, not greenfield-only
- **Best practices:** Every phase follows established patterns — TDD, code review, proper git workflow, verification before completion

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build as Claude Code skills, not standalone app | Leverages existing skill ecosystem, runs where Claude Code runs | -- Pending |
| GSD for planning, system for execution | Separation of concerns — GSD already handles planning well | -- Pending |
| Neon PostgreSQL for design memory | Consistent with existing stack, serverless, already in use | -- Pending |
| Page-by-page UI generation | Works better than full-app generation per user experience with Stitch | -- Pending |
| First page requires user approval | Sets design direction, ensures system understands user intent | -- Pending |
| Self-review before escalation | Reduces user friction — only involve human when AI is uncertain | -- Pending |
| Use skill-creator to build | Best practice for skill development, includes evals and benchmarking | -- Pending |
| Research Stitch API properly | Don't guess — use official docs for correct integration | -- Pending |

## Skill Mapping

The system orchestrates these existing skills across its lifecycle:

**Spec & Planning:**
- `superpowers:brainstorming` — explore intent/requirements if no spec provided
- GSD skills (`discuss-phase`, `plan-phase`, `new-project`) — structured planning
- `superpowers:writing-plans` — plan multi-step implementation
- `superpowers:dispatching-parallel-agents` — parallelize independent work

**UI Generation & Design:**
- Google Stitch API — generate UI code + preview
- `frontend-design` — ensure high design quality, avoid generic AI aesthetics

**Skill Building:**
- `skill-creator` — build the system itself as proper skills with evals

**Code Integration & Execution:**
- `superpowers:subagent-driven-development` — parallel execution
- `superpowers:test-driven-development` — tests alongside implementation
- `gsd:map-codebase` — understand existing code before changes
- `gsd:execute-phase` — execute plans

**Code Review:**
- `superpowers:requesting-code-review` / `receiving-code-review`
- `coderabbit:code-review` — automated review
- `superpowers:verification-before-completion` — verify before claiming done

**Testing & Debugging:**
- `superpowers:systematic-debugging` — scientific method debugging
- `superpowers:verification-before-completion` — run tests, confirm output

**Analytics:**
- `posthog:posthog-instrumentation` — add tracking/events
- `posthog:flags` — feature flags
- `posthog:insights` / `posthog:dashboards` — analytics setup
- `posthog:errors` — error tracking

**Git & Deployment:**
- `superpowers:using-git-worktrees` — isolate feature work
- `superpowers:finishing-a-development-branch` — merge/PR decisions
- `gsd:ship` / `gsd:pr-branch` — PR workflow

**Maintenance:**
- `gsd:resume-work` / `gsd:pause-work` — session management
- `gsd:debug` — persistent debug sessions
- `simplify` — code quality review
- `claude-md-management:revise-claude-md` / `claude-md-improver` — project docs
- `update-config` — Claude Code settings

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-31 after Phase 03 (UI Generation) enhancement plans completion — design seeder, component discovery, dual reviewer, HTML sanitizer added*
