import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  complianceRequirementSchema,
  complianceReviewSchema,
  complianceSourceDraftSchema,
  complianceSourceVerificationSchema,
  complianceStateForOutcome,
} from "@shared/compliance";

const evidenceId = "3320d884-0c5b-4fb3-bfab-70d6b8897824";
const seatId = "8d8c1948-6c0b-49f4-af10-25b3b7f1eeda";
const sourceId = "1eb721f3-6416-4fe7-bf73-cbbf09390f6e";

describe("EOS compliance control center", () => {
  it("validates dated, bounded, secret-free source custody", () => {
    const source = complianceSourceDraftSchema.parse({
      sourceKey: "privacy-notice", versionLabel: "2026.1", title: "Privacy processing notice", sourceType: "consent_notice",
      authoritySystem: "Company privacy register", authoritativeReference: "policy://privacy/2026.1", jurisdictionRegime: "United States",
      summary: "The exact reviewed notice governing specified processing purposes and data-subject rights.",
      effectiveFrom: "2026-08-01", reviewedThrough: "2026-08-20", nextReviewAt: "2027-02-20",
    });
    expect(source.classification).toBe("confidential");
    expect(() => complianceSourceDraftSchema.parse({ ...source, nextReviewAt: "2026-08-01" })).toThrow("Next review");
    expect(() => complianceSourceDraftSchema.parse({ ...source, authoritativeReference: "client_secret=should-not-be-here" })).toThrow("credential material");
  });

  it("keeps requirement types distinct and fails closed on retention and consent detail", () => {
    const base = {
      requirementKey: "candidate-retention", sourceVersionId: sourceId, expectedSourceSha256: "a".repeat(64), title: "Candidate evidence retention",
      description: "Retain candidate Evidence only for the professionally reviewed period and bounded purpose.", ownerSeatId: seatId,
      subjectScope: "Candidates and their submitted evidence", sourceRequirement: "Retention section 4", jurisdictionRegime: "United States", dueReviewAt: "2027-01-15",
    };
    expect(() => complianceRequirementSchema.parse({ ...base, requirementType: "retention_rule" })).toThrow("trigger, period, and disposition");
    expect(complianceRequirementSchema.parse({ ...base, requirementType: "retention_rule", retentionTrigger: "Application closure", retentionPeriod: "365 days", dispositionMethod: "Verified deletion" }).requirementType).toBe("retention_rule");
    expect(() => complianceRequirementSchema.parse({ ...base, requirementType: "consent" })).toThrow("processing purpose");
  });

  it("maps attributable review outcomes to explicit command state", () => {
    expect(complianceStateForOutcome("effective")).toBe("monitoring");
    expect(complianceStateForOutcome("ineffective")).toBe("remediating");
    expect(complianceStateForOutcome("breached")).toBe("overdue_breached");
    const review = complianceReviewSchema.parse({ expectedVersion: 1, expectedSourceSha256: "b".repeat(64), reviewKind: "control_test", outcome: "ineffective", reviewEvidenceId: evidenceId, reviewAuthority: "internal_compliance", reviewerName: "A Reviewer", reviewerOrganization: "Internal Compliance", reviewerCredentialReference: "engagement-2026-08", factsConsidered: "The current control population, sampled records, exceptions, and observed execution receipts.", rationale: "The sampled control did not operate consistently and requires a bounded remediation packet." });
    expect(review.outcome).toBe("ineffective");
    expect(() => complianceReviewSchema.parse({ ...review, outcome: "applicable" })).toThrow("Control tests");
  });

  it("requires review attribution without accepting embedded credentials", () => {
    const verification = complianceSourceVerificationSchema.parse({ expectedContentSha256: "c".repeat(64), reviewEvidenceId: evidenceId, reviewAuthority: "privacy_professional", reviewerName: "Privacy Reviewer", reviewerOrganization: "Privacy Office", reviewerCredentialReference: "matter-2026-104", limitations: "Company facts, processing purposes, vendors, geography, and current law still require validation." });
    expect(verification.reviewAuthority).toBe("privacy_professional");
    const secretShapedFixture = ["sk", "live", "fixture_should_be_rejected"].join("_");
expect(() => complianceSourceVerificationSchema.parse({ ...verification, reviewerCredentialReference: secretShapedFixture })).toThrow("credential material");
  });

  it("migrates immutable sources, requirement definitions, and append-only reviews", () => {
    const migration = readFileSync(resolve(process.cwd(), "migrations/0082_add_compliance_control_center.sql"), "utf8");
    for (const table of ["eos_compliance_source_versions", "eos_compliance_requirements", "eos_compliance_requirement_reviews"])
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    expect(migration).toContain("EOS compliance source versions are immutable");
    expect(migration).toContain("EOS compliance requirement definitions are immutable");
    expect(migration).toContain("EOS compliance reviews are append-only");
    expect(migration).not.toContain("external_claim_not_verified_by_eos");
    expect(migration).not.toMatch(/secret_ciphertext|token_digest|private[_ ]?key/i);
  });
});
