import type { ComponentDiscoveryResult, ComponentReference } from "./types.js";

// Per Plan 03-07: query registries for ALL components, not just "complex" ones.
// Button/Input/Card deserve production-grade shadcn/MagicUI references too — Stitch
// generates better output when it has concrete examples for every component.

// Max chars per individual code snippet -- prevents one component from dominating prompt
const MAX_SNIPPET_CHARS = 500;

/**
 * Discovers production-ready component implementations from multiple registries.
 *
 * Uses MCP tools when available. All registry calls are wrapped in try/catch --
 * missing tools, network errors, or malformed responses never crash the pipeline.
 *
 * @param componentNames - Component names from PageSpec.components
 * @param mcpInvoke - Injectable MCP tool invocation function for testing.
 *   In production, wired to Claude tool_use. In tests, a mock.
 */
export async function discoverComponents(
  componentNames: string[],
  mcpInvoke?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>
): Promise<ComponentDiscoveryResult> {
  const references: ComponentReference[] = [];
  const queriedComponents: string[] = [];
  const skippedComponents: string[] = [];

  for (const name of componentNames) {
    queriedComponents.push(name);

    if (!mcpInvoke) {
      continue;
    }

    // Query shadcn registry
    try {
      const shadcnResult = await mcpInvoke("shadcn_search", { query: name });
      if (shadcnResult && typeof shadcnResult === "object") {
        references.push({
          componentName: name,
          source: "shadcn",
          codeSnippet: typeof (shadcnResult as any).code === "string"
            ? ((shadcnResult as any).code as string).slice(0, MAX_SNIPPET_CHARS)
            : undefined,
          description: typeof (shadcnResult as any).description === "string"
            ? (shadcnResult as any).description as string
            : undefined,
        });
      }
    } catch {
      // shadcn MCP not available -- continue gracefully
    }

    // Query 21st.dev for visual inspiration
    try {
      const inspirationResult = await mcpInvoke(
        "mcp__magic21__21st_magic_component_inspiration",
        { message: `${name} component for SaaS application` }
      );
      if (inspirationResult && typeof inspirationResult === "object") {
        references.push({
          componentName: name,
          source: "21st-dev",
          description: typeof (inspirationResult as any).description === "string"
            ? (inspirationResult as any).description as string
            : undefined,
          visualRef: typeof (inspirationResult as any).url === "string"
            ? (inspirationResult as any).url as string
            : undefined,
        });
      }
    } catch {
      // 21st.dev MCP not available -- continue gracefully
    }

    // Query MagicUI for animated component examples
    try {
      const magicResult = await mcpInvoke(
        "mcp__magicui__searchRegistryItems",
        { query: name }
      );
      if (magicResult && typeof magicResult === "object") {
        references.push({
          componentName: name,
          source: "magicui",
          description: typeof (magicResult as any).description === "string"
            ? (magicResult as any).description as string
            : undefined,
          codeSnippet: typeof (magicResult as any).code === "string"
            ? ((magicResult as any).code as string).slice(0, MAX_SNIPPET_CHARS)
            : undefined,
        });
      }
    } catch {
      // MagicUI MCP not available -- continue gracefully
    }
  }

  return { references, queriedComponents, skippedComponents };
}

/**
 * Formats discovery results into a prompt section for Stitch.
 * Returns empty string if no references found.
 * Truncates total output to maxChars to prevent prompt bloat.
 *
 * @param result - ComponentDiscoveryResult from discoverComponents
 * @param maxChars - Maximum characters for the formatted output (default 8000).
 *   This leaves room for spec + tokens + direction within the MAX_PROMPT_TOTAL_CHARS budget.
 */
export function formatDiscoveryForPrompt(
  result: ComponentDiscoveryResult,
  maxChars: number = 8000
): string {
  if (result.references.length === 0) {
    return "";
  }

  const lines: string[] = ["Component Implementation References:"];

  const byComponent = new Map<string, ComponentReference[]>();
  for (const ref of result.references) {
    const existing = byComponent.get(ref.componentName) ?? [];
    existing.push(ref);
    byComponent.set(ref.componentName, existing);
  }

  for (const [name, refs] of byComponent) {
    lines.push(`\n${name}:`);
    for (const ref of refs) {
      lines.push(`  [${ref.source}]${ref.description ? ` ${ref.description}` : ""}`);
      if (ref.codeSnippet) {
        const snippet = ref.codeSnippet.length > MAX_SNIPPET_CHARS
          ? ref.codeSnippet.slice(0, MAX_SNIPPET_CHARS) + "..."
          : ref.codeSnippet;
        lines.push(`  Code example:\n${snippet}`);
      }
    }
  }

  let output = lines.join("\n");
  if (output.length > maxChars) {
    output = output.slice(0, maxChars) + "\n... (truncated to fit prompt budget)";
  }
  return output;
}
