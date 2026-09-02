import { createHash, randomBytes, randomUUID } from "node:crypto";
import express, { type Express, type Request, type Response } from "express";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { ZodError } from "zod";
import {
  companies,
  portfolios,
  eosAuditRecords,
  eosEsignArtifacts,
  eosEsignClauses,
  eosEsignClauseVersions,
  eosEsignCounterparties,
  eosEsignDocumentVersions,
  eosEsignDocumentComparisons,
  eosEsignDeliveryAttempts,
  eosEsignCompletionDeliveries,
  eosEsignCompletionDeliveryAttempts,
  eosEsignEnvelopes,
  eosEsignEvents,
  eosEsignIntegrityChecks,
  eosEsignEvidencePromotions,
  eosEsignNegotiations,
  eosEsignNegotiationEntries,
  eosEsignReminderSchedules,
  eosEsignBatches,
  eosEsignBatchItems,
  eosEsignObligationPromotions,
  eosEsignObligationReviews,
  eosEsignContractPlans,
  eosEsignContractPlanEvents,
  eosEsignContractNotices,
  eosEsignContractNoticeAttempts,
  eosEsignJurisdictionPacks,
  eosEsignJurisdictionPackApplicabilityDecisions,
  eosEsignPortfolioTemplateProposals,
  eosEsignPortfolioTemplateAdoptions,
  eosEsignRecipients,
  eosEsignTemplates,
  eosEsignTemplateVersions,
  eosEsignWebhookAttempts,
  eosEsignWebhookDeliveries,
  eosEsignWebhookSubscriptions,
  eosEvidence,
  eosRisksControls,
  eosSeats,
  eosWorkPackets,
  eosRecoveryAgreementAuthorities,
  eosRecoveryAgreementInstances,
} from "@shared/schema";
import { allowedSurfacesFor } from "@shared/eos-runtime";
import {
  NATIVE_ESIGN_CONSENT_VERSION,
  NATIVE_ESIGN_MAX_DOCUMENT_BYTES,
  nativeEsignRecipientRoutingState,
  nativeEsignRolesMissingRequiredSignature,
  nativeEsignEnvelopeState,
  nativeEsignConsentSchema,
  nativeEsignIssueSchema,
  nativeEsignDeclineSchema,
  nativeEsignDocumentRegistrationSchema,
  nativeEsignEnvelopeCreationSchema,
  nativeEsignEnvelopeDraftUpdateSchema,
  nativeEsignFieldSchema,
  nativeEsignRecipientCorrectionSchema,
  nativeEsignOtpVerifySchema,
  nativeEsignReplaySchema,
  nativeEsignIntegrityCheckSchema,
  nativeEsignRetentionPolicySchema,
  nativeEsignStorageDrillSchema,
  nativeEsignLegalHoldSchema,
  nativeEsignLegalHoldReleaseSchema,
  nativeEsignDeletionRequestSchema,
  nativeEsignDeletionDecisionSchema,
  nativeEsignCustodyExecutionSchema,
  nativeEsignSecretRotationSchema,
  nativeEsignSignatureSchema,
  nativeEsignTokenSchema,
  nativeEsignVoidSchema,
  nativeEsignClauseSchema,
  nativeEsignClauseVersionSchema,
  nativeEsignCounterpartySchema,
  nativeEsignCounterpartyUpdateSchema,
  nativeEsignEnvelopeListSchema,
  nativeEsignEvidencePromotionSchema,
  nativeEsignLibraryApprovalSchema,
  nativeEsignTemplateGenerationSchema,
  nativeEsignTemplateRecipientSchema,
  nativeEsignTemplateSchema,
  nativeEsignTemplateVariableSchema,
  nativeEsignTemplateVersionSchema,
  nativeEsignWebhookSubscriptionSchema,
  nativeEsignWebhookSubscriptionUpdateSchema,
  nativeEsignCloneSchema,
  nativeEsignNegotiationOpenSchema,
  nativeEsignNegotiationEntrySchema,
  nativeEsignNegotiationResolutionSchema,
  nativeEsignDocumentRevisionSchema,
  nativeEsignGeneratedRevisionSchema,
  nativeEsignReplacementSchema,
  nativeEsignReminderScheduleSchema,
  nativeEsignReminderScheduleUpdateSchema,
  nativeEsignBatchSchema,
  nativeEsignObligationPromotionSchema,
  nativeEsignObligationReviewSchema,
  nativeEsignContractPlanSchema,
  nativeEsignContractRenewalDecisionSchema,
  nativeEsignContractNoticeSchema,
  nativeEsignContractNoticeApprovalSchema,
  nativeEsignContractNoticeDeliverySchema,
  nativeEsignContractNoticeReconciliationSchema,
  nativeEsignPortfolioTemplateProposalSchema,
  nativeEsignPortfolioTemplateAdoptionSchema,
  nativeEsignPortfolioTemplateWithdrawalSchema,
  nativeEsignJurisdictionPackSchema,
  nativeEsignJurisdictionPackPublicationSchema,
  nativeEsignJurisdictionApplicabilityDecisionSchema,
  nativeEsignJurisdictionPackWithdrawalSchema,
} from "@shared/native-esign";
import { db } from "../db";
import { fixedWindowRateLimit } from "../middleware/rate-limit";
import {
  nativeEsignAuditStorageKey,
  nativeEsignFinalStorageKey,
  nativeEsignSignatureStorageKey,
  nativeEsignSourceStorageKey,
  inspectNativeEsignPdf,
  readNativeEsignArtifact,
  removeNativeEsignArtifact,
  storeNativeEsignArtifact,
  validateNativeEsignPdf,
} from "../artifacts/native-esign-files";
import {
  createNativeEsignSecret,
  nativeEsignTokenDigest,
  nativeEsignUrl,
} from "../native-esign-token";
import {
  nativeEsignFingerprint,
  nativeEsignSignatureSha256,
} from "../esign/audit-chain";
import { renderNativeEsignCompletedPdf } from "../esign/pdf-renderer";
import { classifyNativeEsignDeliveryFailure, nativeContractNoticeEmail, nativeEsignDeliveryEmail } from "../esign/delivery";
import { appendNativeEsignAuditEvent as appendAuditEvent } from "../esign/events";
import { createNativeEsignOtp, nativeEsignOtpDigest, nativeEsignOtpEmail, nativeEsignOtpMatches } from "../esign/otp";
import { parseNativeEsignWebhookEndpoint } from "../esign/webhook-egress";
import { typedSignatureCaptureSha256, validateNativeEsignSignatureCapture } from "../esign/signature-capture";
import { nativeContractContentSha256, renderNativeContractPdf, renderNativeContractText } from "../esign/template-generation";
import { compareNativeContractText } from "../esign/contract-diff";
import { publicNativeEsignIntegrityProjection, recordNativeEsignIntegrityCheck, verifyNativeEsignEnvelopeIntegrity } from "../esign/integrity";
import {
  backUpEnvelopeCustody,
  configureRetentionPolicy,
  cancelEnvelopeDeletion,
  custodySummary,
  decideEnvelopeDeletion,
  ensureEnvelopeCustodyInventory,
  executeEnvelopeDeletion,
  placeLegalHold,
  registerNativeEsignArtifact,
  releaseLegalHold,
  requestEnvelopeDeletion,
  restoreCustodyArtifact,
  verifyEnvelopeCustody,
} from "../esign/custody";
import { listNativeEsignStorageDrills, runNativeEsignStorageDrill } from "../esign/storage-drill";
import { writeLog } from "../observability/logger";
import { encryptCredential } from "../security/credential-encryption";
import { scanBufferForMalware } from "../security/malware-scanner";
import * as gmail from "../integrations/gmail";
import { deliverNativeEsignRecipient } from "../esign/recipient-delivery";
import { EosRouteError, authorizeAction, companyAccess, mayAccessClassification, visibleSeatIds } from "./eos-runtime";
import { canTransitionRiskControl } from "@shared/eos-runtime";

class NativeEsignError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function requireCleanUploadedArtifact(
  bytes: Buffer,
  mimeType: string,
  sha256: string,
): Promise<void> {
  const scan = await scanBufferForMalware(bytes, {
    mimeType,
    sizeBytes: bytes.length,
    sha256,
  });
  if (scan.state === "infected")
    throw new NativeEsignError(
      422,
      "native_esign_upload_infected",
      "EOS rejected the upload because the malware scanner detected unsafe content.",
    );
  if (scan.state !== "clean")
    throw new NativeEsignError(
      503,
      "native_esign_upload_scan_unavailable",
      "EOS could not complete the required malware scan. Nothing was stored; retry later.",
    );
}

const publicEsignRateLimit = fixedWindowRateLimit({
  limit: 60,
  windowMs: 60_000,
  namespace: "native-esign-public",
});

function publicHeaders(res: Response): void {
  res.setHeader("Cache-Control", "no-store, private, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
}

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof NativeEsignError)
        return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof EosRouteError)
        return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof ZodError)
        return res.status(400).json({ code: "native_esign_input_invalid", message: error.issues[0]?.message || "Signing input is invalid." });
      next(error);
    }
  };
}

function custodyRouteError(error: unknown): NativeEsignError {
  const code = error instanceof Error ? error.message.split(":")[0] : "native_esign_custody_failed";
  const conflictCodes = new Set([
    "native_esign_retention_policy_changed", "native_esign_legal_hold_changed",
    "native_esign_deletion_request_changed", "native_esign_deletion_two_person_required",
    "native_esign_deletion_executor_separation_required", "native_esign_restore_unavailable",
    "native_esign_deletion_completed_envelope_required", "native_esign_storage_drill_running",
  ]);
  if (code === "native_esign_backup_not_configured") return new NativeEsignError(409, code, "Configure a separate private backup storage plane before running evidence backup.");
  if (code === "native_esign_envelope_not_found") return new NativeEsignError(404, code, "The tenant-scoped envelope is unavailable.");
  if (code === "native_esign_deletion_blocked") return new NativeEsignError(409, code, "Deletion is blocked by retention authority or an active legal hold.");
  if (conflictCodes.has(code)) return new NativeEsignError(409, code, "The custody record changed or the required separation of duties was not met. Refresh and retry with a different authorized operator where required.");
  return new NativeEsignError(503, "native_esign_custody_failed", "The evidence custody action could not be completed safely.");
}

async function nativeEsignAccess(req: Request, companyId: number, authorityClass: "view" | "sign", actionKey: string) {
  if (!Number.isInteger(companyId) || companyId <= 0)
    throw new NativeEsignError(400, "invalid_company", "Company id must be a positive integer.");
  const access = await companyAccess(req);
  if (access.company.id !== companyId)
    throw new NativeEsignError(404, "company_not_found", "Company not found in the active principal scope.");
  if (!allowedSurfacesFor(access.role).includes("systems"))
    throw new NativeEsignError(403, "native_esign_scope_denied", "Native signing is outside this role's compiled Systems workspace.");
  const policy = await authorizeAction(req, access, {
    authorityClass,
    resource: "native_esign",
    actionKey,
    purpose: authorityClass === "view" ? "inspect_native_signing_records" : "operate_native_signing",
    classification: "confidential",
    consequence: authorityClass === "sign" ? "material" : "routine",
  });
  return {
    access,
    policy,
    isFounder: access.isCompanyOwner && access.role === "founder",
  };
}

const requireCompanyReader = (req: Request, companyId: number, actionKey = "native_esign.read") =>
  nativeEsignAccess(req, companyId, "view", actionKey);

const requireCompanyOperator = (req: Request, companyId: number, actionKey = "native_esign.operate") =>
  nativeEsignAccess(req, companyId, "sign", actionKey);

async function requireVisibleVerifiedEvidence(companyId: number, evidenceId: string, access: Awaited<ReturnType<typeof companyAccess>>) {
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  const [row] = await db.select({ evidence: eosEvidence, packet: eosWorkPackets }).from(eosEvidence)
    .innerJoin(eosWorkPackets, eq(eosWorkPackets.id, eosEvidence.workPacketId))
    .where(and(eq(eosEvidence.id, evidenceId), eq(eosEvidence.companyId, companyId), eq(eosWorkPackets.companyId, companyId))).limit(1);
  if (!row || row.evidence.verificationState !== "verified" || !mayAccessClassification(access, row.evidence.dataClassification) || !mayAccessClassification(access, row.packet.classification) || (!access.isOwner && (!row.packet.accountableSeatId || !visible.has(row.packet.accountableSeatId))))
    throw new NativeEsignError(409, "native_esign_review_evidence_invalid", "Review Evidence must be verified and visible in this company, hierarchy, and classification scope.");
  return row.evidence;
}

const qualifiedCounselEvidenceTypes = new Set(["counsel_review", "legal_review", "legal_opinion"]);
function requireQualifiedCounselEvidence(evidence: typeof eosEvidence.$inferSelect): void {
  if (!qualifiedCounselEvidenceTypes.has(evidence.evidenceType))
    throw new NativeEsignError(409, "native_esign_qualified_counsel_evidence_required", "Publishing or applying a jurisdiction pack requires verified, tenant-local counsel review Evidence. EOS records the reviewer claim but does not verify professional credentials.");
}

function requireCurrentJurisdictionPack(pack: typeof eosEsignJurisdictionPacks.$inferSelect): void {
  const today = new Date().toISOString().slice(0, 10);
  if (pack.effectiveFrom > today || pack.nextReviewAt <= today)
    throw new NativeEsignError(409, "native_esign_jurisdiction_pack_review_required", "The jurisdiction pack is not yet effective or its next counsel-review date has arrived. Prepare and review a new version before relying on it.");
}

function flattenPortfolioTemplateClauses(bodyTemplate: string, clauses: Array<{ clauseKey: string; bodyText: string }>): string {
  let body = bodyTemplate;
  for (const clause of clauses) body = body.replaceAll(`{{clause.${clause.clauseKey}}}`, clause.bodyText);
  if (/\{\{clause\.[a-z0-9._-]+\}\}/i.test(body)) throw new NativeEsignError(409, "native_esign_portfolio_proposal_clause_unresolved", "Every source clause must be available before publishing a portfolio proposal.");
  return body;
}

function assertExactRecipientRoles(
  fields: Array<typeof nativeEsignFieldSchema._output>,
  recipients: Array<{ roleKey: string }>,
): void {
  const fieldRoles = new Set(fields.map((field) => field.roleKey));
  const recipientRoles = new Set(recipients.map((recipient) => recipient.roleKey));
  const exact = fieldRoles.size === recipientRoles.size &&
    Array.from(fieldRoles).every((roleKey) => recipientRoles.has(roleKey));
  if (!exact)
    throw new NativeEsignError(409, "native_esign_recipient_role_mismatch", "Envelope recipients must match the document's authored roles exactly.");
  const missingSignatureRoles = nativeEsignRolesMissingRequiredSignature(fields);
  if (missingSignatureRoles.length)
    throw new NativeEsignError(409, "native_esign_recipient_signature_field_missing", `Every recipient role requires a visible, required signature field. Missing: ${missingSignatureRoles.join(", ")}.`);
}

function nativeEsignComparisonProjection(comparison: typeof eosEsignDocumentComparisons.$inferSelect | undefined) {
  if (!comparison) return null;
  const structured = comparison.structuredDiff && typeof comparison.structuredDiff === "object" && !Array.isArray(comparison.structuredDiff)
    ? comparison.structuredDiff as Record<string, unknown> : {};
  return {
    comparisonType: comparison.comparisonType,
    comparisonSha256: comparison.comparisonSha256,
    revisionSummary: comparison.revisionSummary,
    declaredChanges: Array.isArray(comparison.declaredChanges) ? comparison.declaredChanges.map(String) : [],
    sourceSha256: comparison.sourceSha256,
    targetSha256: comparison.targetSha256,
    sourceTextSha256: comparison.sourceTextSha256,
    targetTextSha256: comparison.targetTextSha256,
    diffStats: comparison.diffStats,
    structuredDiff: comparison.comparisonType === "generated_text" ? {
      schemaVersion: structured.schemaVersion,
      granularity: structured.granularity,
      exact: structured.exact,
      algorithm: structured.algorithm,
      operations: Array.isArray(structured.operations) ? structured.operations : [],
    } : {},
  };
}

function recipientRoutingState(
  envelope: Pick<typeof eosEsignEnvelopes.$inferSelect, "routingMode">,
  recipients: Array<Pick<typeof eosEsignRecipients.$inferSelect, "routingOrder" | "state">>,
  recipient: Pick<typeof eosEsignRecipients.$inferSelect, "routingOrder" | "state">,
) {
  return nativeEsignRecipientRoutingState({
    routingMode: envelope.routingMode as "sequential" | "parallel",
    recipients,
    recipient,
  });
}

function assertRecipientRoutingActive(
  envelope: Pick<typeof eosEsignEnvelopes.$inferSelect, "routingMode">,
  recipients: Array<Pick<typeof eosEsignRecipients.$inferSelect, "routingOrder" | "state">>,
  recipient: Pick<typeof eosEsignRecipients.$inferSelect, "routingOrder" | "state">,
): void {
  if (recipientRoutingState(envelope, recipients, recipient) !== "active")
    throw new NativeEsignError(409, "native_esign_routing_wait", "An earlier recipient must complete before this routing stage can receive links, email, or reminders.");
}

async function renderGovernedTemplateVersion(
  companyId: number,
  version: typeof eosEsignTemplateVersions.$inferSelect,
  values: Record<string, string>,
) {
  const clauseIds = Array.isArray(version.clauseVersionIds) ? version.clauseVersionIds.map(String) : [];
  const clauseRows = clauseIds.length ? await db.select({ version: eosEsignClauseVersions, clause: eosEsignClauses })
    .from(eosEsignClauseVersions)
    .innerJoin(eosEsignClauses, eq(eosEsignClauses.id, eosEsignClauseVersions.clauseId))
    .where(and(eq(eosEsignClauseVersions.companyId, companyId), inArray(eosEsignClauseVersions.id, clauseIds))) : [];
  if (clauseRows.length !== clauseIds.length)
    throw new NativeEsignError(409, "native_esign_template_clause_unavailable", "A snapshotted clause version is no longer available in this tenant.");
  const variables = nativeEsignTemplateVariableSchema.array().parse(version.variableSchema);
  const recipients = nativeEsignTemplateRecipientSchema.array().parse(version.recipientSchema);
  let rendered;
  try {
    rendered = renderNativeContractText({
      titleTemplate: version.titleTemplate,
      bodyTemplate: version.bodyTemplate,
      variableSchema: variables,
      values,
      clauses: clauseRows.map(({ version: clauseVersion, clause }) => ({ clauseKey: clause.clauseKey, versionId: clauseVersion.id, bodyText: clauseVersion.bodyText, bodySha256: clauseVersion.bodySha256 })),
    });
  } catch (error) {
    throw new NativeEsignError(400, "native_esign_template_render_invalid", error instanceof Error ? error.message.replace(/^native_esign_[^:]+:/, "") : "Template variables could not be rendered.");
  }
  return { rendered, recipients, clauseRows };
}

async function reconstructGeneratedDocumentText(companyId: number, document: typeof eosEsignDocumentVersions.$inferSelect) {
  if (!document.templateVersionId)
    throw new NativeEsignError(409, "native_esign_semantic_source_unavailable", "Semantic comparison is available only for agreements generated from a governed EOS template. Use the reviewed PDF revision path for uploaded documents.");
  const version = await db.query.eosEsignTemplateVersions.findFirst({ where: and(eq(eosEsignTemplateVersions.id, document.templateVersionId), eq(eosEsignTemplateVersions.companyId, companyId)) });
  if (!version) throw new NativeEsignError(409, "native_esign_semantic_source_unavailable", "The source template snapshot is unavailable. Use the reviewed PDF revision path.");
  const snapshot = document.generationSnapshot && typeof document.generationSnapshot === "object" && !Array.isArray(document.generationSnapshot) ? document.generationSnapshot as Record<string, unknown> : {};
  const values = snapshot.values && typeof snapshot.values === "object" && !Array.isArray(snapshot.values)
    ? Object.fromEntries(Object.entries(snapshot.values as Record<string, unknown>).map(([key, value]) => [key, String(value)]))
    : null;
  if (!values || snapshot.templateContentSha256 !== version.contentSha256)
    throw new NativeEsignError(409, "native_esign_semantic_source_unavailable", "The source generation receipt cannot be verified against its immutable template. Use the reviewed PDF revision path.");
  const result = await renderGovernedTemplateVersion(companyId, version, values);
  const expectedClauses = Array.isArray(snapshot.clauses) ? snapshot.clauses : [];
  const actualClauses = (result.rendered.snapshot.clauses as Array<{ versionId: string; bodySha256: string }> | undefined) || [];
  const clausesMatch = expectedClauses.length === actualClauses.length && actualClauses.every((actual) => expectedClauses.some((item) => {
    const expected = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return expected.versionId === actual.versionId && expected.bodySha256 === actual.bodySha256;
  }));
  if (!clausesMatch || snapshot.renderedSha256 !== result.rendered.snapshot.renderedSha256)
    throw new NativeEsignError(409, "native_esign_semantic_source_unavailable", "The source generation receipt failed its content verification. Use the reviewed PDF revision path.");
  return { ...result, version };
}

function validatedWebhookEndpoint(value: string): string {
  try { return parseNativeEsignWebhookEndpoint(value).toString(); }
  catch (error) { throw new NativeEsignError(400, "native_esign_webhook_endpoint_invalid", error instanceof Error ? error.message : "Webhook endpoint is invalid."); }
}

async function resolvePublicRecipient(req: Request) {
  const token = nativeEsignTokenSchema.parse(req.params.token);
  const [context] = await db.select({
    recipient: eosEsignRecipients,
    envelope: eosEsignEnvelopes,
    document: eosEsignDocumentVersions,
  }).from(eosEsignRecipients)
    .innerJoin(eosEsignEnvelopes, eq(eosEsignEnvelopes.id, eosEsignRecipients.envelopeId))
    .innerJoin(eosEsignDocumentVersions, eq(eosEsignDocumentVersions.id, eosEsignEnvelopes.documentVersionId))
    .where(eq(eosEsignRecipients.tokenDigest, nativeEsignTokenDigest(token))).limit(1);
  const now = new Date();
  if (!context || context.recipient.tokenUsedAt || context.recipient.tokenExpiresAt <= now)
    throw new NativeEsignError(404, "native_esign_link_unavailable", "This signing link is invalid, expired, or has already been used.");
  if (!["issued", "in_progress"].includes(context.envelope.state) || context.envelope.expiresAt <= now)
    throw new NativeEsignError(410, "native_esign_envelope_unavailable", "This envelope is no longer available for signing.");
  if (["signed", "declined", "expired"].includes(context.recipient.state))
    throw new NativeEsignError(410, "native_esign_recipient_terminal", "This recipient action is already complete.");
  const recipients = await db.select().from(eosEsignRecipients).where(eq(eosEsignRecipients.envelopeId, context.envelope.id));
  if (recipientRoutingState(context.envelope, recipients, context.recipient) !== "active")
    throw new NativeEsignError(409, "native_esign_routing_wait", "An earlier recipient must complete before this link becomes active.");
  return { ...context, recipients };
}

async function resolveCompletedAccess(req: Request) {
  const token = nativeEsignTokenSchema.parse(req.params.token);
  const [context] = await db.select({
    recipient: eosEsignRecipients,
    envelope: eosEsignEnvelopes,
    document: eosEsignDocumentVersions,
  }).from(eosEsignRecipients)
    .innerJoin(eosEsignEnvelopes, eq(eosEsignEnvelopes.id, eosEsignRecipients.envelopeId))
    .innerJoin(eosEsignDocumentVersions, eq(eosEsignDocumentVersions.id, eosEsignEnvelopes.documentVersionId))
    .where(eq(eosEsignRecipients.tokenDigest, nativeEsignTokenDigest(token))).limit(1);
  if (!context || context.recipient.state !== "signed" || context.envelope.state !== "completed" || !context.envelope.finalStorageKey || context.recipient.tokenExpiresAt <= new Date())
    throw new NativeEsignError(404, "native_esign_completed_document_unavailable", "The completed document is unavailable for this signing link.");
  return context;
}

async function resolveCompletionReceiptAccess(rawToken: string) {
  const token = nativeEsignTokenSchema.parse(rawToken);
  const [context] = await db.select({
    recipient: eosEsignRecipients,
    envelope: eosEsignEnvelopes,
    document: eosEsignDocumentVersions,
  }).from(eosEsignRecipients)
    .innerJoin(eosEsignEnvelopes, eq(eosEsignEnvelopes.id, eosEsignRecipients.envelopeId))
    .innerJoin(eosEsignDocumentVersions, eq(eosEsignDocumentVersions.id, eosEsignEnvelopes.documentVersionId))
    .where(eq(eosEsignRecipients.completionTokenDigest, nativeEsignTokenDigest(token))).limit(1);
  if (!context || context.recipient.state !== "signed" || context.envelope.state !== "completed" || !context.envelope.finalStorageKey)
    throw new NativeEsignError(404, "native_esign_completion_receipt_unavailable", "This completion receipt is unavailable or has been replaced.");
  return context;
}

async function markOpened(context: Awaited<ReturnType<typeof resolvePublicRecipient>>) {
  if (!["pending", "sent"].includes(context.recipient.state)) return;
  const now = new Date();
  await db.transaction(async (tx) => {
    const [updated] = await tx.update(eosEsignRecipients).set({
      state: "opened", openedAt: context.recipient.openedAt || now,
      version: context.recipient.version + 1, updatedAt: now,
    }).where(and(eq(eosEsignRecipients.id, context.recipient.id), eq(eosEsignRecipients.version, context.recipient.version), inArray(eosEsignRecipients.state, ["pending", "sent"]))).returning();
    if (!updated) return;
    await tx.update(eosEsignEnvelopes).set({ state: "in_progress", version: context.envelope.version + 1, updatedAt: now })
      .where(and(eq(eosEsignEnvelopes.id, context.envelope.id), eq(eosEsignEnvelopes.version, context.envelope.version), eq(eosEsignEnvelopes.state, "issued")));
    await appendAuditEvent(tx, { companyId: context.envelope.companyId, envelopeId: context.envelope.id, recipientId: context.recipient.id, eventType: "recipient_opened", actorType: "signer", actorReference: context.recipient.id, eventProjection: {} });
  });
}

function validatedRecipientFieldValues(
  fields: Array<typeof nativeEsignFieldSchema._output>,
  roleKey: string,
  submitted: Record<string, string | boolean>,
): Record<string, string | boolean> {
  const editable = fields.filter((field) => field.roleKey === roleKey && ["text", "checkbox"].includes(field.type));
  const allowed = new Set(editable.map((field) => field.id));
  if (Object.keys(submitted).some((fieldId) => !allowed.has(fieldId)))
    throw new NativeEsignError(400, "native_esign_field_value_unexpected", "The signature contains a field that is not assigned to this recipient.");
  const sanitized: Record<string, string | boolean> = {};
  for (const field of editable) {
    const value = submitted[field.id];
    if (field.type === "checkbox") {
      if (value !== undefined && typeof value !== "boolean")
        throw new NativeEsignError(400, "native_esign_field_value_invalid", `${field.label} must be a checkbox value.`);
      if (field.required && value !== true)
        throw new NativeEsignError(400, "native_esign_required_field_missing", `${field.label} must be accepted before signing.`);
      if (value !== undefined) sanitized[field.id] = value;
      continue;
    }
    if (value !== undefined && typeof value !== "string")
      throw new NativeEsignError(400, "native_esign_field_value_invalid", `${field.label} must be text.`);
    const text = typeof value === "string" ? value.trim() : "";
    if (field.required && !text)
      throw new NativeEsignError(400, "native_esign_required_field_missing", `${field.label} is required before signing.`);
    if (text) sanitized[field.id] = text;
  }
  return sanitized;
}

async function finalizeEnvelope(envelopeId: string) {
  const [context] = await db.select({ envelope: eosEsignEnvelopes, document: eosEsignDocumentVersions })
    .from(eosEsignEnvelopes).innerJoin(eosEsignDocumentVersions, eq(eosEsignDocumentVersions.id, eosEsignEnvelopes.documentVersionId))
    .where(eq(eosEsignEnvelopes.id, envelopeId)).limit(1);
  if (!context || context.envelope.state === "completed") return null;
  const recipients = await db.select().from(eosEsignRecipients).where(eq(eosEsignRecipients.envelopeId, envelopeId));
  if (!recipients.length || recipients.some((recipient) => recipient.state !== "signed" || !recipient.signedAt)) return null;
  const completedAt = new Date();
  const sourcePdf = await readNativeEsignArtifact(context.document.sourceStorageKey);
  const fields = nativeEsignFieldSchema.array().parse(context.document.fieldSchema);
  const renderedRecipients = await Promise.all(recipients.map(async (recipient) => {
    let signatureCaptureBytes: Buffer | undefined;
    if (["drawn", "uploaded"].includes(recipient.signatureMethod)) {
      if (!recipient.signatureCaptureStorageKey || !["image/png", "image/jpeg"].includes(recipient.signatureCaptureMimeType))
        throw new Error("native_esign_capture_metadata_missing");
      const stored = await readNativeEsignArtifact(recipient.signatureCaptureStorageKey);
      const validated = await validateNativeEsignSignatureCapture({
        method: recipient.signatureMethod as "drawn" | "uploaded",
        mimeType: recipient.signatureCaptureMimeType as "image/png" | "image/jpeg",
        base64: stored.toString("base64"),
        claimedSha256: recipient.signatureCaptureSha256,
      });
      if (validated.sizeBytes !== recipient.signatureCaptureSizeBytes || validated.width !== recipient.signatureCaptureWidth || validated.height !== recipient.signatureCaptureHeight)
        throw new Error("native_esign_capture_metadata_mismatch");
      signatureCaptureBytes = stored;
    }
    return {
      id: recipient.id, roleKey: recipient.roleKey, signerName: recipient.signerName,
      signerEmail: recipient.signerEmail, signatureName: recipient.signatureName,
      signatureMethod: recipient.signatureMethod, signatureSha256: recipient.signatureSha256,
      signatureCaptureSha256: recipient.signatureCaptureSha256,
      signatureCaptureMimeType: recipient.signatureCaptureMimeType,
      signatureCaptureWidth: recipient.signatureCaptureWidth,
      signatureCaptureHeight: recipient.signatureCaptureHeight,
      signatureCaptureBytes,
      consentVersion: recipient.consentVersion, signedAt: recipient.signedAt!,
      fieldValues: recipient.fieldValues as Record<string, string | boolean>,
    };
  }));
  const completedPdf = await renderNativeEsignCompletedPdf({
    sourcePdf, envelopeId, sourceSha256: context.document.sourceSha256, completedAt, fields,
    recipients: renderedRecipients,
  });
  const finalMetadata = validateNativeEsignPdf(completedPdf);
  const finalStorageKey = nativeEsignFinalStorageKey(context.envelope.companyId, envelopeId, finalMetadata.sha256);
  const sealed = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM eos_esign_envelopes WHERE id = ${envelopeId} FOR UPDATE`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${envelopeId}))`);
    const current = await tx.query.eosEsignEnvelopes.findFirst({ where: eq(eosEsignEnvelopes.id, envelopeId) });
    if (!current || current.state === "completed") return false;
    if (!["issued", "in_progress", "recovery_required"].includes(current.state))
      throw new NativeEsignError(409, "native_esign_completion_state_invalid", "The envelope is not eligible for completion.");
    const currentRecipients = await tx.select().from(eosEsignRecipients).where(eq(eosEsignRecipients.envelopeId, envelopeId));
    if (!currentRecipients.length || currentRecipients.some((recipient) => recipient.state !== "signed" || !recipient.signedAt))
      throw new NativeEsignError(409, "native_esign_completion_recipients_incomplete", "Every recipient must sign before the envelope can be completed.");
    if (currentRecipients.some((recipient) => {
      const rendered = recipients.find((candidate) => candidate.id === recipient.id);
      return !rendered || rendered.version !== recipient.version || rendered.signatureSha256 !== recipient.signatureSha256;
    }))
      throw new NativeEsignError(409, "native_esign_completion_race", "Recipient evidence changed during completion. Retry sealing the envelope.");
    await appendAuditEvent(tx, { companyId: current.companyId, envelopeId, eventType: "envelope_completed", actorType: "system", occurredAt: completedAt, eventProjection: { sourceSha256: context.document.sourceSha256, finalSha256: finalMetadata.sha256 } });
    const events = await tx.select().from(eosEsignEvents).where(eq(eosEsignEvents.envelopeId, envelopeId)).orderBy(eosEsignEvents.sequence);
    const audit = Buffer.from(JSON.stringify({
      schemaVersion: "eos-native-esign-audit.v1", envelopeId, documentVersionId: context.document.id,
      sourceSha256: context.document.sourceSha256, finalSha256: finalMetadata.sha256,
      completedAt: completedAt.toISOString(),
      recipients: currentRecipients.map((recipient) => ({ id: recipient.id, roleKey: recipient.roleKey, signerName: recipient.signerName, signerEmail: recipient.signerEmail, consentVersion: recipient.consentVersion, comparisonAcknowledgementSha256: recipient.comparisonAcknowledgementSha256 || null, comparisonAcknowledgedAt: recipient.comparisonAcknowledgedAt?.toISOString() || null, signatureMethod: recipient.signatureMethod, signatureSha256: recipient.signatureSha256, signatureCaptureSha256: recipient.signatureCaptureSha256, signatureCaptureMimeType: recipient.signatureCaptureMimeType, signatureCaptureSizeBytes: recipient.signatureCaptureSizeBytes, signatureCaptureWidth: recipient.signatureCaptureWidth, signatureCaptureHeight: recipient.signatureCaptureHeight, signedAt: recipient.signedAt?.toISOString() })),
      events: events.map(({ id, sequence, eventType, actorType, actorReference, eventProjection, previousEventSha256, eventSha256, occurredAt }) => ({ id, sequence, eventType, actorType, actorReference, eventProjection, previousEventSha256, eventSha256, occurredAt: occurredAt.toISOString() })),
    }, null, 2), "utf8");
    const auditSha256 = createHash("sha256").update(audit).digest("hex");
    const auditStorageKey = nativeEsignAuditStorageKey(current.companyId, envelopeId);
    await storeNativeEsignArtifact(finalStorageKey, completedPdf);
    await storeNativeEsignArtifact(auditStorageKey, audit);
    await registerNativeEsignArtifact(tx, {
      companyId: current.companyId, envelopeId, documentVersionId: context.document.id,
      artifactKind: "completed_pdf", storageKey: finalStorageKey, sha256: finalMetadata.sha256,
      sizeBytes: completedPdf.length, mimeType: "application/pdf", createdAt: completedAt,
    });
    await registerNativeEsignArtifact(tx, {
      companyId: current.companyId, envelopeId, documentVersionId: context.document.id,
      artifactKind: "audit_json", storageKey: auditStorageKey, sha256: auditSha256,
      sizeBytes: audit.length, mimeType: "application/json", createdAt: completedAt,
    });
    const [completed] = await tx.update(eosEsignEnvelopes).set({
      state: "completed", completedAt, finalStorageKey, finalSha256: finalMetadata.sha256,
      auditStorageKey, auditSha256, version: current.version + 1, updatedAt: completedAt,
    }).where(and(eq(eosEsignEnvelopes.id, envelopeId), eq(eosEsignEnvelopes.version, current.version), inArray(eosEsignEnvelopes.state, ["issued", "in_progress", "recovery_required"]))).returning();
    if (!completed)
      throw new NativeEsignError(409, "native_esign_completion_race", "Envelope state changed during completion.");
    for (const recipient of currentRecipients) {
      const completionSecret = createNativeEsignSecret();
      const deliveryId = randomUUID();
      await tx.update(eosEsignRecipients).set({
        completionTokenDigest: nativeEsignTokenDigest(completionSecret),
        completionDeliveryState: "pending", completionDeliveryAttemptCount: 0,
        version: recipient.version + 1, updatedAt: completedAt,
      }).where(and(eq(eosEsignRecipients.id, recipient.id), eq(eosEsignRecipients.version, recipient.version)));
      await tx.insert(eosEsignCompletionDeliveries).values({
        id: deliveryId, companyId: current.companyId, envelopeId,
        recipientId: recipient.id, requestedByUserId: current.createdByUserId,
        tokenCiphertext: encryptCredential(completionSecret), state: "pending",
        attemptCount: 0, replayCount: 0, nextAttemptAt: completedAt,
        createdAt: completedAt, updatedAt: completedAt,
      });
      await appendAuditEvent(tx, {
        companyId: current.companyId, envelopeId, recipientId: recipient.id,
        eventType: "completion_delivery_prepared", actorType: "system", occurredAt: completedAt,
        eventProjection: { deliveryId, channel: "gmail" },
      });
    }
    if (current.recoveryAgreementInstanceId) {
      await tx.update(eosRecoveryAgreementInstances).set({ state: "signed", providerEnvelopeReference: envelopeId, nativeEnvelopeId: envelopeId, version: sql`${eosRecoveryAgreementInstances.version} + 1`, updatedAt: completedAt })
        .where(and(eq(eosRecoveryAgreementInstances.id, current.recoveryAgreementInstanceId), eq(eosRecoveryAgreementInstances.companyId, current.companyId)));
    }
    return true;
  });
  if (!sealed) return null;
  try {
    const report = await verifyNativeEsignEnvelopeIntegrity(envelopeId);
    await recordNativeEsignIntegrityCheck({
      report, companyId: context.envelope.companyId, triggerType: "completion",
      reason: "Automatic verification after completed-envelope sealing.",
    });
    writeLog(report.state === "passed" ? "info" : "error", "native_esign_completion_integrity_checked", {
      companyId: context.envelope.companyId, envelopeId, state: report.state,
      failureCodes: report.failureCodes, eventCount: report.eventCount, captureCount: report.captureCount,
    });
    return report;
  } catch (error) {
    writeLog("error", "native_esign_completion_integrity_check_unavailable", {
      companyId: context.envelope.companyId, envelopeId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return null;
  }
}

export function registerPublicNativeEsignRoutes(app: Express): void {
  app.use("/api/eos/native-esign/public", publicEsignRateLimit);

  app.get("/api/eos/native-esign/public/:token", route(async (req, res) => {
    publicHeaders(res);
    const context = await resolvePublicRecipient(req);
    await markOpened(context);
    const negotiation = await db.query.eosEsignNegotiations.findFirst({
      where: and(eq(eosEsignNegotiations.envelopeId, context.envelope.id), eq(eosEsignNegotiations.companyId, context.envelope.companyId)),
      orderBy: [desc(eosEsignNegotiations.createdAt)],
    });
    const negotiationEntries = negotiation
      ? await db.select().from(eosEsignNegotiationEntries).where(and(eq(eosEsignNegotiationEntries.negotiationId, negotiation.id), eq(eosEsignNegotiationEntries.companyId, context.envelope.companyId))).orderBy(eosEsignNegotiationEntries.createdAt)
      : [];
    const comparison = context.envelope.replacesEnvelopeId
      ? await db.query.eosEsignDocumentComparisons.findFirst({ where: and(eq(eosEsignDocumentComparisons.companyId, context.envelope.companyId), eq(eosEsignDocumentComparisons.targetDocumentVersionId, context.document.id)) })
      : undefined;
    res.json({
      envelope: { id: context.envelope.id, subject: context.envelope.subject, message: context.envelope.message, state: context.envelope.state, expiresAt: context.envelope.expiresAt, assuranceMode: context.envelope.assuranceMode },
      document: {
        title: context.document.title,
        version: context.document.documentVersion,
        sha256: context.document.sourceSha256,
        fields: nativeEsignFieldSchema.array().parse(context.document.fieldSchema)
          .filter((field) => field.roleKey === context.recipient.roleKey),
      },
      recipient: { roleKey: context.recipient.roleKey, signerName: context.recipient.signerName, signerEmail: context.recipient.signerEmail, state: context.recipient.state, consentVersion: NATIVE_ESIGN_CONSENT_VERSION, identityAssuranceState: context.recipient.identityAssuranceState, identityVerifiedAt: context.recipient.identityVerifiedAt, comparisonAcknowledged: Boolean(context.recipient.comparisonAcknowledgementSha256), comparisonAcknowledgedAt: context.recipient.comparisonAcknowledgedAt },
      comparison: nativeEsignComparisonProjection(comparison),
      negotiation: negotiation ? {
        id: negotiation.id, state: negotiation.state, subject: negotiation.subject,
        resolutionSummary: negotiation.resolutionSummary, updatedAt: negotiation.updatedAt,
        replacementDocumentVersionId: negotiation.replacementDocumentVersionId,
        replacementEnvelopeId: negotiation.replacementEnvelopeId,
        entries: negotiationEntries.map((entry) => ({
          id: entry.id,
          author: entry.authorType === "operator" ? "Sender" : entry.authorReference === context.recipient.id ? "You" : "Another signer",
          entryType: entry.entryType, body: entry.body, requestedChanges: entry.requestedChanges,
          previousEntrySha256: entry.previousEntrySha256, entrySha256: entry.entrySha256, createdAt: entry.createdAt,
        })),
      } : null,
    });
  }));

  app.get("/api/eos/native-esign/public/:token/document", route(async (req, res) => {
    publicHeaders(res);
    const context = await resolvePublicRecipient(req);
    await markOpened(context);
    const document = await readNativeEsignArtifact(context.document.sourceStorageKey);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${context.document.documentKey.replace(/[^a-z0-9_-]/gi, "-")}.pdf"`);
    res.send(document);
  }));

  app.get("/api/eos/native-esign/public/:token/completed-document", route(async (req, res) => {
    publicHeaders(res);
    const context = await resolveCompletedAccess(req);
    const document = await readNativeEsignArtifact(context.envelope.finalStorageKey);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${context.document.documentKey.replace(/[^a-z0-9_-]/gi, "-")}-signed.pdf"`);
    res.setHeader("Digest", `sha-256=${Buffer.from(context.envelope.finalSha256, "hex").toString("base64")}`);
    res.send(document);
  }));

  app.get("/api/eos/native-esign/public/:token/receipt", route(async (req, res) => {
    publicHeaders(res);
    const context = await resolveCompletedAccess(req);
    res.json({
      envelopeId: context.envelope.id,
      state: context.envelope.state,
      sourceSha256: context.document.sourceSha256,
      finalSha256: context.envelope.finalSha256,
      auditSha256: context.envelope.auditSha256,
      completedAt: context.envelope.completedAt,
      assurance: { electronicConsent: true, comparisonAcknowledged: Boolean(context.recipient.comparisonAcknowledgementSha256), comparisonAcknowledgementSha256: context.recipient.comparisonAcknowledgementSha256 || null, comparisonAcknowledgedAt: context.recipient.comparisonAcknowledgedAt || null, intentToSign: true, signatureMethod: context.recipient.signatureMethod, signatureCaptureSha256: context.recipient.signatureCaptureSha256, signatureCaptureMimeType: context.recipient.signatureCaptureMimeType || null, signatureCaptureWidth: context.recipient.signatureCaptureWidth || null, signatureCaptureHeight: context.recipient.signatureCaptureHeight || null, emailOtpVerified: context.recipient.identityAssuranceState === "verified", governmentIdVerified: false, qualifiedCertificate: false },
    });
  }));

  app.get("/api/eos/native-esign/public/:token/verify", route(async (req, res) => {
    publicHeaders(res);
    const context = await resolveCompletedAccess(req);
    const report = await verifyNativeEsignEnvelopeIntegrity(context.envelope.id);
    res.json(publicNativeEsignIntegrityProjection(report));
  }));

  app.get("/api/eos/native-esign/public/completion/:token/document", route(async (req, res) => {
    publicHeaders(res);
    const context = await resolveCompletionReceiptAccess(req.params.token);
    const document = await readNativeEsignArtifact(context.envelope.finalStorageKey);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${context.document.documentKey.replace(/[^a-z0-9_-]/gi, "-")}-signed.pdf"`);
    res.setHeader("Digest", `sha-256=${Buffer.from(context.envelope.finalSha256, "hex").toString("base64")}`);
    res.send(document);
  }));

  app.get("/api/eos/native-esign/public/completion/:token/receipt", route(async (req, res) => {
    publicHeaders(res);
    const context = await resolveCompletionReceiptAccess(req.params.token);
    res.json({
      envelopeId: context.envelope.id, state: context.envelope.state,
      sourceSha256: context.document.sourceSha256, finalSha256: context.envelope.finalSha256,
      auditSha256: context.envelope.auditSha256, completedAt: context.envelope.completedAt,
      assurance: { electronicConsent: true, comparisonAcknowledged: Boolean(context.recipient.comparisonAcknowledgementSha256), comparisonAcknowledgementSha256: context.recipient.comparisonAcknowledgementSha256 || null, comparisonAcknowledgedAt: context.recipient.comparisonAcknowledgedAt || null, intentToSign: true, signatureMethod: context.recipient.signatureMethod, signatureCaptureSha256: context.recipient.signatureCaptureSha256, signatureCaptureMimeType: context.recipient.signatureCaptureMimeType || null, signatureCaptureWidth: context.recipient.signatureCaptureWidth || null, signatureCaptureHeight: context.recipient.signatureCaptureHeight || null, emailOtpVerified: context.recipient.identityAssuranceState === "verified", governmentIdVerified: false, qualifiedCertificate: false },
    });
  }));

  app.get("/api/eos/native-esign/public/completion/:token/verify", route(async (req, res) => {
    publicHeaders(res);
    const context = await resolveCompletionReceiptAccess(req.params.token);
    const report = await verifyNativeEsignEnvelopeIntegrity(context.envelope.id);
    res.json(publicNativeEsignIntegrityProjection(report));
  }));

  app.post("/api/eos/native-esign/public/:token/otp/request", route(async (req, res) => {
    publicHeaders(res);
    const context = await resolvePublicRecipient(req);
    if (context.envelope.assuranceMode !== "email_otp")
      throw new NativeEsignError(409, "native_esign_otp_not_required", "This envelope does not require email verification.");
    if (context.recipient.identityAssuranceState === "verified") {
      res.json({ state: "verified", verifiedAt: context.recipient.identityVerifiedAt });
      return;
    }
    if (context.recipient.identityAssuranceState === "locked" || context.recipient.otpSendCount >= 5)
      throw new NativeEsignError(429, "native_esign_otp_locked", "Email verification is locked. Contact the sender to correct or reissue the recipient.");
    const now = new Date();
    if (context.recipient.otpLastSentAt && now.getTime() - context.recipient.otpLastSentAt.getTime() < 60_000)
      throw new NativeEsignError(429, "native_esign_otp_cooldown", "Wait before requesting another verification code.");
    const otp = createNativeEsignOtp();
    const digest = nativeEsignOtpDigest(context.recipient.id, otp.code);
    const [reserved] = await db.update(eosEsignRecipients).set({
      identityAssuranceState: "pending", otpDigest: digest, otpExpiresAt: otp.expiresAt,
      otpAttemptCount: 0, otpSendCount: context.recipient.otpSendCount + 1,
      otpLastSentAt: now, version: context.recipient.version + 1, updatedAt: now,
    }).where(and(eq(eosEsignRecipients.id, context.recipient.id), eq(eosEsignRecipients.version, context.recipient.version), inArray(eosEsignRecipients.identityAssuranceState, ["pending", "not_required"]))).returning();
    if (!reserved) throw new NativeEsignError(409, "native_esign_recipient_changed", "The verification session changed. Refresh and retry.");
    const company = await db.query.companies.findFirst({ where: eq(companies.id, context.envelope.companyId) });
    const email = nativeEsignOtpEmail({ signerName: context.recipient.signerName, companyName: company?.name || "The sender", documentTitle: context.document.title, code: otp.code, expiresAt: otp.expiresAt });
    try {
      const receipt = await gmail.sendEmail(context.envelope.createdByUserId, { to: context.recipient.signerEmail, ...email });
      if (!receipt.messageId) throw new Error("Gmail returned no message receipt.");
      await db.transaction(async (tx) => {
        await appendAuditEvent(tx, {
          companyId: context.envelope.companyId, envelopeId: context.envelope.id,
          recipientId: context.recipient.id, eventType: "identity_otp_requested",
          actorType: "provider", eventProjection: { expiresAt: otp.expiresAt.toISOString(), sendCount: reserved.otpSendCount, providerMessageReference: receipt.messageId },
        });
      });
    } catch (error) {
      await db.update(eosEsignRecipients).set({
        otpDigest: "", otpExpiresAt: null, otpAttemptCount: 0,
        otpSendCount: context.recipient.otpSendCount, otpLastSentAt: context.recipient.otpLastSentAt,
        version: reserved.version + 1, updatedAt: new Date(),
      }).where(and(eq(eosEsignRecipients.id, reserved.id), eq(eosEsignRecipients.otpDigest, digest)));
      const failure = classifyNativeEsignDeliveryFailure(error);
      throw new NativeEsignError(502, "native_esign_otp_delivery_failed", failure.safeMessage);
    }
    res.json({ state: "pending", expiresAt: otp.expiresAt, sendCount: reserved.otpSendCount });
  }));

  app.post("/api/eos/native-esign/public/:token/otp/verify", route(async (req, res) => {
    publicHeaders(res);
    const input = nativeEsignOtpVerifySchema.parse(req.body);
    const context = await resolvePublicRecipient(req);
    if (context.envelope.assuranceMode !== "email_otp")
      throw new NativeEsignError(409, "native_esign_otp_not_required", "This envelope does not require email verification.");
    if (context.recipient.identityAssuranceState === "verified") {
      res.json({ state: "verified", verifiedAt: context.recipient.identityVerifiedAt });
      return;
    }
    if (context.recipient.identityAssuranceState === "locked" || context.recipient.otpAttemptCount >= 5)
      throw new NativeEsignError(429, "native_esign_otp_locked", "Email verification is locked. Contact the sender.");
    if (!context.recipient.otpDigest || !context.recipient.otpExpiresAt || context.recipient.otpExpiresAt <= new Date())
      throw new NativeEsignError(409, "native_esign_otp_expired", "Request a new verification code.");
    if (!nativeEsignOtpMatches(context.recipient.id, input.code, context.recipient.otpDigest)) {
      const attempts = context.recipient.otpAttemptCount + 1;
      await db.update(eosEsignRecipients).set({
        otpAttemptCount: attempts, identityAssuranceState: attempts >= 5 ? "locked" : "pending",
        otpDigest: attempts >= 5 ? "" : context.recipient.otpDigest,
        version: context.recipient.version + 1, updatedAt: new Date(),
      }).where(and(eq(eosEsignRecipients.id, context.recipient.id), eq(eosEsignRecipients.version, context.recipient.version)));
      throw new NativeEsignError(400, "native_esign_otp_invalid", attempts >= 5 ? "Email verification is locked. Contact the sender." : "The verification code is invalid.");
    }
    const verifiedAt = new Date();
    await db.transaction(async (tx) => {
      const [verified] = await tx.update(eosEsignRecipients).set({
        identityAssuranceState: "verified", identityVerifiedAt: verifiedAt,
        otpDigest: "", otpExpiresAt: null, otpAttemptCount: 0,
        version: context.recipient.version + 1, updatedAt: verifiedAt,
      }).where(and(eq(eosEsignRecipients.id, context.recipient.id), eq(eosEsignRecipients.version, context.recipient.version), eq(eosEsignRecipients.identityAssuranceState, "pending"))).returning();
      if (!verified) throw new NativeEsignError(409, "native_esign_recipient_changed", "The verification session changed. Refresh and retry.");
      await appendAuditEvent(tx, {
        companyId: context.envelope.companyId, envelopeId: context.envelope.id,
        recipientId: context.recipient.id, eventType: "identity_verified", actorType: "signer",
        actorReference: context.recipient.id, eventProjection: { assuranceMethod: "email_otp" },
      });
    });
    res.json({ state: "verified", verifiedAt });
  }));

  app.post("/api/eos/native-esign/public/:token/negotiations", route(async (req, res) => {
    publicHeaders(res);
    const context = await resolvePublicRecipient(req);
    const input = nativeEsignNegotiationOpenSchema.parse(req.body);
    if (!['sent', 'opened', 'consented'].includes(context.recipient.state))
      throw new NativeEsignError(409, "native_esign_negotiation_unavailable", "A change request can only be opened before this recipient signs or declines.");
    const existing = await db.query.eosEsignNegotiations.findFirst({ where: and(eq(eosEsignNegotiations.envelopeId, context.envelope.id), eq(eosEsignNegotiations.companyId, context.envelope.companyId), eq(eosEsignNegotiations.state, "open")) });
    if (existing) throw new NativeEsignError(409, "native_esign_negotiation_already_open", "This envelope already has an open change request.");
    const now = new Date();
    const negotiationId = randomUUID();
    const entryId = randomUUID();
    const entrySha256 = nativeContractContentSha256({ schemaVersion: "eos-native-esign-negotiation-entry.v1", entryId, negotiationId, envelopeId: context.envelope.id, authorType: "recipient", authorReference: context.recipient.id, entryType: "change_request", body: input.body, requestedChanges: input.requestedChanges, previousEntrySha256: "", createdAt: now.toISOString() });
    const result = await db.transaction(async (tx) => {
      const [negotiation] = await tx.insert(eosEsignNegotiations).values({ id: negotiationId, companyId: context.envelope.companyId, envelopeId: context.envelope.id, state: "open", openedByType: "recipient", openedByReference: context.recipient.id, subject: input.subject, version: 1, createdAt: now, updatedAt: now }).returning();
      const [entry] = await tx.insert(eosEsignNegotiationEntries).values({ id: entryId, companyId: context.envelope.companyId, negotiationId, envelopeId: context.envelope.id, authorType: "recipient", authorReference: context.recipient.id, entryType: "change_request", body: input.body, requestedChanges: input.requestedChanges, previousEntrySha256: "", entrySha256, createdAt: now }).returning();
      await appendAuditEvent(tx, { companyId: context.envelope.companyId, envelopeId: context.envelope.id, recipientId: context.recipient.id, eventType: "negotiation_opened", actorType: "signer", actorReference: context.recipient.id, eventProjection: { negotiationId, entryId, subject: input.subject, entrySha256 } });
      return { negotiation, entry };
    });
    res.status(201).json(result);
  }));

  app.post("/api/eos/native-esign/public/:token/negotiations/:negotiationId/entries", route(async (req, res) => {
    publicHeaders(res);
    const context = await resolvePublicRecipient(req);
    const input = nativeEsignNegotiationEntrySchema.parse(req.body);
    const negotiation = await db.query.eosEsignNegotiations.findFirst({ where: and(
      eq(eosEsignNegotiations.id, req.params.negotiationId), eq(eosEsignNegotiations.envelopeId, context.envelope.id),
      eq(eosEsignNegotiations.companyId, context.envelope.companyId), eq(eosEsignNegotiations.state, "open"),
    ) });
    if (!negotiation) throw new NativeEsignError(409, "native_esign_negotiation_unavailable", "The open change discussion is no longer available.");
    const entryId = randomUUID();
    const [entry] = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${negotiation.id}))`);
      const [currentNegotiation] = await tx.select().from(eosEsignNegotiations).where(and(eq(eosEsignNegotiations.id, negotiation.id), eq(eosEsignNegotiations.state, "open"))).limit(1);
      if (!currentNegotiation) throw new NativeEsignError(409, "native_esign_negotiation_changed", "The discussion changed before this reply. Refresh and review it.");
      const [previous] = await tx.select().from(eosEsignNegotiationEntries).where(and(eq(eosEsignNegotiationEntries.negotiationId, negotiation.id), eq(eosEsignNegotiationEntries.companyId, context.envelope.companyId))).orderBy(desc(eosEsignNegotiationEntries.createdAt)).limit(1);
      const now = new Date(Math.max(Date.now(), (previous?.createdAt?.getTime() || 0) + 1));
      const entrySha256 = nativeContractContentSha256({ schemaVersion: "eos-native-esign-negotiation-entry.v1", entryId, negotiationId: negotiation.id, envelopeId: negotiation.envelopeId, authorType: "recipient", authorReference: context.recipient.id, entryType: "comment", body: input.body, requestedChanges: input.requestedChanges, previousEntrySha256: previous?.entrySha256 || "", createdAt: now.toISOString() });
      const created = await tx.insert(eosEsignNegotiationEntries).values({ id: entryId, companyId: context.envelope.companyId, negotiationId: negotiation.id, envelopeId: negotiation.envelopeId, authorType: "recipient", authorReference: context.recipient.id, entryType: "comment", body: input.body, requestedChanges: input.requestedChanges, previousEntrySha256: previous?.entrySha256 || "", entrySha256, createdAt: now }).returning();
      await tx.update(eosEsignNegotiations).set({ version: currentNegotiation.version + 1, updatedAt: now }).where(and(eq(eosEsignNegotiations.id, negotiation.id), eq(eosEsignNegotiations.version, currentNegotiation.version)));
      await appendAuditEvent(tx, { companyId: context.envelope.companyId, envelopeId: negotiation.envelopeId, recipientId: context.recipient.id, eventType: "negotiation_entry_recorded", actorType: "signer", actorReference: context.recipient.id, eventProjection: { negotiationId: negotiation.id, entryId, entrySha256 } });
      return created;
    });
    res.status(201).json({ id: entry.id, author: "You", entryType: entry.entryType, body: entry.body, requestedChanges: entry.requestedChanges, previousEntrySha256: entry.previousEntrySha256, entrySha256: entry.entrySha256, createdAt: entry.createdAt });
  }));

  app.post("/api/eos/native-esign/public/:token/consent", route(async (req, res) => {
    publicHeaders(res);
    const input = nativeEsignConsentSchema.parse(req.body);
    const context = await resolvePublicRecipient(req);
    const openNegotiation = await db.query.eosEsignNegotiations.findFirst({ where: and(eq(eosEsignNegotiations.envelopeId, context.envelope.id), eq(eosEsignNegotiations.companyId, context.envelope.companyId), eq(eosEsignNegotiations.state, "open")) });
    if (openNegotiation) throw new NativeEsignError(409, "native_esign_negotiation_resolution_required", "Resolve the open change request before consenting to this document.");
    if (context.envelope.assuranceMode === "email_otp" && context.recipient.identityAssuranceState !== "verified")
      throw new NativeEsignError(409, "native_esign_identity_verification_required", "Verify the signer email before recording consent.");
    const comparison = context.envelope.replacesEnvelopeId
      ? await db.query.eosEsignDocumentComparisons.findFirst({ where: and(eq(eosEsignDocumentComparisons.companyId, context.envelope.companyId), eq(eosEsignDocumentComparisons.targetDocumentVersionId, context.document.id)) })
      : undefined;
    if (context.envelope.replacesEnvelopeId && (!comparison || input.comparisonAcknowledgementSha256 !== comparison.comparisonSha256))
      throw new NativeEsignError(409, "native_esign_comparison_acknowledgement_required", "Review and acknowledge the exact replacement comparison before consenting.");
    const now = new Date();
    const networkFingerprintSha256 = nativeEsignFingerprint(req.ip || req.socket.remoteAddress || "");
    const userAgentSha256 = nativeEsignFingerprint(String(req.headers["user-agent"] || ""));
    let updated: typeof eosEsignRecipients.$inferSelect | undefined;
    await db.transaction(async (tx) => {
      [updated] = await tx.update(eosEsignRecipients).set({
        state: "consented", consentVersion: input.consentVersion, consentedAt: now,
        comparisonAcknowledgementSha256: comparison?.comparisonSha256 || "", comparisonAcknowledgedAt: comparison ? now : null,
        networkFingerprintSha256, userAgentSha256,
        openedAt: context.recipient.openedAt || now, version: context.recipient.version + 1, updatedAt: now,
      }).where(and(eq(eosEsignRecipients.id, context.recipient.id), eq(eosEsignRecipients.version, context.recipient.version), inArray(eosEsignRecipients.state, ["pending", "sent", "opened"]))).returning();
      if (!updated) throw new NativeEsignError(409, "native_esign_recipient_changed", "The signing session changed. Refresh and review it again.");
      if (comparison) await appendAuditEvent(tx, { companyId: context.envelope.companyId, envelopeId: context.envelope.id, recipientId: context.recipient.id, eventType: "comparison_acknowledged", actorType: "signer", actorReference: context.recipient.id, eventProjection: { comparisonSha256: comparison.comparisonSha256, comparisonType: comparison.comparisonType } });
      await appendAuditEvent(tx, { companyId: context.envelope.companyId, envelopeId: context.envelope.id, recipientId: context.recipient.id, eventType: "consent_recorded", actorType: "signer", actorReference: context.recipient.id, eventProjection: { consentVersion: input.consentVersion, networkFingerprintSha256, userAgentSha256 } });
    });
    res.json({ state: updated!.state, consentedAt: updated!.consentedAt });
  }));

  app.post("/api/eos/native-esign/public/:token/sign", route(async (req, res) => {
    publicHeaders(res);
    const input = nativeEsignSignatureSchema.parse(req.body);
    const context = await resolvePublicRecipient(req);
    const openNegotiation = await db.query.eosEsignNegotiations.findFirst({ where: and(eq(eosEsignNegotiations.envelopeId, context.envelope.id), eq(eosEsignNegotiations.companyId, context.envelope.companyId), eq(eosEsignNegotiations.state, "open")) });
    if (openNegotiation) throw new NativeEsignError(409, "native_esign_negotiation_resolution_required", "Resolve the open change request before signing this document.");
    if (context.recipient.state !== "consented" || context.recipient.consentVersion !== input.consentVersion || !context.recipient.consentedAt)
      throw new NativeEsignError(409, "native_esign_consent_required", "Review and accept the electronic-record and signature consent before signing.");
    if (context.envelope.replacesEnvelopeId) {
      const comparison = await db.query.eosEsignDocumentComparisons.findFirst({ where: and(eq(eosEsignDocumentComparisons.companyId, context.envelope.companyId), eq(eosEsignDocumentComparisons.targetDocumentVersionId, context.document.id)) });
      if (!comparison || context.recipient.comparisonAcknowledgementSha256 !== comparison.comparisonSha256 || !context.recipient.comparisonAcknowledgedAt)
        throw new NativeEsignError(409, "native_esign_comparison_acknowledgement_required", "A valid acknowledgement of the exact replacement comparison is required before signing.");
    }
    const documentFields = nativeEsignFieldSchema.array().parse(context.document.fieldSchema);
    const fieldValues = validatedRecipientFieldValues(documentFields, context.recipient.roleKey, input.fieldValues);
    const now = new Date();
    let signatureCaptureSha256: string;
    let signatureCaptureStorageKey = "";
    let signatureCaptureMimeType = "";
    let signatureCaptureSizeBytes = 0;
    let signatureCaptureWidth = 0;
    let signatureCaptureHeight = 0;
    let captureStored = false;
    if (input.signatureMethod === "typed") {
      signatureCaptureSha256 = typedSignatureCaptureSha256(input.signatureName);
      if (signatureCaptureSha256 !== input.signatureCaptureSha256)
        throw new NativeEsignError(400, "native_esign_capture_hash_mismatch", "The typed signature evidence did not match the adopted signature name.");
    } else {
      let capture;
      try {
        capture = await validateNativeEsignSignatureCapture({
          method: input.signatureMethod,
          mimeType: input.signatureCaptureMimeType!,
          base64: input.signatureCaptureBase64!,
          claimedSha256: input.signatureCaptureSha256,
        });
      } catch (error: any) {
        const code = typeof error?.message === "string" && error.message.startsWith("native_esign_capture_") ? error.message : "native_esign_capture_invalid";
        throw new NativeEsignError(400, code, "The signature image is invalid, unsafe, too large, or does not match its evidence hash.");
      }
      signatureCaptureSha256 = capture.sha256;
      signatureCaptureMimeType = capture.mimeType;
      signatureCaptureSizeBytes = capture.sizeBytes;
      signatureCaptureWidth = capture.width;
      signatureCaptureHeight = capture.height;
      await requireCleanUploadedArtifact(
        capture.bytes,
        capture.mimeType,
        capture.sha256,
      );
      signatureCaptureStorageKey = nativeEsignSignatureStorageKey(
        context.envelope.companyId,
        context.envelope.id,
        context.recipient.id,
        randomUUID(),
        capture.mimeType,
      );
      try {
        await storeNativeEsignArtifact(signatureCaptureStorageKey, capture.bytes);
        captureStored = true;
      } catch {
        throw new NativeEsignError(503, "native_esign_capture_storage_unavailable", "The signature image could not be stored privately. No signature was recorded; retry later.");
      }
    }
    const signatureSha256 = nativeEsignSignatureSha256({
      envelopeId: context.envelope.id, recipientId: context.recipient.id,
      consentVersion: input.consentVersion, signatureMethod: input.signatureMethod,
      signatureName: input.signatureName, signatureCaptureSha256, fieldValues,
    });
    try {
      await db.transaction(async (tx) => {
        const [updated] = await tx.update(eosEsignRecipients).set({
          state: "signed", signatureMethod: input.signatureMethod, signatureName: input.signatureName,
          signatureSha256, signatureCaptureSha256, signatureCaptureStorageKey,
          signatureCaptureMimeType, signatureCaptureSizeBytes, signatureCaptureWidth, signatureCaptureHeight,
          fieldValues, signedAt: now, tokenUsedAt: now,
          version: context.recipient.version + 1, updatedAt: now,
        }).where(and(eq(eosEsignRecipients.id, context.recipient.id), eq(eosEsignRecipients.version, context.recipient.version), eq(eosEsignRecipients.state, "consented"))).returning();
        if (!updated) throw new NativeEsignError(409, "native_esign_recipient_changed", "The signing session changed before the signature was recorded.");
        await appendAuditEvent(tx, { companyId: context.envelope.companyId, envelopeId: context.envelope.id, recipientId: context.recipient.id, eventType: "signature_recorded", actorType: "signer", actorReference: context.recipient.id, eventProjection: { consentVersion: input.consentVersion, signatureMethod: input.signatureMethod, signatureSha256, signatureCaptureSha256, signatureCaptureMimeType: signatureCaptureMimeType || null, signatureCaptureSizeBytes, signatureCaptureWidth, signatureCaptureHeight } });
        if (signatureCaptureStorageKey) await registerNativeEsignArtifact(tx, {
          companyId: context.envelope.companyId, envelopeId: context.envelope.id,
          documentVersionId: context.document.id, recipientId: context.recipient.id,
          artifactKind: "signature_capture", storageKey: signatureCaptureStorageKey,
          sha256: signatureCaptureSha256, sizeBytes: signatureCaptureSizeBytes,
          mimeType: signatureCaptureMimeType, createdAt: now,
        });
      });
    } catch (error) {
      if (captureStored) await removeNativeEsignArtifact(signatureCaptureStorageKey).catch(() => undefined);
      throw error;
    }
    let integrity = null;
    try {
      integrity = await finalizeEnvelope(context.envelope.id);
    } catch (error: any) {
      const failedAt = new Date();
      await db.transaction(async (tx) => {
        const current = await tx.query.eosEsignEnvelopes.findFirst({ where: eq(eosEsignEnvelopes.id, context.envelope.id) });
        if (current && current.state !== "completed") {
          await tx.update(eosEsignEnvelopes).set({ state: "recovery_required", version: current.version + 1, updatedAt: failedAt }).where(and(eq(eosEsignEnvelopes.id, current.id), eq(eosEsignEnvelopes.version, current.version)));
          await appendAuditEvent(tx, { companyId: current.companyId, envelopeId: current.id, eventType: "recovery_required", actorType: "system", eventProjection: { failureCode: error instanceof NativeEsignError ? error.code : "native_esign_completion_failed" } });
        }
      });
      throw new NativeEsignError(503, "native_esign_completion_recovery_required", "Your signature was recorded, but EOS could not seal the final document. The envelope is locked for operator recovery; do not sign again.");
    }
    const envelope = await db.query.eosEsignEnvelopes.findFirst({ where: eq(eosEsignEnvelopes.id, context.envelope.id) });
    res.json({ state: "signed", signedAt: now, envelopeState: envelope?.state || "in_progress", finalSha256: envelope?.finalSha256 || "", integrity: integrity ? publicNativeEsignIntegrityProjection(integrity) : null });
  }));

  app.post("/api/eos/native-esign/public/:token/decline", route(async (req, res) => {
    publicHeaders(res);
    const input = nativeEsignDeclineSchema.parse(req.body);
    const context = await resolvePublicRecipient(req);
    const now = new Date();
    await db.transaction(async (tx) => {
      const [updated] = await tx.update(eosEsignRecipients).set({ state: "declined", declinedAt: now, declineReason: input.reason, tokenUsedAt: now, version: context.recipient.version + 1, updatedAt: now })
        .where(and(eq(eosEsignRecipients.id, context.recipient.id), eq(eosEsignRecipients.version, context.recipient.version), inArray(eosEsignRecipients.state, ["pending", "sent", "opened", "consented"]))).returning();
      if (!updated) throw new NativeEsignError(409, "native_esign_recipient_changed", "The signing session changed before the decline was recorded.");
      await tx.update(eosEsignEnvelopes).set({ state: "declined", declinedAt: now, version: context.envelope.version + 1, updatedAt: now }).where(and(eq(eosEsignEnvelopes.id, context.envelope.id), inArray(eosEsignEnvelopes.state, ["issued", "in_progress"]))).returning();
      if (context.envelope.recoveryAgreementInstanceId)
        await tx.update(eosRecoveryAgreementInstances).set({ state: "declined", version: sql`${eosRecoveryAgreementInstances.version} + 1`, updatedAt: now }).where(and(eq(eosRecoveryAgreementInstances.id, context.envelope.recoveryAgreementInstanceId), eq(eosRecoveryAgreementInstances.companyId, context.envelope.companyId), inArray(eosRecoveryAgreementInstances.state, ["issued", "eligible_to_issue"])));
      await appendAuditEvent(tx, { companyId: context.envelope.companyId, envelopeId: context.envelope.id, recipientId: context.recipient.id, eventType: "recipient_declined", actorType: "signer", actorReference: context.recipient.id, eventProjection: { reason: input.reason } });
    });
    res.json({ state: "declined", declinedAt: now });
  }));
}

export function registerNativeEsignRoutes(app: Express): void {
  app.get("/api/eos/companies/:companyId/native-esign/library", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const reader = await requireCompanyReader(req, companyId, "native_esign.library.read");
    const [clauses, clauseVersions, templates, templateVersions, counterparties] = await Promise.all([
      db.select().from(eosEsignClauses).where(eq(eosEsignClauses.companyId, companyId)).orderBy(eosEsignClauses.name),
      db.select().from(eosEsignClauseVersions).where(eq(eosEsignClauseVersions.companyId, companyId)).orderBy(desc(eosEsignClauseVersions.createdAt)),
      db.select().from(eosEsignTemplates).where(eq(eosEsignTemplates.companyId, companyId)).orderBy(eosEsignTemplates.name),
      db.select().from(eosEsignTemplateVersions).where(eq(eosEsignTemplateVersions.companyId, companyId)).orderBy(desc(eosEsignTemplateVersions.createdAt)),
      db.select().from(eosEsignCounterparties).where(eq(eosEsignCounterparties.companyId, companyId)).orderBy(eosEsignCounterparties.displayName),
    ]);
    const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
    let portfolioProposals: Array<typeof eosEsignPortfolioTemplateProposals.$inferSelect & { sourceCompanyName: string }> = [];
    let portfolioAdoptions: Array<typeof eosEsignPortfolioTemplateAdoptions.$inferSelect> = [];
    let jurisdictionPacks: Array<typeof eosEsignJurisdictionPacks.$inferSelect & { sourceCompanyName: string }> = [];
    let jurisdictionApplicabilityDecisions: Array<typeof eosEsignJurisdictionPackApplicabilityDecisions.$inferSelect> = [];
    let canPublishPortfolioProposal = false;
    let canDecidePortfolioProposal = false;
    if (company?.portfolioId) {
      const [portfolio, proposals, adoptions, packs, applicabilityDecisions] = await Promise.all([
        db.query.portfolios.findFirst({ where: eq(portfolios.id, company.portfolioId) }),
        db.select().from(eosEsignPortfolioTemplateProposals).where(eq(eosEsignPortfolioTemplateProposals.portfolioId, company.portfolioId)).orderBy(desc(eosEsignPortfolioTemplateProposals.createdAt)),
        db.select().from(eosEsignPortfolioTemplateAdoptions).where(and(eq(eosEsignPortfolioTemplateAdoptions.portfolioId, company.portfolioId), eq(eosEsignPortfolioTemplateAdoptions.companyId, companyId))).orderBy(desc(eosEsignPortfolioTemplateAdoptions.decidedAt)),
        db.select().from(eosEsignJurisdictionPacks).where(eq(eosEsignJurisdictionPacks.portfolioId, company.portfolioId)).orderBy(desc(eosEsignJurisdictionPacks.preparedAt)),
        db.select().from(eosEsignJurisdictionPackApplicabilityDecisions).where(and(eq(eosEsignJurisdictionPackApplicabilityDecisions.portfolioId, company.portfolioId), eq(eosEsignJurisdictionPackApplicabilityDecisions.companyId, companyId))).orderBy(desc(eosEsignJurisdictionPackApplicabilityDecisions.decidedAt)),
      ]);
      const visibleProposals = proposals.filter((proposal) => mayAccessClassification(reader.access, proposal.classification));
      const visiblePacks = packs.filter((pack) => mayAccessClassification(reader.access, pack.classification));
      const sourceCompanyIds = Array.from(new Set([...visibleProposals.map((proposal) => proposal.sourceCompanyId), ...visiblePacks.map((pack) => pack.sourceCompanyId)]));
      const sourceCompanies = sourceCompanyIds.length ? await db.select({ id: companies.id, name: companies.name }).from(companies).where(inArray(companies.id, sourceCompanyIds)) : [];
      portfolioProposals = visibleProposals.map((proposal) => ({ ...proposal, sourceCompanyName: sourceCompanies.find((item) => item.id === proposal.sourceCompanyId)?.name || "Portfolio company" }));
      portfolioAdoptions = adoptions.filter((adoption) => visibleProposals.some((proposal) => proposal.id === adoption.proposalId));
      jurisdictionPacks = visiblePacks.map((pack) => ({ ...pack, sourceCompanyName: sourceCompanies.find((item) => item.id === pack.sourceCompanyId)?.name || "Portfolio company" }));
      jurisdictionApplicabilityDecisions = applicabilityDecisions.filter((decision) => visiblePacks.some((pack) => pack.id === decision.packId));
      canPublishPortfolioProposal = Boolean(portfolio?.ownerId === req.user.id && reader.isFounder);
      canDecidePortfolioProposal = reader.isFounder;
    }
    res.json({ clauses, clauseVersions, templates, templateVersions, counterparties, portfolioProposals, portfolioAdoptions, jurisdictionPacks, jurisdictionApplicabilityDecisions, canPublishPortfolioProposal, canDecidePortfolioProposal });
  }));

  app.post("/api/eos/companies/:companyId/native-esign/jurisdiction-packs", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const operator = await requireCompanyOperator(req, companyId, "native_esign.jurisdiction_pack.prepare");
    const input = nativeEsignJurisdictionPackSchema.parse(req.body);
    const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
    if (!company?.portfolioId || !operator.isFounder) throw new NativeEsignError(403, "native_esign_jurisdiction_pack_founder_required", "A company founder inside a portfolio is required to prepare a jurisdiction pack.");
    const portfolio = await db.query.portfolios.findFirst({ where: and(eq(portfolios.id, company.portfolioId), eq(portfolios.ownerId, req.user.id)) });
    if (!portfolio) throw new NativeEsignError(403, "native_esign_portfolio_owner_required", "Only the portfolio owner can prepare a portfolio jurisdiction pack.");
    if (!mayAccessClassification(operator.access, input.classification)) throw new NativeEsignError(403, "native_esign_jurisdiction_pack_classification_forbidden", "The jurisdiction pack classification exceeds this operator's disclosure ceiling.");
    const policy = await authorizeAction(req, operator.access, { authorityClass: "execute", resource: "jurisdiction_pack", actionKey: "native_esign.jurisdiction_pack.prepare", purpose: "prepare_counsel_reviewable_jurisdiction_pack", classification: input.classification, consequence: "material", targetSeatId: operator.access.seat.id });
    const packId = randomUUID(); const preparedAt = new Date();
    const pack = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`jurisdiction-pack:${portfolio.id}:${input.packKey}`}))`);
      const [latest] = await tx.select({ value: sql<number>`COALESCE(MAX(${eosEsignJurisdictionPacks.packVersion}), 0)` }).from(eosEsignJurisdictionPacks).where(and(eq(eosEsignJurisdictionPacks.portfolioId, portfolio.id), eq(eosEsignJurisdictionPacks.packKey, input.packKey)));
      const packVersion = Number(latest?.value || 0) + 1;
      const contentSha256 = nativeContractContentSha256({ schemaVersion: "eos-jurisdiction-pack.v1", portfolioId: portfolio.id, packVersion, ...input });
      const [created] = await tx.insert(eosEsignJurisdictionPacks).values({ id: packId, portfolioId: portfolio.id, sourceCompanyId: companyId, packKey: input.packKey, packVersion, name: input.name, countryCode: input.countryCode, subdivision: input.subdivision, governingLawLabel: input.governingLawLabel, scopeSummary: input.scopeSummary, applicabilityCriteria: input.applicabilityCriteria, exclusions: input.exclusions, requiredReviews: input.requiredReviews, sourceReferences: input.sourceReferences, effectiveFrom: input.effectiveFrom, reviewedThrough: input.reviewedThrough, nextReviewAt: input.nextReviewAt, contentSha256, classification: input.classification, state: "draft", preparedByUserId: req.user.id, preparedAt }).returning();
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "native_esign.jurisdiction_pack.prepared", targetType: "jurisdiction_pack", targetId: created.id, traceId: randomUUID(), correlationId: randomUUID(), result: "draft", details: { portfolioId: portfolio.id, packKey: created.packKey, packVersion, contentSha256, policyDecisionId: policy.decisionId } });
      return created;
    });
    res.status(201).json(pack);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/jurisdiction-packs/:packId/publish", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const operator = await requireCompanyOperator(req, companyId, "native_esign.jurisdiction_pack.publish");
    const input = nativeEsignJurisdictionPackPublicationSchema.parse(req.body);
    const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
    if (!company?.portfolioId || !operator.isFounder) throw new NativeEsignError(403, "native_esign_jurisdiction_pack_founder_required", "A company founder inside a portfolio is required to publish a jurisdiction pack.");
    const portfolio = await db.query.portfolios.findFirst({ where: and(eq(portfolios.id, company.portfolioId), eq(portfolios.ownerId, req.user.id)) });
    const pack = await db.query.eosEsignJurisdictionPacks.findFirst({ where: and(eq(eosEsignJurisdictionPacks.id, req.params.packId), eq(eosEsignJurisdictionPacks.portfolioId, company.portfolioId), eq(eosEsignJurisdictionPacks.sourceCompanyId, companyId), eq(eosEsignJurisdictionPacks.state, "draft")) });
    if (!portfolio || !pack) throw new NativeEsignError(404, "native_esign_jurisdiction_pack_not_found", "The draft jurisdiction pack is unavailable to this portfolio owner.");
    if (pack.contentSha256 !== input.expectedPackSha256) throw new NativeEsignError(409, "native_esign_jurisdiction_pack_changed", "The jurisdiction pack changed before publication. Refresh and review it again.");
    if (pack.nextReviewAt <= new Date().toISOString().slice(0, 10)) throw new NativeEsignError(409, "native_esign_jurisdiction_pack_review_required", "The next counsel-review date must remain in the future at publication.");
    const evidence = await requireVisibleVerifiedEvidence(companyId, input.reviewEvidenceId, operator.access); requireQualifiedCounselEvidence(evidence);
    const policy = await authorizeAction(req, operator.access, { authorityClass: "decide", resource: "jurisdiction_pack", actionKey: "native_esign.jurisdiction_pack.publish", purpose: "publish_counsel_attributed_jurisdiction_pack", classification: pack.classification, consequence: "material", targetSeatId: operator.access.seat.id });
    const publishedAt = new Date();
    const published = await db.transaction(async (tx) => {
      const [updated] = await tx.update(eosEsignJurisdictionPacks).set({ state: "published", reviewEvidenceId: evidence.id, reviewerName: input.reviewerName, reviewerOrganization: input.reviewerOrganization, reviewerCredentialReference: input.reviewerCredentialReference, publicationNote: input.publicationNote, publicationPolicyDecisionId: policy.decisionId, publishedByUserId: req.user.id, publishedAt }).where(and(eq(eosEsignJurisdictionPacks.id, pack.id), eq(eosEsignJurisdictionPacks.state, "draft"), eq(eosEsignJurisdictionPacks.contentSha256, input.expectedPackSha256))).returning();
      if (!updated) throw new NativeEsignError(409, "native_esign_jurisdiction_pack_changed", "The jurisdiction pack changed before publication. Refresh and review it again.");
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "native_esign.jurisdiction_pack.published", targetType: "jurisdiction_pack", targetId: updated.id, traceId: randomUUID(), correlationId: randomUUID(), result: "published", details: { portfolioId: portfolio.id, contentSha256: updated.contentSha256, reviewEvidenceId: evidence.id, reviewerName: input.reviewerName, reviewerOrganization: input.reviewerOrganization, reviewerCredentialReference: input.reviewerCredentialReference, policyDecisionId: policy.decisionId, credentialVerification: "external_claim_not_verified_by_eos" } });
      return updated;
    });
    res.json(published);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/jurisdiction-packs/:packId/applicability-decisions", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const operator = await requireCompanyOperator(req, companyId, "native_esign.jurisdiction_pack.applicability_decide");
    const input = nativeEsignJurisdictionApplicabilityDecisionSchema.parse(req.body);
    const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
    if (!company?.portfolioId || !operator.isFounder) throw new NativeEsignError(403, "native_esign_jurisdiction_applicability_founder_required", "The company founder must record the company-specific jurisdiction applicability decision.");
    const pack = await db.query.eosEsignJurisdictionPacks.findFirst({ where: and(eq(eosEsignJurisdictionPacks.id, req.params.packId), eq(eosEsignJurisdictionPacks.portfolioId, company.portfolioId), eq(eosEsignJurisdictionPacks.state, "published")) });
    if (!pack || !mayAccessClassification(operator.access, pack.classification)) throw new NativeEsignError(404, "native_esign_jurisdiction_pack_not_found", "The published jurisdiction pack is unavailable in this company's scope.");
    if (pack.contentSha256 !== input.expectedPackSha256) throw new NativeEsignError(409, "native_esign_jurisdiction_pack_changed", "The jurisdiction pack changed before the company decision. Refresh and review it again.");
    requireCurrentJurisdictionPack(pack);
    const evidence = await requireVisibleVerifiedEvidence(companyId, input.reviewEvidenceId, operator.access); requireQualifiedCounselEvidence(evidence);
    const policy = await authorizeAction(req, operator.access, { authorityClass: "decide", resource: "jurisdiction_pack_applicability", actionKey: "native_esign.jurisdiction_pack.applicability_decide", purpose: "record_company_specific_counsel_applicability", classification: pack.classification, consequence: "material", targetSeatId: operator.access.seat.id });
    const id = randomUUID(); const decidedAt = new Date();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`jurisdiction-applicability:${pack.id}:${companyId}`}))`);
      const existing = await tx.query.eosEsignJurisdictionPackApplicabilityDecisions.findFirst({ where: and(eq(eosEsignJurisdictionPackApplicabilityDecisions.packId, pack.id), eq(eosEsignJurisdictionPackApplicabilityDecisions.companyId, companyId)) });
      if (existing) throw new NativeEsignError(409, "native_esign_jurisdiction_applicability_already_decided", "This company already recorded an immutable applicability decision for this pack version.");
      const decisionSha256 = nativeContractContentSha256({ schemaVersion: "eos-jurisdiction-applicability.v1", id, portfolioId: pack.portfolioId, companyId, packId: pack.id, packSha256: pack.contentSha256, outcome: input.outcome, factsConsidered: input.factsConsidered, decisionRationale: input.decisionRationale, reviewEvidenceId: evidence.id, reviewerName: input.reviewerName, reviewerOrganization: input.reviewerOrganization, reviewerCredentialReference: input.reviewerCredentialReference, policyDecisionId: policy.decisionId, decidedByUserId: req.user.id, decidedAt: decidedAt.toISOString() });
      const [decision] = await tx.insert(eosEsignJurisdictionPackApplicabilityDecisions).values({ id, packId: pack.id, portfolioId: pack.portfolioId, companyId, packSha256: pack.contentSha256, outcome: input.outcome, factsConsidered: input.factsConsidered, decisionRationale: input.decisionRationale, reviewEvidenceId: evidence.id, reviewerName: input.reviewerName, reviewerOrganization: input.reviewerOrganization, reviewerCredentialReference: input.reviewerCredentialReference, policyDecisionId: policy.decisionId, decisionSha256, decidedByUserId: req.user.id, decidedAt }).returning();
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "native_esign.jurisdiction_pack.applicability_decided", targetType: "jurisdiction_pack_applicability", targetId: decision.id, traceId: randomUUID(), correlationId: randomUUID(), result: input.outcome, details: { portfolioId: pack.portfolioId, packId: pack.id, packSha256: pack.contentSha256, decisionSha256, reviewEvidenceId: evidence.id, reviewerName: input.reviewerName, reviewerOrganization: input.reviewerOrganization, reviewerCredentialReference: input.reviewerCredentialReference, policyDecisionId: policy.decisionId, credentialVerification: "external_claim_not_verified_by_eos" } });
      return decision;
    });
    res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/jurisdiction-packs/:packId/withdraw", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const operator = await requireCompanyOperator(req, companyId, "native_esign.jurisdiction_pack.withdraw");
    const input = nativeEsignJurisdictionPackWithdrawalSchema.parse(req.body);
    const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
    if (!company?.portfolioId || !operator.isFounder) throw new NativeEsignError(403, "native_esign_jurisdiction_pack_founder_required", "A company founder inside a portfolio is required to withdraw a jurisdiction pack.");
    const portfolio = await db.query.portfolios.findFirst({ where: and(eq(portfolios.id, company.portfolioId), eq(portfolios.ownerId, req.user.id)) });
    const pack = await db.query.eosEsignJurisdictionPacks.findFirst({ where: and(eq(eosEsignJurisdictionPacks.id, req.params.packId), eq(eosEsignJurisdictionPacks.portfolioId, company.portfolioId), eq(eosEsignJurisdictionPacks.sourceCompanyId, companyId), eq(eosEsignJurisdictionPacks.state, "published")) });
    if (!portfolio || !pack) throw new NativeEsignError(404, "native_esign_jurisdiction_pack_not_found", "The published jurisdiction pack is unavailable to this portfolio owner.");
    if (pack.contentSha256 !== input.expectedPackSha256) throw new NativeEsignError(409, "native_esign_jurisdiction_pack_changed", "The jurisdiction pack changed before withdrawal. Refresh and review it again.");
    const policy = await authorizeAction(req, operator.access, { authorityClass: "decide", resource: "jurisdiction_pack", actionKey: "native_esign.jurisdiction_pack.withdraw", purpose: "withdraw_portfolio_jurisdiction_pack", classification: pack.classification, consequence: "material", targetSeatId: operator.access.seat.id });
    const withdrawnAt = new Date();
    const withdrawn = await db.transaction(async (tx) => {
      const [updated] = await tx.update(eosEsignJurisdictionPacks).set({ state: "withdrawn", withdrawnByUserId: req.user.id, withdrawnAt, withdrawalReason: input.reason }).where(and(eq(eosEsignJurisdictionPacks.id, pack.id), eq(eosEsignJurisdictionPacks.state, "published"), eq(eosEsignJurisdictionPacks.contentSha256, input.expectedPackSha256))).returning();
      if (!updated) throw new NativeEsignError(409, "native_esign_jurisdiction_pack_changed", "The jurisdiction pack changed before withdrawal. Refresh and review it again.");
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "native_esign.jurisdiction_pack.withdrawn", targetType: "jurisdiction_pack", targetId: updated.id, traceId: randomUUID(), correlationId: randomUUID(), result: "withdrawn", details: { portfolioId: portfolio.id, contentSha256: pack.contentSha256, reason: input.reason, policyDecisionId: policy.decisionId } });
      return updated;
    });
    res.json(withdrawn);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/portfolio-template-proposals", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const operator = await requireCompanyOperator(req, companyId, "native_esign.portfolio_template.propose");
    const input = nativeEsignPortfolioTemplateProposalSchema.parse(req.body);
    const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
    if (!company?.portfolioId || !operator.isFounder) throw new NativeEsignError(403, "native_esign_portfolio_proposal_founder_required", "A company founder inside a portfolio is required to propose contract content.");
    const portfolio = await db.query.portfolios.findFirst({ where: and(eq(portfolios.id, company.portfolioId), eq(portfolios.ownerId, req.user.id)) });
    if (!portfolio) throw new NativeEsignError(403, "native_esign_portfolio_owner_required", "Only the portfolio owner can publish a portfolio contract proposal.");
    if (!mayAccessClassification(operator.access, input.classification)) throw new NativeEsignError(403, "native_esign_portfolio_proposal_classification_forbidden", "The proposal classification exceeds this operator's disclosure ceiling.");
    const evidence = await requireVisibleVerifiedEvidence(companyId, input.reviewEvidenceId, operator.access);
    if (input.reviewAuthority === "qualified_counsel") requireQualifiedCounselEvidence(evidence);
    const jurisdictionPack = input.jurisdictionPackId ? await db.query.eosEsignJurisdictionPacks.findFirst({ where: and(eq(eosEsignJurisdictionPacks.id, input.jurisdictionPackId), eq(eosEsignJurisdictionPacks.portfolioId, portfolio.id), eq(eosEsignJurisdictionPacks.state, "published")) }) : null;
    if (input.jurisdictionPackId && (!jurisdictionPack || !mayAccessClassification(operator.access, jurisdictionPack.classification))) throw new NativeEsignError(409, "native_esign_jurisdiction_pack_invalid", "A proposal may cite only a visible, published jurisdiction pack from the same portfolio.");
    if (jurisdictionPack) requireCurrentJurisdictionPack(jurisdictionPack);
    const [source] = await db.select({ version: eosEsignTemplateVersions, template: eosEsignTemplates }).from(eosEsignTemplateVersions)
      .innerJoin(eosEsignTemplates, eq(eosEsignTemplates.id, eosEsignTemplateVersions.templateId))
      .where(and(eq(eosEsignTemplateVersions.id, input.sourceTemplateVersionId), eq(eosEsignTemplateVersions.companyId, companyId), eq(eosEsignTemplateVersions.state, "approved"), eq(eosEsignTemplates.state, "active"))).limit(1);
    if (!source) throw new NativeEsignError(409, "native_esign_portfolio_proposal_source_invalid", "Only an approved active company template can become a portfolio proposal.");
    const clauseIds = Array.isArray(source.version.clauseVersionIds) ? source.version.clauseVersionIds.map(String) : [];
    const clauseRows = clauseIds.length ? await db.select({ version: eosEsignClauseVersions, clause: eosEsignClauses }).from(eosEsignClauseVersions).innerJoin(eosEsignClauses, eq(eosEsignClauses.id, eosEsignClauseVersions.clauseId)).where(and(eq(eosEsignClauseVersions.companyId, companyId), inArray(eosEsignClauseVersions.id, clauseIds), inArray(eosEsignClauseVersions.state, ["approved", "superseded"]))) : [];
    if (clauseRows.length !== clauseIds.length) throw new NativeEsignError(409, "native_esign_portfolio_proposal_clause_invalid", "Every snapshotted source clause must remain available in the source company.");
    const clauseSnapshot = clauseRows.map(({ clause, version }) => ({ clauseKey: clause.clauseKey, name: clause.name, versionLabel: version.versionLabel, bodyText: version.bodyText, bodySha256: version.bodySha256 }));
    const bodyTemplate = flattenPortfolioTemplateClauses(source.version.bodyTemplate, clauseSnapshot);
    const variables = nativeEsignTemplateVariableSchema.array().parse(source.version.variableSchema);
    const recipients = nativeEsignTemplateRecipientSchema.array().parse(source.version.recipientSchema);
    const policy = await authorizeAction(req, operator.access, { authorityClass: "execute", resource: "portfolio_contract_proposal", actionKey: "native_esign.portfolio_template.propose", purpose: "publish_nonbinding_portfolio_contract_proposal", classification: input.classification, consequence: "material", targetSeatId: operator.access.seat.id });
    const proposalId = randomUUID(); const createdAt = new Date();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`portfolio-contract-proposal:${portfolio.id}:${input.proposalKey}`}))`);
      const [latest] = await tx.select({ value: sql<number>`COALESCE(MAX(${eosEsignPortfolioTemplateProposals.proposalVersion}), 0)` }).from(eosEsignPortfolioTemplateProposals).where(and(eq(eosEsignPortfolioTemplateProposals.portfolioId, portfolio.id), eq(eosEsignPortfolioTemplateProposals.proposalKey, input.proposalKey)));
      const proposalVersion = Number(latest?.value || 0) + 1;
      const proposalSha256 = nativeContractContentSha256({ schemaVersion: "eos-portfolio-contract-proposal.v2", portfolioId: portfolio.id, proposalKey: input.proposalKey, name: source.template.name, description: source.template.description, sourceVersionLabel: source.version.versionLabel, jurisdiction: input.jurisdiction, applicabilitySummary: input.applicabilitySummary, limitations: input.limitations, titleTemplate: source.version.titleTemplate, bodyTemplate, variableSchema: variables, recipientSchema: recipients, clauseSnapshot, sourceContentSha256: source.version.contentSha256, reviewEvidenceId: evidence.id, reviewAuthority: input.reviewAuthority, jurisdictionPackId: jurisdictionPack?.id || null, jurisdictionPackSha256: jurisdictionPack?.contentSha256 || null, classification: input.classification });
      const [proposal] = await tx.insert(eosEsignPortfolioTemplateProposals).values({ id: proposalId, portfolioId: portfolio.id, sourceCompanyId: companyId, sourceTemplateVersionId: source.version.id, proposalKey: input.proposalKey, proposalVersion, name: source.template.name, description: source.template.description, sourceVersionLabel: source.version.versionLabel, jurisdiction: input.jurisdiction, applicabilitySummary: input.applicabilitySummary, limitations: input.limitations, titleTemplate: source.version.titleTemplate, bodyTemplate, variableSchema: variables, recipientSchema: recipients, clauseSnapshot, sourceContentSha256: source.version.contentSha256, proposalSha256, reviewEvidenceId: evidence.id, reviewAuthority: input.reviewAuthority, jurisdictionPackId: jurisdictionPack?.id || null, jurisdictionPackSha256: jurisdictionPack?.contentSha256 || null, classification: input.classification, state: "proposed", createdByUserId: req.user.id, createdAt }).returning();
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "native_esign.portfolio_template.proposed", targetType: "portfolio_contract_proposal", targetId: proposal.id, traceId: randomUUID(), correlationId: randomUUID(), result: "proposed", details: { portfolioId: portfolio.id, proposalKey: proposal.proposalKey, proposalVersion, proposalSha256, reviewAuthority: input.reviewAuthority, policyDecisionId: policy.decisionId } });
      return proposal;
    });
    res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/portfolio-template-proposals/:proposalId/withdraw", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const operator = await requireCompanyOperator(req, companyId, "native_esign.portfolio_template.withdraw");
    const input = nativeEsignPortfolioTemplateWithdrawalSchema.parse(req.body);
    const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
    if (!company?.portfolioId || !operator.isFounder) throw new NativeEsignError(403, "native_esign_portfolio_proposal_founder_required", "A company founder inside a portfolio is required to withdraw a proposal.");
    const portfolio = await db.query.portfolios.findFirst({ where: and(eq(portfolios.id, company.portfolioId), eq(portfolios.ownerId, req.user.id)) });
    const proposal = await db.query.eosEsignPortfolioTemplateProposals.findFirst({ where: and(eq(eosEsignPortfolioTemplateProposals.id, req.params.proposalId), eq(eosEsignPortfolioTemplateProposals.portfolioId, company.portfolioId), eq(eosEsignPortfolioTemplateProposals.state, "proposed")) });
    if (!portfolio || !proposal) throw new NativeEsignError(404, "native_esign_portfolio_proposal_not_found", "The active portfolio proposal is unavailable to this owner.");
    if (proposal.proposalSha256 !== input.expectedProposalSha256) throw new NativeEsignError(409, "native_esign_portfolio_proposal_changed", "The proposal changed before withdrawal. Refresh and review it again.");
    const policy = await authorizeAction(req, operator.access, { authorityClass: "decide", resource: "portfolio_contract_proposal", actionKey: "native_esign.portfolio_template.withdraw", purpose: "withdraw_portfolio_contract_proposal", classification: proposal.classification, consequence: "material", targetSeatId: operator.access.seat.id });
    const withdrawnAt = new Date();
    const withdrawn = await db.transaction(async (tx) => {
      const [updated] = await tx.update(eosEsignPortfolioTemplateProposals).set({ state: "withdrawn", withdrawnByUserId: req.user.id, withdrawnAt, withdrawalReason: input.reason }).where(and(eq(eosEsignPortfolioTemplateProposals.id, proposal.id), eq(eosEsignPortfolioTemplateProposals.state, "proposed"), eq(eosEsignPortfolioTemplateProposals.proposalSha256, input.expectedProposalSha256))).returning();
      if (!updated) throw new NativeEsignError(409, "native_esign_portfolio_proposal_changed", "The proposal changed before withdrawal. Refresh and review it again.");
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: "native_esign.portfolio_template.withdrawn", targetType: "portfolio_contract_proposal", targetId: proposal.id, traceId: randomUUID(), correlationId: randomUUID(), result: "withdrawn", details: { portfolioId: portfolio.id, proposalSha256: proposal.proposalSha256, reason: input.reason, policyDecisionId: policy.decisionId } });
      return updated;
    });
    res.json(withdrawn);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/portfolio-template-proposals/:proposalId/adopt", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const operator = await requireCompanyOperator(req, companyId, "native_esign.portfolio_template.adopt");
    const input = nativeEsignPortfolioTemplateAdoptionSchema.parse(req.body);
    const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
    if (!company?.portfolioId || !operator.isFounder) throw new NativeEsignError(403, "native_esign_portfolio_adoption_founder_required", "The company founder must decide whether to adopt a portfolio contract proposal.");
    const proposal = await db.query.eosEsignPortfolioTemplateProposals.findFirst({ where: and(eq(eosEsignPortfolioTemplateProposals.id, req.params.proposalId), eq(eosEsignPortfolioTemplateProposals.portfolioId, company.portfolioId), eq(eosEsignPortfolioTemplateProposals.state, "proposed")) });
    if (!proposal || !mayAccessClassification(operator.access, proposal.classification)) throw new NativeEsignError(404, "native_esign_portfolio_proposal_not_found", "The active portfolio proposal is unavailable in this company's scope.");
    if (proposal.proposalSha256 !== input.expectedProposalSha256) throw new NativeEsignError(409, "native_esign_portfolio_proposal_changed", "The proposal changed before the company decision. Refresh and review it again.");
    const evidence = await requireVisibleVerifiedEvidence(companyId, input.reviewEvidenceId, operator.access);
    if (input.reviewAuthority === "qualified_counsel") requireQualifiedCounselEvidence(evidence);
    const applicability = proposal.jurisdictionPackId ? await db.query.eosEsignJurisdictionPackApplicabilityDecisions.findFirst({ where: and(eq(eosEsignJurisdictionPackApplicabilityDecisions.packId, proposal.jurisdictionPackId), eq(eosEsignJurisdictionPackApplicabilityDecisions.companyId, companyId), eq(eosEsignJurisdictionPackApplicabilityDecisions.packSha256, proposal.jurisdictionPackSha256!)) }) : null;
    if (input.decision === "accepted" && proposal.jurisdictionPackId) {
      const currentPack = await db.query.eosEsignJurisdictionPacks.findFirst({ where: and(eq(eosEsignJurisdictionPacks.id, proposal.jurisdictionPackId), eq(eosEsignJurisdictionPacks.state, "published")) });
      if (!currentPack || currentPack.contentSha256 !== proposal.jurisdictionPackSha256) throw new NativeEsignError(409, "native_esign_jurisdiction_pack_unavailable", "The cited jurisdiction pack is withdrawn or no longer matches the proposal snapshot.");
      requireCurrentJurisdictionPack(currentPack);
    }
    if (input.decision === "accepted" && proposal.jurisdictionPackId && applicability?.outcome !== "applicable") throw new NativeEsignError(409, "native_esign_jurisdiction_applicability_required", "This company needs an immutable qualified-counsel applicability decision for the exact jurisdiction pack before accepting the proposal.");
    const policy = await authorizeAction(req, operator.access, { authorityClass: "decide", resource: "portfolio_contract_adoption", actionKey: "native_esign.portfolio_template.adopt", purpose: "decide_company_local_contract_proposal", classification: proposal.classification, consequence: "material", targetSeatId: operator.access.seat.id });
    const adoptionId = randomUUID(); const decidedAt = new Date(); const localTemplateId = input.decision === "accepted" ? randomUUID() : null; const localVersionId = input.decision === "accepted" ? randomUUID() : null;
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`portfolio-contract-adoption:${proposal.id}:${companyId}`}))`);
      const existing = await tx.query.eosEsignPortfolioTemplateAdoptions.findFirst({ where: and(eq(eosEsignPortfolioTemplateAdoptions.proposalId, proposal.id), eq(eosEsignPortfolioTemplateAdoptions.companyId, companyId)) });
      if (existing) throw new NativeEsignError(409, "native_esign_portfolio_proposal_already_decided", "This company already recorded an immutable decision for the proposal.");
      if (input.decision === "accepted") {
        const templateKey = `portfolio.${proposal.proposalKey}.${proposal.id.slice(0, 8)}`;
        await tx.insert(eosEsignTemplates).values({ id: localTemplateId!, companyId, templateKey, name: `${proposal.name} · portfolio proposal`, description: `${proposal.description}\n\nImported from portfolio proposal ${proposal.proposalKey} v${proposal.proposalVersion}. Local approval remains required.`, state: "active", createdByUserId: req.user.id, createdAt: decidedAt, updatedAt: decidedAt, version: 1 });
        const content = { titleTemplate: proposal.titleTemplate, bodyTemplate: proposal.bodyTemplate, variables: proposal.variableSchema, recipients: proposal.recipientSchema, clauseVersionIds: [] };
        await tx.insert(eosEsignTemplateVersions).values({ id: localVersionId!, companyId, templateId: localTemplateId!, versionLabel: `portfolio-${proposal.proposalVersion}.0`, titleTemplate: proposal.titleTemplate, bodyTemplate: proposal.bodyTemplate, variableSchema: proposal.variableSchema, recipientSchema: proposal.recipientSchema, fieldSchema: [], clauseVersionIds: [], contentSha256: nativeContractContentSha256(content), state: "draft", counselEvidenceId: applicability?.reviewEvidenceId || (input.reviewAuthority === "qualified_counsel" ? evidence.id : null), createdByUserId: req.user.id, createdAt: decidedAt });
      }
      const decisionSha256 = nativeContractContentSha256({ schemaVersion: "eos-portfolio-contract-adoption.v1", adoptionId, portfolioId: proposal.portfolioId, companyId, proposalId: proposal.id, proposalSha256: proposal.proposalSha256, decision: input.decision, decisionRationale: input.decisionRationale, reviewEvidenceId: evidence.id, reviewAuthority: input.reviewAuthority, localTemplateId, localTemplateVersionId: localVersionId, policyDecisionId: policy.decisionId, decidedByUserId: req.user.id, decidedAt: decidedAt.toISOString() });
      const [adoption] = await tx.insert(eosEsignPortfolioTemplateAdoptions).values({ id: adoptionId, proposalId: proposal.id, portfolioId: proposal.portfolioId, companyId, decision: input.decision, decisionRationale: input.decisionRationale, reviewEvidenceId: evidence.id, reviewAuthority: input.reviewAuthority, proposalSha256: proposal.proposalSha256, localTemplateId, localTemplateVersionId: localVersionId, policyDecisionId: policy.decisionId, decisionSha256, decidedByUserId: req.user.id, decidedAt }).returning();
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId, actorUserId: req.user.id, action: `native_esign.portfolio_template.${input.decision}`, targetType: "portfolio_contract_adoption", targetId: adoption.id, traceId: randomUUID(), correlationId: randomUUID(), result: input.decision, details: { portfolioId: proposal.portfolioId, proposalId: proposal.id, proposalSha256: proposal.proposalSha256, decisionSha256, reviewAuthority: input.reviewAuthority, localTemplateVersionId: localVersionId, policyDecisionId: policy.decisionId } });
      return adoption;
    });
    res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/clauses", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.clause.create");
    const input = nativeEsignClauseSchema.parse(req.body);
    const now = new Date();
    const [clause] = await db.insert(eosEsignClauses).values({ id: randomUUID(), companyId, ...input, state: "active", createdByUserId: req.user.id, createdAt: now, updatedAt: now, version: 1 }).returning();
    res.status(201).json(clause);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/clauses/:clauseId/versions", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.clause.version.create");
    const input = nativeEsignClauseVersionSchema.parse(req.body);
    const clause = await db.query.eosEsignClauses.findFirst({ where: and(eq(eosEsignClauses.id, req.params.clauseId), eq(eosEsignClauses.companyId, companyId), eq(eosEsignClauses.state, "active")) });
    if (!clause) throw new NativeEsignError(404, "native_esign_clause_not_found", "The active tenant-scoped clause is unavailable.");
    if (input.counselEvidenceId) {
      const evidence = await db.query.eosEvidence.findFirst({ where: and(eq(eosEvidence.id, input.counselEvidenceId), eq(eosEvidence.companyId, companyId), eq(eosEvidence.verificationState, "verified")) });
      if (!evidence) throw new NativeEsignError(409, "native_esign_counsel_evidence_invalid", "Counsel evidence must be verified and tenant-scoped.");
    }
    const [version] = await db.insert(eosEsignClauseVersions).values({ id: randomUUID(), companyId, clauseId: clause.id, versionLabel: input.versionLabel, bodyText: input.bodyText, bodySha256: nativeContractContentSha256(input.bodyText), state: "draft", counselEvidenceId: input.counselEvidenceId, createdByUserId: req.user.id, createdAt: new Date() }).returning();
    res.status(201).json(version);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/clause-versions/:versionId/approve", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const access = await requireCompanyOperator(req, companyId, "native_esign.clause.version.approve");
    if (!access.isFounder) throw new NativeEsignError(403, "native_esign_library_founder_required", "Founder authority is required to approve reusable legal content.");
    const input = nativeEsignLibraryApprovalSchema.parse(req.body);
    const current = await db.query.eosEsignClauseVersions.findFirst({ where: and(eq(eosEsignClauseVersions.id, req.params.versionId), eq(eosEsignClauseVersions.companyId, companyId)) });
    if (!current || current.state !== "draft") throw new NativeEsignError(409, "native_esign_clause_version_not_draft", "Only an unchanged draft clause version can be approved.");
    const now = new Date();
    const approved = await db.transaction(async (tx) => {
      await tx.update(eosEsignClauseVersions).set({ state: "superseded" }).where(and(eq(eosEsignClauseVersions.clauseId, current.clauseId), eq(eosEsignClauseVersions.state, "approved")));
      const [result] = await tx.update(eosEsignClauseVersions).set({ state: "approved", approvedByUserId: req.user.id, approvedAt: now }).where(and(eq(eosEsignClauseVersions.id, current.id), eq(eosEsignClauseVersions.state, "draft"))).returning();
      return result;
    });
    res.json({ ...approved, approvalReason: input.reason });
  }));

  app.post("/api/eos/companies/:companyId/native-esign/templates", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.template.create");
    const input = nativeEsignTemplateSchema.parse(req.body);
    const now = new Date();
    const [template] = await db.insert(eosEsignTemplates).values({ id: randomUUID(), companyId, ...input, state: "active", createdByUserId: req.user.id, createdAt: now, updatedAt: now, version: 1 }).returning();
    res.status(201).json(template);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/templates/:templateId/versions", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.template.version.create");
    const input = nativeEsignTemplateVersionSchema.parse(req.body);
    const template = await db.query.eosEsignTemplates.findFirst({ where: and(eq(eosEsignTemplates.id, req.params.templateId), eq(eosEsignTemplates.companyId, companyId), eq(eosEsignTemplates.state, "active")) });
    if (!template) throw new NativeEsignError(404, "native_esign_template_not_found", "The active tenant-scoped template is unavailable.");
    if (input.clauseVersionIds.length) {
      const clauses = await db.select().from(eosEsignClauseVersions).where(and(eq(eosEsignClauseVersions.companyId, companyId), inArray(eosEsignClauseVersions.id, input.clauseVersionIds), eq(eosEsignClauseVersions.state, "approved")));
      if (clauses.length !== input.clauseVersionIds.length) throw new NativeEsignError(409, "native_esign_template_clause_invalid", "Every referenced clause version must be approved and tenant-scoped.");
    }
    if (input.counselEvidenceId) {
      const evidence = await db.query.eosEvidence.findFirst({ where: and(eq(eosEvidence.id, input.counselEvidenceId), eq(eosEvidence.companyId, companyId), eq(eosEvidence.verificationState, "verified")) });
      if (!evidence) throw new NativeEsignError(409, "native_esign_counsel_evidence_invalid", "Counsel evidence must be verified and tenant-scoped.");
    }
    const content = { titleTemplate: input.titleTemplate, bodyTemplate: input.bodyTemplate, variables: input.variables, recipients: input.recipients, clauseVersionIds: input.clauseVersionIds };
    const [version] = await db.insert(eosEsignTemplateVersions).values({ id: randomUUID(), companyId, templateId: template.id, versionLabel: input.versionLabel, titleTemplate: input.titleTemplate, bodyTemplate: input.bodyTemplate, variableSchema: input.variables, recipientSchema: input.recipients, fieldSchema: [], clauseVersionIds: input.clauseVersionIds, contentSha256: nativeContractContentSha256(content), state: "draft", counselEvidenceId: input.counselEvidenceId, createdByUserId: req.user.id, createdAt: new Date() }).returning();
    res.status(201).json(version);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/template-versions/:versionId/approve", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const access = await requireCompanyOperator(req, companyId, "native_esign.template.version.approve");
    if (!access.isFounder) throw new NativeEsignError(403, "native_esign_library_founder_required", "Founder authority is required to approve reusable contract templates.");
    const input = nativeEsignLibraryApprovalSchema.parse(req.body);
    const current = await db.query.eosEsignTemplateVersions.findFirst({ where: and(eq(eosEsignTemplateVersions.id, req.params.versionId), eq(eosEsignTemplateVersions.companyId, companyId)) });
    if (!current || current.state !== "draft") throw new NativeEsignError(409, "native_esign_template_version_not_draft", "Only an unchanged draft template version can be approved.");
    const now = new Date();
    const approved = await db.transaction(async (tx) => {
      await tx.update(eosEsignTemplateVersions).set({ state: "superseded" }).where(and(eq(eosEsignTemplateVersions.templateId, current.templateId), eq(eosEsignTemplateVersions.state, "approved")));
      const [result] = await tx.update(eosEsignTemplateVersions).set({ state: "approved", approvedByUserId: req.user.id, approvedAt: now }).where(and(eq(eosEsignTemplateVersions.id, current.id), eq(eosEsignTemplateVersions.state, "draft"))).returning();
      return result;
    });
    res.json({ ...approved, approvalReason: input.reason });
  }));

  app.post("/api/eos/companies/:companyId/native-esign/counterparties", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.counterparty.create");
    const input = nativeEsignCounterpartySchema.parse(req.body);
    const now = new Date();
    const [party] = await db.insert(eosEsignCounterparties).values({ id: randomUUID(), companyId, ...input, state: "active", createdByUserId: req.user.id, createdAt: now, updatedAt: now, version: 1 }).returning();
    res.status(201).json(party);
  }));

  app.patch("/api/eos/companies/:companyId/native-esign/counterparties/:counterpartyId", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.counterparty.update");
    const input = nativeEsignCounterpartyUpdateSchema.parse(req.body);
    const [party] = await db.update(eosEsignCounterparties).set({ partyType: input.partyType, legalName: input.legalName, displayName: input.displayName, signerName: input.signerName, signerEmail: input.signerEmail, externalReference: input.externalReference, dataClassification: input.dataClassification, state: input.state, version: input.version + 1, updatedAt: new Date() }).where(and(eq(eosEsignCounterparties.id, req.params.counterpartyId), eq(eosEsignCounterparties.companyId, companyId), eq(eosEsignCounterparties.version, input.version))).returning();
    if (!party) throw new NativeEsignError(409, "native_esign_counterparty_changed", "The counterparty changed or is unavailable. Refresh and retry.");
    res.json(party);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/template-versions/:versionId/generate", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.template.generate");
    const input = nativeEsignTemplateGenerationSchema.parse(req.body);
    const [context] = await db.select({ version: eosEsignTemplateVersions, template: eosEsignTemplates }).from(eosEsignTemplateVersions).innerJoin(eosEsignTemplates, eq(eosEsignTemplates.id, eosEsignTemplateVersions.templateId)).where(and(eq(eosEsignTemplateVersions.id, req.params.versionId), eq(eosEsignTemplateVersions.companyId, companyId), eq(eosEsignTemplateVersions.state, "approved"), eq(eosEsignTemplates.state, "active"))).limit(1);
    if (!context) throw new NativeEsignError(409, "native_esign_template_not_approved", "Only an approved active tenant template can generate a document.");
    const clauseIds = Array.isArray(context.version.clauseVersionIds) ? context.version.clauseVersionIds.map(String) : [];
    const clauseRows = clauseIds.length ? await db.select({ version: eosEsignClauseVersions, clause: eosEsignClauses }).from(eosEsignClauseVersions).innerJoin(eosEsignClauses, eq(eosEsignClauses.id, eosEsignClauseVersions.clauseId)).where(and(eq(eosEsignClauseVersions.companyId, companyId), inArray(eosEsignClauseVersions.id, clauseIds), inArray(eosEsignClauseVersions.state, ["approved", "superseded"]))) : [];
    if (clauseRows.length !== clauseIds.length) throw new NativeEsignError(409, "native_esign_template_clause_unavailable", "A snapshotted clause version is no longer available in this tenant.");
    const variables = nativeEsignTemplateVariableSchema.array().parse(context.version.variableSchema);
    const recipients = nativeEsignTemplateRecipientSchema.array().parse(context.version.recipientSchema);
    if (input.counterpartyId) {
      const party = await db.query.eosEsignCounterparties.findFirst({ where: and(eq(eosEsignCounterparties.id, input.counterpartyId), eq(eosEsignCounterparties.companyId, companyId), eq(eosEsignCounterparties.state, "active")) });
      if (!party) throw new NativeEsignError(409, "native_esign_counterparty_unavailable", "The selected counterparty is not active in this tenant.");
    }
    if (input.workPacketId) {
      const packet = await db.query.eosWorkPackets.findFirst({ where: and(eq(eosWorkPackets.id, input.workPacketId), eq(eosWorkPackets.companyId, companyId)) });
      if (!packet) throw new NativeEsignError(409, "native_esign_work_packet_unavailable", "The selected Work Packet is not available in this tenant.");
    }
    let rendered;
    try { rendered = renderNativeContractText({ titleTemplate: context.version.titleTemplate, bodyTemplate: context.version.bodyTemplate, variableSchema: variables, values: input.values, clauses: clauseRows.map(({ version, clause }) => ({ clauseKey: clause.clauseKey, versionId: version.id, bodyText: version.bodyText, bodySha256: version.bodySha256 })) }); }
    catch (error) { throw new NativeEsignError(400, "native_esign_template_render_invalid", error instanceof Error ? error.message.replace(/^native_esign_[^:]+:/, "") : "Template variables could not be rendered."); }
    const id = randomUUID();
    const generationReference = `eos:${companyId}:template:${context.version.id}:document:${id}`;
    const generated = await renderNativeContractPdf({ title: rendered.title, body: rendered.body, recipients, generationReference });
    const metadata = await inspectNativeEsignPdf(generated.pdf);
    const storageKey = nativeEsignSourceStorageKey(companyId, id);
    await storeNativeEsignArtifact(storageKey, generated.pdf);
    try {
      const document = await db.transaction(async (tx) => {
        const now = new Date();
        const [created] = await tx.insert(eosEsignDocumentVersions).values({ id, companyId, documentKey: `${context.template.templateKey}.${id}`, documentVersion: input.documentVersion || context.version.versionLabel, title: rendered.title, sourceReference: generationReference, sourceStorageKey: storageKey, sourceSha256: metadata.sha256, mimeType: metadata.mimeType, sizeBytes: metadata.sizeBytes, pageCount: generated.pageCount, fieldSchema: generated.fields, counselEvidenceId: context.version.counselEvidenceId, templateVersionId: context.version.id, counterpartyId: input.counterpartyId, workPacketId: input.workPacketId, generationSnapshot: { ...rendered.snapshot, templateContentSha256: context.version.contentSha256, generatedAt: now.toISOString() }, createdByUserId: req.user.id, createdAt: now }).returning();
        await registerNativeEsignArtifact(tx, { companyId, documentVersionId: id, artifactKind: "source_pdf", storageKey, sha256: metadata.sha256, sizeBytes: metadata.sizeBytes, mimeType: metadata.mimeType, createdAt: now });
        return created;
      });
      res.status(201).json(document);
    } catch (error) { await removeNativeEsignArtifact(storageKey).catch(() => undefined); throw error; }
  }));

  app.get("/api/eos/companies/:companyId/native-esign/documents", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyReader(req, companyId, "native_esign.document.list");
    const documents = await db.select().from(eosEsignDocumentVersions)
      .where(eq(eosEsignDocumentVersions.companyId, companyId))
      .orderBy(desc(eosEsignDocumentVersions.createdAt));
    const comparisons = await db.select().from(eosEsignDocumentComparisons)
      .where(eq(eosEsignDocumentComparisons.companyId, companyId))
      .orderBy(desc(eosEsignDocumentComparisons.createdAt));
    res.json(documents.map((document) => ({ ...document, comparison: comparisons.find((item) => item.targetDocumentVersionId === document.id) || null })));
  }));

  app.post("/api/eos/companies/:companyId/native-esign/documents",
    express.raw({ type: "application/pdf", limit: NATIVE_ESIGN_MAX_DOCUMENT_BYTES }),
    route(async (req, res) => {
      const companyId = Number(req.params.companyId);
      await requireCompanyOperator(req, companyId, "native_esign.document.register");
      if (!Buffer.isBuffer(req.body)) throw new NativeEsignError(400, "native_esign_pdf_required", "Upload a PDF document body.");
      const fieldsHeader = String(req.headers["x-eos-field-schema"] || "");
      let fields: unknown[] = [];
      if (fieldsHeader) {
        try { fields = JSON.parse(Buffer.from(fieldsHeader, "base64url").toString("utf8")); }
        catch { throw new NativeEsignError(400, "native_esign_field_schema_invalid", "The field schema header must be base64url-encoded JSON."); }
      }
      const input = nativeEsignDocumentRegistrationSchema.parse({ ...req.query, fields });
      if (!input.fields.some((field) => field.type === "signature" && field.required))
        throw new NativeEsignError(400, "native_esign_signature_field_required", "A native signing document requires at least one visible, required signature field.");
      const missingSignatureRoles = nativeEsignRolesMissingRequiredSignature(input.fields);
      if (missingSignatureRoles.length)
        throw new NativeEsignError(400, "native_esign_recipient_signature_field_missing", `Every authored recipient role requires a visible, required signature field. Missing: ${missingSignatureRoles.join(", ")}.`);
      let boundedMetadata: ReturnType<typeof validateNativeEsignPdf>;
      try {
        boundedMetadata = validateNativeEsignPdf(req.body);
      } catch {
        throw new NativeEsignError(400, "native_esign_pdf_invalid", "Upload a readable, non-encrypted PDF with at least one page.");
      }
      await requireCleanUploadedArtifact(
        req.body,
        boundedMetadata.mimeType,
        boundedMetadata.sha256,
      );
      let metadata;
      try { metadata = await inspectNativeEsignPdf(req.body); }
      catch { throw new NativeEsignError(400, "native_esign_pdf_invalid", "Upload a readable, non-encrypted PDF with at least one page."); }
      if (input.fields.some((field) => field.page > metadata.pageCount))
        throw new NativeEsignError(400, "native_esign_field_page_invalid", "Every signing field must be placed on a page in the uploaded PDF.");
      if (input.counselEvidenceId) {
        const evidence = await db.query.eosEvidence.findFirst({ where: and(eq(eosEvidence.id, input.counselEvidenceId), eq(eosEvidence.companyId, companyId), eq(eosEvidence.verificationState, "verified")) });
        if (!evidence) throw new NativeEsignError(409, "native_esign_counsel_evidence_invalid", "Counsel evidence must be verified and tenant-scoped.");
      }
      const id = randomUUID();
      const storageKey = nativeEsignSourceStorageKey(companyId, id);
      await storeNativeEsignArtifact(storageKey, req.body);
      let document;
      try {
        document = await db.transaction(async (tx) => {
          const createdAt = new Date();
          const [created] = await tx.insert(eosEsignDocumentVersions).values({
            id, companyId, documentKey: input.documentKey, documentVersion: input.documentVersion,
            title: input.title, sourceReference: input.sourceReference, sourceStorageKey: storageKey,
            sourceSha256: metadata.sha256, mimeType: metadata.mimeType, sizeBytes: metadata.sizeBytes, pageCount: metadata.pageCount,
            fieldSchema: input.fields, counselEvidenceId: input.counselEvidenceId,
            createdByUserId: req.user.id, createdAt,
          }).returning();
          await registerNativeEsignArtifact(tx, {
            companyId, documentVersionId: id, artifactKind: "source_pdf", storageKey,
            sha256: metadata.sha256, sizeBytes: metadata.sizeBytes, mimeType: metadata.mimeType, createdAt,
          });
          return created;
        });
      } catch (error) {
        await removeNativeEsignArtifact(storageKey).catch(() => undefined);
        throw error;
      }
      res.status(201).json(document);
    }),
  );

  app.post("/api/eos/companies/:companyId/native-esign/documents/:sourceDocumentVersionId/revisions",
    express.raw({ type: "application/pdf", limit: NATIVE_ESIGN_MAX_DOCUMENT_BYTES }),
    route(async (req, res) => {
      const companyId = Number(req.params.companyId);
      await requireCompanyOperator(req, companyId, "native_esign.document.revise");
      if (!Buffer.isBuffer(req.body)) throw new NativeEsignError(400, "native_esign_pdf_required", "Upload the revised PDF document body.");
      let metadataInput: Record<string, unknown>; let fields: unknown[] = [];
      try { metadataInput = JSON.parse(Buffer.from(String(req.headers["x-eos-revision-metadata"] || ""), "base64url").toString("utf8")); }
      catch { throw new NativeEsignError(400, "native_esign_revision_metadata_invalid", "Revision metadata must be base64url-encoded JSON."); }
      const fieldsHeader = String(req.headers["x-eos-field-schema"] || "");
      if (fieldsHeader) {
        try { fields = JSON.parse(Buffer.from(fieldsHeader, "base64url").toString("utf8")); }
        catch { throw new NativeEsignError(400, "native_esign_field_schema_invalid", "The field schema header must be base64url-encoded JSON."); }
      }
      const input = nativeEsignDocumentRevisionSchema.parse({ ...metadataInput, fields });
      if (!input.fields.some((field) => field.type === "signature" && field.required))
        throw new NativeEsignError(400, "native_esign_signature_field_required", "A revised signing document requires at least one visible, required signature field.");
      const missingSignatureRoles = nativeEsignRolesMissingRequiredSignature(input.fields);
      if (missingSignatureRoles.length)
        throw new NativeEsignError(400, "native_esign_recipient_signature_field_missing", `Every authored recipient role requires a visible, required signature field. Missing: ${missingSignatureRoles.join(", ")}.`);
      const source = await db.query.eosEsignDocumentVersions.findFirst({ where: and(eq(eosEsignDocumentVersions.id, req.params.sourceDocumentVersionId), eq(eosEsignDocumentVersions.companyId, companyId)) });
      if (!source) throw new NativeEsignError(404, "native_esign_document_not_found", "The source document version is not available in this company.");
      let negotiation: typeof eosEsignNegotiations.$inferSelect | undefined;
      if (input.negotiationId) {
        negotiation = await db.query.eosEsignNegotiations.findFirst({ where: and(eq(eosEsignNegotiations.id, input.negotiationId), eq(eosEsignNegotiations.companyId, companyId), eq(eosEsignNegotiations.state, "open")) });
        if (!negotiation) throw new NativeEsignError(409, "native_esign_negotiation_unavailable", "The open tenant negotiation is unavailable for this revision.");
        const sourceEnvelope = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, negotiation.envelopeId), eq(eosEsignEnvelopes.companyId, companyId), eq(eosEsignEnvelopes.documentVersionId, source.id)) });
        if (!sourceEnvelope) throw new NativeEsignError(409, "native_esign_revision_source_mismatch", "The negotiation does not govern this source document version.");
      }
      let boundedMetadata: ReturnType<typeof validateNativeEsignPdf>;
      try {
        boundedMetadata = validateNativeEsignPdf(req.body);
      }
      catch { throw new NativeEsignError(400, "native_esign_pdf_invalid", "Upload a readable, non-encrypted PDF with at least one page."); }
      await requireCleanUploadedArtifact(req.body, boundedMetadata.mimeType, boundedMetadata.sha256);
      let pdfMetadata;
      try { pdfMetadata = await inspectNativeEsignPdf(req.body); }
      catch { throw new NativeEsignError(400, "native_esign_pdf_invalid", "Upload a readable, non-encrypted PDF with at least one page."); }
      if (input.fields.some((field) => field.page > pdfMetadata.pageCount))
        throw new NativeEsignError(400, "native_esign_field_page_invalid", "Every signing field must be placed on a page in the revised PDF.");
      const id = randomUUID(); const comparisonId = randomUUID(); const createdAt = new Date();
      const revisionEvidenceSha256 = nativeContractContentSha256({ schemaVersion: "eos-native-esign-document-revision.v1", sourceDocumentVersionId: source.id, sourceSha256: source.sourceSha256, targetDocumentVersionId: id, targetSha256: pdfMetadata.sha256, revisionSummary: input.revisionSummary, declaredChanges: input.declaredChanges, fieldSchema: input.fields });
      const comparisonSha256 = nativeContractContentSha256({ schemaVersion: "eos-native-esign-document-comparison.v1", comparisonId, sourceDocumentVersionId: source.id, targetDocumentVersionId: id, sourceSha256: source.sourceSha256, targetSha256: pdfMetadata.sha256, revisionSummary: input.revisionSummary, declaredChanges: input.declaredChanges, createdAt: createdAt.toISOString() });
      const storageKey = nativeEsignSourceStorageKey(companyId, id);
      await storeNativeEsignArtifact(storageKey, req.body);
      try {
        const result = await db.transaction(async (tx) => {
          const [document] = await tx.insert(eosEsignDocumentVersions).values({ id, companyId, documentKey: source.documentKey, documentVersion: input.documentVersion, title: input.title, sourceReference: input.sourceReference, sourceStorageKey: storageKey, sourceSha256: pdfMetadata.sha256, mimeType: pdfMetadata.mimeType, sizeBytes: pdfMetadata.sizeBytes, pageCount: pdfMetadata.pageCount, fieldSchema: input.fields, counselEvidenceId: source.counselEvidenceId, templateVersionId: source.templateVersionId, counterpartyId: source.counterpartyId, workPacketId: source.workPacketId, generationSnapshot: { parentDocumentVersionId: source.id, parentGenerationSnapshot: source.generationSnapshot }, parentDocumentVersionId: source.id, negotiationId: negotiation?.id, revisionSummary: input.revisionSummary, revisionEvidenceSha256, createdByUserId: req.user.id, createdAt }).returning();
          const [comparison] = await tx.insert(eosEsignDocumentComparisons).values({ id: comparisonId, companyId, sourceDocumentVersionId: source.id, targetDocumentVersionId: id, negotiationId: negotiation?.id, comparisonType: "operator_declared", sourceSha256: source.sourceSha256, targetSha256: pdfMetadata.sha256, revisionSummary: input.revisionSummary, declaredChanges: input.declaredChanges, comparisonSha256, createdByUserId: req.user.id, createdAt }).returning();
          await registerNativeEsignArtifact(tx, { companyId, documentVersionId: id, artifactKind: "source_pdf", storageKey, sha256: pdfMetadata.sha256, sizeBytes: pdfMetadata.sizeBytes, mimeType: pdfMetadata.mimeType, createdAt });
          if (negotiation) {
            await appendAuditEvent(tx, { companyId, envelopeId: negotiation.envelopeId, eventType: "document_revision_registered", actorType: "operator", actorReference: req.user.id, eventProjection: { negotiationId: negotiation.id, sourceDocumentVersionId: source.id, targetDocumentVersionId: id, sourceSha256: source.sourceSha256, targetSha256: pdfMetadata.sha256, revisionEvidenceSha256 } });
            await appendAuditEvent(tx, { companyId, envelopeId: negotiation.envelopeId, eventType: "document_comparison_recorded", actorType: "operator", actorReference: req.user.id, eventProjection: { comparisonId, comparisonSha256, comparisonType: "operator_declared" } });
          }
          return { ...document, comparison };
        });
        res.status(201).json(result);
      } catch (error) { await removeNativeEsignArtifact(storageKey).catch(() => undefined); throw error; }
    }),
  );

  app.post("/api/eos/companies/:companyId/native-esign/documents/:sourceDocumentVersionId/generated-revisions", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.document.semantic_revise");
    const input = nativeEsignGeneratedRevisionSchema.parse(req.body);
    const source = await db.query.eosEsignDocumentVersions.findFirst({ where: and(eq(eosEsignDocumentVersions.id, req.params.sourceDocumentVersionId), eq(eosEsignDocumentVersions.companyId, companyId)) });
    if (!source) throw new NativeEsignError(404, "native_esign_document_not_found", "The source document version is not available in this company.");
    const sourceContext = await reconstructGeneratedDocumentText(companyId, source);
    const [targetContext] = await db.select({ version: eosEsignTemplateVersions, template: eosEsignTemplates })
      .from(eosEsignTemplateVersions)
      .innerJoin(eosEsignTemplates, eq(eosEsignTemplates.id, eosEsignTemplateVersions.templateId))
      .where(and(eq(eosEsignTemplateVersions.id, input.templateVersionId), eq(eosEsignTemplateVersions.companyId, companyId), eq(eosEsignTemplateVersions.state, "approved"), eq(eosEsignTemplates.state, "active")))
      .limit(1);
    if (!targetContext || targetContext.version.templateId !== sourceContext.version.templateId)
      throw new NativeEsignError(409, "native_esign_revision_template_lineage_invalid", "Choose an approved version of the same governed template used by the source agreement.");
    let negotiation: typeof eosEsignNegotiations.$inferSelect | undefined;
    if (input.negotiationId) {
      negotiation = await db.query.eosEsignNegotiations.findFirst({ where: and(eq(eosEsignNegotiations.id, input.negotiationId), eq(eosEsignNegotiations.companyId, companyId), eq(eosEsignNegotiations.state, "open")) });
      if (!negotiation) throw new NativeEsignError(409, "native_esign_negotiation_unavailable", "The open tenant negotiation is unavailable for this revision.");
      const sourceEnvelope = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, negotiation.envelopeId), eq(eosEsignEnvelopes.companyId, companyId), eq(eosEsignEnvelopes.documentVersionId, source.id)) });
      if (!sourceEnvelope) throw new NativeEsignError(409, "native_esign_revision_source_mismatch", "The negotiation does not govern this source document version.");
    }
    const target = await renderGovernedTemplateVersion(companyId, targetContext.version, input.values);
    assertExactRecipientRoles(nativeEsignFieldSchema.array().parse(source.fieldSchema), target.recipients);
    const semanticDiff = compareNativeContractText(sourceContext.rendered, target.rendered);
    if (!semanticDiff.stats.insertedLines && !semanticDiff.stats.deletedLines)
      throw new NativeEsignError(409, "native_esign_revision_has_no_text_change", "The selected template values produce the same agreement text as the source version.");

    const id = randomUUID();
    const comparisonId = randomUUID();
    const createdAt = new Date();
    const generationReference = `eos:${companyId}:template:${targetContext.version.id}:revision:${id}`;
    const generated = await renderNativeContractPdf({ title: target.rendered.title, body: target.rendered.body, recipients: target.recipients, generationReference });
    const metadata = await inspectNativeEsignPdf(generated.pdf);
    const declaredChanges = [`Machine-computed exact text diff: ${semanticDiff.stats.deletedLines} deleted line(s), ${semanticDiff.stats.insertedLines} inserted line(s).`];
    const revisionEvidenceSha256 = nativeContractContentSha256({ schemaVersion: "eos-native-esign-generated-revision.v1", sourceDocumentVersionId: source.id, sourceSha256: source.sourceSha256, targetDocumentVersionId: id, targetSha256: metadata.sha256, targetTemplateVersionId: targetContext.version.id, targetTemplateContentSha256: targetContext.version.contentSha256, revisionSummary: input.revisionSummary, semanticDiff, fieldSchema: generated.fields });
    const comparisonSha256 = nativeContractContentSha256({ schemaVersion: "eos-native-esign-document-comparison.v2", comparisonId, sourceDocumentVersionId: source.id, targetDocumentVersionId: id, sourceSha256: source.sourceSha256, targetSha256: metadata.sha256, revisionSummary: input.revisionSummary, comparisonType: "generated_text", semanticDiff, createdAt: createdAt.toISOString() });
    const storageKey = nativeEsignSourceStorageKey(companyId, id);
    await storeNativeEsignArtifact(storageKey, generated.pdf);
    try {
      const result = await db.transaction(async (tx) => {
        const [document] = await tx.insert(eosEsignDocumentVersions).values({
          id, companyId, documentKey: source.documentKey, documentVersion: input.documentVersion,
          title: target.rendered.title, sourceReference: generationReference, sourceStorageKey: storageKey,
          sourceSha256: metadata.sha256, mimeType: metadata.mimeType, sizeBytes: metadata.sizeBytes, pageCount: metadata.pageCount,
          fieldSchema: generated.fields, counselEvidenceId: targetContext.version.counselEvidenceId,
          templateVersionId: targetContext.version.id, counterpartyId: source.counterpartyId, workPacketId: source.workPacketId,
          generationSnapshot: { ...target.rendered.snapshot, templateContentSha256: targetContext.version.contentSha256, generatedAt: createdAt.toISOString(), parentDocumentVersionId: source.id, semanticComparisonSha256: comparisonSha256 },
          parentDocumentVersionId: source.id, negotiationId: negotiation?.id, revisionSummary: input.revisionSummary,
          revisionEvidenceSha256, createdByUserId: req.user.id, createdAt,
        }).returning();
        const [comparison] = await tx.insert(eosEsignDocumentComparisons).values({
          id: comparisonId, companyId, sourceDocumentVersionId: source.id, targetDocumentVersionId: id,
          negotiationId: negotiation?.id, comparisonType: "generated_text", sourceSha256: source.sourceSha256,
          targetSha256: metadata.sha256, revisionSummary: input.revisionSummary, declaredChanges,
          structuredDiff: semanticDiff, diffStats: semanticDiff.stats, sourceTextSha256: semanticDiff.sourceTextSha256,
          targetTextSha256: semanticDiff.targetTextSha256, comparisonSha256, createdByUserId: req.user.id, createdAt,
        }).returning();
        await registerNativeEsignArtifact(tx, { companyId, documentVersionId: id, artifactKind: "source_pdf", storageKey, sha256: metadata.sha256, sizeBytes: metadata.sizeBytes, mimeType: metadata.mimeType, createdAt });
        if (negotiation) {
          await appendAuditEvent(tx, { companyId, envelopeId: negotiation.envelopeId, eventType: "document_revision_registered", actorType: "operator", actorReference: req.user.id, eventProjection: { negotiationId: negotiation.id, sourceDocumentVersionId: source.id, targetDocumentVersionId: id, sourceSha256: source.sourceSha256, targetSha256: metadata.sha256, revisionEvidenceSha256, generationMode: "approved_template" } });
          await appendAuditEvent(tx, { companyId, envelopeId: negotiation.envelopeId, eventType: "document_semantic_comparison_recorded", actorType: "operator", actorReference: req.user.id, eventProjection: { comparisonId, comparisonSha256, comparisonType: "generated_text", sourceTextSha256: semanticDiff.sourceTextSha256, targetTextSha256: semanticDiff.targetTextSha256, diffStats: semanticDiff.stats } });
        }
        return { ...document, comparison };
      });
      res.status(201).json(result);
    } catch (error) { await removeNativeEsignArtifact(storageKey).catch(() => undefined); throw error; }
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.envelope.create");
    const input = nativeEsignEnvelopeCreationSchema.parse(req.body);
    const document = await db.query.eosEsignDocumentVersions.findFirst({ where: and(eq(eosEsignDocumentVersions.id, input.documentVersionId), eq(eosEsignDocumentVersions.companyId, companyId)) });
    if (!document) throw new NativeEsignError(404, "native_esign_document_not_found", "Document version is not available in this company.");
    const fields = nativeEsignFieldSchema.array().parse(document.fieldSchema);
    const roles = new Set(input.recipients.map((recipient) => recipient.roleKey));
    assertExactRecipientRoles(fields, input.recipients);
    if (input.recoveryAgreementInstanceId) {
      if (!fields.some((field) => field.type === "signature" && field.required && roles.has(field.roleKey)))
        throw new NativeEsignError(409, "native_esign_recovery_signature_required", "Recovery agreements require a visible, required signature field assigned to a recipient.");
      const agreement = await db.query.eosRecoveryAgreementInstances.findFirst({ where: and(eq(eosRecoveryAgreementInstances.id, input.recoveryAgreementInstanceId), eq(eosRecoveryAgreementInstances.companyId, companyId)) });
      if (!agreement) throw new NativeEsignError(404, "native_esign_agreement_not_found", "Recovery agreement is not available in this company.");
    }
    const envelopeId = randomUUID();
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(eosEsignEnvelopes).values({ id: envelopeId, companyId, documentVersionId: document.id, recoveryAgreementInstanceId: input.recoveryAgreementInstanceId, templateVersionId: document.templateVersionId, counterpartyId: document.counterpartyId, workPacketId: document.workPacketId, state: "draft", routingMode: input.routingMode, assuranceMode: input.assuranceMode, subject: input.subject, message: input.message, expiresAt: input.expiresAt, version: 1, createdByUserId: req.user.id, createdAt: now, updatedAt: now });
      await tx.insert(eosEsignRecipients).values(input.recipients.map((recipient) => ({ id: randomUUID(), companyId, envelopeId, roleKey: recipient.roleKey, routingOrder: recipient.routingOrder, signerName: recipient.signerName, signerEmail: recipient.signerEmail.toLowerCase(), state: "pending", tokenDigest: nativeEsignTokenDigest(createNativeEsignSecret()), tokenExpiresAt: input.expiresAt, version: 1, createdAt: now, updatedAt: now })));
      await appendAuditEvent(tx, { companyId, envelopeId, eventType: "envelope_created", actorType: "operator", actorReference: req.user.id, eventProjection: { documentVersionId: document.id, documentSha256: document.sourceSha256, routingMode: input.routingMode, assuranceMode: input.assuranceMode, recipientCount: input.recipients.length } });
    });
    res.status(201).json(await db.query.eosEsignEnvelopes.findFirst({ where: eq(eosEsignEnvelopes.id, envelopeId) }));
  }));

  app.patch("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const access = await requireCompanyOperator(req, companyId, "native_esign.envelope.update_draft");
    const input = nativeEsignEnvelopeDraftUpdateSchema.parse(req.body);
    const envelope = await db.query.eosEsignEnvelopes.findFirst({
      where: and(
        eq(eosEsignEnvelopes.id, req.params.envelopeId),
        eq(eosEsignEnvelopes.companyId, companyId),
      ),
    });
    if (!envelope || envelope.state !== "draft")
      throw new NativeEsignError(409, "native_esign_envelope_not_editable", "Only a tenant-scoped draft envelope can be edited.");
    if (envelope.version !== input.version)
      throw new NativeEsignError(409, "native_esign_envelope_changed", "The draft changed before this update. Refresh and review the latest version.");
    const document = await db.query.eosEsignDocumentVersions.findFirst({
      where: and(
        eq(eosEsignDocumentVersions.id, envelope.documentVersionId),
        eq(eosEsignDocumentVersions.companyId, companyId),
      ),
    });
    if (!document)
      throw new NativeEsignError(404, "native_esign_document_not_found", "Document version is not available in this company.");
    const fields = nativeEsignFieldSchema.array().parse(document.fieldSchema);
    assertExactRecipientRoles(fields, input.recipients);
    const now = new Date();
    const revised = await db.transaction(async (tx) => {
      const [updated] = await tx.update(eosEsignEnvelopes).set({
        subject: input.subject,
        message: input.message,
        routingMode: input.routingMode,
        assuranceMode: input.assuranceMode || envelope.assuranceMode,
        expiresAt: input.expiresAt,
        version: envelope.version + 1,
        updatedAt: now,
      }).where(and(
        eq(eosEsignEnvelopes.id, envelope.id),
        eq(eosEsignEnvelopes.companyId, companyId),
        eq(eosEsignEnvelopes.state, "draft"),
        eq(eosEsignEnvelopes.version, envelope.version),
      )).returning();
      if (!updated)
        throw new NativeEsignError(409, "native_esign_envelope_changed", "The draft changed before this update. Refresh and review the latest version.");
      await tx.delete(eosEsignRecipients).where(and(
        eq(eosEsignRecipients.envelopeId, envelope.id),
        eq(eosEsignRecipients.companyId, companyId),
      ));
      await tx.insert(eosEsignRecipients).values(input.recipients.map((recipient) => ({
        id: randomUUID(),
        companyId,
        envelopeId: envelope.id,
        roleKey: recipient.roleKey,
        routingOrder: recipient.routingOrder,
        signerName: recipient.signerName,
        signerEmail: recipient.signerEmail.toLowerCase(),
        state: "pending",
        tokenDigest: nativeEsignTokenDigest(createNativeEsignSecret()),
        tokenExpiresAt: input.expiresAt,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })));
      await appendAuditEvent(tx, {
        companyId,
        envelopeId: envelope.id,
        eventType: "envelope_revised",
        actorType: "operator",
        actorReference: req.user.id,
        eventProjection: {
          previousVersion: envelope.version,
          version: updated.version,
          subject: updated.subject,
          routingMode: updated.routingMode,
          assuranceMode: updated.assuranceMode,
          expiresAt: updated.expiresAt.toISOString(),
          recipientRoles: input.recipients.map((recipient) => recipient.roleKey),
          policyDecisionId: access.policy.decisionId,
        },
      });
      return updated;
    });
    res.json(revised);
  }));

  app.get("/api/eos/companies/:companyId/native-esign/contracts/control-center", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const reader = await requireCompanyReader(req, companyId, "native_esign.contract_control.read");
    const visible = await visibleSeatIds(companyId, reader.access.seat.id, reader.access.role);
    const allEnvelopes = await db.select().from(eosEsignEnvelopes)
      .where(eq(eosEsignEnvelopes.companyId, companyId)).orderBy(desc(eosEsignEnvelopes.updatedAt));
    const envelopes = allEnvelopes.filter((item) => item.state === "completed");
    const envelopeIds = envelopes.map((item) => item.id);
    if (!envelopeIds.length) {
      res.json({ generatedAt: new Date(), metrics: { executedAgreements: 0, unplanned: 0, reviewDue: 0, noticeDue: 0, overdueObligations: 0, noticeActions: 0, custodyExceptions: 0 }, contracts: [] });
      return;
    }

    const documentIds = Array.from(new Set(envelopes.map((item) => item.documentVersionId)));
    const counterpartyIds = Array.from(new Set(envelopes.flatMap((item) => item.counterpartyId ? [item.counterpartyId] : [])));
    const workPacketIds = Array.from(new Set(envelopes.flatMap((item) => item.workPacketId ? [item.workPacketId] : [])));
    const [plans, documents, counterparties, promotions, integrityChecks, artifacts, workPackets] = await Promise.all([
      db.select().from(eosEsignContractPlans).where(and(eq(eosEsignContractPlans.companyId, companyId), inArray(eosEsignContractPlans.envelopeId, envelopeIds))),
      db.select().from(eosEsignDocumentVersions).where(and(eq(eosEsignDocumentVersions.companyId, companyId), inArray(eosEsignDocumentVersions.id, documentIds))),
      counterpartyIds.length ? db.select().from(eosEsignCounterparties).where(and(eq(eosEsignCounterparties.companyId, companyId), inArray(eosEsignCounterparties.id, counterpartyIds))) : Promise.resolve([]),
      db.select().from(eosEsignObligationPromotions).where(and(eq(eosEsignObligationPromotions.companyId, companyId), inArray(eosEsignObligationPromotions.envelopeId, envelopeIds))),
      db.select().from(eosEsignIntegrityChecks).where(and(eq(eosEsignIntegrityChecks.companyId, companyId), inArray(eosEsignIntegrityChecks.envelopeId, envelopeIds))).orderBy(desc(eosEsignIntegrityChecks.checkedAt)),
      db.select().from(eosEsignArtifacts).where(and(eq(eosEsignArtifacts.companyId, companyId), inArray(eosEsignArtifacts.envelopeId, envelopeIds))),
      workPacketIds.length ? db.select().from(eosWorkPackets).where(and(eq(eosWorkPackets.companyId, companyId), inArray(eosWorkPackets.id, workPacketIds))) : Promise.resolve([]),
    ]);
    const planIds = plans.map((item) => item.id);
    const obligationIds = promotions.map((item) => item.obligationId);
    const ownerSeatIds = Array.from(new Set(plans.map((item) => item.ownerSeatId)));
    const [events, obligations, owners, notices, noticeAttempts] = await Promise.all([
      planIds.length ? db.select().from(eosEsignContractPlanEvents).where(and(eq(eosEsignContractPlanEvents.companyId, companyId), inArray(eosEsignContractPlanEvents.planId, planIds))).orderBy(desc(eosEsignContractPlanEvents.recordedAt)) : Promise.resolve([]),
      obligationIds.length ? db.select().from(eosRisksControls).where(and(eq(eosRisksControls.companyId, companyId), inArray(eosRisksControls.id, obligationIds))) : Promise.resolve([]),
      ownerSeatIds.length ? db.select().from(eosSeats).where(and(eq(eosSeats.companyId, companyId), inArray(eosSeats.id, ownerSeatIds))) : Promise.resolve([]),
      planIds.length ? db.select().from(eosEsignContractNotices).where(and(eq(eosEsignContractNotices.companyId, companyId), inArray(eosEsignContractNotices.planId, planIds))).orderBy(desc(eosEsignContractNotices.createdAt)) : Promise.resolve([]),
      planIds.length ? db.select().from(eosEsignContractNoticeAttempts).where(and(eq(eosEsignContractNoticeAttempts.companyId, companyId), inArray(eosEsignContractNoticeAttempts.planId, planIds))).orderBy(desc(eosEsignContractNoticeAttempts.preparedAt)) : Promise.resolve([]),
    ]);
    const now = new Date();
    const noticeHorizon = new Date(now.getTime() + 30 * 86_400_000);
    const termHorizon = new Date(now.getTime() + 60 * 86_400_000);
    const visiblePlans = new Map(plans.filter((plan) => visible.has(plan.ownerSeatId) && mayAccessClassification(reader.access, plan.classification)).map((plan) => [plan.envelopeId, plan]));
    const contracts = envelopes.flatMap((envelope) => {
      const plan = plans.find((item) => item.envelopeId === envelope.id) || null;
      if (plan && !visiblePlans.has(envelope.id)) return [];
      const packet = workPackets.find((item) => item.id === envelope.workPacketId);
      if (!plan && !reader.access.isOwner && (!packet || !packet.accountableSeatId || !visible.has(packet.accountableSeatId) || !mayAccessClassification(reader.access, packet.classification))) return [];
      const document = documents.find((item) => item.id === envelope.documentVersionId);
      const counterparty = counterparties.find((item) => item.id === envelope.counterpartyId);
      const owner = owners.find((item) => item.id === plan?.ownerSeatId);
      const linkedObligations = promotions.flatMap((promotion) => {
        if (promotion.envelopeId !== envelope.id) return [];
        const obligation = obligations.find((item) => item.id === promotion.obligationId);
        return obligation && visible.has(obligation.ownerSeatId) && mayAccessClassification(reader.access, obligation.classification) ? [obligation] : [];
      });
      const latestIntegrity = integrityChecks.find((item) => item.envelopeId === envelope.id) || null;
      const custodyArtifacts = artifacts.filter((item) => item.envelopeId === envelope.id && ["completed_pdf", "audit_json"].includes(item.artifactKind));
      const reviewDue = Boolean(plan && !["closed", "expired"].includes(plan.lifecycleState) && plan.nextReviewAt <= now);
      const noticeDue = Boolean(plan?.noticeDeadlineAt && !["closed", "expired"].includes(plan.lifecycleState) && plan.noticeDeadlineAt <= noticeHorizon);
      const termDue = Boolean(plan?.contractEndsAt && !["closed", "expired"].includes(plan.lifecycleState) && plan.contractEndsAt <= termHorizon);
      const overdueObligations = linkedObligations.filter((item) => item.dueReviewAt && item.dueReviewAt <= now && !["satisfied_closed", "superseded"].includes(item.state)).length;
      const renewalDraft = allEnvelopes.find((item) => item.renewalOfEnvelopeId === envelope.id && !["voided", "declined", "expired"].includes(item.state)) || null;
      const visibleNotices = plan ? notices.filter((item) => item.planId === plan.id && visible.has(item.ownerSeatId) && mayAccessClassification(reader.access, item.classification)) : [];
      return [{
        envelope: { id: envelope.id, subject: envelope.subject, completedAt: envelope.completedAt, evidenceId: envelope.evidenceId, renewalOfEnvelopeId: envelope.renewalOfEnvelopeId },
        document: document ? { id: document.id, title: document.title, documentKey: document.documentKey, documentVersion: document.documentVersion } : null,
        counterparty: counterparty ? { id: counterparty.id, displayName: counterparty.displayName, legalName: counterparty.legalName, signerName: counterparty.signerName, signerEmail: counterparty.signerEmail } : null,
        plan,
        owner: owner ? { id: owner.id, title: owner.title, kind: owner.kind, agentName: owner.agentName, status: owner.status } : null,
        events: plan ? events.filter((item) => item.planId === plan.id) : [],
        obligations: linkedObligations.map((item) => ({ id: item.id, title: item.title, state: item.state, ownerSeatId: item.ownerSeatId, dueReviewAt: item.dueReviewAt, classification: item.classification })),
        renewalDraft: renewalDraft ? { id: renewalDraft.id, subject: renewalDraft.subject, state: renewalDraft.state } : null,
        notices: visibleNotices.map((notice) => ({ ...notice, attempts: noticeAttempts.filter((attempt) => attempt.noticeId === notice.id) })),
        urgency: { reviewDue, noticeDue, termDue, overdueObligations },
        readiness: {
          evidencePromoted: Boolean(envelope.evidenceId),
          integrityPassed: latestIntegrity?.state === "passed",
          custodyVerified: custodyArtifacts.length >= 2 && custodyArtifacts.every((item) => item.state === "active" && Boolean(item.lastVerifiedAt)),
        },
      }];
    });
    res.json({
      generatedAt: now,
      metrics: {
        executedAgreements: contracts.length,
        unplanned: contracts.filter((item) => !item.plan).length,
        reviewDue: contracts.filter((item) => item.urgency.reviewDue).length,
        noticeDue: contracts.filter((item) => item.urgency.noticeDue).length,
        overdueObligations: contracts.reduce((sum, item) => sum + item.urgency.overdueObligations, 0),
        noticeActions: contracts.reduce((sum, item) => sum + item.notices.filter((notice) => !["delivered", "cancelled"].includes(notice.state)).length, 0),
        custodyExceptions: contracts.filter((item) => !item.readiness.integrityPassed || !item.readiness.custodyVerified).length,
      },
      contracts,
    });
  }));

  app.put("/api/eos/companies/:companyId/native-esign/contracts/:envelopeId/plan", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const operator = await requireCompanyOperator(req, companyId, "native_esign.contract_plan.record");
    const input = nativeEsignContractPlanSchema.parse(req.body);
    if (!mayAccessClassification(operator.access, input.classification))
      throw new NativeEsignError(403, "native_esign_contract_plan_classification_denied", "The contract plan classification exceeds this operator's disclosure authority.");
    const envelope = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId)) });
    if (!envelope || envelope.state !== "completed")
      throw new NativeEsignError(409, "native_esign_contract_plan_execution_required", "An agreement must be completed before its commercial lifecycle can be scheduled.");
    const visible = await visibleSeatIds(companyId, operator.access.seat.id, operator.access.role);
    const owner = await db.query.eosSeats.findFirst({ where: and(eq(eosSeats.id, input.ownerSeatId), eq(eosSeats.companyId, companyId), eq(eosSeats.status, "active")) });
    if (!owner || !visible.has(owner.id)) throw new NativeEsignError(404, "native_esign_contract_plan_owner_unavailable", "The accountable seat is not active in this operator's visible organization scope.");
    const current = await db.query.eosEsignContractPlans.findFirst({ where: and(eq(eosEsignContractPlans.companyId, companyId), eq(eosEsignContractPlans.envelopeId, envelope.id)) });
    if (current && input.expectedVersion !== current.version) throw new NativeEsignError(409, "native_esign_contract_plan_changed", "The contract plan changed before this update. Refresh and review the current schedule.");
    if (!current && input.expectedVersion) throw new NativeEsignError(409, "native_esign_contract_plan_changed", "This agreement does not yet have a contract plan. Refresh before recording it.");
    const policy = await authorizeAction(req, operator.access, { authorityClass: "execute", resource: "contract_plan", actionKey: "native_esign.contract_plan.record", purpose: "schedule_executed_contract_control", classification: input.classification, consequence: "routine", targetSeatId: owner.id });
    const now = new Date(); const planId = current?.id || randomUUID(); const eventId = randomUUID();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${envelope.id}))`);
      const locked = await tx.query.eosEsignContractPlans.findFirst({ where: and(eq(eosEsignContractPlans.companyId, companyId), eq(eosEsignContractPlans.envelopeId, envelope.id)) });
      if ((current && (!locked || locked.version !== current.version)) || (!current && locked)) throw new NativeEsignError(409, "native_esign_contract_plan_changed", "The contract plan changed before this update. Refresh and review the current schedule.");
      const scheduleSnapshot = { effectiveAt: input.effectiveAt.toISOString(), contractEndsAt: input.contractEndsAt?.toISOString() || null, noticeDeadlineAt: input.noticeDeadlineAt?.toISOString() || null, nextReviewAt: input.nextReviewAt.toISOString() };
      const values = { effectiveAt: input.effectiveAt, contractEndsAt: input.contractEndsAt || null, noticeDeadlineAt: input.noticeDeadlineAt || null, nextReviewAt: input.nextReviewAt, ownerSeatId: owner.id, classification: input.classification, notes: input.notes, lastPolicyDecisionId: policy.decisionId, recordedByUserId: req.user.id, updatedAt: now };
      const [plan] = locked
        ? await tx.update(eosEsignContractPlans).set({ ...values, version: locked.version + 1 }).where(and(eq(eosEsignContractPlans.id, locked.id), eq(eosEsignContractPlans.version, locked.version))).returning()
        : await tx.insert(eosEsignContractPlans).values({ id: planId, companyId, envelopeId: envelope.id, lifecycleState: "active", renewalIntent: "undecided", version: 1, createdAt: now, ...values }).returning();
      if (!plan) throw new NativeEsignError(409, "native_esign_contract_plan_changed", "The contract plan changed before this update. Refresh and review the current schedule.");
      const [previous] = await tx.select().from(eosEsignContractPlanEvents).where(and(eq(eosEsignContractPlanEvents.companyId, companyId), eq(eosEsignContractPlanEvents.planId, plan.id))).orderBy(desc(eosEsignContractPlanEvents.recordedAt)).limit(1);
      const eventSha256 = nativeContractContentSha256({ schemaVersion: "eos-native-contract-plan-event.v1", eventId, companyId, planId: plan.id, envelopeId: envelope.id, eventType: "plan_recorded", stateBefore: locked?.lifecycleState || "active", stateAfter: plan.lifecycleState, intentBefore: locked?.renewalIntent || "undecided", intentAfter: plan.renewalIntent, ownerSeatId: owner.id, scheduleSnapshot, evidenceIds: [], note: input.notes, authorityClass: "execute", policyDecisionId: policy.decisionId, previousEventSha256: previous?.eventSha256 || "", recordedByUserId: req.user.id, recordedAt: now.toISOString() });
      const [event] = await tx.insert(eosEsignContractPlanEvents).values({ id: eventId, companyId, planId: plan.id, envelopeId: envelope.id, eventType: "plan_recorded", stateBefore: locked?.lifecycleState || "active", stateAfter: plan.lifecycleState, intentBefore: locked?.renewalIntent || "undecided", intentAfter: plan.renewalIntent, ownerSeatId: owner.id, scheduleSnapshot, evidenceIds: [], note: input.notes, authorityClass: "execute", policyDecisionId: policy.decisionId, previousEventSha256: previous?.eventSha256 || "", eventSha256, recordedByUserId: req.user.id, recordedAt: now, createdAt: now }).returning();
      await appendAuditEvent(tx, { companyId, envelopeId: envelope.id, eventType: "contract_plan_recorded", actorType: "operator", actorReference: req.user.id, eventProjection: { planId: plan.id, version: plan.version, ownerSeatId: owner.id, lifecycleState: plan.lifecycleState, renewalIntent: plan.renewalIntent, eventSha256, policyDecisionId: policy.decisionId } });
      return { plan, event };
    });
    res.status(current ? 200 : 201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/contracts/:envelopeId/renewal-decision", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const operator = await requireCompanyOperator(req, companyId, "native_esign.contract_plan.decide_renewal");
    const input = nativeEsignContractRenewalDecisionSchema.parse(req.body);
    const envelope = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId), eq(eosEsignEnvelopes.state, "completed")) });
    const plan = await db.query.eosEsignContractPlans.findFirst({ where: and(eq(eosEsignContractPlans.companyId, companyId), eq(eosEsignContractPlans.envelopeId, req.params.envelopeId)) });
    if (!envelope || !plan) throw new NativeEsignError(404, "native_esign_contract_plan_not_found", "Record a visible contract plan before making a renewal decision.");
    const visible = await visibleSeatIds(companyId, operator.access.seat.id, operator.access.role);
    if (!visible.has(plan.ownerSeatId) || !mayAccessClassification(operator.access, plan.classification)) throw new NativeEsignError(404, "native_esign_contract_plan_not_found", "This contract plan is outside the operator's visible authority scope.");
    if (plan.version !== input.expectedVersion) throw new NativeEsignError(409, "native_esign_contract_plan_changed", "The contract plan changed before this decision. Refresh and review it again.");
    const evidenceRows = await db.select({ evidence: eosEvidence, packet: eosWorkPackets }).from(eosEvidence).innerJoin(eosWorkPackets, eq(eosWorkPackets.id, eosEvidence.workPacketId)).where(and(eq(eosEvidence.companyId, companyId), eq(eosWorkPackets.companyId, companyId), inArray(eosEvidence.id, input.evidenceIds)));
    const validEvidence = evidenceRows.length === input.evidenceIds.length && evidenceRows.every(({ evidence, packet }) => evidence.verificationState === "verified" && mayAccessClassification(operator.access, evidence.dataClassification) && mayAccessClassification(operator.access, packet.classification) && (operator.access.isOwner || Boolean(packet.accountableSeatId && visible.has(packet.accountableSeatId))));
    if (!validEvidence) throw new NativeEsignError(409, "native_esign_contract_decision_evidence_invalid", "Every renewal decision Evidence item must be verified and visible in this tenant and hierarchy.");
    if (!input.evidenceIds.some((id) => id !== envelope.evidenceId)) throw new NativeEsignError(409, "native_esign_contract_decision_operational_evidence_required", "The executed agreement proves its terms, not renewal fitness. Attach separate verified operational Evidence.");
    const policy = await authorizeAction(req, operator.access, { authorityClass: "decide", resource: "contract_plan", actionKey: "native_esign.contract_plan.decide_renewal", purpose: "decide_executed_contract_renewal", classification: plan.classification, consequence: "material", targetSeatId: plan.ownerSeatId });
    const nextState = ["renew", "renegotiate"].includes(input.intent) ? "up_for_renewal" : "nonrenewing";
    const now = new Date(); const eventId = randomUUID();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${plan.id}))`);
      const current = await tx.query.eosEsignContractPlans.findFirst({ where: and(eq(eosEsignContractPlans.id, plan.id), eq(eosEsignContractPlans.companyId, companyId)) });
      if (!current || current.version !== input.expectedVersion) throw new NativeEsignError(409, "native_esign_contract_plan_changed", "The contract plan changed before this decision. Refresh and review it again.");
      const [updated] = await tx.update(eosEsignContractPlans).set({ lifecycleState: nextState, renewalIntent: input.intent, version: current.version + 1, lastPolicyDecisionId: policy.decisionId, recordedByUserId: req.user.id, updatedAt: now }).where(and(eq(eosEsignContractPlans.id, current.id), eq(eosEsignContractPlans.version, current.version))).returning();
      if (!updated) throw new NativeEsignError(409, "native_esign_contract_plan_changed", "The contract plan changed before this decision. Refresh and review it again.");
      const [previous] = await tx.select().from(eosEsignContractPlanEvents).where(and(eq(eosEsignContractPlanEvents.companyId, companyId), eq(eosEsignContractPlanEvents.planId, current.id))).orderBy(desc(eosEsignContractPlanEvents.recordedAt)).limit(1);
      const scheduleSnapshot = { effectiveAt: current.effectiveAt.toISOString(), contractEndsAt: current.contractEndsAt?.toISOString() || null, noticeDeadlineAt: current.noticeDeadlineAt?.toISOString() || null, nextReviewAt: current.nextReviewAt.toISOString() };
      const eventSha256 = nativeContractContentSha256({ schemaVersion: "eos-native-contract-plan-event.v1", eventId, companyId, planId: current.id, envelopeId: envelope.id, eventType: "renewal_decision_recorded", stateBefore: current.lifecycleState, stateAfter: nextState, intentBefore: current.renewalIntent, intentAfter: input.intent, ownerSeatId: current.ownerSeatId, scheduleSnapshot, evidenceIds: input.evidenceIds, note: input.decisionNote, authorityClass: "decide", policyDecisionId: policy.decisionId, previousEventSha256: previous?.eventSha256 || "", recordedByUserId: req.user.id, recordedAt: now.toISOString() });
      const [event] = await tx.insert(eosEsignContractPlanEvents).values({ id: eventId, companyId, planId: current.id, envelopeId: envelope.id, eventType: "renewal_decision_recorded", stateBefore: current.lifecycleState, stateAfter: nextState, intentBefore: current.renewalIntent, intentAfter: input.intent, ownerSeatId: current.ownerSeatId, scheduleSnapshot, evidenceIds: input.evidenceIds, note: input.decisionNote, authorityClass: "decide", policyDecisionId: policy.decisionId, previousEventSha256: previous?.eventSha256 || "", eventSha256, recordedByUserId: req.user.id, recordedAt: now, createdAt: now }).returning();
      await appendAuditEvent(tx, { companyId, envelopeId: envelope.id, eventType: "contract_renewal_decided", actorType: "operator", actorReference: req.user.id, eventProjection: { planId: current.id, intent: input.intent, lifecycleState: nextState, operationalEvidenceCount: input.evidenceIds.length, eventSha256, policyDecisionId: policy.decisionId } });
      return { plan: updated, event };
    });
    res.json(result);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/contracts/:envelopeId/notices", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const operator = await requireCompanyOperator(req, companyId, "native_esign.contract_notice.create");
    const input = nativeEsignContractNoticeSchema.parse(req.body);
    const [envelope, plan] = await Promise.all([
      db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId), eq(eosEsignEnvelopes.state, "completed")) }),
      db.query.eosEsignContractPlans.findFirst({ where: and(eq(eosEsignContractPlans.companyId, companyId), eq(eosEsignContractPlans.envelopeId, req.params.envelopeId)) }),
    ]);
    if (!envelope || !plan || ["closed", "expired"].includes(plan.lifecycleState))
      throw new NativeEsignError(404, "native_esign_contract_plan_not_found", "Record an active, visible contract plan before preparing a notice.");
    const visible = await visibleSeatIds(companyId, operator.access.seat.id, operator.access.role);
    if (!visible.has(plan.ownerSeatId) || !mayAccessClassification(operator.access, plan.classification) || !visible.has(input.ownerSeatId) || !mayAccessClassification(operator.access, input.classification))
      throw new NativeEsignError(404, "native_esign_contract_plan_not_found", "This contract plan or notice owner is outside the operator's visible authority scope.");
    const owner = await db.query.eosSeats.findFirst({ where: and(eq(eosSeats.id, input.ownerSeatId), eq(eosSeats.companyId, companyId), eq(eosSeats.status, "active")) });
    if (!owner) throw new NativeEsignError(409, "native_esign_contract_notice_owner_invalid", "Select an active, visible seat to own this notice.");
    if (input.dueAt <= new Date()) throw new NativeEsignError(409, "native_esign_contract_notice_due_invalid", "The notice due time must be in the future.");
    if (input.noticeType === "renewal_offer" && !["renew", "renegotiate"].includes(plan.renewalIntent))
      throw new NativeEsignError(409, "native_esign_contract_notice_intent_mismatch", "Record a renew or renegotiate decision before preparing a renewal offer.");
    if (["nonrenewal", "termination"].includes(input.noticeType) && !["terminate", "allow_expiry"].includes(plan.renewalIntent))
      throw new NativeEsignError(409, "native_esign_contract_notice_intent_mismatch", "Record a terminate or allow-expiry decision before preparing this notice.");
    const policy = await authorizeAction(req, operator.access, { authorityClass: "execute", resource: "contract_notice", actionKey: "native_esign.contract_notice.create", purpose: "prepare_contract_notice", classification: input.classification, consequence: "routine", targetSeatId: input.ownerSeatId });
    const id = randomUUID(); const now = new Date();
    const contentSha256 = nativeContractContentSha256({ schemaVersion: "eos-native-contract-notice-content.v1", noticeId: id, companyId, planId: plan.id, envelopeId: envelope.id, noticeType: input.noticeType, recipientName: input.recipientName, recipientEmail: input.recipientEmail, subject: input.subject, bodyText: input.bodyText, dueAt: input.dueAt.toISOString(), ownerSeatId: input.ownerSeatId, classification: input.classification });
    const notice = await db.transaction(async (tx) => {
      const [created] = await tx.insert(eosEsignContractNotices).values({ id, companyId, planId: plan.id, envelopeId: envelope.id, noticeType: input.noticeType, recipientName: input.recipientName, recipientEmail: input.recipientEmail, subject: input.subject, bodyText: input.bodyText, dueAt: input.dueAt, ownerSeatId: input.ownerSeatId, classification: input.classification, contentSha256, state: "draft", version: 1, createdByUserId: req.user.id, createdAt: now, updatedAt: now }).returning();
      await appendAuditEvent(tx, { companyId, envelopeId: envelope.id, eventType: "contract_notice_created", actorType: "operator", actorReference: req.user.id, eventProjection: { noticeId: id, planId: plan.id, noticeType: input.noticeType, ownerSeatId: input.ownerSeatId, dueAt: input.dueAt.toISOString(), contentSha256, policyDecisionId: policy.decisionId } });
      return created;
    });
    res.status(201).json(notice);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/contracts/:envelopeId/notices/:noticeId/approve", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const operator = await requireCompanyOperator(req, companyId, "native_esign.contract_notice.approve");
    const input = nativeEsignContractNoticeApprovalSchema.parse(req.body);
    const [envelope, plan, notice] = await Promise.all([
      db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId), eq(eosEsignEnvelopes.state, "completed")) }),
      db.query.eosEsignContractPlans.findFirst({ where: and(eq(eosEsignContractPlans.companyId, companyId), eq(eosEsignContractPlans.envelopeId, req.params.envelopeId)) }),
      db.query.eosEsignContractNotices.findFirst({ where: and(eq(eosEsignContractNotices.id, req.params.noticeId), eq(eosEsignContractNotices.companyId, companyId), eq(eosEsignContractNotices.envelopeId, req.params.envelopeId)) }),
    ]);
    if (!envelope || !plan || !notice || notice.planId !== plan.id) throw new NativeEsignError(404, "native_esign_contract_notice_not_found", "The tenant-scoped contract notice is unavailable.");
    if (notice.state !== "draft" || notice.version !== input.expectedVersion) throw new NativeEsignError(409, "native_esign_contract_notice_changed", "The notice changed before approval. Refresh and review the exact content again.");
    const visible = await visibleSeatIds(companyId, operator.access.seat.id, operator.access.role);
    if (!visible.has(notice.ownerSeatId) || !mayAccessClassification(operator.access, notice.classification)) throw new NativeEsignError(404, "native_esign_contract_notice_not_found", "This contract notice is outside the operator's visible authority scope.");
    const evidenceRows = await db.select({ evidence: eosEvidence, packet: eosWorkPackets }).from(eosEvidence).innerJoin(eosWorkPackets, eq(eosWorkPackets.id, eosEvidence.workPacketId)).where(and(eq(eosEvidence.companyId, companyId), eq(eosWorkPackets.companyId, companyId), inArray(eosEvidence.id, input.evidenceIds)));
    const validEvidence = evidenceRows.length === input.evidenceIds.length && evidenceRows.every(({ evidence, packet }) => evidence.verificationState === "verified" && mayAccessClassification(operator.access, evidence.dataClassification) && mayAccessClassification(operator.access, packet.classification) && (operator.access.isOwner || Boolean(packet.accountableSeatId && visible.has(packet.accountableSeatId))));
    if (!validEvidence) throw new NativeEsignError(409, "native_esign_contract_notice_evidence_invalid", "Every notice approval Evidence item must be verified and visible in this tenant and hierarchy.");
    if (!input.evidenceIds.some((id) => id !== envelope.evidenceId)) throw new NativeEsignError(409, "native_esign_contract_notice_operational_evidence_required", "The executed agreement proves its terms, not notice fitness. Attach separate verified operational Evidence.");
    const policy = await authorizeAction(req, operator.access, { authorityClass: "decide", resource: "contract_notice", actionKey: "native_esign.contract_notice.approve", purpose: "approve_exact_contract_notice", classification: notice.classification, consequence: "material", targetSeatId: notice.ownerSeatId });
    const approvedAt = new Date();
    const approvalSha256 = nativeContractContentSha256({ schemaVersion: "eos-native-contract-notice-approval.v1", noticeId: notice.id, companyId, contentSha256: notice.contentSha256, evidenceIds: [...input.evidenceIds].sort(), approvalNote: input.approvalNote, policyDecisionId: policy.decisionId, approvedByUserId: req.user.id, approvedAt: approvedAt.toISOString() });
    const approved = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${notice.id}))`);
      const [updated] = await tx.update(eosEsignContractNotices).set({ state: "approved", version: notice.version + 1, approvalEvidenceIds: input.evidenceIds, approvalNote: input.approvalNote, approvalPolicyDecisionId: policy.decisionId, approvalSha256, approvedByUserId: req.user.id, approvedAt, updatedAt: approvedAt }).where(and(eq(eosEsignContractNotices.id, notice.id), eq(eosEsignContractNotices.companyId, companyId), eq(eosEsignContractNotices.state, "draft"), eq(eosEsignContractNotices.version, input.expectedVersion))).returning();
      if (!updated) throw new NativeEsignError(409, "native_esign_contract_notice_changed", "The notice changed before approval. Refresh and review the exact content again.");
      await appendAuditEvent(tx, { companyId, envelopeId: envelope.id, eventType: "contract_notice_approved", actorType: "operator", actorReference: req.user.id, eventProjection: { noticeId: notice.id, planId: plan.id, contentSha256: notice.contentSha256, approvalSha256, operationalEvidenceCount: input.evidenceIds.length, policyDecisionId: policy.decisionId } });
      return updated;
    });
    res.json(approved);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/contracts/:envelopeId/notices/:noticeId/deliver", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const operator = await requireCompanyOperator(req, companyId, "native_esign.contract_notice.deliver");
    const input = nativeEsignContractNoticeDeliverySchema.parse(req.body);
    const [context] = await db.select({ envelope: eosEsignEnvelopes, plan: eosEsignContractPlans, notice: eosEsignContractNotices, company: companies })
      .from(eosEsignContractNotices)
      .innerJoin(eosEsignContractPlans, eq(eosEsignContractPlans.id, eosEsignContractNotices.planId))
      .innerJoin(eosEsignEnvelopes, eq(eosEsignEnvelopes.id, eosEsignContractNotices.envelopeId))
      .innerJoin(companies, eq(companies.id, eosEsignContractNotices.companyId))
      .where(and(eq(eosEsignContractNotices.id, req.params.noticeId), eq(eosEsignContractNotices.companyId, companyId), eq(eosEsignContractNotices.envelopeId, req.params.envelopeId), eq(eosEsignEnvelopes.state, "completed"))).limit(1);
    if (!context) throw new NativeEsignError(404, "native_esign_contract_notice_not_found", "The tenant-scoped contract notice is unavailable.");
    if (!["approved", "failed", "uncertain"].includes(context.notice.state) || context.notice.version !== input.expectedVersion || !context.notice.approvalSha256)
      throw new NativeEsignError(409, "native_esign_contract_notice_delivery_unavailable", "Only the current exact approved notice can be sent or retried. A sending notice requires reconciliation before another attempt.");
    if (context.notice.deliveryAttemptCount >= 20) throw new NativeEsignError(429, "native_esign_contract_notice_attempt_limit", "This notice reached the controlled delivery-attempt limit.");
    const visible = await visibleSeatIds(companyId, operator.access.seat.id, operator.access.role);
    if (!visible.has(context.notice.ownerSeatId) || !mayAccessClassification(operator.access, context.notice.classification)) throw new NativeEsignError(404, "native_esign_contract_notice_not_found", "This contract notice is outside the operator's visible authority scope.");
    const policy = await authorizeAction(req, operator.access, { authorityClass: "execute", resource: "contract_notice", actionKey: "native_esign.contract_notice.deliver", purpose: "deliver_approved_contract_notice", classification: context.notice.classification, consequence: "material", targetSeatId: context.notice.ownerSeatId });
    const attemptId = randomUUID(); const preparedAt = new Date(); const attemptNumber = context.notice.deliveryAttemptCount + 1;
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM eos_esign_contract_notices WHERE id = ${context.notice.id} FOR UPDATE`);
      const current = await tx.query.eosEsignContractNotices.findFirst({ where: and(eq(eosEsignContractNotices.id, context.notice.id), eq(eosEsignContractNotices.companyId, companyId)) });
      if (!current || current.version !== input.expectedVersion || !["approved", "failed", "uncertain"].includes(current.state) || current.deliveryAttemptCount !== context.notice.deliveryAttemptCount || current.contentSha256 !== context.notice.contentSha256 || current.approvalSha256 !== context.notice.approvalSha256)
        throw new NativeEsignError(409, "native_esign_contract_notice_changed", "The approved notice changed before delivery preparation. Refresh and review it again.");
      await tx.insert(eosEsignContractNoticeAttempts).values({ id: attemptId, companyId, noticeId: current.id, planId: current.planId, envelopeId: current.envelopeId, attemptNumber, channel: "gmail", state: "prepared", contentSha256: current.contentSha256, approvalSha256: current.approvalSha256, recipientEmail: current.recipientEmail, requestedByUserId: req.user.id, policyDecisionId: policy.decisionId, preparedAt });
      const [sending] = await tx.update(eosEsignContractNotices).set({ state: "sending", deliveryAttemptCount: attemptNumber, lastDeliveryAttemptId: attemptId, providerMessageReference: "", version: current.version + 1, updatedAt: preparedAt }).where(and(eq(eosEsignContractNotices.id, current.id), eq(eosEsignContractNotices.version, current.version))).returning();
      if (!sending) throw new NativeEsignError(409, "native_esign_contract_notice_changed", "The approved notice changed before delivery preparation. Refresh and review it again.");
      await appendAuditEvent(tx, { companyId, envelopeId: current.envelopeId, eventType: "contract_notice_delivery_prepared", actorType: "operator", actorReference: req.user.id, eventProjection: { noticeId: current.id, planId: current.planId, attemptId, attemptNumber, contentSha256: current.contentSha256, approvalSha256: current.approvalSha256, policyDecisionId: policy.decisionId } });
    });
    const email = nativeContractNoticeEmail({ recipientName: context.notice.recipientName, companyName: context.company.name, subject: context.notice.subject, bodyText: context.notice.bodyText, noticeType: context.notice.noticeType, contentSha256: context.notice.contentSha256 });
    let receipt: { messageId: string };
    try {
      receipt = await gmail.sendEmail(req.user.id, { to: context.notice.recipientEmail, ...email });
      if (!receipt.messageId) throw new Error("Gmail returned no message receipt.");
    } catch (error) {
      const failure = classifyNativeEsignDeliveryFailure(error); const completedAt = new Date();
      await db.transaction(async (tx) => {
        await tx.update(eosEsignContractNoticeAttempts).set({ state: failure.state, failureCode: failure.code, failureMessage: failure.safeMessage, completedAt }).where(and(eq(eosEsignContractNoticeAttempts.id, attemptId), eq(eosEsignContractNoticeAttempts.state, "prepared")));
        await tx.update(eosEsignContractNotices).set({ state: failure.state, version: sql`${eosEsignContractNotices.version} + 1`, updatedAt: completedAt }).where(and(eq(eosEsignContractNotices.id, context.notice.id), eq(eosEsignContractNotices.lastDeliveryAttemptId, attemptId), eq(eosEsignContractNotices.state, "sending")));
        await appendAuditEvent(tx, { companyId, envelopeId: context.envelope.id, eventType: "contract_notice_delivery_failed", actorType: "provider", actorReference: "gmail", eventProjection: { noticeId: context.notice.id, planId: context.plan.id, attemptId, attemptNumber, deliveryState: failure.state, failureCode: failure.code } });
      });
      throw new NativeEsignError(502, "native_esign_contract_notice_delivery_failed", `${failure.safeMessage} Review the recorded attempt before retrying the exact approved notice.`);
    }
    const deliveredAt = new Date();
    await db.transaction(async (tx) => {
      const [attempt] = await tx.update(eosEsignContractNoticeAttempts).set({ state: "delivered", providerMessageReference: receipt.messageId, completedAt: deliveredAt }).where(and(eq(eosEsignContractNoticeAttempts.id, attemptId), eq(eosEsignContractNoticeAttempts.state, "prepared"))).returning();
      if (!attempt) throw new NativeEsignError(409, "native_esign_contract_notice_reconciliation_changed", "The Gmail receipt could not be reconciled to the prepared notice attempt.");
      const [notice] = await tx.update(eosEsignContractNotices).set({ state: "delivered", deliveredAt, providerMessageReference: receipt.messageId, version: sql`${eosEsignContractNotices.version} + 1`, updatedAt: deliveredAt }).where(and(eq(eosEsignContractNotices.id, context.notice.id), eq(eosEsignContractNotices.lastDeliveryAttemptId, attemptId), eq(eosEsignContractNotices.state, "sending"))).returning();
      if (!notice) throw new NativeEsignError(409, "native_esign_contract_notice_reconciliation_changed", "The notice changed before the Gmail receipt was reconciled.");
      await appendAuditEvent(tx, { companyId, envelopeId: context.envelope.id, eventType: "contract_notice_delivery_succeeded", actorType: "provider", actorReference: "gmail", eventProjection: { noticeId: context.notice.id, planId: context.plan.id, attemptId, attemptNumber, providerMessageReference: receipt.messageId, contentSha256: context.notice.contentSha256, approvalSha256: context.notice.approvalSha256 } });
    });
    res.json({ noticeId: context.notice.id, attemptId, attemptNumber, channel: "gmail", state: "delivered", deliveredAt, providerMessageReference: receipt.messageId });
  }));

  app.post("/api/eos/companies/:companyId/native-esign/contracts/:envelopeId/notices/:noticeId/reconcile", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const operator = await requireCompanyOperator(req, companyId, "native_esign.contract_notice.reconcile");
    const input = nativeEsignContractNoticeReconciliationSchema.parse(req.body);
    const [context] = await db.select({ envelope: eosEsignEnvelopes, plan: eosEsignContractPlans, notice: eosEsignContractNotices, attempt: eosEsignContractNoticeAttempts })
      .from(eosEsignContractNotices)
      .innerJoin(eosEsignContractPlans, eq(eosEsignContractPlans.id, eosEsignContractNotices.planId))
      .innerJoin(eosEsignEnvelopes, eq(eosEsignEnvelopes.id, eosEsignContractNotices.envelopeId))
      .innerJoin(eosEsignContractNoticeAttempts, eq(eosEsignContractNoticeAttempts.id, eosEsignContractNotices.lastDeliveryAttemptId))
      .where(and(eq(eosEsignContractNotices.id, req.params.noticeId), eq(eosEsignContractNotices.companyId, companyId), eq(eosEsignContractNotices.envelopeId, req.params.envelopeId))).limit(1);
    if (!context) throw new NativeEsignError(404, "native_esign_contract_notice_not_found", "The tenant-scoped contract notice or prepared attempt is unavailable.");
    if (context.notice.state !== "sending" || context.notice.version !== input.expectedVersion || context.attempt.state !== "prepared")
      throw new NativeEsignError(409, "native_esign_contract_notice_reconciliation_unavailable", "Only the current stranded sending attempt can be reconciled.");
    const visible = await visibleSeatIds(companyId, operator.access.seat.id, operator.access.role);
    if (!visible.has(context.notice.ownerSeatId) || !mayAccessClassification(operator.access, context.notice.classification)) throw new NativeEsignError(404, "native_esign_contract_notice_not_found", "This contract notice is outside the operator's visible authority scope.");
    const policy = await authorizeAction(req, operator.access, { authorityClass: "decide", resource: "contract_notice_delivery", actionKey: "native_esign.contract_notice.reconcile", purpose: "reconcile_ambiguous_contract_notice_delivery", classification: context.notice.classification, consequence: "material", targetSeatId: context.notice.ownerSeatId });
    const reconciledAt = new Date();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM eos_esign_contract_notices WHERE id = ${context.notice.id} FOR UPDATE`);
      const current = await tx.query.eosEsignContractNotices.findFirst({ where: and(eq(eosEsignContractNotices.id, context.notice.id), eq(eosEsignContractNotices.companyId, companyId)) });
      if (!current || current.state !== "sending" || current.version !== input.expectedVersion || current.lastDeliveryAttemptId !== context.attempt.id)
        throw new NativeEsignError(409, "native_esign_contract_notice_reconciliation_changed", "The notice changed before reconciliation. Refresh and review the attempt again.");
      const [attempt] = await tx.update(eosEsignContractNoticeAttempts).set({ state: input.outcome, providerMessageReference: input.providerMessageReference, failureCode: input.outcome === "delivered" ? "" : `operator_reconciled_${input.outcome}`, failureMessage: "", reconciliationNote: input.reconciliationNote, reconciliationPolicyDecisionId: policy.decisionId, reconciledByUserId: req.user.id, reconciledAt, completedAt: reconciledAt }).where(and(eq(eosEsignContractNoticeAttempts.id, context.attempt.id), eq(eosEsignContractNoticeAttempts.state, "prepared"))).returning();
      if (!attempt) throw new NativeEsignError(409, "native_esign_contract_notice_reconciliation_changed", "The prepared attempt changed before reconciliation.");
      const [notice] = await tx.update(eosEsignContractNotices).set({ state: input.outcome, providerMessageReference: input.providerMessageReference, deliveredAt: input.outcome === "delivered" ? reconciledAt : null, version: current.version + 1, updatedAt: reconciledAt }).where(and(eq(eosEsignContractNotices.id, current.id), eq(eosEsignContractNotices.version, current.version), eq(eosEsignContractNotices.state, "sending"))).returning();
      if (!notice) throw new NativeEsignError(409, "native_esign_contract_notice_reconciliation_changed", "The notice changed before the reconciled outcome could be stored.");
      await appendAuditEvent(tx, { companyId, envelopeId: context.envelope.id, eventType: "contract_notice_delivery_reconciled", actorType: "operator", actorReference: req.user.id, eventProjection: { noticeId: current.id, planId: context.plan.id, attemptId: attempt.id, attemptNumber: attempt.attemptNumber, outcome: input.outcome, providerMessageReference: input.providerMessageReference, reconciliationNote: input.reconciliationNote, contentSha256: current.contentSha256, approvalSha256: current.approvalSha256, policyDecisionId: policy.decisionId } });
      return { notice, attempt };
    });
    res.json(result);
  }));

  app.get("/api/eos/companies/:companyId/native-esign/envelopes", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyReader(req, companyId, "native_esign.envelope.list");
    const input = nativeEsignEnvelopeListSchema.parse(req.query);
    const filters = [eq(eosEsignEnvelopes.companyId, companyId)];
    if (input.state !== "all") filters.push(eq(eosEsignEnvelopes.state, input.state));
    if (input.counterpartyId) filters.push(eq(eosEsignEnvelopes.counterpartyId, input.counterpartyId));
    if (input.q) filters.push(or(ilike(eosEsignEnvelopes.subject, `%${input.q}%`), ilike(eosEsignEnvelopes.message, `%${input.q}%`))!);
    const envelopes = await db.select().from(eosEsignEnvelopes)
      .where(and(...filters))
      .orderBy(desc(eosEsignEnvelopes.updatedAt)).limit(input.limit);
    res.json(envelopes);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/clone", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.envelope.clone");
    const input = nativeEsignCloneSchema.parse(req.body);
    const source = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId)) });
    if (!source || source.recoveryAgreementInstanceId) throw new NativeEsignError(409, "native_esign_clone_unavailable", "This tenant envelope cannot be cloned through the standard contract workflow.");
    if (input.mode === "renewal" && source.state !== "completed") throw new NativeEsignError(409, "native_esign_renewal_requires_completion", "A renewal must originate from a completed agreement.");
    const sourceRecipients = await db.select().from(eosEsignRecipients).where(and(eq(eosEsignRecipients.companyId, companyId), eq(eosEsignRecipients.envelopeId, source.id)));
    const now = new Date();
    const envelopeId = randomUUID();
    const result = await db.transaction(async (tx) => {
      const [envelope] = await tx.insert(eosEsignEnvelopes).values({ id: envelopeId, companyId, documentVersionId: source.documentVersionId, state: "draft", routingMode: source.routingMode, assuranceMode: source.assuranceMode, subject: input.subject || `${source.subject}${input.mode === "renewal" ? " · renewal" : " · copy"}`, message: input.message ?? source.message, expiresAt: input.expiresAt, templateVersionId: source.templateVersionId, counterpartyId: source.counterpartyId, workPacketId: source.workPacketId, clonedFromEnvelopeId: source.id, renewalOfEnvelopeId: input.mode === "renewal" ? source.id : null, version: 1, createdByUserId: req.user.id, createdAt: now, updatedAt: now }).returning();
      const recipients = sourceRecipients.map((recipient) => ({ id: randomUUID(), companyId, envelopeId, roleKey: recipient.roleKey, routingOrder: recipient.routingOrder, signerName: recipient.signerName, signerEmail: recipient.signerEmail, state: "pending", tokenDigest: nativeEsignTokenDigest(createNativeEsignSecret()), tokenExpiresAt: input.expiresAt, version: 1, createdAt: now, updatedAt: now }));
      if (recipients.length) await tx.insert(eosEsignRecipients).values(recipients);
      await appendAuditEvent(tx, { companyId, envelopeId, eventType: input.mode === "renewal" ? "envelope_renewed" : "envelope_cloned", actorType: "operator", actorReference: req.user.id, eventProjection: { sourceEnvelopeId: source.id, sourceState: source.state, documentVersionId: source.documentVersionId, recipientCount: recipients.length } });
      return { envelope, recipientCount: recipients.length };
    });
    res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/replacement", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const access = await requireCompanyOperator(req, companyId, "native_esign.envelope.replace");
    if (!access.isFounder) throw new NativeEsignError(403, "native_esign_replacement_founder_required", "Founder authority is required to retire issued contract text and create its replacement.");
    const input = nativeEsignReplacementSchema.parse(req.body);
    const source = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId)) });
    if (!source || !["issued", "in_progress"].includes(source.state) || source.recoveryAgreementInstanceId || source.replacedByEnvelopeId)
      throw new NativeEsignError(409, "native_esign_replacement_unavailable", "Only an unreplaced, active standard contract envelope can enter the governed replacement workflow.");
    const targetDocument = await db.query.eosEsignDocumentVersions.findFirst({ where: and(eq(eosEsignDocumentVersions.id, input.documentVersionId), eq(eosEsignDocumentVersions.companyId, companyId), eq(eosEsignDocumentVersions.parentDocumentVersionId, source.documentVersionId), eq(eosEsignDocumentVersions.negotiationId, input.negotiationId)) });
    if (!targetDocument) throw new NativeEsignError(409, "native_esign_replacement_document_invalid", "Select the immutable revision created directly from this envelope's document and negotiation.");
    const targetFields = nativeEsignFieldSchema.array().parse(targetDocument.fieldSchema);
    const sourceRecipients = await db.select().from(eosEsignRecipients).where(and(eq(eosEsignRecipients.companyId, companyId), eq(eosEsignRecipients.envelopeId, source.id))).orderBy(eosEsignRecipients.routingOrder);
    assertExactRecipientRoles(targetFields, sourceRecipients);
    const now = new Date(); const envelopeId = randomUUID();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${source.id}))`);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.negotiationId}))`);
      const [currentSource] = await tx.select().from(eosEsignEnvelopes).where(and(eq(eosEsignEnvelopes.id, source.id), eq(eosEsignEnvelopes.companyId, companyId), inArray(eosEsignEnvelopes.state, ["issued", "in_progress"]), sql`${eosEsignEnvelopes.replacedByEnvelopeId} IS NULL`)).limit(1);
      const [negotiation] = await tx.select().from(eosEsignNegotiations).where(and(eq(eosEsignNegotiations.id, input.negotiationId), eq(eosEsignNegotiations.envelopeId, source.id), eq(eosEsignNegotiations.companyId, companyId), eq(eosEsignNegotiations.state, "open"))).limit(1);
      if (!currentSource || !negotiation) throw new NativeEsignError(409, "native_esign_replacement_changed", "The source envelope or negotiation changed before replacement. Refresh and review it.");
      const [replacement] = await tx.insert(eosEsignEnvelopes).values({ id: envelopeId, companyId, documentVersionId: targetDocument.id, state: "draft", routingMode: source.routingMode, assuranceMode: source.assuranceMode, subject: input.subject || source.subject, message: input.message ?? source.message, expiresAt: input.expiresAt, templateVersionId: targetDocument.templateVersionId, counterpartyId: targetDocument.counterpartyId, workPacketId: targetDocument.workPacketId, replacesEnvelopeId: source.id, version: 1, createdByUserId: req.user.id, createdAt: now, updatedAt: now }).returning();
      const recipients = sourceRecipients.map((recipient) => ({ id: randomUUID(), companyId, envelopeId, roleKey: recipient.roleKey, routingOrder: recipient.routingOrder, signerName: recipient.signerName, signerEmail: recipient.signerEmail, state: "pending", tokenDigest: nativeEsignTokenDigest(createNativeEsignSecret()), tokenExpiresAt: input.expiresAt, version: 1, createdAt: now, updatedAt: now }));
      await tx.insert(eosEsignRecipients).values(recipients);
      const resolutionSummary = `Superseded by governed replacement envelope ${envelopeId} using document revision ${targetDocument.id}.`;
      await tx.update(eosEsignEnvelopes).set({ state: "voided", voidedAt: now, voidReason: resolutionSummary, replacedByEnvelopeId: envelopeId, version: currentSource.version + 1, updatedAt: now }).where(and(eq(eosEsignEnvelopes.id, source.id), eq(eosEsignEnvelopes.version, currentSource.version)));
      await tx.update(eosEsignReminderSchedules).set({ state: "cancelled", leasedAt: null, version: sql`${eosEsignReminderSchedules.version} + 1`, updatedAt: now }).where(and(eq(eosEsignReminderSchedules.envelopeId, source.id), inArray(eosEsignReminderSchedules.state, ["active", "delivering", "paused"])));
      await tx.update(eosEsignNegotiations).set({ state: "resolved", resolutionSummary, resolvedByUserId: req.user.id, resolvedAt: now, replacementDocumentVersionId: targetDocument.id, replacementEnvelopeId: envelopeId, version: negotiation.version + 1, updatedAt: now }).where(and(eq(eosEsignNegotiations.id, negotiation.id), eq(eosEsignNegotiations.version, negotiation.version)));
      const [previous] = await tx.select().from(eosEsignNegotiationEntries).where(eq(eosEsignNegotiationEntries.negotiationId, negotiation.id)).orderBy(desc(eosEsignNegotiationEntries.createdAt)).limit(1);
      const entryId = randomUUID();
      const entryCreatedAt = new Date(Math.max(now.getTime(), (previous?.createdAt?.getTime() || 0) + 1));
      const entrySha256 = nativeContractContentSha256({ schemaVersion: "eos-native-esign-negotiation-entry.v1", entryId, negotiationId: negotiation.id, envelopeId: source.id, authorType: "operator", authorReference: req.user.id, entryType: "resolution", body: resolutionSummary, requestedChanges: [], previousEntrySha256: previous?.entrySha256 || "", createdAt: entryCreatedAt.toISOString() });
      await tx.insert(eosEsignNegotiationEntries).values({ id: entryId, companyId, negotiationId: negotiation.id, envelopeId: source.id, authorType: "operator", authorReference: req.user.id, entryType: "resolution", body: resolutionSummary, requestedChanges: [], previousEntrySha256: previous?.entrySha256 || "", entrySha256, createdAt: entryCreatedAt });
      await appendAuditEvent(tx, { companyId, envelopeId: source.id, eventType: "negotiation_resolved", actorType: "operator", actorReference: req.user.id, eventProjection: { negotiationId: negotiation.id, replacementDocumentVersionId: targetDocument.id, replacementEnvelopeId: envelopeId, entrySha256 } });
      await appendAuditEvent(tx, { companyId, envelopeId: source.id, eventType: "envelope_replaced", actorType: "operator", actorReference: req.user.id, eventProjection: { replacementEnvelopeId: envelopeId, replacementDocumentVersionId: targetDocument.id, previousState: currentSource.state } });
      await appendAuditEvent(tx, { companyId, envelopeId, eventType: "envelope_replacement_created", actorType: "operator", actorReference: req.user.id, eventProjection: { sourceEnvelopeId: source.id, sourceDocumentVersionId: source.documentVersionId, documentVersionId: targetDocument.id, recipientCount: recipients.length } });
      return { envelope: replacement, recipientCount: recipients.length, retiredEnvelopeId: source.id, negotiationId: negotiation.id };
    });
    res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/issue", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const access = await requireCompanyOperator(req, companyId, "native_esign.envelope.issue");
    const input = nativeEsignIssueSchema.parse(req.body);
    const envelope = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId)) });
    if (!envelope || envelope.state !== "draft") throw new NativeEsignError(409, "native_esign_envelope_not_draft", "Only a tenant-scoped draft envelope can be issued.");
    if (envelope.expiresAt <= new Date()) throw new NativeEsignError(409, "native_esign_envelope_expired", "Set a future expiry before issuing this envelope.");
    if (envelope.recoveryAgreementInstanceId) {
      if (!access.isFounder)
        throw new NativeEsignError(403, "native_esign_recovery_founder_required", "Founder authority is required to issue a Recovery agreement.");
      const [agreement] = await db.select({ agreement: eosRecoveryAgreementInstances, authority: eosRecoveryAgreementAuthorities })
        .from(eosRecoveryAgreementInstances).innerJoin(eosRecoveryAgreementAuthorities, eq(eosRecoveryAgreementAuthorities.id, eosRecoveryAgreementInstances.authorityId))
        .where(and(eq(eosRecoveryAgreementInstances.id, envelope.recoveryAgreementInstanceId), eq(eosRecoveryAgreementInstances.companyId, companyId))).limit(1);
      if (!agreement || agreement.agreement.eSignProvider !== "eos_native" || agreement.agreement.eSignTemplateReference !== envelope.documentVersionId || !["counsel_approved", "counsel_approved_with_changes"].includes(agreement.authority.state) || agreement.agreement.state !== "eligible_to_issue")
        throw new NativeEsignError(409, "native_esign_recovery_not_eligible", "Recovery issuance requires effective counsel authority and authoritative payment readiness.");
    }
    const comparison = envelope.replacesEnvelopeId
      ? await db.query.eosEsignDocumentComparisons.findFirst({ where: and(eq(eosEsignDocumentComparisons.companyId, companyId), eq(eosEsignDocumentComparisons.targetDocumentVersionId, envelope.documentVersionId)) })
      : undefined;
    if (envelope.replacesEnvelopeId && !access.isFounder)
      throw new NativeEsignError(403, "native_esign_replacement_issue_founder_required", "Founder authority is required to review and issue replacement contract text.");
    if (envelope.replacesEnvelopeId && (!comparison || input.comparisonReviewSha256 !== comparison.comparisonSha256))
      throw new NativeEsignError(409, "native_esign_comparison_review_required", "Review and acknowledge the exact sealed comparison before issuing this replacement.");
    const recipients = await db.select().from(eosEsignRecipients)
      .where(eq(eosEsignRecipients.envelopeId, envelope.id))
      .orderBy(eosEsignRecipients.routingOrder, eosEsignRecipients.roleKey);
    const issuedAt = new Date();
    const links = recipients.map((recipient) => ({ recipient, secret: createNativeEsignSecret() }));
    await db.transaction(async (tx) => {
      const [issued] = await tx.update(eosEsignEnvelopes).set({ state: "issued", issuedAt, comparisonReviewSha256: comparison?.comparisonSha256 || "", comparisonReviewedByUserId: comparison ? req.user.id : null, comparisonReviewedAt: comparison ? issuedAt : null, version: envelope.version + 1, updatedAt: issuedAt }).where(and(eq(eosEsignEnvelopes.id, envelope.id), eq(eosEsignEnvelopes.version, envelope.version), eq(eosEsignEnvelopes.state, "draft"))).returning();
      if (!issued) throw new NativeEsignError(409, "native_esign_envelope_changed", "Envelope state changed before issuance.");
      if (comparison) await appendAuditEvent(tx, { companyId, envelopeId: envelope.id, eventType: "comparison_reviewed", actorType: "operator", actorReference: req.user.id, eventProjection: { comparisonSha256: comparison.comparisonSha256, comparisonType: comparison.comparisonType } });
      for (const item of links) {
        const routingState = recipientRoutingState(envelope, recipients, item.recipient);
        await tx.update(eosEsignRecipients).set({ state: routingState === "active" ? "sent" : "pending", sentAt: routingState === "active" ? issuedAt : null, tokenDigest: nativeEsignTokenDigest(item.secret), tokenExpiresAt: envelope.expiresAt, deliveryState: routingState === "active" ? "manual_ready" : "routing_wait", providerMessageReference: "", identityAssuranceState: envelope.assuranceMode === "email_otp" ? "pending" : "not_required", identityVerifiedAt: null, otpDigest: "", otpExpiresAt: null, otpAttemptCount: 0, otpSendCount: 0, otpLastSentAt: null, version: item.recipient.version + 1, updatedAt: issuedAt }).where(and(eq(eosEsignRecipients.id, item.recipient.id), eq(eosEsignRecipients.version, item.recipient.version)));
        if (routingState === "active") await appendAuditEvent(tx, { companyId, envelopeId: envelope.id, recipientId: item.recipient.id, eventType: "recipient_sent", actorType: "operator", actorReference: req.user.id, eventProjection: { routingOrder: item.recipient.routingOrder } });
      }
      await appendAuditEvent(tx, { companyId, envelopeId: envelope.id, eventType: "envelope_issued", actorType: "operator", actorReference: req.user.id, eventProjection: { expiresAt: envelope.expiresAt.toISOString(), assuranceMode: envelope.assuranceMode, recipientCount: recipients.length, comparisonReviewSha256: comparison?.comparisonSha256 || null } });
      if (envelope.recoveryAgreementInstanceId)
        await tx.update(eosRecoveryAgreementInstances).set({ state: "issued", eSignProvider: "eos_native", nativeEnvelopeId: envelope.id, providerEnvelopeReference: envelope.id, version: sql`${eosRecoveryAgreementInstances.version} + 1`, updatedAt: issuedAt }).where(and(eq(eosRecoveryAgreementInstances.id, envelope.recoveryAgreementInstanceId), eq(eosRecoveryAgreementInstances.companyId, companyId), eq(eosRecoveryAgreementInstances.state, "eligible_to_issue")));
    });
    const publicOrigin = process.env.EOS_PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`;
    res.json({ id: envelope.id, state: "issued", issuedAt, recipients: links.map(({ recipient, secret }) => {
      const routingState = recipientRoutingState(envelope, recipients, recipient);
      return { id: recipient.id, roleKey: recipient.roleKey, signerName: recipient.signerName, signerEmail: recipient.signerEmail, routingOrder: recipient.routingOrder, routingState, signingUrl: routingState === "active" ? nativeEsignUrl(secret, publicOrigin) : null };
    }) });
  }));

  app.get("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const reader = await requireCompanyReader(req, companyId, "native_esign.envelope.read");
    const envelope = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId)) });
    if (!envelope) throw new NativeEsignError(404, "native_esign_envelope_not_found", "Envelope is not available in this company.");
    const document = await db.query.eosEsignDocumentVersions.findFirst({ where: and(eq(eosEsignDocumentVersions.id, envelope.documentVersionId), eq(eosEsignDocumentVersions.companyId, companyId)) });
    const comparison = document?.parentDocumentVersionId
      ? await db.query.eosEsignDocumentComparisons.findFirst({ where: and(eq(eosEsignDocumentComparisons.companyId, companyId), eq(eosEsignDocumentComparisons.targetDocumentVersionId, document.id)) })
      : undefined;
    const custody = await ensureEnvelopeCustodyInventory(companyId, envelope.id);
    const [recipients, events, deliveryAttempts, completionDeliveries, integrityChecks, negotiations, reminderSchedules, obligationPromotions] = await Promise.all([
      db.select().from(eosEsignRecipients).where(and(eq(eosEsignRecipients.envelopeId, envelope.id), eq(eosEsignRecipients.companyId, companyId))).orderBy(eosEsignRecipients.routingOrder, eosEsignRecipients.roleKey),
      db.select().from(eosEsignEvents).where(and(eq(eosEsignEvents.envelopeId, envelope.id), eq(eosEsignEvents.companyId, companyId))).orderBy(eosEsignEvents.sequence),
      db.select().from(eosEsignDeliveryAttempts).where(and(eq(eosEsignDeliveryAttempts.envelopeId, envelope.id), eq(eosEsignDeliveryAttempts.companyId, companyId))).orderBy(eosEsignDeliveryAttempts.preparedAt),
      db.select().from(eosEsignCompletionDeliveries).where(and(eq(eosEsignCompletionDeliveries.envelopeId, envelope.id), eq(eosEsignCompletionDeliveries.companyId, companyId))).orderBy(eosEsignCompletionDeliveries.createdAt),
      db.select().from(eosEsignIntegrityChecks).where(and(eq(eosEsignIntegrityChecks.envelopeId, envelope.id), eq(eosEsignIntegrityChecks.companyId, companyId))).orderBy(desc(eosEsignIntegrityChecks.checkedAt)).limit(100),
      db.select().from(eosEsignNegotiations).where(and(eq(eosEsignNegotiations.envelopeId, envelope.id), eq(eosEsignNegotiations.companyId, companyId))).orderBy(desc(eosEsignNegotiations.createdAt)),
      db.select().from(eosEsignReminderSchedules).where(and(eq(eosEsignReminderSchedules.envelopeId, envelope.id), eq(eosEsignReminderSchedules.companyId, companyId))).orderBy(desc(eosEsignReminderSchedules.createdAt)),
      db.select().from(eosEsignObligationPromotions).where(and(eq(eosEsignObligationPromotions.envelopeId, envelope.id), eq(eosEsignObligationPromotions.companyId, companyId))).orderBy(desc(eosEsignObligationPromotions.promotedAt)),
    ]);
    const obligationIds = obligationPromotions.map((promotion) => promotion.obligationId);
    const promotionIds = obligationPromotions.map((promotion) => promotion.id);
    const [promotedObligations, obligationReviews] = obligationIds.length ? await Promise.all([
      db.select().from(eosRisksControls).where(and(eq(eosRisksControls.companyId, companyId), inArray(eosRisksControls.id, obligationIds))),
      db.select().from(eosEsignObligationReviews).where(and(eq(eosEsignObligationReviews.companyId, companyId), inArray(eosEsignObligationReviews.promotionId, promotionIds))).orderBy(desc(eosEsignObligationReviews.reviewedAt)),
    ]) : [[], []];
    const ownerSeatIds = Array.from(new Set(promotedObligations.map((obligation) => obligation.ownerSeatId)));
    const obligationOwners = ownerSeatIds.length
      ? await db.select().from(eosSeats).where(and(eq(eosSeats.companyId, companyId), inArray(eosSeats.id, ownerSeatIds)))
      : [];
    const visibleObligationSeatIds = await visibleSeatIds(companyId, reader.access.seat.id, reader.access.role);
    const visibleObligationPromotions = obligationPromotions.filter((promotion) => {
      const obligation = promotedObligations.find((item) => item.id === promotion.obligationId);
      return Boolean(obligation && visibleObligationSeatIds.has(obligation.ownerSeatId) && mayAccessClassification(reader.access, obligation.classification));
    });
    const negotiationIds = negotiations.map((item) => item.id);
    const negotiationEntries = negotiationIds.length ? await db.select().from(eosEsignNegotiationEntries).where(and(eq(eosEsignNegotiationEntries.companyId, companyId), inArray(eosEsignNegotiationEntries.negotiationId, negotiationIds))).orderBy(eosEsignNegotiationEntries.createdAt) : [];
    const completionDeliveryIds = completionDeliveries.map((delivery) => delivery.id);
    const completionDeliveryAttempts = completionDeliveryIds.length
      ? await db.select().from(eosEsignCompletionDeliveryAttempts).where(and(eq(eosEsignCompletionDeliveryAttempts.companyId, companyId), inArray(eosEsignCompletionDeliveryAttempts.deliveryId, completionDeliveryIds))).orderBy(eosEsignCompletionDeliveryAttempts.attemptedAt)
      : [];
    res.json({
      envelope,
      document,
      comparison: nativeEsignComparisonProjection(comparison),
      recipients: recipients.map(({ tokenDigest: _tokenDigest, otpDigest: _otpDigest, completionTokenDigest: _completionTokenDigest, signatureCaptureStorageKey: _signatureCaptureStorageKey, ...recipient }) => ({
        ...recipient,
        routingState: recipientRoutingState(envelope, recipients, recipient),
      })),
      events,
      deliveryAttempts: deliveryAttempts.map(({ tokenDigest: _tokenDigest, ...attempt }) => attempt),
      completionDeliveries: completionDeliveries.map(({ tokenCiphertext: _tokenCiphertext, ...delivery }) => delivery),
      completionDeliveryAttempts,
      integrityChecks,
      negotiations: negotiations.map((negotiation) => ({ ...negotiation, entries: negotiationEntries.filter((entry) => entry.negotiationId === negotiation.id) })),
      reminderSchedules,
      obligationPromotions: visibleObligationPromotions.map((promotion) => ({
        ...promotion,
        obligation: promotedObligations.find((obligation) => obligation.id === promotion.obligationId) || null,
        ownerSeat: (() => {
          const obligation = promotedObligations.find((item) => item.id === promotion.obligationId);
          const seat = obligationOwners.find((item) => item.id === obligation?.ownerSeatId);
          return seat ? { id: seat.id, title: seat.title, kind: seat.kind, agentName: seat.agentName, status: seat.status } : null;
        })(),
        reviews: obligationReviews.filter((review) => review.promotionId === promotion.id),
      })),
      custody: custody ? {
        ...custody,
        artifacts: custody.artifacts.map(({ storageKey: _storageKey, backupStorageKey: _backupStorageKey, ...artifact }) => artifact),
      } : null,
    });
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/negotiations/:negotiationId/entries", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.negotiation.respond");
    const input = nativeEsignNegotiationEntrySchema.parse(req.body);
    const negotiation = await db.query.eosEsignNegotiations.findFirst({ where: and(eq(eosEsignNegotiations.id, req.params.negotiationId), eq(eosEsignNegotiations.envelopeId, req.params.envelopeId), eq(eosEsignNegotiations.companyId, companyId), eq(eosEsignNegotiations.state, "open")) });
    if (!negotiation) throw new NativeEsignError(409, "native_esign_negotiation_unavailable", "The open tenant negotiation is unavailable.");
    const entryId = randomUUID();
    const [entry] = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${negotiation.id}))`);
      const [currentNegotiation] = await tx.select().from(eosEsignNegotiations).where(and(eq(eosEsignNegotiations.id, negotiation.id), eq(eosEsignNegotiations.state, "open"))).limit(1);
      if (!currentNegotiation) throw new NativeEsignError(409, "native_esign_negotiation_changed", "The negotiation changed before this response.");
      const [previous] = await tx.select().from(eosEsignNegotiationEntries).where(and(eq(eosEsignNegotiationEntries.negotiationId, negotiation.id), eq(eosEsignNegotiationEntries.companyId, companyId))).orderBy(desc(eosEsignNegotiationEntries.createdAt)).limit(1);
      const now = new Date(Math.max(Date.now(), (previous?.createdAt?.getTime() || 0) + 1));
      const entrySha256 = nativeContractContentSha256({ schemaVersion: "eos-native-esign-negotiation-entry.v1", entryId, negotiationId: negotiation.id, envelopeId: negotiation.envelopeId, authorType: "operator", authorReference: req.user.id, entryType: "response", body: input.body, requestedChanges: input.requestedChanges, previousEntrySha256: previous?.entrySha256 || "", createdAt: now.toISOString() });
      const created = await tx.insert(eosEsignNegotiationEntries).values({ id: entryId, companyId, negotiationId: negotiation.id, envelopeId: negotiation.envelopeId, authorType: "operator", authorReference: req.user.id, entryType: "response", body: input.body, requestedChanges: input.requestedChanges, previousEntrySha256: previous?.entrySha256 || "", entrySha256, createdAt: now }).returning();
      await tx.update(eosEsignNegotiations).set({ version: currentNegotiation.version + 1, updatedAt: now }).where(and(eq(eosEsignNegotiations.id, negotiation.id), eq(eosEsignNegotiations.version, currentNegotiation.version)));
      await appendAuditEvent(tx, { companyId, envelopeId: negotiation.envelopeId, eventType: "negotiation_entry_recorded", actorType: "operator", actorReference: req.user.id, eventProjection: { negotiationId: negotiation.id, entryId, entrySha256 } });
      return created;
    });
    res.status(201).json(entry);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/negotiations/:negotiationId/resolve", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.negotiation.resolve");
    const input = nativeEsignNegotiationResolutionSchema.parse(req.body);
    const [resolved] = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${req.params.negotiationId}))`);
      const previous = await tx.select().from(eosEsignNegotiationEntries).where(eq(eosEsignNegotiationEntries.negotiationId, req.params.negotiationId)).orderBy(desc(eosEsignNegotiationEntries.createdAt)).limit(1);
      const now = new Date(Math.max(Date.now(), (previous[0]?.createdAt?.getTime() || 0) + 1));
      const changed = await tx.update(eosEsignNegotiations).set({ state: "resolved", resolutionSummary: input.resolutionSummary, resolvedByUserId: req.user.id, resolvedAt: now, version: input.version + 1, updatedAt: now }).where(and(eq(eosEsignNegotiations.id, req.params.negotiationId), eq(eosEsignNegotiations.envelopeId, req.params.envelopeId), eq(eosEsignNegotiations.companyId, companyId), eq(eosEsignNegotiations.state, "open"), eq(eosEsignNegotiations.version, input.version))).returning();
      if (!changed[0]) throw new NativeEsignError(409, "native_esign_negotiation_changed", "The negotiation changed before resolution. Refresh and review it.");
      const entryId = randomUUID();
      const entrySha256 = nativeContractContentSha256({ schemaVersion: "eos-native-esign-negotiation-entry.v1", entryId, negotiationId: changed[0].id, envelopeId: changed[0].envelopeId, authorType: "operator", authorReference: req.user.id, entryType: "resolution", body: input.resolutionSummary, requestedChanges: [], previousEntrySha256: previous[0]?.entrySha256 || "", createdAt: now.toISOString() });
      await tx.insert(eosEsignNegotiationEntries).values({ id: entryId, companyId, negotiationId: changed[0].id, envelopeId: changed[0].envelopeId, authorType: "operator", authorReference: req.user.id, entryType: "resolution", body: input.resolutionSummary, requestedChanges: [], previousEntrySha256: previous[0]?.entrySha256 || "", entrySha256, createdAt: now });
      await appendAuditEvent(tx, { companyId, envelopeId: changed[0].envelopeId, eventType: "negotiation_resolved", actorType: "operator", actorReference: req.user.id, eventProjection: { negotiationId: changed[0].id, resolutionSummary: input.resolutionSummary, entrySha256 } });
      return changed;
    });
    res.json(resolved);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/recipients/:recipientId/reminder-schedule", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.reminder.schedule");
    const input = nativeEsignReminderScheduleSchema.parse(req.body);
    const [context] = await db.select({ envelope: eosEsignEnvelopes, recipient: eosEsignRecipients }).from(eosEsignEnvelopes).innerJoin(eosEsignRecipients, eq(eosEsignRecipients.envelopeId, eosEsignEnvelopes.id)).where(and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId), eq(eosEsignRecipients.id, req.params.recipientId), eq(eosEsignRecipients.companyId, companyId))).limit(1);
    if (!context || !["issued", "in_progress"].includes(context.envelope.state)) throw new NativeEsignError(409, "native_esign_reminder_unavailable", "Only an incomplete recipient on an active envelope can receive scheduled reminders.");
    const routingRecipients = await db.select({ routingOrder: eosEsignRecipients.routingOrder, state: eosEsignRecipients.state }).from(eosEsignRecipients).where(and(eq(eosEsignRecipients.envelopeId, context.envelope.id), eq(eosEsignRecipients.companyId, companyId)));
    assertRecipientRoutingActive(context.envelope, routingRecipients, context.recipient);
    if (!["sent", "opened", "consented"].includes(context.recipient.state)) throw new NativeEsignError(409, "native_esign_reminder_unavailable", "Email or rotate the active recipient link before scheduling reminders.");
    const activeSchedule = await db.query.eosEsignReminderSchedules.findFirst({ where: and(eq(eosEsignReminderSchedules.recipientId, context.recipient.id), inArray(eosEsignReminderSchedules.state, ["active", "delivering"])) });
    if (activeSchedule) throw new NativeEsignError(409, "native_esign_reminder_already_active", "This recipient already has an active reminder schedule.");
    const now = new Date(); const id = randomUUID();
    const [schedule] = await db.transaction(async (tx) => {
      const created = await tx.insert(eosEsignReminderSchedules).values({ id, companyId, envelopeId: context.envelope.id, recipientId: context.recipient.id, state: "active", nextReminderAt: input.nextReminderAt, intervalDays: input.intervalDays, maxReminders: input.maxReminders, sentCount: 0, requestedByUserId: req.user.id, version: 1, createdAt: now, updatedAt: now }).returning();
      await appendAuditEvent(tx, { companyId, envelopeId: context.envelope.id, recipientId: context.recipient.id, eventType: "reminder_scheduled", actorType: "operator", actorReference: req.user.id, eventProjection: { scheduleId: id, nextReminderAt: input.nextReminderAt.toISOString(), intervalDays: input.intervalDays, maxReminders: input.maxReminders } });
      return created;
    });
    res.status(201).json(schedule);
  }));

  app.patch("/api/eos/companies/:companyId/native-esign/reminder-schedules/:scheduleId", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.reminder.update");
    const input = nativeEsignReminderScheduleUpdateSchema.parse(req.body); const now = new Date();
    const [schedule] = await db.transaction(async (tx) => {
      const changed = await tx.update(eosEsignReminderSchedules).set({ state: input.state, nextReminderAt: input.nextReminderAt, version: input.version + 1, updatedAt: now }).where(and(eq(eosEsignReminderSchedules.id, req.params.scheduleId), eq(eosEsignReminderSchedules.companyId, companyId), eq(eosEsignReminderSchedules.version, input.version), inArray(eosEsignReminderSchedules.state, ["active", "paused"]))).returning();
      if (!changed[0]) throw new NativeEsignError(409, "native_esign_reminder_changed", "The reminder schedule changed before this update.");
      await appendAuditEvent(tx, { companyId, envelopeId: changed[0].envelopeId, recipientId: changed[0].recipientId, eventType: "reminder_schedule_changed", actorType: "operator", actorReference: req.user.id, eventProjection: { scheduleId: changed[0].id, state: changed[0].state, nextReminderAt: changed[0].nextReminderAt.toISOString() } });
      return changed;
    });
    res.json(schedule);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/batches", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const access = await requireCompanyOperator(req, companyId, "native_esign.batch.execute");
    const input = nativeEsignBatchSchema.parse(req.body);
    if (input.action === "void" && !access.isFounder) throw new NativeEsignError(403, "native_esign_void_founder_required", "Founder authority is required for bulk voiding.");
    const batchId = randomUUID(); const now = new Date();
    await db.insert(eosEsignBatches).values({ id: batchId, companyId, action: input.action, state: "running", reason: input.reason, requestedByUserId: req.user.id, requestedCount: input.envelopeIds.length, createdAt: now });
    const results: Array<{ envelopeId: string; outcome: "succeeded" | "failed" | "skipped"; failureCode: string; recipientIds?: string[] }> = [];
    for (const envelopeId of input.envelopeIds) {
      const envelope = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, envelopeId), eq(eosEsignEnvelopes.companyId, companyId)) });
      if (!envelope) { results.push({ envelopeId, outcome: "failed", failureCode: "envelope_unavailable" }); continue; }
      if (input.action === "void") {
        if (!["draft", "issued", "in_progress"].includes(envelope.state)) { results.push({ envelopeId, outcome: "skipped", failureCode: "envelope_not_voidable" }); continue; }
        const changed = await db.transaction(async (tx) => {
          const [updated] = await tx.update(eosEsignEnvelopes).set({ state: "voided", voidedAt: now, voidReason: input.reason, version: envelope.version + 1, updatedAt: now }).where(and(eq(eosEsignEnvelopes.id, envelope.id), eq(eosEsignEnvelopes.version, envelope.version), inArray(eosEsignEnvelopes.state, ["draft", "issued", "in_progress"]))).returning();
          if (updated) await appendAuditEvent(tx, { companyId, envelopeId, eventType: "envelope_voided", actorType: "operator", actorReference: req.user.id, eventProjection: { reason: input.reason, batchId } });
          return updated;
        });
        if (!changed) { results.push({ envelopeId, outcome: "failed", failureCode: "envelope_changed" }); continue; }
        results.push({ envelopeId, outcome: "succeeded", failureCode: "" });
      } else {
        const recipients = await db.select().from(eosEsignRecipients).where(and(eq(eosEsignRecipients.companyId, companyId), eq(eosEsignRecipients.envelopeId, envelopeId), inArray(eosEsignRecipients.state, ["sent", "opened", "consented"])));
        if (!["issued", "in_progress"].includes(envelope.state) || !recipients.length) { results.push({ envelopeId, outcome: "skipped", failureCode: "no_active_recipients" }); continue; }
        const outcomes = await Promise.all(recipients.map((recipient) => deliverNativeEsignRecipient({ companyId, envelopeId, recipientId: recipient.id, requestedByUserId: req.user.id, actorType: "operator", publicOrigin: process.env.EOS_PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}` })));
        results.push({ envelopeId, outcome: outcomes.every((item) => item.outcome === "delivered") ? "succeeded" : "failed", failureCode: outcomes.find((item) => item.outcome !== "delivered")?.failureCode || "", recipientIds: recipients.map((item) => item.id) });
      }
    }
    const completedAt = new Date();
    const items = results.map((result) => ({ id: randomUUID(), companyId, batchId, envelopeId: result.envelopeId, outcome: result.outcome, failureCode: result.failureCode, resultProjection: { recipientIds: result.recipientIds || [] }, itemSha256: "", createdAt: completedAt })).map((item) => ({ ...item, itemSha256: nativeContractContentSha256({ ...item, createdAt: completedAt.toISOString() }) }));
    const succeededCount = results.filter((item) => item.outcome === "succeeded").length; const failedCount = results.length - succeededCount;
    const state = succeededCount === results.length ? "completed" : succeededCount ? "partial" : "failed";
    const receiptSha256 = nativeContractContentSha256({ schemaVersion: "eos-native-esign-batch.v1", batchId, companyId, action: input.action, reason: input.reason, requestedByUserId: req.user.id, items: items.map((item) => item.itemSha256), completedAt: completedAt.toISOString() });
    await db.transaction(async (tx) => { await tx.insert(eosEsignBatchItems).values(items); await tx.update(eosEsignBatches).set({ state, succeededCount, failedCount, receiptSha256, completedAt }).where(eq(eosEsignBatches.id, batchId)); for (const envelopeId of input.envelopeIds.filter((id) => results.some((result) => result.envelopeId === id && result.outcome === "succeeded"))) await appendAuditEvent(tx, { companyId, envelopeId, eventType: "batch_completed", actorType: "operator", actorReference: req.user.id, eventProjection: { batchId, action: input.action, state, receiptSha256 } }); });
    res.status(201).json({ id: batchId, action: input.action, state, succeededCount, failedCount, receiptSha256, items: results });
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/promote-obligation", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const operator = await requireCompanyOperator(req, companyId, "native_esign.obligation.promote");
    const input = nativeEsignObligationPromotionSchema.parse(req.body);
    if (!mayAccessClassification(operator.access, input.classification))
      throw new NativeEsignError(403, "native_esign_obligation_classification_denied", "The requested obligation classification exceeds this operator's active disclosure authority.");
    const envelope = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId), eq(eosEsignEnvelopes.state, "completed")) });
    if (!envelope?.evidenceId) throw new NativeEsignError(409, "native_esign_obligation_evidence_required", "Promote and verify this executed contract as canonical Evidence before recording obligations from it.");
    const visible = await visibleSeatIds(companyId, operator.access.seat.id, operator.access.role);
    if (!visible.has(input.ownerSeatId)) throw new NativeEsignError(404, "native_esign_obligation_owner_unavailable", "The accountable seat is not available in this operator's visible organization scope.");
    const seat = await db.query.eosSeats.findFirst({ where: and(eq(eosSeats.id, input.ownerSeatId), eq(eosSeats.companyId, companyId), eq(eosSeats.status, "active")) });
    if (!seat) throw new NativeEsignError(409, "native_esign_obligation_owner_unavailable", "The accountable seat is not active in this tenant.");
    const existingObligation = await db.query.eosRisksControls.findFirst({ where: and(eq(eosRisksControls.companyId, companyId), eq(eosRisksControls.riskControlKey, input.obligationKey)) });
    if (existingObligation) throw new NativeEsignError(409, "native_esign_obligation_key_exists", "This tenant already uses that obligation key.");
    const policy = await authorizeAction(req, operator.access, {
      authorityClass: "execute",
      resource: "risk_control",
      actionKey: "native_esign.obligation.promote",
      purpose: "govern_contract_obligations",
      classification: input.classification,
      consequence: "material",
      targetSeatId: operator.access.seat.id,
    });
    const now = new Date(); const obligationId = randomUUID(); const promotionId = randomUUID(); const excerptSha256 = createHash("sha256").update(input.sourceExcerpt, "utf8").digest("hex");
    const receiptSha256 = nativeContractContentSha256({ schemaVersion: "eos-native-esign-obligation-promotion.v1", promotionId, companyId, envelopeId: envelope.id, evidenceId: envelope.evidenceId, obligationId, obligationKey: input.obligationKey, ownerSeatId: input.ownerSeatId, excerptSha256, policyDecisionId: policy.decisionId, promotedByUserId: req.user.id, promotedAt: now.toISOString() });
    const result = await db.transaction(async (tx) => {
      const [obligation] = await tx.insert(eosRisksControls).values({ id: obligationId, companyId, riskControlKey: input.obligationKey, recordType: "obligation", title: input.title, state: "identified", ownerSeatId: input.ownerSeatId, descriptionCauseEventImpact: input.description, sourceRequirement: `Executed agreement ${envelope.id}; human-reviewed excerpt SHA-256 ${excerptSha256}`, evidenceIds: [envelope.evidenceId], policyDecisionWorkKeys: envelope.workPacketId ? [envelope.workPacketId] : [], notes: "Human-promoted contract obligation. EOS does not provide legal interpretation or approval.", sourceAuthority: "native_eos", classification: input.classification, schemaVersion: "risk-obligation-control-v1.0", dueReviewAt: input.dueReviewAt, validFrom: now, recordedByUserId: req.user.id, createdAt: now, updatedAt: now }).returning();
      const [promotion] = await tx.insert(eosEsignObligationPromotions).values({ id: promotionId, companyId, envelopeId: envelope.id, evidenceId: envelope.evidenceId!, obligationId, sourceExcerpt: input.sourceExcerpt, sourceExcerptSha256: excerptSha256, promotedByUserId: req.user.id, receiptSha256, promotedAt: now, createdAt: now }).returning();
      await appendAuditEvent(tx, { companyId, envelopeId: envelope.id, eventType: "obligation_promoted", actorType: "operator", actorReference: req.user.id, eventProjection: { obligationId, evidenceId: envelope.evidenceId, ownerSeatId: input.ownerSeatId, excerptSha256, receiptSha256, policyDecisionId: policy.decisionId } });
      return { obligation, promotion };
    });
    res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/obligations/:obligationId/reviews", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const operator = await requireCompanyOperator(req, companyId, "native_esign.obligation.review");
    const input = nativeEsignObligationReviewSchema.parse(req.body);
    const promotion = await db.query.eosEsignObligationPromotions.findFirst({ where: and(
      eq(eosEsignObligationPromotions.companyId, companyId),
      eq(eosEsignObligationPromotions.envelopeId, req.params.envelopeId),
      eq(eosEsignObligationPromotions.obligationId, req.params.obligationId),
    ) });
    if (!promotion) throw new NativeEsignError(404, "native_esign_obligation_not_found", "This contract obligation is not available in the selected tenant-scoped envelope.");
    const obligation = await db.query.eosRisksControls.findFirst({ where: and(
      eq(eosRisksControls.id, promotion.obligationId),
      eq(eosRisksControls.companyId, companyId),
      eq(eosRisksControls.recordType, "obligation"),
    ) });
    if (!obligation) throw new NativeEsignError(404, "native_esign_obligation_not_found", "The canonical obligation projection is unavailable.");
    const visible = await visibleSeatIds(companyId, operator.access.seat.id, operator.access.role);
    if (!visible.has(obligation.ownerSeatId) || !mayAccessClassification(operator.access, obligation.classification))
      throw new NativeEsignError(404, "native_esign_obligation_not_found", "This contract obligation is outside the operator's visible authority scope.");
    if (obligation.updatedAt.getTime() !== input.expectedUpdatedAt.getTime())
      throw new NativeEsignError(409, "native_esign_obligation_concurrent_change", "The obligation changed before this review. Refresh and review the current state before trying again.");
    if (!canTransitionRiskControl(obligation.state as any, input.targetState))
      throw new NativeEsignError(409, "native_esign_obligation_transition_invalid", `The obligation cannot move from ${obligation.state} to ${input.targetState}.`);
    if (input.nextReviewAt && input.nextReviewAt.getTime() <= Date.now())
      throw new NativeEsignError(400, "native_esign_obligation_review_date_invalid", "The next active review must be scheduled in the future.");

    const ownerSeat = await db.query.eosSeats.findFirst({ where: and(
      eq(eosSeats.id, input.ownerSeatId),
      eq(eosSeats.companyId, companyId),
      eq(eosSeats.status, "active"),
    ) });
    if (!ownerSeat || !visible.has(ownerSeat.id))
      throw new NativeEsignError(404, "native_esign_obligation_owner_unavailable", "The accountable seat is not active in this operator's visible organization scope.");

    const evidenceRows = input.evidenceIds.length ? await db.select({ evidence: eosEvidence, packet: eosWorkPackets })
      .from(eosEvidence)
      .innerJoin(eosWorkPackets, eq(eosWorkPackets.id, eosEvidence.workPacketId))
      .where(and(eq(eosEvidence.companyId, companyId), eq(eosWorkPackets.companyId, companyId), inArray(eosEvidence.id, input.evidenceIds))) : [];
    const evidenceIsVisibleAndVerified = evidenceRows.length === input.evidenceIds.length && evidenceRows.every(({ evidence, packet }) =>
      evidence.verificationState === "verified" &&
      mayAccessClassification(operator.access, evidence.dataClassification) &&
      mayAccessClassification(operator.access, packet.classification) &&
      (operator.access.isOwner || Boolean(packet.accountableSeatId && visible.has(packet.accountableSeatId))));
    if (!evidenceIsVisibleAndVerified)
      throw new NativeEsignError(409, "native_esign_obligation_evidence_invalid", "Every operational Evidence item must be verified and available in this operator's tenant, hierarchy, and disclosure scope.");
    if (["overdue_breached", "satisfied_closed"].includes(input.targetState) && !input.evidenceIds.some((id) => id !== promotion.evidenceId))
      throw new NativeEsignError(409, "native_esign_obligation_operational_evidence_required", "The executed contract proves the source obligation, not breach or satisfaction. Attach separate verified operational Evidence.");

    const materialDecision = ["accepted", "satisfied_closed", "superseded"].includes(input.targetState);
    const authorityClass = materialDecision ? "decide" : "execute";
    const policy = await authorizeAction(req, operator.access, {
      authorityClass,
      resource: "risk_control",
      actionKey: "native_esign.obligation.review",
      purpose: "govern_contract_obligations",
      classification: obligation.classification,
      consequence: materialDecision || input.targetState === "overdue_breached" ? "material" : "routine",
      targetSeatId: operator.access.seat.id,
    });
    const reviewedAt = new Date();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${obligation.id}))`);
      const [current] = await tx.select().from(eosRisksControls).where(and(
        eq(eosRisksControls.id, obligation.id),
        eq(eosRisksControls.companyId, companyId),
      )).limit(1);
      if (!current || current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime() || current.state !== obligation.state)
        throw new NativeEsignError(409, "native_esign_obligation_concurrent_change", "The obligation changed before this review. Refresh and review the current state before trying again.");
      if (!canTransitionRiskControl(current.state as any, input.targetState))
        throw new NativeEsignError(409, "native_esign_obligation_transition_invalid", `The obligation cannot move from ${current.state} to ${input.targetState}.`);
      const [previousReview] = await tx.select().from(eosEsignObligationReviews)
        .where(and(eq(eosEsignObligationReviews.companyId, companyId), eq(eosEsignObligationReviews.obligationId, current.id)))
        .orderBy(desc(eosEsignObligationReviews.reviewedAt), desc(eosEsignObligationReviews.id)).limit(1);
      const reviewId = randomUUID();
      const previousReviewSha256 = previousReview?.reviewSha256 || "";
      const reviewSha256 = nativeContractContentSha256({
        schemaVersion: "eos-native-esign-obligation-review.v1",
        reviewId,
        companyId,
        envelopeId: promotion.envelopeId,
        promotionId: promotion.id,
        obligationId: current.id,
        stateBefore: current.state,
        stateAfter: input.targetState,
        ownerSeatId: ownerSeat.id,
        evidenceIds: [...input.evidenceIds].sort(),
        reviewNote: input.reviewNote,
        nextReviewAt: input.nextReviewAt?.toISOString() || null,
        authorityClass,
        policyDecisionId: policy.decisionId,
        sourceExcerptSha256: promotion.sourceExcerptSha256,
        previousReviewSha256,
        reviewedByUserId: req.user.id,
        reviewedAt: reviewedAt.toISOString(),
      });
      const existingEvidenceIds = Array.isArray(current.evidenceIds) ? current.evidenceIds.map(String) : [];
      const mergedEvidenceIds = Array.from(new Set([...existingEvidenceIds, ...input.evidenceIds]));
      const [updated] = await tx.update(eosRisksControls).set({
        state: input.targetState,
        ownerSeatId: ownerSeat.id,
        evidenceIds: mergedEvidenceIds,
        dueReviewAt: input.nextReviewAt || null,
        updatedAt: reviewedAt,
      }).where(and(
        eq(eosRisksControls.id, current.id),
        eq(eosRisksControls.companyId, companyId),
        eq(eosRisksControls.state, current.state),
        eq(eosRisksControls.updatedAt, input.expectedUpdatedAt),
      )).returning();
      if (!updated) throw new NativeEsignError(409, "native_esign_obligation_concurrent_change", "The obligation changed before this review. Refresh and review the current state before trying again.");
      const [review] = await tx.insert(eosEsignObligationReviews).values({
        id: reviewId, companyId, envelopeId: promotion.envelopeId, promotionId: promotion.id, obligationId: current.id,
        stateBefore: current.state, stateAfter: input.targetState, ownerSeatId: ownerSeat.id,
        evidenceIds: input.evidenceIds, reviewNote: input.reviewNote, nextReviewAt: input.nextReviewAt || null,
        authorityClass, policyDecisionId: policy.decisionId, sourceExcerptSha256: promotion.sourceExcerptSha256,
        previousReviewSha256, reviewSha256, reviewedByUserId: req.user.id, reviewedAt, createdAt: reviewedAt,
      }).returning();
      await appendAuditEvent(tx, {
        companyId, envelopeId: promotion.envelopeId, eventType: "obligation_reviewed", actorType: "operator", actorReference: req.user.id,
        eventProjection: { reviewId, obligationId: current.id, stateBefore: current.state, stateAfter: input.targetState, ownerSeatId: ownerSeat.id, operationalEvidenceCount: input.evidenceIds.length, reviewSha256, policyDecisionId: policy.decisionId },
      });
      return { obligation: updated, review };
    });
    res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/verify", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.integrity.verify");
    const input = nativeEsignIntegrityCheckSchema.parse(req.body);
    const envelope = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId)) });
    if (!envelope || envelope.state !== "completed")
      throw new NativeEsignError(409, "native_esign_integrity_unavailable", "Only a completed tenant-scoped envelope can be verified.");
    const report = await verifyNativeEsignEnvelopeIntegrity(envelope.id);
    const check = await recordNativeEsignIntegrityCheck({
      report, companyId, triggerType: "operator", requestedByUserId: req.user.id, reason: input.reason,
    });
    writeLog(report.state === "passed" ? "info" : "error", "native_esign_integrity_operator_checked", {
      companyId, envelopeId: envelope.id, checkId: check.id, state: report.state, failureCodes: report.failureCodes,
    });
    res.status(201).json({ report: publicNativeEsignIntegrityProjection(report), check });
  }));

  app.put("/api/eos/companies/:companyId/native-esign/custody/retention-policy", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const access = await requireCompanyOperator(req, companyId, "native_esign.custody.retention.configure");
    if (!access.isFounder) throw new NativeEsignError(403, "native_esign_custody_founder_required", "Founder authority is required to activate evidence retention policy.");
    const input = nativeEsignRetentionPolicySchema.parse(req.body);
    try { res.json(await configureRetentionPolicy(companyId, req.user.id, input)); }
    catch (error) { throw custodyRouteError(error); }
  }));

  app.get("/api/eos/companies/:companyId/native-esign/custody/storage-drills", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyReader(req, companyId, "native_esign.custody.storage_drill.read");
    res.json(await listNativeEsignStorageDrills(companyId));
  }));

  app.post("/api/eos/companies/:companyId/native-esign/custody/storage-drills", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const access = await requireCompanyOperator(req, companyId, "native_esign.custody.storage_drill.execute");
    if (!access.isFounder) throw new NativeEsignError(403, "native_esign_custody_founder_required", "Founder authority is required to run a storage loss-and-recovery drill.");
    const input = nativeEsignStorageDrillSchema.parse(req.body);
    try {
      const result = await runNativeEsignStorageDrill({
        companyId,
        requestedByUserId: req.user.id,
        reason: input.reason,
      });
      res.status(201).json(result);
    } catch (error) { throw custodyRouteError(error); }
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/custody/verify", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.custody.verify");
    try { res.json(await verifyEnvelopeCustody(companyId, req.params.envelopeId, req.user.id)); }
    catch (error) { throw custodyRouteError(error); }
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/custody/backup", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.custody.backup");
    try { res.json(await backUpEnvelopeCustody(companyId, req.params.envelopeId, req.user.id)); }
    catch (error) { throw custodyRouteError(error); }
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/custody/artifacts/:artifactId/restore", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const access = await requireCompanyOperator(req, companyId, "native_esign.custody.restore");
    if (!access.isFounder) throw new NativeEsignError(403, "native_esign_custody_founder_required", "Founder authority is required to restore signing evidence.");
    try { res.json(await restoreCustodyArtifact(companyId, req.params.envelopeId, req.params.artifactId, req.user.id)); }
    catch (error) { throw custodyRouteError(error); }
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/custody/legal-holds", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const access = await requireCompanyOperator(req, companyId, "native_esign.custody.legal_hold.place");
    if (!access.isFounder) throw new NativeEsignError(403, "native_esign_custody_founder_required", "Founder authority is required to place a legal hold.");
    const input = nativeEsignLegalHoldSchema.parse(req.body);
    try { res.status(201).json(await placeLegalHold(companyId, req.params.envelopeId, req.user.id, input.reason, input.reference)); }
    catch (error) { throw custodyRouteError(error); }
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/custody/legal-holds/:holdId/release", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const access = await requireCompanyOperator(req, companyId, "native_esign.custody.legal_hold.release");
    if (!access.isFounder) throw new NativeEsignError(403, "native_esign_custody_founder_required", "Founder authority is required to release a legal hold.");
    const input = nativeEsignLegalHoldReleaseSchema.parse(req.body);
    try { res.json(await releaseLegalHold(companyId, req.params.envelopeId, req.params.holdId, req.user.id, input.reason, input.version)); }
    catch (error) { throw custodyRouteError(error); }
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/custody/deletion-requests", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.custody.deletion.request");
    const input = nativeEsignDeletionRequestSchema.parse(req.body);
    try { res.status(201).json(await requestEnvelopeDeletion(companyId, req.params.envelopeId, req.user.id, input.reason)); }
    catch (error) { throw custodyRouteError(error); }
  }));

  app.post("/api/eos/companies/:companyId/native-esign/custody/deletion-requests/:requestId/decision", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const access = await requireCompanyOperator(req, companyId, "native_esign.custody.deletion.decide");
    if (!access.isFounder) throw new NativeEsignError(403, "native_esign_custody_founder_required", "Founder authority is required to decide an evidence deletion request.");
    const input = nativeEsignDeletionDecisionSchema.parse(req.body);
    try { res.json(await decideEnvelopeDeletion(companyId, req.params.requestId, req.user.id, input.approve, input.reason, input.version)); }
    catch (error) { throw custodyRouteError(error); }
  }));

  app.post("/api/eos/companies/:companyId/native-esign/custody/deletion-requests/:requestId/cancel", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.custody.deletion.cancel");
    const input = nativeEsignCustodyExecutionSchema.parse(req.body);
    try { res.json(await cancelEnvelopeDeletion(companyId, req.params.requestId, req.user.id, input.version)); }
    catch (error) { throw custodyRouteError(error); }
  }));

  app.post("/api/eos/companies/:companyId/native-esign/custody/deletion-requests/:requestId/execute", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.custody.deletion.execute");
    const input = nativeEsignCustodyExecutionSchema.parse(req.body);
    try { res.json(await executeEnvelopeDeletion(companyId, req.params.requestId, req.user.id, input.version)); }
    catch (error) { throw custodyRouteError(error); }
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/recipients/:recipientId/rotate-link", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const access = await requireCompanyOperator(req, companyId, "native_esign.recipient.rotate_link");
    const [context] = await db.select({ envelope: eosEsignEnvelopes, recipient: eosEsignRecipients })
      .from(eosEsignEnvelopes).innerJoin(eosEsignRecipients, eq(eosEsignRecipients.envelopeId, eosEsignEnvelopes.id))
      .where(and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId), eq(eosEsignRecipients.id, req.params.recipientId), eq(eosEsignRecipients.companyId, companyId))).limit(1);
    if (!context || !["issued", "in_progress"].includes(context.envelope.state) || ["signed", "declined", "expired"].includes(context.recipient.state))
      throw new NativeEsignError(409, "native_esign_link_not_rotatable", "Only a non-terminal recipient on an active envelope can receive a replacement link.");
    const routingRecipients = await db.select({ routingOrder: eosEsignRecipients.routingOrder, state: eosEsignRecipients.state }).from(eosEsignRecipients).where(and(eq(eosEsignRecipients.envelopeId, context.envelope.id), eq(eosEsignRecipients.companyId, companyId)));
    assertRecipientRoutingActive(context.envelope, routingRecipients, context.recipient);
    if (context.envelope.recoveryAgreementInstanceId && !access.isFounder)
      throw new NativeEsignError(403, "native_esign_recovery_founder_required", "Founder authority is required to rotate a Recovery signing link.");
    const secret = createNativeEsignSecret();
    const now = new Date();
    await db.transaction(async (tx) => {
      const [updated] = await tx.update(eosEsignRecipients).set({ state: context.recipient.state === "pending" ? "sent" : context.recipient.state, tokenDigest: nativeEsignTokenDigest(secret), tokenUsedAt: null, sentAt: now, deliveryState: "manual_ready", providerMessageReference: "", version: context.recipient.version + 1, updatedAt: now })
        .where(and(eq(eosEsignRecipients.id, context.recipient.id), eq(eosEsignRecipients.version, context.recipient.version))).returning();
      if (!updated) throw new NativeEsignError(409, "native_esign_recipient_changed", "Recipient state changed before link rotation.");
      await appendAuditEvent(tx, { companyId, envelopeId: context.envelope.id, recipientId: context.recipient.id, eventType: "recipient_sent", actorType: "operator", actorReference: req.user.id, eventProjection: { replacement: true, routingOrder: context.recipient.routingOrder } });
    });
    const publicOrigin = process.env.EOS_PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`;
    res.json({ recipientId: context.recipient.id, signingUrl: nativeEsignUrl(secret, publicOrigin), rotatedAt: now });
  }));

  app.patch("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/recipients/:recipientId", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const access = await requireCompanyOperator(req, companyId, "native_esign.recipient.correct");
    const input = nativeEsignRecipientCorrectionSchema.parse(req.body);
    const secret = createNativeEsignSecret();
    const now = new Date();
    let corrected: typeof eosEsignRecipients.$inferSelect | undefined;
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM eos_esign_envelopes WHERE id = ${req.params.envelopeId} FOR UPDATE`);
      await tx.execute(sql`SELECT id FROM eos_esign_recipients WHERE id = ${req.params.recipientId} FOR UPDATE`);
      const [envelope, recipient] = await Promise.all([
        tx.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId)) }),
        tx.query.eosEsignRecipients.findFirst({ where: and(eq(eosEsignRecipients.id, req.params.recipientId), eq(eosEsignRecipients.envelopeId, req.params.envelopeId), eq(eosEsignRecipients.companyId, companyId)) }),
      ]);
      if (!envelope || !recipient || !["issued", "in_progress"].includes(envelope.state) || !["sent", "opened", "consented"].includes(recipient.state))
        throw new NativeEsignError(409, "native_esign_recipient_not_correctable", "Only an incomplete recipient on an active tenant-scoped envelope can be corrected.");
      if (envelope.recoveryAgreementInstanceId)
        throw new NativeEsignError(409, "native_esign_recovery_recipient_locked", "Recovery agreement signer identity is locked to its approved authority record. Void and re-authorize instead.");
      if (recipient.version !== input.version)
        throw new NativeEsignError(409, "native_esign_recipient_changed", "The recipient changed before correction. Refresh and review the current identity.");
      const signerEmail = input.signerEmail.toLowerCase();
      if (recipient.signerName === input.signerName && recipient.signerEmail.toLowerCase() === signerEmail)
        throw new NativeEsignError(409, "native_esign_recipient_identity_unchanged", "Change the signer name or email before recording a recipient correction.");

      const recipients = await tx.select({ id: eosEsignRecipients.id, state: eosEsignRecipients.state })
        .from(eosEsignRecipients)
        .where(and(eq(eosEsignRecipients.envelopeId, envelope.id), eq(eosEsignRecipients.companyId, companyId)));
      const nextEnvelopeState = nativeEsignEnvelopeState({
        recipientStates: recipients.map((item) => item.id === recipient.id ? "sent" : item.state),
        expired: false,
        voided: false,
      });
      [corrected] = await tx.update(eosEsignRecipients).set({
        signerName: input.signerName,
        signerEmail,
        state: "sent",
        tokenDigest: nativeEsignTokenDigest(secret),
        tokenExpiresAt: envelope.expiresAt,
        tokenUsedAt: null,
        sentAt: now,
        openedAt: null,
        consentVersion: "",
        consentedAt: null,
        comparisonAcknowledgementSha256: "",
        comparisonAcknowledgedAt: null,
        signatureMethod: "",
        signatureName: "",
        signatureSha256: "",
        fieldValues: {},
        signedAt: null,
        declinedAt: null,
        declineReason: "",
        networkFingerprintSha256: "",
        userAgentSha256: "",
        deliveryState: "manual_ready",
        lastDeliveryAttemptId: "",
        lastDeliveredAt: null,
        providerMessageReference: "",
        identityAssuranceState: envelope.assuranceMode === "email_otp" ? "pending" : "not_required",
        identityVerifiedAt: null,
        otpDigest: "",
        otpExpiresAt: null,
        otpAttemptCount: 0,
        otpSendCount: 0,
        otpLastSentAt: null,
        version: recipient.version + 1,
        updatedAt: now,
      }).where(and(
        eq(eosEsignRecipients.id, recipient.id),
        eq(eosEsignRecipients.companyId, companyId),
        eq(eosEsignRecipients.version, recipient.version),
        inArray(eosEsignRecipients.state, ["sent", "opened", "consented"]),
      )).returning();
      if (!corrected)
        throw new NativeEsignError(409, "native_esign_recipient_changed", "The recipient changed before correction. Refresh and retry.");
      const [updatedEnvelope] = await tx.update(eosEsignEnvelopes).set({
        state: nextEnvelopeState,
        version: envelope.version + 1,
        updatedAt: now,
      }).where(and(
        eq(eosEsignEnvelopes.id, envelope.id),
        eq(eosEsignEnvelopes.companyId, companyId),
        eq(eosEsignEnvelopes.version, envelope.version),
        inArray(eosEsignEnvelopes.state, ["issued", "in_progress"]),
      )).returning();
      if (!updatedEnvelope)
        throw new NativeEsignError(409, "native_esign_envelope_changed", "The envelope changed before recipient correction. Refresh and retry.");
      await appendAuditEvent(tx, {
        companyId,
        envelopeId: envelope.id,
        recipientId: recipient.id,
        eventType: "recipient_corrected",
        actorType: "operator",
        actorReference: req.user.id,
        eventProjection: {
          roleKey: recipient.roleKey,
          previousState: recipient.state,
          previousSignerNameSha256: nativeEsignFingerprint(recipient.signerName),
          previousSignerEmailSha256: nativeEsignFingerprint(recipient.signerEmail.toLowerCase()),
          signerNameSha256: nativeEsignFingerprint(input.signerName),
          signerEmailSha256: nativeEsignFingerprint(signerEmail),
          reason: input.reason,
          priorDeliveryAttemptCount: recipient.deliveryAttemptCount,
          linkRotated: true,
          consentReset: Boolean(recipient.consentedAt),
          policyDecisionId: access.policy.decisionId,
        },
      });
    });
    const publicOrigin = process.env.EOS_PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`;
    res.json({
      recipient: {
        id: corrected!.id,
        roleKey: corrected!.roleKey,
        signerName: corrected!.signerName,
        signerEmail: corrected!.signerEmail,
        state: corrected!.state,
        deliveryState: corrected!.deliveryState,
        deliveryAttemptCount: corrected!.deliveryAttemptCount,
        version: corrected!.version,
      },
      signingUrl: nativeEsignUrl(secret, publicOrigin),
      correctedAt: now,
    });
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/recipients/:recipientId/deliver", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const access = await requireCompanyOperator(req, companyId, "native_esign.recipient.deliver");
    const [context] = await db.select({ envelope: eosEsignEnvelopes, recipient: eosEsignRecipients, document: eosEsignDocumentVersions, company: companies })
      .from(eosEsignEnvelopes)
      .innerJoin(eosEsignRecipients, eq(eosEsignRecipients.envelopeId, eosEsignEnvelopes.id))
      .innerJoin(eosEsignDocumentVersions, eq(eosEsignDocumentVersions.id, eosEsignEnvelopes.documentVersionId))
      .innerJoin(companies, eq(companies.id, eosEsignEnvelopes.companyId))
      .where(and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId), eq(eosEsignRecipients.id, req.params.recipientId), eq(eosEsignRecipients.companyId, companyId))).limit(1);
    if (!context || !["issued", "in_progress"].includes(context.envelope.state) || !["pending", "sent", "opened", "consented"].includes(context.recipient.state) || context.envelope.expiresAt <= new Date())
      throw new NativeEsignError(409, "native_esign_delivery_not_available", "Only an incomplete recipient on an active envelope can receive a signing email or reminder.");
    const routingRecipients = await db.select({ routingOrder: eosEsignRecipients.routingOrder, state: eosEsignRecipients.state }).from(eosEsignRecipients).where(and(eq(eosEsignRecipients.envelopeId, context.envelope.id), eq(eosEsignRecipients.companyId, companyId)));
    assertRecipientRoutingActive(context.envelope, routingRecipients, context.recipient);
    if (context.envelope.recoveryAgreementInstanceId && !access.isFounder)
      throw new NativeEsignError(403, "native_esign_recovery_founder_required", "Founder authority is required to deliver a Recovery signing request.");
    if (context.recipient.deliveryAttemptCount >= 20)
      throw new NativeEsignError(429, "native_esign_delivery_attempt_limit", "This recipient reached the controlled delivery-attempt limit.");

    const secret = createNativeEsignSecret();
    const tokenDigest = nativeEsignTokenDigest(secret);
    const attemptId = randomUUID();
    const preparedAt = new Date();
    const attemptNumber = context.recipient.deliveryAttemptCount + 1;
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM eos_esign_recipients WHERE id = ${context.recipient.id} FOR UPDATE`);
      const current = await tx.query.eosEsignRecipients.findFirst({ where: and(eq(eosEsignRecipients.id, context.recipient.id), eq(eosEsignRecipients.companyId, companyId)) });
      if (!current || current.version !== context.recipient.version || !["pending", "sent", "opened", "consented"].includes(current.state) || current.deliveryAttemptCount !== context.recipient.deliveryAttemptCount)
        throw new NativeEsignError(409, "native_esign_delivery_changed", "The recipient changed before delivery preparation. Refresh and retry.");
      await tx.insert(eosEsignDeliveryAttempts).values({
        id: attemptId, companyId, envelopeId: context.envelope.id, recipientId: current.id,
        attemptNumber, channel: "gmail", state: "prepared", tokenDigest,
        requestedByUserId: req.user.id, preparedAt,
      });
      await tx.update(eosEsignRecipients).set({
        state: current.state === "pending" ? "sent" : current.state, tokenDigest, tokenUsedAt: null, sentAt: preparedAt, deliveryState: "sending",
        deliveryAttemptCount: attemptNumber, lastDeliveryAttemptId: attemptId,
        providerMessageReference: "", version: current.version + 1, updatedAt: preparedAt,
      }).where(and(eq(eosEsignRecipients.id, current.id), eq(eosEsignRecipients.version, current.version)));
      await appendAuditEvent(tx, { companyId, envelopeId: context.envelope.id, recipientId: current.id, eventType: "delivery_prepared", actorType: "operator", actorReference: req.user.id, eventProjection: { attemptId, attemptNumber, channel: "gmail" } });
    });

    const publicOrigin = process.env.EOS_PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`;
    const signingUrl = nativeEsignUrl(secret, publicOrigin);
    const email = nativeEsignDeliveryEmail({
      signerName: context.recipient.signerName,
      companyName: context.company.name,
      documentTitle: context.document.title,
      envelopeSubject: context.envelope.subject,
      envelopeMessage: context.envelope.message,
      signingUrl,
      expiresAt: context.envelope.expiresAt,
    });
    let receipt: { messageId: string };
    try {
      receipt = await gmail.sendEmail(req.user.id, { to: context.recipient.signerEmail, ...email });
      if (!receipt.messageId) throw new Error("Gmail returned no message receipt.");
    } catch (error) {
      const failure = classifyNativeEsignDeliveryFailure(error);
      const completedAt = new Date();
      await db.transaction(async (tx) => {
        await tx.update(eosEsignDeliveryAttempts).set({ state: failure.state, failureCode: failure.code, failureMessage: failure.safeMessage, completedAt })
          .where(and(eq(eosEsignDeliveryAttempts.id, attemptId), eq(eosEsignDeliveryAttempts.state, "prepared")));
        await tx.update(eosEsignRecipients).set({ deliveryState: failure.state, version: sql`${eosEsignRecipients.version} + 1`, updatedAt: completedAt })
          .where(and(eq(eosEsignRecipients.id, context.recipient.id), eq(eosEsignRecipients.lastDeliveryAttemptId, attemptId), eq(eosEsignRecipients.deliveryState, "sending")));
        await appendAuditEvent(tx, { companyId, envelopeId: context.envelope.id, recipientId: context.recipient.id, eventType: "delivery_failed", actorType: "provider", actorReference: "gmail", eventProjection: { attemptId, attemptNumber, deliveryState: failure.state, failureCode: failure.code } });
      });
      throw new NativeEsignError(502, "native_esign_delivery_failed", `${failure.safeMessage} Rotate or retry the link before relying on delivery.`);
    }

    const deliveredAt = new Date();
    await db.transaction(async (tx) => {
      const [attempt] = await tx.update(eosEsignDeliveryAttempts).set({ state: "delivered", providerMessageReference: receipt.messageId, completedAt: deliveredAt })
        .where(and(eq(eosEsignDeliveryAttempts.id, attemptId), eq(eosEsignDeliveryAttempts.state, "prepared"))).returning();
      if (!attempt)
        throw new NativeEsignError(409, "native_esign_delivery_reconciliation_changed", "The Gmail receipt could not be reconciled to the prepared delivery attempt.");
      const [recipient] = await tx.update(eosEsignRecipients).set({ deliveryState: "delivered", lastDeliveredAt: deliveredAt, providerMessageReference: receipt.messageId, version: sql`${eosEsignRecipients.version} + 1`, updatedAt: deliveredAt })
        .where(and(eq(eosEsignRecipients.id, context.recipient.id), eq(eosEsignRecipients.lastDeliveryAttemptId, attemptId), eq(eosEsignRecipients.deliveryState, "sending"))).returning();
      if (!recipient)
        throw new NativeEsignError(409, "native_esign_delivery_reconciliation_changed", "The recipient changed before the Gmail receipt was reconciled.");
      await appendAuditEvent(tx, { companyId, envelopeId: context.envelope.id, recipientId: context.recipient.id, eventType: "delivery_succeeded", actorType: "provider", actorReference: "gmail", eventProjection: { attemptId, attemptNumber, providerMessageReference: receipt.messageId } });
    });
    res.json({ recipientId: context.recipient.id, attemptId, attemptNumber, channel: "gmail", state: "delivered", deliveredAt, providerMessageReference: receipt.messageId });
  }));

  app.get("/api/eos/companies/:companyId/native-esign/operations", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyReader(req, companyId, "native_esign.operations.read");
    const [subscriptions, webhookDeliveries, completionDeliveries, integrityChecks] = await Promise.all([
      db.select().from(eosEsignWebhookSubscriptions).where(eq(eosEsignWebhookSubscriptions.companyId, companyId)).orderBy(desc(eosEsignWebhookSubscriptions.updatedAt)),
      db.select().from(eosEsignWebhookDeliveries).where(eq(eosEsignWebhookDeliveries.companyId, companyId)).orderBy(desc(eosEsignWebhookDeliveries.updatedAt)).limit(200),
      db.select().from(eosEsignCompletionDeliveries).where(eq(eosEsignCompletionDeliveries.companyId, companyId)).orderBy(desc(eosEsignCompletionDeliveries.updatedAt)).limit(200),
      db.select().from(eosEsignIntegrityChecks).where(eq(eosEsignIntegrityChecks.companyId, companyId)).orderBy(desc(eosEsignIntegrityChecks.checkedAt)).limit(200),
    ]);
    const webhookIds = webhookDeliveries.map((delivery) => delivery.id);
    const completionIds = completionDeliveries.map((delivery) => delivery.id);
    const [webhookAttempts, completionAttempts] = await Promise.all([
      webhookIds.length ? db.select().from(eosEsignWebhookAttempts).where(and(eq(eosEsignWebhookAttempts.companyId, companyId), inArray(eosEsignWebhookAttempts.deliveryId, webhookIds))).orderBy(desc(eosEsignWebhookAttempts.attemptedAt)) : [],
      completionIds.length ? db.select().from(eosEsignCompletionDeliveryAttempts).where(and(eq(eosEsignCompletionDeliveryAttempts.companyId, companyId), inArray(eosEsignCompletionDeliveryAttempts.deliveryId, completionIds))).orderBy(desc(eosEsignCompletionDeliveryAttempts.attemptedAt)) : [],
    ]);
    res.json({
      subscriptions: subscriptions.map(({ secretCiphertext: _secretCiphertext, ...subscription }) => subscription),
      webhookDeliveries, webhookAttempts,
      completionDeliveries: completionDeliveries.map(({ tokenCiphertext: _tokenCiphertext, ...delivery }) => delivery),
      completionAttempts,
      integrityChecks,
    });
  }));

  app.post("/api/eos/companies/:companyId/native-esign/webhooks", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.webhook.create");
    const input = nativeEsignWebhookSubscriptionSchema.parse(req.body);
    const endpointUrl = validatedWebhookEndpoint(input.endpointUrl);
    const secret = randomBytes(32).toString("base64url");
    const now = new Date();
    const [subscription] = await db.insert(eosEsignWebhookSubscriptions).values({
      id: randomUUID(), companyId, endpointUrl, description: input.description,
      eventTypes: input.eventTypes, secretCiphertext: encryptCredential(secret),
      secretFingerprint: createHash("sha256").update(secret, "utf8").digest("hex"),
      state: "active", version: 1, createdByUserId: req.user.id, createdAt: now, updatedAt: now,
    }).returning();
    const { secretCiphertext: _secretCiphertext, ...projection } = subscription;
    res.status(201).json({ subscription: projection, signingSecret: secret });
  }));

  app.patch("/api/eos/companies/:companyId/native-esign/webhooks/:subscriptionId", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.webhook.update");
    const input = nativeEsignWebhookSubscriptionUpdateSchema.parse(req.body);
    const current = await db.query.eosEsignWebhookSubscriptions.findFirst({ where: and(eq(eosEsignWebhookSubscriptions.id, req.params.subscriptionId), eq(eosEsignWebhookSubscriptions.companyId, companyId)) });
    if (!current || current.state === "revoked" || current.version !== input.version)
      throw new NativeEsignError(409, "native_esign_webhook_changed", "The webhook is unavailable, revoked, or changed. Refresh and retry.");
    const endpointUrl = validatedWebhookEndpoint(input.endpointUrl);
    const [updated] = await db.update(eosEsignWebhookSubscriptions).set({
      endpointUrl, description: input.description, eventTypes: input.eventTypes,
      state: input.state, version: current.version + 1, updatedAt: new Date(),
    }).where(and(eq(eosEsignWebhookSubscriptions.id, current.id), eq(eosEsignWebhookSubscriptions.companyId, companyId), eq(eosEsignWebhookSubscriptions.version, current.version), inArray(eosEsignWebhookSubscriptions.state, ["active", "paused"]))).returning();
    if (!updated) throw new NativeEsignError(409, "native_esign_webhook_changed", "The webhook changed before the update.");
    const { secretCiphertext: _secretCiphertext, ...projection } = updated;
    res.json(projection);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/webhooks/:subscriptionId/rotate-secret", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.webhook.rotate_secret");
    const input = nativeEsignSecretRotationSchema.parse(req.body);
    const current = await db.query.eosEsignWebhookSubscriptions.findFirst({ where: and(eq(eosEsignWebhookSubscriptions.id, req.params.subscriptionId), eq(eosEsignWebhookSubscriptions.companyId, companyId)) });
    if (!current || current.state === "revoked" || current.version !== input.version)
      throw new NativeEsignError(409, "native_esign_webhook_changed", "The webhook is unavailable, revoked, or changed. Refresh and retry.");
    const secret = randomBytes(32).toString("base64url");
    const [updated] = await db.update(eosEsignWebhookSubscriptions).set({
      secretCiphertext: encryptCredential(secret),
      secretFingerprint: createHash("sha256").update(secret, "utf8").digest("hex"),
      version: current.version + 1, updatedAt: new Date(),
    }).where(and(eq(eosEsignWebhookSubscriptions.id, current.id), eq(eosEsignWebhookSubscriptions.version, current.version), inArray(eosEsignWebhookSubscriptions.state, ["active", "paused"]))).returning();
    if (!updated) throw new NativeEsignError(409, "native_esign_webhook_changed", "The webhook changed before secret rotation.");
    const { secretCiphertext: _secretCiphertext, ...projection } = updated;
    res.json({ subscription: projection, signingSecret: secret, reasonRecorded: input.reason });
  }));

  app.post("/api/eos/companies/:companyId/native-esign/webhook-deliveries/:deliveryId/replay", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.webhook.replay");
    const input = nativeEsignReplaySchema.parse(req.body);
    const [current] = await db.select({ delivery: eosEsignWebhookDeliveries, subscription: eosEsignWebhookSubscriptions })
      .from(eosEsignWebhookDeliveries).innerJoin(eosEsignWebhookSubscriptions, eq(eosEsignWebhookSubscriptions.id, eosEsignWebhookDeliveries.subscriptionId))
      .where(and(eq(eosEsignWebhookDeliveries.id, req.params.deliveryId), eq(eosEsignWebhookDeliveries.companyId, companyId), eq(eosEsignWebhookSubscriptions.companyId, companyId))).limit(1);
    if (!current || current.subscription.state !== "active" || !["retry", "dead_letter"].includes(current.delivery.state))
      throw new NativeEsignError(409, "native_esign_webhook_replay_unavailable", "Only a failed delivery for an active subscription can be replayed.");
    const [updated] = await db.update(eosEsignWebhookDeliveries).set({
      state: "pending", replayCount: current.delivery.replayCount + 1, nextAttemptAt: new Date(),
      leasedAt: null, lastFailureCode: "", lastFailureMessage: "", updatedAt: new Date(),
    }).where(and(eq(eosEsignWebhookDeliveries.id, current.delivery.id), inArray(eosEsignWebhookDeliveries.state, ["retry", "dead_letter"]))).returning();
    if (!updated) throw new NativeEsignError(409, "native_esign_webhook_changed", "The delivery changed before replay.");
    res.json({ ...updated, replayReasonRecorded: input.reason });
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/recipients/:recipientId/completion-delivery/replay", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.completion_delivery.replay");
    const input = nativeEsignReplaySchema.parse(req.body);
    const [context] = await db.select({ delivery: eosEsignCompletionDeliveries, recipient: eosEsignRecipients, envelope: eosEsignEnvelopes })
      .from(eosEsignCompletionDeliveries)
      .innerJoin(eosEsignRecipients, eq(eosEsignRecipients.id, eosEsignCompletionDeliveries.recipientId))
      .innerJoin(eosEsignEnvelopes, eq(eosEsignEnvelopes.id, eosEsignCompletionDeliveries.envelopeId))
      .where(and(eq(eosEsignCompletionDeliveries.envelopeId, req.params.envelopeId), eq(eosEsignCompletionDeliveries.recipientId, req.params.recipientId), eq(eosEsignCompletionDeliveries.companyId, companyId), eq(eosEsignEnvelopes.companyId, companyId))).limit(1);
    if (!context || context.envelope.state !== "completed" || context.recipient.state !== "signed" || !["retry", "dead_letter"].includes(context.delivery.state))
      throw new NativeEsignError(409, "native_esign_completion_replay_unavailable", "Only a failed completion delivery can be replayed.");
    const secret = createNativeEsignSecret();
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(eosEsignRecipients).set({
        completionTokenDigest: nativeEsignTokenDigest(secret), completionDeliveryState: "pending",
        version: context.recipient.version + 1, updatedAt: now,
      }).where(and(eq(eosEsignRecipients.id, context.recipient.id), eq(eosEsignRecipients.version, context.recipient.version)));
      await tx.update(eosEsignCompletionDeliveries).set({
        tokenCiphertext: encryptCredential(secret), state: "pending", replayCount: context.delivery.replayCount + 1,
        nextAttemptAt: now, leasedAt: null, providerMessageReference: "", deliveredAt: null,
        lastFailureCode: "", lastFailureMessage: "", updatedAt: now,
      }).where(and(eq(eosEsignCompletionDeliveries.id, context.delivery.id), inArray(eosEsignCompletionDeliveries.state, ["retry", "dead_letter"])));
      await appendAuditEvent(tx, {
        companyId, envelopeId: context.envelope.id, recipientId: context.recipient.id,
        eventType: "completion_delivery_prepared", actorType: "operator", actorReference: req.user.id,
        eventProjection: { deliveryId: context.delivery.id, replay: true, replayCount: context.delivery.replayCount + 1, reason: input.reason },
      });
    });
    res.json({ deliveryId: context.delivery.id, state: "pending", replayCount: context.delivery.replayCount + 1 });
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/promote-evidence", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyOperator(req, companyId, "native_esign.evidence.promote");
    const input = nativeEsignEvidencePromotionSchema.parse(req.body);
    const envelope = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId)) });
    if (!envelope || envelope.state !== "completed" || !envelope.finalSha256 || !envelope.auditSha256)
      throw new NativeEsignError(409, "native_esign_evidence_not_completed", "Only a sealed completed tenant envelope can become canonical Evidence.");
    if (envelope.evidenceId)
      throw new NativeEsignError(409, "native_esign_evidence_already_promoted", "This envelope is already linked to canonical Evidence.");
    if (envelope.workPacketId && envelope.workPacketId !== input.workPacketId)
      throw new NativeEsignError(409, "native_esign_evidence_work_packet_mismatch", "A generated contract cannot be promoted into a different Work Packet.");
    const packet = await db.query.eosWorkPackets.findFirst({ where: and(eq(eosWorkPackets.id, input.workPacketId), eq(eosWorkPackets.companyId, companyId)) });
    if (!packet) throw new NativeEsignError(409, "native_esign_work_packet_unavailable", "The evidence Work Packet is not available in this tenant.");
    const [integrity] = await db.select().from(eosEsignIntegrityChecks).where(and(eq(eosEsignIntegrityChecks.companyId, companyId), eq(eosEsignIntegrityChecks.envelopeId, envelope.id))).orderBy(desc(eosEsignIntegrityChecks.checkedAt)).limit(1);
    if (!integrity || integrity.state !== "passed" || integrity.finalSha256 !== envelope.finalSha256 || integrity.auditSha256 !== envelope.auditSha256)
      throw new NativeEsignError(409, "native_esign_evidence_integrity_required", "Run a passing integrity verification against the current sealed hashes before promotion.");
    const custody = await ensureEnvelopeCustodyInventory(companyId, envelope.id);
    if (!custody?.policy || custody.readiness.activeArtifactCount === 0 || custody.readiness.verifiedArtifactCount !== custody.readiness.activeArtifactCount)
      throw new NativeEsignError(409, "native_esign_evidence_custody_required", "Configure retention and verify every active artifact before promotion.");
    const promotedAt = new Date();
    const evidenceId = randomUUID();
    const receiptId = randomUUID();
    const receiptSha256 = nativeContractContentSha256({ schemaVersion: "eos-native-esign-evidence-promotion.v1", receiptId, companyId, envelopeId: envelope.id, evidenceId, workPacketId: packet.id, finalSha256: envelope.finalSha256, auditSha256: envelope.auditSha256, integrityCheckSha256: integrity.checkSha256, promotedByUserId: req.user.id, promotedAt: promotedAt.toISOString(), supportedClaimSummary: input.supportedClaimSummary, verifierMethod: input.verifierMethod });
    const result = await db.transaction(async (tx) => {
      const [evidence] = await tx.insert(eosEvidence).values({
        id: evidenceId, companyId, workPacketId: packet.id, recordedByUserId: req.user.id,
        evidenceType: "executed_contract", title: `Executed contract · ${envelope.subject}`,
        uri: `/api/eos/companies/${companyId}/native-esign/envelopes/${envelope.id}/completed-document`,
        details: { envelopeId: envelope.id, documentVersionId: envelope.documentVersionId, templateVersionId: envelope.templateVersionId, counterpartyId: envelope.counterpartyId, finalSha256: envelope.finalSha256, auditSha256: envelope.auditSha256, integrityCheckSha256: integrity.checkSha256, promotionReceiptSha256: receiptSha256 },
        evidenceKey: `native-esign:${envelope.id}:completed`, claimSubjectType: "native_esign_envelope", claimSubjectKey: envelope.id,
        verificationState: "verified", confidenceQuality: "high", dataClassification: "confidential", sourceSystem: "native_eos", producerProviderKey: "eos_native_esign",
        consentRights: "contractual-retention-and-legal-hold", supportedClaimSummary: input.supportedClaimSummary, verifierMethod: input.verifierMethod,
        templateLearningEligibility: "not_eligible", relatedEventKeys: [`native-esign:${envelope.id}:envelope_completed`], relatedDecisionKeys: [], schemaVersion: "evidence-v1.0", capturedAt: envelope.completedAt || promotedAt, validFrom: envelope.completedAt || promotedAt, createdAt: promotedAt,
      }).returning();
      const [promotion] = await tx.insert(eosEsignEvidencePromotions).values({ id: receiptId, companyId, envelopeId: envelope.id, evidenceId, workPacketId: packet.id, promotedByUserId: req.user.id, supportedClaimSummary: input.supportedClaimSummary, verifierMethod: input.verifierMethod, receiptSha256, promotedAt, createdAt: promotedAt }).returning();
      const [updated] = await tx.update(eosEsignEnvelopes).set({ evidenceId, workPacketId: packet.id, version: envelope.version + 1, updatedAt: promotedAt }).where(and(eq(eosEsignEnvelopes.id, envelope.id), eq(eosEsignEnvelopes.companyId, companyId), eq(eosEsignEnvelopes.version, envelope.version), eq(eosEsignEnvelopes.state, "completed"), sql`${eosEsignEnvelopes.evidenceId} IS NULL`)).returning();
      if (!updated) throw new NativeEsignError(409, "native_esign_evidence_promotion_changed", "The envelope changed before Evidence promotion completed.");
      await appendAuditEvent(tx, { companyId, envelopeId: envelope.id, eventType: "evidence_promoted", actorType: "operator", actorReference: req.user.id, eventProjection: { evidenceId, workPacketId: packet.id, receiptSha256, integrityCheckSha256: integrity.checkSha256 } });
      return { evidence, promotion, envelope: updated };
    });
    res.status(201).json(result);
  }));

  app.get("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/completed-document", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyReader(req, companyId, "native_esign.completed_document.download");
    const envelope = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId), eq(eosEsignEnvelopes.state, "completed")) });
    if (!envelope?.finalStorageKey) throw new NativeEsignError(404, "native_esign_completed_document_unavailable", "The completed document is not available.");
    const artifact = await db.query.eosEsignArtifacts.findFirst({ where: and(eq(eosEsignArtifacts.companyId, companyId), eq(eosEsignArtifacts.storageKey, envelope.finalStorageKey)) });
    if (artifact?.state === "deleted") throw new NativeEsignError(410, "native_esign_completed_document_deleted", "The completed document was deleted under an approved custody request; its audit tombstone remains.");
    const document = await readNativeEsignArtifact(envelope.finalStorageKey);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${envelope.id}-signed.pdf"`);
    res.setHeader("Digest", `sha-256=${Buffer.from(envelope.finalSha256, "hex").toString("base64")}`);
    res.send(document);
  }));

  app.get("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/audit", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    await requireCompanyReader(req, companyId, "native_esign.audit.download");
    const envelope = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId), eq(eosEsignEnvelopes.state, "completed")) });
    if (!envelope?.auditStorageKey) throw new NativeEsignError(404, "native_esign_audit_unavailable", "The completed audit artifact is not available.");
    const artifact = await db.query.eosEsignArtifacts.findFirst({ where: and(eq(eosEsignArtifacts.companyId, companyId), eq(eosEsignArtifacts.storageKey, envelope.auditStorageKey)) });
    if (artifact?.state === "deleted") throw new NativeEsignError(410, "native_esign_audit_deleted", "The detailed audit artifact was deleted under an approved custody request; its relational tombstone remains.");
    const audit = await readNativeEsignArtifact(envelope.auditStorageKey);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${envelope.id}-audit.json"`);
    res.setHeader("Digest", `sha-256=${Buffer.from(envelope.auditSha256, "hex").toString("base64")}`);
    res.send(audit);
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/recover", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const access = await requireCompanyOperator(req, companyId, "native_esign.envelope.recover");
    if (!access.isFounder)
      throw new NativeEsignError(403, "native_esign_recovery_founder_required", "Founder authority is required to recover a failed envelope seal.");
    const envelope = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId)) });
    if (!envelope || envelope.state !== "recovery_required")
      throw new NativeEsignError(409, "native_esign_recovery_not_required", "Only an envelope locked for completion recovery can be resealed.");
    try {
      await finalizeEnvelope(envelope.id);
    } catch (error: any) {
      await db.transaction(async (tx) => {
        await appendAuditEvent(tx, { companyId, envelopeId: envelope.id, eventType: "recovery_attempt_failed", actorType: "operator", actorReference: req.user.id, eventProjection: { failureCode: error instanceof NativeEsignError ? error.code : "native_esign_recovery_failed" } });
      });
      throw new NativeEsignError(503, "native_esign_recovery_failed", "EOS could not reseal the envelope. The signed evidence remains locked for another controlled recovery attempt.");
    }
    const completed = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, envelope.id), eq(eosEsignEnvelopes.companyId, companyId)) });
    if (completed?.state !== "completed")
      throw new NativeEsignError(503, "native_esign_recovery_incomplete", "The recovery attempt did not produce a completed envelope.");
    res.json({ id: completed.id, state: completed.state, completedAt: completed.completedAt, finalSha256: completed.finalSha256, auditSha256: completed.auditSha256 });
  }));

  app.post("/api/eos/companies/:companyId/native-esign/envelopes/:envelopeId/void", route(async (req, res) => {
    const companyId = Number(req.params.companyId);
    const access = await requireCompanyOperator(req, companyId, "native_esign.envelope.void");
    if (!access.isFounder) throw new NativeEsignError(403, "native_esign_void_founder_required", "Founder authority is required to void an issued envelope.");
    const input = nativeEsignVoidSchema.parse(req.body);
    const envelope = await db.query.eosEsignEnvelopes.findFirst({ where: and(eq(eosEsignEnvelopes.id, req.params.envelopeId), eq(eosEsignEnvelopes.companyId, companyId)) });
    if (!envelope || !["draft", "issued", "in_progress"].includes(envelope.state) || envelope.version !== input.version)
      throw new NativeEsignError(409, "native_esign_envelope_not_voidable", "Envelope is terminal, unavailable, or changed before voiding.");
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(eosEsignEnvelopes).set({ state: "voided", voidedAt: now, voidReason: input.reason, version: envelope.version + 1, updatedAt: now }).where(and(eq(eosEsignEnvelopes.id, envelope.id), eq(eosEsignEnvelopes.version, envelope.version)));
      await appendAuditEvent(tx, { companyId, envelopeId: envelope.id, eventType: "envelope_voided", actorType: "operator", actorReference: req.user.id, eventProjection: { reason: input.reason } });
      if (envelope.recoveryAgreementInstanceId)
        await tx.update(eosRecoveryAgreementInstances).set({ state: "voided", version: sql`${eosRecoveryAgreementInstances.version} + 1`, updatedAt: now }).where(and(eq(eosRecoveryAgreementInstances.id, envelope.recoveryAgreementInstanceId), eq(eosRecoveryAgreementInstances.companyId, companyId)));
    });
    res.json({ id: envelope.id, state: "voided", voidedAt: now });
  }));
}
