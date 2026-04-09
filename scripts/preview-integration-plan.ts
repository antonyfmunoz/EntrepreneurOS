// scripts/preview-integration-plan.ts
// One-shot script: runs the brownfield planner against the live repo and
// prints the integration PLAN.md to stdout. No file writes, no LLM calls.

import { readFileSync } from "fs";

// Load .env into process.env (no dotenv dependency).
for (const line of readFileSync(".env", "utf-8").split("\n")) {
  const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2];
  }
}

import { loadProjectConfig } from "../lib/project-config.js";
import { registerPhaseImplementation } from "../lib/orchestrator/index.js";
import { integrationPhaseImplementation } from "../lib/orchestrator/phases/integration-adapter.js";

async function main() {
  const config = loadProjectConfig(".");

  // Register so the orchestrator can see it (not strictly needed for preview,
  // but keeps the import graph consistent).
  registerPhaseImplementation("integration", integrationPhaseImplementation);

  if (!integrationPhaseImplementation.previewForApproval) {
    console.error("previewForApproval not implemented on integration phase");
    process.exit(1);
  }

  const planMarkdown = await integrationPhaseImplementation.previewForApproval(config);
  console.log(planMarkdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
