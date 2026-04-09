// lib/orchestrator/phases/deploy-adapter.ts
// Phase 5: deploy
//
// Generates PostHog analytics injection metadata AND injects it directly into
// the matching page component at client/src/pages/{kebab(pageName)}-page.tsx.
//
// Injection is idempotent:
//   - importCode is inserted after the last existing import line, skipped if
//     `posthog-js` is already imported.
//   - hookCode is inserted at the top of the component function body, skipped
//     if `usePostHog()` is already present.
//   - captureCode is placed between the sentinel markers
//     `// __POSTHOG_CAPTURES__` and `// __POSTHOG_CAPTURES_END__`. Subsequent
//     runs replace the content between markers.
//
// A review blueprint is still written to
// .planning/output/analytics/<page>.injection.json so manualCaptures can be
// wired into their event handlers by hand.
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
import { toKebabCase } from "../../code-integrator/page-writer.js";

const CAPTURE_START = "// __POSTHOG_CAPTURES__";
const CAPTURE_END = "// __POSTHOG_CAPTURES_END__";

function resolvePageFilePath(projectRoot: string, pageName: string): string {
  const kebab = toKebabCase(pageName);
  const fileName = kebab.endsWith("-page") ? `${kebab}.tsx` : `${kebab}-page.tsx`;
  return path.join(projectRoot, "client", "src", "pages", fileName);
}

// Bug 4: Inject an import after the LAST import statement, respecting
// multi-line import blocks. Previously we split on newline and inserted after
// the `import` keyword line — which corrupted blocks like:
//   import {
//     Foo,
//     Bar,
//   } from "lucide-react";
// by wedging the new import between `import {` and its members.
//
// The fix walks lines forward, and for each `^\s*import\s` line advances
// until the statement actually ends (closing `"...";` after balanced braces),
// then remembers the *end* of that statement as the insertion point.
export function injectImport(source: string, importCode: string): string {
  if (source.includes("posthog-js")) return source;
  const lines = source.split("\n");
  let lastImportEndIdx = -1;

  let i = 0;
  while (i < lines.length) {
    if (/^\s*import\s/.test(lines[i])) {
      // Walk forward until the statement terminates with a line ending in `;`
      // that is outside any open brace group. Most imports are single-line,
      // but `import { a, b, c } from "x";` can be split across many lines.
      let j = i;
      let braceDepth = 0;
      while (j < lines.length) {
        const ln = lines[j];
        for (const ch of ln) {
          if (ch === "{") braceDepth++;
          else if (ch === "}") braceDepth--;
        }
        if (braceDepth <= 0 && /;\s*$/.test(ln)) {
          break;
        }
        j++;
      }
      lastImportEndIdx = j;
      i = j + 1;
      continue;
    }
    i++;
  }

  if (lastImportEndIdx === -1) {
    return `${importCode}\n${source}`;
  }
  lines.splice(lastImportEndIdx + 1, 0, importCode);
  return lines.join("\n");
}

function injectHook(source: string, hookCode: string): string {
  if (source.includes("usePostHog()")) return source;
  const lines = source.split("\n");
  // Find first `export default function Name(...) {` or `function Name(...) {`
  const fnRegex = /^(\s*)(export\s+default\s+function|export\s+function|function)\s+\w+\s*\([^)]*\)\s*(:\s*[^{]+)?\s*\{/;
  for (let i = 0; i < lines.length; i++) {
    if (fnRegex.test(lines[i])) {
      const indentMatch = lines[i].match(/^(\s*)/);
      const indent = (indentMatch ? indentMatch[1] : "") + "  ";
      lines.splice(i + 1, 0, `${indent}${hookCode}`);
      return lines.join("\n");
    }
  }
  throw new Error(
    `deploy-adapter: could not locate component function body to inject PostHog hook.`,
  );
}

function injectCaptures(source: string, captureCode: string): string {
  if (!captureCode) return source;
  const startIdx = source.indexOf(CAPTURE_START);
  const endIdx = source.indexOf(CAPTURE_END);

  const block = [CAPTURE_START, captureCode, CAPTURE_END].join("\n");

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Replace existing block
    return (
      source.slice(0, startIdx) +
      block +
      source.slice(endIdx + CAPTURE_END.length)
    );
  }

  // First injection: place right after the hookCode / at top of function body.
  const lines = source.split("\n");
  const hookIdx = lines.findIndex((l) => l.includes("usePostHog()"));
  if (hookIdx === -1) {
    throw new Error(
      `deploy-adapter: could not locate usePostHog() hook for capture injection.`,
    );
  }
  const indentMatch = lines[hookIdx].match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1] : "  ";
  const indentedBlock = block
    .split("\n")
    .map((l) => (l.length ? indent + l : l))
    .join("\n");
  lines.splice(hookIdx + 1, 0, indentedBlock);
  return lines.join("\n");
}

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

    const projectRoot = path.resolve(config.repoPath);
    const expectedPagePath = resolvePageFilePath(projectRoot, page.name);

    if (!fs.existsSync(expectedPagePath)) {
      throw new Error(
        `Phase "deploy": page file not found for "${page.name}". ` +
          `Expected at: ${expectedPagePath}. ` +
          `Run the code-integration phase first so the page component exists.`,
      );
    }

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

    // Inject into real page file (idempotent).
    let source = fs.readFileSync(expectedPagePath, "utf-8");
    source = injectImport(source, injection.importCode);
    source = injectHook(source, injection.hookCode);
    source = injectCaptures(source, injection.captureCode);
    fs.writeFileSync(expectedPagePath, source, "utf-8");

    // Also emit the review blueprint so manualCaptures can be wired by hand.
    const blueprintFile = path.join(
      outputDir,
      `${toKebabCase(page.name)}.injection.json`,
    );
    fs.writeFileSync(blueprintFile, JSON.stringify(injection, null, 2), "utf-8");

    return {
      pageName: page.name,
      pageFilePath: expectedPagePath,
      blueprintFile,
      loadEvents: injection.captureCode ? injection.captureCode.split("\n").length : 0,
      manualCaptures: injection.manualCaptures.length,
      events: injection.events,
      note: "Injected importCode + hookCode + captureCode directly into the page file. Wire manualCaptures into their event handlers by hand using the blueprint.",
    };
  },
};
