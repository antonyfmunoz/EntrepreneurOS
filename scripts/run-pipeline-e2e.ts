// scripts/run-pipeline-e2e.ts
// Drives the full SaaS-dev skill pipeline against the current repo.
// Uses resumePipeline so spec/ui-gen pages marked complete on prior
// loops are skipped — no re-spend on Anthropic / Stitch across retries.
// Usage: npx tsx scripts/run-pipeline-e2e.ts
import "dotenv/config";
import { resumePipeline, runPipeline } from "../lib/orchestrator/index.js";
import { registerAllPhases } from "../lib/orchestrator/phases/register.js";
import { loadProjectConfig } from "../lib/project-config.js";
import { getLastIncompleteRun } from "../lib/orchestrator/db.js";

async function main() {
  registerAllPhases();
  const config = loadProjectConfig(process.cwd());
  const approvedPhases = ["ui-gen", "integration", "backend", "deploy"] as const;

  const existing = await getLastIncompleteRun(config.projectId);
  const status = existing
    ? await resumePipeline(config, { approvedPhases: [...approvedPhases] })
    : await runPipeline(config, { approvedPhases: [...approvedPhases] });

  console.log("\n=== PIPELINE STATUS ===");
  console.log(JSON.stringify(status, null, 2));
}

main().catch((err) => {
  console.error("\n=== PIPELINE FAILED ===");
  console.error(err?.stack ?? err);
  process.exit(1);
});
