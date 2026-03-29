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
  mergeTokens,
  extractTokensFromHtml,
} from "../../../lib/ui-generator/extract-tokens.js";
import { MAX_HTML_FOR_EXTRACTION } from "../../../lib/ui-generator/types.js";

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

const VALID_EXTRACTION_RESPONSE = {
  tokens: {
    colorPrimary: "#1a1a2e",
    colorSecondary: "#ff6b6b",
    colorBackground: "#0f0f1a",
    colorSurface: "#1e1e2e",
    colorText: "#ffffff",
    colorAccent: "#7c3aed",
    typeFontFamily: "Inter",
    typeSizeBase: 16,
    typeScaleRatio: 1.25,
    spacingUnit: 8,
    borderRadius: 8,
    shadowStyle: "0 4px 6px -1px rgba(0,0,0,0.5)",
  },
  patterns: [
    {
      name: "card",
      variant: "metric",
      propsShape: "title, value, icon, trend",
      usageContext: "dashboard metric display",
      shadcnComponent: "Card",
    },
    {
      name: "button-primary",
      usageContext: "primary action trigger",
      shadcnComponent: "Button",
    },
  ],
};

// ─── Tests: mergeTokens (pure function) ──────────────────────────────────────

describe("mergeTokens", () => {
  it("Test 3: prior values NOT overwritten by null — nullish coalescing", () => {
    const prior = { colorPrimary: "#1a1a2e", typeFontFamily: "Inter" };
    const extracted = {
      colorPrimary: null,
      colorSecondary: "#ff6b6b",
      typeFontFamily: null,
    };
    const result = mergeTokens(prior, extracted);
    // prior values survive because extracted has null
    expect(result.colorPrimary).toBe("#1a1a2e");
    expect(result.typeFontFamily).toBe("Inter");
    // new values from extracted are included
    expect(result.colorSecondary).toBe("#ff6b6b");
  });

  it("Test 4: mergeTokens(null, newTokens) returns newTokens directly (page 1 case)", () => {
    const newTokens = {
      colorPrimary: "#7c3aed",
      typeFontFamily: "Sora",
      colorSecondary: null,
    };
    const result = mergeTokens(null, newTokens);
    expect(result.colorPrimary).toBe("#7c3aed");
    expect(result.typeFontFamily).toBe("Sora");
    // null stays null when prior is also null
    expect(result.colorSecondary).toBeNull();
  });

  it("mergeTokens preserves all token fields — never loses existing non-null prior values", () => {
    const prior = {
      colorPrimary: "#1a1a2e",
      colorBackground: "#0f0f1a",
      spacingUnit: 8,
      borderRadius: 6,
    };
    const extracted = {
      colorPrimary: null,
      colorBackground: null,
      colorSurface: "#1e1e2e",
      spacingUnit: null,
    };
    const result = mergeTokens(prior, extracted);
    expect(result.colorPrimary).toBe("#1a1a2e");
    expect(result.colorBackground).toBe("#0f0f1a");
    expect(result.colorSurface).toBe("#1e1e2e");
    // spacingUnit null in extracted, 8 in prior — prior wins
    expect(result.spacingUnit).toBe(8);
    // borderRadius not in extracted, still comes from prior
    expect(result.borderRadius).toBe(6);
  });
});

// ─── Tests: extractTokensFromHtml ────────────────────────────────────────────

describe("extractTokensFromHtml", () => {
  beforeEach(() => {
    mockMessagesCreate.mockReset();
  });

  it("Test 1: returns TokenExtractionResult with tokens + patterns from mock Claude response", async () => {
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse(VALID_EXTRACTION_RESPONSE));

    const result = await extractTokensFromHtml({
      htmlContent: "<html><body><div class='card'>Test</div></body></html>",
      projectId: "proj-1",
      priorTokens: null,
    });

    expect(result.tokens).toBeDefined();
    expect(result.patterns).toBeDefined();
    expect(result.patterns).toHaveLength(2);
    expect(result.patterns[0].name).toBe("card");
    expect(result.patterns[0].shadcnComponent).toBe("Card");
    expect(result.tokens.colorPrimary).toBe("#1a1a2e");
  });

  it("Test 2: truncates HTML input to MAX_HTML_FOR_EXTRACTION chars before sending to Claude", async () => {
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse(VALID_EXTRACTION_RESPONSE));

    const oversizedHtml = "x".repeat(MAX_HTML_FOR_EXTRACTION + 5000);

    await extractTokensFromHtml({
      htmlContent: oversizedHtml,
      projectId: "proj-1",
      priorTokens: null,
    });

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    const userContent = callArgs.messages[0].content as string;
    // HTML in the user message must be truncated
    expect(userContent.length).toBeLessThanOrEqual(MAX_HTML_FOR_EXTRACTION + 500);
    // The oversized string is definitely longer than any truncated result
    expect(userContent).not.toContain("x".repeat(MAX_HTML_FOR_EXTRACTION + 1000));
  });

  it("Test 5: extractTokensFromHtml returns patterns with name, variant, usageContext fields", async () => {
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse(VALID_EXTRACTION_RESPONSE));

    const result = await extractTokensFromHtml({
      htmlContent: "<html><body>content</body></html>",
      projectId: "proj-2",
      priorTokens: null,
    });

    expect(result.patterns[0]).toMatchObject({
      name: "card",
      variant: "metric",
      usageContext: "dashboard metric display",
    });
    expect(result.patterns[1]).toMatchObject({
      name: "button-primary",
      usageContext: "primary action trigger",
    });
  });

  it("Test 6: handles markdown-fenced JSON response from Claude via extractJsonFromResponse", async () => {
    const fencedResponse = {
      content: [
        {
          type: "text",
          text: "```json\n" + JSON.stringify(VALID_EXTRACTION_RESPONSE) + "\n```",
        },
      ],
    };
    mockMessagesCreate.mockResolvedValue(fencedResponse);

    const result = await extractTokensFromHtml({
      htmlContent: "<html><body>content</body></html>",
      projectId: "proj-3",
      priorTokens: null,
    });

    // Should parse successfully despite markdown fences
    expect(result.tokens.colorPrimary).toBe("#1a1a2e");
    expect(result.patterns).toHaveLength(2);
  });

  it("merges prior tokens with extracted — prior non-null values survive null extractions", async () => {
    // Claude returns null for colorPrimary (couldn't detect it)
    const responseWithNulls = {
      tokens: {
        ...VALID_EXTRACTION_RESPONSE.tokens,
        colorPrimary: null,
        typeFontFamily: null,
      },
      patterns: VALID_EXTRACTION_RESPONSE.patterns,
    };
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse(responseWithNulls));

    const result = await extractTokensFromHtml({
      htmlContent: "<html><body>content</body></html>",
      projectId: "proj-4",
      priorTokens: {
        colorPrimary: "#prior-color",
        typeFontFamily: "PriorFont",
      },
    });

    // Prior values survive the null extraction
    expect(result.tokens.colorPrimary).toBe("#prior-color");
    expect(result.tokens.typeFontFamily).toBe("PriorFont");
    // Non-null extracted values override prior nulls
    expect(result.tokens.colorSecondary).toBe("#ff6b6b");
  });
});
