import "dotenv/config";
import { getOrchestratorDb } from "../lib/orchestrator/db.js";
import { pipelineRuns, pipelinePages } from "../shared/design-schema.js";
import { eq } from "drizzle-orm";

async function main() {
  const db = getOrchestratorDb();
  const projectId = "entrepreneur-os";

  const runs = await db.select().from(pipelineRuns).where(eq(pipelineRuns.projectId, projectId));
  console.log("Existing runs:", runs.length);
  for (const r of runs) {
    console.log(`  Run ${r.id} — phase: ${r.phase}, status: ${r.status}`);
  }

  await db.delete(pipelinePages).where(eq(pipelinePages.projectId, projectId));
  await db.delete(pipelineRuns).where(eq(pipelineRuns.projectId, projectId));
  console.log("Cleared all pipeline state for", projectId);
  process.exit(0);
}

main().catch(console.error);
