import { describe, expect, it } from "vitest";
import { learningDecisionSchema, realityObservationCreateSchema, scenarioCreateSchema } from "../../shared/institutional-intelligence";
import { stakeholderAccessGrantSchema, stakeholderPortalCreateSchema } from "../../shared/stakeholder-portal";

describe("institutional intelligence contracts", () => {
  it("requires Evidence before an observation can be called verified", () => {
    expect(realityObservationCreateSchema.safeParse({ observationKey: "obs-1", subject: "Qualified runtime", statement: "The exact runtime passed the bounded fixture.", sourceKind: "workflow", observedAt: new Date().toISOString(), confidence: 100, state: "verified", evidenceIds: [] }).success).toBe(false);
    expect(realityObservationCreateSchema.safeParse({ observationKey: "obs-1", subject: "Qualified runtime", statement: "The exact runtime passed the bounded fixture.", sourceKind: "workflow", observedAt: new Date().toISOString(), confidence: 100, state: "verified", evidenceIds: ["evidence-1"] }).success).toBe(true);
  });

  it("keeps simulations bounded and separate from observed reality", () => {
    const parsed = scenarioCreateSchema.parse({ scenarioKey: "scenario-1", name: "Two branches", decisionQuestion: "Which branch should the bounded operator select?", assumptions: [{ statement: "Demand remains stable" }], branches: [{ name: "A" }, { name: "B" }] });
    expect(parsed.branches).toHaveLength(2);
    expect(scenarioCreateSchema.safeParse({ ...parsed, branches: [{ name: "only" }] }).success).toBe(false);
  });

  it("prevents accepted learning from silently becoming memory", () => {
    expect(learningDecisionSchema.safeParse({ state: "implemented", rationale: "The founder reviewed and approved the exact proposal and its supporting Evidence." }).success).toBe(false);
    expect(learningDecisionSchema.safeParse({ state: "accepted", rationale: "The founder reviewed and approved the exact proposal and its supporting Evidence." }).success).toBe(true);
  });
});
describe("stakeholder portal contracts", () => {
  it("creates explicit dormant-safe disclosure scope", () => {
    const portal = stakeholderPortalCreateSchema.parse({ portalKey: "client-1", name: "Client workspace", portalType: "client", visibleSections: ["updates"], activationRequirements: ["Verify the intended recipient"] });
    expect(portal.visibleSections).toEqual(["updates"]);
  });

  it("rejects expired access grants", () => {
    expect(stakeholderAccessGrantSchema.safeParse({ recipientLabel: "Client", recipientIdentity: "client@example.test", expiresAt: new Date(Date.now() - 1_000).toISOString(), rationale: "Issue only bounded and revocable access to the intended external recipient." }).success).toBe(false);
  });
});
