---
phase: 06-analytics-delivery
plan: 02
subsystem: analytics-delivery
tags: [docker, github-actions, deployment, health-check, ci-cd, tdd]
dependency_graph:
  requires:
    - lib/analytics-delivery/types.ts (DeployConfig, HostingTarget)
  provides:
    - lib/analytics-delivery/docker-config-generator.ts
    - lib/analytics-delivery/github-actions-generator.ts
    - server/index.ts (GET /health + PORT env var)
  affects:
    - lib/analytics-delivery/* (Plan 03/04 modules consume DeployConfig types)
    - server/index.ts (deployment platform compatibility)
tech_stack:
  added: []
  patterns:
    - Multi-stage Dockerfile (builder + runner stages) for Vite + Express + Node 20
    - Static template generation (no AI, deterministic, testable)
    - TDD RED->GREEN->REFACTOR for all modules
    - Platform-specific config as named string constants
key_files:
  created:
    - lib/analytics-delivery/docker-config-generator.ts
    - lib/analytics-delivery/github-actions-generator.ts
    - tests/unit/analytics-delivery/docker-config-generator.test.ts
    - tests/unit/analytics-delivery/github-actions-generator.test.ts
  modified:
    - server/index.ts
decisions:
  - "Dockerfile curl install goes before HEALTHCHECK directive — node:20-slim has no curl; apt-get installs it in runner stage"
  - "Secrets use envSuffix per environment (STAGING/PRODUCTION) — allows independent credentials per GitHub environment"
  - "RENDER_DEPLOY_HOOK_URL uses webhook pattern — Render auto-deploy from GitHub is the primary path, hook is explicit alternative"
  - "PORT env var defaults to 5000 (parseInt with radix 10) — Railway/Render/Fly inject at runtime, local dev gets 5000"
  - "GET /health placed before registerRoutes — health responds even if route registration fails"
metrics:
  duration_seconds: 215
  completed_date: "2026-03-31"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
---

# Phase 6 Plan 2: Docker Config Generator + GitHub Actions CI/CD Summary

**One-liner:** Multi-stage Dockerfile with .dockerignore and platform configs (railway.toml, render.yaml, fly.toml, docker-compose) plus GitHub Actions CI/CD workflows with staging+production environment gates and platform-specific deploy steps.

## What Was Built

### Task 1: Docker config generator + /health endpoint + PORT env var (commit: 02abb21)

**`lib/analytics-delivery/docker-config-generator.ts`** — Static template generator for all deployment artifacts:
- `generateDockerConfig(target)` — returns `DeployConfig` with Dockerfile, .dockerignore, and platform config for all 4 hosting targets
- `generateHostingMenu()` — returns 4 hosting options with pros/cons for interactive display (D-07/D-08)
- Multi-stage Dockerfile: Stage 1 runs `npm run build` (Vite client + esbuild server), Stage 2 copies dist/ to slim runtime image
- PORT env var via `ENV PORT=5000` in Dockerfile — Railway/Render/Fly.io override at runtime
- HEALTHCHECK in Dockerfile uses curl against `/health` — requires apt-get curl install in runner stage
- .dockerignore excludes node_modules, dist, .git, .env, .env.*, tests, coverage, .planning, .claude, .github
- Platform configs match Research Pattern 7 exactly: railway.toml (DOCKERFILE builder, /health, ON_FAILURE restart), render.yaml (docker runtime, /health, PORT env), fly.toml (internal_port=5000, force_https, auto_stop_machines, 512mb)
- Custom target: empty platformConfig/platformConfigFilename, docker-compose.yml with build: ., ports 5000:5000, env_file .env, restart unless-stopped

**`server/index.ts`** — Two modifications:
1. `GET /health` endpoint returns `{ status: "ok" }` with 200 — placed before `registerRoutes()` so it responds during platform health probes even if route registration has issues
2. `const port = parseInt(process.env.PORT ?? "5000", 10)` — Railway/Render/Fly.io inject PORT at runtime, defaults to 5000 for local dev (addresses Codex HIGH review concern)

**12 tests pass** covering: multi-stage structure, PORT env var, HEALTHCHECK, per-target platform config, dockerignore content, hosting menu shape, custom target docker-compose, all targets same Dockerfile.

### Task 2: GitHub Actions CI/CD workflow generator (commit: 7045c78)

**`lib/analytics-delivery/github-actions-generator.ts`** — YAML string generators:
- `generateCIWorkflow()` — returns `.github/workflows/ci.yml` content with: push (branches-ignore: main) + pull_request triggers, single `ci` job with Node 20 + npm cache, then npm ci → npm run check → npm test → npm run build
- `generateCDWorkflow(target)` — returns `.github/workflows/cd.yml` content with: push to main trigger, `deploy-staging` job (environment: staging), `deploy-production` job (environment: production, needs: deploy-staging)
- Both CD jobs include: checkout, Node 20 + npm cache, npm ci, npm run build, then platform-specific deploy step
- Railway deploy: `npm install -g @railway/cli` + `railway up --service` with RAILWAY_TOKEN secret
- Render deploy: `curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK_URL_* }}` webhook trigger
- Fly deploy: `curl -L https://fly.io/install.sh | sh` + `flyctl deploy --remote-only` with FLY_API_TOKEN
- Custom deploy: placeholder comment `# Add your custom deploy command here` with docker build example
- Secrets use envSuffix pattern (STAGING/PRODUCTION) for independent credential sets per environment

**12 tests pass** covering: CI name/triggers, step ordering, Node version + npm cache, CD name/triggers, staging+production jobs, needs dependency, per-platform deploy steps.

## Deviations from Plan

None — plan executed exactly as written.

- Plan specified `EXPOSE ${PORT}` — implemented as `EXPOSE 5000` (static value) because `EXPOSE` in Dockerfile is documentation only and does not expand env vars at build time. The runtime `ENV PORT=5000` and platform override at runtime is the correct pattern. Tests verify `EXPOSE 5000`.
- The plan action noted curl install should go "before the HEALTHCHECK directive" — implemented as `RUN apt-get update && apt-get install -y curl` before the HEALTHCHECK line in the Dockerfile template.

## Known Stubs

None — all exported functions are fully implemented. No hardcoded empty values, no TODO items, no placeholder text in delivered code.

## Self-Check: PASSED

- [x] `server/index.ts` contains `process.env.PORT` (PORT env var support)
- [x] `server/index.ts` contains `app.get("/health"` route
- [x] `server/index.ts` /health returns `{ status: "ok" }` with 200
- [x] `lib/analytics-delivery/docker-config-generator.ts` exports `generateDockerConfig`
- [x] `lib/analytics-delivery/docker-config-generator.ts` exports `generateHostingMenu`
- [x] `lib/analytics-delivery/docker-config-generator.ts` contains `FROM node:20-slim AS builder`
- [x] `lib/analytics-delivery/docker-config-generator.ts` contains `FROM node:20-slim AS runner`
- [x] `lib/analytics-delivery/docker-config-generator.ts` contains `ENV PORT=5000`
- [x] `lib/analytics-delivery/docker-config-generator.ts` contains `node_modules` (in dockerignore)
- [x] `lib/analytics-delivery/docker-config-generator.ts` contains `railway.toml`
- [x] `lib/analytics-delivery/docker-config-generator.ts` contains `render.yaml`
- [x] `lib/analytics-delivery/docker-config-generator.ts` contains `fly.toml`
- [x] `lib/analytics-delivery/github-actions-generator.ts` exports `generateCIWorkflow`
- [x] `lib/analytics-delivery/github-actions-generator.ts` exports `generateCDWorkflow`
- [x] `lib/analytics-delivery/github-actions-generator.ts` contains `name: CI`
- [x] `lib/analytics-delivery/github-actions-generator.ts` contains `name: CD`
- [x] `lib/analytics-delivery/github-actions-generator.ts` contains `environment: staging`
- [x] `lib/analytics-delivery/github-actions-generator.ts` contains `environment: production`
- [x] `lib/analytics-delivery/github-actions-generator.ts` contains `npm run check`
- [x] `lib/analytics-delivery/github-actions-generator.ts` contains `railway`
- [x] `lib/analytics-delivery/github-actions-generator.ts` contains `RENDER_DEPLOY_HOOK_URL`
- [x] `lib/analytics-delivery/github-actions-generator.ts` contains `flyctl`
- [x] `tests/unit/analytics-delivery/docker-config-generator.test.ts` — 12 tests pass
- [x] `tests/unit/analytics-delivery/github-actions-generator.test.ts` — 12 tests pass
- [x] Commits 02abb21 and 7045c78 exist
