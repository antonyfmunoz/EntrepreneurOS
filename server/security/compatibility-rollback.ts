type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const text = (value: unknown) => typeof value === "string" ? value : "";
const sha = (value: unknown) => /^[a-f0-9]{40}$/.test(text(value));
const subject = (value: unknown) => /^git:[a-f0-9]{40}$/.test(text(value));
const receipt = (value: unknown) => /^(?:evidence|run|receipt):[A-Za-z0-9._:/-]{8,400}$/.test(text(value));
const fresh = (value: unknown, now: number) => Number.isFinite(Date.parse(text(value))) && now - Date.parse(text(value)) >= -300_000 && now - Date.parse(text(value)) <= 86_400_000;

export type CompatibilityRollbackExpectations = {
  app: string; environmentSubject: string; candidateReleaseSubject: string;
  incumbentImage: string; incumbentReleaseSubject: string; targetMigrationCount: number;
  platformAdministratorIds: string[]; now?: number;
};

/** A prepared fallback is a separate, explicitly approved artifact, never a healthy relabeling of a failed incumbent. */
export function compatibilityRollbackIssues(raw: unknown, expected: CompatibilityRollbackExpectations): string[] {
  const manifest = record(raw), fallback = record(manifest.fallback), incumbent = record(manifest.incumbent);
  const rehearsal = record(manifest.rehearsal), approval = record(manifest.approval);
  const now = expected.now ?? Date.now();
  const issues: string[] = [];
  const require = (condition: boolean, key: string) => { if (!condition) issues.push(key); };
  const imagePrefix = `registry.fly.io/${expected.app}@sha256:`;
  require(/^[a-z0-9][a-z0-9-]{1,62}$/.test(expected.app)
    && /^environment:[A-Za-z0-9._:/-]{3,200}$/.test(expected.environmentSubject)
    && subject(expected.candidateReleaseSubject)
    && /^(?:git:[a-f0-9]{40}|image:sha256:[a-f0-9]{64})$/.test(expected.incumbentReleaseSubject)
    && expected.incumbentImage.startsWith(imagePrefix) && /^[a-f0-9]{64}$/.test(expected.incumbentImage.slice(imagePrefix.length))
    && Number.isInteger(expected.targetMigrationCount) && expected.targetMigrationCount > 0, "expectations");
  require(manifest.standard === "eos.compatibility-rollback.v1", "standard");
  require(manifest.app === expected.app, "app");
  require(manifest.environmentSubject === expected.environmentSubject, "environmentSubject");
  require(manifest.candidateReleaseSubject === expected.candidateReleaseSubject, "candidateReleaseSubject");
  require(incumbent.image === expected.incumbentImage, "incumbent.image");
  require(incumbent.releaseSubject === expected.incumbentReleaseSubject, "incumbent.releaseSubject");
  require(subject(fallback.releaseSubject) && fallback.releaseSubject !== expected.candidateReleaseSubject && fallback.releaseSubject !== expected.incumbentReleaseSubject, "fallback.releaseSubject");
  require(text(fallback.image).startsWith(imagePrefix) && /^[a-f0-9]{64}$/.test(text(fallback.image).slice(imagePrefix.length)) && fallback.image !== expected.incumbentImage, "fallback.image");
  require(sha(fallback.sourceBaseCommit), "fallback.sourceBaseCommit");
  for (const key of ["qualificationRunId", "securityRunId"]) require(Number.isSafeInteger(fallback[key]) && Number(fallback[key]) > 0, `fallback.${key}`);
  require(fallback.qualificationRunId !== fallback.securityRunId, "fallback.distinctRuns");
  require(rehearsal.releaseSubject === fallback.releaseSubject && rehearsal.image === fallback.image, "rehearsal.identity");
  require(rehearsal.targetMigrationCount === expected.targetMigrationCount, "rehearsal.targetMigrationCount");
  require(/^database:(?:local-isolated|staging-isolated)\/[A-Za-z0-9_-]{3,100}$/.test(text(rehearsal.databaseSubject)), "rehearsal.databaseSubject");
  require(fresh(rehearsal.completedAt, now), "rehearsal.completedAt");
  for (const key of ["runtimeReadiness", "publicSmoke", "authenticatedSmoke", "migrationCompatibility", "paymentEffectsDisabled", "publicPaidSaasDisabled", "untrustedUploadsDisabled"]) {
    const proof = record(rehearsal[key]);
    require(proof.result === "pass" && receipt(proof.receiptRef), `rehearsal.${key}`);
  }
  require(approval.decision === "approved", "approval.decision");
  require(Boolean(text(approval.approvedByUserId)) && expected.platformAdministratorIds.includes(text(approval.approvedByUserId)), "approval.approvedByUserId");
  require(fresh(approval.approvedAt, now), "approval.approvedAt");
  require(receipt(approval.evidenceRef), "approval.evidenceRef");
  return issues;
}
