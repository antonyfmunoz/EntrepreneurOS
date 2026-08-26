import { z } from "zod";
import { recoveryProviderExecutionSchemas } from "./recovery-provider-executions";

export const manifestInputSchema = z.object({
  purpose: z.string().min(3).max(500),
  stage: z.string().min(1).max(100),
  offer: z.string().min(1).max(500),
  targetCustomer: z.string().min(1).max(500),
  goals: z.array(z.string().min(1).max(300)).min(1).max(12),
  enabledModules: z.array(z.number().int().min(1).max(17)).min(1),
  ownerSeat: z.object({
    title: z.string().min(1).max(120),
    authority: z.enum(["owner", "executive", "operator"]),
  }),
  operatingCadence: z.enum(["weekly", "biweekly", "monthly"]),
  founderProfile: z
    .object({
      vision: z.string().max(2000).default(""),
      values: z.string().max(1200).default(""),
      decisionStyle: z.string().max(1200).default(""),
      workingStyle: z.string().max(1200).default(""),
    })
    .default({ vision: "", values: "", decisionStyle: "", workingStyle: "" }),
  sourceAssertions: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        value: z.string().min(1).max(2000),
        sourceType: z.enum([
          "source_fact",
          "source_claim",
          "eos_inference",
          "user_assertion",
        ]),
        sourceUri: z.string().url().max(2000).optional(),
      }),
    )
    .max(100)
    .default([]),
  assumptions: z.array(z.string().min(1).max(1000)).max(50).default([]),
  unknowns: z.array(z.string().min(1).max(1000)).max(50).default([]),
  packageSelections: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        version: z.string().min(1).max(50),
        rationale: z.string().max(1000).default(""),
      }),
    )
    .max(50)
    .default([]),
  provisioningChecklist: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        label: z.string().min(1).max(300),
        required: z.boolean().default(true),
        complete: z.boolean().default(false),
      }),
    )
    .max(100)
    .default([]),
  verificationChecks: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        label: z.string().min(1).max(300),
        status: z.enum(["pending", "passed", "failed"]),
        evidence: z.string().max(2000).optional(),
      }),
    )
    .max(100)
    .default([]),
});

export type ManifestInput = z.infer<typeof manifestInputSchema>;

export const workPacketCreateSchema = z.object({
  title: z.string().min(3).max(200),
  objective: z.string().min(3).max(2000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueAt: z.string().datetime().optional(),
  requiresApproval: z.boolean().default(false),
  toolPack: z.array(z.string().min(1).max(100)).max(20).default([]),
  evidenceRequirements: z.array(z.string().min(1).max(300)).max(20).default([]),
  source: z
    .enum(["manual", "compiler", "integration", "umh"])
    .default("manual"),
  accountableSeatId: z.string().uuid().optional(),
  visibility: z.enum(["company", "reporting_tree", "seat"]).default("company"),
  classification: z
    .enum(["public", "internal", "confidential", "restricted"])
    .default("internal"),
  capabilityInstanceId: z.string().uuid().optional(),
  processDefinitionId: z.string().uuid().optional(),
  resourceIds: z.array(z.string().uuid()).max(100).default([]),
  expectedOutput: z.string().trim().max(3000).default(""),
  acceptanceCriteria: z.string().trim().max(3000).default(""),
  constraintsPolicies: z.string().trim().max(3000).default(""),
  failureEscalationCompensation: z.string().trim().max(3000).default(""),
  humanFallback: z.string().trim().max(3000).default(""),
  sourceLineage: z.string().trim().max(3000).default(""),
  outputArtifactKeys: z
    .array(z.string().trim().min(1).max(1000))
    .max(200)
    .default([]),
});

export const objectiveRecordTypes = [
  "objective",
  "constraint",
  "mandate",
  "hypothesis",
  "success_condition",
  "guardrail",
] as const;
export const objectiveStates = [
  "proposed",
  "active",
  "at_risk",
  "blocked",
  "achieved",
  "failed",
  "superseded",
  "archived",
] as const;
export const metricOutcomeRecordTypes = [
  "metric_definition",
  "measurement",
  "target",
  "forecast",
  "benchmark",
  "outcome",
  "impact",
] as const;
export const metricOutcomeStates = [
  "proposed",
  "defined",
  "active",
  "under_review",
  "verified",
  "contested",
  "superseded",
  "retired",
] as const;
export const riskControlRecordTypes = [
  "risk",
  "obligation",
  "control",
  "incident",
  "finding",
  "remediation",
  "insurance_transfer",
] as const;
export const riskControlStates = [
  "identified",
  "under_assessment",
  "applicable_active",
  "assigned",
  "treating_in_progress",
  "monitoring",
  "accepted",
  "overdue_breached",
  "remediating",
  "satisfied_closed",
  "superseded",
] as const;

const commandRecordBase = z.object({
  title: z.string().trim().min(3).max(240),
  ownerSeatId: z.string().uuid().optional(),
  classification: z
    .enum(["public", "internal", "confidential", "restricted"])
    .default("internal"),
  sourceAuthority: z
    .enum([
      "native_eos",
      "notion_runtime",
      "external_authoritative",
      "reconciled",
    ])
    .default("native_eos"),
});

export const objectiveCreateSchema = commandRecordBase.extend({
  recordType: z.enum(objectiveRecordTypes).default("objective"),
  statement: z.string().trim().min(3).max(4000),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  parentObjectiveId: z.string().uuid().optional(),
  scopeBoundary: z.string().trim().max(2000).default(""),
  rationaleTheory: z.string().trim().max(4000).default(""),
  successExitCriteria: z.string().trim().max(4000).default(""),
  timeHorizon: z.string().trim().max(500).default(""),
  workPacketIds: z.array(z.string().uuid()).max(500).default([]),
  metricIds: z.array(z.string().uuid()).max(500).default([]),
  evidenceIds: z.array(z.string().uuid()).max(500).default([]),
  decisionPolicyKeys: z
    .array(z.string().trim().min(1).max(300))
    .max(500)
    .default([]),
  targetReviewAt: z.string().datetime().optional(),
});

export const objectiveUpdateSchema = objectiveCreateSchema
  .omit({ sourceAuthority: true })
  .partial()
  .extend({
    state: z.enum(objectiveStates).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one objective field is required.",
  );

const metricOutcomeCreateBaseSchema = commandRecordBase.extend({
  recordType: z.enum(metricOutcomeRecordTypes).default("metric_definition"),
  objectiveId: z.string().uuid().optional(),
  subjectType: z.string().trim().min(1).max(160).default("organization"),
  subjectKey: z.string().trim().max(300).default(""),
  definitionFormula: z.string().trim().max(4000).default(""),
  unitCurrency: z.string().trim().max(100).default(""),
  thresholdDirection: z.string().trim().max(500).default(""),
  targetValue: z.number().finite().optional(),
  actualValue: z.number().finite().optional(),
  forecastValue: z.number().finite().optional(),
  timeGrainPeriod: z.string().trim().max(500).default(""),
  verifierConfidence: z.string().trim().max(1000).default(""),
  attributionLimitations: z.string().trim().max(4000).default(""),
  evidenceIds: z.array(z.string().uuid()).max(500).default([]),
  notes: z.string().trim().max(4000).default(""),
  asOf: z.string().datetime().optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
});
export const metricOutcomeCreateSchema = metricOutcomeCreateBaseSchema.refine(
  (value) =>
    !value.validUntil || !value.validFrom || value.validUntil > value.validFrom,
  { message: "Valid until must be after valid from.", path: ["validUntil"] },
);

export const metricOutcomeUpdateSchema = metricOutcomeCreateBaseSchema
  .omit({ sourceAuthority: true })
  .partial()
  .extend({
    state: z.enum(metricOutcomeStates).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one metric or outcome field is required.",
  )
  .refine(
    (value) =>
      !value.validUntil ||
      !value.validFrom ||
      value.validUntil > value.validFrom,
    { message: "Valid until must be after valid from.", path: ["validUntil"] },
  );

const riskControlCreateBaseSchema = commandRecordBase.extend({
  recordType: z.enum(riskControlRecordTypes).default("risk"),
  descriptionCauseEventImpact: z.string().trim().min(3).max(5000),
  capabilityProcessAssetKey: z.string().trim().max(300).default(""),
  inherentAssessment: z.string().trim().max(2000).default(""),
  residualAssessment: z.string().trim().max(2000).default(""),
  appetiteToleranceMateriality: z.string().trim().max(2000).default(""),
  treatmentControl: z.string().trim().max(4000).default(""),
  sourceRequirement: z.string().trim().max(2000).default(""),
  jurisdictionRegime: z.string().trim().max(1000).default(""),
  evidenceIds: z.array(z.string().uuid()).max(500).default([]),
  policyDecisionWorkKeys: z
    .array(z.string().trim().min(1).max(300))
    .max(500)
    .default([]),
  exceptionIncidentKeys: z
    .array(z.string().trim().min(1).max(300))
    .max(500)
    .default([]),
  insuranceTransfer: z.string().trim().max(2000).default(""),
  notes: z.string().trim().max(4000).default(""),
  dueReviewAt: z.string().datetime().optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
});
export const riskControlCreateSchema = riskControlCreateBaseSchema.refine(
  (value) =>
    !value.validUntil || !value.validFrom || value.validUntil > value.validFrom,
  { message: "Valid until must be after valid from.", path: ["validUntil"] },
);

export const riskControlUpdateSchema = riskControlCreateBaseSchema
  .omit({ sourceAuthority: true })
  .partial()
  .extend({
    state: z.enum(riskControlStates).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one risk, obligation, or control field is required.",
  )
  .refine(
    (value) =>
      !value.validUntil ||
      !value.validFrom ||
      value.validUntil > value.validFrom,
    { message: "Valid until must be after valid from.", path: ["validUntil"] },
  );

const objectiveTransitions: Record<
  (typeof objectiveStates)[number],
  readonly (typeof objectiveStates)[number][]
> = {
  proposed: ["active", "superseded", "archived"],
  active: [
    "at_risk",
    "blocked",
    "achieved",
    "failed",
    "superseded",
    "archived",
  ],
  at_risk: [
    "active",
    "blocked",
    "achieved",
    "failed",
    "superseded",
    "archived",
  ],
  blocked: ["active", "at_risk", "failed", "superseded", "archived"],
  achieved: ["archived"],
  failed: ["archived"],
  superseded: ["archived"],
  archived: [],
};
const metricTransitions: Record<
  (typeof metricOutcomeStates)[number],
  readonly (typeof metricOutcomeStates)[number][]
> = {
  proposed: ["defined", "superseded", "retired"],
  defined: ["active", "under_review", "superseded", "retired"],
  active: ["under_review", "verified", "contested", "superseded", "retired"],
  under_review: ["active", "verified", "contested", "superseded", "retired"],
  verified: ["under_review", "superseded", "retired"],
  contested: ["under_review", "superseded", "retired"],
  superseded: ["retired"],
  retired: [],
};
const riskTransitions: Record<
  (typeof riskControlStates)[number],
  readonly (typeof riskControlStates)[number][]
> = {
  identified: ["under_assessment", "superseded"],
  under_assessment: [
    "applicable_active",
    "assigned",
    "satisfied_closed",
    "superseded",
  ],
  applicable_active: [
    "assigned",
    "treating_in_progress",
    "monitoring",
    "accepted",
    "overdue_breached",
    "satisfied_closed",
    "superseded",
  ],
  assigned: [
    "treating_in_progress",
    "monitoring",
    "overdue_breached",
    "satisfied_closed",
    "superseded",
  ],
  treating_in_progress: [
    "monitoring",
    "overdue_breached",
    "remediating",
    "satisfied_closed",
    "superseded",
  ],
  monitoring: [
    "treating_in_progress",
    "accepted",
    "overdue_breached",
    "remediating",
    "satisfied_closed",
    "superseded",
  ],
  accepted: [
    "monitoring",
    "overdue_breached",
    "remediating",
    "satisfied_closed",
    "superseded",
  ],
  overdue_breached: ["remediating", "satisfied_closed", "superseded"],
  remediating: [
    "monitoring",
    "overdue_breached",
    "satisfied_closed",
    "superseded",
  ],
  satisfied_closed: ["superseded"],
  superseded: [],
};

export function canTransitionObjective(
  from: (typeof objectiveStates)[number],
  to: (typeof objectiveStates)[number],
): boolean {
  return objectiveTransitions[from].includes(to);
}
export function canTransitionMetricOutcome(
  from: (typeof metricOutcomeStates)[number],
  to: (typeof metricOutcomeStates)[number],
): boolean {
  return metricTransitions[from].includes(to);
}
export function canTransitionRiskControl(
  from: (typeof riskControlStates)[number],
  to: (typeof riskControlStates)[number],
): boolean {
  return riskTransitions[from].includes(to);
}
export function nextObjectiveStates(state: (typeof objectiveStates)[number]) {
  return objectiveTransitions[state];
}
export function nextMetricOutcomeStates(
  state: (typeof metricOutcomeStates)[number],
) {
  return metricTransitions[state];
}
export function nextRiskControlStates(
  state: (typeof riskControlStates)[number],
) {
  return riskTransitions[state];
}

// Stakeholder and commercial runtime. A Party is canonical identity; relationship
// contexts are separate edges so the same person or organization can be a
// prospect, customer, partner, vendor, investor, or other stakeholder without
// duplicating identity. Provider-owned commercial facts remain projections.
export const stakeholderPartyTypes = [
  "person",
  "organization",
  "audience_segment",
  "customer_segment",
  "customer",
  "prospect",
  "partner",
  "vendor_provider",
  "employee",
  "candidate",
  "collaborator",
  "community",
  "investor",
  "regulator",
  "other",
] as const;
export const stakeholderStates = [
  "proposed",
  "active",
  "dormant",
  "restricted",
  "closed",
] as const;
export const relationshipTypes = [
  "prospect",
  "customer",
  "partner",
  "vendor_provider",
  "employee",
  "candidate",
  "collaborator",
  "community",
  "investor",
  "regulator",
  "beneficiary",
  "donor",
  "alumni",
  "other",
] as const;
export const relationshipStates = [
  "proposed",
  "active",
  "dormant",
  "restricted",
  "closed",
] as const;
export const commercialCaseClasses = [
  "commercial_opportunity",
  "client_engagement",
  "delivery_case",
  "partnership",
  "recruiting",
  "content_campaign",
  "internal_initiative",
  "other",
] as const;
export const commercialCaseStates = [
  "identified",
  "qualifying",
  "qualified",
  "proposal",
  "negotiation",
  "committed",
  "active",
  "on_hold",
  "won",
  "lost",
  "disqualified",
  "completed",
  "closed",
] as const;
export const offerTypes = [
  "service",
  "product",
  "program",
  "subscription",
  "engagement",
  "content_series",
  "internal_capability",
  "other",
] as const;
export const offerStates = [
  "thesis",
  "validation",
  "active",
  "paused",
  "scaling",
  "retired",
] as const;
export const valueFlowTypes = [
  "commitment",
  "proposal",
  "invoice",
  "payment",
  "refund",
  "cost",
  "revenue",
  "referral",
  "lead_attribution",
  "outcome",
  "resource_allocation",
  "other",
] as const;
export const valueFlowStates = [
  "proposed",
  "committed",
  "invoiced",
  "paid_settled",
  "partially_settled",
  "failed",
  "cancelled",
  "reconciled",
] as const;
export const commercialSourceAuthorities = [
  "native_eos",
  "notion_runtime",
  "external_authoritative",
  "reconciled",
] as const;

const commercialRecordBase = z.object({
  ownerSeatId: z.string().uuid().optional(),
  classification: z
    .enum(["public", "internal", "confidential", "restricted"])
    .default("internal"),
  sourceAuthority: z.enum(commercialSourceAuthorities).default("native_eos"),
  evidenceKeys: z
    .array(z.string().trim().min(1).max(1000))
    .max(200)
    .default([]),
});

const stakeholderFields = commercialRecordBase.extend({
  name: z.string().trim().min(1).max(300),
  partyType: z.enum(stakeholderPartyTypes),
  identityReference: z.string().trim().min(1).max(1000),
  externalId: z.string().trim().min(1).max(500).optional(),
  sourceSystem: z.string().trim().min(1).max(200).optional(),
  consentLegalBasis: z.string().trim().max(2000).default(""),
  relationshipRole: z.string().trim().max(1000).default(""),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
});
export const stakeholderCreateSchema = stakeholderFields
  .refine((value) => !value.externalId || Boolean(value.sourceSystem), {
    message: "Source system is required with an external ID.",
    path: ["sourceSystem"],
  })
  .refine(
    (value) =>
      !value.validUntil ||
      !value.validFrom ||
      value.validUntil > value.validFrom,
    { message: "Valid until must be after valid from.", path: ["validUntil"] },
  );

export const stakeholderUpdateSchema = stakeholderFields
  .omit({ sourceAuthority: true })
  .partial()
  .extend({ state: z.enum(stakeholderStates).optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one stakeholder field is required.",
  );

export const relationshipContextCreateSchema = commercialRecordBase.extend({
  stakeholderId: z.string().uuid(),
  relationshipType: z.enum(relationshipTypes),
  title: z.string().trim().min(1).max(300),
  needConstraint: z.string().trim().max(3000).default(""),
  fitHypothesis: z.string().trim().max(3000).default(""),
  nextBestAction: z.string().trim().max(2000).default(""),
});
export const relationshipContextUpdateSchema = relationshipContextCreateSchema
  .omit({ stakeholderId: true, sourceAuthority: true })
  .partial()
  .extend({ state: z.enum(relationshipStates).optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one relationship field is required.",
  );

const commercialCaseFields = commercialRecordBase.extend({
  title: z.string().trim().min(3).max(300),
  objectClass: z.enum(commercialCaseClasses).default("commercial_opportunity"),
  stakeholderIds: z.array(z.string().uuid()).min(1).max(100),
  offerId: z.string().uuid().optional(),
  valueEstimate: z.number().finite().nonnegative().optional(),
  currency: z.string().trim().min(3).max(12).default("USD"),
  probabilityConfidence: z.number().finite().min(0).max(100).optional(),
  nextAction: z.string().trim().max(2000).default(""),
  targetDate: z.string().datetime().optional(),
  resultOutcome: z.string().trim().max(3000).default(""),
  riskExceptionKeys: z
    .array(z.string().trim().min(1).max(1000))
    .max(200)
    .default([]),
  externalId: z.string().trim().min(1).max(500).optional(),
  sourceSystem: z.string().trim().min(1).max(200).optional(),
});
export const commercialCaseCreateSchema = commercialCaseFields.refine(
  (value) => !value.externalId || Boolean(value.sourceSystem),
  {
    message: "Source system is required with an external ID.",
    path: ["sourceSystem"],
  },
);
export const commercialCaseUpdateSchema = commercialCaseFields
  .omit({ sourceAuthority: true })
  .partial()
  .extend({ state: z.enum(commercialCaseStates).optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one commercial case field is required.",
  );

export const offerProgramCreateSchema = commercialRecordBase.extend({
  name: z.string().trim().min(2).max(300),
  offerType: z.enum(offerTypes),
  problemNeed: z.string().trim().min(3).max(3000),
  promiseOutcome: z.string().trim().min(3).max(3000),
  audienceStakeholderIds: z.array(z.string().uuid()).max(200).default([]),
  scopeInclusions: z.string().trim().max(4000).default(""),
  exclusionsConstraints: z.string().trim().max(4000).default(""),
  deliveryModel: z.string().trim().max(3000).default(""),
  pricingEconomicModel: z.string().trim().max(3000).default(""),
  commercialTermsAuthority: z.string().trim().max(2000).default(""),
  metricKeys: z.array(z.string().trim().min(1).max(1000)).max(200).default([]),
  workflowKeys: z
    .array(z.string().trim().min(1).max(1000))
    .max(200)
    .default([]),
});
export const offerProgramUpdateSchema = offerProgramCreateSchema
  .omit({ sourceAuthority: true })
  .partial()
  .extend({ state: z.enum(offerStates).optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one offer or program field is required.",
  );

const providerAuthoritativeFlowTypes = new Set<(typeof valueFlowTypes)[number]>(
  ["invoice", "payment", "refund", "cost", "revenue"],
);
const valueFlowFields = commercialRecordBase.extend({
  title: z.string().trim().min(3).max(300),
  flowType: z.enum(valueFlowTypes),
  fromStakeholderId: z.string().uuid().optional(),
  toStakeholderId: z.string().uuid().optional(),
  offerId: z.string().uuid().optional(),
  commercialCaseId: z.string().uuid().optional(),
  amount: z.number().finite().nonnegative().optional(),
  currency: z.string().trim().min(3).max(12).default("USD"),
  dueEffectiveAt: z.string().datetime().optional(),
  attributionNotes: z.string().trim().max(3000).default(""),
  agreementReference: z.string().trim().max(2000).default(""),
  externalId: z.string().trim().min(1).max(500).optional(),
  sourceSystem: z.string().trim().min(1).max(200).optional(),
});
export const valueFlowCreateSchema = valueFlowFields
  .refine(
    (value) => Boolean(value.fromStakeholderId || value.toStakeholderId),
    {
      message: "A value flow requires at least one party endpoint.",
      path: ["fromStakeholderId"],
    },
  )
  .refine(
    (value) =>
      !providerAuthoritativeFlowTypes.has(value.flowType) ||
      (["external_authoritative", "reconciled"] as string[]).includes(
        value.sourceAuthority,
      ),
    {
      message:
        "Provider-owned financial facts must be externally authoritative or reconciled.",
      path: ["sourceAuthority"],
    },
  )
  .refine(
    (value) =>
      !providerAuthoritativeFlowTypes.has(value.flowType) ||
      Boolean(value.sourceSystem && value.externalId),
    {
      message:
        "Provider-owned financial facts require source system and external ID.",
      path: ["externalId"],
    },
  );
export const valueFlowUpdateSchema = valueFlowFields
  .omit({ sourceAuthority: true })
  .partial()
  .extend({ state: z.enum(valueFlowStates).optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one value-flow field is required.",
  );

export const sharedServiceEngagementStates = [
  "awaiting_beneficiary_approval",
  "beneficiary_rejected",
  "provider_review",
  "clarification_requested",
  "provider_accepted",
  "provider_rejected",
  "in_progress",
  "delivered",
  "rework_requested",
  "accepted",
  "rejected",
  "cancelled",
] as const;

export const sharedServiceRequestCreateSchema = z.object({
  providerCompanyId: z.number().int().positive(),
  beneficiaryRelationshipId: z.string().uuid(),
  title: z.string().trim().min(3).max(300),
  serviceType: z.string().trim().min(2).max(160).default("production"),
  scope: z.string().trim().min(10).max(5000),
  beneficiary: z.string().trim().min(3).max(1000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("high"),
  inputs: z.array(z.string().trim().min(1).max(1000)).min(1).max(100),
  acceptanceCriteria: z.string().trim().min(10).max(5000),
  dueAt: z.string().datetime(),
  costCapacityTreatment: z.string().trim().min(5).max(3000),
});

export const sharedServiceProviderResponseSchema = z.object({
  decision: z.enum(["accept", "reject", "request_clarification"]),
  response: z.string().trim().min(3).max(3000),
});

export const sharedServiceClarificationSchema = z.object({
  response: z.string().trim().min(3).max(3000),
  confirmsNoMaterialChange: z.literal(true),
});

export const sharedServiceDeliverySchema = z.object({
  deliverySummary: z.string().trim().min(10).max(5000),
  evidenceIds: z.array(z.string().uuid()).min(1).max(100),
});

export const sharedServiceDispositionSchema = z
  .object({
    decision: z.enum(["accept", "reject", "request_rework"]),
    disposition: z.string().trim().min(5).max(3000),
    evidenceIds: z.array(z.string().uuid()).min(1).max(100),
    costCapacityOutcome: z.string().trim().min(5).max(3000).optional(),
  })
  .superRefine((value, context) => {
    if (value.decision !== "request_rework" && !value.costCapacityOutcome)
      context.addIssue({
        code: "custom",
        path: ["costCapacityOutcome"],
        message: "Final acceptance or rejection requires cost and capacity attribution.",
      });
  });

export const customerValueCycleStates = [
  "awaiting_commercial_approval",
  "commercial_approved",
  "commercial_rejected",
  "agreement_ready",
  "onboarding",
  "delivery",
  "reporting",
  "renewal_review",
  "renewed",
  "closed",
  "recovery_required",
  "cancelled",
] as const;

export const customerValueCycleCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(16)
    .max(300)
    .refine((value) => value.toUpperCase().startsWith("TEST-PRELIVE-"), {
      message: "Pre-live cycle titles must use the TEST-PRELIVE- namespace.",
    }),
  stakeholderId: z.string().uuid(),
  relationshipId: z.string().uuid(),
  offerId: z.string().uuid(),
  commercialCaseId: z.string().uuid(),
  ownerSeatId: z.string().uuid().optional(),
  objective: z.string().trim().min(10).max(5000),
  acceptanceCriteria: z.string().trim().min(10).max(5000),
  cleanupCriteria: z.string().trim().min(10).max(5000),
});

export const customerValueProviderContractRunSchema = z.object({
  confirmFixtureOnly: z.literal(true),
});

export const customerValueCycleActionSchema = z.object({
  action: z.enum([
    "verify_agreement",
    "start_onboarding",
    "start_delivery",
    "start_reporting",
    "start_renewal_review",
    "renew",
    "close",
    "report_failure",
    "restore_safe_state",
    "cancel",
  ]),
  note: z.string().trim().min(5).max(5000),
  evidenceIds: z.array(z.string().uuid()).min(1).max(100),
});

const sharedServiceTransitions: Record<
  (typeof sharedServiceEngagementStates)[number],
  readonly (typeof sharedServiceEngagementStates)[number][]
> = {
  awaiting_beneficiary_approval: ["provider_review", "beneficiary_rejected", "cancelled"],
  beneficiary_rejected: [],
  provider_review: ["clarification_requested", "provider_accepted", "provider_rejected", "cancelled"],
  clarification_requested: ["provider_review", "cancelled"],
  provider_accepted: ["in_progress", "cancelled"],
  provider_rejected: [],
  in_progress: ["delivered", "cancelled"],
  delivered: ["rework_requested", "accepted", "rejected"],
  rework_requested: ["delivered", "cancelled"],
  accepted: [],
  rejected: [],
  cancelled: [],
};

export function canTransitionSharedService(
  from: (typeof sharedServiceEngagementStates)[number],
  to: (typeof sharedServiceEngagementStates)[number],
) {
  return sharedServiceTransitions[from].includes(to);
}

export function nextSharedServiceStates(
  state: (typeof sharedServiceEngagementStates)[number],
) {
  return sharedServiceTransitions[state];
}

const stakeholderTransitions: Record<
  (typeof stakeholderStates)[number],
  readonly (typeof stakeholderStates)[number][]
> = {
  proposed: ["active", "restricted", "closed"],
  active: ["dormant", "restricted", "closed"],
  dormant: ["active", "restricted", "closed"],
  restricted: ["active", "dormant", "closed"],
  closed: [],
};
const relationshipTransitions: Record<
  (typeof relationshipStates)[number],
  readonly (typeof relationshipStates)[number][]
> = stakeholderTransitions;
const commercialCaseTransitions: Record<
  (typeof commercialCaseStates)[number],
  readonly (typeof commercialCaseStates)[number][]
> = {
  identified: ["qualifying", "disqualified", "closed"],
  qualifying: ["qualified", "disqualified", "on_hold", "closed"],
  qualified: ["proposal", "on_hold", "lost", "closed"],
  proposal: ["negotiation", "committed", "won", "lost", "on_hold"],
  negotiation: ["committed", "won", "lost", "on_hold"],
  committed: ["active", "won", "lost", "closed"],
  active: ["on_hold", "completed", "closed"],
  on_hold: [
    "qualifying",
    "qualified",
    "proposal",
    "negotiation",
    "active",
    "lost",
    "closed",
  ],
  won: ["active", "completed", "closed"],
  lost: ["closed"],
  disqualified: ["closed"],
  completed: ["closed"],
  closed: [],
};
const offerTransitions: Record<
  (typeof offerStates)[number],
  readonly (typeof offerStates)[number][]
> = {
  thesis: ["validation", "retired"],
  validation: ["active", "paused", "retired"],
  active: ["paused", "scaling", "retired"],
  paused: ["validation", "active", "retired"],
  scaling: ["active", "paused", "retired"],
  retired: [],
};
const valueFlowTransitions: Record<
  (typeof valueFlowStates)[number],
  readonly (typeof valueFlowStates)[number][]
> = {
  proposed: ["committed", "cancelled", "failed"],
  committed: [
    "invoiced",
    "paid_settled",
    "partially_settled",
    "failed",
    "cancelled",
    "reconciled",
  ],
  invoiced: [
    "paid_settled",
    "partially_settled",
    "failed",
    "cancelled",
    "reconciled",
  ],
  paid_settled: ["reconciled"],
  partially_settled: ["paid_settled", "failed", "cancelled", "reconciled"],
  failed: ["reconciled"],
  cancelled: ["reconciled"],
  reconciled: [],
};
export function canTransitionStakeholder(
  from: (typeof stakeholderStates)[number],
  to: (typeof stakeholderStates)[number],
) {
  return stakeholderTransitions[from].includes(to);
}
export function canTransitionRelationship(
  from: (typeof relationshipStates)[number],
  to: (typeof relationshipStates)[number],
) {
  return relationshipTransitions[from].includes(to);
}
export function canTransitionCommercialCase(
  from: (typeof commercialCaseStates)[number],
  to: (typeof commercialCaseStates)[number],
) {
  return commercialCaseTransitions[from].includes(to);
}
export function canTransitionOffer(
  from: (typeof offerStates)[number],
  to: (typeof offerStates)[number],
) {
  return offerTransitions[from].includes(to);
}
export function canTransitionValueFlow(
  from: (typeof valueFlowStates)[number],
  to: (typeof valueFlowStates)[number],
) {
  return valueFlowTransitions[from].includes(to);
}
export function nextStakeholderStates(
  state: (typeof stakeholderStates)[number],
) {
  return stakeholderTransitions[state];
}
export function nextRelationshipStates(
  state: (typeof relationshipStates)[number],
) {
  return relationshipTransitions[state];
}
export function nextCommercialCaseStates(
  state: (typeof commercialCaseStates)[number],
) {
  return commercialCaseTransitions[state];
}
export function nextOfferStates(state: (typeof offerStates)[number]) {
  return offerTransitions[state];
}
export function nextValueFlowStates(state: (typeof valueFlowStates)[number]) {
  return valueFlowTransitions[state];
}

export const capabilityStates = [
  "planned",
  "activating",
  "active",
  "dormant",
  "blocked",
  "deprecated",
] as const;
export const capabilityMaturities = [
  "ad_hoc",
  "defined",
  "repeatable",
  "managed",
  "optimizing",
] as const;
export const processQualificationStates = [
  "mapped",
  "artifact_complete",
  "implemented",
  "pre_live_qualified",
  "field_qualified",
  "retired",
] as const;
export const processReleaseStates = [
  "draft",
  "review",
  "released",
  "paused",
  "retired",
] as const;
export const resourceAssetTypes = [
  "intellectual_property",
  "brand_asset",
  "content_asset",
  "channel_account",
  "system_tool",
  "equipment",
  "template",
  "document",
  "dataset",
  "credential_reference",
  "other",
] as const;
export const resourceLifecycleStates = [
  "proposed",
  "active",
  "restricted",
  "under_review",
  "deprecated",
  "archived",
] as const;
const operationsRecordBase = z.object({
  ownerSeatId: z.string().uuid().optional(),
  sourceAuthority: z
    .enum([
      "native_eos",
      "notion_runtime",
      "external_authoritative",
      "reconciled",
    ])
    .default("native_eos"),
  classification: z
    .enum(["public", "internal", "confidential", "restricted"])
    .default("internal"),
});
const keyList = z
  .array(z.string().trim().min(1).max(1000))
  .max(200)
  .default([]);

export const capabilityCreateSchema = operationsRecordBase.extend({
  name: z.string().trim().min(2).max(300),
  capabilityKey: z.string().trim().min(2).max(200),
  moduleIds: z.array(z.number().int().min(1).max(14)).max(14).transform((values) => Array.from(new Set(values)).sort((a, b) => a - b)).default([]),
  maturity: z.enum(capabilityMaturities).default("ad_hoc"),
  activationTrigger: z.string().trim().max(2000).default(""),
  deactivationTrigger: z.string().trim().max(2000).default(""),
  agentKeys: keyList,
  humanOperatorKey: z.string().trim().max(300).default(""),
  systemKeys: keyList,
  workflowKeys: keyList,
  metricKeys: keyList,
  riskControlKeys: keyList,
  evidenceKeys: keyList,
});
export const capabilityUpdateSchema = capabilityCreateSchema
  .omit({ sourceAuthority: true })
  .partial()
  .extend({ state: z.enum(capabilityStates).optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one capability field is required.",
  );

const processStepSchema = z.object({
  id: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(300),
  instructions: z.string().trim().min(1).max(4000),
  completionCriteria: z.string().trim().min(1).max(2000),
});
export const processCreateSchema = operationsRecordBase.extend({
  capabilityInstanceId: z.string().uuid(),
  name: z.string().trim().min(2).max(300),
  workflowKey: z.string().trim().min(2).max(200),
  purpose: z.string().trim().min(3).max(4000),
  intendedOutcome: z.string().trim().min(3).max(4000),
  triggerCondition: z.string().trim().min(3).max(2000),
  templateAncestry: z.string().trim().max(2000).default(""),
  applicableOverlays: keyList,
  supportingActorKeys: keyList,
  requiredAuthority: keyList,
  disclosureScope: z
    .enum(["public", "internal", "confidential", "restricted"])
    .default("internal"),
  prerequisites: keyList,
  requiredInputs: keyList,
  toolSystemBoundaries: keyList,
  procedureSteps: z.array(processStepSchema).min(1).max(100),
  branchConditions: keyList,
  approvalGates: keyList,
  prohibitedActions: keyList,
  requiredOutputs: keyList,
  evidenceRequirements: keyList,
  qualityCriteria: keyList,
  sla: z.string().trim().max(1000).default(""),
  emittedEvents: keyList,
  failurePaths: keyList,
  terminalCriteria: keyList,
  trainingPrerequisites: keyList,
  acceptanceTests: keyList,
  reviewerKeys: keyList,
});
export const processUpdateSchema = processCreateSchema
  .omit({ sourceAuthority: true, capabilityInstanceId: true })
  .partial()
  .extend({
    qualificationState: z.enum(processQualificationStates).optional(),
    releaseState: z.enum(processReleaseStates).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one process field is required.",
  );

const resourceFields = operationsRecordBase.extend({
  name: z.string().trim().min(2).max(300),
  assetType: z.enum(resourceAssetTypes),
  ownerOrganizationKey: z.string().trim().min(1).max(300),
  operatorOrganizationKey: z.string().trim().max(300).default(""),
  dataClassification: z
    .enum([
      "public",
      "internal",
      "confidential",
      "restricted",
      "highly_restricted",
    ])
    .default("internal"),
  externalIdUrl: z.string().trim().min(1).max(2000).optional(),
  sourceSystem: z.string().trim().min(1).max(200).optional(),
  rightsUsageLicense: z.string().trim().max(4000).default(""),
  replacementPortabilityNotes: z.string().trim().max(4000).default(""),
  toolEntitlementKeys: keyList,
  evidenceKeys: keyList,
});
export const resourceCreateSchema = resourceFields.refine(
  (value) => !value.externalIdUrl || Boolean(value.sourceSystem),
  {
    message: "Source system is required with an external ID or URL.",
    path: ["sourceSystem"],
  },
);
export const resourceUpdateSchema = resourceFields
  .omit({ sourceAuthority: true })
  .partial()
  .extend({ lifecycleState: z.enum(resourceLifecycleStates).optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one resource field is required.",
  );

const capabilityTransitions: Record<
  (typeof capabilityStates)[number],
  readonly (typeof capabilityStates)[number][]
> = {
  planned: ["activating", "deprecated"],
  activating: ["active", "blocked", "dormant"],
  active: ["dormant", "blocked", "deprecated"],
  dormant: ["activating", "deprecated"],
  blocked: ["activating", "dormant", "deprecated"],
  deprecated: [],
};
const processQualificationTransitions: Record<
  (typeof processQualificationStates)[number],
  readonly (typeof processQualificationStates)[number][]
> = {
  mapped: ["artifact_complete", "retired"],
  artifact_complete: ["implemented", "mapped", "retired"],
  implemented: ["pre_live_qualified", "artifact_complete", "retired"],
  pre_live_qualified: ["field_qualified", "implemented", "retired"],
  field_qualified: ["implemented", "retired"],
  retired: [],
};
const processReleaseTransitions: Record<
  (typeof processReleaseStates)[number],
  readonly (typeof processReleaseStates)[number][]
> = {
  draft: ["review", "retired"],
  review: ["draft", "released", "retired"],
  released: ["paused", "retired"],
  paused: ["review", "released", "retired"],
  retired: [],
};
const resourceTransitions: Record<
  (typeof resourceLifecycleStates)[number],
  readonly (typeof resourceLifecycleStates)[number][]
> = {
  proposed: ["under_review", "active", "archived"],
  under_review: ["active", "restricted", "deprecated", "archived"],
  active: ["restricted", "under_review", "deprecated", "archived"],
  restricted: ["under_review", "active", "deprecated", "archived"],
  deprecated: ["archived"],
  archived: [],
};
export function canTransitionCapability(
  from: (typeof capabilityStates)[number],
  to: (typeof capabilityStates)[number],
) {
  return capabilityTransitions[from].includes(to);
}
export function canTransitionProcessQualification(
  from: (typeof processQualificationStates)[number],
  to: (typeof processQualificationStates)[number],
) {
  return processQualificationTransitions[from].includes(to);
}
export function canTransitionProcessRelease(
  from: (typeof processReleaseStates)[number],
  to: (typeof processReleaseStates)[number],
) {
  return processReleaseTransitions[from].includes(to);
}
export function canTransitionResource(
  from: (typeof resourceLifecycleStates)[number],
  to: (typeof resourceLifecycleStates)[number],
) {
  return resourceTransitions[from].includes(to);
}
export function nextCapabilityStates(state: (typeof capabilityStates)[number]) {
  return capabilityTransitions[state];
}
export function nextProcessQualificationStates(
  state: (typeof processQualificationStates)[number],
) {
  return processQualificationTransitions[state];
}
export function nextProcessReleaseStates(
  state: (typeof processReleaseStates)[number],
) {
  return processReleaseTransitions[state];
}
export function nextResourceStates(
  state: (typeof resourceLifecycleStates)[number],
) {
  return resourceTransitions[state];
}

export const financialSourceTypes = [
  "bank",
  "accounting",
  "payment",
  "payroll",
  "tax",
  "investment",
  "receivable",
  "payable",
  "cash_equivalent",
  "other",
] as const;
export const financialSourceStates = [
  "draft",
  "connected",
  "stale",
  "restricted",
  "disconnected",
  "archived",
] as const;
export const financialReconciliationStates = [
  "unreconciled",
  "pending",
  "reconciled",
  "exception",
] as const;
export const financialPlanTypes = [
  "budget",
  "forecast",
  "scenario",
  "liquidity",
  "unit_economics",
  "capital_plan",
] as const;
export const financialPlanStates = [
  "draft",
  "review",
  "approved",
  "active",
  "superseded",
  "archived",
] as const;
export const capitalAllocationTypes = [
  "operating",
  "growth",
  "reserve",
  "debt_service",
  "asset_purchase",
  "internal_investment",
  "external_investment",
  "distribution",
  "other",
] as const;
export const capitalAllocationStates = [
  "proposed",
  "under_review",
  "approved",
  "committed",
  "deployed",
  "measuring",
  "realized",
  "rejected",
  "cancelled",
] as const;

const financeRecordBase = z.object({
  ownerSeatId: z.string().uuid().optional(),
  sourceAuthority: z
    .enum([
      "native_eos",
      "notion_runtime",
      "external_authoritative",
      "reconciled",
    ])
    .default("native_eos"),
  classification: z
    .enum(["public", "internal", "confidential", "restricted"])
    .default("confidential"),
});
const financeIdList = z.array(z.string().uuid()).max(500).default([]);
const financeTextList = z
  .array(z.string().trim().min(1).max(2000))
  .max(500)
  .default([]);

const financialSourceFields = financeRecordBase.extend({
  name: z.string().trim().min(2).max(300),
  legalEntityName: z.string().trim().min(2).max(300),
  legalEntityReference: z.string().trim().max(1000).default(""),
  accountType: z.enum(financialSourceTypes),
  currency: z.string().trim().min(3).max(12).default("USD"),
  lifecycleState: z.enum(financialSourceStates).default("draft"),
  sourceSystem: z.string().trim().min(1).max(200).nullable().optional(),
  externalId: z.string().trim().min(1).max(500).nullable().optional(),
  reconciliationState: z
    .enum(financialReconciliationStates)
    .default("unreconciled"),
  freshnessAsOf: z.string().datetime().optional(),
  evidenceIds: financeIdList,
});
export const financialSourceCreateSchema = financialSourceFields
  .refine(
    (value) => Boolean(value.sourceSystem) === Boolean(value.externalId),
    {
      message: "Source system and external ID must be supplied together.",
      path: ["externalId"],
    },
  )
  .refine(
    (value) =>
      !["connected", "stale", "restricted", "disconnected"].includes(
        value.lifecycleState,
      ) || Boolean(value.sourceSystem && value.externalId),
    {
      message:
        "A connected financial source requires an authoritative provider account reference.",
      path: ["sourceSystem"],
    },
  );
export const financialSourceUpdateSchema = financialSourceFields
  .omit({ sourceAuthority: true })
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one financial source field is required.",
  );

const financialLineItemSchema = z.object({
  name: z.string().trim().min(1).max(300),
  amount: z.number().finite(),
  category: z.string().trim().max(200).default(""),
  assumption: z.string().trim().max(2000).default(""),
});
const financialPlanFields = financeRecordBase.extend({
  name: z.string().trim().min(2).max(300),
  planType: z.enum(financialPlanTypes),
  financialSourceId: z.string().uuid().optional(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  currency: z.string().trim().min(3).max(12).default("USD"),
  plannedAmount: z.number().finite().nonnegative(),
  assumptions: financeTextList,
  lineItems: z.array(financialLineItemSchema).max(500).default([]),
  sourceValueFlowIds: financeIdList,
  metricIds: financeIdList,
  evidenceIds: financeIdList,
});
export const financialPlanCreateSchema = financialPlanFields.refine(
  (value) => value.periodEnd > value.periodStart,
  { message: "Plan period end must be after its start.", path: ["periodEnd"] },
);
export const financialPlanUpdateSchema = financialPlanFields
  .omit({ sourceAuthority: true })
  .partial()
  .extend({ state: z.enum(financialPlanStates).optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one financial plan field is required.",
  );
export const financialPlanReconcileSchema = z.object({
  sourceValueFlowIds: z.array(z.string().uuid()).min(1).max(500),
  evidenceIds: z.array(z.string().uuid()).min(1).max(500),
  actualAmount: z.number().finite().nonnegative(),
  note: z.string().trim().min(3).max(4000),
});

const capitalAllocationFields = financeRecordBase.extend({
  name: z.string().trim().min(2).max(300),
  allocationType: z.enum(capitalAllocationTypes),
  financialPlanId: z.string().uuid(),
  targetType: z.string().trim().min(1).max(200),
  targetKey: z.string().trim().min(1).max(500),
  amount: z.number().finite().positive(),
  currency: z.string().trim().min(3).max(12).default("USD"),
  rationale: z.string().trim().min(3).max(4000),
  alternatives: financeTextList,
  expectedOutcome: z.string().trim().min(3).max(4000),
  downsideRisk: z.string().trim().min(3).max(4000),
  workPacketId: z.string().uuid().optional(),
  metricIds: financeIdList,
  evidenceIds: financeIdList,
});
export const capitalAllocationCreateSchema = capitalAllocationFields;
export const capitalAllocationUpdateSchema = capitalAllocationFields
  .omit({ sourceAuthority: true })
  .partial()
  .extend({ state: z.enum(capitalAllocationStates).optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one capital allocation field is required.",
  );

const financialSourceTransitions: Record<
  (typeof financialSourceStates)[number],
  readonly (typeof financialSourceStates)[number][]
> = {
  draft: ["connected", "archived"],
  connected: ["stale", "restricted", "disconnected", "archived"],
  stale: ["connected", "restricted", "disconnected", "archived"],
  restricted: ["connected", "disconnected", "archived"],
  disconnected: ["connected", "archived"],
  archived: [],
};
const financialPlanTransitions: Record<
  (typeof financialPlanStates)[number],
  readonly (typeof financialPlanStates)[number][]
> = {
  draft: ["review", "archived"],
  review: ["draft", "approved", "archived"],
  approved: ["active", "superseded", "archived"],
  active: ["superseded", "archived"],
  superseded: ["archived"],
  archived: [],
};
const capitalAllocationTransitions: Record<
  (typeof capitalAllocationStates)[number],
  readonly (typeof capitalAllocationStates)[number][]
> = {
  proposed: ["under_review", "rejected", "cancelled"],
  under_review: ["proposed", "approved", "rejected", "cancelled"],
  approved: ["committed", "cancelled"],
  committed: ["deployed", "cancelled"],
  deployed: ["measuring", "realized"],
  measuring: ["realized"],
  realized: [],
  rejected: [],
  cancelled: [],
};
export function canTransitionFinancialSource(
  from: (typeof financialSourceStates)[number],
  to: (typeof financialSourceStates)[number],
) {
  return financialSourceTransitions[from].includes(to);
}
export function canTransitionFinancialPlan(
  from: (typeof financialPlanStates)[number],
  to: (typeof financialPlanStates)[number],
) {
  return financialPlanTransitions[from].includes(to);
}
export function canTransitionCapitalAllocation(
  from: (typeof capitalAllocationStates)[number],
  to: (typeof capitalAllocationStates)[number],
) {
  return capitalAllocationTransitions[from].includes(to);
}
export function nextFinancialSourceStates(
  state: (typeof financialSourceStates)[number],
) {
  return financialSourceTransitions[state];
}
export function nextFinancialPlanStates(
  state: (typeof financialPlanStates)[number],
) {
  return financialPlanTransitions[state];
}
export function nextCapitalAllocationStates(
  state: (typeof capitalAllocationStates)[number],
) {
  return capitalAllocationTransitions[state];
}

export const systemRegistryTypes = [
  "system",
  "application",
  "service",
  "tool",
  "data_platform",
  "infrastructure",
  "provider",
] as const;
export const systemLifecycleStates = [
  "proposed",
  "selected",
  "implementing",
  "active",
  "degraded",
  "replacement_planned",
  "migrating",
  "retired",
] as const;
export const systemReplacementStates = [
  "keep",
  "integrate",
  "migrate",
  "replace",
  "retire",
  "unknown",
] as const;
export const integrationAdapterKinds = [
  "oauth",
  "api_key",
  "webhook",
  "signed_https",
  "service_account",
  "database",
  "file_exchange",
  "manual",
  "native",
] as const;
export const integrationConnectionStates = [
  "unconfigured",
  "configured",
  "connected",
  "revoked",
  "failed",
] as const;
export const integrationHealthStates = [
  "unknown",
  "healthy",
  "degraded",
  "unavailable",
] as const;
export const integrationParityStates = [
  "not_tested",
  "test_planned",
  "passing",
  "failing",
  "accepted_exception",
] as const;
export const entitlementStates = [
  "proposed",
  "pending",
  "active",
  "suspended",
  "revoked",
  "expired",
] as const;
export const entitlementMasteryStates = [
  "unverified",
  "training",
  "qualified",
  "expired",
] as const;
export const automationLifecycleStates = [
  "proposed",
  "design",
  "review",
  "enabled",
  "paused",
  "degraded",
  "disabled",
  "retired",
] as const;
export const integrationHealthCheckTypes = [
  "live_provider",
  "monitoring",
  "manual_test",
  "fixture",
  "recovery_test",
  "parity_test",
] as const;

const systemsIdList = z.array(z.string().uuid()).max(500).default([]);
const systemsTextList = z
  .array(z.string().trim().min(1).max(1000))
  .max(500)
  .default([]);
const secretReferenceSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .regex(
    /^(op|vault|aws-secretsmanager|gcp-secret-manager|azure-key-vault):\/\/[A-Za-z0-9._~!$&'()*+,;=:@%\/ -]+$/,
    "Use a secret-manager reference; never submit a credential value.",
  );
const providerSecretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\b/,
  /\bgh[opsu]_[A-Za-z0-9]{20,}\b/,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_=-]{20,}\b/i,
  /\bya29\.[A-Za-z0-9_-]{20,}\b/,
];
function rejectProviderCredentialMaterial(
  value: Record<string, unknown>,
  context: z.RefinementCtx,
) {
  const { credentialReference: _credentialReference, ...safeMetadata } = value;
  const serialized = JSON.stringify(safeMetadata);
  if (providerSecretPatterns.some((pattern) => pattern.test(serialized)))
    context.addIssue({
      code: "custom",
      message:
        "Provider configuration may contain safe identities and secret-manager references only; credential-shaped material is prohibited.",
      path: ["credentialReference"],
    });
}
const systemsRecordBase = z.object({
  ownerSeatId: z.string().uuid().optional(),
  sourceAuthority: z
    .enum([
      "native_eos",
      "notion_runtime",
      "external_authoritative",
      "reconciled",
    ])
    .default("native_eos"),
  classification: z
    .enum(["public", "internal", "confidential", "restricted"])
    .default("restricted"),
});

const systemRegistryFields = systemsRecordBase.extend({
  name: z.string().trim().min(2).max(300),
  systemType: z.enum(systemRegistryTypes),
  lifecycleState: z.enum(systemLifecycleStates).default("proposed"),
  vendorStakeholderId: z.string().uuid().optional(),
  capabilities: systemsTextList,
  dataDomains: systemsTextList,
  authoritativeFields: systemsTextList,
  nativeAdminUrl: z.string().url().max(2000).optional(),
  monthlyCost: z.number().finite().nonnegative().optional(),
  currency: z.string().trim().min(3).max(12).default("USD"),
  riskNotes: z.string().trim().max(4000).default(""),
  contractRenewalAt: z.string().datetime().optional(),
  replacementIntent: z.enum(systemReplacementStates).default("unknown"),
  sourceSystem: z.string().trim().min(1).max(200).nullable().optional(),
  externalId: z.string().trim().min(1).max(500).nullable().optional(),
  evidenceIds: systemsIdList,
});
export const systemRegistryCreateSchema = systemRegistryFields.refine(
  (value) => Boolean(value.sourceSystem) === Boolean(value.externalId),
  {
    message: "Source system and external ID must be supplied together.",
    path: ["externalId"],
  },
);
export const systemRegistryUpdateSchema = systemRegistryFields
  .omit({ sourceAuthority: true })
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one system field is required.",
  );

const integrationBindingFields = systemsRecordBase.extend({
  name: z.string().trim().min(2).max(300),
  fromSystemId: z.string().uuid().optional(),
  toSystemId: z.string().uuid().optional(),
  providerKey: z.string().trim().min(1).max(200),
  providerAccountReference: z.string().trim().max(1000).default(""),
  adapterKind: z.enum(integrationAdapterKinds),
  adapterReference: z.string().trim().min(1).max(1000),
  adapterVersion: z.string().trim().max(200).default(""),
  transport: z.string().trim().max(500).default(""),
  lifecycleState: z.enum(systemLifecycleStates).default("proposed"),
  connectionState: z.enum(integrationConnectionStates).default("unconfigured"),
  recoveryOwnerSeatId: z.string().uuid().optional(),
  administratorReference: z.string().trim().max(1000).default(""),
  accountScope: z.string().trim().max(2000).default(""),
  nativePermissions: systemsTextList,
  credentialReference: secretReferenceSchema.nullable().optional(),
  executionAuthority: z.string().trim().max(2000).default(""),
  operations: systemsTextList,
  expectedEvents: systemsTextList,
  inputSchema: z.record(z.unknown()).default({}),
  outputSchema: z.record(z.unknown()).default({}),
  eventSchema: z.record(z.unknown()).default({}),
  costModel: z.string().trim().max(2000).default(""),
  latencyBudgetMs: z.number().int().positive().max(3_600_000).optional(),
  rateLimitPolicy: z.string().trim().max(2000).default(""),
  idempotencyStrategy: z.string().trim().max(3000).default(""),
  retryPolicy: z.string().trim().max(3000).default(""),
  timeoutMs: z.number().int().positive().max(3_600_000).optional(),
  cancellationBehavior: z.string().trim().max(3000).default(""),
  redactionPolicy: z.string().trim().max(3000).default(""),
  evidenceRequirements: systemsTextList,
  testCapability: z.string().trim().max(3000).default(""),
  revocationProcedure: z.string().trim().max(3000).default(""),
  manualFallback: z.string().trim().min(3).max(4000),
  failureRecovery: z.string().trim().min(3).max(4000),
  replacementStatus: z.enum(systemReplacementStates).default("unknown"),
  parityState: z.enum(integrationParityStates).default("not_tested"),
  workPacketId: z.string().uuid().optional(),
  evidenceIds: systemsIdList,
  sourceSystem: z.string().trim().min(1).max(200).nullable().optional(),
  externalId: z.string().trim().min(1).max(500).nullable().optional(),
});
export const integrationBindingCreateSchema = integrationBindingFields
  .refine((value) => Boolean(value.fromSystemId) || Boolean(value.toSystemId), {
    message: "An integration requires at least one system endpoint.",
    path: ["fromSystemId"],
  })
  .refine(
    (value) => Boolean(value.sourceSystem) === Boolean(value.externalId),
    {
      message: "Source system and external ID must be supplied together.",
      path: ["externalId"],
    },
  )
  .superRefine(rejectProviderCredentialMaterial);
export const integrationBindingUpdateSchema = integrationBindingFields
  .omit({ sourceAuthority: true })
  .partial()
  .extend({
    expectedConfigurationVersion: z.number().int().positive(),
    changeSummary: z.string().trim().min(3).max(1000).optional(),
  })
  .refine(
    (value) =>
      Object.keys(value).some(
        (key) =>
          key !== "expectedConfigurationVersion" && key !== "changeSummary",
      ),
    "At least one integration field is required.",
  )
  .superRefine(rejectProviderCredentialMaterial);

const toolEntitlementFields = z.object({
  systemId: z.string().uuid(),
  integrationBindingId: z.string().uuid().optional(),
  granteeSeatId: z.string().uuid().optional(),
  granteeSubjectId: z.string().min(1).max(200).optional(),
  providerResourceReference: z.string().trim().min(1).max(1000),
  nativePermissions: z
    .array(z.string().trim().min(1).max(1000))
    .min(1)
    .max(500),
  authorityGrantId: z.string().min(1).max(200).optional(),
  credentialReference: secretReferenceSchema.nullable().optional(),
  masteryState: z.enum(entitlementMasteryStates).default("unverified"),
  state: z.enum(entitlementStates).default("proposed"),
  revocationOwnerSeatId: z.string().uuid().optional(),
  evidenceIds: systemsIdList,
  effectiveFrom: z.string().datetime().optional(),
  effectiveUntil: z.string().datetime().optional(),
  sourceAuthority: z
    .enum([
      "native_eos",
      "notion_runtime",
      "external_authoritative",
      "reconciled",
    ])
    .default("native_eos"),
  classification: z
    .enum(["public", "internal", "confidential", "restricted"])
    .default("restricted"),
});
export const toolEntitlementCreateSchema = toolEntitlementFields
  .refine(
    (value) =>
      Number(Boolean(value.granteeSeatId)) +
        Number(Boolean(value.granteeSubjectId)) ===
      1,
    {
      message: "Choose exactly one canonical grantee.",
      path: ["granteeSeatId"],
    },
  )
  .refine(
    (value) =>
      !value.effectiveUntil ||
      !value.effectiveFrom ||
      value.effectiveUntil > value.effectiveFrom,
    {
      message: "Entitlement expiry must follow its effective start.",
      path: ["effectiveUntil"],
    },
  );
export const toolEntitlementUpdateSchema = toolEntitlementFields
  .omit({ sourceAuthority: true })
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one entitlement field is required.",
  );

const automationFields = systemsRecordBase.extend({
  name: z.string().trim().min(2).max(300),
  integrationBindingId: z.string().uuid(),
  triggerContract: z.string().trim().min(3).max(4000),
  actionContract: z.string().trim().min(3).max(4000),
  lifecycleState: z.enum(automationLifecycleStates).default("proposed"),
  consequence: z
    .enum(["routine", "material", "high_consequence"])
    .default("routine"),
  failureBehavior: z.string().trim().min(3).max(4000),
  manualFallback: z.string().trim().min(3).max(4000),
  workPacketId: z.string().uuid().optional(),
  evidenceIds: systemsIdList,
});
export const automationCreateSchema = automationFields;
export const automationUpdateSchema = automationFields
  .omit({ sourceAuthority: true })
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one automation field is required.",
  );
export const integrationHealthObservationCreateSchema = z
  .object({
    integrationBindingId: z.string().uuid(),
    healthState: z.enum(integrationHealthStates),
    checkType: z.enum(integrationHealthCheckTypes),
    summary: z.string().trim().min(3).max(4000),
    externalReference: z.string().trim().max(2000).optional(),
    evidenceIds: z.array(z.string().uuid()).min(1).max(500),
    observedAt: z.string().datetime().optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .refine(
    (value) =>
      !value.expiresAt ||
      !value.observedAt ||
      value.expiresAt > value.observedAt,
    {
      message: "Health observation expiry must follow observation time.",
      path: ["expiresAt"],
    },
  );

const systemLifecycleTransitions: Record<
  (typeof systemLifecycleStates)[number],
  readonly (typeof systemLifecycleStates)[number][]
> = {
  proposed: ["selected", "retired"],
  selected: ["implementing", "replacement_planned", "retired"],
  implementing: ["active", "degraded", "replacement_planned", "retired"],
  active: ["degraded", "replacement_planned", "migrating", "retired"],
  degraded: ["active", "replacement_planned", "migrating", "retired"],
  replacement_planned: ["migrating", "active", "retired"],
  migrating: ["active", "degraded", "retired"],
  retired: [],
};
const entitlementTransitions: Record<
  (typeof entitlementStates)[number],
  readonly (typeof entitlementStates)[number][]
> = {
  proposed: ["pending", "revoked"],
  pending: ["active", "suspended", "revoked"],
  active: ["suspended", "revoked", "expired"],
  suspended: ["active", "revoked", "expired"],
  revoked: [],
  expired: [],
};
const automationTransitions: Record<
  (typeof automationLifecycleStates)[number],
  readonly (typeof automationLifecycleStates)[number][]
> = {
  proposed: ["design", "retired"],
  design: ["review", "retired"],
  review: ["design", "enabled", "disabled", "retired"],
  enabled: ["paused", "degraded", "disabled", "retired"],
  paused: ["enabled", "disabled", "retired"],
  degraded: ["enabled", "paused", "disabled", "retired"],
  disabled: ["review", "retired"],
  retired: [],
};
export function canTransitionSystemLifecycle(
  from: (typeof systemLifecycleStates)[number],
  to: (typeof systemLifecycleStates)[number],
) {
  return systemLifecycleTransitions[from].includes(to);
}
export function canTransitionEntitlement(
  from: (typeof entitlementStates)[number],
  to: (typeof entitlementStates)[number],
) {
  return entitlementTransitions[from].includes(to);
}
export function canTransitionAutomation(
  from: (typeof automationLifecycleStates)[number],
  to: (typeof automationLifecycleStates)[number],
) {
  return automationTransitions[from].includes(to);
}
export function nextSystemLifecycleStates(
  state: (typeof systemLifecycleStates)[number],
) {
  return systemLifecycleTransitions[state];
}
export function nextEntitlementStates(
  state: (typeof entitlementStates)[number],
) {
  return entitlementTransitions[state];
}
export function nextAutomationStates(
  state: (typeof automationLifecycleStates)[number],
) {
  return automationTransitions[state];
}
export function integrationActivationIssues(value: {
  providerAccountReference?: string;
  adapterReference?: string;
  adapterVersion?: string;
  transport?: string;
  administratorReference?: string;
  connectionState?: string;
  healthState?: string;
  accountScope?: string;
  nativePermissions?: unknown;
  credentialReference?: string | null;
  executionAuthority?: string;
  operations?: unknown;
  inputSchema?: unknown;
  outputSchema?: unknown;
  eventSchema?: unknown;
  costModel?: string;
  latencyBudgetMs?: number | null;
  rateLimitPolicy?: string;
  idempotencyStrategy?: string;
  retryPolicy?: string;
  timeoutMs?: number | null;
  cancellationBehavior?: string;
  redactionPolicy?: string;
  evidenceRequirements?: unknown;
  testCapability?: string;
  revocationProcedure?: string;
  manualFallback?: string;
  failureRecovery?: string;
  evidenceIds?: unknown;
  lastHealthAt?: Date | string | null;
}): string[] {
  const issues: string[] = [];
  if (!value.providerAccountReference?.trim())
    issues.push("provider account/resource");
  if (!value.adapterReference?.trim()) issues.push("adapter");
  if (!value.adapterVersion?.trim()) issues.push("adapter version");
  if (!value.transport?.trim()) issues.push("transport");
  if (!value.administratorReference?.trim())
    issues.push("provider administrator reference");
  if (value.connectionState !== "connected")
    issues.push("connected provider state");
  if (value.healthState !== "healthy" || !value.lastHealthAt)
    issues.push("fresh healthy observation");
  if (!value.accountScope?.trim()) issues.push("account scope");
  if (
    !Array.isArray(value.nativePermissions) ||
    value.nativePermissions.length === 0
  )
    issues.push("native permissions");
  if (!value.credentialReference?.trim())
    issues.push("secret-manager reference");
  if (!value.executionAuthority?.trim()) issues.push("execution authority");
  if (!Array.isArray(value.operations) || value.operations.length === 0)
    issues.push("operations");
  if (!value.inputSchema || Object.keys(value.inputSchema as object).length === 0)
    issues.push("input schema");
  if (!value.outputSchema || Object.keys(value.outputSchema as object).length === 0)
    issues.push("output schema");
  if (!value.eventSchema || Object.keys(value.eventSchema as object).length === 0)
    issues.push("event schema");
  if (!value.costModel?.trim()) issues.push("cost model");
  if (!value.latencyBudgetMs) issues.push("latency budget");
  if (!value.rateLimitPolicy?.trim()) issues.push("rate-limit policy");
  if (!value.idempotencyStrategy?.trim()) issues.push("idempotency strategy");
  if (!value.retryPolicy?.trim()) issues.push("retry policy");
  if (!value.timeoutMs) issues.push("timeout");
  if (!value.cancellationBehavior?.trim()) issues.push("cancellation behavior");
  if (!value.redactionPolicy?.trim()) issues.push("redaction policy");
  if (
    !Array.isArray(value.evidenceRequirements) ||
    value.evidenceRequirements.length === 0
  )
    issues.push("evidence requirements");
  if (!value.testCapability?.trim()) issues.push("test capability");
  if (!value.revocationProcedure?.trim()) issues.push("revocation procedure");
  if (!value.manualFallback?.trim()) issues.push("manual fallback");
  if (!value.failureRecovery?.trim()) issues.push("failure/recovery path");
  if (!Array.isArray(value.evidenceIds) || value.evidenceIds.length === 0)
    issues.push("verified evidence");
  return issues;
}
export function entitlementActivationIssues(value: {
  authorityGrantId?: string | null;
  credentialReference?: string | null;
  masteryState?: string;
  nativePermissions?: unknown;
  evidenceIds?: unknown;
  providerResourceReference?: string;
}): string[] {
  const issues: string[] = [];
  if (!value.authorityGrantId) issues.push("Authority Grant");
  if (!value.credentialReference?.trim())
    issues.push("secret-manager reference");
  if (value.masteryState !== "qualified") issues.push("qualified mastery");
  if (
    !Array.isArray(value.nativePermissions) ||
    value.nativePermissions.length === 0
  )
    issues.push("native permissions");
  if (!Array.isArray(value.evidenceIds) || value.evidenceIds.length === 0)
    issues.push("verified evidence");
  if (!value.providerResourceReference?.trim())
    issues.push("provider resource");
  return issues;
}

export const workforceReviewStates = [
  "draft",
  "self_review",
  "manager_review",
  "calibrated",
  "acknowledged",
  "closed",
] as const;
export const performanceAttributions = [
  "undetermined",
  "person",
  "role_design",
  "process",
  "management",
  "capacity",
  "fit",
  "mixed",
] as const;
export const workforceCorrectionStates = [
  "none",
  "requested",
  "resolved",
  "rejected",
] as const;
export const developmentPlanStates = [
  "draft",
  "active",
  "paused",
  "completed",
  "cancelled",
] as const;
export const roleSupportModes = ["assist", "teach", "guard", "transfer"] as const;
export const roleSupportPlanStates = [
  "draft",
  "active",
  "ready_for_review",
  "completed",
  "cancelled",
] as const;
export const careerTransitionTypes = [
  "level_promotion",
  "management_path",
  "senior_ic_path",
  "leadership_path",
  "lateral_adjacent",
  "cross_functional",
  "recovery_reposition",
] as const;
export const careerTracks = [
  "individual_contributor",
  "management",
  "leadership",
  "executive",
  "cross_functional",
] as const;
export const careerPathStates = [
  "proposed",
  "under_review",
  "development_active",
  "evidence_ready",
  "endorsed",
  "declined",
  "withdrawn",
] as const;
export const successionStates = [
  "hypothesis",
  "assessed",
  "development_active",
  "ready",
  "selected",
  "rejected",
  "withdrawn",
] as const;
export const successionReadinessWindows = [
  "unassessed",
  "ready_now",
  "within_6_months",
  "within_12_months",
  "within_18_months",
  "not_ready",
] as const;

const workforceIdList = z.array(z.string().uuid()).max(500).default([]);
const workforceTextList = z
  .array(z.string().trim().min(1).max(2000))
  .max(200)
  .default([]);
const workforceRecordBase = z.object({
  sourceAuthority: z
    .enum([
      "native_eos",
      "notion_runtime",
      "external_authoritative",
      "reconciled",
    ])
    .default("native_eos"),
  classification: z
    .enum(["internal", "confidential", "restricted"])
    .default("internal"),
});

const workforceReviewFields = workforceRecordBase.extend({
  subjectSeatId: z.string().uuid(),
  assignmentId: z.string().uuid().optional(),
  reviewerSeatId: z.string().uuid().optional(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  performanceAttribution: z
    .enum(performanceAttributions)
    .default("undetermined"),
  outcomeSummary: z.string().trim().min(3).max(8000),
  strengths: workforceTextList,
  gaps: workforceTextList,
  managerObligations: workforceTextList,
  employeeResponse: z.string().trim().max(8000).default(""),
  correctionStatus: z.enum(workforceCorrectionStates).default("none"),
  metricIds: workforceIdList,
  workPacketIds: workforceIdList,
  evidenceIds: workforceIdList,
});
export const workforceReviewCreateSchema = workforceReviewFields
  .omit({ employeeResponse: true, correctionStatus: true })
  .refine(
  (value) => value.periodEnd > value.periodStart,
  { message: "Review period end must follow its start.", path: ["periodEnd"] },
  );
export const workforceReviewUpdateSchema = workforceReviewFields
  .omit({
    sourceAuthority: true,
    subjectSeatId: true,
    assignmentId: true,
    reviewerSeatId: true,
    periodStart: true,
    periodEnd: true,
    employeeResponse: true,
    correctionStatus: true,
  })
  .partial()
  .extend({ state: z.enum(workforceReviewStates).optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one workforce review field is required.",
  );

export const workforceReviewDialogueCreateSchema = z
  .object({
    responseType: z.enum([
      "employee_response",
      "correction_request",
      "manager_response",
      "correction_resolution",
    ]),
    body: z.string().trim().min(3).max(8000),
    correctionDecision: z.enum(["resolved", "rejected"]).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.responseType === "correction_resolution" &&
      !value.correctionDecision
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctionDecision"],
        message: "Correction resolution requires an explicit decision.",
      });
    if (
      value.responseType !== "correction_resolution" &&
      value.correctionDecision
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctionDecision"],
        message: "Only correction resolution may include a decision.",
      });
  });

const developmentPlanFields = workforceRecordBase.extend({
  subjectSeatId: z.string().uuid(),
  assignmentId: z.string().uuid().optional(),
  managerSeatId: z.string().uuid().optional(),
  targetPositionAgreementId: z.string().uuid().optional(),
  targetRole: z.string().trim().max(300).default(""),
  capabilityGaps: workforceTextList,
  developmentActions: workforceTextList,
  successCriteria: workforceTextList,
  workPacketIds: workforceIdList,
  evidenceIds: workforceIdList,
  reviewAt: z.string().datetime().optional(),
});
export const developmentPlanCreateSchema = developmentPlanFields.refine(
  (value) =>
    value.capabilityGaps.length > 0 || value.developmentActions.length > 0,
  {
    message:
      "A development plan requires a capability gap or development action.",
    path: ["capabilityGaps"],
  },
);
export const developmentPlanUpdateSchema = developmentPlanFields
  .omit({
    sourceAuthority: true,
    subjectSeatId: true,
    assignmentId: true,
    managerSeatId: true,
  })
  .partial()
  .extend({ state: z.enum(developmentPlanStates).optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one development plan field is required.",
  );

const roleSupportPlanFields = workforceRecordBase.extend({
  subjectSeatId: z.string().uuid(),
  assignmentId: z.string().uuid().optional(),
  supportMode: z.enum(roleSupportModes),
  responsibility: z.string().trim().min(3).max(2000),
  objective: z.string().trim().min(3).max(4000),
  humanOwnership: z.string().trim().min(3).max(4000),
  supportInstructions: z.string().trim().min(3).max(4000),
  guardrails: workforceTextList,
  proofRequirements: workforceTextList,
  evidenceIds: workforceIdList,
  transferTarget: z.string().trim().max(1000).default(""),
  reviewAt: z.string().datetime().optional(),
});

function addRoleSupportPlanIssues(
  value: z.infer<typeof roleSupportPlanFields>,
  context: z.RefinementCtx,
) {
  if (["guard", "transfer"].includes(value.supportMode) && !value.guardrails.length)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["guardrails"], message: "Guard and transfer modes require an explicit guardrail." });
  if (["teach", "transfer"].includes(value.supportMode) && !value.proofRequirements.length)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["proofRequirements"], message: "Teach and transfer modes require explicit proof requirements." });
  if (value.supportMode === "transfer" && value.transferTarget.length < 3)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["transferTarget"], message: "Transfer mode requires an explicit execution target." });
}

export const roleSupportPlanCreateSchema = roleSupportPlanFields.superRefine(
  addRoleSupportPlanIssues,
);
export const roleSupportPlanUpdateSchema = roleSupportPlanFields
  .omit({ sourceAuthority: true, subjectSeatId: true, assignmentId: true })
  .partial()
  .extend({ state: z.enum(roleSupportPlanStates).optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one role support plan field is required.",
  );

const careerPathFields = workforceRecordBase.extend({
  subjectSeatId: z.string().uuid(),
  assignmentId: z.string().uuid().optional(),
  fromPositionAgreementId: z.string().uuid().optional(),
  targetPositionAgreementId: z.string().uuid().optional(),
  targetRole: z.string().trim().max(300).default(""),
  transitionType: z.enum(careerTransitionTypes),
  careerTrack: z.enum(careerTracks),
  aspirationStatement: z.string().trim().min(3).max(4000),
  businessNeed: z.string().trim().max(4000).default(""),
  seatAvailability: z
    .enum(["unknown", "available", "unavailable", "not_required"])
    .default("unknown"),
  transitionCriteria: workforceTextList,
  trainingRequirements: workforceTextList,
  proofRequirements: workforceTextList,
  evidenceIds: workforceIdList,
  authorityChangeProposal: z.string().trim().max(2000).default(""),
  compensationChangeProposal: z.string().trim().max(2000).default(""),
  reviewAt: z.string().datetime().optional(),
});
export const careerPathCreateSchema = careerPathFields
  .refine(
    (value) => value.targetRole.length >= 3 || Boolean(value.targetPositionAgreementId),
    { message: "A career path requires a target role or Position Agreement.", path: ["targetRole"] },
  )
  .refine((value) => value.transitionCriteria.length > 0, {
    message: "A career path requires explicit transition criteria.",
    path: ["transitionCriteria"],
  })
  .refine((value) => value.proofRequirements.length > 0, {
    message: "A career path requires explicit proof requirements.",
    path: ["proofRequirements"],
  });
export const careerPathUpdateSchema = careerPathFields
  .omit({
    sourceAuthority: true,
    subjectSeatId: true,
    assignmentId: true,
    fromPositionAgreementId: true,
  })
  .partial()
  .extend({ state: z.enum(careerPathStates).optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one career path field is required.",
  );

const successionFields = workforceRecordBase.extend({
  criticalSeatId: z.string().uuid(),
  candidateSeatId: z.string().uuid().optional(),
  candidateAssignmentId: z.string().uuid().optional(),
  sponsorSeatId: z.string().uuid().optional(),
  readinessWindow: z.enum(successionReadinessWindows).default("unassessed"),
  rationale: z.string().trim().min(3).max(8000),
  proofGaps: workforceTextList,
  developmentalAssignments: workforceTextList,
  externalHiringRequired: z.boolean().default(false),
  workPacketId: z.string().uuid().optional(),
  evidenceIds: workforceIdList,
});
export const successionHypothesisCreateSchema = successionFields.refine(
  (value) => value.candidateSeatId !== value.criticalSeatId,
  {
    message: "The candidate seat must differ from the critical seat.",
    path: ["candidateSeatId"],
  },
);
export const successionHypothesisUpdateSchema = successionFields
  .omit({
    sourceAuthority: true,
    criticalSeatId: true,
    candidateSeatId: true,
    candidateAssignmentId: true,
    sponsorSeatId: true,
  })
  .partial()
  .extend({ state: z.enum(successionStates).optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one succession field is required.",
  );

const workforceReviewTransitions: Record<
  (typeof workforceReviewStates)[number],
  readonly (typeof workforceReviewStates)[number][]
> = {
  draft: ["self_review", "manager_review"],
  self_review: ["manager_review", "draft"],
  manager_review: ["calibrated", "self_review"],
  calibrated: ["acknowledged"],
  acknowledged: ["closed"],
  closed: [],
};
const developmentPlanTransitions: Record<
  (typeof developmentPlanStates)[number],
  readonly (typeof developmentPlanStates)[number][]
> = {
  draft: ["active", "cancelled"],
  active: ["paused", "completed", "cancelled"],
  paused: ["active", "cancelled"],
  completed: [],
  cancelled: [],
};
const roleSupportPlanTransitions: Record<
  (typeof roleSupportPlanStates)[number],
  readonly (typeof roleSupportPlanStates)[number][]
> = {
  draft: ["active", "cancelled"],
  active: ["ready_for_review", "cancelled"],
  ready_for_review: ["active", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};
const careerPathTransitions: Record<
  (typeof careerPathStates)[number],
  readonly (typeof careerPathStates)[number][]
> = {
  proposed: ["under_review", "withdrawn"],
  under_review: ["development_active", "evidence_ready", "declined", "withdrawn"],
  development_active: ["under_review", "evidence_ready", "declined", "withdrawn"],
  evidence_ready: ["under_review", "endorsed", "declined", "withdrawn"],
  endorsed: [],
  declined: [],
  withdrawn: [],
};
const successionTransitions: Record<
  (typeof successionStates)[number],
  readonly (typeof successionStates)[number][]
> = {
  hypothesis: ["assessed", "rejected", "withdrawn"],
  assessed: ["development_active", "ready", "rejected", "withdrawn"],
  development_active: ["assessed", "ready", "rejected", "withdrawn"],
  ready: ["selected", "development_active", "withdrawn"],
  selected: [],
  rejected: [],
  withdrawn: [],
};
export function canTransitionWorkforceReview(
  from: (typeof workforceReviewStates)[number],
  to: (typeof workforceReviewStates)[number],
) {
  return workforceReviewTransitions[from].includes(to);
}
export function canTransitionDevelopmentPlan(
  from: (typeof developmentPlanStates)[number],
  to: (typeof developmentPlanStates)[number],
) {
  return developmentPlanTransitions[from].includes(to);
}
export function canTransitionRoleSupportPlan(
  from: (typeof roleSupportPlanStates)[number],
  to: (typeof roleSupportPlanStates)[number],
) {
  return roleSupportPlanTransitions[from].includes(to);
}
export function canTransitionCareerPath(
  from: (typeof careerPathStates)[number],
  to: (typeof careerPathStates)[number],
) {
  return careerPathTransitions[from].includes(to);
}
export function canTransitionSuccession(
  from: (typeof successionStates)[number],
  to: (typeof successionStates)[number],
) {
  return successionTransitions[from].includes(to);
}
export function nextWorkforceReviewStates(
  state: (typeof workforceReviewStates)[number],
) {
  return workforceReviewTransitions[state];
}
export function nextDevelopmentPlanStates(
  state: (typeof developmentPlanStates)[number],
) {
  return developmentPlanTransitions[state];
}
export function nextRoleSupportPlanStates(
  state: (typeof roleSupportPlanStates)[number],
) {
  return roleSupportPlanTransitions[state];
}
export function nextCareerPathStates(
  state: (typeof careerPathStates)[number],
) {
  return careerPathTransitions[state];
}
export function nextSuccessionStates(state: (typeof successionStates)[number]) {
  return successionTransitions[state];
}
export function workforceReviewAdvancementIssues(
  value: { state: string; metricIds?: unknown; evidenceIds?: unknown },
  target: string,
): string[] {
  if (!["calibrated", "acknowledged", "closed"].includes(target)) return [];
  const issues: string[] = [];
  if (!Array.isArray(value.metricIds) || value.metricIds.length === 0)
    issues.push("role scorecard metric");
  if (!Array.isArray(value.evidenceIds) || value.evidenceIds.length === 0)
    issues.push("verified work evidence");
  return issues;
}
export function developmentPlanAdvancementIssues(
  value: { evidenceIds?: unknown },
  target: string,
): string[] {
  return target === "completed" &&
    (!Array.isArray(value.evidenceIds) || value.evidenceIds.length === 0)
    ? ["verified development evidence"]
    : [];
}
export function roleSupportPlanAdvancementIssues(
  value: { evidenceIds?: unknown },
  target: string,
): string[] {
  return target === "completed" &&
    (!Array.isArray(value.evidenceIds) || value.evidenceIds.length === 0)
    ? ["verified support evidence"]
    : [];
}
export function careerPathAdvancementIssues(
  value: {
    businessNeed?: string;
    seatAvailability?: string;
    evidenceIds?: unknown;
  },
  target: string,
): string[] {
  if (!["evidence_ready", "endorsed"].includes(target)) return [];
  const issues: string[] = [];
  if (!Array.isArray(value.evidenceIds) || value.evidenceIds.length === 0)
    issues.push("verified transition evidence");
  if (target === "endorsed") {
    if (!value.businessNeed?.trim()) issues.push("real business need");
    if (!['available', 'not_required'].includes(value.seatAvailability || 'unknown'))
      issues.push("available seat or explicit no-seat requirement");
  }
  return issues;
}
export function successionAdvancementIssues(
  value: { readinessWindow?: string; evidenceIds?: unknown },
  target: string,
): string[] {
  if (!["ready", "selected"].includes(target)) return [];
  const issues: string[] = [];
  if (
    !value.readinessWindow ||
    ["unassessed", "not_ready"].includes(value.readinessWindow)
  )
    issues.push("positive readiness window");
  if (!Array.isArray(value.evidenceIds) || value.evidenceIds.length === 0)
    issues.push("verified readiness evidence");
  return issues;
}

export const talentNeedStates = [
  "identified",
  "validated",
  "open",
  "paused",
  "filled",
  "closed",
] as const;
export const talentApplicationStates = [
  "invited",
  "intake_started",
  "intake_submitted",
  "assessments_incomplete",
  "assessments_complete",
  "internal_review",
  "interview_ready",
  "trial_recommended",
  "trial_active",
  "decision",
  "onboarding",
  "activated",
  "rejected",
  "hold",
  "withdrawn",
] as const;
export const talentAssessmentStates = [
  "planned",
  "candidate_action",
  "submitted",
  "verified",
  "reviewed",
  "waived",
  "cancelled",
] as const;
export const talentPlacementStates = [
  "pending",
  "offer_approved",
  "offer_accepted",
  "offer_declined",
  "rejected",
  "hold",
  "onboarding",
  "activated",
  "withdrawn",
] as const;
export const talentReviewPacketStates = [
  "draft",
  "ready_for_review",
  "in_review",
  "signed_off",
  "superseded",
  "cancelled",
] as const;
export const talentFitConfidence = [
  "insufficient",
  "emerging",
  "supported",
  "contradicted",
] as const;
export const talentReviewRecommendations = [
  "collect_more_evidence",
  "interview_ready",
  "trial_recommended",
  "decision_ready",
  "hold",
  "do_not_advance_recommendation",
] as const;
export const talentTrialStates = [
  "draft",
  "approved",
  "offered",
  "accepted",
  "active",
  "submitted",
  "under_review",
  "passed",
  "redirected",
  "extended",
  "failed",
  "declined",
  "cancelled",
] as const;
export const talentTrialOutcomes = ["pass", "redirect", "extend", "fail"] as const;
export const talentAssessmentTypes = [
  "eligibility",
  "evidence_review",
  "structured_interview",
  "work_sample",
  "simulation",
  "reference",
  "skills_test",
  "job_relevant_cognitive",
  "consented_contextual",
  "paid_trial",
  "other",
] as const;
export const talentSchedulingKinds = [
  "intro",
  "interview",
  "work_sample",
  "trial",
  "decision_conversation",
] as const;
export const talentSchedulingStates = [
  "proposed",
  "accepted",
  "alternative_requested",
  "declined",
  "cancelled",
  "completed",
] as const;
const talentTextList = z
  .array(z.string().trim().min(1).max(2000))
  .max(200)
  .default([]);
const talentIdList = z.array(z.string().uuid()).max(500).default([]);
const talentBase = z.object({
  sourceAuthority: z
    .enum([
      "native_eos",
      "notion_runtime",
      "external_authoritative",
      "reconciled",
    ])
    .default("native_eos"),
  classification: z
    .enum(["confidential", "restricted"])
    .default("confidential"),
});

const talentNeedFields = talentBase.extend({
  title: z.string().trim().min(2).max(300),
  targetSeatId: z.string().uuid().optional(),
  capabilityInstanceId: z.string().uuid().optional(),
  ownerSeatId: z.string().uuid().optional(),
  urgency: z.enum(["planned", "soon", "urgent", "critical"]).default("planned"),
  rationale: z.string().trim().min(3).max(8000),
  requiredOutcomes: talentTextList,
  requiredNow: z.boolean().default(false),
  budgetConstraint: z.string().trim().max(2000).default(""),
  evidenceIds: talentIdList,
});
export const talentNeedCreateSchema = talentNeedFields;
export const talentNeedUpdateSchema = talentNeedFields
  .omit({ sourceAuthority: true, ownerSeatId: true })
  .partial()
  .extend({ state: z.enum(talentNeedStates).optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one talent-need field is required.",
  );

const talentApplicationFields = talentBase.extend({
  candidateName: z.string().trim().min(2).max(300),
  identityReference: z.string().trim().min(3).max(1000),
  consentLegalBasis: z.string().trim().min(3).max(2000),
  candidateUserId: z.string().min(1).max(200).optional(),
  talentNeedId: z.string().uuid(),
  targetSeatId: z.string().uuid().optional(),
  ownerSeatId: z.string().uuid().optional(),
  candidateSummary: z.string().trim().max(8000).default(""),
  candidateData: z.record(z.unknown()).default({}),
  candidateCorrection: z.string().trim().max(8000).default(""),
  correctionStatus: z
    .enum(["none", "requested", "resolved", "rejected"])
    .default("none"),
  consentState: z
    .enum(["pending", "granted", "limited", "withdrawn"])
    .default("pending"),
  consentScope: talentTextList,
  roleHypotheses: talentTextList,
  proofGaps: talentTextList,
  internalNotes: z.string().trim().max(12000).default(""),
  evidenceIds: talentIdList,
});
export const talentApplicationCreateSchema = talentApplicationFields;
export const talentApplicationUpdateSchema = talentApplicationFields
  .omit({
    sourceAuthority: true,
    candidateName: true,
    identityReference: true,
    consentLegalBasis: true,
    candidateUserId: true,
    talentNeedId: true,
    ownerSeatId: true,
  })
  .partial()
  .extend({ state: z.enum(talentApplicationStates).optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one talent-application field is required.",
  );

const talentAssessmentFields = talentBase.extend({
  applicationId: z.string().uuid(),
  assessmentType: z.enum(talentAssessmentTypes),
  title: z.string().trim().min(2).max(300),
  decisionQuestion: z.string().trim().min(3).max(4000),
  evidenceExpected: z.string().trim().min(3).max(4000),
  validityScope: z.string().trim().max(4000).default(""),
  candidateBurden: z.string().trim().max(2000).default(""),
  candidateSubmission: z.string().trim().max(12000).default(""),
  internalEvaluation: z.string().trim().max(12000).default(""),
  consentRequired: z.boolean().default(false),
  consentCaptured: z.boolean().default(false),
  evidenceIds: talentIdList,
});
export const talentAssessmentCreateSchema = talentAssessmentFields;
export const talentAssessmentUpdateSchema = talentAssessmentFields
  .omit({ sourceAuthority: true, applicationId: true, assessmentType: true })
  .partial()
  .extend({ state: z.enum(talentAssessmentStates).optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one talent-assessment field is required.",
  );

export const talentRoleFitAssessmentSchema = z.object({
  roleHypothesis: z.string().trim().min(2).max(300),
  confidence: z.enum(talentFitConfidence).default("insufficient"),
  evidenceForIds: talentIdList,
  evidenceAgainstIds: talentIdList,
  unresolvedQuestions: talentTextList,
});
export const talentOutcomeCoverageSchema = z.object({
  outcome: z.string().trim().min(2).max(1000),
  evidenceIds: talentIdList,
});
export const talentNextAssessmentSchema = z.object({
  assessmentType: z.enum(talentAssessmentTypes),
  title: z.string().trim().min(2).max(300),
  decisionQuestion: z.string().trim().min(3).max(4000),
  evidenceExpected: z.string().trim().min(3).max(4000),
  candidateBurden: z.string().trim().max(2000).default(""),
  rationale: z.string().trim().min(3).max(4000),
  consentRequired: z.boolean().default(false),
});
const talentReviewPacketFields = talentBase.extend({
  applicationId: z.string().uuid(),
  packetSummary: z.string().trim().min(3).max(12000),
  roleAssessments: z.array(talentRoleFitAssessmentSchema).min(1).max(8),
  outcomeCoverage: z.array(talentOutcomeCoverageSchema).max(50).default([]),
  proofGaps: talentTextList,
  nextAssessment: talentNextAssessmentSchema.nullable().default(null),
  interviewFocus: talentTextList,
  teamFitQuestions: talentTextList,
  classification: z.enum(["confidential", "restricted"]).default("restricted"),
});
export const talentReviewPacketCreateSchema = talentReviewPacketFields;
export const talentReviewPacketUpdateSchema = talentReviewPacketFields
  .omit({ sourceAuthority: true, applicationId: true })
  .partial()
  .extend({
    state: z.enum(talentReviewPacketStates).optional(),
    reviewerDecision: z.enum(talentReviewRecommendations).optional(),
    reviewerRationale: z.string().trim().max(12000).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one review-packet field is required.",
  );

export const talentTrialScorecardDefinitionSchema = z.object({
  dimension: z.string().trim().min(2).max(300),
  successAnchor: z.string().trim().min(3).max(2000),
  weight: z.number().int().min(1).max(100).default(1),
});
export const talentTrialScorecardObservationSchema = z.object({
  dimension: z.string().trim().min(2).max(300),
  rating: z.enum(["not_observed", "below", "meets", "exceeds"]),
  evidenceIds: talentIdList,
  notes: z.string().trim().min(3).max(4000),
});
export const talentTrialOutcomeCriteriaSchema = z.object({
  pass: z.string().trim().min(3).max(2000),
  redirect: z.string().trim().min(3).max(2000),
  extend: z.string().trim().min(3).max(2000),
  fail: z.string().trim().min(3).max(2000),
});
const talentTrialFields = talentBase.extend({
  applicationId: z.string().uuid(),
  targetSeatId: z.string().uuid(),
  title: z.string().trim().min(3).max(300),
  question: z.string().trim().min(3).max(4000),
  durationDays: z.number().int().min(1).max(30),
  compensationAmountMinor: z.number().int().positive().max(1_000_000_000),
  compensationCurrency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  compensationTerms: z.string().trim().min(3).max(4000),
  legalAgreementReference: z.string().trim().min(3).max(2000),
  jurisdiction: z.string().trim().min(2).max(300),
  inputsSupport: talentTextList.refine((items) => items.length > 0, "Trial support is required."),
  requiredOutputs: talentTextList.refine((items) => items.length > 0, "Trial outputs are required."),
  scorecard: z.array(talentTrialScorecardDefinitionSchema).min(1).max(20),
  constraintsDecisionRights: talentTextList.refine((items) => items.length > 0, "Trial constraints are required."),
  observationPoints: talentTextList.refine((items) => items.length > 0, "Observation points are required."),
  reviewAt: z.string().datetime(),
  outcomeCriteria: talentTrialOutcomeCriteriaSchema,
  predictedOutcome: z.string().trim().min(3).max(4000),
  predictedConfidence: z.enum(talentFitConfidence).default("insufficient"),
  candidateInstructions: z.string().trim().min(3).max(8000),
  classification: z.enum(["confidential", "restricted"]).default("restricted"),
});
export const talentTrialCreateSchema = talentTrialFields.superRefine((value, context) => {
  const dimensions = value.scorecard.map((item) => item.dimension.toLowerCase());
  if (new Set(dimensions).size !== dimensions.length)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Trial scorecard dimensions must be unique",
      path: ["scorecard"],
    });
});
export const talentTrialUpdateSchema = z
  .object({
    state: z.enum(talentTrialStates),
    scorecardObservations: z.array(talentTrialScorecardObservationSchema).max(20).optional(),
    outcomeEvidenceIds: talentIdList.optional(),
    actualOutcomeSummary: z.string().trim().max(12000).optional(),
    reviewerRationale: z.string().trim().max(12000).optional(),
    candidateFeedback: z.string().trim().max(8000).optional(),
    learningProposal: z.string().trim().max(12000).optional(),
  })
  .superRefine((value, context) => {
    const outcomeFields = [
      value.scorecardObservations,
      value.outcomeEvidenceIds,
      value.actualOutcomeSummary,
      value.reviewerRationale,
      value.candidateFeedback,
      value.learningProposal,
    ];
    if (
      !["passed", "redirected", "extended", "failed"].includes(value.state) &&
      outcomeFields.some((field) => field !== undefined)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Trial outcome fields may be recorded only with a human outcome",
      });
  });

const talentPlacementFields = talentBase.extend({
  applicationId: z.string().uuid(),
  targetSeatId: z.string().uuid(),
  decidedBySeatId: z.string().uuid().optional(),
  rationale: z.string().trim().min(3).max(8000),
  offerSummary: z.string().trim().max(8000).default(""),
  candidateResponse: z.string().trim().max(8000).default(""),
  onboardingChecklist: talentTextList,
  accessPlan: talentTextList,
  assignmentId: z.string().uuid().optional(),
  evidenceIds: talentIdList,
  classification: z.enum(["confidential", "restricted"]).default("restricted"),
});
export const talentPlacementCreateSchema = talentPlacementFields;
export const talentPlacementUpdateSchema = talentPlacementFields
  .omit({ sourceAuthority: true, applicationId: true, decidedBySeatId: true })
  .partial()
  .extend({ state: z.enum(talentPlacementStates).optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one talent-placement field is required.",
  );

export const talentSchedulingCreateSchema = z.object({
  applicationId: z.string().uuid(),
  schedulingKind: z.enum(talentSchedulingKinds).default("interview"),
  proposedSlots: z.array(z.string().datetime()).min(1).max(10),
  schedulingUrl: z
    .union([z.literal(""), z.string().url().startsWith("https://")])
    .default(""),
  durationMinutes: z.number().int().min(15).max(240).default(45),
  teamNote: z.string().trim().max(2_000).default(""),
  sourceSystem: z
    .enum(["native_eos", "google_calendar", "external_scheduling"])
    .default("native_eos"),
  externalEventReference: z.string().trim().max(1_000).optional(),
});
export const talentSchedulingUpdateSchema = z
  .object({
    state: z.enum(["cancelled", "completed"]).optional(),
    proposedSlots: z.array(z.string().datetime()).min(1).max(10).optional(),
    schedulingUrl: z
      .union([z.literal(""), z.string().url().startsWith("https://")])
      .optional(),
    teamNote: z.string().trim().max(2_000).optional(),
    sourceSystem: z
      .enum(["native_eos", "google_calendar", "external_scheduling"])
      .optional(),
    externalEventReference: z.string().trim().max(1_000).nullable().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one scheduling field is required.",
  );

const talentNeedTransitions: Record<
  (typeof talentNeedStates)[number],
  readonly (typeof talentNeedStates)[number][]
> = {
  identified: ["validated", "closed"],
  validated: ["open", "closed"],
  open: ["paused", "filled", "closed"],
  paused: ["open", "closed"],
  filled: ["closed"],
  closed: [],
};
const talentApplicationTransitions: Record<
  (typeof talentApplicationStates)[number],
  readonly (typeof talentApplicationStates)[number][]
> = {
  invited: ["intake_started", "withdrawn"],
  intake_started: ["intake_submitted", "withdrawn"],
  intake_submitted: ["assessments_incomplete", "internal_review", "withdrawn"],
  assessments_incomplete: ["assessments_complete", "hold", "withdrawn"],
  assessments_complete: ["internal_review", "withdrawn"],
  internal_review: ["interview_ready", "rejected", "hold", "withdrawn"],
  interview_ready: [
    "trial_recommended",
    "decision",
    "rejected",
    "hold",
    "withdrawn",
  ],
  trial_recommended: [
    "trial_active",
    "decision",
    "rejected",
    "hold",
    "withdrawn",
  ],
  trial_active: ["decision", "hold", "withdrawn"],
  decision: ["onboarding", "rejected", "hold", "withdrawn"],
  onboarding: ["activated", "hold", "withdrawn"],
  activated: [],
  rejected: [],
  hold: ["internal_review", "withdrawn"],
  withdrawn: [],
};
const talentAssessmentTransitions: Record<
  (typeof talentAssessmentStates)[number],
  readonly (typeof talentAssessmentStates)[number][]
> = {
  planned: ["candidate_action", "waived", "cancelled"],
  candidate_action: ["submitted", "waived", "cancelled"],
  submitted: ["verified", "candidate_action", "cancelled"],
  verified: ["reviewed"],
  reviewed: [],
  waived: [],
  cancelled: [],
};
const talentPlacementTransitions: Record<
  (typeof talentPlacementStates)[number],
  readonly (typeof talentPlacementStates)[number][]
> = {
  pending: ["offer_approved", "rejected", "hold", "withdrawn"],
  offer_approved: ["offer_accepted", "offer_declined", "withdrawn"],
  offer_accepted: ["onboarding", "withdrawn"],
  offer_declined: [],
  rejected: [],
  hold: ["pending", "withdrawn"],
  onboarding: ["activated", "hold", "withdrawn"],
  activated: [],
  withdrawn: [],
};
const talentReviewPacketTransitions: Record<
  (typeof talentReviewPacketStates)[number],
  readonly (typeof talentReviewPacketStates)[number][]
> = {
  draft: ["ready_for_review", "cancelled"],
  ready_for_review: ["draft", "in_review", "cancelled"],
  in_review: ["draft", "signed_off", "cancelled"],
  signed_off: ["superseded"],
  superseded: [],
  cancelled: [],
};
const talentTrialTransitions: Record<
  (typeof talentTrialStates)[number],
  readonly (typeof talentTrialStates)[number][]
> = {
  draft: ["approved", "cancelled"],
  approved: ["offered", "cancelled"],
  offered: ["accepted", "declined", "cancelled"],
  accepted: ["active", "cancelled"],
  active: ["submitted", "cancelled"],
  submitted: ["under_review", "cancelled"],
  under_review: ["passed", "redirected", "extended", "failed"],
  passed: [],
  redirected: [],
  extended: [],
  failed: [],
  declined: [],
  cancelled: [],
};
export function canTransitionTalentNeed(
  from: (typeof talentNeedStates)[number],
  to: (typeof talentNeedStates)[number],
) {
  return talentNeedTransitions[from].includes(to);
}
export function canTransitionTalentApplication(
  from: (typeof talentApplicationStates)[number],
  to: (typeof talentApplicationStates)[number],
) {
  return talentApplicationTransitions[from].includes(to);
}
export function canTransitionTalentAssessment(
  from: (typeof talentAssessmentStates)[number],
  to: (typeof talentAssessmentStates)[number],
) {
  return talentAssessmentTransitions[from].includes(to);
}
export function canTransitionTalentPlacement(
  from: (typeof talentPlacementStates)[number],
  to: (typeof talentPlacementStates)[number],
) {
  return talentPlacementTransitions[from].includes(to);
}
export function canTransitionTalentReviewPacket(
  from: (typeof talentReviewPacketStates)[number],
  to: (typeof talentReviewPacketStates)[number],
) {
  return talentReviewPacketTransitions[from].includes(to);
}
export function canTransitionTalentTrial(
  from: (typeof talentTrialStates)[number],
  to: (typeof talentTrialStates)[number],
) {
  return talentTrialTransitions[from].includes(to);
}
export function nextTalentNeedStates(state: (typeof talentNeedStates)[number]) {
  return talentNeedTransitions[state];
}
export function nextTalentApplicationStates(
  state: (typeof talentApplicationStates)[number],
) {
  return talentApplicationTransitions[state];
}
export function nextTalentAssessmentStates(
  state: (typeof talentAssessmentStates)[number],
) {
  return talentAssessmentTransitions[state];
}
export function nextTalentPlacementStates(
  state: (typeof talentPlacementStates)[number],
) {
  return talentPlacementTransitions[state];
}
export function nextTalentReviewPacketStates(
  state: (typeof talentReviewPacketStates)[number],
) {
  return talentReviewPacketTransitions[state];
}
export function nextTalentTrialStates(state: (typeof talentTrialStates)[number]) {
  return talentTrialTransitions[state];
}
export function talentApplicationAdvancementIssues(
  value: { consentState?: string; evidenceIds?: unknown },
  target: string,
  reviewedAssessmentCount = 0,
  signedReviewPacketCount = 0,
  acceptedTrialCount = 0,
  completedTrialCount = 0,
  sourceState = "",
): string[] {
  const issues: string[] = [];
  if (
    [
      "assessments_complete",
      "internal_review",
      "interview_ready",
      "trial_recommended",
      "trial_active",
      "decision",
      "onboarding",
      "activated",
    ].includes(target) &&
    !["granted", "limited"].includes(value.consentState || "")
  )
    issues.push("candidate consent");
  if (
    [
      "assessments_complete",
      "internal_review",
      "interview_ready",
      "trial_recommended",
      "trial_active",
      "decision",
    ].includes(target) &&
    reviewedAssessmentCount < 1
  )
    issues.push("reviewed assessment");
  if (
    [
      "interview_ready",
      "trial_recommended",
      "trial_active",
      "decision",
      "onboarding",
      "activated",
    ].includes(target) &&
    signedReviewPacketCount < 1
  )
    issues.push("signed human review packet");
  if (target === "trial_active" && acceptedTrialCount < 1)
    issues.push("accepted approved trial");
  if (
    target === "decision" &&
    sourceState === "trial_active" &&
    completedTrialCount < 1
  )
    issues.push("human-reviewed trial outcome");
  if (
    ["decision", "onboarding", "activated"].includes(target) &&
    (!Array.isArray(value.evidenceIds) || value.evidenceIds.length === 0)
  )
    issues.push("verified decision evidence");
  return issues;
}

export function talentTrialAdvancementIssues(
  value: {
    state?: string;
    approvalStatus?: string;
    acceptedAt?: Date | string | null;
    candidateSubmission?: string | null;
    candidateEvidenceIds?: unknown;
    scorecard?: unknown;
    scorecardObservations?: unknown;
    outcomeEvidenceIds?: unknown;
    actualOutcomeSummary?: string | null;
    reviewerRationale?: string | null;
    candidateFeedback?: string | null;
    learningProposal?: string | null;
  },
  target: string,
  verifiedOutcomeEvidenceCount = 0,
): string[] {
  const issues: string[] = [];
  if (target === "offered" && value.approvalStatus !== "approved")
    issues.push("approved trial Work Packet");
  if (target === "active" && !value.acceptedAt)
    issues.push("candidate acceptance");
  if (target === "under_review") {
    if (!value.candidateSubmission?.trim()) issues.push("candidate trial submission");
    if (!Array.isArray(value.candidateEvidenceIds) || !value.candidateEvidenceIds.length)
      issues.push("candidate trial evidence");
  }
  if (["passed", "redirected", "extended", "failed"].includes(target)) {
    const definitions = Array.isArray(value.scorecard) ? value.scorecard : [];
    const observations = Array.isArray(value.scorecardObservations)
      ? value.scorecardObservations
      : [];
    const observed = new Set(
      observations
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item) => String(item.dimension || "")),
    );
    if (observed.size !== observations.length)
      issues.push("one scorecard observation per dimension");
    const defined = new Set(
      definitions
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item) => String(item.dimension || "")),
    );
    for (const observation of observations) {
      if (!observation || typeof observation !== "object") continue;
      const item = observation as Record<string, unknown>;
      if (!defined.has(String(item.dimension || "")))
        issues.push("scorecard observations limited to defined dimensions");
      const observationEvidence = Array.isArray(item.evidenceIds) ? item.evidenceIds.map(String) : [];
      if (!observationEvidence.length)
        issues.push(`observation evidence: ${String(item.dimension || "unnamed")}`);
      const outcomeEvidence = Array.isArray(value.outcomeEvidenceIds)
        ? value.outcomeEvidenceIds.map(String)
        : [];
      if (observationEvidence.some((id) => !outcomeEvidence.includes(id)))
        issues.push("observation evidence included in trial outcome evidence");
    }
    for (const definition of definitions) {
      if (
        definition &&
        typeof definition === "object" &&
        !observed.has(String((definition as Record<string, unknown>).dimension || ""))
      )
        issues.push(`scorecard observation: ${String((definition as Record<string, unknown>).dimension || "unnamed")}`);
    }
    if (!Array.isArray(value.outcomeEvidenceIds) || !value.outcomeEvidenceIds.length)
      issues.push("trial outcome evidence");
    else if (verifiedOutcomeEvidenceCount !== value.outcomeEvidenceIds.length)
      issues.push("verified trial outcome evidence");
    if (!value.actualOutcomeSummary?.trim()) issues.push("actual outcome summary");
    if (!value.reviewerRationale?.trim()) issues.push("human reviewer rationale");
    if (!value.candidateFeedback?.trim()) issues.push("candidate feedback");
    if (!value.learningProposal?.trim()) issues.push("predicted-versus-actual learning proposal");
  }
  return Array.from(new Set(issues));
}
export function talentAssessmentAdvancementIssues(
  value: {
    consentRequired?: boolean;
    consentCaptured?: boolean;
    evidenceIds?: unknown;
  },
  target: string,
): string[] {
  const issues: string[] = [];
  if (
    ["submitted", "verified", "reviewed"].includes(target) &&
    value.consentRequired &&
    !value.consentCaptured
  )
    issues.push("captured assessment consent");
  if (
    ["verified", "reviewed"].includes(target) &&
    (!Array.isArray(value.evidenceIds) || value.evidenceIds.length === 0)
  )
    issues.push("assessment evidence");
  return issues;
}
export function talentPlacementAdvancementIssues(
  value: {
    assignmentId?: string | null;
    evidenceIds?: unknown;
    onboardingChecklist?: unknown;
    accessPlan?: unknown;
  },
  target: string,
): string[] {
  const issues: string[] = [];
  if (
    ["offer_approved", "offer_accepted", "onboarding", "activated"].includes(
      target,
    ) &&
    (!Array.isArray(value.evidenceIds) || value.evidenceIds.length === 0)
  )
    issues.push("verified placement evidence");
  if (
    ["onboarding", "activated"].includes(target) &&
    (!Array.isArray(value.onboardingChecklist) ||
      value.onboardingChecklist.length === 0)
  )
    issues.push("onboarding checklist");
  if (
    target === "activated" &&
    (!Array.isArray(value.accessPlan) || value.accessPlan.length === 0)
  )
    issues.push("least-privilege access plan");
  if (target === "activated" && !value.assignmentId)
    issues.push("explicit seat assignment");
  return issues;
}

export function talentReviewPacketReadinessIssues(
  value: {
    roleHypothesesSnapshot?: unknown;
    requiredOutcomesSnapshot?: unknown;
    roleAssessments?: unknown;
    outcomeCoverage?: unknown;
    proofGaps?: unknown;
    nextAssessment?: unknown;
    verifiedEvidenceIds?: unknown;
    packetSummary?: string;
    interviewFocus?: unknown;
    teamFitQuestions?: unknown;
    reviewerDecision?: string | null;
    reviewerRationale?: string | null;
  },
  target = "ready_for_review",
): string[] {
  if (!["ready_for_review", "in_review", "signed_off"].includes(target))
    return [];
  const issues: string[] = [];
  const roles = Array.isArray(value.roleHypothesesSnapshot)
    ? value.roleHypothesesSnapshot.map(String)
    : [];
  const roleAssessments = Array.isArray(value.roleAssessments)
    ? (value.roleAssessments as Array<Record<string, unknown>>)
    : [];
  const assessedRoles = new Set(
    roleAssessments.map((item) => String(item.roleHypothesis || "")),
  );
  if (!roles.length) issues.push("at least one current role hypothesis");
  if (roles.some((role) => !assessedRoles.has(role)))
    issues.push("a fit assessment for every current role hypothesis");
  const verified = new Set(
    Array.isArray(value.verifiedEvidenceIds)
      ? value.verifiedEvidenceIds.map(String)
      : [],
  );
  if (!verified.size) issues.push("at least one verified work-evidence item");
  for (const role of roleAssessments) {
    const confidence = String(role.confidence || "insufficient");
    const evidence = [
      ...(Array.isArray(role.evidenceForIds) ? role.evidenceForIds : []),
      ...(Array.isArray(role.evidenceAgainstIds)
        ? role.evidenceAgainstIds
        : []),
    ].map(String);
    if (
      ["supported", "contradicted"].includes(confidence) &&
      !evidence.some((id) => verified.has(id))
    )
      issues.push(
        `verified evidence for the ${String(role.roleHypothesis || "role")} conclusion`,
      );
  }
  const outcomes = Array.isArray(value.requiredOutcomesSnapshot)
    ? value.requiredOutcomesSnapshot.map(String)
    : [];
  const coverage = Array.isArray(value.outcomeCoverage)
    ? (value.outcomeCoverage as Array<Record<string, unknown>>)
    : [];
  const coverageByOutcome = new Map(
    coverage.map((item) => [
      String(item.outcome || ""),
      Array.isArray(item.evidenceIds) ? item.evidenceIds.map(String) : [],
    ]),
  );
  for (const outcome of outcomes)
    if (!(coverageByOutcome.get(outcome) || []).some((id) => verified.has(id)))
      issues.push(`verified evidence covering outcome: ${outcome}`);
  if (
    Array.isArray(value.proofGaps) &&
    value.proofGaps.length > 0 &&
    !value.nextAssessment
  )
    issues.push("the smallest next assessment for unresolved proof gaps");
  if (!value.packetSummary?.trim()) issues.push("human review summary");
  if (!Array.isArray(value.interviewFocus) || value.interviewFocus.length === 0)
    issues.push("human interview focus");
  if (
    !Array.isArray(value.teamFitQuestions) ||
    value.teamFitQuestions.length === 0
  )
    issues.push("team-fit questions without automated scoring");
  if (target === "signed_off") {
    if (!value.reviewerDecision) issues.push("human reviewer recommendation");
    if (!value.reviewerRationale?.trim())
      issues.push("human reviewer rationale");
  }
  return Array.from(new Set(issues));
}

export const membershipInvitationCreateSchema = z.object({
  email: z.string().trim().email().max(320),
  seatId: z.string().uuid(),
  talentApplicationId: z.string().uuid().optional(),
  purpose: z.string().min(1).max(100).default("operate"),
  classificationCeiling: z
    .enum(["public", "internal", "confidential", "restricted"])
    .default("internal"),
  portfolioScope: z.boolean().default(false),
});

export const membershipInvitationTokenSchema = z.object({
  token: z.string().min(32).max(512),
});

export const seatCreateSchema = z.object({
  title: z.string().min(1).max(120),
  kind: z.enum([
    "portfolio_executive",
    "company_ceo",
    "functional_executive",
    "manager",
    "individual_contributor",
    "external",
  ]),
  supervisorSeatId: z.string().uuid().optional(),
  occupantUserId: z.string().min(1).optional(),
  agentName: z.string().min(1).max(80),
  mandate: z.string().max(2000).default(""),
  authority: z.record(z.unknown()).default({}),
  toolEntitlements: z.array(z.string().min(1).max(120)).max(100).default([]),
});

export const authoritySubjectTypes = [
  "agent",
  "team",
  "provider",
  "service_account",
  "governing_body",
] as const;
export type AuthoritySubjectType = (typeof authoritySubjectTypes)[number];
export const authoritySubjectAgentClasses = [
  "executive_assistant",
  "advisor_agent",
  "ceo_agent",
  "role_agent",
  "sub_agent",
] as const;

const authoritySubjectBaseSchema = z.object({
  subjectKey: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9:._-]*$/),
  displayName: z.string().trim().min(1).max(200),
  ownerUserId: z.string().min(1).max(200).optional(),
  supervisorSeatId: z.string().uuid().optional(),
  externalIdentityKey: z.string().trim().min(1).max(500).optional(),
  sourceAuthority: z.string().trim().min(1).max(500),
  governanceContract: z.record(z.unknown()).default({}),
  evidenceReferences: z.array(z.string().min(1).max(2000)).max(100).default([]),
  classificationCeiling: z
    .enum([
      "public",
      "internal",
      "confidential",
      "restricted",
      "highly_restricted",
    ])
    .default("internal"),
  effectiveFrom: z.string().datetime().optional(),
  effectiveUntil: z.string().datetime().optional(),
  reviewAt: z.string().datetime().optional(),
});

const agentSubjectSchema = authoritySubjectBaseSchema.extend({
  subjectType: z.literal("agent"),
  seatId: z.string().uuid().optional(),
  parentSubjectId: z.string().min(1).max(200).optional(),
  agentClass: z.enum(authoritySubjectAgentClasses),
  identityAttributes: z.object({
    operatingMode: z.enum([
      "autonomous",
      "founder_supervised",
      "human_led_assistant",
      "advisory",
      "approval_gated",
      "restricted_observation",
      "dormant",
      "emergency_fallback",
    ]),
    workforceRoleMode: z.enum([
      "primary_role_operator",
      "human_employee_assistant",
      "human_ceo_assistant",
      "provider_liaison",
      "shadow_training",
      "transitioning",
      "nested_specialist",
      "dormant",
    ]),
    memoryScope: z.string().trim().min(1).max(1000),
    modelRuntime: z.string().trim().min(1).max(500),
    humanFallbackUserId: z.string().min(1).max(200),
    patternKey: z.string().trim().min(1).max(200).optional(),
    patternVersion: z.string().trim().min(1).max(100).optional(),
    permittedTools: z
      .array(z.string().trim().min(1).max(200))
      .max(100)
      .default([]),
  }),
});

const teamSubjectSchema = authoritySubjectBaseSchema.extend({
  subjectType: z.literal("team"),
  seatId: z.string().uuid().optional(),
  identityAttributes: z.object({
    teamKind: z.enum([
      "functional",
      "cross_functional",
      "project",
      "shared_service",
      "external",
    ]),
    memberPrincipalIds: z.array(z.string().min(1).max(200)).min(1).max(500),
    charterReference: z.string().trim().min(1).max(2000),
    decisionMode: z.enum([
      "manager",
      "consensus",
      "majority",
      "unanimous",
      "advisory",
    ]),
  }),
});

const providerSubjectSchema = authoritySubjectBaseSchema.extend({
  subjectType: z.literal("provider"),
  seatId: z.string().uuid().optional(),
  identityAttributes: z.object({
    providerKind: z.enum([
      "vendor",
      "contractor",
      "professional_service",
      "shared_service",
      "platform",
    ]),
    legalName: z.string().trim().min(1).max(300),
    agreementReference: z.string().trim().min(1).max(2000),
    providerSystemKeys: z
      .array(z.string().trim().min(1).max(300))
      .max(100)
      .default([]),
  }),
});

const serviceAccountSubjectSchema = authoritySubjectBaseSchema.extend({
  subjectType: z.literal("service_account"),
  seatId: z.string().uuid().optional(),
  identityAttributes: z.object({
    providerKey: z.string().trim().min(1).max(200),
    externalAccountReference: z.string().trim().min(1).max(500),
    environment: z.enum(["development", "test", "staging", "production"]),
    credentialReference: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .regex(
        /^(op|vault|aws-secretsmanager|gcp-secret-manager|azure-key-vault):\/\/[A-Za-z0-9._~!$&'()*+,;=:@%\/ -]+$/,
        "Use a secret-manager reference such as op://vault/item/field; never submit a credential value.",
      ),
    rotationOwnerUserId: z.string().min(1).max(200),
  }),
});

const governingBodySubjectSchema = authoritySubjectBaseSchema.extend({
  subjectType: z.literal("governing_body"),
  seatId: z.string().uuid().optional(),
  identityAttributes: z
    .object({
      bodyKind: z.enum([
        "board",
        "committee",
        "council",
        "investment_committee",
        "compensation_committee",
      ]),
      charterReference: z.string().trim().min(1).max(2000),
      memberPrincipalIds: z.array(z.string().min(1).max(200)).min(1).max(100),
      quorum: z.number().int().min(1).max(100),
      conflictPolicyReference: z.string().trim().min(1).max(2000),
    })
    .superRefine((profile, context) => {
      if (profile.quorum > profile.memberPrincipalIds.length)
        context.addIssue({
          code: "custom",
          path: ["quorum"],
          message: "Quorum cannot exceed the registered member count.",
        });
    }),
});

export const authoritySubjectCreateSchema = z
  .discriminatedUnion("subjectType", [
    agentSubjectSchema,
    teamSubjectSchema,
    providerSubjectSchema,
    serviceAccountSubjectSchema,
    governingBodySubjectSchema,
  ])
  .superRefine((subject, context) => {
    if (
      subject.effectiveFrom &&
      subject.effectiveUntil &&
      new Date(subject.effectiveUntil) <= new Date(subject.effectiveFrom)
    )
      context.addIssue({
        code: "custom",
        path: ["effectiveUntil"],
        message: "Effective Until must be later than Effective From.",
      });
    if (
      subject.subjectType === "agent" &&
      subject.agentClass !== "advisor_agent" &&
      !subject.seatId
    )
      context.addIssue({
        code: "custom",
        path: ["seatId"],
        message: "This agent class requires an exact organizational seat.",
      });
    if (
      subject.subjectType === "agent" &&
      subject.agentClass === "sub_agent" &&
      !subject.parentSubjectId
    )
      context.addIssue({
        code: "custom",
        path: ["parentSubjectId"],
        message: "A Sub-Agent requires one parent Agent identity.",
      });
    if (
      subject.subjectType === "agent" &&
      subject.agentClass !== "sub_agent" &&
      subject.parentSubjectId
    )
      context.addIssue({
        code: "custom",
        path: ["parentSubjectId"],
        message: "Only a Sub-Agent may declare a parent Agent.",
      });
  });

export const authoritySubjectTransitionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("verify"),
    evidenceReferences: z.array(z.string().min(1).max(2000)).min(1).max(100),
    reviewAt: z.string().datetime().optional(),
  }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().trim().min(3).max(2000),
    evidenceReferences: z.array(z.string().min(1).max(2000)).min(1).max(100),
  }),
  z.object({
    action: z.literal("activate"),
    evidenceReferences: z
      .array(z.string().min(1).max(2000))
      .max(100)
      .default([]),
    reviewAt: z.string().datetime(),
  }),
  z.object({
    action: z.literal("review"),
    evidenceReferences: z.array(z.string().min(1).max(2000)).min(1).max(100),
    reviewAt: z.string().datetime(),
  }),
  z.object({
    action: z.literal("suspend"),
    reason: z.string().trim().min(3).max(2000),
    evidenceReferences: z
      .array(z.string().min(1).max(2000))
      .max(100)
      .default([]),
  }),
  z.object({
    action: z.literal("retire"),
    reason: z.string().trim().min(3).max(2000),
    evidenceReferences: z
      .array(z.string().min(1).max(2000))
      .max(100)
      .default([]),
  }),
]);

export function authoritySubjectIsEffective(
  subject: {
    status: string;
    verificationStatus: string;
    effectiveFrom: Date | string;
    effectiveUntil?: Date | string | null;
    reviewAt?: Date | string | null;
  },
  now = new Date(),
): boolean {
  const timestamp = now.getTime();
  return (
    subject.status === "active" &&
    subject.verificationStatus === "verified" &&
    new Date(subject.effectiveFrom).getTime() <= timestamp &&
    (!subject.effectiveUntil ||
      new Date(subject.effectiveUntil).getTime() > timestamp) &&
    (!subject.reviewAt || new Date(subject.reviewAt).getTime() > timestamp)
  );
}

export const authorityClasses = [
  "view",
  "recommend",
  "execute",
  "decide",
  "approve",
  "spend",
  "sign",
  "grant_access",
  "delegate",
  "override_emergency",
] as const;
export type AuthorityClass = (typeof authorityClasses)[number];

export const positionFamilyCreateSchema = z.object({
  canonicalKey: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9][a-z0-9._-]*$/),
  name: z.string().trim().min(1).max(160),
  titleRoot: z.string().trim().min(1).max(120),
  department: z.string().trim().min(1).max(160),
  dominantResult: z.string().trim().min(3).max(1000),
  applicability: z.record(z.unknown()).default({}),
  activationConditions: z.array(z.string().min(1).max(500)).max(50).default([]),
  splitConditions: z.array(z.string().min(1).max(500)).max(50).default([]),
  trackOptions: z
    .array(z.enum(["individual_contributor", "management", "leadership"]))
    .min(1)
    .max(3)
    .default(["individual_contributor"]),
  templateAncestry: z.array(z.string().min(1).max(500)).max(50).default([]),
});

export const positionAgreementContractSchema = z.object({
  resultStatement: z.string().min(3).max(2000),
  responsibilities: z.array(z.string().min(1).max(500)).min(1).max(100),
  nonResponsibilities: z.array(z.string().min(1).max(500)).max(100).default([]),
  acceptanceStandards: z.array(z.string().min(1).max(500)).min(1).max(100),
  scorecard: z
    .array(
      z.object({
        metric: z.string().min(1).max(200),
        target: z.string().min(1).max(300),
        cadence: z.string().min(1).max(100),
      }),
    )
    .min(1)
    .max(50),
  managerRelationship: z.string().min(1).max(500),
  schedule: z.string().min(1).max(500),
  toolRequirements: z.array(z.string().min(1).max(200)).max(100).default([]),
  decisionRights: z.array(z.string().min(1).max(500)).max(100).default([]),
  authorityCeiling: z.record(z.unknown()).default({}),
  trainingRequirements: z
    .array(z.string().min(1).max(500))
    .max(100)
    .default([]),
  evidenceRequirements: z.array(z.string().min(1).max(500)).min(1).max(100),
  compensationPlaceholder: z
    .string()
    .max(500)
    .default("Defined before human employment or contractor activation."),
  promotionCriteria: z.array(z.string().min(1).max(500)).max(100).default([]),
  releaseCriteria: z.array(z.string().min(1).max(500)).max(100).default([]),
});

export const positionAgreementCreateSchema = z.object({
  positionFamilyId: z.string().min(1).max(200),
  levelCode: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(160),
  contract: positionAgreementContractSchema,
  templateAncestry: z.array(z.string().min(1).max(500)).max(50).default([]),
  activate: z.boolean().default(false),
});

export const roleOperatingPackContractSchema = z.object({
  mission: z.string().min(3).max(2000),
  responsibilities: z.array(z.string().min(1).max(500)).min(1).max(100),
  nonResponsibilities: z.array(z.string().min(1).max(500)).max(100).default([]),
  outputs: z.array(z.string().min(1).max(500)).min(1).max(100),
  acceptanceStandards: z.array(z.string().min(1).max(500)).min(1).max(100),
  scorecard: z
    .array(
      z.object({
        metric: z.string().min(1).max(200),
        target: z.string().min(1).max(300),
        cadence: z.string().min(1).max(100),
      }),
    )
    .min(1)
    .max(50),
  reviewCadence: z.string().min(1).max(100),
  authorityRequirements: z
    .array(z.enum(authorityClasses))
    .max(authorityClasses.length)
    .default([]),
  requiredTools: z.array(z.string().min(1).max(200)).max(100).default([]),
  allowedSpecialists: z.array(z.string().min(1).max(200)).max(100).default([]),
  workflows: z.array(z.string().min(1).max(300)).max(100).default([]),
  sops: z.array(z.string().min(1).max(500)).max(100).default([]),
  queueTypes: z.array(z.string().min(1).max(200)).max(100).default([]),
  meetingObligations: z.array(z.string().min(1).max(300)).max(100).default([]),
  handoffs: z.array(z.string().min(1).max(500)).max(100).default([]),
  dependencies: z.array(z.string().min(1).max(500)).max(100).default([]),
  escalationPaths: z.array(z.string().min(1).max(500)).min(1).max(100),
  exceptions: z.array(z.string().min(1).max(500)).max(100).default([]),
  trainingRequirements: z
    .array(z.string().min(1).max(500))
    .max(100)
    .default([]),
  evidenceRequirements: z.array(z.string().min(1).max(500)).min(1).max(100),
  occupancyModes: z
    .array(
      z.enum([
        "founder_held",
        "agent_operated",
        "human_led",
        "provider_led",
        "team",
        "hybrid",
      ]),
    )
    .min(1)
    .max(6),
  entryRules: z.array(z.string().min(1).max(500)).min(1).max(100),
  exitRules: z.array(z.string().min(1).max(500)).min(1).max(100),
  transferRules: z.array(z.string().min(1).max(500)).min(1).max(100),
  qualificationTests: z.array(z.string().min(1).max(500)).min(1).max(100),
});

export const roleOperatingPackUpdateSchema = z.object({
  contract: roleOperatingPackContractSchema,
  positionAgreementId: z.string().min(1).max(200).optional(),
  activate: z.boolean().default(true),
});

const authorityResourceScopeSchema = z
  .object({
    resource: z.string().trim().min(1).max(160).optional(),
    resources: z
      .array(z.string().trim().min(1).max(160))
      .min(1)
      .max(100)
      .optional(),
    seatId: z.string().uuid().optional(),
    companyId: z.number().int().positive().optional(),
  })
  .passthrough()
  .refine((scope) => Boolean(scope.resource || scope.resources?.length), {
    message: "At least one governed resource is required.",
  });

export const authorityGrantCreateSchema = z.object({
  authorityKey: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9:._-]*$/),
  granteeType: z.enum([
    "principal",
    "agent",
    "team",
    "provider",
    "seat",
    "governing_body",
    "service_account",
    "other",
  ]),
  granteeKey: z.string().trim().min(1).max(200),
  seatId: z.string().uuid().optional(),
  capabilityKey: z.string().trim().min(1).max(160).optional(),
  effect: z.enum(["allow", "deny"]).default("allow"),
  authorityClasses: z
    .array(z.enum(authorityClasses))
    .min(1)
    .max(authorityClasses.length),
  actionResourceScope: authorityResourceScopeSchema,
  ceilingThreshold: z.record(z.unknown()).default({}),
  conditions: z.array(z.string().min(1).max(1000)).max(100).default([]),
  requiredApprovals: z.array(z.string().min(1).max(500)).max(100).default([]),
  conditionRules: z.array(z.record(z.unknown())).max(100).default([]),
  approvalPolicy: z.record(z.unknown()).default({}),
  separationOfDuties: z.array(z.record(z.unknown())).max(100).default([]),
  delegable: z.boolean().default(false),
  toolEntitlements: z.array(z.string().min(1).max(200)).max(100).default([]),
  policyDecisionSource: z.string().min(1).max(1000),
  evidenceReferences: z.array(z.string().min(1).max(2000)).max(100).default([]),
  revocationDependentWork: z
    .array(z.string().min(1).max(1000))
    .max(100)
    .default([]),
  effectiveFrom: z.string().datetime().optional(),
  effectiveUntil: z.string().datetime().optional(),
  reviewAt: z.string().datetime().optional(),
  activate: z.boolean().default(false),
});

export const authorityGrantTransitionSchema = z.object({
  state: z.enum(["active", "suspended", "revoked"]),
  reason: z.string().trim().min(3).max(2000),
  evidenceReferences: z.array(z.string().min(1).max(2000)).max(100).default([]),
  reviewAt: z.string().datetime().optional(),
});

export interface AuthorityGrantCandidate {
  id: string;
  granteeType: string;
  granteeKey: string;
  granteeSubjectId?: string | null;
  seatId?: string | null;
  effect?: unknown;
  authorityClasses: unknown;
  actionResourceScope?: unknown;
  ceilingThreshold?: unknown;
  conditions?: unknown;
  requiredApprovals?: unknown;
  conditionRules?: unknown;
  approvalPolicy?: unknown;
  separationOfDuties?: unknown;
  delegable?: boolean;
  toolEntitlements: unknown;
  state: string;
  effectiveFrom: Date | string;
  effectiveUntil?: Date | string | null;
  reviewAt?: Date | string | null;
}

export function authorityGrantCoversResource(
  grant: Pick<AuthorityGrantCandidate, "actionResourceScope">,
  resource: string,
  seatId?: string,
): boolean {
  if (
    !grant.actionResourceScope ||
    typeof grant.actionResourceScope !== "object" ||
    Array.isArray(grant.actionResourceScope)
  )
    return false;
  const scope = grant.actionResourceScope as Record<string, unknown>;
  const resources = Array.isArray(scope.resources)
    ? scope.resources
    : [scope.resource];
  const resourceCovered = resources.some(
    (candidate) => candidate === "*" || candidate === resource,
  );
  if (!resourceCovered) return false;
  if (scope.seatId && scope.seatId !== seatId) return false;
  return true;
}

export function effectiveAuthorityFor(
  grants: readonly AuthorityGrantCandidate[],
  principalKey: string,
  seatId: string,
  now = new Date(),
) {
  const timestamp = now.getTime();
  const effectiveGrants = grants.filter((grant) => {
    const from = new Date(grant.effectiveFrom).getTime();
    const until = grant.effectiveUntil
      ? new Date(grant.effectiveUntil).getTime()
      : Number.POSITIVE_INFINITY;
    const addressed =
      (grant.granteeType === "seat" && grant.granteeKey === seatId) ||
      (grant.granteeType === "principal" &&
        grant.granteeKey === principalKey &&
        (!grant.seatId || grant.seatId === seatId));
    return (
      addressed &&
      grant.effect !== "deny" &&
      grant.state === "active" &&
      from <= timestamp &&
      until > timestamp
    );
  });
  const classes = Array.from(
    new Set(
      effectiveGrants.flatMap((grant) =>
        Array.isArray(grant.authorityClasses)
          ? grant.authorityClasses.filter((item): item is AuthorityClass =>
              authorityClasses.includes(item as AuthorityClass),
            )
          : [],
      ),
    ),
  );
  const toolEntitlements = Array.from(
    new Set(
      effectiveGrants.flatMap((grant) =>
        Array.isArray(grant.toolEntitlements)
          ? grant.toolEntitlements.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
      ),
    ),
  );
  return { grants: effectiveGrants, classes, toolEntitlements };
}

export const roleAssignmentCreateSchema = z.object({
  principalUserId: z.string().min(1).max(200),
  seatId: z.string().uuid(),
  assignmentType: z
    .enum(["occupant", "acting", "observer"])
    .default("occupant"),
  operatingGrant: z.enum(["observe", "operate"]).default("operate"),
  purpose: z.string().min(1).max(100).default("operate"),
  classificationCeiling: z
    .enum(["public", "internal", "confidential", "restricted"])
    .default("internal"),
  effectiveUntil: z.string().datetime().optional(),
});

export interface AssignmentSelectionCandidate {
  id: string;
  seatId: string;
  operatingGrant: string;
  classificationCeiling: string;
  status: string;
  effectiveFrom: Date | string;
  effectiveUntil?: Date | string | null;
}

export function selectOperatingAssignment(
  assignments: readonly AssignmentSelectionCandidate[],
  requestedSeatId?: string | null,
  preferredSeatId?: string | null,
  now = new Date(),
): AssignmentSelectionCandidate | undefined {
  const timestamp = now.getTime();
  const eligible = assignments.filter((assignment) => {
    const from = new Date(assignment.effectiveFrom).getTime();
    const until = assignment.effectiveUntil
      ? new Date(assignment.effectiveUntil).getTime()
      : Number.POSITIVE_INFINITY;
    return (
      assignment.status === "active" &&
      assignment.operatingGrant === "operate" &&
      from <= timestamp &&
      until > timestamp
    );
  });
  if (requestedSeatId)
    return eligible.find((assignment) => assignment.seatId === requestedSeatId);
  return (
    eligible.find((assignment) => assignment.seatId === preferredSeatId) ||
    eligible[0]
  );
}

export const membershipAdministrationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend") }),
  z.object({ action: z.literal("reactivate") }),
  z.object({ action: z.literal("reassign"), seatId: z.string().uuid() }),
  z.object({
    action: z.literal("change_access"),
    classificationCeiling: z.enum([
      "public",
      "internal",
      "confidential",
      "restricted",
    ]),
  }),
]);

export const portfolioMembershipAdministrationSchema = z.object({
  action: z.enum(["suspend", "reactivate"]),
});

export const organizationIdentityPolicySchema = z.object({
  allowedEmailDomains: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/),
    )
    .max(50),
  allowExternalCollaborators: z.boolean(),
});

const gmailMessageExecutionSchema = z.object({
  provider: z.literal("gmail"),
  operation: z.literal("gmail.send_with_local_approval"),
  to: z.string().email(),
  subject: z.string().min(1).max(998),
  body: z.string().min(1).max(50_000),
  cc: z.string().email().optional(),
  bcc: z.string().email().optional(),
});

const gmailCandidateInvitationExecutionSchema = z.object({
  provider: z.literal("gmail"),
  operation: z.literal(
    "gmail.send_candidate_portal_invitation_with_local_approval",
  ),
  applicationId: z.string().uuid(),
  expiresInDays: z.number().int().min(1).max(30).default(14),
  retentionDays: z.number().int().min(30).max(1_095).default(365),
  personalMessage: z.string().trim().max(2_000).default(""),
});

const googleCalendarCandidateEventExecutionSchema = z.object({
  provider: z.literal("google_workspace"),
  operation: z.literal(
    "google.calendar.create_candidate_event_with_local_approval",
  ),
  schedulingId: z.string().uuid(),
});

const googleCalendarCandidateEventCancellationSchema = z.object({
  provider: z.literal("google_workspace"),
  operation: z.literal(
    "google.calendar.cancel_candidate_event_with_local_approval",
  ),
  schedulingId: z.string().uuid(),
});

export const providerExecutionCreateSchema = z.discriminatedUnion("operation", [
  gmailMessageExecutionSchema,
  gmailCandidateInvitationExecutionSchema,
  googleCalendarCandidateEventExecutionSchema,
  googleCalendarCandidateEventCancellationSchema,
  ...recoveryProviderExecutionSchemas,
]);

export const manifestStatuses = [
  "draft",
  "diagnostic",
  "proposed",
  "review",
  "approved",
  "provisioning",
  "verifying",
  "active",
  "blocked",
  "rejected",
  "failed",
  "quarantined",
  "rolled_back",
  "superseded",
] as const;
export type ManifestStatus = (typeof manifestStatuses)[number];

const manifestTransitions: Record<ManifestStatus, readonly ManifestStatus[]> = {
  draft: ["diagnostic", "rejected"],
  diagnostic: ["proposed", "blocked", "rejected"],
  proposed: ["review", "draft", "rejected"],
  review: ["approved", "draft", "rejected"],
  approved: ["provisioning", "rejected"],
  provisioning: ["verifying", "blocked", "failed"],
  verifying: ["active", "blocked", "failed"],
  active: ["superseded", "rolled_back"],
  blocked: ["diagnostic", "provisioning", "verifying", "rejected"],
  rejected: ["draft"],
  failed: ["provisioning", "rolled_back"],
  quarantined: ["draft", "rejected"],
  rolled_back: [],
  superseded: [],
};

export function canTransitionManifest(
  from: string,
  to: string,
): to is ManifestStatus {
  return (
    manifestStatuses.includes(from as ManifestStatus) &&
    manifestStatuses.includes(to as ManifestStatus) &&
    manifestTransitions[from as ManifestStatus].includes(to as ManifestStatus)
  );
}

export const evidenceCreateSchema = z.object({
  workPacketId: z.string().uuid(),
  evidenceType: z.enum([
    "document",
    "record_data",
    "communication",
    "artifact",
    "observation",
    "test_result",
    "financial_record",
    "contract_legal",
    "media_asset",
    "external_verification",
    "provider_receipt",
    "review",
    "metric",
    "other",
  ]),
  title: z.string().min(1).max(200),
  uri: z.string().url().max(2000).optional(),
  details: z.record(z.unknown()).default({}),
  claimSubjectType: z.string().trim().min(1).max(200).default("work_packet"),
  claimSubjectKey: z.string().trim().max(500).default(""),
  verificationState: z
    .enum([
      "unverified",
      "self_reported",
      "observed",
      "verified",
      "disputed",
      "expired",
      "superseded",
    ])
    .default("unverified"),
  confidenceQuality: z
    .enum(["low", "medium", "high", "authoritative"])
    .default("medium"),
  dataClassification: z
    .enum([
      "public",
      "internal",
      "confidential",
      "restricted",
      "highly_restricted",
    ])
    .default("internal"),
  sourceSystem: z.string().trim().min(1).max(200).default("native_eos"),
  producerProviderKey: z.string().trim().max(300).default(""),
  consentRights: z.string().trim().max(2000).default(""),
  supportedClaimSummary: z.string().trim().max(4000).default(""),
  verifierMethod: z.string().trim().max(2000).default(""),
  templateLearningEligibility: z
    .enum([
      "not_eligible",
      "instance_only",
      "candidate",
      "approved_for_abstraction",
      "rejected",
    ])
    .default("not_eligible"),
  relatedEventKeys: z
    .array(z.string().trim().min(1).max(1000))
    .max(200)
    .default([]),
  relatedDecisionKeys: z
    .array(z.string().trim().min(1).max(1000))
    .max(200)
    .default([]),
  validFrom: z.string().datetime().optional(),
  expiresReviewAt: z.string().datetime().optional(),
});

// Promotion is a human verification boundary from candidate-provided material
// into canonical Evidence. The server binds Trial evidence to its Work Packet.
export const talentCandidateEvidencePromotionSchema = z.object({
  workPacketId: z.string().uuid().optional(),
  supportedClaimSummary: z.string().trim().min(3).max(4_000),
  verifierMethod: z.string().trim().min(3).max(2_000),
  confidenceQuality: z.enum(["high", "authoritative"]).default("high"),
});

export const workPacketStatuses = [
  "draft",
  "awaiting_approval",
  "ready",
  "in_progress",
  "blocked",
  "in_review",
  "completed",
  "cancelled",
] as const;

export type WorkPacketStatus = (typeof workPacketStatuses)[number];

const transitions: Record<WorkPacketStatus, readonly WorkPacketStatus[]> = {
  draft: ["awaiting_approval", "ready", "cancelled"],
  awaiting_approval: ["ready", "cancelled"],
  ready: ["in_progress", "cancelled"],
  in_progress: ["blocked", "in_review", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  in_review: ["in_progress", "completed"],
  completed: [],
  cancelled: [],
};

export function canTransitionWorkPacket(
  from: string,
  to: string,
): to is WorkPacketStatus {
  if (
    !workPacketStatuses.includes(from as WorkPacketStatus) ||
    !workPacketStatuses.includes(to as WorkPacketStatus)
  )
    return false;
  return transitions[from as WorkPacketStatus].includes(to as WorkPacketStatus);
}

export const eosSeatKinds = [
  "founder",
  "portfolio_executive",
  "company_ceo",
  "functional_executive",
  "manager",
  "individual_contributor",
  "external",
] as const;

export type EosSeatKind = (typeof eosSeatKinds)[number];

export interface SeatVisibilityPolicy {
  role: EosSeatKind;
  label: string;
  visibilityRank: number;
  scope:
    "portfolio" | "company" | "function" | "team" | "self" | "relationship";
  sees: readonly string[];
  cannotSee: readonly string[];
  communicationPath: string;
}

const seatVisibilityPolicies: Record<EosSeatKind, SeatVisibilityPolicy> = {
  founder: {
    role: "founder",
    label: "Founder / Portfolio Principal",
    visibilityRank: 100,
    scope: "portfolio",
    sees: [
      "all authorized portfolio and company operating state",
      "all decision and approval queues",
      "all organizational rollups and evidence",
    ],
    cannotSee: [
      "legally privileged, conflict-walled, or highly restricted fields without the required explicit grant",
    ],
    communicationPath: "Founder ↔ Executive Assistant",
  },
  portfolio_executive: {
    role: "portfolio_executive",
    label: "Portfolio Executive",
    visibilityRank: 90,
    scope: "portfolio",
    sees: [
      "authorized portfolio rollups",
      "entity health and dependencies",
      "portfolio mandates, risks, and allocations",
    ],
    cannotSee: [
      "entity-private or person-private detail outside consolidation rights",
    ],
    communicationPath:
      "Portfolio Executive ↔ Executive Assistant ↔ Company CEO Agents",
  },
  company_ceo: {
    role: "company_ceo",
    label: "Company CEO",
    visibilityRank: 80,
    scope: "company",
    sees: [
      "all authorized company state",
      "all functions and direct/indirect reports",
      "company decisions, risks, and evidence",
    ],
    cannotSee: [
      "other portfolio companies without an explicit cross-entity grant",
    ],
    communicationPath:
      "Company CEO ↔ Executive Assistant or Portfolio Executive; Company CEO ↔ direct reports",
  },
  functional_executive: {
    role: "functional_executive",
    label: "Functional Executive",
    visibilityRank: 70,
    scope: "function",
    sees: [
      "owned function",
      "downline teams",
      "authorized cross-functional dependencies and rollups",
    ],
    cannotSee: ["peer-function private records or portfolio-wide detail"],
    communicationPath:
      "Functional Executive ↔ Company CEO; Functional Executive ↔ function managers",
  },
  manager: {
    role: "manager",
    label: "Manager",
    visibilityRank: 60,
    scope: "team",
    sees: [
      "own work and scorecard",
      "direct and indirect reports",
      "team work, risks, approvals, and evidence needed for supervision",
    ],
    cannotSee: [
      "upward private state, lateral teams, or restricted people data without a specific grant",
    ],
    communicationPath: "Manager ↔ direct supervisor; Manager ↔ direct reports",
  },
  individual_contributor: {
    role: "individual_contributor",
    label: "Individual Contributor",
    visibilityRank: 50,
    scope: "self",
    sees: [
      "own seat",
      "assigned work",
      "needed collaboration context",
      "own metrics, evidence, and policies",
    ],
    cannotSee: ["manager-only, peer-private, executive, or portfolio state"],
    communicationPath:
      "Employee ↔ direct manager; peer communication only inside shared authorized work",
  },
  external: {
    role: "external",
    label: "External Collaborator",
    visibilityRank: 20,
    scope: "relationship",
    sees: [
      "explicitly shared relationship, case, work packet, or portal records",
    ],
    cannotSee: [
      "internal deliberation, scoring, risk notes, or unrelated organizational state",
    ],
    communicationPath:
      "External collaborator ↔ named internal relationship owner",
  },
};

export function visibilityPolicyFor(role: EosSeatKind): SeatVisibilityPolicy {
  return seatVisibilityPolicies[role];
}

const surfacePolicies: Record<EosSeatKind, readonly string[]> = {
  founder: [
    "home",
    "command",
    "organization",
    "talent",
    "workforce",
    "my-role",
    "modules",
    "commercial",
    "operations",
    "work-room",
    "review",
    "academy",
    "portfolio-map",
    "capital",
    "intelligence",
    "systems",
  ],
  portfolio_executive: [
    "home",
    "command",
    "organization",
    "talent",
    "workforce",
    "my-role",
    "modules",
    "operations",
    "work-room",
    "review",
    "academy",
    "portfolio-map",
    "capital",
    "intelligence",
    "systems",
  ],
  company_ceo: [
    "home",
    "command",
    "organization",
    "talent",
    "workforce",
    "my-role",
    "modules",
    "commercial",
    "operations",
    "work-room",
    "review",
    "academy",
    "capital",
    "intelligence",
    "systems",
  ],
  functional_executive: [
    "home",
    "command",
    "organization",
    "talent",
    "workforce",
    "my-role",
    "modules",
    "operations",
    "work-room",
    "review",
    "academy",
    "intelligence",
    "systems",
  ],
  manager: [
    "home",
    "talent",
    "workforce",
    "my-role",
    "modules",
    "operations",
    "work-room",
    "review",
    "academy",
    "intelligence",
  ],
  individual_contributor: [
    "home",
    "workforce",
    "my-role",
    "modules",
    "work-room",
    "academy",
    "intelligence",
  ],
  external: ["home", "my-role", "modules", "work-room"],
};

export function allowedSurfacesFor(role: EosSeatKind): readonly string[] {
  return surfacePolicies[role];
}

export type EosNextActionReason =
  "organization_setup" | "approval" | "active_work" | "new_work";

export function nextUsableSurfaceFor(
  role: EosSeatKind,
  reason: EosNextActionReason,
): string {
  const allowed = new Set(allowedSurfacesFor(role));
  const candidates: Record<EosNextActionReason, readonly string[]> = {
    organization_setup: ["organization", "intelligence", "my-role"],
    approval: ["review", "work-room", "my-role"],
    active_work: ["work-room", "my-role"],
    new_work: ["operations", "intelligence", "my-role"],
  };
  return candidates[reason].find((surface) => allowed.has(surface)) || "home";
}

export type RolePracticeAction =
  "prepare_work" | "open_assigned_work" | "request_supervisor_approval";

export function rolePracticeActionFor(
  role: EosSeatKind,
  hasActiveWork: boolean,
): RolePracticeAction {
  const allowed = new Set(allowedSurfacesFor(role));
  if (allowed.has("operations")) return "prepare_work";
  if (hasActiveWork && allowed.has("work-room")) return "open_assigned_work";
  return "request_supervisor_approval";
}

export interface EosActiveModule {
  id: number;
  name: string;
  activation: "active" | "partial";
  operatingSurface:
    "command" | "commercial" | "operations" | "work-room" | "systems";
  overlayBoundary: string;
  missionTitle: string;
  missionObjective: string;
  evidenceRequirement: string;
  fallback: string;
}

/**
 * The fourteen non-dormant EOS modules from the MVP-to-native blueprint.
 * These definitions intentionally route overlay work through the canonical
 * Work Packet, approval, evidence, and provider-control runtime. They do not
 * claim that the future native systems already exist.
 */
export const eosActiveModules: readonly EosActiveModule[] = [
  {
    id: 1,
    name: "Recruiting & Candidate Portal",
    activation: "active",
    operatingSurface: "operations",
    overlayBoundary:
      "Coordinate provider or form intake, assessment, review, decision, and onboarding handoff without exposing internal candidate deliberation.",
    missionTitle: "Advance a recruiting decision",
    missionObjective:
      "Move one candidate or open role through intake, assessment, accountable review, decision, and evidence-backed handoff.",
    evidenceRequirement: "Candidate decision record or reviewed assessment",
    fallback:
      "Create a local recruiting Work Packet and attach provider links or reviewed notes as evidence.",
  },
  {
    id: 2,
    name: "Lead Capture & Marketing Qualification",
    activation: "active",
    operatingSurface: "commercial",
    overlayBoundary:
      "Ingest consented lead and attribution context from connected providers; EOS governs qualification and routing.",
    missionTitle: "Qualify and route a lead cohort",
    missionObjective:
      "Review consent, attribution, fit, and routing for a defined lead or cohort and return an accountable next commercial action.",
    evidenceRequirement: "Qualification rationale and source reference",
    fallback:
      "Record the source and qualification in a local Work Packet when the CRM or form provider is unavailable.",
  },
  {
    id: 3,
    name: "Sales Opportunity & Commercial Decision",
    activation: "active",
    operatingSurface: "commercial",
    overlayBoundary:
      "Unify opportunity context while the CRM, communications, proposals, and offers remain authoritative provider records.",
    missionTitle: "Advance a commercial opportunity",
    missionObjective:
      "Evaluate one opportunity, its customer need, offer, risks, forecast, and required commercial decision with source-backed evidence.",
    evidenceRequirement:
      "Opportunity decision and supporting customer evidence",
    fallback:
      "Use a local commercial Work Packet and reconcile the decision to the authoritative CRM later.",
  },
  {
    id: 4,
    name: "Contracting & Payment Activation",
    activation: "active",
    operatingSurface: "commercial",
    overlayBoundary:
      "Coordinate agreement and payment activation through approved provider links and events; EOS does not claim ledger or legal authority.",
    missionTitle: "Prepare a contract and payment decision",
    missionObjective:
      "Assemble the commercial terms, professional review needs, payment activation steps, authority gate, and provider references for one agreement.",
    evidenceRequirement: "Approved terms and provider activation receipt",
    fallback:
      "Prepare a governed local packet; a qualified human must execute legal or payment actions in the authoritative provider.",
  },
  {
    id: 5,
    name: "Client Onboarding Portal",
    activation: "active",
    operatingSurface: "operations",
    overlayBoundary:
      "Coordinate scoped intake, access, checklist, approvals, and handoff while external identity and provider records retain authority.",
    missionTitle: "Complete a client onboarding milestone",
    missionObjective:
      "Move one client through the next onboarding milestone with named inputs, access requirements, owner, approval, and completion evidence.",
    evidenceRequirement:
      "Completed onboarding milestone and client-visible confirmation",
    fallback:
      "Run the checklist as a local Work Packet and share only explicitly authorized artifacts.",
  },
  {
    id: 6,
    name: "Fulfillment & Work Delivery",
    activation: "active",
    operatingSurface: "work-room",
    overlayBoundary:
      "Coordinate deliverables, issues, change requests, review, and proof around connected project, document, and file systems.",
    missionTitle: "Deliver a client outcome",
    missionObjective:
      "Advance one deliverable from scoped work through review, change control, acceptance, and evidence-backed handoff.",
    evidenceRequirement: "Reviewed deliverable or observed outcome",
    fallback:
      "Operate the delivery packet locally and attach authoritative document or project links when available.",
  },
  {
    id: 7,
    name: "Customer Success, Reporting & Renewal",
    activation: "partial",
    operatingSurface: "operations",
    overlayBoundary:
      "Summarize health, outcomes, issues, reports, and renewal reminders from evidence without inventing unsupported attribution.",
    missionTitle: "Review customer health and renewal readiness",
    missionObjective:
      "Assess one customer relationship using current outcomes, risks, open issues, evidence, and the next renewal or retention decision.",
    evidenceRequirement: "Customer health review with outcome evidence",
    fallback:
      "Create a local review packet and reconcile communications to the customer system when restored.",
  },
  {
    id: 8,
    name: "Executive Command & Operating Cadence",
    activation: "active",
    operatingSurface: "command",
    overlayBoundary:
      "Direct objectives, constraints, decisions, commitments, approvals, and cadence from canonical EOS state.",
    missionTitle: "Run the next operating review",
    missionObjective:
      "Review current objectives, constraints, decisions, commitments, approvals, and accountable next actions for the organization.",
    evidenceRequirement: "Recorded decisions, owners, and commitments",
    fallback:
      "Use the EOS command state and local approval queue even when external providers are offline.",
  },
  {
    id: 9,
    name: "Finance Control & Commercial Events",
    activation: "partial",
    operatingSurface: "operations",
    overlayBoundary:
      "Coordinate provider-backed invoice, payment, accounting, budget, approval, and reconciliation events without claiming ledger truth.",
    missionTitle: "Review a financial control event",
    missionObjective:
      "Review one budget, invoice, payment, or reconciliation event, identify the authority gate, and record the accountable decision.",
    evidenceRequirement: "Provider receipt or reviewed reconciliation record",
    fallback:
      "Record the control decision locally; the accounting, banking, payroll, or payment provider remains authoritative.",
  },
  {
    id: 10,
    name: "Operations, Administration & Vendor Control",
    activation: "active",
    operatingSurface: "operations",
    overlayBoundary:
      "Govern recurring work, vendors, assets, access, obligations, and administrative requests through accountable packets.",
    missionTitle: "Resolve an operating control",
    missionObjective:
      "Advance one vendor, asset, access, obligation, or recurring-work request through ownership, approval, and verified completion.",
    evidenceRequirement: "Completed control checklist or provider receipt",
    fallback:
      "Operate the request locally and reconcile provider state after recovery.",
  },
  {
    id: 11,
    name: "Product, Offer & Template Evolution",
    activation: "partial",
    operatingSurface: "operations",
    overlayBoundary:
      "Coordinate feedback, experiments, version proposals, and release decisions without presenting drafts as released product truth.",
    missionTitle: "Evaluate a product or offer change",
    missionObjective:
      "Turn feedback or an experiment into a versioned proposal, compatibility assessment, release decision, and measurable verification plan.",
    evidenceRequirement: "Versioned proposal and reviewed experiment evidence",
    fallback:
      "Run the proposal and approval locally; publish only through the authoritative product or content system.",
  },
  {
    id: 12,
    name: "Technology, Integrations & Automation Control",
    activation: "partial",
    operatingSurface: "systems",
    overlayBoundary:
      "Expose provider binding, health, entitlement, retries, fallback, reconciliation, and replacement status before external effects.",
    missionTitle: "Qualify an integration or automation",
    missionObjective:
      "Verify one integration's identity, authority, health, failure behavior, fallback, evidence, and recovery path before enabling consequential use.",
    evidenceRequirement: "Health check, authority proof, and recovery result",
    fallback:
      "Keep EOS standalone-safe and route work through local packets until the provider is healthy and authorized.",
  },
  {
    id: 13,
    name: "Legal Obligations, Rights & Compliance",
    activation: "partial",
    operatingSurface: "operations",
    overlayBoundary:
      "Index obligations, rights, consent, risks, controls, and professional-review needs while authoritative documents remain external.",
    missionTitle: "Review an obligation or rights decision",
    missionObjective:
      "Identify one obligation, consent, rights, retention, or compliance decision, its source, owner, deadline, professional boundary, and required evidence.",
    evidenceRequirement:
      "Authoritative source link and qualified review record",
    fallback:
      "Track the obligation locally and stop at the professional-review boundary; EOS does not provide legal approval.",
  },
  {
    id: 14,
    name: "Brand, Media & Proof Distribution",
    activation: "active",
    operatingSurface: "commercial",
    overlayBoundary:
      "Coordinate creator or provider assets, claims, rights, approvals, distribution, attribution, and outcomes with source identity preserved.",
    missionTitle: "Approve a proof-backed distribution action",
    missionObjective:
      "Prepare one brand or media asset for distribution by verifying its claim, evidence, rights, audience, approval, channel, and outcome measure.",
    evidenceRequirement:
      "Approved asset, rights record, and distribution receipt",
    fallback:
      "Prepare the governed packet locally and distribute only through an authorized provider or CreatorOS/UMH path.",
  },
] as const;

export function eosModulesForRole(
  role: EosSeatKind,
): readonly EosActiveModule[] {
  const allowed = new Set(allowedSurfacesFor(role));
  return eosActiveModules.filter((module) =>
    allowed.has(module.operatingSurface),
  );
}

export function canSeeSeat(actor: EosSeatKind, target: EosSeatKind): boolean {
  const actorPolicy = visibilityPolicyFor(actor);
  const targetPolicy = visibilityPolicyFor(target);
  if (actor === "external") return target === "external";
  return actorPolicy.visibilityRank >= targetPolicy.visibilityRank;
}

export interface AdvisorSeat {
  id: string;
  name: string;
  mandate: string;
  timeHorizon: string;
  professionalBoundary?: string;
}

export interface AdvisorCouncilManifest {
  version: "eos.advisor-council.v1";
  count: 15;
  founderFacingAgent: "executive_assistant";
  councilMode: "advisory_only";
  personalization: {
    founderName: string;
    portfolioName: string;
    companyName: string;
    founderVision: string;
    founderValues: string;
    decisionStyle: string;
    companyGoals: string;
  };
  advisors: AdvisorSeat[];
}

const advisorKeywords: Record<string, readonly string[]> = {
  capital: ["capital", "cash", "budget", "invest", "finance"],
  operations: ["operate", "delivery", "process", "execution", "workflow"],
  revenue: ["revenue", "sales", "pricing", "pipeline", "offer"],
  customer: ["customer", "client", "retention", "service"],
  brand: ["brand", "media", "content", "distribution", "reputation"],
  product: ["product", "technology", "software", "integration", "security"],
  people: ["people", "hire", "team", "culture", "role", "manager"],
  governance: ["risk", "authority", "approval", "governance", "control"],
  legal: ["legal", "contract", "entity", "compliance", "rights"],
  data: ["data", "metric", "evidence", "analytics", "measurement"],
  deals: ["deal", "partner", "acquisition", "merger", "negotiate"],
  resilience: ["failure", "resilience", "continuity", "incident", "recovery"],
};

export function selectAdvisorSeats(
  advisors: readonly AdvisorSeat[],
  request: string,
  limit = 3,
): AdvisorSeat[] {
  const normalized = request.toLowerCase();
  const scored = advisors.map((advisor, index) => ({
    advisor,
    index,
    score: (advisorKeywords[advisor.id] || []).filter((keyword) =>
      normalized.includes(keyword),
    ).length,
  }));
  const defaults = ["chief_portfolio_advisor", "strategy", "governance"];
  const defaultRank = (id: string) => {
    const rank = defaults.indexOf(id);
    return rank === -1 ? defaults.length + 1 : rank;
  };
  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        defaultRank(a.advisor.id) - defaultRank(b.advisor.id) ||
        a.index - b.index,
    )
    .slice(0, Math.max(1, Math.min(limit, advisors.length)))
    .map((item) => item.advisor);
}

const advisorSeatTemplates: AdvisorSeat[] = [
  {
    id: "chief_portfolio_advisor",
    name: "Chief Portfolio Advisor",
    mandate:
      "Synthesize the council, retain dissent, and connect recommendations to portfolio coherence.",
    timeHorizon: "quarters to decades",
  },
  {
    id: "strategy",
    name: "Strategy & Portfolio Architecture",
    mandate:
      "Test direction, sequencing, strategic fit, and the relationship among companies.",
    timeHorizon: "years",
  },
  {
    id: "capital",
    name: "Capital Allocation",
    mandate:
      "Compare uses of cash, attention, people, and risk capacity across the portfolio.",
    timeHorizon: "quarters to years",
  },
  {
    id: "operations",
    name: "Operating Systems",
    mandate:
      "Turn strategy into accountable operating loops, owners, cadence, and proof.",
    timeHorizon: "weeks to quarters",
  },
  {
    id: "revenue",
    name: "Revenue & Commercial",
    mandate:
      "Challenge offer, positioning, sales motion, pricing, pipeline, and unit economics.",
    timeHorizon: "days to quarters",
  },
  {
    id: "customer",
    name: "Customer & Stakeholder",
    mandate:
      "Represent customer truth, service quality, trust, retention, and stakeholder outcomes.",
    timeHorizon: "days to years",
  },
  {
    id: "brand",
    name: "Brand, Media & Distribution",
    mandate:
      "Align narrative, reputation, channels, owned audience, and distribution leverage.",
    timeHorizon: "weeks to years",
  },
  {
    id: "product",
    name: "Product & Technology",
    mandate:
      "Evaluate product architecture, technical leverage, integrations, security, and native replacement.",
    timeHorizon: "weeks to years",
  },
  {
    id: "people",
    name: "People, Talent & Culture",
    mandate:
      "Evaluate seats, hiring, development, incentives, succession, culture, and founder dependence.",
    timeHorizon: "months to years",
  },
  {
    id: "governance",
    name: "Governance, Risk & Controls",
    mandate:
      "Test authority, evidence, reversibility, separation of duties, and institutional risk.",
    timeHorizon: "immediate to permanent",
  },
  {
    id: "legal",
    name: "Legal & Entity Structure",
    mandate:
      "Surface entity, contract, regulatory, fiduciary, and rights questions for qualified counsel.",
    timeHorizon: "transaction to permanent",
    professionalBoundary:
      "Advisory preparation only; qualified counsel owns legal advice and sign-off.",
  },
  {
    id: "finance",
    name: "Finance, Tax & Treasury",
    mandate:
      "Evaluate reporting, liquidity, tax questions, controls, capital structure, and downside resilience.",
    timeHorizon: "monthly to decades",
    professionalBoundary:
      "Advisory preparation only; qualified accounting, tax, and finance professionals own sign-off.",
  },
  {
    id: "deals",
    name: "Deals, Partnerships & M&A",
    mandate:
      "Assess partnerships, acquisitions, integrations, negotiation posture, and strategic optionality.",
    timeHorizon: "quarters to years",
  },
  {
    id: "founder",
    name: "Founder Performance & Continuity",
    mandate:
      "Protect founder attention, decision quality, sustainability, learning, and continuity beyond one person.",
    timeHorizon: "daily to lifelong",
  },
  {
    id: "red_team",
    name: "Contrarian & Red Team",
    mandate:
      "Attack assumptions, expose blind spots, model failure, and preserve material dissent.",
    timeHorizon: "immediate to long-term",
  },
];

export function buildAdvisorCouncil(input: {
  founderName?: string | null;
  portfolioName?: string | null;
  companyName: string;
  founderProfile?: Record<string, unknown> | null;
  companyGoals?: string | null;
}): AdvisorCouncilManifest {
  const profile = input.founderProfile || {};
  return {
    version: "eos.advisor-council.v1",
    count: 15,
    founderFacingAgent: "executive_assistant",
    councilMode: "advisory_only",
    personalization: {
      founderName: input.founderName || "Founder",
      portfolioName: input.portfolioName || "Independent portfolio",
      companyName: input.companyName,
      founderVision: typeof profile.vision === "string" ? profile.vision : "",
      founderValues: typeof profile.values === "string" ? profile.values : "",
      decisionStyle:
        typeof profile.decisionStyle === "string" ? profile.decisionStyle : "",
      companyGoals: input.companyGoals || "",
    },
    advisors: advisorSeatTemplates.map((advisor) => ({ ...advisor })),
  };
}

export const workPacketTransitionSchema = z.object({
  status: z.enum(workPacketStatuses),
  reason: z.string().max(1000).optional(),
});

export const approvalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().max(1000).optional(),
});
