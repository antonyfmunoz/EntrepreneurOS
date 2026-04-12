// lib/orchestrator/phases/spec-adapter.ts
// Phase 1: spec
//
// prepare(): locate the project's PRD/spec source file (no LLM call — read-only).
//   Search order: .planning/REQUIREMENTS.md → .planning/PRD.md → newest .planning/specs/*.md
//   Throws with all paths checked if nothing is found.
//
// runPage(): call restructureSpec() with the raw text, returning a validated SpecOutput.
//   The full SpecOutput is JSON-serialized into pipeline_pages.output by phase-runner.

import fs from "node:fs";
import path from "node:path";
import { restructureSpec } from "../../spec-parser/restructure-spec.js";
import { deriveBackendSpec } from "../../spec-parser/derive-backend-spec.js";
import { analyzeGaps, hasBlockingGaps } from "../../spec-parser/gap-analyzer.js";
import { formatGapReport } from "../../spec-parser/spec-approval.js";
import { inferBrandVoice } from "../../spec-parser/brand-voice-inferrer.js";
import { SpecOutputSchema } from "@shared/spec-schema.js";
import type { SpecOutput } from "@shared/spec-schema.js";
import type { ProjectConfig } from "../../../shared/design-schema.js";
import type { PhaseImplementation, PageWorkUnit } from "../phase-runner.js";

export class SpecBlockedByGapsError extends Error {
  constructor(
    public readonly report: string,
  ) {
    super("Spec blocked by gap analysis — resolve blocking issues before proceeding.");
    this.name = "SpecBlockedByGapsError";
  }
}

interface SpecRunInput {
  rawSpecText: string;
  sourcePath: string;
  /** When set, the spec is already validated JSON — skip LLM restructuring. */
  prevalidatedSpec?: SpecOutput;
}

/**
 * Locate the spec source. Priority:
 * 1. Pre-validated JSON spec in .planning/specs/*.json (newest first)
 * 2. PRD.md (authoritative product doc)
 * 3. REQUIREMENTS.md (legacy fallback)
 * 4. Newest .md in .planning/specs/
 */
function findSpecSource(projectRoot: string): { rawText: string; sourcePath: string; prevalidatedSpec?: SpecOutput } {
  // Check for pre-validated JSON specs first
  const specsDir = path.join(projectRoot, ".planning", "specs");
  if (fs.existsSync(specsDir)) {
    const jsonFiles = fs
      .readdirSync(specsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join(specsDir, f));
    jsonFiles.sort(
      (a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs,
    );
    for (const jsonPath of jsonFiles) {
      try {
        const raw = fs.readFileSync(jsonPath, "utf-8");
        const parsed = JSON.parse(raw);
        const result = SpecOutputSchema.safeParse(parsed);
        if (result.success) {
          return { rawText: raw, sourcePath: jsonPath, prevalidatedSpec: result.data };
        }
      } catch {
        // Invalid JSON or schema — skip to next candidate
      }
    }
  }

  // Fall back to markdown sources for LLM restructuring
  const candidates = [
    path.join(projectRoot, ".planning", "PRD.md"),
    path.join(projectRoot, ".planning", "REQUIREMENTS.md"),
  ];

  if (fs.existsSync(specsDir)) {
    const mdFiles = fs
      .readdirSync(specsDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => path.join(specsDir, f));
    mdFiles.sort(
      (a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs,
    );
    if (mdFiles.length > 0) candidates.push(mdFiles[0]);
  }

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return { rawText: fs.readFileSync(p, "utf-8"), sourcePath: p };
    }
  }

  throw new Error(
    `Phase "spec": no source file found. Looked at:\n` +
      candidates.map((p) => `  - ${p}`).join("\n") +
      `\nCreate one of these files with your product spec and re-run.`,
  );
}

export const specPhaseImplementation: PhaseImplementation = {
  async prepare(config: ProjectConfig): Promise<PageWorkUnit[]> {
    const projectRoot = path.resolve(config.repoPath);
    const { rawText, sourcePath, prevalidatedSpec } = findSpecSource(projectRoot);
    const input: SpecRunInput = { rawSpecText: rawText, sourcePath, prevalidatedSpec };
    return [
      {
        pageName: "spec",
        pageIndex: 0,
        input,
      },
    ];
  },

  async runPage(rawInput: unknown, config: ProjectConfig): Promise<SpecOutput> {
    const input = rawInput as SpecRunInput;

    // Fast path: use pre-validated JSON spec directly — skip LLM restructuring
    const spec = input.prevalidatedSpec
      ? input.prevalidatedSpec
      : await restructureSpec(input.rawSpecText);

    // If restructureSpec didn't fill in the backend layer, derive it.
    if (!spec.backendSpec || spec.backendSpec.endpoints.length === 0) {
      try {
        spec.backendSpec = await deriveBackendSpec(spec.pages);
      } catch {
        // Backend derivation is best-effort. Pages still get the rest of the spec.
      }
    }

    const projectRoot = path.resolve(config.repoPath);

    // Gap analysis — challenge the spec before locking
    const skipGaps = process.env.SKIP_GAP_ANALYSIS === "true";
    if (!skipGaps) {
      const gaps = await analyzeGaps(spec);
      const report = formatGapReport(spec, gaps);
      const outputDir = path.join(projectRoot, ".planning", "output", "spec");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(outputDir, "GAP-ANALYSIS.md"),
        report,
        "utf-8",
      );

      if (hasBlockingGaps(gaps)) {
        throw new SpecBlockedByGapsError(report);
      }
    }

    // Brand voice inference — run after spec locks, fail-open.
    // Reads the PRD source and writes .planning/BRAND-VOICE.md for downstream
    // injection into react-gen prompts.
    const planningDir = path.join(projectRoot, ".planning");
    const prdPath = path.join(planningDir, "PRD.md");
    if (fs.existsSync(prdPath)) {
      const prdText = fs.readFileSync(prdPath, "utf-8");
      await inferBrandVoice(prdText, planningDir);
    }

    return spec;
  },
};
