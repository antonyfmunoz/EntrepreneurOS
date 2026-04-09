# Phase 2: Spec Layer - Research

**Researched:** 2026-03-27
**Domain:** AI-driven spec parsing, Zod schema composition, Claude structured output, collaborative questioning flows, Claude Code skill authoring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Spec Input & Parsing**
- D-01: Format-agnostic input — accept markdown, plain text, Notion exports, any format. AI interprets intent and restructures into PageSpec[] regardless of input quality.
- D-02: AI restructuring fills technical gaps even when the user's spec has them. If user writes "dashboard with analytics" without specifying components, the AI infers data visualization components, auth protection, loading states, etc.
- D-03: Full restructured spec shown to user for confirmation. Inferred/added items are visually distinct from explicit content. One confirmation gate, full visibility.
- D-04: Two-step flow: parse → restructure → confirm. User sees everything the AI understood and approves, edits, or kicks back for re-interpretation before anything gets locked.

**PageSpec Output Shape**
- D-05: Layered PageSpec structure with four layers:
  - Core layer (all phases read): name, route, purpose, components[], authLevel, priority, dependsOn
  - UI layer (Phase 3-4 consume): layout hints, empty/loading/error state descriptions, mobile considerations
  - Data layer (Phase 5 consumes): data requirements per component, API endpoints implied, validation rules
  - Analytics layer (Phase 6 consumes): event taxonomy, tracking points, feature flag candidates
- D-06: Zod contracts are composable — `PageSpecCore.merge(PageSpecUI)` for Phase 3, `PageSpecCore.merge(PageSpecData)` for Phase 5. Each phase reads core + its layer, no wasted fields.

**Collaborative Spec Flow**
- D-07: Domain-first questioning as primary flow — vision → user flows → pages → per-page detail → implied requirements. Mirrors `superpowers:brainstorming` pattern.
- D-08: References accepted at any point during collaboration — URLs, screenshots, "make it like X". References inform the spec being built but don't replace structured questioning.

**Backend Spec Relationship**
- D-09: All three input paths supported — auto-derived from UI spec, paste standalone, or collaborate. System adapts to how the user works.
- D-10: Auto-generation always runs when UI spec exists. Even if user also pastes or collaborates on backend, the system shows what it derived from UI PageSpec[] data layer and lets user reconcile.
- D-11: All paths converge to the same validated backend spec structure. Cross-references against UI spec when both exist, flags mismatches.
- D-12: Backend-only concerns (webhooks, cron jobs, third-party integrations, background tasks) captured through user overrides after auto-generation.

**Multi-Page Ordering & Dependencies**
- D-13: Parser auto-detects page dependencies from spec content. Each PageSpec includes a `dependsOn` field.
- D-14: Default generation order: foundational pages (auth, layout shell, dashboard) → feature pages → settings/admin. User can override.
- D-15: Suggested generation order output alongside PageSpec[] for Phase 3 consumption.

**Spec Versioning & Iteration**
- D-16: Surgical edits — change one page's spec without invalidating the rest. Modified PageSpec gets a version bump.
- D-17: Downstream phases that consumed old version get flagged ("Page 3 spec changed — Phase 3 output may be stale"). Dependent pages also flagged for review.
- D-18: Pages with no relationship to the change are untouched. No full re-parse needed.
- D-19: Per-page status tracking in pipeline state (Neon) supports marking individual pages as "spec-changed, needs re-generation."

**Shared Components**
- D-20: Deduplication pass after restructuring all pages. Similar components described with different language across pages get unified into a single shared component definition.
- D-21: Top-level `sharedComponents[]` in spec output. Each PageSpec references shared components by ID, not re-description.
- D-22: Deduplication shown to user: "I merged these 3 descriptions into one shared component: `SidebarNav`." User confirms or splits apart.

**Spec Size Handling**
- D-23: No hard cap on page count.
- D-24: 1-25 pages: single AI pass for restructuring. No chunking needed.
- D-25: 26+ pages: parser chunks into groups of ~15 pages by domain. Each chunk restructured, then merge pass unifies shared components and resolves cross-chunk dependencies.
- D-26: Chunking is internal — user pastes one spec, gets one PageSpec[] back.

### Claude's Discretion
- Exact Zod field names and types for each PageSpec layer
- AI prompt engineering for restructuring and gap-filling
- Deduplication similarity threshold for shared component detection
- Domain grouping logic for chunked parsing
- Questioning depth/sequence in collaborative flow

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SPEC-01 | User can paste a pre-written spec document and system parses it into page-level units | Claude structured output with Zod schemas; parse path via Anthropic SDK messages.create with JSON mode |
| SPEC-02 | User can collaboratively create a spec with the system if no document exists (brainstorming/GSD questioning) | Domain-first questioning pattern; multi-turn Anthropic SDK conversation loop |
| SPEC-03 | System parses spec into individual page specs (name, purpose, components, data requirements) | PageSpecCore Zod schema design; layered .merge() composition pattern from existing drizzle-zod usage |
| SPEC-04 | User can paste a backend spec document with same input optionality as UI spec | BackendSpec Zod schema; auto-derivation from PageSpecData layer; mismatch detection logic |
| SPEC-05 | System extracts implied requirements from page specs (auth, data fetching, error states, loading states, empty states) | AI inference pass after initial parse; gap-fill prompt engineering; visually distinct confirmation output |
</phase_requirements>

---

## Summary

Phase 2 is the first user-facing phase in the pipeline. It must handle two fundamentally different input paths — paste-and-parse vs. collaborative creation — and converge them to the same validated `PageSpec[]` output that all downstream phases (3-6) consume. The output is not just the parsed pages; it is a layered, composable Zod-typed contract with four layers (core, UI, data, analytics) that each downstream phase reads via `.merge()` composition.

The technical foundation is already in place. Phase 1 delivered `shared/design-schema.ts` with `SpecPhaseOutputSchema` as a skeleton, `pipeline_runs` and `pipeline_pages` tables for per-page state tracking, and the `@anthropic-ai/sdk` is already in the project's dependencies and actively used in `server/ai/anthropic-service.ts`. Phase 2 extends these assets rather than building from scratch.

The dominant complexity is prompt engineering: the AI must (1) interpret format-agnostic input regardless of quality, (2) infer missing technical detail without overstepping user intent, (3) deduplicate shared components across pages with high recall and low false-positives, and (4) auto-derive a backend spec from the UI data layer. These AI behaviors are the core engineering challenge — the TypeScript plumbing is straightforward given existing patterns.

**Primary recommendation:** Build Phase 2 as the `saas-dev:spec-parser` Claude Code skill in `.claude/skills/saas-dev/spec-parser/`, backed by pure TypeScript modules in `lib/spec-parser/`, with Zod contracts in `shared/spec-schema.ts`. The skill is the user interface; the lib modules contain all testable parsing logic.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.37.0 (already installed) | AI spec parsing, restructuring, gap-filling, collaborative questioning | Already in project, proven in anthropic-service.ts, Claude models are best at structured JSON extraction |
| `zod` | 3.25.76 (already installed) | PageSpec contracts, layer composition, runtime validation | Already the project-wide validation library, `.merge()` composition is the locked pattern |
| `drizzle-zod` | 0.7.1 (already installed) | Generate insert schemas from new spec-related Neon tables | Already used in design-schema.ts, consistent pattern |
| `postgres` | 3.4.5 (already installed) | Pipeline state queries for per-page spec version tracking | Already the Neon driver |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | 2.x (already installed, pinned) | Unit tests for spec parser pure functions | All pure parsing logic must be tested |
| `p-retry` | 7.3.0 (already installed) | Retry AI calls that fail transiently | Use in spec-parser AI call wrapper, same as Stitch wrapper pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Claude structured output (JSON mode) | OpenAI JSON mode | OpenAI not the primary AI provider here; Anthropic already wired with escalation logic |
| Zod `.merge()` composition | Separate interface files | `.merge()` is the locked decision (D-06); TypeScript interfaces don't provide runtime validation |
| Neon for spec version state | In-memory / JSON file | Locked as D-06 in Phase 1 — pipeline state is always Neon only |

**Installation:** No new package installs required. All dependencies are already in `package.json`.

---

## Architecture Patterns

### Recommended Project Structure
```
lib/
└── spec-parser/
    ├── parse-spec.ts          # paste path: raw text → PageSpec[] (pure, testable)
    ├── restructure-spec.ts    # AI restructuring + gap-fill pass
    ├── deduplicate-components.ts  # shared component deduplication pass
    ├── derive-backend-spec.ts # auto-derive BackendSpec from PageSpec[] data layer
    ├── chunk-spec.ts          # chunking logic for 26+ pages
    └── types.ts               # re-exports from shared/spec-schema.ts

shared/
└── spec-schema.ts             # All PageSpec Zod contracts (4 layers + composed types)

.claude/skills/saas-dev/spec-parser/
└── SKILL.md                   # skill definition consumed by orchestrator

tests/unit/
└── spec-parser/
    ├── parse-spec.test.ts
    ├── deduplicate-components.test.ts
    ├── chunk-spec.test.ts
    └── derive-backend-spec.test.ts
```

### Pattern 1: Layered Zod Schema Composition (D-05, D-06)

**What:** Four Zod schemas per layer that downstream phases compose with `.merge()` to get exactly the fields they need.

**When to use:** For all PageSpec type exports. Every downstream phase imports only `PageSpecCore.merge(PageSpecUI)` etc. — never the full combined type.

**Example:**
```typescript
// shared/spec-schema.ts

// Core layer — all phases read this
export const PageSpecCore = z.object({
  name: z.string(),                        // e.g., "Dashboard"
  route: z.string(),                       // e.g., "/dashboard"
  purpose: z.string(),                     // one-line description of the page
  components: z.array(z.string()),         // component names, e.g., ["StatsCard", "ActivityFeed"]
  authLevel: z.enum(["public", "authenticated", "admin"]),
  priority: z.number().int().min(1),       // generation order priority
  dependsOn: z.array(z.string()).default([]), // route paths this page depends on
  specVersion: z.number().int().default(1),
});

// UI layer — Phase 3 & 4 consume: PageSpecCore.merge(PageSpecUI)
export const PageSpecUI = z.object({
  layoutHint: z.string().optional(),       // e.g., "sidebar-left with content-right"
  emptyState: z.string().optional(),       // description of empty state behavior
  loadingState: z.string().optional(),     // loading state behavior
  errorState: z.string().optional(),       // error state behavior
  mobileConsiderations: z.string().optional(),
});

// Data layer — Phase 5 consumes: PageSpecCore.merge(PageSpecData)
export const PageSpecData = z.object({
  dataRequirements: z.array(z.object({
    component: z.string(),
    fields: z.array(z.string()),
    source: z.string().optional(),         // e.g., "GET /api/tasks"
  })),
  apiEndpoints: z.array(z.string()).default([]),  // implied API routes
  validationRules: z.array(z.string()).default([]),
});

// Analytics layer — Phase 6 consumes: PageSpecCore.merge(PageSpecAnalytics)
export const PageSpecAnalytics = z.object({
  events: z.array(z.object({
    name: z.string(),                      // e.g., "dashboard_viewed"
    trigger: z.string(),                   // e.g., "page mount"
    properties: z.array(z.string()).default([]),
  })).default([]),
  featureFlagCandidates: z.array(z.string()).default([]),
});

// Full combined — only spec-parser produces this; downstream phases use .merge()
export const PageSpecFull = PageSpecCore
  .merge(PageSpecUI)
  .merge(PageSpecData)
  .merge(PageSpecAnalytics);

// Shared component definition
export const SharedComponentSpec = z.object({
  id: z.string(),                          // stable ID used as reference
  name: z.string(),                        // e.g., "SidebarNav"
  purpose: z.string(),
  usedByPages: z.array(z.string()),        // page routes that reference this component
  props: z.array(z.string()).default([]),
});

// Top-level spec output
export const SpecOutputSchema = z.object({
  pages: z.array(PageSpecFull),
  sharedComponents: z.array(SharedComponentSpec),
  suggestedOrder: z.array(z.string()),     // page routes in recommended generation order (D-15)
  backendSpec: BackendSpecSchema.optional(),
});

export type PageSpecCore = z.infer<typeof PageSpecCore>;
export type PageSpecFull = z.infer<typeof PageSpecFull>;
export type SpecOutput = z.infer<typeof SpecOutputSchema>;
```

### Pattern 2: Claude Structured JSON Output

**What:** Use Anthropic SDK's messages.create with a system prompt that instructs Claude to return strict JSON, then parse/validate with Zod.

**When to use:** Every AI call in spec-parser must return structured JSON, not prose. The parse-spec and restructure-spec modules both use this pattern.

**Example:**
```typescript
// lib/spec-parser/restructure-spec.ts

import Anthropic from "@anthropic-ai/sdk";
import { SpecOutputSchema, type SpecOutput } from "@shared/spec-schema.js";
import pRetry from "p-retry";

const client = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

export async function restructureSpec(rawInput: string): Promise<SpecOutput> {
  return pRetry(async () => {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      system: RESTRUCTURE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: rawInput }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const json = extractJsonFromResponse(text);
    return SpecOutputSchema.parse(json);  // throws ZodError if malformed
  }, { retries: 3, minTimeout: 1000, factor: 2 });
}

function extractJsonFromResponse(text: string): unknown {
  // Claude may wrap JSON in markdown fences — strip them
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1] : text.trim();
  return JSON.parse(jsonStr);
}
```

### Pattern 3: Pure Function Module (detect-framework.ts pattern)

**What:** All parsing logic in `lib/spec-parser/` is pure functions — no file I/O, no side effects. AI calls are in separate modules. This makes every parsing decision unit-testable.

**When to use:** All spec manipulation logic (chunking, deduplication, ordering, backend derivation). Only the entry-point module (the skill invocation handler) combines pure functions with AI calls.

**Example:**
```typescript
// lib/spec-parser/chunk-spec.ts — pure function, no AI, fully testable

export function chunkSpecByDomain(rawPages: string[], chunkSize: number = 15): string[][] {
  // Group pages by detected domain (auth, core-features, admin, etc.)
  // Returns array of chunks, each chunk is an array of page descriptions
  if (rawPages.length <= 25) return [rawPages]; // D-24: no chunking below 26 pages
  // ... domain grouping logic
}
```

### Pattern 4: Multi-Turn Collaborative Flow

**What:** Stateful conversation loop using the Anthropic SDK messages array, following domain-first questioning sequence (D-07): vision → user flows → pages → per-page detail → implied requirements.

**When to use:** SPEC-02 path — user has no spec document and engages in guided creation.

**Example:**
```typescript
// lib/spec-parser/collaborative-flow.ts

const QUESTION_SEQUENCE = [
  "vision",      // What is this product? Who is it for?
  "user-flows",  // What are the 3-5 core things users do?
  "pages",       // What pages/screens do those flows require?
  "page-detail", // Per-page: components, data, auth requirements
  "implied",     // What implied requirements did we miss? (errors, empty states, etc.)
] as const;

export type QuestionStage = typeof QUESTION_SEQUENCE[number];

export interface CollaborativeState {
  stage: QuestionStage;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  partialSpec: Partial<SpecOutput>;
}
```

### Pattern 5: Confirmation Gate with Visual Diff

**What:** After AI restructuring, present the spec to the user with inferred/added items marked. One confirmation gate before anything is persisted to Neon (D-03, D-04).

**When to use:** Both input paths (paste and collaborate) must go through this gate.

**Implementation note:** The skill (SKILL.md instructions to Claude Code) handles the confirmation display — it renders the spec in markdown with clear "INFERRED:" vs "EXPLICIT:" labels. The pure functions produce the data; the skill controls the display and user prompt.

### Anti-Patterns to Avoid

- **Embedding prompt strings in Zod schemas:** Prompts belong in separate constant files; schemas are contracts.
- **Persisting spec to Neon before confirmation:** Nothing written to `pipeline_pages` until user confirms at D-03 gate.
- **Storing full PageSpecFull in pipeline_pages.output:** The `output` column is TEXT — serialize as JSON. Deserialize and re-validate with Zod on read.
- **Using SpecPhaseOutputSchema from design-schema.ts directly:** That schema is the Phase 1 skeleton (very minimal). Phase 2 extends it with the proper layered structure in `shared/spec-schema.ts`. The orchestrator skill should reference `SpecOutputSchema` from `shared/spec-schema.ts` going forward.
- **Building a deduplication algorithm with string distance metrics:** Deduplicate via Claude — paste all component descriptions, ask it to identify conceptually identical ones. String distance is brittle; semantic matching via AI handles "sidebar navigation" vs "SideNav" vs "left nav rail" correctly.
- **Chunking visible to user:** All chunking (D-26) is internal. The user-facing confirmation always shows the full merged PageSpec[] regardless of how it was chunked.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured JSON from AI | Custom regex / string parsing | Anthropic SDK + Zod.parse() | Model output can vary; Zod provides typed validation and clear error messages for retry logic |
| Retry on transient AI errors | Custom sleep/loop | `p-retry` (already in deps) | Already used in Stitch wrapper; exponential backoff handles rate limits and 5xx correctly |
| Semantic component deduplication | Levenshtein / TF-IDF similarity | Claude AI pass | "SidebarNav" vs "left navigation rail" are semantically identical; string distance gets it wrong |
| Spec format detection | Regexp for markdown/plain text/Notion | Don't detect format at all | D-01 locks format-agnostic input — AI interprets intent regardless, no preprocessing needed |
| Validation error messages | Custom error formatting | ZodError.flatten() | Produces structured field-level errors suitable for confirmation display |

**Key insight:** The spec parsing domain is almost entirely semantic — it requires understanding intent, inferring missing detail, and recognizing conceptual equivalence across descriptions. These are AI problems, not algorithmic ones. Build thin pure functions for deterministic operations (chunking, ordering, serialization) and delegate all semantic work to Claude.

---

## Common Pitfalls

### Pitfall 1: Zod Parse Failure on AI Output
**What goes wrong:** Claude returns JSON that doesn't match the schema — missing required field, wrong enum value, unexpected nesting.
**Why it happens:** The model occasionally deviates from the schema, especially for complex nested structures or when the input spec is ambiguous.
**How to avoid:** Wrap every `SpecOutputSchema.parse(json)` in a try/catch. On ZodError, send the error details back to Claude as a follow-up message: "Your output failed validation: [ZodError.flatten()]. Please regenerate." Retry up to 2 times before surfacing to user.
**Warning signs:** ZodError with `issues` array pointing to missing `.pages[0].authLevel` or similar — the model omitted a required enum field.

### Pitfall 2: Confirmation Gate Skipped in Iterate Path
**What goes wrong:** User requests a spec edit after initial confirmation. The re-parse runs, updates PageSpec[], writes to Neon — but no confirmation gate is shown for the changed pages.
**Why it happens:** Easy to wire the edit path directly to persistence for speed.
**How to avoid:** The confirmation gate (D-03) is always required. For edits, show only the affected pages with their before/after diff, but still require explicit confirmation before updating `pipeline_pages` status to "spec-changed."

### Pitfall 3: SpecPhaseOutputSchema in design-schema.ts is the Wrong Contract
**What goes wrong:** Developer uses the Phase 1 skeleton schema (`SpecPhaseOutputSchema` in `shared/design-schema.ts`) instead of the full layered schema from `shared/spec-schema.ts`.
**Why it happens:** `design-schema.ts` already exists and has a SpecPhaseOutputSchema export — natural to reach for it.
**How to avoid:** Phase 2 creates `shared/spec-schema.ts` as the authoritative spec contract. Update the orchestrator SKILL.md to reference `spec-schema.ts`. The Phase 1 `SpecPhaseOutputSchema` can either be removed or kept as a deprecated shim.

### Pitfall 4: Backend Spec Auto-Derivation Misses Implied Endpoints
**What goes wrong:** Auto-derivation reads `dataRequirements[].source` from the data layer, but many data requirements don't have an explicit source because the user didn't specify it. The derived backend spec is incomplete.
**Why it happens:** D-10 says auto-generation always runs, but the data layer only has explicit sources when the AI inferred them during spec restructuring.
**How to avoid:** The derive-backend-spec pass should instruct Claude to infer CRUD endpoints for every `dataRequirements[].fields` array it encounters, even without an explicit source. The mismatch detection (D-11) then flags anything the user's backend paste contradicts.

### Pitfall 5: Chunked Spec Loses Cross-Chunk Dependencies
**What goes wrong:** Page A (chunk 1) references a component described in page B (chunk 2). The deduplication merge pass doesn't catch it because the two descriptions used different language across chunks.
**Why it happens:** Each chunk is restructured independently; shared components are deduplicated in a merge pass, but the merge pass only catches structurally identical names, not semantically equivalent ones.
**How to avoid:** The merge pass must be an AI call, not a string comparison. Feed all chunks' `sharedComponents[]` arrays to Claude and ask it to deduplicate semantically. This is the same deduplication strategy as within-chunk deduplication but across chunk boundaries.

### Pitfall 6: `suggestedOrder` Ignores Implicit Shell Pages
**What goes wrong:** The user's spec doesn't mention an "App Shell" or "Layout" page explicitly. The suggested order puts the dashboard first, but Phase 3 needs a layout shell to exist before dashboard content can be integrated.
**Why it happens:** D-14 says foundational pages first, but if they're not in the spec, they don't appear in the output.
**How to avoid:** During gap-fill (D-02, D-05 implied requirements), always check for and inject a layout shell page if none is detected. Auth pages, 404, and loading skeletons are similarly implied for any authenticated app.

---

## Code Examples

### Collaborative Flow Entry Point
```typescript
// .claude/skills/saas-dev/spec-parser/ — invocation handler (pseudocode for SKILL.md)
// Step 1: Detect input path
if (userPastedSpec) {
  rawOutput = await restructureSpec(pastedText);        // SPEC-01
} else {
  rawOutput = await runCollaborativeFlow();             // SPEC-02
}

// Step 2: Run deduplication pass (always)
rawOutput = await deduplicateSharedComponents(rawOutput);

// Step 3: Derive backend spec from data layer
rawOutput.backendSpec = await deriveBackendSpec(rawOutput.pages);

// Step 4: Confirmation gate — never skip (D-03, D-04)
confirmed = await presentSpecForConfirmation(rawOutput);
if (!confirmed) goto Step 1 with user feedback;

// Step 5: Persist to Neon pipeline_pages
await persistSpecToPipeline(projectId, runId, rawOutput);
```

### PageSpec Persistence Pattern
```typescript
// Reuse pipeline_pages table from Phase 1
// Store each PageSpecFull as JSON in the output column
await db.insert(pipelinePages).values({
  runId,
  projectId,
  pageName: page.name,
  pageIndex: idx,
  phase: "spec",
  status: "complete",
  output: JSON.stringify(page),   // TEXT column — serialized PageSpecFull
});
```

### Spec Version Bump on Edit (D-16, D-19)
```typescript
// When user edits a single page spec:
await db.update(pipelinePages)
  .set({
    output: JSON.stringify({ ...updatedPage, specVersion: prev.specVersion + 1 }),
    status: "spec-changed",
    updatedAt: new Date(),
  })
  .where(
    and(
      eq(pipelinePages.runId, runId),
      eq(pipelinePages.pageName, pageName)
    )
  );
// Downstream phase rows for this page get flagged separately
```

### Backend Spec Zod Contract
```typescript
// shared/spec-schema.ts (addition)
export const BackendEndpointSpec = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string(),
  description: z.string(),
  requestBody: z.array(z.string()).default([]),
  responseFields: z.array(z.string()).default([]),
  authRequired: z.boolean().default(true),
  uiPageRef: z.string().optional(),   // which PageSpec.route this serves
});

export const BackendSpecSchema = z.object({
  endpoints: z.array(BackendEndpointSpec),
  drizzleTableHints: z.array(z.string()).default([]),  // e.g., "tasks table with userId FK"
  backgroundJobs: z.array(z.string()).default([]),     // cron jobs, webhooks (D-12)
  mismatches: z.array(z.string()).default([]),         // flagged UI/backend conflicts (D-11)
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Parse specs with regex or NLP libraries | Use LLMs with structured output + Zod validation | 2023-2024 | Handles format-agnostic input; regex is brittle for natural language specs |
| OpenAI function calling for JSON | Anthropic messages API with JSON instruction in system prompt | 2024 | Anthropic doesn't have a separate function-calling API in the same style; use system prompt + Zod parse |
| Store spec in files (JSON in repo) | Pipeline state in PostgreSQL only | Locked in Phase 1 (D-06) | Enables resume, per-page checkpointing, version tracking |

**Current Anthropic SDK pattern (verified against project's anthropic-service.ts):**
- Constructor: `new Anthropic({ apiKey, baseURL })` — both vars already in .env
- Call: `client.messages.create({ model, max_tokens, system, messages })` — no separate function-calling API needed
- JSON extraction: Claude returns text; parse JSON from response.content[0].text (strip markdown fences)
- Model: Use `claude-sonnet-4-5` for spec parsing (complexity warrants Sonnet; Haiku may hallucinate fields)

---

## Open Questions

1. **SpecPhaseOutputSchema migration strategy**
   - What we know: `shared/design-schema.ts` exports `SpecPhaseOutputSchema` as a Phase 1 skeleton. Phase 2 creates the authoritative layered schema in `shared/spec-schema.ts`.
   - What's unclear: Should the Phase 1 skeleton be deleted, kept as a shim, or extended in place?
   - Recommendation: Create `shared/spec-schema.ts` as the authoritative file. Deprecate `SpecPhaseOutputSchema` in `design-schema.ts` with a comment pointing to the new file. Don't delete it until the orchestrator SKILL.md is updated, to avoid breaking any reference.

2. **Confirmation gate UX in a skill**
   - What we know: The confirmation gate (D-03) requires showing inferred vs explicit items distinctly. Claude Code skills are markdown instructions — they direct Claude Code's behavior.
   - What's unclear: Whether the skill should produce a formatted markdown output for Claude Code to display to the user, or whether Claude Code handles the display from the raw data.
   - Recommendation: The `lib/spec-parser/` pure functions produce data structures with an `inferred: boolean` flag on each item. The SKILL.md instructs Claude Code to render these as distinct sections (e.g., "Explicit: ... | Inferred: ..."). This keeps rendering logic in the skill, data logic in the library.

3. **Event taxonomy extraction depth**
   - What we know: ANLYT-01 requires event taxonomy extracted during spec parsing (Phase 6 consumes it). The analytics layer in PageSpecFull captures this as `events[]`.
   - What's unclear: How detailed should event extraction be at spec time? Phase 6 is the analytics instrumentation phase — there's a risk of under-specifying (Phase 6 has nothing to work with) or over-specifying (spec phase spends too long on analytics).
   - Recommendation: At spec time, extract page-level events only (page viewed, primary action taken, error encountered). Phase 6 adds interaction-level events during instrumentation. This gives Phase 6 a starting taxonomy without spec phase becoming an analytics planning exercise.

---

## Environment Availability

Step 2.6: Environment audit performed. All required dependencies are already installed.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@anthropic-ai/sdk` | AI spec parsing and restructuring | Yes | 0.37.0 | — |
| `zod` | PageSpec schema contracts | Yes | 3.25.76 | — |
| `postgres` / `@neondatabase/serverless` | Pipeline state persistence | Yes | 3.4.5 / 0.10.4 | — |
| `p-retry` | AI call retry logic | Yes | 7.1.1 | — |
| `vitest` | Unit tests for lib/spec-parser/ | Yes | 2.x (pinned) | — |
| `drizzle-orm` | Database queries | Yes | 0.39.1 | — |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` env var | Anthropic SDK auth | Yes (in .env) | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 2.x (pinned — Vite 5.4.15 incompatible with vitest 4+) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/unit/spec-parser/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SPEC-01 | Raw text input produces valid PageSpec[] | unit | `npx vitest run tests/unit/spec-parser/parse-spec.test.ts` | No — Wave 0 |
| SPEC-02 | Collaborative flow produces valid PageSpec[] | manual-only | N/A — requires live AI conversation | — |
| SPEC-03 | PageSpecFull has all four layers populated | unit | `npx vitest run tests/unit/spec-parser/parse-spec.test.ts` | No — Wave 0 |
| SPEC-04 | BackendSpec derivation from UI data layer | unit | `npx vitest run tests/unit/spec-parser/derive-backend-spec.test.ts` | No — Wave 0 |
| SPEC-05 | Implied requirements (auth, error, loading states) are inferred | unit (mock AI) | `npx vitest run tests/unit/spec-parser/restructure-spec.test.ts` | No — Wave 0 |

**SPEC-02 manual-only justification:** Collaborative flow is an interactive multi-turn conversation with a live AI model. Automated testing would require mocking the entire Anthropic conversation loop, which adds complexity without meaningful signal. Manual smoke test: invoke the spec-parser skill with no spec document, verify the skill asks the domain-first questions in the correct sequence, verify the resulting output passes `SpecOutputSchema.parse()`.

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/spec-parser/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/spec-parser/parse-spec.test.ts` — covers SPEC-01, SPEC-03 (unit tests with fixture inputs)
- [ ] `tests/unit/spec-parser/restructure-spec.test.ts` — covers SPEC-05 (mock Anthropic SDK, verify inferred fields populated)
- [ ] `tests/unit/spec-parser/derive-backend-spec.test.ts` — covers SPEC-04 (pure function test with fixture PageSpec[])
- [ ] `tests/unit/spec-parser/deduplicate-components.test.ts` — covers D-20 deduplication (mock AI, verify merge output)
- [ ] `tests/unit/spec-parser/chunk-spec.test.ts` — covers D-24/D-25 chunking logic (pure function, no AI needed)

---

## Sources

### Primary (HIGH confidence)
- `shared/design-schema.ts` (project file) — Phase 1 schema patterns, `SpecPhaseOutputSchema` skeleton, `pipelinePages` table structure
- `lib/detect-framework.ts` (project file) — Pure function module pattern to replicate in `lib/spec-parser/`
- `lib/stitch/types.ts` (project file) — Typed wrapper pattern for AI client modules
- `server/ai/anthropic-service.ts` (project file) — Anthropic SDK instantiation pattern, `messages.create` call signature, model names, env var keys
- `.claude/skills/saas-dev/orchestrator/SKILL.md` (project file) — Skill definition format, namespace convention
- `.planning/phases/01-foundation/01-CONTEXT.md` (project file) — All Phase 1 decisions, especially D-06 (Neon-only state), D-08 (modular Zod shapes), D-22 (separate schema file)
- `vitest.config.ts` (project file) — Test environment config, include patterns
- `tests/unit/detect-framework.test.ts` (project file) — Unit test pattern to mirror

### Secondary (MEDIUM confidence)
- Zod documentation `.merge()` pattern — verified against project's existing drizzle-zod usage in design-schema.ts
- Anthropic SDK messages API — verified against project's anthropic-service.ts implementation (not guessed)

### Tertiary (LOW confidence)
- None — all findings are based on project code, not external sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already installed, patterns already established in Phase 1
- Architecture: HIGH — directly follows detect-framework.ts (pure function) and anthropic-service.ts (AI wrapper) patterns from project
- Pitfalls: HIGH — derived from locked decisions and known failure modes of structured AI output parsing
- Zod field names (discretion area): MEDIUM — proposed names are reasonable; planner has discretion to adjust

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable domain — Anthropic SDK, Zod, and Drizzle are stable; no expiry risk)
