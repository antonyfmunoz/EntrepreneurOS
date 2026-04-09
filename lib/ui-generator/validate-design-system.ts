/**
 * Validates that generated HTML follows the Ethereal Professional design system.
 * Reports forbidden colors, missing tokens, wrong fonts, and colored icons.
 */

const ETHEREAL_COLORS = {
  primary: "#6a37d4",
  secondary: "#6448b2",
  tertiary: "#ae8dff",
  background: "#ffffff",
  surface: "#f5f6f7",
  onSurface: "#2c2f30",
  outline: "#abadae",
} as const;

const FORBIDDEN_COLORS = [
  "#914700", // brown
  "#8b4513", // brown
  "#a0522d", // brown
  "#d2691e", // chocolate
];

export interface DesignValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  colorsFound: string[];
}

export function validateDesignSystem(html: string): DesignValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Collect all hex colors (lowercased)
  const colors = new Set<string>();
  for (const match of html.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    colors.add(`#${match[1].toLowerCase()}`);
  }

  // Forbidden colors
  for (const forbidden of FORBIDDEN_COLORS) {
    if (colors.has(forbidden)) {
      errors.push(
        `FORBIDDEN COLOR FOUND: ${forbidden} (likely wrong tertiary — should be ${ETHEREAL_COLORS.tertiary})`
      );
    }
  }

  // Must contain at least the primary and tertiary
  if (!colors.has(ETHEREAL_COLORS.primary)) {
    errors.push(`MISSING primary ${ETHEREAL_COLORS.primary}`);
  }
  if (!colors.has(ETHEREAL_COLORS.tertiary)) {
    errors.push(`MISSING tertiary ${ETHEREAL_COLORS.tertiary}`);
  }

  // Gradient check — accepts CSS linear-gradient or Tailwind from-[#hex] to-[#hex]
  const hasCssGradient =
    /linear-gradient[^;"]*#6a37d4[^;"]*#ae8dff/i.test(html) ||
    /linear-gradient[^;"]*#ae8dff[^;"]*#6a37d4/i.test(html);
  const hasTailwindGradient =
    /gradient-[a-z-]+[^"]*#6a37d4[^"]*#ae8dff/i.test(html) ||
    /gradient-[a-z-]+[^"]*#ae8dff[^"]*#6a37d4/i.test(html);
  const hasCorrectGradient = hasCssGradient || hasTailwindGradient;
  if (!hasCorrectGradient) {
    warnings.push("No #6a37d4 → #ae8dff linear-gradient detected (expected on primary buttons)");
  }

  // Inter font
  if (!/\bInter\b/.test(html)) {
    errors.push("Font 'Inter' not found — wrong typeface used");
  }

  // Colored icons: material-symbols span/element with inline color: #xxx where not #2c2f30 or #000000 or white
  const coloredIconRe =
    /material-symbols[^>]*style="[^"]*color\s*:\s*#(?!2c2f30|000000|000|ffffff|fff)([0-9a-fA-F]{3,6})/gi;
  if (coloredIconRe.test(html)) {
    warnings.push("Colored Material-Symbols icon detected — icons should be monochrome #2c2f30");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    colorsFound: [...colors].sort(),
  };
}
