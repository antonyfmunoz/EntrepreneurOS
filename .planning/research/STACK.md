# Technology Stack

**Project:** SaaS Development Automation System (Claude Code Skills)
**Researched:** 2026-03-25
**Overall confidence:** MEDIUM-HIGH (Stitch SDK is recent/evolving; skill/subagent system is fully verified against live docs)

---

## Recommended Stack

### Claude Code Skill System

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Claude Code Skills (`SKILL.md`) | Current (live docs verified) | Primary delivery mechanism — each pipeline phase is a skill | Native to Claude Code, supports frontmatter, supporting files, shell injection, and subagent delegation. No custom runtime needed. |
| Claude Code Subagents (`AGENT.md`) | Current (live docs verified) | Specialized workers for parallel phases (e.g., Stitch generation, backend wiring, test running) | Subagents run in isolated context windows with their own tool restrictions, model selection, and persistent memory. Critical for keeping pipeline phases from polluting each other's context. |
| Skill `context: fork` + `agent` field | Current | Run complex phases in isolated subagent from a skill | Allows a skill to be both user-invocable via `/skill-name` AND delegate execution to a fresh subagent context without requiring the user to manage agents directly. |
| `.claude/skills/` (project scope) | Current | Store all pipeline skills in the repo | Skills at `.claude/skills/` are version-controlled and available project-wide. Personal skills at `~/.claude/skills/` available across all SaaS repos. |

**Skill invocation pattern for this system:** User invokes one top-level orchestrator skill (e.g., `/saas-build`). The orchestrator dispatches subagents for each phase. Each subagent has the right tools, the right model, and the right pre-loaded skills injected via the `skills` field.

---

### Google Stitch Integration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@google/stitch-sdk` | Latest (npm) | Call Stitch API to generate UI screens from prompts | Official SDK. Supports `project.generate(prompt)`, `screen.edit(prompt)`, `screen.getHtml()`, `screen.getImage()`. TypeScript-native. |
| Stitch MCP server (`stitch.googleapis.com`) | Current | Alternative: MCP-native integration via `npx @_davideast/stitch-mcp` | If using MCP path instead of SDK, scoped to a subagent's `mcpServers` field. MCP path requires no npm install in project; SDK path is more explicit and scriptable. **Recommendation: use SDK for skill scripts, MCP for interactive sessions.** |
| `STITCH_API_KEY` env var | — | Authentication | SDK reads automatically. Store in `.env`, reference in skill shell injection. |
| `DeviceType: "DESKTOP"` | — | Target device for generated screens | SaaS products are desktop-primary. Pass explicitly on every `generate()` call. |
| `ModelId: "GEMINI_3_PRO"` | — | Model tier for generation | Use PRO for first-page generation (sets design direction). Use FLASH for subsequent pages (faster, cheaper, feeds on established context). |

**Stitch API contract (verified against official SDK docs):**
```typescript
import { stitch } from "@google/stitch-sdk";

// One project per SaaS product
const project = stitch.project(projectId);

// Generate first screen
const screen = await project.generate(pagePrompt, "DESKTOP");

// Get integration artifacts
const htmlUrl = await screen.getHtml();   // returns download URL
const imgUrl  = await screen.getImage();  // returns screenshot URL

// Iterate on a screen
const revised = await screen.edit(feedbackPrompt, "DESKTOP", "GEMINI_3_PRO");

// Generate design variants for first page direction-setting
const variants = await screen.variants(
  "Explore layout options",
  { variantCount: 3, creativeRange: "EXPLORE", aspects: ["LAYOUT", "COLOR_SCHEME"] },
  "DESKTOP"
);
```

**What Stitch does NOT return directly:** Raw HTML string — `getHtml()` returns a download URL. The skill script must fetch from that URL to get the actual HTML content before integrating it into the repo.

---

### Design Consistency Memory (Neon PostgreSQL)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Neon PostgreSQL (serverless) | Existing project DB | Store approved page context: design tokens, component patterns, layout decisions | Already in use. Serverless = no persistent connection required from skill scripts. Zero cold-start overhead for skill execution. |
| `@neondatabase/serverless` | `^0.10.4` (current in project, latest stable is `1.0.2`) | Connect from skill scripts without a persistent server | HTTP-mode queries. No WebSocket setup needed for skill scripts that run and exit. |
| `drizzle-orm` | `^0.39.1` (project current, 0.45.x is latest stable) | Type-safe schema and query layer | Already in stack. Define a `design_context` table for approved page specs. |
| `drizzle-kit` | `^0.30.4` (project current) | Migration management | Run `drizzle-kit push` to apply new `design_context` table. |

**Recommended `design_context` table shape:**
```sql
CREATE TABLE design_context (
  id          SERIAL PRIMARY KEY,
  project_id  TEXT NOT NULL,        -- stitch project ID
  page_key    TEXT NOT NULL,        -- e.g. "dashboard", "settings"
  page_order  INTEGER NOT NULL,     -- generation sequence
  html_url    TEXT,                 -- stitch-returned download URL
  screenshot_url TEXT,              -- stitch-returned screenshot URL
  design_tokens  JSONB,             -- extracted color/typography tokens
  component_patterns JSONB,         -- shadcn components used, props observed
  layout_decisions   JSONB,         -- grid, spacing, nav patterns
  spec_text   TEXT,                 -- original page spec that generated it
  approved_at TIMESTAMPTZ DEFAULT NOW()
);
```

This table is queried at the start of each Stitch call so the prompt can reference `"previously approved pages used shadcn Card with dark background, 16px body, Inter font"` — maintaining visual cohesion without re-sending full HTML every call.

---

### Skill Script Runtime (for Stitch calls and DB writes)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TypeScript + `tsx` | `tsx ^4.19.1` (already in project) | Execute skill scripts (Stitch SDK, Neon writes) from within skills via `!` shell injection | `tsx` already installed. Run TypeScript scripts directly: `npx tsx scripts/generate-screen.ts`. No compile step needed. |
| Node.js 20+ | Project runtime | Script execution environment | Already the project runtime. `@neondatabase/serverless` v1.x requires Node 19+; project is on Node 20 per types. |
| `zod` | `^3.25.76` (already in project) | Validate Stitch API responses and spec parsing | Already installed. Use for spec document schema and Stitch response shapes. |

**Do NOT use:** Python scripts for Stitch integration. The SDK is TypeScript-native. Mixing runtimes creates unnecessary setup complexity inside skills.

---

### Spec Parsing and Pipeline State

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `zod` | Existing | Parse and validate spec documents (UI spec, backend spec) | Define a `PageSpec` schema, validate user-provided spec text before sending to Stitch. |
| Skill `$ARGUMENTS` substitution | Native | Pass spec file path or mode flag to orchestrator skill | `$ARGUMENTS` is the only input channel for skill invocations. Keep the API surface simple: path to spec file, or nothing (triggers collaboration mode). |
| CLAUDE.md + session notes | Native | Pipeline state between phases | For multi-phase runs (UI gen → backend wiring → testing → deploy), write phase completion notes to `.claude/notes/` or a simple `pipeline-state.json`. Skills read this on resume. |

---

### Existing Stack (already in project — no changes)

| Technology | Current Version | Role in System |
|------------|----------------|----------------|
| React 18 + Vite 5 | `^18.3.1` / `^5.4.15` | Target framework for generated/integrated code |
| Tailwind CSS 3 | `^3.4.14` | Stitch output will be Tailwind-compatible (shadcn/ui uses Tailwind) |
| shadcn/ui (Radix) | Various `^1.x` | Component system; Stitch has explicit `shadcn-ui` skill guidance in google-labs-code/stitch-skills |
| Express 4 | `^4.21.2` | Backend wiring target |
| Drizzle ORM + Neon | `^0.39.1` / `^0.10.4` | DB layer for both app and design memory |
| Passport.js + sessions | `^0.7.0` | Auth — skills must preserve existing session setup when wiring backend |
| TanStack Query 5 | `^5.60.5` | Data fetching — generated pages must use this pattern |
| Wouter 3 | `^3.3.5` | Routing — generated pages registered here |
| Zod 3 | `^3.25.76` | Validation — backend routes must use Zod schemas |

---

### Testing (per-phase verification)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest | Not yet installed — add | Unit and integration tests for generated code | Vite-native, fast, compatible with existing build setup. Use `vitest` not Jest — zero config with Vite 5. |
| `@testing-library/react` | Not yet installed — add with Vitest | Component testing for generated UI | Standard for React components. Works with Vitest. |
| Playwright | Not in project yet | E2E tests for full flows | Add only if the system needs to verify deployed pages, not required for MVP skill build. |

**Note on existing test setup:** The project has no test runner currently. The `/superpowers:test-driven-development` skill assumes one exists. The system build must include a Vitest setup phase.

---

### Deployment Automation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Docker + Docker Compose | Existing VPS setup | Container build and deployment | Already used in OS repo. Skills write/update Dockerfile and `docker-compose.yml`. |
| GitHub Actions | — | CI/CD pipeline automation | Standard. Skills generate workflow YAML (`/.github/workflows/`). Triggers on PR merge or tag push. |
| Existing VPS (Tailscale network) | — | Primary deploy target | Already set up. Skills automate `docker compose pull && up -d`. |
| Replit Autoscale | — | Alternative deploy target for SaaS products | Already used. Skills handle Replit deploy steps as a separate path. |

**Skills do not pick the hosting target** — they guide the user to choose (VPS vs Replit vs cloud), then execute the full setup for the chosen path. This is the "guided setup" requirement from the spec.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Stitch integration | `@google/stitch-sdk` (npm) | Stitch MCP server | MCP is better for interactive sessions; SDK is better for scripted skill execution where we need explicit control over project/screen IDs and want to store return values in DB |
| DB for design memory | Neon PostgreSQL (existing) | Local JSON files | JSON files can't be queried across sessions cleanly; Neon is already provisioned; JSONB queries for token matching are more powerful |
| Script runtime | `tsx` (existing) | Python | SDK is TypeScript-only; adding Python runtime to skill scripts creates unnecessary setup complexity |
| Test runner | Vitest | Jest | Vite 5 is the build tool; Vitest is zero-config with it; Jest requires config to handle ESM modules |
| CI/CD | GitHub Actions | Manual deploy scripts | Skills should produce a proper CI/CD artifact, not a bash one-shot; GH Actions is already present in the dev environment context |
| State between phases | `pipeline-state.json` | Neon DB table | File is simpler and faster for ephemeral pipeline state; DB is for durable design context only |

---

## Installation (net new additions only)

```bash
# Stitch SDK
npm install @google/stitch-sdk

# Testing (not currently in project)
npm install -D vitest @testing-library/react @testing-library/user-event jsdom

# Note: @neondatabase/serverless, drizzle-orm, tsx, zod are already installed
```

**Update `@neondatabase/serverless`** from `^0.10.4` to `^1.0.2` when ready — v1.x has breaking changes (Node 19+ required, confirmed on Node 20). Not required for MVP.

---

## Skill File Structure (recommended layout)

```
.claude/
  skills/
    saas-build/                    # Master orchestrator skill
      SKILL.md
      scripts/
        parse-spec.ts              # Zod-validated spec ingestion
        generate-screen.ts         # Stitch SDK calls
        write-design-context.ts    # Neon writes after approval
        read-design-context.ts     # Neon reads for prompt enrichment
      resources/
        spec-template.md           # Blank spec template for collaboration mode
        page-prompt-template.md    # Stitch prompt structure guide
    saas-ui-phase/                 # UI generation subphase skill
      SKILL.md
    saas-backend-phase/            # Backend wiring subphase skill
      SKILL.md
    saas-deploy/                   # Deployment phase skill
      SKILL.md
  agents/
    stitch-generator.md            # Subagent: Stitch calls + design memory writes
    backend-wirer.md               # Subagent: Express routes + Drizzle schema
    test-runner.md                 # Subagent: Vitest + fix failures
    deploy-agent.md                # Subagent: Docker/GH Actions setup
```

**Personal skills** (reusable across all SaaS repos) go in `~/.claude/skills/`. Project skills (EntrepreneurOS-specific) go in `.claude/skills/`. The orchestrator and phase skills should be personal; deploy configs with project specifics should be project-scoped.

---

## Sources

- [Stitch SDK GitHub (google-labs-code/stitch-sdk)](https://github.com/google-labs-code/stitch-sdk) — HIGH confidence (official)
- [Stitch Skills GitHub (google-labs-code/stitch-skills)](https://github.com/google-labs-code/stitch-skills) — HIGH confidence (official)
- [Google Stitch MCP (davideast/stitch-mcp)](https://github.com/davideast/stitch-mcp) — MEDIUM confidence
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) — HIGH confidence (official, live docs)
- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents) — HIGH confidence (official, live docs)
- [@neondatabase/serverless npm](https://www.npmjs.com/package/@neondatabase/serverless) — HIGH confidence
- [Drizzle ORM latest releases](https://orm.drizzle.team/docs/latest-releases) — MEDIUM confidence (beta in progress)
- [Google Stitch announcement (Google Developers Blog)](https://developers.googleblog.com/stitch-a-new-way-to-design-uis/) — HIGH confidence
