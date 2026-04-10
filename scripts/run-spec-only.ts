import "dotenv/config";
import { registerAllPhases } from "../lib/orchestrator/phases/register.js";
import { loadProjectConfig } from "../lib/project-config.js";
import { runPipeline, ApprovalRequiredError } from "../lib/orchestrator/index.js";
import { getOrchestratorDb } from "../lib/orchestrator/db.js";
import { pipelinePages } from "../shared/design-schema.js";
import { eq } from "drizzle-orm";

async function main() {
  registerAllPhases();
  const config = loadProjectConfig(process.cwd());

  console.log("Running spec phase only...");
  console.log("Source: will look for .planning/specs/*.json first");

  try {
    const status = await runPipeline(config, {
      startPhase: "spec",
      approvedPhases: [],
    });
    console.log("Pipeline status:", status.currentPhase, status.summary);
  } catch (err) {
    if (err instanceof ApprovalRequiredError) {
      console.log("Approval gate hit at:", err.phase);
      console.log("Spec phase completed successfully — paused at ui-gen approval gate");
    } else {
      console.error("Error:", (err as Error).message);
    }
  }

  // Check what got stored
  const db = getOrchestratorDb();
  const pages = await db
    .select()
    .from(pipelinePages)
    .where(eq(pipelinePages.projectId, "entrepreneur-os"));

  console.log("\nDB state after spec phase:");
  console.log("  Total pages:", pages.length);
  for (const p of pages) {
    console.log(
      `  ${p.phase}/${p.pageName} [${p.status}] — output: ${p.output ? p.output.length + " chars" : "null"}`,
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
