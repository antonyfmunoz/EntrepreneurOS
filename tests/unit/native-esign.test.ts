import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import {
  NATIVE_ESIGN_CONSENT_VERSION,
  activeRoutingOrder,
  nativeEsignRecipientRoutingState,
  nativeEsignRolesMissingRequiredSignature,
  nativeEsignConsentSchema,
  nativeEsignDocumentRegistrationSchema,
  nativeEsignEnvelopeState,
  nativeEsignEnvelopeCreationSchema,
  nativeEsignFieldSchema,
  nativeEsignRecipientCorrectionSchema,
  nativeEsignOtpVerifySchema,
  nativeEsignSignatureSchema,
  nativeEsignIntegrityCheckSchema,
  nativeEsignObligationReviewSchema,
  nativeEsignStorageDrillSchema,
  nativeEsignWebhookSubscriptionSchema,
} from "@shared/native-esign";
import {
  createNativeEsignSecret,
  nativeEsignPath,
  nativeEsignTokenDigest,
  nativeEsignUrl,
} from "../../server/native-esign-token";
import {
  nativeEsignAuditEventSha256,
  nativeEsignSignatureSha256,
} from "../../server/esign/audit-chain";
import {
  nativeEsignFinalStorageKey,
  inspectNativeEsignPdf,
  readNativeEsignArtifact,
  nativeEsignSignatureStorageKey,
  nativeEsignSourceStorageKey,
  nativeEsignStorageIdentitySha256,
  probeNativeEsignStoragePlane,
  backUpNativeEsignArtifact,
  inspectStoredNativeEsignArtifact,
  removeNativeEsignArtifact,
  restoreNativeEsignArtifact,
  storeNativeEsignArtifact,
  validateNativeEsignPdf,
} from "../../server/artifacts/native-esign-files";
import { renderNativeEsignCompletedPdf } from "../../server/esign/pdf-renderer";
import { createNativeEsignOtp, nativeEsignOtpDigest, nativeEsignOtpMatches } from "../../server/esign/otp";
import { parseNativeEsignWebhookEndpoint } from "../../server/esign/webhook-egress";
import { nativeEsignRetryAt } from "../../server/esign/operations-worker";
import { typedSignatureCaptureSha256, validateNativeEsignSignatureCapture } from "../../server/esign/signature-capture";
import { publicNativeEsignIntegrityProjection, verifyNativeEsignEventChain } from "../../server/esign/integrity";
import { createSyntheticSignaturePng } from "../fixtures/native-esign-signature-image";

describe("EOS native e-sign foundation", () => {
  it("creates high-entropy signer secrets while retaining only deterministic digests", () => {
    const secret = createNativeEsignSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(nativeEsignTokenDigest(secret)).toMatch(/^[0-9a-f]{64}$/);
    expect(nativeEsignTokenDigest(secret)).not.toContain(secret);
    expect(nativeEsignPath(secret)).toBe(`/sign/${secret}`);
    expect(nativeEsignUrl(secret, "https://entrepreneuros.net/base")).toBe(
      `https://entrepreneuros.net/sign/${secret}`,
    );
  });

  it("requires explicit electronic-record and signature consent", () => {
    expect(nativeEsignConsentSchema.parse({
      consentVersion: NATIVE_ESIGN_CONSENT_VERSION,
      electronicRecordsAccepted: true,
      electronicSignaturesAccepted: true,
    })).toBeTruthy();
    expect(() => nativeEsignConsentSchema.parse({
      consentVersion: NATIVE_ESIGN_CONSENT_VERSION,
      electronicRecordsAccepted: true,
      electronicSignaturesAccepted: false,
    })).toThrow();
  });

  it("requires affirmative intent and an independently hashed signature capture", () => {
    const valid = {
      consentVersion: NATIVE_ESIGN_CONSENT_VERSION,
      intentToSignConfirmed: true,
      signatureMethod: "typed",
      signatureName: "Example Signer",
      signatureCaptureSha256: "a".repeat(64),
      fieldValues: {},
    };
    expect(nativeEsignSignatureSchema.parse(valid).signatureMethod).toBe("typed");
    expect(() => nativeEsignSignatureSchema.parse({ ...valid, intentToSignConfirmed: false })).toThrow();
    expect(() => nativeEsignSignatureSchema.parse({ ...valid, signatureMethod: "drawn" })).toThrow("image capture");
    expect(() => nativeEsignSignatureSchema.parse({ ...valid, signatureCaptureMimeType: "image/png", signatureCaptureBase64: "AAAA" })).toThrow("cannot include an image");
  });

  it("validates bounded drawn and uploaded capture bytes against their claimed hash", async () => {
    const png = createSyntheticSignaturePng();
    const sha256 = createHash("sha256").update(png).digest("hex");
    expect(typedSignatureCaptureSha256("  Example Signer ")).toBe(createHash("sha256").update("typed\0Example Signer").digest("hex"));
    const capture = await validateNativeEsignSignatureCapture({ method: "drawn", mimeType: "image/png", base64: png.toString("base64"), claimedSha256: sha256 });
    expect(capture).toMatchObject({ mimeType: "image/png", sha256, sizeBytes: png.length, width: 160, height: 60 });
    await expect(validateNativeEsignSignatureCapture({ method: "drawn", mimeType: "image/jpeg", base64: png.toString("base64"), claimedSha256: sha256 })).rejects.toThrow("capture_type_invalid");
    await expect(validateNativeEsignSignatureCapture({ method: "uploaded", mimeType: "image/png", base64: png.toString("base64"), claimedSha256: "0".repeat(64) })).rejects.toThrow("capture_hash_mismatch");
  });

  it("requires a versioned replacement identity and attributable correction reason", () => {
    const valid = {
      version: 3,
      signerName: "Corrected Signer",
      signerEmail: "corrected@example.test",
      reason: "The original recipient was selected incorrectly.",
    };
    expect(nativeEsignRecipientCorrectionSchema.parse(valid)).toMatchObject(valid);
    expect(() => nativeEsignRecipientCorrectionSchema.parse({ ...valid, version: 0 })).toThrow();
    expect(() => nativeEsignRecipientCorrectionSchema.parse({ ...valid, reason: "typo" })).toThrow();
  });

  it("supports an explicit email-OTP assurance contract without upgrading it to identity proofing", () => {
    const envelope = nativeEsignEnvelopeCreationSchema.parse({
      documentVersionId: "8d8c1948-6c0b-49f4-af10-25b3b7f1eeda",
      subject: "OTP agreement", message: "", routingMode: "sequential", assuranceMode: "email_otp",
      expiresAt: new Date(Date.now() + 60_000),
      recipients: [{ roleKey: "client", routingOrder: 1, signerName: "Signer", signerEmail: "signer@example.test" }],
    });
    expect(envelope.assuranceMode).toBe("email_otp");
    const otp = createNativeEsignOtp();
    expect(otp.code).toMatch(/^\d{6}$/);
    const digest = nativeEsignOtpDigest("recipient-id", otp.code);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(nativeEsignOtpMatches("recipient-id", otp.code, digest)).toBe(true);
    expect(nativeEsignOtpMatches("other-recipient", otp.code, digest)).toBe(false);
    expect(nativeEsignOtpVerifySchema.parse({ code: otp.code })).toEqual({ code: otp.code });
  });

  it("validates signed webhook subscriptions and bounded exponential retries", () => {
    const subscription = nativeEsignWebhookSubscriptionSchema.parse({ endpointUrl: "https://operations.example.test/eos", description: "Lifecycle events", eventTypes: ["envelope_completed", "recipient_declined"] });
    expect(subscription.eventTypes).toEqual(["envelope_completed", "recipient_declined"]);
    expect(() => nativeEsignWebhookSubscriptionSchema.parse({ ...subscription, eventTypes: ["envelope_completed", "envelope_completed"] })).toThrow("unique");
    expect(parseNativeEsignWebhookEndpoint("https://operations.example.test/eos").protocol).toBe("https:");
    expect(() => parseNativeEsignWebhookEndpoint("ftp://operations.example.test/eos")).toThrow("HTTPS");
    expect(() => parseNativeEsignWebhookEndpoint("https://user:secret@operations.example.test/eos")).toThrow("credentials");
    const start = Date.parse("2026-08-24T12:00:00.000Z");
    expect(nativeEsignRetryAt(1, start).getTime() - start).toBe(15_000);
    expect(nativeEsignRetryAt(20, start).getTime() - start).toBe(60 * 60_000);
  });

  it("requires scheduled, evidence-backed contract obligation reviews", () => {
    const base = {
      expectedUpdatedAt: "2026-08-25T12:00:00.000Z",
      ownerSeatId: "8d8c1948-6c0b-49f4-af10-25b3b7f1eeda",
      reviewNote: "Human review confirmed the next accountable operating step.",
    };
    const active = nativeEsignObligationReviewSchema.parse({
      ...base,
      targetState: "under_assessment",
      nextReviewAt: "2026-09-25T12:00:00.000Z",
    });
    expect(active).toMatchObject({ targetState: "under_assessment", evidenceIds: [] });
    expect(() => nativeEsignObligationReviewSchema.parse({ ...base, targetState: "under_assessment" })).toThrow("schedule");
    expect(() => nativeEsignObligationReviewSchema.parse({ ...base, targetState: "satisfied_closed" })).toThrow("operational Evidence");
    const closed = nativeEsignObligationReviewSchema.parse({
      ...base,
      targetState: "satisfied_closed",
      evidenceIds: ["2ef4c2d8-43c0-4c7d-aad7-6d452fffd739"],
    });
    expect(closed.nextReviewAt).toBeUndefined();
    expect(() => nativeEsignObligationReviewSchema.parse({
      ...base,
      targetState: "overdue_breached",
      nextReviewAt: "2026-09-25T12:00:00.000Z",
      evidenceIds: ["2ef4c2d8-43c0-4c7d-aad7-6d452fffd739", "2ef4c2d8-43c0-4c7d-aad7-6d452fffd739"],
    })).toThrow("unique");
  });

  it("derives fail-closed lifecycle and routing state", () => {
    expect(nativeEsignEnvelopeState({ recipientStates: ["sent"], expired: false, voided: false })).toBe("issued");
    expect(nativeEsignEnvelopeState({ recipientStates: ["opened", "sent"], expired: false, voided: false })).toBe("in_progress");
    expect(nativeEsignEnvelopeState({ recipientStates: ["signed", "signed"], expired: false, voided: false })).toBe("completed");
    expect(nativeEsignEnvelopeState({ recipientStates: ["signed", "declined"], expired: false, voided: false })).toBe("declined");
    expect(activeRoutingOrder({ routingMode: "sequential", recipients: [
      { routingOrder: 1, state: "signed" },
      { routingOrder: 2, state: "sent" },
      { routingOrder: 3, state: "pending" },
    ] })).toEqual([2]);
    const recipients = [
      { routingOrder: 1, state: "signed" },
      { routingOrder: 2, state: "sent" },
      { routingOrder: 3, state: "sent" },
    ];
    expect(nativeEsignRecipientRoutingState({ routingMode: "sequential", recipients, recipient: recipients[1] })).toBe("active");
    expect(nativeEsignRecipientRoutingState({ routingMode: "sequential", recipients, recipient: recipients[2] })).toBe("waiting");
    expect(nativeEsignRecipientRoutingState({ routingMode: "parallel", recipients, recipient: recipients[2] })).toBe("active");
    expect(nativeEsignRecipientRoutingState({ routingMode: "sequential", recipients, recipient: recipients[0] })).toBe("completed");
  });

  it("produces stable, order-independent audit and signature hashes", () => {
    const event = {
      envelopeId: "envelope",
      recipientId: "recipient",
      sequence: 1,
      eventType: "consent_recorded",
      actorType: "signer" as const,
      actorReference: "recipient",
      eventProjection: { z: "last", a: "first" },
      occurredAt: "2026-08-23T12:00:00.000Z",
      previousEventSha256: "",
    };
    expect(nativeEsignAuditEventSha256(event)).toBe(
      nativeEsignAuditEventSha256({ ...event, eventProjection: { a: "first", z: "last" } }),
    );
    expect(nativeEsignAuditEventSha256({ ...event, eventProjection: { a: "first", omittedByJsonStorage: undefined } as any })).toBe(
      nativeEsignAuditEventSha256({ ...event, eventProjection: { a: "first" } }),
    );
    expect(nativeEsignSignatureSha256({
      envelopeId: "envelope",
      recipientId: "recipient",
      consentVersion: NATIVE_ESIGN_CONSENT_VERSION,
      signatureMethod: "typed",
      signatureName: "Example Signer",
      signatureCaptureSha256: "b".repeat(64),
      fieldValues: { accepted: true },
    })).toMatch(/^[0-9a-f]{64}$/);
  });

  it("detects event sequence, predecessor, and content tampering independently", () => {
    const firstInput = {
      envelopeId: "envelope", recipientId: null, sequence: 1, eventType: "envelope_created",
      actorType: "operator" as const, actorReference: "user", eventProjection: { state: "draft" },
      occurredAt: "2026-08-24T12:00:00.000Z", previousEventSha256: "",
    };
    const first = { id: "event-1", ...firstInput, eventSha256: nativeEsignAuditEventSha256(firstInput), occurredAt: new Date(firstInput.occurredAt) };
    const secondInput = { ...firstInput, recipientId: "recipient", sequence: 2, eventType: "signature_recorded", actorType: "signer" as const, actorReference: "recipient", eventProjection: { signatureSha256: "a".repeat(64) }, previousEventSha256: first.eventSha256 };
    const second = { id: "event-2", ...secondInput, eventSha256: nativeEsignAuditEventSha256(secondInput), occurredAt: new Date(secondInput.occurredAt) };
    expect(verifyNativeEsignEventChain([first, second])).toEqual([]);
    expect(verifyNativeEsignEventChain([first, { ...second, sequence: 3 }])).toContain("event_sequence_invalid");
    expect(verifyNativeEsignEventChain([first, { ...second, previousEventSha256: "0".repeat(64) }])).toContain("event_chain_invalid");
    expect(verifyNativeEsignEventChain([first, { ...second, eventProjection: { signatureSha256: "b".repeat(64) } }])).toContain("event_chain_invalid");
  });

  it("exposes a bounded signer-safe verification projection and attributable operator reason", () => {
    expect(nativeEsignIntegrityCheckSchema.parse({ reason: "Quarterly evidence verification." })).toEqual({ reason: "Quarterly evidence verification." });
    expect(() => nativeEsignIntegrityCheckSchema.parse({ reason: "short" })).toThrow();
    const projection = publicNativeEsignIntegrityProjection({
      schemaVersion: "eos-native-esign-integrity.v1", envelopeId: "envelope", state: "passed",
      checkedAt: "2026-08-24T12:00:00.000Z", completedAt: "2026-08-24T11:59:00.000Z",
      sourceSha256: "a".repeat(64), finalSha256: "b".repeat(64), auditSha256: "c".repeat(64),
      eventCount: 8, auditedEventCount: 6, captureCount: 1, failureCodes: [],
      checks: { sourceArtifact: true, finalArtifact: true, auditArtifact: true, eventChain: true, auditSnapshot: true, signatureEvidence: true, observationChain: true },
    });
    expect(projection).toMatchObject({ valid: true, state: "passed", eventCount: 8, auditedEventCount: 6, captureCount: 1 });
    expect(JSON.stringify(projection)).not.toContain("storageKey");
  });

  it("adds an immutable, hash-chained native signing integrity ledger", () => {
    const migration = readFileSync(resolve(process.cwd(), "migrations/0068_add_native_esign_integrity_verification.sql"), "utf8");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_integrity_checks");
    expect(migration).toContain("previous_check_sha256 text NOT NULL DEFAULT ''");
    expect(migration).toContain("BEFORE UPDATE OR DELETE ON eos_esign_integrity_checks");
    expect(migration).toContain("Native e-sign integrity check history is immutable");
  });

  it("accepts bounded PDF artifacts and creates tenant-scoped storage keys", () => {
    const pdf = Buffer.from("%PDF-1.7\nminimal-test-fixture", "utf8");
    expect(validateNativeEsignPdf(pdf)).toMatchObject({
      mimeType: "application/pdf",
      sizeBytes: pdf.length,
    });
    expect(validateNativeEsignPdf(pdf).sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(nativeEsignSourceStorageKey(7, "8e8e3df4-9686-426a-9a2e-5ed1bd88ee2f"))
      .toBe("native-esign/7/documents/8e8e3df4-9686-426a-9a2e-5ed1bd88ee2f/source.pdf");
    expect(nativeEsignFinalStorageKey(7, "8e8e3df4-9686-426a-9a2e-5ed1bd88ee2f", "a".repeat(64)))
      .toBe(`native-esign/7/envelopes/8e8e3df4-9686-426a-9a2e-5ed1bd88ee2f/completed-${"a".repeat(64)}.pdf`);
    expect(nativeEsignSignatureStorageKey(7, "8e8e3df4-9686-426a-9a2e-5ed1bd88ee2f", "recipient", "a3cd04cc-246f-42bb-ae30-9a64b646324d", "image/png"))
      .toBe("native-esign/7/envelopes/8e8e3df4-9686-426a-9a2e-5ed1bd88ee2f/signatures/recipient-a3cd04cc-246f-42bb-ae30-9a64b646324d.png");
    expect(() => nativeEsignFinalStorageKey(7, "8e8e3df4-9686-426a-9a2e-5ed1bd88ee2f", "invalid"))
      .toThrow("native_esign_artifact_sha256_invalid");
    expect(() => validateNativeEsignPdf(Buffer.from("not a pdf"))).toThrow("native_esign_document_content_invalid");
  });

  it("inspects real PDF page geometry before immutable registration", async () => {
    const source = await PDFDocument.create();
    source.addPage([612, 792]);
    source.addPage([792, 612]);
    const metadata = await inspectNativeEsignPdf(Buffer.from(await source.save()));
    expect(metadata).toMatchObject({ mimeType: "application/pdf", pageCount: 2 });
    await expect(inspectNativeEsignPdf(Buffer.from("%PDF-1.7\nnot-a-real-document")))
      .rejects.toThrow("native_esign_document_content_invalid");
  });

  it("keeps authored fields within page bounds and gives every field a unique identity", () => {
    const field = {
      id: "8d8c1948-6c0b-49f4-af10-25b3b7f1eeda",
      roleKey: "client",
      type: "signature" as const,
      page: 1,
      x: 0.7,
      y: 0.8,
      width: 0.3,
      height: 0.2,
      label: "Client signature",
      required: true,
    };
    expect(nativeEsignFieldSchema.parse(field)).toEqual(field);
    expect(() => nativeEsignFieldSchema.parse({ ...field, x: 0.71 })).toThrow("right page boundary");
    expect(() => nativeEsignFieldSchema.parse({ ...field, y: 0.81 })).toThrow("bottom page boundary");
    expect(() => nativeEsignDocumentRegistrationSchema.parse({
      documentKey: "agreement",
      documentVersion: "1",
      title: "Agreement",
      sourceReference: "counsel://agreement/1",
      fields: [field, field],
    })).toThrow("Field IDs must be unique");
  });

  it("round-trips generated PDF and audit keys through private artifact storage", async () => {
    const root = await mkdtemp(join(tmpdir(), "eos-native-esign-unit-"));
    const env = { ...process.env, EOS_ARTIFACT_STORAGE_ROOT: root };
    try {
      const pdfKey = nativeEsignSourceStorageKey(7, "8e8e3df4-9686-426a-9a2e-5ed1bd88ee2f");
      const bytes = Buffer.from("%PDF-1.7\nprivate-storage-fixture", "utf8");
      await storeNativeEsignArtifact(pdfKey, bytes, env);
      expect(await readNativeEsignArtifact(pdfKey, env)).toEqual(bytes);
      await expect(storeNativeEsignArtifact("native-esign/7/../escape.pdf", bytes, env))
        .rejects.toThrow("native_esign_storage_key_invalid");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("enforces immutable primary writes and verifies independent backup recovery", async () => {
    const root = await mkdtemp(join(tmpdir(), "eos-native-esign-primary-"));
    const backupRoot = await mkdtemp(join(tmpdir(), "eos-native-esign-backup-"));
    const env = { ...process.env, NODE_ENV: "test", EOS_ARTIFACT_STORAGE_PROVIDER: "filesystem", EOS_ARTIFACT_STORAGE_ROOT: root, EOS_ARTIFACT_BACKUP_STORAGE_PROVIDER: "filesystem", EOS_ARTIFACT_BACKUP_STORAGE_ROOT: backupRoot };
    try {
      const key = nativeEsignSourceStorageKey(9, "3ee8e6ea-262e-41ef-a333-bbc532eead72");
      const bytes = Buffer.from("%PDF-1.7\nimmutable-custody-fixture", "utf8");
      const hash = createHash("sha256").update(bytes).digest("hex");
      await storeNativeEsignArtifact(key, bytes, env);
      await storeNativeEsignArtifact(key, bytes, env);
      await expect(storeNativeEsignArtifact(key, Buffer.concat([bytes, Buffer.from("tamper")]), env))
        .rejects.toThrow("native_esign_artifact_immutable_conflict");
      await expect(backUpNativeEsignArtifact(key, "0".repeat(64), env))
        .rejects.toThrow("native_esign_primary_hash_mismatch");
      expect(await backUpNativeEsignArtifact(key, hash, env)).toEqual({ sizeBytes: bytes.length, sha256: hash });
      await removeNativeEsignArtifact(key, env);
      await expect(readNativeEsignArtifact(key, env)).rejects.toThrow();
      expect(await restoreNativeEsignArtifact(key, hash, env)).toEqual({ sizeBytes: bytes.length, sha256: hash });
      expect(await inspectStoredNativeEsignArtifact(key, env)).toEqual({ sizeBytes: bytes.length, sha256: hash });
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(backupRoot, { recursive: true, force: true });
    }
  });

  it("reports secret-free storage capabilities and distinct plane identities", async () => {
    const root = await mkdtemp(join(tmpdir(), "eos-native-esign-capability-primary-"));
    const backupRoot = await mkdtemp(join(tmpdir(), "eos-native-esign-capability-backup-"));
    const env = { ...process.env, NODE_ENV: "test", EOS_ARTIFACT_STORAGE_PROVIDER: "filesystem", EOS_ARTIFACT_STORAGE_ROOT: root, EOS_ARTIFACT_BACKUP_STORAGE_PROVIDER: "filesystem", EOS_ARTIFACT_BACKUP_STORAGE_ROOT: backupRoot };
    try {
      expect(nativeEsignStorageDrillSchema.parse({
        reason: "Exercise synthetic storage loss and recovery.",
        acknowledgeSyntheticPrimaryLoss: true,
      })).toMatchObject({ acknowledgeSyntheticPrimaryLoss: true });
      expect(() => nativeEsignStorageDrillSchema.parse({
        reason: "Exercise synthetic storage loss and recovery.",
        acknowledgeSyntheticPrimaryLoss: false,
      })).toThrow();
      const primary = await probeNativeEsignStoragePlane(env, "primary");
      const backup = await probeNativeEsignStoragePlane(env, "backup");
      expect(primary).toMatchObject({ provider: "filesystem", reachable: true, shared: false, defaultEncryption: "not_applicable" });
      expect(backup).toMatchObject({ provider: "filesystem", reachable: true, shared: false, defaultEncryption: "not_applicable" });
      expect(primary.identitySha256).toMatch(/^[0-9a-f]{64}$/);
      expect(backup.identitySha256).toMatch(/^[0-9a-f]{64}$/);
      expect(primary.identitySha256).not.toBe(backup.identitySha256);
      expect(nativeEsignStorageIdentitySha256(env, "primary")).toBe(primary.identitySha256);
      expect(JSON.stringify({ primary, backup })).not.toContain(root);
      expect(JSON.stringify({ primary, backup })).not.toContain(backupRoot);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(backupRoot, { recursive: true, force: true });
    }
  });

  it("renders signer fields and an EOS evidence page into a completed PDF", async () => {
    const source = await PDFDocument.create();
    source.addPage([612, 792]);
    const sourcePdf = Buffer.from(await source.save());
    const completed = await renderNativeEsignCompletedPdf({
      sourcePdf,
      envelopeId: "a3cd04cc-246f-42bb-ae30-9a64b646324d",
      sourceSha256: "c".repeat(64),
      completedAt: new Date("2026-08-23T12:00:00.000Z"),
      fields: [{
        id: "8d8c1948-6c0b-49f4-af10-25b3b7f1eeda",
        roleKey: "client",
        type: "signature",
        page: 1,
        x: 0.1,
        y: 0.7,
        width: 0.4,
        height: 0.06,
        label: "Client signature",
        required: true,
      }],
      recipients: [{
        id: "recipient",
        roleKey: "client",
        signerName: "Example Signer",
        signerEmail: "signer@example.com",
        signatureName: "Example Signer",
        signatureMethod: "typed",
        signatureSha256: "d".repeat(64),
        signatureCaptureSha256: "e".repeat(64),
        signatureCaptureMimeType: "",
        signatureCaptureWidth: 0,
        signatureCaptureHeight: 0,
        consentVersion: NATIVE_ESIGN_CONSENT_VERSION,
        signedAt: new Date("2026-08-23T11:59:00.000Z"),
        fieldValues: {},
      }],
    });
    expect(validateNativeEsignPdf(completed).sha256).toMatch(/^[0-9a-f]{64}$/);
    const parsed = await PDFDocument.load(completed);
    expect(parsed.getPageCount()).toBe(2);
    expect(parsed.getTitle()).toContain("a3cd04cc");
  });

  it("requires a visible required signature field for every authored recipient role", () => {
    const signature = {
      id: "8d8c1948-6c0b-49f4-af10-25b3b7f1eeda",
      roleKey: "provider",
      type: "signature" as const,
      page: 1,
      x: 0.1,
      y: 0.7,
      width: 0.4,
      height: 0.06,
      label: "Provider signature",
      required: true,
    };
    const counterpartyText = {
      ...signature,
      id: "3f79069f-fb3e-4546-bc1f-dfaef5670712",
      roleKey: "counterparty",
      type: "text" as const,
      label: "Counterparty name",
    };
    expect(nativeEsignRolesMissingRequiredSignature([signature, counterpartyText])).toEqual(["counterparty"]);
    expect(nativeEsignRolesMissingRequiredSignature([signature, counterpartyText, {
        ...signature,
        id: "403aa5d3-eb59-4934-b11f-181d45320ab8",
        roleKey: "counterparty",
        label: "Counterparty signature",
      }])).toEqual([]);
  });

  it("paginates the sealed certificate so every supported signer has evidence space", async () => {
    const source = await PDFDocument.create();
    source.addPage([612, 792]);
    const recipients = Array.from({ length: 50 }, (_, index) => ({
      id: `recipient-${index + 1}`,
      roleKey: `signer-${index + 1}`,
      signerName: `Example Signer ${index + 1}`,
      signerEmail: `signer-${index + 1}@example.test`,
      signatureName: `Example Signer ${index + 1}`,
      signatureMethod: "typed",
      signatureSha256: createHash("sha256").update(`signature-${index + 1}`).digest("hex"),
      signatureCaptureSha256: createHash("sha256").update(`typed\0Example Signer ${index + 1}`).digest("hex"),
      signatureCaptureMimeType: "",
      signatureCaptureWidth: 0,
      signatureCaptureHeight: 0,
      consentVersion: NATIVE_ESIGN_CONSENT_VERSION,
      signedAt: new Date(`2026-08-23T11:${String(index).padStart(2, "0")}:00.000Z`),
      fieldValues: {},
    }));
    const completed = await renderNativeEsignCompletedPdf({
      sourcePdf: Buffer.from(await source.save()),
      envelopeId: "many-signer-envelope",
      sourceSha256: "c".repeat(64),
      completedAt: new Date("2026-08-23T12:00:00.000Z"),
      fields: [],
      recipients,
    });
    const parsed = await PDFDocument.load(completed);
    expect(parsed.getPageCount()).toBe(9);
    expect(validateNativeEsignPdf(completed).sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("embeds the validated private image capture for a drawn signature", async () => {
    const source = await PDFDocument.create();
    source.addPage([612, 792]);
    const capture = createSyntheticSignaturePng(320, 120);
    const completed = await renderNativeEsignCompletedPdf({
      sourcePdf: Buffer.from(await source.save()), envelopeId: "drawn-envelope", sourceSha256: "c".repeat(64), completedAt: new Date("2026-08-24T12:00:00.000Z"),
      fields: [{ id: "8d8c1948-6c0b-49f4-af10-25b3b7f1eeda", roleKey: "client", type: "signature", page: 1, x: 0.1, y: 0.7, width: 0.5, height: 0.1, label: "Drawn signature", required: true }],
      recipients: [{
        id: "recipient", roleKey: "client", signerName: "Drawn Signer", signerEmail: "drawn@example.test", signatureName: "Drawn Signer", signatureMethod: "drawn", signatureSha256: "d".repeat(64), signatureCaptureSha256: createHash("sha256").update(capture).digest("hex"), signatureCaptureMimeType: "image/png", signatureCaptureWidth: 320, signatureCaptureHeight: 120, signatureCaptureBytes: capture, consentVersion: NATIVE_ESIGN_CONSENT_VERSION, signedAt: new Date("2026-08-24T11:59:00.000Z"), fieldValues: {},
      }],
    });
    const parsed = await PDFDocument.load(completed);
    expect(parsed.getPageCount()).toBe(2);
    expect(parsed.getPage(0).node.Resources()?.get(PDFName.of("XObject"))).toBeTruthy();
    expect(validateNativeEsignPdf(completed).sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("migrates immutable document versions, one-time recipient digests, and chained audit events", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0062_add_native_esign_foundation.sql"),
      "utf8",
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_document_versions");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_envelopes");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_recipients");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS eos_esign_events");
    expect(migration).toContain("EOS native e-sign document versions and events are append-only");
    expect(migration).toContain("token_digest text NOT NULL UNIQUE");
    expect(migration).not.toMatch(/bytea|password|private[_ ]?key/i);
    const geometryMigration = readFileSync(
      resolve(process.cwd(), "migrations/0064_add_native_esign_page_geometry.sql"),
      "utf8",
    );
    expect(geometryMigration).toContain("ADD COLUMN IF NOT EXISTS page_count");
    expect(geometryMigration).toContain("page_count BETWEEN 1 AND 2000");
    const captureMigration = readFileSync(resolve(process.cwd(), "migrations/0067_add_native_esign_signature_captures.sql"), "utf8");
    expect(captureMigration).toContain("signature_capture_storage_key");
    expect(captureMigration).toContain("Native e-sign signed recipient evidence is immutable");
    expect(captureMigration).not.toMatch(/signature_capture_(?:bytes|base64)/i);
  });
});
