import "dotenv/config";
import { getOrchestratorDb } from "../lib/orchestrator/db.js";
import { pipelineRuns, pipelinePages } from "../shared/design-schema.js";
import { eq } from "drizzle-orm";

async function main() {
  const db = getOrchestratorDb();
  const projectId = "entrepreneur-os";

  const runs = await db.select().from(pipelineRuns).where(eq(pipelineRuns.projectId, projectId));
  console.log("Runs:", runs.length);
  for (const r of runs) {
    console.log(`  Run ${r.id} — phase: ${r.phase}, status: ${r.status}`);
  }

  const pages = await db.select().from(pipelinePages).where(eq(pipelinePages.projectId, projectId));
  console.log("\nPages:", pages.length);
  for (const p of pages) {
    console.log(`  ${p.phase}/${p.pageName} [${p.status}] — output: ${p.output ? p.output.slice(0, 80) + "..." : "null"}`);
  }
  process.exit(0);
}

main().catch(console.error);
