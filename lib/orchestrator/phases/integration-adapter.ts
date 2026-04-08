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
} from "../../code-integrator/page-writer.js";
import { injectRoute } from "../../code-integrator/route-injector.js";
import { injectNavItem } from "../../code-integrator/nav-injector.js";

interface IntegrationRunInput {
  page: PageSpecFull;
  htmlContent: string;
  installedComponents: string[];
  projectRoot: string;
  appTsxPath: string;
  sidebarPath: string;
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

export const integrationPhaseImplementation: PhaseImplementation = {
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

    const work: PageWorkUnit[] = [];
    for (const row of uiGenRows) {
      const page = spec.pages[row.pageIndex];
      if (!page) continue;

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
        } satisfies IntegrationRunInput,
      });
    }

    return work;
  },

  async runPage(rawInput: unknown, _config: ProjectConfig): Promise<unknown> {
    const input = rawInput as IntegrationRunInput;
    const { page, htmlContent, installedComponents, projectRoot, appTsxPath, sidebarPath } = input;

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

    // 3. Write the page file (overwrite=false; rerun fails loudly on conflict)
    const pageFile = await writePage({
      projectRoot,
      pageName: page.name,
      tsxContent: translation.tsxContent,
    });

    // 4. Inject route
    const componentName = page.name;
    const importPath = `@/pages/${toKebabCase(page.name)}-page`;
    const isStandalone = page.authLevel === "public";
    await injectRoute({
      appTsxPath,
      componentName,
      importPath,
      routePath: page.route,
      wrapCompanyGate: !isStandalone,
      isStandalone,
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
      routeInjected: true,
      navInjected,
      installedShadcn: installed,
    };
  },
};
