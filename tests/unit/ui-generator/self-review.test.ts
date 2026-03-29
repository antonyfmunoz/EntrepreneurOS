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

import { selfReview } from "../../../lib/ui-generator/self-review.js";
import type { SelfReviewInput } from "../../../lib/ui-generator/self-review.js";
import { MAX_HTML_FOR_REVIEW } from "../../../lib/ui-generator/types.js";
import type { PageSpecFull } from "@shared/spec-schema.js";
import type { DmTokenRow } from "../../../lib/ui-generator/types.js";

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

const VALID_REVIEW_SCORE = {
  specCompliance: {
    score: 0.95,
    findings: ["All components present", "Auth gate correctly applied"],
  },
  visualConsistency: {
    score: 0.92,
    findings: ["Colors match token palette", "Font family consistent"],
  },
  structuralCompleteness: {
    score: 0.9,
    findings: ["Navigation present", "Semantic HTML used"],
  },
  contentQuality: {
    score: 0.93,
    findings: ["Appropriate labels", "No lorem ipsum in visible areas"],
  },
};

function makePageSpec(overrides: Partial<PageSpecFull> = {}): PageSpecFull {
  return {
    name: "Dashboard",
    route: "/dashboard",
    purpose: "Primary view for authenticated users showing key metrics",
    components: ["MetricsGrid", "RecentActivity", "QuickActions"],
    authLevel: "authenticated",
    priority: 2,
    dependsOn: ["/login"],
    specVersion: 1,
    source: "explicit",
    dataRequirements: [],
    apiEndpoints: [],
    validationRules: [],
    events: [],
    featureFlagCandidates: [],
    ...overrides,
  };
}

function makeDmTokenRow(overrides: Partial<DmTokenRow> = {}): DmTokenRow {
  return {
    id: 1,
    projectId: "proj-1",
    version: 1,
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
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeSelfReviewInput(overrides: Partial<SelfReviewInput> = {}): SelfReviewInput {
  return {
    htmlContent: "<html><body><div class='dashboard'>content</div></body></html>",
    screenshotUrls: ["https://stitch.example.com/screenshot/page1.png"],
    spec: makePageSpec(),
    tokens: makeDmTokenRow(),
    priorPatterns: [
      { name: "card", usageContext: "metric display" },
    ],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("selfReview", () => {
  beforeEach(() => {
    mockMessagesCreate.mockReset();
  });

  it("Test 1: returns valid ReviewScore with all 4 dimensions from mock Claude response", async () => {
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse(VALID_REVIEW_SCORE));

    const result = await selfReview(makeSelfReviewInput());

    expect(result).toBeDefined();
    expect(result.specCompliance).toBeDefined();
    expect(result.visualConsistency).toBeDefined();
    expect(result.structuralCompleteness).toBeDefined();
    expect(result.contentQuality).toBeDefined();

    // All scores must be between 0 and 1
    expect(result.specCompliance.score).toBeGreaterThanOrEqual(0);
    expect(result.specCompliance.score).toBeLessThanOrEqual(1);
    expect(result.visualConsistency.score).toBeGreaterThanOrEqual(0);
    expect(result.visualConsistency.score).toBeLessThanOrEqual(1);
    expect(result.structuralCompleteness.score).toBeGreaterThanOrEqual(0);
    expect(result.structuralCompleteness.score).toBeLessThanOrEqual(1);
    expect(result.contentQuality.score).toBeGreaterThanOrEqual(0);
    expect(result.contentQuality.score).toBeLessThanOrEqual(1);

    // Findings must be arrays
    expect(Array.isArray(result.specCompliance.findings)).toBe(true);
    expect(Array.isArray(result.visualConsistency.findings)).toBe(true);
    expect(Array.isArray(result.structuralCompleteness.findings)).toBe(true);
    expect(Array.isArray(result.contentQuality.findings)).toBe(true);
  });

  it("Test 2: sends PageSpec component list in the user message for spec compliance checking", async () => {
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse(VALID_REVIEW_SCORE));

    const spec = makePageSpec({
      components: ["MetricsGrid", "RecentActivity", "QuickActions"],
    });
    await selfReview(makeSelfReviewInput({ spec }));

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    const userMessage = callArgs.messages[0].content as string;

    expect(userMessage).toContain("MetricsGrid");
    expect(userMessage).toContain("RecentActivity");
    expect(userMessage).toContain("QuickActions");
  });

  it("Test 3: sends design tokens in the prompt when tokens are non-null (visual consistency)", async () => {
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse(VALID_REVIEW_SCORE));

    const tokens = makeDmTokenRow({ colorPrimary: "#7c3aed", typeFontFamily: "Sora" });
    await selfReview(makeSelfReviewInput({ tokens }));

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    const userMessage = callArgs.messages[0].content as string;

    expect(userMessage).toContain("#7c3aed");
    expect(userMessage).toContain("Sora");
  });

  it("Test 4: null tokens still produces valid ReviewScore (page 1 — no stored tokens)", async () => {
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse(VALID_REVIEW_SCORE));

    const result = await selfReview(makeSelfReviewInput({ tokens: null }));

    expect(result).toBeDefined();
    expect(result.specCompliance.score).toBeGreaterThanOrEqual(0);
    expect(result.visualConsistency.score).toBeGreaterThanOrEqual(0);
    expect(result.structuralCompleteness.score).toBeGreaterThanOrEqual(0);
    expect(result.contentQuality.score).toBeGreaterThanOrEqual(0);

    // User message should mention that no tokens exist
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    const userMessage = callArgs.messages[0].content as string;
    expect(userMessage).toContain("No design tokens");
  });

  it("Test 5: truncates HTML to MAX_HTML_FOR_REVIEW before sending to Claude", async () => {
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse(VALID_REVIEW_SCORE));

    // Use a unique marker string that only appears in the HTML content, not spec/token sections
    const uniqueMarker = "ZZZZ";
    const oversizedHtml = uniqueMarker + "a".repeat(MAX_HTML_FOR_REVIEW + 5000) + uniqueMarker;
    await selfReview(makeSelfReviewInput({ htmlContent: oversizedHtml }));

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    const userMessage = callArgs.messages[0].content as string;

    // The HTML section in the user message must be truncated.
    // The oversized HTML contains MAX_HTML_FOR_REVIEW + 5000 + 8 chars (markers),
    // after truncation it should only contain MAX_HTML_FOR_REVIEW chars.
    // The second marker "ZZZZ" should NOT be present since it would be beyond the truncation point.
    const htmlSection = userMessage.split("## Generated HTML\n")[1] ?? "";
    expect(htmlSection.length).toBeLessThanOrEqual(MAX_HTML_FOR_REVIEW);
    // The first marker should be present (at start of HTML)
    expect(htmlSection).toContain(uniqueMarker);
    // The second marker should NOT be present (got cut off by truncation)
    expect(htmlSection.indexOf(uniqueMarker, uniqueMarker.length)).toBe(-1);
  });

  it("Test 6: throws on invalid Claude response after retries (missing dimension)", async () => {
    // Missing structuralCompleteness and contentQuality
    const invalidResponse = {
      specCompliance: { score: 0.9, findings: ["ok"] },
      visualConsistency: { score: 0.85, findings: ["ok"] },
      // structuralCompleteness and contentQuality missing
    };
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse(invalidResponse));

    await expect(selfReview(makeSelfReviewInput())).rejects.toThrow();
  });
});
