import { describe, expect, it } from "vitest";
import { validateCompanyPackage } from "../../shared/company-compilation";
import {
  companyMatchesPackage,
  listRegisteredCompanyPackages,
} from "../../server/company-compilation/catalog";
import {
  LYFE_INSTITUTE_COMPANY_PACKAGE,
  LYFE_INSTITUTE_SOURCE_BINDINGS,
} from "../../server/reference-instances/lyfe-institute";
import {
  LYFE_SPECTRUM_COMPANY_PACKAGE,
  LYFE_SPECTRUM_SOURCE_BINDINGS,
} from "../../server/reference-instances/lyfe-spectrum";
import {
  OST_COMPANY_PACKAGE,
  OST_SOURCE_BINDINGS,
} from "../../server/reference-instances/ost";

const portfolioPackages = [
  OST_COMPANY_PACKAGE,
  LYFE_INSTITUTE_COMPANY_PACKAGE,
  LYFE_SPECTRUM_COMPANY_PACKAGE,
];

describe("Lyfe Holdings company packages", () => {
  it("registers an isolated valid package for every company currently being built", () => {
    for (const packageDefinition of portfolioPackages) {
      expect(validateCompanyPackage(packageDefinition)).toEqual({
        package: packageDefinition,
        findings: [],
      });
    }

    expect(
      listRegisteredCompanyPackages().map(({ package: definition }) =>
        definition.companyManifest.value.orgKey,
      ),
    ).toEqual([
      "ORG-EMPYREAN-STUDIOS",
      "ORG-AFM",
      "ORG-OST",
      "ORG-LYFE-INSTITUTE",
      "ORG-LYFE-SPECTRUM",
    ]);
  });

  it("matches the exact live company names without accepting lookalikes", () => {
    expect(companyMatchesPackage("OST, Inc.", OST_COMPANY_PACKAGE)).toBe(true);
    expect(
      companyMatchesPackage("Lyfe Institute", LYFE_INSTITUTE_COMPANY_PACKAGE),
    ).toBe(true);
    expect(
      companyMatchesPackage("Lyfe Spectrum", LYFE_SPECTRUM_COMPANY_PACKAGE),
    ).toBe(true);
    expect(companyMatchesPackage("OST customer", OST_COMPANY_PACKAGE)).toBe(false);
    expect(
      companyMatchesPackage(
        "Lyfe Institute Alumni",
        LYFE_INSTITUTE_COMPANY_PACKAGE,
      ),
    ).toBe(false);
    expect(
      companyMatchesPackage(
        "Lyfe Spectrum Sample Vendor",
        LYFE_SPECTRUM_COMPANY_PACKAGE,
      ),
    ).toBe(false);
  });

  it("preserves each company's distinct lifecycle and activation boundary", () => {
    expect(OST_COMPANY_PACKAGE.companyManifest.value.lifecycleStage).toBe("private");
    expect(OST_COMPANY_PACKAGE.lifecycleActivationMap.value.requestedState).toBe(
      "dry_run",
    );
    expect(
      LYFE_INSTITUTE_COMPANY_PACKAGE.companyManifest.value.lifecycleStage,
    ).toBe("validation");
    expect(
      LYFE_INSTITUTE_COMPANY_PACKAGE.lifecycleActivationMap.value.requestedState,
    ).toBe("blocked");
    expect(
      LYFE_SPECTRUM_COMPANY_PACKAGE.companyManifest.value.lifecycleStage,
    ).toBe("sampling");
    expect(
      LYFE_SPECTRUM_COMPANY_PACKAGE.lifecycleActivationMap.value.requestedState,
    ).toBe("dry_run");

    expect(
      LYFE_SPECTRUM_COMPANY_PACKAGE.capabilityManifest.value
        .filter(({ state }) => state === "dormant")
        .map(({ key }) => key),
    ).toEqual([
      "bulk-production",
      "shopify-commerce",
      "paid-growth-creator-fleet",
      "inventory-fulfillment-service",
      "international-market-compliance",
    ]);
  });

  it("records vacancies without pretending planned Institute and Spectrum roles are staffed", () => {
    const instituteVacancies =
      LYFE_INSTITUTE_COMPANY_PACKAGE.orgRoleAgentGraph.value.filter(
        ({ occupancyMode }) => occupancyMode === "vacant",
      );
    expect(instituteVacancies.map(({ key }) => key)).toEqual([
      "curriculum-approver",
      "lead-facilitator",
      "safeguarding-owner",
      "privacy-owner",
      "evidence-owner",
      "community-operator",
    ]);

    const spectrumVacancies =
      LYFE_SPECTRUM_COMPANY_PACKAGE.orgRoleAgentGraph.value.filter(
        ({ occupancyMode }) => occupancyMode === "vacant",
      );
    expect(spectrumVacancies.map(({ key }) => key)).toEqual([
      "commerce-growth",
      "community-content",
      "operations-service",
      "data-compliance",
      "technical-authority",
    ]);
  });

  it("binds every canonical Notion source to the correct company scope", () => {
    expect(OST_SOURCE_BINDINGS).toHaveLength(7);
    expect(LYFE_INSTITUTE_SOURCE_BINDINGS).toHaveLength(9);
    expect(LYFE_SPECTRUM_SOURCE_BINDINGS).toHaveLength(8);

    for (const [orgKey, bindings] of [
      ["ORG-OST", OST_SOURCE_BINDINGS],
      ["ORG-LYFE-INSTITUTE", LYFE_INSTITUTE_SOURCE_BINDINGS],
      ["ORG-LYFE-SPECTRUM", LYFE_SPECTRUM_SOURCE_BINDINGS],
    ] as const) {
      expect(new Set(bindings.map(({ orgKey: actual }) => actual))).toEqual(
        new Set([orgKey]),
      );
      expect(bindings.every(({ importAuthority }) => importAuthority === "reference_only"))
        .toBe(true);
      expect(bindings.every(({ sourceRef }) => sourceRef.startsWith("https://app.notion.com/")))
        .toBe(true);
    }
  });

  it("keeps every reporting edge inside the company package", () => {
    for (const packageDefinition of portfolioPackages) {
      const seatKeys = new Set(
        packageDefinition.orgRoleAgentGraph.value.map(({ key }) => key),
      );
      expect(
        packageDefinition.orgRoleAgentGraph.value.every(
          ({ reportsToSeatKey }) =>
            reportsToSeatKey === null || seatKeys.has(reportsToSeatKey),
        ),
      ).toBe(true);
      expect(
        packageDefinition.orgRoleAgentGraph.value.filter(
          ({ kind }) => kind === "company_ceo",
        ),
      ).toHaveLength(1);
    }
  });

  it("declares exact source contracts and a 22-class module home for every capability", () => {
    for (const registration of listRegisteredCompanyPackages()) {
      const packageDefinition = registration.package;
      const sources = packageDefinition.sourceAuthorityManifest.value.sources;
      expect(registration.sourceBindings).toHaveLength(sources.length);
      expect(
        sources.map((source) => ({
          key: source.key,
          ref: source.sourceRef,
          revision: source.sourceRevision,
        })),
      ).toEqual(
        registration.sourceBindings.map((binding) => ({
          key: binding.sourceKey,
          ref: binding.sourceRef,
          revision: binding.expectedRevision,
        })),
      );
      expect(
        packageDefinition.capabilityManifest.value.every(
          (capability) => capability.moduleIds.length > 0,
        ),
      ).toBe(true);
    }
  });
});
