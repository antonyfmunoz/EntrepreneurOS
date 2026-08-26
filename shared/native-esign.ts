import { z } from "zod";
import { riskControlStates } from "./eos-runtime";

export const NATIVE_ESIGN_CONTRACT_VERSION = "eos-native-esign.v1";
export const NATIVE_ESIGN_CONSENT_VERSION = "eos-native-esign-consent.v1";
export const NATIVE_ESIGN_MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;
export const NATIVE_ESIGN_MAX_SIGNATURE_CAPTURE_BYTES = 512 * 1024;
export const NATIVE_ESIGN_MIN_SIGNATURE_CAPTURE_WIDTH = 32;
export const NATIVE_ESIGN_MIN_SIGNATURE_CAPTURE_HEIGHT = 16;
export const NATIVE_ESIGN_MAX_SIGNATURE_CAPTURE_WIDTH = 2_400;
export const NATIVE_ESIGN_MAX_SIGNATURE_CAPTURE_HEIGHT = 1_200;
export const NATIVE_ESIGN_WEBHOOK_EVENT_TYPES = [
  "envelope_created", "envelope_revised", "envelope_issued", "envelope_completed",
  "envelope_voided", "envelope_expired", "envelope_cloned", "envelope_renewed", "recipient_sent", "recipient_opened",
  "recipient_corrected", "recipient_declined", "identity_otp_requested",
  "identity_verified", "consent_recorded", "signature_recorded", "delivery_prepared",
  "delivery_succeeded", "delivery_failed", "completion_delivery_prepared",
  "completion_delivery_succeeded", "completion_delivery_failed", "negotiation_opened", "negotiation_entry_recorded",
  "negotiation_resolved", "document_revision_registered", "document_comparison_recorded", "document_semantic_comparison_recorded",
  "comparison_reviewed", "comparison_acknowledged",
  "envelope_replacement_created", "envelope_replaced", "reminder_scheduled", "reminder_schedule_changed", "batch_completed",
  "obligation_promoted", "obligation_reviewed", "contract_plan_recorded", "contract_renewal_decided",
  "contract_notice_created", "contract_notice_approved", "contract_notice_delivery_prepared", "contract_notice_delivery_succeeded", "contract_notice_delivery_failed", "contract_notice_delivery_reconciled", "recovery_required",
  "recovery_attempt_failed", "evidence_promoted",
] as const;

const boundedText = (min: number, max: number) =>
  z.string().trim().min(min).max(max);

export const nativeEsignTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "Signing token is invalid.");

export const nativeEsignFieldSchema = z.object({
  id: z.string().uuid(),
  roleKey: boundedText(1, 100),
  type: z.enum(["signature", "initials", "text", "date", "checkbox"]),
  page: z.coerce.number().int().min(1).max(2_000),
  x: z.coerce.number().min(0).max(1),
  y: z.coerce.number().min(0).max(1),
  width: z.coerce.number().positive().max(1),
  height: z.coerce.number().positive().max(1),
  label: boundedText(1, 240),
  required: z.boolean().default(true),
}).superRefine((field, context) => {
  if (field.x + field.width > 1)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["width"], message: "Field must remain inside the right page boundary." });
  if (field.y + field.height > 1)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["height"], message: "Field must remain inside the bottom page boundary." });
});

export function nativeEsignRolesMissingRequiredSignature(
  fields: Array<z.infer<typeof nativeEsignFieldSchema>>,
): string[] {
  const roles = Array.from(new Set(fields.map((field) => field.roleKey)));
  return roles.filter((roleKey) => !fields.some((field) =>
    field.roleKey === roleKey && field.type === "signature" && field.required,
  ));
}

export const nativeEsignDocumentRegistrationSchema = z.object({
  documentKey: boundedText(2, 160),
  documentVersion: boundedText(1, 120),
  title: boundedText(2, 240),
  sourceReference: boundedText(2, 1_000),
  counselEvidenceId: z.string().uuid().optional(),
  fields: z.array(nativeEsignFieldSchema).max(500).default([]),
}).superRefine((document, context) => {
  const ids = new Set<string>();
  for (let index = 0; index < document.fields.length; index += 1) {
    const field = document.fields[index];
    if (ids.has(field.id))
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["fields", index, "id"], message: "Field IDs must be unique within a document version." });
    ids.add(field.id);
  }
});

export const nativeEsignRecipientInputSchema = z.object({
  roleKey: boundedText(1, 100),
  routingOrder: z.coerce.number().int().min(1).max(100),
  signerName: boundedText(2, 240),
  signerEmail: z.string().trim().email().max(320),
});

export const nativeEsignEnvelopeCreationSchema = z.object({
  documentVersionId: z.string().uuid(),
  recoveryAgreementInstanceId: z.string().uuid().optional(),
  subject: boundedText(2, 240),
  message: z.string().trim().max(4_000).default(""),
  routingMode: z.enum(["sequential", "parallel"]).default("sequential"),
  assuranceMode: z.enum(["link", "email_otp"]).default("link"),
  expiresAt: z.coerce.date(),
  recipients: z.array(nativeEsignRecipientInputSchema).min(1).max(50),
}).superRefine((value, context) => {
  if (value.expiresAt.getTime() <= Date.now())
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "Envelope expiry must be in the future." });
  const roles = new Set(value.recipients.map((recipient) => recipient.roleKey));
  if (roles.size !== value.recipients.length)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["recipients"], message: "Recipient role keys must be unique within an envelope." });
});

export const nativeEsignEnvelopeDraftUpdateSchema = z.object({
  version: z.coerce.number().int().positive(),
  subject: boundedText(2, 240),
  message: z.string().trim().max(4_000).default(""),
  routingMode: z.enum(["sequential", "parallel"]),
  assuranceMode: z.enum(["link", "email_otp"]).optional(),
  expiresAt: z.coerce.date(),
  recipients: z.array(nativeEsignRecipientInputSchema).min(1).max(50),
}).superRefine((value, context) => {
  if (value.expiresAt.getTime() <= Date.now())
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "Envelope expiry must be in the future." });
  const roles = new Set(value.recipients.map((recipient) => recipient.roleKey));
  if (roles.size !== value.recipients.length)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["recipients"], message: "Recipient role keys must be unique within an envelope." });
});

export const nativeEsignConsentSchema = z.object({
  consentVersion: z.literal(NATIVE_ESIGN_CONSENT_VERSION),
  electronicRecordsAccepted: z.literal(true),
  electronicSignaturesAccepted: z.literal(true),
  comparisonAcknowledgementSha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
});

export const nativeEsignIssueSchema = z.object({
  comparisonReviewSha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
});

export const nativeEsignSignatureSchema = z.object({
  consentVersion: z.literal(NATIVE_ESIGN_CONSENT_VERSION),
  intentToSignConfirmed: z.literal(true),
  signatureMethod: z.enum(["typed", "drawn", "uploaded"]),
  signatureName: boundedText(2, 240),
  signatureCaptureSha256: z.string().regex(/^[0-9a-f]{64}$/),
  signatureCaptureMimeType: z.enum(["image/png", "image/jpeg"]).optional(),
  signatureCaptureBase64: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).max(700_000).optional(),
  fieldValues: z.record(z.union([z.string().max(4_000), z.boolean()])).default({}),
}).superRefine((value, context) => {
  if (value.signatureMethod === "typed") {
    if (value.signatureCaptureMimeType || value.signatureCaptureBase64)
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["signatureCaptureBase64"], message: "Typed signatures cannot include an image capture." });
    return;
  }
  if (!value.signatureCaptureMimeType || !value.signatureCaptureBase64)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["signatureCaptureBase64"], message: "Drawn and uploaded signatures require an image capture." });
  if (value.signatureMethod === "drawn" && value.signatureCaptureMimeType !== "image/png")
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["signatureCaptureMimeType"], message: "Drawn signatures must use PNG capture." });
});

export const nativeEsignDeclineSchema = z.object({
  reason: boundedText(4, 2_000),
});

export const nativeEsignRecipientCorrectionSchema = z.object({
  version: z.coerce.number().int().positive(),
  signerName: boundedText(2, 240),
  signerEmail: z.string().trim().email().max(320),
  reason: boundedText(8, 2_000),
});

export const nativeEsignOtpVerifySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the six-digit verification code."),
});

const nativeEsignWebhookSubscriptionBaseSchema = z.object({
  endpointUrl: z.string().trim().url().max(2_000),
  description: z.string().trim().max(500).default(""),
  eventTypes: z.array(z.union([z.literal("*"), z.enum(NATIVE_ESIGN_WEBHOOK_EVENT_TYPES)])).min(1).max(NATIVE_ESIGN_WEBHOOK_EVENT_TYPES.length + 1),
});

function uniqueWebhookEventTypes(value: { eventTypes: string[] }, context: z.RefinementCtx) {
  if (new Set(value.eventTypes).size !== value.eventTypes.length)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["eventTypes"], message: "Webhook event types must be unique." });
}

export const nativeEsignWebhookSubscriptionSchema = nativeEsignWebhookSubscriptionBaseSchema.superRefine(uniqueWebhookEventTypes);

export const nativeEsignWebhookSubscriptionUpdateSchema = nativeEsignWebhookSubscriptionBaseSchema.extend({
  version: z.coerce.number().int().positive(),
  state: z.enum(["active", "paused", "revoked"]),
}).superRefine(uniqueWebhookEventTypes);

export const nativeEsignReplaySchema = z.object({
  reason: boundedText(8, 1_000),
});

export const nativeEsignIntegrityCheckSchema = z.object({
  reason: boundedText(8, 1_000),
});

export const nativeEsignRetentionPolicySchema = z.object({
  name: boundedText(2, 160),
  retentionDays: z.coerce.number().int().min(1).max(36_500),
  backupRequired: z.boolean().default(true),
  version: z.coerce.number().int().positive().optional(),
});

export const nativeEsignStorageDrillSchema = z.object({
  reason: boundedText(8, 1_000),
  acknowledgeSyntheticPrimaryLoss: z.literal(true),
});

export const nativeEsignLegalHoldSchema = z.object({
  reason: boundedText(10, 1_000),
  reference: z.string().trim().max(500).default(""),
});

export const nativeEsignLegalHoldReleaseSchema = z.object({
  reason: boundedText(10, 1_000),
  version: z.coerce.number().int().positive(),
});

export const nativeEsignDeletionRequestSchema = z.object({ reason: boundedText(10, 1_000) });
export const nativeEsignDeletionDecisionSchema = z.object({
  approve: z.boolean(), reason: boundedText(10, 1_000), version: z.coerce.number().int().positive(),
});
export const nativeEsignCustodyExecutionSchema = z.object({ version: z.coerce.number().int().positive() });

export const nativeEsignSecretRotationSchema = nativeEsignReplaySchema.extend({
  version: z.coerce.number().int().positive(),
});

export const nativeEsignVoidSchema = z.object({
  version: z.coerce.number().int().positive(),
  reason: boundedText(8, 2_000),
});

export const nativeEsignLibraryKeySchema = z.string().trim().min(2).max(120).regex(/^[a-z0-9][a-z0-9._-]*$/);
export const nativeEsignClauseSchema = z.object({
  clauseKey: nativeEsignLibraryKeySchema,
  name: boundedText(2, 160),
  description: z.string().trim().max(1_000).default(""),
});
export const nativeEsignClauseVersionSchema = z.object({
  versionLabel: boundedText(1, 80),
  bodyText: boundedText(10, 30_000),
  counselEvidenceId: z.string().uuid().optional(),
});
export const nativeEsignTemplateSchema = z.object({
  templateKey: nativeEsignLibraryKeySchema,
  name: boundedText(2, 160),
  description: z.string().trim().max(1_000).default(""),
});
export const nativeEsignTemplateVariableSchema = z.object({
  key: nativeEsignLibraryKeySchema,
  label: boundedText(2, 160),
  required: z.boolean().default(true),
  maxLength: z.coerce.number().int().min(1).max(4_000).default(500),
});
export const nativeEsignTemplateRecipientSchema = z.object({
  roleKey: nativeEsignLibraryKeySchema,
  label: boundedText(2, 160),
  routingOrder: z.coerce.number().int().min(1).max(100),
});
export const nativeEsignTemplateVersionSchema = z.object({
  versionLabel: boundedText(1, 80),
  titleTemplate: boundedText(2, 240),
  bodyTemplate: boundedText(20, 60_000),
  variables: z.array(nativeEsignTemplateVariableSchema).max(100).default([]),
  recipients: z.array(nativeEsignTemplateRecipientSchema).min(1).max(50),
  clauseVersionIds: z.array(z.string().uuid()).max(100).default([]),
  counselEvidenceId: z.string().uuid().optional(),
}).superRefine((value, context) => {
  for (const [path, values] of [["variables", value.variables.map((item) => item.key)], ["recipients", value.recipients.map((item) => item.roleKey)], ["clauseVersionIds", value.clauseVersionIds]] as const) {
    if (new Set(values).size !== values.length)
      context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: `${path} must be unique.` });
  }
});
export const nativeEsignLibraryApprovalSchema = z.object({
  reason: boundedText(8, 1_000),
});
export const nativeEsignCounterpartySchema = z.object({
  partyType: z.enum(["person", "organization"]),
  legalName: boundedText(2, 240),
  displayName: boundedText(2, 240),
  signerName: z.string().trim().max(240).default(""),
  signerEmail: z.union([z.literal(""), z.string().trim().email().max(320)]).default(""),
  externalReference: z.string().trim().max(500).default(""),
  dataClassification: z.enum(["internal", "confidential", "restricted"]).default("confidential"),
});
export const nativeEsignCounterpartyUpdateSchema = nativeEsignCounterpartySchema.extend({
  version: z.coerce.number().int().positive(), state: z.enum(["active", "archived"]),
});
export const nativeEsignTemplateGenerationSchema = z.object({
  values: z.record(z.string().max(4_000)).default({}),
  counterpartyId: z.string().uuid().optional(),
  workPacketId: z.string().uuid().optional(),
  documentVersion: boundedText(1, 120).optional(),
});

export const nativeEsignPortfolioTemplateProposalSchema = z.object({
  sourceTemplateVersionId: z.string().uuid(),
  proposalKey: z.string().trim().min(2).max(120).regex(/^[a-z0-9][a-z0-9._-]*$/),
  jurisdictionPackId: z.string().uuid().optional(),
  jurisdiction: boundedText(2, 160),
  applicabilitySummary: boundedText(20, 4_000),
  limitations: boundedText(20, 4_000),
  reviewEvidenceId: z.string().uuid(),
  reviewAuthority: z.enum(["qualified_counsel", "internal_legal", "business_review"]),
  classification: z.enum(["internal", "confidential", "restricted"]).default("confidential"),
});

const nativeEsignIsoDateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date in YYYY-MM-DD format.");
const nativeEsignCredentialPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\b/,
  /\bgh[opsu]_[A-Za-z0-9]{20,}\b/,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_=-]{20,}\b/i,
  /\bya29\.[A-Za-z0-9_-]{20,}\b/,
];
function rejectNativeEsignCredentialMaterial(value: unknown, context: z.RefinementCtx): void {
  if (nativeEsignCredentialPatterns.some((pattern) => pattern.test(JSON.stringify(value))))
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Jurisdiction records cannot contain credential-shaped material.", path: ["sourceReferences"] });
}
export const nativeEsignJurisdictionSourceReferenceSchema = z.object({
  label: boundedText(2, 240),
  reference: boundedText(4, 1_000),
  url: z.string().trim().url().max(2_000).optional(),
});
export const nativeEsignJurisdictionPackSchema = z.object({
  packKey: z.string().trim().min(2).max(120).regex(/^[a-z0-9][a-z0-9._-]*$/),
  name: boundedText(2, 240),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  subdivision: z.string().trim().max(160).default(""),
  governingLawLabel: boundedText(2, 240),
  scopeSummary: boundedText(20, 4_000),
  applicabilityCriteria: boundedText(20, 4_000),
  exclusions: boundedText(20, 4_000),
  requiredReviews: z.array(boundedText(4, 500)).min(1).max(30).refine((values) => new Set(values.map((value) => value.toLowerCase())).size === values.length, "Required reviews must be unique."),
  sourceReferences: z.array(nativeEsignJurisdictionSourceReferenceSchema).min(1).max(30),
  effectiveFrom: nativeEsignIsoDateSchema,
  reviewedThrough: nativeEsignIsoDateSchema,
  nextReviewAt: nativeEsignIsoDateSchema,
  classification: z.enum(["internal", "confidential", "restricted"]).default("confidential"),
}).superRefine((value, context) => {
  if (value.reviewedThrough < value.effectiveFrom) context.addIssue({ code: z.ZodIssueCode.custom, path: ["reviewedThrough"], message: "Reviewed-through date cannot precede the effective date." });
  if (value.nextReviewAt <= value.reviewedThrough) context.addIssue({ code: z.ZodIssueCode.custom, path: ["nextReviewAt"], message: "Next review must follow the reviewed-through date." });
  rejectNativeEsignCredentialMaterial(value, context);
});
export const nativeEsignJurisdictionPackPublicationSchema = z.object({
  expectedPackSha256: z.string().regex(/^[0-9a-f]{64}$/),
  reviewEvidenceId: z.string().uuid(),
  reviewerName: boundedText(2, 240),
  reviewerOrganization: boundedText(2, 240),
  reviewerCredentialReference: boundedText(5, 500),
  publicationNote: boundedText(20, 4_000),
}).superRefine(rejectNativeEsignCredentialMaterial);
export const nativeEsignJurisdictionApplicabilityDecisionSchema = z.object({
  expectedPackSha256: z.string().regex(/^[0-9a-f]{64}$/),
  outcome: z.enum(["applicable", "not_applicable", "needs_revision"]),
  reviewEvidenceId: z.string().uuid(),
  reviewerName: boundedText(2, 240),
  reviewerOrganization: boundedText(2, 240),
  reviewerCredentialReference: boundedText(5, 500),
  factsConsidered: boundedText(20, 4_000),
  decisionRationale: boundedText(20, 4_000),
}).superRefine(rejectNativeEsignCredentialMaterial);
export const nativeEsignJurisdictionPackWithdrawalSchema = z.object({
  expectedPackSha256: z.string().regex(/^[0-9a-f]{64}$/),
  reason: boundedText(20, 4_000),
});

export const nativeEsignPortfolioTemplateAdoptionSchema = z.object({
  expectedProposalSha256: z.string().regex(/^[0-9a-f]{64}$/),
  decision: z.enum(["accepted", "rejected"]),
  reviewEvidenceId: z.string().uuid(),
  reviewAuthority: z.enum(["qualified_counsel", "internal_legal", "business_review"]),
  decisionRationale: boundedText(20, 4_000),
});

export const nativeEsignPortfolioTemplateWithdrawalSchema = z.object({
  expectedProposalSha256: z.string().regex(/^[0-9a-f]{64}$/),
  reason: boundedText(20, 4_000),
});
export const nativeEsignEvidencePromotionSchema = z.object({
  workPacketId: z.string().uuid(),
  supportedClaimSummary: boundedText(10, 2_000),
  verifierMethod: boundedText(8, 500),
});
export const nativeEsignEnvelopeListSchema = z.object({
  q: z.string().trim().max(200).default(""),
  state: z.enum(["all", "draft", "issued", "in_progress", "completed", "declined", "voided", "expired", "recovery_required"]).default("all"),
  counterpartyId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const nativeEsignCloneSchema = z.object({
  mode: z.enum(["clone", "renewal"]).default("clone"),
  subject: boundedText(2, 240).optional(),
  message: z.string().trim().max(4_000).optional(),
  expiresAt: z.coerce.date().refine((value) => value.getTime() > Date.now(), "Expiry must be in the future."),
});
export const nativeEsignNegotiationOpenSchema = z.object({
  subject: boundedText(2, 240), body: boundedText(2, 10_000),
  requestedChanges: z.array(boundedText(2, 1_000)).max(50).default([]),
});
export const nativeEsignNegotiationEntrySchema = z.object({
  body: boundedText(2, 10_000), requestedChanges: z.array(boundedText(2, 1_000)).max(50).default([]),
});
export const nativeEsignNegotiationResolutionSchema = z.object({
  version: z.coerce.number().int().positive(), resolutionSummary: boundedText(8, 2_000),
});
export const nativeEsignDocumentRevisionSchema = z.object({
  documentVersion: boundedText(1, 120), title: boundedText(2, 240), sourceReference: boundedText(2, 1_000),
  revisionSummary: boundedText(8, 2_000), negotiationId: z.string().uuid().optional(),
  declaredChanges: z.array(boundedText(2, 1_000)).min(1).max(100),
  fields: z.array(nativeEsignFieldSchema).max(500).default([]),
}).superRefine((document, context) => {
  const ids = new Set<string>();
  for (let index = 0; index < document.fields.length; index += 1) {
    const field = document.fields[index];
    if (ids.has(field.id)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["fields", index, "id"], message: "Field IDs must be unique within a document revision." });
    ids.add(field.id);
  }
});
export const nativeEsignGeneratedRevisionSchema = z.object({
  templateVersionId: z.string().uuid(),
  documentVersion: boundedText(1, 120),
  revisionSummary: boundedText(8, 2_000),
  negotiationId: z.string().uuid().optional(),
  values: z.record(z.string().max(4_000)).default({}),
});
export const nativeEsignReplacementSchema = z.object({
  documentVersionId: z.string().uuid(), negotiationId: z.string().uuid(),
  subject: boundedText(2, 240).optional(), message: z.string().trim().max(4_000).optional(),
  expiresAt: z.coerce.date().refine((value) => value.getTime() > Date.now(), "Expiry must be in the future."),
});
export const nativeEsignReminderScheduleSchema = z.object({
  nextReminderAt: z.coerce.date(), intervalDays: z.coerce.number().int().min(1).max(30),
  maxReminders: z.coerce.number().int().min(1).max(20),
});
export const nativeEsignReminderScheduleUpdateSchema = z.object({
  version: z.coerce.number().int().positive(), state: z.enum(["active", "paused", "cancelled"]),
  nextReminderAt: z.coerce.date().optional(),
});
export const nativeEsignBatchSchema = z.object({
  action: z.enum(["remind", "void"]), envelopeIds: z.array(z.string().uuid()).min(1).max(100),
  reason: boundedText(8, 2_000),
}).superRefine((value, context) => {
  if (new Set(value.envelopeIds).size !== value.envelopeIds.length)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["envelopeIds"], message: "Envelope IDs must be unique." });
});
export const nativeEsignObligationPromotionSchema = z.object({
  obligationKey: nativeEsignLibraryKeySchema, title: boundedText(2, 240),
  ownerSeatId: z.string().uuid(), description: boundedText(10, 4_000),
  sourceExcerpt: boundedText(5, 5_000), dueReviewAt: z.coerce.date().optional(),
  classification: z.enum(["internal", "confidential", "restricted"]).default("confidential"),
});

export const nativeEsignObligationReviewSchema = z.object({
  expectedUpdatedAt: z.coerce.date(),
  targetState: z.enum(riskControlStates),
  ownerSeatId: z.string().uuid(),
  evidenceIds: z.array(z.string().uuid()).max(50).default([]),
  reviewNote: boundedText(8, 4_000),
  nextReviewAt: z.coerce.date().optional(),
}).superRefine((value, context) => {
  if (new Set(value.evidenceIds).size !== value.evidenceIds.length)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["evidenceIds"], message: "Operational Evidence IDs must be unique." });
  if (["overdue_breached", "satisfied_closed"].includes(value.targetState) && value.evidenceIds.length === 0)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["evidenceIds"], message: "Breach and satisfaction reviews require verified operational Evidence." });
  if (!["satisfied_closed", "superseded"].includes(value.targetState) && !value.nextReviewAt)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["nextReviewAt"], message: "An active obligation review must schedule the next review." });
});

export const nativeEsignContractPlanSchema = z.object({
  expectedVersion: z.coerce.number().int().positive().optional(),
  effectiveAt: z.coerce.date(),
  contractEndsAt: z.coerce.date().nullable().optional(),
  noticeDeadlineAt: z.coerce.date().nullable().optional(),
  nextReviewAt: z.coerce.date(),
  ownerSeatId: z.string().uuid(),
  classification: z.enum(["internal", "confidential", "restricted"]).default("confidential"),
  notes: z.string().trim().max(4_000).default(""),
}).superRefine((value, context) => {
  if (value.contractEndsAt && value.contractEndsAt <= value.effectiveAt)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["contractEndsAt"], message: "The agreement end must follow its effective date." });
  if (value.noticeDeadlineAt && value.contractEndsAt && value.noticeDeadlineAt > value.contractEndsAt)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["noticeDeadlineAt"], message: "The notice deadline cannot follow the agreement end." });
});

export const nativeEsignContractRenewalDecisionSchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
  intent: z.enum(["renew", "renegotiate", "terminate", "allow_expiry"]),
  evidenceIds: z.array(z.string().uuid()).min(1).max(50),
  decisionNote: boundedText(8, 4_000),
}).superRefine((value, context) => {
  if (new Set(value.evidenceIds).size !== value.evidenceIds.length)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["evidenceIds"], message: "Decision Evidence IDs must be unique." });
});

export const nativeEsignContractNoticeSchema = z.object({
  noticeType: z.enum(["renewal_offer", "nonrenewal", "termination", "cure", "other"]),
  recipientName: boundedText(2, 240),
  recipientEmail: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  subject: boundedText(2, 240).refine((value) => !/[\r\n]/.test(value), "Subject cannot contain line breaks."),
  bodyText: boundedText(20, 20_000),
  dueAt: z.coerce.date(),
  ownerSeatId: z.string().uuid(),
  classification: z.enum(["internal", "confidential", "restricted"]).default("confidential"),
});

export const nativeEsignContractNoticeApprovalSchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
  evidenceIds: z.array(z.string().uuid()).min(1).max(50),
  approvalNote: boundedText(8, 4_000),
}).superRefine((value, context) => {
  if (new Set(value.evidenceIds).size !== value.evidenceIds.length)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["evidenceIds"], message: "Notice approval Evidence IDs must be unique." });
});

export const nativeEsignContractNoticeDeliverySchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
});

export const nativeEsignContractNoticeReconciliationSchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
  outcome: z.enum(["delivered", "failed", "uncertain"]),
  providerMessageReference: z.string().trim().max(500).default(""),
  reconciliationNote: boundedText(8, 4_000),
}).superRefine((value, context) => {
  if (value.outcome === "delivered" && !value.providerMessageReference)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["providerMessageReference"], message: "A verified provider message reference is required to reconcile delivery." });
});

export type NativeEsignEnvelopeCreation = z.infer<typeof nativeEsignEnvelopeCreationSchema>;
export type NativeEsignEnvelopeDraftUpdate = z.infer<typeof nativeEsignEnvelopeDraftUpdateSchema>;
export type NativeEsignRecipientCorrection = z.infer<typeof nativeEsignRecipientCorrectionSchema>;
export type NativeEsignSignature = z.infer<typeof nativeEsignSignatureSchema>;
export type NativeEsignField = z.infer<typeof nativeEsignFieldSchema>;
export type NativeEsignTemplateVariable = z.infer<typeof nativeEsignTemplateVariableSchema>;
export type NativeEsignTemplateRecipient = z.infer<typeof nativeEsignTemplateRecipientSchema>;

export function nativeEsignEnvelopeState(input: {
  recipientStates: string[];
  expired: boolean;
  voided: boolean;
}): "issued" | "in_progress" | "completed" | "declined" | "voided" | "expired" {
  if (input.voided) return "voided";
  if (input.expired) return "expired";
  if (input.recipientStates.some((state) => state === "declined")) return "declined";
  if (input.recipientStates.length > 0 && input.recipientStates.every((state) => state === "signed")) return "completed";
  if (input.recipientStates.some((state) => ["opened", "consented", "signed"].includes(state))) return "in_progress";
  return "issued";
}

export function activeRoutingOrder(input: {
  routingMode: "sequential" | "parallel";
  recipients: Array<{ routingOrder: number; state: string }>;
}): number[] {
  if (input.routingMode === "parallel")
    return input.recipients.filter((recipient) => recipient.state !== "signed").map((recipient) => recipient.routingOrder);
  const pending = input.recipients
    .filter((recipient) => recipient.state !== "signed")
    .map((recipient) => recipient.routingOrder);
  return pending.length ? [Math.min(...pending)] : [];
}

export function nativeEsignRecipientRoutingState(input: {
  routingMode: "sequential" | "parallel";
  recipients: Array<{ routingOrder: number; state: string }>;
  recipient: { routingOrder: number; state: string };
}): "active" | "waiting" | "completed" {
  if (input.recipient.state === "signed") return "completed";
  const activeOrders = activeRoutingOrder({
    routingMode: input.routingMode,
    recipients: input.recipients,
  });
  return activeOrders.includes(input.recipient.routingOrder) ? "active" : "waiting";
}
