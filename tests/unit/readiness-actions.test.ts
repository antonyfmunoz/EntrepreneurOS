import { describe, expect, it } from "vitest";
import { productionRuntimeConfiguration } from "../../server/security/release-configuration";
import { CONFIGURATION_ACTION_DEFINITIONS, readinessActionCandidates } from "../../server/operations/readiness-actions";

describe("production readiness action candidates", () => {
  it("has an actionable owner-safe definition for every runtime configuration key", () => {
    expect(Object.keys(CONFIGURATION_ACTION_DEFINITIONS).sort()).toEqual(
      Object.keys(productionRuntimeConfiguration({})).sort(),
    );
    for (const definition of Object.values(CONFIGURATION_ACTION_DEFINITIONS)) {
      expect(definition.layer).toBeGreaterThanOrEqual(1);
      expect(definition.layer).toBeLessThanOrEqual(24);
      expect(definition.nextAction.length).toBeGreaterThan(20);
    }
  });

  it("maps controls, vendors, ownership, and configuration without allowing narrative closure", () => {
    const candidates = readinessActionCandidates({
      layers: [
        { layer: 1, missing: ["frontend_acceptance"] },
        { layer: 19, missing: ["vendor_review", "approved_vendor:GitHub"] },
        { layer: 20, missing: ["service_ownership_review", "distinct_backup_service_owner"] },
      ],
      configurationMissing: ["immutableReleaseSubject"],
    });
    expect(candidates.map((candidate) => candidate.blockerKey)).toEqual(expect.arrayContaining([
      "control:frontend_acceptance",
      "control:vendor_review",
      "vendor:git-hub",
      "control:service_ownership_review",
      "ownership:distinct-backup-service-owner",
      "configuration:immutable-release-subject",
    ]));
    expect(new Set(candidates.map((candidate) => candidate.blockerKey)).size).toBe(candidates.length);
    expect(candidates.every((candidate) => !/mark.*(?:pass|complete|resolved)/i.test(candidate.nextAction))).toBe(true);
  });

  it("fails closed when a new configuration issue lacks an action definition", () => {
    expect(() => readinessActionCandidates({ layers: [], configurationMissing: ["unknownConfiguration"] })).toThrow("Unregistered production configuration action");
  });
});
