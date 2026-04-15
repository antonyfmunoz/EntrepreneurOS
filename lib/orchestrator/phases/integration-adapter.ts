// lib/orchestrator/phases/integration-adapter.ts
// Phase 3: integration
//
// React-gen now writes .tsx files directly to client/src/pages/. The
// integration phase verifies each page file exists, injects routes into
// App.tsx, injects nav items into sidebar.tsx, and ensures any shadcn
// components used in the generated pages are installed.
//
// The old Stitch HTML→TSX translation pipeline has been removed. React-gen
// output is the source of truth — this phase wires it into the running app.

import fs from "node:fs";
import path from "node:path";
import { and, asc, eq } from "drizzle-orm";
import {
  pipelinePages,
  type ProjectConfig,
} from "../../../shared/design-schema.js";
import type { SpecOutput, PageSpecFull } from "@shared/spec-schema.js";
import type { PhaseImplementation, PageWorkUnit } from "../phase-runner.js";
import { getOrchestratorDb } from "../db.js";
import { auditBrownfield } from "../../code-integrator/brownfield-audit.js";
import {
  writePage,
  ensureShadcnComponents,
  toKebabCase,
  checkFileConflict,
} from "../../code-integrator/page-writer.js";
import { injectRoute } from "../../code-integrator/route-injector.js";
import { injectNavItem } from "../../code-integrator/nav-injector.js";
import {
  planBrownfieldIntegration,
  renderIntegrationPlanMarkdown,
  type IntegrationMode,
  type IntegrationPlanEntry,
} from "../../code-integrator/brownfield-planner.js";
import {
  buildSharedComponents,
  SHARED_LAYOUT_COMPONENTS,
} from "../../code-integrator/shared-components-builder.js";
import { loadBrandVoice } from "../../spec-parser/brand-voice-inferrer.js";

/** Matches the actual react-gen phase output stored in pipeline_pages.output. */
interface ReactGenOutput {
  filePath: string;
  componentCode: string;
  reviewScore: number;
  reviewFeedback: string[];
  passed: boolean;
  retried: boolean;
}

interface IntegrationRunInput {
  page: PageSpecFull;
  reactGenOutput: ReactGenOutput;
  installedComponents: string[];
  projectRoot: string;
  appTsxPath: string;
  sidebarPath: string;
  planEntry: IntegrationPlanEntry;
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
      `Phase "integration": no completed spec output found for projectId=${projectId}.`,
    );
  }
  return JSON.parse(rows[0].output) as SpecOutput;
}

async function loadReactGenOutputs(
  projectId: string,
): Promise<{ pageIndex: number; pageName: string; output: ReactGenOutput }[]> {
  const db = getOrchestratorDb();
  const rows = await db
    .select()
    .from(pipelinePages)
    .where(
      and(
        eq(pipelinePages.projectId, projectId),
        eq(pipelinePages.phase, "react-gen"),
        eq(pipelinePages.status, "complete"),
      ),
    )
    .orderBy(asc(pipelinePages.pageIndex));
  return rows
    .filter((r) => r.output)
    .map((r) => ({
      pageIndex: r.pageIndex,
      pageName: r.pageName,
      output: JSON.parse(r.output!) as ReactGenOutput,
    }));
}

/**
 * Resolve a react-gen row to its spec page by **pageName**, not pageIndex.
 *
 * Name-based matching is stable across spec edits. Returns the page's
 * **current** index in the spec so downstream code can surface a consistent
 * ordering to the integration planner and the phase-runner.
 *
 * Returns `null` if the row references a page that no longer exists in the
 * spec (e.g. a page was removed).
 */
export function resolveRowToSpecPage(
  row: { pageIndex: number; pageName: string },
  spec: SpecOutput,
): { page: PageSpecFull; currentSpecIndex: number } | null {
  const currentSpecIndex = spec.pages.findIndex((p) => p.name === row.pageName);
  if (currentSpecIndex === -1) return null;
  return { page: spec.pages[currentSpecIndex], currentSpecIndex };
}

// Best-effort remixicon class selection from a page name.
function selectIconClass(pageName: string): string {
  const lc = pageName.toLowerCase();
  if (/dashboard|home/.test(lc)) return "ri-dashboard-line";
  if (/report/.test(lc)) return "ri-file-chart-line";
  if (/analytic|chart|metric/.test(lc)) return "ri-line-chart-line";
  if (/setting/.test(lc)) return "ri-settings-3-line";
  if (/user|team|member/.test(lc)) return "ri-user-line";
  if (/billing|payment/.test(lc)) return "ri-bank-card-line";
  if (/document|file/.test(lc)) return "ri-file-list-3-line";
  if (/message|chat|inbox/.test(lc)) return "ri-chat-3-line";
  if (/calendar|schedule/.test(lc)) return "ri-calendar-line";
  if (/task/.test(lc)) return "ri-task-line";
  return "ri-layout-line";
}

/**
 * Load per-page integration mode overrides from
 * `<outputPath>/integration/OVERRIDES.json`.
 */
function loadIntegrationOverrides(
  projectRoot: string,
  outputPath: string,
): Record<string, IntegrationMode> {
  const overridesPath = path.join(
    projectRoot,
    outputPath,
    "integration",
    "OVERRIDES.json",
  );
  if (!fs.existsSync(overridesPath)) return {};

  const raw = fs.readFileSync(overridesPath, "utf-8").trim();
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Phase "integration": OVERRIDES.json is not valid JSON. ` +
        `Fix ${overridesPath} and re-run. (${(err as Error).message})`,
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `Phase "integration": OVERRIDES.json must be an object mapping ` +
        `pageName → integration mode. Got ${typeof parsed} in ${overridesPath}.`,
    );
  }

  const validModes: ReadonlySet<IntegrationMode> = new Set<IntegrationMode>([
    "create",
    "replace",
    "merge",
    "supplement",
    "skip",
  ]);
  const out: Record<string, IntegrationMode> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string" || !validModes.has(value as IntegrationMode)) {
      throw new Error(
        `Phase "integration": OVERRIDES.json has invalid mode "${String(value)}" ` +
          `for "${key}". Must be one of: create, replace, merge, supplement, skip.`,
      );
    }
    out[key] = value as IntegrationMode;
  }
  return out;
}

// ─── Preview helpers (Phase C) ───────────────────────────────────────────────

async function buildIntegrationPreview(config: ProjectConfig): Promise<string> {
  const projectRoot = path.resolve(config.repoPath);
  const spec = await loadLatestSpec(config.projectId);
  const reactGenRows = await loadReactGenOutputs(config.projectId);
  if (reactGenRows.length === 0) {
    return "(no completed react-gen pages — preview unavailable)";
  }

  const inventory = await auditBrownfield(projectRoot);
  const pagesDir = path.join(projectRoot, config.clientSrcPath, "pages");
  const pageSources: Record<string, string> = {};
  for (const ep of inventory.existingPages) {
    try {
      pageSources[ep.fileName] = fs.readFileSync(path.join(pagesDir, ep.fileName), "utf-8");
    } catch {
      // best-effort
    }
  }

  const onlySpecPagesWithReactGen = reactGenRows
    .map((row) => resolveRowToSpecPage(row, spec)?.page)
    .filter((p): p is PageSpecFull => Boolean(p));

  const overrides = loadIntegrationOverrides(projectRoot, config.outputPath);

  const plan = planBrownfieldIntegration({
    specPages: onlySpecPagesWithReactGen,
    inventory,
    pageSources,
    overrides,
  });

  return renderIntegrationPlanMarkdown(plan);
}

// ─── Extract shadcn imports from TSX source ─────────────────────────────────

function extractShadcnImports(tsxContent: string): string[] {
  const importRegex = /@\/components\/ui\/([\w-]+)/g;
  const extracted = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = importRegex.exec(tsxContent)) !== null) extracted.add(m[1]);
  return Array.from(extracted);
}

export const integrationPhaseImplementation: PhaseImplementation = {
  async previewForApproval(config: ProjectConfig): Promise<string> {
    return buildIntegrationPreview(config);
  },

  async prepare(config: ProjectConfig, runId?: number): Promise<PageWorkUnit[]> {
    const projectRoot = path.resolve(config.repoPath);
    const spec = await loadLatestSpec(config.projectId);
    const reactGenRows = await loadReactGenOutputs(config.projectId);

    if (reactGenRows.length === 0) {
      throw new Error(
        `Phase "integration": no completed react-gen pages for projectId=${config.projectId}. ` +
          `Run the react-gen phase first.`,
      );
    }

    // Snapshot the current state of client/src once.
    const inventory = await auditBrownfield(projectRoot);
    const installed = [...inventory.installedShadcnComponents];

    const appTsxPath = path.join(projectRoot, config.clientSrcPath, "App.tsx");
    const sidebarPath = path.join(
      projectRoot,
      config.clientSrcPath,
      "components",
      "sidebar.tsx",
    );

    // Read existing page sources for the brownfield planner.
    const pagesDir = path.join(projectRoot, config.clientSrcPath, "pages");
    const pageSources: Record<string, string> = {};
    for (const ep of inventory.existingPages) {
      try {
        pageSources[ep.fileName] = fs.readFileSync(
          path.join(pagesDir, ep.fileName),
          "utf-8",
        );
      } catch {
        // Best-effort; non-fatal.
      }
    }

    // Resolve each react-gen row to its current spec page by NAME.
    const resolvedRows: Array<{
      row: (typeof reactGenRows)[number];
      page: PageSpecFull;
      currentSpecIndex: number;
    }> = [];
    for (const row of reactGenRows) {
      const match = resolveRowToSpecPage(row, spec);
      if (!match) {
        console.warn(
          `[integration] react-gen row "${row.pageName}" (stored pageIndex=${row.pageIndex}) ` +
            `no longer exists in the spec — skipping.`,
        );
        continue;
      }
      resolvedRows.push({ row, page: match.page, currentSpecIndex: match.currentSpecIndex });
    }

    const onlySpecPagesWithReactGen = resolvedRows.map((r) => r.page);
    const overrides = loadIntegrationOverrides(projectRoot, config.outputPath);

    const plan = planBrownfieldIntegration({
      specPages: onlySpecPagesWithReactGen,
      inventory,
      pageSources,
      overrides,
    });

    // Write PLAN.md
    const planDir = path.join(projectRoot, config.outputPath, "integration");
    fs.mkdirSync(planDir, { recursive: true });
    const planFile = path.join(planDir, "PLAN.md");
    fs.writeFileSync(planFile, renderIntegrationPlanMarkdown(plan), "utf-8");

    // Block on entries that need human merge review.
    const blockers = plan.entries.filter((e) => e.needsReview);
    if (blockers.length > 0) {
      const list = blockers
        .map((b) => `  - ${b.pageName} (${b.route}): ${b.rationale}`)
        .join("\n");
      throw new Error(
        `Phase "integration": ${blockers.length} page(s) need human merge ` +
          `review before integration can proceed. See ${planFile}\n${list}`,
      );
    }

    // Build shared layout components first (blocking).
    const designSystemPath = path.resolve(projectRoot, config.designSystemPath);
    const designSystem = fs.existsSync(designSystemPath)
      ? fs.readFileSync(designSystemPath, "utf-8")
      : "(design system file missing — sub-agents will use defaults)";
    const planningDir = path.resolve(projectRoot, ".planning");
    const brandVoice = loadBrandVoice(planningDir);

    await buildSharedComponents({
      projectRoot,
      clientSrcPath: config.clientSrcPath,
      designSystem,
      brandVoice,
    });

    // Which pages are already complete in this run?
    const completePageIndexes = new Set<number>();
    if (runId !== undefined) {
      const db = getOrchestratorDb();
      const existingRows = await db
        .select()
        .from(pipelinePages)
        .where(
          and(
            eq(pipelinePages.runId, runId),
            eq(pipelinePages.phase, "integration"),
            eq(pipelinePages.status, "complete"),
          ),
        );
      for (const r of existingRows) completePageIndexes.add(r.pageIndex);
    }

    const planByName = new Map(plan.entries.map((e) => [e.pageName, e]));

    // Build work units. React-gen already wrote the .tsx files — integration
    // just needs to verify they exist and wire routes/nav/shadcn.
    const workUnits: PageWorkUnit[] = [];
    for (const { row, page, currentSpecIndex } of resolvedRows) {
      const planEntry = planByName.get(page.name);
      if (!planEntry) continue;

      workUnits.push({
        pageName: page.name,
        pageIndex: currentSpecIndex,
        input: {
          page,
          reactGenOutput: row.output,
          installedComponents: installed,
          projectRoot,
          appTsxPath,
          sidebarPath,
          planEntry,
        } satisfies IntegrationRunInput,
      });
    }

    return workUnits;
  },

  async runPage(rawInput: unknown, _config: ProjectConfig): Promise<unknown> {
    const input = rawInput as IntegrationRunInput;
    const { page, reactGenOutput, installedComponents, projectRoot, appTsxPath, sidebarPath, planEntry } = input;

    if (planEntry.mode === "skip") {
      return {
        pageFile: planEntry.existingFile,
        mode: "skip",
        rationale: planEntry.rationale,
      };
    }

    if (planEntry.mode === "merge") {
      throw new Error(
        `integration: page "${page.name}" is mode=merge and requires human review`,
      );
    }

    // Verify the react-gen output file exists on disk.
    const expectedPath = reactGenOutput.filePath;
    if (!fs.existsSync(expectedPath)) {
      // Try the conventional path as fallback.
      const kebab = toKebabCase(page.name);
      const conventionalPath = path.join(projectRoot, "client", "src", "pages", `${kebab}-page.tsx`);
      if (!fs.existsSync(conventionalPath)) {
        throw new Error(
          `integration: page file for "${page.name}" not found at ${expectedPath} or ${conventionalPath}. ` +
            `React-gen may have failed for this page.`,
        );
      }
    }

    // Read the generated TSX to extract shadcn imports.
    const pageFilePath = fs.existsSync(expectedPath)
      ? expectedPath
      : path.join(projectRoot, "client", "src", "pages", `${toKebabCase(page.name)}-page.tsx`);
    const tsxContent = fs.readFileSync(pageFilePath, "utf-8");
    const extractedImports = extractShadcnImports(tsxContent);

    // For create mode, surface a hard error if the target file already exists
    // and the planner thought it didn't.
    const overwrite = planEntry.mode === "replace";
    if (planEntry.mode === "create") {
      const conflict = await checkFileConflict({ projectRoot, pageName: page.name });
      // The file WILL exist since react-gen wrote it. Only error if a DIFFERENT
      // file (not the react-gen output) was there before.
      if (conflict.exists && conflict.existingPath !== pageFilePath) {
        throw new Error(
          `integration: planner said create for "${page.name}" but ` +
            `${conflict.existingPath} already exists. Stale inventory? Re-run ` +
            `the integration phase or change the spec page name.`,
        );
      }
    }

    // Install missing shadcn components
    const installed = await ensureShadcnComponents({
      projectRoot,
      extractedImports,
      installedComponents,
    });

    // Inject route (idempotent)
    const componentName = page.name;
    const importPath = `@/pages/${toKebabCase(page.name)}-page`;
    const isStandalone = page.authLevel === "public";
    const routeResult = await injectRoute({
      appTsxPath,
      componentName,
      importPath,
      routePath: page.route,
      wrapCompanyGate: !isStandalone,
      isStandalone,
      pageFilePath,
    });

    // Inject nav item (only for authenticated, non-standalone pages)
    let navInjected = false;
    if (!isStandalone) {
      await injectNavItem({
        sidebarPath,
        label: page.name,
        href: page.route,
        iconClass: selectIconClass(page.name),
      });
      navInjected = true;
    }

    return {
      pageFile: pageFilePath,
      mode: planEntry.mode,
      replacedFile: overwrite ? planEntry.existingFile : null,
      componentName: routeResult.componentName,
      renamedToAvoidCollision: routeResult.renamed,
      routeInjected: true,
      navInjected,
      installedShadcn: installed,
      reactGenScore: reactGenOutput.reviewScore,
      reactGenPassed: reactGenOutput.passed,
    };
  },
};
