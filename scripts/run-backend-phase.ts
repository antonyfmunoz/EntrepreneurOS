// scripts/run-backend-phase.ts
//
// Drives ONLY the backend phase of the orchestrator pipeline against the
// current repo. Resumes the most recent incomplete run if one exists,
// otherwise creates a new run pinned to phase="backend". This is the
// entry point for Phase 5 execution — it does NOT auto-advance into the
// deploy phase (that's handled separately).
//
// Usage: npx tsx scripts/run-backend-phase.ts
import "dotenv/config";
import { PHASE_IMPLEMENTATIONS } from "../lib/orchestrator/index.js";
import { registerAllPhases } from "../lib/orchestrator/phases/register.js";
import { runPhase } from "../lib/orchestrator/phase-runner.js";
import {
  createRun,
  getLastIncompleteRun,
  updateRun,
} from "../lib/orchestrator/db.js";
import { loadProjectConfig } from "../lib/project-config.js";

async function main() {
  registerAllPhases();
  const config = loadProjectConfig(process.cwd());

  // Resume the latest incomplete run if one exists; otherwise create a
  // new run pinned to phase="backend".
  let run = await getLastIncompleteRun(config.projectId);
  if (run) {
    console.log(
      `[phase-5] Resuming incomplete run ${run.id} (current phase: ${run.phase}, status: ${run.status})`,
    );
    if (run.phase !== "backend" || run.status !== "running") {
      await updateRun(run.id, { phase: "backend", status: "running" });
      run = { ...run, phase: "backend", status: "running" };
      console.log(`[phase-5] Advanced run ${run.id} to phase="backend"`);
    }
  } else {
    console.log(`[phase-5] No incomplete run found — creating new one`);
    run = await createRun(config.projectId, "backend", config);
    console.log(`[phase-5] Created run ${run.id} pinned to phase="backend"`);
  }

  console.log(`[phase-5] Running backend phase against run ${run.id}...`);
  const result = await runPhase(
    run.id,
    "backend",
    PHASE_IMPLEMENTATIONS.backend,
    config,
  );

  console.log(`\n=== PHASE 5 (backend) RESULT ===`);
  console.log(`Total pages:     ${result.totalPages}`);
  console.log(`Completed pages: ${result.completedPages}`);
  console.log(`Failed pages:    ${result.failedPages.length}`);

  if (result.failedPages.length > 0) {
    console.log(`\nFAILURES:`);
    for (const f of result.failedPages) {
      console.log(`  - ${f.pageName}: ${f.error}`);
    }
    await updateRun(run.id, { status: "failed" });
    process.exit(1);
  }

  // Mark the run as paused so a later phase-6 run can resume it cleanly.
  // (We don't mark it complete because deploy is still pending.)
  await updateRun(run.id, { status: "paused" });
  console.log(
    `\n[phase-5] Backend phase complete. Run ${run.id} paused (awaiting phase 6).`,
  );
}

main().catch((err) => {
  console.error("\n=== PHASE 5 (backend) FAILED ===");
  console.error(err?.stack ?? err);
  process.exit(1);
});
