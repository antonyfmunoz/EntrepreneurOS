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
 * Parse DESIGN.md content back into a DesignTokens object.
 * Best-effort: missing fields are simply absent from the result.
 */
export function parseDesignMD(content: string): DesignTokens {
  const tokens: DesignTokens = {};

  const grab = (label: string): string | undefined => {
    const re = new RegExp(`${label}:\\s*([^\\n]+)`, "i");
    const m = content.match(re);
    return m?.[1]?.trim();
  };

  const primary = grab("Primary");
  if (primary && primary !== "not set") tokens.colorPrimary = primary;

  const secondary = grab("Secondary");
  if (secondary && secondary !== "not set") tokens.colorSecondary = secondary;

  const background = grab("Background");
  if (background && background !== "not set") tokens.colorBackground = background;

  const surface = grab("Surface");
  if (surface && surface !== "not set") tokens.colorSurface = surface;

  const text = grab("Text");
  if (text && text !== "not set") tokens.colorText = text;

  const accent = grab("Accent");
  if (accent && accent !== "not set") tokens.colorAccent = accent;

  const font = grab("Font Family");
  if (font && font !== "not set") {
    tokens.fontHeading = font;
    tokens.fontBody = font;
  }

  const spacing = grab("Base Unit");
  if (spacing) tokens.spacing = spacing;

  const radius = grab("Default");
  if (radius) tokens.borderRadius = radius;

  // Component Direction is a section header, not a `Label: value` line
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
