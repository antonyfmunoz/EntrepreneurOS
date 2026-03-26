# Project Research Summary

**Project:** SaaS Development Automation System (Claude Code Skills)
**Domain:** AI-driven spec-to-deployment pipeline — Claude Code skill orchestration with Google Stitch UI generation
**Researched:** 2026-03-25
**Confidence:** MEDIUM-HIGH

## Executive Summary

This system is a personal SaaS development automation pipeline delivered entirely as Claude Code skills. It takes a product spec (or collaborates to produce one) and drives a deterministic 8-phase workflow: spec ingestion, UI generation via Google Stitch, design consistency memory, frontend code integration, backend wiring, test execution, analytics instrumentation, and deployment. The system lives inside Claude Code — no standalone application, no external runtime. State is split between an ephemeral JSON state file per run and a durable Neon PostgreSQL design memory database that persists approved design tokens, component patterns, and layout decisions across sessions.

The recommended approach is an orchestrator skill (`/saas-dev`) that delegates to focused sub-skills for each phase, with subagent isolation at phase boundaries to prevent context rot. The Stitch SDK (TypeScript, not the MCP path) is used for programmatic UI generation with the critical addition of a design context database seeded from the first approved page. Every page after page 1 gets Stitch prompts explicitly constrained by stored design tokens — this is the primary mechanism for visual cohesion and is non-negotiable. The system is brownfield-first: it must scan the existing repo before writing anything and treat existing auth, routes, and schema as invariants.

The key risks are context rot across the 8-phase pipeline, design drift from Stitch's stateless API, brownfield blindness in code integration, and silent test fabrication. All four are preventable by the same principle: external durable state over context-window state. The Neon design memory DB, the JSON state file, typed inter-skill handoffs, and the spec-first test discipline address each of these directly. Skipping any of these mitigations and treating them as polish for v2 is a rewrite-inducing mistake.

---

## Key Findings

### Recommended Stack

The stack is almost entirely in-place — this system is built on top of EntrepreneurOS's existing dependencies, not alongside them. The Stitch SDK (`@google/stitch-sdk`) is the only net-new npm dependency required for v1. Vitest and `@testing-library/react` must also be added since the project currently has no test runner. Everything else — Neon serverless, Drizzle ORM, tsx, Zod, Express, TanStack Query, Wouter, Passport.js — is already installed and operational.

The skill file structure targets `.claude/skills/` for project-scoped skills and `~/.claude/skills/` for reusable personal skills. The orchestrator and phase skills belong in personal scope (reusable across all SaaS repos). Deploy configs belong in project scope. Skill scripts run via `npx tsx` — no Python, no compile step.

**Core technologies:**
- Claude Code Skills (`SKILL.md`) + Subagents (`AGENT.md`): primary delivery mechanism — each pipeline phase is a skill, each heavy operation is an isolated subagent
- `@google/stitch-sdk` (npm): UI generation — programmatic page-by-page calls via TypeScript SDK; use GEMINI_3_PRO for page 1, GEMINI_FLASH for subsequent pages
- Neon PostgreSQL (existing): design memory store — `design_projects`, `design_pages`, `design_tokens`, `component_patterns` tables; queried before every Stitch call
- `tsx` (existing): script runner — executes Stitch SDK calls and Neon writes from within skill shell injection
- Zod (existing): spec validation and Stitch response schema enforcement
- Vitest + `@testing-library/react` (to install): test runner — zero-config with Vite 5; required before any deployment phase
- `pipeline-state.json` (ephemeral, gitignored): inter-phase state — tracks current phase, page index, approval history, error state; not Neon (file is faster for ephemeral run state)

**Critical version note:** `@neondatabase/serverless` can be updated from `^0.10.4` to `^1.0.2` (requires Node 19+, confirmed on Node 20) but this is not required for v1.

### Expected Features

**Must have (table stakes):**
- Spec ingestion (paste) + spec collaboration (structured questioning) — both paths must produce the same `PageSpec[]` output
- Spec parsing into page-level units — name, route, components, data requirements, auth protection
- Stitch API integration for single-page generation — correct prompt contract with context payload
- Stitch output consumption — HTML download URL fetched to string + screenshot URL, both artifacts handled
- Brownfield codebase scan before any code write — `gsd:map-codebase` before every integration step, non-negotiable
- Mandatory approval gate on page 1 — page 1 sets the design system anchor; auto-approval is not allowed regardless of confidence
- Confidence-calibrated self-review before escalation — subsequent pages only escalate when review fails; flooding user with approvals breaks the UX
- Design consistency memory (Neon PostgreSQL) — seeded from page 1, queried before every subsequent Stitch call, stored as structured design tokens not raw HTML
- Frontend code integration — Stitch output becomes real repo files, wired into routing, respects existing conventions
- Backend spec ingestion + backend wiring (Express/Drizzle) — additive only, catalogs existing routes and schema before generating new ones
- Test execution with autonomous fix loop — run tests, parse failures, fix implementation (not tests), re-run; exit on pass or escalate after 3 cycles
- Git workflow — feature branch per phase, incremental commits, push, PR-ready state
- Pause / resume support — state file checkpointed at each phase completion; resume skips completed phases
- Reusable across SaaS repos — no hardcoded paths; repo root, framework, and project config are inputs

**Should have (differentiators):**
- Design system extraction + persistence — extract color palette, type scale, spacing units, component patterns, border radius, shadow scale from page 1 into structured JSONB
- Confidence-calibrated escalation — measurable confidence score (token drift within threshold + spec compliance + self-review pass) determines auto-approve vs. escalate
- Self-review against spec AND prior pages — two-pass: spec compliance check then consistency check against design memory
- Skill orchestration layer — orchestrator knows which sub-skill to invoke at which phase; this is the core IP
- Backend wiring that follows UI — parse what API calls the new page makes, generate exactly those routes + schema changes
- PostHog analytics auto-instrumented — event taxonomy defined from spec during Phase 1; events wired per page before deployment
- Interruption-safe state machine — every phase writes completion record before finishing; orchestrator checks on startup and skips completed phases
- Framework-aware integration — detect stack from `package.json`; v1 targets React + Vite explicitly but detection layer built from start
- Spec delta logging — every deviation from spec logged to state store with reason; reconciliation report at delivery

**Defer (v2+):**
- Next.js / Vue / Nuxt framework support — design extension point now, implement later
- External productization — no web UI, no billing, no user accounts
- Screenshot-to-spec conversion — separate problem
- Custom Stitch model training — no API for this

### Architecture Approach

The system is a sequential pipeline with conditional routing at approval gates and an iterative loop at the quality layer. The orchestrator skill (`/saas-dev`) reads the state file, determines current phase, invokes the appropriate sub-skill, and advances state. Skills do not call each other directly — Claude is the coordinator. State is stored in two places: `.saas-dev-state.json` (ephemeral, per-run, gitignored) for current phase tracking, and Neon PostgreSQL (persistent, cross-run) for approved design context. Subagent isolation at phase boundaries prevents context rot from compounding across the 8+ phase pipeline.

**Major components:**
1. Orchestrator (`/saas-dev` SKILL.md) — reads state, determines next phase, invokes sub-skill, advances state; this is the only user-facing entry point
2. State File (`.saas-dev-state.json`) — single source of truth for current run; phase, page index, approval history, error state, spec deltas
3. Spec Layer (`spec-collab` skill) — produces `PageSpec[]` from pasted doc or structured collaboration; both paths converge on the same parsed format
4. Design Memory DB (Neon PostgreSQL) — `design_projects`, `design_pages`, `design_tokens`, `component_patterns`; read before every Stitch call, written after every approval
5. UI Generation Layer (`stitch-generator` sub-skill) — queries design memory, builds context-augmented prompt, calls Stitch SDK, runs self-review, routes to approval gate
6. Self-Review Component (inline in stitch-generator) — scores generated HTML against spec requirements and stored design tokens; produces confidence score + issues list
7. Approval Gate (inline in orchestrator) — page 1 always escalates; subsequent pages auto-approve above confidence threshold or escalate with surgical context
8. Code Integration Layer (`code-integrator` skill) — brownfield scan first, diff-first approach, writes approved Stitch output into repo, updates routes
9. Backend Wiring Layer (`backend-wirer` skill) — catalogs existing routes + schema, generates additive-only routes + Drizzle schema changes + Zod validation
10. Quality Layer — TDD skill + systematic-debugging; autonomous loop; fixes implementation on failure, never fixes tests; exits on pass or escalates after 3 cycles
11. Analytics Layer — PostHog instrumentation per page using event taxonomy defined at spec parse time
12. Delivery Layer — git worktrees, branch management, PR workflow, Docker/CI/CD setup, VPS deploy

**Critical path:** DB schema → Stitch SDK wrapper → State file schema → Spec layer → UI generation loop → Code integration. Everything else is downstream of UI generation loop.

**Build order:** Follow the critical path strictly. Design Memory DB schema must exist before the first Stitch call. State file schema must be finalized before building any skill. Do not parallelize across layers — each layer depends on contracts from the layer below.

### Critical Pitfalls

1. **Context rot across 8+ phases** — accumulated chat context degrades quality by phase 4-5; prevention: subagent isolation per skill invocation with scoped context payload, never full conversation thread; external state via Neon and state file is the fix
2. **Stitch design drift (stateless API)** — Stitch has no memory between calls; by page 3, visual inconsistency is the default; prevention: extract design tokens from page 1 approval into Neon immediately, inject as hard constraints into every subsequent Stitch prompt — "use exactly these values"
3. **Brownfield blindness** — generating code without reading what exists causes duplicate routes, duplicate components, broken auth; prevention: `gsd:map-codebase` runs before every integration step, diff-first approach, read before write is a hard pipeline constraint
4. **Silent test fabrication** — AI writes tests to pass, not to catch bugs; tests get assertions removed or everything mocked; prevention: write tests against spec before implementation (TDD discipline), hard rule that test failures fix the implementation not the test
5. **Untyped skill handoffs corrupt state** — natural language inter-skill communication fails silently at boundaries; 5 skills at 95% reliability = 77% system reliability; prevention: typed handoff schemas defined before building any skill, Neon as state store between phases, fail fast on bad input rather than continue

---

## Implications for Roadmap

Based on combined research, suggested phase structure with 6 phases:

### Phase 1: Foundation — Infrastructure, Schemas, and Contracts

**Rationale:** Every other phase depends on these artifacts. You cannot build the UI generation layer without the DB schema. You cannot build any skill without the state file schema. You cannot build typed handoffs without the handoff contracts. This is the highest-leverage phase — mistakes here propagate everywhere downstream. Architecture doc identifies this as the critical path anchor.

**Delivers:** Neon DB schema (4 tables), state file JSON schema, typed handoff schemas for every inter-phase boundary, Stitch SDK wrapper (thin TypeScript client), Vitest setup, event taxonomy extracted from spec template, framework detection layer skeleton.

**Addresses:** Spec ingestion + parsing, design memory DB, pipeline state management, brownfield detection setup.

**Avoids:** Context rot (subagent isolation architecture decided here), untyped handoffs (schemas defined before code), brownfield blindness (map-codebase constraint baked in), non-resumable pipeline (checkpointing pattern established).

**Research flag:** Standard patterns — DB schema design, state machine pattern, typed schema with Zod are all well-documented. Skip research-phase.

---

### Phase 2: Spec Layer — Ingestion and Collaboration

**Rationale:** Everything downstream of spec depends on structured `PageSpec[]` output. This must exist and be validated before building the UI generation layer. The two entry paths (paste vs. collaborate) must both converge on the same output schema.

**Delivers:** `spec-collab` skill (both ingestion and collaboration paths), Zod `PageSpec` schema, spec validation step that escalates on incomplete input, event taxonomy extraction from spec (feeds Phase 5 analytics), spec delta logging hooks.

**Addresses:** Spec ingestion (table stakes), spec collaboration, spec delta tracking (moderate pitfall 8).

**Avoids:** Garbage-in garbage-out spec parsing; spec drift from code without record.

**Research flag:** Standard patterns — Zod schema design, skill authoring. Skip research-phase.

---

### Phase 3: UI Generation Loop — Stitch Integration and Design Memory

**Rationale:** This is the most novel and highest-risk phase. Stitch is the newest technology in the stack. The design consistency mechanism is the primary differentiator. Validating the Stitch API contract early surfaces any integration surprises before they affect downstream phases. This phase is the biggest unknown and should be unblocked as early as possible.

**Delivers:** `stitch-generator` sub-skill, Stitch SDK scripts (generate-screen.ts, write-design-context.ts, read-design-context.ts), self-review component, approval gate logic with confidence scoring, design token extraction after page 1 approval.

**Addresses:** Stitch single-page generation, design consistency memory, self-review + approval gates, approval gate fatigue mitigation (confidence calibration).

**Avoids:** Stitch design drift (design tokens stored and re-injected as hard constraints), approval gate fatigue (surgical escalation messages, measurable confidence threshold).

**Research flag:** Needs research-phase. Stitch SDK is recent and evolving. Confidence scoring mechanism for self-review needs threshold tuning. The `GEMINI_3_PRO` vs `GEMINI_FLASH` model selection strategy may need empirical validation.

---

### Phase 4: Code Integration Layer — Frontend + Git Workflow

**Rationale:** Approved Stitch output must become real repo files. This phase converts generated HTML into React components integrated into the existing brownfield codebase. Git workflow is built here so every integration is tracked incrementally.

**Delivers:** `code-integrator` skill, brownfield pre-integration checklist, diff-first file writing (show before/after intent, then execute), route updater (App.tsx, protected routes), git workflow (branch per phase, incremental commits, push).

**Addresses:** Frontend code integration, brownfield codebase scan, git workflow, framework-aware integration (detect from package.json).

**Avoids:** Brownfield blindness (map-codebase before every write), framework coupling (adapter interface isolates React-specific logic), merge conflicts on dirty working tree (pre-flight git status check).

**Research flag:** Standard patterns — file writing, React component patterns, Wouter routing are well-documented for the existing stack. Skip research-phase.

---

### Phase 5: Backend + Quality — Wiring and Verification

**Rationale:** Backend must serve what the UI requests. Tests must verify what was built. These two steps are tightly coupled — backend wiring generates the API surface, quality layer verifies it. Running them together as one phase prevents the test suite from lagging behind the implementation.

**Delivers:** `backend-wirer` skill (catalog-then-extend pattern, additive-only routes, Drizzle schema additions, Zod validation, drizzle-kit migration review), quality layer (Vitest test generation against spec, autonomous fix loop capped at 3 cycles, test quality check for assertion presence and over-mocking).

**Addresses:** Backend spec ingestion, backend wiring (Express/Drizzle), test execution with fix loop, existing endpoint protection.

**Avoids:** Backend wiring breaking existing routes (catalog-first, additive-only), silent test fabrication (TDD discipline — tests written against spec before implementation, hard rule against fixing tests on failure), existing auth flow breakage (Passport.js patterns treated as invariants).

**Research flag:** Backend wiring is standard Express/Drizzle — skip research-phase. Test quality enforcement (detecting over-mocking, assertion presence) may benefit from a targeted research note but is not blocking.

---

### Phase 6: Analytics + Delivery — Instrumentation and Deployment

**Rationale:** Analytics uses the event taxonomy defined in Phase 2 from the spec — it is not a separate design effort, just execution. Delivery is downstream of a passing quality gate. These two steps are sequenced but relatively mechanical given the groundwork laid in prior phases.

**Delivers:** Analytics layer (PostHog instrumentation per page using pre-defined event taxonomy, feature flag setup, error tracking hooks, baseline dashboard), delivery layer (finishing-branch, `gsd:ship` PR workflow, Docker/CI/CD config generation, VPS deploy automation).

**Addresses:** PostHog analytics auto-instrumented, deployment automation with mandatory user confirmation gate, hosting setup (VPS vs Replit guided choice, not auto-selected).

**Avoids:** Generic pageview-only analytics (event taxonomy was spec-derived in Phase 2), autonomous deployment without review (explicit user confirmation gate), PostHog as afterthought (event taxonomy pre-defined, Phase 6 is execution only), assuming greenfield infrastructure (reads existing Docker/CI config before generating new ones).

**Research flag:** PostHog instrumentation patterns are well-documented — skip research-phase. Deployment automation is project-specific (VPS + Tailscale + existing Docker Compose) — skip research-phase, use existing infrastructure knowledge.

---

### Phase Ordering Rationale

- Foundation (Phase 1) must precede everything. The DB schema is a hard dependency for UI generation. The state file schema is a hard dependency for every skill. Typed handoff contracts defined here prevent state corruption across all subsequent phases.
- Spec layer (Phase 2) precedes UI generation because `PageSpec[]` is the input to Stitch. The event taxonomy defined here also informs Phase 6 analytics, avoiding the "analytics as afterthought" pitfall.
- UI generation (Phase 3) is the earliest possible phase for the most novel technology, surfacing Stitch API integration risks before they cascade downstream.
- Code integration (Phase 4) follows UI generation — you cannot integrate code that hasn't been generated and approved.
- Backend wiring and quality (Phase 5) follow code integration — the backend must serve what the UI actually requests; tests verify what was built.
- Analytics and delivery (Phase 6) are last because they depend on a clean, passing codebase. The event taxonomy is the only analytics artifact created early (Phase 2); execution is last.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (UI Generation Loop):** Stitch SDK is recent and evolving. The self-review confidence scoring mechanism needs threshold design. The `design.md` injection pattern shows forum evidence of inconsistency even with explicit context — the design token approach is the mitigation but needs validation against real Stitch API behavior.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** DB schema, state machine, Zod — established patterns.
- **Phase 2 (Spec Layer):** Spec parsing, skill authoring, Zod schema — established patterns.
- **Phase 4 (Code Integration):** File writing, React components, Wouter routing — established for this stack.
- **Phase 5 (Backend + Quality):** Express/Drizzle wiring, Vitest — established for this stack.
- **Phase 6 (Analytics + Delivery):** PostHog, existing Docker/VPS setup — established.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Stitch SDK is official but recent/evolving; all other technologies verified against live docs and existing project |
| Features | HIGH | Feature landscape well-supported by spec-driven development research, Stitch official docs, and agentic workflow literature |
| Architecture | HIGH | Orchestrator + subagent pattern verified against official Claude Code docs; state file + design memory DB is a clean, validated approach |
| Pitfalls | HIGH | Multi-source verification including peer-reviewed research (arxiv), official forum evidence (Google Stitch), and 470-PR dataset (CodeRabbit) |

**Overall confidence:** HIGH

### Gaps to Address

- **Stitch confidence scoring thresholds:** The self-review component needs measurable criteria for auto-approve vs. escalate. Research shows the design.md injection approach has inconsistency issues. Exact threshold design (what constitutes "within token drift threshold") needs empirical tuning during Phase 3 build. Handle by building the threshold as a configurable constant (default: 15% drift tolerance) and adjusting after first real run.
- **Stitch SDK version stability:** `@google/stitch-sdk` is flagged as recent/evolving. The API contract documented in STACK.md (`project.generate()`, `screen.getHtml()`, `screen.getImage()`) is verified against the official repo at research time but may shift. Handle by pinning the SDK version at install time and testing against live API early in Phase 3.
- **`@neondatabase/serverless` v1.x breaking changes:** Current project uses `^0.10.4`; v1.0.2 has breaking changes. Not required for v1 but the upgrade path should be tested before any production use. Handle by deferring upgrade until v1 is stable.

---

## Sources

### Primary (HIGH confidence)
- [Stitch SDK GitHub — google-labs-code/stitch-sdk](https://github.com/google-labs-code/stitch-sdk) — API contract, TypeScript SDK methods
- [Stitch Skills GitHub — google-labs-code/stitch-skills](https://github.com/google-labs-code/stitch-skills) — shadcn/ui integration guidance
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) — skill structure, frontmatter, subagent delegation
- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents) — subagent isolation, context window scoping
- [Google Stitch announcement — Google Developers Blog](https://developers.googleblog.com/stitch-a-new-way-to-design-uis/) — product positioning, design direction
- [Context Rot — Understanding AI](https://www.understandingai.org/p/context-rot-the-emerging-challenge) — context degradation in long pipelines
- [Context Window Management — Redis](https://redis.io/blog/context-window-management-llm-apps-developer-guide/) — budget-based context management
- [Rethinking Autonomy — arxiv](https://arxiv.org/html/2508.11824v1) — agentic system failure modes, peer-reviewed
- [Survey of Bugs in AI-Generated Code — arxiv](https://arxiv.org/html/2512.05239v1) — test fabrication patterns, peer-reviewed
- [AI vs Human Code Generation Report — CodeRabbit](https://www.coderabbit.ai/blog/state-of-ai-vs-human-code-generation-report) — 470 PR dataset on code quality
- [PostHog Docs — Feature Flags](https://posthog.com/docs/feature-flags) — analytics instrumentation patterns
- [Spec-Driven Development 2025 — Thoughtworks](https://www.thoughtworks.com/en-us/insights/blog/agile-engineering-practices/spec-driven-development-unpacking-2025-new-engineering-practices) — industry practice validation

### Secondary (MEDIUM confidence)
- [Stitch MCP — davideast/stitch-mcp](https://github.com/davideast/stitch-mcp) — MCP alternative path (not recommended for skill scripts)
- [Google Stitch Forum — style consistency thread](https://discuss.ai.google.dev/t/how-to-maintain-style-consistency/116160) — real-world design drift evidence
- [Multi-agent workflows often fail — GitHub Blog](https://github.blog/ai-and-ml/generative-ai/multi-agent-workflows-often-fail-heres-how-to-engineer-ones-that-dont/) — handoff failure modes
- [Spec-Driven Development for Brownfield Codebases — Augment Code](https://www.augmentcode.com/guides/spec-driven-development-brownfield-codebases) — brownfield integration patterns
- [Agentic Workflows 2026 Guide — Vellum](https://vellum.ai/blog/agentic-workflows-emerging-architectures-and-design-patterns) — pipeline architecture patterns
- [Kiro Review — OpenAIToolsHub](https://www.openaitoolshub.org/en/blog/kiro-review-amazon-ide) — spec-driven IDE comparisons
- [Building Reliable Agentic AI — TechEmpower](https://www.techempower.com/blog/2026/01/12/bulding-reliable-autonomous-agentic-ai/) — reliability engineering for agents
- [Brownfield Problem — JJMasse](https://www.jjmasse.com/2026/03/06/the-brownfield-problem-why-most-ai-development-advice-ignores-your-actual-codebase/) — brownfield AI integration challenges
- [@neondatabase/serverless npm](https://www.npmjs.com/package/@neondatabase/serverless) — version requirements

---
*Research completed: 2026-03-25*
*Ready for roadmap: yes*
