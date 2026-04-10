import "dotenv/config";
import { detectIntakeMode } from "../lib/intake/mode-detector.js";
import { scanPlanningDocs, identifyMissingDocs } from "../lib/intake/doc-scanner.js";
import { scanCodebase, formatCodebaseSummary } from "../lib/intake/codebase-scanner.js";
import { runIntake } from "../lib/intake/intake-orchestrator.js";
import { loadProjectConfig } from "../lib/project-config.js";
import path from "path";

async function main() {
  const root = path.resolve(".");
  console.log("=== INTAKE: Mode Detection ===");
  console.log("Mode:", detectIntakeMode(root));
  console.log("");

  console.log("=== INTAKE: Document Scan ===");
  const docs = scanPlanningDocs(root);
  console.log("PRD:", docs.prd ? `${docs.prd.length} chars` : "MISSING");
  console.log("Requirements:", docs.requirements ? `${docs.requirements.length} chars` : "MISSING");
  console.log("Design System:", docs.designSystem ? `${docs.designSystem.length} chars` : "MISSING");
  console.log("Brand Voice:", docs.brandVoice ? `${docs.brandVoice.length} chars` : "MISSING");
  console.log("Spec Files:", docs.specFiles.map((f) => `${f.path} (${f.content.length} chars)`));
  console.log("Source Docs:", docs.sourceDocs);
  console.log("Missing categories:", identifyMissingDocs(docs));
  console.log("");

  console.log("=== INTAKE: Codebase Scan ===");
  const scan = scanCodebase(root);
  console.log(formatCodebaseSummary(scan));
  console.log("Pages:", scan.existingPages);
  console.log("Tables:", scan.existingTables.length);
  console.log("Endpoints:", scan.existingEndpoints.length);
  console.log("");

  console.log("=== INTAKE: Running Full Intake ===");
  const config = loadProjectConfig(".");
  const result = await runIntake(config);

  console.log("");
  console.log("================================================================");
  console.log("  PROJECT BRIEF — EntrepreneurOS");
  console.log("================================================================");
  console.log("");
  console.log("Mode:", result.mode);
  console.log("");

  console.log("── Product ──────────────────────────────────────────────────────");
  console.log("Name:", result.brief.productName);
  console.log("Description:", result.brief.productDescription);
  console.log("Vision:", result.brief.productVision);
  console.log("Target Users:", JSON.stringify(result.brief.targetUsers, null, 2));
  console.log("Jobs To Be Done:", JSON.stringify(result.brief.jobsToBeDone));
  console.log("");

  console.log("── Brand ────────────────────────────────────────────────────────");
  console.log("Brand Voice:");
  console.log(result.brief.brandVoice || "(none — will infer)");
  console.log("");
  console.log("Design System:", result.brief.designSystem ? `${result.brief.designSystem.length} chars loaded` : "(none)");
  console.log(result.brief.designSystem ? result.brief.designSystem.slice(0, 500) + "..." : "");
  console.log("");

  console.log("── Tech Stack ───────────────────────────────────────────────────");
  console.log("Frontend:", result.brief.techStack.frontend);
  console.log("Build Tool:", result.brief.techStack.buildTool);
  console.log("Styling:", result.brief.techStack.styling);
  console.log("Component Lib:", result.brief.techStack.componentLib);
  console.log("Language:", result.brief.techStack.language);
  console.log("Auth Provider:", result.brief.authProvider);
  console.log("DB Provider:", result.brief.dbProvider);
  console.log("Deploy Target:", result.brief.deployTarget);
  console.log("");

  console.log("── Spec (13 pages) ──────────────────────────────────────────────");
  for (const p of result.brief.spec.pages) {
    const comps = p.components.length;
    const apis = p.apiEndpoints?.length ?? 0;
    console.log(
      `  ${p.name.padEnd(28)} ${p.route.padEnd(30)} ${p.authLevel.padEnd(16)} comps:${comps} apis:${apis}`
    );
  }
  console.log("");
  console.log("Shared Components:", result.brief.spec.sharedComponents?.length ?? 0);
  for (const sc of result.brief.spec.sharedComponents ?? []) {
    console.log(`  ${sc.name.padEnd(25)} ${sc.purpose.slice(0, 70)}`);
  }
  console.log("");
  console.log("Backend Endpoints:", result.brief.spec.backendSpec?.endpoints?.length ?? 0);
  for (const ep of result.brief.spec.backendSpec?.endpoints ?? []) {
    console.log(`  ${ep.method.padEnd(7)} ${ep.path.padEnd(40)} ${ep.description.slice(0, 50)}`);
  }
  console.log("");
  console.log("Suggested Order:", result.brief.spec.suggestedOrder?.join(" → "));
  console.log("");

  console.log("── Meta ─────────────────────────────────────────────────────────");
  console.log("Greenfield:", result.brief.isGreenfield);
  console.log("Codebase Scanned:", result.brief.existingCodeScanned);
  console.log("Source Docs:", result.brief.sourceDocs);
  console.log("Gap Report:", result.gapReport ? "present (see .planning/output/spec/GAP-ANALYSIS.md)" : "skipped");
  console.log("");
  console.log("================================================================");
  console.log("  Awaiting approval before proceeding to pipeline phases.");
  console.log("================================================================");
}

main().catch((err) => {
  console.error("[intake] FATAL:", err);
  process.exit(1);
});
