import { readFile, writeFile } from "fs/promises";
import type { RouteInjectionInput, RouteConflict } from "./types.js";
import type { BrownfieldInventory } from "./types.js";

// Inserts a ProtectedRoute (with optional CompanyGate) into App.tsx and adds the import.
// Uses string-based insertion — App.tsx has a stable, predictable structure.
export async function injectRoute(input: RouteInjectionInput): Promise<void> {
  let content = await readFile(input.appTsxPath, "utf-8");

  // 1. Build import line and insert after last existing import
  const importLine = `import ${input.componentName} from "${input.importPath}";`;
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
                <${input.componentName} />
              </CompanyGate>
            )}
          </ProtectedRoute>`;
  } else {
    routeJsx = `          <ProtectedRoute path="${input.routePath}" component={${input.componentName}} />`;
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
