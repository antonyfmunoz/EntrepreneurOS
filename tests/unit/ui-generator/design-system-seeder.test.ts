import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Anthropic SDK ───────────────────────────────────────────────────────

const mockMessagesCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockMessagesCreate,
      },
    })),
  };
});

// ─── Import under test ────────────────────────────────────────────────────────

import {
  seedDesignSystem,
  seedToTokens,
} from "../../../lib/ui-generator/design-system-seeder.js";
import { DEFAULT_DESIGN_SEED } from "../../../lib/ui-generator/types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeClaudeResponse(json: object): object {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(json),
      },
    ],
  };
}

const VALID_SEED_RESPONSE = {
  colorPalette: {
    primary: "#1a1a2e",
    secondary: "#16213e",
    background: "#0f0f23",
    surface: "#1a1a3e",
    text: "#e4e4e7",
    accent: "#6366f1",
  },
  fontPairing: {
    heading: "Inter",
    body: "Inter",
  },
  spacingSystem: {
    unit: 4,
    borderRadius: 8,
  },
  componentDirection: "clean minimal cards with subtle shadows",
};

describe("seedDesignSystem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a valid DesignSystemSeed shape from mock Claude response", async () => {
    mockMessagesCreate.mockResolvedValueOnce(makeClaudeResponse(VALID_SEED_RESPONSE));

    const result = await seedDesignSystem({
      projectDescription: "A SaaS task management app",
      brandDescription: "dark tactical luxury",
    });

    expect(result.colorPalette.primary).toBe("#1a1a2e");
    expect(result.colorPalette.secondary).toBe("#16213e");
    expect(result.fontPairing.heading).toBe("Inter");
    expect(result.fontPairing.body).toBe("Inter");
    expect(result.spacingSystem.unit).toBe(4);
    expect(result.spacingSystem.borderRadius).toBe(8);
    expect(typeof result.componentDirection).toBe("string");
  });

  it("returns non-null color values for brand description 'dark tactical luxury'", async () => {
    mockMessagesCreate.mockResolvedValueOnce(makeClaudeResponse(VALID_SEED_RESPONSE));

    const result = await seedDesignSystem({
      projectDescription: "A platform for entrepreneurs",
      brandDescription: "dark tactical luxury",
      targetAudience: "Founders 25-40",
    });

    expect(result.colorPalette.primary).toBeTruthy();
    expect(result.colorPalette.background).toBeTruthy();
    expect(result.colorPalette.text).toBeTruthy();
  });

  it("returns DEFAULT_DESIGN_SEED when Claude returns malformed JSON (fail-closed)", async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "not valid json at all {broken}" }],
    });

    const result = await seedDesignSystem({
      projectDescription: "A SaaS app",
    });

    expect(result).toEqual(DEFAULT_DESIGN_SEED);
  });

  it("returns DEFAULT_DESIGN_SEED when Claude API throws (fail-closed)", async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error("API timeout"));
    mockMessagesCreate.mockRejectedValueOnce(new Error("API timeout"));
    mockMessagesCreate.mockRejectedValueOnce(new Error("API timeout"));

    const result = await seedDesignSystem({
      projectDescription: "A SaaS app",
    });

    expect(result).toEqual(DEFAULT_DESIGN_SEED);
  });
});

describe("seedToTokens", () => {
  it("maps colorPalette.primary to colorPrimary", () => {
    const result = seedToTokens(VALID_SEED_RESPONSE);
    expect(result.colorPrimary).toBe("#1a1a2e");
  });

  it("maps colorPalette.secondary to colorSecondary", () => {
    const result = seedToTokens(VALID_SEED_RESPONSE);
    expect(result.colorSecondary).toBe("#16213e");
  });

  it("maps colorPalette.background to colorBackground", () => {
    const result = seedToTokens(VALID_SEED_RESPONSE);
    expect(result.colorBackground).toBe("#0f0f23");
  });

  it("maps fontPairing.body to typeFontFamily", () => {
    const result = seedToTokens(VALID_SEED_RESPONSE);
    expect(result.typeFontFamily).toBe("Inter");
  });

  it("maps spacingSystem.unit to spacingUnit as string", () => {
    const result = seedToTokens(VALID_SEED_RESPONSE);
    expect(result.spacingUnit).toBe("4");
  });

  it("maps spacingSystem.borderRadius to borderRadius as string", () => {
    const result = seedToTokens(VALID_SEED_RESPONSE);
    expect(result.borderRadius).toBe("8");
  });
});
