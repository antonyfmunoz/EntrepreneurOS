# Phase 4: Code Integration - Research

**Researched:** 2026-03-28
**Domain:** React/TypeScript brownfield code integration, Wouter routing, shadcn/ui component mapping, git workflow automation
**Confidence:** HIGH

## Summary

Phase 4 takes approved Stitch HTML output from Phase 3 and integrates it as real, working React files in the existing EntrepreneurOS repo. The work is well-scoped: all architectural decisions are locked in CONTEXT.md, the codebase is deeply familiar from prior phases, and the integration surface (App.tsx routes, sidebar.tsx nav, pages directory, shadcn/ui primitives) is fully documented. The phase builds a new Claude Code skill (`saas-dev:integrator`) that orchestrates brownfield audit, HTML-to-shadcn translation via Claude AI, page file creation, route wiring, nav injection, and per-page git commits.

The primary technical challenge is the Stitch HTML-to-shadcn rewrite step: Claude must map raw HTML (divs, inline styles, generic classes) to typed TypeScript React components using the project's existing shadcn/ui library. The existing pages directory has 16+ reference implementations making the translation target concrete. All components needed (Button, Card, Dialog, Tabs, Accordion, etc.) are already installed — the full shadcn component inventory is available.

The git workflow layer is straightforward: one feature branch, one atomic commit per page, push + PR after all pages. The existing git infrastructure is standard and GitHub CLI (`gh`) is available.

**Primary recommendation:** Build `lib/code-integrator/` as the module home for all Phase 4 logic, structured symmetrically with `lib/ui-generator/`. The skill entry point `saas-dev:integrator` in `.claude/skills/saas-dev/integrator/SKILL.md` orchestrates these modules. Each page integration runs as: audit snapshot → translate HTML → write file → wire route → add nav → commit.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Stitch-to-shadcn Translation**
- D-01: Claude AI rewrite strategy. Send Stitch HTML + inventory of installed shadcn components to Claude. AI rewrites to use existing Button, Card, Dialog, etc. from client/src/components/ui/. No AST parsing step.
- D-02: Claude's Discretion on preservation balance. Claude determines per-page whether to keep Stitch layout structure with existing styling, or preserve Stitch fidelity. Adapt based on output quality.
- D-03: Auto-install missing shadcn components. When Stitch output needs a shadcn primitive that isn't installed, run `npx shadcn@latest add [component]` automatically. No user prompt needed.
- D-04: Static structure only — no data fetching in translated components. Phase 4 outputs pure presentational components with props. useQuery hooks and API wiring are Phase 5's concern.

**Page File Structure**
- D-05: Default to one page component per file in client/src/pages/. Extract sub-components into client/src/components/ only when genuinely reused across 3+ pages. Avoid file explosion.
- D-06: Route paths come directly from PageSpec `route` field. No re-derivation needed.

**Page Wiring**
- D-07: All new pages wrapped in ProtectedRoute + CompanyGate by default. Opt-out via PageSpec flags (fullScreen: true, page type onboarding/auth).
- D-08: Default Layout wrapper with opt-out. New pages render inside existing Layout (sidebar + header + content area) by default.
- D-09: Auto-add navigation entries. System reads page name from PageSpec, picks appropriate Lucide icon, adds entry to sidebar.tsx.

**Brownfield Conflict Resolution**
- D-10: Flag conflicts + smart merge option. Route/filename collision shows both versions, offers: replace existing, AI smart-merge, or skip.
- D-11: Full brownfield audit scope. Inventory all existing pages, routes, shared components, hooks, and utilities before writing any file.
- D-12: One-time audit with incremental updates. Full scan once before first page. Incremental update after each page.

**Git Workflow**
- D-13: One feature branch per phase run. Branch name: feature/ui-integration.
- D-14: One atomic commit per page. Each page integration is one commit.
- D-15: Auto-push after all pages, auto-create PR with summary of all pages added.
- D-16: Claude's Discretion on base branch. Analyze dependencies at execution time — branch from feature/company-system if CompanyGuard/use-company required, else from main.

### Claude's Discretion
- D-02: Preservation balance during translation (layout vs styling fidelity)
- D-05: Page file granularity (single file default, extract reused sub-components)
- D-16: Base branch selection based on dependency analysis

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTG-01 | System scans existing codebase before writing any files (brownfield audit) | Brownfield audit module: scan pages/, components/, App.tsx routes, sidebar.tsx nav entries — extract inventory as typed data structure for conflict detection and reuse identification |
| INTG-02 | System translates Stitch output to match existing design system (shadcn/ui components) before integration | Claude AI rewrite step: send HTML + installed shadcn component list → receive TypeScript React component. Full installed component inventory documented below. |
| INTG-03 | System creates/updates React component files from approved Stitch output | Page file writer: create client/src/pages/[name].tsx following established patterns (default export, Layout wrapper, kebab-case file name) |
| INTG-04 | System updates routing configuration for new pages | Route injector: parse App.tsx, insert ProtectedRoute + CompanyGate blocks in Router Switch, write back |
| INTG-05 | System wires new pages into existing app layout and navigation | Nav injector: parse sidebar.tsx, append nav item with Lucide icon in the ul.space-y-2 list |
| GIT-01 | System creates feature branches per phase | `git checkout -b feature/ui-integration [base-branch]` at pipeline start |
| GIT-02 | System commits at phase boundaries with descriptive messages | One `git add + git commit` per page after all wiring steps complete |
| GIT-03 | System pushes to remote and surfaces PR-ready state | `git push -u origin feature/ui-integration` then `gh pr create` with page summary |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.6.3 | All source files for Phase 4 modules | Project-wide, strict mode |
| Anthropic SDK | 0.37.0 | Claude AI call for HTML-to-shadcn rewrite (D-01) | Already installed, used in Phase 3 self-review |
| Drizzle ORM | 0.39.1 | Read pipelinePages output from Phase 3; write integration records | Project-wide ORM, same pattern as Phases 1-3 |
| ts-morph | To be installed | Parse/modify App.tsx and sidebar.tsx AST | TypeScript-native AST manipulation; safer than regex for adding route entries |
| lucide-react | 0.453.0 | Icon selection for auto-added nav entries | Already installed, used in layout.tsx and existing pages |
| GitHub CLI (gh) | System | Create PR after push (GIT-03) | Available on VPS; used in project git workflows |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| glob | 11.1.0 | File discovery for brownfield audit | Already installed; enumerate pages/, components/, hooks/ |
| fs/promises | Node built-in | File read/write for page file creation | No extra dependency needed |
| child_process / execa | Node built-in / optional | Run `git` commands and `npx shadcn@latest add` | Use exec/spawn for git and shadcn auto-install |
| zod | 3.25.76 | Schema for BrownfieldInventory, IntegrationResult types | Already installed; use for all internal data contracts |
| p-limit | 7.3.0 | Concurrency control if parallelizing component installs | Already installed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ts-morph AST | Regex string manipulation | Regex is fragile on App.tsx edits — misses edge cases like comments inside Switch blocks. ts-morph is safer but adds a dependency. |
| ts-morph AST | Custom line-insertion heuristic | Simpler but brittle when App.tsx grows. Acceptable for MVP if ts-morph install is blocked. |
| Claude for HTML rewrite | Custom regex HTML-to-JSX transpiler | Custom transpiler cannot understand semantic intent (which shadcn component maps to which HTML pattern). Claude is the correct tool per D-01. |

**Installation (ts-morph only — everything else already present):**
```bash
npm install ts-morph
```

**Version verification:**
```bash
npm view ts-morph version
# Current: 23.0.0 (as of 2026-03-28)
```

---

## Architecture Patterns

### Recommended Module Structure

```
lib/code-integrator/
├── types.ts                  # BrownfieldInventory, PageIntegrationResult, IntegrationOptions
├── brownfield-audit.ts       # INTG-01: scan codebase, return BrownfieldInventory
├── html-to-shadcn.ts         # INTG-02: Claude AI rewrite HTML → TSX component string
├── page-writer.ts            # INTG-03: write client/src/pages/[slug].tsx
├── route-injector.ts         # INTG-04: insert ProtectedRoute + CompanyGate in App.tsx
├── nav-injector.ts           # INTG-05: insert nav item in sidebar.tsx
└── git-workflow.ts           # GIT-01/02/03: branch, commit, push, PR

.claude/skills/saas-dev/integrator/
└── SKILL.md                  # Phase 4 skill entry point, pipeline orchestration prose

tests/unit/code-integrator/
├── brownfield-audit.test.ts
├── html-to-shadcn.test.ts
├── page-writer.test.ts
├── route-injector.test.ts
└── nav-injector.test.ts
```

### Pattern 1: Brownfield Inventory Type

The audit output is a typed data structure consumed by conflict detection and reuse identification. Shape:

```typescript
// lib/code-integrator/types.ts
import { z } from "zod";

export const BrownfieldInventorySchema = z.object({
  existingRoutes: z.array(z.object({
    path: z.string(),          // e.g. "/home"
    componentName: z.string(), // e.g. "Dashboard"
    filePath: z.string(),      // e.g. "client/src/pages/dashboard.tsx"
    isProtected: z.boolean(),
    hasCompanyGate: z.boolean(),
  })),
  existingPages: z.array(z.object({
    fileName: z.string(),      // e.g. "dashboard.tsx"
    filePath: z.string(),
    exportName: z.string(),    // e.g. "Dashboard" (default export)
  })),
  installedShadcnComponents: z.array(z.string()), // ["button", "card", "dialog", ...]
  existingNavItems: z.array(z.object({
    label: z.string(),
    href: z.string(),
    iconClass: z.string(),
  })),
  existingSharedComponents: z.array(z.string()), // files in client/src/components/ (non-ui/)
  existingHooks: z.array(z.string()),            // files in client/src/hooks/
});

export type BrownfieldInventory = z.infer<typeof BrownfieldInventorySchema>;
```

### Pattern 2: HTML-to-shadcn Claude Rewrite

The Claude prompt for translation must include: (1) the Stitch HTML, (2) the full list of installed shadcn components, (3) the page name and route from PageSpec, (4) explicit constraints (no data fetching, no useQuery, static props only, TypeScript strict mode, 2-space indent, default export).

```typescript
// lib/code-integrator/html-to-shadcn.ts
import Anthropic from "@anthropic-ai/sdk";

export interface TranslationInput {
  htmlContent: string;
  pageName: string;
  pageRoute: string;
  installedComponents: string[]; // from BrownfieldInventory
  authLevel: "public" | "authenticated" | "admin";
}

export interface TranslationResult {
  tsxContent: string;           // Complete TypeScript React component string
  extractedImports: string[];   // shadcn components actually used (for auto-install check)
  layoutWrapped: boolean;       // Did Claude wrap in Layout?
}

export async function translateHtmlToShadcn(
  input: TranslationInput,
  client: Anthropic,
): Promise<TranslationResult> {
  const componentList = input.installedComponents.join(", ");

  const prompt = `Convert the following HTML (from a Stitch UI generator) into a TypeScript React component.

PAGE: ${input.pageName} (route: ${input.pageRoute})
AUTH: ${input.authLevel}

RULES:
- Use ONLY components from: ${componentList} — imported from "@/components/ui/[name]"
- Wrap content in <Layout title="${input.pageName}"> from "@/components/layout"
- Default export, file name will be kebab-case
- NO useQuery, NO fetch calls, NO data fetching — use static placeholder props
- TypeScript strict: all props typed, no 'any'
- Tailwind utility classes only for styling
- 2-space indentation
- lucide-react icons only (already installed)
- Return ONLY the TypeScript file content, no markdown fences

HTML TO CONVERT:
${input.htmlContent}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const tsxContent = message.content[0].type === "text"
    ? message.content[0].text
    : "";

  // Extract which shadcn components were actually used
  const shadcnImportPattern = /@\/components\/ui\/(\w+)/g;
  const extractedImports: string[] = [];
  let match;
  while ((match = shadcnImportPattern.exec(tsxContent)) !== null) {
    extractedImports.push(match[1]);
  }

  return {
    tsxContent,
    extractedImports,
    layoutWrapped: tsxContent.includes("<Layout"),
  };
}
```

### Pattern 3: Route Injection (ts-morph)

App.tsx uses a Wouter `<Switch>` with `<ProtectedRoute>` and `<CompanyGate>` wrappers. New routes must be inserted before the final `<Route component={NotFound} />`. The import for the page component must also be added.

```typescript
// lib/code-integrator/route-injector.ts
import { Project, SyntaxKind } from "ts-morph";

export interface RouteInjectionInput {
  appTsxPath: string;   // absolute path to client/src/App.tsx
  componentName: string; // e.g. "ReportsPage"
  importPath: string;    // e.g. "@/pages/reports-page"
  routePath: string;     // e.g. "/reports"
  wrapCompanyGate: boolean;
  isStandalone: boolean; // fullScreen/auth/onboarding pages skip Layout wrapper
}

export function injectRoute(input: RouteInjectionInput): void {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(input.appTsxPath);

  // 1. Add import at top
  sourceFile.addImportDeclaration({
    defaultImport: input.componentName,
    moduleSpecifier: input.importPath,
  });

  // 2. Find the Router function's Switch JSX
  // 3. Insert ProtectedRoute before the NotFound catch-all
  // 4. Save the file
  sourceFile.saveSync();
}
```

**Important:** The existing App.tsx pattern uses two forms of ProtectedRoute:
- `<ProtectedRoute path="/company-setup" component={CompanySetupPage} />` — for standalone pages (no CompanyGate)
- `<ProtectedRoute path="/home">{() => (<CompanyGate><Dashboard /></CompanyGate>)}</ProtectedRoute>` — for company-required pages

The route injector must generate the correct form based on `wrapCompanyGate`.

### Pattern 4: Nav Item Injection

sidebar.tsx uses `remixicon` classes (e.g., `ri-home-4-line`) for nav icons. However, the CONTEXT.md specifies picking a Lucide icon. The existing sidebar actually uses remix icons, not Lucide. This is a critical observation: the nav injector must use remix icon classes consistent with the existing pattern, NOT Lucide — unless the decision is to introduce Lucide icons into the sidebar (which both icon sets are installed).

**Resolution:** Both `lucide-react` (layout.tsx, protected-route.tsx) and `remixicon` (sidebar.tsx) are installed. For consistency with the sidebar pattern, new nav items should use `remixicon` class names. Claude can select appropriate remix icon class names per page.

Nav item insertion point in sidebar.tsx is the `<ul className="space-y-2">` block — new `<li>` entries added before the closing `</ul>`.

### Pattern 5: Page File Output Format

Canonical page file structure derived from `dashboard.tsx` and `crm-page.tsx`:

```typescript
// client/src/pages/[kebab-name]-page.tsx

import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// ... other shadcn imports

// Static placeholder types (no API types yet — Phase 5 wires data)
interface [PageName]Props {
  // empty or minimal static props
}

export default function [PageName]() {
  return (
    <Layout title="[Page Title]">
      {/* translated content */}
    </Layout>
  );
}
```

### Pattern 6: Pipeline Database Integration

Phase 4 reads Phase 3 output from `pipelinePages` table using `UiGenPhaseOutputSchema`. Each page produces an `htmlUrl` (presigned S3) and `screenshotUrl`. Phase 4 writes its own records with phase = "integration".

```typescript
// Reading Phase 3 output per page:
const uiGenOutput = UiGenPhaseOutputSchema.parse(JSON.parse(page.output));
const htmlContent = await fetch(uiGenOutput.htmlUrl).then(r => r.text());
// htmlUrl may be expired — see Pitfall 3 below
```

### Pattern 7: Git Workflow Sequence

```typescript
// lib/code-integrator/git-workflow.ts

// Step 1 — Create branch (run once at pipeline start)
async function createBranch(baseBranch: string): Promise<void> {
  await exec(`git checkout ${baseBranch}`);
  await exec(`git checkout -b feature/ui-integration`);
}

// Step 2 — Atomic commit per page (run after each page integration)
async function commitPage(pageName: string, files: string[]): Promise<void> {
  for (const f of files) await exec(`git add "${f}"`);
  await exec(`git commit -m "feat(ui): integrate ${pageName} page"`);
}

// Step 3 — Push and create PR (run after all pages)
async function pushAndCreatePR(pagesSummary: string[]): Promise<string> {
  await exec(`git push -u origin feature/ui-integration`);
  const body = pagesSummary.map(p => `- ${p}`).join("\n");
  const { stdout } = await exec(
    `gh pr create --title "feat(ui): integrate generated pages" --body "## Pages Added\n${body}"`
  );
  return stdout.trim(); // PR URL
}
```

### Anti-Patterns to Avoid

- **Regex-based App.tsx editing:** App.tsx has complex JSX with nested closures — regex misses edge cases. Use ts-morph.
- **Writing page files before audit completes:** Always run `brownfield-audit` first. Never skip it even if `--fast` mode is requested.
- **Including useQuery/fetch in translated components:** Phase 4 is static structure only. Claude prompt must explicitly forbid data fetching. Any slip here creates a Phase 5 conflict.
- **Committing multiple pages in one commit:** D-14 requires one atomic commit per page. Batching makes revert harder.
- **Using `git add .` in commits:** Only add the specific files touched for that page (page file, App.tsx, sidebar.tsx, package.json if shadcn installed).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TypeScript AST modification | Custom regex string replacer | ts-morph | App.tsx has nested JSX closures — regex brittle at scale |
| HTML-to-JSX transpilation | Custom HTML parser + component mapper | Claude AI (D-01) | Cannot infer semantic intent without AI; custom mapper misses edge cases |
| Icon selection | Hardcoded icon map | Claude selects from remixicon/lucide set given page name | Icon choice is semantic — AI picks better than a lookup table |
| shadcn component detection | Manual string scan | List files in `client/src/components/ui/` | Source of truth is the filesystem, not a config or registry |
| Git operations | Custom git library | `child_process.exec` + `gh` CLI | Git and gh are already on the path; no library needed |
| PR creation | GitHub REST API | `gh pr create` | gh CLI is the standard for project git workflows |

**Key insight:** The AI translation step is the core value of this phase. Don't attempt to replace it with deterministic rules — Stitch output is semantically rich HTML that maps to shadcn components via intent, not syntax.

---

## Common Pitfalls

### Pitfall 1: Stitch Presigned URL Expiry
**What goes wrong:** Phase 3 stored `htmlUrl` in `pipelinePages.output`. By the time Phase 4 runs, the presigned URL may be expired (S3 presigned URLs typically expire in 15 min to 1 hour).
**Why it happens:** Phase 3 SKILL.md documents this as Pitfall #1 — Stitch returns presigned URLs, not raw HTML.
**How to avoid:** If `fetch(htmlUrl)` returns 403/410, escalate to user: "HTML for [page] has expired. Re-run Phase 3 for this page or paste HTML manually." Do not silently fail.
**Warning signs:** HTTP 403 or 403 XML error body from S3 fetch.

### Pitfall 2: Claude Generates useQuery Calls
**What goes wrong:** Despite the static-only instruction, Claude may generate data-fetching code if the HTML has obvious data patterns (tables, lists). Phase 5 will then try to re-wire the same components and create conflicts.
**Why it happens:** Claude's training associates certain UI patterns with data fetching.
**How to avoid:** Add an explicit post-translation check: scan the generated TSX for `useQuery`, `useMutation`, `fetch(`, `axios.` — if found, re-prompt Claude with stricter instructions or strip them automatically with a regex pass.
**Warning signs:** TSX imports `@tanstack/react-query`, `useQuery` appears in the component body.

### Pitfall 3: Route Collision with Existing Pages
**What goes wrong:** PageSpec.route = "/settings" conflicts with the already-wired `/settings` → `SettingsPage` route.
**Why it happens:** The spec parser derives routes from page names without knowing the brownfield inventory.
**How to avoid:** D-10 mandates conflict detection. Brownfield audit must extract all existing routes from App.tsx before any wiring. If collision detected, present the three options (replace, merge, skip) and pause for user input.
**Warning signs:** Duplicate `<Route path="/settings">` entries in App.tsx would cause Wouter to match only the first one (silent failure).

### Pitfall 4: ts-morph Saving Reformats the File
**What goes wrong:** ts-morph by default pretty-prints the file using its own formatter, which may reformat App.tsx differently from the existing 2-space Tailwind style.
**Why it happens:** ts-morph uses TypeScript's own printer.
**How to avoid:** Use `project.addSourceFileAtPath()` and only call `.saveSync()` after minimal targeted edits. Consider using `ManipulationSettings` to preserve existing formatting. Alternative: string manipulation with clear anchor patterns (e.g., insert before `<Route component={NotFound} />`) is acceptable for App.tsx since the pattern is stable.
**Warning signs:** `git diff` shows formatting-only changes across the entire file.

### Pitfall 5: Auto-installing shadcn Breaks the Build
**What goes wrong:** `npx shadcn@latest add [component]` may prompt interactively for overwrite confirmation if the component is already present.
**Why it happens:** shadcn CLI checks for existing files.
**How to avoid:** Before running `npx shadcn@latest add`, check if the component file already exists in `client/src/components/ui/`. Only call add for genuinely missing components. Pass `--overwrite` flag only if an upgrade is intentional.
**Warning signs:** `npx shadcn@latest add` process hangs waiting for stdin.

### Pitfall 6: Base Branch Selection (D-16)
**What goes wrong:** Branching from `main` when the new pages use `CompanyGate` or `use-company` — these are on `feature/company-system` and not yet merged. The integrated pages would fail to compile on main.
**Why it happens:** `feature/company-system` adds `company-guard.tsx` and `use-company.ts` which are in `.gitignore` untracked files on main.
**How to avoid:** At pipeline start, check: (1) does `client/src/lib/company-guard.tsx` exist? (2) does `client/src/hooks/use-company.ts` exist? If both present, branch from `feature/company-system`. Check git status of those files on main vs feature branches.
**Warning signs:** TypeScript compile error: "Cannot find module '@/lib/company-guard'".

### Pitfall 7: Sidebar Uses Remix Icons, Not Lucide
**What goes wrong:** D-09 says "picks an appropriate Lucide icon" but the existing sidebar.tsx uses `<i className="ri-*-line">` remix icon classes, not `<LucideIcon />` JSX components.
**Why it happens:** The two icon libraries coexist in the project. CONTEXT.md references Lucide generally, but sidebar uses remixicon.
**How to avoid:** Nav injector should match the existing sidebar pattern — use remix icon class strings (e.g., `ri-bar-chart-line`) not `import { BarChart } from "lucide-react"`. Prompt Claude to select from the remixicon icon set when generating nav item icon classes.

---

## Code Examples

Verified from codebase inspection:

### Existing Route Pattern (App.tsx)

```typescript
// Standard company-gated page route
<ProtectedRoute path="/reports">
  {() => (
    <CompanyGate>
      <ReportsPage />
    </CompanyGate>
  )}
</ProtectedRoute>

// Standalone page (no CompanyGate, e.g. company-setup)
<ProtectedRoute path="/company-setup" component={CompanySetupPage} />
```

### Existing Nav Item Pattern (sidebar.tsx)

```tsx
<li>
  <Link href="/reports">
    <div className={cn(
      "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
      location === "/reports"
        ? "bg-blue-50 text-primary font-medium"
        : "hover:bg-gray-100 text-gray-700"
    )}>
      <i className="ri-bar-chart-line"></i>
      <span>Reports</span>
    </div>
  </Link>
</li>
```

### Existing Page File Pattern (from dashboard.tsx)

```typescript
import { Layout } from "@/components/layout";
// ...component imports

export default function Dashboard() {
  return (
    <Layout title="Dashboard">
      {/* content */}
    </Layout>
  );
}
```

### Installed shadcn/ui Component Inventory (complete)

All 45 components already installed in `client/src/components/ui/`:

```
accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb,
button, calendar, card, carousel, chart, checkbox, collapsible, command,
context-menu, dialog, drawer, dropdown-menu, form, hover-card, input,
input-otp, label, menubar, navigation-menu, pagination, popover, progress,
radio-group, resizable, scroll-area, select, separator, sheet, sidebar,
skeleton, slider, switch, table, tabs, textarea, toast, toaster, toggle,
toggle-group, tooltip
```

No auto-install is expected for standard SaaS pages. The `auto-install` path (D-03) handles edge cases where Stitch generates a pattern needing a component not in this list.

### Reading Phase 3 Output from DB

```typescript
import { db } from "../../server/db.js";
import { pipelinePages } from "@shared/design-schema.js";
import { UiGenPhaseOutputSchema } from "@shared/design-schema.js";
import { eq, and } from "drizzle-orm";

const pages = await db
  .select()
  .from(pipelinePages)
  .where(
    and(
      eq(pipelinePages.runId, runId),
      eq(pipelinePages.phase, "ui-gen"),
      eq(pipelinePages.status, "complete"),
    )
  );

for (const page of pages) {
  const uiGenOutput = UiGenPhaseOutputSchema.parse(JSON.parse(page.output!));
  // uiGenOutput.htmlUrl — fetch HTML from this (check expiry)
  // uiGenOutput.screenshotUrl — for display in skill output
  // uiGenOutput.approved — should always be true (complete status implies approval)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Router v5/v6 | Wouter 3.3.5 | This project's choice | Wouter uses `<Switch>/<Route>` not `<Routes>/<Route>` — injection code must target Wouter API |
| Class-based React components | Functional components + hooks | React 16.8+ | All generated code should be functional components, never class components |
| Custom CSS / CSS modules | Tailwind utility classes | Project standard | No CSS files — styling is always Tailwind classes inline |
| Direct Radix primitives | shadcn/ui wrappers | Phase 1 decision | Import from `@/components/ui/*`, never directly from `@radix-ui/*` |

**Deprecated/outdated:**
- `react-router-dom`: Not installed. Do not import or recommend.
- CSS files for page styling: Not the pattern. Tailwind only.
- JSDoc comments: Not in codebase convention. Use inline comments only.

---

## Open Questions

1. **ts-morph formatting preservation**
   - What we know: ts-morph can reformat files when saving; App.tsx has 190 lines with precise formatting
   - What's unclear: Whether ts-morph's ManipulationSettings can fully preserve the existing style, or whether a string-based anchor approach is more reliable for this specific file
   - Recommendation: Use string-based insertion for App.tsx (find `<Route component={NotFound} />` as anchor, insert above it) — simpler and safer for a file with a stable, predictable structure. Use ts-morph for more complex cases.

2. **Stitch HTML URL freshness**
   - What we know: Phase 3 stores presigned S3 URLs; these expire
   - What's unclear: Whether Phase 4 will run immediately after Phase 3 or hours/days later
   - Recommendation: Plan for URL expiry as the common case, not the exception. Add a preflight check at pipeline start that fetches all HTML URLs and caches the content locally (or re-fetches from Stitch if expired).

3. **Conflict detection complexity for smart-merge**
   - What we know: D-10 offers AI smart-merge as an option; AI merge only runs when user explicitly picks it
   - What's unclear: How to implement AI smart-merge — it requires sending both the existing page and the new generated page to Claude with a "reconcile these" prompt
   - Recommendation: Smart-merge implementation can be a separate module invoked only when user picks option 2. Scope the MVP to replace/skip — smart-merge is a thin wrapper with a clear prompt.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All modules | Yes | v24.14.0 | — |
| npm | Package installs | Yes | 11.9.0 | — |
| git | GIT-01/02/03 | Yes | 2.53.0.windows.2 | — |
| gh (GitHub CLI) | GIT-03 PR creation | Verify at runtime | — | Manual PR instructions printed |
| npx (shadcn CLI) | D-03 auto-install | Yes (via npm 11+) | — | Manual install instructions |
| ts-morph | Route injection | Not installed (NEW) | — | String-based App.tsx editing |
| DATABASE_URL | Pipeline state reads | Yes (Neon) | — | — |
| AI_INTEGRATIONS_ANTHROPIC_API_KEY | HTML-to-shadcn rewrite | Yes | — | Pipeline blocked — required |

**Missing dependencies with no fallback:**
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` — required for D-01 HTML translation. Pipeline cannot proceed without it.

**Missing dependencies with fallback:**
- `ts-morph` — needs install (`npm install ts-morph`). String-based App.tsx editing is a viable fallback.
- `gh` CLI — if unavailable, print PR creation instructions instead of auto-creating.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test -- --reporter=verbose tests/unit/code-integrator/` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTG-01 | brownfield-audit returns typed inventory | unit | `npm test -- tests/unit/code-integrator/brownfield-audit.test.ts` | Wave 0 |
| INTG-02 | html-to-shadcn rejects data-fetching code | unit | `npm test -- tests/unit/code-integrator/html-to-shadcn.test.ts` | Wave 0 |
| INTG-03 | page-writer creates file at correct path with default export | unit | `npm test -- tests/unit/code-integrator/page-writer.test.ts` | Wave 0 |
| INTG-04 | route-injector adds ProtectedRoute + CompanyGate to App.tsx | unit | `npm test -- tests/unit/code-integrator/route-injector.test.ts` | Wave 0 |
| INTG-05 | nav-injector adds li entry to sidebar.tsx ul block | unit | `npm test -- tests/unit/code-integrator/nav-injector.test.ts` | Wave 0 |
| GIT-01 | git-workflow creates branch off correct base | unit (mock) | `npm test -- tests/unit/code-integrator/git-workflow.test.ts` | Wave 0 |
| GIT-02 | git-workflow commits only relevant files | unit (mock) | included in git-workflow.test.ts | Wave 0 |
| GIT-03 | git-workflow pushes and returns PR URL | unit (mock) | included in git-workflow.test.ts | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- tests/unit/code-integrator/`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/code-integrator/brownfield-audit.test.ts` — covers INTG-01
- [ ] `tests/unit/code-integrator/html-to-shadcn.test.ts` — covers INTG-02
- [ ] `tests/unit/code-integrator/page-writer.test.ts` — covers INTG-03
- [ ] `tests/unit/code-integrator/route-injector.test.ts` — covers INTG-04
- [ ] `tests/unit/code-integrator/nav-injector.test.ts` — covers INTG-05
- [ ] `tests/unit/code-integrator/git-workflow.test.ts` — covers GIT-01/02/03
- [ ] `lib/code-integrator/types.ts` — shared types used across all modules

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `client/src/App.tsx`, `client/src/components/sidebar.tsx`, `client/src/components/layout.tsx`, `client/src/lib/protected-route.tsx`, `client/src/lib/company-guard.tsx` — all routing, nav, and guard patterns verified from source
- `shared/spec-schema.ts` — PageSpecFull type, route field shape verified from source
- `shared/design-schema.ts` — UiGenPhaseOutputSchema, pipelinePages table structure verified from source
- `lib/ui-generator/types.ts` — DmTokenRow, ReviewScore types verified from source
- `.claude/skills/saas-dev/ui-generator/SKILL.md` — Phase 3 output contract verified (htmlUrl presigned URL pitfall documented)
- `client/src/components/ui/` directory listing — all 45 installed shadcn components verified from filesystem
- `vitest.config.ts` — test framework config verified from source

### Secondary (MEDIUM confidence)
- ts-morph documentation (TypeScript AST manipulation) — verified via npm registry; current version 23.x; well-maintained
- remixicon vs lucide usage difference in sidebar.tsx vs layout.tsx — verified by direct code inspection

### Tertiary (LOW confidence)
- Stitch presigned URL expiry timing — documented in ui-generator SKILL.md as known pitfall; exact expiry window not confirmed by AWS S3 configuration inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified as installed or available; ts-morph is the only new dependency
- Architecture: HIGH — all integration points verified from actual source files; no guessing at API shapes
- Pitfalls: HIGH (Pitfalls 1, 3, 6, 7 verified from source) / MEDIUM (Pitfall 4 ts-morph formatting — common knowledge, not tested in this project)

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable stack, 30-day window appropriate)
