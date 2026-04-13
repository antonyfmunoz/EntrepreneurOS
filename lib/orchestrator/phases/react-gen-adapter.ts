// lib/orchestrator/phases/react-gen-adapter.ts
// Phase: react-gen
//
// Replaces the former Stitch-based ui-gen phase with direct Claude React
// component generation. Pages are written to disk as .tsx files — Vite
// hot-reloads them into the browser as each completes.
//
// prepare(): load spec + copy + brief, start live preview, inject build
//   overlay, build shared components, return one work unit per page.
//
// runPage(): call writeReactComponent(), update overlay, print progress.

import path from "node:path";
import pLimit from "p-limit";
import { and, desc, eq } from "drizzle-orm";
import {
  pipelinePages,
  pipelineRuns,
  type ProjectConfig,
  ReactGenPhaseOutputSchema,
} from "../../../shared/design-schema.js";
import type { SpecOutput } from "@shared/spec-schema.js";
import type { PhaseImplementation, PageWorkUnit } from "../phase-runner.js";
import { getOrchestratorDb } from "../db.js";
import { writeReactComponent, type ComponentWriterInput, type ComponentWriterOutput } from "../../react-gen/component-writer.js";
import { buildSharedComponents } from "../../react-gen/shared-component-builder.js";
import { screenshotAndReview } from "../../react-gen/screenshot-reviewer.js";
import { ensureLivePreviewServer, type LivePreviewServer } from "../../react-gen/live-preview-server.js";
import { injectBuildOverlay, updateBuildStatus, removeBuildOverlay, type BuildStatus } from "../../react-gen/build-status-overlay.js";
import { loadBrandVoice } from "../../spec-parser/brand-voice-inferrer.js";
import { loadBriefFromConfig } from "../../intake/intake-orchestrator.js";
import type { ProjectBrief } from "../../intake/types.js";
import type { ProjectCopy, PageCopy } from "../../copy-planner/types.js";
import fs from "node:fs";

/** Max concurrent page generations. Claude API handles 5 well. */
const REACT_GEN_PARALLEL_LIMIT = 5;

interface ReactGenRunInput {
  page: SpecOutput["pages"][number];
  pageIndex: number;
  pageCopy: PageCopy | null;
  designSystem: string;
  brandVoice: string;
  sharedComponentPaths: Record<string, string>;
  projectBrief: ProjectBrief;
  projectRoot: string;
  competitiveIntel?: string;
  priorPageSummary?: string;
  /** Cached output from parallel batch in prepare(). */
  precomputedOutput?: ComponentWriterOutput;
  /** Cached error from parallel batch. */
  precomputedError?: string;
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
      `Phase "react-gen": no completed spec found for projectId=${projectId}. Run the spec phase first.`,
    );
  }
  return JSON.parse(rows[0].output) as SpecOutput;
}

async function loadProjectBrief(projectId: string): Promise<ProjectBrief | null> {
  const db = getOrchestratorDb();
  const runs = await db
    .select()
    .from(pipelineRuns)
    .where(eq(pipelineRuns.projectId, projectId))
    .orderBy(desc(pipelineRuns.startedAt))
    .limit(1);

  if (runs.length > 0 && runs[0].config) {
    return loadBriefFromConfig(runs[0].config);
  }
  return null;
}

async function loadProjectCopy(projectId: string): Promise<ProjectCopy | null> {
  const db = getOrchestratorDb();
  const rows = await db
    .select()
    .from(pipelinePages)
    .where(
      and(
        eq(pipelinePages.projectId, projectId),
        eq(pipelinePages.phase, "copy"),
        eq(pipelinePages.status, "complete"),
      ),
    )
    .limit(1);

  if (rows.length > 0 && rows[0].output) {
    try {
      return JSON.parse(rows[0].output) as ProjectCopy;
    } catch {
      return null;
    }
  }
  return null;
}

// Module-level state for the preview server — cleaned up after all pages.
let previewServer: LivePreviewServer | null = null;

export const reactGenPhaseImplementation: PhaseImplementation = {
  async prepare(config: ProjectConfig, runId?: number): Promise<PageWorkUnit[]> {
    const projectRoot = path.resolve(config.repoPath);
    const spec = await loadLatestSpec(config.projectId);
    const projectCopy = await loadProjectCopy(config.projectId);
    const brief = await loadProjectBrief(config.projectId);

    const planningDir = path.resolve(projectRoot, ".planning");
    const brandVoice = loadBrandVoice(planningDir) ?? "";
    const designSystemPath = path.resolve(projectRoot, config.designSystemPath);
    const designSystem = fs.existsSync(designSystemPath)
      ? fs.readFileSync(designSystemPath, "utf-8")
      : "";

    // Build a minimal brief if DB doesn't have one
    const projectBrief: ProjectBrief = brief ?? {
      productName: "Project",
      productDescription: "",
      productVision: "",
      targetUsers: [],
      jobsToBeDone: [],
      brandVoice,
      designSystem,
      techStack: { frontend: "react", buildTool: "vite", styling: "tailwind", componentLib: "shadcn/ui", language: "typescript" },
      authProvider: "firebase",
      dbProvider: "neon",
      deployTarget: "vps",
      spec,
      isGreenfield: false,
      existingCodeScanned: false,
      sourceDocs: [],
    };

    // 1. Start live preview
    previewServer = await ensureLivePreviewServer(projectRoot);

    // 2. Inject build overlay
    await injectBuildOverlay(projectRoot);

    // 3. Build shared components (sequential, blocking)
    await updateBuildStatus(
      { phase: "shared-components", total: 7, completed: [], current: "starting...", failed: [] },
      projectRoot,
    );
    const sharedComponentPaths = await buildSharedComponents(projectBrief, projectRoot);
    await updateBuildStatus(
      { phase: "shared-components", total: 7, completed: Object.keys(sharedComponentPaths), current: null, failed: [] },
      projectRoot,
    );

    // 4. Determine which pages still need generation
    const completePageIndexes = new Set<number>();
    if (runId !== undefined) {
      const db = getOrchestratorDb();
      const existingRows = await db
        .select()
        .from(pipelinePages)
        .where(
          and(
            eq(pipelinePages.runId, runId),
            eq(pipelinePages.phase, "react-gen"),
            eq(pipelinePages.status, "complete"),
          ),
        );
      for (const r of existingRows) completePageIndexes.add(r.pageIndex);
    }

    // Build work unit inputs
    const pageOrder = spec.suggestedOrder.length > 0
      ? spec.suggestedOrder
      : spec.pages.map((p) => p.name);

    const orderedPages = pageOrder
      .map((name) => spec.pages.find((p) => p.name === name))
      .filter((p): p is SpecOutput["pages"][number] => Boolean(p));

    // Add any pages not in suggestedOrder
    for (const page of spec.pages) {
      if (!orderedPages.includes(page)) orderedPages.push(page);
    }

    const baseInputs: Map<number, ReactGenRunInput> = new Map();
    for (let idx = 0; idx < orderedPages.length; idx++) {
      const page = orderedPages[idx];
      baseInputs.set(idx, {
        page,
        pageIndex: idx,
        pageCopy: projectCopy?.pages.find((p) => p.pageName === page.name) ?? null,
        designSystem,
        brandVoice,
        sharedComponentPaths,
        projectBrief,
        projectRoot,
        competitiveIntel: projectBrief.competitiveIntel?.copyInfluences,
      });
    }

    // 5. Parallel generation
    const pendingIndexes = orderedPages
      .map((_, idx) => idx)
      .filter((idx) => !completePageIndexes.has(idx));

    if (pendingIndexes.length > 0) {
      const totalPages = pendingIndexes.length;
      await updateBuildStatus(
        { phase: "pages", total: totalPages, completed: [], current: "starting...", failed: [] },
        projectRoot,
      );

      console.log(
        `[react-gen] Generating ${totalPages} page(s), concurrency=${REACT_GEN_PARALLEL_LIMIT}`,
      );

      const limit = pLimit(REACT_GEN_PARALLEL_LIMIT);
      const completedNames: string[] = [];
      const failedNames: string[] = [];

      const results = await Promise.allSettled(
        pendingIndexes.map((idx) =>
          limit(async () => {
            const input = baseInputs.get(idx)!;
            await updateBuildStatus(
              { phase: "pages", total: totalPages, completed: [...completedNames], current: input.page.name, failed: [...failedNames] },
              projectRoot,
            );

            const writerInput: ComponentWriterInput = {
              page: input.page,
              pageCopy: input.pageCopy,
              designSystem: input.designSystem,
              brandVoice: input.brandVoice,
              sharedComponentPaths: input.sharedComponentPaths,
              projectBrief: input.projectBrief,
              projectRoot: input.projectRoot,
              competitiveIntel: input.competitiveIntel,
              priorPageSummary: input.priorPageSummary,
            };

            let output = await writeReactComponent(writerInput);
            completedNames.push(input.page.name);

            await updateBuildStatus(
              { phase: "pages", total: totalPages, completed: [...completedNames], current: null, failed: [...failedNames] },
              projectRoot,
            );

            const routePath = input.page.route;
            const previewUrl = previewServer ? `${previewServer.url}${routePath}` : routePath;
            console.log(`  \u2713 ${input.page.name} (${output.reviewScore.toFixed(2)}) \u2014 ${previewUrl}`);

            // Screenshot quality gate — wait for Vite HMR, then screenshot + review
            if (previewServer) {
              await new Promise((r) => setTimeout(r, 2000)); // Wait for Vite compile
              const screenshotResult = await screenshotAndReview({
                url: `${previewServer.url}${routePath}`,
                pageName: input.page.name,
                designSystem: input.designSystem,
                projectRoot: input.projectRoot,
              });
              console.log(`  📸 ${input.page.name} screenshot: ${screenshotResult.score.toFixed(2)}`);
              if (screenshotResult.screenshotPath) {
                console.log(`     ${screenshotResult.screenshotPath}`);
              }

              // If score < 0.7 and we haven't retried via screenshot yet, regenerate
              if (screenshotResult.score < 0.7 && !output.retried) {
                const issueList = screenshotResult.issues.map((i) => `- ${i}`).join("\n");
                console.log(`  ↻ Regenerating ${input.page.name} due to screenshot issues...`);
                const retryInput: ComponentWriterInput = {
                  ...writerInput,
                  priorPageSummary: `SCREENSHOT REVIEW FAILED (${screenshotResult.score.toFixed(2)}). Fix these visual issues:\n${issueList}`,
                };
                output = await writeReactComponent(retryInput);
                console.log(`  \u2713 ${input.page.name} retry (${output.reviewScore.toFixed(2)})`);
              }
            }

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
          failedNames.push(input.page.name);
          console.error(`  \u2717 ${input.page.name} FAILED: ${msg}`);
        }
      }

      const ok = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - ok;
      console.log(`[react-gen] Batch complete: ${ok} ok, ${failed} failed`);
    }

    // 6. Clean up overlay
    await removeBuildOverlay(projectRoot);

    // 7. Print completion
    const bar = "\u2550".repeat(46);
    console.log(`\u2554${bar}\u2557`);
    console.log(`\u2551  Build complete${" ".repeat(30)}\u2551`);
    console.log(`\u2551  ${orderedPages.length}/${orderedPages.length} pages generated${" ".repeat(20)}\u2551`);
    console.log(`\u2551${" ".repeat(46)}\u2551`);
    if (previewServer) {
      const reviewLine = `  Review: ${previewServer.url}`;
      console.log(`\u2551${reviewLine.padEnd(46)}\u2551`);
      console.log(`\u2551${" ".repeat(46)}\u2551`);
    }
    console.log(`\u2551  To edit: describe what to change in chat${" ".repeat(3)}\u2551`);
    console.log(`\u255A${bar}\u255D`);

    return orderedPages.map((page, idx) => ({
      pageName: page.name,
      pageIndex: idx,
      input: baseInputs.get(idx)!,
    }));
  },

  async runPage(rawInput: unknown, _config: ProjectConfig): Promise<unknown> {
    const input = rawInput as ReactGenRunInput;

    if (input.precomputedError) {
      throw new Error(input.precomputedError);
    }

    if (input.precomputedOutput) {
      return ReactGenPhaseOutputSchema.parse({
        filePath: input.precomputedOutput.filePath,
        componentCode: input.precomputedOutput.componentCode,
        reviewScore: input.precomputedOutput.reviewScore,
        reviewFeedback: input.precomputedOutput.reviewFeedback,
        passed: input.precomputedOutput.passed,
        retried: input.precomputedOutput.retried,
      });
    }

    // Fallback: single-page generation (for manual reruns)
    const writerInput: ComponentWriterInput = {
      page: input.page,
      pageCopy: input.pageCopy,
      designSystem: input.designSystem,
      brandVoice: input.brandVoice,
      sharedComponentPaths: input.sharedComponentPaths,
      projectBrief: input.projectBrief,
      projectRoot: input.projectRoot,
      competitiveIntel: input.competitiveIntel,
      priorPageSummary: input.priorPageSummary,
    };

    const output = await writeReactComponent(writerInput);
    return ReactGenPhaseOutputSchema.parse({
      filePath: output.filePath,
      componentCode: output.componentCode,
      reviewScore: output.reviewScore,
      reviewFeedback: output.reviewFeedback,
      passed: output.passed,
      retried: output.retried,
    });
  },
};
