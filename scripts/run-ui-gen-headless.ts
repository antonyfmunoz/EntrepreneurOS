/**
 * Headless ui-gen runner — generates Stitch HTML for any spec pages that
 * don't yet have a completed ui-gen row in pipeline_pages for the given
 * run. Bypasses the interactive onPageComplete() review gate so it can run
 * non-interactively (used for small additions where review can be deferred
 * to the integrated app).
 *
 * Used here to generate PortfolioList and PortfolioDetail after the
 * portfolio hierarchy spec update without blocking on stdin prompts.
 *
 * Usage: npx tsx scripts/run-ui-gen-headless.ts
 */

import "dotenv/config";
process.env.USE_NEON_HTTP = "1";

import { and, eq } from "drizzle-orm";
import { getOrchestratorDb } from "../lib/orchestrator/db.js";
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

async function main() {
  console.log(`\n=== Headless UI-Gen — Run ${RUN_ID} ===\n`);

  // prepare() walks the spec, skips already-complete pageIndexes for this
  // run, and runs parallel Stitch generation for the pending ones. The
  // returned work units carry either precomputedOutput (success) or
  // precomputedError (failure) on their input.
  const workUnits = await uiGenPhaseImplementation.prepare(config, RUN_ID);
  console.log(`\nprepare() produced ${workUnits.length} work unit(s).\n`);

  const db = getOrchestratorDb();

  // Determine which work units are pending (no existing complete row).
  const existing = await db
    .select()
    .from(pipelinePages)
    .where(
      and(
        eq(pipelinePages.runId, RUN_ID),
        eq(pipelinePages.phase, "ui-gen"),
      ),
    );
  const existingByIndex = new Map(existing.map((r) => [r.pageIndex, r]));

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const unit of workUnits) {
    const found = existingByIndex.get(unit.pageIndex);
    if (found && found.status === "complete") {
      skipped++;
      continue;
    }

    const input = unit.input as {
      precomputedOutput?: unknown;
      precomputedError?: string;
    };

    if (input.precomputedError) {
      console.error(`  FAIL  ${unit.pageName.padEnd(20)}  ${input.precomputedError}`);
      failed++;
      if (found) {
        await db
          .update(pipelinePages)
          .set({
            status: "failed",
            error: input.precomputedError,
            completedAt: new Date(),
          })
          .where(eq(pipelinePages.id, found.id));
      } else {
        await db.insert(pipelinePages).values({
          runId: RUN_ID,
          projectId: config.projectId,
          pageName: unit.pageName,
          pageIndex: unit.pageIndex,
          phase: "ui-gen",
          status: "failed",
          error: input.precomputedError,
          startedAt: new Date(),
          completedAt: new Date(),
        });
      }
      continue;
    }

    if (input.precomputedOutput === undefined) {
      // Nothing to do — page was already complete and prepare() didn't
      // touch it. Shouldn't normally hit this branch given the filter above.
      skipped++;
      continue;
    }

    const outputJson = JSON.stringify(input.precomputedOutput ?? null);
    if (found) {
      await db
        .update(pipelinePages)
        .set({
          status: "complete",
          output: outputJson,
          startedAt: new Date(),
          completedAt: new Date(),
          error: null,
        })
        .where(eq(pipelinePages.id, found.id));
    } else {
      await db.insert(pipelinePages).values({
        runId: RUN_ID,
        projectId: config.projectId,
        pageName: unit.pageName,
        pageIndex: unit.pageIndex,
        phase: "ui-gen",
        status: "complete",
        output: outputJson,
        startedAt: new Date(),
        completedAt: new Date(),
      });
    }
    console.log(`  OK    ${unit.pageName.padEnd(20)}  pageIndex=${unit.pageIndex}`);
    created++;
  }

  console.log(`\n=== Summary ===`);
  console.log(`  created/updated: ${created}`);
  console.log(`  skipped:         ${skipped}`);
  console.log(`  failed:          ${failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Headless ui-gen failed:", err);
  process.exit(1);
});
