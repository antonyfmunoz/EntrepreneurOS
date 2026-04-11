// lib/code-integrator/brownfield-planner.ts
//
// Phase B of brownfield-aware integration. Given the spec's declared pages and
// a brownfield inventory, the planner classifies every spec page into one of
// five integration modes and returns a per-page IntegrationPlan plus a
// human-readable PLAN.md body.
//
// Modes (least → most destructive):
//
//   skip        — spec page is functionally equivalent to something already in
//                 the repo at the same route AND same name; do nothing.
//   create      — nothing in the repo matches; write fresh, inject route+nav.
//   supplement  — spec page covers a different route but a related concept;
//                 keep both, no deletion. (e.g. /login alongside /auth)
//   replace     — an existing file holds the same route and the same conceptual
//                 page; overwrite it (and its old import/route entry) with the
//                 generated artifact. Old file gets deleted only after the
//                 dependency check passes.
//   merge       — an existing page has behavior worth preserving (Firebase
//                 OAuth, custom data fetching, etc.) AND the generated page
//                 covers it conceptually. Keep the existing logic, graft the
//                 generated UI on top. ALWAYS flagged for human review — the
//                 planner never auto-merges.
//
// The planner is intentionally LLM-free. Static analysis + naming heuristics
// are enough to make a defensible first cut; the user reviews PLAN.md and can
// override any row by hand before execution.

import type { PageSpecFull } from "@shared/spec-schema.js";
import type { BrownfieldInventory } from "./types.js";
import { toKebabCase } from "./page-writer.js";

export type IntegrationMode = "create" | "replace" | "merge" | "supplement" | "skip";

export interface IntegrationPlanEntry {
  /** Spec page being planned for. */
  pageName: string;
  /** Spec route. */
  route: string;
  /** Authoritative integration mode chosen by the planner. */
  mode: IntegrationMode;
  /** Computed kebab filename (without extension) the page would land at. */
  targetFile: string;
  /** Existing brownfield file the planner thinks this page corresponds to (if any). */
  existingFile: string | null;
  /** Existing brownfield route the planner thinks this page corresponds to (if any). */
  existingRoute: string | null;
  /**
   * One-sentence rationale — surfaced in PLAN.md so the user can audit each
   * decision without re-deriving it.
   */
  rationale: string;
  /**
   * True when the mode demands human review before execution. The orchestrator
   * MUST refuse to execute a plan with any unresolved review flag.
   */
  needsReview: boolean;
}

export interface IntegrationPlan {
  entries: IntegrationPlanEntry[];
  /**
   * Existing brownfield pages that no spec page mapped to. Useful so the user
   * can decide whether to delete orphaned pages by hand.
   */
  orphanPages: Array<{ fileName: string; route: string | null }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  // "Auth Page" / "auth-page" / "AuthPage" → "auth"
  return name
    .replace(/[-_\s]+/g, "")
    .replace(/page$/i, "")
    .toLowerCase();
}

function expectedTargetFile(pageName: string): string {
  const kebab = toKebabCase(pageName);
  return kebab.endsWith("-page") ? `${kebab}.tsx` : `${kebab}-page.tsx`;
}

// Behavior fingerprints we look for in existing page source. When the
// planner is fed page contents and finds any of these, it flags the page
// for `merge` rather than blind overwrite — these are signals that real
// behavior would be lost.
const MERGE_FINGERPRINTS = [
  /firebase\/auth/i,
  /signInWith(Popup|Redirect)/i,
  /useMutation|useQuery/i,
  /apiRequest\(/i,
];

// ─── Public API ──────────────────────────────────────────────────────────────

export interface PlannerInput {
  specPages: PageSpecFull[];
  inventory: BrownfieldInventory;
  /**
   * Optional map of existing-page-fileName → its source contents. When
   * present, the planner inspects the source for behavior fingerprints
   * (Firebase auth, custom data fetching) to choose merge vs replace.
   */
  pageSources?: Record<string, string>;
  /**
   * Optional per-page mode overrides keyed by spec page name. When the
   * default heuristic flags a page for merge review (needsReview=true), the
   * caller can inject an explicit decision here — typically `skip` to
   * preserve the existing file, or `replace` to force overwrite after a
   * human has decided the existing behavior is disposable.
   *
   * Overrides ALWAYS clear `needsReview`, and the rationale is updated to
   * note that it came from an override. This is the documented escape
   * hatch for unblocking integration runs without loosening the default
   * merge-safety heuristic.
   */
  overrides?: Record<string, IntegrationMode>;
}

export function planBrownfieldIntegration(input: PlannerInput): IntegrationPlan {
  const { specPages, inventory, pageSources = {}, overrides = {} } = input;

  // Build lookup tables off the inventory.
  const routesByPath = new Map(
    inventory.existingRoutes.map((r) => [r.path, r]),
  );
  const pagesByNormName = new Map<string, (typeof inventory.existingPages)[number]>();
  for (const p of inventory.existingPages) {
    pagesByNormName.set(normalizeName(p.fileName.replace(/\.tsx?$/, "")), p);
    if (p.exportName) pagesByNormName.set(normalizeName(p.exportName), p);
  }

  const claimedExistingFiles = new Set<string>();
  const entries: IntegrationPlanEntry[] = [];

  for (const page of specPages) {
    const targetFile = expectedTargetFile(page.name);
    const targetRouteMatch = routesByPath.get(page.route) ?? null;
    const normSpecName = normalizeName(page.name);
    const nameMatch = pagesByNormName.get(normSpecName) ?? null;

    let mode: IntegrationMode;
    let existingFile: string | null = null;
    let existingRoute: string | null = null;
    let rationale: string;
    let needsReview = false;

    if (!targetRouteMatch && !nameMatch) {
      mode = "create";
      rationale = "No existing file or route matches — fresh creation.";
    } else if (targetRouteMatch && nameMatch && targetRouteMatch.componentName === nameMatch.exportName) {
      // Same route AND same component already in place — strongest signal
      // that the previous run already integrated this exact page.
      mode = "skip";
      existingFile = nameMatch.filePath;
      existingRoute = targetRouteMatch.path;
      rationale = "Already wired: route and component identifier both match the existing repo.";
    } else if (targetRouteMatch) {
      // Same route is held by a differently-named page. Behavior fingerprint
      // check decides merge vs replace.
      existingRoute = targetRouteMatch.path;
      const existingFileName = targetRouteMatch.filePath.split(/[\\/]/).pop() ?? "";
      existingFile = targetRouteMatch.filePath;
      const src = pageSources[existingFileName] ?? "";
      if (src && MERGE_FINGERPRINTS.some((re) => re.test(src))) {
        mode = "merge";
        needsReview = true;
        rationale =
          `Existing ${existingFileName} owns ${page.route} and contains behavior ` +
          `(Firebase auth, data fetching, or mutations) that would be lost on overwrite. ` +
          `Flagged for human merge review.`;
      } else {
        mode = "replace";
        rationale =
          `Existing ${existingFileName} owns ${page.route} but holds no detectable ` +
          `behavior worth preserving — generated page replaces it.`;
      }
      claimedExistingFiles.add(existingFileName);
    } else if (nameMatch) {
      // Name matches but the route is different — supplement (keep both).
      existingFile = nameMatch.filePath;
      mode = "supplement";
      rationale =
        `Existing ${nameMatch.fileName} matches the spec page name but lives at a ` +
        `different route. Both are kept — generated page is added at ${page.route}.`;
      claimedExistingFiles.add(nameMatch.fileName);
    } else {
      // Defensive default.
      mode = "create";
      rationale = "Falling back to create — no overlap detected.";
    }

    // Apply explicit override if the caller supplied one. Overrides ALWAYS
    // win over the heuristic result and ALWAYS clear needsReview — the
    // caller has already decided.
    const override = overrides[page.name];
    if (override && override !== mode) {
      rationale =
        `Override applied via OVERRIDES.json: ${mode}${needsReview ? " (needs review)" : ""} → ${override}. ` +
        `Original rationale: ${rationale}`;
      mode = override;
      needsReview = false;
    } else if (override && override === mode && needsReview) {
      rationale = `Override applied via OVERRIDES.json: confirmed ${mode}, review waived. ${rationale}`;
      needsReview = false;
    }

    entries.push({
      pageName: page.name,
      route: page.route,
      mode,
      targetFile,
      existingFile,
      existingRoute,
      rationale,
      needsReview,
    });
  }

  // Anything in the inventory's existingPages we didn't claim is an orphan
  // worth surfacing — the user may want to delete it manually.
  const orphanPages: IntegrationPlan["orphanPages"] = [];
  for (const p of inventory.existingPages) {
    if (claimedExistingFiles.has(p.fileName)) continue;
    const matchedRoute =
      inventory.existingRoutes.find((r) =>
        r.filePath.endsWith(p.fileName),
      )?.path ?? null;
    orphanPages.push({ fileName: p.fileName, route: matchedRoute });
  }

  return { entries, orphanPages };
}

// ─── PLAN.md rendering ───────────────────────────────────────────────────────

const MODE_ICON: Record<IntegrationMode, string> = {
  create: "✨",
  replace: "♻",
  merge: "⚠",
  supplement: "+",
  skip: "·",
};

export function renderIntegrationPlanMarkdown(plan: IntegrationPlan): string {
  const lines: string[] = [];
  lines.push("# Brownfield Integration Plan");
  lines.push("");
  lines.push(
    "Generated by the integration phase before any files are written. Review " +
      "every entry — anything flagged with ⚠ requires a human merge decision " +
      "and will block the run until resolved.",
  );
  lines.push("");

  // Counts
  const counts: Record<IntegrationMode, number> = {
    create: 0,
    replace: 0,
    merge: 0,
    supplement: 0,
    skip: 0,
  };
  for (const e of plan.entries) counts[e.mode]++;

  lines.push("## Summary");
  lines.push("");
  lines.push(`- ✨ create:     ${counts.create}`);
  lines.push(`- ♻ replace:    ${counts.replace}`);
  lines.push(`- ⚠ merge:      ${counts.merge}  (needs review)`);
  lines.push(`- + supplement: ${counts.supplement}`);
  lines.push(`- · skip:       ${counts.skip}`);
  lines.push("");

  lines.push("## Per-page decisions");
  lines.push("");
  for (const e of plan.entries) {
    lines.push(`### ${MODE_ICON[e.mode]} ${e.pageName} → \`${e.route}\``);
    lines.push("");
    lines.push(`- **mode**: \`${e.mode}\`${e.needsReview ? "  ⚠ needs review" : ""}`);
    lines.push(`- **target file**: \`${e.targetFile}\``);
    if (e.existingFile) lines.push(`- **existing file**: \`${e.existingFile}\``);
    if (e.existingRoute) lines.push(`- **existing route**: \`${e.existingRoute}\``);
    lines.push(`- **why**: ${e.rationale}`);
    lines.push("");
  }

  if (plan.orphanPages.length > 0) {
    lines.push("## Orphan pages (no spec entry maps to these)");
    lines.push("");
    lines.push(
      "These files exist in `client/src/pages/` but no spec page mapped to " +
        "them. The planner does not delete orphans automatically — review " +
        "and remove by hand if they are obsolete.",
    );
    lines.push("");
    for (const o of plan.orphanPages) {
      lines.push(`- \`${o.fileName}\`${o.route ? ` (routed at \`${o.route}\`)` : ""}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
