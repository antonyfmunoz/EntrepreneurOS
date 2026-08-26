import { describe, expect, it } from "vitest";
import { productionPromotionEvidenceIssues } from "../../server/security/production-promotion-evidence";

const now = new Date("2026-08-26T22:00:00.000Z");
const expected = {
  releaseSubject: `git:${"a".repeat(40)}`,
  environmentSubject: "environment:entrepreneuros-production",
  rollbackSubject: `image:sha256:${"b".repeat(64)}`,
  targetMigrationCount: 111,
  platformAdministratorIds: ["user_founder"],
  now,
};

const valid = {
  standard: "eos.production-promotion-prerequisites.v1",
  releaseSubject: expected.releaseSubject,
  environmentSubject: expected.environmentSubject,
  database: {
    productionSubject: "database:neon/eos-production",
    sourceMigrationCount: 9,
    backup: { result: "pass", receiptRef: "backup:neon/snapshot-123", completedAt: "2026-08-26T20:00:00.000Z" },
    migrationRehearsal: {
      result: "pass",
      databaseSubject: "database:neon/eos-release-rehearsal",
      sourceMigrationCount: 9,
      targetMigrationCount: 111,
      receiptRef: "run:github/migration-rehearsal-123",
      completedAt: "2026-08-25T20:00:00.000Z",
    },
    restoreRehearsal: {
      result: "pass",
      receiptRef: "restore:neon/rehearsal-123",
      completedAt: "2026-08-25T21:00:00.000Z",
      rtoMinutes: 18,
      rpoMinutes: 0,
    },
  },
  rollback: {
    releaseSubject: expected.rollbackSubject,
    result: "pass",
    receiptRef: "run:fly/rollback-rehearsal-123",
    completedAt: "2026-08-25T22:00:00.000Z",
  },
  approval: {
    decision: "approved",
    approvedByUserId: "user_founder",
    approvedAt: "2026-08-26T21:00:00.000Z",
    evidenceRef: "evidence:eos/release-approval-123",
  },
};

describe("production promotion evidence", () => {
  it("accepts current release-bound backup, migration, restore, rollback, and approval proof", () => {
    expect(productionPromotionEvidenceIssues(valid, expected)).toEqual([]);
  });

  it("rejects stale, cross-environment, secret-shaped, and wrong-release claims", () => {
    const invalid = structuredClone(valid);
    invalid.releaseSubject = `git:${"c".repeat(40)}`;
    invalid.database.migrationRehearsal.databaseSubject = invalid.database.productionSubject;
    invalid.database.backup.receiptRef = "https://user:password@example.com/proof?token=secret";
    invalid.database.backup.completedAt = "2026-08-20T20:00:00.000Z";
    invalid.database.migrationRehearsal.targetMigrationCount = 110;
    invalid.rollback.releaseSubject = `image:sha256:${"d".repeat(64)}`;
    invalid.approval.approvedByUserId = "user_untrusted";
    expect(productionPromotionEvidenceIssues(invalid, expected)).toEqual(expect.arrayContaining([
      "releaseSubject",
      "database.backup.receiptRef",
      "database.backup.completedAt",
      "database.migrationRehearsal.isolated",
      "database.migrationRehearsal.targetMigrationCount",
      "rollback.releaseSubject",
      "approval.approvedByUserId",
    ]));
  });
});
