import { describe, it, expect } from "vitest";
import {
  exportDesignMD,
  generateDesignMDFromTokens,
  parseDesignMD,
  importDesignMD,
} from "../../../lib/stitch/design-md.js";
import type { DmTokenRow } from "../../../lib/ui-generator/types.js";

const fullTokens = {
  id: 1,
  projectId: "p1",
  version: 1,
  colorPrimary: "#0a0a0f",
  colorSecondary: "#1a1a2e",
  colorBackground: "#000000",
  colorSurface: "#111111",
  colorText: "#ffffff",
  colorAccent: "#6366f1",
  typeFontFamily: "Inter",
  typeSizeBase: "16",
  typeScaleRatio: "1.25",
  spacingUnit: "8",
  borderRadius: "8",
  shadowStyle: "subtle",
  componentDirection: "tactical luxury cards",
  createdAt: new Date(),
} as unknown as DmTokenRow;

describe("generateDesignMDFromTokens", () => {
  it("renders all token fields", () => {
    const md = generateDesignMDFromTokens(fullTokens);
    expect(md).toContain("Primary: #0a0a0f");
    expect(md).toContain("Font Family: Inter");
    expect(md).toContain("tactical luxury cards");
  });

  it("renders empty placeholder when tokens null", () => {
    expect(generateDesignMDFromTokens(null)).toContain("No tokens available");
  });
});

describe("parseDesignMD", () => {
  it("round-trips tokens through generate -> parse", () => {
    const md = generateDesignMDFromTokens(fullTokens);
    const parsed = parseDesignMD(md);
    expect(parsed.colorPrimary).toBe("#0a0a0f");
    expect(parsed.colorAccent).toBe("#6366f1");
    expect(parsed.fontHeading).toBe("Inter");
    expect(parsed.componentDirection).toBe("tactical luxury cards");
  });

  it("ignores 'not set' placeholders", () => {
    const md = "## Colors\n- Primary: not set\n";
    const parsed = parseDesignMD(md);
    expect(parsed.colorPrimary).toBeUndefined();
  });
});

describe("exportDesignMD", () => {
  it("returns content + parsed tokens", async () => {
    const result = await exportDesignMD("p1", fullTokens);
    expect(result.content).toContain("Design System");
    expect(result.tokens.colorPrimary).toBe("#0a0a0f");
  });

  it("handles null tokens without throwing", async () => {
    const result = await exportDesignMD("p1", null);
    expect(result.content).toContain("No tokens");
  });
});

describe("importDesignMD", () => {
  it("is a no-op stub that resolves", async () => {
    await expect(importDesignMD("p1", "# Design System")).resolves.toBeUndefined();
  });
});
