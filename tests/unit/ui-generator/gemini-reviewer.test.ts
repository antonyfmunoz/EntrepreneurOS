import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock @google/generative-ai ───────────────────────────────────────────────

const mockGenerateContent = vi.fn();

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

// ─── Import under test ────────────────────────────────────────────────────────

import { geminiReview } from "../../../lib/ui-generator/gemini-reviewer.js";
import type { GeminiReviewInput } from "../../../lib/ui-generator/gemini-reviewer.js";
import type { PageSpecFull } from "@shared/spec-schema.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_REVIEW_SCORE = {
  specCompliance: {
    score: 0.92,
    findings: ["All required components present"],
  },
  visualConsistency: {
    score: 0.88,
    findings: ["Colors align with design tokens"],
  },
  structuralCompleteness: {
    score: 0.95,
    findings: ["Navigation elements present", "Semantic HTML used"],
  },
  contentQuality: {
    score: 0.9,
    findings: ["Appropriate labels", "No debug text visible"],
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

function makeGeminiInput(overrides: Partial<GeminiReviewInput> = {}): GeminiReviewInput {
  return {
    screenshotUrls: ["https://stitch.example.com/screenshot/page1.png"],
    spec: makePageSpec(),
    tokens: null,
    priorPatterns: [],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("geminiReview", () => {
  const ORIGINAL_GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    mockGenerateContent.mockReset();
    process.env.GEMINI_API_KEY = "test-gemini-key";
  });

  afterEach(() => {
    if (ORIGINAL_GEMINI_API_KEY === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = ORIGINAL_GEMINI_API_KEY;
    }
  });

  it("Test 1: returns a valid ReviewScore with all 4 dimensions when Gemini responds with valid JSON", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify(VALID_REVIEW_SCORE),
      },
    });

    const result = await geminiReview(makeGeminiInput());

    expect(result).not.toBeNull();
    expect(result!.specCompliance).toBeDefined();
    expect(result!.visualConsistency).toBeDefined();
    expect(result!.structuralCompleteness).toBeDefined();
    expect(result!.contentQuality).toBeDefined();

    expect(result!.specCompliance.score).toBeGreaterThanOrEqual(0);
    expect(result!.specCompliance.score).toBeLessThanOrEqual(1);
    expect(Array.isArray(result!.specCompliance.findings)).toBe(true);
  });

  it("Test 2: includes screenshot URLs in the Gemini prompt content", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify(VALID_REVIEW_SCORE),
      },
    });

    const screenshotUrls = [
      "https://stitch.example.com/screenshot/desktop.png",
      "https://stitch.example.com/screenshot/mobile.png",
    ];

    await geminiReview(makeGeminiInput({ screenshotUrls }));

    expect(mockGenerateContent).toHaveBeenCalledOnce();
    const callArgs = mockGenerateContent.mock.calls[0][0];
    const promptText = callArgs.contents[0].parts[0].text as string;

    expect(promptText).toContain("https://stitch.example.com/screenshot/desktop.png");
    expect(promptText).toContain("https://stitch.example.com/screenshot/mobile.png");
  });

  it("Test 3: includes spec component names and token constraints in prompt", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify(VALID_REVIEW_SCORE),
      },
    });

    const spec = makePageSpec({
      components: ["MetricsGrid", "RecentActivity", "QuickActions"],
    });
    const tokens = {
      id: 1,
      projectId: "proj-1",
      version: 1,
      colorPrimary: "#7c3aed",
      colorSecondary: "#ff6b6b",
      colorBackground: "#0f0f1a",
      colorSurface: "#1e1e2e",
      colorText: "#ffffff",
      colorAccent: "#7c3aed",
      typeFontFamily: "Sora",
      typeSizeBase: 16,
      typeScaleRatio: 1.25,
      spacingUnit: 8,
      borderRadius: 8,
      shadowStyle: "0 4px 6px -1px rgba(0,0,0,0.5)",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    };

    await geminiReview(makeGeminiInput({ spec, tokens }));

    expect(mockGenerateContent).toHaveBeenCalledOnce();
    const callArgs = mockGenerateContent.mock.calls[0][0];
    const promptText = callArgs.contents[0].parts[0].text as string;

    expect(promptText).toContain("MetricsGrid");
    expect(promptText).toContain("RecentActivity");
    expect(promptText).toContain("QuickActions");
    expect(promptText).toContain("#7c3aed");
    expect(promptText).toContain("Sora");
  });

  it("Test 4: returns null when GEMINI_API_KEY is not set (fail-closed)", async () => {
    delete process.env.GEMINI_API_KEY;

    const result = await geminiReview(makeGeminiInput());

    expect(result).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("Test 5: returns null when Gemini API throws error (fail-closed)", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Gemini API unavailable"));

    const result = await geminiReview(makeGeminiInput());

    expect(result).toBeNull();
  });

  it("Test 6: returns null when Gemini returns malformed JSON (fail-closed)", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({ not: "valid", schema: "at all" }),
      },
    });

    const result = await geminiReview(makeGeminiInput());

    expect(result).toBeNull();
  });
});
