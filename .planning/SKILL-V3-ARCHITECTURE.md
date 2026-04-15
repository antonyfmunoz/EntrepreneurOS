# V3 Multi-Agent Architecture

## Overview

A 9-agent team coordinated by a PM Orchestrator that takes a SaaS product from spec document to deployed, tested, hosted application. Agents communicate exclusively through an ArtifactStore backed by typed JSON files under `.planning/artifacts/`. Each agent reads its upstream artifacts, executes its domain-specific work, and writes its output artifact for downstream consumers. The PM Orchestrator manages wave-based execution, error recovery, live progress reporting, and human approval gates.

## Agent Team

### 1. Product Intelligence Agent

Analyzes the product category from the intake brief, researches competitors via the competitive researcher, and produces actionable recommendations for design, copy, and architecture. Outputs a `ProductInsights` artifact containing target user profile, market positioning, and per-domain recommendation lists.

**Reads:** `ProjectBrief`
**Writes:** `ProductInsights`

### 2. Architecture Agent

Designs the full system structure: data model (entities, relationships, enums), API contracts (method, path, request/response shapes, validation rules, auth requirements), page structure (routes, auth levels, components, data needs, mutations), and component hierarchy (props, dependencies, page usage). Incorporates architecture recommendations from Product Intelligence.

**Reads:** `ProjectBrief`, `ProductInsights`
**Writes:** `SystemArchitecture`

### 3. Design System Agent

Generates design tokens (colors, typography, spacing, border radius, shadows, breakpoints), a Tailwind config extension, CSS custom properties file, and a component design guide. Incorporates design recommendations from Product Intelligence and the product aesthetic from the brief.

**Reads:** `ProjectBrief`, `ProductInsights`
**Writes:** `DesignSystem`

### 4. Copy Agent

Infers brand voice from the brief and product insights, generates all cross-page copy (headlines, CTAs, descriptions, empty states, error messages), and reviews output for tone consistency. Incorporates copy recommendations from Product Intelligence.

**Reads:** `ProjectBrief`, `ProductInsights`, `SystemArchitecture`
**Writes:** `ProjectCopy` (contains per-page `PageCopy` entries)

### 5. Component Library Agent

Builds shared components referenced by the component hierarchy. Runs each component through the validation pipeline (TypeScript check, import validation, null safety). Extracts and publishes typed `ComponentInterface` records so the Page Agent can import components with correct props.

**Reads:** `SystemArchitecture`, `DesignSystem`, `ProjectCopy`
**Writes:** `ComponentInterface[]` (one per shared component, includes file path, export name, and full prop definitions)

### 6. Page Agent

Builds individual pages with full context from every upstream agent. For each page defined in the architecture, the agent receives the page structure, relevant API contracts, component interfaces, design tokens, and page-specific copy. Runs each generated page through TypeScript compilation, import validation, and screenshot review. Outputs a `PageOutput` per page with review score, fix attempts, and pass/fail status. Executes with `p-limit(5)` concurrency.

**Reads:** `SystemArchitecture`, `DesignSystem`, `ProjectCopy`, `ComponentInterface[]`
**Writes:** `PageOutput[]`

### 7. Backend Agent

Generates the Drizzle ORM schema from the data model, Express route handlers from the API contracts, and storage layer CRUD functions from entity definitions. Each generated route maps to its contract, and the agent tracks schema generation and migration file paths per entity.

**Reads:** `SystemArchitecture`, `ProductInsights`
**Writes:** `BackendRoute[]`

### 8. QA Agent

Runs full-project TypeScript compilation, validates all imports against the allowlist, checks every API call against its contract, verifies loading/error/empty states exist per page, and scans for null safety issues. Operates in an auto-fix loop: detect issues, apply fixes, re-check, repeat until clean or max iterations reached. Produces a `QAReport` with per-page results.

**Reads:** All artifacts (full project state)
**Writes:** `QAReport`

### 9. PM Orchestrator

Coordinates the entire build. Manages the `BuildState` (current phase, completed/running/failed agents, checkpoints). Launches agents in waves, handles retries on failure (up to configured max), writes `build-status.json` to `public/` for the browser overlay, and gates the build at approval points. Produces the final `BuildResult` or `EditResult`.

**Reads:** All artifacts, `BuildState`
**Writes:** `BuildState`, `BuildStatus`, `BuildResult` or `EditResult`

## Execution Order

```
Wave 1: Product Intelligence
         (runs after intake brief is captured)
              |
    ┌─────────┴─────────┐
    v                     v
Wave 2: Architecture    Design System
         (parallel, both read ProductInsights)
              |                |
    ┌─────────┴────────────────┘
    v
Wave 3: Copy            Component Library
         (parallel, both read Architecture + DesignSystem)
              |                |
    ┌─────────┴────────────────┘
    v
Wave 4: Pages (p-limit 5)    Backend
         (parallel, Pages reads all Wave 3 output,
          Backend reads Architecture)
              |                |
    ┌─────────┴────────────────┘
    v
Wave 5: QA
         (runs after all Wave 4 agents complete)
```

Each wave completes fully before the next wave starts. Within a wave, agents run in parallel. The PM Orchestrator advances the `BuildPhase` at each wave boundary and writes a checkpoint to enable resume.

## Artifact Store

The ArtifactStore is the sole communication channel between agents. No agent calls another agent directly.

### Storage

- All artifacts live as JSON files under `.planning/artifacts/`
- Each artifact type maps to a deterministic filename (e.g., `product-insights.json`, `system-architecture.json`, `design-system.json`)
- Page-level artifacts use the page name as a key within a collection file (e.g., `page-outputs.json`)

### API

```typescript
// Typed get/set for each artifact type
store.get<ProductInsights>("product-insights")
store.set<ProductInsights>("product-insights", data)

// Collection operations for multi-item artifacts
store.getAll<PageOutput>("page-outputs")
store.append<PageOutput>("page-outputs", pageOutput)
```

### Consistency

- **Atomic writes:** Every `set` operation writes to a temporary file first, then renames it to the target path. This prevents partial reads by downstream agents.
- **Build status mirror:** After every artifact write, the store also updates `public/build-status.json` with the current `BuildStatus` so the browser overlay can display live progress without polling the file system.

### Artifact File Map

| Artifact Type | Filename | Writer |
|---|---|---|
| `ProjectBrief` | `project-brief.json` | Intake |
| `ProductInsights` | `product-insights.json` | Product Intelligence |
| `SystemArchitecture` | `system-architecture.json` | Architecture |
| `DesignSystem` | `design-system.json` | Design System |
| `ProjectCopy` | `project-copy.json` | Copy |
| `ComponentInterface[]` | `component-interfaces.json` | Component Library |
| `PageOutput[]` | `page-outputs.json` | Page Agent |
| `BackendRoute[]` | `backend-routes.json` | Backend |
| `QAReport` | `qa-report.json` | QA |
| `BuildState` | `build-state.json` | PM Orchestrator |
| `BuildStatus` | `public/build-status.json` | PM Orchestrator (mirror) |

## Quality Gates

Every build must pass these gates before the PM Orchestrator marks it complete:

1. **Zero TypeScript errors** -- `tsc --noEmit` exits clean across the entire project
2. **Import allowlist** -- every import resolves to a known project file, shared module, or approved dependency; no orphan or circular imports
3. **No null reference errors** -- all optional chains and nullable values are guarded before access
4. **State coverage** -- every page implements loading, error, and empty states for its data dependencies
5. **Contract matching** -- every frontend API call matches its corresponding `ApiContract` (method, path, request body shape, response shape)
6. **QA sign-off** -- the `QAReport.allPassed` field is `true` and `remainingIssues` is empty

If any gate fails, the QA Agent enters its auto-fix loop (up to max iterations). If issues remain after all iterations, the build is marked `failed` and the `BuildResult.errors` array contains every unresolved issue.

## Build Plan Approval Gate

After Wave 2 completes (Architecture + Design System), the PM Orchestrator assembles a `BuildPlan` containing the brief, insights, architecture, design system, and estimated counts for pages, endpoints, and components. This plan is presented to the human operator for approval before proceeding to Wave 3. The operator can approve, request modifications, or abort.

## Agent Lifecycle

Each agent is managed by the `agent-runner.ts` module, which provides:

- **Status tracking:** Every agent transitions through `AgentStatus` states: `pending` -> `running` -> `completed` | `failed` | `retrying`
- **Result wrapping:** Every agent output is wrapped in `AgentResult<T>` with the agent name, status, typed data (or null on failure), error message, duration in milliseconds, and retry count
- **Signal emission:** Agents emit `AgentSignal` events (`progress`, `warning`, `error`, `complete`) with timestamps for real-time progress reporting
- **Retry policy:** Failed agents retry up to the configured maximum. Each retry increments the counter and transitions status to `retrying` before returning to `running`

## Resume and Edit Modes

### Resume (`--resume`)

Reads the existing `BuildState` from `.planning/artifacts/build-state.json`, identifies the last completed checkpoint, and restarts execution from the next wave. Artifacts from completed waves are reused without re-running those agents.

### Edit (`--edit`)

Accepts a list of pages to regenerate. Loads all existing artifacts (architecture, design system, copy, component interfaces) as context, re-runs only the Page Agent for the specified pages, then runs the QA Agent on the modified files. Produces an `EditResult` with the list of edited pages and a scoped QA report.

## Entry Points

```bash
# New build -- starts from intake, runs all waves
npx tsx scripts/saas-dev-build.ts

# Resume -- picks up from last checkpoint
npx tsx scripts/saas-dev-build.ts --resume

# Edit mode -- regenerate specific pages
npx tsx scripts/saas-dev-build.ts --edit
```

## File Map

| File | Purpose |
|---|---|
| `lib/agents/types.ts` | All shared TypeScript interfaces for inter-agent communication |
| `lib/agents/artifact-store.ts` | Central artifact store with typed get/set, atomic writes, status mirroring |
| `lib/agents/agent-runner.ts` | Agent lifecycle management: status tracking, result wrapping, retries, signals |
| `lib/agents/product-intel-agent.ts` | Product Intelligence Agent -- category analysis, competitor research, recommendations |
| `lib/agents/architecture-agent.ts` | Architecture Agent -- data model, API contracts, page structure, component hierarchy |
| `lib/agents/design-system-agent.ts` | Design System Agent -- tokens, Tailwind config, CSS properties, component design guide |
| `lib/agents/copy-agent.ts` | Copy Agent -- brand voice inference, cross-page copy generation, consistency review |
| `lib/agents/component-library-agent.ts` | Component Library Agent -- shared component generation, validation, interface extraction |
| `lib/agents/page-agent.ts` | Page Agent -- per-page generation with full context, validation pipeline, screenshot review |
| `lib/agents/backend-agent.ts` | Backend Agent -- Drizzle schema, Express routes, storage layer generation |
| `lib/agents/qa-agent.ts` | QA Agent -- TypeScript check, import validation, contract matching, auto-fix loops |
| `lib/agents/pm-orchestrator.ts` | PM Orchestrator -- wave coordination, build state, approval gates, progress reporting |
| `scripts/saas-dev-build.ts` | CLI entry point for new build, resume, and edit modes |

## Type Dependency Graph

```
ProjectBrief (intake)
    |
    v
ProductInsights
    |
    ├──> SystemArchitecture
    |        |
    |        ├──> DataModel (entities, relationships, enums)
    |        ├──> ApiContract[]
    |        ├──> PageStructure[]
    |        └──> ComponentHierarchy[]
    |
    └──> DesignSystem
             |
             └──> DesignTokens

SystemArchitecture + DesignSystem + ProjectCopy
    |
    ├──> ComponentInterface[]
    ├──> PageOutput[]
    └──> BackendRoute[]

All artifacts
    |
    └──> QAReport
             |
             └──> QAIssue[]

BuildState (tracks everything)
    |
    ├──> BuildStatus (current phase, agent tracking)
    ├──> AgentResult<T>[] (per-agent results)
    └──> BuildResult | EditResult (final output)
```
