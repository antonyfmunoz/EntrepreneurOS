import { writeFile, access } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import pLimit from "p-limit";

const execAsync = promisify(exec);

// ─── toKebabCase ──────────────────────────────────────────────────────────────

// Converts PascalCase or camelCase to kebab-case
// "ReportsPage" -> "reports-page"
// "UserSettings" -> "user-settings"
// "CRM" -> "c-r-m"
export function toKebabCase(name: string): string {
  return name
    .replace(/([A-Z])/g, "-$1")
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
// Throws if file already exists and overwrite is not set (D-10 conflict detection).
// Pass overwrite=true only after user has confirmed "replace" resolution (D-10).
export async function writePage(options: {
  projectRoot: string;
  pageName: string;
  tsxContent: string;
  overwrite?: boolean;
}): Promise<string> {
  const { projectRoot, pageName, tsxContent, overwrite = false } = options;
  const filePath = getPageFilePath(projectRoot, pageName);

  // Check for existing file
  try {
    await access(filePath);
    // File exists
    if (!overwrite) {
      throw new Error(
        `Page file already exists: ${filePath}. Use checkFileConflict() + conflict resolution (D-10) before overwriting.`
      );
    }
    // overwrite=true — proceed with replacement (user chose "replace" per D-10)
  } catch (err) {
    // Re-throw our own error (already-exists guard)
    if (err instanceof Error && err.message.includes("already exists")) {
      throw err;
    }
    // access() threw because file doesn't exist — safe to write
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
