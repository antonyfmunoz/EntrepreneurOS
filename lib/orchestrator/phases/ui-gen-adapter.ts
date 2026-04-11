// lib/orchestrator/phases/ui-gen-adapter.ts
// Phase 2: ui-gen
//
// prepare(): pull the most recent completed spec output from pipeline_pages,
//   parse the SpecOutput, fetch the latest dm_tokens row for this project, and
//   produce one work unit per page in the spec. Read-only — no Stitch calls.
//
// runPage(): build the Stitch prompt with token carry-forward, call generateScreen,
//   then dualReview the result. Returns a UiGenPhaseOutput-shaped record.

import path from "node:path";
import fs from "node:fs";
import readline from "node:readline";
import pLimit from "p-limit";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  dmTokens,
  pipelinePages,
  type ProjectConfig,
  UiGenPhaseOutputSchema,
} from "../../../shared/design-schema.js";
import type { SpecOutput, PageSpecFull } from "@shared/spec-schema.js";
import type { PhaseImplementation, PageWorkUnit, PageCompleteContext, PageDecision } from "../phase-runner.js";
import { getOrchestratorDb } from "../db.js";
import { buildStitchPrompt } from "../../ui-generator/build-stitch-prompt.js";
import {
  discoverComponents,
  formatDiscoveryForPrompt,
  validateCacheFreshness,
} from "../../ui-generator/component-discovery.js";
import { dualReview } from "../../ui-generator/self-review.js";
import {
  allDimensionsPass,
  formatScoreSummary,
  type DmTokenRow,
} from "../../ui-generator/types.js";
import { generateScreen, attemptFigmaExport } from "../../stitch/client.js";
import { loadBrandVoice } from "../../spec-parser/brand-voice-inferrer.js";
import { startPreviewServer, startPreviewServerFromFile } from "../../ui-generator/preview-server.js";
import type { ProjectCopy, PageCopy } from "../../copy-planner/types.js";
import { printPageReview } from "../../ui-generator/terminal-links.js";

// Accumulated user feedback from page reviews. Injected into every Stitch
// prompt as mandatory overrides so corrections carry forward to all pages.
const GLOBAL_USER_FEEDBACK = `
- Never use labels like "STRATEGIC ACCESS TERMINAL", "SECURE KEY", "WORK EMAIL", or "OR DEPLOY VIA" — these are not brand voice.
- Form labels must be simple and direct: "Email", "Password", "Confirm password".
- OAuth separator text: "OR CONTINUE WITH" (never "OR DEPLOY VIA").
- Left panel / marketing copy must be operational and founder-focused. No agency/visionary language.
- Cards: glassmorphism only, no visible borders, ambient purple shadow (0 8px 32px rgba(106,55,212,0.08)).
- No 1px solid borders on cards — use background shifts and subtle shadows instead.
- No gradients anywhere. Primary buttons solid #6a37d4 only.
- Copyright year must be dynamic (current year), never hardcoded.
- Remove decorative icons not from lucide-react.
- No Help Center or support links on auth pages.
- Auth pages: floating cards on a solid surface background (#f5f6f7). No gradient backgrounds.
`.trim();

interface UiGenRunInput {
  page: PageSpecFull;
  pageIndex: number;
  tokens: DmTokenRow | null;
  designSystemPath: string;
  /** screenshotUrl from page N-1, or null for page 0 (D-12 multi-page inheritance) */
  priorScreenshotUrl: string | null;
  /** Brand voice markdown inferred from PRD, or null if unavailable */
  brandVoice: string | null;
  /** Approved copy from copy planning phase, or null if copy phase was skipped */
  pageCopy: PageCopy | null;
  /** Accumulated feedback from prior page reviews (carry-forward). */
  accumulatedFeedback?: string;
  /** Cached output from parallel batch generation during prepare(). When set,
   *  runPage returns this directly instead of calling Stitch again. */
  precomputedOutput?: unknown;
  /** Cached error from parallel batch generation. When set, runPage throws. */
  precomputedError?: string;
}

/** Max concurrent Stitch generations per prepare() batch. Stitch free tier
 *  has tight rate limits; 3 concurrent calls is a safe ceiling. */
const STITCH_PARALLEL_LIMIT = 3;

async function loadLatestSpec(projectId: string): Promise<SpecOutput> {
  const db = getOrchestratorDb();
  const rows = await db
    .select()
    .from(pipelinePages)
    .where(
      and(
        eq(pipelinePages.projectId, projectId),
        eq(pipelinePages.phase, "spec"),
        eq(pipelinePages.status, "complete"),
      ),
    )
    .orderBy(desc(pipelinePages.completedAt))
    .limit(1);

  if (rows.length === 0 || !rows[0].output) {
    throw new Error(
      `Phase "ui-gen": no completed spec phase output found for projectId=${projectId}. ` +
        `Run the spec phase first.`,
    );
  }
  return JSON.parse(rows[0].output) as SpecOutput;
}

async function loadLatestTokens(projectId: string): Promise<DmTokenRow | null> {
  const db = getOrchestratorDb();
  const rows = await db
    .select()
    .from(dmTokens)
    .where(eq(dmTokens.projectId, projectId))
    .orderBy(desc(dmTokens.version))
    .limit(1);
  return (rows[0] as DmTokenRow | undefined) ?? null;
}

/**
 * Returns a map of pageIndex → screenshotUrl for every previously completed
 * ui-gen page in this project. The runner uses the entry at index N-1 to seed
 * the prior-screenshot reference for page N (multi-page visual inheritance).
 */
async function loadPriorScreenshotsByIndex(
  projectId: string,
): Promise<Map<number, string>> {
  const db = getOrchestratorDb();
  const rows = await db
    .select()
    .from(pipelinePages)
    .where(
      and(
        eq(pipelinePages.projectId, projectId),
        eq(pipelinePages.phase, "ui-gen"),
        eq(pipelinePages.status, "complete"),
      ),
    )
    .orderBy(asc(pipelinePages.pageIndex));

  const map = new Map<number, string>();
  for (const row of rows) {
    if (!row.output) continue;
    try {
      const out = JSON.parse(row.output) as { screenshotUrl?: string };
      if (out.screenshotUrl) map.set(row.pageIndex, out.screenshotUrl);
    } catch {
      // skip malformed rows; they'll be regenerated
    }
  }
  return map;
}

// ─── Single-page generation helper ───────────────────────────────────────────
// Extracted from runPage so it can be called in parallel from prepare() when
// batching multiple pages at once. Pure function over its inputs — no DB writes.
async function generatePage(
  input: UiGenRunInput,
  config: ProjectConfig,
): Promise<unknown> {
  const { page, tokens, designSystemPath, priorScreenshotUrl, brandVoice, pageCopy } = input;

  const discoveryResult = discoverComponents(page.components);
  const componentReferences = formatDiscoveryForPrompt(discoveryResult);

  let combinedFeedback = GLOBAL_USER_FEEDBACK;
  if (input.accumulatedFeedback) {
    combinedFeedback += "\n" + input.accumulatedFeedback;
  }

  const prompt = buildStitchPrompt(
    page,
    tokens,
    priorScreenshotUrl ?? undefined,
    tokens?.componentDirection ?? undefined,
    componentReferences || undefined,
    undefined,
    designSystemPath,
    brandVoice ?? undefined,
    pageCopy ?? undefined,
    undefined,
    combinedFeedback,
  );

  const stitchResult = await generateScreen(config.stitchProjectId!, {
    prompt,
    deviceType: "DESKTOP",
  });

  const htmlResp = await fetch(stitchResult.htmlUrl);
  if (!htmlResp.ok) {
    throw new Error(
      `Phase "ui-gen": failed to fetch generated HTML (${htmlResp.status}) ` +
        `for ${page.name}. Stitch presigned URL may have expired.`,
    );
  }
  const htmlContent = await htmlResp.text();

  const previewDir = path.resolve(config.repoPath, ".planning/output/previews");
  if (!fs.existsSync(previewDir)) {
    fs.mkdirSync(previewDir, { recursive: true });
  }
  const localHtmlPath = path.resolve(previewDir, `${page.name}.html`);
  fs.writeFileSync(localHtmlPath, htmlContent, "utf-8");
  console.log(`[ui-gen] Cached HTML → ${localHtmlPath}`);

  const review = await dualReview({
    htmlContent,
    screenshotUrls: [stitchResult.screenshotUrl],
    spec: page,
    tokens,
    priorPatterns: [],
  });

  const approved = allDimensionsPass(review.combined);
  const scoreSummary = formatScoreSummary(review.combined);
  console.log(`[ui-gen] ${page.name}: ${scoreSummary} | approved=${approved}`);

  return UiGenPhaseOutputSchema.parse({
    htmlUrl: stitchResult.htmlUrl,
    screenshotUrl: stitchResult.screenshotUrl,
    tokenVersion: tokens?.version ?? 0,
    approved,
    scoreSummary,
    localHtmlPath,
  });
}

export const uiGenPhaseImplementation: PhaseImplementation = {
  async prepare(config: ProjectConfig, runId?: number): Promise<PageWorkUnit[]> {
    // Allow env fallback so users can keep project IDs out of checked-in config.
    if (!config.stitchProjectId && process.env.STITCH_PROJECT_ID) {
      config.stitchProjectId = process.env.STITCH_PROJECT_ID;
    }
    if (!config.stitchProjectId) {
      throw new Error(
        `Phase "ui-gen": stitchProjectId is required. Set it in .planning/project.config.json or as STITCH_PROJECT_ID in .env.`,
      );
    }

    const spec = await loadLatestSpec(config.projectId);
    const tokens = await loadLatestTokens(config.projectId);
    const priorByIndex = await loadPriorScreenshotsByIndex(config.projectId);
    const designSystemPath = path.resolve(
      config.repoPath,
      config.designSystemPath,
    );
    const planningDir = path.resolve(config.repoPath, ".planning");
    const brandVoice = loadBrandVoice(planningDir);

    // Load approved copy from the copy phase (if it ran)
    let projectCopy: ProjectCopy | null = null;
    const copyRows = await getOrchestratorDb()
      .select()
      .from(pipelinePages)
      .where(
        and(
          eq(pipelinePages.projectId, config.projectId),
          eq(pipelinePages.phase, "copy"),
          eq(pipelinePages.status, "complete"),
        ),
      )
      .limit(1);
    if (copyRows.length > 0 && copyRows[0].output) {
      try {
        projectCopy = JSON.parse(copyRows[0].output) as ProjectCopy;
      } catch {
        // Copy phase output malformed — continue without copy
      }
    }

    // Validate component cache freshness before any generation.
    // The cache is populated by /saas-dev:warm-cache inside a Claude Code session.
    const allComponentNames = Array.from(
      new Set(spec.pages.flatMap((p) => p.components)),
    );
    const freshness = validateCacheFreshness(allComponentNames);
    if (!freshness.fresh) {
      throw new Error(
        `Phase "ui-gen": component cache is stale. ${freshness.reason}`,
      );
    }

    // Build base work unit inputs for every spec page.
    const baseInputs: Map<number, UiGenRunInput> = new Map();
    for (let idx = 0; idx < spec.pages.length; idx++) {
      const page = spec.pages[idx];
      baseInputs.set(idx, {
        page,
        pageIndex: idx,
        tokens,
        designSystemPath,
        priorScreenshotUrl: idx > 0 ? priorByIndex.get(idx - 1) ?? null : null,
        brandVoice,
        pageCopy: projectCopy?.pages.find((p) => p.pageName === page.name) ?? null,
      });
    }

    // Identify which pages are already complete for this run so we don't
    // re-generate them. If runId is not passed (legacy caller), generate
    // everything — caller is responsible for picking the right subset.
    const completePageIndexes = new Set<number>();
    if (runId !== undefined) {
      const existingRows = await getOrchestratorDb()
        .select()
        .from(pipelinePages)
        .where(
          and(
            eq(pipelinePages.runId, runId),
            eq(pipelinePages.phase, "ui-gen"),
            eq(pipelinePages.status, "complete"),
          ),
        );
      for (const r of existingRows) completePageIndexes.add(r.pageIndex);
    }

    const pendingIndexes = spec.pages
      .map((_, idx) => idx)
      .filter((idx) => !completePageIndexes.has(idx));

    // ── Parallel Stitch generation ───────────────────────────────────────────
    // Run up to STITCH_PARALLEL_LIMIT generations concurrently. Per-page
    // failures are captured and attached to the work unit — they do NOT block
    // the rest of the batch. The phase-runner sees failures via runPage()
    // which throws the cached error string.
    if (pendingIndexes.length > 0) {
      console.log(
        `[ui-gen] Parallel generation: ${pendingIndexes.length} page(s), ` +
          `concurrency=${STITCH_PARALLEL_LIMIT}`,
      );
      const limit = pLimit(STITCH_PARALLEL_LIMIT);
      const results = await Promise.allSettled(
        pendingIndexes.map((idx) =>
          limit(async () => {
            const input = baseInputs.get(idx)!;
            const output = await generatePage(input, config);
            return { idx, output };
          }),
        ),
      );

      for (let i = 0; i < results.length; i++) {
        const idx = pendingIndexes[i];
        const result = results[i];
        const input = baseInputs.get(idx)!;
        if (result.status === "fulfilled") {
          input.precomputedOutput = result.value.output;
        } else {
          const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
          input.precomputedError = msg;
          console.error(`[ui-gen] ${spec.pages[idx].name} FAILED: ${msg}`);
        }
      }

      const ok = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - ok;
      console.log(`[ui-gen] Parallel batch complete: ${ok} ok, ${failed} failed`);
    }

    return spec.pages.map((page, idx) => ({
      pageName: page.name,
      pageIndex: idx,
      input: baseInputs.get(idx)!,
    }));
  },

  async runPage(rawInput: unknown, config: ProjectConfig): Promise<unknown> {
    const input = rawInput as UiGenRunInput;

    // If prepare() already generated this page in parallel, return the cache.
    if (input.precomputedError) {
      throw new Error(input.precomputedError);
    }
    if (input.precomputedOutput !== undefined) {
      return input.precomputedOutput;
    }

    // Fallback: single-page generation path (used by scripts/ui-gen-next.ts
    // and scripts/ui-gen-runner.ts which bypass prepare()'s batch mode).
    return generatePage(input, config);
  },

  async onPageComplete(
    context: PageCompleteContext,
    config: ProjectConfig,
  ): Promise<PageDecision> {
    const output = context.output as {
      screenshotUrl?: string;
      htmlUrl?: string;
      scoreSummary?: string;
      approved?: boolean;
      localHtmlPath?: string;
    };

    // Start preview server from cached local file (immune to URL expiry).
    // Falls back to fetching presigned URL if local file doesn't exist.
    let preview = output.localHtmlPath
      ? await startPreviewServerFromFile(output.localHtmlPath)
      : null;
    if (!preview && output.htmlUrl) {
      preview = await startPreviewServer(output.htmlUrl);
    }

    // Attempt Figma export silently — null if unavailable
    const figmaUrl = config.stitchProjectId
      ? await attemptFigmaExport(config.stitchProjectId)
      : null;

    // Print review block with OSC 8 clickable links
    printPageReview({
      pageName: context.pageName,
      pageIndex: context.pageIndex,
      scoreSummary: output.scoreSummary,
      approved: output.approved,
      localUrl: preview?.localUrl,
      screenshotUrl: output.screenshotUrl,
      htmlUrl: output.htmlUrl,
      figmaUrl,
      localHtmlPath: output.localHtmlPath,
    });

    const answer = await promptStdin("Decision (y/f/n/s): ");
    const normalized = answer.trim().toLowerCase();

    // Shut down preview server after user makes their decision
    if (preview) {
      await preview.shutdown();
    }

    if (normalized === "f") {
      const feedback = await promptStdin("What should carry forward to all remaining pages? ");
      console.log(`[ui-gen] Approved ${context.pageName} with carry-forward feedback`);
      return { action: "continue-with-feedback", feedback: feedback.trim() };
    }

    if (normalized === "n") {
      const feedback = await promptStdin("Feedback for retry: ");
      if (feedback.trim()) {
        console.log(`[ui-gen] Retrying ${context.pageName} with feedback: ${feedback.trim()}`);
      }
      return { action: "retry", feedback: feedback.trim() };
    }

    if (normalized === "s") {
      console.log(`[ui-gen] Skipping ${context.pageName}`);
      return { action: "skip" };
    }

    // Default to continue (approve) for 'y' or any other input
    return { action: "continue" };
  },
};

function promptStdin(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
