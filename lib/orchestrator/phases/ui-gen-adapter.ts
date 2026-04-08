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
import { and, desc, eq } from "drizzle-orm";
import {
  dmTokens,
  pipelinePages,
  type ProjectConfig,
  UiGenPhaseOutputSchema,
} from "../../../shared/design-schema.js";
import type { SpecOutput, PageSpecFull } from "@shared/spec-schema.js";
import type { PhaseImplementation, PageWorkUnit } from "../phase-runner.js";
import { getOrchestratorDb } from "../db.js";
import { buildStitchPrompt } from "../../ui-generator/build-stitch-prompt.js";
import { dualReview } from "../../ui-generator/self-review.js";
import { allDimensionsPass, type DmTokenRow } from "../../ui-generator/types.js";
import { generateScreen } from "../../stitch/client.js";

interface UiGenRunInput {
  page: PageSpecFull;
  pageIndex: number;
  tokens: DmTokenRow | null;
  designSystemPath: string;
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

export const uiGenPhaseImplementation: PhaseImplementation = {
  async prepare(config: ProjectConfig): Promise<PageWorkUnit[]> {
    if (!config.stitchProjectId) {
      throw new Error(
        `Phase "ui-gen": config.stitchProjectId is required. Set it in .planning/project.config.json.`,
      );
    }

    const spec = await loadLatestSpec(config.projectId);
    const tokens = await loadLatestTokens(config.projectId);
    const designSystemPath = path.resolve(
      config.repoPath,
      config.designSystemPath,
    );

    return spec.pages.map((page, idx) => ({
      pageName: page.name,
      pageIndex: idx,
      input: {
        page,
        pageIndex: idx,
        tokens,
        designSystemPath,
      } satisfies UiGenRunInput,
    }));
  },

  async runPage(rawInput: unknown, config: ProjectConfig): Promise<unknown> {
    const input = rawInput as UiGenRunInput;
    const { page, tokens, designSystemPath } = input;

    // Build prompt — design-system.md is the single source of truth, no
    // hardcoded brand values.
    const prompt = buildStitchPrompt(
      page,
      tokens,
      undefined, // priorScreenshotUrl — wired in a later iteration
      tokens?.componentDirection ?? undefined,
      undefined, // componentReferences
      undefined, // enrichment
      designSystemPath,
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

    return UiGenPhaseOutputSchema.parse({
      htmlUrl: stitchResult.htmlUrl,
      screenshotUrl: stitchResult.screenshotUrl,
      tokenVersion: tokens?.version ?? 0,
      approved,
    });
  },
};
