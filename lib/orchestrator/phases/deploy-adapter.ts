// lib/orchestrator/phases/deploy-adapter.ts
// Phase 5: deploy
//
// Generates PostHog analytics injection metadata for every page in the spec
// that has events declared. Each page is one work unit. Per orchestrator
// scoping rules, this adapter does NOT auto-edit client/src/pages/* — it
// writes injection blueprints to .planning/output/analytics/<page>.json so
// the user can paste the import/hook/capture blocks into the matching page
// component.
//
// Verifies VITE_POSTHOG_API_KEY exists in the project's .env at prepare time.
// Without it, the PostHog provider would no-op at runtime — that's a
// misconfiguration we want to flag before generating anything.

import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import {
  pipelinePages,
  type ProjectConfig,
} from "../../../shared/design-schema.js";
import type { SpecOutput, PageSpecFull } from "@shared/spec-schema.js";
import type { PhaseImplementation, PageWorkUnit } from "../phase-runner.js";
import { getOrchestratorDb } from "../db.js";
import { generateAnalyticsInjections } from "../../analytics-delivery/analytics-injector.js";

interface DeployRunInput {
  page: PageSpecFull;
  outputDir: string;
}

async function loadLatestSpec(projectId: string): Promise<SpecOutput> {
  const db = getOrchestratorDb();
  const rows = await db
    .select()
    .from(pipelinePages)
    .where(
      and(
        eq(pipelinePages.projectId, projectId),
        eq(pipelinePages.phase, "spec"),
        eq(pipelinePages.status, "complete"),
      ),
    )
    .limit(1);
  if (rows.length === 0 || !rows[0].output) {
    throw new Error(
      `Phase "deploy": no completed spec output found for projectId=${projectId}.`,
    );
  }
  return JSON.parse(rows[0].output) as SpecOutput;
}

function checkPostHogEnv(projectRoot: string): void {
  // Check process.env first (set by the wrapping shell)
  if (process.env.VITE_POSTHOG_API_KEY) return;

  // Fall back to parsing the project's .env file
  const envPath = path.join(projectRoot, ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    if (/^\s*VITE_POSTHOG_API_KEY\s*=\s*\S+/m.test(content)) return;
  }

  throw new Error(
    `Phase "deploy": VITE_POSTHOG_API_KEY is not set. ` +
      `Add it to your .env or shell environment before running the deploy phase.`,
  );
}

export const deployPhaseImplementation: PhaseImplementation = {
  async prepare(config: ProjectConfig): Promise<PageWorkUnit[]> {
    const projectRoot = path.resolve(config.repoPath);
    checkPostHogEnv(projectRoot);

    const spec = await loadLatestSpec(config.projectId);

    const outputDir = path.join(projectRoot, config.outputPath, "analytics");
    fs.mkdirSync(outputDir, { recursive: true });

    // Only pages with at least one event need injection metadata.
    const work: PageWorkUnit[] = [];
    spec.pages.forEach((page, idx) => {
      if (page.events && page.events.length > 0) {
        work.push({
          pageName: page.name,
          pageIndex: idx,
          input: { page, outputDir } satisfies DeployRunInput,
        });
      }
    });

    if (work.length === 0) {
      throw new Error(
        `Phase "deploy": no pages have analytics events declared in the spec. ` +
          `Nothing to inject.`,
      );
    }

    return work;
  },

  async runPage(rawInput: unknown, config: ProjectConfig): Promise<unknown> {
    const input = rawInput as DeployRunInput;
    const { page, outputDir } = input;

    // The lib helper expects PageEventSpec[] with a stable shape.
    const events = page.events.map((e) => ({
      name: e.name,
      trigger: e.trigger,
      properties: e.properties ?? [],
    }));

    // filePath is the page's expected location after integration. Used by
    // the user to know where to paste the injection blocks.
    const expectedPagePath = path.join(
      config.clientSrcPath,
      "pages",
      `${page.name.toLowerCase()}-page.tsx`,
    );

    const injections = generateAnalyticsInjections([
      { name: page.name, filePath: expectedPagePath, events },
    ]);

    if (injections.length === 0) {
      return {
        pageName: page.name,
        eventsInjected: 0,
        note: "All declared events filtered out (no load triggers and no manual captures).",
      };
    }

    const injection = injections[0];
    const blueprintFile = path.join(
      outputDir,
      `${page.name.toLowerCase()}.injection.json`,
    );
    fs.writeFileSync(blueprintFile, JSON.stringify(injection, null, 2), "utf-8");

    return {
      pageName: page.name,
      pageFilePath: expectedPagePath,
      blueprintFile,
      loadEvents: injection.captureCode ? injection.captureCode.split("\n").length : 0,
      manualCaptures: injection.manualCaptures.length,
      events: injection.events,
      note: "Generated as a review artifact. Paste importCode + hookCode + captureCode into the page component, and wire manualCaptures into their event handlers.",
    };
  },
};
