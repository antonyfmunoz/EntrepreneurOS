import { describe, expect, it } from "vitest";
import {
  commercialStateForDisposition,
  recoveryCall2DecisionSchema,
  recoveryCall2Terms,
  recoveryCall2UpdateSchema,
} from "../../shared/recovery-call2";

describe("Recovery Call-2 authority contract", () => {
  it("exposes only the two current server-owned packages", () => {
    expect(recoveryCall2Terms("founding_proof_cohort")).toMatchObject({
      setupAmount: 3_000,
      monthlyAmount: 1_500,
      currency: "USD",
    });
    expect(recoveryCall2Terms("standard")).toMatchObject({
      setupAmount: 5_000,
      monthlyAmount: 2_500,
      currency: "USD",
    });
  });

  it("does not accept an arbitrary package or operator-authored price", () => {
    const base = {
      version: 1,
      buyerDecisionMakers: ["Owner"],
      observedFacts: "Observed source records.",
      measuredSignals: "Modeled diagnostic result.",
      unavailableData: "Realized outcomes unavailable.",
      changesSinceCall1: "No changes.",
      recoveryThesis: "Validate one bounded pool.",
      scopeDiscussion: "Canonical scope.",
      measurementAttribution: "No overlap.",
      clientResponsibilities: "Provide records.",
      objections: "Needs proof.",
      recommendedPackage: "custom",
      foundingProofConsideration: "",
      setupAmount: 1,
    };
    expect(recoveryCall2UpdateSchema.safeParse(base).success).toBe(false);
  });

  it("requires a complete won handoff and maps all canonical dispositions", () => {
    expect(recoveryCall2DecisionSchema.safeParse({
      version: 1,
      disposition: "closed_won_pending_agreement_payment",
      decisionMaker: "Owner",
      nextAction: "Send agreement",
      nextActionAt: new Date(),
      agreementVersion: "",
      paymentPath: "",
      onboardingTrigger: "",
    }).success).toBe(false);
    expect(commercialStateForDisposition("closed_won_pending_agreement_payment")).toBe("won");
    expect(commercialStateForDisposition("conditional_named_dependency")).toBe("on_hold");
    expect(commercialStateForDisposition("nurture_not_now")).toBe("on_hold");
    expect(commercialStateForDisposition("closed_lost_reason")).toBe("lost");
  });
});
