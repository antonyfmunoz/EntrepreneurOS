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
import readline from "node:readline";
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
import { startPreviewServer } from "../../ui-generator/preview-server.js";
import { printPageReview } from "../../ui-generator/terminal-links.js";

interface UiGenRunInput {
  page: PageSpecFull;
  pageIndex: number;
  tokens: DmTokenRow | null;
  designSystemPath: string;
  /** screenshotUrl from page N-1, or null for page 0 (D-12 multi-page inheritance) */
  priorScreenshotUrl: string | null;
  /** Brand voice markdown inferred from PRD, or null if unavailable */
  brandVoice: string | null;
}

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

export const uiGenPhaseImplementation: PhaseImplementation = {
  async prepare(config: ProjectConfig): Promise<PageWorkUnit[]> {
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

    return spec.pages.map((page, idx) => ({
      pageName: page.name,
      pageIndex: idx,
      input: {
        page,
        pageIndex: idx,
        tokens,
        designSystemPath,
        // Carry forward the screenshot from page N-1 so Stitch has visual
        // context for inheritance. Page 0 has no prior reference.
        priorScreenshotUrl: idx > 0 ? priorByIndex.get(idx - 1) ?? null : null,
        brandVoice,
      } satisfies UiGenRunInput,
    }));
  },

  async runPage(rawInput: unknown, config: ProjectConfig): Promise<unknown> {
    const input = rawInput as UiGenRunInput;
    const { page, tokens, designSystemPath, priorScreenshotUrl, brandVoice } = input;

    // Discover component references from the warm cache.
    const discoveryResult = discoverComponents(page.components);
    const componentReferences = formatDiscoveryForPrompt(discoveryResult);

    // Build prompt — design-system.md is the single source of truth, no
    // hardcoded brand values. priorScreenshotUrl gives Stitch visual context
    // from the previously approved page (multi-page inheritance).
    const prompt = buildStitchPrompt(
      page,
      tokens,
      priorScreenshotUrl ?? undefined,
      tokens?.componentDirection ?? undefined,
      componentReferences || undefined,
      undefined, // enrichment — wired separately via skill-enrichment layer
      designSystemPath,
      brandVoice ?? undefined,
    );

    // Generate the desktop screen via Stitch.
    const stitchResult = await generateScreen(config.stitchProjectId!, {
      prompt,
      deviceType: "DESKTOP",
    });

    // Fetch the HTML so dualReview can score against it.
    const htmlResp = await fetch(stitchResult.htmlUrl);
    if (!htmlResp.ok) {
      throw new Error(
        `Phase "ui-gen": failed to fetch generated HTML (${htmlResp.status}) ` +
          `for ${page.name}. Stitch presigned URL may have expired.`,
      );
    }
    const htmlContent = await htmlResp.text();

    // Dual review (Claude + Gemini if available).
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
    });
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
    };

    // Start preview server (fetches HTML, serves locally)
    const preview = output.htmlUrl
      ? await startPreviewServer(output.htmlUrl)
      : null;

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
    });

    const answer = await promptStdin("Decision (y/n/s): ");
    const normalized = answer.trim().toLowerCase();

    // Shut down preview server after user makes their decision
    if (preview) {
      await preview.shutdown();
    }

    if (normalized === "n") {
      const feedback = await promptStdin("Feedback for retry: ");
      if (feedback.trim()) {
        console.log(`[ui-gen] Retrying ${context.pageName} with feedback: ${feedback.trim()}`);
      }
      return "retry";
    }

    if (normalized === "s") {
      console.log(`[ui-gen] Skipping ${context.pageName}`);
      return "skip";
    }

    // Default to continue (approve) for 'y' or any other input
    return "continue";
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
