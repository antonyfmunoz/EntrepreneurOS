import { describe, expect, it } from "vitest";
import { CONTROL_DEFINITIONS, controlEvidenceIsCurrent } from "../../server/operations/control-definitions";

describe("production control evidence definitions", () => {
  const now = new Date("2026-08-12T12:00:00Z");

  it("allows repository evidence only for repository-qualified controls", () => {
    const ci = CONTROL_DEFINITIONS.get("ci_qualification")!;
    const deployment = CONTROL_DEFINITIONS.get("deployment_smoke")!;
    const evidence = { evidenceScope: "repository", subject: `git:${"a".repeat(40)}`, expectedReleaseSubject: `git:${"a".repeat(40)}`, reviewedAt: new Date("2026-08-12T11:00:00Z"), expiresAt: new Date("2026-08-20T12:00:00Z"), now };
    expect(controlEvidenceIsCurrent({ definition: ci, ...evidence })).toBe(true);
    expect(controlEvidenceIsCurrent({ definition: deployment, ...evidence })).toBe(false);
  });

  it("rejects stale, overlong, expired, future, and non-professional review evidence", () => {
    const security = CONTROL_DEFINITIONS.get("security_review")!;
    const subject = { subject: "review:security-2026", expectedEnvironmentSubject: "environment:entrepreneuros-production" };
    expect(controlEvidenceIsCurrent({ definition: security, evidenceScope: "production", ...subject, reviewedAt: now, expiresAt: new Date("2026-09-01T12:00:00Z"), now })).toBe(false);
    expect(controlEvidenceIsCurrent({ definition: security, evidenceScope: "professional", ...subject, reviewedAt: new Date("2025-01-01T00:00:00Z"), expiresAt: new Date("2026-09-01T12:00:00Z"), now })).toBe(false);
    expect(controlEvidenceIsCurrent({ definition: security, evidenceScope: "professional", ...subject, reviewedAt: new Date("2026-08-12T12:06:00Z"), expiresAt: new Date("2026-09-01T12:00:00Z"), now })).toBe(false);
    expect(controlEvidenceIsCurrent({ definition: security, evidenceScope: "professional", ...subject, reviewedAt: now, expiresAt: new Date("2028-01-01T00:00:00Z"), now })).toBe(false);
  });

  it("binds release and environment controls to their exact promotion subjects", () => {
    const release = CONTROL_DEFINITIONS.get("deployment_smoke")!;
    const environment = CONTROL_DEFINITIONS.get("load_and_scaling_test")!;
    const base = { evidenceScope: "production", reviewedAt: now, expiresAt: new Date("2026-08-20T12:00:00Z"), now };
    expect(controlEvidenceIsCurrent({ definition: release, ...base, subject: `git:${"a".repeat(40)}`, expectedReleaseSubject: `git:${"b".repeat(40)}` })).toBe(false);
    expect(controlEvidenceIsCurrent({ definition: environment, ...base, subject: "environment:staging", expectedEnvironmentSubject: "environment:entrepreneuros-production" })).toBe(false);
    expect(controlEvidenceIsCurrent({ definition: environment, ...base, subject: "environment:entrepreneuros-production", expectedEnvironmentSubject: "environment:entrepreneuros-production" })).toBe(true);
  });
});
