import { z } from "zod";

export const complianceSourceTypes = [
  "statute",
  "regulation",
  "contract",
  "internal_policy",
  "standard",
  "professional_guidance",
  "consent_notice",
  "other",
] as const;

export const complianceRequirementTypes = [
  "obligation",
  "right",
  "consent",
  "policy",
  "retention_rule",
  "control",
] as const;

export const complianceReviewKinds = [
  "applicability",
  "periodic_review",
  "control_test",
  "closure",
] as const;

export const complianceReviewOutcomes = [
  "applicable",
  "not_applicable",
  "needs_revision",
  "effective",
  "ineffective",
  "inconclusive",
  "satisfied",
  "breached",
] as const;

export const complianceReviewAuthorities = [
  "qualified_counsel",
  "privacy_professional",
  "internal_compliance",
  "business_owner",
] as const;

const classification = z.enum(["public", "internal", "confidential", "restricted"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date (YYYY-MM-DD).");
const text = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);
const optionalDate = z.union([isoDate, z.literal("")]).optional();

const rejectsCredentialMaterial = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine((value, context) => {
    const serialized = JSON.stringify(value);
    if (/(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|sk_(?:live|test)_[A-Za-z0-9]+|gh[pousr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|client_secret\s*[:=])/i.test(serialized)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Store only an external managed-secret, engagement, or credential reference; credential material is prohibited." });
    }
  });

export const complianceSourceDraftSchema = rejectsCredentialMaterial(z.object({
  sourceKey: text(2, 120).regex(/^[a-z0-9][a-z0-9._-]*$/i),
  versionLabel: text(1, 80),
  title: text(3, 240),
  sourceType: z.enum(complianceSourceTypes),
  authoritySystem: text(2, 160),
  authoritativeReference: text(4, 2000),
  jurisdictionRegime: text(2, 500),
  summary: text(20, 5000),
  effectiveFrom: isoDate,
  effectiveUntil: optionalDate,
  reviewedThrough: isoDate,
  nextReviewAt: isoDate,
  classification: classification.default("confidential"),
}).superRefine((value, context) => {
  if (value.effectiveUntil && value.effectiveUntil <= value.effectiveFrom)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["effectiveUntil"], message: "Effective until must be after effective from." });
  if (value.reviewedThrough < value.effectiveFrom)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["reviewedThrough"], message: "Reviewed through cannot precede the effective date." });
  if (value.nextReviewAt <= value.reviewedThrough)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["nextReviewAt"], message: "Next review must be after the reviewed-through date." });
}));

export const complianceSourceVerificationSchema = rejectsCredentialMaterial(z.object({
  expectedContentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  reviewEvidenceId: z.string().uuid(),
  reviewAuthority: z.enum(complianceReviewAuthorities),
  reviewerName: text(2, 200),
  reviewerOrganization: text(2, 240),
  reviewerCredentialReference: text(5, 500),
  limitations: text(20, 3000),
}));

export const complianceSourceSupersessionSchema = z.object({
  expectedContentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  reason: text(20, 2000),
});

export const complianceRequirementSchema = rejectsCredentialMaterial(z.object({
  requirementKey: text(2, 120).regex(/^[a-z0-9][a-z0-9._-]*$/i),
  requirementType: z.enum(complianceRequirementTypes),
  sourceVersionId: z.string().uuid(),
  expectedSourceSha256: z.string().regex(/^[0-9a-f]{64}$/),
  title: text(3, 240),
  description: text(20, 5000),
  ownerSeatId: z.string().uuid(),
  subjectScope: text(3, 2000),
  sourceRequirement: text(3, 2000),
  jurisdictionRegime: text(2, 500),
  processingPurpose: z.string().trim().max(2000).default(""),
  legalBasisClaim: z.string().trim().max(2000).default(""),
  retentionTrigger: z.string().trim().max(1000).default(""),
  retentionPeriod: z.string().trim().max(1000).default(""),
  dispositionMethod: z.string().trim().max(1000).default(""),
  dueReviewAt: isoDate,
  classification: classification.default("confidential"),
}).superRefine((value, context) => {
  if (value.requirementType === "consent" && !value.processingPurpose)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["processingPurpose"], message: "Consent records require a bounded processing purpose." });
  if (value.requirementType === "retention_rule" && (!value.retentionTrigger || !value.retentionPeriod || !value.dispositionMethod))
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["retentionPeriod"], message: "Retention rules require a trigger, period, and disposition method." });
}));

export const complianceReviewSchema = rejectsCredentialMaterial(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  expectedSourceSha256: z.string().regex(/^[0-9a-f]{64}$/),
  reviewKind: z.enum(complianceReviewKinds),
  outcome: z.enum(complianceReviewOutcomes),
  reviewEvidenceId: z.string().uuid(),
  reviewAuthority: z.enum(complianceReviewAuthorities),
  reviewerName: text(2, 200),
  reviewerOrganization: text(2, 240),
  reviewerCredentialReference: text(5, 500),
  factsConsidered: text(20, 5000),
  rationale: text(20, 5000),
  nextReviewAt: optionalDate,
}).superRefine((value, context) => {
  if (["applicable", "effective", "inconclusive"].includes(value.outcome) && !value.nextReviewAt)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["nextReviewAt"], message: "An active or inconclusive result requires a next review date." });
  if (value.reviewKind === "control_test" && !["effective", "ineffective", "inconclusive"].includes(value.outcome))
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["outcome"], message: "Control tests must record effective, ineffective, or inconclusive." });
  if (value.reviewKind === "closure" && !["satisfied", "not_applicable"].includes(value.outcome))
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["outcome"], message: "Closure must record satisfied or not applicable." });
}));

export type ComplianceReviewOutcome = (typeof complianceReviewOutcomes)[number];

export function complianceStateForOutcome(outcome: ComplianceReviewOutcome) {
  return ({
    applicable: "applicable_active",
    not_applicable: "superseded",
    needs_revision: "under_assessment",
    effective: "monitoring",
    ineffective: "remediating",
    inconclusive: "under_assessment",
    satisfied: "satisfied_closed",
    breached: "overdue_breached",
  } as const)[outcome];
}
