// lib/agents/design-system-agent.ts
// Generates a complete, product-specific design system from a ProjectBrief
// and ProductInsights. Writes design tokens, CSS custom properties, a Tailwind
// config extension, and a component design guide to disk.

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, getAnthropicBaseUrl } from "../env.js";
import { extractJsonFromResponse } from "../spec-parser/restructure-spec.js";
import { generateDesignContract } from "../react-gen/design-linter.js";
import { ArtifactStore } from "./artifact-store.js";
import type { DesignSystem, DesignTokens, ProductInsights } from "./types.js";
import type { ProjectBrief } from "../intake/types.js";

// ─── System Prompt ──────────────────────────────────────────────────────────

const DESIGN_SYSTEM_PROMPT = `You are a senior product designer with an award-winning SaaS design background. You create distinctive, non-generic design systems that avoid the generic AI aesthetic. You commit to bold aesthetic directions. You believe every SaaS product deserves its own visual identity.

PHILOSOPHY:
- Bold aesthetic choices. Commit to a direction. No generic AI slop.
- Every token should feel intentional for THIS product.
- Colors must have semantic meaning tied to the product domain.
- Typography choices must reinforce the product personality.
- Spacing and radius scales must create a cohesive spatial rhythm.
- Shadows and elevation must establish a clear depth hierarchy.
- The system must feel like it was hand-crafted by a design team, not generated.

DESIGN PHILOSOPHY (from frontend-design best practices):
Before generating any design system, commit to a BOLD aesthetic direction.
Ask: What makes this product UNFORGETTABLE? What's the one visual thing someone will remember?
CRITICAL RULES:
- Never use generic AI aesthetics: Inter/Roboto/Arial fonts, purple gradients on white, cookie-cutter layouts
- Pick an extreme: brutally minimal, luxury refined, editorial, technical precision, warm organic — commit fully
- Typography: choose fonts that are beautiful and unexpected. Pair a distinctive display font with a refined body font. Load from Google Fonts.
- Color: dominant colors with sharp accents. One strong primary, used deliberately. Not timid distributed palettes.
- Motion: one well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions
- Spatial composition: use asymmetry, generous negative space OR controlled density — never mediocre middle ground
- Depth: layered transparencies, dramatic shadows tinted with the primary color, subtle textures

NEVER produce: the same design twice, safe choices, predictable layouts, generic SaaS templates
ALWAYS produce: something a senior designer would be proud to put in their portfolio

CRITICAL: If the user message includes an EXISTING DESIGN SYSTEM section, that document is LAW. You must use exactly the colors, fonts, spacing, and rules defined there. You may add details and component patterns but you cannot change the core tokens. The design system was deliberately chosen by the product owner — do not override it. Refine and extend, never replace.

OUTPUT FORMAT: Return ONLY a valid JSON object with this exact shape:

{
  "aesthetic": "string — 1-2 sentence description of the overall design direction and why it fits this product",
  "colorMode": "light | dark | user-choice",
  "tokens": {
    "colors": {
      "primary": "#hex — main brand action color",
      "primaryHover": "#hex — darker/lighter variant for hover",
      "primaryMuted": "#hex — subtle tint for backgrounds",
      "secondary": "#hex — complementary accent",
      "secondaryHover": "#hex",
      "success": "#hex — positive actions/states",
      "successMuted": "#hex",
      "warning": "#hex — caution states",
      "warningMuted": "#hex",
      "destructive": "#hex — danger/delete actions",
      "destructiveMuted": "#hex",
      "background": "#hex — page background",
      "surface": "#hex — card/panel background",
      "surfaceElevated": "#hex — elevated elements (dropdowns, modals)",
      "surfaceSubtle": "#hex — subtle differentiation (table rows, sidebars)",
      "border": "#hex — default border",
      "borderSubtle": "#hex — lighter border for internal divisions",
      "text": "#hex — primary text (never pure black #000000)",
      "textSecondary": "#hex — secondary/muted text",
      "textTertiary": "#hex — placeholder/disabled text",
      "textOnPrimary": "#hex — text on primary-colored backgrounds",
      "ring": "#hex — focus ring color"
    },
    "typography": {
      "fontFamily": "string — primary font name (Inter or product-specific)",
      "fontSizes": {
        "xs": "rem value",
        "sm": "rem value",
        "base": "rem value",
        "lg": "rem value",
        "xl": "rem value",
        "2xl": "rem value",
        "3xl": "rem value",
        "4xl": "rem value"
      },
      "fontWeights": {
        "normal": 400,
        "medium": 500,
        "semibold": 600,
        "bold": 700
      },
      "lineHeights": {
        "tight": "unitless or rem",
        "normal": "unitless or rem",
        "relaxed": "unitless or rem"
      }
    },
    "spacing": {
      "0.5": "rem value",
      "1": "rem value",
      "1.5": "rem value",
      "2": "rem value",
      "3": "rem value",
      "4": "rem value",
      "5": "rem value",
      "6": "rem value",
      "8": "rem value",
      "10": "rem value",
      "12": "rem value",
      "16": "rem value",
      "20": "rem value",
      "24": "rem value"
    },
    "borderRadius": {
      "none": "0",
      "sm": "px/rem value",
      "md": "px/rem value",
      "lg": "px/rem value",
      "xl": "px/rem value",
      "2xl": "px/rem value",
      "full": "9999px"
    },
    "shadows": {
      "sm": "CSS shadow value",
      "md": "CSS shadow value",
      "lg": "CSS shadow value",
      "xl": "CSS shadow value",
      "inner": "CSS inset shadow value",
      "focus": "CSS focus ring shadow"
    },
    "breakpoints": {
      "sm": "px value",
      "md": "px value",
      "lg": "px value",
      "xl": "px value",
      "2xl": "px value"
    }
  },
  "tailwindExtend": {
    "description": "A valid Tailwind theme.extend object (colors, borderRadius, boxShadow, fontFamily, fontSize, spacing). Keys must be valid Tailwind config keys. Values must be plain objects or strings — no JavaScript expressions."
  },
  "cssCustomProperties": "string — complete CSS file contents with :root { --color-primary: #hex; ... } and a .dark { } block if colorMode is dark or user-choice. Include ALL tokens as CSS custom properties.",
  "componentDesignGuide": "string — complete markdown contents for COMPONENT_DESIGN_GUIDE.md. Must include concrete Tailwind class patterns (not abstract descriptions) for: buttons (primary, secondary, ghost, destructive, sizes), cards (default, interactive, elevated), inputs (default, error, disabled), navigation (sidebar, topbar, breadcrumb), modals/dialogs, tables, empty states, loading states. Each pattern must use the actual color/spacing/radius tokens defined above."
}

RULES:
1. Never use pure black (#000000) for text. Pick a near-black that has slight warmth or coolness matching the palette.
2. All colors must pass WCAG AA contrast minimums for their intended use.
3. The shadow scale must use the primary color tint in at least the focus shadow.
4. Border radius must commit to a direction: sharp (2-4px), balanced (6-8px), or soft (12-16px). Do not hedge.
5. The Tailwind extend block must be a plain JSON object that can be spread into theme.extend.
6. The CSS custom properties file must be self-contained and importable.
7. The component design guide must use ACTUAL Tailwind classes from the token system — not placeholder descriptions.
8. Return ONLY the JSON. No preamble, no explanation, no markdown fences.`;

// ─── Local type helpers for optional brief fields ───────────────────────────

interface VisualIntent {
  referenceUrls: string[];
  feelWord: string;
  avoidances: string[];
  colorMode: "light" | "dark" | "user-choice";
}

interface VisualResearchEntry {
  url: string;
  observations: string;
}

// ─── Prompt Builder ─────────────────────────────────────────────────────────

function buildUserPrompt(brief: ProjectBrief, insights: ProductInsights): string {
  const sections: string[] = [];

  sections.push(`# Product: ${brief.productName}`);
  sections.push(`## Description\n${brief.productDescription}`);

  if (brief.productVision) {
    sections.push(`## Vision\n${brief.productVision}`);
  }

  const targetUsers = (brief.targetUsers ?? []) as string[];
  if (targetUsers.length > 0) {
    sections.push(`## Target Users\n${targetUsers.map((u) => `- ${u}`).join("\n")}`);
  }

  const vi = brief.visualIntent as VisualIntent | undefined;
  if (vi) {
    sections.push(`## Visual Intent`);
    if (vi.feelWord) {
      sections.push(`Feel: ${vi.feelWord}`);
    }
    if (vi.colorMode) {
      sections.push(`Color mode preference: ${vi.colorMode}`);
    }
    if (vi.referenceUrls && vi.referenceUrls.length > 0) {
      sections.push(`Reference URLs:\n${vi.referenceUrls.map((u: string) => `- ${u}`).join("\n")}`);
    }
    if (vi.avoidances && vi.avoidances.length > 0) {
      sections.push(`Explicitly avoid:\n${vi.avoidances.map((a: string) => `- ${a}`).join("\n")}`);
    }
  }

  const vr = brief.visualResearch as VisualResearchEntry[] | undefined;
  if (vr && vr.length > 0) {
    sections.push(`## Visual Research Observations`);
    for (const entry of vr) {
      sections.push(`### ${entry.url}\n${entry.observations}`);
    }
  }

  if (brief.brandVoice) {
    sections.push(`## Brand Voice\n${brief.brandVoice}`);
  }

  if (brief.designSystem) {
    sections.push(`## Existing Design System Notes\n${brief.designSystem}`);
  }

  sections.push(`## Product Category\n${insights.productCategory}`);
  sections.push(`## Target User Profile\n${insights.targetUserProfile}`);
  sections.push(`## Market Positioning\n${insights.marketPositioning}`);

  if (insights.designRecommendations.length > 0) {
    sections.push(`## Design Recommendations from Product Analysis\n${insights.designRecommendations.map((r) => `- ${r}`).join("\n")}`);
  }

  if (insights.competitiveIntel) {
    const intel = insights.competitiveIntel;
    sections.push(`## Competitive Landscape`);
    if (intel.competitors && intel.competitors.length > 0) {
      for (const comp of intel.competitors) {
        const compName = comp.name ?? comp.url ?? "Unknown";
        const patterns: string[] = [];
        if (comp.copyPatterns && comp.copyPatterns.length > 0) {
          patterns.push(`- Copy patterns: ${comp.copyPatterns.join(", ")}`);
        }
        if (comp.structurePatterns && comp.structurePatterns.length > 0) {
          patterns.push(`- Structure patterns: ${comp.structurePatterns.join(", ")}`);
        }
        if (comp.uxPatterns && comp.uxPatterns.length > 0) {
          patterns.push(`- UX patterns: ${comp.uxPatterns.join(", ")}`);
        }
        if (comp.whatToAdopt && comp.whatToAdopt.length > 0) {
          patterns.push(`- Worth adopting: ${comp.whatToAdopt.join(", ")}`);
        }
        if (comp.whatToAvoid && comp.whatToAvoid.length > 0) {
          patterns.push(`- Avoid: ${comp.whatToAvoid.join(", ")}`);
        }
        sections.push(`### ${compName}\n${patterns.join("\n")}`);
      }
    }
    if (intel.synthesizedInsights) {
      sections.push(`### Synthesized Competitive Insights\n${intel.synthesizedInsights}`);
    }
    if (intel.structureInfluences) {
      sections.push(`### Structure Influences\n${intel.structureInfluences}`);
    }
  }

  sections.push(`\nGenerate a complete, distinctive design system for this product. Commit to bold choices that differentiate it from competitors. Every token must feel intentional for ${brief.productName}.`);

  return sections.join("\n\n");
}

// ─── Tailwind Config Merger ─────────────────────────────────────────────────

function mergeTailwindConfig(existing: string | null, extendBlock: Record<string, unknown>): string {
  if (!existing) {
    // Generate a complete tailwind config from scratch
    const extendJson = JSON.stringify(extendBlock, null, 4)
      .split("\n")
      .map((line, i) => (i === 0 ? line : `    ${line}`))
      .join("\n");

    return `import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./client/index.html",
    "./client/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: ${extendJson},
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
`;
  }

  // Parse the extend block from existing config and merge
  // Strategy: find the `extend:` block and inject new keys
  const extendEntries = Object.entries(extendBlock);
  if (extendEntries.length === 0) return existing;

  // Build the merged extend content as individual key assignments
  const mergeLines: string[] = [];
  for (const [key, value] of extendEntries) {
    const valueStr = JSON.stringify(value, null, 6)
      .split("\n")
      .map((line, i) => (i === 0 ? line : `      ${line}`))
      .join("\n");
    mergeLines.push(`      ${key}: ${valueStr}`);
  }
  const mergeBlock = mergeLines.join(",\n");

  // Try to inject into existing extend block
  const extendMatch = existing.match(/extend\s*:\s*\{/);
  if (extendMatch && extendMatch.index !== undefined) {
    const insertPos = extendMatch.index + extendMatch[0].length;
    const before = existing.slice(0, insertPos);
    const after = existing.slice(insertPos);
    // Add a newline and the merge block, then a comma if needed
    const needsComma = after.trimStart().charAt(0) !== "}";
    const separator = needsComma ? ",\n" : "\n";
    return `${before}\n${mergeBlock}${separator}${after}`;
  }

  // If no extend block found, try to inject into theme block
  const themeMatch = existing.match(/theme\s*:\s*\{/);
  if (themeMatch && themeMatch.index !== undefined) {
    const insertPos = themeMatch.index + themeMatch[0].length;
    const before = existing.slice(0, insertPos);
    const after = existing.slice(insertPos);
    return `${before}\n    extend: {\n${mergeBlock}\n    },\n${after}`;
  }

  // Last resort: return existing with a comment about manual merge
  return `${existing}\n// DESIGN SYSTEM: Manual merge needed for extend block:\n// ${JSON.stringify(extendBlock)}\n`;
}

// ─── CSS Custom Properties Builder ──────────────────────────────────────────

function buildCssCustomProperties(tokens: DesignTokens, colorMode: string): string {
  const lines: string[] = [
    "/* Design System — Auto-generated CSS Custom Properties */",
    "/* Do not edit manually. Regenerate via design-system-agent. */",
    "",
    ":root {",
  ];

  // Colors
  for (const [name, value] of Object.entries(tokens.colors)) {
    const cssName = name.replace(/([A-Z])/g, "-$1").toLowerCase();
    lines.push(`  --color-${cssName}: ${value};`);
  }

  lines.push("");

  // Typography
  lines.push(`  --font-family: '${tokens.typography.fontFamily}', system-ui, sans-serif;`);
  for (const [name, value] of Object.entries(tokens.typography.fontSizes)) {
    lines.push(`  --font-size-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(tokens.typography.fontWeights)) {
    lines.push(`  --font-weight-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(tokens.typography.lineHeights)) {
    lines.push(`  --line-height-${name}: ${value};`);
  }

  lines.push("");

  // Spacing
  for (const [name, value] of Object.entries(tokens.spacing)) {
    lines.push(`  --spacing-${name.replace(".", "_")}: ${value};`);
  }

  lines.push("");

  // Border radius
  for (const [name, value] of Object.entries(tokens.borderRadius)) {
    lines.push(`  --radius-${name}: ${value};`);
  }

  lines.push("");

  // Shadows
  for (const [name, value] of Object.entries(tokens.shadows)) {
    lines.push(`  --shadow-${name}: ${value};`);
  }

  lines.push("");

  // Breakpoints
  for (const [name, value] of Object.entries(tokens.breakpoints)) {
    lines.push(`  --breakpoint-${name}: ${value};`);
  }

  lines.push("}");

  if (colorMode === "dark" || colorMode === "user-choice") {
    lines.push("");
    lines.push("/* Dark mode overrides — populate with dark variants */");
    lines.push(".dark {");
    for (const [name] of Object.entries(tokens.colors)) {
      const cssName = name.replace(/([A-Z])/g, "-$1").toLowerCase();
      lines.push(`  /* --color-${cssName}: dark variant; */`);
    }
    lines.push("}");
  }

  lines.push("");
  return lines.join("\n");
}

// ─── Agent Entry Point ──────────────────────────────────────────────────────

interface DesignSystemResponse {
  aesthetic: string;
  colorMode: "light" | "dark" | "user-choice";
  tokens: DesignTokens;
  tailwindExtend: Record<string, unknown>;
  cssCustomProperties: string;
  componentDesignGuide: string;
}

export async function runDesignSystemAgent(
  brief: ProjectBrief,
  insights: ProductInsights,
  store: ArtifactStore,
): Promise<DesignSystem> {
  const client = new Anthropic({
    apiKey: getAnthropicApiKey(),
    baseURL: getAnthropicBaseUrl(),
  });

  const projectRoot = store.getProjectRoot();

  // Check for an existing design-system.md — if present, it is the primary
  // source of truth and the agent must stay within its defined tokens.
  const dsPath = path.join(projectRoot, ".planning", "design-system.md");
  let existingDesignDoc: string | null = null;
  if (fs.existsSync(dsPath)) {
    existingDesignDoc = fs.readFileSync(dsPath, "utf-8");
    console.log("[design-system] Found .planning/design-system.md — using as binding constraint");
  } else {
    console.log("[design-system] No design-system.md found — generating with full creative freedom");
  }

  let userPrompt = buildUserPrompt(brief, insights);

  // If an existing design system document exists, prepend it as a binding constraint
  if (existingDesignDoc) {
    userPrompt = `# ⚠️ EXISTING DESIGN SYSTEM — THIS IS LAW\n\nThe following design system document was written by the product owner. You MUST use exactly these colors, fonts, spacing, glassmorphism rules, and constraints. You may refine details (add component patterns, fill in missing token slots) but you CANNOT change core tokens like primary color, font family, glassmorphism values, shadow tints, or violate any stated rules (e.g. "NO gradients").\n\n---\n\n${existingDesignDoc}\n\n---\n\n# Product Context (for extending, not overriding)\n\n${userPrompt}`;
  }

  // Call Claude to generate the design system
  const stream = client.messages.stream({
    model: "claude-sonnet-4-5",
    max_tokens: 24000,
    system: DESIGN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const finalMessage = await stream.finalMessage();
  const firstContent = finalMessage.content[0];
  if (!firstContent || firstContent.type !== "text") {
    throw new Error("Design system agent: unexpected response type from Anthropic API");
  }

  const parsed = extractJsonFromResponse(firstContent.text) as DesignSystemResponse;

  // Validate required fields
  if (!parsed.tokens || !parsed.tokens.colors || !parsed.tokens.typography) {
    throw new Error("Design system agent: response missing required token fields");
  }
  if (!parsed.tailwindExtend || typeof parsed.tailwindExtend !== "object") {
    throw new Error("Design system agent: response missing tailwindExtend block");
  }
  if (!parsed.cssCustomProperties || typeof parsed.cssCustomProperties !== "string") {
    throw new Error("Design system agent: response missing cssCustomProperties");
  }
  if (!parsed.componentDesignGuide || typeof parsed.componentDesignGuide !== "string") {
    throw new Error("Design system agent: response missing componentDesignGuide");
  }

  // ─── Write files to disk ────────────────────────────────────────────────

  // 1. Tailwind config — read existing, merge, write
  const existingTailwind = store.readProjectFile("tailwind.config.ts");
  const mergedTailwind = mergeTailwindConfig(existingTailwind, parsed.tailwindExtend);
  store.writeProjectFile("tailwind.config.ts", mergedTailwind);

  // 2. CSS custom properties — use Claude's generated version, but fall back
  //    to our builder if the response is too short (sanity check)
  const cssContent = parsed.cssCustomProperties.length > 100
    ? parsed.cssCustomProperties
    : buildCssCustomProperties(parsed.tokens, parsed.colorMode);
  store.writeProjectFile("client/src/styles/design-system.css", cssContent);

  // 3. Component design guide
  store.writeProjectFile(
    ".planning/artifacts/COMPONENT_DESIGN_GUIDE.md",
    parsed.componentDesignGuide,
  );

  // 4. Design contract — TypeScript file that makes design violations compile errors
  const designContract = generateDesignContract(parsed.tokens);
  store.writeProjectFile("client/src/lib/design-tokens.ts", designContract);

  // ─── Build and persist artifact ─────────────────────────────────────────

  // 5. Tailwind token enforcement — generate CSS-variable-backed color map
  //    so that arbitrary color values (text-[#FF0000]) are replaced by
  //    token classes (text-primary, text-secondary, etc.)
  const tokenColorMap: Record<string, string> = {};
  for (const [name] of Object.entries(parsed.tokens.colors)) {
    const cssVar = `--color-${name.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
    tokenColorMap[name] = `var(${cssVar})`;
  }
  // Inject into the tailwind extend block so only design system colors are named
  if (parsed.tailwindExtend && typeof parsed.tailwindExtend === "object") {
    (parsed.tailwindExtend as Record<string, unknown>).colors = {
      ...((parsed.tailwindExtend as Record<string, unknown>).colors as Record<string, unknown> ?? {}),
      ...tokenColorMap,
    };
  }

  const designSystem: DesignSystem = {
    tokens: parsed.tokens,
    tailwindConfigPath: "tailwind.config.ts",
    cssCustomPropertiesPath: "client/src/styles/design-system.css",
    componentDesignGuidePath: ".planning/artifacts/COMPONENT_DESIGN_GUIDE.md",
    aesthetic: parsed.aesthetic,
    colorMode: parsed.colorMode,
  };

  store.setDesignSystem(designSystem);

  store.appendBuildLog({
    agent: "design-system",
    event: "completed",
    timestamp: Date.now(),
    detail: `Generated ${Object.keys(parsed.tokens.colors).length} color tokens, ${parsed.tokens.typography.fontFamily} typography, wrote 3 files`,
  });

  return designSystem;
}
