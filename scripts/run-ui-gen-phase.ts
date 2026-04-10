/**
 * UI-Gen Phase Runner for Pipeline Run ID 8
 *
 * Runs the ui-gen phase through the standard phase-runner with:
 * - Neon HTTP driver (USE_NEON_HTTP=1) for Windows compatibility
 * - Real uiGenPhaseImplementation wired in
 * - Per-page review with preview links and approval gate
 *
 * Usage: npx tsx scripts/run-ui-gen-phase.ts
 */

import "dotenv/config";
process.env.USE_NEON_HTTP = "1";

import { runPhase } from "../lib/orchestrator/phase-runner.js";
import { uiGenPhaseImplementation } from "../lib/orchestrator/phases/ui-gen-adapter.js";
import { updateRun } from "../lib/orchestrator/db.js";
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
  console.log(`\n=== UI-Gen Phase — Pipeline Run ${RUN_ID} ===\n`);
  console.log("Using Neon HTTP driver for DB access");
  console.log(`Stitch Project: ${config.stitchProjectId}`);
  console.log();

  // Update run to mark ui-gen phase active
  await updateRun(RUN_ID, { phase: "ui-gen" });

  const result = await runPhase(RUN_ID, "ui-gen", uiGenPhaseImplementation, config);

  console.log("\n=== UI-Gen Phase Complete ===");
  console.log(`  Total pages: ${result.totalPages}`);
  console.log(`  Completed:   ${result.completedPages}`);
  if (result.failedPages.length > 0) {
    console.log("  Failed:");
    for (const f of result.failedPages) {
      console.log(`    ${f.pageName}: ${f.error}`);
    }
  }

  // Update run status
  if (result.failedPages.length === 0) {
    await updateRun(RUN_ID, { phase: "ui-gen", status: "paused" });
    console.log("\nRun paused after ui-gen. Next phase: integration");
  } else {
    await updateRun(RUN_ID, { status: "failed" });
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("UI-Gen phase failed:", err);
    process.exit(1);
  });
