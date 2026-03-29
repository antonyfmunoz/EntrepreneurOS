import Anthropic from "@anthropic-ai/sdk";
import pRetry from "p-retry";
import { z } from "zod";
import { extractJsonFromResponse } from "../spec-parser/restructure-spec.js";
import type { TokenExtractionResult, DmTokenRow } from "./types.js";
import { MAX_HTML_FOR_EXTRACTION } from "./types.js";

// ─── Anthropic client (lazy — instantiated per call) ─────────────────────────

function getClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });
}

// ─── Token field names matching dmTokens columns ──────────────────────────────

const TOKEN_FIELDS = [
  "colorPrimary",
  "colorSecondary",
  "colorBackground",
  "colorSurface",
  "colorText",
  "colorAccent",
  "typeFontFamily",
  "typeSizeBase",
  "typeScaleRatio",
  "spacingUnit",
  "borderRadius",
  "shadowStyle",
] as const;

type TokenField = (typeof TOKEN_FIELDS)[number];

// ─── Validation schema for Claude extraction response ─────────────────────────

const ExtractionResponseSchema = z.object({
  tokens: z.record(z.union([z.string(), z.number(), z.null()])),
  patterns: z.array(
    z.object({
      name: z.string(),
      variant: z.string().optional(),
      propsShape: z.string().optional(),
      usageContext: z.string().optional(),
      shadcnComponent: z.string().optional(),
    })
  ),
});

// ─── System prompt ────────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are a design token extraction engine. Analyze the HTML below and extract design tokens.
Return a JSON object with exactly this shape:
{
  "tokens": {
    "colorPrimary": "#hex or null",
    "colorSecondary": "#hex or null",
    "colorBackground": "#hex or null",
    "colorSurface": "#hex or null",
    "colorText": "#hex or null",
    "colorAccent": "#hex or null",
    "typeFontFamily": "font name or null",
    "typeSizeBase": "number or null",
    "typeScaleRatio": "number or null",
    "spacingUnit": "number or null",
    "borderRadius": "number or null",
    "shadowStyle": "CSS shadow value or null"
  },
  "patterns": [
    {
      "name": "component pattern name (e.g., 'card', 'button-primary', 'nav-sidebar')",
      "variant": "optional variant name",
      "propsShape": "brief description of props/slots this component accepts",
      "usageContext": "where this pattern is used (e.g., 'dashboard metric display')",
      "shadcnComponent": "closest shadcn/ui component if applicable (e.g., 'Card', 'Button')"
    }
  ]
}
Extract colors from inline styles, CSS variables, and class-based color utilities.
Extract typography from font-family declarations and font-size patterns.
Extract spacing from padding/margin/gap patterns.
For patterns, identify distinct UI component patterns (cards, buttons, navigation, forms, tables, modals).
Only return non-null values for tokens you can confidently extract from the HTML.
Return valid JSON only — no markdown, no explanation.`;

// ─── mergeTokens: pure, no I/O ───────────────────────────────────────────────

// Merges newly extracted tokens with prior tokens using nullish coalescing.
// Per D-07: prior non-null values are NEVER overwritten by null extractions.
// New non-null values from extracted take precedence over prior null values.
export function mergeTokens(
  prior: Partial<DmTokenRow> | null,
  extracted: Record<string, string | number | null>
): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};
  for (const field of TOKEN_FIELDS) {
    // nullish coalescing: use extracted value if non-null, else fall back to prior, else null
    const extractedVal = extracted[field] ?? null;
    const priorVal = prior?.[field as keyof DmTokenRow] ?? null;
    result[field] = extractedVal !== null ? extractedVal : priorVal;
  }
  return result;
}

// ─── extractTokensFromHtml: Claude API call ───────────────────────────────────

// Calls Claude with truncated HTML content, extracts tokens and patterns,
// merges extracted tokens with prior tokens using nullish coalescing.
export async function extractTokensFromHtml(input: {
  htmlContent: string;
  projectId: string;
  priorTokens: Partial<DmTokenRow> | null;
}): Promise<TokenExtractionResult> {
  const { htmlContent, priorTokens } = input;

  // Truncate HTML to MAX_HTML_FOR_EXTRACTION chars if oversized
  const truncated = htmlContent.length > MAX_HTML_FOR_EXTRACTION
    ? htmlContent.slice(0, MAX_HTML_FOR_EXTRACTION)
    : htmlContent;

  const userMessage = `Analyze this HTML and extract design tokens and component patterns:\n\n${truncated}`;

  const validated = await pRetry(
    async () => {
      const client = getClient();
      const response = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      const parsed = extractJsonFromResponse(text);
      return ExtractionResponseSchema.parse(parsed);
    },
    { retries: 2, minTimeout: 1000, factor: 2 }
  );

  const mergedTokens = mergeTokens(priorTokens, validated.tokens);

  return {
    tokens: mergedTokens,
    patterns: validated.patterns,
  };
}
