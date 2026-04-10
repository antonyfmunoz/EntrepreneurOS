import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { pipelinePages } from "../shared/design-schema.js";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Connecting via Neon HTTP...");
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

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
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  });
