// lib/orchestrator/phases/integration-adapter.ts
// Phase 3: integration
//
// prepare(): pull every completed ui-gen page output for the project, fetch
//   each HTML by URL (presigned, can expire — surface 403/410 cleanly), and
//   audit the brownfield once. Read-only. The fetched HTMLs are passed in the
//   work unit input so runPage doesn't redo network work on retry.
//
// runPage(): translate HTML→TSX with shadcn, install missing components,
//   write the page file, inject the route into App.tsx, inject the nav item.
//   Returns the list of files touched.

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
import { translateHtmlToShadcn } from "../../code-integrator/html-to-shadcn.js";
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
  type IntegrationPlanEntry,
} from "../../code-integrator/brownfield-planner.js";

interface IntegrationRunInput {
  page: PageSpecFull;
  htmlContent: string;
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

interface UiGenOutput {
  htmlUrl: string;
  screenshotUrl: string;
  tokenVersion: number;
  approved: boolean;
}

async function loadUiGenOutputs(
  projectId: string,
): Promise<{ pageIndex: number; pageName: string; output: UiGenOutput }[]> {
  const db = getOrchestratorDb();
  const rows = await db
    .select()
    .from(pipelinePages)
    .where(
      and(
        eq(pipelinePages.projectId, projectId),
        eq(pipelinePages.phase, "ui-gen"),
        eq(pipelinePages.status, "complete"),
      ),
    )
    .orderBy(asc(pipelinePages.pageIndex));
  return rows
    .filter((r) => r.output)
    .map((r) => ({
      pageIndex: r.pageIndex,
      pageName: r.pageName,
      output: JSON.parse(r.output!) as UiGenOutput,
    }));
}

// Best-effort remixicon class selection from a page name. Defaults to a
// generic layout icon. Caller can override later by editing sidebar.tsx.
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

// ─── Preview helpers (Phase C) ───────────────────────────────────────────────

/**
 * Build the brownfield plan WITHOUT making any LLM calls or network fetches,
 * so the orchestrator can render it inside the approval gate before the user
 * decides whether to authorize the destructive phase.
 */
async function buildIntegrationPreview(config: ProjectConfig): Promise<string> {
  const projectRoot = path.resolve(config.repoPath);
  const spec = await loadLatestSpec(config.projectId);
  const uiGenRows = await loadUiGenOutputs(config.projectId);
  if (uiGenRows.length === 0) {
    return "(no completed ui-gen pages — preview unavailable)";
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

  const onlySpecPagesWithUiGen = uiGenRows
    .map((row) => spec.pages[row.pageIndex])
    .filter((p): p is PageSpecFull => Boolean(p));

  const plan = planBrownfieldIntegration({
    specPages: onlySpecPagesWithUiGen,
    inventory,
    pageSources,
  });

  return renderIntegrationPlanMarkdown(plan);
}

export const integrationPhaseImplementation: PhaseImplementation = {
  async previewForApproval(config: ProjectConfig): Promise<string> {
    return buildIntegrationPreview(config);
  },

  async prepare(config: ProjectConfig): Promise<PageWorkUnit[]> {
    const projectRoot = path.resolve(config.repoPath);
    const spec = await loadLatestSpec(config.projectId);
    const uiGenRows = await loadUiGenOutputs(config.projectId);

    if (uiGenRows.length === 0) {
      throw new Error(
        `Phase "integration": no completed ui-gen pages for projectId=${config.projectId}. ` +
          `Run the ui-gen phase first.`,
      );
    }

    // Snapshot the current state of client/src once. Each page-level work unit
    // gets a copy so runPage is independent of in-loop mutation.
    const inventory = await auditBrownfield(projectRoot);
    const installed = [...inventory.installedShadcnComponents];

    const appTsxPath = path.join(projectRoot, config.clientSrcPath, "App.tsx");
    const sidebarPath = path.join(
      projectRoot,
      config.clientSrcPath,
      "components",
      "sidebar.tsx",
    );

    // ── Phase B: brownfield planner ────────────────────────────────────────
    // Read every existing page's source (best-effort) so the planner can
    // detect behavior worth preserving (Firebase auth, custom data fetching).
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

    const onlySpecPagesWithUiGen = uiGenRows
      .map((row) => spec.pages[row.pageIndex])
      .filter((p): p is PageSpecFull => Boolean(p));

    const plan = planBrownfieldIntegration({
      specPages: onlySpecPagesWithUiGen,
      inventory,
      pageSources,
    });

    // Write PLAN.md so the user can audit decisions before/after the run.
    const planDir = path.join(projectRoot, config.outputPath, "integration");
    fs.mkdirSync(planDir, { recursive: true });
    const planFile = path.join(planDir, "PLAN.md");
    fs.writeFileSync(planFile, renderIntegrationPlanMarkdown(plan), "utf-8");

    // Refuse to proceed if any entry needs human merge review. The user has
    // to resolve those by hand (edit PLAN.md and rerun, or fix the spec).
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

    // Index plan entries by page name for runPage lookup.
    const planByName = new Map(plan.entries.map((e) => [e.pageName, e]));

    const work: PageWorkUnit[] = [];
    for (const row of uiGenRows) {
      const page = spec.pages[row.pageIndex];
      if (!page) continue;

      const planEntry = planByName.get(page.name);
      if (!planEntry) continue;

      // skip-mode pages still produce a work unit so the run is auditable,
      // but the LLM call + Stitch fetch are skipped to save cost/time.
      if (planEntry.mode === "skip") {
        work.push({
          pageName: page.name,
          pageIndex: row.pageIndex,
          input: {
            page,
            htmlContent: "",
            installedComponents: installed,
            projectRoot,
            appTsxPath,
            sidebarPath,
            planEntry,
          } satisfies IntegrationRunInput,
        });
        continue;
      }

      const resp = await fetch(row.output.htmlUrl);
      if (!resp.ok) {
        throw new Error(
          `Phase "integration": cannot fetch HTML for ${page.name} ` +
            `(${resp.status} ${resp.statusText}). Stitch presigned URL likely expired — ` +
            `re-run the ui-gen phase for this page.`,
        );
      }
      const htmlContent = await resp.text();

      work.push({
        pageName: page.name,
        pageIndex: row.pageIndex,
        input: {
          page,
          htmlContent,
          installedComponents: installed,
          projectRoot,
          appTsxPath,
          sidebarPath,
          planEntry,
        } satisfies IntegrationRunInput,
      });
    }

    return work;
  },

  async runPage(rawInput: unknown, _config: ProjectConfig): Promise<unknown> {
    const input = rawInput as IntegrationRunInput;
    const { page, htmlContent, installedComponents, projectRoot, appTsxPath, sidebarPath, planEntry } = input;

    // ── Mode dispatch (Phase B) ────────────────────────────────────────────
    // The planner already decided what to do with this page. runPage is just
    // the executor — it never re-classifies and never silently skips on a
    // file conflict.

    if (planEntry.mode === "skip") {
      return {
        pageFile: planEntry.existingFile,
        mode: "skip",
        rationale: planEntry.rationale,
      };
    }

    // create / replace / supplement all need a translated TSX file. Only the
    // overwrite + delete-old-file behavior differs.
    if (planEntry.mode === "merge") {
      // Defensive: prepare() should already have blocked this. If we got
      // here, refuse to touch the page rather than guess.
      throw new Error(
        `integration: page "${page.name}" is mode=merge and requires human review`,
      );
    }

    // For replace mode, we sanity-check the existing file is actually present
    // (the inventory may be stale if a hand edit removed it between phases).
    const overwrite = planEntry.mode === "replace";
    if (overwrite && planEntry.existingFile) {
      // Note: we are about to overwrite — record the old path so the result
      // surfaces it for the audit log.
    }

    // For create mode, surface a hard error if the target file mysteriously
    // already exists (the planner thought it didn't). That's a real conflict
    // worth stopping for, not a silent skip.
    if (planEntry.mode === "create") {
      const conflict = await checkFileConflict({ projectRoot, pageName: page.name });
      if (conflict.exists) {
        throw new Error(
          `integration: planner said create for "${page.name}" but ` +
            `${conflict.existingPath} already exists. Stale inventory? Re-run ` +
            `the integration phase or change the spec page name.`,
        );
      }
    }

    // 1. HTML → TSX
    const translation = await translateHtmlToShadcn({
      htmlContent,
      pageName: page.name,
      pageRoute: page.route,
      installedComponents,
      authLevel: page.authLevel,
    });

    // 2. Install missing shadcn components
    const installed = await ensureShadcnComponents({
      projectRoot,
      extractedImports: translation.extractedImports,
      installedComponents,
    });

    // 3. Write the page file. Overwrite for replace mode; fresh write
    // otherwise.
    const pageFile = await writePage({
      projectRoot,
      pageName: page.name,
      tsxContent: translation.tsxContent,
      overwrite,
    });

    // 4. Inject route (idempotent — Phase A). For replace mode, the existing
    // route entry stays in place if it already points at the same import
    // path; otherwise the injector adds the new route alongside.
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
      pageFilePath: pageFile,
    });

    // 5. Inject nav item (only for authenticated, non-standalone pages)
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
      pageFile,
      mode: planEntry.mode,
      replacedFile: overwrite ? planEntry.existingFile : null,
      componentName: routeResult.componentName,
      renamedToAvoidCollision: routeResult.renamed,
      routeInjected: true,
      navInjected,
      installedShadcn: installed,
    };
  },
};
