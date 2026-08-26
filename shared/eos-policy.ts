import { z } from "zod";
import {
  authorityClasses,
  authorityGrantCoversResource,
  type AuthorityClass,
  type AuthorityGrantCandidate,
} from "./eos-runtime";

export const policyDataClassifications = ["public", "internal", "confidential", "restricted", "highly_restricted", "contextual"] as const;
export type PolicyDataClassification = typeof policyDataClassifications[number];

export const policyConsequences = ["routine", "material", "irreversible", "emergency"] as const;
export type PolicyConsequence = typeof policyConsequences[number];

export const policyFieldTransformActions = ["omit", "redact", "mask_last4"] as const;
export type PolicyFieldTransformAction = typeof policyFieldTransformActions[number];

export const policyFieldDescriptorSchema = z.object({
  path: z.string().trim().regex(/^\/(?:[^/~]|~[01])+(?:\/(?:[^/~]|~[01])*)*$/, "Use a non-root JSON Pointer path."),
  classification: z.enum(policyDataClassifications).exclude(["contextual"]),
  dataClasses: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
});

export const policyFieldTransformRuleSchema = z.object({
  path: z.string().trim().regex(/^\/(?:[^/~]|~[01])+(?:\/(?:[^/~]|~[01])*)*$/, "Use a non-root JSON Pointer path."),
  action: z.enum(policyFieldTransformActions),
  purposes: z.array(z.string().trim().min(1).max(300)).min(1).max(100),
  outputClassification: z.enum(policyDataClassifications).exclude(["contextual"]).default("internal"),
});

// Higher-order disclosure policy for the organization registry. Credential
// references are write-only; lower-ceiling seats receive progressively smaller
// read models without changing the canonical record.
export const organizationRegistryFieldTransformRules = policyFieldTransformRuleSchema.array().parse([
  { path: "/authoritySubjects", action: "omit", purposes: ["administer_organization_registry"], outputClassification: "public" },
  { path: "/authoritySubjects/*/identityAttributes/credentialReference", action: "omit", purposes: ["administer_organization_registry"], outputClassification: "public" },
  { path: "/authoritySubjects/*/externalIdentityKey", action: "redact", purposes: ["administer_organization_registry"], outputClassification: "public" },
  { path: "/authoritySubjects/*/evidenceReferences", action: "omit", purposes: ["administer_organization_registry"], outputClassification: "public" },
  { path: "/authoritySubjects/*/governanceContract", action: "omit", purposes: ["administer_organization_registry"], outputClassification: "public" },
  { path: "/authoritySubjects/*/identityAttributes/memoryScope", action: "omit", purposes: ["administer_organization_registry"], outputClassification: "public" },
  { path: "/authoritySubjects/*/identityAttributes/memberPrincipalIds", action: "omit", purposes: ["administer_organization_registry"], outputClassification: "public" },
  { path: "/authoritySubjects/*/identityAttributes/externalAccountReference", action: "redact", purposes: ["administer_organization_registry"], outputClassification: "public" },
  { path: "/authoritySubjects/*/identityAttributes/providerSystemKeys", action: "omit", purposes: ["administer_organization_registry"], outputClassification: "public" },
]);

export const authorityCeilingSchema = z.object({
  classification: z.enum(policyDataClassifications).optional(),
  maxAmount: z.number().nonnegative().optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
  maxRecords: z.number().int().nonnegative().optional(),
  consequence: z.enum(policyConsequences).optional(),
  allowedDataClasses: z.array(z.string().trim().min(1).max(160)).max(100).optional(),
  fieldTransformRules: z.array(policyFieldTransformRuleSchema).max(500).optional(),
}).passthrough();

export const policyConditionRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("purpose_in"), values: z.array(z.string().trim().min(1).max(160)).min(1).max(100) }),
  z.object({ type: z.literal("provider_in"), values: z.array(z.string().trim().min(1).max(160)).min(1).max(100) }),
  z.object({ type: z.literal("tool_in"), values: z.array(z.string().trim().min(1).max(160)).min(1).max(100) }),
  z.object({ type: z.literal("target_seat_in"), values: z.array(z.string().uuid()).min(1).max(100) }),
  z.object({ type: z.literal("data_class_in"), values: z.array(z.string().trim().min(1).max(160)).min(1).max(100) }),
  z.object({ type: z.literal("evidence_minimum"), count: z.number().int().min(1).max(100) }),
  z.object({ type: z.literal("utc_time_window"), startHour: z.number().int().min(0).max(23), endHour: z.number().int().min(1).max(24), days: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 1, 2, 3, 4, 5, 6]) }),
]);

export const authorityApprovalPolicySchema = z.object({
  minimumApprovals: z.number().int().min(0).max(20).default(0),
  approverSeatIds: z.array(z.string().uuid()).max(100).default([]),
  approverAuthorityClasses: z.array(z.enum(authorityClasses)).max(authorityClasses.length).default(["approve"]),
  disallowRequester: z.boolean().default(true),
  requireDistinctPrincipals: z.boolean().default(true),
  requireDistinctSeats: z.boolean().default(false),
}).default({});

const dutyParticipantKinds = ["initiator", "approver", "executor", "reconciler", "verifier"] as const;

export const separationOfDutiesRuleSchema = z.object({
  authorityClass: z.enum(authorityClasses),
  distinctFrom: z.array(z.enum(dutyParticipantKinds)).min(1).max(dutyParticipantKinds.length),
  requireDistinctSeat: z.boolean().default(false),
});

export const policyApprovalEvidenceSchema = z.object({
  approvalId: z.string().min(1).max(200),
  decision: z.literal("approved"),
  approverPrincipalKey: z.string().min(1).max(200),
  approverSeatId: z.string().uuid(),
  authorityClasses: z.array(z.enum(authorityClasses)).default(["approve"]),
  decidedAt: z.string().datetime(),
});

const participantSchema = z.object({
  principalKey: z.string().min(1).max(200),
  seatId: z.string().uuid(),
});

export const policyActionContextSchema = z.object({
  authorityClass: z.enum(authorityClasses),
  resource: z.string().trim().min(1).max(160),
  actionKey: z.string().trim().min(1).max(200).optional(),
  purpose: z.string().trim().min(1).max(300),
  classification: z.enum(policyDataClassifications).default("internal"),
  consequence: z.enum(policyConsequences).default("routine"),
  amount: z.number().nonnegative().optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
  recordCount: z.number().int().nonnegative().optional(),
  dataClasses: z.array(z.string().trim().min(1).max(160)).max(100).default([]),
  fieldInventoryComplete: z.boolean().default(false),
  fields: z.array(policyFieldDescriptorSchema).max(500).default([]),
  providerKey: z.string().trim().min(1).max(160).optional(),
  toolKey: z.string().trim().min(1).max(160).optional(),
  targetSeatId: z.string().uuid().optional(),
  evidenceReferences: z.array(z.string().min(1).max(2000)).max(100).default([]),
  approvals: z.array(policyApprovalEvidenceSchema).max(100).default([]),
  participants: z.object({
    initiator: participantSchema.optional(),
    approver: participantSchema.optional(),
    executor: participantSchema.optional(),
    reconciler: participantSchema.optional(),
    verifier: participantSchema.optional(),
  }).default({}),
});

export type PolicyActionContext = z.infer<typeof policyActionContextSchema>;
export type PolicyDecisionOutcome = "permit" | "deny" | "require_approval" | "require_evidence" | "transform_minimize" | "escalate";

export interface PolicyGrantCandidate extends AuthorityGrantCandidate {
  effect?: unknown;
  actionResourceScope?: unknown;
  ceilingThreshold?: unknown;
  conditionRules?: unknown;
  approvalPolicy?: unknown;
  separationOfDuties?: unknown;
  reviewAt?: Date | string | null;
  toolEntitlements: unknown;
}

export interface PolicyDecisionResult {
  outcome: PolicyDecisionOutcome;
  reasonCodes: string[];
  matchedGrantIds: string[];
  satisfiedGrantId?: string;
  requirements: { approvals: number; evidence: number; review: boolean; transforms: PolicyFieldTransform[] };
}

export interface PolicyFieldTransform {
  path: string;
  action: PolicyFieldTransformAction;
  outputClassification: Exclude<PolicyDataClassification, "contextual">;
}

const classificationRank: Record<PolicyDataClassification, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
  highly_restricted: 4,
  contextual: 5,
};

const consequenceRank: Record<PolicyConsequence, number> = { routine: 0, material: 1, irreversible: 2, emergency: 3 };

const noRequirements = (): PolicyDecisionResult["requirements"] => ({ approvals: 0, evidence: 0, review: false, transforms: [] });

function fieldTransformationFor(
  ceiling: z.infer<typeof authorityCeilingSchema>,
  action: PolicyActionContext,
): { transforms: PolicyFieldTransform[]; failure?: string } {
  const classificationExceeded = Boolean(ceiling.classification && classificationRank[action.classification] > classificationRank[ceiling.classification]);
  const disallowedData = Boolean(ceiling.allowedDataClasses?.length && action.dataClasses.some((item) => !ceiling.allowedDataClasses?.includes(item)));
  if (!classificationExceeded && !disallowedData) return { transforms: [] };
  if (action.authorityClass !== "view") return { transforms: [], failure: classificationExceeded ? "classification_ceiling_exceeded" : "data_class_ceiling_exceeded" };
  if (!action.fieldInventoryComplete || !action.fields.length) return { transforms: [], failure: "complete_field_inventory_required" };
  const inventoryDataClasses = new Set(action.fields.flatMap((field) => field.dataClasses));
  const inventoryClassification = Math.max(...action.fields.map((field) => classificationRank[field.classification]));
  if (action.dataClasses.some((dataClass) => !inventoryDataClasses.has(dataClass)) || inventoryClassification !== classificationRank[action.classification]) {
    return { transforms: [], failure: "field_inventory_classification_mismatch" };
  }

  const fieldsNeedingTransformation = action.fields.filter((field) => {
    const overClassification = Boolean(ceiling.classification && classificationRank[field.classification] > classificationRank[ceiling.classification]);
    const outsideDataClass = Boolean(ceiling.allowedDataClasses?.length && field.dataClasses.some((item) => !ceiling.allowedDataClasses?.includes(item)));
    return overClassification || outsideDataClass;
  });
  if (!fieldsNeedingTransformation.length) return { transforms: [], failure: "field_inventory_classification_mismatch" };

  const transforms: PolicyFieldTransform[] = [];
  for (const field of fieldsNeedingTransformation) {
    const rule = ceiling.fieldTransformRules?.find((candidate) => candidate.path === field.path && (candidate.purposes.includes(action.purpose) || candidate.purposes.includes("*")));
    if (!rule) return { transforms: [], failure: "field_transform_policy_missing" };
    if (ceiling.classification && classificationRank[rule.outputClassification] > classificationRank[ceiling.classification]) return { transforms: [], failure: "field_transform_output_exceeds_ceiling" };
    transforms.push({ path: rule.path, action: rule.action, outputClassification: rule.outputClassification });
  }
  return { transforms };
}

function pointerSegments(path: string): string[] {
  return path.slice(1).split("/").map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function applyTransformAt(parent: any, key: string, action: PolicyFieldTransformAction): void {
  if (!parent || typeof parent !== "object" || !(key in parent)) return;
  if (action === "omit") {
    if (Array.isArray(parent) && /^\d+$/.test(key)) parent[Number(key)] = null;
    else delete parent[key];
  } else if (action === "redact") {
    parent[key] = "[REDACTED]";
  } else {
    const value = parent[key];
    parent[key] = typeof value === "string" && value.length >= 4 ? `••••${value.slice(-4)}` : "••••";
  }
}

function applyTransformPath(node: any, segments: readonly string[], action: PolicyFieldTransformAction): void {
  if (!node || typeof node !== "object" || !segments.length) return;
  const [head, ...rest] = segments;
  if (head === "*") {
    for (const key of Object.keys(node)) {
      if (rest.length) applyTransformPath(node[key], rest, action);
      else applyTransformAt(node, key, action);
    }
    return;
  }
  if (!rest.length) applyTransformAt(node, head, action);
  else if (head in node) applyTransformPath(node[head], rest, action);
}

export function applyFieldTransformations<T>(record: T, transforms: readonly PolicyFieldTransform[]): T {
  const projected = structuredClone(record);
  for (const transform of transforms) {
    const segments = pointerSegments(transform.path);
    if (segments.some((segment) => ["__proto__", "prototype", "constructor"].includes(segment))) continue;
    applyTransformPath(projected, segments, transform.action);
  }
  return projected;
}

function addressedTo(grant: PolicyGrantCandidate, principalKey: string, seatId: string, subjectId?: string): boolean {
  return (grant.granteeType === "seat" && grant.granteeKey === seatId)
    || (grant.granteeType === "principal" && grant.granteeKey === principalKey && (!grant.seatId || grant.seatId === seatId))
    || (Boolean(subjectId) && grant.granteeSubjectId === subjectId && !["seat", "principal"].includes(grant.granteeType));
}

function actionScopeMatches(grant: PolicyGrantCandidate, action: PolicyActionContext, seatId: string): boolean {
  if (!authorityGrantCoversResource(grant, action.resource, seatId)) return false;
  if (!grant.actionResourceScope || typeof grant.actionResourceScope !== "object" || Array.isArray(grant.actionResourceScope)) return false;
  const scope = grant.actionResourceScope as Record<string, unknown>;
  const actions = Array.isArray(scope.actions) ? scope.actions : scope.action ? [scope.action] : [];
  return !actions.length || Boolean(action.actionKey && actions.some((candidate) => candidate === "*" || candidate === action.actionKey));
}

function grantScopeSpecificity(
  grant: PolicyGrantCandidate,
  action: PolicyActionContext,
): number {
  const scope = grant.actionResourceScope as Record<string, unknown>;
  const resources = Array.isArray(scope.resources)
    ? scope.resources
    : [scope.resource];
  const actions = Array.isArray(scope.actions)
    ? scope.actions
    : scope.action
      ? [scope.action]
      : [];
  return (
    (resources.includes(action.resource) ? 16 : 0) +
    (Boolean(action.actionKey && actions.includes(action.actionKey)) ? 8 : 0) +
    (scope.seatId ? 4 : 0) +
    (grant.granteeType === "principal" || grant.granteeSubjectId ? 2 : 0)
  );
}

function evaluateConditions(rules: z.infer<typeof policyConditionRuleSchema>[], action: PolicyActionContext, now: Date): { failures: string[]; evidenceMinimum: number } {
  const failures: string[] = [];
  let evidenceMinimum = 0;
  for (const rule of rules) {
    if (rule.type === "purpose_in" && !rule.values.includes(action.purpose)) failures.push("purpose_not_allowed");
    if (rule.type === "provider_in" && (!action.providerKey || !rule.values.includes(action.providerKey))) failures.push("provider_not_allowed");
    if (rule.type === "tool_in" && (!action.toolKey || !rule.values.includes(action.toolKey))) failures.push("tool_not_allowed");
    if (rule.type === "target_seat_in" && (!action.targetSeatId || !rule.values.includes(action.targetSeatId))) failures.push("target_seat_not_allowed");
    if (rule.type === "data_class_in" && action.dataClasses.some((item) => !rule.values.includes(item))) failures.push("data_class_not_allowed");
    if (rule.type === "evidence_minimum") evidenceMinimum = Math.max(evidenceMinimum, rule.count);
    if (rule.type === "utc_time_window" && (rule.startHour >= rule.endHour || !rule.days.includes(now.getUTCDay()) || now.getUTCHours() < rule.startHour || now.getUTCHours() >= rule.endHour)) failures.push("outside_time_window");
  }
  return { failures: Array.from(new Set(failures)), evidenceMinimum };
}

function approvalCount(policy: z.infer<typeof authorityApprovalPolicySchema>, action: PolicyActionContext, principalKey: string): number {
  const eligible = action.approvals.filter((approval) => {
    if (policy.disallowRequester && approval.approverPrincipalKey === principalKey) return false;
    if (policy.approverSeatIds.length && !policy.approverSeatIds.includes(approval.approverSeatId)) return false;
    if (policy.approverAuthorityClasses.length && !policy.approverAuthorityClasses.some((authorityClass) => approval.authorityClasses.includes(authorityClass))) return false;
    return true;
  });
  if (policy.requireDistinctPrincipals && new Set(eligible.map((item) => item.approverPrincipalKey)).size !== eligible.length) return new Set(eligible.map((item) => item.approverPrincipalKey)).size;
  if (policy.requireDistinctSeats && new Set(eligible.map((item) => item.approverSeatId)).size !== eligible.length) return new Set(eligible.map((item) => item.approverSeatId)).size;
  return eligible.length;
}

function dutyViolations(rules: z.infer<typeof separationOfDutiesRuleSchema>[], action: PolicyActionContext, principalKey: string, seatId: string): string[] {
  const violations: string[] = [];
  for (const rule of rules) {
    if (rule.authorityClass !== action.authorityClass) continue;
    for (const duty of rule.distinctFrom) {
      const participant = action.participants[duty];
      if (!participant) continue;
      if (participant.principalKey === principalKey || (rule.requireDistinctSeat && participant.seatId === seatId)) violations.push(`separation_of_duties_${duty}`);
    }
  }
  return violations;
}

export function evaluatePolicyDecision(input: {
  grants: readonly PolicyGrantCandidate[];
  principalKey: string;
  seatId: string;
  subjectId?: string;
  action: PolicyActionContext;
  now?: Date;
}): PolicyDecisionResult {
  const now = input.now || new Date();
  const action = policyActionContextSchema.parse(input.action);
  if (action.classification === "contextual") return { outcome: "escalate", reasonCodes: ["classification_unresolved"], matchedGrantIds: [], requirements: noRequirements() };

  const addressed = input.grants.filter((grant) => addressedTo(grant, input.principalKey, input.seatId, input.subjectId));
  const classScoped = addressed.filter((grant) => Array.isArray(grant.authorityClasses)
    && grant.authorityClasses.includes(action.authorityClass)
    && actionScopeMatches(grant, action, input.seatId));
  const matchedGrantIds = classScoped.map((grant) => grant.id);
  if (!classScoped.length) return { outcome: "deny", reasonCodes: ["no_explicit_grant"], matchedGrantIds, requirements: noRequirements() };

  const active = classScoped.filter((grant) => {
    const from = new Date(grant.effectiveFrom).getTime();
    const until = grant.effectiveUntil ? new Date(grant.effectiveUntil).getTime() : Number.POSITIVE_INFINITY;
    return grant.state === "active" && from <= now.getTime() && until > now.getTime();
  });
  if (!active.length) return { outcome: "deny", reasonCodes: ["grant_inactive_or_expired"], matchedGrantIds, requirements: noRequirements() };
  if (active.some((grant) => grant.effect === "deny")) return { outcome: "deny", reasonCodes: ["explicit_deny"], matchedGrantIds, requirements: noRequirements() };

  // A narrow active grant must not be bypassed by a broader wildcard grant.
  // Explicit denies remain organization-wide across every matching scope.
  const activeAllows = active.filter((grant) => grant.effect !== "deny");
  const maximumSpecificity = Math.max(
    ...activeAllows.map((grant) => grantScopeSpecificity(grant, action)),
  );
  const applicableAllows = activeAllows.filter(
    (grant) => grantScopeSpecificity(grant, action) === maximumSpecificity,
  );

  const unmetApprovalCounts: number[] = [];
  const unmetEvidenceCounts: number[] = [];
  const failureCodes: string[] = [];
  let reviewRequired = false;
  let transformationCandidate: { grantId: string; transforms: PolicyFieldTransform[] } | null = null;

  for (const grant of applicableAllows) {
    if (grant.reviewAt && new Date(grant.reviewAt).getTime() <= now.getTime()) {
      reviewRequired = true;
      failureCodes.push("grant_review_overdue");
      continue;
    }
    const ceiling = authorityCeilingSchema.safeParse(grant.ceilingThreshold || {});
    if (!ceiling.success) { failureCodes.push("invalid_ceiling_policy"); continue; }
    const fieldTransformation = fieldTransformationFor(ceiling.data, action);
    if (fieldTransformation.failure) { failureCodes.push(fieldTransformation.failure); continue; }
    if (ceiling.data.maxAmount !== undefined && (action.amount === undefined || action.amount > ceiling.data.maxAmount)) { failureCodes.push("financial_ceiling_exceeded"); continue; }
    if (ceiling.data.currency && action.currency !== ceiling.data.currency) { failureCodes.push("currency_not_allowed"); continue; }
    if (ceiling.data.maxRecords !== undefined && (action.recordCount === undefined || action.recordCount > ceiling.data.maxRecords)) { failureCodes.push("record_ceiling_exceeded"); continue; }
    if (ceiling.data.consequence && consequenceRank[action.consequence] > consequenceRank[ceiling.data.consequence]) { failureCodes.push("consequence_ceiling_exceeded"); continue; }
    if (action.toolKey && Array.isArray(grant.toolEntitlements) && grant.toolEntitlements.length && !grant.toolEntitlements.includes(action.toolKey)) { failureCodes.push("tool_not_entitled"); continue; }

    const parsedConditions = z.array(policyConditionRuleSchema).safeParse(grant.conditionRules || []);
    if (!parsedConditions.success) { failureCodes.push("invalid_condition_policy"); continue; }
    const conditionResult = evaluateConditions(parsedConditions.data, action, now);
    if (conditionResult.failures.length) { failureCodes.push(...conditionResult.failures); continue; }
    if (conditionResult.evidenceMinimum > action.evidenceReferences.length) {
      unmetEvidenceCounts.push(conditionResult.evidenceMinimum - action.evidenceReferences.length);
      continue;
    }

    const parsedDuties = z.array(separationOfDutiesRuleSchema).safeParse(grant.separationOfDuties || []);
    if (!parsedDuties.success) { failureCodes.push("invalid_separation_policy"); continue; }
    const violations = dutyViolations(parsedDuties.data, action, input.principalKey, input.seatId);
    if (violations.length) { failureCodes.push(...violations); continue; }

    const parsedApproval = authorityApprovalPolicySchema.safeParse(grant.approvalPolicy || {});
    if (!parsedApproval.success) { failureCodes.push("invalid_approval_policy"); continue; }
    const approvals = approvalCount(parsedApproval.data, action, input.principalKey);
    if (approvals < parsedApproval.data.minimumApprovals) {
      unmetApprovalCounts.push(parsedApproval.data.minimumApprovals - approvals);
      continue;
    }
    if (fieldTransformation.transforms.length) {
      transformationCandidate ||= { grantId: grant.id, transforms: fieldTransformation.transforms };
      continue;
    }
    return { outcome: "permit", reasonCodes: ["explicit_grant_satisfied"], matchedGrantIds, satisfiedGrantId: grant.id, requirements: noRequirements() };
  }

  if (transformationCandidate) return { outcome: "transform_minimize", reasonCodes: ["field_minimization_required"], matchedGrantIds, satisfiedGrantId: transformationCandidate.grantId, requirements: { ...noRequirements(), transforms: transformationCandidate.transforms } };
  if (unmetEvidenceCounts.length) return { outcome: "require_evidence", reasonCodes: ["policy_evidence_required"], matchedGrantIds, requirements: { ...noRequirements(), evidence: Math.min(...unmetEvidenceCounts), review: reviewRequired } };
  if (unmetApprovalCounts.length) return { outcome: "require_approval", reasonCodes: ["policy_approval_required"], matchedGrantIds, requirements: { ...noRequirements(), approvals: Math.min(...unmetApprovalCounts), review: reviewRequired } };
  if (reviewRequired) return { outcome: "escalate", reasonCodes: ["grant_review_overdue"], matchedGrantIds, requirements: { ...noRequirements(), review: true } };
  return { outcome: "deny", reasonCodes: Array.from(new Set(failureCodes.length ? failureCodes : ["policy_conditions_unsatisfied"])), matchedGrantIds, requirements: noRequirements() };
}
