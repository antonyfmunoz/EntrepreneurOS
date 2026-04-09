import Anthropic from "@anthropic-ai/sdk";
import pRetry from "p-retry";
import { z } from "zod";
import { extractJsonFromResponse } from "../spec-parser/restructure-spec.js";
import type { TokenExtractionResult, DmTokenRow } from "./types.js";
import { MAX_HTML_FOR_EXTRACTION } from "./types.js";
import { getAnthropicApiKey, getAnthropicBaseUrl } from "../env.js";

// ─── Anthropic client (lazy — instantiated per call) ─────────────────────────

function getClient(): Anthropic {
  return new Anthropic({
    apiKey: getAnthropicApiKey(),
    baseURL: getAnthropicBaseUrl(),
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
//
// Token field schemas. The LLM is instructed to return null when it cannot
// confidently extract a value. Anything non-null must be in the right shape:
//   - colors: 6-digit hex (#RRGGBB), case-insensitive
//   - typeFontFamily: non-empty string
//   - numeric fields: positive numbers in plausible UI ranges
//   - shadowStyle: non-empty CSS string
// Anything else is a Claude hallucination — we throw rather than poison the
// downstream prompt builder with malformed values.

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const HexOrNull = z
  .union([
    z.string().regex(HEX_RE, { message: "expected #RRGGBB" }),
    z.null(),
  ])
  .nullable();

const NumericOrNull = (min: number, max: number) =>
  z.union([z.number().min(min).max(max), z.null()]).nullable();

const StringOrNull = z.union([z.string().min(1), z.null()]).nullable();

const TokensSchema = z.object({
  colorPrimary: HexOrNull,
  colorSecondary: HexOrNull,
  colorBackground: HexOrNull,
  colorSurface: HexOrNull,
  colorText: HexOrNull,
  colorAccent: HexOrNull,
  typeFontFamily: StringOrNull,
  typeSizeBase: NumericOrNull(8, 32),       // px
  typeScaleRatio: NumericOrNull(1, 2),       // typographic scale
  spacingUnit: NumericOrNull(2, 16),         // px
  borderRadius: NumericOrNull(0, 64),        // px
  shadowStyle: StringOrNull,
});

type ExtractedTokens = z.infer<typeof TokensSchema>;

const PatternSchema = z.object({
  name: z.string(),
  variant: z.string().optional(),
  propsShape: z.string().optional(),
  usageContext: z.string().optional(),
  shadcnComponent: z.string().optional(),
});

type ExtractedPattern = z.infer<typeof PatternSchema>;

const ExtractionResponseSchema = z.object({
  tokens: TokensSchema,
  patterns: z.array(PatternSchema),
});

type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;

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
  extracted: ExtractedTokens,
): ExtractedTokens {
  const result = {} as Record<TokenField, string | number | null>;
  for (const field of TOKEN_FIELDS) {
    const extractedVal = extracted[field] ?? null;
    const priorVal = (prior?.[field as keyof DmTokenRow] as
      | string
      | number
      | null
      | undefined) ?? null;
    result[field] = extractedVal !== null ? extractedVal : priorVal;
  }
  return result as unknown as ExtractedTokens;
}

// ─── extractTokensFromHtml: Claude API call ───────────────────────────────────

// Calls Claude with truncated HTML content, extracts tokens and patterns,
// merges extracted tokens with prior tokens using nullish coalescing.
//
// Throws if Claude returns malformed token shapes. The downstream Stitch
// prompt builder and design memory tables both depend on well-formed values.
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

  const validated: ExtractionResponse = await pRetry(
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
      const result = ExtractionResponseSchema.safeParse(parsed);
      if (!result.success) {
        const detail = result.error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        throw new Error(
          `extractTokensFromHtml: Claude returned malformed tokens. ${detail}`,
        );
      }
      return result.data;
    },
    { retries: 2, minTimeout: 1000, factor: 2 },
  );

  const mergedTokens = mergeTokens(priorTokens, validated.tokens);

  return {
    tokens: mergedTokens as unknown as Record<string, string | number | null>,
    patterns: validated.patterns,
  };
}
