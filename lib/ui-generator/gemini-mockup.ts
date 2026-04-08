import { GoogleGenerativeAI, type Part, type InlineDataPart } from "@google/generative-ai";

function isInlineDataPart(part: Part): part is InlineDataPart {
  return (part as InlineDataPart).inlineData !== undefined;
}
import type { PageSpecFull } from "@shared/spec-schema.js";
import type { DmTokenRow, MockupResult } from "./types.js";
import { getGeminiApiKey } from "../env.js";

/**
 * Generates a reference mockup image via Gemini 2.0 Flash.
 * Returns null if GEMINI_API_KEY not set, on error, or if Gemini returns no image.
 *
 * This is best-effort — the pipeline continues without it.
 * Fail-closed: any error returns null, never throws.
 */
export async function generateReferenceMockup(input: {
  spec: PageSpecFull;
  tokens: Partial<DmTokenRow> | null;
  deviceType?: string;
}): Promise<MockupResult | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    // Build token constraints string for prompt enrichment
    const tokenConstraints = input.tokens
      ? [
          input.tokens.colorPrimary ? `primary color ${input.tokens.colorPrimary}` : null,
          input.tokens.typeFontFamily ? `font ${input.tokens.typeFontFamily}` : null,
          input.tokens.borderRadius ? `border radius ${input.tokens.borderRadius}px` : null,
        ].filter(Boolean).join(", ")
      : "";

    const prompt = [
      `Generate a UI mockup screenshot for a SaaS page.`,
      `Name: ${input.spec.name}.`,
      `Purpose: ${input.spec.purpose}.`,
      `Components: ${input.spec.components.join(", ")}.`,
      tokenConstraints ? `Design tokens: ${tokenConstraints}.` : null,
      `Generate a clean, modern UI design mockup as an image.`,
    ].filter(Boolean).join(" ");

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "image/png" },
    });

    const parts: Part[] = result.response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (isInlineDataPart(part)) {
        return {
          imageBase64: part.inlineData.data,
          mimeType: part.inlineData.mimeType ?? "image/png",
        };
      }
    }

    // No image parts found — return null gracefully
    return null;
  } catch {
    // Fail-closed: return null on any error — mockup is enhancement not requirement
    return null;
  }
}
