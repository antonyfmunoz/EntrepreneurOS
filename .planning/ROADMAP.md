# Roadmap: SaaS Development System

## Overview

Six phases that deliver a complete spec-to-deployment pipeline as Claude Code skills. The critical path runs from infrastructure contracts through spec parsing, UI generation with design memory, frontend code integration, backend wiring with quality gates, and finally analytics instrumentation and deployment automation. Each phase delivers one complete, independently verifiable capability. Nothing ships until it works end-to-end.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Infrastructure schemas, state contracts, Stitch SDK wrapper, Vitest setup, and framework detection
- [ ] **Phase 2: Spec Layer** - Spec ingestion (paste or collaborate) producing validated PageSpec[] output
- [ ] **Phase 3: UI Generation** - Stitch integration with design memory and confidence-calibrated approval gates
- [ ] **Phase 4: Code Integration** - Brownfield-aware frontend integration with git workflow
- [ ] **Phase 5: Backend + Quality** - Backend wiring against actual UI contracts with autonomous test fix loop
- [ ] **Phase 6: Analytics + Delivery** - PostHog instrumentation and full deployment automation

## Phase Details

### Phase 1: Foundation
**Goal**: All contracts, schemas, and infrastructure are in place so every downstream phase has typed inputs and external state to rely on
**Depends on**: Nothing (first phase)
**Requirements**: ORCH-01, ORCH-02, ORCH-03, ORCH-04, ORCH-05, INTG-06
**Success Criteria** (what must be TRUE):
  1. Neon PostgreSQL design memory tables exist and are queryable (design_projects, design_pages, design_tokens, component_patterns)
  2. pipeline-state.json schema is defined with Zod and validates correctly against all inter-phase handoff shapes
  3. The Stitch SDK wrapper executes a live generate call and returns typed HTML + screenshot URL without error
  4. Vitest runs and passes on the project with at least one smoke test confirming the test harness works
  5. Framework detection reads package.json and correctly identifies React + Vite + Tailwind + shadcn/ui
**Plans**: TBD

### Phase 2: Spec Layer
**Goal**: User can provide a spec (paste or collaborate) and the system produces a validated, structured PageSpec[] that all downstream phases consume
**Depends on**: Phase 1
**Requirements**: SPEC-01, SPEC-02, SPEC-03, SPEC-04, SPEC-05
**Success Criteria** (what must be TRUE):
  1. User can paste a raw spec document and receive a parsed PageSpec[] with name, route, components, data requirements, and auth protection per page
  2. User can start with no spec and reach a complete PageSpec[] through structured questioning (brainstorming/GSD flow)
  3. System extracts implied requirements (auth gates, error states, loading states, empty states) that were not explicit in the spec
  4. Backend spec follows the same dual-path input (paste or collaborate) and produces a validated backend spec structure
  5. Event taxonomy is extracted from spec pages during parsing and written to state file for Phase 6 consumption
**Plans**: TBD
**UI hint**: no

### Phase 3: UI Generation
**Goal**: System generates pixel-quality UI for each page via Stitch, maintains visual consistency across all pages using design memory, and routes to user only when confidence is below threshold
**Depends on**: Phase 2
**Requirements**: UIGEN-01, UIGEN-02, UIGEN-03, UIGEN-04, UIGEN-05, UIGEN-06, UIGEN-07
**Success Criteria** (what must be TRUE):
  1. System calls Stitch API with a page spec and receives generated code and a visual preview URL
  2. Page 1 always escalates to user for approval regardless of self-review score
  3. After page 1 approval, design tokens (color palette, type scale, spacing, component patterns, border radius) are extracted and persisted to Neon
  4. Subsequent pages are generated with stored design tokens injected as hard constraints into the Stitch prompt
  5. Self-review scores generated output against spec requirements and consistency with prior pages; pages that score above confidence threshold auto-approve without user interruption
**Plans**: TBD
**UI hint**: yes

### Phase 4: Code Integration
**Goal**: Approved Stitch output becomes real, working React files in the existing repo — integrated into routing, navigation, and layout — with every change tracked in git
**Depends on**: Phase 3
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04, INTG-05, GIT-01, GIT-02, GIT-03
**Success Criteria** (what must be TRUE):
  1. System scans existing codebase and produces a brownfield inventory before writing any file
  2. Stitch HTML output is translated to use existing shadcn/ui components and design system conventions before any file is written
  3. New pages are navigable in the running app — routes are added to App.tsx, pages appear in navigation, and existing auth-protected routes remain intact
  4. Each phase's work lives on its own feature branch with incremental commits at phase boundaries, and the branch is pushed to remote in PR-ready state
**Plans**: TBD
**UI hint**: yes

### Phase 5: Backend + Quality
**Goal**: The backend serves exactly what the integrated UI requests, tests verify what was built, and nothing ships until the test suite passes
**Depends on**: Phase 4
**Requirements**: BACK-01, BACK-02, BACK-03, BACK-04, BACK-05, TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. System extracts actual API calls from integrated frontend components and generates only the Express routes, Drizzle schema additions, and Zod validators needed to serve them
  2. Backend wiring is additive-only — existing routes, middleware, and Passport.js auth remain untouched
  3. Integration tests are written against spec requirements (not just unit tests) before implementation is marked complete
  4. System runs tests autonomously, parses failures, fixes the implementation (never the tests), re-runs, and either passes or escalates after 3 cycles
  5. No deployment gate is reachable with a failing test suite
**Plans**: TBD

### Phase 6: Analytics + Delivery
**Goal**: The finished, tested app is instrumented with meaningful analytics and deployed to the target host with explicit user confirmation at the deployment gate
**Depends on**: Phase 5
**Requirements**: ANLYT-01, ANLYT-02, ANLYT-03, DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05
**Success Criteria** (what must be TRUE):
  1. PostHog events defined in the spec-derived taxonomy are instrumented per page during integration — not added as an afterthought post-deploy
  2. PostHog feature flags, error tracking, and a baseline dashboard are configured and active
  3. User is guided through a hosting decision (VPS, cloud, Replit) with a clear explanation of trade-offs before any config is generated
  4. Docker, docker-compose, and GitHub Actions CI/CD configs are generated and correct for the chosen target
  5. Deployment executes to the configured target only after explicit user confirmation — autonomous deployment without this gate is not possible
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/TBD | Not started | - |
| 2. Spec Layer | 0/TBD | Not started | - |
| 3. UI Generation | 0/TBD | Not started | - |
| 4. Code Integration | 0/TBD | Not started | - |
| 5. Backend + Quality | 0/TBD | Not started | - |
| 6. Analytics + Delivery | 0/TBD | Not started | - |
