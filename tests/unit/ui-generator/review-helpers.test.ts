import { describe, it, expect } from "vitest";
import {
  CONFIDENCE_THRESHOLD,
  REGENERATION_THRESHOLD,
  allDimensionsPass,
  lowestDimensionScore,
  belowRegenerationThreshold,
  formatScoreSummary,
  collectReviewFeedback,
} from "../../../lib/ui-generator/types.js";
import type { ReviewScore } from "../../../lib/ui-generator/types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeScore(scores: {
  spec?: number;
  visual?: number;
  structure?: number;
  content?: number;
} = {}): ReviewScore {
  return {
    specCompliance: { score: scores.spec ?? 0.8, findings: ["spec ok"] },
    visualConsistency: { score: scores.visual ?? 0.8, findings: ["visual ok"] },
    structuralCompleteness: { score: scores.structure ?? 0.8, findings: ["structure ok"] },
    contentQuality: { score: scores.content ?? 0.8, findings: ["content ok"] },
  };
}

// ─── Threshold constants ─────────────────────────────────────────────────────

describe("threshold constants", () => {
  it("CONFIDENCE_THRESHOLD is 0.7", () => {
    expect(CONFIDENCE_THRESHOLD).toBe(0.7);
  });

  it("REGENERATION_THRESHOLD is 0.5", () => {
    expect(REGENERATION_THRESHOLD).toBe(0.5);
  });
});

// ─── allDimensionsPass ───────────────────────────────────────────────────────

describe("allDimensionsPass", () => {
  it("passes when all dimensions >= 0.7", () => {
    expect(allDimensionsPass(makeScore({ spec: 0.7, visual: 0.7, structure: 0.7, content: 0.7 }))).toBe(true);
  });

  it("fails when any dimension < 0.7", () => {
    expect(allDimensionsPass(makeScore({ spec: 0.69 }))).toBe(false);
  });

  it("passes with high scores", () => {
    expect(allDimensionsPass(makeScore({ spec: 0.95, visual: 0.92, structure: 0.88, content: 0.9 }))).toBe(true);
  });
});

// ─── lowestDimensionScore ────────────────────────────────────────────────────

describe("lowestDimensionScore", () => {
  it("returns the minimum score across all dimensions", () => {
    expect(lowestDimensionScore(makeScore({ spec: 0.9, visual: 0.6, structure: 0.8, content: 0.7 }))).toBe(0.6);
  });

  it("returns the score when all dimensions are equal", () => {
    expect(lowestDimensionScore(makeScore({ spec: 0.75, visual: 0.75, structure: 0.75, content: 0.75 }))).toBe(0.75);
  });
});

// ─── belowRegenerationThreshold ──────────────────────────────────────────────

describe("belowRegenerationThreshold", () => {
  it("returns true when any dimension < 0.5", () => {
    expect(belowRegenerationThreshold(makeScore({ visual: 0.49 }))).toBe(true);
  });

  it("returns false when all dimensions >= 0.5", () => {
    expect(belowRegenerationThreshold(makeScore({ spec: 0.5, visual: 0.5, structure: 0.5, content: 0.5 }))).toBe(false);
  });

  it("returns false for passing scores", () => {
    expect(belowRegenerationThreshold(makeScore())).toBe(false);
  });
});

// ─── formatScoreSummary ──────────────────────────────────────────────────────

describe("formatScoreSummary", () => {
  it("formats all four dimensions as pipe-separated string", () => {
    const summary = formatScoreSummary(makeScore({ spec: 0.85, visual: 0.72, structure: 0.91, content: 0.68 }));
    expect(summary).toBe("spec=0.85 | visual=0.72 | structure=0.91 | content=0.68");
  });

  it("pads to two decimal places", () => {
    const summary = formatScoreSummary(makeScore({ spec: 1, visual: 0, structure: 0.5, content: 0.333 }));
    expect(summary).toContain("spec=1.00");
    expect(summary).toContain("visual=0.00");
    expect(summary).toContain("structure=0.50");
    expect(summary).toContain("content=0.33");
  });
});

// ─── collectReviewFeedback ───────────────────────────────────────────────────

describe("collectReviewFeedback", () => {
  it("collects all findings from all dimensions", () => {
    const score: ReviewScore = {
      specCompliance: { score: 0.8, findings: ["missing sidebar"] },
      visualConsistency: { score: 0.7, findings: ["color mismatch"] },
      structuralCompleteness: { score: 0.9, findings: [] },
      contentQuality: { score: 0.75, findings: ["placeholder text"] },
    };
    const feedback = collectReviewFeedback(score);
    expect(feedback).toContain("missing sidebar");
    expect(feedback).toContain("color mismatch");
    expect(feedback).toContain("placeholder text");
  });

  it("returns empty string when no findings", () => {
    const score: ReviewScore = {
      specCompliance: { score: 0.9, findings: [] },
      visualConsistency: { score: 0.9, findings: [] },
      structuralCompleteness: { score: 0.9, findings: [] },
      contentQuality: { score: 0.9, findings: [] },
    };
    expect(collectReviewFeedback(score)).toBe("");
  });
});
