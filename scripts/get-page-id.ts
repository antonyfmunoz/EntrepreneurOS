import "dotenv/config";
import { getOrchestratorDb } from "../lib/orchestrator/db.js";
import { pipelinePages } from "../shared/design-schema.js";
import { eq, and } from "drizzle-orm";

const pageName = process.argv[2];
const db = getOrchestratorDb();
const rows = await db.select().from(pipelinePages).where(
  and(eq(pipelinePages.runId, 8), eq(pipelinePages.phase, "ui-gen"), eq(pipelinePages.pageName, pageName)),
);
if (rows.length > 0) {
  console.log(JSON.stringify({ id: rows[0].id, pageName: rows[0].pageName, pageIndex: rows[0].pageIndex, status: rows[0].status }));
}
process.exit(0);
