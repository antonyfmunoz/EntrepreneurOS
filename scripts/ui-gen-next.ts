/**
 * UI-Gen Next — one command, one page, full control.
 *
 * Usage: npx tsx scripts/ui-gen-next.ts
 *
 * Flow:
 *   1. Check for any .pending.json in queue → if found, go straight to review
 *   2. Otherwise, find next pending page in DB → generate via Stitch → save to queue
 *   3. Show review block with local preview server
 *   4. Wait for y/f/n/s decision
 *   5. Record decision to DB
 *   6. Exit
 *
 * User runs this repeatedly, one page at a time. No background processes.
 */

import "dotenv/config";
process.env.USE_NEON_HTTP = "1";

import path from "node:path";
import fs from "node:fs";
import readline from "node:readline";
import { and, asc, eq } from "drizzle-orm";
import { getOrchestratorDb, updatePage } from "../lib/orchestrator/db.js";
import { pipelinePages } from "../shared/design-schema.js";
import { uiGenPhaseImplementation } from "../lib/orchestrator/phases/ui-gen-adapter.js";
import { startPreviewServerFromFile } from "../lib/ui-generator/preview-server.js";
import { printPageReview } from "../lib/ui-generator/terminal-links.js";
import { attemptFigmaExport } from "../lib/stitch/client.js";
import type { ProjectConfig } from "../shared/design-schema.js";

const RUN_ID = 8;

const config: ProjectConfig = {
  projectId: "entrepreneur-os",
  repoPath: process.cwd(),
  framework: "react-vite-tailwind-shadcn",
  designSystemPath: ".planning/design-system.md",
  outputPath: ".planning/output",
  clientSrcPath: "client/src",
  serverPath: "server",
  defaultBranch: "main",
  featureBranchPrefix: "feature/",
  stitchProjectId: process.env.STITCH_PROJECT_ID || "15245812195263033351",
  clerkOrganizationsEnabled: true,
};

const QUEUE_DIR = path.resolve(config.repoPath, ".planning/output/ui-gen-queue");
const STITCH_PROJECT_ID = config.stitchProjectId!;

interface QueueEntry {
  pageName: string;
  pageIndex: number;
  pageRowId: number;
  output: Record<string, unknown>;
  generatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function promptStdin(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function findPendingQueueFile(): string | null {
  if (!fs.existsSync(QUEUE_DIR)) return null;
  const files = fs
    .readdirSync(QUEUE_DIR)
    .filter((f) => f.endsWith(".pending.json"));
  if (files.length === 0) return null;
  return path.resolve(QUEUE_DIR, files[0]);
}

function loadCarryForwardFeedback(): string | null {
  const file = path.resolve(QUEUE_DIR, "carry-forward-feedback.txt");
  if (!fs.existsSync(file)) return null;
  const content = fs.readFileSync(file, "utf-8").trim();
  return content || null;
}

function loadRetryFeedback(pageName: string): string | null {
  const file = path.resolve(QUEUE_DIR, `${pageName}.retry-feedback.txt`);
  if (!fs.existsSync(file)) return null;
  const content = fs.readFileSync(file, "utf-8").trim();
  // Clean up after reading
  fs.unlinkSync(file);
  return content || null;
}

// ─── Generate ─────────────────────────────────────────────────────────────────

async function generatePage(
  pageName: string,
  pageIndex: number,
  pageRowId: number,
): Promise<QueueEntry> {
  console.log(`\n[next] Generating: ${pageName} (index ${pageIndex})...\n`);

  await updatePage(pageRowId, { status: "in_progress", startedAt: new Date(), error: null });

  const workUnits = await uiGenPhaseImplementation.prepare(config);
  const unit = workUnits.find((u) => u.pageName === pageName);
  if (!unit) {
    throw new Error(`Work unit for "${pageName}" not found after prepare().`);
  }

  // Inject carry-forward feedback and retry feedback into the work unit
  const carryForward = loadCarryForwardFeedback();
  const retryFeedback = loadRetryFeedback(pageName);
  const allFeedback = [carryForward, retryFeedback].filter(Boolean).join("\n");
  if (allFeedback) {
    (unit.input as Record<string, unknown>).accumulatedFeedback = allFeedback;
  }

  const output = await uiGenPhaseImplementation.runPage(unit.input, config);

  // Save to queue
  if (!fs.existsSync(QUEUE_DIR)) {
    fs.mkdirSync(QUEUE_DIR, { recursive: true });
  }

  const entry: QueueEntry = {
    pageName,
    pageIndex,
    pageRowId,
    output: output as Record<string, unknown>,
    generatedAt: new Date().toISOString(),
  };

  const queueFile = path.resolve(QUEUE_DIR, `${pageName}.pending.json`);
  fs.writeFileSync(queueFile, JSON.stringify(entry, null, 2));

  console.log(`[next] Generated. Scores: ${(output as any).scoreSummary}`);
  return entry;
}

// ─── Review ───────────────────────────────────────────────────────────────────

async function reviewPage(entry: QueueEntry): Promise<void> {
  const { pageName, pageIndex, pageRowId, output } = entry;
  const queueFile = path.resolve(QUEUE_DIR, `${pageName}.pending.json`);

  // Start local preview
  const localHtmlPath = output.localHtmlPath as string | undefined;
  let preview = localHtmlPath
    ? await startPreviewServerFromFile(localHtmlPath)
    : null;

  // Figma export (silent)
  const figmaUrl = await attemptFigmaExport(STITCH_PROJECT_ID).catch(() => null);

  // Show review block
  printPageReview({
    pageName,
    pageIndex,
    scoreSummary: output.scoreSummary as string | undefined,
    approved: output.approved as boolean | undefined,
    localUrl: preview?.localUrl,
    screenshotUrl: output.screenshotUrl as string | undefined,
    htmlUrl: output.htmlUrl as string | undefined,
    figmaUrl,
    localHtmlPath: localHtmlPath,
  });

  // Wait for decision
  const answer = await promptStdin("Decision (y/f/n/s): ");
  const normalized = answer.trim().toLowerCase();

  // Shut down preview
  if (preview) await preview.shutdown();

  if (normalized === "y") {
    await updatePage(pageRowId, {
      status: "complete",
      output: JSON.stringify(output),
      completedAt: new Date(),
    });
    fs.unlinkSync(queueFile);
    console.log(`\n[next] ${pageName} — approved.\n`);
  } else if (normalized === "f") {
    const feedback = await promptStdin("What should carry forward to all remaining pages? ");
    await updatePage(pageRowId, {
      status: "complete",
      output: JSON.stringify(output),
      completedAt: new Date(),
    });
    // Append to persistent carry-forward file
    const feedbackFile = path.resolve(QUEUE_DIR, "carry-forward-feedback.txt");
    const existing = fs.existsSync(feedbackFile) ? fs.readFileSync(feedbackFile, "utf-8") : "";
    fs.writeFileSync(feedbackFile, existing + (existing ? "\n" : "") + feedback.trim());
    fs.unlinkSync(queueFile);
    console.log(`\n[next] ${pageName} — approved with carry-forward feedback.\n`);
  } else if (normalized === "n") {
    const feedback = await promptStdin("Feedback for retry: ");
    await updatePage(pageRowId, {
      status: "pending",
      error: null,
    });
    // Write retry feedback for next generation
    const retryFile = path.resolve(QUEUE_DIR, `${pageName}.retry-feedback.txt`);
    fs.writeFileSync(retryFile, feedback.trim());
    fs.unlinkSync(queueFile);
    console.log(`\n[next] ${pageName} — rejected. Run again to retry with feedback.\n`);
  } else if (normalized === "s") {
    await updatePage(pageRowId, {
      status: "complete",
      output: JSON.stringify({ skipped: true }),
      completedAt: new Date(),
    });
    fs.unlinkSync(queueFile);
    console.log(`\n[next] ${pageName} — skipped.\n`);
  } else {
    console.log(`\n[next] Unknown input "${normalized}". No action taken.\n`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Check for existing pending queue file
  const existingQueue = findPendingQueueFile();
  if (existingQueue) {
    const entry: QueueEntry = JSON.parse(fs.readFileSync(existingQueue, "utf-8"));
    console.log(`\n[next] Found pending review: ${entry.pageName}`);
    await reviewPage(entry);
    process.exit(0);
  }

  // 2. Find next pending page in DB
  const db = getOrchestratorDb();
  const allPages = await db
    .select()
    .from(pipelinePages)
    .where(
      and(
        eq(pipelinePages.runId, RUN_ID),
        eq(pipelinePages.phase, "ui-gen"),
      ),
    )
    .orderBy(asc(pipelinePages.pageIndex));

  const nextPage = allPages.find((r) => r.status === "pending" || r.status === "in_progress");
  if (!nextPage) {
    // Show summary
    const complete = allPages.filter((r) => r.status === "complete").length;
    console.log(`\n[next] All ${complete}/${allPages.length} ui-gen pages complete. Nothing to do.\n`);

    // Show status
    for (const p of allPages) {
      const marker = p.status === "complete" ? "✓" : p.status === "failed" ? "✗" : "·";
      console.log(`  ${marker} ${p.pageName}`);
    }
    console.log();
    process.exit(0);
  }

  // 3. Generate the page
  const entry = await generatePage(nextPage.pageName, nextPage.pageIndex, nextPage.id);

  // 4. Review inline
  await reviewPage(entry);

  process.exit(0);
}

main().catch((err) => {
  console.error("ui-gen-next failed:", err);
  process.exit(1);
});
