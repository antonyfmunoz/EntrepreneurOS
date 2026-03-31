import { z } from "zod";
import type { InferSelectModel } from "drizzle-orm";
import { dmTokens } from "@shared/design-schema.js";

// ─── SECTION 1: Confidence Threshold ────────────────────────────────────────

// All four review dimensions must meet this threshold for auto-approval (D-10, UIGEN-07)
export const CONFIDENCE_THRESHOLD = 0.9;

// ─── SECTION 2: Review Score Schema ─────────────────────────────────────────

// Per-dimension schema: score in [0,1] plus human-readable findings
const DimensionSchema = z.object({
  score: z.number().min(0).max(1),
  findings: z.array(z.string()),
});

export const ReviewScoreSchema = z.object({
  specCompliance: DimensionSchema,
  visualConsistency: DimensionSchema,
  structuralCompleteness: DimensionSchema,
  contentQuality: DimensionSchema,
});

export type ReviewScore = z.infer<typeof ReviewScoreSchema>;

// ─── SECTION 3: allDimensionsPass helper ────────────────────────────────────

// Returns true only when all four dimension scores meet or exceed CONFIDENCE_THRESHOLD
export function allDimensionsPass(score: ReviewScore): boolean {
  return (
    score.specCompliance.score >= CONFIDENCE_THRESHOLD &&
    score.visualConsistency.score >= CONFIDENCE_THRESHOLD &&
    score.structuralCompleteness.score >= CONFIDENCE_THRESHOLD &&
    score.contentQuality.score >= CONFIDENCE_THRESHOLD
  );
}

// ─── SECTION 4: Approval Gate ────────────────────────────────────────────────

export interface ApprovalGateResult {
  needsUserApproval: boolean;
  reason: "first_page" | "score_below_threshold" | "auto_approved";
  failedDimensions?: (keyof ReviewScore)[];
  scores?: ReviewScore;
}

// ─── SECTION 5: Token Extraction Result ─────────────────────────────────────

export interface TokenExtractionResult {
  tokens: Record<string, string | number | null>;
  patterns: Array<{
    name: string;
    variant?: string;
    propsShape?: string;
    usageContext?: string;
    shadcnComponent?: string;
  }>;
}

// ─── SECTION 6: Conflict Detection Result ───────────────────────────────────

export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflicts: Array<{
    patternName: string;
    existingValue: string;
    newValue: string;
    recommendation: string;
  }>;
}

// ─── SECTION 7: Database Row Type ───────────────────────────────────────────

// Alias for the Drizzle inferred select type — used throughout Phase 3 modules
export type DmTokenRow = InferSelectModel<typeof dmTokens>;

// ─── SECTION 8: Device Type ──────────────────────────────────────────────────

// Subset of Stitch's deviceType — AGNOSTIC not used in Phase 3 (D-03)
export type DeviceType = "DESKTOP" | "MOBILE" | "TABLET";

// ─── SECTION 9: Size Constants ───────────────────────────────────────────────

// Maximum HTML size (in chars) accepted for design token extraction (research open question #2)
export const MAX_HTML_FOR_EXTRACTION = 80_000;

// Maximum HTML size (in chars) accepted for AI self-review
export const MAX_HTML_FOR_REVIEW = 120_000;

// ─── SECTION 10: Prompt Size Budget ─────────────────────────────────────────

// Addresses review concern: prompt size growth across tokens, patterns, component refs
// Total prompt budget = Stitch prompt + component refs + design seed direction
export const MAX_PROMPT_TOTAL_CHARS = 30_000;

// ─── SECTION 11: Design System Seed ─────────────────────────────────────────

export interface DesignSystemSeed {
  colorPalette: {
    primary: string;       // hex
    secondary: string;     // hex
    background: string;    // hex
    surface: string;       // hex
    text: string;          // hex
    accent: string;        // hex
  };
  fontPairing: {
    heading: string;       // font family name
    body: string;          // font family name
  };
  spacingSystem: {
    unit: number;          // px base unit (4 or 8)
    borderRadius: number;  // px
  };
  componentDirection: string; // e.g. "minimal cards with subtle shadows, rounded buttons"
}

// ─── SECTION 12: Mockup Result ───────────────────────────────────────────────

export interface MockupResult {
  imageBase64: string;     // base64-encoded PNG
  mimeType: string;        // "image/png"
}

// ─── SECTION 13: Default Seed (fail-closed fallback) ─────────────────────────

// When Claude returns malformed JSON for design system seeding,
// use this neutral default rather than crashing the pipeline.
export const DEFAULT_DESIGN_SEED: DesignSystemSeed = {
  colorPalette: {
    primary: "#1a1a2e",
    secondary: "#16213e",
    background: "#0f0f23",
    surface: "#1a1a3e",
    text: "#e4e4e7",
    accent: "#6366f1",
  },
  fontPairing: {
    heading: "Inter",
    body: "Inter",
  },
  spacingSystem: {
    unit: 4,
    borderRadius: 8,
  },
  componentDirection: "clean minimal cards with subtle shadows and rounded interactive elements",
};
