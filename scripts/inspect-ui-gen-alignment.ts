import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { and, asc, eq } from "drizzle-orm";
import { getOrchestratorDb } from "../lib/orchestrator/db.js";
import { pipelinePages } from "../shared/design-schema.js";

async function main() {
  const db = getOrchestratorDb();

  const specRaw = readFileSync(
    resolve(process.cwd(), ".planning/specs/eos-mvp-spec.json"),
    "utf-8",
  );
  const spec = JSON.parse(specRaw);

  console.log("Current spec page order (new):");
  spec.pages.forEach((p: any, i: number) => {
    console.log(`  [${i}] ${p.name}  → ${p.route}`);
  });

  const rows = await db
    .select()
    .from(pipelinePages)
    .where(
      and(
        eq(pipelinePages.projectId, "entrepreneur-os"),
        eq(pipelinePages.phase, "ui-gen"),
        eq(pipelinePages.status, "complete"),
      ),
    )
    .orderBy(asc(pipelinePages.pageIndex));

  console.log(`\nui-gen rows in pipeline_pages: ${rows.length}`);
  console.log("pageIndex  stored-name          → spec.pages[pageIndex]");
  console.log("─────────  ──────────────────── ─────────────────────");

  let misaligned = 0;
  for (const r of rows) {
    const specPage = spec.pages[r.pageIndex];
    const match = specPage && specPage.name === r.pageName;
    const marker = match ? "✓" : "✗";
    const specName = specPage ? specPage.name : "(out of bounds)";
    if (!match) misaligned++;
    console.log(
      `  ${String(r.pageIndex).padStart(2)}      ${r.pageName.padEnd(20)}  ${specName}  ${marker}`,
    );
  }

  console.log(`\nMisaligned rows: ${misaligned}/${rows.length}`);

  // Which spec pages lack a ui-gen row?
  const storedNames = new Set(rows.map((r) => r.pageName));
  const missingFromUiGen = spec.pages
    .filter((p: any) => !storedNames.has(p.name))
    .map((p: any) => p.name);
  console.log(`\nSpec pages WITHOUT a ui-gen row: ${missingFromUiGen.length}`);
  for (const n of missingFromUiGen) console.log(`  ${n}`);

  // Which ui-gen rows reference a page that no longer exists in the spec?
  const specNames = new Set(spec.pages.map((p: any) => p.name));
  const orphanedUiGen = rows.filter((r) => !specNames.has(r.pageName));
  console.log(`\nui-gen rows referencing a removed page: ${orphanedUiGen.length}`);
  for (const r of orphanedUiGen) console.log(`  ${r.pageName} (pageIndex=${r.pageIndex})`);

  // Which HTMLs exist on disk?
  const previewDir = resolve(process.cwd(), ".planning/output/previews");
  const fs = await import("node:fs");
  const htmlFiles = fs.existsSync(previewDir)
    ? fs.readdirSync(previewDir).filter((f) => f.endsWith(".html"))
    : [];
  console.log(`\nPreview HTMLs on disk: ${htmlFiles.length}`);
  htmlFiles.sort().forEach((f) => console.log(`  ${f}`));

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
