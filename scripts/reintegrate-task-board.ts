/**
 * Targeted re-integration for TaskBoard only.
 *
 * The first integration run failed on TaskBoard because supplement mode hit
 * a filename collision with the existing client/src/pages/task-board-page.tsx.
 * page-writer was updated to fall back to <name>-page-new.tsx in that case,
 * banner the file for manual review, and return the new path. This script
 * exercises that path for TaskBoard specifically without re-running the
 * whole integration batch (14 sub-agents, 14 Stitch-to-TSX calls).
 */

import "dotenv/config";
process.env.USE_NEON_HTTP = "1";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runPageAgent } from "../lib/code-integrator/page-agent.js";
import { writePage } from "../lib/code-integrator/page-writer.js";
import { injectRoute } from "../lib/code-integrator/route-injector.js";
import { injectNavItem } from "../lib/code-integrator/nav-injector.js";
import { auditBrownfield } from "../lib/code-integrator/brownfield-audit.js";
import { loadBrandVoice } from "../lib/spec-parser/brand-voice-inferrer.js";
import { SHARED_LAYOUT_COMPONENTS } from "../lib/code-integrator/shared-components-builder.js";
import type { PageSpecFull } from "@shared/spec-schema.js";

async function main() {
  const projectRoot = process.cwd();
  const spec = JSON.parse(
    readFileSync(resolve(projectRoot, ".planning/specs/eos-mvp-spec.json"), "utf-8"),
  );
  const taskBoardPage: PageSpecFull | undefined = spec.pages.find(
    (p: { name: string }) => p.name === "TaskBoard",
  );
  if (!taskBoardPage) {
    throw new Error("TaskBoard spec page not found in eos-mvp-spec.json");
  }

  const htmlContent = readFileSync(
    resolve(projectRoot, ".planning/output/previews/TaskBoard.html"),
    "utf-8",
  );

  const designSystem = readFileSync(
    resolve(projectRoot, ".planning/design-system.md"),
    "utf-8",
  );
  const brandVoice = loadBrandVoice(resolve(projectRoot, ".planning"));
  const inventory = await auditBrownfield(projectRoot);

  console.log("\n=== Re-integrating TaskBoard (supplement mode) ===\n");
  console.log("Spawning page sub-agent...");
  const agentResult = await runPageAgent({
    pageName: taskBoardPage.name,
    pageRoute: taskBoardPage.route,
    authLevel: taskBoardPage.authLevel,
    htmlContent,
    pageSpec: taskBoardPage,
    designSystem,
    brandVoice,
    sharedComponents: SHARED_LAYOUT_COMPONENTS.map((c) => c.name),
    installedComponents: [...inventory.installedShadcnComponents],
  });

  console.log(`Sub-agent OK: ${agentResult.tsxContent.length} chars\n`);

  // Supplement-mode write: the new page-writer will automatically fall back
  // to task-board-page-new.tsx because the target filename collides with
  // the existing file.
  const pageFile = await writePage({
    projectRoot,
    pageName: taskBoardPage.name,
    tsxContent: agentResult.tsxContent,
    mode: "supplement",
  });
  console.log(`Wrote: ${pageFile}`);

  // Only inject route+nav if the file is the "-new" sibling — the original
  // task-board-page.tsx is already wired into App.tsx under /tasks, we're
  // adding the new location at /company/:companyId/tasks.
  const appTsxPath = resolve(projectRoot, "client/src/App.tsx");
  const sidebarPath = resolve(projectRoot, "client/src/components/sidebar.tsx");

  const routeResult = await injectRoute({
    appTsxPath,
    componentName: taskBoardPage.name,
    importPath: `@/pages/${pageFile.split(/[\\/]/).pop()?.replace(/\.tsx$/, "")}`,
    routePath: taskBoardPage.route,
    wrapCompanyGate: true,
    isStandalone: false,
    pageFilePath: pageFile,
  });
  console.log(
    `Route injected: ${routeResult.componentName}${routeResult.renamed ? " (renamed)" : ""}`,
  );

  await injectNavItem({
    sidebarPath,
    label: taskBoardPage.name,
    href: taskBoardPage.route,
    iconClass: "ri-task-line",
  });
  console.log(`Nav item injected for ${taskBoardPage.route}`);

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("TaskBoard re-integration failed:", err);
  process.exit(1);
});
