// lib/agents/component-library-agent.ts
// Wraps the shared-component-builder with design system context and
// interface extraction. Builds all shared components, then extracts
// TypeScript interfaces from the generated files and persists them
// in the ArtifactStore for downstream page agents to consume.

import fs from "node:fs";
import path from "node:path";
import { buildSharedComponents, SHARED_COMPONENTS } from "../react-gen/shared-component-builder.js";
import {
  autoFixImports,
  validateImports,
  scanForNullUnsafePatterns,
  runTscCheck,
} from "../react-gen/component-writer.js";
import { ArtifactStore } from "./artifact-store.js";
import type { ComponentInterface, SystemArchitecture, DesignSystem } from "./types.js";
import type { ProjectBrief } from "../intake/types.js";

// ─── Interface Extraction ────────────────────────────────────────────────────

interface ExtractedProp {
  name: string;
  type: string;
  optional: boolean;
}

function extractPropsFromBlock(block: string): ExtractedProp[] {
  const props: ExtractedProp[] = [];
  // Match each line inside the interface/type body: name?: type; or name: type;
  const propPattern = /^\s*(\w+)(\?)?:\s*(.+?);?\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = propPattern.exec(block)) !== null) {
    const name = match[1];
    const optional = match[2] === "?";
    const type = match[3].replace(/;$/, "").trim();
    // Skip index signatures and methods
    if (name === "children" || /^\[/.test(name)) continue;
    props.push({ name, type, optional });
  }
  return props;
}

function extractComponentInterface(
  fileContent: string,
  filePath: string,
  componentName: string,
): ComponentInterface {
  // Extract props interface: interface FooProps { ... }
  const interfacePattern = /(?:export\s+)?interface\s+(\w+Props)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;
  const typePattern = /(?:export\s+)?type\s+(\w+Props)\s*=\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;

  let props: ExtractedProp[] = [];
  let propsTypeName = "";

  // Try interface first
  let propsMatch = interfacePattern.exec(fileContent);
  if (propsMatch) {
    propsTypeName = propsMatch[1];
    props = extractPropsFromBlock(propsMatch[2]);
  } else {
    // Fall back to type alias
    propsMatch = typePattern.exec(fileContent);
    if (propsMatch) {
      propsTypeName = propsMatch[1];
      props = extractPropsFromBlock(propsMatch[2]);
    }
  }

  // Extract export name: export default function Foo or export function Foo
  let exportName = componentName;
  const defaultExportMatch = /export\s+default\s+function\s+(\w+)/.exec(fileContent);
  if (defaultExportMatch) {
    exportName = defaultExportMatch[1];
  } else {
    const namedExportMatch = /export\s+function\s+(\w+)/.exec(fileContent);
    if (namedExportMatch) {
      exportName = namedExportMatch[1];
    }
  }

  // Extract dependsOn from import statements
  const dependsOn: string[] = [];
  const importPattern = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  let importMatch: RegExpExecArray | null;
  while ((importMatch = importPattern.exec(fileContent)) !== null) {
    const source = importMatch[1];
    // Only track internal component dependencies, not external packages
    if (source.startsWith("@/components/") && !source.includes("/ui/")) {
      // Extract the component file name from the import path
      const segments = source.split("/");
      const last = segments[segments.length - 1];
      dependsOn.push(last.replace(/\.tsx?$/, ""));
    } else if (source.startsWith("@/lib/")) {
      const segments = source.split("/");
      const last = segments[segments.length - 1];
      dependsOn.push(last.replace(/\.ts$/, ""));
    }
  }

  return {
    name: componentName,
    filePath,
    exportName,
    props: props.map((p) => ({
      name: p.name,
      type: p.type,
      optional: p.optional,
    })),
    dependsOn,
  };
}

// ─── Agent Entry Point ───────────────────────────────────────────────────────

export async function runComponentLibraryAgent(
  brief: ProjectBrief,
  store: ArtifactStore,
): Promise<Record<string, string>> {
  const projectRoot = store.getProjectRoot();

  // Read design context from the store (informational — building delegates to
  // the existing shared-component-builder which has its own design token injection)
  const architecture = store.getArchitecture();
  const designSystem = store.getDesignSystem();

  if (architecture) {
    console.log(
      `  [component-library] Architecture loaded: ${architecture.pages.length} pages, ` +
      `${architecture.componentHierarchy.length} hierarchy entries`,
    );
  }
  if (designSystem) {
    console.log(
      `  [component-library] Design system loaded: ${designSystem.aesthetic} aesthetic, ` +
      `${designSystem.colorMode} mode`,
    );
  }

  // Delegate the actual build to the existing shared-component-builder.
  // It handles generation, validation (autoFixImports, validateImports,
  // scanForNullUnsafePatterns, runTscCheck), and fix loops internally.
  console.log("  [component-library] Building shared components...");
  const componentPaths = await buildSharedComponents(brief, projectRoot);

  // Extract TypeScript interfaces from each built component file
  console.log("  [component-library] Extracting component interfaces...");
  const interfaces: ComponentInterface[] = [];

  for (const def of SHARED_COMPONENTS) {
    const filePath = componentPaths[def.name];
    if (!filePath || !fs.existsSync(filePath)) {
      console.warn(`  ⚠ [component-library] Missing file for ${def.name}: ${filePath}`);
      continue;
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const iface = extractComponentInterface(fileContent, filePath, def.name);
    interfaces.push(iface);

    console.log(
      `  ✓ [component-library] ${def.name}: export=${iface.exportName}, ` +
      `${iface.props.length} props, ${iface.dependsOn.length} deps`,
    );
  }

  // Persist to artifact store for downstream agents (page builder, QA)
  store.setComponentInterfaces(interfaces);
  store.setComponentPaths(componentPaths);

  console.log(
    `  [component-library] Done: ${interfaces.length} interfaces extracted, ` +
    `${Object.keys(componentPaths).length} components built`,
  );

  return componentPaths;
}
