/**
 * UI-Gen Runner — generates ONE page via Stitch, saves result to queue file, exits.
 *
 * Usage: npx tsx scripts/ui-gen-runner.ts [pageName]
 *   If pageName omitted, picks the next pending page from pipeline_pages.
 *
 * Output: .planning/output/ui-gen-queue/{pageName}.pending.json
 * No stdin. No review. No blocking. Just generate and exit.
 */

import "dotenv/config";
process.env.USE_NEON_HTTP = "1";

import path from "node:path";
import fs from "node:fs";
import { and, asc, eq } from "drizzle-orm";
import { getOrchestratorDb, updatePage } from "../lib/orchestrator/db.js";
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

const QUEUE_DIR = path.resolve(config.repoPath, ".planning/output/ui-gen-queue");

async function findNextPending(): Promise<{ pageName: string; pageIndex: number } | null> {
  const db = getOrchestratorDb();
  const rows = await db
    .select()
    .from(pipelinePages)
    .where(
      and(
        eq(pipelinePages.runId, RUN_ID),
        eq(pipelinePages.phase, "ui-gen"),
      ),
    )
    .orderBy(asc(pipelinePages.pageIndex));

  for (const row of rows) {
    if (row.status === "pending" || row.status === "in_progress") {
      return { pageName: row.pageName, pageIndex: row.pageIndex };
    }
  }
  return null;
}

async function main() {
  const explicitPage = process.argv[2];

  const db = getOrchestratorDb();
  const allPages = await db
    .select()
    .from(pipelinePages)
    .where(
      and(
        eq(pipelinePages.runId, RUN_ID),
        eq(pipelinePages.phase, "ui-gen"),
      ),
    )
    .orderBy(asc(pipelinePages.pageIndex));

  let target: { pageName: string; pageIndex: number };

  if (explicitPage) {
    const found = allPages.find((r) => r.pageName === explicitPage);
    if (!found) {
      console.error(`Page "${explicitPage}" not found in run ${RUN_ID}.`);
      process.exit(1);
    }
    target = { pageName: found.pageName, pageIndex: found.pageIndex };
  } else {
    const next = await findNextPending();
    if (!next) {
      console.log("All ui-gen pages are complete. Nothing to generate.");
      process.exit(0);
    }
    target = next;
  }

  console.log(`\n[runner] Generating: ${target.pageName} (index ${target.pageIndex})\n`);

  // Mark in_progress
  const pageRow = allPages.find((r) => r.pageName === target.pageName)!;
  await updatePage(pageRow.id, { status: "in_progress", startedAt: new Date(), error: null });

  // Use the phase implementation's prepare() to build the work unit,
  // then call runPage() for just the target page.
  const workUnits = await uiGenPhaseImplementation.prepare(config);
  const unit = workUnits.find((u) => u.pageName === target.pageName);
  if (!unit) {
    console.error(`Work unit for "${target.pageName}" not found after prepare().`);
    process.exit(1);
  }

  try {
    const output = await uiGenPhaseImplementation.runPage(unit.input, config);

    // Save to queue file
    if (!fs.existsSync(QUEUE_DIR)) {
      fs.mkdirSync(QUEUE_DIR, { recursive: true });
    }
    const queueFile = path.resolve(QUEUE_DIR, `${target.pageName}.pending.json`);
    fs.writeFileSync(
      queueFile,
      JSON.stringify(
        {
          pageName: target.pageName,
          pageIndex: target.pageIndex,
          pageRowId: pageRow.id,
          output,
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );

    console.log(`[runner] Generated: ${target.pageName}`);
    console.log(`[runner] Queue file: ${queueFile}`);
    console.log(`[runner] Scores: ${(output as any).scoreSummary}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updatePage(pageRow.id, { status: "failed", error: message, completedAt: new Date() });
    console.error(`[runner] FAILED: ${target.pageName} — ${message}`);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Runner failed:", err);
  process.exit(1);
});
