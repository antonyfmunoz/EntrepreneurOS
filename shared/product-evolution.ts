import { z } from "zod";

export const productFeedbackSources = ["customer", "sales", "delivery", "support", "operations", "analytics", "provider"] as const;
export const productCompatibilityOutcomes = ["compatible", "breaking", "unknown"] as const;
export const productExperimentStates = ["planned", "running", "concluded", "stopped"] as const;
export const productExperimentResults = ["met", "not_met", "inconclusive"] as const;
export const productReleaseDecisions = ["ship", "iterate", "reject"] as const;
export const productRolloutStages = ["internal", "pilot", "limited", "general"] as const;
export const productRolloutStates = ["not_started", "running", "completed", "rolled_back"] as const;

const id = z.string().uuid();
const text = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);
const classification = z.enum(["public", "internal", "confidential", "restricted"]);
const evidenceIds = z.array(id).min(1).max(20).refine((values) => new Set(values).size === values.length, "Evidence references must be unique.");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date (YYYY-MM-DD).");

const rejectsSecrets = <T extends z.ZodTypeAny>(schema: T) => schema.superRefine((value, context) => {
  const serialized = JSON.stringify(value);
  if (/(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|sk_(?:live|test)_[A-Za-z0-9]+|gh[pousr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|client_secret\s*[:=]|bearer\s+[A-Za-z0-9._-]{20,})/i.test(serialized))
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Store provider references and Evidence IDs only; secret material is prohibited." });
});

export const evolvableOfferFields = [
  "name", "problemNeed", "promiseOutcome", "scopeInclusions", "exclusionsConstraints",
  "deliveryModel", "pricingEconomicModel", "commercialTermsAuthority", "metricKeys", "workflowKeys",
] as const;

export const offerPatchSchema = z.object({
  name: text(2, 300).optional(),
  problemNeed: text(3, 3000).optional(),
  promiseOutcome: text(3, 3000).optional(),
  scopeInclusions: z.string().trim().max(4000).optional(),
  exclusionsConstraints: z.string().trim().max(4000).optional(),
  deliveryModel: z.string().trim().max(3000).optional(),
  pricingEconomicModel: z.string().trim().max(3000).optional(),
  commercialTermsAuthority: z.string().trim().max(2000).optional(),
  metricKeys: z.array(text(1, 1000)).max(200).optional(),
  workflowKeys: z.array(text(1, 1000)).max(200).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one governed offer field must change.");

export const productFeedbackSchema = rejectsSecrets(z.object({
  offerId: id,
  source: z.enum(productFeedbackSources),
  sourceReference: text(3, 1000),
  summary: text(20, 5000),
  observedAt: z.coerce.date(),
  evidenceIds,
  classification: classification.default("confidential"),
}));

export const productProposalSchema = rejectsSecrets(z.object({
  offerId: id,
  proposalKey: text(2, 120).regex(/^[a-z0-9][a-z0-9._-]*$/i),
  title: text(3, 240),
  hypothesis: text(20, 5000),
  proposedPatch: offerPatchSchema,
  rollbackPlan: text(20, 5000),
  successMetric: text(3, 1000),
  guardrailMetric: text(3, 1000),
  feedbackSignalIds: z.array(id).max(50).default([]).refine((values) => new Set(values).size === values.length, "Feedback references must be unique."),
  ownerSeatId: id,
  classification: classification.default("confidential"),
}));

export const productCompatibilityReviewSchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  outcome: z.enum(productCompatibilityOutcomes),
  rationale: text(20, 5000),
  affectedWorkflows: z.array(text(1, 500)).max(100).default([]),
  affectedSegments: z.array(text(1, 500)).max(100).default([]),
  affectedContracts: z.array(text(1, 500)).max(100).default([]),
  migrationPlan: z.string().trim().max(5000).default(""),
  evidenceIds,
}).superRefine((value, context) => {
  if (value.outcome === "breaking" && value.migrationPlan.trim().length < 20)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["migrationPlan"], message: "Breaking changes require a migration plan." });
}));

export const productExperimentSchema = rejectsSecrets(z.object({
  expectedProposalVersion: z.coerce.number().int().positive(),
  question: text(20, 3000),
  cohortScope: text(10, 3000),
  allocationPercent: z.coerce.number().int().min(1).max(100),
  startsAt: isoDate,
  endsAt: isoDate,
  ownerSeatId: id,
  classification: classification.default("confidential"),
}).refine((value) => value.endsAt >= value.startsAt, { path: ["endsAt"], message: "Experiment end cannot precede its start." }));

export const productExperimentTransitionSchema = rejectsSecrets(z.object({
  expectedProposalVersion: z.coerce.number().int().positive(),
  expectedVersion: z.coerce.number().int().positive(),
  state: z.enum(["running", "stopped"]),
  rationale: text(20, 3000),
  evidenceIds: z.array(id).max(20).default([]),
}));

export const productObservationSchema = rejectsSecrets(z.object({
  expectedProposalVersion: z.coerce.number().int().positive(),
  expectedExperimentVersion: z.coerce.number().int().positive(),
  metricKey: text(1, 500),
  value: text(1, 240),
  unit: text(1, 80),
  windowStart: isoDate,
  windowEnd: isoDate,
  sourceAuthority: z.enum(["internal_observation", "manual_attestation", "provider_receipt", "reconciled"]),
  externalReference: z.string().trim().max(1000).default(""),
  evidenceIds,
}).superRefine((value, context) => {
  if (value.windowEnd < value.windowStart) context.addIssue({ code: z.ZodIssueCode.custom, path: ["windowEnd"], message: "Observation window end cannot precede its start." });
  if (["provider_receipt", "reconciled"].includes(value.sourceAuthority) && value.externalReference.trim().length < 3)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["externalReference"], message: "Provider-backed observations require an external reference." });
}));

export const productExperimentConclusionSchema = rejectsSecrets(z.object({
  expectedProposalVersion: z.coerce.number().int().positive(),
  expectedVersion: z.coerce.number().int().positive(),
  result: z.enum(productExperimentResults),
  conclusion: text(20, 5000),
  evidenceIds,
}));

export const productReleaseDecisionSchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  decision: z.enum(productReleaseDecisions),
  rationale: text(20, 5000),
  evidenceIds,
}));

export const productRolloutStartSchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  initialStage: z.enum(productRolloutStages).default("internal"),
  allocationPercent: z.coerce.number().int().min(1).max(100),
  rollbackThreshold: text(10, 2000),
  evidenceIds,
}));

export const productRolloutAdvanceSchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  stage: z.enum(productRolloutStages),
  allocationPercent: z.coerce.number().int().min(1).max(100),
  externalReference: text(3, 1000),
  receiptEvidenceId: id,
  note: text(20, 3000),
}));

export const productRolloutRollbackSchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  rationale: text(20, 5000),
  evidenceIds,
}));

export const productApplySchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  evidenceIds,
  rationale: text(20, 5000),
}));

export function nextRolloutStage(stage: (typeof productRolloutStages)[number]) {
  const index = productRolloutStages.indexOf(stage);
  return index < productRolloutStages.length - 1 ? productRolloutStages[index + 1] : null;
}
