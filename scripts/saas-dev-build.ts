#!/usr/bin/env npx tsx
// scripts/saas-dev-build.ts
// Single entry point for the SaaS dev pipeline.
// Usage: npx tsx scripts/saas-dev-build.ts [--resume]

import "dotenv/config";
import { loadProjectConfig } from "../lib/project-config.js";
import { registerAllPhases } from "../lib/orchestrator/phases/register.js";
import {
  runPipeline,
  resumePipeline,
  ApprovalRequiredError,
  type RunPipelineOptions,
} from "../lib/orchestrator/index.js";
import { runIntake } from "../lib/intake/intake-orchestrator.js";

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

  const args = process.argv.slice(2);
  const isResume = args.includes("--resume");

  const projectRoot = process.cwd();
  const config = loadProjectConfig(projectRoot);

  // Wire all phase implementations
  registerAllPhases();

  if (isResume) {
    console.log("Resuming from last checkpoint...");
    try {
      const status = await resumePipeline(config, {
        // spec and copy are non-destructive — auto-approve.
        // react-gen writes files but user watches live — auto-approve.
        // integration, backend, deploy require human oversight.
        approvedPhases: ["react-gen"],
      });
      printCompletion();
      console.log(`Pipeline status: ${status.currentPhase}`);
      console.log(`Completed phases: ${status.completedPhases.join(", ")}`);
    } catch (err) {
      if (err instanceof ApprovalRequiredError) {
        console.log(`\n${err.message}`);
        console.log(`\nRe-run with: npx tsx scripts/saas-dev-build.ts --resume`);
        console.log(`The pipeline will ask for approval before proceeding.`);
        process.exit(0);
      }
      throw err;
    }
    return;
  }

  // ── Intake phase ──────────────────────────────────────────────────────────
  console.log("[intake] Running intake phase...");
  try {
    const intakeResult = await runIntake(config);
    console.log(`[intake] Mode: ${intakeResult.mode}`);

    if (intakeResult.gapReport) {
      console.log(`[intake] Gap analysis complete — see .planning/output/spec/GAP-ANALYSIS.md`);
    }

    console.log(`[intake] Product: ${intakeResult.brief.productName}`);
    console.log(`[intake] Pages in spec: ${intakeResult.brief.spec.pages.length}`);
    console.log("");
  } catch (err) {
    if (err instanceof Error) {
      console.error(`\n[intake] Failed: ${err.message}`);
      if (err.message.includes("blocking")) {
        console.error(`\nResolve blocking gaps in .planning/output/spec/GAP-ANALYSIS.md and re-run.`);
      }
    }
    process.exit(1);
  }

  // ── Pipeline run ──────────────────────────────────────────────────────────
  const options: RunPipelineOptions = {
    // spec and copy are non-destructive — auto-approve.
    // react-gen writes files but user watches live — auto-approve.
    // integration, backend, deploy are destructive and need approval.
    approvedPhases: ["react-gen"],
  };

  try {
    const status = await runPipeline(config, options);
    printCompletion();
    console.log(`Pipeline status: ${status.currentPhase}`);
    console.log(`Completed phases: ${status.completedPhases.join(", ")}`);
  } catch (err) {
    if (err instanceof ApprovalRequiredError) {
      console.log(`\n${err.message}`);
      console.log(`\nApprove and continue with: npx tsx scripts/saas-dev-build.ts --resume`);
      process.exit(0);
    }
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
