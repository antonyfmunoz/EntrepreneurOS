import "dotenv/config";
import { getOrchestratorDb } from "../lib/orchestrator/db.js";
import { pipelinePages } from "../shared/design-schema.js";
import { eq, and } from "drizzle-orm";

const pageName = process.argv[2];
if (!pageName) {
  console.error("Usage: npx tsx scripts/approve-page.ts <pageName>");
  process.exit(1);
}

async function main() {
  const db = getOrchestratorDb();

  const result = await db.update(pipelinePages).set({
    status: "complete",
    output: JSON.stringify({
      htmlUrl: "expired",
      screenshotUrl: "expired",
      tokenVersion: 0,
      approved: true,
      scoreSummary: "manually approved",
      localHtmlPath: `.planning/output/previews/${pageName}.html`,
    }),
    completedAt: new Date(),
  }).where(
    and(
      eq(pipelinePages.runId, 8),
      eq(pipelinePages.phase, "ui-gen"),
      eq(pipelinePages.pageName, pageName),
    ),
  );

  console.log(`${pageName} marked complete.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
