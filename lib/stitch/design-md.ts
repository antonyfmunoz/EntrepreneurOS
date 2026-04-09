import type { DmTokenRow } from "../ui-generator/types.js";

/**
 * DESIGN.md export/import (Plan 03-08).
 *
 * Stitch's MCP does not currently expose an export_design_system tool, so the
 * "export" path generates a Markdown document from the most recent dmTokens row.
 * The result is persisted in dm_design_md (immutable, versioned per project) and
 * referenced in subsequent page prompts to keep design intent stable.
 *
 * Fail-open: any error falls back to an empty design system.
 */

export interface DesignTokens {
  colorPrimary?: string;
  colorSecondary?: string;
  colorBackground?: string;
  colorSurface?: string;
  colorText?: string;
  colorAccent?: string;
  fontHeading?: string;
  fontBody?: string;
  spacing?: string;
  borderRadius?: string;
  componentDirection?: string;
}

/**
 * Export DESIGN.md from current tokens. (Stitch MCP fallback path.)
 */
export async function exportDesignMD(
  projectId: string,
  currentTokens: DmTokenRow | null
): Promise<{ content: string; tokens: DesignTokens }> {
  void projectId; // reserved for future MCP-backed export
  const content = generateDesignMDFromTokens(currentTokens);
  // When there are no tokens yet the generator emits a stub document that
  // intentionally has no Colors/Typography/etc sections. Skip parsing and
  // return an empty tokens object instead of throwing on the missing sections.
  if (currentTokens === null) {
    return { content, tokens: {} };
  }
  const tokens = parseDesignMD(content);
  return { content, tokens };
}

/**
 * Generate DESIGN.md content from a dmTokens row.
 */
export function generateDesignMDFromTokens(tokens: DmTokenRow | null): string {
  if (!tokens) {
    return `# Design System\n\nNo tokens available yet.\n`;
  }

  return `# Design System

## Colors
- Primary: ${tokens.colorPrimary ?? "not set"}
- Secondary: ${tokens.colorSecondary ?? "not set"}
- Background: ${tokens.colorBackground ?? "not set"}
- Surface: ${tokens.colorSurface ?? "not set"}
- Text: ${tokens.colorText ?? "not set"}
- Accent: ${tokens.colorAccent ?? "not set"}

## Typography
- Font Family: ${tokens.typeFontFamily ?? "not set"}
- Base Size: ${tokens.typeSizeBase ?? 16}px
- Scale Ratio: ${tokens.typeScaleRatio ?? "not set"}

## Spacing
- Base Unit: ${tokens.spacingUnit ?? 8}px

## Border Radius
- Default: ${tokens.borderRadius ?? 8}px

## Component Direction
${tokens.componentDirection ?? "modern, professional aesthetic"}

## Shadows
${tokens.shadowStyle ?? "subtle elevation"}
`;
}

/**
 * Required top-level sections in a well-formed DESIGN.md. parseDesignMD throws
 * if any of these are missing — silent fall-through corrupts downstream prompts.
 */
const REQUIRED_SECTIONS = [
  "Colors",
  "Typography",
  "Spacing",
  "Border Radius",
  "Component Direction",
] as const;

const HEX_RE = /^#[0-9A-Fa-f]{3,8}$/;

export interface DesignMDValidationResult {
  ok: boolean;
  missingSections: string[];
  invalidColors: { label: string; value: string }[];
}

export class DesignMDFormatError extends Error {
  constructor(
    message: string,
    public readonly missingSections: string[] = [],
    public readonly invalidColors: { label: string; value: string }[] = [],
    public readonly sourcePath?: string,
  ) {
    super(message);
    this.name = "DesignMDFormatError";
  }
}

function findSection(content: string, name: string): boolean {
  const re = new RegExp(`^#{1,3}\\s*${name}\\b`, "im");
  return re.test(content);
}

function grabLabel(content: string, label: string): string | undefined {
  // Anchor on a leading dash or whitespace so we don't match section headers.
  const re = new RegExp(`-\\s*${label}\\s*:\\s*([^\\n]+)`, "i");
  return content.match(re)?.[1]?.trim();
}

/**
 * Validate DESIGN.md without parsing. Used by verification commands and the
 * orchestrator preflight to surface format drift before any LLM call.
 */
export function validateDesignMD(content: string): DesignMDValidationResult {
  const missingSections = REQUIRED_SECTIONS.filter(
    (s) => !findSection(content, s),
  );

  const colorLabels = [
    "Primary",
    "Secondary",
    "Background",
    "Surface",
    "Text",
    "Accent",
  ] as const;

  const invalidColors: { label: string; value: string }[] = [];
  for (const label of colorLabels) {
    const value = grabLabel(content, label);
    if (!value || value === "not set") continue;
    if (!HEX_RE.test(value)) {
      invalidColors.push({ label, value });
    }
  }

  return {
    ok: missingSections.length === 0 && invalidColors.length === 0,
    missingSections: [...missingSections],
    invalidColors,
  };
}

/**
 * Parse DESIGN.md content into a DesignTokens object. Throws DesignMDFormatError
 * when required sections are missing or color values are not in hex format.
 * "not set" placeholders are still tolerated (those are the generator's marker
 * for "no value yet" and round-trip cleanly to undefined).
 *
 * @param content - DESIGN.md text
 * @param sourcePath - Optional source path for the error message
 */
export function parseDesignMD(
  content: string,
  sourcePath?: string,
): DesignTokens {
  const validation = validateDesignMD(content);
  if (!validation.ok) {
    const parts: string[] = [];
    if (validation.missingSections.length > 0) {
      parts.push(`missing sections: ${validation.missingSections.join(", ")}`);
    }
    if (validation.invalidColors.length > 0) {
      parts.push(
        `invalid color values: ${validation.invalidColors
          .map((c) => `${c.label}="${c.value}" (expected #RRGGBB)`)
          .join("; ")}`,
      );
    }
    throw new DesignMDFormatError(
      `DESIGN.md format error${sourcePath ? ` in ${sourcePath}` : ""}: ${parts.join("; ")}`,
      validation.missingSections,
      validation.invalidColors,
      sourcePath,
    );
  }

  const tokens: DesignTokens = {};

  const primary = grabLabel(content, "Primary");
  if (primary && primary !== "not set") tokens.colorPrimary = primary;

  const secondary = grabLabel(content, "Secondary");
  if (secondary && secondary !== "not set") tokens.colorSecondary = secondary;

  const background = grabLabel(content, "Background");
  if (background && background !== "not set")
    tokens.colorBackground = background;

  const surface = grabLabel(content, "Surface");
  if (surface && surface !== "not set") tokens.colorSurface = surface;

  const text = grabLabel(content, "Text");
  if (text && text !== "not set") tokens.colorText = text;

  const accent = grabLabel(content, "Accent");
  if (accent && accent !== "not set") tokens.colorAccent = accent;

  const font = grabLabel(content, "Font Family");
  if (font && font !== "not set") {
    tokens.fontHeading = font;
    tokens.fontBody = font;
  }

  const spacing = grabLabel(content, "Base Unit");
  if (spacing) tokens.spacing = spacing;

  const radius = grabLabel(content, "Default");
  if (radius) tokens.borderRadius = radius;

  // Component Direction is a section header followed by a prose line
  const dirMatch = content.match(/##\s*Component Direction\s*\n([^\n#]+)/i);
  if (dirMatch?.[1]) tokens.componentDirection = dirMatch[1].trim();

  return tokens;
}

/**
 * Import DESIGN.md into a Stitch project. Stitch MCP does not currently support
 * design-system import, so this is a no-op stub that callers use as a signal to
 * inject the DESIGN.md into their next page prompt instead.
 */
export async function importDesignMD(
  projectId: string,
  designMD: string
): Promise<void> {
  void projectId;
  void designMD;
  // Intentionally a no-op — callers should inject DESIGN.md into page prompts.
}
