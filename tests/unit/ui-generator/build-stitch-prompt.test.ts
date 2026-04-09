import { describe, it, expect } from "vitest";
import { buildStitchPrompt } from "../../../lib/ui-generator/build-stitch-prompt.js";
import type { PageSpecFull } from "@shared/spec-schema";
import { resolve } from "node:path";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const designSystemPath = resolve(process.cwd(), ".planning/design-system.md");

function makeSpec(overrides: Partial<PageSpecFull> = {}): PageSpecFull {
  return {
    name: "Dashboard",
    route: "/dashboard",
    purpose: "Main view",
    components: ["sidebar", "chart"],
    authLevel: "authenticated",
    priority: 1,
    dependsOn: [],
    specVersion: 1,
    source: "inferred",
    dataRequirements: [],
    apiEndpoints: [],
    validationRules: [],
    events: [],
    featureFlagCandidates: [],
    ...overrides,
  };
}

function makeTokens(overrides: Record<string, string | number | null> = {}): Record<string, string | number | null> {
  return {
    id: 1,
    projectId: "proj-1",
    version: 1,
    colorPrimary: "#1a1a2e",
    colorSecondary: "#16213e",
    colorBackground: "#0f3460",
    colorSurface: "#e94560",
    colorText: "#ffffff",
    colorAccent: "#f5a623",
    typeFontFamily: "Inter",
    typeSizeBase: 16,
    typeScaleRatio: 1.25,
    spacingUnit: 8,
    borderRadius: 8,
    shadowStyle: "elevated",
    createdAt: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildStitchPrompt", () => {
  it("Test 1: minimal spec with null tokens includes all core spec fields", () => {
    const spec = makeSpec();
    const result = buildStitchPrompt(spec, null, undefined, undefined, undefined, undefined, designSystemPath);

    expect(result).toContain("Dashboard");
    expect(result).toContain("Main view");
    expect(result).toContain("sidebar");
    expect(result).toContain("chart");
    expect(result).toContain("authentication");
  });

  it("Test 2: with tokens injects constraint text with token values", () => {
    const spec = makeSpec();
    const tokens = makeTokens();
    const result = buildStitchPrompt(spec, tokens as any, undefined, undefined, undefined, undefined, designSystemPath);

    expect(result).toContain("#1a1a2e");
    expect(result).toContain("Inter");
    // borderRadius: 8 — should appear as "8" (with or without "px")
    expect(result).toMatch(/8/);
  });

  it("Test 3: null tokens does NOT include visual constraints section", () => {
    const spec = makeSpec();
    const result = buildStitchPrompt(spec, null, undefined, undefined, undefined, undefined, designSystemPath);

    expect(result).not.toContain("Visual constraints");
    expect(result).not.toContain("must be followed");
  });

  it("Test 4: emptyState is included when provided", () => {
    const spec = makeSpec({ emptyState: "No projects yet" });
    const result = buildStitchPrompt(spec, null, undefined, undefined, undefined, undefined, designSystemPath);

    expect(result).toContain("No projects yet");
  });

  it("Test 5: priorScreenshotUrl triggers reference screenshot instruction", () => {
    const spec = makeSpec();
    const result = buildStitchPrompt(spec, null, "https://example.com/screenshot.png", undefined, undefined, undefined, designSystemPath);

    expect(result).toContain("Reference the visual style from the previously approved page screenshot.");
  });

  it("Test 6: authLevel=public does NOT include authentication text", () => {
    const spec = makeSpec({ authLevel: "public" });
    const result = buildStitchPrompt(spec, null, undefined, undefined, undefined, undefined, designSystemPath);

    expect(result).not.toContain("authentication");
  });

  it("Test 7: designSystemPath injects design system as first section", () => {
    const spec = makeSpec();
    const result = buildStitchPrompt(spec, null, undefined, undefined, undefined, undefined, designSystemPath);

    expect(result).toContain("DESIGN SYSTEM");
    expect(result).toContain("single source of truth");
    // Design system should appear before the page spec
    const dsIndex = result.indexOf("DESIGN SYSTEM");
    const specIndex = result.indexOf("Dashboard");
    expect(dsIndex).toBeLessThan(specIndex);
  });

  it("Test 8: missing designSystemPath does not inject design system section", () => {
    const spec = makeSpec();
    const result = buildStitchPrompt(spec, null);

    expect(result).not.toContain("DESIGN SYSTEM");
    // Core spec fields still present
    expect(result).toContain("Dashboard");
  });

  it("Test 9: brandVoice is injected when provided", () => {
    const spec = makeSpec();
    const result = buildStitchPrompt(spec, null, undefined, undefined, undefined, undefined, designSystemPath, "Bold, authoritative, tactical luxury.");

    expect(result).toContain("Brand Voice");
    expect(result).toContain("Bold, authoritative, tactical luxury.");
  });

  it("Test 10: brandVoice is omitted when undefined", () => {
    const spec = makeSpec();
    const result = buildStitchPrompt(spec, null, undefined, undefined, undefined, undefined, designSystemPath);

    expect(result).not.toContain("Brand Voice");
  });

  it("Test 11: brandVoice appears before page description", () => {
    const spec = makeSpec();
    const result = buildStitchPrompt(spec, null, undefined, undefined, undefined, undefined, designSystemPath, "Minimalist tone.");

    const voiceIndex = result.indexOf("Brand Voice");
    const specIndex = result.indexOf("Design a Dashboard");
    expect(voiceIndex).toBeLessThan(specIndex);
  });
});
