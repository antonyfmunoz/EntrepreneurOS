import { describe, expect, it } from "vitest";
import { validateCompanyPackage } from "../../shared/company-compilation";
import { companyMatchesPackage } from "../../server/company-compilation/catalog";
import { EMPYREAN_COMPANY_PACKAGE } from "../../server/reference-instances/empyrean-studios";
import { AFM_COMPANY_PACKAGE, AFM_RUNTIME_BINDINGS, AFM_SOURCE_BINDINGS } from "../../server/reference-instances/afm";
import { companySourceContentHash, validateCompanySourceSnapshot } from "../../shared/company-source-adapter";

describe("EOS company compilation contracts", () => {
  it("accepts the complete Empyrean package and preserves active versus dormant capability state", () => {
    const result = validateCompanyPackage(EMPYREAN_COMPANY_PACKAGE);
    expect(result.findings).toEqual([]);
    expect(result.package).not.toBeNull();
    expect(result.package?.capabilityManifest.value).toHaveLength(17);
    expect(
      result.package?.capabilityManifest.value.filter(
        (capability) => capability.state === "required",
      ),
    ).toHaveLength(14);
    expect(
      result.package?.capabilityManifest.value.filter(
        (capability) => capability.state === "dormant",
      ),
    ).toHaveLength(3);
    expect(result.package?.providerBindingDeclarations.value).toHaveLength(5);
    expect(
      result.package?.providerBindingDeclarations.value.every(
        (binding) =>
          binding.credentialReference === null &&
          binding.authorityState === "selected",
      ),
    ).toBe(true);
  });

  it("fails closed before compilation on source, scope, activation and client-authority ambiguity", () => {
    const conflicted = structuredClone(EMPYREAN_COMPANY_PACKAGE);
    conflicted.sourceAuthorityManifest.value.unresolvedConflicts.push(
      "Two sources claim current commercial authority.",
    );
    expect(validateCompanyPackage(conflicted).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "source_authority_unresolved" }),
      ]),
    );

    const crossScoped = structuredClone(EMPYREAN_COMPANY_PACKAGE);
    crossScoped.workflowArtifactMap.metadata.orgKey = "ORG-AFM";
    expect(validateCompanyPackage(crossScoped).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "organization_scope_mismatch" }),
      ]),
    );

    const prematurelyActive = structuredClone(EMPYREAN_COMPANY_PACKAGE);
    prematurelyActive.lifecycleActivationMap.value.requestedState = "active";
    expect(validateCompanyPackage(prematurelyActive).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "activation_gates_open" }),
      ]),
    );

    const unauthorizedClient = structuredClone(EMPYREAN_COMPANY_PACKAGE);
    unauthorizedClient.companyManifest.value.ownershipClass = "external_client";
    unauthorizedClient.companyManifest.value.clientAuthorityReference = null;
    expect(validateCompanyPackage(unauthorizedClient).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "client_authority_missing" }),
      ]),
    );
  });

  it("matches only an explicit company alias instead of a loose brand substring", () => {
    expect(
      companyMatchesPackage("Empyrean Creative", EMPYREAN_COMPANY_PACKAGE),
    ).toBe(true);
    expect(
      companyMatchesPackage("Empyrean Studios", EMPYREAN_COMPANY_PACKAGE),
    ).toBe(true);
    expect(
      companyMatchesPackage(
        "Empyrean Studios Customer Copy",
        EMPYREAN_COMPANY_PACKAGE,
      ),
    ).toBe(false);
  });

  it("validates AFM as a separate blocked company package with the current named-seat chart", () => {
    const result = validateCompanyPackage(AFM_COMPANY_PACKAGE);
    expect(result.findings).toEqual([]);
    expect(result.package?.companyManifest.value.orgKey).toBe("ORG-AFM");
    expect(result.package?.orgRoleAgentGraph.value.map((seat) => seat.title)).toEqual(expect.arrayContaining([
      "Founder / Chief Executive Officer & Principal Creator",
      "Executive Assistant I",
      "Creator Operations Coordinator I",
      "Content Strategist I",
      "Associate Content Producer",
      "Assistant Video Editor",
      "Social Media Coordinator I",
    ]));
    expect(result.package?.lifecycleActivationMap.value.requestedState).toBe("blocked");
    expect(result.package?.lifecycleActivationMap.value.stopLaws.join(" ")).toContain("ORG-AFM");
    expect(AFM_SOURCE_BINDINGS).toHaveLength(7);
    expect(AFM_RUNTIME_BINDINGS.processes?.map((process) => process.processKey)).toEqual([
      "afm-content-lifecycle",
      "afm-empyrean-production-service",
    ]);
    expect(AFM_RUNTIME_BINDINGS.assets).toEqual([
      expect.objectContaining({ assetKey: "BRAND-AFM", ownerOrganizationKey: "ORG-AFM", operatorOrganizationKey: "ORG-AFM" }),
    ]);
    expect(AFM_RUNTIME_BINDINGS.additionalWorkPackets).toEqual([
      expect.objectContaining({ key: "request-empyrean-production-service", processKey: "afm-empyrean-production-service" }),
    ]);
    expect(companyMatchesPackage("AFM", AFM_COMPANY_PACKAGE)).toBe(true);
    expect(companyMatchesPackage("AFM fan page", AFM_COMPANY_PACKAGE)).toBe(false);
  });

  it("accepts exact read-only AFM source snapshots and rejects drift, staleness and secrets", () => {
    const binding = AFM_SOURCE_BINDINGS[0];
    const base = {
      schemaVersion: "eos.notion-company-source-snapshot.v1" as const,
      sourceKey: binding.sourceKey,
      orgKey: binding.orgKey,
      pageClass: binding.pageClass,
      sourceRef: binding.sourceRef,
      pageId: binding.expectedPageId,
      title: "AFM",
      sourceRevision: "2026-08-21T12:00:00.000Z",
      capturedAt: "2026-08-22T12:00:00.000Z",
      classification: binding.classification,
      importAuthority: "reference_only" as const,
      boundedText: "Registry pointer only; this is not proof that the company or outcome is live.",
      truncated: false,
    };
    const snapshot = { ...base, contentHash: companySourceContentHash(base) };
    expect(validateCompanySourceSnapshot(binding, snapshot, new Date("2026-08-22T12:00:00.000Z")).findings).toEqual([]);

    const drifted = { ...snapshot, pageId: "00000000-0000-0000-0000-000000000000" };
    expect(validateCompanySourceSnapshot(binding, drifted, new Date("2026-08-22T12:00:00.000Z")).findings.map((finding) => finding.code))
      .toEqual(expect.arrayContaining(["source_identity_mismatch", "source_hash_mismatch"]));

    const secretShapedFixture = ["sk", "live", "abcdefghijklmnopqrstuvwxyz"].join("_");
    const secretBase = { ...base, boundedText: `Provider credential ${secretShapedFixture}` };
    const secret = { ...secretBase, contentHash: companySourceContentHash(secretBase) };
    expect(validateCompanySourceSnapshot(binding, secret, new Date("2026-08-22T12:00:00.000Z")).findings.map((finding) => finding.code))
      .toContain("source_secret_detected");
    expect(validateCompanySourceSnapshot(binding, snapshot, new Date("2027-01-01T00:00:00.000Z")).findings.map((finding) => finding.code))
      .toContain("source_revision_stale");
  });
});
