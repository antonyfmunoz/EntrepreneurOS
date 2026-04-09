// scripts/run-pipeline-e2e.ts
// Drives the full SaaS-dev skill pipeline against the current repo.
// Usage: npx tsx scripts/run-pipeline-e2e.ts
import "dotenv/config";
import { runPipelineFromRoot } from "../lib/orchestrator/index.js";
import { registerAllPhases } from "../lib/orchestrator/phases/register.js";

async function main() {
  registerAllPhases();
  const status = await runPipelineFromRoot(process.cwd(), {
    approvedPhases: ["ui-gen", "integration", "backend", "deploy"],
  });
  console.log("\n=== PIPELINE STATUS ===");
  console.log(JSON.stringify(status, null, 2));
}

main().catch((err) => {
  console.error("\n=== PIPELINE FAILED ===");
  console.error(err?.stack ?? err);
  process.exit(1);
});
