import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMessagesCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate },
  })),
}));

import {
  queryFrontendDesignSkill,
  queryUXProSkill,
  extractIndustry,
  enrichOnce,
} from "../../../lib/ui-generator/skill-enrichment.js";

function textResponse(text: string): object {
  return { content: [{ type: "text", text }] };
}

beforeEach(() => {
  mockMessagesCreate.mockReset();
});

describe("queryFrontendDesignSkill", () => {
  it("returns the model's text on success", async () => {
    mockMessagesCreate.mockResolvedValue(textResponse("use 8px grid, generous whitespace"));
    const result = await queryFrontendDesignSkill({
      productType: "crm",
      components: ["Button", "Card"],
      complexity: "medium",
      targetAudience: "sales teams",
    });
    expect(result).toContain("8px grid");
  });

  it("returns null and does not throw on API failure (fail-open)", async () => {
    mockMessagesCreate.mockRejectedValue(new Error("rate limited"));
    const result = await queryFrontendDesignSkill({
      productType: "crm",
      components: [],
      complexity: "low",
      targetAudience: "anyone",
    });
    expect(result).toBeNull();
  });

  it("returns null when content block is not text", async () => {
    mockMessagesCreate.mockResolvedValue({ content: [{ type: "tool_use" }] });
    const result = await queryFrontendDesignSkill({
      productType: "x",
      components: [],
      complexity: "low",
      targetAudience: "y",
    });
    expect(result).toBeNull();
  });
});

describe("queryUXProSkill", () => {
  it("parses PALETTE and FONTS from the response", async () => {
    mockMessagesCreate.mockResolvedValue(
      textResponse("PALETTE: Midnight Ops — primary #0a0a0f, secondary #1a1a2e, accent #6366f1\nFONTS: Space Grotesk / Inter")
    );
    const result = await queryUXProSkill({ productType: "saas", vibe: "tactical luxury" });
    expect(result.palette).toContain("Midnight Ops");
    expect(result.fonts).toBe("Space Grotesk / Inter");
  });

  it("returns {} on failure (fail-open)", async () => {
    mockMessagesCreate.mockRejectedValue(new Error("boom"));
    const result = await queryUXProSkill({ productType: "x", vibe: "y" });
    expect(result).toEqual({});
  });

  it("returns partial result if only one field present", async () => {
    mockMessagesCreate.mockResolvedValue(textResponse("PALETTE: Solo — #fff\n"));
    const result = await queryUXProSkill({ productType: "x", vibe: "y" });
    expect(result.palette).toContain("Solo");
    expect(result.fonts).toBeUndefined();
  });
});

describe("extractIndustry", () => {
  it("identifies known industries", () => {
    expect(extractIndustry("a fintech payment platform")).toBe("fintech");
    expect(extractIndustry("telehealth clinic management")).toBe("healthcare");
    expect(extractIndustry("b2b CRM for sales")).toBe("saas");
  });

  it("returns undefined for unknown / empty input", () => {
    expect(extractIndustry("")).toBeUndefined();
    expect(extractIndustry(null)).toBeUndefined();
    expect(extractIndustry("a thing for people")).toBeUndefined();
  });
});

describe("enrichOnce", () => {
  it("returns a SkillEnrichment with both fields populated on success", async () => {
    mockMessagesCreate
      .mockResolvedValueOnce(textResponse("design guidance text"))
      .mockResolvedValueOnce(textResponse("PALETTE: Foo — #fff\nFONTS: A / B"));
    const result = await enrichOnce({
      productType: "saas",
      components: ["Button"],
      complexity: "low",
      targetAudience: "ops",
      vibe: "minimal",
    });
    expect(result.designGuidance).toContain("design guidance");
    expect(result.uxGuidance.fonts).toBe("A / B");
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it("never throws when both queries fail", async () => {
    mockMessagesCreate.mockRejectedValue(new Error("nope"));
    const result = await enrichOnce({
      productType: "x",
      components: [],
      complexity: "low",
      targetAudience: "y",
      vibe: "z",
    });
    expect(result.designGuidance).toBeNull();
    expect(result.uxGuidance).toEqual({});
  });
});
