import "dotenv/config";
import { getOrchestratorDb } from "../lib/orchestrator/db.js";
import { pipelinePages } from "../shared/design-schema.js";
import { eq, and } from "drizzle-orm";

async function main() {
  const db = getOrchestratorDb();
  const rows = await db
    .select()
    .from(pipelinePages)
    .where(
      and(
        eq(pipelinePages.projectId, "entrepreneur-os"),
        eq(pipelinePages.phase, "ui-gen"),
        eq(pipelinePages.status, "complete"),
      ),
    );

  console.log(`\n=== Stitch UI-Gen Results: ${rows.length} pages ===\n`);
  for (const r of rows) {
    if (!r.output) continue;
    const out = JSON.parse(r.output);
    console.log(`Page: ${r.pageName}`);
    console.log(`  HTML:       ${out.htmlUrl?.slice(0, 100)}...`);
    console.log(`  Screenshot: ${out.screenshotUrl?.slice(0, 100)}...`);
    console.log(`  Approved:   ${out.approved}`);
    console.log("");
  }
  process.exit(0);
}

main().catch(console.error);
