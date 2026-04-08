import Anthropic from "@anthropic-ai/sdk";
import pRetry from "p-retry";
import { extractJsonFromResponse } from "../spec-parser/restructure-spec.js";
import { ReviewScoreSchema, MAX_HTML_FOR_REVIEW } from "./types.js";
import type { ReviewScore, DmTokenRow, DualReviewScore } from "./types.js";
import type { PageSpecFull } from "@shared/spec-schema.js";
import { geminiReview } from "./gemini-reviewer.js";
import { getAnthropicApiKey, getAnthropicBaseUrl } from "../env.js";

// ─── SelfReviewInput ──────────────────────────────────────────────────────────

export interface SelfReviewInput {
  /** Raw HTML from Stitch generation */
  htmlContent: string;
  /** Screenshot URL(s) from Stitch — one per device type */
  screenshotUrls: string[];
  /** Full page specification to review against */
  spec: PageSpecFull;
  /** Current design tokens from DB (null for page 1 — no tokens established yet) */
  tokens: DmTokenRow | null;
  /** Prior approved component patterns for consistency check */
  priorPatterns: Array<{ name: string; usageContext?: string | null }>;
}

// ─── Anthropic client (lazy — instantiated per call) ─────────────────────────

function getClient(): Anthropic {
  return new Anthropic({
    apiKey: getAnthropicApiKey(),
    baseURL: getAnthropicBaseUrl(),
  });
}

// ─── System prompt ────────────────────────────────────────────────────────────

const REVIEW_SYSTEM_PROMPT = `You are a UI quality reviewer for a SaaS application. Review the generated HTML against the page specification and design context provided.

Score each dimension from 0.0 to 1.0 and provide specific findings (what passed, what failed, what's missing).

Return a JSON object with exactly this shape:
{
  "specCompliance": {
    "score": 0.0-1.0,
    "findings": ["finding 1", "finding 2"]
  },
  "visualConsistency": {
    "score": 0.0-1.0,
    "findings": ["finding 1", "finding 2"]
  },
  "structuralCompleteness": {
    "score": 0.0-1.0,
    "findings": ["finding 1", "finding 2"]
  },
  "contentQuality": {
    "score": 0.0-1.0,
    "findings": ["finding 1", "finding 2"]
  }
}

Scoring criteria per dimension:

1. Spec Compliance (UIGEN-04):
   - All components from the spec are present in the HTML
   - Auth level is respected (login form for authenticated pages, no auth gate for public)
   - Empty state, loading state, and error state variants are present if specified
   - Data requirements are reflected in component structure

2. Visual Consistency (UIGEN-05):
   - If design tokens provided: colors match token palette, typography matches font family and scale, spacing follows spacing unit, border radius matches
   - If no tokens (page 1): score based on internal consistency (one font family, coherent color palette, consistent spacing)
   - Prior component patterns are visually matched if same pattern type appears

3. Structural Completeness:
   - Navigation elements present (if not a standalone page like auth)
   - Responsive layout indicators (flex/grid, breakpoints)
   - Semantic HTML used (header, main, nav, section, not all divs)
   - Accessibility basics (form labels, alt text, ARIA where needed)

4. Content Quality:
   - Reasonable placeholder text (not "Lorem ipsum" in visible areas)
   - Appropriate labels, headings, and button text
   - Icons or visual indicators where semantically appropriate
   - No debug text, TODO markers, or placeholder URLs visible

Return valid JSON only — no markdown, no explanation.`;

// ─── selfReview ───────────────────────────────────────────────────────────────

/**
 * Sends Stitch HTML + PageSpec + design tokens + prior patterns to Claude Sonnet
 * and returns a validated 4-dimension ReviewScore.
 *
 * Implementation per D-09 (four dimensions), D-11 (Claude Sonnet), D-12 (multi-device review).
 *
 * @param input - SelfReviewInput containing all context for review
 * @returns Validated ReviewScore with per-dimension scores and findings
 */
export async function selfReview(input: SelfReviewInput): Promise<ReviewScore> {
  const { spec, tokens, priorPatterns } = input;

  // Step a: Truncate htmlContent to MAX_HTML_FOR_REVIEW chars (D-11)
  const truncatedHtml =
    input.htmlContent.length > MAX_HTML_FOR_REVIEW
      ? input.htmlContent.slice(0, MAX_HTML_FOR_REVIEW)
      : input.htmlContent;

  // Step b-c: Build user message with all context sections
  const messageParts: string[] = [];

  // Page specification section
  const statesSection: string[] = [];
  if (spec.emptyState) statesSection.push(`Empty state: ${spec.emptyState}`);
  if (spec.loadingState) statesSection.push(`Loading state: ${spec.loadingState}`);
  if (spec.errorState) statesSection.push(`Error state: ${spec.errorState}`);

  messageParts.push(
    `## Page Specification\n` +
    `Name: ${spec.name}\n` +
    `Purpose: ${spec.purpose}\n` +
    `Components: ${spec.components.join(", ")}\n` +
    `Auth level: ${spec.authLevel}` +
    (statesSection.length > 0 ? `\n${statesSection.join("\n")}` : "")
  );

  // Design tokens section
  if (tokens !== null) {
    const tokenFields: Record<string, string | number | null> = {
      colorPrimary: tokens.colorPrimary ?? null,
      colorSecondary: tokens.colorSecondary ?? null,
      colorBackground: tokens.colorBackground ?? null,
      colorSurface: tokens.colorSurface ?? null,
      colorText: tokens.colorText ?? null,
      colorAccent: tokens.colorAccent ?? null,
      typeFontFamily: tokens.typeFontFamily ?? null,
      typeSizeBase: tokens.typeSizeBase ?? null,
      typeScaleRatio: tokens.typeScaleRatio ?? null,
      spacingUnit: tokens.spacingUnit ?? null,
      borderRadius: tokens.borderRadius ?? null,
      shadowStyle: tokens.shadowStyle ?? null,
    };
    // Filter out null values for a cleaner token display
    const nonNullTokens = Object.fromEntries(
      Object.entries(tokenFields).filter(([, v]) => v !== null)
    );
    messageParts.push(`## Design Tokens\n${JSON.stringify(nonNullTokens, null, 2)}`);
  } else {
    messageParts.push(`## Design Tokens\nNo design tokens established yet (first page).`);
  }

  // Prior component patterns section
  if (priorPatterns.length > 0) {
    const patternLines = priorPatterns.map(
      (p) =>
        `- ${p.name}${p.usageContext ? ` (${p.usageContext})` : ""}`
    );
    messageParts.push(`## Prior Component Patterns\n${patternLines.join("\n")}`);
  } else {
    messageParts.push(`## Prior Component Patterns\nNo prior patterns established.`);
  }

  // Generated HTML section (truncated)
  messageParts.push(`## Generated HTML\n${truncatedHtml}`);

  const userMessage = messageParts.join("\n\n");

  // Steps d-f: Call Claude with pRetry wrapping
  const validated = await pRetry(
    async () => {
      const client = getClient();
      const response = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 2048,
        system: REVIEW_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      const parsed = extractJsonFromResponse(text);
      return ReviewScoreSchema.parse(parsed);
    },
    { retries: 2, minTimeout: 1000, factor: 2 }
  );

  // Step g: Return validated ReviewScore
  return validated;
}

// ─── combineScores ────────────────────────────────────────────────────────────

/**
 * Takes the minimum score per dimension from both reviewers (worst-of-both).
 * Merges findings from both with reviewer prefix labels.
 * If gemini is null, returns claude scores unchanged.
 */
export function combineScores(
  claude: ReviewScore,
  gemini: ReviewScore | null
): ReviewScore {
  if (gemini === null) {
    return claude;
  }

  const dimensions = [
    "specCompliance",
    "visualConsistency",
    "structuralCompleteness",
    "contentQuality",
  ] as const;

  const combined: Record<string, { score: number; findings: string[] }> = {};

  for (const dim of dimensions) {
    combined[dim] = {
      score: Math.min(claude[dim].score, gemini[dim].score),
      findings: [
        ...claude[dim].findings.map((f) => `[Claude] ${f}`),
        ...gemini[dim].findings.map((f) => `[Gemini] ${f}`),
      ],
    };
  }

  return ReviewScoreSchema.parse(combined);
}

// ─── dualReview ───────────────────────────────────────────────────────────────

/**
 * Combines Claude text-based review with Gemini vision-based review.
 * Returns DualReviewScore with combined worst-of-both per dimension.
 *
 * The existing selfReview function is preserved for backwards compatibility.
 * dualReview calls selfReview internally, then calls geminiReview in parallel.
 *
 * Fail behavior:
 * - If Claude fails (selfReview throws), the error propagates (Claude is required)
 * - If Gemini fails (geminiReview returns null), falls back to Claude-only (Gemini is optional)
 */
export async function dualReview(input: SelfReviewInput): Promise<DualReviewScore> {
  const [claudeScore, geminiScore] = await Promise.all([
    selfReview(input),
    geminiReview({
      screenshotUrls: input.screenshotUrls,
      spec: input.spec,
      tokens: input.tokens,
      priorPatterns: input.priorPatterns,
    }),
  ]);

  const combined = combineScores(claudeScore, geminiScore);

  return {
    claude: claudeScore,
    gemini: geminiScore,
    combined,
    reviewerCount: geminiScore !== null ? 2 : 1,
  };
}
