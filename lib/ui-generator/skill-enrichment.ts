import Anthropic from "@anthropic-ai/sdk";
import type { SkillEnrichment } from "./types.js";

/**
 * Skill enrichment layer (Plan 03-07).
 *
 * These functions invoke the `frontend-design` and `ui-ux-pro-max` skills via
 * the Anthropic API by *prompting* Claude to apply the skill's principles. They
 * are NOT calls into the Claude Code Skill tool runtime — that tool is only
 * available inside the orchestrator process. From a Node-side library these are
 * regular API calls with skill-aware system prompts.
 *
 * All functions are fail-open: any error returns an empty/null result so the
 * pipeline never blocks on enrichment.
 */

function getClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY ?? process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    ...(process.env.ANTHROPIC_API_KEY ? {} : { baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL }),
  });
}

const MODEL = "claude-sonnet-4-5";

export interface FrontendDesignQuery {
  productType: string;
  components: string[];
  complexity: "low" | "medium" | "high";
  targetAudience: string;
}

/**
 * Query the frontend-design skill for production-grade design patterns.
 * Returns null on any failure.
 */
export async function queryFrontendDesignSkill(
  query: FrontendDesignQuery
): Promise<string | null> {
  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Apply the frontend-design skill to provide production-grade design guidance for:
- Product type: ${query.productType}
- Components: ${query.components.join(", ")}
- Complexity: ${query.complexity}
- Target audience: ${query.targetAudience}

Focus on avoiding generic AI aesthetics and ensuring distinctive, professional UI quality.
Provide specific guidance on layout, spacing, hierarchy, interaction patterns, and component composition.
Be concrete: name specific patterns, not general principles. Keep response under 1500 words.`,
        },
      ],
    });

    const block = response.content[0];
    return block && block.type === "text" ? block.text : null;
  } catch (err) {
    console.warn("[skill-enrichment] frontend-design skill unavailable:", (err as Error).message);
    return null;
  }
}

export interface UxProQuery {
  productType: string;
  vibe: string;
  industry?: string;
}

/**
 * Query the ui-ux-pro-max skill for palette + font pairing recommendations.
 * Returns {} on any failure.
 */
export async function queryUXProSkill(
  query: UxProQuery
): Promise<{ palette?: string; fonts?: string }> {
  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Apply the ui-ux-pro-max skill (161 palettes, 57 font pairings) to recommend:
1. A color palette suited to a ${query.productType} app with a ${query.vibe} aesthetic${query.industry ? ` serving the ${query.industry} industry` : ""}.
2. A font pairing (heading + body) from production-tested combinations.

Reply in EXACTLY this format (two lines):
PALETTE: <palette name> — primary #hex, secondary #hex, accent #hex
FONTS: <heading font> / <body font>`,
        },
      ],
    });

    const block = response.content[0];
    const text = block && block.type === "text" ? block.text : "";

    const paletteMatch = text.match(/PALETTE:\s*(.+)/i);
    const fontsMatch = text.match(/FONTS:\s*(.+)/i);

    return {
      palette: paletteMatch?.[1]?.trim(),
      fonts: fontsMatch?.[1]?.trim(),
    };
  } catch (err) {
    console.warn("[skill-enrichment] ui-ux-pro-max skill unavailable:", (err as Error).message);
    return {};
  }
}

/**
 * Best-effort industry extraction from a free-form project description.
 * Returns undefined when no obvious industry term is present.
 */
export function extractIndustry(description: string | undefined | null): string | undefined {
  if (!description) return undefined;
  const lower = description.toLowerCase();
  const industries: Array<[string, RegExp]> = [
    ["fintech", /\b(fintech|banking|finance|payment|wallet|trading|crypto)\b/],
    ["healthcare", /\b(healthcare|health|medical|patient|clinic|telehealth)\b/],
    ["education", /\b(education|edtech|learning|course|student|school)\b/],
    ["ecommerce", /\b(ecommerce|e-commerce|shop|store|retail|marketplace)\b/],
    ["saas", /\b(saas|crm|erp|ops|workflow|productivity|b2b)\b/],
    ["real estate", /\b(real estate|property|listing|rental|housing)\b/],
    ["logistics", /\b(logistics|shipping|delivery|fleet|supply chain)\b/],
    ["media", /\b(media|content|streaming|publishing|news)\b/],
  ];
  for (const [name, re] of industries) {
    if (re.test(lower)) return name;
  }
  return undefined;
}

/**
 * Convenience: run both skill queries in parallel and assemble a SkillEnrichment.
 * Always returns a SkillEnrichment (never throws). Fields are null/empty on failure.
 */
export async function enrichOnce(input: {
  productType: string;
  components: string[];
  complexity: "low" | "medium" | "high";
  targetAudience: string;
  vibe: string;
  industry?: string;
}): Promise<SkillEnrichment> {
  const [designGuidance, uxGuidance] = await Promise.all([
    queryFrontendDesignSkill({
      productType: input.productType,
      components: input.components,
      complexity: input.complexity,
      targetAudience: input.targetAudience,
    }),
    queryUXProSkill({
      productType: input.productType,
      vibe: input.vibe,
      industry: input.industry,
    }),
  ]);

  return {
    designGuidance,
    uxGuidance,
    timestamp: new Date(),
  };
}
