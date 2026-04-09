// scripts/run-integration-phase.ts
// Runs the integration phase directly (bypasses orchestrator state machine).
// Loads .env, builds work units via prepare(), runs each page via runPage().

import { readFileSync } from "fs";

// Load .env into process.env.
for (const line of readFileSync(".env", "utf-8").split("\n")) {
  const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2];
  }
}

import { loadProjectConfig } from "../lib/project-config.js";
import { integrationPhaseImplementation } from "../lib/orchestrator/phases/integration-adapter.js";

async function main() {
  const config = loadProjectConfig(".");

  console.log("=== INTEGRATION PHASE: prepare() ===\n");
  let workUnits;
  try {
    workUnits = await integrationPhaseImplementation.prepare(config);
  } catch (err) {
    console.error("prepare() failed:", (err as Error).message);
    process.exit(1);
  }

  console.log(`Work units: ${workUnits.length}\n`);
  for (const wu of workUnits) {
    console.log(`  [${wu.pageIndex}] ${wu.pageName}`);
  }
  console.log("");

  console.log("=== INTEGRATION PHASE: runPage() per work unit ===\n");
  for (const wu of workUnits) {
    console.log(`--- ${wu.pageName} ---`);
    try {
      const result = await integrationPhaseImplementation.runPage(wu.input, config);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(`FAILED: ${(err as Error).message}`);
    }
    console.log("");
  }

  console.log("=== DONE ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
