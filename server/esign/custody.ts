import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  eosEsignArtifacts,
  eosEsignCustodyEvents,
  eosEsignDeletionRequests,
  eosEsignDocumentVersions,
  eosEsignEnvelopes,
  eosEsignLegalHolds,
  eosEsignRecipients,
  eosEsignRetentionPolicies,
} from "@shared/schema";
import { db } from "../db";
import {
  backUpNativeEsignArtifact,
  inspectStoredNativeEsignArtifact,
  nativeEsignBackupConfigured,
  nativeEsignStorageProvider,
  removeNativeEsignArtifact,
  restoreNativeEsignArtifact,
} from "../artifacts/native-esign-files";

type ArtifactKind = "source_pdf" | "completed_pdf" | "audit_json" | "signature_capture";
type ArtifactInput = {
  companyId: number; envelopeId?: string | null; documentVersionId?: string | null; recipientId?: string | null;
  artifactKind: ArtifactKind; storageKey: string; sha256: string; sizeBytes: number; mimeType: string; createdAt: Date;
};

function canonical(value: unknown): string {
  if (value === undefined || value === null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).filter((key) => object[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}

async function appendCustodyEvent(tx: any, input: {
  companyId: number; envelopeId?: string | null; artifactId?: string | null; actorUserId?: string | null;
  eventType: string; eventProjection?: Record<string, unknown>; occurredAt?: Date;
}) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`esign-custody:${input.companyId}`}))`);
  const [previous] = await tx.select({ eventSha256: eosEsignCustodyEvents.eventSha256 }).from(eosEsignCustodyEvents)
    .where(eq(eosEsignCustodyEvents.companyId, input.companyId)).orderBy(desc(eosEsignCustodyEvents.createdAt), desc(eosEsignCustodyEvents.id)).limit(1);
  const occurredAt = input.occurredAt || new Date();
  const eventProjection = input.eventProjection || {};
  const previousEventSha256 = previous?.eventSha256 || "";
  const eventSha256 = createHash("sha256").update(canonical({
    companyId: input.companyId, envelopeId: input.envelopeId || null, artifactId: input.artifactId || null,
    actorUserId: input.actorUserId || null, eventType: input.eventType, eventProjection,
    previousEventSha256, occurredAt: occurredAt.toISOString(),
  }), "utf8").digest("hex");
  await tx.insert(eosEsignCustodyEvents).values({
    id: randomUUID(), companyId: input.companyId, envelopeId: input.envelopeId || null,
    artifactId: input.artifactId || null, actorUserId: input.actorUserId || null,
    eventType: input.eventType, eventProjection, previousEventSha256, eventSha256, occurredAt,
  });
}

async function activePolicy(companyId: number, executor: any = db) {
  return executor.query.eosEsignRetentionPolicies.findFirst({
    where: and(eq(eosEsignRetentionPolicies.companyId, companyId), eq(eosEsignRetentionPolicies.state, "active")),
  });
}

export async function registerNativeEsignArtifact(executor: any, input: ArtifactInput) {
  const policy = await activePolicy(input.companyId, executor);
  const retainedUntil = policy ? new Date(input.createdAt.getTime() + policy.retentionDays * 86_400_000) : null;
  const id = randomUUID();
  const [created] = await executor.insert(eosEsignArtifacts).values({
    id, companyId: input.companyId, envelopeId: input.envelopeId || null,
    documentVersionId: input.documentVersionId || null, recipientId: input.recipientId || null,
    artifactKind: input.artifactKind, storageProvider: nativeEsignStorageProvider(), storageKey: input.storageKey,
    sha256: input.sha256, sizeBytes: input.sizeBytes, mimeType: input.mimeType, state: "active",
    retentionPolicyId: policy?.id || null, retainedUntil,
    backupState: nativeEsignBackupConfigured() ? "pending" : "not_configured",
    version: 1, createdAt: input.createdAt, updatedAt: new Date(),
  }).onConflictDoNothing().returning();
  if (created) await appendCustodyEvent(executor, {
    companyId: input.companyId, envelopeId: input.envelopeId, artifactId: id,
    eventType: "artifact_registered", occurredAt: input.createdAt,
    eventProjection: { artifactKind: input.artifactKind, sha256: input.sha256, sizeBytes: input.sizeBytes, retentionPolicyId: policy?.id || null, retainedUntil: retainedUntil?.toISOString() || null },
  });
  return created || executor.query.eosEsignArtifacts.findFirst({
    where: and(eq(eosEsignArtifacts.companyId, input.companyId), eq(eosEsignArtifacts.storageProvider, nativeEsignStorageProvider()), eq(eosEsignArtifacts.storageKey, input.storageKey)),
  });
}

export async function ensureEnvelopeCustodyInventory(companyId: number, envelopeId: string) {
  const [context] = await db.select({ envelope: eosEsignEnvelopes, document: eosEsignDocumentVersions })
    .from(eosEsignEnvelopes).innerJoin(eosEsignDocumentVersions, eq(eosEsignDocumentVersions.id, eosEsignEnvelopes.documentVersionId))
    .where(and(eq(eosEsignEnvelopes.id, envelopeId), eq(eosEsignEnvelopes.companyId, companyId))).limit(1);
  if (!context) return null;
  const recipients = await db.select().from(eosEsignRecipients).where(and(eq(eosEsignRecipients.envelopeId, envelopeId), eq(eosEsignRecipients.companyId, companyId)));
  await db.transaction(async (tx) => {
    await registerNativeEsignArtifact(tx, {
      companyId, documentVersionId: context.document.id, artifactKind: "source_pdf", storageKey: context.document.sourceStorageKey,
      sha256: context.document.sourceSha256, sizeBytes: context.document.sizeBytes, mimeType: context.document.mimeType, createdAt: context.document.createdAt,
    });
    if (context.envelope.finalStorageKey && context.envelope.finalSha256) {
      const final = await inspectStoredNativeEsignArtifact(context.envelope.finalStorageKey).catch(() => null);
      if (final) await registerNativeEsignArtifact(tx, { companyId, envelopeId, documentVersionId: context.document.id, artifactKind: "completed_pdf", storageKey: context.envelope.finalStorageKey, sha256: context.envelope.finalSha256, sizeBytes: final.sizeBytes, mimeType: "application/pdf", createdAt: context.envelope.completedAt || context.envelope.updatedAt });
    }
    if (context.envelope.auditStorageKey && context.envelope.auditSha256) {
      const audit = await inspectStoredNativeEsignArtifact(context.envelope.auditStorageKey).catch(() => null);
      if (audit) await registerNativeEsignArtifact(tx, { companyId, envelopeId, documentVersionId: context.document.id, artifactKind: "audit_json", storageKey: context.envelope.auditStorageKey, sha256: context.envelope.auditSha256, sizeBytes: audit.sizeBytes, mimeType: "application/json", createdAt: context.envelope.completedAt || context.envelope.updatedAt });
    }
    for (const recipient of recipients.filter((item) => item.signatureCaptureStorageKey && item.signatureCaptureSha256)) {
      await registerNativeEsignArtifact(tx, { companyId, envelopeId, documentVersionId: context.document.id, recipientId: recipient.id, artifactKind: "signature_capture", storageKey: recipient.signatureCaptureStorageKey, sha256: recipient.signatureCaptureSha256, sizeBytes: recipient.signatureCaptureSizeBytes, mimeType: recipient.signatureCaptureMimeType, createdAt: recipient.signedAt || recipient.updatedAt });
    }
  });
  return custodySummary(companyId, envelopeId);
}

export async function custodySummary(companyId: number, envelopeId: string) {
  const envelope = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, envelopeId), eq(eosEsignEnvelopes.companyId, companyId)) });
  if (!envelope) return null;
  const document = await db.query.eosEsignDocumentVersions.findFirst({ where: eq(eosEsignDocumentVersions.id, envelope.documentVersionId) });
  const [artifacts, policies, holds, deletionRequests, events] = await Promise.all([
    db.select().from(eosEsignArtifacts).where(and(eq(eosEsignArtifacts.companyId, companyId), sql`(${eosEsignArtifacts.envelopeId} = ${envelopeId} OR ${eosEsignArtifacts.documentVersionId} = ${document?.id || ""})`)).orderBy(asc(eosEsignArtifacts.createdAt)),
    db.select().from(eosEsignRetentionPolicies).where(eq(eosEsignRetentionPolicies.companyId, companyId)).orderBy(desc(eosEsignRetentionPolicies.updatedAt)),
    db.select().from(eosEsignLegalHolds).where(and(eq(eosEsignLegalHolds.companyId, companyId), eq(eosEsignLegalHolds.envelopeId, envelopeId))).orderBy(desc(eosEsignLegalHolds.placedAt)),
    db.select().from(eosEsignDeletionRequests).where(and(eq(eosEsignDeletionRequests.companyId, companyId), eq(eosEsignDeletionRequests.envelopeId, envelopeId))).orderBy(desc(eosEsignDeletionRequests.createdAt)),
    db.select().from(eosEsignCustodyEvents).where(and(eq(eosEsignCustodyEvents.companyId, companyId), eq(eosEsignCustodyEvents.envelopeId, envelopeId))).orderBy(desc(eosEsignCustodyEvents.occurredAt)).limit(100),
  ]);
  const activeHold = holds.find((hold) => hold.state === "active") || null;
  const activePolicyRecord = policies.find((policy) => policy.state === "active") || null;
  return {
    storageProvider: nativeEsignStorageProvider(), backupConfigured: nativeEsignBackupConfigured(),
    policy: activePolicyRecord, artifacts, legalHolds: holds, activeLegalHold: activeHold,
    deletionRequests, events,
    readiness: {
      policyConfigured: Boolean(activePolicyRecord),
      artifactCount: artifacts.length,
      activeArtifactCount: artifacts.filter((item) => item.state === "active").length,
      verifiedArtifactCount: artifacts.filter((item) => item.lastVerifiedAt && !item.lastFailureCode).length,
      backupVerifiedCount: artifacts.filter((item) => item.backupState === "verified").length,
      held: Boolean(activeHold),
    },
  };
}

export async function verifyEnvelopeCustody(companyId: number, envelopeId: string, actorUserId: string | null) {
  await ensureEnvelopeCustodyInventory(companyId, envelopeId);
  const summary = await custodySummary(companyId, envelopeId);
  if (!summary) throw new Error("native_esign_envelope_not_found");
  const results: Array<{ id: string; state: "verified" | "failed"; failureCode: string }> = [];
  for (const artifact of summary.artifacts.filter((item) => item.state !== "deleted")) {
    let failureCode = "";
    try {
      const inspected = await inspectStoredNativeEsignArtifact(artifact.storageKey);
      if (inspected.sha256 !== artifact.sha256 || inspected.sizeBytes !== artifact.sizeBytes) failureCode = "primary_mismatch";
    } catch { failureCode = "primary_unavailable"; }
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(eosEsignArtifacts).set({ lastVerifiedAt: now, lastFailureCode: failureCode, state: failureCode ? "recovery_required" : "active", version: artifact.version + 1, updatedAt: now }).where(and(eq(eosEsignArtifacts.id, artifact.id), eq(eosEsignArtifacts.version, artifact.version)));
      await appendCustodyEvent(tx, { companyId, envelopeId, artifactId: artifact.id, actorUserId, eventType: failureCode ? "artifact_verification_failed" : "artifact_verified", eventProjection: { failureCode: failureCode || null, sha256: artifact.sha256 }, occurredAt: now });
    });
    results.push({ id: artifact.id, state: failureCode ? "failed" : "verified", failureCode });
  }
  return { state: results.every((item) => item.state === "verified") ? "passed" : "failed", results };
}

export async function backUpEnvelopeCustody(companyId: number, envelopeId: string, actorUserId: string | null) {
  if (!nativeEsignBackupConfigured()) throw new Error("native_esign_backup_not_configured");
  await ensureEnvelopeCustodyInventory(companyId, envelopeId);
  const summary = await custodySummary(companyId, envelopeId);
  if (!summary) throw new Error("native_esign_envelope_not_found");
  const results = [];
  for (const artifact of summary.artifacts.filter((item) => item.state === "active")) {
    const now = new Date();
    try {
      const backup = await backUpNativeEsignArtifact(artifact.storageKey, artifact.sha256);
      await db.transaction(async (tx) => {
        await tx.update(eosEsignArtifacts).set({ backupState: "verified", backupProvider: nativeEsignStorageProvider(process.env, "backup"), backupStorageKey: artifact.storageKey, backupSha256: backup.sha256, backupVerifiedAt: now, lastFailureCode: "", version: artifact.version + 1, updatedAt: now }).where(and(eq(eosEsignArtifacts.id, artifact.id), eq(eosEsignArtifacts.version, artifact.version)));
        await appendCustodyEvent(tx, { companyId, envelopeId, artifactId: artifact.id, actorUserId, eventType: "artifact_backup_verified", eventProjection: { sha256: backup.sha256, sizeBytes: backup.sizeBytes }, occurredAt: now });
      });
      results.push({ id: artifact.id, state: "verified" });
    } catch (error: any) {
      await db.update(eosEsignArtifacts).set({ backupState: "failed", lastFailureCode: String(error?.message || "backup_failed").slice(0, 200), version: artifact.version + 1, updatedAt: now }).where(and(eq(eosEsignArtifacts.id, artifact.id), eq(eosEsignArtifacts.version, artifact.version)));
      results.push({ id: artifact.id, state: "failed" });
    }
  }
  return { state: results.every((item) => item.state === "verified") ? "passed" : "failed", results };
}

export async function restoreCustodyArtifact(companyId: number, envelopeId: string, artifactId: string, actorUserId: string) {
  const envelope = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, envelopeId), eq(eosEsignEnvelopes.companyId, companyId)) });
  const artifact = envelope ? await db.query.eosEsignArtifacts.findFirst({ where: and(
    eq(eosEsignArtifacts.id, artifactId), eq(eosEsignArtifacts.companyId, companyId),
    or(eq(eosEsignArtifacts.envelopeId, envelopeId), eq(eosEsignArtifacts.documentVersionId, envelope.documentVersionId)),
  ) }) : null;
  if (!artifact || artifact.backupState !== "verified" || artifact.state === "deleted") throw new Error("native_esign_restore_unavailable");
  const restored = await restoreNativeEsignArtifact(artifact.storageKey, artifact.sha256);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(eosEsignArtifacts).set({ state: "active", lastVerifiedAt: now, lastFailureCode: "", version: artifact.version + 1, updatedAt: now }).where(and(eq(eosEsignArtifacts.id, artifact.id), eq(eosEsignArtifacts.version, artifact.version)));
    await appendCustodyEvent(tx, { companyId, envelopeId, artifactId, actorUserId, eventType: "artifact_restored", eventProjection: restored, occurredAt: now });
  });
  return restored;
}

export async function placeLegalHold(companyId: number, envelopeId: string, actorUserId: string, reason: string, reference: string) {
  const id = randomUUID(); const now = new Date();
  const [hold] = await db.transaction(async (tx) => {
    const inserted = await tx.insert(eosEsignLegalHolds).values({ id, companyId, envelopeId, reason, reference, state: "active", placedByUserId: actorUserId, placedAt: now, version: 1 }).returning();
    await appendCustodyEvent(tx, { companyId, envelopeId, actorUserId, eventType: "legal_hold_placed", eventProjection: { holdId: id, reference }, occurredAt: now });
    return inserted;
  });
  return hold;
}

export async function releaseLegalHold(companyId: number, envelopeId: string, holdId: string, actorUserId: string, reason: string, version: number) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const [hold] = await tx.update(eosEsignLegalHolds).set({ state: "released", releasedByUserId: actorUserId, releasedAt: now, releaseReason: reason, version: version + 1 })
      .where(and(eq(eosEsignLegalHolds.id, holdId), eq(eosEsignLegalHolds.companyId, companyId), eq(eosEsignLegalHolds.envelopeId, envelopeId), eq(eosEsignLegalHolds.state, "active"), eq(eosEsignLegalHolds.version, version))).returning();
    if (!hold) throw new Error("native_esign_legal_hold_changed");
    await appendCustodyEvent(tx, { companyId, envelopeId, actorUserId, eventType: "legal_hold_released", eventProjection: { holdId, reason }, occurredAt: now });
    return hold;
  });
}

export async function configureRetentionPolicy(companyId: number, actorUserId: string, input: { name: string; retentionDays: number; backupRequired: boolean; version?: number }) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const current = await activePolicy(companyId, tx);
    if (current) {
      if (input.version !== current.version) throw new Error("native_esign_retention_policy_changed");
      await tx.update(eosEsignRetentionPolicies).set({ state: "retired", version: current.version + 1, updatedAt: now }).where(and(eq(eosEsignRetentionPolicies.id, current.id), eq(eosEsignRetentionPolicies.version, current.version)));
    }
    const id = randomUUID();
    const [policy] = await tx.insert(eosEsignRetentionPolicies).values({ id, companyId, name: input.name, retentionDays: input.retentionDays, backupRequired: input.backupRequired, automaticDeletion: false, state: "active", version: 1, createdByUserId: actorUserId, createdAt: now, updatedAt: now }).returning();
    await tx.update(eosEsignArtifacts).set({
      retentionPolicyId: id,
      retainedUntil: sql`GREATEST(COALESCE(${eosEsignArtifacts.retainedUntil}, ${eosEsignArtifacts.createdAt}), ${eosEsignArtifacts.createdAt} + (${input.retentionDays} * interval '1 day'))`,
      backupState: input.backupRequired && nativeEsignBackupConfigured() ? "pending" : sql`${eosEsignArtifacts.backupState}`,
      version: sql`${eosEsignArtifacts.version} + 1`, updatedAt: now,
    }).where(and(eq(eosEsignArtifacts.companyId, companyId), inArray(eosEsignArtifacts.state, ["active", "deletion_pending", "recovery_required"])));
    await appendCustodyEvent(tx, { companyId, actorUserId, eventType: "retention_policy_activated", eventProjection: { policyId: id, retentionDays: input.retentionDays, backupRequired: input.backupRequired }, occurredAt: now });
    return policy;
  });
}

export async function requestEnvelopeDeletion(companyId: number, envelopeId: string, actorUserId: string, reason: string) {
  const envelope = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, envelopeId), eq(eosEsignEnvelopes.companyId, companyId), eq(eosEsignEnvelopes.state, "completed")) });
  if (!envelope) throw new Error("native_esign_deletion_completed_envelope_required");
  await ensureEnvelopeCustodyInventory(companyId, envelopeId);
  const id = randomUUID(); const now = new Date();
  return db.transaction(async (tx) => {
    const [request] = await tx.insert(eosEsignDeletionRequests).values({ id, companyId, envelopeId, requestedByUserId: actorUserId, reason, state: "pending_approval", version: 1, createdAt: now, updatedAt: now }).returning();
    await tx.update(eosEsignArtifacts).set({ state: "deletion_pending", version: sql`${eosEsignArtifacts.version} + 1`, updatedAt: now }).where(and(eq(eosEsignArtifacts.companyId, companyId), eq(eosEsignArtifacts.envelopeId, envelopeId), eq(eosEsignArtifacts.state, "active")));
    await appendCustodyEvent(tx, { companyId, envelopeId, actorUserId, eventType: "deletion_requested", eventProjection: { requestId: id, reason }, occurredAt: now });
    return request;
  });
}

export async function decideEnvelopeDeletion(companyId: number, requestId: string, actorUserId: string, approve: boolean, reason: string, version: number) {
  const request = await db.query.eosEsignDeletionRequests.findFirst({ where: and(eq(eosEsignDeletionRequests.id, requestId), eq(eosEsignDeletionRequests.companyId, companyId)) });
  if (!request || request.state !== "pending_approval" || request.version !== version) throw new Error("native_esign_deletion_request_changed");
  if (request.requestedByUserId === actorUserId) throw new Error("native_esign_deletion_two_person_required");
  const now = new Date(); const nextState = approve ? "approved" : "rejected";
  return db.transaction(async (tx) => {
    const [updated] = await tx.update(eosEsignDeletionRequests).set({ state: nextState, decidedByUserId: actorUserId, decisionReason: reason, decidedAt: now, version: version + 1, updatedAt: now }).where(and(eq(eosEsignDeletionRequests.id, requestId), eq(eosEsignDeletionRequests.state, "pending_approval"), eq(eosEsignDeletionRequests.version, version))).returning();
    if (!updated) throw new Error("native_esign_deletion_request_changed");
    if (!approve) await tx.update(eosEsignArtifacts).set({ state: "active", version: sql`${eosEsignArtifacts.version} + 1`, updatedAt: now }).where(and(eq(eosEsignArtifacts.companyId, companyId), eq(eosEsignArtifacts.envelopeId, request.envelopeId), eq(eosEsignArtifacts.state, "deletion_pending")));
    await appendCustodyEvent(tx, { companyId, envelopeId: request.envelopeId, actorUserId, eventType: approve ? "deletion_approved" : "deletion_rejected", eventProjection: { requestId, reason }, occurredAt: now });
    return updated;
  });
}

export async function cancelEnvelopeDeletion(companyId: number, requestId: string, actorUserId: string, version: number) {
  const request = await db.query.eosEsignDeletionRequests.findFirst({ where: and(eq(eosEsignDeletionRequests.id, requestId), eq(eosEsignDeletionRequests.companyId, companyId)) });
  if (!request || request.state !== "pending_approval" || request.version !== version || request.requestedByUserId !== actorUserId)
    throw new Error("native_esign_deletion_request_changed");
  const now = new Date();
  return db.transaction(async (tx) => {
    const [updated] = await tx.update(eosEsignDeletionRequests).set({ state: "cancelled", version: version + 1, updatedAt: now }).where(and(eq(eosEsignDeletionRequests.id, requestId), eq(eosEsignDeletionRequests.state, "pending_approval"), eq(eosEsignDeletionRequests.version, version))).returning();
    if (!updated) throw new Error("native_esign_deletion_request_changed");
    await tx.update(eosEsignArtifacts).set({ state: "active", version: sql`${eosEsignArtifacts.version} + 1`, updatedAt: now }).where(and(eq(eosEsignArtifacts.companyId, companyId), eq(eosEsignArtifacts.envelopeId, request.envelopeId), eq(eosEsignArtifacts.state, "deletion_pending")));
    await appendCustodyEvent(tx, { companyId, envelopeId: request.envelopeId, actorUserId, eventType: "deletion_cancelled", eventProjection: { requestId }, occurredAt: now });
    return updated;
  });
}

export async function executeEnvelopeDeletion(companyId: number, requestId: string, actorUserId: string, version: number) {
  const request = await db.query.eosEsignDeletionRequests.findFirst({ where: and(eq(eosEsignDeletionRequests.id, requestId), eq(eosEsignDeletionRequests.companyId, companyId)) });
  if (!request || request.state !== "approved" || request.version !== version) throw new Error("native_esign_deletion_request_changed");
  if ([request.requestedByUserId, request.decidedByUserId].includes(actorUserId)) throw new Error("native_esign_deletion_executor_separation_required");
  const [hold] = await db.select().from(eosEsignLegalHolds).where(and(eq(eosEsignLegalHolds.companyId, companyId), eq(eosEsignLegalHolds.envelopeId, request.envelopeId), eq(eosEsignLegalHolds.state, "active"))).limit(1);
  const artifacts = await db.select().from(eosEsignArtifacts).where(and(eq(eosEsignArtifacts.companyId, companyId), eq(eosEsignArtifacts.envelopeId, request.envelopeId), inArray(eosEsignArtifacts.state, ["active", "deletion_pending"])));
  const now = new Date();
  const blocked = hold ? "active_legal_hold" : !artifacts.length ? "artifact_inventory_empty" : artifacts.some((item) => !item.retentionPolicyId || !item.retainedUntil || item.retainedUntil > now) ? "retention_not_elapsed" : "";
  if (blocked) {
    await db.update(eosEsignDeletionRequests).set({ state: "blocked", failureCode: blocked, version: request.version + 1, updatedAt: now }).where(eq(eosEsignDeletionRequests.id, request.id));
    throw new Error(`native_esign_deletion_blocked:${blocked}`);
  }
  await db.update(eosEsignDeletionRequests).set({ state: "executing", executedByUserId: actorUserId, version: request.version + 1, updatedAt: now }).where(and(eq(eosEsignDeletionRequests.id, request.id), eq(eosEsignDeletionRequests.version, request.version)));
  try {
    for (const artifact of artifacts) {
      await removeNativeEsignArtifact(artifact.storageKey);
      if (artifact.backupState === "verified") await removeNativeEsignArtifact(artifact.backupStorageKey || artifact.storageKey, process.env, "backup");
    }
    await db.transaction(async (tx) => {
      await tx.update(eosEsignArtifacts).set({ state: "deleted", backupState: "deleted", version: sql`${eosEsignArtifacts.version} + 1`, updatedAt: new Date() }).where(and(eq(eosEsignArtifacts.companyId, companyId), eq(eosEsignArtifacts.envelopeId, request.envelopeId)));
      await tx.update(eosEsignDeletionRequests).set({ state: "completed", executedAt: new Date(), failureCode: "", version: request.version + 2, updatedAt: new Date() }).where(and(eq(eosEsignDeletionRequests.id, request.id), eq(eosEsignDeletionRequests.state, "executing")));
      await appendCustodyEvent(tx, { companyId, envelopeId: request.envelopeId, actorUserId, eventType: "deletion_completed", eventProjection: { requestId, artifactCount: artifacts.length } });
    });
    return { state: "completed", artifactCount: artifacts.length };
  } catch (error: any) {
    await db.update(eosEsignDeletionRequests).set({ state: "failed", executedAt: new Date(), failureCode: String(error?.message || "deletion_failed").slice(0, 200), version: request.version + 2, updatedAt: new Date() }).where(eq(eosEsignDeletionRequests.id, request.id));
    throw error;
  }
}
