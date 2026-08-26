import { z } from "zod";

export const customerHealthStates = ["unknown", "healthy", "watch", "at_risk", "critical"] as const;
export const customerLifecycleStates = ["active", "renewal_review", "renewing", "nonrenewing", "churned", "closed"] as const;
export const customerRenewalIntents = ["undecided", "renew", "renegotiate", "terminate", "allow_expiry", "defer"] as const;
export const customerOutcomeStates = ["tracking", "achieved", "not_achieved", "abandoned"] as const;
export const customerIssueSeverities = ["low", "medium", "high", "critical"] as const;
export const customerProofConsents = ["internal_only", "customer_approved", "public_approved"] as const;

const classification = z.enum(["public", "internal", "confidential", "restricted"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date (YYYY-MM-DD).");
const text = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);
const id = z.string().uuid();
const evidenceIds = z.array(id).min(1).max(20);

const rejectsSecrets = <T extends z.ZodTypeAny>(schema: T) => schema.superRefine((value, context) => {
  const serialized = JSON.stringify(value);
  if (/(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|sk_(?:live|test)_[A-Za-z0-9]+|gh[pousr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|client_secret\s*[:=]|bearer\s+[A-Za-z0-9._-]{20,})/i.test(serialized))
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Store only provider, consent, or receipt references; secret material is prohibited." });
});

export const customerSuccessAccountSchema = rejectsSecrets(z.object({
  stakeholderId: id,
  relationshipId: id,
  ownerSeatId: id,
  contractEnvelopeId: z.union([id, z.literal("")]).optional(),
  reviewCadenceDays: z.coerce.number().int().min(1).max(365),
  nextReviewAt: isoDate,
  renewalAt: z.union([isoDate, z.literal("")]).optional(),
  successDefinition: text(20, 5000),
  classification: classification.default("confidential"),
}));

export const customerHealthReviewSchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  deliveryScore: z.coerce.number().int().min(0).max(100),
  outcomeScore: z.coerce.number().int().min(0).max(100),
  adoptionScore: z.coerce.number().int().min(0).max(100),
  relationshipScore: z.coerce.number().int().min(0).max(100),
  riskScore: z.coerce.number().int().min(0).max(100),
  evidenceIds,
  summary: text(20, 5000),
  nextActions: text(10, 3000),
  nextReviewAt: isoDate,
}));

export const customerOutcomeDraftSchema = rejectsSecrets(z.object({
  expectedAccountVersion: z.coerce.number().int().positive(),
  outcomeKey: text(2, 120).regex(/^[a-z0-9][a-z0-9._-]*$/i),
  title: text(3, 240),
  definition: text(20, 5000),
  baselineValue: text(1, 240),
  targetValue: text(1, 240),
  unit: text(1, 80),
  dueAt: isoDate,
  attributionModel: z.enum(["direct", "contributing", "correlated", "unknown"]),
  attributionRationale: text(20, 3000),
  ownerSeatId: id,
  classification: classification.default("confidential"),
}));

export const customerOutcomeProgressSchema = rejectsSecrets(z.object({
  expectedAccountVersion: z.coerce.number().int().positive(),
  expectedVersion: z.coerce.number().int().positive(),
  state: z.enum(customerOutcomeStates),
  actualValue: text(1, 240),
  evidenceIds,
  note: text(20, 3000),
}));

export const customerIssueDraftSchema = rejectsSecrets(z.object({
  expectedAccountVersion: z.coerce.number().int().positive(),
  issueKey: text(2, 120).regex(/^[a-z0-9][a-z0-9._-]*$/i),
  title: text(3, 240),
  severity: z.enum(customerIssueSeverities),
  summary: text(20, 5000),
  ownerSeatId: id,
  dueAt: isoDate,
  evidenceIds: z.array(id).max(20).default([]),
  classification: classification.default("confidential"),
}));

export const customerIssueResolutionSchema = rejectsSecrets(z.object({
  expectedAccountVersion: z.coerce.number().int().positive(),
  expectedVersion: z.coerce.number().int().positive(),
  resolution: text(20, 5000),
  evidenceIds,
}));

export const customerReportPreparationSchema = rejectsSecrets(z.object({
  expectedAccountVersion: z.coerce.number().int().positive(),
  reportKey: text(2, 120).regex(/^[a-z0-9][a-z0-9._-]*$/i),
  title: text(3, 240),
  periodStart: isoDate,
  periodEnd: isoDate,
  executiveSummary: text(20, 5000),
  evidenceIds,
  proofConsent: z.enum(customerProofConsents),
  consentEvidenceId: z.union([id, z.literal("")]).optional(),
  classification: classification.default("confidential"),
}).superRefine((value, context) => {
  if (value.periodEnd < value.periodStart)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["periodEnd"], message: "Reporting period end cannot precede its start." });
  if (value.proofConsent !== "internal_only" && !value.consentEvidenceId)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["consentEvidenceId"], message: "Customer or public proof requires separate verified consent Evidence." });
}));

export const customerReportApprovalSchema = rejectsSecrets(z.object({
  expectedAccountVersion: z.coerce.number().int().positive(),
  expectedVersion: z.coerce.number().int().positive(),
  approvalEvidenceIds: evidenceIds,
  approvalNote: text(20, 3000),
}));

export const customerReportDeliverySchema = rejectsSecrets(z.object({
  expectedAccountVersion: z.coerce.number().int().positive(),
  expectedVersion: z.coerce.number().int().positive(),
  channel: z.enum(["email", "portal", "crm", "manual"]),
  recipientScope: text(3, 500),
  externalReference: text(3, 1000),
  receiptEvidenceId: id,
  deliveredAt: z.coerce.date(),
}));

export const customerRenewalDecisionSchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  intent: z.enum(customerRenewalIntents).exclude(["undecided"]),
  evidenceIds,
  rationale: text(20, 5000),
  nextReviewAt: isoDate,
}));

export type CustomerHealthInput = Pick<z.infer<typeof customerHealthReviewSchema>, "deliveryScore" | "outcomeScore" | "adoptionScore" | "relationshipScore" | "riskScore">;

export function deriveCustomerHealth(input: CustomerHealthInput) {
  const score = Math.round((input.deliveryScore + input.outcomeScore + input.adoptionScore + input.relationshipScore + (100 - input.riskScore)) / 5);
  const state = score >= 80 ? "healthy" : score >= 60 ? "watch" : score >= 40 ? "at_risk" : "critical";
  return { score, state: state as (typeof customerHealthStates)[number] };
}

export function lifecycleForRenewalIntent(intent: Exclude<(typeof customerRenewalIntents)[number], "undecided">) {
  if (intent === "renew" || intent === "renegotiate") return "renewing" as const;
  if (intent === "terminate" || intent === "allow_expiry") return "nonrenewing" as const;
  return "renewal_review" as const;
}
