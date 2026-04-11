import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getOrchestratorDb } from "../lib/orchestrator/db.js";
import { pipelinePages } from "../shared/design-schema.js";

const PROJECT_ID = "entrepreneur-os";
const SPEC_PATH = resolve(process.cwd(), ".planning/specs/eos-mvp-spec.json");

async function main() {
  const db = getOrchestratorDb();

  // Read updated spec JSON
  const raw = readFileSync(SPEC_PATH, "utf-8");
  const spec = JSON.parse(raw);
  const allComponents: string[] = [
    ...new Set(spec.pages.flatMap((p: any) => p.components as string[])),
  ].sort();
  const hash = createHash("sha256")
    .update(allComponents.map((n) => n.toLowerCase()).sort().join("\n"))
    .digest("hex");

  console.log(`Spec components: ${allComponents.length}`);
  console.log(`Spec hash: ${hash.slice(0, 16)}...`);

  // Find latest spec row
  const rows = await db
    .select()
    .from(pipelinePages)
    .where(
      and(
        eq(pipelinePages.projectId, PROJECT_ID),
        eq(pipelinePages.phase, "spec"),
        eq(pipelinePages.status, "complete"),
      ),
    )
    .orderBy(desc(pipelinePages.completedAt))
    .limit(1);

  if (rows.length === 0) {
    throw new Error("No completed spec row found. Run the spec phase first.");
  }

  const specRow = rows[0];
  const oldSpec = JSON.parse(specRow.output ?? "{}");
  const oldComponents: string[] = [
    ...new Set((oldSpec.pages ?? []).flatMap((p: any) => p.components as string[])),
  ].sort();

  const added = allComponents.filter((c) => !oldComponents.includes(c));
  const removed = oldComponents.filter((c) => !allComponents.includes(c));

  console.log(`\nComponents added: ${added.length}`);
  if (added.length) console.log(`  ${added.join(", ")}`);
  console.log(`Components removed: ${removed.length}`);
  if (removed.length) console.log(`  ${removed.join(", ")}`);

  // Update the spec row's output with the new JSON
  await db
    .update(pipelinePages)
    .set({
      output: raw,
      completedAt: new Date(),
    })
    .where(eq(pipelinePages.id, specRow.id));

  console.log(`\nSpec row ${specRow.id} updated.`);

  // Write a summary to a scratch file for reference
  const summary = {
    updatedAt: new Date().toISOString(),
    totalComponents: allComponents.length,
    newHash: hash,
    componentsAdded: added,
    componentsRemoved: removed,
    allComponents,
  };
  writeFileSync(
    resolve(process.cwd(), ".planning/output/spec/components-diff.json"),
    JSON.stringify(summary, null, 2),
  );

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
