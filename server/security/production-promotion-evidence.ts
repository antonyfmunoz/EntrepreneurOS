const EVIDENCE_STANDARD = "eos.production-promotion-prerequisites.v1";
const RECEIPT_MAX_LENGTH = 512;

type UnknownRecord = Record<string, unknown>;

export type PromotionEvidenceExpectations = {
  releaseSubject: string;
  environmentSubject: string;
  rollbackSubject: string;
  targetMigrationCount: number;
  platformAdministratorIds: string[];
  now?: Date;
};

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown): number | null {
  return Number.isInteger(value) ? value as number : null;
}

function validPastTimestamp(
  value: unknown,
  now: Date,
  maximumAgeMs: number,
): boolean {
  const parsed = Date.parse(text(value));
  if (!Number.isFinite(parsed)) return false;
  const age = now.getTime() - parsed;
  return age >= -5 * 60_000 && age <= maximumAgeMs;
}

function secretFreeReceipt(value: unknown): boolean {
  const candidate = text(value);
  if (candidate.length < 8 || candidate.length > RECEIPT_MAX_LENGTH) return false;
  if (/\s/.test(candidate)) return false;
  if (/(?:password|secret|token|api[_-]?key)=/i.test(candidate)) return false;
  if (/(?:sk|rk)_(?:live|test)_[A-Za-z0-9]/.test(candidate)) return false;
  if (/postgres(?:ql)?:\/\//i.test(candidate)) return false;
  if (/^https:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      return !url.username && !url.password && !url.search && !url.hash;
    } catch {
      return false;
    }
  }
  return /^(?:provider|evidence|branch|backup|restore|run|receipt):[A-Za-z0-9._:/-]+$/.test(candidate);
}

function databaseSubject(value: unknown): boolean {
  const candidate = text(value);
  return /^database:[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$/.test(candidate)
    && !candidate.includes("@")
    && !candidate.includes("?");
}

export function productionPromotionEvidenceIssues(
  raw: unknown,
  expected: PromotionEvidenceExpectations,
): string[] {
  const evidence = record(raw);
  const database = record(evidence.database);
  const backup = record(database.backup);
  const rehearsal = record(database.migrationRehearsal);
  const restore = record(database.restoreRehearsal);
  const rollback = record(evidence.rollback);
  const approval = record(evidence.approval);
  const now = expected.now || new Date();
  const issues: string[] = [];
  const sourceMigrationCount = integer(database.sourceMigrationCount);
  const rehearsalSourceCount = integer(rehearsal.sourceMigrationCount);
  const rehearsalTargetCount = integer(rehearsal.targetMigrationCount);
  const restoreRtoMinutes = integer(restore.rtoMinutes);
  const restoreRpoMinutes = integer(restore.rpoMinutes);

  if (evidence.standard !== EVIDENCE_STANDARD) issues.push("standard");
  if (evidence.releaseSubject !== expected.releaseSubject) issues.push("releaseSubject");
  if (evidence.environmentSubject !== expected.environmentSubject) issues.push("environmentSubject");
  if (!databaseSubject(database.productionSubject)) issues.push("database.productionSubject");
  if (sourceMigrationCount === null || sourceMigrationCount < 0) issues.push("database.sourceMigrationCount");

  if (backup.result !== "pass") issues.push("database.backup.result");
  if (!secretFreeReceipt(backup.receiptRef)) issues.push("database.backup.receiptRef");
  if (!validPastTimestamp(backup.completedAt, now, 24 * 60 * 60_000)) issues.push("database.backup.completedAt");

  if (rehearsal.result !== "pass") issues.push("database.migrationRehearsal.result");
  if (!databaseSubject(rehearsal.databaseSubject)) issues.push("database.migrationRehearsal.databaseSubject");
  if (text(rehearsal.databaseSubject) === text(database.productionSubject)) issues.push("database.migrationRehearsal.isolated");
  if (rehearsalSourceCount !== sourceMigrationCount) issues.push("database.migrationRehearsal.sourceMigrationCount");
  if (rehearsalTargetCount !== expected.targetMigrationCount) issues.push("database.migrationRehearsal.targetMigrationCount");
  if (!secretFreeReceipt(rehearsal.receiptRef)) issues.push("database.migrationRehearsal.receiptRef");
  if (!validPastTimestamp(rehearsal.completedAt, now, 7 * 24 * 60 * 60_000)) issues.push("database.migrationRehearsal.completedAt");

  if (restore.result !== "pass") issues.push("database.restoreRehearsal.result");
  if (!secretFreeReceipt(restore.receiptRef)) issues.push("database.restoreRehearsal.receiptRef");
  if (!validPastTimestamp(restore.completedAt, now, 7 * 24 * 60 * 60_000)) issues.push("database.restoreRehearsal.completedAt");
  if (restoreRtoMinutes === null || restoreRtoMinutes < 1) issues.push("database.restoreRehearsal.rtoMinutes");
  if (restoreRpoMinutes === null || restoreRpoMinutes < 0) issues.push("database.restoreRehearsal.rpoMinutes");

  if (rollback.releaseSubject !== expected.rollbackSubject) issues.push("rollback.releaseSubject");
  if (rollback.result !== "pass") issues.push("rollback.result");
  if (!secretFreeReceipt(rollback.receiptRef)) issues.push("rollback.receiptRef");
  if (!validPastTimestamp(rollback.completedAt, now, 7 * 24 * 60 * 60_000)) issues.push("rollback.completedAt");

  const approvedBy = text(approval.approvedByUserId);
  if (approval.decision !== "approved") issues.push("approval.decision");
  if (!approvedBy || !expected.platformAdministratorIds.includes(approvedBy)) issues.push("approval.approvedByUserId");
  if (!validPastTimestamp(approval.approvedAt, now, 24 * 60 * 60_000)) issues.push("approval.approvedAt");
  if (!secretFreeReceipt(approval.evidenceRef)) issues.push("approval.evidenceRef");

  return Array.from(new Set(issues));
}
