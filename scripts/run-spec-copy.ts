// Run spec + copy phases for EntrepreneurOS, then stop before react-gen.
import "dotenv/config";
import { loadProjectConfig } from "../lib/project-config.js";
import { registerAllPhases } from "../lib/orchestrator/phases/register.js";
import { createRun, updateRun } from "../lib/orchestrator/db.js";
import { runPhase } from "../lib/orchestrator/phase-runner.js";
import { PHASE_IMPLEMENTATIONS } from "../lib/orchestrator/index.js";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const config = loadProjectConfig(".");
  registerAllPhases();

  console.log(`[pipeline] Starting spec + copy for projectId: ${config.projectId}`);

  // Create pipeline run
  const run = await createRun(config.projectId, "spec", config);
  console.log(`[pipeline] Run ID: ${run.id}`);

  // Phase 1: spec
  console.log("\n════════════════════════════════════════");
  console.log("  PHASE 1: SPEC");
  console.log("════════════════════════════════════════\n");

  await updateRun(run.id, { phase: "spec", status: "running" });
  const specResult = await runPhase(run.id, "spec", PHASE_IMPLEMENTATIONS.spec, config);

  if (specResult.failedPages.length > 0) {
    console.error("[pipeline] Spec phase FAILED:", specResult.failedPages);
    await updateRun(run.id, { status: "failed" });
    process.exit(1);
  }
  console.log(`[pipeline] Spec complete: ${specResult.completedPages}/${specResult.totalPages} pages`);

  // Phase 2: copy
  console.log("\n════════════════════════════════════════");
  console.log("  PHASE 2: COPY");
  console.log("════════════════════════════════════════\n");

  await updateRun(run.id, { phase: "copy", status: "running" });
  const copyResult = await runPhase(run.id, "copy", PHASE_IMPLEMENTATIONS.copy, config);

  if (copyResult.failedPages.length > 0) {
    console.error("[pipeline] Copy phase FAILED:", copyResult.failedPages);
    await updateRun(run.id, { status: "failed" });
    process.exit(1);
  }
  console.log(`\n[pipeline] Copy complete: ${copyResult.completedPages}/${copyResult.totalPages} pages`);

  // Pause run at copy — react-gen requires approval
  await updateRun(run.id, { phase: "copy", status: "paused" });

  console.log("\n════════════════════════════════════════");
  console.log("  PIPELINE PAUSED — COPY READY FOR REVIEW");
  console.log("════════════════════════════════════════");
  console.log(`\nRun ID: ${run.id}`);
  console.log("Next phase: react-gen (requires approval)");
  console.log("Copy output: .planning/output/copy/PROJECT-COPY.json\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("[pipeline] FATAL:", err);
  process.exit(1);
});
