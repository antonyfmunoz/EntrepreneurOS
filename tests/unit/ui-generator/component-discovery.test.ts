import { describe, it, expect, vi } from "vitest";
import {
  discoverComponents,
  formatDiscoveryForPrompt,
} from "../../../lib/ui-generator/component-discovery.js";
import type { ComponentDiscoveryResult } from "../../../lib/ui-generator/types.js";

// ─── Tests ────────────────────────────────────────────────────────────────────
//
// NOTE: Per Plan 03-07, component-discovery now queries ALL components — the
// "simple vs complex" distinction was removed. Stitch generates better output
// when every component (Button, Input, Badge included) has concrete registry
// references attached. The tests below were updated to match the new contract.

describe("discoverComponents", () => {
  it("Test 1: every component is recorded in queriedComponents (no skip list)", async () => {
    const mockMcp = vi.fn().mockResolvedValue(null);

    const result = await discoverComponents(["DataTable", "Button"], mockMcp);

    expect(result.queriedComponents).toContain("DataTable");
    expect(result.queriedComponents).toContain("Button");
    expect(result.skippedComponents).toHaveLength(0);
  });

  it("Test 2: simple components are queried, not skipped", async () => {
    const mockMcp = vi.fn().mockResolvedValue(null);

    const result = await discoverComponents(["Button", "Input", "Badge"], mockMcp);

    expect(result.queriedComponents).toHaveLength(3);
    expect(result.queriedComponents).toContain("Button");
    expect(result.queriedComponents).toContain("Input");
    expect(result.queriedComponents).toContain("Badge");
    expect(result.skippedComponents).toHaveLength(0);
  });

  it("Test 5: handles MCP tool errors gracefully — returns partial results, never throws", async () => {
    const mockMcp = vi.fn().mockRejectedValue(new Error("MCP tool not available"));

    // Should NOT throw
    const result = await discoverComponents(["DataTable", "KanbanBoard"], mockMcp);

    expect(result.queriedComponents).toContain("DataTable");
    expect(result.queriedComponents).toContain("KanbanBoard");
    // References may be empty because all calls failed
    expect(result.references).toBeInstanceOf(Array);
  });

  it("Test - without mcpInvoke returns empty references but records queriedComponents", async () => {
    const result = await discoverComponents(["DataTable", "Calendar"]);

    expect(result.queriedComponents).toContain("DataTable");
    expect(result.queriedComponents).toContain("Calendar");
    expect(result.references).toHaveLength(0);
  });

  it("Test - with successful mock mcpInvoke returns references from all three sources", async () => {
    const mockMcp = vi.fn().mockImplementation((toolName: string) => {
      if (toolName === "shadcn_search") {
        return Promise.resolve({ code: "const DataTable = ...", description: "shadcn data table" });
      }
      if (toolName === "mcp__magic21__21st_magic_component_inspiration") {
        return Promise.resolve({ description: "visual data table", url: "https://21st.dev/example" });
      }
      if (toolName === "mcp__magicui__searchRegistryItems") {
        return Promise.resolve({ description: "animated table", code: "const MagicTable = ..." });
      }
      return Promise.resolve(null);
    });

    const result = await discoverComponents(["DataTable"], mockMcp);

    expect(result.queriedComponents).toContain("DataTable");
    expect(result.references.length).toBeGreaterThan(0);

    const sources = result.references.map((r) => r.source);
    expect(sources).toContain("shadcn");
    expect(sources).toContain("21st-dev");
    expect(sources).toContain("magicui");
  });
});

describe("formatDiscoveryForPrompt", () => {
  it("Test 3: non-empty results returns string containing 'Component Implementation References:'", () => {
    const result: ComponentDiscoveryResult = {
      references: [
        {
          componentName: "DataTable",
          source: "shadcn",
          description: "A data table component",
          codeSnippet: "export const DataTable = () => <table/>;",
        },
      ],
      queriedComponents: ["DataTable"],
      skippedComponents: [],
    };

    const formatted = formatDiscoveryForPrompt(result);

    expect(formatted).toContain("Component Implementation References:");
    expect(formatted).toContain("DataTable");
  });

  it("Test 4: empty references returns empty string", () => {
    const result: ComponentDiscoveryResult = {
      references: [],
      queriedComponents: [],
      skippedComponents: ["Button"],
    };

    const formatted = formatDiscoveryForPrompt(result);

    expect(formatted).toBe("");
  });

  it("Test 7: truncates individual code snippets to 500 chars in the output", () => {
    const longCode = "x".repeat(1000);
    const result: ComponentDiscoveryResult = {
      references: [
        {
          componentName: "DataTable",
          source: "shadcn",
          codeSnippet: longCode,
        },
      ],
      queriedComponents: ["DataTable"],
      skippedComponents: [],
    };

    const formatted = formatDiscoveryForPrompt(result);

    // The code section should not contain the full 1000-char string
    // It should be truncated to 500 chars
    expect(formatted).not.toContain("x".repeat(501));
    // But it should contain some of the code
    expect(formatted).toContain("x".repeat(10));
  });

  it("Test 8: maxChars parameter truncates total output and appends truncation notice", () => {
    const result: ComponentDiscoveryResult = {
      references: [
        { componentName: "DataTable", source: "shadcn", description: "A".repeat(200) },
        { componentName: "KanbanBoard", source: "21st-dev", description: "B".repeat(200) },
        { componentName: "Calendar", source: "magicui", description: "C".repeat(200) },
      ],
      queriedComponents: ["DataTable", "KanbanBoard", "Calendar"],
      skippedComponents: [],
    };

    const formatted = formatDiscoveryForPrompt(result, 100);

    expect(formatted.length).toBeLessThanOrEqual(100 + 50); // buffer for truncation notice
    expect(formatted).toContain("truncated");
  });
});
