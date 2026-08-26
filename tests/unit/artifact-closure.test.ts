import { describe, expect, it } from "vitest";
import {
  artifactClosureClasses,
  artifactClosureInputIssues,
  artifactClosureUpdateSchema,
  closureGroupState,
  closureModuleState,
} from "../../shared/artifact-closure";

const base = {
  expectedVersion: 1,
  applicability: "instantiated" as const,
  maturity: "mapped" as const,
  ownerSeatId: "11111111-1111-4111-8111-111111111111",
  templateStack: [],
  evidenceIds: [],
  blocker: "",
  nextAction: "Implement and verify the exact canonical artifact.",
  rationale: "The current artifact is mapped but has not been implemented or qualified.",
  triggerCondition: "",
  classification: "confidential" as const,
};

describe("artifact closure contract", () => {
  it("preserves all 22 canonical artifact classes without duplicates", () => {
    expect(artifactClosureClasses).toHaveLength(22);
    expect(new Set(artifactClosureClasses).size).toBe(22);
    expect(artifactClosureClasses).toContain("tools_integrations_provider_bindings");
    expect(artifactClosureClasses).toContain("template_learning_versioning");
  });

  it("fails qualification closed without verified Evidence or with an open blocker", () => {
    const parsed = artifactClosureUpdateSchema.parse({ ...base, maturity: "pre_live_qualified", blocker: "Provider account unverified" });
    expect(artifactClosureInputIssues(parsed)).toEqual(["verified qualification Evidence", "closure of the active blocker"]);
  });

  it("requires missing and deferred rows to expose their blocker or trigger", () => {
    expect(artifactClosureInputIssues(artifactClosureUpdateSchema.parse({ ...base, applicability: "missing", blocker: "" }))).toContain("a named blocker");
    expect(artifactClosureInputIssues(artifactClosureUpdateSchema.parse({ ...base, applicability: "deferred_by_trigger", triggerCondition: "" }))).toContain("an explicit non-applicability or activation trigger");
  });

  it("computes group gates only from complete, unblocked applicable coverage", () => {
    const rows = artifactClosureClasses.map((artifactClass) => ({ artifactClass, applicability: "instantiated", maturity: "pre_live_qualified", blocker: "" }));
    expect(closureGroupState(rows)).toMatchObject({ completeCoverage: true, openBlockers: 0, artifactComplete: true, implemented: true, preLiveQualified: true, fieldQualified: false });
    expect(closureGroupState(rows.slice(1))).toMatchObject({ completeCoverage: false, preLiveQualified: false });
    expect(closureGroupState(rows.map((row, index) => index === 0 ? { ...row, blocker: "Evidence expired" } : row))).toMatchObject({ openBlockers: 1, preLiveQualified: false });
    expect(closureGroupState(rows.map((row) => ({ ...row, applicability: "not_applicable" })))).toMatchObject({ applicableArtifacts: 0, artifactComplete: false, preLiveQualified: false });
  });

  it("derives a module's weakest earned gate instead of a static readiness label", () => {
    const group = { moduleId: 12, rowCount: 22, openBlockers: 0, artifactComplete: true, implemented: true, preLiveQualified: true, fieldQualified: false, nativeQualified: false };
    expect(closureModuleState([], 12)).toEqual({ state: "closure_not_initialized", capabilityGroups: 0, rows: 0, blockers: 0 });
    expect(closureModuleState([group], 12)).toMatchObject({ state: "pre_live_qualified", capabilityGroups: 1, rows: 22 });
    expect(closureModuleState([group, { ...group, openBlockers: 1, artifactComplete: false, implemented: false, preLiveQualified: false }], 12)).toMatchObject({ state: "closure_in_progress", blockers: 1 });
  });
});
