import { describe, it, expect } from "vitest";
import {
  evaluateApprovalGate,
  formatApprovalGateDisplay,
  formatAutoApproveNotice,
} from "../../../lib/ui-generator/approval-gate.js";
import type { ReviewScore } from "../../../lib/ui-generator/types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReviewScore(overrides: Partial<{
  specCompliance: { score: number; findings: string[] };
  visualConsistency: { score: number; findings: string[] };
  structuralCompleteness: { score: number; findings: string[] };
  contentQuality: { score: number; findings: string[] };
}> = {}): ReviewScore {
  const defaultDim = { score: 0.95, findings: [] };
  return {
    specCompliance: overrides.specCompliance ?? { ...defaultDim },
    visualConsistency: overrides.visualConsistency ?? { ...defaultDim },
    structuralCompleteness: overrides.structuralCompleteness ?? { ...defaultDim },
    contentQuality: overrides.contentQuality ?? { ...defaultDim },
  };
}

// ─── evaluateApprovalGate tests ───────────────────────────────────────────────

describe("evaluateApprovalGate", () => {
  it("Test 1: pageIndex 0 with all passing scores always escalates with reason first_page", () => {
    const score = makeReviewScore();
    const result = evaluateApprovalGate(0, score);

    expect(result.needsUserApproval).toBe(true);
    expect(result.reason).toBe("first_page");
  });

  it("Test 2: pageIndex 0 with all failing scores also escalates with reason first_page", () => {
    const score = makeReviewScore({
      specCompliance: { score: 0.5, findings: ["Missing sidebar"] },
      visualConsistency: { score: 0.4, findings: ["Wrong color"] },
      structuralCompleteness: { score: 0.3, findings: ["No nav"] },
      contentQuality: { score: 0.2, findings: ["Lorem ipsum found"] },
    });
    const result = evaluateApprovalGate(0, score);

    expect(result.needsUserApproval).toBe(true);
    expect(result.reason).toBe("first_page");
  });

  it("Test 3: pageIndex 1 with all passing scores auto-approves", () => {
    const score = makeReviewScore();
    const result = evaluateApprovalGate(1, score);

    expect(result.needsUserApproval).toBe(false);
    expect(result.reason).toBe("auto_approved");
  });

  it("Test 4: pageIndex 1 with one failing score escalates with failedDimensions", () => {
    const score = makeReviewScore({
      specCompliance: { score: 0.7, findings: ["Missing chart component"] },
    });
    const result = evaluateApprovalGate(1, score);

    expect(result.needsUserApproval).toBe(true);
    expect(result.reason).toBe("score_below_threshold");
    expect(result.failedDimensions).toContain("specCompliance");
  });

  it("Test 5: pageIndex 5 with all passing scores auto-approves", () => {
    const score = makeReviewScore();
    const result = evaluateApprovalGate(5, score);

    expect(result.needsUserApproval).toBe(false);
    expect(result.reason).toBe("auto_approved");
  });

  it("Test 6: multiple failing dimensions all appear in failedDimensions array", () => {
    const score = makeReviewScore({
      specCompliance: { score: 0.7, findings: ["Missing sidebar"] },
      visualConsistency: { score: 0.5, findings: ["Wrong colors"] },
    });
    const result = evaluateApprovalGate(2, score);

    expect(result.needsUserApproval).toBe(true);
    expect(result.reason).toBe("score_below_threshold");
    expect(result.failedDimensions).toContain("specCompliance");
    expect(result.failedDimensions).toContain("visualConsistency");
    expect(result.failedDimensions?.length).toBe(2);
  });
});

// ─── formatApprovalGateDisplay test ──────────────────────────────────────────

describe("formatApprovalGateDisplay", () => {
  it("Test 7: display contains page name, scores, and action options", () => {
    const score = makeReviewScore({
      specCompliance: { score: 0.75, findings: ["Chart missing"] },
    });

    const result = formatApprovalGateDisplay({
      pageName: "Dashboard",
      pageIndex: 0,
      screenshotUrls: ["https://example.com/shot.png"],
      scores: score,
      specComponents: ["sidebar", "chart", "header"],
      foundComponents: ["sidebar", "header"],
      missingComponents: ["chart"],
    });

    // Page name and index present
    expect(result).toContain("Dashboard");
    // Screenshot URL listed
    expect(result).toContain("https://example.com/shot.png");
    // Scores shown
    expect(result).toContain("75");
    // Action options
    expect(result).toContain("Approve");
    expect(result).toContain("Reject");
    expect(result).toContain("Skip");
  });
});

// ─── formatAutoApproveNotice test ─────────────────────────────────────────────

describe("formatAutoApproveNotice", () => {
  it("returns one-line notice with page name and 90%+ mention", () => {
    const result = formatAutoApproveNotice("Settings", 2);

    expect(result).toContain("Settings");
    expect(result).toContain("90%");
    expect(result).toContain("auto-approved");
    // Should be a single line (no newlines)
    expect(result.split("\n").length).toBe(1);
  });
});
