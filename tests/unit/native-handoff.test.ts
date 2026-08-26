import { describe, expect, it } from "vitest";
import { artifactClosureClasses } from "../../shared/artifact-closure";
import {
  buildNativeHandoffManifest,
  nativeHandoffManifestSchema,
  nativeHandoffSections,
} from "../../shared/native-handoff";
import {
  comparePackageVersions,
  planCompanyPackageTransition,
} from "../../shared/company-compilation";
import { EMPYREAN_COMPANY_PACKAGE } from "../../server/reference-instances/empyrean-studios";

const capability = {
  id: "capability-1",
  companyId: 1,
  portfolioId: 1,
  capabilityInstanceKey: "sales-delivery",
  name: "Sales delivery",
  moduleIds: [4, 5],
  accountableSeatId: "seat-1",
  sourceAuthority: "native_eos",
  classification: "confidential",
  state: "active",
  schemaVersion: "capability-instance-v1.0",
};

describe("native EOS handoff and package lifecycle contracts", () => {
  it("derives all twenty handoff sections and fails closed when closure is absent", () => {
    const handoff = buildNativeHandoffManifest({
      capability,
      organizationKey: "ORG-TEST",
      records: [],
      generatedAt: "2026-08-26T12:00:00.000Z",
    });
    expect(handoff.sections).toHaveLength(nativeHandoffSections.length);
    expect(handoff.readiness).toBe("not_initialized");
    expect(handoff.gaps.some((gap) => gap.severity === "P0")).toBe(true);
    expect(nativeHandoffManifestSchema.omit({ contentSha256: true }).parse(handoff)).toEqual(handoff);
  });

  it("promotes only a complete, blocker-free, attributable matrix", () => {
    const records = artifactClosureClasses.map((artifactClass, index) => ({
      id: `record-${index}`,
      artifactClass,
      applicability: "instantiated",
      maturity: "native_qualified",
      blocker: "",
      evidenceIds: [`evidence-${index}`],
      templateStack: ["canon-2026-08-21"],
    }));
    const handoff = buildNativeHandoffManifest({
      capability,
      organizationKey: "ORG-TEST",
      records,
      generatedAt: "2026-08-26T12:00:00.000Z",
    });
    expect(handoff.readiness).toBe("native_qualified");
    expect(handoff.minimumMaturity).toBe("native_qualified");
    expect(handoff.gaps).toEqual([]);

    const blocked = buildNativeHandoffManifest({
      capability,
      organizationKey: "ORG-TEST",
      records: records.map((record) => record.artifactClass === "authority_permission_disclosure"
        ? { ...record, blocker: "Security review is open." } : record),
      generatedAt: "2026-08-26T12:00:00.000Z",
    });
    expect(blocked.readiness).toBe("semantic_incomplete");
    expect(blocked.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ section: "security_privacy_and_disclosure", severity: "P0" }),
    ]));
  });

  it("plans install, no-change, upgrade and unavailable rollback without executing effects", () => {
    expect(comparePackageVersions("2026-08-21", "2026-08-22")).toBeLessThan(0);
    expect(comparePackageVersions("1.10", "1.2")).toBeGreaterThan(0);
    expect(planCompanyPackageTransition({ packageDefinition: EMPYREAN_COMPANY_PACKAGE, installedVersion: null }).transition).toBe("install");
    expect(planCompanyPackageTransition({ packageDefinition: EMPYREAN_COMPANY_PACKAGE, installedVersion: "2026-08-22" }).transition).toBe("no_change");
    expect(planCompanyPackageTransition({ packageDefinition: EMPYREAN_COMPANY_PACKAGE, installedVersion: "2026-08-21" }).transition).toBe("upgrade");
    expect(planCompanyPackageTransition({ packageDefinition: EMPYREAN_COMPANY_PACKAGE, installedVersion: "2026-08-23" })).toEqual(expect.objectContaining({
      transition: "blocked",
      compatible: false,
      externalEffectsPermitted: false,
    }));
  });
});
