# Architecture Patterns

**Domain:** Skill-based SaaS development automation system (Claude Code skills)
**Researched:** 2026-03-25
**Confidence:** HIGH (SDK docs verified, skill patterns confirmed via official sources)

---

## Recommended Architecture

The system is an **orchestrator skill** that drives a deterministic pipeline by invoking subordinate skills in sequence. It is not a standalone application — it lives entirely inside Claude Code's skill ecosystem. State lives in two places: a JSON workflow state file on disk (ephemeral, per-run) and a Neon PostgreSQL database (persistent, cross-run design memory).

```
┌─────────────────────────────────────────────────────────┐
│                    ENTRY POINT                          │
│   /saas-dev   (orchestrator skill — SKILL.md)           │
│   Accepts: repo path, spec doc (or nothing)             │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│                  PIPELINE STATE FILE                    │
│   .saas-dev-state.json (ephemeral, gitignored)          │
│   Tracks: current phase, page index, approval status,  │
│   completed pages, pending actions, error state        │
└───────────────────┬─────────────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
┌─────────────────┐   ┌─────────────────────────────────┐
│  SPEC LAYER     │   │  DESIGN MEMORY (Neon Postgres)  │
│  (Phase 1-2)    │   │  design_projects table          │
│                 │   │  design_pages table             │
│  spec-collab    │   │  design_tokens table            │
│  skill          │   │  component_patterns table       │
│  ↓              │   │                                 │
│  Structured     │   │  Stores: approved color tokens, │
│  page specs[]   │   │  spacing system, component      │
└────────┬────────┘   │  patterns, layout decisions,    │
         │            │  Stitch project ID, model used  │
         │            └──────────────┬──────────────────┘
         │                           │
         ▼                           ▼
┌─────────────────────────────────────────────────────────┐
│               UI GENERATION LAYER (Phase 3)             │
│                                                         │
│  For each page spec:                                    │
│  1. Query design memory → build consistency prompt      │
│  2. Call Stitch SDK → getHtml() + getImage()            │
│  3. Self-review skill → compare vs spec + prior pages   │
│  4. Approval gate → auto-approve or escalate to user    │
│  5. Write to design memory → update Neon DB             │
│  6. frontend-design skill → quality pass                │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│             CODE INTEGRATION LAYER (Phase 4)            │
│                                                         │
│  brownfield-check → map existing routes/components      │
│  gsd:map-codebase → understand current state            │
│  File writer → create/update pages, components, routes  │
│  Route updater → App.tsx routing, protected routes      │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│              BACKEND WIRING LAYER (Phase 5)             │
│                                                         │
│  Backend spec → parse into endpoint/schema requirements │
│  Drizzle schema updater → add tables/columns            │
│  Route generator → Express routes + Zod validation      │
│  Migration runner → drizzle-kit push                    │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│                 QUALITY LAYER (Phase 6)                 │
│                                                         │
│  TDD skill → write + run tests for new code             │
│  systematic-debugging → fix failures                    │
│  code-review skills → automated review pass             │
│  verification-before-completion → confirm passing       │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│               ANALYTICS LAYER (Phase 7)                 │
│                                                         │
│  posthog-instrumentation → event tracking per page      │
│  posthog:flags → feature flag setup                     │
│  posthog:errors → error tracking hooks                  │
│  posthog:dashboards → baseline dashboard config         │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│               DELIVERY LAYER (Phase 8-9)                │
│                                                         │
│  git-worktrees → isolate feature work                   │
│  finishing-branch → merge/PR decisions                  │
│  gsd:ship → PR workflow                                 │
│  hosting skill → Docker/CI/CD/VPS deploy config         │
└─────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Inputs | Outputs | Communicates With |
|-----------|---------------|--------|---------|-------------------|
| **Orchestrator** (`/saas-dev`) | Pipeline driver. Reads state, decides next phase, invokes the right skill, advances state. | User invocation, optional spec doc or repo path | State transitions, skill invocations | All other components via state file |
| **State File** (`.saas-dev-state.json`) | Single source of truth for current run. Phase tracking, page index, approval history, error state. | Writes from orchestrator | Reads by all skills | Orchestrator, all phase skills |
| **Spec Layer** (`spec-collab` skill) | Spec creation or ingestion. Parses input into structured `PageSpec[]` JSON — name, route, components, data requirements, auth protection. | Pasted spec doc or nothing (triggers collaboration) | `PageSpec[]` written to state file | Orchestrator |
| **Design Memory DB** (Neon PostgreSQL) | Persistent cross-run context. Stores approved design tokens, component patterns, layout decisions, Stitch project ID. | Approved page data after each generation + approval | Design context JSON for prompt construction | UI Generation Layer, Self-Review component |
| **Stitch SDK Client** | Programmatic UI generation. Creates/references project, generates one page at a time, fetches HTML + screenshot. | `PageSpec`, design context prompt, Stitch project ID | Raw HTML, screenshot URL | UI Generation Layer |
| **Self-Review Component** | Quality gate before human escalation. Compares generated page against spec requirements and prior approved pages. | Generated HTML, PageSpec, design memory context | Confidence score + list of issues | Approval Gate |
| **Approval Gate** | Human-in-the-loop control. Page 1 always escalates. Subsequent pages escalate only when confidence is below threshold. | Confidence score, generated HTML, screenshot | Approved/rejected signal | Orchestrator (advances or retries) |
| **Code Integration Layer** (`code-integrator` skill) | Writes approved Stitch output into the actual repo. Brownfield-aware: checks before adding. | Approved HTML, PageSpec, repo path | Modified/created files, updated routes | Orchestrator, existing codebase |
| **Backend Wiring Layer** (`backend-wirer` skill) | Upgrades Express/Drizzle backend to serve new UI. Parses backend spec, generates routes + schema. | Backend PageSpec, existing schema | New routes, schema additions, migration files | Orchestrator, Drizzle schema, routes.ts |
| **Quality Layer** | Tests, debugging, code review. Autonomous loop — runs, fails, fixes, reruns until passing. | New files in repo | Test results, review output | Orchestrator (signals pass/fail) |
| **Analytics Layer** | PostHog instrumentation. Adds tracking per page, configures feature flags and dashboards. | Approved page list, PostHog API key | Instrumented files, PostHog project config | Orchestrator |
| **Delivery Layer** | Git workflow + deployment. Manages branches, PRs, Docker config, CI/CD, VPS deploy. | Clean, passing codebase | Git history, deployed app | Orchestrator, GitHub, hosting target |

---

## Data Flow

### Primary Data Flow (Happy Path)

```
User Input (spec doc or nothing)
    │
    ▼
spec-collab skill
    │
    └──► PageSpec[] → .saas-dev-state.json
                           │
                           ▼
                    [For each PageSpec]
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
    Design Memory DB              Stitch SDK Client
    (SELECT context)              (project.generate())
              │                         │
              └────────────┬────────────┘
                           │
                           ▼
                   Self-Review Component
                   (confidence score)
                           │
                    ┌──────┴──────┐
                    │             │
                HIGH conf      LOW conf / Page 1
                    │             │
                    ▼             ▼
               Auto-approve   Human approval gate
                    │             │
                    └──────┬──────┘
                           │
                           ▼
                   Design Memory DB
                   (INSERT approved context)
                           │
                           ▼
                   Code Integration Layer
                   (write files, update routes)
                           │
                           ▼
                   [Repeat for next page]
                           │
                           ▼
                   Backend Wiring Layer
                           │
                           ▼
                   Quality Layer (loop until passing)
                           │
                           ▼
                   Analytics Layer
                           │
                           ▼
                   Delivery Layer
```

### State File Shape

The state file is the nervous system of a run. Its schema determines what the orchestrator can read and decide.

```json
{
  "version": "1.0",
  "project": {
    "repoPath": "/path/to/repo",
    "stitchProjectId": "stitch-proj-xxx",
    "designMemoryProjectId": 42
  },
  "phase": "ui_generation",
  "pageSpecs": [
    { "name": "Dashboard", "route": "/dashboard", "components": [], "spec": "..." }
  ],
  "pages": {
    "Dashboard": {
      "status": "approved",
      "stitchScreenId": "screen-xxx",
      "htmlPath": ".saas-dev-output/dashboard.html",
      "screenshotUrl": "https://...",
      "approvedAt": "2026-03-25T12:00:00Z",
      "integrated": true
    }
  },
  "currentPageIndex": 0,
  "backend": {
    "spec": null,
    "status": "pending"
  },
  "quality": { "testsPass": false, "reviewPass": false },
  "analytics": { "status": "pending" },
  "delivery": { "branch": null, "prUrl": null },
  "errors": [],
  "history": []
}
```

### Design Memory DB Schema (Neon PostgreSQL)

```sql
-- One row per SaaS project
design_projects (
  id SERIAL PRIMARY KEY,
  repo_path TEXT NOT NULL,
  stitch_project_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- One row per approved page
design_pages (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES design_projects(id),
  page_name TEXT NOT NULL,
  route TEXT NOT NULL,
  stitch_screen_id TEXT,
  html_snapshot TEXT,       -- compressed HTML of approved page
  screenshot_url TEXT,
  approved_at TIMESTAMPTZ,
  prompt_used TEXT          -- what was sent to Stitch
)

-- Design token decisions extracted from approved pages
design_tokens (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES design_projects(id),
  token_type TEXT NOT NULL, -- 'color', 'spacing', 'typography', 'radius'
  token_name TEXT NOT NULL,
  token_value TEXT NOT NULL,
  extracted_from_page INT REFERENCES design_pages(id)
)

-- Reusable component patterns identified across pages
component_patterns (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES design_projects(id),
  component_name TEXT NOT NULL,
  pattern_description TEXT,
  first_seen_page INT REFERENCES design_pages(id)
)
```

---

## Orchestration Pattern

Claude Code skills do not invoke each other directly — Claude is the coordinator. The orchestrator skill instructs Claude to:

1. Read the state file
2. Determine current phase and sub-step
3. Invoke the appropriate skill (which loads into Claude's context)
4. Execute that skill's instructions against the current state
5. Write results back to state file
6. Advance to next step

This is the **sequential chain pattern** with **conditional routing** at approval gates and **iterative loop** at the quality layer. All three patterns are well-established in Claude Code skill collaboration.

The orchestrator SKILL.md is the system's core — it is a long, phase-aware instruction set that Claude follows deterministically, with branching logic expressed in natural language and validated via state file reads.

---

## Key Architectural Decisions

### Decision 1: JSON State File Over In-Memory State

State lives in `.saas-dev-state.json` in the repo root (gitignored), not in Claude's context window. This enables:
- Pause and resume at any point
- Interrupt and inject feedback
- Crash recovery without restart
- History replay for debugging

The state file IS the session. Claude reads it at the start of every orchestrator invocation.

### Decision 2: Stitch Project Persistence

The same Stitch project ID is reused across the entire UI generation run. Stitch's project scope provides native consistency — screens within one project share context. This is the primary mechanism for UI cohesion, supplemented by the design memory database for explicit token extraction.

### Decision 3: Design Memory as Prompt Augmentation

The Neon PostgreSQL database does not enforce design decisions — it informs them. When generating a new page, the orchestrator queries the DB for existing tokens and patterns, formats them into a structured context block, and prepends it to the Stitch generation prompt. This is a retrieval-augmented generation pattern applied to UI consistency.

### Decision 4: Self-Review Before Escalation

The orchestrator runs a structured self-review pass after each generation before touching the user. The review checks:
- Does the generated HTML contain all components specified in the PageSpec?
- Does the visual style match the previously approved pages (via token comparison)?
- Are there obvious spec violations?

Only if the review produces unresolved issues does the system escalate. This is the core UX differentiator — the human is only interrupted when needed.

### Decision 5: Brownfield-First Integration

Before writing any file, the code integration layer runs `gsd:map-codebase` and checks existing routes, component names, and imports. It never creates a file that already exists without explicit user approval. It never adds a route that conflicts with an existing one. This prevents the most common failure mode in automated code generation: duplication and breakage in partially-built repos.

### Decision 6: Quality Loop Is Autonomous

The quality layer does not ask the user for help on test failures — it uses systematic-debugging to diagnose and fix autonomously. It exits only when all tests pass or after a configurable maximum attempt count (default: 3 cycles), at which point it escalates with a structured failure report.

---

## Component Build Order

Build order is determined by data dependencies and verification requirements. Each layer depends on the contracts of the layer below it.

```
1. Design Memory DB schema + migrations
   └── Required by: UI Generation Layer, Self-Review
   └── Dependency: None (pure infrastructure)

2. Stitch SDK wrapper (thin TypeScript client)
   └── Required by: UI Generation Layer
   └── Dependency: STITCH_API_KEY, design memory schema

3. State file schema + orchestrator skeleton
   └── Required by: All skills
   └── Dependency: Finalized phase list (this architecture doc)

4. Spec Layer (spec-collab skill)
   └── Required by: Orchestrator Phase 1
   └── Dependency: State file schema

5. UI Generation Layer (stitch-generator skill)
   └── Required by: Orchestrator Phase 3
   └── Dependency: Stitch SDK wrapper, Design Memory DB, State schema

6. Self-Review Component (inline in stitch-generator)
   └── Required by: Approval Gate
   └── Dependency: Design Memory DB query, generated HTML, PageSpec

7. Approval Gate (inline in orchestrator)
   └── Required by: Code Integration Layer
   └── Dependency: Self-review output

8. Code Integration Layer (code-integrator skill)
   └── Required by: Orchestrator Phase 4
   └── Dependency: Approved HTML, existing codebase map

9. Backend Wiring Layer (backend-wirer skill)
   └── Required by: Orchestrator Phase 5
   └── Dependency: UI integration complete, backend spec

10. Quality Layer (thin orchestrator over existing TDD/debug skills)
    └── Required by: Analytics Layer
    └── Dependency: Wired backend, all code integrated

11. Analytics Layer (thin orchestrator over PostHog skills)
    └── Required by: Delivery Layer
    └── Dependency: Passing quality layer

12. Delivery Layer (thin orchestrator over git/deploy skills)
    └── Required by: User
    └── Dependency: Analytics instrumented, quality passing
```

The **critical path** is: DB schema → Stitch wrapper → State schema → Spec layer → UI generation loop → Code integration. Everything else (backend wiring, quality, analytics, delivery) is downstream. Unblocking UI generation loop in Phase 1 is the highest priority.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Generating All Pages at Once

**What:** Calling Stitch for all pages before reviewing any of them.
**Why bad:** No opportunity to correct direction after page 1. Design drift compounds across pages. User has no control point until everything is broken.
**Instead:** Generate one page, review, approve, store context, then proceed to the next.

### Anti-Pattern 2: Storing Design Context in Claude's Context Window

**What:** Passing the full HTML of all prior pages as context for the next Stitch call.
**Why bad:** Context window bloat. Stitch does not accept prior HTML — it accepts prompts. HTML is unreadable as a design specification.
**Instead:** Extract design tokens and component patterns into the DB. Pass structured token descriptions to Stitch prompts.

### Anti-Pattern 3: One Monolithic Orchestrator Skill

**What:** A single SKILL.md with thousands of lines of instructions for every phase.
**Why bad:** Exceeds what Claude can reliably follow in one context. No testability per phase. Changes to one phase risk breaking others.
**Instead:** Orchestrator SKILL.md is phase-aware and delegates to focused sub-skills. Each skill handles one responsibility and has its own SKILL.md.

### Anti-Pattern 4: Skipping Brownfield Check

**What:** Writing files and routes without checking what already exists.
**Why bad:** Duplicate routes in Express crash the server. Duplicate React components create naming conflicts. Re-creating existing database tables destroys data.
**Instead:** `gsd:map-codebase` runs before every code write. Diff against existing structure. Only add what is missing.

### Anti-Pattern 5: Hardcoding Framework Assumptions

**What:** Writing integration code that assumes Wouter for routing or shadcn/ui for components.
**Why bad:** The system must be reusable across projects. Hardcoded assumptions break on any repo that uses React Router or a different component library.
**Instead:** The spec layer detects the existing stack from `package.json` and `tsconfig.json`. The code integrator uses detected conventions, not assumed ones. v1 targets React + Vite explicitly, but the detection layer is built from the start.

---

## Scalability Considerations

This is a personal development tool. Scalability means: works cleanly across multiple projects without contamination, not concurrent users.

| Concern | Now (personal) | Future (productized) |
|---------|----------------|---------------------|
| State isolation | One state file per repo, gitignored | Per-user session storage, project IDs |
| Design memory | One Neon DB, namespaced by repo path | Per-tenant DB, schema isolation |
| Stitch API rate limits | One generation at a time, sequential | Fan-out with rate limiter (p-limit) |
| Skill invocation concurrency | Sequential, safe | Parallel agents with independent context |
| Interruption recovery | State file resume | Same pattern, add checkpoint timestamps |

---

## Sources

- Stitch SDK official repo: [github.com/google-labs-code/stitch-sdk](https://github.com/google-labs-code/stitch-sdk)
- Stitch SDK deep reference: [deepwiki.com/google-labs-code/stitch-sdk](https://deepwiki.com/google-labs-code/stitch-sdk)
- Claude Code skills official docs: [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)
- Skill collaboration chaining patterns: [mindstudio.ai/blog/claude-code-skill-collaboration-chaining-workflows](https://www.mindstudio.ai/blog/claude-code-skill-collaboration-chaining-workflows)
- Skill structure internals: [mikhail.io/2025/10/claude-code-skills](https://mikhail.io/2025/10/claude-code-skills/)
- Existing codebase architecture: `.planning/codebase/ARCHITECTURE.md`
- Existing stack: `.planning/codebase/STACK.md`
