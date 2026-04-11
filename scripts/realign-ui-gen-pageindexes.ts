import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { getOrchestratorDb } from "../lib/orchestrator/db.js";
import { pipelinePages } from "../shared/design-schema.js";

const PROJECT_ID = "entrepreneur-os";

async function main() {
  const db = getOrchestratorDb();

  // Load current spec page order from the canonical JSON file
  const spec = JSON.parse(
    readFileSync(resolve(process.cwd(), ".planning/specs/eos-mvp-spec.json"), "utf-8"),
  );
  const nameToNewIndex = new Map<string, number>();
  spec.pages.forEach((p: any, i: number) => nameToNewIndex.set(p.name, i));

  // Fetch all existing ui-gen rows for this project
  const rows = await db
    .select()
    .from(pipelinePages)
    .where(
      and(
        eq(pipelinePages.projectId, PROJECT_ID),
        eq(pipelinePages.phase, "ui-gen"),
      ),
    );

  console.log(`Found ${rows.length} ui-gen rows. Computing realignment...\n`);

  type Move = { id: number; pageName: string; from: number; to: number };
  const moves: Move[] = [];
  for (const r of rows) {
    const newIndex = nameToNewIndex.get(r.pageName);
    if (newIndex === undefined) {
      console.log(
        `  SKIP  ${r.pageName}  (id=${r.id}) — page not in current spec, delete manually if needed`,
      );
      continue;
    }
    if (newIndex !== r.pageIndex) {
      moves.push({ id: r.id, pageName: r.pageName, from: r.pageIndex, to: newIndex });
    }
  }

  if (moves.length === 0) {
    console.log("No realignment needed. DB pageIndexes already match spec.");
    process.exit(0);
  }

  for (const m of moves) {
    console.log(`  ${m.pageName.padEnd(20)} pageIndex ${m.from} → ${m.to}`);
  }

  // Apply moves in DESCENDING target order so we never transiently collide
  // with another row that still holds our target slot.
  moves.sort((a, b) => b.to - a.to);

  for (const m of moves) {
    await db
      .update(pipelinePages)
      .set({ pageIndex: m.to })
      .where(eq(pipelinePages.id, m.id));
  }

  console.log(`\nApplied ${moves.length} pageIndex updates.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
