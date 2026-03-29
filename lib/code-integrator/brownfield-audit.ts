import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { BrownfieldInventorySchema, type BrownfieldInventory } from "./types.js";

// ─── Route Parsing ────────────────────────────────────────────────────────────

// Splits App.tsx content into per-ProtectedRoute blocks for accurate parsing
function extractProtectedRouteBlocks(content: string): string[] {
  const blocks: string[] = [];
  // Find all <ProtectedRoute ... /> self-closing and <ProtectedRoute ...>...</ProtectedRoute> blocks
  let i = 0;
  while (i < content.length) {
    const start = content.indexOf("<ProtectedRoute", i);
    if (start === -1) break;

    // Find the end of this route block — either /> or matching closing ProtectedRoute
    let depth = 0;
    let j = start;
    let inBlock = false;
    let selfClosing = false;

    // Check if self-closing: scan forward to find > or />
    const tagEnd = content.indexOf(">", start);
    const selfClose = content.indexOf("/>", start);

    if (selfClose !== -1 && selfClose < tagEnd) {
      // Self-closing: <ProtectedRoute ... />
      blocks.push(content.slice(start, selfClose + 2));
      i = selfClose + 2;
      continue;
    }

    // Multi-line block: walk forward tracking depth
    j = tagEnd + 1;
    depth = 1;
    while (j < content.length && depth > 0) {
      const nextOpen = content.indexOf("<ProtectedRoute", j);
      const nextClose = content.indexOf("</ProtectedRoute>", j);
      const selfCloseInner = content.indexOf("/>", j);

      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        // Nested ProtectedRoute (unlikely but handle it)
        depth++;
        j = nextOpen + 1;
      } else {
        depth--;
        if (depth === 0) {
          blocks.push(content.slice(start, nextClose + "</ProtectedRoute>".length));
          i = nextClose + "</ProtectedRoute>".length;
          break;
        }
        j = nextClose + 1;
      }
    }

    if (depth > 0) break; // Malformed — stop
  }

  return blocks;
}

function parseRoutes(appTsxContent: string, importMap: Record<string, string>): BrownfieldInventory["existingRoutes"] {
  const routes: BrownfieldInventory["existingRoutes"] = [];
  const blocks = extractProtectedRouteBlocks(appTsxContent);

  for (const block of blocks) {
    // Extract path
    const pathMatch = block.match(/<ProtectedRoute\s+path="([^"]+)"/);
    if (!pathMatch) continue;
    const path = pathMatch[1];

    const hasCompanyGate = block.includes("<CompanyGate>");

    // Extract component name — two patterns:
    // 1. component={ComponentName} for standalone
    // 2. <ComponentName /> or <ComponentName> inside children for CompanyGate
    let componentName = "";
    const componentPropMatch = block.match(/component=\{(\w+)\}/);
    if (componentPropMatch) {
      componentName = componentPropMatch[1];
    } else {
      // Extract first component inside the block content (after CompanyGate or as direct child)
      const childComponentMatch = block.match(/<CompanyGate>\s*<(\w+)/);
      if (childComponentMatch) {
        componentName = childComponentMatch[1];
      } else {
        // Fallback: first JSX component in the block
        const fallbackMatch = block.match(/>\s*\(\s*\([^)]*\)\s*=>\s*\(\s*<(\w+)/);
        if (fallbackMatch) {
          componentName = fallbackMatch[1];
        }
      }
    }

    if (!componentName) continue;

    const filePath = importMap[componentName] || "";

    routes.push({
      path,
      componentName,
      filePath,
      isProtected: true,
      hasCompanyGate,
    });
  }

  return routes;
}

function buildImportMap(appTsxContent: string): Record<string, string> {
  const map: Record<string, string> = {};
  // Match: import ComponentName from "@/pages/..."  or  import { ComponentName } from "..."
  const defaultImport = /import\s+(\w+)\s+from\s+"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = defaultImport.exec(appTsxContent)) !== null) {
    const name = match[1];
    const rawPath = match[2];
    // Normalize: @/pages/dashboard -> client/src/pages/dashboard.tsx
    const normalized = rawPath
      .replace(/^@\//, "client/src/")
      .replace(/\.js$/, ".ts")
      + (rawPath.endsWith(".tsx") || rawPath.endsWith(".ts") ? "" : ".tsx");
    map[name] = normalized;
  }
  return map;
}

// ─── Nav Parsing ──────────────────────────────────────────────────────────────

function parseNavItems(sidebarContent: string): BrownfieldInventory["existingNavItems"] {
  const items: BrownfieldInventory["existingNavItems"] = [];

  // Match each <li> block containing a Link
  const liBlocks = sidebarContent.match(/<li>[\s\S]*?<\/li>/g) || [];

  for (const block of liBlocks) {
    const hrefMatch = block.match(/href="([^"]+)"/);
    const iconMatch = block.match(/className="(ri-[^"\s]+)"/);
    const spanMatch = block.match(/<span>([^<]+)<\/span>/);

    if (hrefMatch && iconMatch && spanMatch) {
      items.push({
        label: spanMatch[1].trim(),
        href: hrefMatch[1],
        iconClass: iconMatch[1],
      });
    }
  }

  return items;
}

// ─── Page Export Extraction ───────────────────────────────────────────────────

async function extractExportName(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath, "utf8");
    // Read up to first 20 lines for the export declaration
    const lines = content.split("\n").slice(0, 20).join("\n");
    const match = lines.match(/export\s+default\s+(?:function\s+)?(\w+)/);
    if (match) return match[1];

    // Fallback: look for const export
    const constMatch = lines.match(/export\s+default\s+(\w+)/);
    if (constMatch) return constMatch[1];
  } catch {
    // Ignore read errors
  }
  return "";
}

// ─── Main Audit Function ──────────────────────────────────────────────────────

export async function auditBrownfield(projectRoot: string): Promise<BrownfieldInventory> {
  // 1. Parse App.tsx for routes
  const appTsxPath = join(projectRoot, "client", "src", "App.tsx");
  let appTsxContent = "";
  try {
    appTsxContent = await readFile(appTsxPath, "utf8");
  } catch {
    // App.tsx not found — empty routes
  }

  const importMap = buildImportMap(appTsxContent);
  const existingRoutes = parseRoutes(appTsxContent, importMap);

  // 2. List pages
  const pagesDir = join(projectRoot, "client", "src", "pages");
  let pageFiles: string[] = [];
  try {
    const entries = await readdir(pagesDir);
    pageFiles = entries.filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
  } catch {
    // Directory not found
  }

  const existingPages = await Promise.all(
    pageFiles.map(async (fileName) => {
      const filePath = join("client", "src", "pages", fileName);
      const exportName = await extractExportName(join(projectRoot, filePath));
      return { fileName, filePath, exportName };
    })
  );

  // 3. List installed shadcn components (ui/ subdirectory)
  const uiDir = join(projectRoot, "client", "src", "components", "ui");
  let uiFiles: string[] = [];
  try {
    const entries = await readdir(uiDir);
    uiFiles = entries.filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
  } catch {
    // Directory not found
  }
  const installedShadcnComponents = uiFiles.map((f) => f.replace(/\.tsx?$/, ""));

  // 4. Parse sidebar.tsx for nav items
  const sidebarPath = join(projectRoot, "client", "src", "components", "sidebar.tsx");
  let sidebarContent = "";
  try {
    sidebarContent = await readFile(sidebarPath, "utf8");
  } catch {
    // sidebar.tsx not found
  }
  const existingNavItems = parseNavItems(sidebarContent);

  // 5. List shared components (top-level .tsx in components/, excluding ui/ subdirectory)
  const componentsDir = join(projectRoot, "client", "src", "components");
  let sharedFiles: string[] = [];
  try {
    const entries = await readdir(componentsDir);
    sharedFiles = entries.filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
  } catch {
    // Directory not found
  }
  const existingSharedComponents = sharedFiles;

  // 6. List hooks
  const hooksDir = join(projectRoot, "client", "src", "hooks");
  let hookFiles: string[] = [];
  try {
    const entries = await readdir(hooksDir);
    hookFiles = entries.filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
  } catch {
    // Directory not found
  }
  const existingHooks = hookFiles;

  // Validate and return
  return BrownfieldInventorySchema.parse({
    existingRoutes,
    existingPages,
    installedShadcnComponents,
    existingNavItems,
    existingSharedComponents,
    existingHooks,
  });
}
