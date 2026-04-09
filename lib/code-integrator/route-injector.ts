import { readFile, writeFile } from "fs/promises";
import type { RouteInjectionInput, RouteConflict, RouteInjectionResult } from "./types.js";
import type { BrownfieldInventory } from "./types.js";

// Extract the set of default-import identifiers already declared in a file.
// Only `import Foo from "..."` style — named imports don't collide with our
// generated component identifiers.
function extractDefaultImportNames(source: string): Set<string> {
  const re = /^\s*import\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+["'][^"']+["']/gm;
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    names.add(m[1]);
  }
  return names;
}

// Inserts a ProtectedRoute (with optional CompanyGate) into App.tsx and adds the import.
// Uses string-based insertion — App.tsx has a stable, predictable structure.
export async function injectRoute(
  input: RouteInjectionInput
): Promise<RouteInjectionResult> {
  let content = await readFile(input.appTsxPath, "utf-8");

  // Bug 6: collision-aware naming. If the generated component identifier
  // clashes with an existing default import in App.tsx, append a "Page"
  // suffix and rewrite the generated page file's export to match.
  const existingNames = extractDefaultImportNames(content);
  let finalName = input.componentName;
  let renamed = false;
  if (existingNames.has(finalName)) {
    const candidate = finalName.endsWith("Page") ? `${finalName}View` : `${finalName}Page`;
    finalName = candidate;
    renamed = true;

    if (input.pageFilePath) {
      try {
        let pageSrc = await readFile(input.pageFilePath, "utf-8");
        const originalName = input.componentName;
        // Replace export default function NAME(...)
        pageSrc = pageSrc.replace(
          new RegExp(`(export\\s+default\\s+function\\s+)${originalName}\\b`),
          `$1${finalName}`,
        );
        // Also handle the `function NAME(...) {} ... export default NAME;` form.
        pageSrc = pageSrc.replace(
          new RegExp(`(export\\s+default\\s+)${originalName}\\s*;`),
          `$1${finalName};`,
        );
        pageSrc = pageSrc.replace(
          new RegExp(`(function\\s+)${originalName}\\b`),
          `$1${finalName}`,
        );
        await writeFile(input.pageFilePath, pageSrc, "utf-8");
      } catch {
        // Non-fatal: if the file can't be read we still rename the App.tsx
        // side; the build will fail loudly rather than silently mis-wiring.
      }
    }
  }

  // 1. Build import line and insert after last existing import
  const importLine = `import ${finalName} from "${input.importPath}";`;
  const lastImportIndex = content.lastIndexOf("\nimport ");
  const endOfLastImport = content.indexOf("\n", lastImportIndex + 1);
  if (endOfLastImport === -1) {
    throw new Error("Cannot find last import line end in App.tsx");
  }
  content =
    content.slice(0, endOfLastImport + 1) +
    importLine +
    "\n" +
    content.slice(endOfLastImport + 1);

  // 2. Build route JSX block
  let routeJsx: string;
  if (input.wrapCompanyGate && !input.isStandalone) {
    routeJsx = `          <ProtectedRoute path="${input.routePath}">
            {() => (
              <CompanyGate>
                <${finalName} />
              </CompanyGate>
            )}
          </ProtectedRoute>`;
  } else {
    routeJsx = `          <ProtectedRoute path="${input.routePath}" component={${finalName}} />`;
  }

  // 3. Find the <Route component={NotFound} anchor and insert before it
  const notFoundAnchor = "<Route component={NotFound}";
  const anchorIndex = content.indexOf(notFoundAnchor);
  if (anchorIndex === -1) {
    throw new Error("Cannot find NotFound route anchor in App.tsx");
  }

  // Find the start of the line containing the anchor
  const lineStart = content.lastIndexOf("\n", anchorIndex);
  content =
    content.slice(0, lineStart + 1) +
    routeJsx +
    "\n" +
    content.slice(lineStart + 1);

  await writeFile(input.appTsxPath, content, "utf-8");

  return { componentName: finalName, renamed };
}

// Returns a RouteConflict when the given routePath collides with an existing route in the inventory.
// Returns null when no conflict is found.
export function detectRouteConflict(
  routePath: string,
  newComponentName: string,
  inventory: BrownfieldInventory,
): RouteConflict | null {
  const existing = inventory.existingRoutes.find((r) => r.path === routePath);
  if (!existing) return null;

  return {
    routePath,
    existingComponent: existing.componentName,
    existingFile: existing.filePath,
    newComponent: newComponentName,
  };
}
