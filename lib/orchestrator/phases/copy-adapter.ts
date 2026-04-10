// lib/orchestrator/phases/copy-adapter.ts
// Phase: copy
//
// Generates and reviews all UI copy before Stitch runs. Copy is a planning
// artifact — written, reviewed, approved, then injected into Stitch prompts
// as the single source of truth for visible text.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { and, desc, eq } from "drizzle-orm";
import { pipelinePages, pipelineRuns, type ProjectConfig } from "../../../shared/design-schema.js";
import type { SpecOutput } from "@shared/spec-schema.js";
import type { PhaseImplementation, PageWorkUnit, PageCompleteContext, PageDecision } from "../phase-runner.js";
import { getOrchestratorDb } from "../db.js";
import { generateProjectCopy } from "../../copy-planner/copy-writer.js";
import { reviewProjectCopy } from "../../copy-planner/copy-reviewer.js";
import { loadBrandVoice } from "../../spec-parser/brand-voice-inferrer.js";
import { loadBriefFromConfig } from "../../intake/intake-orchestrator.js";
import type { ProjectBrief } from "../../intake/types.js";
import type { ProjectCopy } from "../../copy-planner/types.js";

interface CopyRunInput {
  spec: SpecOutput;
  brandVoice: string;
  projectBrief: ProjectBrief;
}

async function loadSpecFromBrief(config: ProjectConfig): Promise<{ spec: SpecOutput; brief: ProjectBrief; brandVoice: string }> {
  const db = getOrchestratorDb();

  // Try loading brief from pipeline_runs.config first
  const runs = await db
    .select()
    .from(pipelineRuns)
    .where(eq(pipelineRuns.projectId, config.projectId))
    .orderBy(desc(pipelineRuns.startedAt))
    .limit(1);

  let brief: ProjectBrief | null = null;
  if (runs.length > 0 && runs[0].config) {
    brief = loadBriefFromConfig(runs[0].config);
  }

  // Fall back to spec from pipeline_pages
  let spec: SpecOutput;
  if (brief) {
    spec = brief.spec;
  } else {
    const specRows = await db
      .select()
      .from(pipelinePages)
      .where(
        and(
          eq(pipelinePages.projectId, config.projectId),
          eq(pipelinePages.phase, "spec"),
          eq(pipelinePages.status, "complete"),
        ),
      )
      .orderBy(desc(pipelinePages.completedAt))
      .limit(1);

    if (specRows.length === 0 || !specRows[0].output) {
      throw new Error(
        `Phase "copy": no completed spec found for projectId=${config.projectId}. Run the spec phase first.`,
      );
    }
    spec = JSON.parse(specRows[0].output) as SpecOutput;
  }

  // Load brand voice from file
  const planningDir = path.resolve(config.repoPath, ".planning");
  const brandVoice = loadBrandVoice(planningDir) ?? "";

  if (!brandVoice) {
    console.warn("[copy] No BRAND-VOICE.md found. Copy will be generated without brand voice guidance.");
  }

  // Build a minimal brief if not available from DB
  if (!brief) {
    brief = {
      productName: "Project",
      productDescription: "",
      productVision: "",
      targetUsers: [],
      jobsToBeDone: [],
      brandVoice,
      designSystem: "",
      techStack: { frontend: "react", buildTool: "vite", styling: "tailwind", componentLib: "shadcn/ui", language: "typescript" },
      authProvider: "firebase",
      dbProvider: "neon",
      deployTarget: "vps",
      spec,
      isGreenfield: false,
      existingCodeScanned: false,
      sourceDocs: [],
    };
  }

  return { spec, brief, brandVoice };
}

export const copyPhaseImplementation: PhaseImplementation = {
  async prepare(config: ProjectConfig): Promise<PageWorkUnit[]> {
    const { spec, brief, brandVoice } = await loadSpecFromBrief(config);
    return [
      {
        pageName: "project-copy",
        pageIndex: 0,
        input: { spec, brandVoice, projectBrief: brief } satisfies CopyRunInput,
      },
    ];
  },

  async runPage(rawInput: unknown, config: ProjectConfig): Promise<unknown> {
    const input = rawInput as CopyRunInput;
    const { spec, brandVoice, projectBrief } = input;

    console.log(`[copy] Generating copy for ${spec.pages.length} pages...`);
    const draft = await generateProjectCopy(spec, brandVoice, projectBrief);
    console.log(`[copy] Draft generated. Reviewing for brand compliance...`);

    const review = await reviewProjectCopy(draft, brandVoice);
    console.log(`[copy] Review score: ${review.overallScore.toFixed(2)} | passed: ${review.passed}`);
    for (const pr of review.pageResults) {
      const issues = pr.issues.length > 0 ? ` — ${pr.issues.join("; ")}` : "";
      console.log(`  ${pr.pageName}: ${pr.score.toFixed(2)}${issues}`);
    }

    // Always use revised copy — it's polished even when the draft passed
    const finalCopy = review.revisedCopy;

    // Persist to .planning/output/copy/
    const outputDir = path.resolve(config.repoPath, ".planning", "output", "copy");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(
      path.join(outputDir, "PROJECT-COPY.json"),
      JSON.stringify(finalCopy, null, 2) + "\n",
      "utf-8",
    );
    console.log(`[copy] Saved to .planning/output/copy/PROJECT-COPY.json`);

    return finalCopy;
  },

  async onPageComplete(
    context: PageCompleteContext,
    _config: ProjectConfig,
  ): Promise<PageDecision> {
    const copy = context.output as ProjectCopy;

    for (const page of copy.pages) {
      const ctaLabels = page.ctas.map((c) => c.label).join(", ") || "(none)";
      console.log("");
      console.log("╔══════════════════════════════════════╗");
      console.log(`║  COPY READY FOR REVIEW: ${page.pageName.padEnd(12)} ║`);
      console.log("╠══════════════════════════════════════╣");
      console.log(`║  Heading: ${page.pageHeading.slice(0, 27).padEnd(27)} ║`);
      console.log(`║  CTAs: ${ctaLabels.slice(0, 30).padEnd(30)} ║`);
      console.log(`║  Empty: ${page.emptyState.slice(0, 29).padEnd(29)} ║`);
      console.log("╚══════════════════════════════════════╝");
    }

    console.log("");
    console.log(`Total pages: ${copy.pages.length}`);
    console.log("");
    console.log("  (y) Approve all copy");
    console.log("  (n) Regenerate with feedback");
    console.log("  (s) Skip copy phase");
    console.log("");

    const answer = await promptStdin("Decision (y/n/s): ");
    const normalized = answer.trim().toLowerCase();

    if (normalized === "n") {
      const feedback = await promptStdin("Feedback for regeneration: ");
      if (feedback.trim()) {
        console.log(`[copy] Will regenerate with feedback: ${feedback.trim()}`);
      }
      return "retry";
    }

    if (normalized === "s") {
      console.log("[copy] Skipping copy phase.");
      return "skip";
    }

    return "continue";
  },
};

function promptStdin(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
