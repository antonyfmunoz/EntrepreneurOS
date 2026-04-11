/**
 * UI-Gen Parallel — generates ALL pending pages in parallel via Stitch,
 * auto-approves every successful generation, reports all scores.
 *
 * Usage: npx tsx scripts/ui-gen-parallel.ts
 *
 * This bypasses per-page interactive review. Use when you trust the batch
 * and will review the results in the browser after integration.
 */

import "dotenv/config";
process.env.USE_NEON_HTTP = "1";

import path from "node:path";
import { and, asc, eq } from "drizzle-orm";
import { getOrchestratorDb, updatePage, updateRun } from "../lib/orchestrator/db.js";
import { pipelinePages } from "../shared/design-schema.js";
import { uiGenPhaseImplementation } from "../lib/orchestrator/phases/ui-gen-adapter.js";
import type { ProjectConfig } from "../shared/design-schema.js";

const RUN_ID = 8;

const config: ProjectConfig = {
  projectId: "entrepreneur-os",
  repoPath: process.cwd(),
  framework: "react-vite-tailwind-shadcn",
  designSystemPath: ".planning/design-system.md",
  outputPath: ".planning/output",
  clientSrcPath: "client/src",
  serverPath: "server",
  defaultBranch: "main",
  featureBranchPrefix: "feature/",
  stitchProjectId: process.env.STITCH_PROJECT_ID || "15245812195263033351",
  clerkOrganizationsEnabled: true,
};

interface UiGenOutput {
  htmlUrl?: string;
  screenshotUrl?: string;
  scoreSummary?: string;
  approved?: boolean;
  localHtmlPath?: string;
  tokenVersion?: number;
}

async function main() {
  console.log(`\n=== UI-Gen Parallel — Pipeline Run ${RUN_ID} ===\n`);

  await updateRun(RUN_ID, { phase: "ui-gen" });

  // prepare() runs the parallel Stitch batch and returns work units with
  // precomputedOutput (or precomputedError) cached on each input.
  const workUnits = await uiGenPhaseImplementation.prepare(config, RUN_ID);

  const db = getOrchestratorDb();
  const existingRows = await db
    .select()
    .from(pipelinePages)
    .where(and(eq(pipelinePages.runId, RUN_ID), eq(pipelinePages.phase, "ui-gen")))
    .orderBy(asc(pipelinePages.pageIndex));

  const rowByIndex = new Map(existingRows.map((r) => [r.pageIndex, r]));

  const results: Array<{
    pageName: string;
    status: "approved" | "failed" | "skipped";
    scoreSummary?: string;
    error?: string;
  }> = [];

  for (const unit of workUnits) {
    const row = rowByIndex.get(unit.pageIndex);
    if (!row) continue;
    if (row.status === "complete") {
      results.push({ pageName: unit.pageName, status: "skipped" });
      continue;
    }

    const input = unit.input as {
      precomputedOutput?: UiGenOutput;
      precomputedError?: string;
    };

    if (input.precomputedError) {
      await updatePage(row.id, {
        status: "failed",
        error: input.precomputedError,
        completedAt: new Date(),
      });
      results.push({
        pageName: unit.pageName,
        status: "failed",
        error: input.precomputedError,
      });
      continue;
    }

    if (!input.precomputedOutput) {
      results.push({
        pageName: unit.pageName,
        status: "skipped",
        error: "no output (not pending?)",
      });
      continue;
    }

    // Auto-approve: write output to DB as complete.
    await updatePage(row.id, {
      status: "complete",
      output: JSON.stringify(input.precomputedOutput),
      completedAt: new Date(),
    });

    results.push({
      pageName: unit.pageName,
      status: "approved",
      scoreSummary: input.precomputedOutput.scoreSummary,
    });
  }

  // Report
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`  UI-GEN PARALLEL BATCH RESULTS`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  const approved = results.filter((r) => r.status === "approved");
  const failed = results.filter((r) => r.status === "failed");
  const skipped = results.filter((r) => r.status === "skipped");

  if (approved.length > 0) {
    console.log(`  ✓ Approved (${approved.length}):`);
    for (const r of approved) {
      console.log(`      ${r.pageName.padEnd(22)} ${r.scoreSummary ?? ""}`);
    }
    console.log();
  }

  if (failed.length > 0) {
    console.log(`  ✗ Failed (${failed.length}):`);
    for (const r of failed) {
      console.log(`      ${r.pageName.padEnd(22)} ${r.error ?? ""}`);
    }
    console.log();
  }

  if (skipped.length > 0) {
    console.log(`  · Skipped (${skipped.length}): already complete`);
    for (const r of skipped) {
      console.log(`      ${r.pageName}`);
    }
    console.log();
  }

  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`  Total: ${results.length} | Approved: ${approved.length} | Failed: ${failed.length}`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  if (failed.length === 0) {
    await updateRun(RUN_ID, { phase: "ui-gen", status: "paused" });
    console.log("Run paused after ui-gen. Next phase: integration\n");
  } else {
    console.log("Some pages failed — rerun to retry or mark them manually.\n");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("ui-gen-parallel failed:", err);
  process.exit(1);
});
