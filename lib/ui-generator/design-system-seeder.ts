import Anthropic from "@anthropic-ai/sdk";
import pRetry from "p-retry";
import { z } from "zod";
import { extractJsonFromResponse } from "../spec-parser/restructure-spec.js";
import type { DesignSystemSeed, DmTokenRow } from "./types.js";
import { DEFAULT_DESIGN_SEED } from "./types.js";

// ─── Anthropic client (lazy — same pattern as extract-tokens.ts and self-review.ts) ──

function getClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY ?? process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    ...(process.env.ANTHROPIC_API_KEY ? {} : { baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL }),
  });
}

// ─── Zod schema for Claude response validation ─────────────────────────────────

export const DesignSystemSeedSchema = z.object({
  colorPalette: z.object({
    primary: z.string(),
    secondary: z.string(),
    background: z.string(),
    surface: z.string(),
    text: z.string(),
    accent: z.string(),
  }),
  fontPairing: z.object({
    heading: z.string(),
    body: z.string(),
  }),
  spacingSystem: z.object({
    unit: z.number(),
    borderRadius: z.number(),
  }),
  componentDirection: z.string(),
});

// ─── System prompt for design system generation ────────────────────────────────

const SEED_SYSTEM_PROMPT = `You are a design system architect. Generate a cohesive design system for a SaaS application.
Select from established design conventions — do not invent from scratch.
Return a JSON object with this exact shape:
{
  "colorPalette": { "primary": "#hex", "secondary": "#hex", "background": "#hex", "surface": "#hex", "text": "#hex", "accent": "#hex" },
  "fontPairing": { "heading": "Font Name", "body": "Font Name" },
  "spacingSystem": { "unit": 4, "borderRadius": 8 },
  "componentDirection": "brief description of component aesthetic"
}
Use established Google Fonts. Ensure WCAG AA contrast between text and background.
Return valid JSON only — no markdown, no explanation.`;

// ─── seedDesignSystem: generates DesignSystemSeed from project description ────

/**
 * Generates an initial design system from project/brand description via Claude.
 * Returns DEFAULT_DESIGN_SEED on any failure (fail-closed per review feedback).
 *
 * Addresses review concern: "fail-closed behavior everywhere model output is consumed"
 * (Codex HIGH review feedback).
 */
export async function seedDesignSystem(input: {
  projectDescription: string;
  brandDescription?: string;
  targetAudience?: string;
}): Promise<DesignSystemSeed> {
  try {
    const client = getClient();

    const userMessage = [
      `Project: ${input.projectDescription}`,
      input.brandDescription ? `Brand aesthetic: ${input.brandDescription}` : null,
      input.targetAudience ? `Target audience: ${input.targetAudience}` : null,
    ].filter(Boolean).join("\n");

    const result = await pRetry(async () => {
      const response = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: SEED_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });
      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const parsed = extractJsonFromResponse(text);
      return DesignSystemSeedSchema.parse(parsed);
    }, { retries: 2, minTimeout: 1000, factor: 2 });

    return result;
  } catch {
    // Fail-closed: return neutral default instead of crashing pipeline
    // Addresses Codex review concern: "fail-closed behavior everywhere model output is consumed"
    return DEFAULT_DESIGN_SEED;
  }
}

// ─── seedToTokens: maps DesignSystemSeed to partial DmTokenRow ────────────────

/**
 * Maps a DesignSystemSeed to a partial DmTokenRow for use with buildStitchPrompt.
 * Pure function, no I/O.
 */
export function seedToTokens(seed: DesignSystemSeed): Partial<DmTokenRow> {
  return {
    colorPrimary: seed.colorPalette.primary,
    colorSecondary: seed.colorPalette.secondary,
    colorBackground: seed.colorPalette.background,
    colorSurface: seed.colorPalette.surface,
    colorText: seed.colorPalette.text,
    colorAccent: seed.colorPalette.accent,
    typeFontFamily: seed.fontPairing.body,
    spacingUnit: String(seed.spacingSystem.unit),
    borderRadius: String(seed.spacingSystem.borderRadius),
    componentDirection: seed.componentDirection,
  } as Partial<DmTokenRow>;
}
