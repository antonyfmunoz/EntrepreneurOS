import { createHash, randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import {
  eosEsignDocumentVersions,
  eosEsignEnvelopes,
  eosEsignEvents,
  eosEsignIntegrityChecks,
  eosEsignRecipients,
} from "@shared/schema";
import { db } from "../db";
import { readNativeEsignArtifact, validateNativeEsignPdf } from "../artifacts/native-esign-files";
import { nativeEsignAuditEventSha256, nativeEsignSignatureSha256 } from "./audit-chain";
import { typedSignatureCaptureSha256, validateNativeEsignSignatureCapture } from "./signature-capture";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export const NATIVE_ESIGN_INTEGRITY_FAILURE_CODES = [
  "envelope_not_completed",
  "source_artifact_missing", "source_content_invalid", "source_hash_mismatch", "source_size_mismatch",
  "final_artifact_missing", "final_content_invalid", "final_hash_mismatch",
  "audit_artifact_missing", "audit_hash_mismatch", "audit_parse_invalid", "audit_envelope_mismatch",
  "audit_recipient_mismatch", "audit_event_mismatch",
  "event_sequence_invalid", "event_chain_invalid",
  "capture_artifact_missing", "capture_content_invalid", "capture_metadata_mismatch", "capture_hash_mismatch",
  "signature_evidence_mismatch", "legacy_capture_unverifiable",
  "integrity_check_chain_invalid",
] as const;

export type NativeEsignIntegrityFailureCode = typeof NATIVE_ESIGN_INTEGRITY_FAILURE_CODES[number];
export type NativeEsignIntegrityState = "passed" | "failed" | "unavailable";
export type NativeEsignIntegrityReport = {
  schemaVersion: "eos-native-esign-integrity.v1";
  envelopeId: string;
  state: NativeEsignIntegrityState;
  checkedAt: string;
  completedAt: string | null;
  sourceSha256: string;
  finalSha256: string;
  auditSha256: string;
  eventCount: number;
  auditedEventCount: number;
  captureCount: number;
  failureCodes: NativeEsignIntegrityFailureCode[];
  checks: {
    sourceArtifact: boolean;
    finalArtifact: boolean;
    auditArtifact: boolean;
    eventChain: boolean;
    auditSnapshot: boolean;
    signatureEvidence: boolean;
    observationChain: boolean;
  };
};

export type NativeEsignIntegrityTrigger = "completion" | "operator" | "scheduled" | "recovery";

function canonicalize(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalEqual(left: unknown, right: unknown): boolean {
  try { return canonicalize(left as JsonValue) === canonicalize(right as JsonValue); }
  catch { return false; }
}

type EventEvidence = Pick<typeof eosEsignEvents.$inferSelect,
  "id" | "envelopeId" | "recipientId" | "sequence" | "eventType" | "actorType" |
  "actorReference" | "eventProjection" | "previousEventSha256" | "eventSha256" | "occurredAt">;

export function verifyNativeEsignEventChain(events: EventEvidence[]): NativeEsignIntegrityFailureCode[] {
  const failures = new Set<NativeEsignIntegrityFailureCode>();
  let previous = "";
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.sequence !== index + 1) failures.add("event_sequence_invalid");
    if (event.previousEventSha256 !== previous) failures.add("event_chain_invalid");
    const expected = nativeEsignAuditEventSha256({
      envelopeId: event.envelopeId,
      recipientId: event.recipientId,
      sequence: event.sequence,
      eventType: event.eventType,
      actorType: event.actorType as "operator" | "signer" | "system" | "provider",
      actorReference: event.actorReference,
      eventProjection: event.eventProjection as Record<string, JsonValue>,
      occurredAt: event.occurredAt.toISOString(),
      previousEventSha256: event.previousEventSha256,
    });
    if (event.eventSha256 !== expected) failures.add("event_chain_invalid");
    previous = event.eventSha256;
  }
  return Array.from(failures);
}

function expectedAuditEvent(event: EventEvidence) {
  return {
    id: event.id,
    sequence: event.sequence,
    eventType: event.eventType,
    actorType: event.actorType,
    actorReference: event.actorReference,
    eventProjection: event.eventProjection,
    previousEventSha256: event.previousEventSha256,
    eventSha256: event.eventSha256,
    occurredAt: event.occurredAt.toISOString(),
  };
}

function expectedAuditRecipient(recipient: typeof eosEsignRecipients.$inferSelect) {
  return {
    id: recipient.id,
    roleKey: recipient.roleKey,
    signerName: recipient.signerName,
    signerEmail: recipient.signerEmail,
    consentVersion: recipient.consentVersion,
    comparisonAcknowledgementSha256: recipient.comparisonAcknowledgementSha256 || null,
    comparisonAcknowledgedAt: recipient.comparisonAcknowledgedAt?.toISOString() || null,
    signatureMethod: recipient.signatureMethod,
    signatureSha256: recipient.signatureSha256,
    signatureCaptureSha256: recipient.signatureCaptureSha256,
    signatureCaptureMimeType: recipient.signatureCaptureMimeType,
    signatureCaptureSizeBytes: recipient.signatureCaptureSizeBytes,
    signatureCaptureWidth: recipient.signatureCaptureWidth,
    signatureCaptureHeight: recipient.signatureCaptureHeight,
    signedAt: recipient.signedAt?.toISOString(),
  };
}

async function readableArtifact(storageKey: string, missingCode: NativeEsignIntegrityFailureCode) {
  try { return { bytes: await readNativeEsignArtifact(storageKey), failure: null }; }
  catch { return { bytes: null, failure: missingCode }; }
}

export async function verifyNativeEsignEnvelopeIntegrity(envelopeId: string): Promise<NativeEsignIntegrityReport> {
  const checkedAt = new Date();
  const [context] = await db.select({ envelope: eosEsignEnvelopes, document: eosEsignDocumentVersions })
    .from(eosEsignEnvelopes)
    .innerJoin(eosEsignDocumentVersions, eq(eosEsignDocumentVersions.id, eosEsignEnvelopes.documentVersionId))
    .where(eq(eosEsignEnvelopes.id, envelopeId)).limit(1);
  if (!context || context.envelope.state !== "completed" || !context.envelope.completedAt) {
    return {
      schemaVersion: "eos-native-esign-integrity.v1", envelopeId, state: "unavailable",
      checkedAt: checkedAt.toISOString(), completedAt: context?.envelope.completedAt?.toISOString() || null,
      sourceSha256: context?.document.sourceSha256 || "", finalSha256: context?.envelope.finalSha256 || "",
      auditSha256: context?.envelope.auditSha256 || "", eventCount: 0, auditedEventCount: 0, captureCount: 0,
      failureCodes: ["envelope_not_completed"],
      checks: { sourceArtifact: false, finalArtifact: false, auditArtifact: false, eventChain: false, auditSnapshot: false, signatureEvidence: false, observationChain: false },
    };
  }

  const [recipients, events, observations] = await Promise.all([
    db.select().from(eosEsignRecipients).where(eq(eosEsignRecipients.envelopeId, envelopeId)),
    db.select().from(eosEsignEvents).where(eq(eosEsignEvents.envelopeId, envelopeId)).orderBy(eosEsignEvents.sequence),
    db.select().from(eosEsignIntegrityChecks).where(eq(eosEsignIntegrityChecks.envelopeId, envelopeId)).orderBy(eosEsignIntegrityChecks.checkedAt, eosEsignIntegrityChecks.createdAt),
  ]);
  const failures = new Set<NativeEsignIntegrityFailureCode>();
  const unavailable = new Set<NativeEsignIntegrityFailureCode>();
  const checks = { sourceArtifact: true, finalArtifact: true, auditArtifact: true, eventChain: true, auditSnapshot: true, signatureEvidence: true, observationChain: true };
  let sourceActual = "";
  let finalActual = "";
  let auditActual = "";
  let auditedEventCount = 0;
  let captureCount = 0;

  let previousObservationSha256 = "";
  for (const observation of observations) {
    const observationReport = {
      schemaVersion: "eos-native-esign-integrity.v1",
      envelopeId,
      state: observation.state,
      checkedAt: observation.checkedAt.toISOString(),
      completedAt: context.envelope.completedAt.toISOString(),
      sourceSha256: observation.sourceSha256,
      finalSha256: observation.finalSha256,
      auditSha256: observation.auditSha256,
      eventCount: observation.eventCount,
      auditedEventCount: observation.auditedEventCount,
      captureCount: observation.captureCount,
      failureCodes: observation.failureCodes,
      checks: observation.verificationProjection,
    };
    const expectedCheckSha256 = sha256(canonicalize({
      schemaVersion: "eos-native-esign-integrity.v1",
      envelopeId,
      companyId: observation.companyId,
      triggerType: observation.triggerType,
      requestedByUserId: observation.requestedByUserId || null,
      reason: observation.reason,
      report: observationReport,
      previousCheckSha256: previousObservationSha256,
    } as unknown as JsonValue));
    if (observation.previousCheckSha256 !== previousObservationSha256 || observation.checkSha256 !== expectedCheckSha256) {
      failures.add("integrity_check_chain_invalid"); checks.observationChain = false;
    }
    previousObservationSha256 = observation.checkSha256;
  }

  const source = await readableArtifact(context.document.sourceStorageKey, "source_artifact_missing");
  if (!source.bytes) {
    unavailable.add(source.failure!); checks.sourceArtifact = false;
  } else {
    sourceActual = sha256(source.bytes);
    try { validateNativeEsignPdf(source.bytes); } catch { failures.add("source_content_invalid"); checks.sourceArtifact = false; }
    if (sourceActual !== context.document.sourceSha256) { failures.add("source_hash_mismatch"); checks.sourceArtifact = false; }
    if (source.bytes.length !== context.document.sizeBytes) { failures.add("source_size_mismatch"); checks.sourceArtifact = false; }
  }

  const final = await readableArtifact(context.envelope.finalStorageKey, "final_artifact_missing");
  if (!final.bytes) {
    unavailable.add(final.failure!); checks.finalArtifact = false;
  } else {
    finalActual = sha256(final.bytes);
    try { validateNativeEsignPdf(final.bytes); } catch { failures.add("final_content_invalid"); checks.finalArtifact = false; }
    if (finalActual !== context.envelope.finalSha256) { failures.add("final_hash_mismatch"); checks.finalArtifact = false; }
  }

  for (const eventFailure of verifyNativeEsignEventChain(events)) failures.add(eventFailure);
  if (failures.has("event_sequence_invalid") || failures.has("event_chain_invalid")) checks.eventChain = false;

  for (const recipient of recipients) {
    if (recipient.state !== "signed") { failures.add("signature_evidence_mismatch"); checks.signatureEvidence = false; continue; }
    captureCount += 1;
    let captureVerifiable = true;
    if (recipient.signatureMethod === "typed") {
      const expectedCapture = typedSignatureCaptureSha256(recipient.signatureName);
      if (recipient.signatureCaptureSha256 !== expectedCapture) {
        if (recipient.signatureCaptureSha256 === recipient.signatureSha256) {
          unavailable.add("legacy_capture_unverifiable"); captureVerifiable = false;
        } else {
          failures.add("capture_hash_mismatch"); checks.signatureEvidence = false;
        }
      }
    } else if (["drawn", "uploaded"].includes(recipient.signatureMethod)) {
      const capture = await readableArtifact(recipient.signatureCaptureStorageKey, "capture_artifact_missing");
      if (!capture.bytes) {
        unavailable.add(capture.failure!); checks.signatureEvidence = false; captureVerifiable = false;
      } else {
        try {
          const verified = await validateNativeEsignSignatureCapture({
            method: recipient.signatureMethod as "drawn" | "uploaded",
            mimeType: recipient.signatureCaptureMimeType as "image/png" | "image/jpeg",
            base64: capture.bytes.toString("base64"),
            claimedSha256: recipient.signatureCaptureSha256,
          });
          if (verified.sizeBytes !== recipient.signatureCaptureSizeBytes || verified.width !== recipient.signatureCaptureWidth || verified.height !== recipient.signatureCaptureHeight) {
            failures.add("capture_metadata_mismatch"); checks.signatureEvidence = false;
          }
        } catch (error) {
          const code = error instanceof Error && error.message === "native_esign_capture_hash_mismatch" ? "capture_hash_mismatch" : "capture_content_invalid";
          failures.add(code); checks.signatureEvidence = false;
        }
      }
    } else {
      failures.add("capture_metadata_mismatch"); checks.signatureEvidence = false; captureVerifiable = false;
    }
    if (captureVerifiable) {
      const expectedSignature = nativeEsignSignatureSha256({
        envelopeId, recipientId: recipient.id, consentVersion: recipient.consentVersion,
        signatureMethod: recipient.signatureMethod, signatureName: recipient.signatureName,
        signatureCaptureSha256: recipient.signatureCaptureSha256,
        fieldValues: recipient.fieldValues as Record<string, string | boolean>,
      });
      if (recipient.signatureSha256 !== expectedSignature) { failures.add("signature_evidence_mismatch"); checks.signatureEvidence = false; }
    }
  }

  const audit = await readableArtifact(context.envelope.auditStorageKey, "audit_artifact_missing");
  if (!audit.bytes) {
    unavailable.add(audit.failure!); checks.auditArtifact = false; checks.auditSnapshot = false;
  } else {
    auditActual = sha256(audit.bytes);
    if (auditActual !== context.envelope.auditSha256) { failures.add("audit_hash_mismatch"); checks.auditArtifact = false; }
    let parsed: any;
    try { parsed = JSON.parse(audit.bytes.toString("utf8")); }
    catch { failures.add("audit_parse_invalid"); checks.auditSnapshot = false; }
    if (parsed) {
      if (
        parsed.schemaVersion !== "eos-native-esign-audit.v1" || parsed.envelopeId !== envelopeId ||
        parsed.documentVersionId !== context.document.id || parsed.sourceSha256 !== context.document.sourceSha256 ||
        parsed.finalSha256 !== context.envelope.finalSha256 || parsed.completedAt !== context.envelope.completedAt.toISOString()
      ) { failures.add("audit_envelope_mismatch"); checks.auditSnapshot = false; }
      const completedEvent = events.find((event) => event.eventType === "envelope_completed");
      const auditedEvents = completedEvent ? events.filter((event) => event.sequence <= completedEvent.sequence) : [];
      auditedEventCount = auditedEvents.length;
      if (!Array.isArray(parsed.events) || parsed.events.length !== auditedEvents.length || parsed.events.some((event: unknown, index: number) => !canonicalEqual(event, expectedAuditEvent(auditedEvents[index])))) {
        failures.add("audit_event_mismatch"); checks.auditSnapshot = false;
      }
      const expectedRecipients = new Map(recipients.map((recipient) => [recipient.id, expectedAuditRecipient(recipient)]));
      if (!Array.isArray(parsed.recipients) || parsed.recipients.length !== recipients.length || parsed.recipients.some((recipient: any) => !recipient?.id || !canonicalEqual(recipient, expectedRecipients.get(recipient.id)))) {
        failures.add("audit_recipient_mismatch"); checks.auditSnapshot = false;
      }
    }
  }

  for (const code of Array.from(unavailable)) failures.add(code);
  const failureCodes = Array.from(failures);
  const state: NativeEsignIntegrityState = Array.from(failures).some((code) => !unavailable.has(code)) ? "failed" : unavailable.size ? "unavailable" : "passed";
  return {
    schemaVersion: "eos-native-esign-integrity.v1", envelopeId, state,
    checkedAt: checkedAt.toISOString(), completedAt: context.envelope.completedAt.toISOString(),
    sourceSha256: sourceActual || context.document.sourceSha256,
    finalSha256: finalActual || context.envelope.finalSha256,
    auditSha256: auditActual || context.envelope.auditSha256,
    eventCount: events.length, auditedEventCount, captureCount, failureCodes, checks,
  };
}

export async function recordNativeEsignIntegrityCheck(input: {
  report: NativeEsignIntegrityReport;
  companyId: number;
  triggerType: NativeEsignIntegrityTrigger;
  requestedByUserId?: string | null;
  reason?: string;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`integrity:${input.report.envelopeId}`}))`);
    const [previous] = await tx.select().from(eosEsignIntegrityChecks)
      .where(eq(eosEsignIntegrityChecks.envelopeId, input.report.envelopeId))
      .orderBy(desc(eosEsignIntegrityChecks.checkedAt), desc(eosEsignIntegrityChecks.createdAt)).limit(1);
    const previousCheckSha256 = previous?.checkSha256 || "";
    const checkProjection = {
      schemaVersion: input.report.schemaVersion,
      envelopeId: input.report.envelopeId,
      companyId: input.companyId,
      triggerType: input.triggerType,
      requestedByUserId: input.requestedByUserId || null,
      reason: input.reason?.trim() || "",
      report: input.report,
      previousCheckSha256,
    };
    const checkSha256 = sha256(canonicalize(checkProjection as unknown as JsonValue));
    const [check] = await tx.insert(eosEsignIntegrityChecks).values({
      id: randomUUID(), companyId: input.companyId, envelopeId: input.report.envelopeId,
      requestedByUserId: input.requestedByUserId || null, triggerType: input.triggerType,
      state: input.report.state, reason: input.reason?.trim() || "",
      sourceSha256: input.report.sourceSha256, finalSha256: input.report.finalSha256,
      auditSha256: input.report.auditSha256, eventCount: input.report.eventCount,
      auditedEventCount: input.report.auditedEventCount, captureCount: input.report.captureCount,
      failureCodes: input.report.failureCodes, verificationProjection: input.report.checks,
      previousCheckSha256, checkSha256, checkedAt: new Date(input.report.checkedAt), createdAt: new Date(),
    }).returning();
    return check;
  });
}

export function publicNativeEsignIntegrityProjection(report: NativeEsignIntegrityReport) {
  return {
    schemaVersion: report.schemaVersion,
    envelopeId: report.envelopeId,
    valid: report.state === "passed",
    state: report.state,
    verifiedAt: report.checkedAt,
    completedAt: report.completedAt,
    sourceSha256: report.sourceSha256,
    finalSha256: report.finalSha256,
    auditSha256: report.auditSha256,
    eventCount: report.eventCount,
    auditedEventCount: report.auditedEventCount,
    captureCount: report.captureCount,
    failureCodes: report.failureCodes,
    checks: report.checks,
  };
}
