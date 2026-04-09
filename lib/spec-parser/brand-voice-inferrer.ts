// lib/spec-parser/brand-voice-inferrer.ts
// Infers brand voice from a PRD/spec document via Claude.
// Writes result to .planning/BRAND-VOICE.md for injection into Stitch prompts.
// Fail-open: if Claude API is unavailable, logs a warning and returns null.

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, getAnthropicBaseUrl } from "../env.js";

const BRAND_VOICE_SYSTEM_PROMPT = `You are a brand voice analyst. Given a product requirements document, extract the brand voice characteristics that should inform UI design.

Return a concise brand voice document in markdown with these sections:
- **Tone**: 1-2 sentences describing the overall tone (e.g. professional, playful, authoritative)
- **Personality**: 3-5 adjectives that define the brand personality
- **Language Style**: guidance on copy style (formal vs casual, technical vs accessible, etc.)
- **Visual Mood**: how the brand voice translates to visual design (color temperature, density, whitespace, typography feel)
- **UI Copy Guidelines**: specific rules for button labels, headings, empty states, error messages

Be specific to THIS product. Do not be generic. Keep total output under 300 words.`;

export interface BrandVoiceResult {
  content: string;
  sourcePath: string;
}

/**
 * Infer brand voice from a PRD document using Claude.
 * Returns the brand voice markdown content, or null if inference fails.
 *
 * @param prdText - Raw text of the PRD/spec document
 * @param outputDir - Directory to write BRAND-VOICE.md (e.g. .planning/)
 * @returns BrandVoiceResult with content and output path, or null on failure
 */
export async function inferBrandVoice(
  prdText: string,
  outputDir: string,
): Promise<BrandVoiceResult | null> {
  try {
    const client = new Anthropic({
      apiKey: getAnthropicApiKey(),
      baseURL: getAnthropicBaseUrl(),
    });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: BRAND_VOICE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prdText }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    if (!text.trim()) {
      console.warn("[brand-voice] Claude returned empty response — skipping brand voice inference.");
      return null;
    }

    const outputPath = path.join(outputDir, "BRAND-VOICE.md");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, text.trim() + "\n", "utf-8");

    return { content: text.trim(), sourcePath: outputPath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[brand-voice] Failed to infer brand voice — continuing without it. Error: ${message}`);
    return null;
  }
}

/**
 * Load an existing BRAND-VOICE.md file if it exists.
 * Returns the file content or null.
 */
export function loadBrandVoice(planningDir: string): string | null {
  const voicePath = path.join(planningDir, "BRAND-VOICE.md");
  try {
    if (fs.existsSync(voicePath)) {
      const content = fs.readFileSync(voicePath, "utf-8").trim();
      return content || null;
    }
    return null;
  } catch {
    return null;
  }
}
