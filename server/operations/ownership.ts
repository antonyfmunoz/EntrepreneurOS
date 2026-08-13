const DAY_MS = 86_400_000;

type ServiceOwnershipEvidence = {
  ownerUserId: string;
  backupOwnerReference: string | null;
  onCallReference: string;
  escalationReference: string | null;
  incidentRunbookUri: string;
  accessReviewEvidenceUri: string | null;
  accessReviewedAt: Date | null;
  nextAccessReviewAt: Date | null;
};

function isHttpsReference(value: string | null): boolean {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

export function serviceOwnershipIssues(ownership: ServiceOwnershipEvidence | undefined, now = new Date()): string[] {
  if (!ownership) return ["service_owner_and_on_call"];
  const issues: string[] = [];
  if (!ownership.backupOwnerReference?.trim() || ownership.backupOwnerReference.trim() === ownership.ownerUserId) issues.push("distinct_backup_service_owner");
  if (!isHttpsReference(ownership.onCallReference)) issues.push("https_on_call_route");
  if (!isHttpsReference(ownership.escalationReference)) issues.push("https_escalation_route");
  if (!isHttpsReference(ownership.incidentRunbookUri)) issues.push("https_incident_runbook");
  if (!isHttpsReference(ownership.accessReviewEvidenceUri)) issues.push("access_review_evidence");

  const reviewedAt = ownership.accessReviewedAt?.getTime();
  const nextReviewAt = ownership.nextAccessReviewAt?.getTime();
  if (!reviewedAt || reviewedAt < now.getTime() - 90 * DAY_MS || reviewedAt > now.getTime() + 5 * 60_000) issues.push("current_access_review");
  if (!reviewedAt || !nextReviewAt || nextReviewAt <= now.getTime() || nextReviewAt > reviewedAt + 90 * DAY_MS) issues.push("bounded_next_access_review");
  return issues;
}
