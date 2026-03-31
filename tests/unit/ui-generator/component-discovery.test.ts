import { describe, it, expect, vi } from "vitest";
import {
  discoverComponents,
  formatDiscoveryForPrompt,
  COMPLEX_COMPONENT_PATTERNS,
} from "../../../lib/ui-generator/component-discovery.js";
import type { ComponentDiscoveryResult } from "../../../lib/ui-generator/types.js";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("COMPLEX_COMPONENT_PATTERNS", () => {
  it("Test 6: includes DataTable, KanbanBoard, Calendar, Chart, Timeline, CommandPalette", () => {
    const required = ["DataTable", "KanbanBoard", "Calendar", "Chart", "Timeline", "CommandPalette"];
    for (const name of required) {
      expect(COMPLEX_COMPONENT_PATTERNS).toContain(name);
    }
  });
});

describe("discoverComponents", () => {
  it("Test 1: complex components are queried and simple ones are skipped", async () => {
    const mockMcp = vi.fn().mockResolvedValue(null);

    const result = await discoverComponents(["DataTable", "Button"], mockMcp);

    expect(result.queriedComponents).toContain("DataTable");
    expect(result.skippedComponents).toContain("Button");
    expect(result.queriedComponents).not.toContain("Button");
    expect(result.skippedComponents).not.toContain("DataTable");
  });

  it("Test 2: simple components (Button, Input, Badge) are skipped, not queried", async () => {
    const mockMcp = vi.fn().mockResolvedValue(null);

    const result = await discoverComponents(["Button", "Input", "Badge"], mockMcp);

    expect(result.queriedComponents).toHaveLength(0);
    expect(result.skippedComponents).toHaveLength(3);
    expect(result.skippedComponents).toContain("Button");
    expect(result.skippedComponents).toContain("Input");
    expect(result.skippedComponents).toContain("Badge");
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
