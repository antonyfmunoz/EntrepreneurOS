import { describe, expect, it } from "vitest";
import {
  advisorCalibrationSchema,
  advisorDeliberationAdvance,
  advisorDeliberationCreateSchema,
} from "../../shared/advisor-deliberation";
import { buildAdvisorCouncil } from "../../shared/eos-runtime";

describe("founder advisor council deliberation contract", () => {
  it("retains the canonical founder-specific fifteen-seat council", () => {
    const council = buildAdvisorCouncil({ founderName: "Founder", portfolioName: "Portfolio", companyName: "Company", founderProfile: { vision: "Build durable institutions", values: "truth and stewardship", decisionStyle: "evidence-led" }, companyGoals: "Qualify the operating model" });
    expect(council.count).toBe(15);
    expect(council.advisors).toHaveLength(15);
    expect(council.founderFacingAgent).toBe("executive_assistant");
    expect(council.councilMode).toBe("advisory_only");
  });

  it("requires independent analysis, rebuttal, revision and synthesis before decision", () => {
    expect(advisorDeliberationAdvance("draft")).toBe("independent_complete");
    expect(advisorDeliberationAdvance("independent_complete")).toBe("rebuttal_complete");
    expect(advisorDeliberationAdvance("rebuttal_complete")).toBe("revision_complete");
    expect(advisorDeliberationAdvance("revision_complete")).toBe("synthesis_ready");
    expect(advisorDeliberationAdvance("synthesis_ready")).toBeNull();
  });

  it("keeps creation and outcome calibration attributable and bounded", () => {
    expect(advisorDeliberationCreateSchema.safeParse({ question: "Should the company activate this operating model now?", decisionContext: "The pre-live fixtures passed, but provider and field evidence remain incomplete.", panelMode: "full_council", requestedAdvisorIds: [], evidenceIds: [], classification: "restricted" }).success).toBe(true);
    expect(advisorCalibrationSchema.safeParse({ expectedVersion: 6, outcomeSummary: "The decision produced the expected operating outcome with a measurable delay in provider readiness.", outcome: "as_expected", outcomeEvidenceIds: [], claimOutcomes: [], learningProposal: "Retain the provider-readiness gate in the template." }).success).toBe(true);
  });
});
