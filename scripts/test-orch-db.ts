import "dotenv/config";
process.env.USE_NEON_HTTP = "1";
import { getOrchestratorDb } from "../lib/orchestrator/db.js";
import { pipelinePages } from "../shared/design-schema.js";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Testing orchestrator DB with USE_NEON_HTTP=1...");
  const db = getOrchestratorDb();

  const rows = await db
    .select({
      id: pipelinePages.id,
      pageName: pipelinePages.pageName,
      phase: pipelinePages.phase,
      status: pipelinePages.status,
    })
    .from(pipelinePages)
    .where(eq(pipelinePages.runId, 8));

  console.log(`Found ${rows.length} rows for run 8:`);
  for (const r of rows) {
    console.log(`  ${r.pageName.padEnd(20)} ${r.phase.padEnd(10)} ${r.status}`);
  }
  console.log("Orchestrator DB OK");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  });
