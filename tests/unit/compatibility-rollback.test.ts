import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compatibilityRollbackIssues } from "../../server/security/compatibility-rollback";

const now = Date.parse("2026-09-02T04:00:00Z");
const expected = { app: "eos-app", environmentSubject: "environment:entrepreneuros-production", candidateReleaseSubject: `git:${"a".repeat(40)}`, incumbentImage: `registry.fly.io/eos-app@sha256:${"b".repeat(64)}`, incumbentReleaseSubject: `git:${"c".repeat(40)}`, targetMigrationCount: 115, platformAdministratorIds: ["operator"], now };
const fallback = { image: `registry.fly.io/eos-app@sha256:${"d".repeat(64)}`, releaseSubject: `git:${"e".repeat(40)}`, sourceBaseCommit: "f".repeat(40), qualificationRunId: 123, securityRunId: 124 };
const proof = { result: "pass", receiptRef: "receipt:isolated/actual-proof" };
const valid = { standard: "eos.compatibility-rollback.v1", app: expected.app, environmentSubject: expected.environmentSubject, candidateReleaseSubject: expected.candidateReleaseSubject,
  incumbent: { image: expected.incumbentImage, releaseSubject: expected.incumbentReleaseSubject }, fallback,
  rehearsal: { image: fallback.image, releaseSubject: fallback.releaseSubject, targetMigrationCount: 115, databaseSubject: "database:local-isolated/eos_fallback", completedAt: "2026-09-02T03:00:00Z",
    runtimeReadiness: proof, publicSmoke: proof, authenticatedSmoke: proof, migrationCompatibility: proof, paymentEffectsDisabled: proof, publicPaidSaasDisabled: proof, untrustedUploadsDisabled: proof },
  approval: { decision: "approved", approvedByUserId: "operator", approvedAt: "2026-09-02T03:30:00Z", evidenceRef: "evidence:operator/fallback-approval" },
};

describe("prepared compatibility rollback evidence", () => {
  it("accepts only complete release-, image-, environment- and operator-bound evidence", () => {
    expect(compatibilityRollbackIssues(valid, expected)).toEqual([]);
  });
  it("rejects missing environment and mutable incumbent expectations even when the manifest matches", () => {
    expect(compatibilityRollbackIssues({ ...valid, environmentSubject: "" }, { ...expected, environmentSubject: "" })).toContain("expectations");
    expect(compatibilityRollbackIssues(valid, { ...expected, incumbentImage: "registry.fly.io/eos-app:latest" })).toContain("expectations");
    expect(compatibilityRollbackIssues(valid, { ...expected, incumbentReleaseSubject: "git:main" })).toContain("expectations");
  });
  it.each(["runtimeReadiness", "publicSmoke", "authenticatedSmoke", "migrationCompatibility", "paymentEffectsDisabled", "publicPaidSaasDisabled", "untrustedUploadsDisabled"])("requires actual %s proof", key => {
    expect(compatibilityRollbackIssues({ ...valid, rehearsal: { ...valid.rehearsal, [key]: { result: "pending", receiptRef: "" } } }, expected)).toContain(`rehearsal.${key}`);
  });
  it.each([null, [], {}, "not evidence"])("rejects absent or malformed manifests", manifest => {
    expect(compatibilityRollbackIssues(manifest, expected).length).toBeGreaterThan(10);
  });
  it.each(["registry.fly.io/eos-app:latest", `registry.fly.io/other@sha256:${"d".repeat(64)}`, expected.incumbentImage])( "rejects mutable, foreign or incumbent images: %s", image => {
    expect(compatibilityRollbackIssues({ ...valid, fallback: { ...fallback, image } }, expected)).toContain("fallback.image");
  });
  it.each([expected.candidateReleaseSubject, expected.incumbentReleaseSubject, "git:main"])("rejects candidate/incumbent relabeling or mutable source: %s", releaseSubject => {
    expect(compatibilityRollbackIssues({ ...valid, fallback: { ...fallback, releaseSubject } }, expected)).toContain("fallback.releaseSubject");
  });
  it("binds the evidence to the exact source deployment and current incumbent", () => {
    for (const key of ["app", "environmentSubject", "candidateReleaseSubject"])
      expect(compatibilityRollbackIssues({ ...valid, [key]: "wrong" }, expected)).toContain(key);
    for (const key of ["image", "releaseSubject"])
      expect(compatibilityRollbackIssues({ ...valid, incumbent: { ...valid.incumbent, [key]: "wrong" } }, expected)).toContain(`incumbent.${key}`);
  });
  it("rejects stale/future proof, production database reuse and the wrong migration target", () => {
    for (const completedAt of ["2026-08-01T00:00:00Z", "2027-01-01T00:00:00Z", "invalid"])
      expect(compatibilityRollbackIssues({ ...valid, rehearsal: { ...valid.rehearsal, completedAt } }, expected)).toContain("rehearsal.completedAt");
    expect(compatibilityRollbackIssues({ ...valid, rehearsal: { ...valid.rehearsal, databaseSubject: "database:neon/eos_db", targetMigrationCount: 114 } }, expected))
      .toEqual(expect.arrayContaining(["rehearsal.databaseSubject", "rehearsal.targetMigrationCount"]));
  });
  it("rejects unknown operators, pending approval, malformed evidence and aliased run IDs", () => {
    const issues = compatibilityRollbackIssues({ ...valid, fallback: { ...fallback, qualificationRunId: 124 }, approval: { decision: "pending", approvedByUserId: "someone_else", approvedAt: "2025-01-01", evidenceRef: "https://example.test/?token=secret" } }, expected);
    expect(issues).toEqual(expect.arrayContaining(["fallback.distinctRuns", "approval.decision", "approval.approvedByUserId", "approval.approvedAt", "approval.evidenceRef"]));
  });
  it("never replaces public/authenticated rollout checks with a manifest", () => {
    const deploy = readFileSync(new URL("../../scripts/deploy-fly.ps1", import.meta.url), "utf8");
    expect(deploy.indexOf("verify-compatibility-rollback.ts")).toBeLessThan(deploy.indexOf("npm run release:evidence:verify"));
    expect(deploy.indexOf("npm run release:evidence:verify")).toBeLessThan(deploy.indexOf("--build-only --push"));
    expect(deploy.match(/npm run test:e2e:production\r?\n/g)).toHaveLength(2);
    expect(deploy.match(/npm run test:e2e:production:authenticated/g)).toHaveLength(2);
    expect(deploy).toContain("rollbackManifestSha256 = $rollbackManifestSha256");
  });
});
