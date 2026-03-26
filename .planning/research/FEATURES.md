# Feature Landscape

**Domain:** SaaS development automation — spec-to-deployment pipeline as Claude Code skills
**Researched:** 2026-03-25
**Confidence:** HIGH (primary sources: Google Stitch official docs, Kiro/AWS specs, agentic workflow research, PostHog official docs)

---

## Table Stakes

Features users (you) expect. Missing = system feels broken or incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Spec ingestion (paste or collaborate) | Every pipeline starts with intent capture — no spec, no output | Medium | Two paths: accept pasted doc OR run structured questioning. Both must converge on same parsed format. |
| Spec parsing into page-level units | Downstream tools (Stitch) work page-by-page, not app-wide; page specs are the atomic unit of work | Medium | Parser must handle freeform markdown/text, extract page name + purpose + components + data requirements |
| Stitch API integration — single-page generation | Stitch itself is designed one page at a time; calling it for whole-app at once produces lower quality output | High | Requires correct API contract (prompt structure, context payload, response handling). Research Stitch docs before building. |
| Stitch output consumption — code + preview | System must receive generated code AND visual preview, not just one | Medium | Stitch returns both; the integration must handle both artifacts meaningfully |
| Brownfield codebase scan before writing | On existing repos, writing without reading causes duplication, conflicts, routing collisions | Medium | Map existing routes, components, auth pattern, DB schema before any file is created or modified |
| Approval gate — page 1 mandatory | First page sets visual direction for the entire product; system cannot self-approve the design system anchor | Low | Gate is structural, not confidence-based. Always escalate page 1 regardless of self-review result. |
| Self-review before escalation | Only involve user when AI is uncertain; flooding with approvals kills the workflow | Medium | Review generated page against spec intent + previously approved pages. Escalate only when below confidence threshold. |
| Design consistency memory (Neon PostgreSQL) | Visual coherence across pages requires persisted context — design tokens, component patterns, spacing, color | High | DB schema: approved_pages table with design_system JSON, component_patterns JSON, layout_decisions text. Read on each new page generation. |
| Frontend code integration | Stitch output is raw HTML/CSS/JSX — it must become real project files, wired into routing and imports | High | Create/update files, update routing, respect existing file structure and naming conventions |
| Backend spec ingestion | UI is meaningless without the backend that serves it — same spec flexibility (paste or collaborate) | Medium | Separate from UI spec but same parsing pattern. Produces: routes, schema changes, validation rules. |
| Backend wiring (Express/Drizzle) | The backend must be upgraded to serve what the new UI actually needs | High | Add routes, extend Drizzle schema, add Zod validation, wire endpoints to new pages. Brownfield-aware. |
| Test execution with fix loop | Generating code and writing tests are table stakes; running tests and fixing failures in a loop is what makes it real | High | Not just generate test files — run them, parse failures, attempt fixes, re-run. Exit on pass or escalate on repeated failure. |
| Git workflow — branch and push | Any serious development pipeline manages branches; committing directly to main is unacceptable | Medium | Create feature branch per page or per phase, commit incrementally, push to remote, surface PR-ready state |
| Pause / resume / interrupt support | Long pipelines fail, context changes, users want to inject feedback mid-run | Medium | Session state must be persisted so pipeline can resume from last verified checkpoint, not restart from zero |
| Reusable across SaaS repos | Tied to one repo = a script, not a system | Medium | No hardcoded paths. Skills must accept repo root, framework, and project config as inputs. |

---

## Differentiators

Features that separate this system from ad-hoc prompting or basic code generation tools.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Design system extraction + persistence | Most tools regenerate from scratch each time; this one accumulates a living design system across pages | High | After page 1 approval: extract color palette, typography, spacing, component names, layout grid. Store as structured JSON. Feed back into every subsequent Stitch prompt. |
| Confidence-calibrated escalation | Most agentic tools either always ask or never ask; this one routes based on measured uncertainty | High | Requires a scoring model for how well generated output matches spec + previous pages. Threshold tuning matters — too sensitive floods user, too lenient ships wrong UI. |
| Self-review against spec AND prior pages | Other tools review against spec only; this reviews against visual cohesion across the entire product | Medium | Two-pass review: (1) spec compliance check, (2) consistency check against design memory. Both must pass before auto-approve. |
| Skill orchestration layer | This isn't a monolith — it's a meta-skill that calls the right specialized skill at the right lifecycle phase | High | System must know: when to invoke `frontend-design` vs `tdd` vs `posthog-instrumentation` vs `gsd:ship`. Orchestration map is the core IP of this system. |
| Backend wiring that follows UI | Most codegen creates frontend OR backend; this creates the full vertical slice — UI page + its backend contract | High | After frontend integration, parse what API calls the new page makes, then generate exactly those routes + schema changes. |
| PostHog analytics wired automatically | Analytics is almost always deferred and often skipped; automating it into the pipeline makes it a default, not an afterthought | Medium | After pages are approved and integrated: auto-instrument meaningful events (page views, CTA clicks, form submits, feature flag gates). Wire error tracking. |
| Incremental spec authoring for brownfield | Full reverse-engineering of existing codebase is fragile and error-prone; scoping specs to upcoming changes only is more accurate | Medium | Scan existing codebase, surface what already exists, scope spec to only what's new or changing. Don't try to model the whole app. |
| Interruption-safe state machine | Pipelines that restart from zero on failure are not useful for real projects; resumable state is the difference between a toy and a tool | High | After each phase (page generated, page approved, code integrated, tests passing), checkpoint state to disk/DB so resume picks up exactly where it left off. |
| Framework-aware integration | Hardcoded React assumptions break on Next.js or Vue; detecting and adapting to framework makes this durable | Medium | v1: detect React + Vite + Tailwind + shadcn/ui. v2: extend to Next.js. Framework detection via package.json and config files, not assumptions. |

---

## Anti-Features

Features to explicitly NOT build in v1. Each has a deliberate reason.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full codebase reverse-engineering to spec | Reverse-engineered specs diverge from reality, cause alignment loss, and increase regressions on brownfield projects (Augment Code research, 2025) | Scope specs to only what is being added or changed. Scan existing code to understand what's there, not to re-document it. |
| Whole-app Stitch generation in one call | Stitch produces lower quality when prompted for full apps vs single pages; page-by-page is the correct abstraction per the tool's design | Always generate one page at a time, carrying design system context forward |
| Autonomous deployment without review gate | Deployment is irreversible; auto-deploying without a human checkpoint is a liability, not a feature | Gate deployment with explicit user confirmation after tests pass and PR is ready |
| Generating tests that are never run | Test file generation without test execution is theater — it provides false confidence and doesn't catch integration failures | Always run tests after generation; treat a passing test suite as a required gate, not an optional step |
| Multi-framework support in v1 | Supporting Next.js, Vue, Nuxt simultaneously in v1 adds scope that delays shipping without adding value for the current use case | Ship React + Vite v1, design the framework detection layer for extension, add frameworks in v2 after v1 is proven |
| External user-facing product features (auth, billing, team management) | This is a personal tool first; productizing it is a separate future project | Keep skill interface as CLI-native slash commands. No web UI, no user accounts, no billing in v1. |
| Spec auto-generation from screenshots/designs | Converting visual designs to text specs is a separate problem with its own complexity; scope creep | Accept text specs only. User provides the spec document, or system collaborates on one via questioning. |
| Custom Stitch model training or fine-tuning | No API for this exists; attempting it is guessing at internals | Use Stitch API as-is with well-engineered prompts and design context payloads |
| Real-time collaborative editing of specs | Multiplayer spec editing is a product feature, not a pipeline feature | Single-user pipeline: one operator, sequential phases |

---

## Feature Dependencies

```
Spec Collaboration / Spec Ingestion
        |
        v
Spec Parsing (page units)
        |
        v
Brownfield Codebase Scan  ─────────────────────────────────────────┐
        |                                                            |
        v                                                            |
Stitch API Integration (page 1)                                      |
        |                                                            |
        v                                                            |
Design System Extraction ──> Neon PostgreSQL (design memory)        |
        |                                                            |
        v                                                            |
Self-Review (spec compliance + consistency)                          |
        |                                                            |
        v                                                            |
Approval Gate (mandatory page 1 / confidence-based thereafter)      |
        |                                                            |
        v                                                            |
Frontend Code Integration  <─────────────────────────────────────────┘
        |
        v
Git Workflow (branch, commit, push)
        |
        v
Backend Spec Ingestion / Collaboration
        |
        v
Backend Wiring (routes, schema, validation)
        |
        v
Test Execution + Fix Loop
        |
        v
PostHog Analytics Setup
        |
        v
Deployment Gate (user confirmation)
        |
        v
Hosting / Deployment Automation
        |
        v
Git Workflow (PR, merge)
```

**Hard dependencies (cannot reorder):**
- Brownfield scan must precede code integration — writing without reading causes conflicts
- Design memory must exist before page 2+ generation — consistency requires prior context
- Backend wiring must follow frontend integration — the backend must serve what the UI actually requests
- Test execution must precede deployment gate — no deploying untested code
- PostHog setup can run in parallel with git/deployment steps after tests pass

**Soft dependencies (order is convention, not requirement):**
- Spec collaboration and spec ingestion are alternative entry points — same output either way
- Backend spec collaboration can begin while frontend integration is in progress for later pages

---

## MVP Recommendation

Build in this order:

1. **Spec ingestion + parsing** — foundation everything else sits on; both paste and collaborate paths
2. **Stitch API integration** — the most novel piece; validate the API contract early
3. **Design consistency memory** — wire Neon PostgreSQL immediately after first Stitch success; do not skip
4. **Self-review + approval gates** — single-page workflow is usable at this point
5. **Frontend code integration + brownfield scan** — makes the output real; this is where "spec to files" happens
6. **Git workflow** — commit incrementally as each page integrates
7. **Backend spec + wiring** — second major phase; builds on the frontend that now exists
8. **Test execution with fix loop** — non-negotiable before deployment; run what was built
9. **PostHog analytics setup** — wire events to what was just built; do this before deployment so production has coverage
10. **Deployment automation** — final phase; requires all prior phases to have passed

**Defer to v2:**
- Next.js / Vue / Nuxt framework support — design the extension point but do not implement
- External productization features — out of scope for v1 per PROJECT.md
- Screenshot-to-spec conversion — separate problem

---

## Sources

- [From idea to app: Introducing Stitch — Google Developers Blog](https://developers.googleblog.com/stitch-a-new-way-to-design-uis/)
- [Google Stitch Complete Guide 2026 — NxCode](https://www.nxcode.io/resources/news/google-stitch-complete-guide-vibe-design-2026)
- [Spec-Driven Development for Brownfield Codebases — Augment Code](https://www.augmentcode.com/guides/spec-driven-development-brownfield-codebases)
- [Spec-Driven Development with Brownfield Projects — intent-driven.dev](https://intent-driven.dev/blog/2026/03/10/spec-driven-development-brownfield/)
- [Human-in-the-Loop Patterns for AI Agents 2026 — MyEngineeringPath](https://myengineeringpath.dev/genai-engineer/human-in-the-loop/)
- [Agentic Workflows 2026 Guide — Vellum](https://vellum.ai/blog/agentic-workflows-emerging-architectures-and-design-patterns)
- [2026 Guide to Agentic Workflow Architectures — StackAI](https://www.stackai.com/blog/the-2026-guide-to-agentic-workflow-architectures)
- [Kiro Review: Amazon Spec-Driven IDE — OpenAIToolsHub](https://www.openaitoolshub.org/en/blog/kiro-review-amazon-ide)
- [6 Best Spec-Driven Development Tools 2026 — Augment Code](https://www.augmentcode.com/tools/best-spec-driven-development-tools)
- [Context Engineering Best Practices 2025 — Kubiya](https://www.kubiya.ai/blog/context-engineering-best-practices)
- [PostHog Docs — Feature Flags](https://posthog.com/docs/feature-flags)
- [PostHog GitHub — All-in-one developer platform](https://github.com/PostHog/posthog)
