import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { getOrchestratorDb } from "../lib/orchestrator/db.js";
import { pipelinePages } from "../shared/design-schema.js";

async function main() {
  const db = getOrchestratorDb();

  // Delete the orphaned ui-gen row for PortfolioDashboard — the page was
  // replaced by PortfolioList + PortfolioDetail in the new spec, but this
  // row was left behind and would trigger a warning during integration
  // prepare() every run.
  const deleted = await db
    .delete(pipelinePages)
    .where(
      and(
        eq(pipelinePages.projectId, "entrepreneur-os"),
        eq(pipelinePages.phase, "ui-gen"),
        eq(pipelinePages.pageName, "PortfolioDashboard"),
      ),
    )
    .returning();

  console.log(`Deleted ${deleted.length} ui-gen row(s) for PortfolioDashboard.`);
  for (const r of deleted) {
    console.log(`  row id=${r.id}, pageIndex=${r.pageIndex}, status=${r.status}`);
  }

  // Remove the stale preview HTML
  const htmlPath = resolve(
    process.cwd(),
    ".planning/output/previews/PortfolioDashboard.html",
  );
  if (existsSync(htmlPath)) {
    unlinkSync(htmlPath);
    console.log(`Deleted stale preview: ${htmlPath}`);
  } else {
    console.log(`Stale preview not found (already gone): ${htmlPath}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
