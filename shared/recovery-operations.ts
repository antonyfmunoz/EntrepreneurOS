import { z } from "zod";

export const recoveryEngagementModes = ["client_zero", "paid_client"] as const;
export const recoveryEngagementStates = [
  "draft",
  "intake",
  "baseline",
  "audit",
  "campaign_approval",
  "bounded_launch",
  "operating",
  "reporting",
  "guarantee_review",
  "renewal_review",
  "paused",
  "recovery_required",
  "closed",
  "cancelled",
] as const;
export const recoveryPoolKeys = ["missed_calls", "open_estimates", "past_customers"] as const;
export const recoveryPoolStates = ["unconfigured", "collecting", "qualified", "approved", "active", "paused", "completed", "blocked"] as const;
export const recoveryCampaignStates = ["draft", "awaiting_approval", "approved", "tested", "active", "paused", "completed", "rejected"] as const;
export const recoveryOpportunityStates = ["identified", "contacted", "replied", "qualified", "routed", "booked", "won", "lost", "suppressed", "disputed"] as const;

const uuid = z.string().uuid();
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const evidenceIds = z.array(uuid).min(1).max(20);
const optionalUuid = z.union([uuid, z.literal("")]).optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date (YYYY-MM-DD).");
const optionalDate = z.union([isoDate, z.literal("")]).optional();

const secretPattern = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|sk_(?:live|test)_[A-Za-z0-9]+|gh[pousr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|client_secret\s*[:=]|bearer\s+[A-Za-z0-9._-]{20,})/i;
const rejectsSecrets = <T extends z.ZodTypeAny>(schema: T) => schema.superRefine((value, context) => {
  if (secretPattern.test(JSON.stringify(value))) context.addIssue({ code: z.ZodIssueCode.custom, message: "Store managed-secret references, never credential material." });
});

export const recoveryEngagementCreateSchema = rejectsSecrets(z.object({
  mode: z.enum(recoveryEngagementModes),
  title: text(5, 240),
  ownerSeatId: uuid,
  call2PacketId: optionalUuid,
  objective: text(20, 3000),
  eligiblePoolKeys: z.array(z.enum(recoveryPoolKeys)).min(1).max(3),
  sourceBoundary: text(20, 3000),
  consentPolicy: text(20, 3000),
  clientSideOwner: z.string().trim().max(240).default(""),
  guaranteeWindowStart: optionalDate,
  guaranteeWindowEnd: optionalDate,
  nextAction: text(5, 1000),
  nextActionAt: optionalDate,
  classification: z.enum(["internal", "confidential", "restricted"]).default("confidential"),
})).superRefine((value, context) => {
  if (value.mode === "paid_client" && !value.call2PacketId) context.addIssue({ code: z.ZodIssueCode.custom, path: ["call2PacketId"], message: "A paid-client engagement must originate from the governed closed-won Recovery handoff." });
  if (value.mode === "client_zero" && value.call2PacketId) context.addIssue({ code: z.ZodIssueCode.custom, path: ["call2PacketId"], message: "Client Zero must use Empyrean first-party scope, not a customer Call-2 packet." });
  if (value.guaranteeWindowStart && value.guaranteeWindowEnd && value.guaranteeWindowEnd <= value.guaranteeWindowStart) context.addIssue({ code: z.ZodIssueCode.custom, path: ["guaranteeWindowEnd"], message: "The guarantee-window end must follow its start." });
});

export const recoveryEngagementEvidenceSchema = rejectsSecrets(z.object({
  evidenceType: z.enum(["operator_observation", "scope_approval", "consent_review", "baseline_snapshot", "data_quality_receipt", "campaign_approval", "provider_receipt", "delivery_receipt", "communication_receipt", "attribution_receipt", "recovery_receipt", "client_confirmation", "postmortem"]),
  title: text(5, 240),
  sourceSystem: text(2, 120),
  sourceReference: text(3, 1000),
  supportedClaimSummary: text(20, 3000),
  verifierMethod: text(10, 1000),
  consentRights: text(5, 1000),
  capturedAt: z.coerce.date().optional(),
  dataClassification: z.enum(["internal", "confidential", "restricted"]).default("confidential"),
}));

export const recoveryEngagementActions = [
  "approve_scope",
  "complete_intake",
  "record_baseline",
  "complete_audit",
  "approve_campaigns",
  "verify_bounded_launch",
  "start_reporting",
  "start_guarantee_review",
  "continue_management",
  "start_renewal_review",
  "close",
  "pause",
  "resume",
  "report_failure",
  "restore_safe_state",
  "cancel",
] as const;

export const recoveryEngagementTransitionSchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  action: z.enum(recoveryEngagementActions),
  note: text(20, 3000),
  evidenceIds,
  blocker: z.string().trim().max(3000).default(""),
  nextAction: text(5, 1000),
  nextActionAt: optionalDate,
})).superRefine((value, context) => {
  if (value.action === "report_failure" && value.blocker.length < 10) context.addIssue({ code: z.ZodIssueCode.custom, path: ["blocker"], message: "A live failure requires a named blocker and containment condition." });
});

export const recoveryPoolUpdateSchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  state: z.enum(recoveryPoolStates),
  sourceSystemReference: text(3, 1000),
  rawCount: z.coerce.number().int().min(0),
  eligibleCount: z.coerce.number().int().min(0),
  excludedCount: z.coerce.number().int().min(0),
  activationReadyCount: z.coerce.number().int().min(0),
  exclusionSummary: text(5, 3000),
  qualificationNote: text(20, 3000),
  evidenceIds,
})).superRefine((value, context) => {
  if (value.eligibleCount + value.excludedCount > value.rawCount) context.addIssue({ code: z.ZodIssueCode.custom, message: "Eligible plus excluded records cannot exceed the observed raw count." });
  if (value.activationReadyCount > value.eligibleCount) context.addIssue({ code: z.ZodIssueCode.custom, message: "Activation-ready records cannot exceed eligible records." });
});

export const recoveryCampaignUpsertSchema = rejectsSecrets(z.object({
  campaignId: optionalUuid,
  expectedVersion: z.coerce.number().int().positive().optional(),
  poolKey: z.enum(recoveryPoolKeys),
  name: text(5, 240),
  channel: z.enum(["sms", "email", "phone", "mixed", "manual"]),
  integrationBindingId: optionalUuid,
  messageVersionReference: text(3, 1000),
  consentBasis: text(20, 3000),
  quietHours: text(5, 500),
  cadence: text(20, 3000),
  stopConditions: text(20, 3000),
  optOutHandling: text(20, 3000),
  routingOwnerSeatId: uuid,
  escalationOwnerSeatId: uuid,
}));

export const recoveryCampaignDecisionSchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  decision: z.enum(["submit", "approve", "reject", "verify_test", "activate", "pause", "complete"]),
  note: text(20, 3000),
  evidenceIds,
}));

export const recoveryOpportunityCreateSchema = rejectsSecrets(z.object({
  poolKey: z.enum(recoveryPoolKeys),
  externalReference: text(3, 1000),
  title: text(5, 240),
  summary: text(20, 3000),
  ownerSeatId: uuid,
  estimatedValueMinor: z.coerce.number().int().min(0).default(0),
  nextAction: text(5, 1000),
  nextActionAt: optionalDate,
  evidenceIds,
}));

export const recoveryOpportunityTransitionSchema = rejectsSecrets(z.object({
  expectedVersion: z.coerce.number().int().positive(),
  state: z.enum(recoveryOpportunityStates),
  actualValueMinor: z.coerce.number().int().min(0).default(0),
  attributionModel: z.enum(["direct", "assisted", "unattributed", "disputed"]),
  nextAction: text(5, 1000),
  nextActionAt: optionalDate,
  note: text(20, 3000),
  evidenceIds,
}));

export type RecoveryEngagementState = typeof recoveryEngagementStates[number];
export type RecoveryEngagementAction = typeof recoveryEngagementActions[number];

const linearTransitions: Partial<Record<RecoveryEngagementAction, { from: RecoveryEngagementState[]; to: RecoveryEngagementState }>> = {
  approve_scope: { from: ["draft"], to: "intake" },
  complete_intake: { from: ["intake"], to: "baseline" },
  record_baseline: { from: ["baseline"], to: "audit" },
  complete_audit: { from: ["audit"], to: "campaign_approval" },
  approve_campaigns: { from: ["campaign_approval"], to: "bounded_launch" },
  verify_bounded_launch: { from: ["bounded_launch"], to: "operating" },
  start_reporting: { from: ["operating"], to: "reporting" },
  start_guarantee_review: { from: ["reporting", "operating"], to: "guarantee_review" },
  continue_management: { from: ["guarantee_review", "reporting"], to: "operating" },
  start_renewal_review: { from: ["operating", "reporting", "guarantee_review"], to: "renewal_review" },
  close: { from: ["renewal_review", "guarantee_review"], to: "closed" },
};

export function nextRecoveryEngagementState(input: { state: RecoveryEngagementState; action: RecoveryEngagementAction; returnState?: string | null }): { state: RecoveryEngagementState; returnState: RecoveryEngagementState | null } {
  const { state, action } = input;
  if (["closed", "cancelled"].includes(state)) throw new Error("A terminal Recovery engagement cannot transition.");
  if (action === "report_failure") return { state: "recovery_required", returnState: state };
  if (action === "pause") {
    if (["draft", "paused", "recovery_required"].includes(state)) throw new Error("This Recovery engagement cannot be paused from its current state.");
    return { state: "paused", returnState: state };
  }
  if (action === "resume") {
    if (state !== "paused" || !input.returnState || !recoveryEngagementStates.includes(input.returnState as RecoveryEngagementState)) throw new Error("A paused engagement requires a valid prior safe state.");
    return { state: input.returnState as RecoveryEngagementState, returnState: null };
  }
  if (action === "restore_safe_state") {
    if (state !== "recovery_required" || !input.returnState || !recoveryEngagementStates.includes(input.returnState as RecoveryEngagementState)) throw new Error("Recovery requires a recorded prior safe state.");
    return { state: input.returnState as RecoveryEngagementState, returnState: null };
  }
  if (action === "cancel") return { state: "cancelled", returnState: null };
  const transition = linearTransitions[action];
  if (!transition || !transition.from.includes(state)) throw new Error(`Action ${action} is not allowed from ${state}.`);
  return { state: transition.to, returnState: null };
}

export function engagementProgress(state: RecoveryEngagementState): number {
  const ordered: RecoveryEngagementState[] = ["draft", "intake", "baseline", "audit", "campaign_approval", "bounded_launch", "operating", "reporting", "guarantee_review", "renewal_review", "closed"];
  if (state === "cancelled") return 0;
  if (["paused", "recovery_required"].includes(state)) return 0;
  const index = ordered.indexOf(state);
  return index < 0 ? 0 : Math.round((index / (ordered.length - 1)) * 100);
}

const opportunityTransitions: Record<typeof recoveryOpportunityStates[number], typeof recoveryOpportunityStates[number][]> = {
  identified: ["contacted", "suppressed", "lost", "disputed"],
  contacted: ["replied", "qualified", "suppressed", "lost", "disputed"],
  replied: ["qualified", "routed", "booked", "lost", "disputed"],
  qualified: ["routed", "booked", "lost", "disputed"],
  routed: ["booked", "won", "lost", "disputed"],
  booked: ["won", "lost", "disputed"],
  disputed: ["qualified", "routed", "booked", "won", "lost"],
  won: [], lost: [], suppressed: [],
};

export function recoveryOpportunityTransitionAllowed(current: typeof recoveryOpportunityStates[number], next: typeof recoveryOpportunityStates[number]): boolean {
  return current === next || opportunityTransitions[current].includes(next);
}

export function recoveryAttributionAllowed(state: typeof recoveryOpportunityStates[number], model: "direct" | "assisted" | "unattributed" | "disputed"): boolean {
  return model !== "direct" || ["booked", "won"].includes(state);
}
