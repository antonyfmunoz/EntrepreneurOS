---
name: saas-dev:orchestrator
description: Orchestrates the SaaS development pipeline from spec to deployment. Routes to the correct phase-specific skill at each pipeline stage. Use when starting a new SaaS build or resuming an existing pipeline run.
---

# saas-dev:orchestrator

Orchestrates the complete SaaS development pipeline. Currently a skeleton -- phase-specific sub-skills are created in their respective phases (D-19).

## Pipeline Phases

1. spec -- Parse or collaboratively create a page spec, routes to saas-dev:spec-parser (Phase 2)
2. ui-gen -- Generate UI via Stitch with design memory, routes to saas-dev:ui-generator (Phase 3)
3. integration -- Integrate generated code into existing repo, routes to saas-dev:integrator (Phase 4)
4. backend -- Wire backend routes and schemas, routes to saas-dev:backend-wirer (Phase 5)
5. deploy -- Instrument analytics and deploy, routes to saas-dev:deployer (Phase 6)

## State Management

- Pipeline state persisted in Neon PostgreSQL (pipeline_runs + pipeline_pages tables) -- NOT in JSON files (D-06)
- Each page tracks its own checkpoint within each phase (D-07)
- Resuming a paused run continues from last completed page, not the beginning (D-09)
- Failed pages include an error field for retry context (D-10)

## Project Config

Required fields validated by ProjectConfigSchema in shared/design-schema.ts:

- `projectId` -- unique identifier for the project (min 1 char)
- `repoPath` -- absolute path to the project repository
- `framework` -- detected framework enum (currently only "react-vite-tailwind-shadcn")
- `stitchProjectId` -- (optional) Stitch project ID for UI generation phase

## Current Sub-Skills

- saas-dev:detect-framework
- saas-dev:spec-parser

## Usage

This skill is a Phase 1 skeleton. Full orchestration logic is implemented incrementally across phases 2-6. To start a pipeline run, provide a ProjectConfig and call the appropriate phase-specific sub-skill directly until the orchestrator is wired up in Phase 2.
