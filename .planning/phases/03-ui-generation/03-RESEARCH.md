# Phase 3: UI Generation - Research

**Researched:** 2026-03-28
**Domain:** Google Stitch API, Claude structured outputs, design token extraction, self-review scoring
**Confidence:** HIGH (existing code is the primary source of truth; external research confirmed SDK status)

---

## Summary

Phase 3 orchestrates three tightly coupled concerns: calling Stitch to generate UI screens page by page, extracting and progressively building design tokens and component patterns from approved output, and running a structured 4-dimension self-review with Claude Sonnet to decide auto-approve vs. user escalation.

The foundation is already in place. `lib/stitch/client.ts` implements `generateScreen()` with pRetry and correct `StitchToolClient` instantiation. `shared/design-schema.ts` defines `dmTokens`, `dmPages`, `dmPatterns`, and `pipelinePages` tables already deployed to Neon. `UiGenPhaseOutputSchema` is defined. The missing piece is `lib/ui-generator/` — a new module that wires these pieces together into a page-level pipeline with Stitch prompt construction, Claude-based token extraction, Claude-based self-review, the approval gate, and the SKILL.md.

One infrastructure prerequisite: the installed `@anthropic-ai/sdk` is at 0.37.0, but Claude structured outputs (`output_config.format`) became generally available in a later release. The current codebase workaround (used in Phase 2's `restructure-spec.ts`) is a robust `extractJsonFromResponse()` helper that strips markdown fences and parses JSON. That same pattern works for Phase 3 without an SDK upgrade. If the upgrade is made, `output_config` guarantees zero JSON parse errors. Both paths are viable; the planner should decide.

**Primary recommendation:** Build `lib/ui-generator/` as a collection of focused pure functions following the same `lib/spec-parser/` pattern. The SKILL.md for `saas-dev:ui-generator` wires these functions into the page-level pipeline with approval gate logic. Stitch is called via the existing `generateScreen()` wrapper.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Stitch Prompt Design**
- D-01: Spec-faithful prompt depth — translate PageSpec fields directly into Stitch prompt (components list, layout hints, auth level, empty/loading/error state descriptions) while leaving visual interpretation to Stitch. Not pixel-precise, not minimal.
- D-02: Design token injection via inline constraints in prompt text ("Use primary color #1a1a2e, border-radius 8px, Inter font family") PLUS reference screenshots when available (user-provided during spec creation or from prior approved pages).
- D-03: Device type is user-configured, not hardcoded. User declares targets at Phase 3 start (desktop only, desktop + mobile, etc.). Default to desktop only. When multiple targets selected, generate one Stitch call per device type per page.
- D-04: Feedback-informed retry on rejection — user provides specific feedback ("make sidebar narrower"), system appends to prompt, re-calls Stitch. Up to 3 retries before escalating with full history for manual intervention.

**Design Token Extraction**
- D-05: AI-based extraction from Stitch HTML output using Claude. Send HTML to Claude with structured prompt to extract color palette, typography, spacing, border radius, shadow style into dmTokens schema shape. Validate against schema, show to user for confirmation, then persist to Neon.
- D-06: Extract both design tokens AND component patterns (card style, button variants, nav layout). Patterns stored in dmPatterns for richer Stitch context on subsequent pages.
- D-07: Progressive token evolution — tokens grow with each approved page but don't change existing values. Uses dmTokens immutable revision model (new version row per extraction, prior values carried forward).
- D-08: Pattern conflict detection — when a new page introduces a component pattern that differs from an established one, AI flags the conflict. User decides: unify to existing pattern, keep both as named variants, or override with new pattern going forward.

**Self-Review & Confidence**
- D-09: Four-dimension structured self-review checklist: (1) Spec compliance, (2) Visual consistency, (3) Structural completeness, (4) Content quality.
- D-10: High confidence threshold — 90%+ across ALL dimensions for auto-approval. Any single dimension below 90% triggers user escalation.
- D-11: AI-based review implementation using Claude Sonnet. Send Stitch HTML + screenshot(s) + PageSpec + design tokens + prior page patterns. Returns per-dimension scores with specific findings as structured JSON.
- D-12: When multiple device types generated per page, desktop and mobile reviewed together in a single Claude call. One combined score set covers both.

**Approval Gate Flow**
- D-13: Page 1 always escalates to user regardless of self-review score (UIGEN-06).
- D-14: Approval gate shows: Stitch screenshot(s), self-review scores per dimension with specific findings, original PageSpec with component checklist (found/missing), and three action options.
- D-15: Three user actions at gate: Approve, Reject+feedback (triggers feedback-informed retry per D-04), Skip.
- D-16: Brief notification for auto-approved pages — one-line summary. Full gate displayed only for escalated pages.

### Claude's Discretion
- Stitch prompt template structure and exact wording
- AI extraction prompt engineering for design tokens and patterns
- Self-review prompt engineering and scoring calibration
- How pattern conflict detection determines "same" vs "different" patterns
- Internal page processing order within the suggested generation order
- How feedback is formatted when appended to Stitch retry prompts

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UIGEN-01 | System calls Google Stitch API with page spec and receives generated code + visual preview | `generateScreen()` in `lib/stitch/client.ts` already wraps the API. Phase 3 builds the Stitch prompt constructor that translates `PageSpecFull` fields into a prompt string. |
| UIGEN-02 | System stores approved page design context (tokens, patterns, layout decisions) in Neon PostgreSQL | `dmTokens`, `dmPatterns`, `dmPages` tables already in Neon via `shared/design-schema.ts`. Extraction logic goes in `lib/ui-generator/extract-tokens.ts`. |
| UIGEN-03 | System injects prior design context into Stitch prompts for subsequent pages | Token injection is inline text constraints in the prompt. `lib/ui-generator/build-stitch-prompt.ts` reads latest dmTokens version and formats constraints. |
| UIGEN-04 | System self-reviews generated output against spec requirements (structured checklist) | Claude Sonnet call with HTML + spec, returns structured JSON with per-dimension scores. `lib/ui-generator/self-review.ts` implements this. |
| UIGEN-05 | System self-reviews generated output against previously approved pages for visual consistency | Same self-review call includes stored design tokens and prior page screenshots as context. Visual consistency is dimension 2 of the 4-dimension score. |
| UIGEN-06 | Page 1 always escalates to user for approval regardless of self-review score | Logic branch in `lib/ui-generator/approval-gate.ts` — if `pageIndex === 0`, always return `needsUserApproval: true`. |
| UIGEN-07 | Subsequent pages auto-approve if self-review passes, escalate to user if below confidence threshold | Self-review returns per-dimension scores; if all >= 0.9, auto-approve. Implemented in `approval-gate.ts`. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/stitch-sdk` | installed (pinned) | Generate UI screens via Stitch API | Already installed; `generateScreen()` wrapper exists |
| `@anthropic-ai/sdk` | 0.37.0 (installed) | Claude calls for token extraction and self-review | Already in use across project; env vars configured |
| `zod` | 3.25.76 | Schema validation for all structured outputs from Claude | Already the project standard — every AI output validated through Zod |
| `p-retry` | 7.1.1 | Retry logic for Stitch calls and Claude calls | Already used in `lib/stitch/client.ts` and `lib/spec-parser/restructure-spec.ts` |
| `postgres` + `drizzle-orm` | 3.4.5 / 0.39.1 | Read/write design memory to Neon | Already the project database layer |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node-fetch` or native `fetch` | Node 18+ built-in | Download HTML from Stitch presigned URL | Required because `getHtml()` returns a URL, not raw content — must fetch it |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `extractJsonFromResponse()` helper (Phase 2 pattern) | `output_config` structured outputs (requires SDK >= 0.60+) | SDK upgrade from 0.37.0 to 0.80.0 would enable guaranteed JSON; current helper is battle-tested in Phase 2 and sufficient for v1 |

**Installation:**
```bash
# No new dependencies required for core functionality.
# If SDK upgrade is chosen for structured outputs:
npm install @anthropic-ai/sdk@latest
```

**Version verification:** All core dependencies already installed and tested (110 tests passing).

---

## Architecture Patterns

### Recommended Project Structure
```
lib/ui-generator/
├── build-stitch-prompt.ts   # Translates PageSpecFull + tokens into Stitch prompt string
├── extract-tokens.ts        # Claude call to extract dmTokens + dmPatterns from Stitch HTML
├── self-review.ts           # Claude call for 4-dimension structured score
├── approval-gate.ts         # Decides auto-approve vs. escalate; formats gate display
├── conflict-detector.ts     # Detects component pattern conflicts vs. established patterns
└── types.ts                 # ReviewScore, ApprovalGateResult, TokenExtractionResult types

.claude/skills/saas-dev/ui-generator/
└── SKILL.md                 # saas-dev:ui-generator skill — page pipeline orchestration

tests/unit/ui-generator/
├── build-stitch-prompt.test.ts
├── extract-tokens.test.ts
├── self-review.test.ts
├── approval-gate.test.ts
└── conflict-detector.test.ts
```

### Pattern 1: Stitch Prompt Construction
**What:** Pure function that accepts `PageSpecFull` + current `dmTokens` (nullable for page 1) and returns a prompt string.
**When to use:** Called before every `generateScreen()` invocation.

```typescript
// lib/ui-generator/build-stitch-prompt.ts
import type { PageSpecFull } from "@shared/spec-schema.js";
import type { InferSelectModel } from "drizzle-orm";
import type { dmTokens } from "@shared/design-schema.js";

type DmTokens = InferSelectModel<typeof import("@shared/design-schema.js").dmTokens>;

export function buildStitchPrompt(
  spec: PageSpecFull,
  tokens: DmTokens | null,
  priorScreenshotUrl?: string
): string {
  const parts: string[] = [];

  // Spec-faithful description (D-01)
  parts.push(`Design a ${spec.name} page for a SaaS application.`);
  parts.push(`Purpose: ${spec.purpose}`);
  parts.push(`Components required: ${spec.components.join(", ")}`);
  if (spec.layoutHint) parts.push(`Layout: ${spec.layoutHint}`);
  if (spec.emptyState) parts.push(`Empty state: ${spec.emptyState}`);
  if (spec.loadingState) parts.push(`Loading state: ${spec.loadingState}`);
  if (spec.errorState) parts.push(`Error state: ${spec.errorState}`);
  if (spec.authLevel !== "public") parts.push(`This page requires authentication.`);

  // Token injection as inline constraints (D-02)
  if (tokens) {
    const constraints: string[] = [];
    if (tokens.colorPrimary) constraints.push(`primary color ${tokens.colorPrimary}`);
    if (tokens.colorSecondary) constraints.push(`secondary color ${tokens.colorSecondary}`);
    if (tokens.typeFontFamily) constraints.push(`font family ${tokens.typeFontFamily}`);
    if (tokens.borderRadius) constraints.push(`border radius ${tokens.borderRadius}px`);
    if (tokens.colorBackground) constraints.push(`background color ${tokens.colorBackground}`);
    if (constraints.length > 0) {
      parts.push(`Visual constraints (must be followed exactly): ${constraints.join(", ")}.`);
    }
  }

  return parts.join(" ");
}
```

**Key insight from Stitch prompt guide:** Use plain language. Do not mix layout changes and component specification in the same prompt. Inline constraints ("Use primary color #1a1a2e") are the correct injection pattern — Stitch processes them as hard layout/theme constraints.

### Pattern 2: Claude-Based Token Extraction
**What:** Fetches HTML from presigned URL, sends to Claude with structured extraction prompt, validates against dmTokens shape.
**When to use:** Called after user approves page 1 (sets design anchor), and after each subsequent approval to grow tokens progressively.

```typescript
// lib/ui-generator/extract-tokens.ts
// Source: Phase 2 restructure-spec.ts pattern + design-schema.ts shape

import Anthropic from "@anthropic-ai/sdk";
import { extractJsonFromResponse } from "../spec-parser/restructure-spec.js";
import { insertDmTokenSchema } from "@shared/design-schema.js";

const client = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

export interface TokenExtractionInput {
  htmlContent: string;       // fetched from Stitch htmlUrl
  projectId: string;
  nextVersion: number;
  priorTokens: Partial<TokenRow> | null;  // carry forward existing values
}

export async function extractTokensFromHtml(
  input: TokenExtractionInput
): Promise<TokenRow> {
  // ... Claude call with structured extraction prompt
  // Validates with insertDmTokenSchema.parse()
  // Returns merged token row (prior values + new values from this page)
}
```

**Critical pattern — presigned URL fetch:** Stitch `getHtml()` returns a presigned URL. The HTML content must be fetched with `node-fetch` or native `fetch` before sending to Claude. This is documented in `lib/stitch/types.ts` as "presigned URL, not raw content."

### Pattern 3: Self-Review Scoring
**What:** Claude Sonnet call that returns per-dimension scores + findings as structured JSON.
**When to use:** After each `generateScreen()` call, before the approval gate decision.

```typescript
// lib/ui-generator/self-review.ts
// Mirrors restructure-spec.ts pattern — send to Claude, extractJsonFromResponse, validate with Zod

export const ReviewScoreSchema = z.object({
  specCompliance: z.object({
    score: z.number().min(0).max(1),
    findings: z.array(z.string()),
  }),
  visualConsistency: z.object({
    score: z.number().min(0).max(1),
    findings: z.array(z.string()),
  }),
  structuralCompleteness: z.object({
    score: z.number().min(0).max(1),
    findings: z.array(z.string()),
  }),
  contentQuality: z.object({
    score: z.number().min(0).max(1),
    findings: z.array(z.string()),
  }),
});
export type ReviewScore = z.infer<typeof ReviewScoreSchema>;

export const CONFIDENCE_THRESHOLD = 0.9;  // D-10

export function allDimensionsPass(score: ReviewScore): boolean {
  return (
    score.specCompliance.score >= CONFIDENCE_THRESHOLD &&
    score.visualConsistency.score >= CONFIDENCE_THRESHOLD &&
    score.structuralCompleteness.score >= CONFIDENCE_THRESHOLD &&
    score.contentQuality.score >= CONFIDENCE_THRESHOLD
  );
}
```

### Pattern 4: Approval Gate
**What:** Pure function — accepts `pageIndex`, `ReviewScore`, and `DeviceOutputs`, returns `ApprovalGateResult`.
**When to use:** Called after self-review for every page. Gate shows for page 1 always and for failed reviews.

```typescript
// lib/ui-generator/approval-gate.ts

export interface ApprovalGateResult {
  needsUserApproval: boolean;
  reason: "first_page" | "score_below_threshold" | "auto_approved";
  failedDimension?: keyof ReviewScore;
}

export function evaluateApprovalGate(
  pageIndex: number,
  score: ReviewScore
): ApprovalGateResult {
  // Page 1 always escalates (D-13, UIGEN-06)
  if (pageIndex === 0) {
    return { needsUserApproval: true, reason: "first_page" };
  }
  if (!allDimensionsPass(score)) {
    // Find first failing dimension to report
    const failed = firstFailingDimension(score);
    return { needsUserApproval: true, reason: "score_below_threshold", failedDimension: failed };
  }
  return { needsUserApproval: false, reason: "auto_approved" };
}
```

### Anti-Patterns to Avoid
- **Fetching raw HTML inline inside the prompt builder:** Prompt construction is pure and synchronous. Fetch the HTML before calling `buildStitchPrompt` — separate the I/O from the logic.
- **Storing design tokens in JSON files:** Design memory must go to Neon (`dmTokens` table) per ORCH-02. No file-based token storage.
- **Calling Stitch with a token-injected prompt for page 1:** Page 1 has no prior tokens. Pass `tokens: null` — the function handles gracefully.
- **Treating Stitch presigned URLs as permanent:** They expire. Download HTML and screenshot to memory or temp storage immediately after generation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retry logic for Stitch and Claude API calls | Custom retry loop | `pRetry` | Already used in `lib/stitch/client.ts` and Phase 2. Handles exponential backoff, AbortError for non-recoverable errors |
| JSON parsing from Claude with markdown fences | Custom regex per module | `extractJsonFromResponse()` from `lib/spec-parser/restructure-spec.ts` | Already battle-tested in Phase 2 — import and reuse |
| Zod validation of extracted tokens | Manual field checks | `insertDmTokenSchema.parse()` from `@shared/design-schema` | Schema already defined and tested |
| Database writes for tokens/patterns | Raw SQL | Drizzle ORM insert with `insertDmTokenSchema` | Type-safe, consistent with the entire codebase |
| Fetching presigned URLs | Custom download logic | Native `fetch()` (Node 18+) | Built into runtime — no dependency needed |

**Key insight:** The extraction, retry, validation, and persistence primitives are ALL already in the codebase. Phase 3 is an orchestration layer, not a new infrastructure layer.

---

## Common Pitfalls

### Pitfall 1: Stitch Returns Presigned URLs, Not Raw Content
**What goes wrong:** Code tries to use `htmlUrl` as if it is HTML content (passes to string processing). Crashes or produces empty extraction.
**Why it happens:** `screen.getHtml()` returns a download URL (presigned GCS URL). Raw content must be fetched.
**How to avoid:** Always `await fetch(result.htmlUrl).then(r => r.text())` before passing to Claude or any string processing.
**Warning signs:** Token extraction receiving a URL-like string as input, Claude outputting "this appears to be a URL, not HTML."

### Pitfall 2: SDK 0.37.0 Does Not Have `output_config`
**What goes wrong:** Attempt to use `output_config: { format: { type: "json_schema", ... } }` causes TypeScript compile error or runtime error with SDK 0.37.0.
**Why it happens:** `output_config` became available in SDK versions 0.60+. Current installed is 0.37.0 (latest is 0.80.0).
**How to avoid:** Either (a) use the established `extractJsonFromResponse()` + Zod pattern as in Phase 2, or (b) upgrade SDK to 0.80.0 before using `output_config`. Do not assume `output_config` is available without upgrading.
**Warning signs:** TypeScript error "Property 'output_config' does not exist on type MessageCreateParams."

### Pitfall 3: Token Evolution Mutation Risk
**What goes wrong:** When carrying forward prior token values, code overwrites an existing value with `null` or `undefined` from the new page extraction (which may not set every field).
**Why it happens:** Merge logic uses spread: `{ ...priorTokens, ...newTokens }` where `newTokens` has explicit nulls.
**How to avoid:** Only merge fields where the new extraction returned a non-null value. Prior values are immutable (D-07) — new page only adds; never deletes or overwrites.
**Warning signs:** Token version 2 showing `null` for a field that was set in version 1.

### Pitfall 4: Claude Input Token Overflow with Large HTML
**What goes wrong:** Stitch generates verbose HTML with inline styles. Sending full HTML + PageSpec + tokens + patterns can exceed Claude's context window for complex pages.
**Why it happens:** Stitch output can be 50-200KB of HTML. Adding prior page screenshots (as text descriptions, not images) compounds this.
**How to avoid:** Truncate or summarize HTML before sending to Claude if it exceeds ~80KB. For token extraction, extract only the `<style>` tag and inline styles — these contain the design tokens. For self-review, send the HTML body structure, not the full document.
**Warning signs:** Claude API returning 400 with "input too long" or 413.

### Pitfall 5: Pattern Conflict False Positives
**What goes wrong:** Every slightly different card or button variant triggers a conflict alert, fatiguing the user with constant decisions.
**Why it happens:** Overly strict string-matching comparison of `propsShape` or `usageContext` fields.
**How to avoid:** Conflict detection should compare the semantic intent of a pattern (e.g., "card with header and body") not pixel-level CSS values. Use Claude to determine semantic equivalence, not string comparison.
**Warning signs:** More than 1-2 conflicts per page generation on typical SaaS pages.

### Pitfall 6: pRetry Retry Count vs. User Retry Count
**What goes wrong:** Conflating the 2-retry pRetry transient error handling in `generateScreen()` with the 3-retry feedback-informed user rejection loop (D-04).
**Why it happens:** Both are called "retries" but serve different purposes.
**How to avoid:** Keep them separate. pRetry in `generateScreen()` handles API transients automatically. The user rejection retry loop is a separate count tracked in the SKILL.md orchestration — max 3 user rejections before escalating with full history.

---

## Code Examples

Verified patterns from existing codebase:

### Existing Claude API Call Pattern (from `lib/spec-parser/restructure-spec.ts`)
```typescript
// Source: lib/spec-parser/restructure-spec.ts — established pattern to follow
const client = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

// pRetry wraps the Claude call for transient error handling
const result = await pRetry(async () => {
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const parsed = extractJsonFromResponse(text);
  return TargetSchema.parse(parsed);  // Zod validation — throws on mismatch, triggers pRetry
}, { retries: 2, minTimeout: 1000, factor: 2 });
```

### Stitch Screen Generation (from `lib/stitch/client.ts`)
```typescript
// Source: lib/stitch/client.ts — use as-is, do not re-implement
const result: StitchGenerateResult = await generateScreen(projectId, {
  prompt: buildStitchPrompt(spec, currentTokens),
  deviceType: "DESKTOP",  // or user-configured device type
});
// result.htmlUrl and result.screenshotUrl are presigned URLs — fetch to get content
const htmlContent = await fetch(result.htmlUrl).then(r => r.text());
```

### Drizzle Insert for Design Tokens (from `shared/design-schema.ts` pattern)
```typescript
// Source: design-schema.ts insertDmTokenSchema — established Drizzle insert pattern
import { db } from "../db.js";
import { dmTokens, insertDmTokenSchema } from "@shared/design-schema.js";

const newRow = insertDmTokenSchema.parse({
  projectId,
  version: nextVersion,
  colorPrimary: extracted.colorPrimary ?? prior?.colorPrimary,
  colorSecondary: extracted.colorSecondary ?? prior?.colorSecondary,
  typeFontFamily: extracted.typeFontFamily ?? prior?.typeFontFamily,
  borderRadius: extracted.borderRadius ?? prior?.borderRadius,
  // ... carry forward all fields with nullish coalescing
});
await db.insert(dmTokens).values(newRow);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Anthropic beta header `structured-outputs-2025-11-13` | `output_config.format` (GA, no beta header needed) | ~SDK 0.60+ / Nov 2025 | Old beta approach still works in transition period; new `output_config` is cleaner |
| Stitch: `new Stitch({ apiKey })` | `new Stitch(new StitchToolClient({ apiKey }))` | Phase 1 discovery | Already captured in `lib/stitch/client.ts` — do not regress |
| Stitch outputs raw HTML inline | Stitch returns presigned URLs | Always (Stitch design) | Must fetch URLs to get content — documented as Pitfall #4 in existing code |
| `drizzle-kit push` interactive | Direct SQL via tsx for CI | Phase 1 discovery | `CREATE TABLE IF NOT EXISTS` for non-interactive environments |

**Deprecated/outdated:**
- `output_format` (top-level param): replaced by `output_config.format` — old form still works in transition but `output_format` is deprecated
- `vitest@4`: not compatible with Vite 5.4.15 — project pins `vitest@2.x` (confirmed working, 110 tests pass)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `STITCH_API_KEY` env var | `generateScreen()` | Unknown — must verify | — | Phase 3 blocked if missing; test warns on ENV_MISSING |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` env var | Claude calls | Available (used in Phase 2) | — | None — blocks token extraction and self-review |
| Neon PostgreSQL (`DATABASE_URL`) | `dmTokens`, `dmPatterns`, `dmPages` writes | Available (used Phase 1+2) | Neon serverless | None — blocks persistence |
| `@anthropic-ai/sdk` | Claude API calls | 0.37.0 installed | 0.37.0 | Latest 0.80.0 available if upgrade needed |
| `@google/stitch-sdk` | `generateScreen()` | Installed (Phase 1) | Pinned version | None — blocks all UI generation |
| Node.js native `fetch` | HTML download from presigned URL | Node 18+ built-in | Available | `node-fetch` if Node < 18 |

**Missing dependencies with no fallback:**
- `STITCH_API_KEY`: Required for all UI generation. Tests that call the live API will fail without it. Phase 3 test strategy must mock `generateScreen()` at the module boundary.

**Missing dependencies with fallback:**
- `@anthropic-ai/sdk` 0.37.0 vs 0.80.0: SDK upgrade is optional — Phase 2's `extractJsonFromResponse()` pattern works with 0.37.0.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 (pinned — Vite 5.4.15 incompatible with vitest@4) |
| Config file | `vitest.config.ts` (root) — uses single node environment |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` (no separate full/unit split currently) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UIGEN-01 | `buildStitchPrompt()` includes all PageSpec fields | unit | `npm run test -- tests/unit/ui-generator/build-stitch-prompt.test.ts` | Wave 0 |
| UIGEN-01 | `buildStitchPrompt()` with null tokens produces no constraint block | unit | same file | Wave 0 |
| UIGEN-02 | `extractTokensFromHtml()` returns valid `insertDmTokenSchema` shape | unit | `npm run test -- tests/unit/ui-generator/extract-tokens.test.ts` | Wave 0 |
| UIGEN-02 | Token carry-forward: prior values not overwritten by null | unit | same file | Wave 0 |
| UIGEN-03 | `buildStitchPrompt()` with tokens injects inline constraint text | unit | `npm run test -- tests/unit/ui-generator/build-stitch-prompt.test.ts` | Wave 0 |
| UIGEN-04 | `selfReview()` returns `ReviewScoreSchema`-valid object | unit | `npm run test -- tests/unit/ui-generator/self-review.test.ts` | Wave 0 |
| UIGEN-05 | Visual consistency dimension present in `ReviewScore` | unit | same file | Wave 0 |
| UIGEN-06 | `evaluateApprovalGate(0, anyScore)` returns `needsUserApproval: true` | unit | `npm run test -- tests/unit/ui-generator/approval-gate.test.ts` | Wave 0 |
| UIGEN-07 | `evaluateApprovalGate(1, allPass)` returns `needsUserApproval: false` | unit | same file | Wave 0 |
| UIGEN-07 | `evaluateApprovalGate(1, oneFail)` returns `needsUserApproval: true` with `failedDimension` | unit | same file | Wave 0 |

**Claude API calls (`extractTokensFromHtml`, `selfReview`) must be mocked with `vi.mock` at module boundary** — live API calls are not run in unit tests (same pattern as Phase 2 spec-parser tests).

### Sampling Rate
- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green (all 110 existing + new Phase 3 tests) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/ui-generator/build-stitch-prompt.test.ts` — covers UIGEN-01, UIGEN-03
- [ ] `tests/unit/ui-generator/extract-tokens.test.ts` — covers UIGEN-02
- [ ] `tests/unit/ui-generator/self-review.test.ts` — covers UIGEN-04, UIGEN-05
- [ ] `tests/unit/ui-generator/approval-gate.test.ts` — covers UIGEN-06, UIGEN-07
- [ ] `tests/unit/ui-generator/conflict-detector.test.ts` — covers D-08

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 3 |
|-----------|-------------------|
| Real code only — never pseudocode, never placeholders | All `lib/ui-generator/*.ts` files must be complete, compilable TypeScript |
| Secrets always in `.env` — never committed | `STITCH_API_KEY`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY` via `process.env` only |
| Must use `skill-creator` skill for build | `saas-dev:ui-generator` SKILL.md created as a Claude Code skill |
| Must use official Stitch API documentation | `lib/stitch/client.ts` is the only Stitch integration point — do not re-implement |
| Neon PostgreSQL for design consistency memory | All token/pattern persistence to `dmTokens` and `dmPatterns` tables — no JSON files |
| Brownfield-first | `lib/ui-generator/` reuses `extractJsonFromResponse()` from spec-parser, `generateScreen()` from stitch client — no rebuilding primitives |
| Every tool must be timeless, essential, cohesive | No new dependencies for Phase 3 unless absolutely necessary |
| GSD workflow enforcement | All changes through `/gsd:execute-phase` — no direct repo edits |

---

## Open Questions

1. **SDK upgrade: 0.37.0 → 0.80.0**
   - What we know: `output_config` structured outputs (guaranteed JSON schema compliance) require SDK >= ~0.60. Current installed is 0.37.0.
   - What's unclear: Are there breaking changes in 0.37.0 → 0.80.0 that would affect existing Phase 1/2 code?
   - Recommendation: Check CHANGELOG.md for breaking changes. If clean, upgrade before Phase 3 implementation to get `output_config` for both token extraction and self-review. If uncertain, use the existing `extractJsonFromResponse()` pattern — it works and is tested.

2. **HTML truncation threshold for Claude token limit**
   - What we know: Stitch HTML can be large (50-200KB). Claude has ~200K context window on Sonnet, but cost is proportional.
   - What's unclear: What is the typical Stitch HTML size in practice? Is a 80KB truncation threshold sufficient?
   - Recommendation: For token extraction, only send the `<style>` block + first 200 lines of HTML. For self-review, send the full `<body>` structure stripped of inline style attributes. Document the size limit as a constant `MAX_HTML_FOR_EXTRACTION = 80_000` chars.

3. **`STITCH_API_KEY` availability for live testing**
   - What we know: The existing `stitch-wrapper.test.ts` test exercises live API behavior (tests warn on auth failure but pass). A real key is needed for manual E2E smoke test.
   - What's unclear: Is the key configured in the `.env` on the dev machine?
   - Recommendation: Phase 3 unit tests must mock `generateScreen()`. A separate manual smoke test script should verify the live Stitch API before phase sign-off.

---

## Sources

### Primary (HIGH confidence)
- `lib/stitch/client.ts` — existing `generateScreen()` implementation; presigned URL behavior; SDK instantiation pattern
- `lib/stitch/types.ts` — `StitchGenerateRequest`, `StitchGenerateResult`, `StitchWrapperError`
- `shared/design-schema.ts` — `dmTokens`, `dmPatterns`, `dmPages`, `pipelinePages` table definitions; `UiGenPhaseOutputSchema`
- `shared/spec-schema.ts` — `PageSpecFull` fields consumed by prompt builder
- `lib/spec-parser/restructure-spec.ts` — `extractJsonFromResponse()` helper; established Claude API call pattern
- `vitest.config.ts` + `tests/unit/` — confirmed vitest@2.1.9, 110 tests passing, test file placement conventions

### Secondary (MEDIUM confidence)
- [Stitch SDK GitHub README](https://github.com/google-labs-code/stitch-sdk) — `project.generate(prompt, deviceType)` API confirmed; device type options confirmed; presigned URL behavior confirmed
- [Stitch Prompt Guide (Google AI Forum)](https://discuss.ai.google.dev/t/stitch-prompt-guide/83844) — inline plain language constraints; one concern per prompt; incremental refinement pattern
- [Anthropic Structured Outputs docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — `output_config.format` is GA on Claude Sonnet 4.6; old beta header deprecated but still works; no beta header needed in updated API

### Tertiary (LOW confidence — verify before using)
- WebSearch findings on March 2026 Stitch update (design system import): Low confidence — could not verify exact SDK-level API for this feature vs. web UI-only feature

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core dependencies already installed and confirmed working
- Architecture: HIGH — pattern is directly derived from existing `lib/spec-parser/` structure
- Pitfalls: HIGH — presigned URL and pRetry vs. user retry pitfalls are documented in existing code comments; SDK version gap verified against npm
- Self-review scoring calibration: LOW — 0.9 threshold is a locked decision (D-10) but empirical behavior with real Stitch output is untested (flagged in STATE.md)

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable libraries; Stitch SDK may evolve faster — re-verify if > 30 days)
