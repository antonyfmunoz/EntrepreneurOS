import type { PageSpecFull } from "@shared/spec-schema.js";
import type { DmTokenRow } from "./types.js";
import { MAX_PROMPT_TOTAL_CHARS } from "./types.js";

// ─── buildStitchPrompt ───────────────────────────────────────────────────────

/**
 * Translates a PageSpecFull + optional design tokens into a Stitch-ready prompt string.
 * Pure function — no I/O, no AI calls. (D-01, D-02)
 *
 * @param spec                The full page specification for this page
 * @param tokens              Design memory tokens (null = no constraints injected)
 * @param priorScreenshotUrl  URL of a previously approved screenshot for style reference
 * @param componentDirection  Optional component style direction from DesignSystemSeed
 * @param componentReferences Formatted component registry references from discovery layer (optional)
 */
export function buildStitchPrompt(
  spec: PageSpecFull,
  tokens: DmTokenRow | null,
  priorScreenshotUrl?: string,
  componentDirection?: string,
  componentReferences?: string
): string {
  const parts: string[] = [];

  // 1. Page description
  parts.push(`Design a ${spec.name} page for a SaaS application.`);

  // 2. Purpose
  parts.push(`Purpose: ${spec.purpose}`);

  // 3. Components (only if at least one component specified)
  if (spec.components.length > 0) {
    parts.push(`Components required: ${spec.components.join(", ")}.`);
  }

  // 4. Layout hint (optional)
  if (spec.layoutHint !== undefined && spec.layoutHint !== null) {
    parts.push(`Layout: ${spec.layoutHint}`);
  }

  // 5. Auth requirement (skip for public pages)
  if (spec.authLevel !== "public") {
    parts.push("This page requires authentication.");
  }

  // 6. Empty state (optional)
  if (spec.emptyState !== undefined && spec.emptyState !== null) {
    parts.push(`Empty state behavior: ${spec.emptyState}`);
  }

  // 7. Loading state (optional)
  if (spec.loadingState !== undefined && spec.loadingState !== null) {
    parts.push(`Loading state behavior: ${spec.loadingState}`);
  }

  // 8. Error state (optional)
  if (spec.errorState !== undefined && spec.errorState !== null) {
    parts.push(`Error state behavior: ${spec.errorState}`);
  }

  // 9. Token constraints block (only when tokens provided)
  if (tokens !== null) {
    const constraintLines: string[] = [];

    if (tokens.colorPrimary !== null && tokens.colorPrimary !== undefined) {
      constraintLines.push(`primary color ${tokens.colorPrimary}`);
    }
    if (tokens.colorSecondary !== null && tokens.colorSecondary !== undefined) {
      constraintLines.push(`secondary color ${tokens.colorSecondary}`);
    }
    if (tokens.colorBackground !== null && tokens.colorBackground !== undefined) {
      constraintLines.push(`background color ${tokens.colorBackground}`);
    }
    if (tokens.colorSurface !== null && tokens.colorSurface !== undefined) {
      constraintLines.push(`surface color ${tokens.colorSurface}`);
    }
    if (tokens.colorText !== null && tokens.colorText !== undefined) {
      constraintLines.push(`text color ${tokens.colorText}`);
    }
    if (tokens.colorAccent !== null && tokens.colorAccent !== undefined) {
      constraintLines.push(`accent color ${tokens.colorAccent}`);
    }
    if (tokens.typeFontFamily !== null && tokens.typeFontFamily !== undefined) {
      constraintLines.push(`font family ${tokens.typeFontFamily}`);
    }
    if (tokens.typeSizeBase !== null && tokens.typeSizeBase !== undefined) {
      constraintLines.push(`base font size ${tokens.typeSizeBase}px`);
    }
    if (tokens.spacingUnit !== null && tokens.spacingUnit !== undefined) {
      constraintLines.push(`spacing unit ${tokens.spacingUnit}px`);
    }
    if (tokens.borderRadius !== null && tokens.borderRadius !== undefined) {
      constraintLines.push(`border radius ${tokens.borderRadius}px`);
    }
    if (tokens.shadowStyle !== null && tokens.shadowStyle !== undefined) {
      constraintLines.push(`shadow style: ${tokens.shadowStyle}`);
    }

    if (constraintLines.length > 0) {
      parts.push("Visual constraints (must be followed exactly):");
      for (const line of constraintLines) {
        parts.push(line);
      }
    }
  }

  // 10. Prior screenshot reference (only when URL provided)
  if (priorScreenshotUrl !== undefined && priorScreenshotUrl !== null) {
    parts.push("Reference the visual style from the previously approved page screenshot.");
  }

  // 11. Component style direction (from design system seed, optional)
  if (componentDirection) {
    parts.push(`Component style direction: ${componentDirection}`);
  }

  // 12. Component implementation references (from discovery layer, optional)
  if (componentReferences && componentReferences.length > 0) {
    parts.push(componentReferences);
  }

  // Enforce total prompt size budget to prevent unbounded growth
  let result = parts.join("\n");
  if (result.length > MAX_PROMPT_TOTAL_CHARS) {
    result = result.slice(0, MAX_PROMPT_TOTAL_CHARS);
  }
  return result;
}
