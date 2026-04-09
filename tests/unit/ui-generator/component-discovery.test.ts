import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  discoverComponents,
  formatDiscoveryForPrompt,
  computeSpecHash,
  validateCacheFreshness,
} from "../../../lib/ui-generator/component-discovery.js";
import type { ComponentDiscoveryResult } from "../../../lib/ui-generator/types.js";

// ─── Tests ────────────────────────────────────────────────────────────────────
//
// component-discovery is a pure cache reader. The cache is populated by the
// saas-dev:warm-cache skill inside a Claude Code session. These tests validate
// cache matching, prompt formatting, spec hashing, and freshness validation.

describe("computeSpecHash", () => {
  it("produces deterministic hash for same components regardless of order", () => {
    const hash1 = computeSpecHash(["Button", "Card", "Input"]);
    const hash2 = computeSpecHash(["Input", "Button", "Card"]);
    expect(hash1).toBe(hash2);
  });

  it("is case-insensitive", () => {
    const hash1 = computeSpecHash(["Button", "CARD"]);
    const hash2 = computeSpecHash(["button", "card"]);
    expect(hash1).toBe(hash2);
  });

  it("deduplicates component names", () => {
    const hash1 = computeSpecHash(["Button", "Button", "Card"]);
    const hash2 = computeSpecHash(["Button", "Card"]);
    expect(hash1).toBe(hash2);
  });

  it("returns a 64-char hex SHA-256 string", () => {
    const hash = computeSpecHash(["Button"]);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("validateCacheFreshness", () => {
  // These tests rely on the actual cache file on disk. Since the cache file
  // has an empty spec_hash and a stale timestamp, freshness checks will fail
  // as expected in CI/local — proving the gate works.

  it("returns not fresh when cache spec_hash does not match", () => {
    const result = validateCacheFreshness(["NonExistentComponent123"]);
    expect(result.fresh).toBe(false);
    expect(result.reason).toBeDefined();
  });
});

describe("discoverComponents", () => {
  it("returns matched components from cache", () => {
    const result = discoverComponents(["Button", "Card"]);

    expect(result.queriedComponents).toContain("Button");
    expect(result.queriedComponents).toContain("Card");
    expect(result.skippedComponents).toHaveLength(0);
  });

  it("returns empty references for components not in cache", () => {
    const result = discoverComponents(["SomeUnknownWidget"]);

    expect(result.queriedComponents).toContain("SomeUnknownWidget");
    expect(result.references).toHaveLength(0);
  });

  it("every component name is recorded in queriedComponents", () => {
    const result = discoverComponents(["DataTable", "Button"]);

    expect(result.queriedComponents).toContain("DataTable");
    expect(result.queriedComponents).toContain("Button");
    expect(result.skippedComponents).toHaveLength(0);
  });
});

describe("formatDiscoveryForPrompt", () => {
  it("non-empty results returns string containing 'Component Implementation References:'", () => {
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

  it("empty references returns empty string", () => {
    const result: ComponentDiscoveryResult = {
      references: [],
      queriedComponents: [],
      skippedComponents: [],
    };

    const formatted = formatDiscoveryForPrompt(result);

    expect(formatted).toBe("");
  });

  it("truncates individual code snippets to 500 chars in the output", () => {
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

    expect(formatted).not.toContain("x".repeat(501));
    expect(formatted).toContain("x".repeat(10));
  });

  it("maxChars parameter truncates total output and appends truncation notice", () => {
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

    expect(formatted.length).toBeLessThanOrEqual(100 + 50);
    expect(formatted).toContain("truncated");
  });
});
