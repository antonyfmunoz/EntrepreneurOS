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
| `lib/ui-generator/design-system-seeder.ts` | `seedDesignSystem`, `seedToTokens` | Generate initial design system from project spec |
| `lib/ui-generator/gemini-mockup.ts` | `generateReferenceMockup` | Generate reference mockup via Gemini |
| `lib/ui-generator/html-sanitizer.ts` | `sanitizeHtmlForModel` | Sanitize HTML before LLM input (security) |
| `lib/ui-generator/component-discovery.ts` | `discoverComponents`, `formatDiscoveryForPrompt` | Multi-registry component lookup for prompt enrichment |
| `lib/ui-generator/gemini-reviewer.ts` | `geminiReview` | Gemini vision-based secondary reviewer |
| `lib/ui-generator/skill-enrichment.ts` | `queryFrontendDesignSkill`, `queryUXProSkill`, `enrichOnce`, `extractIndustry` | Session-level design skill enrichment via Anthropic API (Plan 03-07) |
| `lib/stitch/design-md.ts` | `exportDesignMD`, `generateDesignMDFromTokens`, `parseDesignMD`, `importDesignMD` | DESIGN.md export/import for cross-page design stability (Plan 03-08) |
| `lib/stitch/screen-management.ts` | `deleteScreen`, `extractScreenIdFromUrl`, `listScreens` | Stitch screen cleanup after rejection (Plan 03-09) |

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

### Step 0.5 — Design System Seeding (Enhancement)

Before any page generation, seed the design system from the project description.
Only runs if no existing tokens (first pipeline execution).

```typescript
import { seedDesignSystem, seedToTokens } from "../../lib/ui-generator/design-system-seeder.js";

if (currentTokens === null) {
  const seed = await seedDesignSystem({
    projectDescription: specOutput.projectDescription ?? "SaaS application",
    brandDescription: specOutput.brandDescription,
    targetAudience: specOutput.targetAudience,
  });

  console.log(`Design system seeded:`);
  console.log(`  Colors: ${seed.colorPalette.primary} (primary), ${seed.colorPalette.secondary} (secondary)`);
  console.log(`  Fonts: ${seed.fontPairing.heading} / ${seed.fontPairing.body}`);
  console.log(`  Direction: ${seed.componentDirection}`);

  const seedTokens = seedToTokens(seed);
  var componentDirection = seed.componentDirection;

  currentTokens = {
    ...seedTokens,
    projectId: projectConfig.projectId,
    version: 0,
    id: 0,
    createdAt: new Date(),
    typeScaleRatio: null,
    shadowStyle: null,
    // PERSIST seed.componentDirection so it survives page-to-page generation
    // (dm_tokens.component_direction column added by 20260407 migration)
    componentDirection: seed.componentDirection,
  } as DmTokenRow;
}
```

If seedDesignSystem fails internally, it returns DEFAULT_DESIGN_SEED (fail-closed).
The seed provides Page 1 with an informed starting point instead of zero design context.

### Step 1.5 — Skill Enrichment (Plan 03-07, runs ONCE per pipeline)

Query session-level design skills exactly once before the page loop. The result is reused for every page in the run.

```typescript
import {
  enrichOnce,
  extractIndustry,
} from "../../lib/ui-generator/skill-enrichment.js";
import type { SkillEnrichment } from "../../lib/ui-generator/types.js";

let enrichment: SkillEnrichment | null = null;

try {
  console.log("Querying design skills for production-grade guidance...");
  enrichment = await enrichOnce({
    productType: specOutput.projectDescription ?? "saas-application",
    components: [...new Set(pageOrder.flatMap((p) => p.components))],
    complexity: pageOrder.length > 10 ? "high" : "medium",
    targetAudience: specOutput.targetAudience ?? "business-users",
    vibe: currentTokens?.componentDirection ?? "modern-professional",
    industry: extractIndustry(specOutput.projectDescription),
  });

  if (enrichment.designGuidance) console.log("✓ Frontend design guidance received");
  if (enrichment.uxGuidance.palette) console.log(`  Palette: ${enrichment.uxGuidance.palette}`);
  if (enrichment.uxGuidance.fonts) console.log(`  Fonts: ${enrichment.uxGuidance.fonts}`);
} catch {
  console.warn("Design skill enrichment unavailable; continuing with defaults");
  enrichment = null;
}
```

NOTE: `queryFrontendDesignSkill` and `queryUXProSkill` invoke Claude via the Anthropic API with a skill-aware prompt. They are NOT calls into the Claude Code Skill tool runtime — that tool is only available inside the orchestrator process. Both are fail-open: any error returns `null`/`{}` and the pipeline continues.


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

##### Component Discovery (Plan 03-07 update — query ALL components)

Before building the prompt, query component registries for **every** component in the page spec — not just "complex" ones. Button, Input, and Card deserve production-grade shadcn/MagicUI references too.

```typescript
import { discoverComponents, formatDiscoveryForPrompt } from "../../lib/ui-generator/component-discovery.js";

const discoveryResult = await discoverComponents(pageSpec.components);
const componentReferences = formatDiscoveryForPrompt(discoveryResult);

if (discoveryResult.queriedComponents.length > 0) {
  console.log(`  Component discovery: queried ${discoveryResult.queriedComponents.join(", ")}`);
  console.log(`  Found ${discoveryResult.references.length} references from registries`);
}
```

Then pass the references AND the session enrichment to the prompt builder:

```typescript
import { buildStitchPrompt } from "../../lib/ui-generator/build-stitch-prompt.js";

const prompt = buildStitchPrompt(
  pageSpec,
  currentTokens,
  priorScreenshotUrl,
  currentTokens?.componentDirection ?? undefined,  // load from DB, not local var
  componentReferences,
  enrichment ?? undefined,                          // from Step 1.5
);
```

Component discovery is best-effort. If MCP tools (`shadcn`, `magic21`, `magicui` from `.mcp.json`) are not available, the pipeline continues with standard prompts. The total prompt is capped at MAX_PROMPT_TOTAL_CHARS (30,000 chars) to prevent unbounded growth.

#### Step 2a-5 — Import DESIGN.md (Page 2+ only, Plan 03-08)

For every page after the first, load the most recent DESIGN.md export and let it influence the next prompt. (Stitch MCP does not currently expose `import_design_system`, so we inject it into the prompt instead.)

```typescript
import { db } from "../../server/db.js";
import { dmDesignMd } from "@shared/design-schema.js";
import { eq, desc } from "drizzle-orm";

if (pageIndex > 0) {
  const [latest] = await db
    .select()
    .from(dmDesignMd)
    .where(eq(dmDesignMd.projectId, projectConfig.projectId))
    .orderBy(desc(dmDesignMd.version))
    .limit(1);

  if (latest) {
    console.log(`  ✓ Referencing DESIGN.md v${latest.version}`);
    // The DESIGN.md is implicitly carried forward via currentTokens — no
    // prompt mutation needed because tokens already reflect the same state.
  }
}
```

`buildStitchPrompt` translates PageSpec fields into a Stitch-ready prompt string, injecting token constraints when available and referencing prior screenshots for visual continuity.

#### Step 2a.5 — Generate Reference Mockup (Enhancement)

```typescript
import { generateReferenceMockup } from "../../lib/ui-generator/gemini-mockup.js";

const mockupResult = await generateReferenceMockup({
  spec: pageSpec,
  tokens: currentTokens,
  deviceType: deviceTypes[0],
});

if (mockupResult) {
  console.log(`  Reference mockup generated for ${pageSpec.name}`);
}
```

The mockup is best-effort. If GEMINI_API_KEY is not set or Gemini fails, returns null and pipeline continues.
When available, the mockup is shown alongside Stitch output at the approval gate for comparison.

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

#### Step 2c — Self-Review (Enhanced with Dual Reviewer)

Run Claude text-based and Gemini vision-based reviews in parallel:

```typescript
import { dualReview } from "../../lib/ui-generator/self-review.js";

const dualScore = await dualReview({
  htmlContent: sanitizedHtml,   // from sanitizeHtmlForModel
  screenshotUrls,
  spec: pageSpec,
  tokens: currentTokens,
  priorPatterns: existingPatterns,
});

console.log(`  Review: ${dualScore.reviewerCount} reviewer(s)`);
console.log(`  Claude: spec=${dualScore.claude.specCompliance.score.toFixed(2)}, visual=${dualScore.claude.visualConsistency.score.toFixed(2)}`);
if (dualScore.gemini) {
  console.log(`  Gemini: spec=${dualScore.gemini.specCompliance.score.toFixed(2)}, visual=${dualScore.gemini.visualConsistency.score.toFixed(2)}`);
}
console.log(`  Combined: spec=${dualScore.combined.specCompliance.score.toFixed(2)}, visual=${dualScore.combined.visualConsistency.score.toFixed(2)}`);

// Use combined score (worst-of-both) for gate evaluation
const reviewScore = dualScore.combined;
```

Combined scoring uses worst-of-both per dimension. If either reviewer flags a dimension below 0.9, it triggers user escalation. When Gemini is unavailable (no API key or error), falls back to Claude-only review without blocking.

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

##### Screen Cleanup Before Retry (Plan 03-09)

Delete the rejected screen from Stitch before retrying so it doesn't pollute the project. Best-effort: never blocks the retry path.

```typescript
import {
  deleteScreen,
  extractScreenIdFromUrl,
} from "../../lib/stitch/screen-management.js";

try {
  const screenId = extractScreenIdFromUrl(desktopResult.screenshotUrl);
  if (screenId) {
    const result = await deleteScreen(projectConfig.stitchProjectId!, screenId);
    if (result.deleted) {
      console.log("  ✓ Rejected screen deleted from Stitch");
    } else {
      console.warn(`  ⚠ Screen deletion not available: ${result.error}`);
    }
  }
} catch (err) {
  console.warn(`  ⚠ Screen cleanup error (non-blocking): ${(err as Error).message}`);
}
```

**Note:** As of `@google/stitch-sdk` v0.0.3, the `delete_screen` MCP tool does not exist. `deleteScreen()` is a fail-open stub that returns `{ deleted: false, error: ... }`. The pipeline continues normally — rejected screens remain in the Stitch project but don't influence future generations when the DESIGN.md workflow is active. See `.planning/stitch-mcp-research.md` for the full tool inventory and drift-watch workflow (`npm run check:stitch-tools`).

##### Targeted Component Refinement (Orchestration Pattern)

Before re-calling Stitch for the full page, check if the issue is component-level:

1. Gather all findings from `dualScore.combined` across dimensions
2. Check if findings mention specific component names from `pageSpec.components`
3. If exactly 1-2 components are mentioned and the issue is NOT structural:
   - This is a component-level issue
   - If `mcp__magic21__21st_magic_component_refiner` MCP tool is available:
     ```typescript
     const refined = await mcpInvoke("mcp__magic21__21st_magic_component_refiner", {
       code: existingComponentHtml,
       instructions: `Refine: ${userFeedback ?? findings.join("; ")}`,
     });
     ```
   - If refinement succeeds, re-run dualReview on the patched HTML
   - If re-review passes, skip the full Stitch re-call (saves API credits)
4. If the issue is page-level (layout, structure, 3+ components, or structural dimension failed):
   - Fall through to the existing full Stitch re-call retry logic

This is an orchestration pattern, not a library function -- the classification logic is simple enough to inline in the skill flow. The 21st.dev MCP tool is best-effort (may not be available).

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

#### Step 4a-1 — Export DESIGN.md (Page 1 only, Plan 03-08)

After Page 1's tokens are extracted, snapshot the design system to `dm_design_md` so subsequent pages can reference it.

```typescript
import { exportDesignMD } from "../../lib/stitch/design-md.js";
import { dmDesignMd } from "@shared/design-schema.js";

if (pageIndex === 0) {
  const designMD = await exportDesignMD(
    projectConfig.stitchProjectId ?? projectConfig.projectId,
    currentTokens,
  );

  await db.insert(dmDesignMd).values({
    projectId: projectConfig.projectId,
    version: 1,
    content: designMD.content,
    exportedAt: new Date(),
  });

  console.log("  ✓ DESIGN.md v1 exported and stored");
}
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
  // PRESERVE component direction across token revisions (Plan 03-07/08)
  componentDirection: currentTokens?.componentDirection ?? null,
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

## Security: HTML Sanitization

**All Stitch HTML MUST pass through sanitizeHtmlForModel before being sent to any LLM.**
This prevents prompt injection from content embedded in Stitch-generated HTML.

```typescript
import { sanitizeHtmlForModel } from "../../lib/ui-generator/html-sanitizer.js";
import { MAX_HTML_FOR_REVIEW, MAX_HTML_FOR_EXTRACTION } from "../../lib/ui-generator/types.js";

// After fetching HTML from Stitch presigned URL:
const rawHtml = await fetch(result.htmlUrl).then(r => r.text());
const htmlForReview = sanitizeHtmlForModel(rawHtml, MAX_HTML_FOR_REVIEW);
const htmlForExtraction = sanitizeHtmlForModel(rawHtml, MAX_HTML_FOR_EXTRACTION);

// Use htmlForReview in selfReview/dualReview calls
// Use htmlForExtraction in extractTokensFromHtml calls
// Store rawHtml for file output (unsanitized) — sanitization is only for LLM input
```

Sanitization removes: script tags, event handlers, prompt-injection markers in comments, oversized data attributes.


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
| Enhancement | Dual reviewer (Claude + Gemini) -- combined worst-of-both per dimension |
| Enhancement | Targeted component refinement via 21st.dev MCP as orchestration pattern |

## Limitations of the Stitch MCP server

These are server-side gaps in stitch.googleapis.com — not bugs in this skill.
Surface them to the user; do not pretend they don't exist.

### 1. No `delete_screen` tool

The Stitch MCP server exposes generation, project listing, and screen
inspection — but **no delete operation**. Once a screen is generated, it
lives in the Stitch project forever.

Implications:
- Rejected screens accumulate in the Stitch UI as orphaned junk.
- The only cleanup path is the Stitch web app (stitch.withgoogle.com), one
  screen at a time, by hand.
- The skill must NEVER claim a screen was "deleted" or "discarded". On
  rejection, log it locally and warn the user that the orphaned screen
  remains in their Stitch project.

### 2. No `import_design_system` / DESIGN.md import

The MCP server has no tool for pushing a project's design tokens, DESIGN.md,
or any other design system contract into Stitch as a first-class constraint.

Implications:
- Multi-page coherence relies entirely on **token carry-forward** in each
  generation prompt: the orchestrator extracts tokens from approved page 1
  and re-injects them in the prompt for page 2, page 3, etc.
- `priorScreenshotUrl` references give Stitch a visual anchor, but there is
  no server-side memory of the design system between calls.
- Every generation effectively starts fresh — drift is corrected at the
  prompt layer, not the server layer.
- Do not claim the design system is "loaded" or "remembered" by Stitch. It
  is not.

The same warnings live as a comment block at the top of `lib/stitch/client.ts`.
