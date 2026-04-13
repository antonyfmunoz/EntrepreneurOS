#!/usr/bin/env npx tsx
// scripts/saas-dev-build.ts
// Single entry point for the SaaS dev pipeline.
// Usage: npx tsx scripts/saas-dev-build.ts
// Or in Claude Code: /saas-dev:build

import "dotenv/config";
import path from "node:path";
import { loadProjectConfig } from "../lib/project-config.js";
import { registerAllPhases } from "../lib/orchestrator/phases/register.js";
import { runPipeline, type RunPipelineOptions } from "../lib/orchestrator/index.js";

const BAR = "\u2501".repeat(35);

function printBanner(): void {
  console.log("");
  console.log("saas-dev \u2014 AI Development Pipeline");
  console.log(BAR);
  console.log("");
}

function printCompletion(url?: string): void {
  console.log("");
  console.log(BAR);
  console.log("Build complete");
  console.log("");
  if (url) {
    console.log(`Review your app: ${url}`);
    console.log("");
  }
  console.log("To make changes, describe them in the chat.");
  console.log(BAR);
  console.log("");
}

async function main(): Promise<void> {
  printBanner();

  const projectRoot = process.cwd();
  const config = loadProjectConfig(projectRoot);

  // Wire all phase implementations
  registerAllPhases();

  const options: RunPipelineOptions = {
    // Approve all phases — the pipeline runs end-to-end.
    // Individual phases still print progress and can be interrupted.
    approvedPhases: ["react-gen", "integration", "backend", "deploy"],
  };

  try {
    const status = await runPipeline(config, options);
    printCompletion();
    console.log(`Pipeline status: ${status.currentPhase}`);
    console.log(`Completed phases: ${status.completedPhases.join(", ")}`);
  } catch (err) {
    if (err instanceof Error) {
      console.error(`\nPipeline failed: ${err.message}`);
      if (err.stack) {
        console.error(err.stack);
      }
    } else {
      console.error("\nPipeline failed:", err);
    }
    process.exit(1);
  }
}

main();
