import { writeFile, access } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import pLimit from "p-limit";

const execAsync = promisify(exec);

// ─── toKebabCase ──────────────────────────────────────────────────────────────

// Converts PascalCase or camelCase to kebab-case, handling acronyms correctly.
// "ReportsPage"    -> "reports-page"
// "UserSettings"   -> "user-settings"
// "CRMPage"        -> "crm-page"
// "APIKeys"        -> "api-keys"
// "URLShortener"   -> "url-shortener"
// "CRM"            -> "crm"
export function toKebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
    .replace(/^-/, "");
}

// ─── getPageFilePath ──────────────────────────────────────────────────────────

// Compute the target file path for a page name.
// If kebab name already ends with "-page", don't double-append it.
function getPageFilePath(projectRoot: string, pageName: string): string {
  const kebab = toKebabCase(pageName);
  const fileName = kebab.endsWith("-page") ? `${kebab}.tsx` : `${kebab}-page.tsx`;
  return join(projectRoot, "client", "src", "pages", fileName);
}

// ─── checkFileConflict ────────────────────────────────────────────────────────

// Detects whether a page file already exists at the computed path (D-10).
// SKILL.md orchestrator calls this BEFORE writePage to detect conflicts.
export async function checkFileConflict(options: {
  projectRoot: string;
  pageName: string;
}): Promise<{ exists: boolean; existingPath: string | null }> {
  const filePath = getPageFilePath(options.projectRoot, options.pageName);
  try {
    await access(filePath);
    return { exists: true, existingPath: filePath };
  } catch {
    return { exists: false, existingPath: null };
  }
}

// ─── writePage ────────────────────────────────────────────────────────────────

// Writes a translated TSX page file to client/src/pages/{kebab-name}-page.tsx.
//
// Collision behavior depends on `mode`:
//   - mode omitted or "create":  throw if the target file already exists.
//     Caller is expected to have checked conflicts (D-10) first and picked
//     either "replace" (with overwrite=true) or "skip".
//   - mode "replace" + overwrite=true: overwrite the target.
//   - mode "supplement": if the target file already exists, write to
//     `<name>-page-new.tsx` instead (or `<name>-new.tsx` if the page name
//     already ends in "-page"). This is the documented escape hatch for
//     the integration planner's supplement mode, where we've chosen to
//     keep both the existing and generated pages but the expected target
//     filename happens to match the existing one.
//
//     Pages written to `*-new.tsx` REQUIRE manual review. The integration
//     planner picked supplement because the existing file owns the same
//     spec page name — the user must hand-merge valuable logic from the
//     old page into the new one (or vice versa) and delete the loser.
//
// Returns the absolute path actually written.
export type WritePageMode = "create" | "replace" | "merge" | "supplement" | "skip";

export async function writePage(options: {
  projectRoot: string;
  pageName: string;
  tsxContent: string;
  overwrite?: boolean;
  mode?: WritePageMode;
}): Promise<string> {
  const { projectRoot, pageName, tsxContent, overwrite = false, mode } = options;
  const filePath = getPageFilePath(projectRoot, pageName);

  // Check for existing file
  let exists = false;
  try {
    await access(filePath);
    exists = true;
  } catch {
    exists = false;
  }

  if (exists && !overwrite) {
    if (mode === "supplement") {
      // Supplement-mode collision fallback: write to a sibling `-new.tsx`
      // file so both pages coexist. The new one is flagged for manual
      // review (see header comment on writePage).
      const kebab = toKebabCase(pageName);
      const newKebab = kebab.endsWith("-page") ? `${kebab}-new` : `${kebab}-page-new`;
      const newPath = join(projectRoot, "client", "src", "pages", `${newKebab}.tsx`);

      // Prepend a review banner so the hand-merge step is obvious when a
      // developer opens the file.
      const bannered =
        `// ⚠ MANUAL REVIEW REQUIRED\n` +
        `// This file was written in supplement mode because an existing page at\n` +
        `// the same kebab filename (${filePath.split(/[\\/]/).pop()}) already owns\n` +
        `// the spec page name. Both pages now exist.\n` +
        `//\n` +
        `// Hand-merge: pick which one is authoritative, port any missing logic\n` +
        `// from the other, wire the winner into the route, and delete the loser.\n` +
        `// The integration planner will not repeat this collision once one file\n` +
        `// is deleted.\n\n` +
        tsxContent;

      await writeFile(newPath, bannered, "utf-8");
      return newPath;
    }

    throw new Error(
      `Page file already exists: ${filePath}. Use checkFileConflict() + conflict resolution (D-10) before overwriting.`
    );
  }

  await writeFile(filePath, tsxContent, "utf-8");
  return filePath;
}

// ─── ensureShadcnComponents ───────────────────────────────────────────────────

// Compares extractedImports against installedComponents.
// Installs any missing components via npx shadcn@latest add (D-03).
// Uses p-limit(1) to avoid concurrent npx conflicts.
// Returns array of component names that were newly installed.
export async function ensureShadcnComponents(options: {
  projectRoot: string;
  extractedImports: string[];
  installedComponents: string[];
}): Promise<string[]> {
  const { projectRoot, extractedImports, installedComponents } = options;

  const installedSet = new Set(installedComponents);
  const missing = extractedImports.filter((c) => !installedSet.has(c));

  if (missing.length === 0) {
    return [];
  }

  // Sequential installs to avoid concurrent npx conflicts (p-limit(1))
  const limit = pLimit(1);
  const installed: string[] = [];

  await Promise.all(
    missing.map((component) =>
      limit(async () => {
        await execAsync(`npx shadcn@latest add ${component} --overwrite`, {
          cwd: projectRoot,
        });
        installed.push(component);
      })
    )
  );

  return installed;
}
