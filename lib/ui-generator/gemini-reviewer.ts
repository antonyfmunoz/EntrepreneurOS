import { GoogleGenerativeAI } from "@google/generative-ai";
import { ReviewScoreSchema } from "./types.js";
import type { ReviewScore, DmTokenRow } from "./types.js";
import type { PageSpecFull } from "@shared/spec-schema.js";

export interface GeminiReviewInput {
  screenshotUrls: string[];
  spec: PageSpecFull;
  tokens: DmTokenRow | null;
  priorPatterns: Array<{ name: string; usageContext?: string | null }>;
}

/**
 * Secondary vision-based reviewer using Gemini 2.0 Pro.
 * Evaluates Stitch screenshots (not raw HTML) against the same 4 dimensions as Claude.
 *
 * Fail-closed: Returns null if:
 * - GEMINI_API_KEY not set
 * - Gemini API error
 * - Gemini returns malformed/partial JSON
 * - Any unexpected error
 *
 * This is non-blocking -- the pipeline uses Claude-only scores when Gemini is unavailable.
 */
export async function geminiReview(
  input: GeminiReviewInput
): Promise<ReviewScore | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-pro" });

    const prompt = buildGeminiReviewPrompt(input);

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    // Validate against same schema as Claude reviewer.
    // If validation fails, Zod throws and we catch below -> return null.
    return ReviewScoreSchema.parse(parsed);
  } catch {
    // Fail-closed: any error (API, JSON parse, Zod validation) -> return null.
    // Addresses review concern: "fail-closed behavior everywhere model output is consumed"
    return null;
  }
}

function buildGeminiReviewPrompt(input: GeminiReviewInput): string {
  const { spec, tokens, priorPatterns, screenshotUrls } = input;
  const sections: string[] = [];

  sections.push(
    "You are a UI quality reviewer evaluating generated UI screenshots for a SaaS application."
  );
  sections.push(
    `\nPage: ${spec.name}\nPurpose: ${spec.purpose}\nComponents required: ${spec.components.join(", ")}\nAuth level: ${spec.authLevel}`
  );

  if (tokens) {
    const tokenFields = [
      tokens.colorPrimary ? `primary: ${tokens.colorPrimary}` : null,
      tokens.colorSecondary ? `secondary: ${tokens.colorSecondary}` : null,
      tokens.typeFontFamily ? `font: ${tokens.typeFontFamily}` : null,
      tokens.borderRadius !== null ? `radius: ${tokens.borderRadius}px` : null,
      tokens.spacingUnit !== null ? `spacing: ${tokens.spacingUnit}px` : null,
    ]
      .filter(Boolean)
      .join(", ");
    if (tokenFields) {
      sections.push(`\nDesign tokens (must be matched): ${tokenFields}`);
    }
  } else {
    sections.push(
      "\nNo design tokens established yet (first page) -- score visual consistency based on internal coherence."
    );
  }

  if (priorPatterns.length > 0) {
    sections.push(
      `\nEstablished component patterns: ${priorPatterns.map((p) => p.name).join(", ")}`
    );
  }

  sections.push(
    `\nScreenshot URLs to evaluate:\n${screenshotUrls.map((u, i) => `  ${i + 1}. ${u}`).join("\n")}`
  );

  sections.push(
    `\nScore each dimension from 0.0 to 1.0 with specific findings. Focus on VISUAL aspects that text review might miss: color accuracy, alignment, spacing consistency, visual hierarchy, whitespace balance.

Return JSON:
{
  "specCompliance": { "score": 0.0-1.0, "findings": ["..."] },
  "visualConsistency": { "score": 0.0-1.0, "findings": ["..."] },
  "structuralCompleteness": { "score": 0.0-1.0, "findings": ["..."] },
  "contentQuality": { "score": 0.0-1.0, "findings": ["..."] }
}

Return valid JSON only.`
  );

  return sections.join("\n");
}
