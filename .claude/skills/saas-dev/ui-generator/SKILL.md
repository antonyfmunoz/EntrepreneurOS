---
name: saas-dev:ui-generator
description: Generate pixel-quality UI for each page via Google Stitch API with design memory consistency and confidence-calibrated approval gates. Use when executing Phase 3 (ui-gen) of the SaaS development pipeline.
---

# Skill: saas-dev:ui-generator

Generate pixel-quality UI for each page via Google Stitch API with design memory consistency and confidence-calibrated approval gates.

## Prerequisites

- Phase 2 complete: SpecOutput with PageSpecFull[] available
- `STITCH_API_KEY` configured in .env
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` configured in .env
- `DATABASE_URL` configured for Neon PostgreSQL

## Inputs

- `specOutput: SpecOutput` — from Phase 2 (pages array, suggestedOrder)
- `projectConfig: ProjectConfig` — projectId, repoPath, framework, stitchProjectId
- `deviceTypes: DeviceType[]` — user-configured, default `["DESKTOP"]` per D-03

## Module Map

All modules live under `lib/ui-generator/` and `lib/stitch/`:

| Module | Export | Role |
|--------|--------|------|
| `lib/ui-generator/build-stitch-prompt.ts` | `buildStitchPrompt` | Build Stitch-ready prompt from PageSpec + tokens |
| `lib/stitch/client.ts` | `generateScreen` | Call Stitch API and return htmlUrl + screenshotUrl |
| `lib/ui-generator/self-review.ts` | `selfReview` | Claude Sonnet 4-dimension review of generated HTML |
| `lib/ui-generator/approval-gate.ts` | `evaluateApprovalGate`, `formatApprovalGateDisplay`, `formatAutoApproveNotice` | Decide auto-approve vs escalate |
| `lib/ui-generator/extract-tokens.ts` | `extractTokensFromHtml`, `mergeTokens` | Extract design tokens from HTML via Claude |
| `lib/ui-generator/conflict-detector.ts` | `detectPatternConflicts` | Identify conflicting component patterns |
| `lib/ui-generator/types.ts` | `ReviewScoreSchema`, `CONFIDENCE_THRESHOLD`, `DeviceType`, `MAX_HTML_FOR_REVIEW`, `MAX_PROMPT_TOTAL_CHARS` | Shared types and constants |
| `lib/ui-generator/component-discovery.ts` | `discoverComponents`, `formatDiscoveryForPrompt` | Multi-registry component lookup for prompt enrichment |

## Pipeline

### Step 0 — Device Type Configuration (D-03)

Ask user before starting page iteration:

```
Which device types should be generated for this project?
  1. DESKTOP only (default — fastest, web apps)
  2. DESKTOP + MOBILE (responsive sites, PWAs)
  3. DESKTOP + MOBILE + TABLET (full responsive)

Enter choice [1/2/3] or press Enter for default:
```

- Default to `["DESKTOP"]` if user skips or enters 1
- Store as `deviceTypes: DeviceType[]` for use in Step 2b

### Step 1 — Page Order

Determine processing order before entering the page loop:

```typescript
const pageOrder: PageSpecFull[] =
  specOutput.suggestedOrder.length > 0
    ? specOutput.suggestedOrder
        .map((route) => specOutput.pages.find((p) => p.route === route))
        .filter((p): p is PageSpecFull => p !== undefined)
    : [...specOutput.pages].sort((a, b) => a.priority - b.priority);
```

Log the processing order to the user before starting:

```
Processing pages in order:
  1. Login (/login) — priority 1
  2. Dashboard (/dashboard) — priority 2
  3. Settings (/settings) — priority 3
```

Initialize state:

```typescript
let currentTokens: DmTokenRow | null = null;
let existingPatterns: ExistingPattern[] = [];
let priorScreenshotUrl: string | undefined = undefined;
let completedPages = 0;
let skippedPages = 0;
let failedPages = 0;
```

### Step 2 — For Each Page (loop)

Iterate over `pageOrder`. Track `pageIndex` (0-based).

#### Step 2a — Build Stitch Prompt

##### Component Discovery (Enhancement)

Before building the prompt, query component registries for complex components:

```typescript
import { discoverComponents, formatDiscoveryForPrompt } from "../../lib/ui-generator/component-discovery.js";

const discoveryResult = await discoverComponents(pageSpec.components);
const componentReferences = formatDiscoveryForPrompt(discoveryResult);

if (discoveryResult.queriedComponents.length > 0) {
  console.log(`  Component discovery: queried ${discoveryResult.queriedComponents.join(", ")}`);
  console.log(`  Found ${discoveryResult.references.length} references from registries`);
}
```

Then pass the references to the prompt builder:

```typescript
import { buildStitchPrompt } from "../../lib/ui-generator/build-stitch-prompt.js";

const prompt = buildStitchPrompt(
  pageSpec,
  currentTokens,
  priorScreenshotUrl,
  componentDirection,      // from design system seed (Step 0.5)
  componentReferences,     // from component discovery
);
```

Component discovery is best-effort. If MCP tools are not configured, the pipeline continues with standard prompts. The total prompt is capped at MAX_PROMPT_TOTAL_CHARS (30,000 chars) to prevent unbounded growth.

`buildStitchPrompt` translates PageSpec fields into a Stitch-ready prompt string, injecting token constraints when available and referencing prior screenshots for visual continuity.

#### Step 2b — Call Stitch API (one call per device type)

```typescript
import { generateScreen } from "../../lib/stitch/client.js";

const generationResults: Array<{
  htmlUrl: string;
  screenshotUrl: string;
  htmlContent: string;
  deviceType: DeviceType;
}> = [];

for (const deviceType of deviceTypes) {
  const result = await generateScreen(projectConfig.stitchProjectId!, {
    prompt,
    deviceType,
  });

  // CRITICAL — Pitfall 1: Stitch returns a presigned URL, NOT raw HTML.
  // Always fetch the HTML content separately before passing to selfReview or extractTokens.
  const htmlContent = await fetch(result.htmlUrl).then((r) => r.text());

  generationResults.push({
    htmlUrl: result.htmlUrl,
    screenshotUrl: result.screenshotUrl,
    htmlContent,
    deviceType,
  });
}
```

The desktop result is the primary HTML for review and extraction:

```typescript
const desktopResult = generationResults.find((r) => r.deviceType === "DESKTOP")
  ?? generationResults[0];
const screenshotUrls = generationResults.map((r) => r.screenshotUrl);
```

#### Step 2c — Self-Review

```typescript
import { selfReview } from "../../lib/ui-generator/self-review.js";

// Per D-12: when multiple device types, desktop HTML is reviewed with all screenshot URLs
// so the reviewer evaluates responsive consistency across devices in one call.
const reviewScore = await selfReview({
  htmlContent: desktopResult.htmlContent,
  screenshotUrls,          // includes all device screenshots
  spec: pageSpec,
  tokens: currentTokens,
  priorPatterns: existingPatterns,
});
```

#### Step 2d — Approval Gate

```typescript
import { evaluateApprovalGate } from "../../lib/ui-generator/approval-gate.js";

const gateResult = evaluateApprovalGate(pageIndex, reviewScore);
```

### Step 3 — Gate Handling

#### If `gateResult.needsUserApproval === true` (first page or score below threshold)

Display the approval gate to the user:

```typescript
import { formatApprovalGateDisplay } from "../../lib/ui-generator/approval-gate.js";

// Derive component checklist from spec vs HTML content
const specComponents = pageSpec.components;
const foundComponents = specComponents.filter((c) =>
  desktopResult.htmlContent.toLowerCase().includes(c.toLowerCase())
);
const missingComponents = specComponents.filter(
  (c) => !foundComponents.includes(c)
);

console.log(formatApprovalGateDisplay({
  pageName: pageSpec.name,
  pageIndex,
  screenshotUrls,
  scores: reviewScore,
  specComponents,
  foundComponents,
  missingComponents,
}));
```

Wait for user response:

**Option 1 — Approve:** Proceed to Step 4.

**Option 2 — Reject + feedback (3 retries max per D-04):**

```typescript
let retryCount = 0;
const MAX_RETRIES = 3;
const feedbackHistory: string[] = [];

while (retryCount < MAX_RETRIES) {
  // Append user feedback to prompt
  const retryPrompt = prompt + `\n\nUser feedback (retry ${retryCount + 1}): ${userFeedback}`;
  feedbackHistory.push(userFeedback);

  // Re-call Stitch with revised prompt
  // Re-run self-review and gate evaluation
  // Re-display gate if still needs approval
  retryCount++;
}

if (retryCount >= MAX_RETRIES) {
  console.log(`Maximum retries reached for ${pageSpec.name}.`);
  console.log(`Full prompt and feedback history:\n${feedbackHistory.join("\n---\n")}`);
  console.log("Manual intervention required. Mark as failed or edit HTML directly.");
  // Mark page as failed in pipelinePages
  await db.update(pipelinePages)
    .set({ status: "failed", error: "Max retries reached", completedAt: new Date() })
    .where(and(eq(pipelinePages.runId, runId), eq(pipelinePages.pageIndex, pageIndex)));
  failedPages++;
  continue; // next page
}
```

**Option 3 — Skip:**

```typescript
await db.update(pipelinePages)
  .set({ status: "skipped", completedAt: new Date() })
  .where(and(eq(pipelinePages.runId, runId), eq(pipelinePages.pageIndex, pageIndex)));
skippedPages++;
continue; // next page
```

#### If `gateResult.needsUserApproval === false` (auto-approved, D-16)

```typescript
import { formatAutoApproveNotice } from "../../lib/ui-generator/approval-gate.js";

console.log(formatAutoApproveNotice(pageSpec.name, pageIndex));
// Proceed directly to Step 4
```

### Step 4 — Post-Approval (runs on Approve or Auto-Approve only)

#### Step 4a — Extract Tokens

```typescript
import { extractTokensFromHtml } from "../../lib/ui-generator/extract-tokens.js";

const extractionResult = await extractTokensFromHtml({
  htmlContent: desktopResult.htmlContent,
  projectId: projectConfig.projectId,
  priorTokens: currentTokens,
});
```

#### Step 4b — Detect Pattern Conflicts (D-08)

```typescript
import { detectPatternConflicts } from "../../lib/ui-generator/conflict-detector.js";

const conflictResult = detectPatternConflicts(existingPatterns, extractionResult.patterns);
```

#### Step 4c — Resolve Conflicts (if any, D-08)

If `conflictResult.hasConflicts === true`, show conflicts to user:

```
Pattern conflicts detected:

1. Pattern 'card' — different base component
   Existing: shadcn/Card
   New: shadcn/Sheet
   Recommendation: Pattern 'card' uses Sheet but established pattern uses Card.
   Consider: unify to existing, keep both as named variants, or override.

Options per conflict:
  a. Unify to existing — keep the established pattern, discard new
  b. Keep both as variants — store new as 'card-sheet' variant
  c. Override — replace established pattern with new version going forward

Enter choice for each conflict (e.g., "1a 2b"):
```

Apply user's choices to `extractionResult.patterns` before persisting.

#### Step 4d — User Confirmation Gate for Extracted Tokens (D-05)

**This gate is mandatory before any database write.** Show the extracted values to the user and wait for confirmation.

Display extracted tokens as a formatted table:

```
Extracted Design Tokens for: Dashboard (/dashboard)

Token             | Extracted Value      | Prior Value
------------------+----------------------+----------------------
colorPrimary      | #1a1a2e             | (same)
colorSecondary    | #ff6b6b             | (new)
colorBackground   | #0f0f1a             | (same)
colorSurface      | #1e1e2e             | (new)
colorText         | #ffffff             | (same)
typeFontFamily    | Inter               | (same)
typeSizeBase      | 16                  | (new)
spacingUnit       | 8                   | (new)
borderRadius      | 8                   | (same)
shadowStyle       | 0 4px 6px...       | (new)

Extracted Component Patterns:
  - card (variant: metric) — usageContext: dashboard metric display [shadcn: Card]
  - button-primary — usageContext: primary action trigger [shadcn: Button]

Options:
  1. Confirm — persist tokens and patterns to database as-is
  2. Edit — provide corrections before persisting (e.g., "change colorPrimary to #2a2a3e")
  3. Skip persistence — approve the page HTML but do NOT persist tokens
              (tokens from prior pages remain unchanged; useful if extraction looks wrong)

Enter choice [1/2/3]:
```

**Option 1 — Confirm:** Proceed to Step 4e with extracted values.

**Option 2 — Edit:** Accept user corrections in plain text. Parse corrections (e.g., "change colorPrimary to #2a2a3e"), apply to `extractionResult.tokens`, then proceed to Step 4e.

**Option 3 — Skip persistence:** Do NOT write to database. Set `tokensPersisted = false`. Skip Steps 4e and 4f. Proceed to Step 4g (dmPages record still written, but `tokenVersionRef` uses prior version).

#### Step 4e — Persist Tokens (only if user confirmed or edited in Step 4d)

```typescript
import { db } from "../../server/db.js";
import { dmTokens, insertDmTokenSchema } from "@shared/design-schema.js";

// Determine next version number
const nextVersion = currentTokens ? currentTokens.version + 1 : 1;

const tokenRow = insertDmTokenSchema.parse({
  projectId: projectConfig.projectId,
  version: nextVersion,
  ...extractionResult.tokens,
});
await db.insert(dmTokens).values(tokenRow);
```

#### Step 4f — Persist Patterns (only if user confirmed or edited in Step 4d)

```typescript
import { dmPatterns } from "@shared/design-schema.js";

for (const pattern of extractionResult.patterns) {
  await db.insert(dmPatterns).values({
    projectId: projectConfig.projectId,
    name: pattern.name,
    variant: pattern.variant ?? null,
    propsShape: pattern.propsShape ?? null,
    usageContext: pattern.usageContext ?? null,
    shadcnComponent: pattern.shadcnComponent ?? null,
    pageSlugRef: pageSpec.route,
  });
}
```

#### Step 4g — Persist Page Record

```typescript
import { dmPages } from "@shared/design-schema.js";

await db.insert(dmPages).values({
  projectId: projectConfig.projectId,
  pageName: pageSpec.name,
  pageSlug: pageSpec.route,
  purpose: pageSpec.purpose,
  approvedAt: new Date(),
  tokenVersionRef: tokensPersisted ? nextVersion : (currentTokens?.version ?? null),
  screenshotUrl: desktopResult.screenshotUrl,
});
```

#### Step 4h — Update Pipeline State

```typescript
import { pipelinePages } from "@shared/design-schema.js";
import { eq, and } from "drizzle-orm";

const uiGenOutput = {
  htmlUrl: desktopResult.htmlUrl,
  screenshotUrl: desktopResult.screenshotUrl,
  tokenVersion: tokensPersisted ? nextVersion : (currentTokens?.version ?? 0),
  approved: true,
};

await db.update(pipelinePages)
  .set({
    status: "complete",
    output: JSON.stringify(uiGenOutput),
    completedAt: new Date(),
  })
  .where(and(
    eq(pipelinePages.runId, runId),
    eq(pipelinePages.pageIndex, pageIndex),
  ));

completedPages++;
```

#### Step 4i — Update Loop State

Only update `currentTokens` if tokens were persisted (Step 4d confirmed or edited):

```typescript
if (tokensPersisted) {
  // Reload the new token row to get correct types
  const [newTokenRow] = await db
    .select()
    .from(dmTokens)
    .where(and(
      eq(dmTokens.projectId, projectConfig.projectId),
      eq(dmTokens.version, nextVersion),
    ))
    .limit(1);
  currentTokens = newTokenRow;

  // Append new patterns to existing list for next page's conflict detection
  existingPatterns = [...existingPatterns, ...extractionResult.patterns];
}

// Always update screenshot reference for next page
priorScreenshotUrl = desktopResult.screenshotUrl;
```

### Step 5 — Completion

After all pages are processed, log a summary and return results:

```
UI Generation Complete

  Pages approved:  4
  Pages skipped:   1
  Pages failed:    0
  Final token version: 4

Design tokens and patterns stored in Neon PostgreSQL.
```

Return:

```typescript
return {
  completedPages,
  skippedPages,
  failedPages,
  finalTokenVersion: currentTokens?.version ?? 0,
  patternsExtracted: existingPatterns.length,
};
```

## Error Handling

| Error | Cause | Action |
|-------|-------|--------|
| `StitchWrapperError { code: "ENV_MISSING" }` | `STITCH_API_KEY` not in .env | Stop pipeline. Tell user: "Set STITCH_API_KEY in .env and restart." |
| `StitchWrapperError { recoverable: false }` | Stitch API hard failure | Log error, mark page as `status: "failed"` in pipelinePages, continue to next page. |
| Claude API error (after pRetry exhaustion) | Transient AI service outage | Mark review as `review_failed`. Escalate to user: "Self-review unavailable for [page]. Approve manually or skip?" |
| Database write error | Neon connection / constraint issue | Log error with context. Do NOT block pipeline. Warn user: "Design memory may be incomplete for this page." |
| `fetch(htmlUrl)` failure | Presigned URL expired | Re-call `generateScreen` to get a fresh URL. If still fails after 1 retry, treat as recoverable: false. |

## Database Schema Reference

Tables used in this phase (from `shared/design-schema.ts`):

- `dmTokens` — immutable design token revisions (one new row per approved page)
- `dmPatterns` — component patterns extracted from each page
- `dmPages` — approved page record with screenshot reference and token version
- `pipelinePages` — pipeline execution state per page (status, output, errors)

Insert schemas (from drizzle-zod):

```typescript
import {
  dmTokens,
  dmPatterns,
  dmPages,
  pipelinePages,
  insertDmTokenSchema,
  insertDmPageSchema,
  insertDmPatternSchema,
  insertPipelinePageSchema,
} from "@shared/design-schema.js";
```

## Decision Reference

Key decisions applied by this skill:

| Decision | Summary |
|----------|---------|
| D-01 | Spec-faithful prompt depth — translate PageSpec directly into Stitch prompt |
| D-02 | Token constraints injected as inline text + prior screenshot reference |
| D-03 | Device type is user-configured; default DESKTOP only |
| D-04 | 3 retries max on rejection before escalating with full history |
| D-05 | User confirmation gate between token extraction and database persistence |
| D-06 | Pattern conflict detection flags structural or semantic mismatches |
| D-07 | Progressive token evolution — immutable revision model, null values never overwrite non-null |
| D-08 | Pattern conflict resolution: unify, keep variants, or override |
| D-09 | 4-dimension review: specCompliance, visualConsistency, structuralCompleteness, contentQuality |
| D-10 | 90% threshold across ALL dimensions for auto-approval (CONFIDENCE_THRESHOLD = 0.9) |
| D-11 | Claude Sonnet for self-review; pRetry wraps the call |
| D-12 | Multi-device: desktop + mobile screenshots reviewed together in single Claude call |
| D-13 | Page 1 always escalates regardless of score — sets design direction |
| D-14 | Gate shows screenshots, per-dimension scores, component checklist |
| D-15 | Three gate actions: Approve, Reject+feedback, Skip |
| D-16 | Auto-approved pages show one-line notice only |
