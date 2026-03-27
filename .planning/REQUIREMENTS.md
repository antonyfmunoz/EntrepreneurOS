# Requirements: SaaS Development System

**Defined:** 2026-03-25
**Core Value:** One system that takes a SaaS product from spec document to deployed, tested, hosted application — page by page, with human oversight at critical points and autonomous execution everywhere else.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Spec & Input

- [ ] **SPEC-01**: User can paste a pre-written spec document and system parses it into page-level units
- [ ] **SPEC-02**: User can collaboratively create a spec with the system if no document exists (using brainstorming/GSD questioning)
- [ ] **SPEC-03**: System parses spec into individual page specs (name, purpose, components, data requirements)
- [ ] **SPEC-04**: User can paste a backend spec document with same input optionality as UI spec
- [ ] **SPEC-05**: System extracts implied requirements from page specs (auth, data fetching, error states, loading states, empty states)

### UI Generation

- [ ] **UIGEN-01**: System calls Google Stitch API with page spec and receives generated code + visual preview
- [ ] **UIGEN-02**: System stores approved page design context (tokens, patterns, layout decisions) in Neon PostgreSQL
- [ ] **UIGEN-03**: System injects prior design context into Stitch prompts for subsequent pages
- [ ] **UIGEN-04**: System self-reviews generated output against spec requirements (structured checklist, not freeform)
- [ ] **UIGEN-05**: System self-reviews generated output against previously approved pages for visual consistency
- [ ] **UIGEN-06**: Page 1 always escalates to user for approval regardless of self-review confidence
- [ ] **UIGEN-07**: Subsequent pages auto-approve if self-review passes, escalate to user if below confidence threshold

### Code Integration

- [ ] **INTG-01**: System scans existing codebase before writing any files (brownfield audit)
- [ ] **INTG-02**: System translates Stitch output to match existing design system (shadcn/ui components) before integration
- [ ] **INTG-03**: System creates/updates React component files from approved Stitch output
- [ ] **INTG-04**: System updates routing configuration for new pages
- [ ] **INTG-05**: System wires new pages into existing app layout and navigation
- [x] **INTG-06**: System detects React + Vite + Tailwind + shadcn/ui framework via package.json (extensible to other frameworks)

### Backend

- [ ] **BACK-01**: System extracts actual API calls from integrated frontend components (contract extraction)
- [ ] **BACK-02**: System adds Express routes for endpoints the new UI requires
- [ ] **BACK-03**: System extends Drizzle schema for new data requirements
- [ ] **BACK-04**: System adds Zod validation for new endpoints
- [ ] **BACK-05**: Backend wiring is brownfield-aware (checks existing routes, migrations, middleware)

### Quality & Testing

- [ ] **TEST-01**: System runs tests after each phase, parses failures, attempts fixes, re-runs until pass or escalates
- [ ] **TEST-02**: System writes integration tests per phase (not just unit tests)
- [ ] **TEST-03**: System requires passing test suite before deployment gate

### Git Workflow

- [ ] **GIT-01**: System creates feature branches per phase
- [ ] **GIT-02**: System commits at phase boundaries (not per-file) with descriptive messages
- [ ] **GIT-03**: System pushes to remote and surfaces PR-ready state

### Analytics

- [ ] **ANLYT-01**: System defines event taxonomy during spec parsing (before implementation)
- [ ] **ANLYT-02**: System instruments PostHog event capture during page integration (not as afterthought)
- [ ] **ANLYT-03**: System sets up PostHog feature flags, error tracking, and dashboards

### Deployment

- [ ] **DEPLOY-01**: System guides user through hosting decisions (VPS, cloud, Replit, etc.)
- [ ] **DEPLOY-02**: System generates Docker/docker-compose configs for chosen hosting
- [ ] **DEPLOY-03**: System generates CI/CD pipeline (GitHub Actions)
- [ ] **DEPLOY-04**: System can execute full deployment to configured target
- [ ] **DEPLOY-05**: Deployment requires explicit user confirmation gate

### Orchestration & State

- [x] **ORCH-01**: System orchestrates existing Claude Code skills at correct lifecycle phase
- [x] **ORCH-02**: Pipeline state persisted in Neon PostgreSQL (not conversation context)
- [x] **ORCH-03**: System supports pause/resume/interrupt — resumes from last checkpoint
- [x] **ORCH-04**: System is reusable across SaaS repos (no hardcoded paths, accepts project config)
- [ ] **ORCH-05**: System is built as Claude Code skills using skill-creator

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Framework Support

- **FRMWK-01**: System supports Next.js (app router) projects
- **FRMWK-02**: System supports Vue + Nuxt projects
- **FRMWK-03**: Framework detection auto-selects integration strategy

### Productization

- **PROD-01**: External user-facing interface (beyond CLI)
- **PROD-02**: Multi-user support with auth and billing
- **PROD-03**: Team collaboration on specs

### Advanced Generation

- **ADVGEN-01**: Screenshot-to-spec conversion
- **ADVGEN-02**: Custom Stitch model training/fine-tuning
- **ADVGEN-03**: Real-time collaborative spec editing

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full codebase reverse-engineering to spec | Causes alignment loss on brownfield projects — scope specs to changes only |
| Whole-app Stitch generation in one call | Stitch produces lower quality; page-by-page is correct abstraction |
| Autonomous deployment without review gate | Deployment is irreversible; human checkpoint required |
| Tests generated but never run | Test execution is the gate, not test generation |
| Multi-framework v1 | Delays shipping; React + Vite sufficient for current projects |
| External product features (auth, billing, teams) | Personal tool first; productization is separate future project |
| Mobile app generation | Web-first |
| Non-SaaS project types | System designed specifically for SaaS products |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SPEC-01 | Phase 2 | Pending |
| SPEC-02 | Phase 2 | Pending |
| SPEC-03 | Phase 2 | Pending |
| SPEC-04 | Phase 2 | Pending |
| SPEC-05 | Phase 2 | Pending |
| UIGEN-01 | Phase 3 | Pending |
| UIGEN-02 | Phase 3 | Pending |
| UIGEN-03 | Phase 3 | Pending |
| UIGEN-04 | Phase 3 | Pending |
| UIGEN-05 | Phase 3 | Pending |
| UIGEN-06 | Phase 3 | Pending |
| UIGEN-07 | Phase 3 | Pending |
| INTG-01 | Phase 4 | Pending |
| INTG-02 | Phase 4 | Pending |
| INTG-03 | Phase 4 | Pending |
| INTG-04 | Phase 4 | Pending |
| INTG-05 | Phase 4 | Pending |
| INTG-06 | Phase 1 | Complete |
| BACK-01 | Phase 5 | Pending |
| BACK-02 | Phase 5 | Pending |
| BACK-03 | Phase 5 | Pending |
| BACK-04 | Phase 5 | Pending |
| BACK-05 | Phase 5 | Pending |
| TEST-01 | Phase 5 | Pending |
| TEST-02 | Phase 5 | Pending |
| TEST-03 | Phase 5 | Pending |
| GIT-01 | Phase 4 | Pending |
| GIT-02 | Phase 4 | Pending |
| GIT-03 | Phase 4 | Pending |
| ANLYT-01 | Phase 6 | Pending |
| ANLYT-02 | Phase 6 | Pending |
| ANLYT-03 | Phase 6 | Pending |
| DEPLOY-01 | Phase 6 | Pending |
| DEPLOY-02 | Phase 6 | Pending |
| DEPLOY-03 | Phase 6 | Pending |
| DEPLOY-04 | Phase 6 | Pending |
| DEPLOY-05 | Phase 6 | Pending |
| ORCH-01 | Phase 1 | Complete |
| ORCH-02 | Phase 1 | Complete |
| ORCH-03 | Phase 1 | Complete |
| ORCH-04 | Phase 1 | Complete |
| ORCH-05 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after roadmap creation — all 42 requirements mapped*
