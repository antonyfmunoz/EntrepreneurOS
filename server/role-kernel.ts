import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  eosAuthorityGrants,
  eosAuthoritySubjects,
  eosPositionAgreements,
  eosPositionFamilies,
  eosRoleOperatingPacks,
  eosSeats,
  type companies,
} from "@shared/schema";
import {
  positionAgreementContractSchema,
  roleOperatingPackContractSchema,
  type AuthorityClass,
  type EosSeatKind,
} from "@shared/eos-runtime";
import { organizationRegistryFieldTransformRules } from "@shared/eos-policy";

type CompanyRecord = typeof companies.$inferSelect;
type SeatRecord = typeof eosSeats.$inferSelect;

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function defaultAuthorityClassesForRole(kind: string): AuthorityClass[] {
  switch (kind) {
    case "founder": return ["view", "recommend", "execute", "decide", "approve", "spend", "sign", "grant_access", "delegate", "override_emergency"];
    case "company_ceo": return ["view", "recommend", "execute", "decide", "approve", "spend", "sign", "grant_access", "delegate"];
    case "portfolio_executive":
    case "functional_executive": return ["view", "recommend", "execute", "decide", "approve", "delegate"];
    case "manager": return ["view", "recommend", "execute", "decide", "approve"];
    case "external": return ["view", "recommend"];
    default: return ["view", "recommend", "execute"];
  }
}

function classificationForRole(kind: string): string {
  if (["founder", "company_ceo"].includes(kind)) return "restricted";
  if (["portfolio_executive", "functional_executive", "manager"].includes(kind)) return "confidential";
  if (kind === "external") return "public";
  return "internal";
}

function consequenceForRole(kind: string): string {
  if (kind === "founder") return "emergency";
  if (kind === "company_ceo") return "irreversible";
  if (["portfolio_executive", "functional_executive", "manager"].includes(kind)) return "material";
  return "routine";
}

function defaultAgreementContract(seat: SeatRecord) {
  const mission = seat.mandate.trim() || `Produce the accountable result for ${seat.title}.`;
  const tools = Array.isArray(seat.toolEntitlements) ? seat.toolEntitlements.filter((item): item is string => typeof item === "string") : [];
  return positionAgreementContractSchema.parse({
    resultStatement: mission,
    responsibilities: [mission],
    nonResponsibilities: ["Do not exceed explicit Authority Grants or bypass required approvals."],
    acceptanceStandards: ["Named outputs meet their evidence and review requirements."],
    scorecard: [{ metric: "Accountable outcomes accepted", target: "Defined by active Work Packets and company cadence", cadence: "weekly" }],
    managerRelationship: seat.supervisorSeatId ? `Reports through supervisor seat ${seat.supervisorSeatId}.` : "Reports to the governing founder context.",
    schedule: "Defined by the organization operating cadence and active work.",
    toolRequirements: tools,
    decisionRights: ["Only decisions covered by an effective Authority Grant."],
    authorityCeiling: seat.authority && typeof seat.authority === "object" ? seat.authority as Record<string, unknown> : {},
    trainingRequirements: ["Complete role-entry qualification before expanded authority."],
    evidenceRequirements: ["Accepted output or reviewed operating evidence."],
    promotionCriteria: ["Sustained evidence at the next level of complexity and judgment."],
    releaseCriteria: ["Repeated failure, material authority breach, or role deactivation after governed review."],
  });
}

function defaultRolePackContract(seat: SeatRecord) {
  const agreement = defaultAgreementContract(seat);
  const classes = defaultAuthorityClassesForRole(seat.kind);
  return roleOperatingPackContractSchema.parse({
    mission: agreement.resultStatement,
    responsibilities: agreement.responsibilities,
    nonResponsibilities: ["Do not exceed effective authority, disclosure, approval, or reporting boundaries."],
    outputs: ["Accepted evidence-bearing outputs from the active queue."],
    acceptanceStandards: agreement.acceptanceStandards,
    scorecard: agreement.scorecard,
    reviewCadence: "weekly",
    authorityRequirements: classes,
    requiredTools: agreement.toolRequirements,
    allowedSpecialists: [],
    workflows: ["Work Packet lifecycle", "Evidence and review lifecycle"],
    sops: [],
    queueTypes: ["work_packets", "approvals", "exceptions"],
    meetingObligations: [],
    handoffs: ["Use declared supervisor and downstream seat relationships."],
    dependencies: [],
    escalationPaths: [seat.supervisorSeatId ? `Escalate to supervisor seat ${seat.supervisorSeatId}.` : "Escalate to the governing founder context."],
    exceptions: ["Pause and escalate when authority, evidence, source ownership, or classification is ambiguous."],
    trainingRequirements: agreement.trainingRequirements,
    evidenceRequirements: agreement.evidenceRequirements,
    occupancyModes: seat.kind === "founder" ? ["founder_held", "human_led", "hybrid"] : ["agent_operated", "human_led", "provider_led", "team", "hybrid"],
    entryRules: ["An active assignment and effective operating grant are required."],
    exitRules: ["Exit preserves role identity, queue, evidence, and Role Agent continuity."],
    transferRules: ["Transfer changes occupancy without rewriting the institutional role contract."],
    qualificationTests: ["Occupant can explain mission, authority, boundaries, next action, and required proof."],
  });
}

export async function ensureSeatOperatingKernel(
  executor: any,
  company: CompanyRecord,
  seat: SeatRecord,
  actorUserId: string,
) {
  const familyId = `family:${company.id}:${seat.kind}`;
  const agreementId = `agreement:${seat.id}`;
  const packId = `pack:${seat.id}`;
  const grantId = `grant:${seat.id}:baseline`;
  const agentSubjectId = `subject:agent:${seat.id}`;
  const agentSubjectKey = `agent:${seat.id}:primary`;
  const now = new Date();
  const agreementContract = defaultAgreementContract(seat);
  const rolePackContract = defaultRolePackContract(seat);
  const classes = defaultAuthorityClassesForRole(seat.kind);
  const reviewAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  await executor.insert(eosPositionFamilies).values({
    id: familyId,
    companyId: company.id,
    canonicalKey: seat.kind,
    name: seat.kind.replaceAll("_", " ").replace(/\b\w/g, (letter: string) => letter.toUpperCase()),
    titleRoot: seat.title,
    dominantResult: agreementContract.resultStatement,
    applicability: { companyId: company.id, legacyKind: seat.kind },
    activationConditions: ["Activated because an accountable seat exists."],
    splitConditions: [],
    trackOptions: ["founder", "portfolio_executive", "company_ceo", "functional_executive", "manager"].includes(seat.kind) ? ["leadership", "management"] : ["individual_contributor"],
    sourceType: "legacy_backfill",
    templateAncestry: [`runtime:eos_seats:${seat.kind}`],
    status: "active",
    createdByUserId: actorUserId,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  await executor.insert(eosPositionAgreements).values({
    id: agreementId,
    companyId: company.id,
    positionFamilyId: familyId,
    levelCode: `seat-${hash(seat.id).slice(0, 8)}`,
    title: seat.title,
    version: 1,
    contract: agreementContract,
    contentHash: hash(agreementContract),
    sourceType: "legacy_backfill",
    templateAncestry: [`runtime:eos_seats:${seat.id}`],
    status: "active",
    effectiveFrom: now,
    createdByUserId: actorUserId,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  if (seat.positionAgreementId !== agreementId) {
    await executor.update(eosSeats).set({ positionAgreementId: agreementId, updatedAt: now }).where(and(eq(eosSeats.id, seat.id), eq(eosSeats.companyId, company.id)));
  }

  await executor.insert(eosRoleOperatingPacks).values({
    id: packId,
    companyId: company.id,
    seatId: seat.id,
    positionAgreementId: agreementId,
    version: 1,
    contract: rolePackContract,
    contentHash: hash(rolePackContract),
    compiledFrom: [agreementId, `runtime:eos_seats:${seat.id}`],
    status: "active",
    effectiveFrom: now,
    compiledByUserId: actorUserId,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  const agentClass = seat.kind === "founder" ? "executive_assistant" : seat.kind === "company_ceo" ? "ceo_agent" : "role_agent";
  const identityAttributes = {
    operatingMode: seat.occupantUserId ? "human_led_assistant" : "autonomous",
    workforceRoleMode: seat.occupantUserId ? "human_employee_assistant" : "primary_role_operator",
    memoryScope: { companyId: company.id, seatId: seat.id },
    modelRuntime: "configured_reasoning_gateway",
    humanFallbackUserId: company.ownerUserId,
    permittedTools: Array.isArray(seat.toolEntitlements) ? seat.toolEntitlements : [],
  };
  await executor.insert(eosAuthoritySubjects).values({
    id: agentSubjectId,
    companyId: company.id,
    portfolioId: company.portfolioId,
    subjectKey: agentSubjectKey,
    subjectType: "agent",
    displayName: seat.agentName,
    ownerUserId: company.ownerUserId,
    supervisorSeatId: seat.supervisorSeatId,
    seatId: seat.id,
    agentClass,
    sourceAuthority: "native_seat_runtime_v1",
    identityAttributes,
    governanceContract: { authorityRule: "separate_explicit_grant_required", effectiveCeilingRule: "lowest_of_agent_work_seat_tool_policy", suspensionRule: "suspend_dependent_execution" },
    evidenceReferences: [`runtime:eos_seats:${seat.id}`],
    classificationCeiling: classificationForRole(seat.kind),
    verificationStatus: "verified",
    status: "active",
    effectiveFrom: now,
    reviewAt,
    lastReviewedAt: now,
    reviewedByUserId: actorUserId,
    createdByUserId: actorUserId,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();
  await executor
    .update(eosAuthoritySubjects)
    .set({
      portfolioId: company.portfolioId,
      subjectType: "agent",
      displayName: seat.agentName,
      ownerUserId: company.ownerUserId,
      supervisorSeatId: seat.supervisorSeatId,
      seatId: seat.id,
      agentClass,
      sourceAuthority: "native_seat_runtime_v1",
      identityAttributes,
      governanceContract: { authorityRule: "separate_explicit_grant_required", effectiveCeilingRule: "lowest_of_agent_work_seat_tool_policy", suspensionRule: "suspend_dependent_execution" },
      evidenceReferences: [`runtime:eos_seats:${seat.id}`],
      classificationCeiling: classificationForRole(seat.kind),
      verificationStatus: "verified",
      status: "active",
      updatedAt: now,
    })
    .where(
      and(
        eq(eosAuthoritySubjects.companyId, company.id),
        eq(eosAuthoritySubjects.subjectKey, agentSubjectKey),
      ),
    );

  await executor.insert(eosAuthorityGrants).values({
    id: grantId,
    companyId: company.id,
    portfolioId: company.portfolioId,
    authorityKey: `seat:${seat.id}:baseline`,
    granteeType: "seat",
    granteeKey: seat.id,
    grantorType: "principal",
    grantorKey: company.ownerUserId,
    seatId: seat.id,
    capabilityKey: seat.kind,
    effect: "allow",
    authorityClasses: classes,
    actionResourceScope: { companyId: company.id, seatId: seat.id, resource: "*" },
    ceilingThreshold: { classification: classificationForRole(seat.kind), consequence: consequenceForRole(seat.kind), fieldTransformRules: organizationRegistryFieldTransformRules },
    conditions: ["Authority is effective only while the seat and entering assignment remain active."],
    requiredApprovals: ["founder", "company_ceo"].includes(seat.kind) ? [] : ["Escalate consequential effects outside the declared scope."],
    conditionRules: [],
    approvalPolicy: { minimumApprovals: 0, approverSeatIds: [], approverAuthorityClasses: ["approve"], disallowRequester: true, requireDistinctPrincipals: true, requireDistinctSeats: false },
    separationOfDuties: classes.includes("approve") && seat.kind !== "founder"
      ? [{ authorityClass: "approve", distinctFrom: ["initiator"], requireDistinctSeat: false }]
      : [],
    delegable: ["founder", "company_ceo", "portfolio_executive", "functional_executive"].includes(seat.kind),
    toolEntitlements: Array.isArray(seat.toolEntitlements) ? seat.toolEntitlements : [],
    policyDecisionSource: "native_default_role_policy_v1",
    evidenceReferences: [`runtime:eos_seats:${seat.id}`],
    state: "active",
    effectiveFrom: now,
    reviewAt,
    lastReviewedAt: now,
    reviewedByUserId: actorUserId,
    createdByUserId: actorUserId,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  const [positionAgreement, roleOperatingPack, authorityGrant, authoritySubject] = await Promise.all([
    executor.query.eosPositionAgreements.findFirst({ where: and(eq(eosPositionAgreements.id, agreementId), eq(eosPositionAgreements.companyId, company.id)) }),
    executor.query.eosRoleOperatingPacks.findFirst({ where: and(eq(eosRoleOperatingPacks.seatId, seat.id), eq(eosRoleOperatingPacks.status, "active")) }),
    executor.query.eosAuthorityGrants.findFirst({ where: and(eq(eosAuthorityGrants.id, grantId), eq(eosAuthorityGrants.companyId, company.id)) }),
    executor.query.eosAuthoritySubjects.findFirst({ where: and(eq(eosAuthoritySubjects.companyId, company.id), eq(eosAuthoritySubjects.subjectKey, agentSubjectKey)) }),
  ]);
  return { familyId, agreementId, agentSubjectId: authoritySubject?.id || agentSubjectId, positionAgreement, roleOperatingPack, authorityGrant, authoritySubject };
}
