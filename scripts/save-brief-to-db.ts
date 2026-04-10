import "dotenv/config";
import { runIntake } from "../lib/intake/intake-orchestrator.js";
import { loadProjectConfig } from "../lib/project-config.js";
import { getOrchestratorDb } from "../lib/orchestrator/db.js";
import { pipelineRuns } from "../shared/design-schema.js";
import { eq, and, ne } from "drizzle-orm";

const JOBS_TO_BE_DONE = [
  "Structure a business correctly from the start",
  "Generate and evolve the org chart based on stage, model, and goals",
  "Install role-specific dashboards and operating systems",
  "Run workflows manually, with AI assistance, or autonomously",
  "Create, manage, and improve SOPs/workflows",
  "Delegate work to AI agents safely",
  "View key business metrics and next-best actions",
  "Learn what to do and why",
  "Coordinate teams, agents, and software from one platform",
  "Run multiple companies from one portfolio view",
  "Store, retrieve, and evolve business knowledge",
  "Monitor market reality and competitive shifts",
  "Improve the system from outcomes and failures",
  "Integrate with CreatorOS and LYFEOS for distribution and personal optimization",
];

async function main() {
  const config = loadProjectConfig(".");
  console.log("[save-brief] Running intake for", config.projectId);

  const result = await runIntake(config);

  // Patch in the 14 JTBD from the original (non-MVP) PRD
  result.brief.jobsToBeDone = JOBS_TO_BE_DONE;

  console.log("[save-brief] Mode:", result.mode);
  console.log("[save-brief] Pages:", result.brief.spec.pages.length);
  console.log("[save-brief] JTBD:", result.brief.jobsToBeDone.length);
  console.log("[save-brief] Brand voice:", result.brief.brandVoice.length, "chars");

  // Save to pipeline_runs.config — upsert: delete any incomplete runs first,
  // then create a fresh one with the brief embedded in config.
  const db = getOrchestratorDb();

  // Clean up incomplete runs
  const deleted = await db
    .delete(pipelineRuns)
    .where(
      and(
        eq(pipelineRuns.projectId, config.projectId),
        ne(pipelineRuns.status, "complete"),
      ),
    )
    .returning();
  if (deleted.length > 0) {
    console.log("[save-brief] Cleaned up", deleted.length, "incomplete run(s)");
  }

  // Insert new run with brief in config
  const configWithBrief = JSON.stringify({
    ...config,
    brief: result.brief,
  });

  const [run] = await db
    .insert(pipelineRuns)
    .values({
      projectId: config.projectId,
      phase: "spec",
      status: "running",
      config: configWithBrief,
    })
    .returning();

  console.log("[save-brief] Saved to pipeline_runs id:", run.id);
  console.log("[save-brief] Config size:", configWithBrief.length, "chars");

  // Also save the brief JSON to .planning/output/ for reference
  const fs = await import("node:fs");
  const path = await import("node:path");
  const outputDir = path.join(".", ".planning", "output");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, "PROJECT-BRIEF.json"),
    JSON.stringify(result.brief, null, 2) + "\n",
    "utf-8",
  );
  console.log("[save-brief] Written to .planning/output/PROJECT-BRIEF.json");
  console.log("[save-brief] Done. Brief approved and ready for pipeline execution.");

  process.exit(0);
}

main().catch((err) => {
  console.error("[save-brief] FATAL:", err);
  process.exit(1);
});
