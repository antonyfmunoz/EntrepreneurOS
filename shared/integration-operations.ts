import { z } from "zod";

const uuid = z.string().uuid();
const bounded = (min: number, max: number) => z.string().trim().min(min).max(max);
const evidenceIds = z.array(uuid).min(1).max(20).refine((items) => new Set(items).size === items.length, "Evidence references must be unique.");
const classification = z.enum(["public", "internal", "confidential", "restricted"]);

const rejectsSecrets = <T extends z.ZodTypeAny>(schema: T) => schema.superRefine((value, context) => {
  if (/(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|sk_(?:live|test)_[A-Za-z0-9]+|gh[pousr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|client_secret["']?\s*[:=]|bearer\s+[A-Za-z0-9._-]{20,})/i.test(JSON.stringify(value)))
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Store provider references and Evidence IDs only; secret material is prohibited." });
});

export const adapterManifestCreateSchema = rejectsSecrets(z.object({
  integrationBindingId: uuid,
  contractVersion: bounded(1, 120),
  evidenceIds,
}));

export const integrationRunCreateSchema = rejectsSecrets(z.object({
  integrationBindingId: uuid,
  automationId: uuid.optional(),
  operation: bounded(1, 300),
  idempotencyKey: bounded(8, 300),
  requestReference: bounded(3, 1000),
  requestShape: z.record(z.unknown()).default({}),
  maxAttempts: z.coerce.number().int().min(1).max(20).default(3),
  ownerSeatId: uuid,
  classification: classification.default("restricted"),
}));

export const integrationRunReceiptSchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  outcome: z.enum(["succeeded", "failed", "uncertain"]),
  authority: z.enum(["provider_receipt", "provider_observation", "reconciled", "manual_attestation", "fixture"]),
  externalReference: bounded(3, 1000),
  summary: bounded(10, 4000),
  responseShape: z.record(z.unknown()).default({}),
  latencyMs: z.coerce.number().int().nonnegative().max(86_400_000).optional(),
  evidenceIds,
}));

export const integrationRunExecuteSchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  confirmExternalEffect: z.literal(true),
  evidenceIds,
}));

export const integrationWebhookEndpointCreateSchema = z.object({
  acceptedEventTypes: z.array(bounded(1, 300)).min(1).max(200)
    .refine((items) => new Set(items).size === items.length, "Accepted event types must be unique."),
  evidenceIds,
});

export const integrationWebhookSecretRotateSchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
  gracePeriodMinutes: z.coerce.number().int().min(0).max(1440).default(15),
  evidenceIds,
});

export const integrationWebhookEndpointStateSchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
  state: z.enum(["active", "revoked"]),
  evidenceIds,
});

export const providerIngressRegistrationCreateSchema = rejectsSecrets(z.object({
  provider: z.enum(["notion", "gmail", "google_drive", "google_calendar"]),
  providerAccountReference: bounded(3, 500),
  providerSubscriptionReference: z.string().trim().max(1000).default(""),
  resourceCollectionReference: z.string().trim().max(1000).default(""),
  topicName: z.string().trim().max(1000).default(""),
  audience: z.string().trim().url().max(2000).or(z.literal("")).default(""),
  serviceAccountEmail: z.string().trim().email().max(320).or(z.literal("")).default(""),
  evidenceIds,
}).superRefine((value, context) => {
  if (value.provider === "gmail" && (!value.topicName.startsWith("projects/") || !value.audience || !value.serviceAccountEmail || !value.providerSubscriptionReference))
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Gmail ingress requires an exact Pub/Sub topic, subscription, audience, and push service-account email." });
  if (value.provider === "notion" && (value.topicName || value.audience || value.serviceAccountEmail))
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Notion ingress does not use Google Pub/Sub configuration." });
  if ((value.provider === "google_drive" || value.provider === "google_calendar") &&
      (value.providerSubscriptionReference || value.topicName || value.audience || value.serviceAccountEmail))
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Google Drive and Calendar ingress channels are created by EOS; do not supply Pub/Sub configuration or a channel identifier." });
  if (value.provider === "google_drive" && value.resourceCollectionReference !== "changes")
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Google Drive ingress must watch the canonical changes collection." });
  if (value.provider === "google_calendar" && !value.resourceCollectionReference)
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Google Calendar ingress requires an exact calendar identifier such as primary." });
  if ((value.provider === "notion" || value.provider === "gmail") && value.resourceCollectionReference)
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Only Google Drive and Calendar ingress use a resource collection reference." });
}));

export const providerIngressStateSchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
  state: z.enum(["active", "revoked"]),
  evidenceIds,
});

export const gmailWatchStartSchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
  confirmExternalEffect: z.literal(true),
  evidenceIds,
});

export const googleChannelStartSchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
  confirmExternalEffect: z.literal(true),
  evidenceIds,
});

export const providerIngressTokenRevealSchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
  evidenceIds,
});

export const providerIngressReplaySchema = rejectsSecrets(z.object({
  rationale: bounded(20, 3000),
  evidenceIds,
}));

export const providerIngressConfigurationRotateSchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  providerSubscriptionReference: z.string().trim().max(1000).default(""),
  resourceCollectionReference: z.string().trim().max(1000).default(""),
  topicName: z.string().trim().max(1000).default(""),
  audience: z.string().trim().url().max(2000).or(z.literal("")).default(""),
  serviceAccountEmail: z.string().trim().email().max(320).or(z.literal("")).default(""),
  confirmExternalEffect: z.boolean().default(false),
  rationale: bounded(20, 3000),
  evidenceIds,
}));

export const providerIngressPolicyUpdateSchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  watchRenewBeforeMinutes: z.coerce.number().int().min(5).max(8_640),
  reconciliationOverdueMinutes: z.coerce.number().int().min(5).max(1_440),
  pendingVerificationMinutes: z.coerce.number().int().min(5).max(10_080),
  externalEscalationEnabled: z.boolean(),
  minimumEscalationSeverity: z.enum(["warning", "material", "critical"]),
  maxDeliveryAttempts: z.coerce.number().int().min(1).max(10),
  rationale: bounded(20, 3000),
  evidenceIds,
}));

export const providerIngressAlertReplaySchema = rejectsSecrets(z.object({
  rationale: bounded(20, 3000),
  evidenceIds,
}));

export const providerIngressAlertAcknowledgeSchema = rejectsSecrets(z.object({
  acknowledgementNote: bounded(10, 2000),
  evidenceIds: z.array(uuid).max(20).default([])
    .refine((items) => new Set(items).size === items.length, "Evidence references must be unique."),
}));

export const integrationAdapterEventSchema = z.object({
  schemaVersion: z.literal("eos.adapter-event.v1"),
  eventId: bounded(8, 300),
  eventType: bounded(1, 300),
  occurredAt: z.string().datetime({ offset: true }),
  operation: bounded(1, 300).optional(),
  runId: uuid.optional(),
  providerExecutionId: uuid.optional(),
  idempotencyKey: bounded(8, 300).optional(),
  outcome: z.enum(["succeeded", "failed", "uncertain", "informational"]),
  externalReference: bounded(3, 1000),
  summary: bounded(10, 4000),
  data: z.record(z.unknown()).default({}),
}).strict().superRefine((value, context) => {
  if (JSON.stringify(value.data).length > 64_000)
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Adapter event data exceeds the bounded projection limit." });
  if (/(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|sk_(?:live|test)_[A-Za-z0-9]+|gh[pousr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|client_secret["']?\s*[:=]|bearer\s+[A-Za-z0-9._-]{20,})/i.test(JSON.stringify(value)))
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Adapter events must contain bounded references, not secret material." });
});

const optionalMailbox = z.string().trim().email().max(320).optional();
export const gmailSendRequestSchema = z.object({
  to: z.string().trim().email().max(320),
  subject: bounded(1, 998).refine((value) => !/[\r\n]/.test(value), "Subject must not contain line breaks."),
  body: bounded(1, 200_000),
  cc: optionalMailbox,
  bcc: optionalMailbox,
}).strict();

export const notionWorkspaceVerifyRequestSchema = z.object({}).strict();
export const notionWorkspaceSearchRequestSchema = z.object({
  query: z.string().trim().max(500).default(""),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict();
export const notionPageReadSnapshotRequestSchema = z.object({
  pageId: bounded(32, 36).regex(/^[0-9a-f-]+$/i, "Notion page ID must be a canonical hexadecimal identifier."),
  maxBlocks: z.coerce.number().int().min(1).max(500).default(200),
}).strict();

export const quickbooksCompanyVerifyRequestSchema = z.object({}).strict();
export const quickbooksOpenInvoicesRequestSchema = z.object({
  maxResults: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export const quickbooksCreateInvoiceRequestSchema = z.object({
  customerId: bounded(1, 100),
  lineItems: z.array(z.object({
    itemId: bounded(1, 100),
    amount: z.coerce.number().positive().max(10_000_000),
    description: z.string().trim().max(4_000).optional(),
    quantity: z.coerce.number().positive().max(1_000_000).optional(),
    unitPrice: z.coerce.number().positive().max(10_000_000).optional(),
  }).strict()).min(1).max(100),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD.").optional(),
  docNumber: z.string().trim().min(1).max(21).optional(),
  privateNote: z.string().trim().max(4_000).optional(),
}).strict();

export const executableAdapterOperations = [
  "gmail.send",
  "notion.workspace.verify",
  "notion.workspace.search",
  "notion.page.read_snapshot",
  "quickbooks.company.verify",
  "quickbooks.invoice.list_open",
  "quickbooks.invoice.create",
] as const;

export function providerExecutionEnabled(env: Record<string, string | undefined> = process.env) {
  return env.EOS_INTEGRATION_PROVIDER_EFFECTS_ENABLED === "true";
}

export const integrationRetrySchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  rationale: bounded(20, 3000),
  evidenceIds,
}));

export const integrationIncidentTransitionSchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  state: z.enum(["acknowledged", "resolved"]),
  rationale: bounded(20, 4000),
  evidenceIds,
}));

export const integrationFallbackSchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  trafficMode: z.enum(["manual_fallback", "paused", "provider"]),
  rationale: bounded(20, 4000),
  evidenceIds,
}));

export const integrationQualificationSchema = rejectsSecrets(z.object({
  integrationBindingId: uuid,
  manifestId: uuid,
  qualificationKey: bounded(2, 120).regex(/^[a-z0-9][a-z0-9._-]*$/i),
  environment: z.enum(["fixture", "sandbox", "production"]),
  outcome: z.enum(["passing", "failing", "accepted_exception"]),
  testedOperations: z.array(bounded(1, 300)).min(1).max(200),
  missingCapabilities: z.array(bounded(1, 500)).max(200).default([]),
  testSummary: bounded(20, 5000),
  rollbackValidated: z.boolean(),
  evidenceIds,
}));

export const integrationCutoverSchema = rejectsSecrets(z.object({
  expectedOperationalVersion: z.coerce.number().int().positive(),
  qualificationId: uuid,
  decision: z.enum(["approve_native", "retain_provider", "rollback_to_provider"]),
  rationale: bounded(20, 5000),
  evidenceIds,
}));

export function terminalRunState(state: string) {
  return ["succeeded", "dead_letter"].includes(state);
}
