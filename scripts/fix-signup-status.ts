import "dotenv/config";
import { getOrchestratorDb } from "../lib/orchestrator/db.js";
import { pipelinePages } from "../shared/design-schema.js";
import { eq, and } from "drizzle-orm";

async function main() {
  const db = getOrchestratorDb();

  // Mark Signup as complete (it was approved in the prior session)
  await db.update(pipelinePages).set({
    status: "complete",
    output: JSON.stringify({
      htmlUrl: "expired",
      screenshotUrl: "expired",
      tokenVersion: 0,
      approved: true,
      scoreSummary: "manually approved",
      localHtmlPath: ".planning/output/previews/Signup.html",
    }),
    completedAt: new Date(),
  }).where(
    and(
      eq(pipelinePages.runId, 8),
      eq(pipelinePages.phase, "ui-gen"),
      eq(pipelinePages.pageName, "Signup"),
    ),
  );

  console.log("Signup marked complete.");

  // Verify all ui-gen pages
  const rows = await db.select().from(pipelinePages).where(
    and(eq(pipelinePages.runId, 8), eq(pipelinePages.phase, "ui-gen")),
  );
  for (const r of rows) {
    console.log(`${r.pageName} | ${r.status}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
