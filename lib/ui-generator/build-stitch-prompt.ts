import { readFileSync, existsSync } from "node:fs";
import type { PageSpecFull } from "@shared/spec-schema.js";
import type { DmTokenRow, SkillEnrichment } from "./types.js";
import { MAX_PROMPT_TOTAL_CHARS } from "./types.js";
import type { PageCopy } from "../copy-planner/types.js";

// The design system markdown is the single source of truth. When a path is
// passed, the file is read and injected verbatim — no project-specific brand
// rules, color values, or validation checklists are baked into this module.
function loadDesignSystemDoc(path: string | undefined): string | null {
  if (!path) return null;
  try {
    if (existsSync(path)) return readFileSync(path, "utf8");
    return null;
  } catch {
    return null;
  }
}

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
 * @param enrichment          Session-level skill enrichment (frontend-design + ui-ux-pro-max), optional
 * @param designSystemPath    Absolute path to the project's design-system.md (optional). When
 *                            provided, the file is loaded and injected verbatim as the single
 *                            source of truth for visual rules. No brand-specific values are
 *                            hardcoded in this module — every color, font, and rule lives in
 *                            the project's design system file.
 */
export function buildStitchPrompt(
  spec: PageSpecFull,
  tokens: DmTokenRow | null,
  priorScreenshotUrl?: string,
  componentDirection?: string,
  componentReferences?: string,
  enrichment?: SkillEnrichment,
  designSystemPath?: string,
  brandVoice?: string,
  pageCopy?: PageCopy,
  competitiveStructure?: string,
  userFeedback?: string,
): string {
  const parts: string[] = [];

  // 0a. Project design system — injected verbatim from the path the caller
  //     resolved against project config. The file content is the entire contract;
  //     this module adds no brand-specific overrides.
  const designSystemDoc = loadDesignSystemDoc(designSystemPath);
  if (designSystemDoc) {
    parts.push("# DESIGN SYSTEM — single source of truth, follow exactly:");
    parts.push(designSystemDoc);
  }

  // 0b. Skill enrichment — production-grade design guidance, injected after the
  //     official design system. Fail-open: skipped if absent.
  if (enrichment?.designGuidance) {
    parts.push("## Production Design Guidance");
    parts.push(enrichment.designGuidance);
  }
  if (enrichment?.uxGuidance.palette) {
    parts.push(`## Recommended Palette\n${enrichment.uxGuidance.palette}`);
  }
  if (enrichment?.uxGuidance.fonts) {
    parts.push(`## Recommended Fonts\n${enrichment.uxGuidance.fonts}`);
  }

  // 0c. Brand voice — inferred from PRD, injected after design system and enrichment.
  //     Fail-open: omitted entirely when not available.
  if (brandVoice) {
    parts.push("## Brand Voice");
    parts.push(brandVoice);
  }

  // 0d. Page copy — approved copy from the copy planning phase. When present,
  //     Stitch must use this exact text for all visible UI elements.
  if (pageCopy) {
    const copyLines: string[] = [
      "# PAGE COPY — use this exact copy for all visible text. Do not invent your own copy.",
      `Heading: ${pageCopy.pageHeading}`,
    ];
    if (pageCopy.pageSubheading) {
      copyLines.push(`Subheading: ${pageCopy.pageSubheading}`);
    }
    if (pageCopy.ctas.length > 0) {
      copyLines.push(`CTAs: ${pageCopy.ctas.map((c) => c.label).join(", ")}`);
    }
    if (pageCopy.emptyState) {
      copyLines.push(`Empty state: ${pageCopy.emptyState}`);
    }
    if (Object.keys(pageCopy.placeholders).length > 0) {
      copyLines.push("Placeholders:");
      for (const [field, text] of Object.entries(pageCopy.placeholders)) {
        copyLines.push(`  ${field}: ${text}`);
      }
    }
    if (Object.keys(pageCopy.helperText).length > 0) {
      copyLines.push("Helper text:");
      for (const [field, text] of Object.entries(pageCopy.helperText)) {
        copyLines.push(`  ${field}: ${text}`);
      }
    }
    if (Object.keys(pageCopy.errorMessages).length > 0) {
      copyLines.push("Error messages:");
      for (const [key, msg] of Object.entries(pageCopy.errorMessages)) {
        copyLines.push(`  ${key}: ${msg}`);
      }
    }
    if (Object.keys(pageCopy.successMessages).length > 0) {
      copyLines.push("Success messages:");
      for (const [key, msg] of Object.entries(pageCopy.successMessages)) {
        copyLines.push(`  ${key}: ${msg}`);
      }
    }
    parts.push(copyLines.join("\n"));
  }

  // 0e. Competitive structure insights — optional layout guidance from competitor research.
  if (competitiveStructure) {
    parts.push("# COMPETITIVE STRUCTURE INSIGHTS — consider these patterns when designing layout:");
    parts.push(competitiveStructure);
  }

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

  // 13. User feedback from prior page reviews — highest priority overrides
  if (userFeedback) {
    parts.push("# MANDATORY DESIGN RULES — follow exactly, these override any conflicting guidance:");
    parts.push(userFeedback);
  }

  // Enforce total prompt size budget to prevent unbounded growth
  let result = parts.join("\n");
  if (result.length > MAX_PROMPT_TOTAL_CHARS) {
    result = result.slice(0, MAX_PROMPT_TOTAL_CHARS);
  }
  return result;
}
