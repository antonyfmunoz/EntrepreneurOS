import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Google Generative AI ────────────────────────────────────────────────

const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn().mockReturnValue({
  generateContent: mockGenerateContent,
});

vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: mockGetGenerativeModel,
    })),
  };
});

// ─── Import under test ────────────────────────────────────────────────────────

import { generateReferenceMockup } from "../../../lib/ui-generator/gemini-mockup.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePageSpec() {
  return {
    name: "Dashboard",
    route: "/dashboard",
    purpose: "Main overview page with metrics",
    components: ["MetricCard", "Chart", "ActivityFeed"],
    authLevel: "authenticated" as const,
    priority: 1,
    layoutHint: "sidebar left, content right",
    emptyState: null,
    loadingState: "skeleton cards",
    errorState: null,
    dataLayer: {
      entities: [],
      operations: [],
      source: "inferred" as const,
    },
    analyticsLayer: {
      events: [],
      source: "inferred" as const,
    },
  };
}

describe("generateReferenceMockup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set GEMINI_API_KEY by default
    process.env.GEMINI_API_KEY = "test-gemini-key";
  });

  it("returns MockupResult with imageBase64 and mimeType when Gemini returns inlineData", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: "base64encodedimagedata",
                    mimeType: "image/png",
                  },
                },
              ],
            },
          },
        ],
      },
    });

    const result = await generateReferenceMockup({
      spec: makePageSpec(),
      tokens: null,
    });

    expect(result).not.toBeNull();
    expect(result!.imageBase64).toBe("base64encodedimagedata");
    expect(result!.mimeType).toBe("image/png");
  });

  it("returns null when GEMINI_API_KEY is not set", async () => {
    delete process.env.GEMINI_API_KEY;

    const result = await generateReferenceMockup({
      spec: makePageSpec(),
      tokens: null,
    });

    expect(result).toBeNull();
  });

  it("returns null when Gemini throws an error (fail-closed)", async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error("Gemini API error"));

    const result = await generateReferenceMockup({
      spec: makePageSpec(),
      tokens: null,
    });

    expect(result).toBeNull();
  });

  it("returns null when Gemini response has no inlineData parts", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        candidates: [
          {
            content: {
              parts: [{ text: "I cannot generate an image for that." }],
            },
          },
        ],
      },
    });

    const result = await generateReferenceMockup({
      spec: makePageSpec(),
      tokens: null,
    });

    expect(result).toBeNull();
  });

  it("passes token constraints into the prompt when tokens are provided", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: "somebase64",
                    mimeType: "image/png",
                  },
                },
              ],
            },
          },
        ],
      },
    });

    const tokens = {
      colorPrimary: "#1a1a2e",
      typeFontFamily: "Inter",
      borderRadius: "8",
    } as any;

    const result = await generateReferenceMockup({
      spec: makePageSpec(),
      tokens,
    });

    // Verify the call was made with token info in the prompt
    expect(mockGenerateContent).toHaveBeenCalledOnce();
    const callArg = mockGenerateContent.mock.calls[0][0];
    const promptText = callArg.contents[0].parts[0].text;
    expect(promptText).toContain("#1a1a2e");
    expect(promptText).toContain("Inter");
    expect(result).not.toBeNull();
  });
});
