import { describe, expect, it } from "vitest";
import {
  approvalDecisionSchema,
  buildAdvisorCouncil,
  allowedSurfacesFor,
  canTransitionManifest,
  canSeeSeat,
  canTransitionWorkPacket,
  evidenceCreateSchema,
  eosActiveModules,
  eosModulesForRole,
  manifestInputSchema,
  nextUsableSurfaceFor,
  selectAdvisorSeats,
  workPacketCreateSchema,
  visibilityPolicyFor,
} from "../../shared/eos-runtime";

const manifest = {
  purpose: "Build a repeatable organization",
  stage: "MVP",
  offer: "Business operating system",
  targetCustomer: "Founder-led companies",
  goals: ["Complete the first governed value loop"],
  enabledModules: Array.from({ length: 14 }, (_, index) => index + 1),
  ownerSeat: { title: "Founder / Owner", authority: "owner" as const },
  operatingCadence: "weekly" as const,
};

describe("EOS overlay runtime contracts", () => {
  it("accepts the fourteen-module overlay manifest", () => {
    expect(manifestInputSchema.parse(manifest).enabledModules).toHaveLength(14);
  });

  it("rejects a manifest without a goal or enabled module", () => {
    expect(manifestInputSchema.safeParse({ ...manifest, goals: [], enabledModules: [] }).success).toBe(false);
  });

  it("defaults a manual Work Packet to a safe local lifecycle", () => {
    const packet = workPacketCreateSchema.parse({ title: "Review offer", objective: "Approve the initial offer before outreach" });
    expect(packet.requiresApproval).toBe(false);
    expect(packet.source).toBe("manual");
    expect(packet.evidenceRequirements).toEqual([]);
  });

  it("enforces the Work Packet transition graph", () => {
    expect(canTransitionWorkPacket("ready", "in_progress")).toBe(true);
    expect(canTransitionWorkPacket("in_progress", "in_review")).toBe(true);
    expect(canTransitionWorkPacket("in_review", "completed")).toBe(true);
    expect(canTransitionWorkPacket("ready", "completed")).toBe(false);
    expect(canTransitionWorkPacket("completed", "in_progress")).toBe(false);
  });

  it("accepts explicit approval decisions and typed evidence", () => {
    expect(approvalDecisionSchema.parse({ decision: "approved" }).decision).toBe("approved");
    expect(evidenceCreateSchema.safeParse({
      workPacketId: "d61f2233-992e-4da7-a072-3d19afc5ff71",
      evidenceType: "provider_receipt",
      title: "Gmail draft created",
    }).success).toBe(true);
  });

  it("compiles exactly fifteen founder-profiled advisory seats behind the Executive Assistant", () => {
    const council = buildAdvisorCouncil({
      founderName: "Test Founder",
      portfolioName: "Test Portfolio",
      companyName: "Test Company",
      founderProfile: { vision: "Build durable institutions", values: "Proof and sovereignty", decisionStyle: "Facts, options, risks, recommendation" },
      companyGoals: "Complete the first governed value loop",
    });
    expect(council.count).toBe(15);
    expect(council.advisors).toHaveLength(15);
    expect(new Set(council.advisors.map((advisor) => advisor.id)).size).toBe(15);
    expect(council.founderFacingAgent).toBe("executive_assistant");
    expect(council.personalization.founderVision).toBe("Build durable institutions");
  });

  it("defines a descending organizational visibility ceiling without bypassing restricted grants", () => {
    expect(canSeeSeat("founder", "manager")).toBe(true);
    expect(canSeeSeat("manager", "individual_contributor")).toBe(true);
    expect(canSeeSeat("individual_contributor", "manager")).toBe(false);
    expect(visibilityPolicyFor("founder").cannotSee.join(" ")).toContain("explicit grant");
  });

  it("requires manifests to pass the full compiler lifecycle before activation", () => {
    expect(canTransitionManifest("draft", "diagnostic")).toBe(true);
    expect(canTransitionManifest("draft", "active")).toBe(false);
    expect(canTransitionManifest("verifying", "active")).toBe(true);
    expect(canTransitionManifest("active", "rolled_back")).toBe(true);
  });

  it("compiles product surfaces by seat instead of rendering one universal dashboard", () => {
    expect(allowedSurfacesFor("founder")).toContain("portfolio-map");
    expect(allowedSurfacesFor("founder")).toContain("modules");
    expect(allowedSurfacesFor("manager")).toContain("review");
    expect(allowedSurfacesFor("manager")).not.toContain("capital");
    expect(allowedSurfacesFor("individual_contributor")).toEqual(expect.arrayContaining(["my-role", "work-room", "academy"]));
  });

  it("routes all fourteen active modules into usable governed overlay surfaces", () => {
    expect(eosActiveModules).toHaveLength(14);
    expect(eosActiveModules.map((module) => module.id)).toEqual(Array.from({ length: 14 }, (_, index) => index + 1));
    expect(eosActiveModules.every((module) => module.missionTitle && module.missionObjective && module.evidenceRequirement && module.fallback)).toBe(true);
    expect(eosActiveModules.every((module) => allowedSurfacesFor("founder").includes(module.operatingSurface))).toBe(true);
    expect(eosModulesForRole("external").map((module) => module.id)).toEqual([6]);
    expect(eosModulesForRole("manager").every((module) => ["operations", "work-room"].includes(module.operatingSurface))).toBe(true);
  });

  it("never offers a role a next-action surface outside its compiled authority", () => {
    expect(nextUsableSurfaceFor("founder", "organization_setup")).toBe("organization");
    expect(nextUsableSurfaceFor("manager", "organization_setup")).toBe("intelligence");
    expect(nextUsableSurfaceFor("individual_contributor", "new_work")).toBe("intelligence");
    expect(nextUsableSurfaceFor("external", "new_work")).toBe("my-role");
    for (const role of ["founder", "portfolio_executive", "company_ceo", "functional_executive", "manager", "individual_contributor", "external"] as const) {
      for (const reason of ["organization_setup", "approval", "active_work", "new_work"] as const) {
        expect(allowedSurfacesFor(role)).toContain(nextUsableSurfaceFor(role, reason));
      }
    }
  });

  it("selects relevant advisor agents while preserving the EA as the only founder-facing channel", () => {
    const council = buildAdvisorCouncil({ founderName: "Founder", companyName: "Company" });
    expect(new Set(selectAdvisorSeats(council.advisors, "Review revenue, customer retention, and governance risk").map((advisor) => advisor.id))).toEqual(new Set(["revenue", "customer", "governance"]));
    expect(selectAdvisorSeats(council.advisors, "Give me a general portfolio synthesis").map((advisor) => advisor.id)).toEqual(["chief_portfolio_advisor", "strategy", "governance"]);
  });
});
