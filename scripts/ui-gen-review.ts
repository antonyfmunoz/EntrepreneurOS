/**
 * UI-Gen Review — reads a .pending.json queue file, shows review block,
 * waits for stdin decision (y/f/n/s), records to DB, exits.
 *
 * Usage: npx tsx scripts/ui-gen-review.ts [pageName]
 *   If pageName omitted, reads the most recent .pending.json in the queue dir.
 *
 * Starts a local preview server automatically, shuts it down after decision.
 */

import "dotenv/config";
process.env.USE_NEON_HTTP = "1";

import path from "node:path";
import fs from "node:fs";
import readline from "node:readline";
import { getOrchestratorDb, updatePage } from "../lib/orchestrator/db.js";
import { pipelinePages } from "../shared/design-schema.js";
import { and, eq } from "drizzle-orm";
import { startPreviewServerFromFile } from "../lib/ui-generator/preview-server.js";
import { printPageReview } from "../lib/ui-generator/terminal-links.js";
import { attemptFigmaExport } from "../lib/stitch/client.js";

const RUN_ID = 8;
const QUEUE_DIR = path.resolve(process.cwd(), ".planning/output/ui-gen-queue");
const STITCH_PROJECT_ID = process.env.STITCH_PROJECT_ID || "15245812195263033351";

interface QueueEntry {
  pageName: string;
  pageIndex: number;
  pageRowId: number;
  output: {
    htmlUrl?: string;
    screenshotUrl?: string;
    scoreSummary?: string;
    approved?: boolean;
    localHtmlPath?: string;
  };
  generatedAt: string;
}

function findQueueFile(pageName?: string): string | null {
  if (!fs.existsSync(QUEUE_DIR)) return null;

  if (pageName) {
    const file = path.resolve(QUEUE_DIR, `${pageName}.pending.json`);
    return fs.existsSync(file) ? file : null;
  }

  // Find most recent .pending.json
  const files = fs
    .readdirSync(QUEUE_DIR)
    .filter((f) => f.endsWith(".pending.json"))
    .map((f) => ({
      name: f,
      path: path.resolve(QUEUE_DIR, f),
      mtime: fs.statSync(path.resolve(QUEUE_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? files[0].path : null;
}

function promptStdin(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const explicitPage = process.argv[2];
  const queueFile = findQueueFile(explicitPage);

  if (!queueFile) {
    console.log("No pending pages to review. Run ui-gen-runner.ts first.");
    process.exit(0);
  }

  const entry: QueueEntry = JSON.parse(fs.readFileSync(queueFile, "utf-8"));
  const { pageName, pageIndex, pageRowId, output } = entry;

  // Start local preview server
  let preview = output.localHtmlPath
    ? await startPreviewServerFromFile(output.localHtmlPath)
    : null;

  // Attempt Figma export silently
  const figmaUrl = await attemptFigmaExport(STITCH_PROJECT_ID).catch(() => null);

  // Print review block
  printPageReview({
    pageName,
    pageIndex,
    scoreSummary: output.scoreSummary,
    approved: output.approved,
    localUrl: preview?.localUrl,
    screenshotUrl: output.screenshotUrl,
    htmlUrl: output.htmlUrl,
    figmaUrl,
    localHtmlPath: output.localHtmlPath,
  });

  // Wait for decision
  const answer = await promptStdin("Decision (y/f/n/s): ");
  const normalized = answer.trim().toLowerCase();

  // Shut down preview server
  if (preview) await preview.shutdown();

  const db = getOrchestratorDb();

  if (normalized === "y") {
    await updatePage(pageRowId, {
      status: "complete",
      output: JSON.stringify(output),
      completedAt: new Date(),
    });
    // Remove queue file
    fs.unlinkSync(queueFile);
    console.log(`[review] ${pageName} approved.`);
  } else if (normalized === "f") {
    const feedback = await promptStdin("What should carry forward to all remaining pages? ");
    await updatePage(pageRowId, {
      status: "complete",
      output: JSON.stringify({ ...output, carryForwardFeedback: feedback.trim() }),
      completedAt: new Date(),
    });
    // Save feedback to a persistent file for the runner to pick up
    const feedbackFile = path.resolve(QUEUE_DIR, "carry-forward-feedback.txt");
    const existing = fs.existsSync(feedbackFile) ? fs.readFileSync(feedbackFile, "utf-8") : "";
    fs.writeFileSync(feedbackFile, existing + (existing ? "\n" : "") + feedback.trim());
    fs.unlinkSync(queueFile);
    console.log(`[review] ${pageName} approved with carry-forward feedback.`);
  } else if (normalized === "n") {
    const feedback = await promptStdin("Feedback for retry: ");
    // Mark as pending again so runner can regenerate
    await updatePage(pageRowId, {
      status: "pending",
      error: `Rejected: ${feedback.trim()}`,
    });
    // Write retry feedback to queue so runner can inject it
    const retryFile = path.resolve(QUEUE_DIR, `${pageName}.retry-feedback.txt`);
    fs.writeFileSync(retryFile, feedback.trim());
    fs.unlinkSync(queueFile);
    console.log(`[review] ${pageName} rejected — will retry with feedback on next run.`);
  } else if (normalized === "s") {
    await updatePage(pageRowId, {
      status: "complete",
      output: JSON.stringify({ skipped: true }),
      completedAt: new Date(),
    });
    fs.unlinkSync(queueFile);
    console.log(`[review] ${pageName} skipped.`);
  } else {
    console.log(`[review] Unknown input "${normalized}". No action taken.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Review failed:", err);
  process.exit(1);
});
