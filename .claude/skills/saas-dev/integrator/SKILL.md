---
name: saas-dev:integrator
description: Takes approved Stitch HTML from Phase 3 (ui-gen) and integrates it as working React pages — route-wired, nav-linked, committed per page, and PR-ready. Use when executing Phase 4 (code-integration) of the SaaS development pipeline.
---

# Skill: saas-dev:integrator

Takes approved Stitch HTML from Phase 3 and integrates each page as a working React component — routing wired in App.tsx, nav item added to sidebar.tsx, committed atomically, and finalized via a GitHub PR.

## Prerequisites

- Phase 3 (saas-dev:ui-generator) complete: `pipeline_pages` table has rows with `phase="ui-gen"` and `status="complete"`
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` env var set (required for HTML-to-TSX translation)
- `DATABASE_URL` configured for Neon PostgreSQL
- `git` CLI available in PATH
- `gh` CLI available in PATH (fallback: print manual PR instructions if missing)

## Inputs

- `projectRoot: string` — absolute path to the SaaS project repo
- `runId: string` — pipeline run ID (used to query pipeline_pages)
- `projectConfig: { projectId, appTsxPath, sidebarPath }` — file paths for injection targets

## Module Map

All modules live under `lib/code-integrator/`:

| Module | Export | Role |
|--------|--------|------|
| `lib/code-integrator/brownfield-audit.js` | `auditBrownfield` | Snapshot existing routes, pages, nav items, shadcn components |
| `lib/code-integrator/html-to-shadcn.js` | `translateHtmlToShadcn` | Translate Stitch HTML to shadcn/ui TSX via Claude |
| `lib/code-integrator/page-writer.js` | `writePage`, `ensureShadcnComponents`, `checkFileConflict` | Write TSX to disk, install missing shadcn components, detect file collisions |
| `lib/code-integrator/route-injector.js` | `injectRoute`, `detectRouteConflict` | Insert ProtectedRoute + CompanyGate into App.tsx before NotFound anchor |
| `lib/code-integrator/nav-injector.js` | `injectNavItem` | Insert nav item into sidebar.tsx before closing </ul> |
| `lib/code-integrator/git-workflow.js` | `createBranch`, `commitPage`, `pushAndCreatePR`, `detectBaseBranch` | Branch lifecycle, per-page atomic commits, push and PR |
| `lib/code-integrator/types.js` | All shared type interfaces | RouteInjectionInput, NavInjectionInput, BrownfieldInventory, etc. |

## Pipeline

### Step 1 — Initialize

**1a. Detect base branch (D-16):**

```typescript
import { detectBaseBranch } from "../../lib/code-integrator/git-workflow.js";

const baseBranch = await detectBaseBranch(projectRoot);
// Returns "main" if client/src/lib/company-guard.tsx and client/src/hooks/use-company.ts exist
// Returns "feature/company-system" if files absent and that branch exists
// Falls back to "main" if neither condition met
```

**1b. Create integration branch:**

```typescript
import { createBranch } from "../../lib/code-integrator/git-workflow.js";

await createBranch(baseBranch);
// Creates feature/ui-integration from baseBranch
```

**1c. Load pages to integrate:**

```typescript
import { db } from "../../server/db.js";
import { pipelinePages } from "@shared/design-schema.js";
import { eq, and } from "drizzle-orm";

const pages = await db
  .select()
  .from(pipelinePages)
  .where(and(
    eq(pipelinePages.runId, runId),
    eq(pipelinePages.phase, "ui-gen"),
    eq(pipelinePages.status, "complete"),
  ));

console.log(`Integrating ${pages.length} approved pages...`);
```

### Step 2 — Brownfield Audit

Run once before the per-page loop. Produces the inventory used for conflict detection and incremental updates.

```typescript
import { auditBrownfield } from "../../lib/code-integrator/brownfield-audit.js";

const inventory = await auditBrownfield(projectRoot);
// inventory.existingRoutes — all current routes in App.tsx
// inventory.existingPages — all current page files
// inventory.existingNavItems — all current sidebar nav items
// inventory.installedShadcnComponents — shadcn components already installed
```

Per D-11, D-12: audit provides the ground truth before any writes. Do NOT skip or cache across sessions.

### Step 3 — Per-Page Loop

For each page from Step 1c, execute steps 3a–3j in sequence.

#### Step 3a — Fetch HTML content

```typescript
const uiGenOutput = JSON.parse(page.output as string);
const htmlResponse = await fetch(uiGenOutput.htmlUrl);

if (!htmlResponse.ok) {
  // Pitfall 1: Stitch presigned URLs expire
  if (htmlResponse.status === 403 || htmlResponse.status === 410) {
    console.error(`HTML URL expired for ${page.pageName}. Re-run Phase 3 for this page or paste HTML directly.`);
    continue; // escalate to user
  }
  throw new Error(`Failed to fetch HTML for ${page.pageName}: ${htmlResponse.status}`);
}

const htmlContent = await htmlResponse.text();
```

#### Step 3b — Translate HTML to shadcn/ui TSX

```typescript
import { translateHtmlToShadcn } from "../../lib/code-integrator/html-to-shadcn.js";

const translationResult = await translateHtmlToShadcn({
  htmlContent,
  pageName: page.pageName,
  pageRoute: page.pageSlug,
  installedComponents: inventory.installedShadcnComponents,
  authLevel: "authenticated", // or "public" for onboarding/auth pages
});
// translationResult.tsxContent — the translated React component
// translationResult.extractedImports — shadcn components used
// Per D-01, D-04
```

Post-translation validation: if `tsxContent` contains `useQuery(` or `useMutation(` — these are TanStack Query hooks that should not be generated by translation. Strip or replace with placeholder data before proceeding (Pitfall 2).

#### Step 3c — Ensure shadcn components installed

```typescript
import { ensureShadcnComponents } from "../../lib/code-integrator/page-writer.js";

await ensureShadcnComponents({
  projectRoot,
  extractedImports: translationResult.extractedImports,
  installedComponents: inventory.installedShadcnComponents,
});
// Per D-03, Pitfall 5: check existence before running npx shadcn@latest add
// to avoid interactive prompts
```

#### Step 3d — Route conflict check (D-10)

```typescript
import { detectRouteConflict } from "../../lib/code-integrator/route-injector.js";

const componentName = toPascalCase(page.pageName) + "Page";
const routeConflict = detectRouteConflict(page.pageSlug, componentName, inventory);

if (routeConflict) {
  console.log(`Route conflict at ${page.pageSlug}:`);
  console.log(`  Existing: ${routeConflict.existingComponent} (${routeConflict.existingFile})`);
  console.log(`  New: ${routeConflict.newComponent}`);
  console.log("Options: replace / merge / skip");
  const resolution = await getUserInput("[replace/merge/skip]: ");
  if (resolution === "skip") continue;
  // If replace/merge: proceed (page-writer will handle overwrite per Step 3e)
}
```

#### Step 3e — File conflict check and write page (D-10)

```typescript
import { checkFileConflict, writePage } from "../../lib/code-integrator/page-writer.js";

const { exists, existingPath } = await checkFileConflict({ projectRoot, pageName: page.pageName });
let pageFile: string;

if (exists && existingPath) {
  console.log(`File conflict: ${existingPath} already exists.`);
  console.log("Options:");
  console.log("  replace — overwrite existing file");
  console.log("  merge   — Claude AI smart-merge of existing and new content");
  console.log("  skip    — keep existing file, skip this page");
  const resolution = await getUserInput("[replace/merge/skip]: ");

  if (resolution === "skip") continue;

  if (resolution === "merge") {
    // AI smart-merge: send both files to Claude for reconciliation
    const existingContent = await readFile(existingPath, "utf-8");
    const mergedContent = await mergeWithClaude(existingContent, translationResult.tsxContent);
    pageFile = await writePage({
      projectRoot,
      pageName: page.pageName,
      tsxContent: mergedContent,
      overwrite: true,
    });
  } else {
    // replace
    pageFile = await writePage({
      projectRoot,
      pageName: page.pageName,
      tsxContent: translationResult.tsxContent,
      overwrite: true,
    });
  }
} else {
  // No conflict — write normally per D-05
  pageFile = await writePage({
    projectRoot,
    pageName: page.pageName,
    tsxContent: translationResult.tsxContent,
  });
}
```

#### Step 3f — Inject route into App.tsx

```typescript
import { injectRoute } from "../../lib/code-integrator/route-injector.js";

const isStandalonePage = ["onboarding", "auth", "login", "register"].some((s) =>
  page.pageSlug.includes(s),
);

await injectRoute({
  appTsxPath: projectConfig.appTsxPath,
  componentName,
  importPath: `@/pages/${toKebabCase(page.pageName)}`,
  routePath: page.pageSlug,
  wrapCompanyGate: !isStandalonePage,
  isStandalone: isStandalonePage,
});
// Per D-07, D-08: ProtectedRoute + CompanyGate for authenticated pages
// Per D-08: isStandalone=true for auth/onboarding pages (no CompanyGate)
```

#### Step 3g — Inject nav item into sidebar.tsx

```typescript
import { injectNavItem } from "../../lib/code-integrator/nav-injector.js";

// Per Pitfall 7: iconClass MUST be a remixicon class string (ri-*), NOT a Lucide import.
// Select from remixicon set based on page name:
// analytics/reports -> ri-bar-chart-line
// settings -> ri-settings-3-line
// users/crm -> ri-user-star-line
// documents/files -> ri-file-list-3-line
// tasks/board -> ri-task-line
// home/dashboard -> ri-dashboard-line
// Default: ri-pages-line
const iconClass = selectRemixIcon(page.pageName);

await injectNavItem({
  sidebarPath: projectConfig.sidebarPath,
  label: page.pageName,
  href: page.pageSlug,
  iconClass,
});
// Per D-09: inserts before </ul> of space-y-2 nav list, uses location variable for active state
```

#### Step 3h — Commit page atomically

```typescript
import { commitPage } from "../../lib/code-integrator/git-workflow.js";

const commitHash = await commitPage(page.pageName, [
  pageFile,
  projectConfig.appTsxPath,
  projectConfig.sidebarPath,
  // Include package.json if new shadcn components were installed
  ...(newShadcnInstalled.length > 0 ? [join(projectRoot, "package.json")] : []),
]);
// Per D-14: atomic commit per page — message: "feat(ui): integrate {pageName} page"
```

#### Step 3i — Update inventory incrementally

```typescript
// Add new page to inventory so subsequent pages can see it
inventory.existingPages.push({
  fileName: basename(pageFile),
  filePath: pageFile,
  exportName: componentName,
});
inventory.existingRoutes.push({
  path: page.pageSlug,
  componentName,
  filePath: pageFile,
  isProtected: !isStandalonePage,
  hasCompanyGate: !isStandalonePage,
});
inventory.existingNavItems.push({
  label: page.pageName,
  href: page.pageSlug,
  iconClass,
});
```

#### Step 3j — Write integration output to database

```typescript
import { IntegrationPhaseOutputSchema } from "../../lib/code-integrator/types.js";

const integrationOutput = IntegrationPhaseOutputSchema.parse({
  pageName: page.pageName,
  pageFile,
  routePath: page.pageSlug,
  committed: true,
  commitHash,
});

await db.update(pipelinePages)
  .set({
    phase: "integration",
    status: "complete",
    output: JSON.stringify(integrationOutput),
    completedAt: new Date(),
  })
  .where(and(
    eq(pipelinePages.runId, runId),
    eq(pipelinePages.pageIndex, page.pageIndex),
  ));
```

### Step 4 — Push and PR (D-13, D-15)

```typescript
import { pushAndCreatePR } from "../../lib/code-integrator/git-workflow.js";

const pagesSummary = completedPages.map((p) => `${p.pageName} (${p.pageSlug})`);

try {
  const prUrl = await pushAndCreatePR(pagesSummary);
  console.log(`\nPR created: ${prUrl}`);
} catch (err) {
  // Pitfall: gh CLI not available
  console.log("\ngh CLI unavailable. Push and create PR manually:");
  console.log(`  git push -u origin feature/ui-integration`);
  console.log(`  gh pr create --title "feat(ui): integrate generated pages"`);
}
```

### Step 5 — Completion Summary

```
Integration Complete

  Pages integrated: 4
  Commits: [hash1] Reports, [hash2] Analytics, [hash3] Settings, [hash4] CRM
  PR: https://github.com/user/repo/pull/42

All pages are routed in App.tsx and linked in sidebar.tsx.
```

## Pitfall Reference

| # | Pitfall | Detection | Action |
|---|---------|-----------|--------|
| 1 | Stitch presigned URL expiry | HTTP 403 or 410 on htmlUrl fetch | Escalate to user: re-run Phase 3 for that page or paste HTML directly |
| 2 | Claude generates useQuery/useMutation | Post-translation string check | Strip TanStack Query hooks from tsxContent before wiring |
| 3 | Route collision | detectRouteConflict returns non-null | D-10: show existing vs new, ask user for replace/merge/skip |
| 4 | File collision | checkFileConflict returns `{ exists: true }` | D-10: show existing path, ask user for replace/merge/skip |
| 5 | shadcn interactive prompt | `npx shadcn@latest add` asks questions | Check existence before install via ensureShadcnComponents |
| 6 | Wrong base branch | company-guard.tsx absent from projectRoot | D-16: detectBaseBranch determines correct base branch |
| 7 | Sidebar uses remixicon not Lucide | iconClass must start with `ri-` | NEVER pass Lucide component names; always use remixicon `ri-*` strings |

## Error Handling

| Error | Recoverable | Action |
|-------|-------------|--------|
| `ENV_MISSING` (Anthropic key) | No | Print error, abort pipeline |
| `HTML_URL_EXPIRED` (403/410) | Yes | Ask user to re-run Phase 3 for that page or paste HTML |
| `ROUTE_CONFLICT` | Yes | D-10: show both options, user decides replace/merge/skip |
| `FILE_EXISTS` (page file conflict) | Yes | D-10: checkFileConflict + user decides replace/merge/skip |
| `GH_CLI_MISSING` | Yes | Print manual PR instructions |
| `TRANSLATION_FAILED` | Yes | Retry translation once; escalate if second attempt fails |
| Database write error | Yes | Log warning; do NOT block pipeline |

## Decision Reference

Key decisions applied by this skill:

| Decision | Summary |
|----------|---------|
| D-01 | Translate PageSpec directly into Stitch prompt — spec-faithful |
| D-03 | ensureShadcnComponents checks existence before install to avoid interactive prompts |
| D-04 | Translation uses Claude Sonnet with system prompt for shadcn/ui fidelity |
| D-05 | writePage creates page files under client/src/pages/ with kebab-case naming |
| D-07 | ProtectedRoute wraps all authenticated pages in App.tsx |
| D-08 | CompanyGate wraps non-standalone pages (auth/onboarding excluded) |
| D-09 | Sidebar nav items use remixicon ri-* icon classes — never Lucide |
| D-10 | Route and file conflict detection runs before any write; user resolves via replace/merge/skip |
| D-11 | auditBrownfield runs once before loop — provides ground truth for conflict detection |
| D-12 | Inventory updated incrementally per page within the loop — subsequent pages see prior writes |
| D-13 | pushAndCreatePR runs after all pages complete — one PR per integration session |
| D-14 | commitPage creates one atomic commit per page: "feat(ui): integrate {pageName} page" |
| D-15 | gh pr create --title and --body populated from completed page names |
| D-16 | detectBaseBranch: "main" if company-guard.tsx exists, else "feature/company-system" if branch exists, else "main" fallback |

## Database Schema Reference

Tables used in this phase (from `shared/design-schema.ts`):

- `pipelinePages` — pipeline execution state per page (read phase="ui-gen" status="complete", write phase="integration")

```typescript
import { pipelinePages, insertPipelinePageSchema } from "@shared/design-schema.js";
```
