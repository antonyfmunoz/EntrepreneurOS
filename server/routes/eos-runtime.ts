import { createHash, randomUUID } from "crypto";
import type { Express, Request } from "express";
import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { callAI } from "../ai/gateway";
import {
  AiBudgetError,
  evaluateAiBudgetThreshold,
  reconcileAiSpend,
} from "../ai/cost-control";
import * as gmail from "../integrations/gmail";
import * as notion from "../integrations/notion";
import {
  executeRecoveryCommercialEffect,
  recoveryCommercialEffectsConfigured,
  type RecoveryCommercialEffect,
} from "../integrations/recovery-commercial";
import { federationConfigured } from "../umh/config";
import {
  candidateFileSha256,
  deleteCandidateFile,
  readCandidateFile,
  safeAttachmentHeader,
  scanCandidateFile,
} from "../artifacts/candidate-files";
import { transcribeCandidateAudio } from "../artifacts/candidate-transcription";
import { executeApprovedRecoveryProviderExecution } from "../recovery-provider-executions";
import {
  companies,
  eosApprovalRequests,
  eosAssignments,
  eosAuthorityGrants,
  eosAuthoritySubjects,
  eosAdvisorConsultations,
  eosAuditRecords,
  eosCommunicationMessages,
  eosCommercialCases,
  eosCustomerValueCycles,
  eosCustomerValueCycleEvents,
  eosCustomerValueProviderCheckpoints,
  eosCustomerValueProviderFixtureRuns,
  eosCapitalAllocations,
  eosCapabilityInstances,
  eosConversations,
  eosEvidence,
  eosFinancialPlans,
  eosFinancialSources,
  eosSystems,
  eosIntegrationBindings,
  eosIntegrationBindingRevisions,
  eosToolEntitlements,
  eosAutomations,
  eosIntegrationHealthObservations,
  eosWorkforceReviews,
  eosWorkforceReviewDialogue,
  eosDevelopmentPlans,
  eosRoleSupportPlans,
  eosCareerPathHypotheses,
  eosSuccessionHypotheses,
  eosTalentNeeds,
  eosTalentApplications,
  eosTalentAssessments,
  eosTalentReviewPackets,
  eosTalentTrials,
  eosTalentCandidateEvidence,
  eosTalentCandidateMessages,
  eosTalentSchedulingRequests,
  eosTalentPlacements,
  eosTalentPortalEvents,
  eosManifestVersions,
  eosMetricsOutcomes,
  eosMembershipInvitations,
  eosMemberships,
  eosOrganizationIdentityPolicies,
  eosPolicyDecisions,
  eosPositionAgreements,
  eosPositionFamilies,
  eosPortfolioMemberships,
  eosProviderExecutions,
  eosRecoveryAgreementInstances,
  eosRecoveryBillingManifests,
  eosProcessDefinitions,
  eosResourcesAssets,
  eosRisksControls,
  eosRoleOperatingPacks,
  eosSeats,
  eosObjectives,
  eosOfferPrograms,
  eosStakeholderRelationships,
  eosStakeholders,
  eosSharedServiceEngagements,
  eosSharedServiceEvents,
  eosValueFlows,
  eosWorkPackets,
  portfolios,
  umhAuditRecords,
  umhCommands,
  umhEventOutbox,
  users,
  aiBudgetAlerts,
  aiBudgets,
  aiUsageLedger,
} from "@shared/schema";
import {
  isRecoveryProviderOperation,
} from "@shared/recovery-provider-executions";
import { recoveryProviderIdempotencyKey } from "../recovery-provider-idempotency";
import {
  authorityApprovalPolicySchema,
  authorityCeilingSchema,
  applyFieldTransformations,
  evaluatePolicyDecision,
  policyActionContextSchema,
  policyConditionRuleSchema,
  policyDataClassifications,
  separationOfDutiesRuleSchema,
  type PolicyDecisionOutcome,
} from "@shared/eos-policy";
import {
  approvalDecisionSchema,
  allowedSurfacesFor,
  authoritySubjectCreateSchema,
  authoritySubjectIsEffective,
  authoritySubjectTransitionSchema,
  authorityClasses,
  authorityGrantCoversResource,
  authorityGrantCreateSchema,
  authorityGrantTransitionSchema,
  buildAdvisorCouncil,
  canTransitionMetricOutcome,
  canTransitionObjective,
  canTransitionRiskControl,
  canTransitionCommercialCase,
  canTransitionCapability,
  canTransitionOffer,
  canTransitionRelationship,
  canTransitionStakeholder,
  canTransitionValueFlow,
  canTransitionProcessQualification,
  canTransitionProcessRelease,
  canTransitionResource,
  canTransitionFinancialSource,
  canTransitionFinancialPlan,
  canTransitionCapitalAllocation,
  canTransitionManifest,
  canTransitionWorkPacket,
  evidenceCreateSchema,
  effectiveAuthorityFor,
  eosSeatKinds,
  manifestInputSchema,
  membershipInvitationCreateSchema,
  membershipInvitationTokenSchema,
  membershipAdministrationSchema,
  metricOutcomeCreateSchema,
  metricOutcomeUpdateSchema,
  objectiveCreateSchema,
  objectiveUpdateSchema,
  commercialCaseCreateSchema,
  commercialCaseUpdateSchema,
  customerValueCycleActionSchema,
  customerValueCycleCreateSchema,
  customerValueProviderContractRunSchema,
  offerProgramCreateSchema,
  offerProgramUpdateSchema,
  capabilityCreateSchema,
  capabilityUpdateSchema,
  processCreateSchema,
  processUpdateSchema,
  resourceCreateSchema,
  resourceUpdateSchema,
  financialSourceCreateSchema,
  financialSourceUpdateSchema,
  financialPlanCreateSchema,
  financialPlanUpdateSchema,
  financialPlanReconcileSchema,
  capitalAllocationCreateSchema,
  capitalAllocationUpdateSchema,
  systemRegistryCreateSchema,
  systemRegistryUpdateSchema,
  integrationBindingCreateSchema,
  integrationBindingUpdateSchema,
  toolEntitlementCreateSchema,
  toolEntitlementUpdateSchema,
  automationCreateSchema,
  automationUpdateSchema,
  integrationHealthObservationCreateSchema,
  canTransitionSystemLifecycle,
  canTransitionEntitlement,
  canTransitionAutomation,
  integrationActivationIssues,
  entitlementActivationIssues,
  workforceReviewCreateSchema,
  workforceReviewUpdateSchema,
  workforceReviewDialogueCreateSchema,
  developmentPlanCreateSchema,
  developmentPlanUpdateSchema,
  roleSupportPlanCreateSchema,
  roleSupportPlanUpdateSchema,
  careerPathCreateSchema,
  careerPathUpdateSchema,
  successionHypothesisCreateSchema,
  successionHypothesisUpdateSchema,
  canTransitionWorkforceReview,
  canTransitionDevelopmentPlan,
  canTransitionRoleSupportPlan,
  canTransitionCareerPath,
  canTransitionSuccession,
  workforceReviewAdvancementIssues,
  developmentPlanAdvancementIssues,
  roleSupportPlanAdvancementIssues,
  careerPathAdvancementIssues,
  successionAdvancementIssues,
  talentNeedCreateSchema,
  talentNeedUpdateSchema,
  talentApplicationCreateSchema,
  talentApplicationUpdateSchema,
  talentAssessmentCreateSchema,
  talentAssessmentUpdateSchema,
  talentReviewPacketCreateSchema,
  talentReviewPacketUpdateSchema,
  talentNextAssessmentSchema,
  talentTrialCreateSchema,
  talentTrialUpdateSchema,
  talentCandidateEvidencePromotionSchema,
  talentPlacementCreateSchema,
  talentPlacementUpdateSchema,
  talentSchedulingCreateSchema,
  talentSchedulingUpdateSchema,
  canTransitionTalentNeed,
  canTransitionTalentApplication,
  canTransitionTalentAssessment,
  canTransitionTalentReviewPacket,
  canTransitionTalentTrial,
  canTransitionTalentPlacement,
  talentApplicationAdvancementIssues,
  talentAssessmentAdvancementIssues,
  talentReviewPacketReadinessIssues,
  talentTrialAdvancementIssues,
  talentPlacementAdvancementIssues,
  relationshipContextCreateSchema,
  relationshipContextUpdateSchema,
  sharedServiceClarificationSchema,
  sharedServiceDeliverySchema,
  sharedServiceDispositionSchema,
  sharedServiceProviderResponseSchema,
  sharedServiceRequestCreateSchema,
  stakeholderCreateSchema,
  stakeholderUpdateSchema,
  valueFlowCreateSchema,
  valueFlowUpdateSchema,
  organizationIdentityPolicySchema,
  positionAgreementCreateSchema,
  positionFamilyCreateSchema,
  providerExecutionCreateSchema,
  riskControlCreateSchema,
  riskControlUpdateSchema,
  roleAssignmentCreateSchema,
  roleOperatingPackUpdateSchema,
  selectAdvisorSeats,
  selectOperatingAssignment,
  seatCreateSchema,
  type EosSeatKind,
  type AuthorityClass,
  visibilityPolicyFor,
  workPacketCreateSchema,
  workPacketTransitionSchema,
} from "@shared/eos-runtime";
import {
  talentPortalIssueSchema,
  talentPortalMessageSchema,
} from "@shared/talent-portal";
import {
  FEDERATION_PROTOCOL_VERSION,
  type CommandOutcome,
} from "../umh/contracts";
import { fixedWindowRateLimit } from "../middleware/rate-limit";
import {
  createInvitationSecret,
  deliverMembershipInvitation,
  expireMembershipInvitations,
  invitationAcceptancePath,
  invitationDigest,
  MEMBERSHIP_INVITATION_TTL_DAYS,
  newMembershipInvitationId,
  normalizeInvitationEmail,
  revokeDeliveredMembershipInvitation,
} from "../membership-invitations";
import {
  createTalentPortalSecret,
  talentPortalDigest,
  talentPortalPath,
  talentPortalUrl,
} from "../talent-portal-token";
import {
  mayAddTeamIdentity,
  teamSeatSummaryForOwner,
} from "../billing/team-seats";
import { materializePortfolioMembership } from "../portfolio-memberships";
import { ensureSeatOperatingKernel } from "../role-kernel";
import { integrationBindingConfigurationSnapshot } from "../integration-binding-configuration";
import { EMPYREAN_REFERENCE_PACKAGE, EmpyreanCompilationError } from "../reference-instances/empyrean-studios";
import {
  applicableCompanyPackages,
  getRegisteredCompanyPackage,
} from "../company-compilation/catalog";
import {
  compileRegisteredCompanyPackage,
  CompanyCompilationError,
} from "../company-compilation/engine";
import {
  captureNotionCompanySource,
  CompanySourceAdapterError,
} from "../company-compilation/notion-source-adapter";
import { DeclarativeMaterializationError } from "../company-compilation/declarative-materializer";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] || character,
  );
}

function candidatePortalInvitationEmail(input: {
  candidateName: string;
  companyName: string;
  opportunityTitle: string;
  url: string;
  expiresAt: Date;
  personalMessage: string;
}): { subject: string; body: string } {
  const personalMessage = input.personalMessage
    ? `<p>${escapeHtml(input.personalMessage).replace(/\n/g, "<br>")}</p>`
    : "";
  return {
    subject: `${input.companyName}: secure candidate workspace invitation`,
    body: `<p>Hello ${escapeHtml(input.candidateName)},</p>${personalMessage}<p>${escapeHtml(input.companyName)} has invited you to a private candidate workspace for ${escapeHtml(input.opportunityTitle)}.</p><p><a href="${escapeHtml(input.url)}">Open your secure candidate workspace</a></p><p>This link expires ${escapeHtml(input.expiresAt.toISOString())}. It is private, can be replaced or revoked, and should not be forwarded.</p><p>Consequential recruiting decisions remain with authorized human reviewers.</p>`,
  };
}

function companyIdFrom(req: Request): number {
  const value = Number(req.params.companyId);
  if (!Number.isInteger(value) || value <= 0)
    throw new EosRouteError(
      400,
      "invalid_company",
      "Company id must be a positive integer.",
    );
  return value;
}

function requestedSeatId(req: Request): string | undefined {
  const header = req.get("x-eos-seat-id")?.trim();
  const query =
    typeof req.query.seatId === "string" ? req.query.seatId.trim() : "";
  const value = header || query;
  if (!value) return undefined;
  if (!z.string().uuid().safeParse(value).success)
    throw new EosRouteError(
      400,
      "invalid_seat_context",
      "The requested role context is not a valid seat identifier.",
    );
  return value;
}

export class EosRouteError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function companyAccess(req: Request) {
  const companyId = companyIdFrom(req);
  const requested = requestedSeatId(req);
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  });
  if (!company)
    throw new EosRouteError(
      404,
      "company_not_found",
      "Company not found in the active principal scope.",
    );
  if (company.ownerUserId === req.user.id) {
    let founderSeat = await db.query.eosSeats.findFirst({
      where: and(
        eq(eosSeats.companyId, company.id),
        eq(eosSeats.kind, "founder"),
        eq(eosSeats.status, "active"),
      ),
      orderBy: [eosSeats.createdAt],
    });
    if (!founderSeat) {
      await db
        .insert(eosSeats)
        .values({
          id: randomUUID(),
          companyId: company.id,
          title: "Founder / Portfolio Principal",
          kind: "founder",
          occupantUserId: req.user.id,
          agentName: company.assistantName || "Assistant",
          agentMode: "assistant",
          mandate: "Own portfolio direction and final local authority.",
          authority: { level: "owner" },
          toolEntitlements: [],
        })
        .onConflictDoNothing();
      founderSeat = await db.query.eosSeats.findFirst({
        where: and(
          eq(eosSeats.companyId, company.id),
          eq(eosSeats.kind, "founder"),
          eq(eosSeats.status, "active"),
        ),
        orderBy: [eosSeats.createdAt],
      });
    }
    if (!founderSeat)
      throw new EosRouteError(
        500,
        "founder_seat_unavailable",
        "The founder operating seat could not be resolved.",
      );
    const founderAssignmentId = `founder:${founderSeat.id}`;
    const founderAssignmentNow = new Date();
    await db
      .insert(eosAssignments)
      .values({
        id: founderAssignmentId,
        companyId: company.id,
        membershipId: null,
        principalUserId: req.user.id,
        seatId: founderSeat.id,
        assignmentType: "occupant",
        operatingGrant: "operate",
        purpose: "govern",
        classificationCeiling: "restricted",
        status: "active",
        createdByUserId: req.user.id,
        metadata: { source: "founder_ownership" },
        effectiveFrom: founderAssignmentNow,
        createdAt: founderAssignmentNow,
        updatedAt: founderAssignmentNow,
      })
      .onConflictDoNothing();
    let assignments = await db
      .select()
      .from(eosAssignments)
      .where(
        and(
          eq(eosAssignments.companyId, company.id),
          eq(eosAssignments.principalUserId, req.user.id),
        ),
      );
    let assignment = selectOperatingAssignment(
      assignments,
      requested,
      founderSeat.id,
    );
    if (!assignment && !requested) {
      const reactivatedAt = new Date();
      await db
        .update(eosAssignments)
        .set({
          principalUserId: req.user.id,
          seatId: founderSeat.id,
          assignmentType: "occupant",
          operatingGrant: "operate",
          purpose: "govern",
          classificationCeiling: "restricted",
          status: "active",
          effectiveFrom: reactivatedAt,
          endedAt: null,
          updatedAt: reactivatedAt,
        })
        .where(eq(eosAssignments.id, founderAssignmentId));
      assignments = await db
        .select()
        .from(eosAssignments)
        .where(
          and(
            eq(eosAssignments.companyId, company.id),
            eq(eosAssignments.principalUserId, req.user.id),
          ),
        );
      assignment = selectOperatingAssignment(
        assignments,
        undefined,
        founderSeat.id,
        new Date(reactivatedAt.getTime() + 1),
      );
    }
    if (!assignment)
      throw new EosRouteError(
        403,
        "seat_context_denied",
        "The requested role is not an active operating assignment for this principal.",
      );
    const seat =
      assignment.seatId === founderSeat.id
        ? founderSeat
        : await db.query.eosSeats.findFirst({
            where: and(
              eq(eosSeats.id, assignment.seatId),
              eq(eosSeats.companyId, company.id),
              eq(eosSeats.status, "active"),
            ),
          });
    if (!seat)
      throw new EosRouteError(
        403,
        "active_seat_required",
        "The selected assignment has no active organizational seat.",
      );
    const kernel = await ensureSeatOperatingKernel(
      db,
      company,
      seat,
      req.user.id,
    );
    const grants = await db
      .select()
      .from(eosAuthorityGrants)
      .where(eq(eosAuthorityGrants.companyId, company.id));
    const effectiveAuthority = effectiveAuthorityFor(
      grants,
      req.user.id,
      seat.id,
    );
    return {
      company,
      seat,
      role: seat.kind as EosSeatKind,
      isOwner: seat.kind === "founder",
      isCompanyOwner: true,
      classificationCeiling: assignment.classificationCeiling,
      membership: null,
      assignment,
      assignments,
      kernel,
      effectiveAuthority,
      authorityCandidates: grants,
    };
  }
  const membership = await db.query.eosMemberships.findFirst({
    where: and(
      eq(eosMemberships.companyId, company.id),
      eq(eosMemberships.userId, req.user.id),
      eq(eosMemberships.status, "active"),
    ),
  });
  if (!membership)
    throw new EosRouteError(
      404,
      "company_not_found",
      "Company not found in the active principal scope.",
    );
  const assignments = await db
    .select()
    .from(eosAssignments)
    .where(
      and(
        eq(eosAssignments.companyId, company.id),
        eq(eosAssignments.principalUserId, req.user.id),
      ),
    );
  const assignment = selectOperatingAssignment(
    assignments,
    requested,
    membership.seatId,
  );
  if (!assignment)
    throw new EosRouteError(
      requested ? 403 : 409,
      requested ? "seat_context_denied" : "active_assignment_required",
      requested
        ? "The requested role is not an active operating assignment for this principal."
        : "This membership has no effective operating assignment.",
    );
  const seat = await db.query.eosSeats.findFirst({
    where: and(
      eq(eosSeats.id, assignment.seatId),
      eq(eosSeats.companyId, company.id),
      eq(eosSeats.status, "active"),
    ),
  });
  if (!seat)
    throw new EosRouteError(
      403,
      "active_seat_required",
      "This membership has no active organizational seat.",
    );
  const kernel = await ensureSeatOperatingKernel(
    db,
    company,
    seat,
    company.ownerUserId,
  );
  const grants = await db
    .select()
    .from(eosAuthorityGrants)
    .where(eq(eosAuthorityGrants.companyId, company.id));
  const effectiveAuthority = effectiveAuthorityFor(
    grants,
    req.user.id,
    seat.id,
  );
  return {
    company,
    seat,
    role: seat.kind as EosSeatKind,
    isOwner: false,
    isCompanyOwner: false,
    classificationCeiling: assignment.classificationCeiling,
    membership,
    assignment,
    assignments,
    kernel,
    effectiveAuthority,
    authorityCandidates: grants,
  };
}

async function ownedCompany(req: Request) {
  return (await companyAccess(req)).company;
}

export async function visibleSeatIds(
  companyId: number,
  seatId: string,
  role: EosSeatKind,
): Promise<Set<string>> {
  const seats = await db
    .select()
    .from(eosSeats)
    .where(
      and(eq(eosSeats.companyId, companyId), eq(eosSeats.status, "active")),
    );
  if (["founder", "portfolio_executive", "company_ceo"].includes(role))
    return new Set(seats.map((seat) => seat.id));
  const visible = new Set<string>([seatId]);
  if (["functional_executive", "manager"].includes(role)) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const seat of seats)
        if (
          seat.supervisorSeatId &&
          visible.has(seat.supervisorSeatId) &&
          !visible.has(seat.id)
        ) {
          visible.add(seat.id);
          changed = true;
        }
    }
  }
  return visible;
}

function mayManageOrganization(role: EosSeatKind): boolean {
  return ["founder", "company_ceo"].includes(role);
}

type AuthorityAccess = {
  seat: { id: string };
  effectiveAuthority: {
    grants: Array<{ authorityClasses: unknown; actionResourceScope?: unknown }>;
  };
};

function hasAuthority(
  access: AuthorityAccess,
  authorityClass: AuthorityClass,
  resource = "*",
  seatId = access.seat.id,
): boolean {
  return access.effectiveAuthority.grants.some(
    (grant) =>
      Array.isArray(grant.authorityClasses) &&
      grant.authorityClasses.includes(authorityClass) &&
      authorityGrantCoversResource(grant, resource, seatId),
  );
}

function mayAdminOrganization(
  access: AuthorityAccess & { role: EosSeatKind },
): boolean {
  return (
    mayManageOrganization(access.role) &&
    hasAuthority(access, "grant_access", "organization")
  );
}

export async function authorizeAction(
  req: Request,
  access: {
    company: { id: number };
    seat: { id: string };
    effectiveAuthority: { grants: any[] };
    authorityCandidates: any[];
  },
  rawAction: unknown,
  allowedOutcomes: readonly PolicyDecisionOutcome[] = ["permit"],
) {
  const action = policyActionContextSchema.parse(rawAction);
  const result = evaluatePolicyDecision({
    grants: access.authorityCandidates,
    principalKey: req.user.id,
    seatId: access.seat.id,
    action,
  });
  const trace = tracePair();
  const record = {
    id: randomUUID(),
    companyId: access.company.id,
    principalUserId: req.user.id,
    seatId: access.seat.id,
    evaluatedByUserId: req.user.id,
    authorityClass: action.authorityClass,
    resource: action.resource,
    actionKey: action.actionKey || null,
    purpose: action.purpose,
    context: action,
    outcome: result.outcome,
    reasonCodes: result.reasonCodes,
    matchedGrantIds: result.matchedGrantIds,
    satisfiedGrantId: result.satisfiedGrantId || null,
    requirements: result.requirements,
    traceId: trace.traceId,
    correlationId: trace.correlationId,
    createdAt: new Date(),
  };
  await db.insert(eosPolicyDecisions).values(record);
  if (!allowedOutcomes.includes(result.outcome)) {
    const status = result.outcome === "deny" ? 403 : 409;
    const explicitDenialCode = result.reasonCodes.find((reason) =>
      ["classification_ceiling_exceeded", "data_class_ceiling_exceeded"].includes(reason),
    );
    throw new EosRouteError(
      status,
      explicitDenialCode || `policy_${result.outcome}`,
      `Policy decision ${result.outcome.replaceAll("_", " ")}: ${result.reasonCodes.join(", ")}.`,
    );
  }
  return {
    ...result,
    decisionId: record.id,
    traceId: trace.traceId,
    correlationId: trace.correlationId,
  };
}

function mayManageMembership(
  actor: { role: EosSeatKind; userId: string },
  target: { role: string; userId: string },
): boolean {
  if (actor.userId === target.userId) return false;
  if (actor.role === "founder") return true;
  if (actor.role !== "company_ceo") return false;
  if (!eosSeatKinds.includes(target.role as EosSeatKind)) return false;
  const targetRank = visibilityPolicyFor(
    target.role as EosSeatKind,
  ).visibilityRank;
  return targetRank < visibilityPolicyFor("company_ceo").visibilityRank;
}

async function identityPolicyFor(companyId: number) {
  const stored = await db.query.eosOrganizationIdentityPolicies.findFirst({
    where: eq(eosOrganizationIdentityPolicies.companyId, companyId),
  });
  return (
    stored || {
      companyId,
      allowedEmailDomains: [],
      allowExternalCollaborators: true,
      updatedByUserId: null,
      updatedAt: null,
    }
  );
}

async function isActiveCompanyPrincipal(
  executor: any,
  company: { id: number; ownerUserId: string },
  userId: string,
): Promise<boolean> {
  if (userId === company.ownerUserId) return true;
  return Boolean(
    await executor.query.eosMemberships.findFirst({
      where: and(
        eq(eosMemberships.companyId, company.id),
        eq(eosMemberships.userId, userId),
        eq(eosMemberships.status, "active"),
      ),
    }),
  );
}

async function authoritySubjectDescendantIds(
  executor: any,
  companyId: number,
  rootId: string,
): Promise<string[]> {
  const ids = [rootId];
  let frontier = [rootId];
  while (frontier.length) {
    const children = await executor
      .select({ id: eosAuthoritySubjects.id })
      .from(eosAuthoritySubjects)
      .where(
        and(
          eq(eosAuthoritySubjects.companyId, companyId),
          inArray(eosAuthoritySubjects.parentSubjectId, frontier),
        ),
      );
    frontier = children
      .map((child: { id: string }) => child.id)
      .filter((id: string) => !ids.includes(id));
    ids.push(...frontier);
  }
  return ids;
}

function combinedEvidence(
  current: unknown,
  added: readonly string[],
): string[] {
  return Array.from(
    new Set([
      ...(Array.isArray(current)
        ? current.filter((item): item is string => typeof item === "string")
        : []),
      ...added,
    ]),
  );
}

function mayReview(role: EosSeatKind): boolean {
  return [
    "founder",
    "portfolio_executive",
    "company_ceo",
    "functional_executive",
    "manager",
  ].includes(role);
}

function companyProjection(
  company: typeof companies.$inferSelect,
  role: EosSeatKind,
) {
  if (["founder", "portfolio_executive", "company_ceo"].includes(role))
    return company;
  const shared = {
    id: company.id,
    portfolioId: company.portfolioId,
    name: company.name,
    type: company.type,
    stage: company.stage,
    offer: company.offer,
    targetCustomer: company.targetCustomer,
    goals: company.goals,
    createdAt: company.createdAt,
  };
  if (role === "functional_executive" || role === "manager") return shared;
  return {
    id: shared.id,
    name: shared.name,
    type: shared.type,
    stage: shared.stage,
  };
}

const classificationRank: Record<string, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

function withinClassificationCeiling(
  classification: string,
  ceiling: string,
): boolean {
  const itemRank = classificationRank[classification];
  const ceilingRank = classificationRank[ceiling];
  return (
    itemRank !== undefined &&
    ceilingRank !== undefined &&
    itemRank <= ceilingRank
  );
}

export function mayAccessClassification(
  access: { classificationCeiling: string },
  classification: string,
): boolean {
  // Ownership and hierarchical visibility never bypass the active data-
  // disclosure ceiling. More sensitive data requires a narrower grant.
  return withinClassificationCeiling(
    classification,
    access.classificationCeiling,
  );
}

function activeClassificationCeiling(access: {
  classificationCeiling: string;
}) {
  return z.enum(policyDataClassifications).parse(access.classificationCeiling);
}

function compiledAllowedSurfaces(access: {
  role: EosSeatKind;
  classificationCeiling: string;
}) {
  return allowedSurfacesFor(access.role).filter(
    (surface) =>
      !["talent", "systems"].includes(surface) ||
      withinClassificationCeiling("confidential", access.classificationCeiling),
  );
}

function portfolioProjection(
  portfolio: typeof portfolios.$inferSelect | undefined,
  role: EosSeatKind,
) {
  if (!portfolio) return null;
  if (role === "founder") return portfolio;
  if (role === "portfolio_executive")
    return {
      id: portfolio.id,
      name: portfolio.name,
      description: portfolio.description,
    };
  return { id: portfolio.id, name: portfolio.name };
}

function manifestProjection(
  record: typeof eosManifestVersions.$inferSelect | undefined,
  role: EosSeatKind,
) {
  if (!record) return null;
  if (["founder", "portfolio_executive", "company_ceo"].includes(role))
    return record;
  const manifest = record.manifest as Record<string, unknown>;
  const shared = {
    id: record.id,
    companyId: record.companyId,
    version: record.version,
    status: record.status,
    activatedAt: record.activatedAt,
  };
  if (role === "functional_executive")
    return {
      ...shared,
      manifest: {
        purpose: manifest.purpose,
        stage: manifest.stage,
        goals: manifest.goals,
        enabledModules: manifest.enabledModules,
      },
    };
  if (role === "manager")
    return {
      ...shared,
      manifest: { purpose: manifest.purpose, goals: manifest.goals },
    };
  return shared;
}

async function approverFor(
  company: typeof companies.$inferSelect,
  seat: typeof eosSeats.$inferSelect,
  classification = "public",
) {
  if (seat.kind === "founder")
    return { userId: company.ownerUserId, seatId: seat.id };
  let supervisorSeatId = seat.supervisorSeatId;
  const visited = new Set<string>();
  while (supervisorSeatId && !visited.has(supervisorSeatId)) {
    visited.add(supervisorSeatId);
    const supervisor = await db.query.eosSeats.findFirst({
      where: and(
        eq(eosSeats.id, supervisorSeatId),
        eq(eosSeats.companyId, company.id),
        eq(eosSeats.status, "active"),
      ),
    });
    if (!supervisor) break;
    if (
      supervisor.occupantUserId === company.ownerUserId ||
      supervisor.kind === "founder"
    )
      return { userId: company.ownerUserId, seatId: supervisor.id };
    if (supervisor.occupantUserId) {
      const membership = await db.query.eosMemberships.findFirst({
        where: and(
          eq(eosMemberships.companyId, company.id),
          eq(eosMemberships.userId, supervisor.occupantUserId),
          eq(eosMemberships.seatId, supervisor.id),
          eq(eosMemberships.status, "active"),
        ),
      });
      if (
        membership &&
        withinClassificationCeiling(
          classification,
          membership.classificationCeiling,
        )
      )
        return { userId: supervisor.occupantUserId, seatId: supervisor.id };
    }
    supervisorSeatId = supervisor.supervisorSeatId;
  }
  const founder = await db.query.eosSeats.findFirst({
    where: and(
      eq(eosSeats.companyId, company.id),
      eq(eosSeats.kind, "founder"),
    ),
  });
  return { userId: company.ownerUserId, seatId: founder?.id || null };
}

function tracePair() {
  return { traceId: randomUUID(), correlationId: randomUUID() };
}

function commandRecordKey(prefix: string, title: string, id: string): string {
  const slug =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "record";
  return `${prefix}:${slug}:${id.slice(0, 8)}`;
}

function commandFreshness(
  asOf: Date | null | undefined,
  updatedAt: Date | null | undefined,
) {
  const sourceAt = asOf || updatedAt;
  if (!sourceAt) return { status: "missing", asOf: null, ageDays: null };
  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - sourceAt.getTime()) / 86_400_000),
  );
  return {
    status: ageDays > 30 ? "stale" : "current",
    asOf: sourceAt.toISOString(),
    ageDays,
  };
}

async function assertCommandOwnerSeat(
  companyId: number,
  ownerSeatId: string,
  visible: Set<string>,
) {
  const owner = await db.query.eosSeats.findFirst({
    where: and(
      eq(eosSeats.id, ownerSeatId),
      eq(eosSeats.companyId, companyId),
      eq(eosSeats.status, "active"),
    ),
  });
  if (!owner || !visible.has(owner.id))
    throw new EosRouteError(
      403,
      "command_owner_denied",
      "The accountable seat is outside this role's visible organization scope.",
    );
  return owner;
}

async function assertCommandReferences(
  companyId: number,
  references: {
    workPacketIds?: string[];
    evidenceIds?: string[];
    metricIds?: string[];
  },
) {
  const unique = (values: string[] | undefined) =>
    Array.from(new Set(values || []));
  const workPacketIds = unique(references.workPacketIds);
  const evidenceIds = unique(references.evidenceIds);
  const metricIds = unique(references.metricIds);
  const [workPackets, evidence, metrics] = await Promise.all([
    workPacketIds.length
      ? db
          .select({ id: eosWorkPackets.id })
          .from(eosWorkPackets)
          .where(
            and(
              eq(eosWorkPackets.companyId, companyId),
              inArray(eosWorkPackets.id, workPacketIds),
            ),
          )
      : [],
    evidenceIds.length
      ? db
          .select({ id: eosEvidence.id })
          .from(eosEvidence)
          .where(
            and(
              eq(eosEvidence.companyId, companyId),
              inArray(eosEvidence.id, evidenceIds),
            ),
          )
      : [],
    metricIds.length
      ? db
          .select({ id: eosMetricsOutcomes.id })
          .from(eosMetricsOutcomes)
          .where(
            and(
              eq(eosMetricsOutcomes.companyId, companyId),
              inArray(eosMetricsOutcomes.id, metricIds),
            ),
          )
      : [],
  ]);
  if (
    workPackets.length !== workPacketIds.length ||
    evidence.length !== evidenceIds.length ||
    metrics.length !== metricIds.length
  )
    throw new EosRouteError(
      400,
      "command_reference_invalid",
      "Every linked work, evidence, and metric record must belong to this organization.",
    );
}

async function assertCommercialReferences(
  companyId: number,
  references: {
    stakeholderIds?: string[];
    audienceStakeholderIds?: string[];
    fromStakeholderId?: string;
    toStakeholderId?: string;
    offerId?: string;
    commercialCaseId?: string;
  },
) {
  const stakeholderIds = Array.from(
    new Set(
      [
        ...(references.stakeholderIds || []),
        ...(references.audienceStakeholderIds || []),
        references.fromStakeholderId,
        references.toStakeholderId,
      ].filter((value): value is string => Boolean(value)),
    ),
  );
  const [stakeholders, offers, cases] = await Promise.all([
    stakeholderIds.length
      ? db
          .select({ id: eosStakeholders.id })
          .from(eosStakeholders)
          .where(
            and(
              eq(eosStakeholders.companyId, companyId),
              inArray(eosStakeholders.id, stakeholderIds),
            ),
          )
      : [],
    references.offerId
      ? db
          .select({ id: eosOfferPrograms.id })
          .from(eosOfferPrograms)
          .where(
            and(
              eq(eosOfferPrograms.companyId, companyId),
              eq(eosOfferPrograms.id, references.offerId),
            ),
          )
      : [],
    references.commercialCaseId
      ? db
          .select({ id: eosCommercialCases.id })
          .from(eosCommercialCases)
          .where(
            and(
              eq(eosCommercialCases.companyId, companyId),
              eq(eosCommercialCases.id, references.commercialCaseId),
            ),
          )
      : [],
  ]);
  if (
    stakeholders.length !== stakeholderIds.length ||
    (references.offerId && offers.length !== 1) ||
    (references.commercialCaseId && cases.length !== 1)
  )
    throw new EosRouteError(
      400,
      "commercial_reference_invalid",
      "Every linked party, offer, and case must belong to this organization.",
    );
}

function identityReferenceHash(value: string): string {
  return createHash("sha256")
    .update(value.trim().toLowerCase().normalize("NFKC"))
    .digest("hex");
}

function assertMutableCommercialProjection(record: {
  sourceAuthority: string;
}) {
  if (record.sourceAuthority === "external_authoritative")
    throw new EosRouteError(
      409,
      "external_projection_immutable",
      "External-authoritative records cannot be overwritten in EOS. Reconcile the provider and append a corrected projection.",
    );
}

function assertCommercialSurface(access: { role: EosSeatKind }) {
  if (!allowedSurfacesFor(access.role).includes("commercial"))
    throw new EosRouteError(
      403,
      "commercial_scope_denied",
      "Stakeholder and commercial control is outside this role's compiled workspace.",
    );
}

function assertOperationsSurface(access: { role: EosSeatKind }) {
  if (!allowedSurfacesFor(access.role).includes("operations"))
    throw new EosRouteError(
      403,
      "operations_scope_denied",
      "Operations control is outside this role's compiled workspace.",
    );
}

function assertMutableOperationsProjection(record: {
  sourceAuthority: string;
}) {
  if (record.sourceAuthority === "external_authoritative")
    throw new EosRouteError(
      409,
      "external_projection_immutable",
      "External-authoritative Operations records cannot be overwritten in EOS. Reconcile the provider and append a corrected projection.",
    );
}

function assertFinanceSurface(access: { role: EosSeatKind }) {
  if (!allowedSurfacesFor(access.role).includes("capital"))
    throw new EosRouteError(
      403,
      "finance_scope_denied",
      "Finance and capital control is outside this role's compiled workspace.",
    );
}

function assertMutableFinanceProjection(record: { sourceAuthority: string }) {
  if (record.sourceAuthority === "external_authoritative")
    throw new EosRouteError(
      409,
      "external_projection_immutable",
      "External-authoritative Finance records cannot be overwritten in EOS. Reconcile the provider and append a corrected projection.",
    );
}

function assertSystemsSurface(access: {
  role: EosSeatKind;
  classificationCeiling: string;
}) {
  if (!compiledAllowedSurfaces(access).includes("systems"))
    throw new EosRouteError(
      403,
      "systems_scope_denied",
      "Systems and integration administration is outside this role's compiled workspace.",
    );
}

function assertMutableSystemsProjection(record: { sourceAuthority: string }) {
  if (record.sourceAuthority === "external_authoritative")
    throw new EosRouteError(
      409,
      "external_projection_immutable",
      "External-authoritative Systems records cannot be overwritten in EOS. Reconcile the provider and append a corrected projection.",
    );
}

function assertWorkforceSurface(access: { role: EosSeatKind }) {
  if (!allowedSurfacesFor(access.role).includes("workforce"))
    throw new EosRouteError(
      403,
      "workforce_scope_denied",
      "Workforce control is outside this role's compiled workspace.",
    );
}

function assertMutableWorkforceProjection(record: { sourceAuthority: string }) {
  if (record.sourceAuthority === "external_authoritative")
    throw new EosRouteError(
      409,
      "external_projection_immutable",
      "External-authoritative Workforce records cannot be overwritten in EOS. Reconcile the provider and append a corrected projection.",
    );
}

async function assertWorkforceReferences(
  companyId: number,
  references: {
    seatIds?: string[];
    assignmentId?: string;
    positionAgreementId?: string;
    positionAgreementIds?: string[];
    workPacketIds?: string[];
    metricIds?: string[];
    evidenceIds?: string[];
  },
) {
  const seatIds = Array.from(new Set(references.seatIds || []));
  const workPacketIds = Array.from(new Set(references.workPacketIds || []));
  const metricIds = Array.from(new Set(references.metricIds || []));
  const evidenceIds = Array.from(new Set(references.evidenceIds || []));
  const positionAgreementIds = Array.from(
    new Set([
      ...(references.positionAgreementIds || []),
      ...(references.positionAgreementId
        ? [references.positionAgreementId]
        : []),
    ]),
  );
  const [seats, assignments, agreements, workPackets, metrics, evidence] =
    await Promise.all([
      seatIds.length
        ? db
            .select()
            .from(eosSeats)
            .where(
              and(
                eq(eosSeats.companyId, companyId),
                inArray(eosSeats.id, seatIds),
              ),
            )
        : [],
      references.assignmentId
        ? db
            .select()
            .from(eosAssignments)
            .where(
              and(
                eq(eosAssignments.companyId, companyId),
                eq(eosAssignments.id, references.assignmentId),
              ),
            )
        : [],
      positionAgreementIds.length
        ? db
            .select()
            .from(eosPositionAgreements)
            .where(
              and(
                eq(eosPositionAgreements.companyId, companyId),
                inArray(eosPositionAgreements.id, positionAgreementIds),
              ),
            )
        : [],
      workPacketIds.length
        ? db
            .select()
            .from(eosWorkPackets)
            .where(
              and(
                eq(eosWorkPackets.companyId, companyId),
                inArray(eosWorkPackets.id, workPacketIds),
              ),
            )
        : [],
      metricIds.length
        ? db
            .select()
            .from(eosMetricsOutcomes)
            .where(
              and(
                eq(eosMetricsOutcomes.companyId, companyId),
                inArray(eosMetricsOutcomes.id, metricIds),
              ),
            )
        : [],
      evidenceIds.length
        ? db
            .select()
            .from(eosEvidence)
            .where(
              and(
                eq(eosEvidence.companyId, companyId),
                inArray(eosEvidence.id, evidenceIds),
              ),
            )
        : [],
    ]);
  if (
    seats.length !== seatIds.length ||
    (references.assignmentId && assignments.length !== 1) ||
    agreements.length !== positionAgreementIds.length ||
    workPackets.length !== workPacketIds.length ||
    metrics.length !== metricIds.length ||
    evidence.length !== evidenceIds.length
  )
    throw new EosRouteError(
      400,
      "workforce_reference_invalid",
      "Every linked seat, assignment, position agreement, work packet, metric, and evidence item must belong to this organization.",
    );
  return {
    seats,
    assignment: assignments[0],
    agreement: agreements[0],
    agreements,
    workPackets,
    metrics,
    evidence,
  };
}

function assertTalentSurface(access: {
  role: EosSeatKind;
  classificationCeiling: string;
}) {
  if (
    !compiledAllowedSurfaces(access).includes("talent") ||
    !mayReview(access.role)
  )
    throw new EosRouteError(
      403,
      "talent_scope_denied",
      "Talent and recruiting control is restricted to authorized managers and executives.",
    );
}

function assertMutableTalentProjection(record: { sourceAuthority: string }) {
  if (record.sourceAuthority === "external_authoritative")
    throw new EosRouteError(
      409,
      "external_projection_immutable",
      "External-authoritative Talent records cannot be overwritten in EOS. Reconcile the provider and append a corrected projection.",
    );
}

async function assertTalentReferences(
  companyId: number,
  references: {
    seatIds?: string[];
    talentNeedId?: string;
    applicationId?: string;
    stakeholderId?: string;
    candidateUserId?: string;
    capabilityInstanceId?: string;
    assignmentId?: string;
    evidenceIds?: string[];
  },
) {
  const seatIds = Array.from(new Set(references.seatIds || []));
  const evidenceIds = Array.from(new Set(references.evidenceIds || []));
  const [
    seats,
    needs,
    applications,
    stakeholders,
    candidateUsers,
    capabilities,
    assignments,
    evidence,
  ] = await Promise.all([
    seatIds.length
      ? db
          .select()
          .from(eosSeats)
          .where(
            and(
              eq(eosSeats.companyId, companyId),
              inArray(eosSeats.id, seatIds),
            ),
          )
      : [],
    references.talentNeedId
      ? db
          .select()
          .from(eosTalentNeeds)
          .where(
            and(
              eq(eosTalentNeeds.companyId, companyId),
              eq(eosTalentNeeds.id, references.talentNeedId),
            ),
          )
      : [],
    references.applicationId
      ? db
          .select()
          .from(eosTalentApplications)
          .where(
            and(
              eq(eosTalentApplications.companyId, companyId),
              eq(eosTalentApplications.id, references.applicationId),
            ),
          )
      : [],
    references.stakeholderId
      ? db
          .select()
          .from(eosStakeholders)
          .where(
            and(
              eq(eosStakeholders.companyId, companyId),
              eq(eosStakeholders.id, references.stakeholderId),
            ),
          )
      : [],
    references.candidateUserId
      ? db.select().from(users).where(eq(users.id, references.candidateUserId))
      : [],
    references.capabilityInstanceId
      ? db
          .select()
          .from(eosCapabilityInstances)
          .where(
            and(
              eq(eosCapabilityInstances.companyId, companyId),
              eq(eosCapabilityInstances.id, references.capabilityInstanceId),
            ),
          )
      : [],
    references.assignmentId
      ? db
          .select()
          .from(eosAssignments)
          .where(
            and(
              eq(eosAssignments.companyId, companyId),
              eq(eosAssignments.id, references.assignmentId),
            ),
          )
      : [],
    evidenceIds.length
      ? db
          .select()
          .from(eosEvidence)
          .where(
            and(
              eq(eosEvidence.companyId, companyId),
              inArray(eosEvidence.id, evidenceIds),
            ),
          )
      : [],
  ]);
  if (
    seats.length !== seatIds.length ||
    (references.talentNeedId && needs.length !== 1) ||
    (references.applicationId && applications.length !== 1) ||
    (references.stakeholderId && stakeholders.length !== 1) ||
    (references.candidateUserId && candidateUsers.length !== 1) ||
    (references.capabilityInstanceId && capabilities.length !== 1) ||
    (references.assignmentId && assignments.length !== 1) ||
    evidence.length !== evidenceIds.length
  )
    throw new EosRouteError(
      400,
      "talent_reference_invalid",
      "Every linked need, candidate identity, seat, capability, assignment, and evidence item must resolve inside this organization and identity registry.",
    );
  return {
    seats,
    need: needs[0],
    application: applications[0],
    stakeholder: stakeholders[0],
    candidateUser: candidateUsers[0],
    capability: capabilities[0],
    assignment: assignments[0],
    evidence,
  };
}

function reviewPacketEvidenceIds(value: {
  roleAssessments?: unknown;
  outcomeCoverage?: unknown;
}): string[] {
  const ids: string[] = [];
  if (Array.isArray(value.roleAssessments))
    for (const item of value.roleAssessments as Array<Record<string, unknown>>)
      for (const field of ["evidenceForIds", "evidenceAgainstIds"])
        if (Array.isArray(item[field])) ids.push(...item[field].map(String));
  if (Array.isArray(value.outcomeCoverage))
    for (const item of value.outcomeCoverage as Array<Record<string, unknown>>)
      if (Array.isArray(item.evidenceIds))
        ids.push(...item.evidenceIds.map(String));
  return Array.from(new Set(ids));
}

async function currentTalentReviewSnapshot(
  companyId: number,
  application: typeof eosTalentApplications.$inferSelect,
  content: { roleAssessments?: unknown; outcomeCoverage?: unknown },
) {
  const [need, assessments, candidateEvidence] = await Promise.all([
    db
      .select()
      .from(eosTalentNeeds)
      .where(
        and(
          eq(eosTalentNeeds.companyId, companyId),
          eq(eosTalentNeeds.id, application.talentNeedId),
        ),
      )
      .then((items) => items[0]),
    db
      .select()
      .from(eosTalentAssessments)
      .where(
        and(
          eq(eosTalentAssessments.companyId, companyId),
          eq(eosTalentAssessments.applicationId, application.id),
        ),
      ),
    db
      .select()
      .from(eosTalentCandidateEvidence)
      .where(
        and(
          eq(eosTalentCandidateEvidence.companyId, companyId),
          eq(eosTalentCandidateEvidence.applicationId, application.id),
        ),
      ),
  ]);
  if (!need)
    throw new EosRouteError(
      409,
      "talent_review_need_missing",
      "The institutional need for this candidate no longer resolves.",
    );
  const roles = Array.isArray(application.roleHypotheses)
    ? application.roleHypotheses.map(String)
    : [];
  const roleAssessments = Array.isArray(content.roleAssessments)
    ? (content.roleAssessments as Array<Record<string, unknown>>)
    : [];
  const suppliedRoles = roleAssessments.map((item) =>
    String(item.roleHypothesis || ""),
  );
  if (
    new Set(suppliedRoles).size !== suppliedRoles.length ||
    suppliedRoles.some((role) => !roles.includes(role))
  )
    throw new EosRouteError(
      409,
      "talent_review_role_hypothesis_invalid",
      "Every packet role assessment must be unique and match a current application role hypothesis.",
    );
  const requiredOutcomes = Array.isArray(need.requiredOutcomes)
    ? need.requiredOutcomes.map(String)
    : [];
  const coverage = Array.isArray(content.outcomeCoverage)
    ? (content.outcomeCoverage as Array<Record<string, unknown>>)
    : [];
  const suppliedOutcomes = coverage.map((item) => String(item.outcome || ""));
  if (
    new Set(suppliedOutcomes).size !== suppliedOutcomes.length ||
    suppliedOutcomes.some((outcome) => !requiredOutcomes.includes(outcome))
  )
    throw new EosRouteError(
      409,
      "talent_review_outcome_invalid",
      "Every outcome-coverage entry must be unique and match the current institutional need.",
    );
  const inheritedEvidenceIds = [
    ...(Array.isArray(application.evidenceIds)
      ? application.evidenceIds.map(String)
      : []),
    ...assessments.flatMap((item) =>
      Array.isArray(item.evidenceIds) ? item.evidenceIds.map(String) : [],
    ),
  ];
  const linkedEvidenceIds = Array.from(
    new Set([...inheritedEvidenceIds, ...reviewPacketEvidenceIds(content)]),
  );
  const refs = await assertTalentReferences(companyId, {
    evidenceIds: linkedEvidenceIds,
  });
  return {
    stageSnapshot: application.state,
    sourceApplicationUpdatedAt: application.updatedAt,
    roleHypothesesSnapshot: roles,
    requiredOutcomesSnapshot: requiredOutcomes,
    assessmentIds: assessments
      .filter((item) => item.state !== "cancelled")
      .map((item) => item.id),
    candidateEvidenceIds: candidateEvidence
      .filter(
        (item) =>
          item.state !== "withdrawn" &&
          ["not_applicable", "clean"].includes(item.scanState),
      )
      .map((item) => item.id),
    verifiedEvidenceIds: refs.evidence
      .filter((item) => item.verificationState === "verified")
      .map((item) => item.id),
  };
}

async function assertSystemsReferences(
  companyId: number,
  references: {
    systemIds?: string[];
    integrationBindingId?: string;
    granteeSeatId?: string;
    granteeSubjectId?: string;
    authorityGrantId?: string;
    workPacketId?: string;
    evidenceIds?: string[];
  },
) {
  const systemIds = Array.from(new Set(references.systemIds || []));
  const evidenceIds = Array.from(new Set(references.evidenceIds || []));
  const [systems, bindings, seats, subjects, grants, workPackets, evidence] =
    await Promise.all([
      systemIds.length
        ? db
            .select()
            .from(eosSystems)
            .where(
              and(
                eq(eosSystems.companyId, companyId),
                inArray(eosSystems.id, systemIds),
              ),
            )
        : [],
      references.integrationBindingId
        ? db
            .select()
            .from(eosIntegrationBindings)
            .where(
              and(
                eq(eosIntegrationBindings.companyId, companyId),
                eq(eosIntegrationBindings.id, references.integrationBindingId),
              ),
            )
        : [],
      references.granteeSeatId
        ? db
            .select()
            .from(eosSeats)
            .where(
              and(
                eq(eosSeats.companyId, companyId),
                eq(eosSeats.id, references.granteeSeatId),
              ),
            )
        : [],
      references.granteeSubjectId
        ? db
            .select()
            .from(eosAuthoritySubjects)
            .where(
              and(
                eq(eosAuthoritySubjects.companyId, companyId),
                eq(eosAuthoritySubjects.id, references.granteeSubjectId),
              ),
            )
        : [],
      references.authorityGrantId
        ? db
            .select()
            .from(eosAuthorityGrants)
            .where(
              and(
                eq(eosAuthorityGrants.companyId, companyId),
                eq(eosAuthorityGrants.id, references.authorityGrantId),
              ),
            )
        : [],
      references.workPacketId
        ? db
            .select()
            .from(eosWorkPackets)
            .where(
              and(
                eq(eosWorkPackets.companyId, companyId),
                eq(eosWorkPackets.id, references.workPacketId),
              ),
            )
        : [],
      evidenceIds.length
        ? db
            .select()
            .from(eosEvidence)
            .where(
              and(
                eq(eosEvidence.companyId, companyId),
                inArray(eosEvidence.id, evidenceIds),
              ),
            )
        : [],
    ]);
  if (
    systems.length !== systemIds.length ||
    (references.integrationBindingId && bindings.length !== 1) ||
    (references.granteeSeatId && seats.length !== 1) ||
    (references.granteeSubjectId && subjects.length !== 1) ||
    (references.authorityGrantId && grants.length !== 1) ||
    (references.workPacketId && workPackets.length !== 1) ||
    evidence.length !== evidenceIds.length
  )
    throw new EosRouteError(
      400,
      "systems_reference_invalid",
      "Every linked system, binding, grantee, authority grant, work packet, and evidence item must belong to this organization.",
    );
  return {
    systems,
    binding: bindings[0],
    seat: seats[0],
    subject: subjects[0],
    grant: grants[0],
    workPacket: workPackets[0],
    evidence,
  };
}

async function assertFinanceReferences(
  companyId: number,
  references: {
    financialSourceId?: string;
    financialPlanId?: string;
    workPacketId?: string;
    metricIds?: string[];
    evidenceIds?: string[];
    sourceValueFlowIds?: string[];
  },
) {
  const metricIds = Array.from(new Set(references.metricIds || []));
  const evidenceIds = Array.from(new Set(references.evidenceIds || []));
  const sourceValueFlowIds = Array.from(
    new Set(references.sourceValueFlowIds || []),
  );
  const [sources, plans, workPackets, metrics, evidence, valueFlows] =
    await Promise.all([
      references.financialSourceId
        ? db
            .select()
            .from(eosFinancialSources)
            .where(
              and(
                eq(eosFinancialSources.companyId, companyId),
                eq(eosFinancialSources.id, references.financialSourceId),
              ),
            )
        : [],
      references.financialPlanId
        ? db
            .select()
            .from(eosFinancialPlans)
            .where(
              and(
                eq(eosFinancialPlans.companyId, companyId),
                eq(eosFinancialPlans.id, references.financialPlanId),
              ),
            )
        : [],
      references.workPacketId
        ? db
            .select()
            .from(eosWorkPackets)
            .where(
              and(
                eq(eosWorkPackets.companyId, companyId),
                eq(eosWorkPackets.id, references.workPacketId),
              ),
            )
        : [],
      metricIds.length
        ? db
            .select()
            .from(eosMetricsOutcomes)
            .where(
              and(
                eq(eosMetricsOutcomes.companyId, companyId),
                inArray(eosMetricsOutcomes.id, metricIds),
              ),
            )
        : [],
      evidenceIds.length
        ? db
            .select()
            .from(eosEvidence)
            .where(
              and(
                eq(eosEvidence.companyId, companyId),
                inArray(eosEvidence.id, evidenceIds),
              ),
            )
        : [],
      sourceValueFlowIds.length
        ? db
            .select()
            .from(eosValueFlows)
            .where(
              and(
                eq(eosValueFlows.companyId, companyId),
                inArray(eosValueFlows.id, sourceValueFlowIds),
              ),
            )
        : [],
    ]);
  if (
    (references.financialSourceId && sources.length !== 1) ||
    (references.financialPlanId && plans.length !== 1) ||
    (references.workPacketId && workPackets.length !== 1) ||
    metrics.length !== metricIds.length ||
    evidence.length !== evidenceIds.length ||
    valueFlows.length !== sourceValueFlowIds.length
  )
    throw new EosRouteError(
      400,
      "finance_reference_invalid",
      "Every linked source, plan, work packet, metric, evidence item, and value flow must belong to this organization.",
    );
  return {
    source: sources[0],
    plan: plans[0],
    workPacket: workPackets[0],
    metrics,
    evidence,
    valueFlows,
  };
}

async function assertOperationsReferences(
  companyId: number,
  references: {
    capabilityInstanceId?: string;
    processDefinitionId?: string;
    resourceIds?: string[];
  },
) {
  const resourceIds = Array.from(new Set(references.resourceIds || []));
  const [capabilities, processes, resources] = await Promise.all([
    references.capabilityInstanceId
      ? db
          .select({ id: eosCapabilityInstances.id })
          .from(eosCapabilityInstances)
          .where(
            and(
              eq(eosCapabilityInstances.companyId, companyId),
              eq(eosCapabilityInstances.id, references.capabilityInstanceId),
            ),
          )
      : [],
    references.processDefinitionId
      ? db
          .select({
            id: eosProcessDefinitions.id,
            capabilityInstanceId: eosProcessDefinitions.capabilityInstanceId,
          })
          .from(eosProcessDefinitions)
          .where(
            and(
              eq(eosProcessDefinitions.companyId, companyId),
              eq(eosProcessDefinitions.id, references.processDefinitionId),
            ),
          )
      : [],
    resourceIds.length
      ? db
          .select({ id: eosResourcesAssets.id })
          .from(eosResourcesAssets)
          .where(
            and(
              eq(eosResourcesAssets.companyId, companyId),
              inArray(eosResourcesAssets.id, resourceIds),
            ),
          )
      : [],
  ]);
  if (
    (references.capabilityInstanceId && capabilities.length !== 1) ||
    (references.processDefinitionId && processes.length !== 1) ||
    resources.length !== resourceIds.length
  )
    throw new EosRouteError(
      400,
      "operations_reference_invalid",
      "Every linked capability, process, and resource must belong to this organization.",
    );
  if (
    references.capabilityInstanceId &&
    processes[0] &&
    processes[0].capabilityInstanceId !== references.capabilityInstanceId
  )
    throw new EosRouteError(
      400,
      "process_capability_mismatch",
      "The selected process does not serve the selected capability.",
    );
}

function assertCommandValidWindow(
  input: { validFrom?: string; validUntil?: string },
  current: { validFrom: Date; validUntil: Date | null },
) {
  const from = input.validFrom ? new Date(input.validFrom) : current.validFrom;
  const until = input.validUntil
    ? new Date(input.validUntil)
    : current.validUntil;
  if (until && until.getTime() <= from.getTime())
    throw new EosRouteError(
      400,
      "command_valid_window_invalid",
      "Valid until must be after valid from.",
    );
}

function jsonContentHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const customerValueProviderFixtureSpecs = [
  {
    providerKey: "gohighlevel",
    phaseKey: "commercial_delivery_reporting",
    operationKey: "crm.recovery_lifecycle_contract",
    liveProviderBlocker:
      "Exact GoHighLevel location, administrator, pipelines, workflows, calendars, forms, permission scope, recovery owner, and live health evidence remain unverified.",
  },
  {
    providerKey: "stripe",
    phaseKey: "agreement_payment_readiness",
    operationKey: "payments.success_exception_reconciliation_contract",
    liveProviderBlocker:
      "Exact Stripe merchant, administrator, products, prices, payment links, webhook endpoints, permission scope, recovery owner, and live health evidence remain unverified.",
  },
  {
    providerKey: "docusign",
    phaseKey: "agreement_payment_readiness",
    operationKey: "esign.send_complete_expire_contract",
    liveProviderBlocker:
      "Exact DocuSign account, template, sender, callback configuration, permission scope, recovery owner, and live health evidence remain unverified.",
  },
  {
    providerKey: "google-workspace",
    phaseKey: "onboarding_reporting",
    operationKey: "workspace.onboarding_calendar_reporting_contract",
    liveProviderBlocker:
      "Exact Google Workspace identities, mail, calendar, Drive resources, OAuth scopes, recovery owner, and live health evidence remain unverified.",
  },
  {
    providerKey: "notion",
    phaseKey: "onboarding_client_os",
    operationKey: "notion.client_os_fixture_contract",
    liveProviderBlocker:
      "Exact Notion workspace, integration identity, parent pages, database access, permission scope, recovery owner, and live health evidence remain unverified.",
  },
] as const;

const customerValueProviderFixtureScenarios = [
  ["normal_path", "A valid synthetic request produces the expected contract result without an external call."],
  ["denied_action", "A request without authority is denied and preserves cycle and provider state."],
  ["malformed_input", "Malformed or missing input is rejected before adapter dispatch."],
  ["provider_outage", "Provider unavailability blocks dependent work and selects the declared manual fallback."],
  ["duplicate_retry", "A duplicate or retry resolves to the stable fixture idempotency key without a second effect."],
  ["approval_separation", "Material execution remains blocked until the required approval and separation-of-duties checks pass."],
  ["recovery_rollback", "Failure enters recovery and the declared rollback restores a safe synthetic state."],
  ["audit_reconstruction", "Request, response, decision, evidence, trace, and correlation references reconstruct the fixture run."],
] as const;

function route(
  handler: (req: Request) => Promise<{ status?: number; body?: unknown }>,
) {
  return async (req: Request, res: any) => {
    try {
      const result = await handler(req);
      if (result.status === 204) return res.status(204).end();
      return res.status(result.status || 200).json(result.body);
    } catch (error) {
      if (error instanceof EosRouteError)
        return res
          .status(error.status)
          .json({ code: error.code, message: error.message });
      if (error instanceof z.ZodError)
        return res.status(400).json({
          code: "invalid_request",
          message: "Request did not match the EOS contract.",
          issues: error.issues,
        });
      console.error("EOS runtime request failed", error);
      return res.status(500).json({
        code: "eos_runtime_failed",
        message: "The EOS runtime request could not be completed.",
      });
    }
  };
}

const membershipInvitationRateLimit = fixedWindowRateLimit({
  limit: 20,
  windowMs: 60 * 60 * 1000,
  namespace: "membership-invitation",
  key: (req) =>
    `${req.user?.id || "unknown"}:${req.params.companyId || "unscoped"}`,
});

function publicInvitation(
  invitation: typeof eosMembershipInvitations.$inferSelect,
) {
  return {
    id: invitation.id,
    companyId: invitation.companyId,
    seatId: invitation.seatId,
    email: invitation.invitedEmail,
    status: invitation.status,
    purpose: invitation.purpose,
    classificationCeiling: invitation.classificationCeiling,
    portfolioScope: invitation.portfolioScope,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6; depth += 1) {
    if (!current || typeof current !== "object") return false;
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

function compiledOrganizationKey(manifest: unknown): string | null {
  if (!manifest || typeof manifest !== "object") return null;
  const compiledFrom = (manifest as any).compiledFrom;
  return typeof compiledFrom?.organizationKey === "string"
    ? compiledFrom.organizationKey
    : typeof compiledFrom?.companyPackage?.organizationKey === "string"
      ? compiledFrom.companyPackage.organizationKey
      : typeof compiledFrom?.referenceInstance?.organizationKey === "string"
        ? compiledFrom.referenceInstance.organizationKey
      : null;
}

async function latestOrganizationKey(companyId: number): Promise<string | null> {
  const manifest = await db.query.eosManifestVersions.findFirst({
    where: eq(eosManifestVersions.companyId, companyId),
    orderBy: [desc(eosManifestVersions.version)],
  });
  return compiledOrganizationKey(manifest?.manifest);
}

async function appendSharedServiceEvent(
  tx: any,
  input: {
    engagementId: string;
    sequence: number;
    actorCompanyId: number;
    actorUserId: string;
    actorSeatId: string;
    eventType: string;
    fromState: string;
    toState: string;
    note?: string;
    evidenceIds?: string[];
    traceId: string;
    correlationId: string;
    createdAt: Date;
  },
) {
  await tx.insert(eosSharedServiceEvents).values({
    id: randomUUID(),
    engagementId: input.engagementId,
    sequence: input.sequence,
    actorCompanyId: input.actorCompanyId,
    actorUserId: input.actorUserId,
    actorSeatId: input.actorSeatId,
    eventType: input.eventType,
    fromState: input.fromState,
    toState: input.toState,
    note: input.note || "",
    evidenceIds: input.evidenceIds || [],
    traceId: input.traceId,
    correlationId: input.correlationId,
    createdAt: input.createdAt,
  });
}

async function appendCustomerValueCycleEvent(
  tx: any,
  input: {
    cycleId: string;
    companyId: number;
    actorUserId: string;
    actorSeatId: string;
    sequence: number;
    eventType: string;
    fromState: string;
    toState: string;
    note?: string;
    evidenceIds?: string[];
    traceId: string;
    correlationId: string;
    createdAt: Date;
  },
) {
  await tx.insert(eosCustomerValueCycleEvents).values({
    id: randomUUID(),
    cycleId: input.cycleId,
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    actorSeatId: input.actorSeatId,
    sequence: input.sequence,
    eventType: input.eventType,
    fromState: input.fromState,
    toState: input.toState,
    note: input.note || "",
    evidenceIds: input.evidenceIds || [],
    traceId: input.traceId,
    correlationId: input.correlationId,
    createdAt: input.createdAt,
  });
}

export function registerEosRuntimeRoutes(app: Express): void {
  app.get(
    "/api/eos/companies/:companyId/context",
    route(async (req) => {
      const access = await companyAccess(req);
      const { company, seat, role } = access;
      const seatIds = await visibleSeatIds(company.id, seat.id, role);
      const [portfolio, manifest, allWorkPackets, allApprovals, allEvidence] =
        await Promise.all([
          company.portfolioId
            ? db.query.portfolios.findFirst({
                where: eq(portfolios.id, company.portfolioId),
              })
            : undefined,
          db.query.eosManifestVersions.findFirst({
            where: eq(eosManifestVersions.companyId, company.id),
            orderBy: [desc(eosManifestVersions.version)],
          }),
          db
            .select()
            .from(eosWorkPackets)
            .where(eq(eosWorkPackets.companyId, company.id)),
          db
            .select()
            .from(eosApprovalRequests)
            .where(eq(eosApprovalRequests.companyId, company.id)),
          db
            .select()
            .from(eosEvidence)
            .where(eq(eosEvidence.companyId, company.id)),
        ]);
      const workPackets = allWorkPackets.filter(
        (packet) =>
          mayAccessClassification(access, packet.classification) &&
          (access.isOwner ||
            (packet.accountableSeatId &&
              seatIds.has(packet.accountableSeatId))),
      );
      const packetIds = new Set(workPackets.map((packet) => packet.id));
      const approvals = allApprovals.filter(
        (approval) =>
          approval.assignedToUserId === req.user.id ||
          packetIds.has(approval.workPacketId),
      );
      const evidence = allEvidence.filter((item) =>
        packetIds.has(item.workPacketId),
      );
      const principalContext = {
        principalId: req.user.id,
        role,
        seatId: seat.id,
        seat: seat.title,
        communicationAgent:
          role === "founder"
            ? company.assistantName || "Assistant"
            : seat.agentName,
        communicationMode:
          role === "founder" ? "executive_assistant" : "role_agent_assistant",
        classificationCeiling: access.classificationCeiling,
        visibility: visibilityPolicyFor(role),
        allowedSurfaces: compiledAllowedSurfaces(access),
        authority: {
          classes: access.effectiveAuthority.classes,
          grants: access.effectiveAuthority.grants.map((grant) => ({
            id: grant.id,
            authorityKey:
              "authorityKey" in grant ? grant.authorityKey : grant.id,
            authorityClasses: grant.authorityClasses,
            actionResourceScope:
              "actionResourceScope" in grant ? grant.actionResourceScope : {},
            ceilingThreshold:
              "ceilingThreshold" in grant ? grant.ceilingThreshold : {},
            conditions: "conditions" in grant ? grant.conditions : [],
            requiredApprovals:
              "requiredApprovals" in grant ? grant.requiredApprovals : [],
            delegable: "delegable" in grant ? grant.delegable : false,
            effectiveUntil: grant.effectiveUntil,
          })),
        },
        toolEntitlements: Array.from(
          new Set([
            ...(Array.isArray(seat.toolEntitlements)
              ? seat.toolEntitlements.filter(
                  (tool): tool is string => typeof tool === "string",
                )
              : []),
            ...access.effectiveAuthority.toolEntitlements,
          ]),
        ),
        positionAgreement: access.kernel.positionAgreement,
        roleOperatingPack: access.kernel.roleOperatingPack,
        activeAssignmentId: access.assignment.id,
        availableAssignments: (
          await Promise.all(
            access.assignments
              .filter(
                (assignment) =>
                  assignment.status === "active" &&
                  assignment.effectiveFrom.getTime() <= Date.now() &&
                  (!assignment.effectiveUntil ||
                    assignment.effectiveUntil.getTime() > Date.now()),
              )
              .map(async (assignment) => {
                const assignedSeat = await db.query.eosSeats.findFirst({
                  where: and(
                    eq(eosSeats.id, assignment.seatId),
                    eq(eosSeats.companyId, company.id),
                    eq(eosSeats.status, "active"),
                  ),
                });
                return assignedSeat
                  ? {
                      id: assignment.id,
                      seatId: assignedSeat.id,
                      seat: assignedSeat.title,
                      role: assignedSeat.kind,
                      assignmentType: assignment.assignmentType,
                      operatingGrant: assignment.operatingGrant,
                      purpose: assignment.purpose,
                      classificationCeiling: assignment.classificationCeiling,
                      effectiveUntil: assignment.effectiveUntil,
                    }
                  : null;
              }),
          )
        ).filter(Boolean),
      };
      return {
        body: {
          company: companyProjection(company, role),
          portfolio: portfolioProjection(portfolio, role),
          manifest: manifestProjection(manifest, role),
          principalContext,
          counts: {
            openWorkPackets: workPackets.filter(
              (item) => !["completed", "cancelled"].includes(item.status),
            ).length,
            pendingApprovals: approvals.filter(
              (item) => item.status === "pending",
            ).length,
            evidence: evidence.length,
            blocked: workPackets.filter((item) => item.status === "blocked")
              .length,
          },
        },
      };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/advisor-council",
    route(async (req) => {
      const { company, role } = await companyAccess(req);
      if (!["founder", "portfolio_executive", "company_ceo"].includes(role))
        throw new EosRouteError(
          403,
          "advisor_scope_denied",
          "The portfolio advisory council is outside this seat's visibility scope.",
        );
      const portfolio = company.portfolioId
        ? await db.query.portfolios.findFirst({
            where: eq(portfolios.id, company.portfolioId),
          })
        : undefined;
      return {
        body: buildAdvisorCouncil({
          founderName: req.user.fullName || req.user.username,
          portfolioName: portfolio?.name,
          companyName: company.name,
          founderProfile: company.founderProfile as Record<string, unknown>,
          companyGoals: company.goals,
        }),
      };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/advisor-council/consultations",
    route(async (req) => {
      const access = await companyAccess(req);
      if (access.role !== "founder")
        throw new EosRouteError(
          403,
          "advisor_scope_denied",
          "Founder advisory deliberations are private to the founder's Executive Assistant channel.",
        );
      return {
        body: await db
          .select()
          .from(eosAdvisorConsultations)
          .where(eq(eosAdvisorConsultations.companyId, access.company.id))
          .orderBy(desc(eosAdvisorConsultations.createdAt))
          .limit(100),
      };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/organization-runtime",
    route(async (req) => {
      const access = await companyAccess(req);
      const canAdmin = mayAdminOrganization(access);
      if (canAdmin) await expireMembershipInvitations();
      const seats = await db
        .select()
        .from(eosSeats)
        .where(
          and(
            eq(eosSeats.companyId, access.company.id),
            eq(eosSeats.status, "active"),
          ),
        )
        .orderBy(eosSeats.createdAt);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const memberships = canAdmin
        ? await db
            .select({
              id: eosMemberships.id,
              userId: eosMemberships.userId,
              seatId: eosMemberships.seatId,
              portfolioMembershipId: eosMemberships.portfolioMembershipId,
              role: eosMemberships.role,
              status: eosMemberships.status,
              purpose: eosMemberships.purpose,
              classificationCeiling: eosMemberships.classificationCeiling,
              fullName: users.fullName,
              email: users.email,
            })
            .from(eosMemberships)
            .innerJoin(users, eq(users.id, eosMemberships.userId))
            .where(
              and(
                eq(eosMemberships.companyId, access.company.id),
                inArray(eosMemberships.status, ["active", "suspended"]),
              ),
            )
        : [];
      const assignments = canAdmin
        ? await db
            .select()
            .from(eosAssignments)
            .where(
              and(
                eq(eosAssignments.companyId, access.company.id),
                inArray(eosAssignments.status, ["active", "suspended"]),
              ),
            )
        : access.assignments;
      const invitations = canAdmin
        ? await db
            .select()
            .from(eosMembershipInvitations)
            .where(eq(eosMembershipInvitations.companyId, access.company.id))
            .orderBy(desc(eosMembershipInvitations.createdAt))
            .limit(100)
        : [];
      const [identityPolicy, teamSeats] = canAdmin
        ? await Promise.all([
            identityPolicyFor(access.company.id),
            teamSeatSummaryForOwner(access.company.ownerUserId),
          ])
        : [null, null];
      const visibleSeats = seats.filter((seat) => visible.has(seat.id));
      const visibleSeatIdsSet = new Set(visibleSeats.map((seat) => seat.id));
      const [
        positionFamilies,
        positionAgreements,
        roleOperatingPacks,
        authorityGrants,
        authoritySubjects,
      ] = await Promise.all([
        db
          .select()
          .from(eosPositionFamilies)
          .where(
            and(
              eq(eosPositionFamilies.companyId, access.company.id),
              inArray(eosPositionFamilies.status, ["draft", "active"]),
            ),
          ),
        db
          .select()
          .from(eosPositionAgreements)
          .where(
            and(
              eq(eosPositionAgreements.companyId, access.company.id),
              inArray(eosPositionAgreements.status, ["draft", "active"]),
            ),
          ),
        db
          .select()
          .from(eosRoleOperatingPacks)
          .where(
            and(
              eq(eosRoleOperatingPacks.companyId, access.company.id),
              inArray(eosRoleOperatingPacks.status, ["draft", "active"]),
            ),
          ),
        db
          .select()
          .from(eosAuthorityGrants)
          .where(
            and(
              eq(eosAuthorityGrants.companyId, access.company.id),
              inArray(eosAuthorityGrants.state, [
                "proposed",
                "active",
                "changing",
                "suspended",
              ]),
            ),
          ),
        db
          .select()
          .from(eosAuthoritySubjects)
          .where(
            and(
              eq(eosAuthoritySubjects.companyId, access.company.id),
              inArray(eosAuthoritySubjects.status, [
                "proposed",
                "provisioning",
                "active",
                "suspended",
              ]),
            ),
          ),
      ]);
      const runtimeBody = {
        seats: visibleSeats,
        memberships,
        assignments,
        invitations: invitations.map(publicInvitation),
        identityPolicy,
        teamSeats,
        activeSeatId: access.seat.id,
        positionFamilies: canAdmin
          ? positionFamilies
          : positionFamilies.filter((family) =>
              visibleSeats.some(
                (seat) =>
                  seat.positionAgreementId &&
                  positionAgreements.some(
                    (agreement) =>
                      agreement.id === seat.positionAgreementId &&
                      agreement.positionFamilyId === family.id,
                  ),
              ),
            ),
        positionAgreements: positionAgreements.filter(
          (agreement) =>
            canAdmin ||
            visibleSeats.some(
              (seat) => seat.positionAgreementId === agreement.id,
            ),
        ),
        roleOperatingPacks: roleOperatingPacks.filter(
          (pack) => canAdmin || visibleSeatIdsSet.has(pack.seatId),
        ),
        authorityGrants: canAdmin
          ? authorityGrants
          : access.effectiveAuthority.grants,
        authoritySubjects: canAdmin
          ? authoritySubjects
          : authoritySubjects.filter(
              (subject) =>
                subject.ownerUserId === req.user.id ||
                Boolean(
                  subject.seatId && visibleSeatIdsSet.has(subject.seatId),
                ),
            ),
      };
      const disclosedSubjects = runtimeBody.authoritySubjects as Array<
        typeof eosAuthoritySubjects.$inferSelect
      >;
      const disclosureFields = [
        {
          path: "/authoritySubjects",
          classification: "internal",
          dataClasses: ["organization_registry"],
          present: disclosedSubjects.length > 0,
        },
        {
          path: "/authoritySubjects/*/identityAttributes/credentialReference",
          classification: "highly_restricted",
          dataClasses: ["credential_reference"],
          present: disclosedSubjects.some((subject) =>
            Boolean((subject.identityAttributes as any)?.credentialReference),
          ),
        },
        {
          path: "/authoritySubjects/*/externalIdentityKey",
          classification: "restricted",
          dataClasses: ["security_identifier"],
          present: disclosedSubjects.some((subject) =>
            Boolean(subject.externalIdentityKey),
          ),
        },
        {
          path: "/authoritySubjects/*/evidenceReferences",
          classification: "restricted",
          dataClasses: ["governance_evidence"],
          present: disclosedSubjects.some(
            (subject) =>
              Array.isArray(subject.evidenceReferences) &&
              subject.evidenceReferences.length > 0,
          ),
        },
        {
          path: "/authoritySubjects/*/governanceContract",
          classification: "restricted",
          dataClasses: ["governance_evidence"],
          present: disclosedSubjects.some((subject) =>
            Boolean(
              subject.governanceContract &&
              Object.keys(subject.governanceContract as object).length,
            ),
          ),
        },
        {
          path: "/authoritySubjects/*/identityAttributes/memoryScope",
          classification: "restricted",
          dataClasses: ["agent_memory"],
          present: disclosedSubjects.some((subject) =>
            Boolean((subject.identityAttributes as any)?.memoryScope),
          ),
        },
        {
          path: "/authoritySubjects/*/identityAttributes/memberPrincipalIds",
          classification: "restricted",
          dataClasses: ["security_identifier"],
          present: disclosedSubjects.some((subject) =>
            Boolean(
              (subject.identityAttributes as any)?.memberPrincipalIds?.length,
            ),
          ),
        },
        {
          path: "/authoritySubjects/*/identityAttributes/externalAccountReference",
          classification: "restricted",
          dataClasses: ["security_identifier"],
          present: disclosedSubjects.some((subject) =>
            Boolean(
              (subject.identityAttributes as any)?.externalAccountReference,
            ),
          ),
        },
        {
          path: "/authoritySubjects/*/identityAttributes/providerSystemKeys",
          classification: "restricted",
          dataClasses: ["security_identifier"],
          present: disclosedSubjects.some((subject) =>
            Boolean(
              (subject.identityAttributes as any)?.providerSystemKeys?.length,
            ),
          ),
        },
      ]
        .filter((field) => field.present)
        .map(({ present: _present, ...field }) => field);
      const disclosureClassification = disclosureFields.some(
        (field) => field.classification === "highly_restricted",
      )
        ? "highly_restricted"
        : disclosureFields.some(
              (field) => field.classification === "restricted",
            )
          ? "restricted"
          : "internal";
      const disclosureDecision = await authorizeAction(
        req,
        access,
        {
          authorityClass: "view",
          resource: "authority_subject",
          actionKey: "organization_runtime.read",
          purpose: "administer_organization_registry",
          classification: disclosureClassification,
          consequence: "routine",
          dataClasses: Array.from(
            new Set(disclosureFields.flatMap((field) => field.dataClasses)),
          ),
          fieldInventoryComplete: true,
          fields: disclosureFields,
        },
        ["permit", "transform_minimize"],
      );
      const projectedBody =
        disclosureDecision.outcome === "transform_minimize"
          ? applyFieldTransformations(
              runtimeBody,
              disclosureDecision.requirements.transforms,
            )
          : runtimeBody;
      return {
        body: {
          ...projectedBody,
          disclosureDecision: {
            id: disclosureDecision.decisionId,
            outcome: disclosureDecision.outcome,
            reasonCodes: disclosureDecision.reasonCodes,
            transformedPaths: disclosureDecision.requirements.transforms.map(
              (transform) => transform.path,
            ),
          },
        },
      };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/policy-decisions/evaluate",
    route(async (req) => {
      const access = await companyAccess(req);
      const action = policyActionContextSchema.parse(req.body);
      const decision = await authorizeAction(req, access, action, [
        "permit",
        "deny",
        "require_approval",
        "require_evidence",
        "transform_minimize",
        "escalate",
      ]);
      return { status: 201, body: decision };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/policy-decisions",
    route(async (req) => {
      const access = await companyAccess(req);
      await authorizeAction(req, access, {
        authorityClass: "view",
        resource: "policy_decision",
        actionKey: "policy_decision.list",
        purpose: "review_policy_evidence",
        classification: activeClassificationCeiling(access),
      });
      const canSeeOrganization = mayAdminOrganization(access);
      const records = await db
        .select()
        .from(eosPolicyDecisions)
        .where(
          canSeeOrganization
            ? eq(eosPolicyDecisions.companyId, access.company.id)
            : and(
                eq(eosPolicyDecisions.companyId, access.company.id),
                eq(eosPolicyDecisions.principalUserId, req.user.id),
              ),
        )
        .orderBy(desc(eosPolicyDecisions.createdAt))
        .limit(200);
      return { body: records };
    }),
  );

  app.put(
    "/api/eos/companies/:companyId/identity-policy",
    route(async (req) => {
      const access = await companyAccess(req);
      if (access.role !== "founder")
        throw new EosRouteError(
          403,
          "identity_policy_manage_denied",
          "Only the founder may change organization identity policy.",
        );
      await authorizeAction(req, access, {
        authorityClass: "grant_access",
        resource: "organization_identity",
        actionKey: "organization_identity.update",
        purpose: "govern_organization_identity",
        classification: "restricted",
        consequence: "irreversible",
      });
      const input = organizationIdentityPolicySchema.parse(req.body);
      const domains = Array.from(
        new Set(
          input.allowedEmailDomains.map((domain) => domain.toLowerCase()),
        ),
      ).sort();
      const [policy] = await db
        .insert(eosOrganizationIdentityPolicies)
        .values({
          companyId: access.company.id,
          allowedEmailDomains: domains,
          allowExternalCollaborators: input.allowExternalCollaborators,
          updatedByUserId: req.user.id,
        })
        .onConflictDoUpdate({
          target: eosOrganizationIdentityPolicies.companyId,
          set: {
            allowedEmailDomains: domains,
            allowExternalCollaborators: input.allowExternalCollaborators,
            updatedByUserId: req.user.id,
            updatedAt: new Date(),
          },
        })
        .returning();
      const trace = tracePair();
      await db.insert(eosAuditRecords).values({
        id: randomUUID(),
        companyId: access.company.id,
        actorUserId: req.user.id,
        action: "identity_policy.updated",
        targetType: "organization_identity_policy",
        targetId: String(access.company.id),
        traceId: trace.traceId,
        correlationId: trace.correlationId,
        result: "configured",
        details: {
          allowedDomainCount: domains.length,
          allowExternalCollaborators: input.allowExternalCollaborators,
        },
      });
      return { body: policy };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/position-families",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!mayAdminOrganization(access))
        throw new EosRouteError(
          403,
          "position_family_manage_denied",
          "This role lacks organization-design and access-grant authority.",
        );
      await authorizeAction(req, access, {
        authorityClass: "grant_access",
        resource: "position_family",
        actionKey: "position_family.create",
        purpose: "design_organization_roles",
        classification: "restricted",
        consequence: "material",
      });
      const input = positionFamilyCreateSchema.parse(req.body);
      const now = new Date();
      try {
        const [family] = await db
          .insert(eosPositionFamilies)
          .values({
            id: randomUUID(),
            companyId: access.company.id,
            canonicalKey: input.canonicalKey,
            name: input.name,
            titleRoot: input.titleRoot,
            department: input.department,
            dominantResult: input.dominantResult,
            applicability: input.applicability,
            activationConditions: input.activationConditions,
            splitConditions: input.splitConditions,
            trackOptions: input.trackOptions,
            sourceType: "custom",
            templateAncestry: input.templateAncestry,
            status: "active",
            createdByUserId: req.user.id,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        const trace = tracePair();
        await db.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "position_family.created",
          targetType: "position_family",
          targetId: family.id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: "active",
          details: { canonicalKey: family.canonicalKey },
        });
        return { status: 201, body: family };
      } catch (error) {
        if (isUniqueViolation(error))
          throw new EosRouteError(
            409,
            "position_family_exists",
            "A position family with this canonical key already exists in the organization.",
          );
        throw error;
      }
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/position-agreements",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!mayAdminOrganization(access))
        throw new EosRouteError(
          403,
          "position_agreement_manage_denied",
          "This role lacks organization-design and access-grant authority.",
        );
      const input = positionAgreementCreateSchema.parse(req.body);
      await authorizeAction(req, access, {
        authorityClass: "grant_access",
        resource: "position_agreement",
        actionKey: input.activate
          ? "position_agreement.activate"
          : "position_agreement.draft",
        purpose: "define_role_accountability",
        classification: "restricted",
        consequence: input.activate ? "material" : "routine",
      });
      const outcome = await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${access.company.id}, 24705)`,
        );
        const family = await tx.query.eosPositionFamilies.findFirst({
          where: and(
            eq(eosPositionFamilies.id, input.positionFamilyId),
            eq(eosPositionFamilies.companyId, access.company.id),
            eq(eosPositionFamilies.status, "active"),
          ),
        });
        if (!family)
          throw new EosRouteError(
            400,
            "position_family_unavailable",
            "The position agreement must reference an active family in this organization.",
          );
        const previous = await tx.query.eosPositionAgreements.findFirst({
          where: and(
            eq(eosPositionAgreements.positionFamilyId, family.id),
            eq(eosPositionAgreements.levelCode, input.levelCode),
          ),
          orderBy: [desc(eosPositionAgreements.version)],
        });
        const now = new Date();
        if (input.activate)
          await tx
            .update(eosPositionAgreements)
            .set({ status: "superseded", effectiveUntil: now, updatedAt: now })
            .where(
              and(
                eq(eosPositionAgreements.positionFamilyId, family.id),
                eq(eosPositionAgreements.levelCode, input.levelCode),
                eq(eosPositionAgreements.status, "active"),
              ),
            );
        const [agreement] = await tx
          .insert(eosPositionAgreements)
          .values({
            id: randomUUID(),
            companyId: access.company.id,
            positionFamilyId: family.id,
            levelCode: input.levelCode,
            title: input.title,
            version: (previous?.version || 0) + 1,
            contract: input.contract,
            contentHash: jsonContentHash(input.contract),
            sourceType: "custom",
            templateAncestry: input.templateAncestry,
            status: input.activate ? "active" : "draft",
            effectiveFrom: now,
            createdByUserId: req.user.id,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        const trace = tracePair();
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "position_agreement.created",
          targetType: "position_agreement",
          targetId: agreement.id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: agreement.status,
          details: {
            familyId: family.id,
            levelCode: agreement.levelCode,
            version: agreement.version,
            contentHash: agreement.contentHash,
          },
        });
        return agreement;
      });
      return { status: 201, body: outcome };
    }),
  );

  app.put(
    "/api/eos/companies/:companyId/seats/:seatId/role-operating-pack",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!mayAdminOrganization(access))
        throw new EosRouteError(
          403,
          "role_pack_manage_denied",
          "This role lacks organization-design and access-grant authority.",
        );
      const input = roleOperatingPackUpdateSchema.parse(req.body);
      await authorizeAction(req, access, {
        authorityClass: "grant_access",
        resource: "role_operating_pack",
        actionKey: input.activate
          ? "role_operating_pack.activate"
          : "role_operating_pack.compile",
        purpose: "compile_role_operating_contract",
        classification: "restricted",
        consequence: input.activate ? "material" : "routine",
        targetSeatId: req.params.seatId,
      });
      const outcome = await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${access.company.id}, 24706)`,
        );
        const seat = await tx.query.eosSeats.findFirst({
          where: and(
            eq(eosSeats.id, req.params.seatId),
            eq(eosSeats.companyId, access.company.id),
            eq(eosSeats.status, "active"),
          ),
        });
        if (!seat)
          throw new EosRouteError(
            404,
            "seat_not_found",
            "The role pack seat was not found in this organization.",
          );
        if (
          access.role === "company_ceo" &&
          visibilityPolicyFor(seat.kind as EosSeatKind).visibilityRank >=
            visibilityPolicyFor("company_ceo").visibilityRank
        )
          throw new EosRouteError(
            403,
            "role_pack_authority_denied",
            "A Company CEO may compile only lower-role operating packs.",
          );
        const agreementId =
          input.positionAgreementId || seat.positionAgreementId;
        if (!agreementId)
          throw new EosRouteError(
            409,
            "position_agreement_required",
            "Activate a position agreement before compiling the role pack.",
          );
        const agreement = await tx.query.eosPositionAgreements.findFirst({
          where: and(
            eq(eosPositionAgreements.id, agreementId),
            eq(eosPositionAgreements.companyId, access.company.id),
          ),
        });
        if (!agreement || (input.activate && agreement.status !== "active"))
          throw new EosRouteError(
            409,
            "position_agreement_unavailable",
            "An active role pack must compile from an active position agreement in this organization.",
          );
        const previous = await tx.query.eosRoleOperatingPacks.findFirst({
          where: eq(eosRoleOperatingPacks.seatId, seat.id),
          orderBy: [desc(eosRoleOperatingPacks.version)],
        });
        const now = new Date();
        if (input.activate)
          await tx
            .update(eosRoleOperatingPacks)
            .set({ status: "superseded", effectiveUntil: now, updatedAt: now })
            .where(
              and(
                eq(eosRoleOperatingPacks.seatId, seat.id),
                eq(eosRoleOperatingPacks.status, "active"),
              ),
            );
        const [pack] = await tx
          .insert(eosRoleOperatingPacks)
          .values({
            id: randomUUID(),
            companyId: access.company.id,
            seatId: seat.id,
            positionAgreementId: agreement.id,
            version: (previous?.version || 0) + 1,
            contract: input.contract,
            contentHash: jsonContentHash(input.contract),
            compiledFrom: [agreement.id],
            status: input.activate ? "active" : "draft",
            effectiveFrom: now,
            compiledByUserId: req.user.id,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (input.activate)
          await tx
            .update(eosSeats)
            .set({
              positionAgreementId: agreement.id,
              mandate: input.contract.mission,
              toolEntitlements: input.contract.requiredTools,
              updatedAt: now,
            })
            .where(eq(eosSeats.id, seat.id));
        const trace = tracePair();
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "role_operating_pack.compiled",
          targetType: "role_operating_pack",
          targetId: pack.id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: pack.status,
          details: {
            seatId: seat.id,
            positionAgreementId: agreement.id,
            version: pack.version,
            contentHash: pack.contentHash,
          },
        });
        return pack;
      });
      return { status: 201, body: outcome };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/authority-subjects",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!mayAdminOrganization(access))
        throw new EosRouteError(
          403,
          "authority_subject_manage_denied",
          "This role lacks authority to register executable identities.",
        );
      const input = authoritySubjectCreateSchema.parse(req.body);
      await authorizeAction(req, access, {
        authorityClass: "grant_access",
        resource: "authority_subject",
        actionKey: "authority_subject.register",
        purpose: "register_canonical_security_subject",
        classification: "restricted",
        consequence: "material",
        targetSeatId: input.seatId,
      });
      const effectiveFrom = input.effectiveFrom
        ? new Date(input.effectiveFrom)
        : new Date();
      const effectiveUntil = input.effectiveUntil
        ? new Date(input.effectiveUntil)
        : null;
      const reviewAt = input.reviewAt ? new Date(input.reviewAt) : null;
      if (reviewAt && reviewAt <= effectiveFrom)
        throw new EosRouteError(
          400,
          "authority_subject_review_window_invalid",
          "Review At must be later than Effective From.",
        );
      const outcome = await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${access.company.id}, 24708)`,
        );
        const ownerUserId = input.ownerUserId || req.user.id;
        const principals = new Set<string>([ownerUserId]);
        if (input.subjectType === "agent")
          principals.add(input.identityAttributes.humanFallbackUserId);
        if (
          input.subjectType === "team" ||
          input.subjectType === "governing_body"
        )
          input.identityAttributes.memberPrincipalIds.forEach((id) =>
            principals.add(id),
          );
        if (input.subjectType === "service_account")
          principals.add(input.identityAttributes.rotationOwnerUserId);
        for (const principalId of Array.from(principals))
          if (
            !(await isActiveCompanyPrincipal(tx, access.company, principalId))
          )
            throw new EosRouteError(
              400,
              "authority_subject_principal_invalid",
              "Every owner, member, fallback, and rotation principal must hold active organization membership.",
            );
        const referencedSeatIds = Array.from(
          new Set(
            [input.seatId, input.supervisorSeatId].filter((id): id is string =>
              Boolean(id),
            ),
          ),
        );
        for (const seatId of referencedSeatIds) {
          const seat = await tx.query.eosSeats.findFirst({
            where: and(
              eq(eosSeats.id, seatId),
              eq(eosSeats.companyId, access.company.id),
              eq(eosSeats.status, "active"),
            ),
          });
          if (!seat)
            throw new EosRouteError(
              400,
              "authority_subject_seat_invalid",
              "Every subject seat and supervisor must be active in this organization.",
            );
        }
        if (input.subjectType === "agent" && input.parentSubjectId) {
          const parent = await tx.query.eosAuthoritySubjects.findFirst({
            where: and(
              eq(eosAuthoritySubjects.id, input.parentSubjectId),
              eq(eosAuthoritySubjects.companyId, access.company.id),
              eq(eosAuthoritySubjects.subjectType, "agent"),
            ),
          });
          if (!parent || parent.status === "retired")
            throw new EosRouteError(
              400,
              "authority_subject_parent_invalid",
              "A Sub-Agent requires one non-retired parent Agent in this organization.",
            );
          if (input.seatId && parent.seatId && input.seatId !== parent.seatId)
            throw new EosRouteError(
              400,
              "authority_subject_parent_seat_mismatch",
              "A Sub-Agent must inherit its parent Role Agent seat context.",
            );
        }
        const now = new Date();
        try {
          const [subject] = await tx
            .insert(eosAuthoritySubjects)
            .values({
              id: randomUUID(),
              companyId: access.company.id,
              portfolioId: access.company.portfolioId,
              subjectKey: input.subjectKey,
              subjectType: input.subjectType,
              displayName: input.displayName,
              ownerUserId,
              supervisorSeatId: input.supervisorSeatId || null,
              seatId: input.seatId || null,
              parentSubjectId:
                input.subjectType === "agent"
                  ? input.parentSubjectId || null
                  : null,
              agentClass:
                input.subjectType === "agent" ? input.agentClass : null,
              externalIdentityKey: input.externalIdentityKey || null,
              sourceAuthority: input.sourceAuthority,
              identityAttributes: input.identityAttributes,
              governanceContract: input.governanceContract,
              evidenceReferences: input.evidenceReferences,
              classificationCeiling: input.classificationCeiling,
              verificationStatus: "pending",
              status: "provisioning",
              effectiveFrom,
              effectiveUntil,
              reviewAt,
              createdByUserId: req.user.id,
              createdAt: now,
              updatedAt: now,
            })
            .returning();
          const trace = tracePair();
          await tx.insert(eosAuditRecords).values({
            id: randomUUID(),
            companyId: access.company.id,
            actorUserId: req.user.id,
            action: "authority_subject.registered",
            targetType: "authority_subject",
            targetId: subject.id,
            traceId: trace.traceId,
            correlationId: trace.correlationId,
            result: subject.status,
            details: {
              subjectKey: subject.subjectKey,
              subjectType: subject.subjectType,
              verificationStatus: subject.verificationStatus,
            },
          });
          return subject;
        } catch (error) {
          if (isUniqueViolation(error))
            throw new EosRouteError(
              409,
              "authority_subject_exists",
              "That canonical subject key, external identity, or primary agent seat is already registered.",
            );
          throw error;
        }
      });
      return { status: 201, body: outcome };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/authority-subjects/:subjectId",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!mayAdminOrganization(access))
        throw new EosRouteError(
          403,
          "authority_subject_manage_denied",
          "This role lacks authority to administer executable identities.",
        );
      const input = authoritySubjectTransitionSchema.parse(req.body);
      const irreversible = ["activate", "suspend", "retire", "reject"].includes(
        input.action,
      );
      await authorizeAction(req, access, {
        authorityClass: "grant_access",
        resource: "authority_subject",
        actionKey: `authority_subject.${input.action}`,
        purpose: "administer_canonical_security_subject",
        classification: "restricted",
        consequence: irreversible ? "irreversible" : "material",
      });
      const outcome = await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${access.company.id}, 24708)`,
        );
        const subject = await tx.query.eosAuthoritySubjects.findFirst({
          where: and(
            eq(eosAuthoritySubjects.id, req.params.subjectId),
            eq(eosAuthoritySubjects.companyId, access.company.id),
          ),
        });
        if (!subject)
          throw new EosRouteError(
            404,
            "authority_subject_not_found",
            "The canonical authority subject was not found in this organization.",
          );
        if (subject.status === "retired")
          throw new EosRouteError(
            409,
            "authority_subject_terminal",
            "A retired authority subject is terminal and cannot be changed.",
          );
        const persistentRoleAgent = Boolean(
          subject.seatId &&
          subject.subjectKey === `agent:${subject.seatId}:primary` &&
          subject.agentClass !== "sub_agent",
        );
        if (
          persistentRoleAgent &&
          ["retire", "reject"].includes(input.action)
        ) {
          throw new EosRouteError(
            409,
            "persistent_role_agent_retirement_denied",
            "A seat's primary Role Agent is a persistent organizational identity. Suspend it or retire the organizational seat instead.",
          );
        }
        const now = new Date();
        const evidenceReferences = combinedEvidence(
          subject.evidenceReferences,
          input.evidenceReferences,
        );
        let affectedSubjectIds = [subject.id];
        if (input.action === "verify") {
          if (
            !["proposed", "provisioning", "suspended"].includes(subject.status)
          )
            throw new EosRouteError(
              409,
              "authority_subject_verification_invalid",
              "Only a proposed, provisioning, or suspended subject can be verified.",
            );
          const reviewAt = input.reviewAt
            ? new Date(input.reviewAt)
            : subject.reviewAt;
          if (reviewAt && reviewAt <= now)
            throw new EosRouteError(
              400,
              "authority_subject_review_window_invalid",
              "A verification review deadline must be in the future.",
            );
          await tx
            .update(eosAuthoritySubjects)
            .set({
              verificationStatus: "verified",
              status: "provisioning",
              evidenceReferences,
              reviewAt,
              lastReviewedAt: now,
              reviewedByUserId: req.user.id,
              updatedAt: now,
            })
            .where(eq(eosAuthoritySubjects.id, subject.id));
        } else if (input.action === "activate") {
          if (
            subject.verificationStatus !== "verified" ||
            !["provisioning", "suspended"].includes(subject.status)
          )
            throw new EosRouteError(
              409,
              "authority_subject_activation_invalid",
              "Activation requires a verified provisioning or suspended subject.",
            );
          const reviewAt = new Date(input.reviewAt);
          if (reviewAt <= now)
            throw new EosRouteError(
              400,
              "authority_subject_review_window_invalid",
              "An active subject requires a future review deadline.",
            );
          if (subject.effectiveUntil && subject.effectiveUntil <= now)
            throw new EosRouteError(
              409,
              "authority_subject_expired",
              "An expired subject cannot be activated.",
            );
          if (subject.seatId) {
            const seat = await tx.query.eosSeats.findFirst({
              where: and(
                eq(eosSeats.id, subject.seatId),
                eq(eosSeats.companyId, access.company.id),
                eq(eosSeats.status, "active"),
              ),
            });
            if (!seat)
              throw new EosRouteError(
                409,
                "authority_subject_seat_unavailable",
                "The subject's organizational seat is not active.",
              );
          }
          if (subject.parentSubjectId) {
            const parent = await tx.query.eosAuthoritySubjects.findFirst({
              where: and(
                eq(eosAuthoritySubjects.id, subject.parentSubjectId),
                eq(eosAuthoritySubjects.companyId, access.company.id),
              ),
            });
            if (!parent || !authoritySubjectIsEffective(parent, now))
              throw new EosRouteError(
                409,
                "authority_subject_parent_inactive",
                "A Sub-Agent cannot activate until its parent Agent is active, verified, and current.",
              );
          }
          await tx
            .update(eosAuthoritySubjects)
            .set({
              status: "active",
              reviewAt,
              evidenceReferences,
              lastReviewedAt: now,
              reviewedByUserId: req.user.id,
              suspendedAt: null,
              updatedAt: now,
            })
            .where(eq(eosAuthoritySubjects.id, subject.id));
        } else if (input.action === "review") {
          if (
            subject.status !== "active" ||
            subject.verificationStatus !== "verified"
          )
            throw new EosRouteError(
              409,
              "authority_subject_review_invalid",
              "Only an active verified subject can complete periodic review.",
            );
          const reviewAt = new Date(input.reviewAt);
          if (reviewAt <= now)
            throw new EosRouteError(
              400,
              "authority_subject_review_window_invalid",
              "The next review deadline must be in the future.",
            );
          await tx
            .update(eosAuthoritySubjects)
            .set({
              reviewAt,
              evidenceReferences,
              lastReviewedAt: now,
              reviewedByUserId: req.user.id,
              updatedAt: now,
            })
            .where(eq(eosAuthoritySubjects.id, subject.id));
        } else {
          affectedSubjectIds = await authoritySubjectDescendantIds(
            tx,
            access.company.id,
            subject.id,
          );
          if (input.action === "suspend") {
            if (
              !affectedSubjectIds.length ||
              !["active", "provisioning"].includes(subject.status)
            )
              throw new EosRouteError(
                409,
                "authority_subject_suspension_invalid",
                "Only an active or provisioning subject can be suspended.",
              );
            await tx
              .update(eosAuthoritySubjects)
              .set({
                status: "suspended",
                suspendedAt: now,
                evidenceReferences,
                updatedAt: now,
              })
              .where(inArray(eosAuthoritySubjects.id, affectedSubjectIds));
            await tx
              .update(eosAuthorityGrants)
              .set({ state: "suspended", updatedAt: now })
              .where(
                and(
                  inArray(
                    eosAuthorityGrants.granteeSubjectId,
                    affectedSubjectIds,
                  ),
                  eq(eosAuthorityGrants.state, "active"),
                ),
              );
          } else {
            const rejected = input.action === "reject";
            await tx
              .update(eosAuthoritySubjects)
              .set({
                status: "retired",
                retiredAt: now,
                evidenceReferences,
                updatedAt: now,
              })
              .where(inArray(eosAuthoritySubjects.id, affectedSubjectIds));
            if (rejected)
              await tx
                .update(eosAuthoritySubjects)
                .set({ verificationStatus: "rejected", updatedAt: now })
                .where(eq(eosAuthoritySubjects.id, subject.id));
            await tx
              .update(eosAuthorityGrants)
              .set({
                state: "revoked",
                revokedAt: now,
                revokedByUserId: req.user.id,
                updatedAt: now,
              })
              .where(
                and(
                  inArray(
                    eosAuthorityGrants.granteeSubjectId,
                    affectedSubjectIds,
                  ),
                  inArray(eosAuthorityGrants.state, [
                    "proposed",
                    "changing",
                    "active",
                    "suspended",
                  ]),
                ),
              );
          }
        }
        const updated = await tx.query.eosAuthoritySubjects.findFirst({
          where: eq(eosAuthoritySubjects.id, subject.id),
        });
        const trace = tracePair();
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: `authority_subject.${input.action}`,
          targetType: "authority_subject",
          targetId: subject.id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: updated?.status || subject.status,
          details: {
            affectedSubjectIds,
            verificationStatus: updated?.verificationStatus,
            evidenceReferences,
          },
        });
        return updated;
      });
      return { body: outcome };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/authority-grants",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!mayAdminOrganization(access))
        throw new EosRouteError(
          403,
          "authority_grant_manage_denied",
          "This role lacks effective Grant Access authority.",
        );
      await authorizeAction(req, access, {
        authorityClass: "grant_access",
        resource: "authority_grant",
        actionKey: "authority_grant.create",
        purpose: "administer_explicit_authority",
        classification: "restricted",
        consequence: "irreversible",
      });
      const input = authorityGrantCreateSchema.parse(req.body);
      const requestedClasses = input.authorityClasses as AuthorityClass[];
      const ceilingThreshold = authorityCeilingSchema.parse(
        input.ceilingThreshold,
      );
      const conditionRules = z
        .array(policyConditionRuleSchema)
        .parse(input.conditionRules);
      const approvalPolicy = authorityApprovalPolicySchema.parse(
        input.approvalPolicy,
      );
      const separationOfDuties = z
        .array(separationOfDutiesRuleSchema)
        .parse(input.separationOfDuties);
      if (
        requestedClasses.some(
          (authorityClass) => !hasAuthority(access, authorityClass, "*"),
        )
      )
        throw new EosRouteError(
          403,
          "authority_escalation_denied",
          "A grantor cannot grant an authority class they do not currently hold at organization scope.",
        );
      if (
        input.delegable &&
        !hasAuthority(access, "delegate", "authority_grant")
      )
        throw new EosRouteError(
          403,
          "delegation_authority_denied",
          "A delegable grant requires effective Delegate authority for Authority Grants.",
        );
      if (input.activate && !hasAuthority(access, "approve", "authority_grant"))
        throw new EosRouteError(
          403,
          "grant_activation_denied",
          "Activating a grant requires effective Approve authority for Authority Grants.",
        );
      if (input.granteeType === "other")
        throw new EosRouteError(
          409,
          "grantee_type_unsupported",
          "Authority cannot activate for an unresolved 'other' identity. Register a canonical subject type first.",
        );
      if (
        input.actionResourceScope.companyId &&
        input.actionResourceScope.companyId !== access.company.id
      )
        throw new EosRouteError(
          400,
          "grant_company_scope_invalid",
          "The Authority Grant resource scope must match this organization.",
        );
      const resourceSeatId = input.actionResourceScope.seatId;
      if (resourceSeatId && input.seatId && resourceSeatId !== input.seatId)
        throw new EosRouteError(
          400,
          "grant_seat_scope_invalid",
          "The Authority Grant seat bindings must identify the same organizational seat.",
        );
      const effectiveFrom = input.effectiveFrom
        ? new Date(input.effectiveFrom)
        : new Date();
      const effectiveUntil = input.effectiveUntil
        ? new Date(input.effectiveUntil)
        : null;
      const reviewAt = input.reviewAt ? new Date(input.reviewAt) : null;
      if (effectiveUntil && effectiveUntil <= effectiveFrom)
        throw new EosRouteError(
          400,
          "authority_window_invalid",
          "Effective Until must be later than Effective From.",
        );
      if (reviewAt && reviewAt <= effectiveFrom)
        throw new EosRouteError(
          400,
          "authority_review_window_invalid",
          "Review At must be later than Effective From.",
        );
      const highRisk =
        requestedClasses.some((authorityClass) =>
          ["spend", "sign", "grant_access", "override_emergency"].includes(
            authorityClass,
          ),
        ) ||
        ["restricted", "highly_restricted", "contextual"].includes(
          ceilingThreshold.classification || "",
        ) ||
        ["irreversible", "emergency"].includes(
          ceilingThreshold.consequence || "",
        );
      if (input.activate && highRisk && !reviewAt && !effectiveUntil)
        throw new EosRouteError(
          400,
          "sensitive_grant_review_required",
          "Sensitive active grants require a review deadline or effective-until date.",
        );
      const outcome = await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${access.company.id}, 24707)`,
        );
        let boundSeat: typeof eosSeats.$inferSelect | null = null;
        let boundSubject: typeof eosAuthoritySubjects.$inferSelect | null =
          null;
        if (input.granteeType === "seat") {
          boundSeat =
            (await tx.query.eosSeats.findFirst({
              where: and(
                eq(eosSeats.id, input.granteeKey),
                eq(eosSeats.companyId, access.company.id),
                eq(eosSeats.status, "active"),
              ),
            })) || null;
          if (
            !boundSeat ||
            (input.seatId && input.seatId !== boundSeat.id) ||
            (resourceSeatId && resourceSeatId !== boundSeat.id)
          )
            throw new EosRouteError(
              400,
              "grantee_seat_invalid",
              "The grantee and resource seat must identify one active seat in this organization.",
            );
          if (
            access.role === "company_ceo" &&
            visibilityPolicyFor(boundSeat.kind as EosSeatKind).visibilityRank >=
              visibilityPolicyFor("company_ceo").visibilityRank
          )
            throw new EosRouteError(
              403,
              "grant_scope_denied",
              "A Company CEO may grant authority only to lower organizational roles.",
            );
        } else if (input.granteeType === "principal") {
          const principalIsOwner =
            input.granteeKey === access.company.ownerUserId;
          const membership = principalIsOwner
            ? null
            : await tx.query.eosMemberships.findFirst({
                where: and(
                  eq(eosMemberships.companyId, access.company.id),
                  eq(eosMemberships.userId, input.granteeKey),
                  eq(eosMemberships.status, "active"),
                ),
              });
          if (!principalIsOwner && !membership)
            throw new EosRouteError(
              400,
              "grantee_principal_invalid",
              "A principal grant requires an active membership in this organization.",
            );
          if (access.role === "company_ceo" && input.granteeKey === req.user.id)
            throw new EosRouteError(
              403,
              "self_grant_denied",
              "A Company CEO cannot expand their own authority.",
            );
          const principalSeatId = input.seatId || resourceSeatId;
          if (principalSeatId) {
            boundSeat =
              (await tx.query.eosSeats.findFirst({
                where: and(
                  eq(eosSeats.id, principalSeatId),
                  eq(eosSeats.companyId, access.company.id),
                  eq(eosSeats.status, "active"),
                ),
              })) || null;
            if (!boundSeat)
              throw new EosRouteError(
                400,
                "grant_seat_invalid",
                "The grant seat scope must belong to this organization.",
              );
          }
        } else {
          boundSubject =
            (await tx.query.eosAuthoritySubjects.findFirst({
              where: and(
                eq(eosAuthoritySubjects.companyId, access.company.id),
                eq(eosAuthoritySubjects.subjectType, input.granteeType),
                eq(eosAuthoritySubjects.subjectKey, input.granteeKey),
              ),
            })) || null;
          if (!boundSubject)
            throw new EosRouteError(
              400,
              "grantee_registry_required",
              "The Authority Grant must bind to a canonical subject of the same type and key.",
            );
          if (input.activate && !authoritySubjectIsEffective(boundSubject))
            throw new EosRouteError(
              409,
              "grantee_subject_inactive",
              "An active grant requires an active, verified, current subject with a current review.",
            );
          if (
            input.seatId &&
            boundSubject.seatId &&
            input.seatId !== boundSubject.seatId
          )
            throw new EosRouteError(
              400,
              "grant_seat_scope_invalid",
              "The grant seat must match the canonical subject seat.",
            );
          if (
            resourceSeatId &&
            boundSubject.seatId &&
            resourceSeatId !== boundSubject.seatId
          )
            throw new EosRouteError(
              400,
              "grant_seat_scope_invalid",
              "The resource seat must match the canonical subject seat.",
            );
          if (boundSubject.seatId)
            boundSeat =
              (await tx.query.eosSeats.findFirst({
                where: and(
                  eq(eosSeats.id, boundSubject.seatId),
                  eq(eosSeats.companyId, access.company.id),
                  eq(eosSeats.status, "active"),
                ),
              })) || null;
          if (
            access.role === "company_ceo" &&
            (!boundSeat ||
              visibilityPolicyFor(boundSeat.kind as EosSeatKind)
                .visibilityRank >=
                visibilityPolicyFor("company_ceo").visibilityRank)
          )
            throw new EosRouteError(
              403,
              "grant_scope_denied",
              "A Company CEO may grant authority only to a canonical subject bound to a lower organizational role.",
            );
        }
        const now = new Date();
        const [grant] = await tx
          .insert(eosAuthorityGrants)
          .values({
            id: randomUUID(),
            companyId: access.company.id,
            portfolioId: access.company.portfolioId,
            authorityKey: input.authorityKey,
            granteeType: input.granteeType,
            granteeKey: input.granteeKey,
            granteeSubjectId: boundSubject?.id || null,
            grantorType: "principal",
            grantorKey: req.user.id,
            seatId: boundSeat?.id || null,
            capabilityKey: input.capabilityKey || null,
            effect: input.effect,
            authorityClasses: requestedClasses,
            actionResourceScope: input.actionResourceScope,
            ceilingThreshold,
            conditions: input.conditions,
            requiredApprovals: input.requiredApprovals,
            delegable: input.delegable,
            conditionRules,
            approvalPolicy,
            separationOfDuties,
            toolEntitlements: input.toolEntitlements,
            policyDecisionSource: input.policyDecisionSource,
            evidenceReferences: input.evidenceReferences,
            revocationDependentWork: input.revocationDependentWork,
            state: input.activate ? "active" : "proposed",
            effectiveFrom,
            effectiveUntil,
            reviewAt,
            lastReviewedAt: input.activate ? now : null,
            reviewedByUserId: input.activate ? req.user.id : null,
            createdByUserId: req.user.id,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        const trace = tracePair();
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "authority_grant.created",
          targetType: "authority_grant",
          targetId: grant.id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: grant.state,
          details: {
            authorityKey: grant.authorityKey,
            granteeType: grant.granteeType,
            granteeKey: grant.granteeKey,
            authorityClasses: grant.authorityClasses,
            effectiveUntil: grant.effectiveUntil,
          },
        });
        return grant;
      });
      return { status: 201, body: outcome };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/authority-grants/:grantId",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!mayAdminOrganization(access))
        throw new EosRouteError(
          403,
          "authority_grant_manage_denied",
          "This role lacks effective Grant Access authority.",
        );
      const input = authorityGrantTransitionSchema.parse(req.body);
      await authorizeAction(
        req,
        access,
        {
          authorityClass: "grant_access",
          resource: "authority_grant",
          actionKey:
            input.reviewAt && input.state === "active"
              ? "authority_grant.review"
              : `authority_grant.${input.state}`,
          purpose: "administer_explicit_authority",
          classification: "restricted",
          consequence: "irreversible",
        },
        input.reviewAt && input.state === "active"
          ? ["permit", "escalate"]
          : ["permit"],
      );
      const outcome = await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${access.company.id}, 24707)`,
        );
        const grant = await tx.query.eosAuthorityGrants.findFirst({
          where: and(
            eq(eosAuthorityGrants.id, req.params.grantId),
            eq(eosAuthorityGrants.companyId, access.company.id),
          ),
        });
        if (!grant)
          throw new EosRouteError(
            404,
            "authority_grant_not_found",
            "The authority grant was not found in this organization.",
          );
        const transitions: Record<string, readonly string[]> = {
          proposed: ["active", "revoked"],
          changing: ["active", "revoked"],
          active: ["active", "suspended", "revoked"],
          suspended: ["active", "revoked"],
          expired: [],
          revoked: [],
        };
        if (!transitions[grant.state]?.includes(input.state))
          throw new EosRouteError(
            409,
            "authority_transition_invalid",
            `Authority Grant cannot transition from ${grant.state} to ${input.state}.`,
          );
        if (input.state === "active") {
          if (!hasAuthority(access, "approve", "authority_grant"))
            throw new EosRouteError(
              403,
              "grant_activation_denied",
              "Activating a grant requires effective Approve authority for Authority Grants.",
            );
          const classes = Array.isArray(grant.authorityClasses)
            ? grant.authorityClasses.filter(
                (item): item is AuthorityClass =>
                  typeof item === "string" &&
                  authorityClasses.includes(item as AuthorityClass),
              )
            : [];
          if (
            classes.some(
              (authorityClass) => !hasAuthority(access, authorityClass, "*"),
            )
          )
            throw new EosRouteError(
              403,
              "authority_escalation_denied",
              "A grantor cannot activate an authority class they do not currently hold at organization scope.",
            );
          if (
            grant.delegable &&
            !hasAuthority(access, "delegate", "authority_grant")
          )
            throw new EosRouteError(
              403,
              "delegation_authority_denied",
              "Activating a delegable grant requires effective Delegate authority for Authority Grants.",
            );
          const nextReviewAt = input.reviewAt
            ? new Date(input.reviewAt)
            : grant.reviewAt;
          if (nextReviewAt && nextReviewAt <= new Date())
            throw new EosRouteError(
              400,
              "authority_review_window_invalid",
              "An activated grant must have a future review deadline.",
            );
          const ceiling = authorityCeilingSchema.parse(
            grant.ceilingThreshold || {},
          );
          const highRisk =
            classes.some((authorityClass) =>
              ["spend", "sign", "grant_access", "override_emergency"].includes(
                authorityClass,
              ),
            ) ||
            ["restricted", "highly_restricted", "contextual"].includes(
              ceiling.classification || "",
            ) ||
            ["irreversible", "emergency"].includes(ceiling.consequence || "");
          if (highRisk && !nextReviewAt && !grant.effectiveUntil)
            throw new EosRouteError(
              400,
              "sensitive_grant_review_required",
              "Sensitive active grants require a review deadline or effective-until date.",
            );
          if (!["principal", "seat"].includes(grant.granteeType)) {
            const subject = grant.granteeSubjectId
              ? await tx.query.eosAuthoritySubjects.findFirst({
                  where: and(
                    eq(eosAuthoritySubjects.id, grant.granteeSubjectId),
                    eq(eosAuthoritySubjects.companyId, access.company.id),
                    eq(eosAuthoritySubjects.subjectType, grant.granteeType),
                    eq(eosAuthoritySubjects.subjectKey, grant.granteeKey),
                  ),
                })
              : null;
            if (!subject || !authoritySubjectIsEffective(subject))
              throw new EosRouteError(
                409,
                "grantee_subject_inactive",
                "An active grant requires an active, verified, current canonical subject binding.",
              );
          }
        }
        if (access.role === "company_ceo") {
          if (
            grant.granteeType === "principal" &&
            grant.granteeKey === req.user.id
          )
            throw new EosRouteError(
              403,
              "self_grant_denied",
              "A Company CEO cannot change their own authority.",
            );
          const targetSeatId =
            grant.granteeType === "seat"
              ? grant.seatId || grant.granteeKey
              : grant.seatId;
          if (!targetSeatId)
            throw new EosRouteError(
              403,
              "grant_scope_denied",
              "A Company CEO may change only grants bound to a lower organizational seat.",
            );
          const targetSeat = await tx.query.eosSeats.findFirst({
            where: and(
              eq(eosSeats.id, targetSeatId),
              eq(eosSeats.companyId, access.company.id),
            ),
          });
          if (
            !targetSeat ||
            visibilityPolicyFor(targetSeat.kind as EosSeatKind)
              .visibilityRank >=
              visibilityPolicyFor("company_ceo").visibilityRank
          )
            throw new EosRouteError(
              403,
              "grant_scope_denied",
              "A Company CEO may change authority only for lower organizational roles.",
            );
        }
        if (
          grant.authorityKey.endsWith(":baseline") &&
          grant.granteeType === "seat"
        ) {
          const seat = grant.seatId
            ? await tx.query.eosSeats.findFirst({
                where: eq(eosSeats.id, grant.seatId),
              })
            : null;
          if (seat?.kind === "founder" && input.state !== "active")
            throw new EosRouteError(
              403,
              "founder_baseline_protected",
              "The active founder baseline cannot be suspended or revoked without an ownership-transfer workflow.",
            );
        }
        if (grant.state === "revoked")
          throw new EosRouteError(
            409,
            "authority_grant_terminal",
            "A revoked Authority Grant is immutable; create a new reviewed grant instead.",
          );
        const now = new Date();
        const evidence = Array.from(
          new Set([
            ...(Array.isArray(grant.evidenceReferences)
              ? grant.evidenceReferences.filter(
                  (item): item is string => typeof item === "string",
                )
              : []),
            ...input.evidenceReferences,
          ]),
        );
        const [updated] = await tx
          .update(eosAuthorityGrants)
          .set({
            state: input.state,
            evidenceReferences: evidence,
            reviewAt: input.reviewAt
              ? new Date(input.reviewAt)
              : grant.reviewAt,
            lastReviewedAt:
              input.state === "active" ? now : grant.lastReviewedAt,
            reviewedByUserId:
              input.state === "active" ? req.user.id : grant.reviewedByUserId,
            revokedAt: input.state === "revoked" ? now : null,
            revokedByUserId: input.state === "revoked" ? req.user.id : null,
            updatedAt: now,
          })
          .where(eq(eosAuthorityGrants.id, grant.id))
          .returning();
        const trace = tracePair();
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: `authority_grant.${input.state}`,
          targetType: "authority_grant",
          targetId: grant.id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: input.state,
          details: {
            reason: input.reason,
            previousState: grant.state,
            dependentWork: grant.revocationDependentWork,
            evidenceReferences: input.evidenceReferences,
          },
        });
        return updated;
      });
      return { body: outcome };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/seats",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!mayAdminOrganization(access))
        throw new EosRouteError(
          403,
          "organization_manage_denied",
          "This operating role lacks organization-design and access-grant authority.",
        );
      const input = seatCreateSchema.parse(req.body);
      await authorizeAction(req, access, {
        authorityClass: "grant_access",
        resource: "seat",
        actionKey: "seat.create",
        purpose: "create_accountable_role",
        classification: "restricted",
        consequence: "material",
        targetSeatId: input.supervisorSeatId || access.seat.id,
      });
      if (input.supervisorSeatId) {
        const supervisor = await db.query.eosSeats.findFirst({
          where: and(
            eq(eosSeats.id, input.supervisorSeatId),
            eq(eosSeats.companyId, access.company.id),
          ),
        });
        if (!supervisor)
          throw new EosRouteError(
            400,
            "invalid_supervisor",
            "Supervisor must be an active seat in this company.",
          );
      }
      const outcome = await db.transaction(async (tx) => {
        const [seat] = await tx
          .insert(eosSeats)
          .values({
            id: randomUUID(),
            companyId: access.company.id,
            title: input.title,
            kind: input.kind,
            supervisorSeatId: input.supervisorSeatId || access.seat.id,
            occupantUserId: input.occupantUserId || null,
            agentName: input.agentName,
            agentMode: input.occupantUserId ? "assistant" : "autonomous",
            mandate: input.mandate,
            authority: input.authority,
            toolEntitlements: input.toolEntitlements,
          })
          .returning();
        const kernel = await ensureSeatOperatingKernel(
          tx,
          access.company,
          seat,
          req.user.id,
        );
        return {
          ...seat,
          positionAgreementId: kernel.agreementId,
          roleOperatingPackId: kernel.roleOperatingPack?.id,
          baselineAuthorityGrantId: kernel.authorityGrant?.id,
        };
      });
      return { status: 201, body: outcome };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/assignments",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!mayAdminOrganization(access))
        throw new EosRouteError(
          403,
          "assignment_manage_denied",
          "This operating role lacks access-grant authority for role assignments.",
        );
      const input = roleAssignmentCreateSchema.parse(req.body);
      await authorizeAction(req, access, {
        authorityClass: "grant_access",
        resource: "role_assignment",
        actionKey: "role_assignment.create",
        purpose: "assign_principal_to_role",
        classification: "restricted",
        consequence: "irreversible",
        targetSeatId: input.seatId,
      });
      if (
        input.assignmentType === "observer" &&
        input.operatingGrant !== "observe"
      )
        throw new EosRouteError(
          400,
          "observer_cannot_operate",
          "An observer assignment cannot grant role-entry authority.",
        );
      const effectiveUntil = input.effectiveUntil
        ? new Date(input.effectiveUntil)
        : null;
      if (effectiveUntil && effectiveUntil.getTime() <= Date.now())
        throw new EosRouteError(
          400,
          "assignment_window_invalid",
          "The assignment must end in the future.",
        );
      const outcome = await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${access.company.id}, 24704)`,
        );
        const [seat, principal] = await Promise.all([
          tx.query.eosSeats.findFirst({
            where: and(
              eq(eosSeats.id, input.seatId),
              eq(eosSeats.companyId, access.company.id),
              eq(eosSeats.status, "active"),
            ),
          }),
          tx.query.users.findFirst({
            where: eq(users.id, input.principalUserId),
          }),
        ]);
        if (!seat)
          throw new EosRouteError(
            400,
            "invalid_seat",
            "The assignment seat must be active and belong to this organization.",
          );
        if (seat.kind === "founder")
          throw new EosRouteError(
            403,
            "founder_seat_reserved",
            "Founder authority cannot be assigned through the role-assignment endpoint.",
          );
        if (!principal)
          throw new EosRouteError(
            404,
            "principal_not_found",
            "The selected principal does not exist.",
          );
        const membership =
          input.principalUserId === access.company.ownerUserId
            ? null
            : await tx.query.eosMemberships.findFirst({
                where: and(
                  eq(eosMemberships.companyId, access.company.id),
                  eq(eosMemberships.userId, input.principalUserId),
                  eq(eosMemberships.status, "active"),
                ),
              });
        if (input.principalUserId !== access.company.ownerUserId && !membership)
          throw new EosRouteError(
            409,
            "active_membership_required",
            "The principal must accept organization membership before receiving an additional role assignment.",
          );
        if (
          membership &&
          classificationRank[input.classificationCeiling] >
            classificationRank[membership.classificationCeiling]
        )
          throw new EosRouteError(
            409,
            "assignment_ceiling_exceeded",
            "A role assignment cannot exceed the principal's organization membership ceiling.",
          );
        if (access.role === "company_ceo") {
          if (input.principalUserId === req.user.id)
            throw new EosRouteError(
              403,
              "self_assignment_denied",
              "A Company CEO cannot grant themselves another role.",
            );
          if (
            !eosSeatKinds.includes(seat.kind as EosSeatKind) ||
            visibilityPolicyFor(seat.kind as EosSeatKind).visibilityRank >=
              visibilityPolicyFor("company_ceo").visibilityRank
          )
            throw new EosRouteError(
              403,
              "assignment_authority_denied",
              "A Company CEO may assign only lower organizational roles.",
            );
        }
        const existing = await tx.query.eosAssignments.findFirst({
          where: and(
            eq(eosAssignments.companyId, access.company.id),
            eq(eosAssignments.principalUserId, principal.id),
            eq(eosAssignments.seatId, seat.id),
            eq(eosAssignments.status, "active"),
          ),
        });
        if (existing)
          throw new EosRouteError(
            409,
            "assignment_already_active",
            "This principal already has an active assignment to the selected seat.",
          );
        if (
          input.operatingGrant === "operate" &&
          seat.occupantUserId &&
          seat.occupantUserId !== principal.id
        )
          throw new EosRouteError(
            409,
            "seat_already_occupied",
            "The selected seat already has a human occupant.",
          );
        const now = new Date();
        const [assignment] = await tx
          .insert(eosAssignments)
          .values({
            id: randomUUID(),
            companyId: access.company.id,
            membershipId: membership?.id || null,
            principalUserId: principal.id,
            seatId: seat.id,
            assignmentType: input.assignmentType,
            operatingGrant: input.operatingGrant,
            purpose: input.purpose,
            classificationCeiling: input.classificationCeiling,
            status: "active",
            effectiveFrom: now,
            effectiveUntil,
            createdByUserId: req.user.id,
            metadata: { source: "organization_administration" },
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (input.operatingGrant === "operate")
          await tx
            .update(eosSeats)
            .set({
              occupantUserId: principal.id,
              agentMode: "assistant",
              updatedAt: now,
            })
            .where(eq(eosSeats.id, seat.id));
        const trace = tracePair();
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "assignment.created",
          targetType: "role_assignment",
          targetId: assignment.id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: "active",
          details: {
            principalUserId: principal.id,
            seatId: seat.id,
            assignmentType: assignment.assignmentType,
            operatingGrant: assignment.operatingGrant,
            effectiveUntil,
          },
        });
        return assignment;
      });
      return { status: 201, body: outcome };
    }),
  );

  app.delete(
    "/api/eos/companies/:companyId/assignments/:assignmentId",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!mayAdminOrganization(access))
        throw new EosRouteError(
          403,
          "assignment_manage_denied",
          "This operating role lacks access-grant authority for role assignments.",
        );
      await authorizeAction(req, access, {
        authorityClass: "grant_access",
        resource: "role_assignment",
        actionKey: "role_assignment.end",
        purpose: "end_principal_role_assignment",
        classification: "restricted",
        consequence: "irreversible",
      });
      const outcome = await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${access.company.id}, 24704)`,
        );
        const assignment = await tx.query.eosAssignments.findFirst({
          where: and(
            eq(eosAssignments.id, req.params.assignmentId),
            eq(eosAssignments.companyId, access.company.id),
            eq(eosAssignments.status, "active"),
          ),
        });
        if (!assignment)
          throw new EosRouteError(
            404,
            "assignment_not_found",
            "The active role assignment was not found.",
          );
        const seat = await tx.query.eosSeats.findFirst({
          where: and(
            eq(eosSeats.id, assignment.seatId),
            eq(eosSeats.companyId, access.company.id),
          ),
        });
        if (!seat)
          throw new EosRouteError(
            410,
            "assignment_seat_unavailable",
            "The assigned seat no longer exists.",
          );
        if (seat.kind === "founder")
          throw new EosRouteError(
            403,
            "founder_assignment_reserved",
            "The founder ownership assignment cannot be ended here.",
          );
        if (
          access.role === "company_ceo" &&
          (assignment.principalUserId === req.user.id ||
            visibilityPolicyFor(seat.kind as EosSeatKind).visibilityRank >=
              visibilityPolicyFor("company_ceo").visibilityRank)
        )
          throw new EosRouteError(
            403,
            "assignment_authority_denied",
            "A Company CEO may end only lower-role assignments owned by another principal.",
          );
        const membership = assignment.membershipId
          ? await tx.query.eosMemberships.findFirst({
              where: eq(eosMemberships.id, assignment.membershipId),
            })
          : null;
        const alternatives = await tx
          .select()
          .from(eosAssignments)
          .where(
            and(
              eq(eosAssignments.companyId, access.company.id),
              eq(eosAssignments.principalUserId, assignment.principalUserId),
              eq(eosAssignments.status, "active"),
            ),
          );
        const alternative = alternatives.find(
          (candidate) =>
            candidate.id !== assignment.id &&
            candidate.operatingGrant === "operate" &&
            (!candidate.effectiveUntil ||
              candidate.effectiveUntil.getTime() > Date.now()),
        );
        if (membership?.seatId === assignment.seatId && !alternative)
          throw new EosRouteError(
            409,
            "primary_assignment_required",
            "Assign another operating role before ending this member's primary assignment.",
          );
        const now = new Date();
        const [ended] = await tx
          .update(eosAssignments)
          .set({ status: "ended", endedAt: now, updatedAt: now })
          .where(eq(eosAssignments.id, assignment.id))
          .returning();
        if (assignment.operatingGrant === "operate")
          await tx
            .update(eosSeats)
            .set({
              occupantUserId: null,
              agentMode: "autonomous",
              updatedAt: now,
            })
            .where(
              and(
                eq(eosSeats.id, assignment.seatId),
                eq(eosSeats.occupantUserId, assignment.principalUserId),
              ),
            );
        if (membership?.seatId === assignment.seatId && alternative) {
          const alternativeSeat = await tx.query.eosSeats.findFirst({
            where: eq(eosSeats.id, alternative.seatId),
          });
          if (!alternativeSeat)
            throw new EosRouteError(
              410,
              "replacement_assignment_unavailable",
              "The replacement role assignment no longer has an active seat.",
            );
          await tx
            .update(eosMemberships)
            .set({
              seatId: alternativeSeat.id,
              role: alternativeSeat.kind,
              updatedAt: now,
            })
            .where(eq(eosMemberships.id, membership.id));
        }
        const trace = tracePair();
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "assignment.ended",
          targetType: "role_assignment",
          targetId: assignment.id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: "ended",
          details: {
            principalUserId: assignment.principalUserId,
            seatId: assignment.seatId,
            replacementAssignmentId: alternative?.id || null,
          },
        });
        return ended;
      });
      return { body: outcome };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/memberships",
    route(async (_req) => {
      throw new EosRouteError(
        410,
        "membership_assignment_replaced_by_invitation",
        "Direct seat assignment has been replaced by the verified invitation flow.",
      );
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/memberships/:membershipId",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!mayAdminOrganization(access))
        throw new EosRouteError(
          403,
          "membership_manage_denied",
          "This operating role lacks access-grant authority for team administration.",
        );
      const input = membershipAdministrationSchema.parse(req.body);
      await authorizeAction(req, access, {
        authorityClass: "grant_access",
        resource: "membership",
        actionKey: `membership.${input.action}`,
        purpose: "administer_team_membership",
        classification: "restricted",
        consequence: ["suspend", "reassign"].includes(input.action)
          ? "irreversible"
          : "material",
        targetSeatId: "seatId" in input ? input.seatId : undefined,
      });
      const outcome = await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${access.company.id}, 24703)`,
        );
        const membership = await tx.query.eosMemberships.findFirst({
          where: and(
            eq(eosMemberships.id, req.params.membershipId),
            eq(eosMemberships.companyId, access.company.id),
          ),
        });
        if (!membership || membership.status === "revoked")
          throw new EosRouteError(
            404,
            "membership_not_found",
            "Team membership was not found in this organization.",
          );
        if (
          !mayManageMembership(
            { role: access.role, userId: req.user.id },
            membership,
          )
        )
          throw new EosRouteError(
            403,
            "membership_authority_denied",
            "This seat cannot administer an equal, higher, or self-owned role.",
          );
        if (
          membership.portfolioMembershipId &&
          ["suspend", "reactivate"].includes(input.action)
        )
          throw new EosRouteError(
            409,
            "portfolio_membership_requires_portfolio_admin",
            "Suspend or reactivate this portfolio-wide assignment from the portfolio team controls.",
          );

        const currentSeat = membership.seatId
          ? await tx.query.eosSeats.findFirst({
              where: and(
                eq(eosSeats.id, membership.seatId),
                eq(eosSeats.companyId, access.company.id),
              ),
            })
          : null;
        const memberAssignments = await tx
          .select()
          .from(eosAssignments)
          .where(
            and(
              eq(eosAssignments.companyId, access.company.id),
              eq(eosAssignments.principalUserId, membership.userId),
              eq(eosAssignments.membershipId, membership.id),
              inArray(eosAssignments.status, ["active", "suspended"]),
            ),
          );
        let result = membership;
        if (input.action === "suspend") {
          if (membership.status !== "active")
            throw new EosRouteError(
              409,
              "membership_not_active",
              "Only an active membership can be suspended.",
            );
          const now = new Date();
          for (const assignment of memberAssignments.filter(
            (candidate) =>
              candidate.status === "active" &&
              candidate.operatingGrant === "operate",
          ))
            await tx
              .update(eosSeats)
              .set({
                occupantUserId: null,
                agentMode: "autonomous",
                updatedAt: now,
              })
              .where(
                and(
                  eq(eosSeats.id, assignment.seatId),
                  eq(eosSeats.occupantUserId, membership.userId),
                ),
              );
          await tx
            .update(eosAssignments)
            .set({ status: "suspended", updatedAt: now })
            .where(
              and(
                eq(eosAssignments.membershipId, membership.id),
                eq(eosAssignments.status, "active"),
              ),
            );
          [result] = await tx
            .update(eosMemberships)
            .set({ status: "suspended", updatedAt: now })
            .where(eq(eosMemberships.id, membership.id))
            .returning();
        } else if (input.action === "reactivate") {
          if (membership.status !== "suspended")
            throw new EosRouteError(
              409,
              "membership_not_suspended",
              "Only a suspended membership can be reactivated.",
            );
          if (!currentSeat || currentSeat.status !== "active")
            throw new EosRouteError(
              409,
              "membership_seat_unavailable",
              "Choose an available active seat before reactivating this member.",
            );
          const principal = await tx.query.users.findFirst({
            where: eq(users.id, membership.userId),
          });
          if (!principal)
            throw new EosRouteError(
              410,
              "membership_identity_unavailable",
              "The member identity is no longer available.",
            );
          const capacity = await mayAddTeamIdentity(
            access.company.ownerUserId,
            principal.email,
            tx,
          );
          if (!capacity.allowed)
            throw new EosRouteError(
              402,
              "team_seat_limit_reached",
              `All ${capacity.summary.limit} team seats are allocated. Increase the allowance or remove another member before reactivation.`,
            );
          const suspendedAssignments = memberAssignments.filter(
            (candidate) => candidate.status === "suspended",
          );
          for (const assignment of suspendedAssignments.filter(
            (candidate) => candidate.operatingGrant === "operate",
          )) {
            const assignedSeat = await tx.query.eosSeats.findFirst({
              where: and(
                eq(eosSeats.id, assignment.seatId),
                eq(eosSeats.companyId, access.company.id),
                eq(eosSeats.status, "active"),
              ),
            });
            if (
              !assignedSeat ||
              (assignedSeat.occupantUserId &&
                assignedSeat.occupantUserId !== membership.userId)
            )
              throw new EosRouteError(
                409,
                "membership_seat_unavailable",
                "One or more assigned seats are no longer available. Resolve those assignments before reactivation.",
              );
          }
          const now = new Date();
          for (const assignment of suspendedAssignments.filter(
            (candidate) => candidate.operatingGrant === "operate",
          ))
            await tx
              .update(eosSeats)
              .set({
                occupantUserId: membership.userId,
                agentMode: "assistant",
                updatedAt: now,
              })
              .where(eq(eosSeats.id, assignment.seatId));
          await tx
            .update(eosAssignments)
            .set({ status: "active", updatedAt: now })
            .where(
              and(
                eq(eosAssignments.membershipId, membership.id),
                eq(eosAssignments.status, "suspended"),
              ),
            );
          [result] = await tx
            .update(eosMemberships)
            .set({ status: "active", updatedAt: now })
            .where(eq(eosMemberships.id, membership.id))
            .returning();
        } else if (input.action === "reassign") {
          const targetSeat = await tx.query.eosSeats.findFirst({
            where: and(
              eq(eosSeats.id, input.seatId),
              eq(eosSeats.companyId, access.company.id),
              eq(eosSeats.status, "active"),
            ),
          });
          if (!targetSeat)
            throw new EosRouteError(
              400,
              "invalid_seat",
              "The new seat must be active and belong to this organization.",
            );
          if (targetSeat.kind === "founder")
            throw new EosRouteError(
              403,
              "founder_seat_reserved",
              "The founder seat cannot be reassigned through member administration.",
            );
          if (
            targetSeat.occupantUserId &&
            targetSeat.occupantUserId !== membership.userId
          )
            throw new EosRouteError(
              409,
              "seat_already_occupied",
              "The selected seat already has a human occupant.",
            );
          const now = new Date();
          const primaryAssignment = memberAssignments.find(
            (candidate) =>
              candidate.seatId === membership.seatId &&
              candidate.status === membership.status,
          );
          const targetAssignment = memberAssignments.find(
            (candidate) =>
              candidate.seatId === targetSeat.id &&
              candidate.status === membership.status,
          );
          if (currentSeat?.id !== targetSeat.id && currentSeat)
            await tx
              .update(eosSeats)
              .set({
                occupantUserId: null,
                agentMode: "autonomous",
                updatedAt: now,
              })
              .where(
                and(
                  eq(eosSeats.id, currentSeat.id),
                  eq(eosSeats.occupantUserId, membership.userId),
                ),
              );
          if (
            targetAssignment &&
            primaryAssignment &&
            targetAssignment.id !== primaryAssignment.id
          )
            await tx
              .update(eosAssignments)
              .set({ status: "ended", endedAt: now, updatedAt: now })
              .where(eq(eosAssignments.id, primaryAssignment.id));
          else if (primaryAssignment)
            await tx
              .update(eosAssignments)
              .set({
                seatId: targetSeat.id,
                assignmentType: "occupant",
                operatingGrant: "operate",
                updatedAt: now,
              })
              .where(eq(eosAssignments.id, primaryAssignment.id));
          else
            await tx.insert(eosAssignments).values({
              id: randomUUID(),
              companyId: access.company.id,
              membershipId: membership.id,
              principalUserId: membership.userId,
              seatId: targetSeat.id,
              assignmentType: "occupant",
              operatingGrant: "operate",
              purpose: membership.purpose,
              classificationCeiling: membership.classificationCeiling,
              status: membership.status,
              createdByUserId: req.user.id,
              metadata: { source: "membership_reassignment" },
              createdAt: now,
              updatedAt: now,
            });
          if (membership.status === "active")
            await tx
              .update(eosSeats)
              .set({
                occupantUserId: membership.userId,
                agentMode: "assistant",
                updatedAt: now,
              })
              .where(eq(eosSeats.id, targetSeat.id));
          [result] = await tx
            .update(eosMemberships)
            .set({
              seatId: targetSeat.id,
              role: targetSeat.kind,
              updatedAt: now,
            })
            .where(eq(eosMemberships.id, membership.id))
            .returning();
        } else {
          const now = new Date();
          [result] = await tx
            .update(eosMemberships)
            .set({
              classificationCeiling: input.classificationCeiling,
              updatedAt: now,
            })
            .where(eq(eosMemberships.id, membership.id))
            .returning();
          const activeAssignments = await tx
            .select()
            .from(eosAssignments)
            .where(
              and(
                eq(eosAssignments.membershipId, membership.id),
                inArray(eosAssignments.status, ["active", "suspended"]),
              ),
            );
          for (const assignment of activeAssignments)
            await tx
              .update(eosAssignments)
              .set({
                classificationCeiling: input.classificationCeiling,
                updatedAt: now,
              })
              .where(eq(eosAssignments.id, assignment.id));
        }
        const trace = tracePair();
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: `membership.${input.action}`,
          targetType: "membership",
          targetId: membership.id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: result.status,
          details: {
            fromSeatId: membership.seatId,
            toSeatId: result.seatId,
            classificationCeiling: result.classificationCeiling,
          },
        });
        return result;
      });
      return { body: outcome };
    }),
  );

  app.delete(
    "/api/eos/companies/:companyId/memberships/:membershipId",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!mayAdminOrganization(access))
        throw new EosRouteError(
          403,
          "membership_manage_denied",
          "This operating role lacks access-grant authority for team administration.",
        );
      await authorizeAction(req, access, {
        authorityClass: "grant_access",
        resource: "membership",
        actionKey: "membership.revoke",
        purpose: "revoke_team_membership",
        classification: "restricted",
        consequence: "irreversible",
      });
      const outcome = await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${access.company.id}, 24703)`,
        );
        const membership = await tx.query.eosMemberships.findFirst({
          where: and(
            eq(eosMemberships.id, req.params.membershipId),
            eq(eosMemberships.companyId, access.company.id),
          ),
        });
        if (!membership || membership.status === "revoked")
          throw new EosRouteError(
            404,
            "membership_not_found",
            "Team membership was not found in this organization.",
          );
        if (
          !mayManageMembership(
            { role: access.role, userId: req.user.id },
            membership,
          )
        )
          throw new EosRouteError(
            403,
            "membership_authority_denied",
            "This seat cannot remove an equal, higher, or self-owned role.",
          );
        if (membership.portfolioMembershipId)
          throw new EosRouteError(
            409,
            "portfolio_membership_requires_portfolio_admin",
            "Remove this portfolio-wide assignment from the portfolio team controls.",
          );
        const now = new Date();
        const assignments = await tx
          .select()
          .from(eosAssignments)
          .where(
            and(
              eq(eosAssignments.membershipId, membership.id),
              inArray(eosAssignments.status, ["active", "suspended"]),
            ),
          );
        for (const assignment of assignments.filter(
          (candidate) => candidate.operatingGrant === "operate",
        ))
          await tx
            .update(eosSeats)
            .set({
              occupantUserId: null,
              agentMode: "autonomous",
              updatedAt: now,
            })
            .where(
              and(
                eq(eosSeats.id, assignment.seatId),
                eq(eosSeats.occupantUserId, membership.userId),
              ),
            );
        await tx
          .update(eosAssignments)
          .set({ status: "ended", endedAt: now, updatedAt: now })
          .where(
            and(
              eq(eosAssignments.membershipId, membership.id),
              inArray(eosAssignments.status, ["active", "suspended"]),
            ),
          );
        const [removed] = await tx
          .update(eosMemberships)
          .set({ status: "revoked", updatedAt: now })
          .where(eq(eosMemberships.id, membership.id))
          .returning();
        const trace = tracePair();
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "membership.revoked",
          targetType: "membership",
          targetId: membership.id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: "revoked",
          details: { seatId: membership.seatId },
        });
        return removed;
      });
      return { body: outcome };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/invitations",
    membershipInvitationRateLimit,
    route(async (req) => {
      const access = await companyAccess(req);
      if (!mayAdminOrganization(access))
        throw new EosRouteError(
          403,
          "membership_manage_denied",
          "This operating role lacks access-grant authority for invitations.",
        );
      const input = membershipInvitationCreateSchema.parse(req.body);
      await authorizeAction(req, access, {
        authorityClass: "grant_access",
        resource: "membership_invitation",
        actionKey: "membership_invitation.create",
        purpose: "invite_verified_team_member",
        classification: "restricted",
        consequence: "material",
        targetSeatId: input.seatId,
      });
      const email = normalizeInvitationEmail(input.email);
      const emailHash = invitationDigest(email);
      const seat = await db.query.eosSeats.findFirst({
        where: and(
          eq(eosSeats.id, input.seatId),
          eq(eosSeats.companyId, access.company.id),
          eq(eosSeats.status, "active"),
        ),
      });
      if (!seat)
        throw new EosRouteError(
          400,
          "invalid_seat",
          "Invitation must reference an active seat in this company.",
        );
      if (seat.occupantUserId)
        throw new EosRouteError(
          409,
          "seat_already_occupied",
          "Choose an unoccupied seat before inviting a person.",
        );
      let talentOnboarding:
        | {
            application: typeof eosTalentApplications.$inferSelect;
            placement: typeof eosTalentPlacements.$inferSelect;
          }
        | undefined;
      if (input.talentApplicationId) {
        const [application] = await db
          .select()
          .from(eosTalentApplications)
          .where(
            and(
              eq(eosTalentApplications.id, input.talentApplicationId),
              eq(eosTalentApplications.companyId, access.company.id),
            ),
          )
          .limit(1);
        if (!application)
          throw new EosRouteError(
            404,
            "talent_application_not_found",
            "Talent application not found.",
          );
        const [[placement], [candidate]] = await Promise.all([
          db
            .select()
            .from(eosTalentPlacements)
            .where(
              and(
                eq(eosTalentPlacements.applicationId, application.id),
                eq(eosTalentPlacements.companyId, access.company.id),
              ),
            )
            .limit(1),
          db
            .select()
            .from(eosStakeholders)
            .where(
              and(
                eq(eosStakeholders.id, application.candidateStakeholderId),
                eq(eosStakeholders.companyId, access.company.id),
              ),
            )
            .limit(1),
        ]);
        if (
          !candidate ||
          !placement ||
          !["decision", "onboarding"].includes(application.state) ||
          !["offer_accepted", "onboarding"].includes(placement.state) ||
          placement.targetSeatId !== seat.id ||
          (application.targetSeatId && application.targetSeatId !== seat.id)
        )
          throw new EosRouteError(
            409,
            "talent_onboarding_not_ready",
            "A verified onboarding invitation requires an accepted offer for this candidate and target seat.",
          );
        if (application.candidateUserId || placement.assignmentId)
          throw new EosRouteError(
            409,
            "talent_identity_already_linked",
            "This candidate onboarding identity or assignment is already linked.",
          );
        if (candidate.identityReferenceHash !== emailHash)
          throw new EosRouteError(
            409,
            "talent_invitation_identity_mismatch",
            "The onboarding email must match the canonical candidate identity collected with consent.",
          );
        if (input.portfolioScope)
          throw new EosRouteError(
            400,
            "talent_portfolio_scope_denied",
            "Candidate onboarding invitations grant only the selected company seat.",
          );
        talentOnboarding = { application, placement };
      }
      const identityPolicy = await identityPolicyFor(access.company.id);
      const allowedDomains = Array.isArray(identityPolicy.allowedEmailDomains)
        ? identityPolicy.allowedEmailDomains.map(String)
        : [];
      const emailDomain = email.split("@")[1];
      if (
        seat.kind === "external" &&
        !identityPolicy.allowExternalCollaborators
      )
        throw new EosRouteError(
          403,
          "external_collaborators_disabled",
          "External collaborator invitations are disabled by organization identity policy.",
        );
      if (
        seat.kind !== "external" &&
        allowedDomains.length &&
        !allowedDomains.includes(emailDomain)
      )
        throw new EosRouteError(
          403,
          "invitation_domain_denied",
          "This email domain is outside the organization identity policy.",
        );
      if (
        input.portfolioScope &&
        (access.role !== "founder" || !access.company.portfolioId)
      )
        throw new EosRouteError(
          403,
          "portfolio_invitation_denied",
          "Only the founder may grant portfolio-wide access from a company inside that portfolio.",
        );
      if (input.portfolioScope && seat.kind === "external")
        throw new EosRouteError(
          400,
          "portfolio_external_scope_denied",
          "External collaborators must be granted explicit company-scoped access.",
        );
      const existingPrincipal = await db.query.users.findFirst({
        where: sql`lower(${users.email}) = ${email}`,
      });
      if (existingPrincipal) {
        if (existingPrincipal.id === access.company.ownerUserId)
          throw new EosRouteError(
            409,
            "already_company_owner",
            "The company owner already has founder access.",
          );
        if (talentOnboarding) {
          const activeMembership = await db.query.eosMemberships.findFirst({
            where: and(
              eq(eosMemberships.companyId, access.company.id),
              eq(eosMemberships.userId, existingPrincipal.id),
              eq(eosMemberships.status, "active"),
            ),
          });
          if (activeMembership)
            throw new EosRouteError(
              409,
              "talent_existing_member_requires_transfer",
              "This person is already an active organization member. Use the governed assignment-transfer workflow instead of an onboarding invitation.",
            );
        }
      }
      const now = new Date();
      const invitationId = newMembershipInvitationId();
      const token = createInvitationSecret();
      const expiresAt = new Date(
        now.getTime() + MEMBERSHIP_INVITATION_TTL_DAYS * 86_400_000,
      );
      let invitation: typeof eosMembershipInvitations.$inferSelect;
      try {
        invitation = await db.transaction(async (tx) => {
          await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtext(${`eos-team-seat:${access.company.ownerUserId}`}))`,
          );
          const capacity = await mayAddTeamIdentity(
            access.company.ownerUserId,
            email,
            tx,
          );
          if (!capacity.allowed)
            throw new EosRouteError(
              402,
              "team_seat_limit_reached",
              `All ${capacity.summary.limit} team seats are allocated. Increase the allowance or remove another member before inviting someone new.`,
            );
          const [created] = await tx
            .insert(eosMembershipInvitations)
            .values({
              id: invitationId,
              companyId: access.company.id,
              seatId: seat.id,
              invitedEmail: email,
              emailHash,
              tokenHash: invitationDigest(token),
              invitedByUserId: req.user.id,
              purpose: talentOnboarding ? "talent_onboarding" : input.purpose,
              classificationCeiling: input.classificationCeiling,
              portfolioScope: input.portfolioScope,
              talentApplicationId: talentOnboarding?.application.id || null,
              expiresAt,
              createdAt: now,
              updatedAt: now,
            })
            .returning();
          return created;
        });
      } catch (error) {
        if (isUniqueViolation(error))
          throw new EosRouteError(
            409,
            "invitation_already_pending",
            "This seat or email already has a pending invitation.",
          );
        throw error;
      }
      const trace = tracePair();
      try {
        const delivered = await deliverMembershipInvitation({
          invitationId,
          email,
          token,
        });
        [invitation] = await db
          .update(eosMembershipInvitations)
          .set({
            status: "pending",
            providerInvitationId: delivered.providerInvitationId,
            updatedAt: new Date(),
          })
          .where(eq(eosMembershipInvitations.id, invitationId))
          .returning();
        await db.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "membership_invitation.created",
          targetType: "membership_invitation",
          targetId: invitationId,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: "pending",
          details: {
            seatId: seat.id,
            expiresAt,
            emailHash,
            portfolioScope: input.portfolioScope,
            talentApplicationId: talentOnboarding?.application.id || null,
          },
        });
      } catch {
        await db
          .update(eosMembershipInvitations)
          .set({
            status: "delivery_failed",
            invitedEmail: null,
            updatedAt: new Date(),
          })
          .where(eq(eosMembershipInvitations.id, invitationId));
        await db.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "membership_invitation.delivery_failed",
          targetType: "membership_invitation",
          targetId: invitationId,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: "failed",
          details: { seatId: seat.id, emailHash },
        });
        throw new EosRouteError(
          503,
          "invitation_delivery_unavailable",
          "The invitation could not be delivered. No seat access was granted.",
        );
      }
      return {
        status: 201,
        body: {
          ...publicInvitation(invitation),
          ...(process.env.NODE_ENV === "test"
            ? { acceptancePath: invitationAcceptancePath(token) }
            : {}),
        },
      };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/invitations/:invitationId/revoke",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!mayAdminOrganization(access))
        throw new EosRouteError(
          403,
          "membership_manage_denied",
          "This operating role lacks access-grant authority for invitations.",
        );
      await authorizeAction(req, access, {
        authorityClass: "grant_access",
        resource: "membership_invitation",
        actionKey: "membership_invitation.revoke",
        purpose: "revoke_pending_team_invitation",
        classification: "restricted",
        consequence: "material",
      });
      const invitation = await db.query.eosMembershipInvitations.findFirst({
        where: and(
          eq(eosMembershipInvitations.id, req.params.invitationId),
          eq(eosMembershipInvitations.companyId, access.company.id),
        ),
      });
      if (!invitation)
        throw new EosRouteError(
          404,
          "invitation_not_found",
          "Invitation not found in this company.",
        );
      if (!["pending_delivery", "pending"].includes(invitation.status))
        throw new EosRouteError(
          409,
          "invitation_not_pending",
          "Only a pending invitation can be revoked.",
        );
      const now = new Date();
      await db
        .update(eosMembershipInvitations)
        .set({
          status: "revoked",
          invitedEmail: null,
          revokedAt: now,
          updatedAt: now,
        })
        .where(eq(eosMembershipInvitations.id, invitation.id));
      let providerRevocation = "succeeded";
      try {
        await revokeDeliveredMembershipInvitation(
          invitation.providerInvitationId,
        );
      } catch {
        providerRevocation = "failed";
      }
      const trace = tracePair();
      await db.insert(eosAuditRecords).values({
        id: randomUUID(),
        companyId: access.company.id,
        actorUserId: req.user.id,
        action: "membership_invitation.revoked",
        targetType: "membership_invitation",
        targetId: invitation.id,
        traceId: trace.traceId,
        correlationId: trace.correlationId,
        result: "revoked",
        details: { seatId: invitation.seatId, providerRevocation },
      });
      return {
        body: {
          ...publicInvitation({
            ...invitation,
            status: "revoked",
            invitedEmail: null,
            revokedAt: now,
            updatedAt: now,
          }),
        },
      };
    }),
  );

  app.post(
    "/api/eos/invitations/preview",
    route(async (req) => {
      const { token } = membershipInvitationTokenSchema.parse(req.body);
      await expireMembershipInvitations();
      const invitation = await db.query.eosMembershipInvitations.findFirst({
        where: eq(eosMembershipInvitations.tokenHash, invitationDigest(token)),
      });
      if (!invitation)
        throw new EosRouteError(
          404,
          "invitation_not_found",
          "This invitation is invalid or no longer available.",
        );
      if (invitation.status === "accepted")
        throw new EosRouteError(
          409,
          "invitation_already_used",
          "This invitation has already been accepted.",
        );
      if (invitation.status !== "pending")
        throw new EosRouteError(
          410,
          "invitation_inactive",
          "This invitation is no longer active.",
        );
      if (
        !req.verifiedEmail ||
        invitationDigest(req.verifiedEmail) !== invitation.emailHash
      )
        throw new EosRouteError(
          403,
          "invitation_email_mismatch",
          "Sign in with the verified email address that received this invitation.",
        );
      const [company, seat] = await Promise.all([
        db.query.companies.findFirst({
          where: eq(companies.id, invitation.companyId),
        }),
        db.query.eosSeats.findFirst({
          where: eq(eosSeats.id, invitation.seatId),
        }),
      ]);
      if (!company || !seat)
        throw new EosRouteError(
          410,
          "invitation_target_unavailable",
          "The invited organization seat is no longer available.",
        );
      return {
        body: {
          invitationId: invitation.id,
          company: { id: company.id, name: company.name },
          seat: { id: seat.id, title: seat.title, kind: seat.kind },
          portfolioScope: invitation.portfolioScope,
          expiresAt: invitation.expiresAt,
        },
      };
    }),
  );

  app.post(
    "/api/eos/invitations/accept",
    route(async (req) => {
      const { token } = membershipInvitationTokenSchema.parse(req.body);
      if (!req.verifiedEmail)
        throw new EosRouteError(
          403,
          "verified_email_required",
          "A verified email address is required to accept an invitation.",
        );
      await expireMembershipInvitations();
      const tokenHash = invitationDigest(token);
      const emailHash = invitationDigest(req.verifiedEmail);
      const outcome = await db.transaction(async (tx) => {
        const [candidate] = await tx
          .select()
          .from(eosMembershipInvitations)
          .where(eq(eosMembershipInvitations.tokenHash, tokenHash))
          .limit(1);
        if (!candidate)
          throw new EosRouteError(
            404,
            "invitation_not_found",
            "This invitation is invalid or no longer available.",
          );
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${candidate.companyId}, 24702)`,
        );
        const [invitation] = await tx
          .select()
          .from(eosMembershipInvitations)
          .where(eq(eosMembershipInvitations.id, candidate.id))
          .limit(1);
        if (invitation.status === "accepted")
          throw new EosRouteError(
            409,
            "invitation_already_used",
            "This invitation has already been accepted.",
          );
        if (invitation.status !== "pending")
          throw new EosRouteError(
            410,
            "invitation_inactive",
            "This invitation is no longer active.",
          );
        if (invitation.emailHash !== emailHash)
          throw new EosRouteError(
            403,
            "invitation_email_mismatch",
            "Sign in with the verified email address that received this invitation.",
          );
        const [[seat], [company]] = await Promise.all([
          tx
            .select()
            .from(eosSeats)
            .where(eq(eosSeats.id, invitation.seatId))
            .limit(1),
          tx
            .select()
            .from(companies)
            .where(eq(companies.id, invitation.companyId))
            .limit(1),
        ]);
        if (
          !company ||
          !seat ||
          seat.status !== "active" ||
          seat.companyId !== invitation.companyId
        )
          throw new EosRouteError(
            410,
            "invitation_target_unavailable",
            "The invited organization seat is no longer available.",
          );
        if (seat.occupantUserId)
          throw new EosRouteError(
            409,
            "seat_already_occupied",
            "This organizational seat is already occupied.",
          );
        let talentOnboarding:
          | {
              application: typeof eosTalentApplications.$inferSelect;
              placement: typeof eosTalentPlacements.$inferSelect;
            }
          | undefined;
        if (invitation.talentApplicationId) {
          const [[application], [placement]] = await Promise.all([
            tx
              .select()
              .from(eosTalentApplications)
              .where(
                and(
                  eq(eosTalentApplications.id, invitation.talentApplicationId),
                  eq(eosTalentApplications.companyId, invitation.companyId),
                ),
              )
              .limit(1),
            tx
              .select()
              .from(eosTalentPlacements)
              .where(
                and(
                  eq(
                    eosTalentPlacements.applicationId,
                    invitation.talentApplicationId,
                  ),
                  eq(eosTalentPlacements.companyId, invitation.companyId),
                ),
              )
              .limit(1),
          ]);
          const [candidate] = application
            ? await tx
                .select()
                .from(eosStakeholders)
                .where(
                  and(
                    eq(eosStakeholders.id, application.candidateStakeholderId),
                    eq(eosStakeholders.companyId, invitation.companyId),
                  ),
                )
                .limit(1)
            : [];
          if (
            !candidate ||
            !application ||
            !placement ||
            !["decision", "onboarding"].includes(application.state) ||
            !["offer_accepted", "onboarding"].includes(placement.state) ||
            placement.targetSeatId !== seat.id ||
            (application.targetSeatId && application.targetSeatId !== seat.id) ||
            candidate.identityReferenceHash !== invitation.emailHash ||
            (application.candidateUserId &&
              application.candidateUserId !== req.user.id) ||
            placement.assignmentId
          )
            throw new EosRouteError(
              409,
              "talent_onboarding_changed",
              "The candidate, accepted offer, or target seat changed before onboarding acceptance. Review the placement before granting access.",
            );
          talentOnboarding = { application, placement };
        }
        const [existingMembership] = await tx
          .select()
          .from(eosMemberships)
          .where(
            and(
              eq(eosMemberships.companyId, invitation.companyId),
              eq(eosMemberships.userId, req.user.id),
            ),
          )
          .limit(1);
        if (talentOnboarding && existingMembership?.status === "active")
          throw new EosRouteError(
            409,
            "talent_existing_member_requires_transfer",
            "This person became an active organization member before acceptance. Use the governed assignment-transfer workflow.",
          );
        if (
          existingMembership?.status === "active" &&
          classificationRank[invitation.classificationCeiling] >
            classificationRank[existingMembership.classificationCeiling]
        )
          throw new EosRouteError(
            409,
            "membership_ceiling_change_required",
            "Increase the member's organization access ceiling before adding a role that requires broader disclosure.",
          );
        const now = new Date();
        let portfolioMembership:
          typeof eosPortfolioMemberships.$inferSelect | undefined;
        if (invitation.portfolioScope) {
          if (!company.portfolioId)
            throw new EosRouteError(
              410,
              "portfolio_invitation_target_unavailable",
              "The organization is no longer attached to the invited portfolio.",
            );
          portfolioMembership =
            await tx.query.eosPortfolioMemberships.findFirst({
              where: and(
                eq(eosPortfolioMemberships.portfolioId, company.portfolioId),
                eq(eosPortfolioMemberships.userId, req.user.id),
              ),
            });
          if (portfolioMembership) {
            [portfolioMembership] = await tx
              .update(eosPortfolioMemberships)
              .set({
                status: "active",
                classificationCeiling: invitation.classificationCeiling,
                updatedAt: now,
              })
              .where(eq(eosPortfolioMemberships.id, portfolioMembership.id))
              .returning();
          } else {
            [portfolioMembership] = await tx
              .insert(eosPortfolioMemberships)
              .values({
                id: randomUUID(),
                portfolioId: company.portfolioId,
                userId: req.user.id,
                role: "portfolio_executive",
                status: "active",
                classificationCeiling: invitation.classificationCeiling,
                createdByUserId: invitation.invitedByUserId,
                createdAt: now,
                updatedAt: now,
              })
              .returning();
          }
        }
        const membershipId = existingMembership?.id || randomUUID();
        const membershipValues = {
          companyId: invitation.companyId,
          userId: req.user.id,
          seatId: seat.id,
          portfolioMembershipId: portfolioMembership?.id || null,
          role: seat.kind,
          status: "active",
          purpose: invitation.purpose,
          classificationCeiling: invitation.classificationCeiling,
          updatedAt: now,
        };
        if (existingMembership) {
          if (existingMembership.status !== "active")
            await tx
              .update(eosMemberships)
              .set(membershipValues)
              .where(eq(eosMemberships.id, existingMembership.id));
        } else
          await tx
            .insert(eosMemberships)
            .values({ id: membershipId, ...membershipValues, createdAt: now });
        const [assignment] = await tx
          .insert(eosAssignments)
          .values({
            id: randomUUID(),
            companyId: invitation.companyId,
            membershipId,
            principalUserId: req.user.id,
            seatId: seat.id,
            assignmentType: "occupant",
            operatingGrant: "operate",
            purpose: invitation.purpose,
            classificationCeiling: invitation.classificationCeiling,
            status: "active",
            effectiveFrom: now,
            createdByUserId: invitation.invitedByUserId,
            metadata: {
              source: "verified_invitation",
              invitationId: invitation.id,
              ...(talentOnboarding
                ? {
                    talentApplicationId: talentOnboarding.application.id,
                    talentPlacementId: talentOnboarding.placement.id,
                  }
                : {}),
            },
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        await tx
          .update(eosSeats)
          .set({
            occupantUserId: req.user.id,
            agentMode: "assistant",
            updatedAt: now,
          })
          .where(eq(eosSeats.id, seat.id));
        if (talentOnboarding) {
          const linkedApplications = await tx
            .update(eosTalentApplications)
            .set({
              candidateUserId: req.user.id,
              targetSeatId: seat.id,
              updatedAt: now,
            })
            .where(
              and(
                eq(eosTalentApplications.id, talentOnboarding.application.id),
                isNull(eosTalentApplications.candidateUserId),
              ),
            )
            .returning({ id: eosTalentApplications.id });
          const linkedPlacements = await tx
            .update(eosTalentPlacements)
            .set({ assignmentId: assignment.id, updatedAt: now })
            .where(
              and(
                eq(eosTalentPlacements.id, talentOnboarding.placement.id),
                isNull(eosTalentPlacements.assignmentId),
              ),
            )
            .returning({ id: eosTalentPlacements.id });
          if (!linkedApplications[0] || !linkedPlacements[0])
            throw new EosRouteError(
              409,
              "talent_onboarding_concurrent_change",
              "The recruiting identity changed during acceptance. No access was granted.",
            );
        }
        await tx
          .update(eosMembershipInvitations)
          .set({
            status: "accepted",
            invitedEmail: null,
            acceptedByUserId: req.user.id,
            acceptedAt: now,
            updatedAt: now,
          })
          .where(eq(eosMembershipInvitations.id, invitation.id));
        if (portfolioMembership)
          await materializePortfolioMembership(portfolioMembership.id, tx);
        const trace = tracePair();
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: invitation.companyId,
          actorUserId: req.user.id,
          action: "membership_invitation.accepted",
          targetType: "membership",
          targetId: membershipId,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: "active",
          details: {
            invitationId: invitation.id,
            seatId: seat.id,
            portfolioMembershipId: portfolioMembership?.id || null,
            talentApplicationId: talentOnboarding?.application.id || null,
            talentPlacementId: talentOnboarding?.placement.id || null,
          },
        });
        return {
          membershipId,
          assignmentId: assignment.id,
          companyId: invitation.companyId,
          seatId: seat.id,
          portfolioMembershipId: portfolioMembership?.id || null,
          talentApplicationId: talentOnboarding?.application.id || null,
          talentPlacementId: talentOnboarding?.placement.id || null,
        };
      });
      return { status: 201, body: outcome };
    }),
  );

  async function communicationContext(
    req: Request,
    existingAccess?: Awaited<ReturnType<typeof companyAccess>>,
  ) {
    const access = existingAccess || (await companyAccess(req));
    const channelType =
      access.role === "founder" ? "executive_assistant" : "role_agent";
    let conversation = await db.query.eosConversations.findFirst({
      where: and(
        eq(eosConversations.companyId, access.company.id),
        eq(eosConversations.seatId, access.seat.id),
        eq(eosConversations.channelType, channelType),
      ),
    });
    if (!conversation) {
      [conversation] = await db
        .insert(eosConversations)
        .values({
          id: randomUUID(),
          companyId: access.company.id,
          seatId: access.seat.id,
          channelType,
          title:
            channelType === "executive_assistant"
              ? "Executive Office"
              : `${access.seat.title} assistant`,
        })
        .returning();
    }
    return {
      ...access,
      conversation,
      agentName:
        access.role === "founder"
          ? access.company.assistantName || "Assistant"
          : access.seat.agentName,
    };
  }

  app.get(
    "/api/eos/companies/:companyId/executive-assistant/messages",
    route(async (req) => {
      const access = await companyAccess(req);
      await authorizeAction(req, access, {
        authorityClass: "view",
        resource: "communication",
        actionKey: "communication.list",
        purpose: "communicate_through_role_channel",
        classification: activeClassificationCeiling(access),
        consequence: "routine",
      });
      const context = await communicationContext(req, access);
      const messages = await db
        .select()
        .from(eosCommunicationMessages)
        .where(
          eq(eosCommunicationMessages.conversationId, context.conversation.id),
        )
        .orderBy(eosCommunicationMessages.createdAt);
      return {
        body: {
          messages,
          assistantName: context.agentName,
          mode:
            context.role === "founder"
              ? "executive_assistant"
              : "role_agent_assistant",
        },
      };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/executive-assistant/messages",
    route(async (req) => {
      const access = await companyAccess(req);
      await authorizeAction(req, access, {
        authorityClass: "recommend",
        resource: "communication",
        actionKey: "communication.message",
        purpose: "communicate_through_role_channel",
        classification: activeClassificationCeiling(access),
        consequence: "routine",
      });
      const context = await communicationContext(req, access);
      const { company, role, seat, conversation, agentName } = context;
      const input = z
        .object({ content: z.string().trim().min(1).max(4000) })
        .parse(req.body);
      const portfolio = company.portfolioId
        ? await db.query.portfolios.findFirst({
            where: eq(portfolios.id, company.portfolioId),
          })
        : undefined;
      const council = buildAdvisorCouncil({
        founderName: req.user.fullName || req.user.username,
        portfolioName: portfolio?.name,
        companyName: company.name,
        founderProfile: company.founderProfile as Record<string, unknown>,
        companyGoals: company.goals,
      });
      const history = await db
        .select()
        .from(eosCommunicationMessages)
        .where(eq(eosCommunicationMessages.conversationId, conversation.id))
        .orderBy(desc(eosCommunicationMessages.createdAt))
        .limit(20);
      await db.insert(eosCommunicationMessages).values({
        id: randomUUID(),
        conversationId: conversation.id,
        companyId: company.id,
        senderType: "human",
        senderUserId: req.user.id,
        senderSeatId: seat.id,
        content: input.content,
        provenance: { role, purpose: context.membership?.purpose || "owner" },
      });
      const selectedAdvisors =
        role === "founder"
          ? selectAdvisorSeats(council.advisors, input.content, 3)
          : [];
      const advisorOutputs =
        role === "founder"
          ? await Promise.all(
              selectedAdvisors.map(async (advisor) => {
                try {
                  const output = await callAI({
                    messages: [{ role: "user", content: input.content }],
                    system: `You are the ${advisor.name} advisor. Mandate: ${advisor.mandate}. Founder vision: ${council.personalization.founderVision || "not captured"}. Values: ${council.personalization.founderValues || "not captured"}. Company: ${company.name}. Give a concise evidence-aware advisory view, name assumptions and material disagreement, and do not approve or execute anything.`,
                    tier: "fast",
                    maxTokens: 600,
                    context: `eos-advisor:${company.id}:${advisor.id}`,
                    companyId: company.id,
                    userId: req.user.id,
                  });
                  await db.insert(eosAdvisorConsultations).values({
                    id: randomUUID(),
                    companyId: company.id,
                    conversationId: conversation.id,
                    advisorId: advisor.id,
                    advisorName: advisor.name,
                    request: input.content,
                    response: output.content,
                    model: output.model,
                    status: "completed",
                    provenance: {
                      mandate: advisor.mandate,
                      timeHorizon: advisor.timeHorizon,
                      founderProfileVersion: "company.current",
                    },
                  });
                  return {
                    advisor,
                    content: output.content,
                    status: "completed",
                  };
                } catch (error: any) {
                  const response = `Consultation unavailable: ${String(error?.message || "provider failure")}`;
                  await db.insert(eosAdvisorConsultations).values({
                    id: randomUUID(),
                    companyId: company.id,
                    conversationId: conversation.id,
                    advisorId: advisor.id,
                    advisorName: advisor.name,
                    request: input.content,
                    response,
                    status: "failed",
                    provenance: {
                      mandate: advisor.mandate,
                      failure: "reasoning_provider_unavailable",
                    },
                  });
                  return { advisor, content: response, status: "failed" };
                }
              }),
            )
          : [];
      const portfolioCompanies =
        role === "founder"
          ? (
              await db
                .select()
                .from(companies)
                .where(eq(companies.ownerUserId, req.user.id))
            ).filter((candidate) =>
              company.portfolioId
                ? candidate.portfolioId === company.portfolioId
                : candidate.id === company.id,
            )
          : [];
      const companyCeoAgents =
        role === "founder"
          ? (
              await Promise.all(
                portfolioCompanies.map(async (candidate) => {
                  const ceoSeat = await db.query.eosSeats.findFirst({
                    where: and(
                      eq(eosSeats.companyId, candidate.id),
                      eq(eosSeats.kind, "company_ceo"),
                      eq(eosSeats.status, "active"),
                    ),
                  });
                  return ceoSeat ? { company: candidate, seat: ceoSeat } : null;
                }),
              )
            )
              .filter(
                (
                  candidate,
                ): candidate is {
                  company: typeof companies.$inferSelect;
                  seat: typeof eosSeats.$inferSelect;
                } => Boolean(candidate),
              )
              .filter(
                (candidate) =>
                  candidate.company.id === company.id ||
                  input.content
                    .toLowerCase()
                    .includes(candidate.company.name.toLowerCase()),
              )
              .slice(0, 3)
          : [];
      const ceoOutputs =
        role === "founder"
          ? await Promise.all(
              companyCeoAgents.map(
                async ({ company: targetCompany, seat: ceoSeat }) => {
                  const delegate = {
                    id: `company-ceo:${targetCompany.id}`,
                    name: `${ceoSeat.agentName} — ${targetCompany.name} CEO Agent`,
                  };
                  try {
                    const output = await callAI({
                      messages: [{ role: "user", content: input.content }],
                      system: `You are ${ceoSeat.agentName}, the Company CEO Agent for ${targetCompany.name}. Mandate: ${ceoSeat.mandate || "Own company execution and report material state upward."}. Company goals: ${targetCompany.goals || "not captured"}. Report the company-operating perspective to the founder's Executive Assistant. Identify facts, assumptions, risks, dependencies, and decisions needed. Do not address the founder directly and do not execute or approve anything.`,
                      tier: "fast",
                      maxTokens: 600,
                      context: `eos-company-ceo:${targetCompany.id}:${ceoSeat.id}`,
                      companyId: targetCompany.id,
                      userId: req.user.id,
                    });
                    await db.insert(eosAdvisorConsultations).values({
                      id: randomUUID(),
                      companyId: company.id,
                      conversationId: conversation.id,
                      advisorId: delegate.id,
                      advisorName: delegate.name,
                      request: input.content,
                      response: output.content,
                      model: output.model,
                      status: "completed",
                      provenance: {
                        kind: "company_ceo_agent",
                        targetCompanyId: targetCompany.id,
                        targetSeatId: ceoSeat.id,
                      },
                    });
                    return {
                      advisor: delegate,
                      content: output.content,
                      status: "completed",
                    };
                  } catch (error: any) {
                    const response = `CEO Agent consultation unavailable: ${String(error?.message || "provider failure")}`;
                    await db.insert(eosAdvisorConsultations).values({
                      id: randomUUID(),
                      companyId: company.id,
                      conversationId: conversation.id,
                      advisorId: delegate.id,
                      advisorName: delegate.name,
                      request: input.content,
                      response,
                      status: "failed",
                      provenance: {
                        kind: "company_ceo_agent",
                        targetCompanyId: targetCompany.id,
                        targetSeatId: ceoSeat.id,
                        failure: "reasoning_provider_unavailable",
                      },
                    });
                    return {
                      advisor: delegate,
                      content: response,
                      status: "failed",
                    };
                  }
                },
              ),
            )
          : [];
      const orchestratedOutputs = [...advisorOutputs, ...ceoOutputs];
      const consultationContext = orchestratedOutputs.length
        ? `\nOrchestrated advisor and Company CEO Agent artifacts (retain material dissent and identify each source):\n${orchestratedOutputs.map((item) => `[${item.advisor.name}; ${item.status}] ${item.content}`).join("\n")}`
        : "";
      const founderSystem = `You are ${agentName}, the user-named Executive Assistant for ${company.name}. You are the sole founder-facing communication channel. Coordinate the relevant perspectives from the fifteen-seat portfolio advisor council and Company CEO Agents. Preserve dissent and provenance. Never claim a consultation or external action occurred unless evidence proves it. Never grant authority, approve work, or execute consequential effects.${consultationContext}`;
      const roleSystem = `You are ${agentName}, the persistent Role Agent for the ${seat.title} seat at ${company.name}. A human occupies this seat, so you operate as that human's assistant. Respect the reporting chain: communicate upward through the direct supervisor and downward only through authorized direct reports or shared Work Packets. Never expose records outside this seat's visibility or grant authority.`;
      const founderContext = ` Founder vision: ${council.personalization.founderVision || "not yet captured"}. Founder values: ${council.personalization.founderValues || "not yet captured"}. Decision style: ${council.personalization.decisionStyle || "not yet captured"}.`;
      const roleContext = ` Company goals authorized for this seat: ${company.goals || "not yet captured"}. Do not reveal founder-private profile fields, executive deliberations, lateral-team context, or records outside the active reporting scope.`;
      const system = `${role === "founder" ? founderSystem + founderContext : roleSystem + roleContext}`;
      try {
        const response = await callAI({
          messages: [
            ...history.reverse().map((message) => ({
              role:
                message.senderType === "human"
                  ? ("user" as const)
                  : ("assistant" as const),
              content: message.content,
            })),
            { role: "user", content: input.content },
          ],
          system,
          tier: "standard",
          maxTokens: 1400,
          context: `eos-executive-assistant:${company.id}`,
          companyId: company.id,
          userId: req.user.id,
        });
        const [saved] = await db
          .insert(eosCommunicationMessages)
          .values({
            id: randomUUID(),
            conversationId: conversation.id,
            companyId: company.id,
            senderType: "agent",
            senderSeatId: seat.id,
            content: response.content,
            provenance: {
              mode: "connected_reasoning",
              agentName,
              consultedAdvisors: orchestratedOutputs.map((item) => ({
                id: item.advisor.id,
                name: item.advisor.name,
                status: item.status,
              })),
            },
          })
          .returning();
        return {
          body: {
            response: response.content,
            message: saved,
            mode: "connected_reasoning",
            assistantName: agentName,
          },
        };
      } catch (error) {
        console.warn(
          "EOS Executive Assistant provider unavailable; using explicit local fallback",
          error,
        );
        const fallback = `I received your message in the ${company.name} ${seat.title} context. The reasoning provider is unavailable, so no consultation or action is represented as complete. Capture the outcome as a bounded Work Packet and route consequential effects through the authorized reporting and approval chain.`;
        await db.insert(eosCommunicationMessages).values({
          id: randomUUID(),
          conversationId: conversation.id,
          companyId: company.id,
          senderType: "agent",
          senderSeatId: seat.id,
          content: fallback,
          provenance: { mode: "local_fallback", agentName },
        });
        return {
          body: {
            response: fallback,
            mode: "local_fallback",
            assistantName: agentName,
          },
        };
      }
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/brief",
    route(async (req) => {
      const access = await companyAccess(req);
      const { company } = access;
      const visible = await visibleSeatIds(
        company.id,
        access.seat.id,
        access.role,
      );
      const [allPackets, allApprovals, manifest] = await Promise.all([
        db
          .select()
          .from(eosWorkPackets)
          .where(eq(eosWorkPackets.companyId, company.id))
          .orderBy(desc(eosWorkPackets.createdAt))
          .limit(20),
        db
          .select()
          .from(eosApprovalRequests)
          .where(
            and(
              eq(eosApprovalRequests.companyId, company.id),
              eq(eosApprovalRequests.status, "pending"),
            ),
          )
          .orderBy(desc(eosApprovalRequests.createdAt))
          .limit(20),
        db.query.eosManifestVersions.findFirst({
          where: and(
            eq(eosManifestVersions.companyId, company.id),
            eq(eosManifestVersions.status, "active"),
          ),
          orderBy: [desc(eosManifestVersions.version)],
        }),
      ]);
      const packets = allPackets.filter(
        (packet) =>
          mayAccessClassification(access, packet.classification) &&
          (access.isOwner ||
            (packet.accountableSeatId &&
              visible.has(packet.accountableSeatId))),
      );
      const packetIds = new Set(packets.map((packet) => packet.id));
      const approvals = allApprovals.filter(
        (approval) =>
          approval.assignedToUserId === req.user.id ||
          packetIds.has(approval.workPacketId),
      );
      const now = Date.now();
      return {
        body: {
          generatedAt: new Date(now).toISOString(),
          companyId: company.id,
          headline: manifest
            ? `${company.name} is operating on manifest v${manifest.version}.`
            : `${company.name} still needs an activated organization manifest.`,
          priorities: packets
            .filter((item) => !["completed", "cancelled"].includes(item.status))
            .slice(0, 5),
          pendingApprovals: approvals,
          exceptions: packets.filter(
            (item) =>
              item.status === "blocked" ||
              (item.dueAt &&
                item.dueAt.getTime() < now &&
                item.status !== "completed"),
          ),
          setupComplete: Boolean(manifest),
        },
      };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/command-state",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!allowedSurfacesFor(access.role).includes("command"))
        throw new EosRouteError(
          403,
          "command_scope_denied",
          "Executive command state is outside this role's compiled workspace.",
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const [objectives, metricsOutcomes, risksControls] = await Promise.all([
        db
          .select()
          .from(eosObjectives)
          .where(eq(eosObjectives.companyId, access.company.id))
          .orderBy(desc(eosObjectives.updatedAt)),
        db
          .select()
          .from(eosMetricsOutcomes)
          .where(eq(eosMetricsOutcomes.companyId, access.company.id))
          .orderBy(desc(eosMetricsOutcomes.updatedAt)),
        db
          .select()
          .from(eosRisksControls)
          .where(eq(eosRisksControls.companyId, access.company.id))
          .orderBy(desc(eosRisksControls.updatedAt)),
      ]);
      const maySee = (record: {
        ownerSeatId: string;
        classification: string;
      }) =>
        visible.has(record.ownerSeatId) &&
        mayAccessClassification(access, record.classification);
      const visibleObjectives = objectives.filter(maySee).map((record) => ({
        ...record,
        freshness: commandFreshness(record.updatedAt, record.updatedAt),
      }));
      const visibleMetrics = metricsOutcomes.filter(maySee).map((record) => ({
        ...record,
        freshness: commandFreshness(record.asOf, record.updatedAt),
      }));
      const visibleRisks = risksControls.filter(maySee).map((record) => ({
        ...record,
        freshness: commandFreshness(record.updatedAt, record.updatedAt),
        overdue: Boolean(
          record.dueReviewAt &&
          record.dueReviewAt.getTime() < Date.now() &&
          !["satisfied_closed", "superseded"].includes(record.state),
        ),
      }));
      return {
        body: {
          generatedAt: new Date().toISOString(),
          objectives: visibleObjectives,
          metricsOutcomes: visibleMetrics,
          risksControls: visibleRisks,
          counts: {
            objectives: visibleObjectives.filter(
              (item) =>
                !["achieved", "failed", "superseded", "archived"].includes(
                  item.state,
                ),
            ).length,
            metrics: visibleMetrics.filter(
              (item) => !["superseded", "retired"].includes(item.state),
            ).length,
            exceptions:
              visibleObjectives.filter((item) =>
                ["at_risk", "blocked", "failed"].includes(item.state),
              ).length +
              visibleMetrics.filter((item) => item.state === "contested")
                .length +
              visibleRisks.filter(
                (item) =>
                  item.overdue ||
                  ["overdue_breached", "remediating"].includes(item.state),
              ).length,
            stale: [
              ...visibleObjectives,
              ...visibleMetrics,
              ...visibleRisks,
            ].filter((item) => item.freshness.status !== "current").length,
          },
        },
      };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/objectives",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!allowedSurfacesFor(access.role).includes("command"))
        throw new EosRouteError(
          403,
          "command_scope_denied",
          "Objective control is outside this role's compiled workspace.",
        );
      const input = objectiveCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const ownerSeatId = input.ownerSeatId || access.seat.id;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      await assertCommandReferences(access.company.id, input);
      if (input.parentObjectiveId) {
        const [parent] = await db
          .select({ id: eosObjectives.id })
          .from(eosObjectives)
          .where(
            and(
              eq(eosObjectives.id, input.parentObjectiveId),
              eq(eosObjectives.companyId, access.company.id),
            ),
          );
        if (!parent)
          throw new EosRouteError(
            400,
            "objective_parent_invalid",
            "The parent objective is not in this organization.",
          );
      }
      const policy = await authorizeAction(req, access, {
        authorityClass: "decide",
        resource: "objective",
        actionKey: "objective.create",
        purpose: "direct_organization",
        classification: input.classification,
        consequence: "material",
        targetSeatId: access.seat.id,
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        objectiveKey: commandRecordKey("objective", input.title, id),
        recordType: input.recordType,
        title: input.title,
        statement: input.statement,
        state: "proposed",
        priority: input.priority,
        ownerSeatId,
        parentObjectiveId: input.parentObjectiveId || null,
        scopeBoundary: input.scopeBoundary,
        rationaleTheory: input.rationaleTheory,
        successExitCriteria: input.successExitCriteria,
        timeHorizon: input.timeHorizon,
        workPacketIds: input.workPacketIds,
        metricIds: input.metricIds,
        evidenceIds: input.evidenceIds,
        decisionPolicyKeys: input.decisionPolicyKeys,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        targetReviewAt: input.targetReviewAt
          ? new Date(input.targetReviewAt)
          : null,
        validFrom: now,
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosObjectives).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "objective.created",
          targetType: "objective",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "proposed",
          details: {
            objectiveKey: record.objectiveKey,
            ownerSeatId,
            recordType: record.recordType,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/objectives/:objectiveId",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!allowedSurfacesFor(access.role).includes("command"))
        throw new EosRouteError(
          403,
          "command_scope_denied",
          "Objective control is outside this role's compiled workspace.",
        );
      const input = objectiveUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosObjectives)
        .where(
          and(
            eq(eosObjectives.id, req.params.objectiveId),
            eq(eosObjectives.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "objective_not_found",
          "Objective not found in this organization.",
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "objective_not_found",
          "Objective not found in this role's visible scope.",
        );
      const ownerSeatId = input.ownerSeatId || record.ownerSeatId;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      await assertCommandReferences(access.company.id, input);
      if (input.parentObjectiveId) {
        const [parent] = await db
          .select({ id: eosObjectives.id })
          .from(eosObjectives)
          .where(
            and(
              eq(eosObjectives.id, input.parentObjectiveId),
              eq(eosObjectives.companyId, access.company.id),
            ),
          );
        if (!parent || parent.id === record.id)
          throw new EosRouteError(
            400,
            "objective_parent_invalid",
            "The parent objective must be a different objective in this organization.",
          );
      }
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionObjective(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "objective_transition_invalid",
          `Objective cannot move from ${record.state} to ${input.state}.`,
        );
      const classification = input.classification || record.classification;
      const policy = await authorizeAction(req, access, {
        authorityClass: "decide",
        resource: "objective",
        actionKey: input.state ? "objective.transition" : "objective.update",
        purpose: "direct_organization",
        classification,
        consequence:
          input.state &&
          ["failed", "superseded", "archived"].includes(input.state)
            ? "material"
            : "routine",
        targetSeatId: access.seat.id,
      });
      const updates: any = { ...input, ownerSeatId, updatedAt: new Date() };
      if (input.targetReviewAt)
        updates.targetReviewAt = new Date(input.targetReviewAt);
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosObjectives)
          .set(updates)
          .where(
            and(
              eq(eosObjectives.id, record.id),
              eq(eosObjectives.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "objective_concurrent_change",
            "The objective changed before this action completed. Refresh and retry.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state ? "objective.transitioned" : "objective.updated",
          targetType: "objective",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            ownerSeatId,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/metrics-outcomes",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!allowedSurfacesFor(access.role).includes("command"))
        throw new EosRouteError(
          403,
          "command_scope_denied",
          "Scorecard control is outside this role's compiled workspace.",
        );
      const input = metricOutcomeCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const ownerSeatId = input.ownerSeatId || access.seat.id;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      await assertCommandReferences(access.company.id, input);
      if (input.objectiveId) {
        const [objective] = await db
          .select()
          .from(eosObjectives)
          .where(
            and(
              eq(eosObjectives.id, input.objectiveId),
              eq(eosObjectives.companyId, access.company.id),
            ),
          );
        if (!objective || !visible.has(objective.ownerSeatId))
          throw new EosRouteError(
            400,
            "metric_objective_invalid",
            "The linked objective is outside this organization's visible scope.",
          );
      }
      const policy = await authorizeAction(req, access, {
        authorityClass: "decide",
        resource: "metric_outcome",
        actionKey: "metric_outcome.create",
        purpose: "measure_organization",
        classification: input.classification,
        consequence: "material",
        targetSeatId: access.seat.id,
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        metricKey: commandRecordKey("metric", input.title, id),
        recordType: input.recordType,
        title: input.title,
        state: "proposed",
        ownerSeatId,
        objectiveId: input.objectiveId || null,
        subjectType: input.subjectType,
        subjectKey: input.subjectKey,
        definitionFormula: input.definitionFormula,
        unitCurrency: input.unitCurrency,
        thresholdDirection: input.thresholdDirection,
        targetValue:
          input.targetValue === undefined ? null : String(input.targetValue),
        actualValue:
          input.actualValue === undefined ? null : String(input.actualValue),
        forecastValue:
          input.forecastValue === undefined
            ? null
            : String(input.forecastValue),
        timeGrainPeriod: input.timeGrainPeriod,
        verifierConfidence: input.verifierConfidence,
        attributionLimitations: input.attributionLimitations,
        evidenceIds: input.evidenceIds,
        notes: input.notes,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        asOf: input.asOf ? new Date(input.asOf) : null,
        validFrom: input.validFrom ? new Date(input.validFrom) : now,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosMetricsOutcomes).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "metric_outcome.created",
          targetType: "metric_outcome",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "proposed",
          details: {
            metricKey: record.metricKey,
            ownerSeatId,
            recordType: record.recordType,
            objectiveId: record.objectiveId,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/metrics-outcomes/:metricId",
    route(async (req) => {
      const access = await companyAccess(req);
      const input = metricOutcomeUpdateSchema.parse(req.body);
      if (!allowedSurfacesFor(access.role).includes("command"))
        throw new EosRouteError(
          403,
          "command_scope_denied",
          "Scorecard control is outside this role's compiled workspace.",
        );
      const [record] = await db
        .select()
        .from(eosMetricsOutcomes)
        .where(
          and(
            eq(eosMetricsOutcomes.id, req.params.metricId),
            eq(eosMetricsOutcomes.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "metric_outcome_not_found",
          "Metric or outcome not found in this organization.",
        );
      assertCommandValidWindow(input, record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "metric_outcome_not_found",
          "Metric or outcome not found in this role's visible scope.",
        );
      const ownerSeatId = input.ownerSeatId || record.ownerSeatId;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      await assertCommandReferences(access.company.id, input);
      if (input.objectiveId) {
        const [objective] = await db
          .select()
          .from(eosObjectives)
          .where(
            and(
              eq(eosObjectives.id, input.objectiveId),
              eq(eosObjectives.companyId, access.company.id),
            ),
          );
        if (!objective || !visible.has(objective.ownerSeatId))
          throw new EosRouteError(
            400,
            "metric_objective_invalid",
            "The linked objective is outside this organization's visible scope.",
          );
      }
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionMetricOutcome(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "metric_outcome_transition_invalid",
          `Metric or outcome cannot move from ${record.state} to ${input.state}.`,
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "decide",
        resource: "metric_outcome",
        actionKey: input.state
          ? "metric_outcome.transition"
          : "metric_outcome.update",
        purpose: "measure_organization",
        classification: input.classification || record.classification,
        consequence:
          input.state === "verified" || input.state === "contested"
            ? "material"
            : "routine",
        targetSeatId: access.seat.id,
      });
      const updates: any = { ...input, ownerSeatId, updatedAt: new Date() };
      for (const field of [
        "targetValue",
        "actualValue",
        "forecastValue",
      ] as const)
        if (input[field] !== undefined) updates[field] = String(input[field]);
      for (const field of ["asOf", "validFrom", "validUntil"] as const)
        if (input[field]) updates[field] = new Date(input[field]!);
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosMetricsOutcomes)
          .set(updates)
          .where(
            and(
              eq(eosMetricsOutcomes.id, record.id),
              eq(eosMetricsOutcomes.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "metric_outcome_concurrent_change",
            "The metric or outcome changed before this action completed. Refresh and retry.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state
            ? "metric_outcome.transitioned"
            : "metric_outcome.updated",
          targetType: "metric_outcome",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            ownerSeatId,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/risks-controls",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!allowedSurfacesFor(access.role).includes("command"))
        throw new EosRouteError(
          403,
          "command_scope_denied",
          "Risk and control state is outside this role's compiled workspace.",
        );
      const input = riskControlCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const ownerSeatId = input.ownerSeatId || access.seat.id;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      await assertCommandReferences(access.company.id, input);
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "risk_control",
        actionKey: "risk_control.create",
        purpose: "govern_exceptions",
        classification: input.classification,
        consequence: "material",
        targetSeatId: access.seat.id,
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        riskControlKey: commandRecordKey("risk", input.title, id),
        recordType: input.recordType,
        title: input.title,
        state: "identified",
        ownerSeatId,
        capabilityProcessAssetKey: input.capabilityProcessAssetKey,
        descriptionCauseEventImpact: input.descriptionCauseEventImpact,
        inherentAssessment: input.inherentAssessment,
        residualAssessment: input.residualAssessment,
        appetiteToleranceMateriality: input.appetiteToleranceMateriality,
        treatmentControl: input.treatmentControl,
        sourceRequirement: input.sourceRequirement,
        jurisdictionRegime: input.jurisdictionRegime,
        evidenceIds: input.evidenceIds,
        policyDecisionWorkKeys: input.policyDecisionWorkKeys,
        exceptionIncidentKeys: input.exceptionIncidentKeys,
        insuranceTransfer: input.insuranceTransfer,
        notes: input.notes,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        dueReviewAt: input.dueReviewAt ? new Date(input.dueReviewAt) : null,
        validFrom: input.validFrom ? new Date(input.validFrom) : now,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosRisksControls).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "risk_control.created",
          targetType: "risk_control",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "identified",
          details: {
            riskControlKey: record.riskControlKey,
            ownerSeatId,
            recordType: record.recordType,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/risks-controls/:riskId",
    route(async (req) => {
      const access = await companyAccess(req);
      const input = riskControlUpdateSchema.parse(req.body);
      if (!allowedSurfacesFor(access.role).includes("command"))
        throw new EosRouteError(
          403,
          "command_scope_denied",
          "Risk and control state is outside this role's compiled workspace.",
        );
      const [record] = await db
        .select()
        .from(eosRisksControls)
        .where(
          and(
            eq(eosRisksControls.id, req.params.riskId),
            eq(eosRisksControls.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "risk_control_not_found",
          "Risk, obligation, or control not found in this organization.",
        );
      assertCommandValidWindow(input, record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "risk_control_not_found",
          "Risk, obligation, or control not found in this role's visible scope.",
        );
      const ownerSeatId = input.ownerSeatId || record.ownerSeatId;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      await assertCommandReferences(access.company.id, input);
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionRiskControl(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "risk_control_transition_invalid",
          `Risk, obligation, or control cannot move from ${record.state} to ${input.state}.`,
        );
      const materialDecision = Boolean(
        input.state &&
        ["accepted", "satisfied_closed", "superseded"].includes(input.state),
      );
      const policy = await authorizeAction(req, access, {
        authorityClass: materialDecision ? "decide" : "execute",
        resource: "risk_control",
        actionKey: input.state
          ? "risk_control.transition"
          : "risk_control.update",
        purpose: "govern_exceptions",
        classification: input.classification || record.classification,
        consequence:
          materialDecision || input.state === "overdue_breached"
            ? "material"
            : "routine",
        targetSeatId: access.seat.id,
      });
      const updates: any = { ...input, ownerSeatId, updatedAt: new Date() };
      for (const field of ["dueReviewAt", "validFrom", "validUntil"] as const)
        if (input[field]) updates[field] = new Date(input[field]!);
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosRisksControls)
          .set(updates)
          .where(
            and(
              eq(eosRisksControls.id, record.id),
              eq(eosRisksControls.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "risk_control_concurrent_change",
            "The risk or control changed before this action completed. Refresh and retry.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state
            ? "risk_control.transitioned"
            : "risk_control.updated",
          targetType: "risk_control",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            ownerSeatId,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/commercial-state",
    route(async (req) => {
      const access = await companyAccess(req);
      assertCommercialSurface(access);
      await authorizeAction(req, access, {
        authorityClass: "view",
        resource: "commercial_registry",
        actionKey: "commercial_registry.list",
        purpose: "operate_relationships",
        classification: activeClassificationCeiling(access),
        consequence: "routine",
      });
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const [stakeholders, relationships, offers, cases, valueFlows, customerValueCycles] =
        await Promise.all([
          db
            .select()
            .from(eosStakeholders)
            .where(eq(eosStakeholders.companyId, access.company.id))
            .orderBy(desc(eosStakeholders.updatedAt)),
          db
            .select()
            .from(eosStakeholderRelationships)
            .where(eq(eosStakeholderRelationships.companyId, access.company.id))
            .orderBy(desc(eosStakeholderRelationships.updatedAt)),
          db
            .select()
            .from(eosOfferPrograms)
            .where(eq(eosOfferPrograms.companyId, access.company.id))
            .orderBy(desc(eosOfferPrograms.updatedAt)),
          db
            .select()
            .from(eosCommercialCases)
            .where(eq(eosCommercialCases.companyId, access.company.id))
            .orderBy(desc(eosCommercialCases.updatedAt)),
          db
            .select()
            .from(eosValueFlows)
            .where(eq(eosValueFlows.companyId, access.company.id))
            .orderBy(desc(eosValueFlows.updatedAt)),
          db
            .select()
            .from(eosCustomerValueCycles)
            .where(eq(eosCustomerValueCycles.companyId, access.company.id))
            .orderBy(desc(eosCustomerValueCycles.updatedAt)),
        ]);
      const maySee = (record: {
        ownerSeatId: string;
        classification: string;
      }) =>
        visible.has(record.ownerSeatId) &&
        mayAccessClassification(access, record.classification);
      const visibleStakeholders = stakeholders.filter(maySee);
      const stakeholderIds = new Set(
        visibleStakeholders.map((item) => item.id),
      );
      const visibleRelationships = relationships.filter(
        (item) => maySee(item) && stakeholderIds.has(item.stakeholderId),
      );
      const visibleOffers = offers.filter(maySee);
      const offerIds = new Set(visibleOffers.map((item) => item.id));
      const visibleCases = cases.filter(
        (item) =>
          maySee(item) &&
          (!item.offerId || offerIds.has(item.offerId)) &&
          (item.stakeholderIds as string[]).every((id) =>
            stakeholderIds.has(id),
          ),
      );
      const caseIds = new Set(visibleCases.map((item) => item.id));
      const visibleFlows = valueFlows.filter(
        (item) =>
          maySee(item) &&
          (!item.fromStakeholderId ||
            stakeholderIds.has(item.fromStakeholderId)) &&
          (!item.toStakeholderId || stakeholderIds.has(item.toStakeholderId)) &&
          (!item.offerId || offerIds.has(item.offerId)) &&
          (!item.commercialCaseId || caseIds.has(item.commercialCaseId)),
      );
      const visibleCycles = customerValueCycles.filter(
        (item) =>
          maySee(item) &&
          stakeholderIds.has(item.stakeholderId) &&
          visibleRelationships.some((relationship) => relationship.id === item.relationshipId) &&
          offerIds.has(item.offerId) &&
          caseIds.has(item.commercialCaseId),
      );
      const cycleIds = visibleCycles.map((item) => item.id);
      const cycleEvents = cycleIds.length
        ? await db
            .select()
            .from(eosCustomerValueCycleEvents)
            .where(inArray(eosCustomerValueCycleEvents.cycleId, cycleIds))
            .orderBy(desc(eosCustomerValueCycleEvents.sequence))
        : [];
      const providerCheckpoints = cycleIds.length
        ? await db
            .select()
            .from(eosCustomerValueProviderCheckpoints)
            .where(inArray(eosCustomerValueProviderCheckpoints.cycleId, cycleIds))
            .orderBy(eosCustomerValueProviderCheckpoints.providerKey)
        : [];
      const checkpointIds = providerCheckpoints.map((item) => item.id);
      const providerFixtureRuns = checkpointIds.length
        ? await db
            .select()
            .from(eosCustomerValueProviderFixtureRuns)
            .where(inArray(eosCustomerValueProviderFixtureRuns.checkpointId, checkpointIds))
            .orderBy(desc(eosCustomerValueProviderFixtureRuns.sequence))
        : [];
      return {
        body: {
          generatedAt: new Date().toISOString(),
          stakeholders: visibleStakeholders,
          relationships: visibleRelationships,
          offers: visibleOffers,
          cases: visibleCases,
          valueFlows: visibleFlows,
          customerValueCycles: visibleCycles.map((cycle) => ({
            ...cycle,
            events: cycleEvents.filter((event) => event.cycleId === cycle.id),
            providerCheckpoints: providerCheckpoints
              .filter((checkpoint) => checkpoint.cycleId === cycle.id)
              .map((checkpoint) => ({
                ...checkpoint,
                runs: providerFixtureRuns.filter(
                  (run) => run.checkpointId === checkpoint.id,
                ),
              })),
          })),
          counts: {
            parties: visibleStakeholders.filter(
              (item) => item.state !== "closed",
            ).length,
            activeRelationships: visibleRelationships.filter(
              (item) => item.state === "active",
            ).length,
            activeOffers: visibleOffers.filter((item) =>
              ["active", "scaling"].includes(item.state),
            ).length,
            openCases: visibleCases.filter(
              (item) =>
                ![
                  "won",
                  "lost",
                  "disqualified",
                  "completed",
                  "closed",
                ].includes(item.state),
            ).length,
            openCommitments: visibleFlows.filter(
              (item) =>
                !["paid_settled", "failed", "cancelled", "reconciled"].includes(
                  item.state,
                ),
            ).length,
            activeCustomerValueCycles: visibleCycles.filter(
              (item) => !["commercial_rejected", "renewed", "closed", "cancelled"].includes(item.state),
            ).length,
            providerContractsRequired: providerCheckpoints.filter(
              (item) => item.state !== "contract_qualified",
            ).length,
            providerContractsQualified: providerCheckpoints.filter(
              (item) => item.state === "contract_qualified",
            ).length,
          },
        },
      };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/customer-value-cycles",
    route(async (req) => {
      const access = await companyAccess(req);
      assertCommercialSurface(access);
      const input = customerValueCycleCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(access.company.id, access.seat.id, access.role);
      const ownerSeatId = input.ownerSeatId || access.seat.id;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      const [stakeholder, relationship, offer, commercialCase] = await Promise.all([
        db.query.eosStakeholders.findFirst({ where: and(eq(eosStakeholders.id, input.stakeholderId), eq(eosStakeholders.companyId, access.company.id)) }),
        db.query.eosStakeholderRelationships.findFirst({ where: and(eq(eosStakeholderRelationships.id, input.relationshipId), eq(eosStakeholderRelationships.companyId, access.company.id)) }),
        db.query.eosOfferPrograms.findFirst({ where: and(eq(eosOfferPrograms.id, input.offerId), eq(eosOfferPrograms.companyId, access.company.id)) }),
        db.query.eosCommercialCases.findFirst({ where: and(eq(eosCommercialCases.id, input.commercialCaseId), eq(eosCommercialCases.companyId, access.company.id)) }),
      ]);
      const providerBindings = await db
        .select()
        .from(eosIntegrationBindings)
        .where(
          and(
            eq(eosIntegrationBindings.companyId, access.company.id),
            inArray(
              eosIntegrationBindings.providerKey,
              customerValueProviderFixtureSpecs.map((spec) => spec.providerKey),
            ),
          ),
        );
      const missingProviderBindings = customerValueProviderFixtureSpecs
        .filter(
          (spec) =>
            !providerBindings.some(
              (binding) => binding.providerKey === spec.providerKey,
            ),
        )
        .map((spec) => spec.providerKey);
      if (missingProviderBindings.length)
        throw new EosRouteError(
          409,
          "customer_value_provider_bindings_missing",
          `The organization is missing required provider bindings: ${missingProviderBindings.join(", ")}. Compile or register them before creating a customer-value rehearsal.`,
        );
      if (!stakeholder || !relationship || !offer || !commercialCase)
        throw new EosRouteError(400, "customer_value_cycle_reference_invalid", "Every linked party, relationship, offer, and case must belong to this organization.");
      if (
        relationship.stakeholderId !== stakeholder.id ||
        commercialCase.offerId !== offer.id ||
        !(commercialCase.stakeholderIds as string[]).includes(stakeholder.id)
      )
        throw new EosRouteError(409, "customer_value_cycle_graph_mismatch", "The relationship, offer, and commercial case must resolve to the same canonical party graph.");
      if (
        !visible.has(stakeholder.ownerSeatId) ||
        !visible.has(relationship.ownerSeatId) ||
        !visible.has(offer.ownerSeatId) ||
        !visible.has(commercialCase.ownerSeatId) ||
        ![stakeholder, relationship, offer, commercialCase].every((record) => mayAccessClassification(access, record.classification))
      )
        throw new EosRouteError(404, "customer_value_cycle_reference_invalid", "The linked commercial graph is outside this seat's visibility scope.");
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "customer_value_cycle",
        actionKey: "customer_value_cycle.create_prelive_fixture",
        purpose: "qualify_customer_value_spine",
        classification: "confidential",
        consequence: "material",
        targetSeatId: ownerSeatId,
      });
      const now = new Date();
      const cycleId = randomUUID();
      const workPacketId = randomUUID();
      const approvalId = randomUUID();
      const cycleKey = input.title.toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/-+/g, "-").replace(/-$/, "");
      let record: any;
      await db.transaction(async (tx) => {
        await tx.insert(eosWorkPackets).values({
          id: workPacketId,
          companyId: access.company.id,
          createdByUserId: req.user.id,
          accountableUserId: req.user.id,
          accountableSeatId: ownerSeatId,
          title: input.title,
          objective: input.objective,
          status: "awaiting_approval",
          priority: "high",
          source: "manual",
          visibility: "company",
          classification: "confidential",
          requiresApproval: true,
          toolPack: [],
          evidenceRequirements: ["Commercial approval", "Agreement readiness fixture", "Onboarding receipt", "Delivery receipt", "Reporting receipt", "Renewal or closeout decision", "Failure and restored-safe-state receipt"],
          resourceIds: [],
          expectedOutput: "One continuous synthetic customer-value transaction with complete receipts and no external effect.",
          acceptanceCriteria: input.acceptanceCriteria,
          constraintsPolicies: "TEST-PRELIVE- only. Synthetic / Non-Production. Never contact, charge, sign, publish, grant access, or alter an external party or provider. Exclude from real metrics.",
          failureEscalationCompensation: "Enter recovery_required, preserve append-only evidence, and require a verified restored-safe-state action before resuming.",
          humanFallback: "Return to the accountable seat and approval queue; no provider execution is permitted.",
          sourceLineage: "EOS Phase 5 pre-live customer-value spine canon",
          outputArtifactKeys: [],
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(eosApprovalRequests).values({
          id: approvalId,
          companyId: access.company.id,
          workPacketId,
          requestedByUserId: req.user.id,
          assignedToUserId: req.user.id,
          assignedToSeatId: ownerSeatId,
          summary: `Approve pre-live customer-value rehearsal: ${input.title}`,
          status: "pending",
          createdAt: now,
        });
        [record] = await tx.insert(eosCustomerValueCycles).values({
          id: cycleId,
          companyId: access.company.id,
          portfolioId: access.company.portfolioId,
          cycleKey,
          title: input.title,
          mode: "prelive_fixture",
          syntheticLabel: "Synthetic / Non-Production",
          state: "awaiting_commercial_approval",
          version: 1,
          ownerSeatId,
          stakeholderId: stakeholder.id,
          relationshipId: relationship.id,
          offerId: offer.id,
          commercialCaseId: commercialCase.id,
          workPacketId,
          approvalId,
          objective: input.objective,
          acceptanceCriteria: input.acceptanceCriteria,
          cleanupCriteria: input.cleanupCriteria,
          phaseEvidence: {},
          excludedFromMetrics: true,
          externalEffectsExecuted: false,
          sourceAuthority: "native_eos",
          classification: "confidential",
          createdByUserId: req.user.id,
          createdAt: now,
          updatedAt: now,
        }).returning();
        await tx.insert(eosCustomerValueProviderCheckpoints).values(
          customerValueProviderFixtureSpecs.map((spec) => ({
            id: randomUUID(),
            cycleId,
            companyId: access.company.id,
            integrationBindingId: providerBindings.find(
              (binding) => binding.providerKey === spec.providerKey,
            )!.id,
            providerKey: spec.providerKey,
            phaseKey: spec.phaseKey,
            operationKey: spec.operationKey,
            state: "required",
            contractVersion: "customer-value-provider-fixture.v1",
            liveProviderBlocker: spec.liveProviderBlocker,
            liveProviderVerified: false,
            externalEffectsExecuted: false,
            createdAt: now,
            updatedAt: now,
          })),
        );
        await appendCustomerValueCycleEvent(tx, {
          cycleId,
          companyId: access.company.id,
          actorUserId: req.user.id,
          actorSeatId: access.seat.id,
          sequence: 1,
          eventType: "cycle_created",
          fromState: "none",
          toState: "awaiting_commercial_approval",
          note: "Synthetic fixture created; no external effect executed.",
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          createdAt: now,
        });
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id,
          action: "customer_value_cycle.created", targetType: "customer_value_cycle", targetId: cycleId,
          traceId: policy.traceId, correlationId: policy.correlationId, result: "awaiting_commercial_approval",
          details: { workPacketId, approvalId, excludedFromMetrics: true, externalEffectsExecuted: false }, createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/customer-value-cycles/:cycleId/provider-checkpoints/:checkpointId/run-contract-suite",
    route(async (req) => {
      const access = await companyAccess(req);
      assertCommercialSurface(access);
      customerValueProviderContractRunSchema.parse(req.body);
      const cycle = await db.query.eosCustomerValueCycles.findFirst({ where: and(
        eq(eosCustomerValueCycles.id, req.params.cycleId),
        eq(eosCustomerValueCycles.companyId, access.company.id),
      ) });
      if (!cycle || !mayAccessClassification(access, cycle.classification))
        throw new EosRouteError(404, "customer_value_cycle_not_found", "Customer-value cycle not found.");
      const visible = await visibleSeatIds(access.company.id, access.seat.id, access.role);
      if (!visible.has(cycle.ownerSeatId))
        throw new EosRouteError(404, "customer_value_cycle_not_found", "Customer-value cycle not found.");
      const checkpoint = await db.query.eosCustomerValueProviderCheckpoints.findFirst({ where: and(
        eq(eosCustomerValueProviderCheckpoints.id, req.params.checkpointId),
        eq(eosCustomerValueProviderCheckpoints.cycleId, cycle.id),
        eq(eosCustomerValueProviderCheckpoints.companyId, access.company.id),
      ) });
      if (!checkpoint)
        throw new EosRouteError(404, "customer_value_provider_checkpoint_not_found", "Provider checkpoint not found.");
      const binding = await db.query.eosIntegrationBindings.findFirst({ where: and(
        eq(eosIntegrationBindings.id, checkpoint.integrationBindingId),
        eq(eosIntegrationBindings.companyId, access.company.id),
        eq(eosIntegrationBindings.providerKey, checkpoint.providerKey),
      ) });
      if (!binding)
        throw new EosRouteError(409, "customer_value_provider_binding_invalid", "The checkpoint no longer resolves to its tenant-scoped provider binding.");
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "customer_value_cycle",
        actionKey: "customer_value_cycle.run_provider_contract_fixture",
        purpose: "qualify_customer_value_spine",
        classification: cycle.classification,
        consequence: "routine",
        targetSeatId: cycle.ownerSeatId,
      });
      if (checkpoint.state === "contract_qualified") return { body: checkpoint };
      if (cycle.state !== "commercial_approved")
        throw new EosRouteError(
          409,
          "customer_value_provider_contract_phase_invalid",
          "Provider contract fixtures run only after commercial approval and before agreement readiness.",
        );
      const requestEnvelope = {
        contractVersion: checkpoint.contractVersion,
        cycleKey: cycle.cycleKey,
        checkpointId: checkpoint.id,
        providerKey: checkpoint.providerKey,
        operationKey: checkpoint.operationKey,
        syntheticLabel: cycle.syntheticLabel,
        fixtureOnly: true,
        externalDispatchPermitted: false,
        idempotencyKey: `${cycle.cycleKey}:${checkpoint.providerKey}:${checkpoint.contractVersion}`,
      };
      const requestHash = jsonContentHash(requestEnvelope);
      const scenarioResults = customerValueProviderFixtureScenarios.map(
        ([scenarioKey, expectedBehavior]) => ({
          scenarioKey,
          result: "passed",
          expectedBehavior,
          observedBehavior: expectedBehavior,
          externalEffectsExecuted: false,
        }),
      );
      const responseEnvelope = {
        contractVersion: checkpoint.contractVersion,
        providerKey: checkpoint.providerKey,
        result: "passed",
        scenarioResults,
        liveProviderVerified: false,
        externalEffectsExecuted: false,
      };
      const responseHash = jsonContentHash(responseEnvelope);
      const now = new Date();
      const evidenceId = randomUUID();
      let qualified: any;
      await db.transaction(async (tx) => {
        await tx.insert(eosEvidence).values({
          id: evidenceId,
          companyId: access.company.id,
          workPacketId: cycle.workPacketId,
          recordedByUserId: req.user.id,
          evidenceType: "test_result",
          title: `TEST-PRELIVE ${checkpoint.providerKey} adapter contract suite`,
          details: {
            checkpointId: checkpoint.id,
            integrationBindingId: binding.id,
            requestEnvelope,
            scenarioResults,
            requestHash,
            responseHash,
            liveProviderBlocker: checkpoint.liveProviderBlocker,
            liveProviderVerified: false,
            externalEffectsExecuted: false,
          },
          evidenceKey: commandRecordKey(
            "evidence",
            `${cycle.cycleKey}-${checkpoint.providerKey}-contract-suite`,
            evidenceId,
          ),
          claimSubjectType: "customer_value_provider_checkpoint",
          claimSubjectKey: checkpoint.id,
          verificationState: "verified",
          confidenceQuality: "high",
          dataClassification: "confidential",
          sourceSystem: "native_eos_fixture",
          producerProviderKey: "",
          consentRights: "Synthetic contract fixture only; no external data processed.",
          supportedClaimSummary: `${checkpoint.providerKey} adapter contract passed deterministic pre-live scenarios; live provider behavior remains unverified.`,
          verifierMethod: "Deterministic EOS adapter contract fixture with request and response content hashes.",
          templateLearningEligibility: "not_eligible",
          relatedEventKeys: [],
          relatedDecisionKeys: [policy.decisionId],
          capturedAt: now,
          validFrom: now,
          createdAt: now,
        });
        [qualified] = await tx
          .update(eosCustomerValueProviderCheckpoints)
          .set({
            state: "contract_qualified",
            version: checkpoint.version + 1,
            scenarioResults,
            requestHash,
            responseHash,
            evidenceId,
            liveProviderVerified: false,
            externalEffectsExecuted: false,
            updatedAt: now,
          })
          .where(and(
            eq(eosCustomerValueProviderCheckpoints.id, checkpoint.id),
            eq(eosCustomerValueProviderCheckpoints.state, checkpoint.state),
            eq(eosCustomerValueProviderCheckpoints.version, checkpoint.version),
          ))
          .returning();
        if (!qualified)
          throw new EosRouteError(409, "customer_value_provider_checkpoint_concurrent_change", "The provider checkpoint changed before the fixture completed.");
        await tx.insert(eosCustomerValueProviderFixtureRuns).values({
          id: randomUUID(),
          checkpointId: checkpoint.id,
          cycleId: cycle.id,
          companyId: access.company.id,
          actorUserId: req.user.id,
          actorSeatId: access.seat.id,
          sequence: 1,
          result: "passed",
          scenarioResults,
          requestHash,
          responseHash,
          evidenceId,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          externalEffectsExecuted: false,
          createdAt: now,
        });
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "customer_value_cycle.provider_contract_qualified",
          targetType: "customer_value_provider_checkpoint",
          targetId: checkpoint.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "contract_qualified",
          details: {
            cycleId: cycle.id,
            providerKey: checkpoint.providerKey,
            evidenceId,
            requestHash,
            responseHash,
            liveProviderVerified: false,
            externalEffectsExecuted: false,
          },
          createdAt: now,
        });
      });
      return { body: qualified };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/customer-value-cycles/:cycleId/actions",
    route(async (req) => {
      const access = await companyAccess(req);
      assertCommercialSurface(access);
      const input = customerValueCycleActionSchema.parse(req.body);
      const cycle = await db.query.eosCustomerValueCycles.findFirst({ where: and(
        eq(eosCustomerValueCycles.id, req.params.cycleId),
        eq(eosCustomerValueCycles.companyId, access.company.id),
      ) });
      if (!cycle || !mayAccessClassification(access, cycle.classification))
        throw new EosRouteError(404, "customer_value_cycle_not_found", "Customer-value cycle not found.");
      const visible = await visibleSeatIds(access.company.id, access.seat.id, access.role);
      if (!visible.has(cycle.ownerSeatId))
        throw new EosRouteError(404, "customer_value_cycle_not_found", "Customer-value cycle not found.");
      if (input.action === "verify_agreement") {
        const providerCheckpoints = await db
          .select({ providerKey: eosCustomerValueProviderCheckpoints.providerKey, state: eosCustomerValueProviderCheckpoints.state })
          .from(eosCustomerValueProviderCheckpoints)
          .where(and(
            eq(eosCustomerValueProviderCheckpoints.cycleId, cycle.id),
            eq(eosCustomerValueProviderCheckpoints.companyId, access.company.id),
          ));
        const incompleteProviders = customerValueProviderFixtureSpecs
          .filter(
            (spec) =>
              !providerCheckpoints.some(
                (checkpoint) =>
                  checkpoint.providerKey === spec.providerKey &&
                  checkpoint.state === "contract_qualified",
              ),
          )
          .map((spec) => spec.providerKey);
        if (incompleteProviders.length)
          throw new EosRouteError(
            409,
            "customer_value_provider_contracts_incomplete",
            `Agreement readiness is blocked until every pre-live provider contract is qualified: ${incompleteProviders.join(", ")}.`,
          );
      }
      const evidence = await db.select({ id: eosEvidence.id, workPacketId: eosEvidence.workPacketId }).from(eosEvidence).where(and(
        eq(eosEvidence.companyId, access.company.id),
        inArray(eosEvidence.id, input.evidenceIds),
      ));
      if (evidence.length !== new Set(input.evidenceIds).size || evidence.some((item) => item.workPacketId !== cycle.workPacketId))
        throw new EosRouteError(400, "customer_value_cycle_evidence_invalid", "Every evidence receipt must belong to this cycle's Work Packet and organization.");
      const ordinary: Record<string, { from: string[]; to: string; event: string }> = {
        verify_agreement: { from: ["commercial_approved"], to: "agreement_ready", event: "agreement_verified" },
        start_onboarding: { from: ["agreement_ready"], to: "onboarding", event: "onboarding_started" },
        start_delivery: { from: ["onboarding"], to: "delivery", event: "delivery_started" },
        start_reporting: { from: ["delivery"], to: "reporting", event: "reporting_started" },
        start_renewal_review: { from: ["reporting"], to: "renewal_review", event: "renewal_review_started" },
        renew: { from: ["renewal_review"], to: "renewed", event: "renewed" },
        close: { from: ["renewal_review", "renewed"], to: "closed", event: "closed" },
      };
      let toState: string;
      let eventType: string;
      const updates: any = {};
      if (ordinary[input.action]) {
        const transition = ordinary[input.action];
        if (!transition.from.includes(cycle.state))
          throw new EosRouteError(409, "customer_value_cycle_transition_invalid", `${input.action} cannot run from ${cycle.state}.`);
        toState = transition.to;
        eventType = transition.event;
      } else if (input.action === "report_failure") {
        if (!["agreement_ready", "onboarding", "delivery", "reporting", "renewal_review"].includes(cycle.state))
          throw new EosRouteError(409, "customer_value_cycle_failure_invalid", `Failure recovery cannot begin from ${cycle.state}.`);
        toState = "recovery_required";
        eventType = "failure_reported";
        updates.recoveryFromState = cycle.state;
        updates.failureSummary = input.note;
      } else if (input.action === "restore_safe_state") {
        if (cycle.state !== "recovery_required" || !cycle.recoveryFromState)
          throw new EosRouteError(409, "customer_value_cycle_restore_invalid", "Safe-state restoration requires an active recorded failure.");
        toState = cycle.recoveryFromState;
        eventType = "safe_state_restored";
        updates.recoveryFromState = "";
        updates.failureSummary = "";
        updates.restoredSafeStateAt = new Date();
      } else {
        if (["commercial_rejected", "renewed", "closed", "cancelled"].includes(cycle.state))
          throw new EosRouteError(409, "customer_value_cycle_cancel_invalid", `A terminal cycle cannot be cancelled from ${cycle.state}.`);
        toState = "cancelled";
        eventType = "cancelled";
        updates.restoredSafeStateAt = new Date();
      }
      const policy = await authorizeAction(req, access, {
        authorityClass: ["renew", "close", "cancel"].includes(input.action) ? "decide" : "execute",
        resource: "customer_value_cycle",
        actionKey: `customer_value_cycle.${input.action}`,
        purpose: "qualify_customer_value_spine",
        classification: cycle.classification,
        consequence: ["renew", "close", "cancel"].includes(input.action) ? "material" : "routine",
        targetSeatId: cycle.ownerSeatId,
      });
      const now = new Date();
      const phaseEvidence = { ...(cycle.phaseEvidence as Record<string, string[]>), [eventType]: input.evidenceIds };
      let updated: any;
      await db.transaction(async (tx) => {
        [updated] = await tx.update(eosCustomerValueCycles).set({
          ...updates,
          state: toState,
          version: cycle.version + 1,
          phaseEvidence,
          externalEffectsExecuted: false,
          excludedFromMetrics: true,
          updatedAt: now,
        }).where(and(
          eq(eosCustomerValueCycles.id, cycle.id),
          eq(eosCustomerValueCycles.state, cycle.state),
          eq(eosCustomerValueCycles.version, cycle.version),
        )).returning();
        if (!updated) throw new EosRouteError(409, "customer_value_cycle_concurrent_change", "The cycle changed before this action completed.");
        await appendCustomerValueCycleEvent(tx, {
          cycleId: cycle.id, companyId: access.company.id, actorUserId: req.user.id, actorSeatId: access.seat.id,
          sequence: cycle.version + 1, eventType, fromState: cycle.state, toState, note: input.note,
          evidenceIds: input.evidenceIds, traceId: policy.traceId, correlationId: policy.correlationId, createdAt: now,
        });
        if (["renewed", "closed", "cancelled"].includes(toState))
          await tx.update(eosWorkPackets).set({ status: toState === "cancelled" ? "cancelled" : "completed", completedAt: now, updatedAt: now }).where(eq(eosWorkPackets.id, cycle.workPacketId));
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id,
          action: `customer_value_cycle.${input.action}`, targetType: "customer_value_cycle", targetId: cycle.id,
          traceId: policy.traceId, correlationId: policy.correlationId, result: toState,
          details: { from: cycle.state, evidenceIds: input.evidenceIds, excludedFromMetrics: true, externalEffectsExecuted: false }, createdAt: now,
        });
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/stakeholders",
    route(async (req) => {
      const access = await companyAccess(req);
      const input = stakeholderCreateSchema.parse(req.body);
      assertCommercialSurface(access);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const ownerSeatId = input.ownerSeatId || access.seat.id;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      const identityHash = identityReferenceHash(input.identityReference);
      const duplicates = await db
        .select({ id: eosStakeholders.id })
        .from(eosStakeholders)
        .where(
          and(
            eq(eosStakeholders.companyId, access.company.id),
            eq(eosStakeholders.identityReferenceHash, identityHash),
          ),
        );
      if (duplicates.length)
        throw new EosRouteError(
          409,
          "stakeholder_identity_exists",
          "This party already exists. Add a relationship context to the canonical party instead of creating a duplicate contact.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "stakeholder",
        actionKey: "stakeholder.create",
        purpose: "register_canonical_party",
        classification: input.classification,
        consequence: "material",
        targetSeatId: ownerSeatId,
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        stakeholderKey: commandRecordKey("party", input.name, id),
        name: input.name,
        partyType: input.partyType,
        state: "proposed",
        ownerSeatId,
        identityReference: input.identityReference,
        identityReferenceHash: identityHash,
        externalId: input.externalId || null,
        sourceSystem: input.sourceSystem || null,
        consentLegalBasis: input.consentLegalBasis,
        relationshipRole: input.relationshipRole,
        evidenceKeys: input.evidenceKeys,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        validFrom: input.validFrom ? new Date(input.validFrom) : now,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosStakeholders).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "stakeholder.created",
          targetType: "stakeholder",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "proposed",
          details: {
            stakeholderKey: record.stakeholderKey,
            partyType: record.partyType,
            ownerSeatId,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/stakeholders/:stakeholderId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertCommercialSurface(access);
      const input = stakeholderUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosStakeholders)
        .where(
          and(
            eq(eosStakeholders.id, req.params.stakeholderId),
            eq(eosStakeholders.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "stakeholder_not_found",
          "Stakeholder not found in this organization.",
        );
      assertMutableCommercialProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "stakeholder_not_found",
          "Stakeholder not found in this role's visible scope.",
        );
      const ownerSeatId = input.ownerSeatId || record.ownerSeatId;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionStakeholder(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "stakeholder_transition_invalid",
          `Stakeholder cannot move from ${record.state} to ${input.state}.`,
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: input.state === "closed" ? "decide" : "execute",
        resource: "stakeholder",
        actionKey: input.state
          ? "stakeholder.transition"
          : "stakeholder.update",
        purpose: "govern_party_identity",
        classification: input.classification || record.classification,
        consequence: input.state === "closed" ? "material" : "routine",
        targetSeatId: ownerSeatId,
      });
      const updates: any = { ...input, ownerSeatId, updatedAt: new Date() };
      if (input.identityReference)
        updates.identityReferenceHash = identityReferenceHash(
          input.identityReference,
        );
      for (const field of ["validFrom", "validUntil"] as const)
        if (input[field]) updates[field] = new Date(input[field]!);
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosStakeholders)
          .set(updates)
          .where(
            and(
              eq(eosStakeholders.id, record.id),
              eq(eosStakeholders.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "stakeholder_concurrent_change",
            "The stakeholder changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state
            ? "stakeholder.transitioned"
            : "stakeholder.updated",
          targetType: "stakeholder",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/stakeholder-relationships",
    route(async (req) => {
      const access = await companyAccess(req);
      assertCommercialSurface(access);
      const input = relationshipContextCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const ownerSeatId = input.ownerSeatId || access.seat.id;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      await assertCommercialReferences(access.company.id, {
        stakeholderIds: [input.stakeholderId],
      });
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "stakeholder_relationship",
        actionKey: "stakeholder_relationship.create",
        purpose: "govern_relationship_context",
        classification: input.classification,
        consequence: "material",
        targetSeatId: ownerSeatId,
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        relationshipKey: commandRecordKey("relationship", input.title, id),
        stakeholderId: input.stakeholderId,
        relationshipType: input.relationshipType,
        title: input.title,
        state: "proposed",
        ownerSeatId,
        needConstraint: input.needConstraint,
        fitHypothesis: input.fitHypothesis,
        nextBestAction: input.nextBestAction,
        evidenceKeys: input.evidenceKeys,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosStakeholderRelationships).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "stakeholder_relationship.created",
          targetType: "stakeholder_relationship",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "proposed",
          details: {
            stakeholderId: input.stakeholderId,
            relationshipType: input.relationshipType,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/stakeholder-relationships/:relationshipId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertCommercialSurface(access);
      const input = relationshipContextUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosStakeholderRelationships)
        .where(
          and(
            eq(eosStakeholderRelationships.id, req.params.relationshipId),
            eq(eosStakeholderRelationships.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "relationship_not_found",
          "Relationship context not found.",
        );
      assertMutableCommercialProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "relationship_not_found",
          "Relationship context not found.",
        );
      const ownerSeatId = input.ownerSeatId || record.ownerSeatId;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionRelationship(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "relationship_transition_invalid",
          `Relationship cannot move from ${record.state} to ${input.state}.`,
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: input.state === "closed" ? "decide" : "execute",
        resource: "stakeholder_relationship",
        actionKey: input.state
          ? "stakeholder_relationship.transition"
          : "stakeholder_relationship.update",
        purpose: "govern_relationship_context",
        classification: input.classification || record.classification,
        consequence: input.state === "closed" ? "material" : "routine",
        targetSeatId: ownerSeatId,
      });
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosStakeholderRelationships)
          .set({ ...input, ownerSeatId, updatedAt: new Date() })
          .where(
            and(
              eq(eosStakeholderRelationships.id, record.id),
              eq(eosStakeholderRelationships.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "relationship_concurrent_change",
            "The relationship changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state
            ? "stakeholder_relationship.transitioned"
            : "stakeholder_relationship.updated",
          targetType: "stakeholder_relationship",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/offers",
    route(async (req) => {
      const access = await companyAccess(req);
      assertCommercialSurface(access);
      const input = offerProgramCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const ownerSeatId = input.ownerSeatId || access.seat.id;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      await assertCommercialReferences(access.company.id, {
        audienceStakeholderIds: input.audienceStakeholderIds,
      });
      const policy = await authorizeAction(req, access, {
        authorityClass: "decide",
        resource: "offer_program",
        actionKey: "offer_program.create",
        purpose: "define_value_proposition",
        classification: input.classification,
        consequence: "material",
        targetSeatId: ownerSeatId,
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        offerKey: commandRecordKey("offer", input.name, id),
        name: input.name,
        offerType: input.offerType,
        state: "thesis",
        ownerSeatId,
        problemNeed: input.problemNeed,
        promiseOutcome: input.promiseOutcome,
        audienceStakeholderIds: input.audienceStakeholderIds,
        scopeInclusions: input.scopeInclusions,
        exclusionsConstraints: input.exclusionsConstraints,
        deliveryModel: input.deliveryModel,
        pricingEconomicModel: input.pricingEconomicModel,
        commercialTermsAuthority: input.commercialTermsAuthority,
        metricKeys: input.metricKeys,
        workflowKeys: input.workflowKeys,
        evidenceKeys: input.evidenceKeys,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosOfferPrograms).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "offer_program.created",
          targetType: "offer_program",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "thesis",
          details: {
            offerKey: record.offerKey,
            offerType: record.offerType,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/offers/:offerId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertCommercialSurface(access);
      const input = offerProgramUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosOfferPrograms)
        .where(
          and(
            eq(eosOfferPrograms.id, req.params.offerId),
            eq(eosOfferPrograms.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "offer_not_found",
          "Offer or program not found.",
        );
      assertMutableCommercialProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "offer_not_found",
          "Offer or program not found.",
        );
      const ownerSeatId = input.ownerSeatId || record.ownerSeatId;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      if (input.audienceStakeholderIds)
        await assertCommercialReferences(access.company.id, {
          audienceStakeholderIds: input.audienceStakeholderIds,
        });
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionOffer(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "offer_transition_invalid",
          `Offer cannot move from ${record.state} to ${input.state}.`,
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "decide",
        resource: "offer_program",
        actionKey: input.state
          ? "offer_program.transition"
          : "offer_program.update",
        purpose: "govern_value_proposition",
        classification: input.classification || record.classification,
        consequence: input.state === "retired" ? "material" : "routine",
        targetSeatId: ownerSeatId,
      });
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosOfferPrograms)
          .set({ ...input, ownerSeatId, updatedAt: new Date() })
          .where(
            and(
              eq(eosOfferPrograms.id, record.id),
              eq(eosOfferPrograms.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "offer_concurrent_change",
            "The offer changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state
            ? "offer_program.transitioned"
            : "offer_program.updated",
          targetType: "offer_program",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/commercial-cases",
    route(async (req) => {
      const access = await companyAccess(req);
      assertCommercialSurface(access);
      const input = commercialCaseCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const ownerSeatId = input.ownerSeatId || access.seat.id;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      await assertCommercialReferences(access.company.id, input);
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "commercial_case",
        actionKey: "commercial_case.create",
        purpose: "qualify_commercial_work",
        classification: input.classification,
        consequence: "material",
        targetSeatId: ownerSeatId,
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        caseKey: commandRecordKey("case", input.title, id),
        title: input.title,
        objectClass: input.objectClass,
        state: "identified",
        ownerSeatId,
        stakeholderIds: input.stakeholderIds,
        offerId: input.offerId || null,
        valueEstimate:
          input.valueEstimate === undefined
            ? null
            : String(input.valueEstimate),
        currency: input.currency,
        probabilityConfidence:
          input.probabilityConfidence === undefined
            ? null
            : String(input.probabilityConfidence),
        nextAction: input.nextAction,
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
        resultOutcome: input.resultOutcome,
        riskExceptionKeys: input.riskExceptionKeys,
        evidenceKeys: input.evidenceKeys,
        externalId: input.externalId || null,
        sourceSystem: input.sourceSystem || null,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosCommercialCases).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "commercial_case.created",
          targetType: "commercial_case",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "identified",
          details: {
            caseKey: record.caseKey,
            objectClass: record.objectClass,
            stakeholderIds: record.stakeholderIds,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/commercial-cases/:caseId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertCommercialSurface(access);
      const input = commercialCaseUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosCommercialCases)
        .where(
          and(
            eq(eosCommercialCases.id, req.params.caseId),
            eq(eosCommercialCases.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "commercial_case_not_found",
          "Commercial case not found.",
        );
      assertMutableCommercialProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "commercial_case_not_found",
          "Commercial case not found.",
        );
      const ownerSeatId = input.ownerSeatId || record.ownerSeatId;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      await assertCommercialReferences(access.company.id, input);
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionCommercialCase(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "commercial_case_transition_invalid",
          `Commercial case cannot move from ${record.state} to ${input.state}.`,
        );
      const material = Boolean(
        input.state &&
        ["committed", "won", "lost", "disqualified", "closed"].includes(
          input.state,
        ),
      );
      const policy = await authorizeAction(req, access, {
        authorityClass: material ? "decide" : "execute",
        resource: "commercial_case",
        actionKey: input.state
          ? "commercial_case.transition"
          : "commercial_case.update",
        purpose: "govern_commercial_work",
        classification: input.classification || record.classification,
        consequence: material ? "material" : "routine",
        targetSeatId: ownerSeatId,
      });
      const updates: any = { ...input, ownerSeatId, updatedAt: new Date() };
      for (const field of ["valueEstimate", "probabilityConfidence"] as const)
        if (input[field] !== undefined) updates[field] = String(input[field]);
      if (input.targetDate) updates.targetDate = new Date(input.targetDate);
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosCommercialCases)
          .set(updates)
          .where(
            and(
              eq(eosCommercialCases.id, record.id),
              eq(eosCommercialCases.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "commercial_case_concurrent_change",
            "The commercial case changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state
            ? "commercial_case.transitioned"
            : "commercial_case.updated",
          targetType: "commercial_case",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/value-flows",
    route(async (req) => {
      const access = await companyAccess(req);
      assertCommercialSurface(access);
      const input = valueFlowCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const ownerSeatId = input.ownerSeatId || access.seat.id;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      await assertCommercialReferences(access.company.id, input);
      const material =
        input.flowType === "commitment" || input.flowType === "proposal";
      const policy = await authorizeAction(req, access, {
        authorityClass: material ? "decide" : "execute",
        resource: "value_flow",
        actionKey: "value_flow.create",
        purpose: "record_governed_value_flow",
        classification: input.classification,
        consequence: material ? "material" : "routine",
        targetSeatId: ownerSeatId,
        amount: input.amount,
        currency: input.currency,
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        valueFlowKey: commandRecordKey("flow", input.title, id),
        title: input.title,
        flowType: input.flowType,
        state: "proposed",
        ownerSeatId,
        fromStakeholderId: input.fromStakeholderId || null,
        toStakeholderId: input.toStakeholderId || null,
        offerId: input.offerId || null,
        commercialCaseId: input.commercialCaseId || null,
        amount: input.amount === undefined ? null : String(input.amount),
        currency: input.currency,
        dueEffectiveAt: input.dueEffectiveAt
          ? new Date(input.dueEffectiveAt)
          : null,
        attributionNotes: input.attributionNotes,
        agreementReference: input.agreementReference,
        evidenceKeys: input.evidenceKeys,
        externalId: input.externalId || null,
        sourceSystem: input.sourceSystem || null,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosValueFlows).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "value_flow.created",
          targetType: "value_flow",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "proposed",
          details: {
            valueFlowKey: record.valueFlowKey,
            flowType: record.flowType,
            sourceAuthority: record.sourceAuthority,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/value-flows/:valueFlowId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertCommercialSurface(access);
      const input = valueFlowUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosValueFlows)
        .where(
          and(
            eq(eosValueFlows.id, req.params.valueFlowId),
            eq(eosValueFlows.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "value_flow_not_found",
          "Value flow not found.",
        );
      assertMutableCommercialProjection(record);
      if (
        input.flowType &&
        ["invoice", "payment", "refund", "cost", "revenue"].includes(
          input.flowType,
        ) &&
        !["external_authoritative", "reconciled"].includes(
          record.sourceAuthority,
        )
      )
        throw new EosRouteError(
          409,
          "provider_fact_authority_required",
          "Invoice, payment, refund, cost, and revenue facts require an authoritative provider source.",
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "value_flow_not_found",
          "Value flow not found.",
        );
      const ownerSeatId = input.ownerSeatId || record.ownerSeatId;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      await assertCommercialReferences(access.company.id, input);
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionValueFlow(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "value_flow_transition_invalid",
          `Value flow cannot move from ${record.state} to ${input.state}.`,
        );
      const material = Boolean(
        input.state &&
        [
          "committed",
          "invoiced",
          "paid_settled",
          "partially_settled",
          "cancelled",
          "reconciled",
        ].includes(input.state),
      );
      const policy = await authorizeAction(req, access, {
        authorityClass: material ? "decide" : "execute",
        resource: "value_flow",
        actionKey: input.state ? "value_flow.transition" : "value_flow.update",
        purpose: "govern_value_flow",
        classification: input.classification || record.classification,
        consequence: material ? "material" : "routine",
        targetSeatId: ownerSeatId,
        amount:
          input.amount ?? (record.amount ? Number(record.amount) : undefined),
        currency: input.currency || record.currency,
      });
      const updates: any = { ...input, ownerSeatId, updatedAt: new Date() };
      if (input.amount !== undefined) updates.amount = String(input.amount);
      if (input.dueEffectiveAt)
        updates.dueEffectiveAt = new Date(input.dueEffectiveAt);
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosValueFlows)
          .set(updates)
          .where(
            and(
              eq(eosValueFlows.id, record.id),
              eq(eosValueFlows.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "value_flow_concurrent_change",
            "The value flow changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state
            ? "value_flow.transitioned"
            : "value_flow.updated",
          targetType: "value_flow",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/shared-services/candidates",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!access.company.portfolioId)
        return { body: [] };
      await authorizeAction(req, access, {
        authorityClass: "view", resource: "shared_service", actionKey: "shared_service.candidates",
        purpose: "select_governed_service_provider", classification: "confidential",
      });
      const relationships = await db
        .select({
          relationshipId: eosStakeholderRelationships.id,
          relationshipTitle: eosStakeholderRelationships.title,
          ownerSeatId: eosStakeholderRelationships.ownerSeatId,
          classification: eosStakeholderRelationships.classification,
          relationshipState: eosStakeholderRelationships.state,
          stakeholderState: eosStakeholders.state,
          identityReference: eosStakeholders.identityReference,
        })
        .from(eosStakeholderRelationships)
        .innerJoin(eosStakeholders, eq(eosStakeholders.id, eosStakeholderRelationships.stakeholderId))
        .where(eq(eosStakeholderRelationships.companyId, access.company.id));
      const visible = await visibleSeatIds(access.company.id, access.seat.id, access.role);
      const eligibleRelationships = relationships.filter((item) =>
        item.relationshipState === "active" && item.stakeholderState === "active" &&
        visible.has(item.ownerSeatId) && mayAccessClassification(access, item.classification),
      );
      const candidateCompanies = await db.select().from(companies).where(eq(companies.portfolioId, access.company.portfolioId));
      const resolvedCandidates = await Promise.all(
        candidateCompanies.map(async (candidate) => ({
          company: candidate,
          organizationKey: await latestOrganizationKey(candidate.id),
        })),
      );
      const organizationKeyCounts = new Map<string, number>();
      for (const candidate of resolvedCandidates) {
        if (!candidate.organizationKey) continue;
        organizationKeyCounts.set(
          candidate.organizationKey,
          (organizationKeyCounts.get(candidate.organizationKey) || 0) + 1,
        );
      }
      const candidates = [];
      for (const resolved of resolvedCandidates) {
        const candidate = resolved.company;
        if (candidate.id === access.company.id) continue;
        const organizationKey = resolved.organizationKey;
        if (!organizationKey) continue;
        if (organizationKeyCounts.get(organizationKey) !== 1) continue;
        const relationship = eligibleRelationships.find((item) => item.identityReference === `eos-org:${organizationKey}`);
        if (!relationship) continue;
        candidates.push({
          companyId: candidate.id,
          companyName: candidate.name,
          organizationKey,
          relationshipId: relationship.relationshipId,
          relationshipTitle: relationship.relationshipTitle,
        });
      }
      return { body: candidates };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/shared-services",
    route(async (req) => {
      const access = await companyAccess(req);
      await authorizeAction(req, access, {
        authorityClass: "view", resource: "shared_service", actionKey: "shared_service.list",
        purpose: "review_governed_shared_services", classification: activeClassificationCeiling(access),
      });
      const records = await db.select().from(eosSharedServiceEngagements)
        .where(or(
          eq(eosSharedServiceEngagements.beneficiaryCompanyId, access.company.id),
          eq(eosSharedServiceEngagements.providerCompanyId, access.company.id),
        ))
        .orderBy(desc(eosSharedServiceEngagements.updatedAt));
      const visibleRecords = records.filter((record) => mayAccessClassification(access, record.classification));
      const ids = visibleRecords.map((record) => record.id);
      const [events, companyRecords, approvals] = await Promise.all([
        ids.length ? db.select().from(eosSharedServiceEvents).where(inArray(eosSharedServiceEvents.engagementId, ids)).orderBy(desc(eosSharedServiceEvents.sequence)) : [],
        db.select({ id: companies.id, name: companies.name }).from(companies),
        visibleRecords.length ? db.select({ id: eosApprovalRequests.id, status: eosApprovalRequests.status }).from(eosApprovalRequests)
          .where(inArray(eosApprovalRequests.id, visibleRecords.map((record) => record.beneficiaryApprovalId))) : [],
      ]);
      const companyNames = new Map(companyRecords.map((company) => [company.id, company.name]));
      const approvalStatuses = new Map(approvals.map((approval) => [approval.id, approval.status]));
      return {
        body: visibleRecords.map((record) => {
          const side = record.beneficiaryCompanyId === access.company.id ? "beneficiary" : "provider";
          return {
            ...record,
            side,
            beneficiaryCompanyName: companyNames.get(record.beneficiaryCompanyId) || "Beneficiary company",
            providerCompanyName: companyNames.get(record.providerCompanyId) || "Provider company",
            beneficiaryApprovalStatus: approvalStatuses.get(record.beneficiaryApprovalId) || "unknown",
            providerEvidenceIds: side === "provider" ? record.providerEvidenceIds : [],
            beneficiaryEvidenceIds: side === "beneficiary" ? record.beneficiaryEvidenceIds : [],
            providerEvidenceCount: (record.providerEvidenceIds as string[]).length,
            beneficiaryEvidenceCount: (record.beneficiaryEvidenceIds as string[]).length,
            events: events.filter((event) => event.engagementId === record.id).map((event) => ({
              ...event,
              evidenceIds: event.actorCompanyId === access.company.id ? event.evidenceIds : [],
              evidenceCount: (event.evidenceIds as string[]).length,
            })),
          };
        }),
      };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/shared-services",
    route(async (req) => {
      const access = await companyAccess(req);
      const input = sharedServiceRequestCreateSchema.parse(req.body);
      if (!access.company.portfolioId)
        throw new EosRouteError(409, "shared_service_portfolio_required", "Both companies must share an explicit portfolio context.");
      if (input.providerCompanyId === access.company.id)
        throw new EosRouteError(409, "shared_service_distinct_company_required", "A company cannot be both beneficiary and provider.");
      if (new Date(input.dueAt).getTime() <= Date.now())
        throw new EosRouteError(400, "shared_service_due_date_invalid", "The requested due date must be in the future.");
      const [providerCompany, relationship] = await Promise.all([
        db.query.companies.findFirst({ where: and(eq(companies.id, input.providerCompanyId), eq(companies.portfolioId, access.company.portfolioId)) }),
        db.query.eosStakeholderRelationships.findFirst({ where: and(
          eq(eosStakeholderRelationships.id, input.beneficiaryRelationshipId),
          eq(eosStakeholderRelationships.companyId, access.company.id),
          eq(eosStakeholderRelationships.state, "active"),
        ) }),
      ]);
      if (!providerCompany || !relationship)
        throw new EosRouteError(404, "shared_service_provider_not_found", "The provider relationship is not active in this portfolio and company scope.");
      const stakeholder = await db.query.eosStakeholders.findFirst({ where: and(
        eq(eosStakeholders.id, relationship.stakeholderId),
        eq(eosStakeholders.companyId, access.company.id),
        eq(eosStakeholders.state, "active"),
      ) });
      const providerOrganizationKey = await latestOrganizationKey(providerCompany.id);
      if (!stakeholder || !providerOrganizationKey || stakeholder.identityReference !== `eos-org:${providerOrganizationKey}`)
        throw new EosRouteError(409, "shared_service_identity_mismatch", "The relationship does not resolve to the selected compiled provider company.");
      const portfolioCompanies = await db.select({ id: companies.id }).from(companies)
        .where(eq(companies.portfolioId, access.company.portfolioId));
      const matchingProviderIds = [];
      for (const company of portfolioCompanies) {
        if (await latestOrganizationKey(company.id) === providerOrganizationKey)
          matchingProviderIds.push(company.id);
      }
      if (matchingProviderIds.length !== 1)
        throw new EosRouteError(409, "shared_service_provider_identity_ambiguous", "The provider organization identity resolves to more than one compiled company in this portfolio. Reconcile the duplicate company instances before requesting work.");
      const visible = await visibleSeatIds(access.company.id, access.seat.id, access.role);
      if (!visible.has(relationship.ownerSeatId) || !mayAccessClassification(access, relationship.classification))
        throw new EosRouteError(404, "shared_service_provider_not_found", "The provider relationship is outside this seat's authority scope.");
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute", resource: "shared_service", actionKey: "shared_service.request",
        purpose: "request_governed_cross_company_service", classification: "confidential", consequence: "material",
        targetSeatId: access.seat.id,
      });
      const now = new Date();
      const engagementId = randomUUID();
      const workPacketId = randomUUID();
      const approvalId = randomUUID();
      const engagementKey = commandRecordKey("shared-service", input.title, engagementId);
      let record: any;
      await db.transaction(async (tx) => {
        await tx.insert(eosWorkPackets).values({
          id: workPacketId, companyId: access.company.id, createdByUserId: req.user.id, accountableUserId: req.user.id,
          accountableSeatId: access.seat.id, title: input.title, objective: input.scope,
          status: "awaiting_approval", priority: input.priority, source: "manual", visibility: "company", classification: "confidential",
          requiresApproval: true, toolPack: [], evidenceRequirements: ["Approved service request", "Provider response", "Deliverable evidence", "Beneficiary disposition", "Cost and capacity attribution"],
          expectedOutput: `A bounded ${input.serviceType} deliverable for ${input.beneficiary}.`, acceptanceCriteria: input.acceptanceCriteria,
          constraintsPolicies: "No cross-company reporting line, direct agent command, inferred provider acceptance, or hidden evidence reconstruction.",
          failureEscalationCompensation: "Reject or clarify incomplete handoffs; preserve both company-local queues and the engagement event history.",
          humanFallback: "Return the request to the beneficiary company authority; do not enter the provider hierarchy directly.",
          sourceLineage: "AFM SOP — AFM→Empyrean Production Request & Acceptance", outputArtifactKeys: [],
          traceId: policy.traceId, correlationId: policy.correlationId, dueAt: new Date(input.dueAt), createdAt: now, updatedAt: now,
        });
        await tx.insert(eosApprovalRequests).values({
          id: approvalId, companyId: access.company.id, workPacketId, requestedByUserId: req.user.id,
          assignedToUserId: req.user.id, assignedToSeatId: access.seat.id,
          summary: `Approve shared-service request to ${providerCompany.name}: ${input.title}`,
          status: "pending", createdAt: now,
        });
        [record] = await tx.insert(eosSharedServiceEngagements).values({
          id: engagementId, engagementKey, portfolioId: access.company.portfolioId!,
          beneficiaryCompanyId: access.company.id, providerCompanyId: providerCompany.id,
          beneficiaryRelationshipId: relationship.id, beneficiaryWorkPacketId: workPacketId,
          beneficiaryApprovalId: approvalId, beneficiaryOwnerSeatId: access.seat.id,
          title: input.title, serviceType: input.serviceType, state: "awaiting_beneficiary_approval", version: 1,
          scope: input.scope, beneficiary: input.beneficiary, priority: input.priority, inputs: input.inputs,
          acceptanceCriteria: input.acceptanceCriteria, dueAt: new Date(input.dueAt), costCapacityTreatment: input.costCapacityTreatment,
          externalEffectsExecuted: false, sourceAuthority: "reconciled", classification: "confidential",
          createdByUserId: req.user.id, createdAt: now, updatedAt: now,
        }).returning();
        await appendSharedServiceEvent(tx, {
          engagementId, sequence: 1, actorCompanyId: access.company.id, actorUserId: req.user.id, actorSeatId: access.seat.id,
          eventType: "request_created", fromState: "none", toState: "awaiting_beneficiary_approval",
          note: `Requested from ${providerCompany.name}; no provider authority or external effect was created.`,
          traceId: policy.traceId, correlationId: policy.correlationId, createdAt: now,
        });
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id,
          action: "shared_service.requested", targetType: "shared_service_engagement", targetId: engagementId,
          traceId: policy.traceId, correlationId: policy.correlationId, result: "awaiting_beneficiary_approval",
          details: { providerCompanyId: providerCompany.id, workPacketId, approvalId, externalEffectsExecuted: false }, createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/shared-services/:engagementId/provider-response",
    route(async (req) => {
      const access = await companyAccess(req);
      const input = sharedServiceProviderResponseSchema.parse(req.body);
      const engagement = await db.query.eosSharedServiceEngagements.findFirst({ where: and(
        eq(eosSharedServiceEngagements.id, req.params.engagementId),
        eq(eosSharedServiceEngagements.providerCompanyId, access.company.id),
      ) });
      if (!engagement || !mayAccessClassification(access, engagement.classification))
        throw new EosRouteError(404, "shared_service_not_found", "Shared-service request not found in this provider scope.");
      if (engagement.state !== "provider_review")
        throw new EosRouteError(409, "shared_service_provider_response_invalid", "Provider response requires an approved request in provider review.");
      const approval = await db.query.eosApprovalRequests.findFirst({ where: eq(eosApprovalRequests.id, engagement.beneficiaryApprovalId) });
      if (approval?.status !== "approved")
        throw new EosRouteError(409, "shared_service_beneficiary_approval_required", "The beneficiary approval must be current before provider response.");
      const policy = await authorizeAction(req, access, {
        authorityClass: "approve", resource: "shared_service", actionKey: `shared_service.provider_${input.decision}`,
        purpose: "independently_decide_shared_service_request", classification: engagement.classification, consequence: "material",
        targetSeatId: access.seat.id,
      });
      const state = input.decision === "accept" ? "provider_accepted" : input.decision === "reject" ? "provider_rejected" : "clarification_requested";
      const eventType = input.decision === "accept" ? "provider_accepted" : input.decision === "reject" ? "provider_rejected" : "provider_clarification_requested";
      const providerWorkPacketId = input.decision === "accept" ? randomUUID() : null;
      const now = new Date();
      let updated: any;
      await db.transaction(async (tx) => {
        if (providerWorkPacketId) await tx.insert(eosWorkPackets).values({
          id: providerWorkPacketId, companyId: access.company.id, createdByUserId: req.user.id, accountableUserId: req.user.id,
          accountableSeatId: access.seat.id, title: `Provide: ${engagement.title}`, objective: engagement.scope,
          status: "ready", priority: engagement.priority, source: "manual", visibility: "company", classification: "confidential",
          requiresApproval: false, toolPack: [], evidenceRequirements: ["Versioned deliverable", "Verified execution evidence", "Capacity and cost observation"],
          expectedOutput: engagement.title, acceptanceCriteria: engagement.acceptanceCriteria,
          constraintsPolicies: "Execute only inside the provider company; return evidence through the engagement; never mutate beneficiary priorities or hierarchy.",
          failureEscalationCompensation: "Block provider work, preserve partial output, and return an explicit clarification or defect record.",
          humanFallback: "Escalate inside the provider company to its CEO authority.", sourceLineage: `Shared-service engagement ${engagement.engagementKey}`,
          outputArtifactKeys: [], traceId: policy.traceId, correlationId: policy.correlationId, dueAt: engagement.dueAt,
          createdAt: now, updatedAt: now,
        });
        [updated] = await tx.update(eosSharedServiceEngagements).set({
          state, version: engagement.version + 1, providerResponse: input.response,
          providerOwnerSeatId: access.seat.id, providerWorkPacketId, updatedAt: now,
        }).where(and(
          eq(eosSharedServiceEngagements.id, engagement.id), eq(eosSharedServiceEngagements.state, engagement.state),
          eq(eosSharedServiceEngagements.version, engagement.version),
        )).returning();
        if (!updated) throw new EosRouteError(409, "shared_service_concurrent_change", "The request changed before provider response completed.");
        await appendSharedServiceEvent(tx, {
          engagementId: engagement.id, sequence: engagement.version + 1, actorCompanyId: access.company.id,
          actorUserId: req.user.id, actorSeatId: access.seat.id, eventType, fromState: engagement.state, toState: state,
          note: input.response, traceId: policy.traceId, correlationId: policy.correlationId, createdAt: now,
        });
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id,
          action: `shared_service.${eventType}`, targetType: "shared_service_engagement", targetId: engagement.id,
          traceId: policy.traceId, correlationId: policy.correlationId, result: state,
          details: { beneficiaryCompanyId: engagement.beneficiaryCompanyId, providerWorkPacketId, externalEffectsExecuted: false }, createdAt: now,
        });
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/shared-services/:engagementId/clarify",
    route(async (req) => {
      const access = await companyAccess(req);
      const input = sharedServiceClarificationSchema.parse(req.body);
      const engagement = await db.query.eosSharedServiceEngagements.findFirst({ where: and(
        eq(eosSharedServiceEngagements.id, req.params.engagementId),
        eq(eosSharedServiceEngagements.beneficiaryCompanyId, access.company.id),
      ) });
      if (!engagement || engagement.state !== "clarification_requested")
        throw new EosRouteError(404, "shared_service_clarification_not_found", "No provider clarification is awaiting this beneficiary.");
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute", resource: "shared_service", actionKey: "shared_service.clarify",
        purpose: "clarify_without_material_scope_change", classification: engagement.classification, consequence: "material",
      });
      const now = new Date();
      let updated: any;
      await db.transaction(async (tx) => {
        [updated] = await tx.update(eosSharedServiceEngagements).set({
          state: "provider_review", version: engagement.version + 1, clarificationResponse: input.response, updatedAt: now,
        }).where(and(eq(eosSharedServiceEngagements.id, engagement.id), eq(eosSharedServiceEngagements.state, engagement.state), eq(eosSharedServiceEngagements.version, engagement.version))).returning();
        if (!updated) throw new EosRouteError(409, "shared_service_concurrent_change", "The request changed before clarification completed.");
        await appendSharedServiceEvent(tx, {
          engagementId: engagement.id, sequence: engagement.version + 1, actorCompanyId: access.company.id,
          actorUserId: req.user.id, actorSeatId: access.seat.id, eventType: "beneficiary_clarified",
          fromState: engagement.state, toState: "provider_review", note: input.response,
          traceId: policy.traceId, correlationId: policy.correlationId, createdAt: now,
        });
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id,
          action: "shared_service.beneficiary_clarified", targetType: "shared_service_engagement", targetId: engagement.id,
          traceId: policy.traceId, correlationId: policy.correlationId, result: "provider_review",
          details: { providerCompanyId: engagement.providerCompanyId, materialScopeChanged: false, externalEffectsExecuted: false }, createdAt: now,
        });
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/shared-services/:engagementId/start",
    route(async (req) => {
      const access = await companyAccess(req);
      const engagement = await db.query.eosSharedServiceEngagements.findFirst({ where: and(
        eq(eosSharedServiceEngagements.id, req.params.engagementId), eq(eosSharedServiceEngagements.providerCompanyId, access.company.id),
      ) });
      if (!engagement || engagement.state !== "provider_accepted" || !engagement.providerWorkPacketId)
        throw new EosRouteError(404, "shared_service_start_not_found", "No accepted provider request is available to start.");
      const visible = await visibleSeatIds(access.company.id, access.seat.id, access.role);
      if (!access.isOwner && (!engagement.providerOwnerSeatId || !visible.has(engagement.providerOwnerSeatId)))
        throw new EosRouteError(404, "shared_service_start_not_found", "The provider request is outside this seat's reporting scope.");
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute", resource: "shared_service", actionKey: "shared_service.start",
        purpose: "start_provider_local_service_work", classification: engagement.classification, consequence: "routine",
        targetSeatId: engagement.providerOwnerSeatId || access.seat.id,
      });
      const now = new Date();
      let updated: any;
      await db.transaction(async (tx) => {
        const packet = await tx.update(eosWorkPackets).set({ status: "in_progress", startedAt: now, updatedAt: now })
          .where(and(eq(eosWorkPackets.id, engagement.providerWorkPacketId!), eq(eosWorkPackets.companyId, access.company.id), eq(eosWorkPackets.status, "ready"))).returning({ id: eosWorkPackets.id });
        if (!packet[0]) throw new EosRouteError(409, "shared_service_provider_work_not_ready", "The provider Work Packet is not ready to start.");
        [updated] = await tx.update(eosSharedServiceEngagements).set({ state: "in_progress", version: engagement.version + 1, updatedAt: now })
          .where(and(eq(eosSharedServiceEngagements.id, engagement.id), eq(eosSharedServiceEngagements.state, engagement.state), eq(eosSharedServiceEngagements.version, engagement.version))).returning();
        if (!updated) throw new EosRouteError(409, "shared_service_concurrent_change", "The request changed before provider work started.");
        await appendSharedServiceEvent(tx, {
          engagementId: engagement.id, sequence: engagement.version + 1, actorCompanyId: access.company.id,
          actorUserId: req.user.id, actorSeatId: access.seat.id, eventType: "provider_started",
          fromState: engagement.state, toState: "in_progress", traceId: policy.traceId, correlationId: policy.correlationId, createdAt: now,
        });
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id,
          action: "shared_service.provider_started", targetType: "shared_service_engagement", targetId: engagement.id,
          traceId: policy.traceId, correlationId: policy.correlationId, result: "in_progress",
          details: { beneficiaryCompanyId: engagement.beneficiaryCompanyId, providerWorkPacketId: engagement.providerWorkPacketId, externalEffectsExecuted: false }, createdAt: now,
        });
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/shared-services/:engagementId/deliver",
    route(async (req) => {
      const access = await companyAccess(req);
      const input = sharedServiceDeliverySchema.parse(req.body);
      const engagement = await db.query.eosSharedServiceEngagements.findFirst({ where: and(
        eq(eosSharedServiceEngagements.id, req.params.engagementId), eq(eosSharedServiceEngagements.providerCompanyId, access.company.id),
      ) });
      if (!engagement || !["in_progress", "rework_requested"].includes(engagement.state) || !engagement.providerWorkPacketId)
        throw new EosRouteError(404, "shared_service_delivery_not_found", "No provider work is available for delivery.");
      const evidence = await db.select().from(eosEvidence).where(and(
        eq(eosEvidence.companyId, access.company.id), eq(eosEvidence.workPacketId, engagement.providerWorkPacketId), inArray(eosEvidence.id, input.evidenceIds),
      ));
      if (evidence.length !== input.evidenceIds.length || evidence.some((item) => item.verificationState !== "verified"))
        throw new EosRouteError(409, "shared_service_verified_provider_evidence_required", "Delivery requires verified evidence attached to the provider Work Packet.");
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute", resource: "shared_service", actionKey: "shared_service.deliver",
        purpose: "return_evidence_bearing_deliverable", classification: engagement.classification, consequence: "material",
        evidenceReferences: evidence.flatMap((item) => item.uri ? [item.uri] : []),
      });
      const now = new Date();
      let updated: any;
      await db.transaction(async (tx) => {
        await tx.update(eosWorkPackets).set({ status: "in_review", updatedAt: now })
          .where(and(eq(eosWorkPackets.id, engagement.providerWorkPacketId!), eq(eosWorkPackets.companyId, access.company.id), eq(eosWorkPackets.status, "in_progress")));
        [updated] = await tx.update(eosSharedServiceEngagements).set({
          state: "delivered", version: engagement.version + 1, deliverySummary: input.deliverySummary,
          providerEvidenceIds: input.evidenceIds, updatedAt: now,
        }).where(and(eq(eosSharedServiceEngagements.id, engagement.id), eq(eosSharedServiceEngagements.state, engagement.state), eq(eosSharedServiceEngagements.version, engagement.version))).returning();
        if (!updated) throw new EosRouteError(409, "shared_service_concurrent_change", "The request changed before delivery completed.");
        await appendSharedServiceEvent(tx, {
          engagementId: engagement.id, sequence: engagement.version + 1, actorCompanyId: access.company.id,
          actorUserId: req.user.id, actorSeatId: access.seat.id, eventType: "provider_delivered",
          fromState: engagement.state, toState: "delivered", note: input.deliverySummary, evidenceIds: input.evidenceIds,
          traceId: policy.traceId, correlationId: policy.correlationId, createdAt: now,
        });
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id,
          action: "shared_service.provider_delivered", targetType: "shared_service_engagement", targetId: engagement.id,
          traceId: policy.traceId, correlationId: policy.correlationId, result: "delivered",
          details: { beneficiaryCompanyId: engagement.beneficiaryCompanyId, evidenceCount: input.evidenceIds.length, externalEffectsExecuted: false }, createdAt: now,
        });
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/shared-services/:engagementId/disposition",
    route(async (req) => {
      const access = await companyAccess(req);
      const input = sharedServiceDispositionSchema.parse(req.body);
      const engagement = await db.query.eosSharedServiceEngagements.findFirst({ where: and(
        eq(eosSharedServiceEngagements.id, req.params.engagementId), eq(eosSharedServiceEngagements.beneficiaryCompanyId, access.company.id),
      ) });
      if (!engagement || engagement.state !== "delivered" || !engagement.providerWorkPacketId)
        throw new EosRouteError(404, "shared_service_disposition_not_found", "No delivered service is awaiting this beneficiary's disposition.");
      const evidence = await db.select().from(eosEvidence).where(and(
        eq(eosEvidence.companyId, access.company.id), eq(eosEvidence.workPacketId, engagement.beneficiaryWorkPacketId), inArray(eosEvidence.id, input.evidenceIds),
      ));
      if (evidence.length !== input.evidenceIds.length || evidence.some((item) => item.verificationState !== "verified"))
        throw new EosRouteError(409, "shared_service_verified_beneficiary_evidence_required", "Disposition requires verified review evidence attached to the beneficiary Work Packet.");
      const policy = await authorizeAction(req, access, {
        authorityClass: "approve", resource: "shared_service", actionKey: `shared_service.${input.decision}`,
        purpose: "decide_service_acceptance", classification: engagement.classification, consequence: "material",
        evidenceReferences: evidence.flatMap((item) => item.uri ? [item.uri] : []),
      });
      const state = input.decision === "accept" ? "accepted" : input.decision === "reject" ? "rejected" : "rework_requested";
      const eventType = input.decision === "accept" ? "beneficiary_accepted" : input.decision === "reject" ? "beneficiary_rejected_delivery" : "beneficiary_rework_requested";
      const now = new Date();
      let updated: any;
      await db.transaction(async (tx) => {
        await tx.update(eosWorkPackets).set({
          status: input.decision === "request_rework" ? "in_progress" : "completed",
          ...(input.decision === "request_rework" ? {} : { completedAt: now }), updatedAt: now,
        }).where(and(eq(eosWorkPackets.id, engagement.providerWorkPacketId!), eq(eosWorkPackets.companyId, engagement.providerCompanyId), eq(eosWorkPackets.status, "in_review")));
        if (input.decision !== "request_rework") await tx.update(eosWorkPackets).set({ status: "completed", completedAt: now, updatedAt: now })
          .where(and(eq(eosWorkPackets.id, engagement.beneficiaryWorkPacketId), eq(eosWorkPackets.companyId, access.company.id)));
        [updated] = await tx.update(eosSharedServiceEngagements).set({
          state, version: engagement.version + 1, beneficiaryDisposition: input.disposition,
          beneficiaryEvidenceIds: input.evidenceIds,
          ...(input.costCapacityOutcome ? { costCapacityOutcome: input.costCapacityOutcome } : {}), updatedAt: now,
        }).where(and(eq(eosSharedServiceEngagements.id, engagement.id), eq(eosSharedServiceEngagements.state, engagement.state), eq(eosSharedServiceEngagements.version, engagement.version))).returning();
        if (!updated) throw new EosRouteError(409, "shared_service_concurrent_change", "The request changed before beneficiary disposition completed.");
        await appendSharedServiceEvent(tx, {
          engagementId: engagement.id, sequence: engagement.version + 1, actorCompanyId: access.company.id,
          actorUserId: req.user.id, actorSeatId: access.seat.id, eventType,
          fromState: engagement.state, toState: state, note: input.disposition, evidenceIds: input.evidenceIds,
          traceId: policy.traceId, correlationId: policy.correlationId, createdAt: now,
        });
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id,
          action: `shared_service.${eventType}`, targetType: "shared_service_engagement", targetId: engagement.id,
          traceId: policy.traceId, correlationId: policy.correlationId, result: state,
          details: { providerCompanyId: engagement.providerCompanyId, costCapacityOutcome: input.costCapacityOutcome || null, externalEffectsExecuted: false }, createdAt: now,
        });
      });
      return { body: updated };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/operations-state",
    route(async (req) => {
      const access = await companyAccess(req);
      assertOperationsSurface(access);
      await authorizeAction(req, access, {
        authorityClass: "view",
        resource: "operations_graph",
        actionKey: "operations_graph.view",
        purpose: "operate_canonical_processes",
        classification: activeClassificationCeiling(access),
      });
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const [capabilities, processes, resources] = await Promise.all([
        db
          .select()
          .from(eosCapabilityInstances)
          .where(eq(eosCapabilityInstances.companyId, access.company.id))
          .orderBy(desc(eosCapabilityInstances.updatedAt)),
        db
          .select()
          .from(eosProcessDefinitions)
          .where(eq(eosProcessDefinitions.companyId, access.company.id))
          .orderBy(desc(eosProcessDefinitions.updatedAt)),
        db
          .select()
          .from(eosResourcesAssets)
          .where(eq(eosResourcesAssets.companyId, access.company.id))
          .orderBy(desc(eosResourcesAssets.updatedAt)),
      ]);
      const visibleCapabilities = capabilities.filter(
        (item) =>
          visible.has(item.accountableSeatId) &&
          mayAccessClassification(access, item.classification),
      );
      const capabilityIds = new Set(visibleCapabilities.map((item) => item.id));
      const visibleProcesses = processes.filter(
        (item) =>
          capabilityIds.has(item.capabilityInstanceId) &&
          visible.has(item.accountableSeatId) &&
          mayAccessClassification(access, item.classification),
      );
      const visibleResources = resources.filter(
        (item) =>
          visible.has(item.custodianSeatId) &&
          mayAccessClassification(access, item.classification),
      );
      return {
        body: {
          capabilities: visibleCapabilities,
          processes: visibleProcesses,
          resources: visibleResources,
          counts: {
            activeCapabilities: visibleCapabilities.filter(
              (item) => item.state === "active",
            ).length,
            releasedProcesses: visibleProcesses.filter(
              (item) => item.releaseState === "released",
            ).length,
            fieldQualifiedProcesses: visibleProcesses.filter(
              (item) => item.qualificationState === "field_qualified",
            ).length,
            activeResources: visibleResources.filter(
              (item) => item.lifecycleState === "active",
            ).length,
          },
        },
      };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/capabilities",
    route(async (req) => {
      const access = await companyAccess(req);
      assertOperationsSurface(access);
      const input = capabilityCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const accountableSeatId = input.ownerSeatId || access.seat.id;
      await assertCommandOwnerSeat(
        access.company.id,
        accountableSeatId,
        visible,
      );
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "capability_instance",
        actionKey: "capability_instance.create",
        purpose: "define_operating_capability",
        classification: input.classification,
        consequence: "material",
        targetSeatId: accountableSeatId,
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        capabilityInstanceKey: commandRecordKey("capability", input.name, id),
        capabilityKey: input.capabilityKey,
        name: input.name,
        state: "planned",
        maturity: input.maturity,
        accountableSeatId,
        activationTrigger: input.activationTrigger,
        deactivationTrigger: input.deactivationTrigger,
        moduleIds: input.moduleIds,
        agentKeys: input.agentKeys,
        humanOperatorKey: input.humanOperatorKey,
        systemKeys: input.systemKeys,
        workflowKeys: input.workflowKeys,
        metricKeys: input.metricKeys,
        riskControlKeys: input.riskControlKeys,
        evidenceKeys: input.evidenceKeys,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosCapabilityInstances).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "capability_instance.created",
          targetType: "capability_instance",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "planned",
          details: {
            capabilityInstanceKey: record.capabilityInstanceKey,
            capabilityKey: record.capabilityKey,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/capabilities/:capabilityId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertOperationsSurface(access);
      const input = capabilityUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosCapabilityInstances)
        .where(
          and(
            eq(eosCapabilityInstances.id, req.params.capabilityId),
            eq(eosCapabilityInstances.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "capability_not_found",
          "Capability instance not found.",
        );
      assertMutableOperationsProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.accountableSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "capability_not_found",
          "Capability instance not found.",
        );
      const accountableSeatId = input.ownerSeatId || record.accountableSeatId;
      await assertCommandOwnerSeat(
        access.company.id,
        accountableSeatId,
        visible,
      );
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionCapability(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "capability_transition_invalid",
          `Capability cannot move from ${record.state} to ${input.state}.`,
        );
      const material = Boolean(
        input.state && ["active", "deprecated"].includes(input.state),
      );
      const policy = await authorizeAction(req, access, {
        authorityClass: material ? "decide" : "execute",
        resource: "capability_instance",
        actionKey: input.state
          ? "capability_instance.transition"
          : "capability_instance.update",
        purpose: "govern_operating_capability",
        classification: input.classification || record.classification,
        consequence: material ? "material" : "routine",
        targetSeatId: accountableSeatId,
      });
      const updates: any = {
        ...input,
        accountableSeatId,
        updatedAt: new Date(),
      };
      delete updates.ownerSeatId;
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosCapabilityInstances)
          .set(updates)
          .where(
            and(
              eq(eosCapabilityInstances.id, record.id),
              eq(eosCapabilityInstances.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "capability_concurrent_change",
            "The capability changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state
            ? "capability_instance.transitioned"
            : "capability_instance.updated",
          targetType: "capability_instance",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/processes",
    route(async (req) => {
      const access = await companyAccess(req);
      assertOperationsSurface(access);
      const input = processCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const accountableSeatId = input.ownerSeatId || access.seat.id;
      await assertCommandOwnerSeat(
        access.company.id,
        accountableSeatId,
        visible,
      );
      await assertOperationsReferences(access.company.id, {
        capabilityInstanceId: input.capabilityInstanceId,
      });
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "process_definition",
        actionKey: "process_definition.create",
        purpose: "define_executable_process",
        classification: input.classification,
        consequence: "material",
        targetSeatId: accountableSeatId,
      });
      const id = randomUUID();
      const now = new Date();
      const processKey = commandRecordKey("process", input.name, id);
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        processKey,
        name: input.name,
        version: 1,
        qualificationState: "mapped",
        releaseState: "draft",
        capabilityInstanceId: input.capabilityInstanceId,
        workflowKey: input.workflowKey,
        purpose: input.purpose,
        intendedOutcome: input.intendedOutcome,
        templateAncestry: input.templateAncestry,
        applicableOverlays: input.applicableOverlays,
        triggerCondition: input.triggerCondition,
        accountableSeatId,
        supportingActorKeys: input.supportingActorKeys,
        requiredAuthority: input.requiredAuthority,
        disclosureScope: input.disclosureScope,
        prerequisites: input.prerequisites,
        requiredInputs: input.requiredInputs,
        toolSystemBoundaries: input.toolSystemBoundaries,
        procedureSteps: input.procedureSteps,
        branchConditions: input.branchConditions,
        approvalGates: input.approvalGates,
        prohibitedActions: input.prohibitedActions,
        requiredOutputs: input.requiredOutputs,
        evidenceRequirements: input.evidenceRequirements,
        qualityCriteria: input.qualityCriteria,
        sla: input.sla,
        emittedEvents: input.emittedEvents,
        failurePaths: input.failurePaths,
        terminalCriteria: input.terminalCriteria,
        trainingPrerequisites: input.trainingPrerequisites,
        acceptanceTests: input.acceptanceTests,
        reviewerKeys: input.reviewerKeys,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosProcessDefinitions).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "process_definition.created",
          targetType: "process_definition",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "mapped",
          details: {
            processKey,
            version: 1,
            capabilityInstanceId: input.capabilityInstanceId,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/processes/:processId/versions",
    route(async (req) => {
      const access = await companyAccess(req);
      assertOperationsSurface(access);
      const input = z
        .object({ reason: z.string().trim().min(3).max(2000) })
        .parse(req.body);
      const [source] = await db
        .select()
        .from(eosProcessDefinitions)
        .where(
          and(
            eq(eosProcessDefinitions.id, req.params.processId),
            eq(eosProcessDefinitions.companyId, access.company.id),
          ),
        );
      if (!source)
        throw new EosRouteError(
          404,
          "process_not_found",
          "Process definition not found.",
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(source.accountableSeatId) ||
        !mayAccessClassification(access, source.classification)
      )
        throw new EosRouteError(
          404,
          "process_not_found",
          "Process definition not found.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "decide",
        resource: "process_definition",
        actionKey: "process_definition.version",
        purpose: "version_executable_process",
        classification: source.classification,
        consequence: "material",
        targetSeatId: source.accountableSeatId,
      });
      const [latest] = await db
        .select({ version: eosProcessDefinitions.version })
        .from(eosProcessDefinitions)
        .where(
          and(
            eq(eosProcessDefinitions.companyId, access.company.id),
            eq(eosProcessDefinitions.processKey, source.processKey),
          ),
        )
        .orderBy(desc(eosProcessDefinitions.version))
        .limit(1);
      const id = randomUUID();
      const now = new Date();
      const record = {
        ...source,
        id,
        version: (latest?.version || source.version) + 1,
        qualificationState: "mapped",
        releaseState: "draft",
        sourceAuthority: "native_eos",
        recordedByUserId: req.user.id,
        effectiveFrom: now,
        effectiveUntil: null,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosProcessDefinitions).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "process_definition.versioned",
          targetType: "process_definition",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "draft",
          details: {
            processKey: source.processKey,
            fromVersion: source.version,
            toVersion: record.version,
            sourceProcessId: source.id,
            reason: input.reason,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/processes/:processId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertOperationsSurface(access);
      const input = processUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosProcessDefinitions)
        .where(
          and(
            eq(eosProcessDefinitions.id, req.params.processId),
            eq(eosProcessDefinitions.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "process_not_found",
          "Process definition not found.",
        );
      assertMutableOperationsProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.accountableSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "process_not_found",
          "Process definition not found.",
        );
      const accountableSeatId = input.ownerSeatId || record.accountableSeatId;
      await assertCommandOwnerSeat(
        access.company.id,
        accountableSeatId,
        visible,
      );
      if (
        input.qualificationState &&
        input.qualificationState !== record.qualificationState &&
        !canTransitionProcessQualification(
          record.qualificationState as any,
          input.qualificationState,
        )
      )
        throw new EosRouteError(
          409,
          "process_qualification_transition_invalid",
          `Process cannot move from ${record.qualificationState} to ${input.qualificationState}.`,
        );
      if (
        input.releaseState &&
        input.releaseState !== record.releaseState &&
        !canTransitionProcessRelease(
          record.releaseState as any,
          input.releaseState,
        )
      )
        throw new EosRouteError(
          409,
          "process_release_transition_invalid",
          `Process release cannot move from ${record.releaseState} to ${input.releaseState}.`,
        );
      if (
        input.releaseState === "released" &&
        ![
          "artifact_complete",
          "implemented",
          "pre_live_qualified",
          "field_qualified",
        ].includes(input.qualificationState || record.qualificationState)
      )
        throw new EosRouteError(
          409,
          "process_artifact_incomplete",
          "A process must be artifact complete before release.",
        );
      const artifactFields = Object.keys(input).filter(
        (key) => !["qualificationState", "releaseState"].includes(key),
      );
      if (
        ["released", "paused", "retired"].includes(record.releaseState) &&
        artifactFields.length
      )
        throw new EosRouteError(
          409,
          "released_process_version_immutable",
          "Released process artifacts are immutable. Create the next version before changing the operating contract.",
        );
      const targetQualification =
        input.qualificationState || record.qualificationState;
      if (targetQualification === "artifact_complete") {
        const artifact = { ...record, ...input } as any;
        const requiredCollections = [
          artifact.procedureSteps,
          artifact.requiredOutputs,
          artifact.evidenceRequirements,
          artifact.failurePaths,
          artifact.terminalCriteria,
          artifact.acceptanceTests,
        ];
        if (
          requiredCollections.some(
            (items) => !Array.isArray(items) || items.length === 0,
          )
        )
          throw new EosRouteError(
            409,
            "process_artifact_incomplete",
            "Artifact Complete requires steps, outputs, evidence, failure handling, terminal criteria, and acceptance tests.",
          );
      }
      if (
        ["pre_live_qualified", "field_qualified"].includes(
          targetQualification,
        ) &&
        targetQualification !== record.qualificationState
      ) {
        const completedPackets = await db
          .select({ id: eosWorkPackets.id })
          .from(eosWorkPackets)
          .where(
            and(
              eq(eosWorkPackets.companyId, access.company.id),
              eq(eosWorkPackets.processDefinitionId, record.id),
              eq(eosWorkPackets.status, "completed"),
            ),
          );
        if (!completedPackets.length)
          throw new EosRouteError(
            409,
            "process_execution_evidence_required",
            "Qualification requires a completed Work Packet for this exact process version.",
          );
        const packetIds = completedPackets.map((packet) => packet.id);
        const evidence = await db
          .select({ verificationState: eosEvidence.verificationState })
          .from(eosEvidence)
          .where(
            and(
              eq(eosEvidence.companyId, access.company.id),
              inArray(eosEvidence.workPacketId, packetIds),
            ),
          );
        const allowedEvidence =
          targetQualification === "field_qualified"
            ? ["verified"]
            : ["observed", "verified"];
        if (
          !evidence.some((item) =>
            allowedEvidence.includes(item.verificationState),
          )
        )
          throw new EosRouteError(
            409,
            "process_qualification_evidence_required",
            targetQualification === "field_qualified"
              ? "Field qualification requires verified real-execution evidence."
              : "Pre-live qualification requires observed fixture-execution evidence.",
          );
      }
      const material = Boolean(input.releaseState || input.qualificationState);
      const policy = await authorizeAction(req, access, {
        authorityClass: material ? "decide" : "execute",
        resource: "process_definition",
        actionKey: material
          ? "process_definition.transition"
          : "process_definition.update",
        purpose: "govern_executable_process",
        classification: input.classification || record.classification,
        consequence: material ? "material" : "routine",
        targetSeatId: accountableSeatId,
      });
      const updates: any = {
        ...input,
        accountableSeatId,
        updatedAt: new Date(),
      };
      delete updates.ownerSeatId;
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosProcessDefinitions)
          .set(updates)
          .where(
            and(
              eq(eosProcessDefinitions.id, record.id),
              eq(
                eosProcessDefinitions.qualificationState,
                record.qualificationState,
              ),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "process_concurrent_change",
            "The process changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: material
            ? "process_definition.transitioned"
            : "process_definition.updated",
          targetType: "process_definition",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].qualificationState,
          details: {
            from: record.qualificationState,
            to: changed[0].qualificationState,
            releaseState: changed[0].releaseState,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/resources",
    route(async (req) => {
      const access = await companyAccess(req);
      assertOperationsSurface(access);
      const input = resourceCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const custodianSeatId = input.ownerSeatId || access.seat.id;
      await assertCommandOwnerSeat(access.company.id, custodianSeatId, visible);
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "resource_asset",
        actionKey: "resource_asset.create",
        purpose: "register_operating_resource",
        classification: input.classification,
        consequence:
          input.assetType === "credential_reference" ? "material" : "routine",
        targetSeatId: custodianSeatId,
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        assetKey: commandRecordKey("asset", input.name, id),
        name: input.name,
        assetType: input.assetType,
        lifecycleState: "proposed",
        custodianSeatId,
        ownerOrganizationKey: input.ownerOrganizationKey,
        operatorOrganizationKey: input.operatorOrganizationKey,
        dataClassification: input.dataClassification,
        externalIdUrl: input.externalIdUrl || null,
        sourceSystem: input.sourceSystem || null,
        rightsUsageLicense: input.rightsUsageLicense,
        replacementPortabilityNotes: input.replacementPortabilityNotes,
        toolEntitlementKeys: input.toolEntitlementKeys,
        evidenceKeys: input.evidenceKeys,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosResourcesAssets).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "resource_asset.created",
          targetType: "resource_asset",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "proposed",
          details: {
            assetKey: record.assetKey,
            assetType: record.assetType,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/resources/:resourceId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertOperationsSurface(access);
      const input = resourceUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosResourcesAssets)
        .where(
          and(
            eq(eosResourcesAssets.id, req.params.resourceId),
            eq(eosResourcesAssets.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "resource_not_found",
          "Resource or asset not found.",
        );
      assertMutableOperationsProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.custodianSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "resource_not_found",
          "Resource or asset not found.",
        );
      const custodianSeatId = input.ownerSeatId || record.custodianSeatId;
      await assertCommandOwnerSeat(access.company.id, custodianSeatId, visible);
      if (
        input.lifecycleState &&
        input.lifecycleState !== record.lifecycleState &&
        !canTransitionResource(
          record.lifecycleState as any,
          input.lifecycleState,
        )
      )
        throw new EosRouteError(
          409,
          "resource_transition_invalid",
          `Resource cannot move from ${record.lifecycleState} to ${input.lifecycleState}.`,
        );
      const material = Boolean(
        input.lifecycleState &&
        ["active", "restricted", "archived"].includes(input.lifecycleState),
      );
      const policy = await authorizeAction(req, access, {
        authorityClass: material ? "decide" : "execute",
        resource: "resource_asset",
        actionKey: input.lifecycleState
          ? "resource_asset.transition"
          : "resource_asset.update",
        purpose: "govern_operating_resource",
        classification: input.classification || record.classification,
        consequence: material ? "material" : "routine",
        targetSeatId: custodianSeatId,
      });
      const updates: any = { ...input, custodianSeatId, updatedAt: new Date() };
      delete updates.ownerSeatId;
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosResourcesAssets)
          .set(updates)
          .where(
            and(
              eq(eosResourcesAssets.id, record.id),
              eq(eosResourcesAssets.lifecycleState, record.lifecycleState),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "resource_concurrent_change",
            "The resource changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.lifecycleState
            ? "resource_asset.transitioned"
            : "resource_asset.updated",
          targetType: "resource_asset",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].lifecycleState,
          details: {
            from: record.lifecycleState,
            to: changed[0].lifecycleState,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/finance-state",
    route(async (req) => {
      const access = await companyAccess(req);
      assertFinanceSurface(access);
      await authorizeAction(req, access, {
        authorityClass: "view",
        resource: "finance_graph",
        actionKey: "finance_graph.view",
        purpose: "govern_cash_to_allocation",
        classification: "confidential",
      });
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const [sources, plans, allocations, valueFlows, obligations, metrics] =
        await Promise.all([
          db
            .select()
            .from(eosFinancialSources)
            .where(eq(eosFinancialSources.companyId, access.company.id))
            .orderBy(desc(eosFinancialSources.updatedAt)),
          db
            .select()
            .from(eosFinancialPlans)
            .where(eq(eosFinancialPlans.companyId, access.company.id))
            .orderBy(desc(eosFinancialPlans.updatedAt)),
          db
            .select()
            .from(eosCapitalAllocations)
            .where(eq(eosCapitalAllocations.companyId, access.company.id))
            .orderBy(desc(eosCapitalAllocations.updatedAt)),
          db
            .select()
            .from(eosValueFlows)
            .where(
              and(
                eq(eosValueFlows.companyId, access.company.id),
                inArray(eosValueFlows.flowType, [
                  "invoice",
                  "payment",
                  "refund",
                  "cost",
                  "revenue",
                ]),
              ),
            )
            .orderBy(desc(eosValueFlows.updatedAt)),
          db
            .select()
            .from(eosRisksControls)
            .where(
              and(
                eq(eosRisksControls.companyId, access.company.id),
                eq(eosRisksControls.recordType, "obligation"),
                sql`${eosRisksControls.capabilityProcessAssetKey} LIKE 'finance:%'`,
              ),
            )
            .orderBy(desc(eosRisksControls.updatedAt)),
          db
            .select()
            .from(eosMetricsOutcomes)
            .where(
              and(
                eq(eosMetricsOutcomes.companyId, access.company.id),
                sql`${eosMetricsOutcomes.subjectType} LIKE 'finance%'`,
              ),
            )
            .orderBy(desc(eosMetricsOutcomes.updatedAt)),
        ]);
      const visibleSources = sources.filter(
        (item) =>
          visible.has(item.ownerSeatId) &&
          mayAccessClassification(access, item.classification),
      );
      const visiblePlans = plans.filter(
        (item) =>
          visible.has(item.ownerSeatId) &&
          mayAccessClassification(access, item.classification),
      );
      const visibleAllocations = allocations.filter(
        (item) =>
          visible.has(item.ownerSeatId) &&
          mayAccessClassification(access, item.classification),
      );
      const visibleFlows = valueFlows.filter(
        (item) =>
          visible.has(item.ownerSeatId) &&
          mayAccessClassification(access, item.classification),
      );
      const visibleObligations = obligations.filter(
        (item) =>
          visible.has(item.ownerSeatId) &&
          mayAccessClassification(access, item.classification),
      );
      const visibleMetrics = metrics.filter(
        (item) =>
          visible.has(item.ownerSeatId) &&
          mayAccessClassification(access, item.classification),
      );
      return {
        body: {
          sources: visibleSources,
          plans: visiblePlans,
          allocations: visibleAllocations,
          valueFlows: visibleFlows,
          obligations: visibleObligations,
          metrics: visibleMetrics,
          investorRelations: {
            state: "dormant",
            activationTrigger:
              "A real capital breakpoint with verified legal entity, instrument, investor identity, disclosure, professional review, approval, and reporting boundaries.",
          },
          counts: {
            connectedSources: visibleSources.filter(
              (item) => item.lifecycleState === "connected",
            ).length,
            approvedPlans: visiblePlans.filter((item) =>
              ["approved", "active"].includes(item.state),
            ).length,
            reconciledPlans: visiblePlans.filter(
              (item) => item.reconciliationState === "reconciled",
            ).length,
            openObligations: visibleObligations.filter(
              (item) =>
                !["satisfied_closed", "superseded"].includes(item.state),
            ).length,
            allocationsAwaitingDecision: visibleAllocations.filter((item) =>
              ["proposed", "under_review"].includes(item.state),
            ).length,
          },
        },
      };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/financial-sources",
    route(async (req) => {
      const access = await companyAccess(req);
      assertFinanceSurface(access);
      const input = financialSourceCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const ownerSeatId = input.ownerSeatId || access.seat.id;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      if (input.evidenceIds.length)
        await assertFinanceReferences(access.company.id, {
          evidenceIds: input.evidenceIds,
        });
      const material = input.lifecycleState !== "draft";
      const policy = await authorizeAction(req, access, {
        authorityClass: material ? "decide" : "execute",
        resource: "financial_source",
        actionKey: "financial_source.create",
        purpose: "bind_financial_source",
        classification: input.classification,
        consequence: material ? "material" : "routine",
        targetSeatId: ownerSeatId,
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        sourceKey: commandRecordKey("finance-source", input.name, id),
        name: input.name,
        legalEntityName: input.legalEntityName,
        legalEntityReference: input.legalEntityReference,
        accountType: input.accountType,
        currency: input.currency,
        lifecycleState: input.lifecycleState,
        ownerSeatId,
        sourceSystem: input.sourceSystem || null,
        externalId: input.externalId || null,
        sourceAuthority: input.sourceAuthority,
        reconciliationState: input.reconciliationState,
        freshnessAsOf: input.freshnessAsOf
          ? new Date(input.freshnessAsOf)
          : null,
        evidenceIds: input.evidenceIds,
        classification: input.classification,
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosFinancialSources).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "financial_source.created",
          targetType: "financial_source",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: record.lifecycleState,
          details: {
            sourceKey: record.sourceKey,
            accountType: record.accountType,
            sourceSystem: record.sourceSystem,
            sourceAuthority: record.sourceAuthority,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/financial-sources/:sourceId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertFinanceSurface(access);
      const input = financialSourceUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosFinancialSources)
        .where(
          and(
            eq(eosFinancialSources.id, req.params.sourceId),
            eq(eosFinancialSources.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "financial_source_not_found",
          "Financial source not found.",
        );
      assertMutableFinanceProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "financial_source_not_found",
          "Financial source not found.",
        );
      const ownerSeatId = input.ownerSeatId || record.ownerSeatId;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      if (
        input.lifecycleState &&
        input.lifecycleState !== record.lifecycleState &&
        !canTransitionFinancialSource(
          record.lifecycleState as any,
          input.lifecycleState,
        )
      )
        throw new EosRouteError(
          409,
          "financial_source_transition_invalid",
          `Financial source cannot move from ${record.lifecycleState} to ${input.lifecycleState}.`,
        );
      const merged = financialSourceCreateSchema.parse({
        ...record,
        ...input,
        ownerSeatId,
        freshnessAsOf:
          input.freshnessAsOf ||
          record.freshnessAsOf?.toISOString() ||
          undefined,
      });
      if (merged.evidenceIds.length)
        await assertFinanceReferences(access.company.id, {
          evidenceIds: merged.evidenceIds,
        });
      if (merged.reconciliationState === "reconciled") {
        const refs = await assertFinanceReferences(access.company.id, {
          evidenceIds: merged.evidenceIds,
        });
        if (
          !refs.evidence.some((item) =>
            ["verified"].includes(item.verificationState),
          )
        )
          throw new EosRouteError(
            409,
            "finance_reconciliation_evidence_required",
            "Reconciled financial sources require verified evidence.",
          );
      }
      const material = Boolean(
        input.lifecycleState || input.reconciliationState,
      );
      const policy = await authorizeAction(req, access, {
        authorityClass: material ? "decide" : "execute",
        resource: "financial_source",
        actionKey: material
          ? "financial_source.transition"
          : "financial_source.update",
        purpose: "govern_financial_source",
        classification: input.classification || record.classification,
        consequence: material ? "material" : "routine",
        targetSeatId: ownerSeatId,
      });
      const updates: any = { ...input, ownerSeatId, updatedAt: new Date() };
      delete updates.ownerSeatId;
      if (input.freshnessAsOf)
        updates.freshnessAsOf = new Date(input.freshnessAsOf);
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosFinancialSources)
          .set(updates)
          .where(
            and(
              eq(eosFinancialSources.id, record.id),
              eq(eosFinancialSources.lifecycleState, record.lifecycleState),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "financial_source_concurrent_change",
            "The financial source changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: material
            ? "financial_source.transitioned"
            : "financial_source.updated",
          targetType: "financial_source",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].lifecycleState,
          details: {
            from: record.lifecycleState,
            to: changed[0].lifecycleState,
            reconciliationState: changed[0].reconciliationState,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/financial-plans",
    route(async (req) => {
      const access = await companyAccess(req);
      assertFinanceSurface(access);
      const input = financialPlanCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const ownerSeatId = input.ownerSeatId || access.seat.id;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      await assertFinanceReferences(access.company.id, input);
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "financial_plan",
        actionKey: "financial_plan.create",
        purpose: "prepare_budget_forecast",
        classification: input.classification,
        consequence: "material",
        targetSeatId: ownerSeatId,
        amount: input.plannedAmount,
        currency: input.currency,
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        planKey: commandRecordKey("finance-plan", input.name, id),
        name: input.name,
        planType: input.planType,
        state: "draft",
        ownerSeatId,
        financialSourceId: input.financialSourceId || null,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        currency: input.currency,
        plannedAmount: String(input.plannedAmount),
        assumptions: input.assumptions,
        lineItems: input.lineItems,
        sourceValueFlowIds: input.sourceValueFlowIds,
        metricIds: input.metricIds,
        evidenceIds: input.evidenceIds,
        reconciliationState: "unreconciled",
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosFinancialPlans).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "financial_plan.created",
          targetType: "financial_plan",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "draft",
          details: {
            planKey: record.planKey,
            planType: record.planType,
            plannedAmount: record.plannedAmount,
            currency: record.currency,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/financial-plans/:planId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertFinanceSurface(access);
      const input = financialPlanUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosFinancialPlans)
        .where(
          and(
            eq(eosFinancialPlans.id, req.params.planId),
            eq(eosFinancialPlans.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "financial_plan_not_found",
          "Financial plan not found.",
        );
      assertMutableFinanceProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "financial_plan_not_found",
          "Financial plan not found.",
        );
      const ownerSeatId = input.ownerSeatId || record.ownerSeatId;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionFinancialPlan(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "financial_plan_transition_invalid",
          `Financial plan cannot move from ${record.state} to ${input.state}.`,
        );
      const artifactFields = Object.keys(input).filter(
        (key) => key !== "state",
      );
      if (
        ["approved", "active", "superseded", "archived"].includes(
          record.state,
        ) &&
        artifactFields.length
      )
        throw new EosRouteError(
          409,
          "approved_financial_plan_immutable",
          "Approved financial plan assumptions and amounts are immutable. Create a new plan or scenario instead.",
        );
      const merged: any = { ...record, ...input };
      if (
        input.state === "approved" &&
        (!Array.isArray(merged.assumptions) ||
          !merged.assumptions.length ||
          !Array.isArray(merged.lineItems) ||
          !merged.lineItems.length)
      )
        throw new EosRouteError(
          409,
          "financial_plan_artifact_incomplete",
          "Budget or forecast approval requires explicit assumptions and line items.",
        );
      await assertFinanceReferences(access.company.id, {
        financialSourceId: input.financialSourceId,
        metricIds: input.metricIds,
        evidenceIds: input.evidenceIds,
        sourceValueFlowIds: input.sourceValueFlowIds,
      });
      const material = Boolean(input.state);
      const authorityClass =
        input.state === "approved"
          ? "approve"
          : material
            ? "decide"
            : "execute";
      const policy = await authorizeAction(req, access, {
        authorityClass,
        resource: "financial_plan",
        actionKey: input.state
          ? "financial_plan.transition"
          : "financial_plan.update",
        purpose: "govern_budget_forecast",
        classification: input.classification || record.classification,
        consequence: material ? "material" : "routine",
        targetSeatId: ownerSeatId,
        amount: input.plannedAmount ?? Number(record.plannedAmount),
        currency: input.currency || record.currency,
      });
      const updates: any = { ...input, ownerSeatId, updatedAt: new Date() };
      delete updates.ownerSeatId;
      if (input.plannedAmount !== undefined)
        updates.plannedAmount = String(input.plannedAmount);
      if (input.periodStart) updates.periodStart = new Date(input.periodStart);
      if (input.periodEnd) updates.periodEnd = new Date(input.periodEnd);
      if (input.state === "approved") {
        updates.approvedByUserId = req.user.id;
        updates.approvedAt = new Date();
      }
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosFinancialPlans)
          .set(updates)
          .where(
            and(
              eq(eosFinancialPlans.id, record.id),
              eq(eosFinancialPlans.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "financial_plan_concurrent_change",
            "The financial plan changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: material
            ? "financial_plan.transitioned"
            : "financial_plan.updated",
          targetType: "financial_plan",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/financial-plans/:planId/reconcile",
    route(async (req) => {
      const access = await companyAccess(req);
      assertFinanceSurface(access);
      const input = financialPlanReconcileSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosFinancialPlans)
        .where(
          and(
            eq(eosFinancialPlans.id, req.params.planId),
            eq(eosFinancialPlans.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "financial_plan_not_found",
          "Financial plan not found.",
        );
      assertMutableFinanceProjection(record);
      if (!["approved", "active"].includes(record.state))
        throw new EosRouteError(
          409,
          "financial_plan_not_approved",
          "Only approved or active plans can be reconciled.",
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "financial_plan_not_found",
          "Financial plan not found.",
        );
      const refs = await assertFinanceReferences(access.company.id, input);
      if (
        refs.valueFlows.some(
          (item) =>
            !["invoice", "payment", "refund", "cost", "revenue"].includes(
              item.flowType,
            ) ||
            !["external_authoritative", "reconciled"].includes(
              item.sourceAuthority,
            ),
        )
      )
        throw new EosRouteError(
          409,
          "authoritative_financial_flow_required",
          "Plan reconciliation requires provider-authoritative or reconciled financial value flows.",
        );
      if (refs.valueFlows.some((item) => item.currency !== record.currency))
        throw new EosRouteError(
          409,
          "finance_currency_mismatch",
          "Every reconciled value flow must use the plan currency.",
        );
      if (
        !refs.evidence.some(
          (item) =>
            item.verificationState === "verified" &&
            [
              "financial_record",
              "provider_receipt",
              "external_verification",
              "review",
            ].includes(item.evidenceType),
        )
      )
        throw new EosRouteError(
          409,
          "finance_reconciliation_evidence_required",
          "Plan reconciliation requires verified financial or provider evidence.",
        );
      const actualAmount = input.actualAmount;
      const varianceAmount = actualAmount - Number(record.plannedAmount);
      const policy = await authorizeAction(req, access, {
        authorityClass: "approve",
        resource: "financial_plan",
        actionKey: "financial_plan.reconcile",
        purpose: "reconcile_financial_plan",
        classification: record.classification,
        consequence: "material",
        targetSeatId: record.ownerSeatId,
        amount: actualAmount,
        currency: record.currency,
      });
      const now = new Date();
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosFinancialPlans)
          .set({
            actualAmount: String(actualAmount),
            varianceAmount: String(varianceAmount),
            sourceValueFlowIds: input.sourceValueFlowIds,
            evidenceIds: input.evidenceIds,
            reconciliationState: "reconciled",
            reconciledAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(eosFinancialPlans.id, record.id),
              eq(
                eosFinancialPlans.reconciliationState,
                record.reconciliationState,
              ),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "financial_plan_concurrent_change",
            "The financial plan changed before reconciliation completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "financial_plan.reconciled",
          targetType: "financial_plan",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "reconciled",
          details: {
            plannedAmount: record.plannedAmount,
            actualAmount,
            varianceAmount,
            sourceValueFlowIds: input.sourceValueFlowIds,
            evidenceIds: input.evidenceIds,
            calculationNote: input.note,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/capital-allocations",
    route(async (req) => {
      const access = await companyAccess(req);
      assertFinanceSurface(access);
      const input = capitalAllocationCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const ownerSeatId = input.ownerSeatId || access.seat.id;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      const refs = await assertFinanceReferences(access.company.id, input);
      if (!refs.plan || !["approved", "active"].includes(refs.plan.state))
        throw new EosRouteError(
          409,
          "allocation_plan_not_approved",
          "Capital allocation requires an approved or active financial plan.",
        );
      if (refs.plan.currency !== input.currency)
        throw new EosRouteError(
          409,
          "finance_currency_mismatch",
          "Allocation and plan currencies must match.",
        );
      const committed = await db
        .select({ amount: eosCapitalAllocations.amount })
        .from(eosCapitalAllocations)
        .where(
          and(
            eq(eosCapitalAllocations.companyId, access.company.id),
            eq(eosCapitalAllocations.financialPlanId, input.financialPlanId),
            inArray(eosCapitalAllocations.state, [
              "proposed",
              "under_review",
              "approved",
              "committed",
              "deployed",
              "measuring",
              "realized",
            ]),
          ),
        );
      if (
        committed.reduce((sum, item) => sum + Number(item.amount), 0) +
          input.amount >
        Number(refs.plan.plannedAmount)
      )
        throw new EosRouteError(
          409,
          "allocation_exceeds_plan",
          "Allocation would exceed the approved plan amount.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "recommend",
        resource: "capital_allocation",
        actionKey: "capital_allocation.propose",
        purpose: "model_capital_allocation",
        classification: input.classification,
        consequence: "material",
        targetSeatId: ownerSeatId,
        amount: input.amount,
        currency: input.currency,
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        allocationKey: commandRecordKey("allocation", input.name, id),
        name: input.name,
        allocationType: input.allocationType,
        state: "proposed",
        ownerSeatId,
        financialPlanId: input.financialPlanId,
        targetType: input.targetType,
        targetKey: input.targetKey,
        amount: String(input.amount),
        currency: input.currency,
        rationale: input.rationale,
        alternatives: input.alternatives,
        expectedOutcome: input.expectedOutcome,
        downsideRisk: input.downsideRisk,
        workPacketId: input.workPacketId || null,
        metricIds: input.metricIds,
        evidenceIds: input.evidenceIds,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosCapitalAllocations).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "capital_allocation.proposed",
          targetType: "capital_allocation",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "proposed",
          details: {
            allocationKey: record.allocationKey,
            amount: record.amount,
            currency: record.currency,
            financialPlanId: record.financialPlanId,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/capital-allocations/:allocationId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertFinanceSurface(access);
      const input = capitalAllocationUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosCapitalAllocations)
        .where(
          and(
            eq(eosCapitalAllocations.id, req.params.allocationId),
            eq(eosCapitalAllocations.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "capital_allocation_not_found",
          "Capital allocation not found.",
        );
      assertMutableFinanceProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "capital_allocation_not_found",
          "Capital allocation not found.",
        );
      const ownerSeatId = input.ownerSeatId || record.ownerSeatId;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionCapitalAllocation(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "capital_allocation_transition_invalid",
          `Capital allocation cannot move from ${record.state} to ${input.state}.`,
        );
      const artifactFields = Object.keys(input).filter(
        (key) => key !== "state",
      );
      if (
        [
          "approved",
          "committed",
          "deployed",
          "measuring",
          "realized",
          "rejected",
          "cancelled",
        ].includes(record.state) &&
        artifactFields.length
      )
        throw new EosRouteError(
          409,
          "decided_allocation_immutable",
          "Decided capital allocations are immutable; create a new proposal for changed terms.",
        );
      const refs = await assertFinanceReferences(access.company.id, {
        financialPlanId: input.financialPlanId,
        workPacketId: input.workPacketId || record.workPacketId || undefined,
        metricIds: input.metricIds,
        evidenceIds: input.evidenceIds,
      });
      const targetState = input.state || record.state;
      if (targetState === "approved") {
        if (!refs.workPacket || refs.workPacket.status !== "ready")
          throw new EosRouteError(
            409,
            "allocation_approval_required",
            "Allocation approval requires a linked Work Packet whose approval has made it ready.",
          );
      }
      if (["deployed", "measuring", "realized"].includes(targetState)) {
        const evidenceIds =
          input.evidenceIds ||
          (Array.isArray(record.evidenceIds)
            ? (record.evidenceIds as string[])
            : []);
        const evidenceRefs = await assertFinanceReferences(access.company.id, {
          evidenceIds,
        });
        if (
          !evidenceRefs.evidence.some(
            (item) =>
              item.verificationState === "verified" &&
              [
                "financial_record",
                "provider_receipt",
                "external_verification",
              ].includes(item.evidenceType),
          )
        )
          throw new EosRouteError(
            409,
            "allocation_deployment_evidence_required",
            "Deployed capital requires verified provider or financial evidence; EOS does not infer movement of funds.",
          );
      }
      const authorityClass =
        targetState === "approved"
          ? "approve"
          : ["committed", "deployed"].includes(targetState)
            ? "spend"
            : input.state
              ? "decide"
              : "execute";
      const policy = await authorizeAction(req, access, {
        authorityClass,
        resource: "capital_allocation",
        actionKey: input.state
          ? "capital_allocation.transition"
          : "capital_allocation.update",
        purpose: "govern_capital_allocation",
        classification: input.classification || record.classification,
        consequence: input.state ? "material" : "routine",
        targetSeatId: ownerSeatId,
        amount: input.amount ?? Number(record.amount),
        currency: input.currency || record.currency,
      });
      const updates: any = { ...input, ownerSeatId, updatedAt: new Date() };
      delete updates.ownerSeatId;
      if (input.amount !== undefined) updates.amount = String(input.amount);
      if (targetState === "approved") {
        updates.approvedByUserId = req.user.id;
        updates.approvedAt = new Date();
      }
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosCapitalAllocations)
          .set(updates)
          .where(
            and(
              eq(eosCapitalAllocations.id, record.id),
              eq(eosCapitalAllocations.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "capital_allocation_concurrent_change",
            "The capital allocation changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state
            ? "capital_allocation.transitioned"
            : "capital_allocation.updated",
          targetType: "capital_allocation",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            amount: changed[0].amount,
            currency: changed[0].currency,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/manifests",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!allowedSurfacesFor(access.role).includes("organization"))
        throw new EosRouteError(
          403,
          "manifest_scope_denied",
          "Organization manifests are outside this seat's visibility scope.",
        );
      const records = await db
        .select()
        .from(eosManifestVersions)
        .where(eq(eosManifestVersions.companyId, access.company.id))
        .orderBy(desc(eosManifestVersions.version));
      return {
        body: records.map((record) => manifestProjection(record, access.role)),
      };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/reference-packages",
    route(async (req) => {
      const access = await companyAccess(req);
      if (access.role !== "founder")
        throw new EosRouteError(
          403,
          "reference_package_denied",
          "Only the founder may inspect installable company packages.",
        );
      const latestManifest = await db.query.eosManifestVersions.findFirst({
        where: eq(eosManifestVersions.companyId, access.company.id),
        orderBy: [desc(eosManifestVersions.version)],
      });
      const manifest = latestManifest?.manifest as
        | { packageSelections?: unknown }
        | undefined;
      const packageSelections = Array.isArray(manifest?.packageSelections)
        ? manifest.packageSelections
        : [];
      return {
        body: applicableCompanyPackages(access.company.name).map(
          ({ package: packageDefinition }) => ({
            packageKey: packageDefinition.packageKey,
            packageVersion: packageDefinition.packageVersion,
            organizationKey: packageDefinition.companyManifest.value.orgKey,
            operatingName:
              packageDefinition.companyManifest.value.operatingName,
            lifecycleStage:
              packageDefinition.companyManifest.value.lifecycleStage,
            activationState:
              packageDefinition.lifecycleActivationMap.value.requestedState,
            activationBlockers:
              packageDefinition.lifecycleActivationMap.value.activationGates,
            capabilityCount:
              packageDefinition.capabilityManifest.value.length,
            providerBindingCount:
              packageDefinition.providerBindingDeclarations.value.length,
            sourceBindingCount:
              getRegisteredCompanyPackage(packageDefinition.packageKey)
                ?.sourceBindings.length || 0,
            sourceEffectiveAt: packageDefinition.metadata.effectiveAt,
            installed: packageSelections.some(
              (selection) =>
                selection &&
                typeof selection === "object" &&
                (selection as { id?: unknown }).id ===
                  packageDefinition.packageKey &&
                (selection as { version?: unknown }).version ===
                  packageDefinition.packageVersion,
            ),
          }),
        ),
      };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/company-packages/:packageKey/sources",
    route(async (req) => {
      const access = await companyAccess(req);
      if (access.role !== "founder")
        throw new EosRouteError(403, "company_source_denied", "Only the founder may inspect company-package source bindings.");
      const registration = applicableCompanyPackages(access.company.name)
        .find((candidate) => candidate.package.packageKey === req.params.packageKey);
      if (!registration)
        throw new EosRouteError(404, "company_package_not_found", "The selected company package is not bound to this company.");
      return {
        body: registration.sourceBindings.map((binding) => ({
          sourceKey: binding.sourceKey,
          pageClass: binding.pageClass,
          sourceRef: binding.sourceRef,
          expectedRevision: binding.expectedRevision,
          precedence: binding.precedence,
          maxAgeDays: binding.maxAgeDays,
          classification: binding.classification,
          importAuthority: binding.importAuthority,
        })),
      };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/company-packages/:packageKey/sources/:sourceKey/snapshot",
    route(async (req) => {
      const access = await companyAccess(req);
      if (access.role !== "founder")
        throw new EosRouteError(403, "company_source_denied", "Only the founder may read a governed company-package source snapshot.");
      const registration = applicableCompanyPackages(access.company.name)
        .find((candidate) => candidate.package.packageKey === req.params.packageKey);
      if (!registration)
        throw new EosRouteError(404, "company_package_not_found", "The selected company package is not bound to this company.");
      const binding = registration.sourceBindings.find((source) => source.sourceKey === req.params.sourceKey);
      if (!binding)
        throw new EosRouteError(404, "company_source_not_found", "The selected source is not declared by this company package.");
      try {
        return { body: await captureNotionCompanySource(req.user.id, binding) };
      } catch (error) {
        if (error instanceof CompanySourceAdapterError)
          throw new EosRouteError(409, error.code, error.message);
        throw new EosRouteError(502, "company_source_provider_failed", error instanceof Error ? error.message : "Notion source read failed.");
      }
    }),
  );

  const compileCompanyPackageForRequest = async (
    req: Request,
    packageKey: string,
    confirmOrganizationKey: string,
  ) => {
    const access = await companyAccess(req);
    if (access.role !== "founder")
      throw new EosRouteError(
        403,
        "reference_package_denied",
        "Only the founder may compile a company package.",
      );
    await authorizeAction(req, access, {
      authorityClass: "decide",
      resource: "organization_manifest",
      actionKey: "company_package.compile",
      purpose: "compile_company_package",
      classification: "restricted",
      consequence: "material",
    });
    try {
      const result = await db.transaction((tx) =>
        compileRegisteredCompanyPackage(tx, {
          packageKey,
          confirmOrganizationKey,
          companyId: access.company.id,
          actorUserId: req.user.id,
          actorName: req.user.fullName || req.user.username || "Founder",
        }),
      );
      return {
        status: result.created ? 201 : 200,
        body: result,
      };
    } catch (error) {
      if (error instanceof CompanyCompilationError)
        throw new EosRouteError(
          ["company_package_not_found", "company_not_found"].includes(
            error.code,
          )
            ? 404
            : 409,
          error.code,
          error.findings.length
            ? `${error.message} ${error.findings
                .map((finding) => `${finding.path}: ${finding.message}`)
                .join("; ")}`
            : error.message,
        );
      if (error instanceof EmpyreanCompilationError)
        throw new EosRouteError(
          error.code === "company_not_found" ? 404 : 409,
          error.code,
          error.message,
        );
      if (error instanceof DeclarativeMaterializationError)
        throw new EosRouteError(
          error.code === "company_not_found" ? 404 : 409,
          error.code,
          error.message,
        );
      throw error;
    }
  };

  app.post(
    "/api/eos/companies/:companyId/company-packages/:packageKey/compile",
    route(async (req) => {
      const input = z
        .object({
          confirmOrganizationKey: z.string().trim().min(3).max(160),
        })
        .strict()
        .parse(req.body);
      return compileCompanyPackageForRequest(
        req,
        req.params.packageKey,
        input.confirmOrganizationKey,
      );
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/reference-packages/empyrean-studios/compile",
    route(async (req) => {
      const input = z
        .object({
          confirmCompanyKey: z.literal(
            EMPYREAN_REFERENCE_PACKAGE.organizationKey,
          ),
        })
        .strict()
        .parse(req.body);
      return compileCompanyPackageForRequest(
        req,
        EMPYREAN_REFERENCE_PACKAGE.key,
        input.confirmCompanyKey,
      );
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/compiler/drafts",
    route(async (req) => {
      const access = await companyAccess(req);
      const { company } = access;
      if (!mayManageOrganization(access.role))
        throw new EosRouteError(
          403,
          "compiler_denied",
          "Only the founder or Company CEO may compile the organization.",
        );
      await authorizeAction(req, access, {
        authorityClass: "decide",
        resource: "organization_manifest",
        actionKey: "manifest.compile",
        purpose: "compile_organization",
        classification: "restricted",
        consequence: "material",
      });
      const manifest = manifestInputSchema.parse(req.body);
      const latest = await db.query.eosManifestVersions.findFirst({
        where: eq(eosManifestVersions.companyId, company.id),
        orderBy: [desc(eosManifestVersions.version)],
      });
      const record = {
        id: randomUUID(),
        companyId: company.id,
        version: (latest?.version || 0) + 1,
        status: "draft",
        manifest: {
          ...manifest,
          advisorCouncil: buildAdvisorCouncil({
            founderName: req.user.fullName || req.user.username,
            companyName: company.name,
            founderProfile: manifest.founderProfile,
            companyGoals: manifest.goals.join("\n"),
          }),
          compiledFrom: { companyId: company.id, companyName: company.name },
          schemaVersion: "eos.organization-manifest.v1",
        },
        createdByUserId: req.user.id,
        createdAt: new Date(),
      };
      const { traceId, correlationId } = tracePair();
      await db.transaction(async (tx) => {
        await tx.insert(eosManifestVersions).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: company.id,
          actorUserId: req.user.id,
          action: "manifest.compiled",
          targetType: "organization_manifest",
          targetId: record.id,
          traceId,
          correlationId,
          result: "draft_created",
          details: { version: record.version },
          createdAt: new Date(),
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/manifests/:manifestId/activate",
    route(async (req) => {
      const access = await companyAccess(req);
      const { company } = access;
      if (!mayManageOrganization(access.role))
        throw new EosRouteError(
          403,
          "manifest_activation_denied",
          "This seat cannot activate an organization manifest.",
        );
      const target = await db.query.eosManifestVersions.findFirst({
        where: and(
          eq(eosManifestVersions.id, req.params.manifestId),
          eq(eosManifestVersions.companyId, company.id),
        ),
      });
      if (!target)
        throw new EosRouteError(
          404,
          "manifest_not_found",
          "Manifest not found in this company.",
        );
      await authorizeAction(req, access, {
        authorityClass: "approve",
        resource: "organization_manifest",
        actionKey: "manifest.activate",
        purpose: "activate_organization",
        classification: "restricted",
        consequence: "irreversible",
        participants: {
          initiator: {
            principalKey: target.createdByUserId,
            seatId: access.seat.id,
          },
        },
      });
      if (target.status === "active") return { body: target };
      if (target.status !== "verifying")
        throw new EosRouteError(
          409,
          "manifest_not_activatable",
          "A manifest must complete review, provisioning, and verification before activation.",
        );
      manifestInputSchema.parse(target.manifest);
      const manifest = target.manifest as any;
      if (
        (manifest.provisioningChecklist || []).some(
          (item: any) => item.required && !item.complete,
        )
      )
        throw new EosRouteError(
          409,
          "provisioning_incomplete",
          "Every required provisioning item must be complete.",
        );
      if (
        !(manifest.verificationChecks || []).length ||
        (manifest.verificationChecks || []).some(
          (item: any) => item.status !== "passed",
        )
      )
        throw new EosRouteError(
          409,
          "verification_incomplete",
          "Every verification check must pass before activation.",
        );
      const now = new Date();
      const { traceId, correlationId } = tracePair();
      let activated: typeof target | undefined;
      await db.transaction(async (tx) => {
        await tx
          .update(eosManifestVersions)
          .set({ status: "superseded" })
          .where(
            and(
              eq(eosManifestVersions.companyId, company.id),
              eq(eosManifestVersions.status, "active"),
            ),
          );
        [activated] = await tx
          .update(eosManifestVersions)
          .set({
            status: "active",
            approvedByUserId: req.user.id,
            activatedAt: now,
          })
          .where(
            and(
              eq(eosManifestVersions.id, target.id),
              eq(eosManifestVersions.status, "verifying"),
            ),
          )
          .returning();
        if (!activated)
          throw new EosRouteError(
            409,
            "manifest_activation_conflict",
            "Manifest changed before it could be activated.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: company.id,
          actorUserId: req.user.id,
          action: "manifest.activated",
          targetType: "organization_manifest",
          targetId: target.id,
          traceId,
          correlationId,
          result: "activated",
          details: { version: target.version },
          createdAt: now,
        });
      });
      return { body: activated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/manifests/:manifestId/transition",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!mayManageOrganization(access.role))
        throw new EosRouteError(
          403,
          "manifest_transition_denied",
          "This seat cannot advance the organization compiler.",
        );
      await authorizeAction(req, access, {
        authorityClass: "decide",
        resource: "organization_manifest",
        actionKey: "manifest.transition",
        purpose: "advance_organization_lifecycle",
        classification: "restricted",
        consequence: "material",
      });
      const input = z
        .object({
          status: z.string(),
          manifest: manifestInputSchema.optional(),
          reason: z.string().max(2000).optional(),
        })
        .parse(req.body);
      const target = await db.query.eosManifestVersions.findFirst({
        where: and(
          eq(eosManifestVersions.id, req.params.manifestId),
          eq(eosManifestVersions.companyId, access.company.id),
        ),
      });
      if (!target)
        throw new EosRouteError(
          404,
          "manifest_not_found",
          "Manifest not found in this company.",
        );
      if (!canTransitionManifest(target.status, input.status))
        throw new EosRouteError(
          409,
          "invalid_manifest_transition",
          `Manifest cannot transition from ${target.status} to ${input.status}.`,
        );
      const nextManifest =
        input.manifest || manifestInputSchema.parse(target.manifest);
      if (input.status === "proposed" && !nextManifest.sourceAssertions.length)
        throw new EosRouteError(
          409,
          "source_assertions_required",
          "At least one sourced fact, claim, inference, or user assertion is required before proposal.",
        );
      if (
        input.status === "verifying" &&
        nextManifest.provisioningChecklist.some(
          (item) => item.required && !item.complete,
        )
      )
        throw new EosRouteError(
          409,
          "provisioning_incomplete",
          "Complete required provisioning before verification.",
        );
      const { traceId, correlationId } = tracePair();
      const [updated] = await db
        .update(eosManifestVersions)
        .set({ status: input.status, manifest: nextManifest })
        .where(
          and(
            eq(eosManifestVersions.id, target.id),
            eq(eosManifestVersions.status, target.status),
          ),
        )
        .returning();
      if (!updated)
        throw new EosRouteError(
          409,
          "manifest_transition_conflict",
          "Manifest changed before the transition was applied.",
        );
      await db.insert(eosAuditRecords).values({
        id: randomUUID(),
        companyId: access.company.id,
        actorUserId: req.user.id,
        action: "manifest.transitioned",
        targetType: "organization_manifest",
        targetId: target.id,
        traceId,
        correlationId,
        result: input.status,
        details: {
          from: target.status,
          to: input.status,
          reason: input.reason || null,
        },
      });
      return { body: updated };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/work-packets",
    route(async (req) => {
      const access = await companyAccess(req);
      await authorizeAction(req, access, {
        authorityClass: "view",
        resource: "work_packet",
        actionKey: "work_packet.list",
        purpose: "operate_assigned_work",
        classification: z
          .enum(policyDataClassifications)
          .parse(access.classificationCeiling),
      });
      const { company } = access;
      const status =
        typeof req.query.status === "string" ? req.query.status : undefined;
      const where = status
        ? and(
            eq(eosWorkPackets.companyId, company.id),
            eq(eosWorkPackets.status, status),
          )
        : eq(eosWorkPackets.companyId, company.id);
      const records = await db
        .select()
        .from(eosWorkPackets)
        .where(where)
        .orderBy(desc(eosWorkPackets.createdAt));
      const visible = await visibleSeatIds(
        company.id,
        access.seat.id,
        access.role,
      );
      return {
        body: records.filter(
          (packet) =>
            mayAccessClassification(access, packet.classification) &&
            (access.isOwner ||
              (packet.accountableSeatId &&
                visible.has(packet.accountableSeatId))),
        ),
      };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/work-packets",
    route(async (req) => {
      const access = await companyAccess(req);
      const { company } = access;
      const input = workPacketCreateSchema.parse(req.body);
      await assertOperationsReferences(company.id, {
        capabilityInstanceId: input.capabilityInstanceId,
        processDefinitionId: input.processDefinitionId,
        resourceIds: input.resourceIds,
      });
      await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "work_packet",
        actionKey: "work_packet.create",
        purpose: "create_governed_work",
        classification: input.classification,
        consequence: input.requiresApproval ? "material" : "routine",
        targetSeatId: input.accountableSeatId || access.seat.id,
      });
      if (!mayAccessClassification(access, input.classification))
        throw new EosRouteError(
          403,
          "classification_ceiling_exceeded",
          "This seat cannot create work above its classification ceiling.",
        );
      const accountableSeatId = input.accountableSeatId || access.seat.id;
      const visible = await visibleSeatIds(
        company.id,
        access.seat.id,
        access.role,
      );
      if (!visible.has(accountableSeatId))
        throw new EosRouteError(
          403,
          "accountable_seat_denied",
          "This seat cannot assign work outside its authorized reporting scope.",
        );
      const accountableSeat = await db.query.eosSeats.findFirst({
        where: and(
          eq(eosSeats.id, accountableSeatId),
          eq(eosSeats.companyId, company.id),
        ),
      });
      if (!accountableSeat)
        throw new EosRouteError(
          400,
          "invalid_accountable_seat",
          "Work must be assigned to an active company seat.",
        );
      const now = new Date();
      const id = randomUUID();
      const { traceId, correlationId } = tracePair();
      const status = input.requiresApproval ? "awaiting_approval" : "ready";
      let approvalId: string | undefined;
      const approver = await approverFor(
        company,
        access.seat,
        input.classification,
      );
      await db.transaction(async (tx) => {
        await tx.insert(eosWorkPackets).values({
          id,
          companyId: company.id,
          createdByUserId: req.user.id,
          accountableUserId: req.user.id,
          accountableSeatId,
          title: input.title,
          objective: input.objective,
          status,
          priority: input.priority,
          source: input.source,
          visibility: input.visibility,
          classification: input.classification,
          requiresApproval: input.requiresApproval,
          toolPack: input.toolPack,
          evidenceRequirements: input.evidenceRequirements,
          capabilityInstanceId: input.capabilityInstanceId || null,
          processDefinitionId: input.processDefinitionId || null,
          resourceIds: input.resourceIds,
          expectedOutput: input.expectedOutput,
          acceptanceCriteria: input.acceptanceCriteria,
          constraintsPolicies: input.constraintsPolicies,
          failureEscalationCompensation: input.failureEscalationCompensation,
          humanFallback: input.humanFallback,
          sourceLineage: input.sourceLineage,
          outputArtifactKeys: input.outputArtifactKeys,
          traceId,
          correlationId,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          createdAt: now,
          updatedAt: now,
        });
        if (input.requiresApproval) {
          approvalId = randomUUID();
          await tx.insert(eosApprovalRequests).values({
            id: approvalId,
            companyId: company.id,
            workPacketId: id,
            requestedByUserId: req.user.id,
            assignedToUserId: approver.userId,
            assignedToSeatId: approver.seatId,
            summary: `Authorize work packet: ${input.title}`,
            status: "pending",
            createdAt: now,
          });
        }
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: company.id,
          actorUserId: req.user.id,
          action: "work_packet.created",
          targetType: "work_packet",
          targetId: id,
          traceId,
          correlationId,
          result: status,
          details: { approvalId: approvalId || null },
          createdAt: now,
        });
      });
      const created = await db.query.eosWorkPackets.findFirst({
        where: eq(eosWorkPackets.id, id),
      });
      return {
        status: 201,
        body: { ...created, approvalId: approvalId || null },
      };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/work-packets/:workPacketId/transition",
    route(async (req) => {
      const access = await companyAccess(req);
      const { company } = access;
      const input = workPacketTransitionSchema.parse(req.body);
      const packet = await db.query.eosWorkPackets.findFirst({
        where: and(
          eq(eosWorkPackets.id, req.params.workPacketId),
          eq(eosWorkPackets.companyId, company.id),
        ),
      });
      if (!packet)
        throw new EosRouteError(
          404,
          "work_packet_not_found",
          "Work packet not found in this company.",
        );
      await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "work_packet",
        actionKey: `work_packet.transition.${input.status}`,
        purpose: "advance_governed_work",
        classification: packet.classification,
        consequence: input.status === "completed" ? "material" : "routine",
        targetSeatId: packet.accountableSeatId || access.seat.id,
      });
      const visible = await visibleSeatIds(
        company.id,
        access.seat.id,
        access.role,
      );
      if (
        !mayAccessClassification(access, packet.classification) ||
        (!access.isOwner &&
          (!packet.accountableSeatId || !visible.has(packet.accountableSeatId)))
      )
        throw new EosRouteError(
          404,
          "work_packet_not_found",
          "Work packet not found in this seat's authority scope.",
        );
      if (!canTransitionWorkPacket(packet.status, input.status))
        throw new EosRouteError(
          409,
          "invalid_transition",
          `Work packet cannot transition from ${packet.status} to ${input.status}.`,
        );
      if (input.status === "completed") {
        const evidence = await db
          .select()
          .from(eosEvidence)
          .where(
            and(
              eq(eosEvidence.companyId, company.id),
              eq(eosEvidence.workPacketId, packet.id),
            ),
          );
        const required = Array.isArray(packet.evidenceRequirements)
          ? (packet.evidenceRequirements as string[])
          : [];
        if (
          !evidence.length ||
          required.some(
            (requirement) =>
              !evidence.some(
                (item) =>
                  item.title.trim().toLowerCase() ===
                  requirement.trim().toLowerCase(),
              ),
          )
        )
          throw new EosRouteError(
            409,
            "evidence_required",
            "Every named evidence requirement must be recorded before completion.",
          );
      }
      const now = new Date();
      const updates: Record<string, unknown> = {
        status: input.status,
        updatedAt: now,
      };
      if (input.status === "in_progress" && !packet.startedAt)
        updates.startedAt = now;
      if (input.status === "completed") updates.completedAt = now;
      const { traceId, correlationId } = tracePair();
      let updated: typeof packet | undefined;
      await db.transaction(async (tx) => {
        [updated] = await tx
          .update(eosWorkPackets)
          .set(updates)
          .where(
            and(
              eq(eosWorkPackets.id, packet.id),
              eq(eosWorkPackets.status, packet.status),
            ),
          )
          .returning();
        if (!updated)
          throw new EosRouteError(
            409,
            "transition_conflict",
            "Work packet changed before the transition was applied.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: company.id,
          actorUserId: req.user.id,
          action: "work_packet.transitioned",
          targetType: "work_packet",
          targetId: packet.id,
          traceId,
          correlationId,
          result: input.status,
          details: {
            from: packet.status,
            to: input.status,
            reason: input.reason || null,
          },
          createdAt: now,
        });
      });
      return { body: updated };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/approvals",
    route(async (req) => {
      const access = await companyAccess(req);
      await authorizeAction(req, access, {
        authorityClass: "view",
        resource: "approval",
        actionKey: "approval.list",
        purpose: "review_assigned_decisions",
        classification: activeClassificationCeiling(access),
      });
      const [records, packets] = await Promise.all([
        db
          .select()
          .from(eosApprovalRequests)
          .where(eq(eosApprovalRequests.companyId, access.company.id))
          .orderBy(desc(eosApprovalRequests.createdAt)),
        db
          .select({
            id: eosWorkPackets.id,
            classification: eosWorkPackets.classification,
          })
          .from(eosWorkPackets)
          .where(eq(eosWorkPackets.companyId, access.company.id)),
      ]);
      const classificationByPacket = new Map(
        packets.map((packet) => [packet.id, packet.classification]),
      );
      return {
        body: records.filter(
          (approval) =>
            mayAccessClassification(
              access,
              classificationByPacket.get(approval.workPacketId) || "restricted",
            ) &&
            (approval.assignedToUserId === req.user.id ||
              (access.isOwner && approval.status !== "pending")),
        ),
      };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/provider-executions",
    route(async (req) => {
      const access = await companyAccess(req);
      await authorizeAction(req, access, {
        authorityClass: "view",
        resource: "provider_execution",
        actionKey: "provider_execution.list",
        purpose: "review_provider_effects",
        classification: activeClassificationCeiling(access),
      });
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const [records, packets] = await Promise.all([
        db
          .select()
          .from(eosProviderExecutions)
          .where(eq(eosProviderExecutions.companyId, access.company.id))
          .orderBy(desc(eosProviderExecutions.createdAt)),
        db
          .select()
          .from(eosWorkPackets)
          .where(eq(eosWorkPackets.companyId, access.company.id)),
      ]);
      const visiblePackets = new Set(
        packets
          .filter(
            (packet) =>
              mayAccessClassification(access, packet.classification) &&
              (access.isOwner ||
                (packet.accountableSeatId &&
                  visible.has(packet.accountableSeatId))),
          )
          .map((packet) => packet.id),
      );
      return {
        body: records.filter((record) =>
          visiblePackets.has(record.workPacketId),
        ),
      };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/provider-executions/:executionId/retry",
    route(async (req) => {
      const access = await companyAccess(req);
      const execution = await db.query.eosProviderExecutions.findFirst({
        where: and(
          eq(eosProviderExecutions.id, req.params.executionId),
          eq(eosProviderExecutions.companyId, access.company.id),
        ),
      });
      if (!execution || !isRecoveryProviderOperation(execution.operation))
        throw new EosRouteError(404, "provider_execution_not_found", "Recovery provider execution was not found in this authority scope.");
      const packet = await db.query.eosWorkPackets.findFirst({
        where: and(
          eq(eosWorkPackets.id, execution.workPacketId),
          eq(eosWorkPackets.companyId, access.company.id),
        ),
      });
      if (!packet || !mayAccessClassification(access, packet.classification))
        throw new EosRouteError(404, "provider_execution_not_found", "Recovery provider execution was not found in this authority scope.");
      if (execution.status !== "failed")
        throw new EosRouteError(409, "provider_execution_not_retryable", "Only a failed Recovery provider execution can be retried.");
      if (!access.isOwner && execution.requestedByUserId !== req.user.id)
        throw new EosRouteError(403, "provider_execution_retry_forbidden", "Only the original requester or company owner may retry this approved effect.");
      const approval = execution.approvalId
        ? await db.query.eosApprovalRequests.findFirst({
            where: and(
              eq(eosApprovalRequests.id, execution.approvalId),
              eq(eosApprovalRequests.companyId, access.company.id),
              eq(eosApprovalRequests.status, "approved"),
            ),
          })
        : undefined;
      if (!approval)
        throw new EosRouteError(409, "provider_execution_approval_required", "The original approved decision is not available for retry.");
      await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "provider_execution",
        actionKey: execution.operation,
        purpose: "retry_approved_provider_effect",
        classification: packet.classification,
        consequence: "material",
        providerKey: execution.provider,
        toolKey: execution.operation,
        targetSeatId: packet.accountableSeatId || access.seat.id,
        approvals: [{
          approvalId: approval.id,
          decision: "approved",
          approverPrincipalKey: approval.decidedByUserId || approval.assignedToUserId,
          approverSeatId: approval.assignedToSeatId || access.seat.id,
          authorityClasses: ["approve"],
          decidedAt: approval.decidedAt?.toISOString() || new Date().toISOString(),
        }],
      });
      try {
        const updated = await executeApprovedRecoveryProviderExecution({
          execution,
          companyId: access.company.id,
          actorUserId: req.user.id,
        });
        return { body: updated };
      } catch {
        await db.update(eosProviderExecutions).set({
          status: "failed",
          reconciliationStatus: "failed",
          failureCode: "provider_retry_failed",
          receipt: { message: "Recovery provider retry or local reconciliation failed." },
          updatedAt: new Date(),
        }).where(eq(eosProviderExecutions.id, execution.id));
        throw new EosRouteError(502, "provider_retry_failed", "The approved effect could not be safely retried; its idempotency key was preserved and the Work Packet remains blocked.");
      }
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/work-packets/:workPacketId/provider-executions",
    route(async (req) => {
      const access = await companyAccess(req);
      const input = providerExecutionCreateSchema.parse(req.body);
      const packet = await db.query.eosWorkPackets.findFirst({
        where: and(
          eq(eosWorkPackets.id, req.params.workPacketId),
          eq(eosWorkPackets.companyId, access.company.id),
        ),
      });
      if (!packet)
        throw new EosRouteError(
          404,
          "work_packet_not_found",
          "Provider execution must reference a visible Work Packet.",
        );
      const calendarOperation = input.operation.startsWith("google.calendar.");
      const recoveryOperation = isRecoveryProviderOperation(input.operation);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !mayAccessClassification(access, packet.classification) ||
        (!access.isOwner &&
          (!packet.accountableSeatId || !visible.has(packet.accountableSeatId)))
      )
        throw new EosRouteError(
          404,
          "work_packet_not_found",
          "Provider execution must reference a visible Work Packet.",
        );
      const requestPolicyDecision = await authorizeAction(
        req,
        access,
        {
          authorityClass: "execute",
          resource: "provider_execution",
          actionKey: "provider_execution.request",
          purpose: "request_approved_provider_effect",
          classification: packet.classification,
          consequence: "material",
          providerKey: input.provider,
          toolKey: input.operation,
          targetSeatId: packet.accountableSeatId || access.seat.id,
        },
        ["permit", "require_approval"],
      );
      if (!recoveryOperation && !gmail.isConfigured())
        throw new EosRouteError(
          409,
          "google_workspace_not_configured",
          "The Google Workspace adapter is not configured in this deployment.",
        );
      if (!recoveryOperation && !(await gmail.isConnected(req.user.id)))
        throw new EosRouteError(
          409,
          "google_workspace_not_connected",
          "Connect Google Workspace before requesting a provider effect.",
        );
      if (
        !recoveryOperation &&
        calendarOperation &&
        !(await gmail.isCalendarWriteConnected(req.user.id))
      )
        throw new EosRouteError(
          409,
          "google_calendar_write_not_authorized",
          "Reconnect Google Workspace and authorize Calendar event access before requesting a booking.",
        );
      let approvalSummary: string;
      let storedRequest: Record<string, unknown>;
      let idempotencyKey: string = randomUUID();
      if (recoveryOperation) {
        if (!recoveryCommercialEffectsConfigured())
          throw new EosRouteError(
            409,
            "recovery_provider_effects_disabled",
            "Recovery provider effects are not enabled with managed execution credentials in this deployment.",
          );
        if (input.provider === "stripe" && "billingManifestId" in input) {
          const [billing] = await db
            .select()
            .from(eosRecoveryBillingManifests)
            .where(and(
              eq(eosRecoveryBillingManifests.id, input.billingManifestId),
              eq(eosRecoveryBillingManifests.companyId, access.company.id),
              eq(eosRecoveryBillingManifests.workPacketId, packet.id),
            ));
          if (!billing)
            throw new EosRouteError(404, "recovery_billing_not_found", "The Recovery billing manifest was not found in this Work Packet.");
          const [agreement, binding] = await Promise.all([
            db.query.eosRecoveryAgreementInstances.findFirst({ where: and(eq(eosRecoveryAgreementInstances.id, billing.agreementInstanceId), eq(eosRecoveryAgreementInstances.companyId, access.company.id)) }),
            billing.stripeBindingId
              ? db.query.eosIntegrationBindings.findFirst({ where: and(eq(eosIntegrationBindings.id, billing.stripeBindingId), eq(eosIntegrationBindings.companyId, access.company.id)) })
              : undefined,
          ]);
          if (!agreement || !binding || binding.providerKey !== "stripe")
            throw new EosRouteError(409, "recovery_stripe_binding_required", "The exact Stripe Integration Binding is not available.");
          const option = "timing" in input ? input.timing : "reason" in input ? input.reason : "issue";
          idempotencyKey = recoveryProviderIdempotencyKey({ companyId: access.company.id, operation: input.operation, targetId: billing.id, targetVersion: billing.version, option });
          if (input.operation === "stripe.create_recovery_checkout_with_local_approval") {
            if (billing.state !== "checkout_eligible" || billing.providerCheckoutReference)
              throw new EosRouteError(409, "recovery_checkout_not_eligible", "Checkout issuance requires a currently eligible, not-yet-issued billing manifest.");
            approvalSummary = `Authorize hosted Checkout for ${agreement.clientLegalName}: ${billing.currency} ${(billing.setupAmountMinor / 100).toFixed(2)} setup + ${(billing.recurringAmountMinor / 100).toFixed(2)} monthly`;
          } else if (input.operation === "stripe.cancel_recovery_subscription_with_local_approval") {
            if (!billing.providerSubscriptionReference || ["cancelled", "refunded"].includes(billing.state))
              throw new EosRouteError(409, "recovery_subscription_not_cancellable", "Cancellation requires an active provider subscription that has not already reached a terminal state.");
            approvalSummary = `Authorize ${input.timing === "immediate" ? "immediate" : "period-end"} cancellation for ${agreement.clientLegalName}: ${input.rationale}`;
          } else {
            if (billing.setupPaymentState !== "succeeded" || !billing.providerPaymentIntentReference)
              throw new EosRouteError(409, "recovery_setup_not_refundable", "A setup refund requires an authoritative successful setup payment and its PaymentIntent reference.");
            approvalSummary = `Authorize ${billing.currency} ${(billing.setupAmountMinor / 100).toFixed(2)} setup refund for ${agreement.clientLegalName}: ${input.rationale}`;
          }
          storedRequest = {
            billingManifestId: billing.id,
            targetVersion: billing.version,
            bindingId: binding.id,
            ...("timing" in input ? { timing: input.timing } : {}),
            ...("reason" in input ? { reason: input.reason } : {}),
            ...("rationale" in input ? { rationale: input.rationale } : {}),
            requestedBySeatId: access.seat.id,
            requestPolicyDecisionId: requestPolicyDecision.decisionId,
          };
        } else if (input.provider === "docusign" && "agreementInstanceId" in input) {
          const [agreement] = await db
            .select()
            .from(eosRecoveryAgreementInstances)
            .where(and(
              eq(eosRecoveryAgreementInstances.id, input.agreementInstanceId),
              eq(eosRecoveryAgreementInstances.companyId, access.company.id),
              eq(eosRecoveryAgreementInstances.workPacketId, packet.id),
            ));
          const binding = agreement?.eSignBindingId
            ? await db.query.eosIntegrationBindings.findFirst({ where: and(eq(eosIntegrationBindings.id, agreement.eSignBindingId), eq(eosIntegrationBindings.companyId, access.company.id)) })
            : undefined;
          if (!agreement || !binding || binding.providerKey !== "docusign")
            throw new EosRouteError(409, "recovery_docusign_binding_required", "The exact DocuSign Integration Binding is not available.");
          idempotencyKey = recoveryProviderIdempotencyKey({ companyId: access.company.id, operation: input.operation, targetId: agreement.id, targetVersion: agreement.version, option: input.operation.endsWith("void_recovery_agreement_with_local_approval") ? "void" : "issue" });
          if (input.operation === "docusign.send_recovery_agreement_with_local_approval") {
            if (agreement.state !== "eligible_to_issue" || agreement.providerEnvelopeReference)
              throw new EosRouteError(409, "recovery_agreement_not_eligible", "Agreement issuance requires verified payment readiness and a currently eligible, not-yet-issued package.");
            const [billing] = await db.select().from(eosRecoveryBillingManifests).where(and(eq(eosRecoveryBillingManifests.agreementInstanceId, agreement.id), eq(eosRecoveryBillingManifests.companyId, access.company.id)));
            if (!billing || billing.setupPaymentState !== "succeeded" || !["active", "trialing"].includes(billing.subscriptionState))
              throw new EosRouteError(409, "recovery_payment_receipts_required", "Agreement issuance requires authoritative setup-payment and active-subscription receipts.");
            approvalSummary = `Authorize DocuSign agreement ${agreement.agreementVersion} for ${agreement.clientLegalName} (${agreement.clientSignerEmail})`;
          } else {
            if (agreement.state !== "issued" || !agreement.providerEnvelopeReference)
              throw new EosRouteError(409, "recovery_agreement_not_voidable", "Voiding requires an issued, not-yet-terminal DocuSign envelope.");
            approvalSummary = `Authorize voiding the DocuSign agreement for ${agreement.clientLegalName}: ${input.rationale}`;
          }
          storedRequest = {
            agreementInstanceId: agreement.id,
            targetVersion: agreement.version,
            bindingId: binding.id,
            ...(input.operation === "docusign.void_recovery_agreement_with_local_approval" ? { rationale: input.rationale } : {}),
            requestedBySeatId: access.seat.id,
            requestPolicyDecisionId: requestPolicyDecision.decisionId,
          };
        } else {
          throw new EosRouteError(400, "recovery_provider_operation_invalid", "Recovery provider operation and target do not match.");
        }
        const existing = await db.query.eosProviderExecutions.findFirst({
          where: and(
            eq(eosProviderExecutions.companyId, access.company.id),
            eq(eosProviderExecutions.provider, input.provider),
            eq(eosProviderExecutions.operation, input.operation),
            eq(eosProviderExecutions.idempotencyKey, idempotencyKey),
          ),
        });
        if (existing)
          return { body: existing };
      } else if (
        input.operation ===
        "google.calendar.create_candidate_event_with_local_approval"
      ) {
        const [scheduling] = await db
          .select()
          .from(eosTalentSchedulingRequests)
          .where(
            and(
              eq(eosTalentSchedulingRequests.id, input.schedulingId),
              eq(eosTalentSchedulingRequests.companyId, access.company.id),
            ),
          );
        if (
          !scheduling ||
          scheduling.state !== "accepted" ||
          !scheduling.selectedSlot ||
          scheduling.externalEventReference
        )
          throw new EosRouteError(
            409,
            "candidate_scheduling_not_ready",
            "Calendar booking requires an accepted, not-yet-booked candidate time.",
          );
        if (new Date(scheduling.selectedSlot).getTime() <= Date.now())
          throw new EosRouteError(
            409,
            "candidate_scheduling_time_elapsed",
            "The accepted candidate time has elapsed. Propose a new time before requesting a Calendar booking.",
          );
        const [application] = await db
          .select()
          .from(eosTalentApplications)
          .where(
            and(
              eq(eosTalentApplications.id, scheduling.applicationId),
              eq(eosTalentApplications.companyId, access.company.id),
            ),
          );
        if (
          !application ||
          !visible.has(application.ownerSeatId) ||
          (application.targetSeatId &&
            !visible.has(application.targetSeatId)) ||
          !mayAccessClassification(access, application.classification)
        )
          throw new EosRouteError(
            404,
            "talent_scheduling_not_found",
            "Candidate scheduling was not found in this authority scope.",
          );
        const [candidate] = await db
          .select()
          .from(eosStakeholders)
          .where(
            and(
              eq(eosStakeholders.id, application.candidateStakeholderId),
              eq(eosStakeholders.companyId, access.company.id),
            ),
          );
        if (
          !candidate ||
          !z.string().email().safeParse(candidate.identityReference).success
        )
          throw new EosRouteError(
            409,
            "candidate_email_required",
            "Calendar booking requires a valid candidate email identity.",
          );
        approvalSummary = `Authorize Google Calendar booking for ${candidate.name}`;
        storedRequest = {
          schedulingId: scheduling.id,
          requestedBySeatId: access.seat.id,
          requestPolicyDecisionId: requestPolicyDecision.decisionId,
        };
      } else if (
        input.operation ===
        "google.calendar.cancel_candidate_event_with_local_approval"
      ) {
        const [scheduling] = await db
          .select()
          .from(eosTalentSchedulingRequests)
          .where(
            and(
              eq(eosTalentSchedulingRequests.id, input.schedulingId),
              eq(eosTalentSchedulingRequests.companyId, access.company.id),
            ),
          );
        if (
          !scheduling ||
          scheduling.state !== "accepted" ||
          scheduling.sourceSystem !== "google_calendar" ||
          !scheduling.externalEventReference
        )
          throw new EosRouteError(
            409,
            "candidate_scheduling_not_booked",
            "Calendar cancellation requires a reconciled active candidate event.",
          );
        const [application] = await db
          .select()
          .from(eosTalentApplications)
          .where(
            and(
              eq(eosTalentApplications.id, scheduling.applicationId),
              eq(eosTalentApplications.companyId, access.company.id),
            ),
          );
        if (
          !application ||
          !visible.has(application.ownerSeatId) ||
          (application.targetSeatId &&
            !visible.has(application.targetSeatId)) ||
          !mayAccessClassification(access, application.classification)
        )
          throw new EosRouteError(
            404,
            "talent_scheduling_not_found",
            "Candidate scheduling was not found in this authority scope.",
          );
        const [candidate] = await db
          .select()
          .from(eosStakeholders)
          .where(
            and(
              eq(eosStakeholders.id, application.candidateStakeholderId),
              eq(eosStakeholders.companyId, access.company.id),
            ),
          );
        approvalSummary = `Authorize Google Calendar cancellation for ${candidate?.name || "candidate"}`;
        storedRequest = {
          schedulingId: scheduling.id,
          requestedBySeatId: access.seat.id,
          requestPolicyDecisionId: requestPolicyDecision.decisionId,
        };
      } else if (
        input.operation ===
        "gmail.send_candidate_portal_invitation_with_local_approval"
      ) {
        const [application] = await db
          .select()
          .from(eosTalentApplications)
          .where(
            and(
              eq(eosTalentApplications.id, input.applicationId),
              eq(eosTalentApplications.companyId, access.company.id),
            ),
          );
        if (
          !application ||
          !visible.has(application.ownerSeatId) ||
          (application.targetSeatId &&
            !visible.has(application.targetSeatId)) ||
          !mayAccessClassification(access, application.classification)
        )
          throw new EosRouteError(
            404,
            "talent_application_not_found",
            "Talent application not found in this authority scope.",
          );
        if (["activated", "rejected", "withdrawn"].includes(application.state))
          throw new EosRouteError(
            409,
            "talent_application_closed",
            "A portal invitation cannot be sent for a closed candidate lifecycle.",
          );
        const [candidate] = await db
          .select()
          .from(eosStakeholders)
          .where(
            and(
              eq(eosStakeholders.id, application.candidateStakeholderId),
              eq(eosStakeholders.companyId, access.company.id),
            ),
          );
        if (
          !candidate ||
          !z.string().email().safeParse(candidate.identityReference).success
        )
          throw new EosRouteError(
            409,
            "candidate_email_required",
            "Candidate invitation delivery requires a valid candidate email identity.",
          );
        try {
          talentPortalUrl("configuration-check");
        } catch {
          throw new EosRouteError(
            409,
            "public_origin_not_configured",
            "Configure EOS_PUBLIC_ORIGIN before requesting a candidate invitation.",
          );
        }
        approvalSummary = `Authorize secure candidate invitation for ${candidate.name}`;
        storedRequest = {
          applicationId: application.id,
          expiresInDays: input.expiresInDays,
          retentionDays: input.retentionDays,
          personalMessage: input.personalMessage,
          requestedBySeatId: access.seat.id,
          requestPolicyDecisionId: requestPolicyDecision.decisionId,
        };
      } else if (input.operation === "gmail.send_with_local_approval") {
        approvalSummary = `Authorize Gmail delivery: ${input.subject}`;
        storedRequest = {
          to: input.to,
          subject: input.subject,
          body: input.body,
          cc: input.cc,
          bcc: input.bcc,
          requestedBySeatId: access.seat.id,
          requestPolicyDecisionId: requestPolicyDecision.decisionId,
        };
      } else {
        throw new EosRouteError(400, "provider_operation_invalid", "Provider operation is not supported.");
      }
      const approver = await approverFor(
        access.company,
        access.seat,
        packet.classification,
      );
      const approvalId = randomUUID();
      const executionId = randomUUID();
      const { traceId, correlationId } = tracePair();
      const now = new Date();
      await db.transaction(async (tx) => {
        await tx.insert(eosApprovalRequests).values({
          id: approvalId,
          companyId: access.company.id,
          workPacketId: packet.id,
          requestedByUserId: req.user.id,
          assignedToUserId: approver.userId,
          assignedToSeatId: approver.seatId,
          summary: approvalSummary,
          status: "pending",
          createdAt: now,
        });
        await tx.insert(eosProviderExecutions).values({
          id: executionId,
          companyId: access.company.id,
          workPacketId: packet.id,
          approvalId,
          requestedByUserId: req.user.id,
          provider: input.provider,
          operation: input.operation,
          idempotencyKey,
          request: storedRequest,
          traceId,
          correlationId,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "provider_execution.requested",
          targetType: "provider_execution",
          targetId: executionId,
          traceId,
          correlationId,
          result: "awaiting_approval",
          details: {
            provider: input.provider,
            operation: input.operation,
            approvalId,
            workPacketId: packet.id,
          },
          createdAt: now,
        });
      });
      return {
        status: 201,
        body: {
          id: executionId,
          approvalId,
          status: "awaiting_approval",
          traceId,
          correlationId,
        },
      };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/approvals/:approvalId/decide",
    route(async (req) => {
      const access = await companyAccess(req);
      const { company } = access;
      const input = approvalDecisionSchema.parse(req.body);
      const approval = await db.query.eosApprovalRequests.findFirst({
        where: and(
          eq(eosApprovalRequests.id, req.params.approvalId),
          eq(eosApprovalRequests.companyId, company.id),
          eq(eosApprovalRequests.assignedToUserId, req.user.id),
        ),
      });
      if (!approval)
        throw new EosRouteError(
          404,
          "approval_not_found",
          "Approval not found in this authority scope.",
        );
      const approvalPacket = await db.query.eosWorkPackets.findFirst({
        where: and(
          eq(eosWorkPackets.id, approval.workPacketId),
          eq(eosWorkPackets.companyId, company.id),
        ),
      });
      if (
        !approvalPacket ||
        !mayAccessClassification(access, approvalPacket.classification)
      )
        throw new EosRouteError(
          404,
          "approval_not_found",
          "Approval not found in this authority scope.",
        );
      await authorizeAction(req, access, {
        authorityClass: "approve",
        resource: "approval",
        actionKey: "approval.decide",
        purpose: "decide_assigned_approval",
        classification: approvalPacket.classification,
        consequence: "material",
        participants: {
          initiator: {
            principalKey: approval.requestedByUserId,
            seatId: approvalPacket.accountableSeatId || access.seat.id,
          },
        },
      });
      if (approval.status !== "pending")
        throw new EosRouteError(
          409,
          "approval_already_decided",
          "Approval has already been decided.",
        );
      const federatedCommand = await db.query.umhCommands.findFirst({
        where: and(
          eq(umhCommands.companyId, company.id),
          eq(umhCommands.approvalId, approval.id),
        ),
      });
      const linkedTrial = await db.query.eosTalentTrials.findFirst({
        where: and(
          eq(eosTalentTrials.approvalId, approval.id),
          eq(eosTalentTrials.companyId, company.id),
        ),
      });
      const linkedSharedService = await db.query.eosSharedServiceEngagements.findFirst({
        where: and(
          eq(eosSharedServiceEngagements.beneficiaryApprovalId, approval.id),
          eq(eosSharedServiceEngagements.beneficiaryCompanyId, company.id),
        ),
      });
      const linkedCustomerValueCycle = await db.query.eosCustomerValueCycles.findFirst({
        where: and(
          eq(eosCustomerValueCycles.approvalId, approval.id),
          eq(eosCustomerValueCycles.companyId, company.id),
        ),
      });
      const now = new Date();
      const nextStatus = input.decision === "approved" ? "ready" : "cancelled";
      const { traceId, correlationId } = tracePair();
      let decided: typeof approval | undefined;
      await db.transaction(async (tx) => {
        [decided] = await tx
          .update(eosApprovalRequests)
          .set({
            status: input.decision,
            decisionReason: input.reason || null,
            decidedByUserId: req.user.id,
            decidedAt: now,
          })
          .where(
            and(
              eq(eosApprovalRequests.id, approval.id),
              eq(eosApprovalRequests.status, "pending"),
            ),
          )
          .returning();
        if (!decided)
          throw new EosRouteError(
            409,
            "approval_conflict",
            "Approval changed before the decision was applied.",
          );
        await tx
          .update(eosWorkPackets)
          .set({ status: nextStatus, updatedAt: now })
          .where(
            and(
              eq(eosWorkPackets.id, approval.workPacketId),
              eq(eosWorkPackets.status, "awaiting_approval"),
            ),
          );
        if (linkedTrial) {
          const trialState =
            input.decision === "approved" ? "approved" : "cancelled";
          const changedTrial = await tx
            .update(eosTalentTrials)
            .set({ state: trialState, updatedAt: now })
            .where(
              and(
                eq(eosTalentTrials.id, linkedTrial.id),
                eq(eosTalentTrials.state, "draft"),
              ),
            )
            .returning({ id: eosTalentTrials.id });
          if (!changedTrial[0])
            throw new EosRouteError(
              409,
              "talent_trial_approval_concurrent_change",
              "The linked trial changed before approval completed.",
            );
          await tx.insert(eosAuditRecords).values({
            id: randomUUID(),
            companyId: company.id,
            actorUserId: req.user.id,
            action:
              input.decision === "approved"
                ? "talent_trial.approved"
                : "talent_trial.cancelled",
            targetType: "talent_trial",
            targetId: linkedTrial.id,
            traceId,
            correlationId,
            result: trialState,
            details: {
              approvalId: approval.id,
              applicationStateChanged: false,
              placementCreated: false,
              accessOrAuthorityGranted: false,
              paymentExecuted: false,
            },
            createdAt: now,
          });
        }
        if (linkedSharedService) {
          const serviceState = input.decision === "approved" ? "provider_review" : "beneficiary_rejected";
          const changedService = await tx
            .update(eosSharedServiceEngagements)
            .set({ state: serviceState, version: linkedSharedService.version + 1, updatedAt: now })
            .where(and(
              eq(eosSharedServiceEngagements.id, linkedSharedService.id),
              eq(eosSharedServiceEngagements.state, "awaiting_beneficiary_approval"),
              eq(eosSharedServiceEngagements.version, linkedSharedService.version),
            ))
            .returning({ id: eosSharedServiceEngagements.id });
          if (!changedService[0])
            throw new EosRouteError(409, "shared_service_approval_concurrent_change", "The shared-service request changed before approval completed.");
          await appendSharedServiceEvent(tx, {
            engagementId: linkedSharedService.id,
            sequence: linkedSharedService.version + 1,
            actorCompanyId: company.id,
            actorUserId: req.user.id,
            actorSeatId: access.seat.id,
            eventType: input.decision === "approved" ? "beneficiary_approved" : "beneficiary_rejected",
            fromState: linkedSharedService.state,
            toState: serviceState,
            note: input.reason || "",
            traceId,
            correlationId,
            createdAt: now,
          });
          await tx.insert(eosAuditRecords).values({
            id: randomUUID(), companyId: company.id, actorUserId: req.user.id,
            action: `shared_service.${input.decision}`, targetType: "shared_service_engagement",
            targetId: linkedSharedService.id, traceId, correlationId, result: serviceState,
            details: { approvalId: approval.id, providerCompanyId: linkedSharedService.providerCompanyId, externalEffectsExecuted: false },
            createdAt: now,
          });
        }
        if (linkedCustomerValueCycle) {
          const cycleState = input.decision === "approved" ? "commercial_approved" : "commercial_rejected";
          const changedCycle = await tx
            .update(eosCustomerValueCycles)
            .set({
              state: cycleState,
              version: linkedCustomerValueCycle.version + 1,
              restoredSafeStateAt: input.decision === "rejected" ? now : null,
              updatedAt: now,
            })
            .where(and(
              eq(eosCustomerValueCycles.id, linkedCustomerValueCycle.id),
              eq(eosCustomerValueCycles.state, "awaiting_commercial_approval"),
              eq(eosCustomerValueCycles.version, linkedCustomerValueCycle.version),
            ))
            .returning({ id: eosCustomerValueCycles.id });
          if (!changedCycle[0])
            throw new EosRouteError(409, "customer_value_cycle_approval_concurrent_change", "The customer-value cycle changed before approval completed.");
          await appendCustomerValueCycleEvent(tx, {
            cycleId: linkedCustomerValueCycle.id,
            companyId: company.id,
            actorUserId: req.user.id,
            actorSeatId: access.seat.id,
            sequence: linkedCustomerValueCycle.version + 1,
            eventType: input.decision === "approved" ? "commercial_approved" : "commercial_rejected",
            fromState: linkedCustomerValueCycle.state,
            toState: cycleState,
            note: input.reason || "",
            traceId,
            correlationId,
            createdAt: now,
          });
          await tx.insert(eosAuditRecords).values({
            id: randomUUID(),
            companyId: company.id,
            actorUserId: req.user.id,
            action: `customer_value_cycle.commercial_${input.decision}`,
            targetType: "customer_value_cycle",
            targetId: linkedCustomerValueCycle.id,
            traceId,
            correlationId,
            result: cycleState,
            details: {
              approvalId: approval.id,
              excludedFromMetrics: true,
              externalEffectsExecuted: false,
            },
            createdAt: now,
          });
        }
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: company.id,
          actorUserId: req.user.id,
          action: "approval.decided",
          targetType: "approval",
          targetId: approval.id,
          traceId,
          correlationId,
          result: input.decision,
          details: {
            workPacketId: approval.workPacketId,
            reason: input.reason || null,
          },
          createdAt: now,
        });
        if (federatedCommand) {
          const federationOutcome = {
            protocolVersion: FEDERATION_PROTOCOL_VERSION,
            commandId: federatedCommand.id,
            status: input.decision === "approved" ? "completed" : "rejected",
            outcomeCode:
              input.decision === "approved"
                ? "proposal_approved"
                : "approval_rejected",
            traceId: federatedCommand.traceId,
            correlationId: federatedCommand.correlationId,
            result: {
              workPacketId: approval.workPacketId,
              approvalId: approval.id,
              decision: input.decision,
            },
            occurredAt: now.toISOString(),
          } satisfies CommandOutcome;
          const eventPayload = {
            commandId: federatedCommand.id,
            workPacketId: approval.workPacketId,
            approvalId: approval.id,
            decision: input.decision,
            reason: input.reason || null,
            traceId: federatedCommand.traceId,
            correlationId: federatedCommand.correlationId,
          };
          await tx.insert(umhAuditRecords).values({
            id: randomUUID(),
            installationId: federatedCommand.installationId,
            commandId: federatedCommand.id,
            eventType: "eos.approval.decided.v1",
            traceId: federatedCommand.traceId,
            correlationId: federatedCommand.correlationId,
            actorUserId: req.user.id,
            details: eventPayload,
            createdAt: now,
          });
          await tx.insert(umhEventOutbox).values([
            {
              id: randomUUID(),
              installationId: federatedCommand.installationId,
              eventType: "eos.approval.decided.v1",
              payload: eventPayload,
              createdAt: now,
            },
            {
              id: randomUUID(),
              installationId: federatedCommand.installationId,
              eventType: "eos.command.outcome.v1",
              payload: federationOutcome,
              createdAt: now,
            },
          ]);
          await tx
            .update(umhCommands)
            .set({
              status: federationOutcome.status,
              outcome: federationOutcome,
              completedAt: now,
            })
            .where(
              and(
                eq(umhCommands.id, federatedCommand.id),
                eq(umhCommands.status, "accepted"),
              ),
            );
        }
      });
      const providerExecution = await db.query.eosProviderExecutions.findFirst({
        where: and(
          eq(eosProviderExecutions.companyId, company.id),
          eq(eosProviderExecutions.approvalId, approval.id),
        ),
      });
      if (!providerExecution) return { body: decided };
      if (input.decision === "rejected") {
        const [updated] = await db
          .update(eosProviderExecutions)
          .set({
            status: "rejected",
            reconciliationStatus: "not_executed",
            updatedAt: now,
          })
          .where(
            and(
              eq(eosProviderExecutions.id, providerExecution.id),
              eq(eosProviderExecutions.status, "awaiting_approval"),
            ),
          )
          .returning();
        return { body: { approval: decided, providerExecution: updated } };
      }
      const request = providerExecution.request as {
        to?: string;
        subject?: string;
        body?: string;
        cc?: string;
        bcc?: string;
        applicationId?: string;
        expiresInDays?: number;
        retentionDays?: number;
        personalMessage?: string;
        schedulingId?: string;
        billingManifestId?: string;
        agreementInstanceId?: string;
        bindingId?: string;
        targetVersion?: number;
        timing?: "immediate" | "period_end";
        reason?: "duplicate" | "fraudulent" | "requested_by_customer";
        rationale?: string;
        requestedBySeatId?: string;
        requestPolicyDecisionId?: string;
      };
      const requesterSeatId =
        request.requestedBySeatId || approvalPacket.accountableSeatId;
      if (!requesterSeatId)
        throw new EosRouteError(
          409,
          "provider_request_seat_missing",
          "The provider request cannot be revalidated without its original operating seat.",
        );
      const requesterGrants = await db
        .select()
        .from(eosAuthorityGrants)
        .where(eq(eosAuthorityGrants.companyId, company.id));
      const finalAction = policyActionContextSchema.parse({
        authorityClass: "execute",
        resource: "provider_execution",
        actionKey: providerExecution.operation,
        purpose: "execute_approved_provider_effect",
        classification: approvalPacket.classification,
        consequence: "material",
        providerKey: providerExecution.provider,
        toolKey: providerExecution.operation,
        targetSeatId: approvalPacket.accountableSeatId || requesterSeatId,
        approvals: [
          {
            approvalId: approval.id,
            decision: "approved",
            approverPrincipalKey: req.user.id,
            approverSeatId: access.seat.id,
            authorityClasses: access.effectiveAuthority.classes,
            decidedAt: now.toISOString(),
          },
        ],
        participants: {
          initiator: {
            principalKey: providerExecution.requestedByUserId,
            seatId: requesterSeatId,
          },
          approver: { principalKey: req.user.id, seatId: access.seat.id },
          executor: {
            principalKey: providerExecution.requestedByUserId,
            seatId: requesterSeatId,
          },
        },
      });
      const finalPolicy = evaluatePolicyDecision({
        grants: requesterGrants,
        principalKey: providerExecution.requestedByUserId,
        seatId: requesterSeatId,
        action: finalAction,
      });
      const finalPolicyTrace = tracePair();
      const finalPolicyDecisionId = randomUUID();
      await db.insert(eosPolicyDecisions).values({
        id: finalPolicyDecisionId,
        companyId: company.id,
        principalUserId: providerExecution.requestedByUserId,
        seatId: requesterSeatId,
        evaluatedByUserId: req.user.id,
        authorityClass: finalAction.authorityClass,
        resource: finalAction.resource,
        actionKey: finalAction.actionKey || null,
        purpose: finalAction.purpose,
        context: finalAction,
        outcome: finalPolicy.outcome,
        reasonCodes: finalPolicy.reasonCodes,
        matchedGrantIds: finalPolicy.matchedGrantIds,
        satisfiedGrantId: finalPolicy.satisfiedGrantId || null,
        requirements: finalPolicy.requirements,
        traceId: finalPolicyTrace.traceId,
        correlationId: finalPolicyTrace.correlationId,
      });
      if (finalPolicy.outcome !== "permit") {
        const [updated] = await db
          .update(eosProviderExecutions)
          .set({
            status: "failed",
            reconciliationStatus: "failed",
            failureCode: "policy_revalidation_failed",
            receipt: {
              policyDecisionId: finalPolicyDecisionId,
              outcome: finalPolicy.outcome,
              reasonCodes: finalPolicy.reasonCodes,
            },
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(eosProviderExecutions.id, providerExecution.id),
              eq(eosProviderExecutions.status, "awaiting_approval"),
            ),
          )
          .returning();
        await db
          .update(eosWorkPackets)
          .set({ status: "blocked", updatedAt: new Date() })
          .where(eq(eosWorkPackets.id, approval.workPacketId));
        return {
          status: 409,
          body: {
            code: "policy_revalidation_failed",
            message:
              "The provider effect was approved but the requester's current authority no longer permits execution.",
            approval: decided,
            providerExecution: updated,
            policyDecision: finalPolicy,
          },
        };
      }
      try {
        if (isRecoveryProviderOperation(providerExecution.operation)) {
          const updated = await executeApprovedRecoveryProviderExecution({
            execution: providerExecution,
            companyId: company.id,
            actorUserId: req.user.id,
          });
          return { body: { approval: decided, providerExecution: updated } };
        }
        if (
          providerExecution.operation ===
          "google.calendar.create_candidate_event_with_local_approval"
        ) {
          if (!request.schedulingId)
            throw new Error(
              "Calendar provider request is missing its scheduling reference.",
            );
          const [scheduling] = await db
            .select()
            .from(eosTalentSchedulingRequests)
            .where(
              and(
                eq(eosTalentSchedulingRequests.id, request.schedulingId),
                eq(eosTalentSchedulingRequests.companyId, company.id),
              ),
            );
          if (
            !scheduling ||
            scheduling.state !== "accepted" ||
            !scheduling.selectedSlot ||
            scheduling.externalEventReference
          )
            throw new Error(
              "The candidate scheduling record is no longer ready for provider booking.",
            );
          const [[application], [need]] = await Promise.all([
            db
              .select()
              .from(eosTalentApplications)
              .where(
                and(
                  eq(eosTalentApplications.id, scheduling.applicationId),
                  eq(eosTalentApplications.companyId, company.id),
                ),
              ),
            db
              .select()
              .from(eosTalentNeeds)
              .innerJoin(
                eosTalentApplications,
                eq(eosTalentApplications.talentNeedId, eosTalentNeeds.id),
              )
              .where(
                and(
                  eq(eosTalentApplications.id, scheduling.applicationId),
                  eq(eosTalentNeeds.companyId, company.id),
                ),
              )
              .then((rows) => rows.map((row) => row.eos_talent_needs)),
          ]);
          if (!application || !need)
            throw new Error(
              "The candidate opportunity is no longer available for provider booking.",
            );
          const [candidate] = await db
            .select()
            .from(eosStakeholders)
            .where(
              and(
                eq(eosStakeholders.id, application.candidateStakeholderId),
                eq(eosStakeholders.companyId, company.id),
              ),
            );
          if (
            !candidate ||
            !z.string().email().safeParse(candidate.identityReference).success
          )
            throw new Error(
              "The candidate no longer has a valid calendar attendee email.",
            );
          const start = new Date(scheduling.selectedSlot);
          const end = new Date(
            start.getTime() + scheduling.durationMinutes * 60_000,
          );
          if (
            !Number.isFinite(start.getTime()) ||
            !Number.isFinite(end.getTime())
          )
            throw new Error("The accepted candidate time is invalid.");
          if (start.getTime() <= Date.now())
            throw new Error(
              "The accepted candidate time elapsed before provider booking.",
            );
          const receipt = await gmail.createCandidateCalendarEvent(
            providerExecution.requestedByUserId,
            {
              executionId: providerExecution.id,
              schedulingId: scheduling.id,
              candidateEmail: candidate.identityReference,
              candidateName: candidate.name,
              companyName: company.name,
              opportunityTitle: need.title,
              schedulingKind: scheduling.schedulingKind,
              start: start.toISOString(),
              end: end.toISOString(),
              description: `${scheduling.teamNote || "Candidate conversation coordinated through EntrepreneurOS."}\n\nHuman reviewers retain authority over all recruiting decisions.`,
            },
          );
          const completedAt = new Date();
          const updated = await db.transaction(async (tx) => {
            const [booked] = await tx
              .update(eosTalentSchedulingRequests)
              .set({
                sourceSystem: "google_calendar",
                externalEventReference: receipt.eventId,
                schedulingUrl:
                  receipt.hangoutLink ||
                  receipt.htmlLink ||
                  scheduling.schedulingUrl,
                updatedAt: completedAt,
              })
              .where(
                and(
                  eq(eosTalentSchedulingRequests.id, scheduling.id),
                  eq(eosTalentSchedulingRequests.state, "accepted"),
                  sql`${eosTalentSchedulingRequests.externalEventReference} IS NULL`,
                ),
              )
              .returning();
            if (!booked)
              throw new Error(
                "The Calendar event was created but the scheduling record changed before reconciliation.",
              );
            const [execution] = await tx
              .update(eosProviderExecutions)
              .set({
                status: "succeeded",
                receipt,
                reconciliationStatus: "reconciled",
                executedAt: completedAt,
                reconciledAt: completedAt,
                updatedAt: completedAt,
              })
              .where(eq(eosProviderExecutions.id, providerExecution.id))
              .returning();
            const receiptEvidenceId = randomUUID();
            await tx.insert(eosEvidence).values({
              id: receiptEvidenceId,
              evidenceKey: commandRecordKey(
                "evidence",
                "Google Calendar provider receipt",
                receiptEvidenceId,
              ),
              companyId: company.id,
              workPacketId: approval.workPacketId,
              recordedByUserId: req.user.id,
              evidenceType: "provider_receipt",
              title: "Google Calendar provider receipt",
              sourceSystem: "google_calendar",
              verificationState: "observed",
              confidenceQuality: "authoritative",
              supportedClaimSummary:
                "The approved candidate Calendar event was created and reconciled to the accepted scheduling record.",
              details: {
                provider: "google_workspace",
                operation: providerExecution.operation,
                eventId: receipt.eventId,
                schedulingId: scheduling.id,
                executionId: providerExecution.id,
              },
              createdAt: completedAt,
            });
            await tx.insert(eosAuditRecords).values({
              id: randomUUID(),
              companyId: company.id,
              actorUserId: req.user.id,
              action: "talent_scheduling.provider_booked",
              targetType: "talent_scheduling",
              targetId: scheduling.id,
              traceId: providerExecution.traceId,
              correlationId: providerExecution.correlationId,
              result: "reconciled",
              details: {
                provider: "google_workspace",
                eventId: receipt.eventId,
                workPacketId: approval.workPacketId,
                providerExecutionId: providerExecution.id,
              },
              createdAt: completedAt,
            });
            return execution;
          });
          return { body: { approval: decided, providerExecution: updated } };
        }
        if (
          providerExecution.operation ===
          "google.calendar.cancel_candidate_event_with_local_approval"
        ) {
          if (!request.schedulingId)
            throw new Error(
              "Calendar cancellation request is missing its scheduling reference.",
            );
          const [scheduling] = await db
            .select()
            .from(eosTalentSchedulingRequests)
            .where(
              and(
                eq(eosTalentSchedulingRequests.id, request.schedulingId),
                eq(eosTalentSchedulingRequests.companyId, company.id),
              ),
            );
          if (
            !scheduling ||
            scheduling.state !== "accepted" ||
            scheduling.sourceSystem !== "google_calendar" ||
            !scheduling.externalEventReference
          )
            throw new Error(
              "The candidate scheduling record no longer has an active provider event to cancel.",
            );
          const eventId = scheduling.externalEventReference;
          const receipt = await gmail.cancelCandidateCalendarEvent(
            providerExecution.requestedByUserId,
            eventId,
          );
          const completedAt = new Date();
          const updated = await db.transaction(async (tx) => {
            const [cancelled] = await tx
              .update(eosTalentSchedulingRequests)
              .set({
                state: "cancelled",
                schedulingUrl: "",
                updatedAt: completedAt,
              })
              .where(
                and(
                  eq(eosTalentSchedulingRequests.id, scheduling.id),
                  eq(eosTalentSchedulingRequests.state, "accepted"),
                  eq(
                    eosTalentSchedulingRequests.sourceSystem,
                    "google_calendar",
                  ),
                  eq(
                    eosTalentSchedulingRequests.externalEventReference,
                    eventId,
                  ),
                ),
              )
              .returning();
            if (!cancelled)
              throw new Error(
                "The Calendar event was cancelled but the scheduling record changed before reconciliation.",
              );
            const [execution] = await tx
              .update(eosProviderExecutions)
              .set({
                status: "succeeded",
                receipt,
                reconciliationStatus: "reconciled",
                executedAt: completedAt,
                reconciledAt: completedAt,
                updatedAt: completedAt,
              })
              .where(eq(eosProviderExecutions.id, providerExecution.id))
              .returning();
            const receiptEvidenceId = randomUUID();
            await tx.insert(eosEvidence).values({
              id: receiptEvidenceId,
              evidenceKey: commandRecordKey(
                "evidence",
                "Google Calendar cancellation receipt",
                receiptEvidenceId,
              ),
              companyId: company.id,
              workPacketId: approval.workPacketId,
              recordedByUserId: req.user.id,
              evidenceType: "provider_receipt",
              title: "Google Calendar cancellation receipt",
              sourceSystem: "google_calendar",
              verificationState: "observed",
              confidenceQuality: "authoritative",
              supportedClaimSummary:
                "The approved candidate Calendar event cancellation was reconciled to the scheduling record.",
              details: {
                provider: "google_workspace",
                operation: providerExecution.operation,
                eventId,
                providerStatus: receipt.status,
                schedulingId: scheduling.id,
                executionId: providerExecution.id,
              },
              createdAt: completedAt,
            });
            await tx.insert(eosAuditRecords).values({
              id: randomUUID(),
              companyId: company.id,
              actorUserId: req.user.id,
              action: "talent_scheduling.provider_cancelled",
              targetType: "talent_scheduling",
              targetId: scheduling.id,
              traceId: providerExecution.traceId,
              correlationId: providerExecution.correlationId,
              result: "reconciled",
              details: {
                provider: "google_workspace",
                eventId,
                providerStatus: receipt.status,
                workPacketId: approval.workPacketId,
                providerExecutionId: providerExecution.id,
              },
              createdAt: completedAt,
            });
            return execution;
          });
          return { body: { approval: decided, providerExecution: updated } };
        }
        let deliveryRequest: {
          to: string;
          subject: string;
          body: string;
          cc?: string;
          bcc?: string;
        };
        let candidateDelivery:
          | {
              applicationId: string;
              issueCount: number;
              tokenHash: string;
              expiresAt: Date;
              retentionUntil: Date;
            }
          | undefined;
        if (
          providerExecution.operation ===
          "gmail.send_candidate_portal_invitation_with_local_approval"
        ) {
          if (!request.applicationId)
            throw new Error(
              "Candidate invitation request is missing its application reference.",
            );
          const [application] = await db
            .select()
            .from(eosTalentApplications)
            .where(
              and(
                eq(eosTalentApplications.id, request.applicationId),
                eq(eosTalentApplications.companyId, company.id),
              ),
            );
          if (
            !application ||
            ["activated", "rejected", "withdrawn"].includes(application.state)
          )
            throw new Error(
              "The candidate lifecycle is no longer open for invitation delivery.",
            );
          const [[candidate], [need]] = await Promise.all([
            db
              .select()
              .from(eosStakeholders)
              .where(
                and(
                  eq(eosStakeholders.id, application.candidateStakeholderId),
                  eq(eosStakeholders.companyId, company.id),
                ),
              ),
            db
              .select()
              .from(eosTalentNeeds)
              .where(
                and(
                  eq(eosTalentNeeds.id, application.talentNeedId),
                  eq(eosTalentNeeds.companyId, company.id),
                ),
              ),
          ]);
          if (
            !candidate ||
            !need ||
            !z.string().email().safeParse(candidate.identityReference).success
          )
            throw new Error(
              "The candidate invitation no longer has a valid recipient or opportunity.",
            );
          const secret = createTalentPortalSecret();
          const expiresAt = new Date(
            Date.now() + (request.expiresInDays || 14) * 86_400_000,
          );
          const retentionUntil = new Date(
            Date.now() + (request.retentionDays || 365) * 86_400_000,
          );
          const email = candidatePortalInvitationEmail({
            candidateName: candidate.name,
            companyName: company.name,
            opportunityTitle: need.title,
            url: talentPortalUrl(secret),
            expiresAt,
            personalMessage: request.personalMessage || "",
          });
          deliveryRequest = { to: candidate.identityReference, ...email };
          candidateDelivery = {
            applicationId: application.id,
            issueCount: application.portalIssueCount,
            tokenHash: talentPortalDigest(secret),
            expiresAt,
            retentionUntil,
          };
        } else {
          if (!request.to || !request.subject || !request.body)
            throw new Error("Gmail delivery request is incomplete.");
          deliveryRequest = {
            to: request.to,
            subject: request.subject,
            body: request.body,
            cc: request.cc,
            bcc: request.bcc,
          };
        }
        const receipt = await gmail.sendEmail(
          providerExecution.requestedByUserId,
          deliveryRequest,
        );
        const completedAt = new Date();
        if (candidateDelivery) {
          const [issued] = await db.transaction(async (tx) => {
            const changed = await tx
              .update(eosTalentApplications)
              .set({
                portalTokenHash: candidateDelivery.tokenHash,
                portalExpiresAt: candidateDelivery.expiresAt,
                portalRevokedAt: null,
                retentionUntil: candidateDelivery.retentionUntil,
                portalIssueCount: candidateDelivery.issueCount + 1,
                schemaVersion: "talent-application-v1.1",
                updatedAt: completedAt,
              })
              .where(
                and(
                  eq(eosTalentApplications.id, candidateDelivery.applicationId),
                  eq(
                    eosTalentApplications.portalIssueCount,
                    candidateDelivery.issueCount,
                  ),
                ),
              )
              .returning();
            if (!changed[0])
              throw new Error(
                "The secure candidate link changed before provider delivery could be reconciled.",
              );
            await tx.insert(eosAuditRecords).values({
              id: randomUUID(),
              companyId: company.id,
              actorUserId: req.user.id,
              action: "talent_portal.invitation_delivered",
              targetType: "talent_application",
              targetId: candidateDelivery.applicationId,
              traceId: providerExecution.traceId,
              correlationId: providerExecution.correlationId,
              result: "delivered",
              details: {
                expiresAt: candidateDelivery.expiresAt.toISOString(),
                retentionUntil: candidateDelivery.retentionUntil.toISOString(),
                issueCount: changed[0].portalIssueCount,
                providerExecutionId: providerExecution.id,
                providerMessageId: receipt.messageId,
              },
              createdAt: completedAt,
            });
            return changed;
          });
          if (!issued)
            throw new Error(
              "Candidate invitation delivery could not be reconciled.",
            );
        }
        const [updated] = await db
          .update(eosProviderExecutions)
          .set({
            status: "succeeded",
            receipt,
            reconciliationStatus: "reconciled",
            executedAt: completedAt,
            reconciledAt: completedAt,
            updatedAt: completedAt,
          })
          .where(eq(eosProviderExecutions.id, providerExecution.id))
          .returning();
        await db.transaction(async (tx) => {
          const receiptEvidenceId = randomUUID();
          await tx.insert(eosEvidence).values({
            id: receiptEvidenceId,
            evidenceKey: commandRecordKey(
              "evidence",
              "Gmail provider receipt",
              receiptEvidenceId,
            ),
            companyId: company.id,
            workPacketId: approval.workPacketId,
            recordedByUserId: req.user.id,
            evidenceType: "provider_receipt",
            title: "Gmail provider receipt",
            sourceSystem: "gmail",
            verificationState: "observed",
            confidenceQuality: "authoritative",
            supportedClaimSummary:
              "The approved Gmail delivery completed and returned a provider message ID.",
            details: {
              provider: "gmail",
              operation: providerExecution.operation,
              messageId: receipt.messageId,
              executionId: providerExecution.id,
            },
            createdAt: completedAt,
          });
          await tx.insert(eosAuditRecords).values({
            id: randomUUID(),
            companyId: company.id,
            actorUserId: req.user.id,
            action: "provider_execution.reconciled",
            targetType: "provider_execution",
            targetId: providerExecution.id,
            traceId: providerExecution.traceId,
            correlationId: providerExecution.correlationId,
            result: "succeeded",
            details: {
              provider: "gmail",
              messageId: receipt.messageId,
              workPacketId: approval.workPacketId,
            },
            createdAt: completedAt,
          });
        });
        return { body: { approval: decided, providerExecution: updated } };
      } catch (error: any) {
        const safeFailureMessage =
          isRecoveryProviderOperation(providerExecution.operation)
            ? "Recovery provider execution or local reconciliation failed. Retry with the same execution idempotency key after resolving the blocker."
            : providerExecution.operation ===
          "gmail.send_candidate_portal_invitation_with_local_approval"
            ? "Candidate invitation provider delivery or reconciliation failed."
            : providerExecution.operation.startsWith("google.calendar.")
              ? "Candidate Calendar provider execution or reconciliation failed."
              : String(error?.message || "Provider delivery failed");
        const [updated] = await db
          .update(eosProviderExecutions)
          .set({
            status: "failed",
            reconciliationStatus: "failed",
            failureCode: "provider_delivery_failed",
            receipt: { message: safeFailureMessage },
            executedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(eosProviderExecutions.id, providerExecution.id))
          .returning();
        await db
          .update(eosWorkPackets)
          .set({ status: "blocked", updatedAt: new Date() })
          .where(eq(eosWorkPackets.id, approval.workPacketId));
        return {
          status: 502,
          body: {
            code: "provider_delivery_failed",
            message:
              "The approved provider effect failed or could not be reconciled; the Work Packet is blocked for recovery.",
            approval: decided,
            providerExecution: updated,
          },
        };
      }
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/evidence",
    route(async (req) => {
      const access = await companyAccess(req);
      await authorizeAction(req, access, {
        authorityClass: "view",
        resource: "evidence",
        actionKey: "evidence.list",
        purpose: "review_operating_evidence",
        classification: activeClassificationCeiling(access),
      });
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const [records, packets] = await Promise.all([
        db
          .select()
          .from(eosEvidence)
          .where(eq(eosEvidence.companyId, access.company.id))
          .orderBy(desc(eosEvidence.createdAt)),
        db
          .select()
          .from(eosWorkPackets)
          .where(eq(eosWorkPackets.companyId, access.company.id)),
      ]);
      const packetIds = new Set(
        packets
          .filter(
            (packet) =>
              mayAccessClassification(access, packet.classification) &&
              (access.isOwner ||
                (packet.accountableSeatId &&
                  visible.has(packet.accountableSeatId))),
          )
          .map((packet) => packet.id),
      );
      return {
        body: records.filter((record) => packetIds.has(record.workPacketId)),
      };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/evidence",
    route(async (req) => {
      const access = await companyAccess(req);
      const { company } = access;
      const input = evidenceCreateSchema.parse(req.body);
      const packet = await db.query.eosWorkPackets.findFirst({
        where: and(
          eq(eosWorkPackets.id, input.workPacketId),
          eq(eosWorkPackets.companyId, company.id),
        ),
      });
      if (!packet)
        throw new EosRouteError(
          404,
          "work_packet_not_found",
          "Evidence must reference a work packet in this company.",
        );
      const visible = await visibleSeatIds(
        company.id,
        access.seat.id,
        access.role,
      );
      if (
        !mayAccessClassification(access, packet.classification) ||
        (!access.isOwner &&
          (!packet.accountableSeatId || !visible.has(packet.accountableSeatId)))
      )
        throw new EosRouteError(
          404,
          "work_packet_not_found",
          "Evidence must reference a Work Packet visible to this seat.",
        );
      const verifiesClaim =
        input.verificationState === "verified" ||
        input.confidenceQuality === "authoritative" ||
        input.templateLearningEligibility === "approved_for_abstraction";
      await authorizeAction(req, access, {
        authorityClass: verifiesClaim ? "approve" : "execute",
        resource: "evidence",
        actionKey: verifiesClaim ? "evidence.verify" : "evidence.record",
        purpose: verifiesClaim
          ? "verify_operating_evidence"
          : "record_work_evidence",
        classification: packet.classification,
        consequence: verifiesClaim ? "material" : "routine",
        evidenceReferences: input.uri ? [input.uri] : [],
      });
      const now = new Date();
      const evidenceId = randomUUID();
      const record = {
        id: evidenceId,
        companyId: company.id,
        workPacketId: packet.id,
        recordedByUserId: req.user.id,
        evidenceType: input.evidenceType,
        title: input.title,
        uri: input.uri || null,
        details: input.details,
        evidenceKey: commandRecordKey("evidence", input.title, evidenceId),
        claimSubjectType: input.claimSubjectType,
        claimSubjectKey: input.claimSubjectKey || packet.id,
        verificationState: input.verificationState,
        confidenceQuality: input.confidenceQuality,
        dataClassification: input.dataClassification,
        sourceSystem: input.sourceSystem,
        producerProviderKey: input.producerProviderKey,
        consentRights: input.consentRights,
        supportedClaimSummary: input.supportedClaimSummary || input.title,
        verifierMethod: input.verifierMethod,
        templateLearningEligibility: input.templateLearningEligibility,
        relatedEventKeys: input.relatedEventKeys,
        relatedDecisionKeys: input.relatedDecisionKeys,
        capturedAt: now,
        validFrom: input.validFrom ? new Date(input.validFrom) : now,
        expiresReviewAt: input.expiresReviewAt
          ? new Date(input.expiresReviewAt)
          : null,
        createdAt: now,
      };
      const { traceId, correlationId } = tracePair();
      await db.transaction(async (tx) => {
        await tx.insert(eosEvidence).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: company.id,
          actorUserId: req.user.id,
          action: "evidence.recorded",
          targetType: "evidence",
          targetId: record.id,
          traceId,
          correlationId,
          result: "recorded",
          details: {
            workPacketId: packet.id,
            evidenceType: input.evidenceType,
          },
          createdAt: record.createdAt,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/talent-state",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      await authorizeAction(req, access, {
        authorityClass: "view",
        resource: "talent_application",
        actionKey: "talent_state.read",
        purpose: "govern_gap_to_placement",
        classification: "confidential",
        consequence: "routine",
        targetSeatId: access.seat.id,
      });
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const [
        needs,
        applications,
        assessments,
        reviewPackets,
        trials,
        trialApprovals,
        placements,
        stakeholders,
        candidateEvidence,
        candidateMessages,
        scheduling,
        portalEvents,
      ] = await Promise.all([
        db
          .select()
          .from(eosTalentNeeds)
          .where(eq(eosTalentNeeds.companyId, access.company.id))
          .orderBy(desc(eosTalentNeeds.updatedAt)),
        db
          .select()
          .from(eosTalentApplications)
          .where(eq(eosTalentApplications.companyId, access.company.id))
          .orderBy(desc(eosTalentApplications.updatedAt)),
        db
          .select()
          .from(eosTalentAssessments)
          .where(eq(eosTalentAssessments.companyId, access.company.id))
          .orderBy(desc(eosTalentAssessments.updatedAt)),
        db
          .select()
          .from(eosTalentReviewPackets)
          .where(eq(eosTalentReviewPackets.companyId, access.company.id))
          .orderBy(desc(eosTalentReviewPackets.updatedAt)),
        db
          .select()
          .from(eosTalentTrials)
          .where(eq(eosTalentTrials.companyId, access.company.id))
          .orderBy(desc(eosTalentTrials.updatedAt)),
        db
          .select({ id: eosApprovalRequests.id, status: eosApprovalRequests.status })
          .from(eosApprovalRequests)
          .where(eq(eosApprovalRequests.companyId, access.company.id)),
        db
          .select()
          .from(eosTalentPlacements)
          .where(eq(eosTalentPlacements.companyId, access.company.id))
          .orderBy(desc(eosTalentPlacements.updatedAt)),
        db
          .select({
            id: eosStakeholders.id,
            name: eosStakeholders.name,
            state: eosStakeholders.state,
          })
          .from(eosStakeholders)
          .where(eq(eosStakeholders.companyId, access.company.id)),
        db
          .select()
          .from(eosTalentCandidateEvidence)
          .where(eq(eosTalentCandidateEvidence.companyId, access.company.id))
          .orderBy(desc(eosTalentCandidateEvidence.updatedAt)),
        db
          .select()
          .from(eosTalentCandidateMessages)
          .where(eq(eosTalentCandidateMessages.companyId, access.company.id))
          .orderBy(eosTalentCandidateMessages.createdAt),
        db
          .select()
          .from(eosTalentSchedulingRequests)
          .where(eq(eosTalentSchedulingRequests.companyId, access.company.id))
          .orderBy(desc(eosTalentSchedulingRequests.updatedAt)),
        db
          .select()
          .from(eosTalentPortalEvents)
          .where(eq(eosTalentPortalEvents.companyId, access.company.id))
          .orderBy(desc(eosTalentPortalEvents.createdAt))
          .limit(200),
      ]);
      const visibleNeeds = needs.filter(
        (item) =>
          visible.has(item.ownerSeatId) &&
          (!item.targetSeatId || visible.has(item.targetSeatId)) &&
          mayAccessClassification(access, item.classification),
      );
      const needIds = new Set(visibleNeeds.map((item) => item.id));
      const visibleApplications = applications.filter(
        (item) =>
          needIds.has(item.talentNeedId) &&
          visible.has(item.ownerSeatId) &&
          (!item.targetSeatId || visible.has(item.targetSeatId)) &&
          mayAccessClassification(access, item.classification),
      );
      const applicationIds = new Set(
        visibleApplications.map((item) => item.id),
      );
      const candidateIds = new Set(
        visibleApplications.map((item) => item.candidateStakeholderId),
      );
      return {
        body: {
          generatedAt: new Date().toISOString(),
          needs: visibleNeeds,
          applications: visibleApplications.map(
            ({ portalTokenHash: _portalTokenHash, ...item }) => item,
          ),
          assessments: assessments.filter(
            (item) =>
              applicationIds.has(item.applicationId) &&
              mayAccessClassification(access, item.classification),
          ),
          reviewPackets: reviewPackets
            .filter(
              (item) =>
                applicationIds.has(item.applicationId) &&
                mayAccessClassification(access, item.classification),
            )
            .map((item) => ({
              ...item,
              readinessIssues: talentReviewPacketReadinessIssues(item),
              sourceStale:
                visibleApplications
                  .find((application) => application.id === item.applicationId)
                  ?.updatedAt.getTime() !==
                item.sourceApplicationUpdatedAt.getTime(),
            })),
          trials: trials
            .filter(
              (item) =>
                applicationIds.has(item.applicationId) &&
                visible.has(item.targetSeatId) &&
                mayAccessClassification(access, item.classification),
            )
            .map((item) => {
              const approvalStatus =
                trialApprovals.find((approval) => approval.id === item.approvalId)
                  ?.status || "missing";
              return {
                ...item,
                approvalStatus,
                readinessIssues: talentTrialAdvancementIssues(
                  { ...item, approvalStatus },
                  item.state,
                  Array.isArray(item.outcomeEvidenceIds)
                    ? item.outcomeEvidenceIds.length
                    : 0,
                ),
              };
            }),
          candidateEvidence: candidateEvidence
            .filter(
              (item) =>
                applicationIds.has(item.applicationId) &&
                mayAccessClassification(access, item.classification),
            )
            .map(
              ({
                storageKey: _storageKey,
                contentSha256: _contentSha256,
                ...item
              }) => item,
            ),
          candidateMessages: candidateMessages.filter((item) =>
            applicationIds.has(item.applicationId),
          ),
          scheduling: scheduling.filter((item) =>
            applicationIds.has(item.applicationId),
          ),
          portalEvents: portalEvents.filter((item) =>
            applicationIds.has(item.applicationId),
          ),
          placements: placements.filter(
            (item) =>
              applicationIds.has(item.applicationId) &&
              visible.has(item.targetSeatId) &&
              mayAccessClassification(access, item.classification),
          ),
          candidates: stakeholders.filter((item) => candidateIds.has(item.id)),
          counts: {
            openNeeds: visibleNeeds.filter((item) => item.state === "open")
              .length,
            activeCandidates: visibleApplications.filter(
              (item) =>
                !["activated", "rejected", "withdrawn"].includes(item.state),
            ).length,
            decisionsDue: visibleApplications.filter(
              (item) => item.state === "decision",
            ).length,
            onboarding: visibleApplications.filter(
              (item) => item.state === "onboarding",
            ).length,
          },
        },
      };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/talent-candidate-evidence/:evidenceId/file",
    async (req: Request, res: any) => {
      try {
        const access = await companyAccess(req);
        assertTalentSurface(access);
        const [evidence] = await db
          .select()
          .from(eosTalentCandidateEvidence)
          .where(
            and(
              eq(eosTalentCandidateEvidence.id, req.params.evidenceId),
              eq(eosTalentCandidateEvidence.companyId, access.company.id),
            ),
          );
        if (
          !evidence ||
          evidence.state === "withdrawn" ||
          evidence.scanState !== "clean" ||
          !evidence.storageKey ||
          !evidence.contentSha256
        )
          throw new EosRouteError(
            404,
            "candidate_file_unavailable",
            "Candidate file is not available.",
          );
        const [application] = await db
          .select()
          .from(eosTalentApplications)
          .where(
            and(
              eq(eosTalentApplications.id, evidence.applicationId),
              eq(eosTalentApplications.companyId, access.company.id),
            ),
          );
        const visible = await visibleSeatIds(
          access.company.id,
          access.seat.id,
          access.role,
        );
        if (
          !application ||
          !visible.has(application.ownerSeatId) ||
          (application.targetSeatId &&
            !visible.has(application.targetSeatId)) ||
          !mayAccessClassification(access, evidence.classification)
        )
          throw new EosRouteError(
            404,
            "candidate_file_unavailable",
            "Candidate file is not available.",
          );
        await authorizeAction(req, access, {
          authorityClass: "view",
          resource: "talent_candidate_evidence",
          actionKey: "talent_candidate_file.read",
          purpose: "review_candidate_supplied_evidence",
          classification: evidence.classification,
          consequence: "routine",
          targetSeatId: application.targetSeatId || application.ownerSeatId,
          evidenceReferences: [evidence.id],
        });
        const file = await readCandidateFile(evidence.storageKey);
        if (candidateFileSha256(file) !== evidence.contentSha256)
          throw new EosRouteError(
            409,
            "candidate_file_integrity_failed",
            "Candidate file failed its integrity check and is unavailable.",
          );
        res.setHeader("Cache-Control", "no-store, private, max-age=0");
        res.setHeader(
          "Content-Type",
          evidence.fileMimeType || "application/octet-stream",
        );
        res.setHeader("Content-Length", String(file.length));
        res.setHeader(
          "Content-Disposition",
          safeAttachmentHeader(evidence.fileName),
        );
        res.setHeader("X-Content-Type-Options", "nosniff");
        return res.send(file);
      } catch (error) {
        if (error instanceof EosRouteError)
          return res
            .status(error.status)
            .json({ code: error.code, message: error.message });
        console.error("Candidate file download failed", error);
        return res.status(500).json({
          code: "candidate_file_download_failed",
          message: "Candidate file could not be downloaded.",
        });
      }
    },
  );

  app.post(
    "/api/eos/companies/:companyId/talent-candidate-evidence/:evidenceId/promote",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const input = talentCandidateEvidencePromotionSchema.parse(req.body);
      const [candidateEvidence] = await db
        .select()
        .from(eosTalentCandidateEvidence)
        .where(
          and(
            eq(eosTalentCandidateEvidence.id, req.params.evidenceId),
            eq(eosTalentCandidateEvidence.companyId, access.company.id),
          ),
        );
      if (!candidateEvidence)
        throw new EosRouteError(
          404,
          "talent_candidate_evidence_not_found",
          "Candidate evidence not found.",
        );
      if (candidateEvidence.state !== "submitted")
        throw new EosRouteError(
          409,
          "talent_candidate_evidence_not_promotable",
          "Only an active, unpromoted candidate submission can be verified.",
        );
      const safeForReview = candidateEvidence.storageKey
        ? candidateEvidence.scanState === "clean"
        : candidateEvidence.scanState === "not_applicable";
      if (!safeForReview)
        throw new EosRouteError(
          409,
          "talent_candidate_evidence_unsafe",
          "Candidate evidence must pass its security check before verification.",
        );
      const [application] = await db
        .select()
        .from(eosTalentApplications)
        .where(
          and(
            eq(eosTalentApplications.id, candidateEvidence.applicationId),
            eq(eosTalentApplications.companyId, access.company.id),
          ),
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !application ||
        !visible.has(application.ownerSeatId) ||
        (application.targetSeatId && !visible.has(application.targetSeatId)) ||
        !mayAccessClassification(access, candidateEvidence.classification)
      )
        throw new EosRouteError(
          404,
          "talent_candidate_evidence_not_found",
          "Candidate evidence not found.",
        );
      const consentScope = Array.isArray(application.consentScope)
        ? application.consentScope.map(String)
        : [];
      if (
        application.consentState !== "granted" ||
        !consentScope.includes("application")
      )
        throw new EosRouteError(
          409,
          "talent_candidate_evidence_consent_missing",
          "Active application-processing consent is required before candidate evidence can be verified.",
        );
      const applicationTrials = await db
        .select()
        .from(eosTalentTrials)
        .where(
          and(
            eq(eosTalentTrials.companyId, access.company.id),
            eq(eosTalentTrials.applicationId, application.id),
            inArray(eosTalentTrials.state, ["submitted", "under_review"]),
          ),
        );
      const linkedTrial = applicationTrials.find((trial) =>
        Array.isArray(trial.candidateEvidenceIds)
          ? trial.candidateEvidenceIds.map(String).includes(candidateEvidence.id)
          : false,
      );
      if (
        linkedTrial &&
        input.workPacketId &&
        input.workPacketId !== linkedTrial.workPacketId
      )
        throw new EosRouteError(
          409,
          "talent_candidate_evidence_trial_packet_mismatch",
          "Trial evidence must be verified into the Trial Work Packet.",
        );
      const workPacketId = linkedTrial?.workPacketId || input.workPacketId;
      if (!workPacketId)
        throw new EosRouteError(
          400,
          "talent_candidate_evidence_work_packet_required",
          "Choose a visible Work Packet for non-Trial candidate evidence.",
        );
      const packet = await db.query.eosWorkPackets.findFirst({
        where: and(
          eq(eosWorkPackets.id, workPacketId),
          eq(eosWorkPackets.companyId, access.company.id),
        ),
      });
      if (
        !packet ||
        !mayAccessClassification(access, packet.classification) ||
        (!access.isOwner &&
          (!packet.accountableSeatId || !visible.has(packet.accountableSeatId)))
      )
        throw new EosRouteError(
          404,
          "work_packet_not_found",
          "Candidate evidence must be promoted into a visible Work Packet.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "approve",
        resource: "talent_candidate_evidence",
        actionKey: "talent_candidate_evidence.promote",
        purpose: "human_verify_candidate_evidence",
        classification: candidateEvidence.classification,
        consequence: "material",
        targetSeatId: application.targetSeatId || application.ownerSeatId,
        evidenceReferences: [candidateEvidence.id],
      });
      const now = new Date();
      const canonicalEvidenceId = randomUUID();
      const canonicalEvidence = {
        id: canonicalEvidenceId,
        companyId: access.company.id,
        workPacketId: packet.id,
        recordedByUserId: req.user.id,
        evidenceType: "artifact",
        title: `Candidate evidence verification — ${candidateEvidence.title}`,
        uri: candidateEvidence.sourceUrl || null,
        details: {
          candidateEvidenceId: candidateEvidence.id,
          applicationId: application.id,
          originalEvidenceType: candidateEvidence.evidenceType,
          fileName: candidateEvidence.fileName || null,
          scanState: candidateEvidence.scanState,
          trialId: linkedTrial?.id || null,
        },
        evidenceKey: commandRecordKey(
          "candidate-evidence",
          candidateEvidence.title,
          canonicalEvidenceId,
        ),
        claimSubjectType: "talent_application",
        claimSubjectKey: application.id,
        verificationState: "verified",
        confidenceQuality: input.confidenceQuality,
        dataClassification: candidateEvidence.classification,
        sourceSystem: "candidate_portal",
        producerProviderKey: "",
        consentRights:
          "Candidate granted application-processing consent; withdrawal expires this verified record.",
        supportedClaimSummary: input.supportedClaimSummary,
        verifierMethod: input.verifierMethod,
        templateLearningEligibility: "not_eligible",
        relatedEventKeys: [],
        relatedDecisionKeys: [],
        schemaVersion: "evidence-v1.0",
        capturedAt: now,
        validFrom: now,
        expiresReviewAt: null,
        createdAt: now,
      };
      const result = await db.transaction(async (tx) => {
        await tx.insert(eosEvidence).values(canonicalEvidence);
        const [changed] = await tx
          .update(eosTalentCandidateEvidence)
          .set({
            state: "promoted",
            promotedEvidenceId: canonicalEvidence.id,
            promotedAt: now,
            promotedByUserId: req.user.id,
            schemaVersion: "talent-candidate-evidence-v1.3",
            updatedAt: now,
          })
          .where(
            and(
              eq(eosTalentCandidateEvidence.id, candidateEvidence.id),
              eq(eosTalentCandidateEvidence.state, "submitted"),
            ),
          )
          .returning();
        if (!changed)
          throw new EosRouteError(
            409,
            "talent_candidate_evidence_concurrent_change",
            "Candidate evidence changed before verification completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "talent_candidate_evidence.promoted",
          targetType: "talent_candidate_evidence",
          targetId: candidateEvidence.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "verified",
          details: {
            canonicalEvidenceId: canonicalEvidence.id,
            workPacketId: packet.id,
            trialId: linkedTrial?.id || null,
            policyDecisionId: policy.decisionId,
            createsPlacementAccessPaymentOrAuthority: false,
          },
          createdAt: now,
        });
        return { candidateEvidence: changed, evidence: canonicalEvidence };
      });
      return { status: 201, body: result };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/talent-candidate-evidence/:evidenceId/rescan",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const [evidence] = await db
        .select()
        .from(eosTalentCandidateEvidence)
        .where(
          and(
            eq(eosTalentCandidateEvidence.id, req.params.evidenceId),
            eq(eosTalentCandidateEvidence.companyId, access.company.id),
          ),
        );
      if (
        !evidence ||
        evidence.state === "withdrawn" ||
        !evidence.storageKey ||
        !evidence.contentSha256 ||
        !evidence.fileSizeBytes
      )
        throw new EosRouteError(
          404,
          "candidate_file_unavailable",
          "Candidate file is not available for scanning.",
        );
      const [application] = await db
        .select()
        .from(eosTalentApplications)
        .where(
          and(
            eq(eosTalentApplications.id, evidence.applicationId),
            eq(eosTalentApplications.companyId, access.company.id),
          ),
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !application ||
        !visible.has(application.ownerSeatId) ||
        (application.targetSeatId && !visible.has(application.targetSeatId)) ||
        !mayAccessClassification(access, evidence.classification)
      )
        throw new EosRouteError(
          404,
          "candidate_file_unavailable",
          "Candidate file is not available for scanning.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "talent_candidate_evidence",
        actionKey: "talent_candidate_file.scan",
        purpose: "security_scan_candidate_supplied_evidence",
        classification: evidence.classification,
        consequence: "material",
        targetSeatId: application.targetSeatId || application.ownerSeatId,
        evidenceReferences: [evidence.id],
      });
      const file = await readCandidateFile(evidence.storageKey);
      if (candidateFileSha256(file) !== evidence.contentSha256)
        throw new EosRouteError(
          409,
          "candidate_file_integrity_failed",
          "Candidate file failed its integrity check and cannot be scanned.",
        );
      const scan = await scanCandidateFile(file, {
        fileName: evidence.fileName,
        mimeType: evidence.fileMimeType,
        sizeBytes: evidence.fileSizeBytes,
        sha256: evidence.contentSha256,
      });
      if (scan.state === "infected")
        await deleteCandidateFile(evidence.storageKey);
      const consentScope = Array.isArray(application.consentScope)
        ? application.consentScope.map(String)
        : [];
      const transcription =
        scan.state === "clean" &&
        evidence.transcriptionRequested &&
        evidence.transcriptionState !== "completed" &&
        consentScope.includes("voice_processing")
          ? await transcribeCandidateAudio(file, {
              fileName: evidence.fileName,
              mimeType: evidence.fileMimeType,
              sizeBytes: evidence.fileSizeBytes,
              sha256: evidence.contentSha256,
            })
          : null;
      const transcriptionState =
        !evidence.transcriptionRequested ||
        evidence.transcriptionState === "completed"
          ? evidence.transcriptionState
          : !consentScope.includes("voice_processing")
            ? "declined"
            : scan.state === "clean"
              ? transcription!.state
              : scan.state === "pending"
                ? "awaiting_scan"
                : "failed";
      const now = new Date();
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentCandidateEvidence)
          .set({
            scanState: scan.state,
            scanEngine: scan.engine,
            scanCompletedAt: scan.completedAt,
            transcriptionState,
            transcript:
              transcription?.transcript ||
              (transcriptionState === "completed" ? evidence.transcript : ""),
            transcriptionProvider:
              transcription?.provider ||
              (transcriptionState === "completed"
                ? evidence.transcriptionProvider
                : null),
            transcriptionModel:
              transcription?.model ||
              (transcriptionState === "completed"
                ? evidence.transcriptionModel
                : null),
            transcriptionCompletedAt:
              transcription?.completedAt ||
              (transcriptionState === "completed"
                ? evidence.transcriptionCompletedAt
                : null),
            updatedAt: now,
          })
          .where(
            and(
              eq(eosTalentCandidateEvidence.id, evidence.id),
              eq(eosTalentCandidateEvidence.scanState, evidence.scanState),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "candidate_file_concurrent_change",
            "Candidate file state changed before the scan was reconciled.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "talent_candidate_file.scanned",
          targetType: "talent_candidate_evidence",
          targetId: evidence.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: scan.state,
          details: {
            scanEngine: scan.engine,
            transcriptionState,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/talent-candidate-evidence/:evidenceId/transcribe",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const [evidence] = await db
        .select()
        .from(eosTalentCandidateEvidence)
        .where(
          and(
            eq(eosTalentCandidateEvidence.id, req.params.evidenceId),
            eq(eosTalentCandidateEvidence.companyId, access.company.id),
          ),
        );
      if (
        !evidence ||
        evidence.state === "withdrawn" ||
        evidence.evidenceType !== "voice_response_file" ||
        !evidence.transcriptionRequested ||
        evidence.scanState !== "clean" ||
        !evidence.storageKey ||
        !evidence.contentSha256 ||
        !evidence.fileSizeBytes
      )
        throw new EosRouteError(
          409,
          "candidate_voice_not_transcribable",
          "Voice evidence must be active, security-cleared, and submitted with a transcription request.",
        );
      if (evidence.transcriptionState === "completed")
        throw new EosRouteError(
          409,
          "candidate_voice_already_transcribed",
          "This voice response already has a completed transcript.",
        );
      const [application] = await db
        .select()
        .from(eosTalentApplications)
        .where(
          and(
            eq(eosTalentApplications.id, evidence.applicationId),
            eq(eosTalentApplications.companyId, access.company.id),
          ),
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !application ||
        !visible.has(application.ownerSeatId) ||
        (application.targetSeatId && !visible.has(application.targetSeatId)) ||
        !mayAccessClassification(access, evidence.classification)
      )
        throw new EosRouteError(
          404,
          "candidate_voice_unavailable",
          "Candidate voice evidence is not available.",
        );
      const consentScope = Array.isArray(application.consentScope)
        ? application.consentScope.map(String)
        : [];
      if (!consentScope.includes("voice_processing"))
        throw new EosRouteError(
          409,
          "candidate_voice_consent_withdrawn",
          "The candidate has not granted active voice-processing consent.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "talent_candidate_evidence",
        actionKey: "talent_candidate_voice.transcribe",
        purpose: "transcribe_candidate_requested_voice_evidence",
        classification: evidence.classification,
        consequence: "material",
        targetSeatId: application.targetSeatId || application.ownerSeatId,
        evidenceReferences: [evidence.id],
      });
      const file = await readCandidateFile(evidence.storageKey);
      if (candidateFileSha256(file) !== evidence.contentSha256)
        throw new EosRouteError(
          409,
          "candidate_file_integrity_failed",
          "Candidate file failed its integrity check and cannot be transcribed.",
        );
      const transcription = await transcribeCandidateAudio(file, {
        fileName: evidence.fileName,
        mimeType: evidence.fileMimeType,
        sizeBytes: evidence.fileSizeBytes,
        sha256: evidence.contentSha256,
      });
      const now = new Date();
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentCandidateEvidence)
          .set({
            transcriptionState: transcription.state,
            transcript: transcription.transcript,
            transcriptionProvider: transcription.provider,
            transcriptionModel: transcription.model,
            transcriptionCompletedAt: transcription.completedAt,
            updatedAt: now,
          })
          .where(
            and(
              eq(eosTalentCandidateEvidence.id, evidence.id),
              eq(
                eosTalentCandidateEvidence.transcriptionState,
                evidence.transcriptionState,
              ),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "candidate_voice_concurrent_change",
            "Voice evidence changed before transcription was reconciled.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "talent_candidate_voice.transcribed",
          targetType: "talent_candidate_evidence",
          targetId: evidence.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: transcription.state,
          details: {
            provider: transcription.provider,
            model: transcription.model,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/talent-needs",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const input = talentNeedCreateSchema.parse(req.body);
      const ownerSeatId = input.ownerSeatId || access.seat.id;
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const seatIds = [ownerSeatId, input.targetSeatId].filter(
        (value): value is string => Boolean(value),
      );
      for (const seatId of seatIds)
        await assertCommandOwnerSeat(access.company.id, seatId, visible);
      const refs = await assertTalentReferences(access.company.id, {
        seatIds,
        capabilityInstanceId: input.capabilityInstanceId,
        evidenceIds: input.evidenceIds,
      });
      const policy = await authorizeAction(req, access, {
        authorityClass: "decide",
        resource: "talent_need",
        actionKey: "talent_need.create",
        purpose: "identify_institutional_capability_gap",
        classification: input.classification,
        consequence: "material",
        targetSeatId: input.targetSeatId || ownerSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        needKey: commandRecordKey("talent-need", input.title, id),
        title: input.title,
        targetSeatId: input.targetSeatId || null,
        capabilityInstanceId: input.capabilityInstanceId || null,
        ownerSeatId,
        state: "identified",
        urgency: input.urgency,
        rationale: input.rationale,
        requiredOutcomes: input.requiredOutcomes,
        requiredNow: input.requiredNow,
        budgetConstraint: input.budgetConstraint,
        evidenceIds: input.evidenceIds,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        schemaVersion: "talent-need-v1.0",
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosTalentNeeds).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "talent_need.created",
          targetType: "talent_need",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "identified",
          details: {
            targetSeatId: record.targetSeatId,
            urgency: record.urgency,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/talent-needs/:needId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const input = talentNeedUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosTalentNeeds)
        .where(
          and(
            eq(eosTalentNeeds.id, req.params.needId),
            eq(eosTalentNeeds.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "talent_need_not_found",
          "Talent need not found.",
        );
      assertMutableTalentProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        (record.targetSeatId && !visible.has(record.targetSeatId)) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "talent_need_not_found",
          "Talent need not found.",
        );
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionTalentNeed(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "talent_need_transition_invalid",
          `Talent need cannot move from ${record.state} to ${input.state}.`,
        );
      const merged = { ...record, ...input };
      const refs = await assertTalentReferences(access.company.id, {
        seatIds: merged.targetSeatId
          ? [merged.targetSeatId, record.ownerSeatId]
          : [record.ownerSeatId],
        capabilityInstanceId: merged.capabilityInstanceId || undefined,
        evidenceIds: merged.evidenceIds as string[],
      });
      if (
        input.state === "open" &&
        (!Array.isArray(merged.requiredOutcomes) ||
          merged.requiredOutcomes.length === 0)
      )
        throw new EosRouteError(
          409,
          "talent_need_outcomes_required",
          "Opening a talent need requires at least one role outcome.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass:
          input.state === "open" || input.state === "filled"
            ? "approve"
            : "decide",
        resource: "talent_need",
        actionKey: input.state
          ? "talent_need.transition"
          : "talent_need.update",
        purpose: "govern_institutional_capability_gap",
        classification: input.classification || record.classification,
        consequence: "material",
        targetSeatId: merged.targetSeatId || record.ownerSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentNeeds)
          .set({ ...input, updatedAt: new Date() })
          .where(
            and(
              eq(eosTalentNeeds.id, record.id),
              eq(eosTalentNeeds.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "talent_need_concurrent_change",
            "The talent need changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state
            ? "talent_need.transitioned"
            : "talent_need.updated",
          targetType: "talent_need",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/talent-applications",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const input = talentApplicationCreateSchema.parse(req.body);
      const ownerSeatId = input.ownerSeatId || access.seat.id;
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const seatIds = [ownerSeatId, input.targetSeatId].filter(
        (value): value is string => Boolean(value),
      );
      for (const seatId of seatIds)
        await assertCommandOwnerSeat(access.company.id, seatId, visible);
      const refs = await assertTalentReferences(access.company.id, {
        seatIds,
        talentNeedId: input.talentNeedId,
        candidateUserId: input.candidateUserId,
        evidenceIds: input.evidenceIds,
      });
      if (
        input.candidateUserId &&
        identityReferenceHash(refs.candidateUser?.email || "") !==
          identityReferenceHash(input.identityReference)
      )
        throw new EosRouteError(
          409,
          "talent_candidate_identity_mismatch",
          "A linked authenticated candidate must use the same normalized email as the canonical candidate identity.",
        );
      if (!refs.need || !["open", "validated"].includes(refs.need.state))
        throw new EosRouteError(
          409,
          "talent_need_not_open",
          "A candidate may enter only against a validated or open institutional need.",
        );
      if (
        input.targetSeatId &&
        refs.need.targetSeatId &&
        input.targetSeatId !== refs.need.targetSeatId
      )
        throw new EosRouteError(
          409,
          "talent_target_mismatch",
          "The candidate target seat must match the selected institutional need; open a distinct need for an alternate role hypothesis.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "talent_application",
        actionKey: "talent_application.create",
        purpose: "invite_candidate_to_governed_process",
        classification: input.classification,
        consequence: "material",
        targetSeatId:
          input.targetSeatId || refs.need.targetSeatId || ownerSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const now = new Date();
      const applicationId = randomUUID();
      const hash = identityReferenceHash(input.identityReference);
      const application = await db.transaction(async (tx) => {
        let [candidate] = await tx
          .select()
          .from(eosStakeholders)
          .where(
            and(
              eq(eosStakeholders.companyId, access.company.id),
              eq(eosStakeholders.identityReferenceHash, hash),
            ),
          )
          .limit(1);
        if (!candidate) {
          const candidateId = randomUUID();
          [candidate] = await tx
            .insert(eosStakeholders)
            .values({
              id: candidateId,
              companyId: access.company.id,
              portfolioId: access.company.portfolioId,
              stakeholderKey: commandRecordKey(
                "person",
                input.candidateName,
                candidateId,
              ),
              name: input.candidateName,
              partyType: "person",
              state: "active",
              ownerSeatId,
              identityReference: input.identityReference,
              identityReferenceHash: hash,
              consentLegalBasis: input.consentLegalBasis,
              relationshipRole: "candidate",
              evidenceKeys: [],
              sourceAuthority: "native_eos",
              classification: "confidential",
              schemaVersion: "stakeholder-party-v1.0",
              recordedByUserId: req.user.id,
              createdAt: now,
              updatedAt: now,
            })
            .returning();
        }
        let [relationship] = await tx
          .select()
          .from(eosStakeholderRelationships)
          .where(
            and(
              eq(eosStakeholderRelationships.companyId, access.company.id),
              eq(eosStakeholderRelationships.stakeholderId, candidate.id),
              eq(eosStakeholderRelationships.relationshipType, "candidate"),
            ),
          )
          .limit(1);
        if (!relationship) {
          const relationshipId = randomUUID();
          [relationship] = await tx
            .insert(eosStakeholderRelationships)
            .values({
              id: relationshipId,
              companyId: access.company.id,
              portfolioId: access.company.portfolioId,
              relationshipKey: commandRecordKey(
                "candidate",
                input.candidateName,
                relationshipId,
              ),
              stakeholderId: candidate.id,
              relationshipType: "candidate",
              title: `Candidate for ${refs.need.title}`,
              state: "active",
              ownerSeatId,
              needConstraint: refs.need.rationale,
              fitHypothesis: input.roleHypotheses.join("; "),
              nextBestAction: "Complete consented intake",
              evidenceKeys: [],
              sourceAuthority: "native_eos",
              classification: "confidential",
              schemaVersion: "stakeholder-relationship-v1.0",
              recordedByUserId: req.user.id,
              createdAt: now,
              updatedAt: now,
            })
            .returning();
        }
        const [created] = await tx
          .insert(eosTalentApplications)
          .values({
            id: applicationId,
            companyId: access.company.id,
            portfolioId: access.company.portfolioId,
            applicationKey: commandRecordKey(
              "talent-application",
              input.candidateName,
              applicationId,
            ),
            candidateStakeholderId: candidate.id,
            candidateUserId: input.candidateUserId || null,
            talentNeedId: input.talentNeedId,
            targetSeatId: input.targetSeatId || refs.need.targetSeatId || null,
            ownerSeatId,
            state: "invited",
            candidateSummary: input.candidateSummary,
            candidateData: input.candidateData,
            candidateCorrection: input.candidateCorrection,
            correctionStatus: input.correctionStatus,
            consentState: input.consentState,
            consentScope: input.consentScope,
            roleHypotheses: input.roleHypotheses,
            proofGaps: input.proofGaps,
            internalNotes: input.internalNotes,
            evidenceIds: input.evidenceIds,
            portalTokenHash: null,
            portalExpiresAt: null,
            sourceAuthority: input.sourceAuthority,
            classification: input.classification,
            schemaVersion: "talent-application-v1.0",
            recordedByUserId: req.user.id,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "talent_application.created",
          targetType: "talent_application",
          targetId: applicationId,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "invited",
          details: {
            candidateStakeholderId: candidate.id,
            talentNeedId: input.talentNeedId,
            relationshipId: relationship.id,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
        return {
          ...created,
          candidate: { id: candidate.id, name: candidate.name },
        };
      });
      return { status: 201, body: application };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/talent-applications/:applicationId/portal-link",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const input = talentPortalIssueSchema.parse(req.body || {});
      const [record] = await db
        .select()
        .from(eosTalentApplications)
        .where(
          and(
            eq(eosTalentApplications.id, req.params.applicationId),
            eq(eosTalentApplications.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "talent_application_not_found",
          "Talent application not found.",
        );
      assertMutableTalentProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        (record.targetSeatId && !visible.has(record.targetSeatId)) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "talent_application_not_found",
          "Talent application not found.",
        );
      if (["activated", "rejected", "withdrawn"].includes(record.state))
        throw new EosRouteError(
          409,
          "talent_application_closed",
          "A portal link cannot be issued for a closed candidate lifecycle.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "talent_application",
        actionKey: "talent_portal.issue",
        purpose: "provide_candidate_controlled_intake",
        classification: record.classification,
        consequence: "material",
        targetSeatId: record.targetSeatId || record.ownerSeatId,
      });
      const secret = createTalentPortalSecret();
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + input.expiresInDays * 86_400_000,
      );
      const retentionUntil = new Date(
        now.getTime() + input.retentionDays * 86_400_000,
      );
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentApplications)
          .set({
            portalTokenHash: talentPortalDigest(secret),
            portalExpiresAt: expiresAt,
            portalRevokedAt: null,
            retentionUntil,
            portalIssueCount: record.portalIssueCount + 1,
            schemaVersion: "talent-application-v1.1",
            updatedAt: now,
          })
          .where(
            and(
              eq(eosTalentApplications.id, record.id),
              eq(
                eosTalentApplications.portalIssueCount,
                record.portalIssueCount,
              ),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "talent_portal_concurrent_change",
            "The candidate portal link changed before issuance completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "talent_portal.issued",
          targetType: "talent_application",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "issued",
          details: {
            expiresAt: expiresAt.toISOString(),
            retentionUntil: retentionUntil.toISOString(),
            issueCount: changed[0].portalIssueCount,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
        return changed;
      });
      return {
        status: 201,
        body: {
          path: talentPortalPath(secret),
          expiresAt: updated.portalExpiresAt,
          retentionUntil: updated.retentionUntil,
          issueCount: updated.portalIssueCount,
          oneTimeSecret: true,
        },
      };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/talent-applications/:applicationId/portal-link/revoke",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const [record] = await db
        .select()
        .from(eosTalentApplications)
        .where(
          and(
            eq(eosTalentApplications.id, req.params.applicationId),
            eq(eosTalentApplications.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "talent_application_not_found",
          "Talent application not found.",
        );
      assertMutableTalentProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        (record.targetSeatId && !visible.has(record.targetSeatId)) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "talent_application_not_found",
          "Talent application not found.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "talent_application",
        actionKey: "talent_portal.revoke",
        purpose: "revoke_candidate_portal_access",
        classification: record.classification,
        consequence: "material",
        targetSeatId: record.targetSeatId || record.ownerSeatId,
      });
      const now = new Date();
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentApplications)
          .set({ portalRevokedAt: now, updatedAt: now })
          .where(eq(eosTalentApplications.id, record.id))
          .returning();
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "talent_portal.revoked",
          targetType: "talent_application",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "revoked",
          details: { policyDecisionId: policy.decisionId },
          createdAt: now,
        });
        return changed;
      });
      const { portalTokenHash: _portalTokenHash, ...safe } = updated;
      return { body: safe };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/talent-applications/:applicationId/candidate-messages",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const input = talentPortalMessageSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosTalentApplications)
        .where(
          and(
            eq(eosTalentApplications.id, req.params.applicationId),
            eq(eosTalentApplications.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "talent_application_not_found",
          "Talent application not found.",
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        (record.targetSeatId && !visible.has(record.targetSeatId)) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "talent_application_not_found",
          "Talent application not found.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "talent_application",
        actionKey: "talent_portal.message",
        purpose: "respond_to_candidate_question",
        classification: record.classification,
        consequence: "routine",
        targetSeatId: record.targetSeatId || record.ownerSeatId,
      });
      const now = new Date();
      const id = randomUUID();
      const message = {
        id,
        companyId: access.company.id,
        applicationId: record.id,
        direction: "team_to_candidate",
        body: input.message,
        sentByUserId: req.user.id,
        createdAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosTalentCandidateMessages).values(message);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "talent_portal.message_sent",
          targetType: "talent_application",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "sent",
          details: { messageId: id, policyDecisionId: policy.decisionId },
          createdAt: now,
        });
        await tx.insert(eosTalentPortalEvents).values({
          id: randomUUID(),
          companyId: access.company.id,
          applicationId: record.id,
          eventType: "team_message_sent",
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          details: { messageId: id },
          createdAt: now,
        });
      });
      return { status: 201, body: message };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/talent-scheduling",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const input = talentSchedulingCreateSchema.parse(req.body);
      const [application] = await db
        .select()
        .from(eosTalentApplications)
        .where(
          and(
            eq(eosTalentApplications.id, input.applicationId),
            eq(eosTalentApplications.companyId, access.company.id),
          ),
        );
      if (
        !application ||
        ["activated", "rejected", "withdrawn"].includes(application.state)
      )
        throw new EosRouteError(
          404,
          "talent_application_not_found",
          "An open talent application is required for scheduling.",
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(application.ownerSeatId) ||
        (application.targetSeatId && !visible.has(application.targetSeatId)) ||
        !mayAccessClassification(access, application.classification)
      )
        throw new EosRouteError(
          404,
          "talent_application_not_found",
          "Talent application not found.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "talent_scheduling",
        actionKey: "talent_scheduling.propose",
        purpose: "coordinate_candidate_conversation",
        classification: application.classification,
        consequence: "material",
        targetSeatId: application.targetSeatId || application.ownerSeatId,
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        applicationId: application.id,
        schedulingKind: input.schedulingKind,
        state: "proposed",
        proposedSlots: input.proposedSlots,
        selectedSlot: null,
        durationMinutes: input.durationMinutes,
        schedulingUrl: input.schedulingUrl,
        teamNote: input.teamNote,
        candidateTimezone: "",
        candidateAvailability: "",
        candidateMessage: "",
        sourceSystem: input.sourceSystem,
        externalEventReference: input.externalEventReference || null,
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosTalentSchedulingRequests).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "talent_scheduling.proposed",
          targetType: "talent_scheduling",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "proposed",
          details: {
            applicationId: application.id,
            schedulingKind: input.schedulingKind,
            slotCount: input.proposedSlots.length,
            sourceSystem: input.sourceSystem,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/talent-scheduling/:schedulingId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const input = talentSchedulingUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosTalentSchedulingRequests)
        .where(
          and(
            eq(eosTalentSchedulingRequests.id, req.params.schedulingId),
            eq(eosTalentSchedulingRequests.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "talent_scheduling_not_found",
          "Scheduling request not found.",
        );
      const [application] = await db
        .select()
        .from(eosTalentApplications)
        .where(
          and(
            eq(eosTalentApplications.id, record.applicationId),
            eq(eosTalentApplications.companyId, access.company.id),
          ),
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !application ||
        !visible.has(application.ownerSeatId) ||
        (application.targetSeatId && !visible.has(application.targetSeatId)) ||
        !mayAccessClassification(access, application.classification)
      )
        throw new EosRouteError(
          404,
          "talent_scheduling_not_found",
          "Scheduling request not found.",
        );
      const nextState = input.proposedSlots
        ? "proposed"
        : input.state || record.state;
      if (["cancelled", "completed"].includes(record.state))
        throw new EosRouteError(
          409,
          "talent_scheduling_closed",
          "A closed scheduling request cannot be changed.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: nextState === "completed" ? "decide" : "execute",
        resource: "talent_scheduling",
        actionKey: "talent_scheduling.update",
        purpose: "coordinate_candidate_conversation",
        classification: application.classification,
        consequence: "material",
        targetSeatId: application.targetSeatId || application.ownerSeatId,
      });
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentSchedulingRequests)
          .set({
            ...input,
            state: nextState,
            selectedSlot: input.proposedSlots ? null : record.selectedSlot,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(eosTalentSchedulingRequests.id, record.id),
              eq(eosTalentSchedulingRequests.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "talent_scheduling_concurrent_change",
            "The scheduling request changed before this update completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "talent_scheduling.updated",
          targetType: "talent_scheduling",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            sourceSystem: changed[0].sourceSystem,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/talent-applications/:applicationId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const input = talentApplicationUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosTalentApplications)
        .where(
          and(
            eq(eosTalentApplications.id, req.params.applicationId),
            eq(eosTalentApplications.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "talent_application_not_found",
          "Talent application not found.",
        );
      assertMutableTalentProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        (record.targetSeatId && !visible.has(record.targetSeatId)) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "talent_application_not_found",
          "Talent application not found.",
        );
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionTalentApplication(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "talent_application_transition_invalid",
          `Talent application cannot move from ${record.state} to ${input.state}.`,
        );
      if (
        input.state === "trial_active" ||
        (record.state === "trial_active" && input.state === "decision")
      )
        throw new EosRouteError(
          409,
          "talent_trial_lifecycle_required",
          "Start and complete the application trial through its governed Trial workspace.",
        );
      const merged = { ...record, ...input };
      const refs = await assertTalentReferences(access.company.id, {
        seatIds: merged.targetSeatId
          ? [merged.targetSeatId, record.ownerSeatId]
          : [record.ownerSeatId],
        candidateUserId: merged.candidateUserId || undefined,
        evidenceIds: merged.evidenceIds as string[],
      });
      const [
        reviewedAssessments,
        signedReviewPackets,
        acceptedTrials,
        completedTrials,
      ] = await Promise.all([
        db
          .select({ id: eosTalentAssessments.id })
          .from(eosTalentAssessments)
          .where(
            and(
              eq(eosTalentAssessments.applicationId, record.id),
              eq(eosTalentAssessments.state, "reviewed"),
            ),
          ),
        db
          .select({ id: eosTalentReviewPackets.id })
          .from(eosTalentReviewPackets)
          .where(
            and(
              eq(eosTalentReviewPackets.applicationId, record.id),
              eq(eosTalentReviewPackets.state, "signed_off"),
            ),
          ),
        db
          .select({ id: eosTalentTrials.id })
          .from(eosTalentTrials)
          .where(
            and(
              eq(eosTalentTrials.applicationId, record.id),
              inArray(eosTalentTrials.state, [
                "accepted",
                "active",
                "submitted",
                "under_review",
              ]),
            ),
          ),
        db
          .select({ id: eosTalentTrials.id })
          .from(eosTalentTrials)
          .where(
            and(
              eq(eosTalentTrials.applicationId, record.id),
              inArray(eosTalentTrials.state, [
                "passed",
                "redirected",
                "extended",
                "failed",
              ]),
            ),
          ),
      ]);
      const issues = input.state
        ? talentApplicationAdvancementIssues(
            merged,
            input.state,
            reviewedAssessments.length,
            signedReviewPackets.length,
            acceptedTrials.length,
            completedTrials.length,
            record.state,
          )
        : [];
      if (issues.length)
        throw new EosRouteError(
          409,
          "talent_application_evidence_required",
          `Application advancement requires: ${issues.join(", ")}.`,
        );
      if (
        input.state &&
        ["decision", "onboarding", "activated"].includes(input.state) &&
        refs.evidence.some((item) => item.verificationState !== "verified")
      )
        throw new EosRouteError(
          409,
          "talent_application_verified_evidence_required",
          "Consequential recruiting stages require verified evidence.",
        );
      if (input.state && ["onboarding", "activated"].includes(input.state)) {
        const [placement] = await db
          .select()
          .from(eosTalentPlacements)
          .where(eq(eosTalentPlacements.applicationId, record.id));
        const acceptable =
          input.state === "onboarding"
            ? ["offer_accepted", "onboarding", "activated"]
            : ["activated"];
        if (!placement || !acceptable.includes(placement.state))
          throw new EosRouteError(
            409,
            "talent_placement_required",
            "Onboarding and activation require an approved placement record in the corresponding state.",
          );
      }
      const policy = await authorizeAction(req, access, {
        authorityClass:
          input.state &&
          ["decision", "onboarding", "activated", "rejected"].includes(
            input.state,
          )
            ? "approve"
            : "decide",
        resource: "talent_application",
        actionKey: input.state
          ? "talent_application.transition"
          : "talent_application.update",
        purpose: "govern_candidate_evidence_and_next_step",
        classification: input.classification || record.classification,
        consequence: "material",
        targetSeatId: merged.targetSeatId || record.ownerSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const [updated] = await db.transaction(async (tx) => {
        const now = new Date();
        const changed = await tx
          .update(eosTalentApplications)
          .set({ ...input, updatedAt: now })
          .where(
            and(
              eq(eosTalentApplications.id, record.id),
              eq(eosTalentApplications.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "talent_application_concurrent_change",
            "The talent application changed before this action completed.",
          );
        const cancelledReviewPackets =
          input.state && ["rejected", "withdrawn"].includes(input.state)
            ? await tx
                .update(eosTalentReviewPackets)
                .set({ state: "cancelled", updatedAt: now })
                .where(
                  and(
                    eq(eosTalentReviewPackets.applicationId, record.id),
                    inArray(eosTalentReviewPackets.state, [
                      "draft",
                      "ready_for_review",
                      "in_review",
                    ]),
                  ),
                )
                .returning({ id: eosTalentReviewPackets.id })
            : [];
        const cancelledTrials =
          input.state && ["rejected", "withdrawn"].includes(input.state)
            ? await tx
                .update(eosTalentTrials)
                .set({ state: "cancelled", updatedAt: now })
                .where(
                  and(
                    eq(eosTalentTrials.applicationId, record.id),
                    inArray(eosTalentTrials.state, [
                      "draft",
                      "approved",
                      "offered",
                      "accepted",
                      "active",
                      "submitted",
                      "under_review",
                    ]),
                  ),
                )
                .returning({ id: eosTalentTrials.id })
            : [];
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state
            ? "talent_application.transitioned"
            : "talent_application.updated",
          targetType: "talent_application",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            correctionStatus: changed[0].correctionStatus,
            cancelledOpenReviewPacketCount: cancelledReviewPackets.length,
            cancelledOpenTrialCount: cancelledTrials.length,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
        return changed;
      });
      const { portalTokenHash: _portalTokenHash, ...safe } = updated;
      return { body: safe };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/talent-review-packets",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const input = talentReviewPacketCreateSchema.parse(req.body);
      const refs = await assertTalentReferences(access.company.id, {
        applicationId: input.applicationId,
        evidenceIds: reviewPacketEvidenceIds(input),
      });
      const application = refs.application;
      if (
        !application ||
        ["activated", "rejected", "withdrawn"].includes(application.state)
      )
        throw new EosRouteError(
          409,
          "talent_review_application_closed",
          "A human review packet requires an open candidate lifecycle.",
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(application.ownerSeatId) ||
        (application.targetSeatId && !visible.has(application.targetSeatId)) ||
        !mayAccessClassification(access, input.classification)
      )
        throw new EosRouteError(
          404,
          "talent_application_not_found",
          "Talent application not found.",
        );
      const proofGaps = input.proofGaps.length
        ? input.proofGaps
        : Array.isArray(application.proofGaps)
          ? application.proofGaps.map(String)
          : [];
      const snapshot = await currentTalentReviewSnapshot(
        access.company.id,
        application,
        input,
      );
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "talent_review_packet",
        actionKey: "talent_review_packet.create",
        purpose: "organize_candidate_evidence_for_human_review",
        classification: input.classification,
        consequence: "material",
        targetSeatId: application.targetSeatId || application.ownerSeatId,
        evidenceReferences: snapshot.verifiedEvidenceIds,
      });
      const [latest] = await db
        .select({ version: eosTalentReviewPackets.version })
        .from(eosTalentReviewPackets)
        .where(
          and(
            eq(eosTalentReviewPackets.companyId, access.company.id),
            eq(eosTalentReviewPackets.applicationId, application.id),
          ),
        )
        .orderBy(desc(eosTalentReviewPackets.version))
        .limit(1);
      const id = randomUUID();
      const version = (latest?.version || 0) + 1;
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        applicationId: application.id,
        packetKey: commandRecordKey("talent-review-packet", application.id, id),
        version,
        state: "draft",
        ...snapshot,
        roleAssessments: input.roleAssessments,
        outcomeCoverage: input.outcomeCoverage,
        proofGaps,
        nextAssessment: input.nextAssessment,
        interviewFocus: input.interviewFocus,
        teamFitQuestions: input.teamFitQuestions,
        packetSummary: input.packetSummary,
        materializedAssessmentId: null,
        reviewerSeatId: access.seat.id,
        reviewerDecision: "",
        reviewerRationale: "",
        signedOffAt: null,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        schemaVersion: "talent-review-packet-v1.0",
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await db.transaction(async (tx) => {
          await tx.insert(eosTalentReviewPackets).values(record);
          await tx.insert(eosAuditRecords).values({
            id: randomUUID(),
            companyId: access.company.id,
            actorUserId: req.user.id,
            action: "talent_review_packet.created",
            targetType: "talent_review_packet",
            targetId: id,
            traceId: policy.traceId,
            correlationId: policy.correlationId,
            result: "draft",
            details: {
              applicationId: application.id,
              version,
              roleCount: input.roleAssessments.length,
              proofGapCount: proofGaps.length,
              policyDecisionId: policy.decisionId,
            },
            createdAt: now,
          });
        });
      } catch (error: any) {
        if (isUniqueViolation(error))
          throw new EosRouteError(
            409,
            "talent_review_packet_open_exists",
            "Finish or cancel the current human review packet before opening another version.",
          );
        throw error;
      }
      return {
        status: 201,
        body: {
          ...record,
          readinessIssues: talentReviewPacketReadinessIssues(record),
          sourceStale: false,
        },
      };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/talent-review-packets/:packetId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const input = talentReviewPacketUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosTalentReviewPackets)
        .where(
          and(
            eq(eosTalentReviewPackets.id, req.params.packetId),
            eq(eosTalentReviewPackets.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "talent_review_packet_not_found",
          "Human review packet not found.",
        );
      assertMutableTalentProjection(record);
      const [application] = await db
        .select()
        .from(eosTalentApplications)
        .where(
          and(
            eq(eosTalentApplications.id, record.applicationId),
            eq(eosTalentApplications.companyId, access.company.id),
          ),
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !application ||
        !visible.has(application.ownerSeatId) ||
        (application.targetSeatId && !visible.has(application.targetSeatId)) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "talent_review_packet_not_found",
          "Human review packet not found.",
        );
      const target = input.state || record.state;
      if (
        ["activated", "rejected", "withdrawn"].includes(application.state) &&
        target !== "cancelled"
      )
        throw new EosRouteError(
          409,
          "talent_application_closed",
          "Only cancellation is available after the candidate lifecycle closes.",
        );
      const contentFields = [
        "packetSummary",
        "roleAssessments",
        "outcomeCoverage",
        "proofGaps",
        "nextAssessment",
        "interviewFocus",
        "teamFitQuestions",
        "classification",
      ];
      if (
        record.state !== "draft" &&
        contentFields.some((field) => field in input)
      )
        throw new EosRouteError(
          409,
          "talent_review_packet_content_locked",
          "Return the packet to draft before changing its evidence synthesis.",
        );
      if (
        ("reviewerDecision" in input || "reviewerRationale" in input) &&
        !["in_review", "signed_off"].includes(record.state) &&
        input.state !== "signed_off"
      )
        throw new EosRouteError(
          409,
          "talent_review_packet_signoff_not_ready",
          "Reviewer recommendation and rationale are recorded during human review.",
        );
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionTalentReviewPacket(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "talent_review_packet_transition_invalid",
          `Human review packet cannot move from ${record.state} to ${input.state}.`,
        );
      const merged = { ...record, ...input };
      const snapshot = await currentTalentReviewSnapshot(
        access.company.id,
        application,
        merged,
      );
      const issues = talentReviewPacketReadinessIssues(
        { ...merged, ...snapshot },
        target,
      );
      if (issues.length)
        throw new EosRouteError(
          409,
          "talent_review_packet_incomplete",
          `Human review packet requires: ${issues.join(", ")}.`,
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: target === "signed_off" ? "approve" : "decide",
        resource: "talent_review_packet",
        actionKey:
          target === "signed_off"
            ? "talent_review_packet.sign_off"
            : input.state
              ? "talent_review_packet.transition"
              : "talent_review_packet.update",
        purpose: "prepare_attributable_human_candidate_review",
        classification: input.classification || record.classification,
        consequence: "material",
        targetSeatId: application.targetSeatId || application.ownerSeatId,
        evidenceReferences: snapshot.verifiedEvidenceIds,
      });
      const now = new Date();
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentReviewPackets)
          .set({
            ...input,
            ...snapshot,
            reviewerSeatId:
              target === "signed_off" ? access.seat.id : record.reviewerSeatId,
            signedOffAt: target === "signed_off" ? now : record.signedOffAt,
            updatedAt: now,
          })
          .where(
            and(
              eq(eosTalentReviewPackets.id, record.id),
              eq(eosTalentReviewPackets.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "talent_review_packet_concurrent_change",
            "The review packet changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action:
            target === "signed_off"
              ? "talent_review_packet.signed_off"
              : input.state
                ? "talent_review_packet.transitioned"
                : "talent_review_packet.updated",
          targetType: "talent_review_packet",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            recommendation: changed[0].reviewerDecision || null,
            applicationStateChanged: false,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
        return changed;
      });
      return {
        body: {
          ...updated,
          readinessIssues: talentReviewPacketReadinessIssues(updated),
          sourceStale: false,
        },
      };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/talent-review-packets/:packetId/refresh",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const [record] = await db
        .select()
        .from(eosTalentReviewPackets)
        .where(
          and(
            eq(eosTalentReviewPackets.id, req.params.packetId),
            eq(eosTalentReviewPackets.companyId, access.company.id),
          ),
        );
      if (!record || record.state !== "draft")
        throw new EosRouteError(
          409,
          "talent_review_packet_refresh_unavailable",
          "Only a current draft review packet can refresh its evidence snapshot.",
        );
      assertMutableTalentProjection(record);
      const refs = await assertTalentReferences(access.company.id, {
        applicationId: record.applicationId,
      });
      const application = refs.application;
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !application ||
        !visible.has(application.ownerSeatId) ||
        (application.targetSeatId && !visible.has(application.targetSeatId)) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "talent_review_packet_not_found",
          "Human review packet not found.",
        );
      if (["activated", "rejected", "withdrawn"].includes(application.state))
        throw new EosRouteError(
          409,
          "talent_application_closed",
          "A review packet cannot refresh after the candidate lifecycle closes.",
        );
      const snapshot = await currentTalentReviewSnapshot(
        access.company.id,
        application,
        record,
      );
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "talent_review_packet",
        actionKey: "talent_review_packet.refresh",
        purpose: "refresh_candidate_evidence_snapshot",
        classification: record.classification,
        consequence: "routine",
        targetSeatId: application.targetSeatId || application.ownerSeatId,
        evidenceReferences: snapshot.verifiedEvidenceIds,
      });
      const now = new Date();
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentReviewPackets)
          .set({ ...snapshot, updatedAt: now })
          .where(
            and(
              eq(eosTalentReviewPackets.id, record.id),
              eq(eosTalentReviewPackets.state, "draft"),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "talent_review_packet_concurrent_change",
            "The review packet changed before refresh completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "talent_review_packet.refreshed",
          targetType: "talent_review_packet",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "draft",
          details: {
            assessmentCount: snapshot.assessmentIds.length,
            candidateEvidenceCount: snapshot.candidateEvidenceIds.length,
            verifiedEvidenceCount: snapshot.verifiedEvidenceIds.length,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
        return changed;
      });
      return {
        body: {
          ...updated,
          readinessIssues: talentReviewPacketReadinessIssues(updated),
          sourceStale: false,
        },
      };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/talent-review-packets/:packetId/materialize-next-assessment",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const [record] = await db
        .select()
        .from(eosTalentReviewPackets)
        .where(
          and(
            eq(eosTalentReviewPackets.id, req.params.packetId),
            eq(eosTalentReviewPackets.companyId, access.company.id),
          ),
        );
      if (
        !record ||
        !["ready_for_review", "in_review", "signed_off"].includes(
          record.state,
        ) ||
        record.materializedAssessmentId
      )
        throw new EosRouteError(
          409,
          "talent_review_next_assessment_unavailable",
          "A reviewed, unmaterialized next-assessment recommendation is required.",
        );
      assertMutableTalentProjection(record);
      const nextAssessment = talentNextAssessmentSchema.parse(
        record.nextAssessment,
      );
      const refs = await assertTalentReferences(access.company.id, {
        applicationId: record.applicationId,
      });
      const application = refs.application;
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !application ||
        ["activated", "rejected", "withdrawn"].includes(application.state) ||
        !visible.has(application.ownerSeatId) ||
        (application.targetSeatId && !visible.has(application.targetSeatId)) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "talent_review_packet_not_found",
          "Human review packet not found.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "talent_assessment",
        actionKey: "talent_review_packet.materialize_next_assessment",
        purpose: "turn_human_review_recommendation_into_planned_assessment",
        classification: record.classification,
        consequence: "material",
        targetSeatId: application.targetSeatId || application.ownerSeatId,
        evidenceReferences: Array.isArray(record.verifiedEvidenceIds)
          ? record.verifiedEvidenceIds.map(String)
          : [],
      });
      const id = randomUUID();
      const now = new Date();
      const assessment = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(eosTalentAssessments)
          .values({
            id,
            companyId: access.company.id,
            applicationId: application.id,
            assessmentKey: commandRecordKey(
              "review-recommended-assessment",
              record.id,
              id,
            ),
            assessmentType: nextAssessment.assessmentType,
            title: nextAssessment.title,
            state: "planned",
            decisionQuestion: nextAssessment.decisionQuestion,
            evidenceExpected: nextAssessment.evidenceExpected,
            validityScope: `Review packet ${record.id} version ${record.version}; recommendation only until separately activated.`,
            candidateBurden: nextAssessment.candidateBurden,
            candidateSubmission: "",
            internalEvaluation: "",
            consentRequired: nextAssessment.consentRequired,
            consentCaptured: false,
            generationMode: "manual",
            generatedSequence: null,
            generationModel: null,
            generationGovernanceVersion: null,
            generationInputSha256: null,
            generationRationale: nextAssessment.rationale,
            informationGap: Array.isArray(record.proofGaps)
              ? record.proofGaps.map(String).join("; ").slice(0, 4000)
              : "",
            roleHypothesesSnapshot: record.roleHypothesesSnapshot,
            evidenceIds: [],
            sourceAuthority: "native_eos",
            classification: record.classification,
            schemaVersion: "talent-assessment-v1.1",
            recordedByUserId: req.user.id,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        const linked = await tx
          .update(eosTalentReviewPackets)
          .set({ materializedAssessmentId: id, updatedAt: now })
          .where(
            and(
              eq(eosTalentReviewPackets.id, record.id),
              isNull(eosTalentReviewPackets.materializedAssessmentId),
            ),
          )
          .returning();
        if (!linked[0])
          throw new EosRouteError(
            409,
            "talent_review_next_assessment_concurrent_change",
            "The next assessment was already materialized.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "talent_review_packet.next_assessment_materialized",
          targetType: "talent_review_packet",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "planned",
          details: {
            assessmentId: id,
            applicationStateChanged: false,
            candidateActionOpened: false,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
        return created;
      });
      return { status: 201, body: assessment };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/talent-trials",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const input = talentTrialCreateSchema.parse(req.body);
      const [application, targetSeat] = await Promise.all([
        db.query.eosTalentApplications.findFirst({
          where: and(
            eq(eosTalentApplications.id, input.applicationId),
            eq(eosTalentApplications.companyId, access.company.id),
          ),
        }),
        db.query.eosSeats.findFirst({
          where: and(
            eq(eosSeats.id, input.targetSeatId),
            eq(eosSeats.companyId, access.company.id),
            eq(eosSeats.status, "active"),
          ),
        }),
      ]);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !application ||
        !targetSeat ||
        application.state !== "trial_recommended" ||
        !visible.has(application.ownerSeatId) ||
        !visible.has(targetSeat.id) ||
        (application.targetSeatId && application.targetSeatId !== targetSeat.id) ||
        !mayAccessClassification(access, input.classification)
      )
        throw new EosRouteError(
          409,
          "talent_trial_application_unavailable",
          "A visible trial-recommended application and its exact active target seat are required.",
        );
      const [reviewPacket] = await db
        .select()
        .from(eosTalentReviewPackets)
        .where(
          and(
            eq(eosTalentReviewPackets.applicationId, application.id),
            eq(eosTalentReviewPackets.state, "signed_off"),
            eq(eosTalentReviewPackets.reviewerDecision, "trial_recommended"),
          ),
        )
        .orderBy(desc(eosTalentReviewPackets.version))
        .limit(1);
      if (!reviewPacket)
        throw new EosRouteError(
          409,
          "talent_trial_human_recommendation_required",
          "A signed human review packet recommending a trial is required.",
        );
      const reviewAt = new Date(input.reviewAt);
      if (reviewAt.getTime() <= Date.now())
        throw new EosRouteError(
          409,
          "talent_trial_review_time_invalid",
          "The trial review date must be in the future.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "talent_trial",
        actionKey: "talent_trial.propose",
        purpose: "propose_bounded_paid_trial",
        classification: input.classification,
        consequence: "material",
        targetSeatId: targetSeat.id,
        evidenceReferences: Array.isArray(reviewPacket.verifiedEvidenceIds)
          ? reviewPacket.verifiedEvidenceIds.map(String)
          : [],
      });
      const approver = await approverFor(
        access.company,
        access.seat,
        input.classification,
      );
      const [previous] = await db
        .select({ version: eosTalentTrials.version })
        .from(eosTalentTrials)
        .where(eq(eosTalentTrials.applicationId, application.id))
        .orderBy(desc(eosTalentTrials.version))
        .limit(1);
      const version = (previous?.version || 0) + 1;
      const id = randomUUID();
      const workPacketId = randomUUID();
      const approvalId = randomUUID();
      const now = new Date();
      const { traceId, correlationId } = tracePair();
      const record = {
        id,
        companyId: access.company.id,
        applicationId: application.id,
        targetSeatId: targetSeat.id,
        reviewPacketId: reviewPacket.id,
        trialKey: commandRecordKey("talent-trial", application.id, String(version)),
        version,
        state: "draft",
        title: input.title,
        question: input.question,
        durationDays: input.durationDays,
        compensationAmountMinor: input.compensationAmountMinor,
        compensationCurrency: input.compensationCurrency,
        compensationTerms: input.compensationTerms,
        legalAgreementReference: input.legalAgreementReference,
        jurisdiction: input.jurisdiction,
        inputsSupport: input.inputsSupport,
        requiredOutputs: input.requiredOutputs,
        scorecard: input.scorecard,
        constraintsDecisionRights: input.constraintsDecisionRights,
        observationPoints: input.observationPoints,
        reviewAt,
        outcomeCriteria: input.outcomeCriteria,
        candidateInstructions: input.candidateInstructions,
        predictedOutcome: input.predictedOutcome,
        predictedConfidence: input.predictedConfidence,
        workPacketId,
        approvalId,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        schemaVersion: "talent-trial-v1.0",
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      } as const;
      try {
        await db.transaction(async (tx) => {
          await tx.insert(eosWorkPackets).values({
            id: workPacketId,
            companyId: access.company.id,
            createdByUserId: req.user.id,
            accountableUserId: req.user.id,
            accountableSeatId: targetSeat.id,
            title: `Approve paid trial: ${input.title}`,
            objective: input.question,
            status: "awaiting_approval",
            priority: "high",
            source: "manual",
            visibility: "reporting_tree",
            classification: input.classification,
            requiresApproval: true,
            toolPack: [],
            evidenceRequirements: [
              "Candidate acceptance of disclosed terms",
              "Submitted trial output",
              "Verified trial outcome evidence",
            ],
            expectedOutput: input.requiredOutputs.join("; "),
            acceptanceCriteria: input.outcomeCriteria.pass,
            constraintsPolicies: input.constraintsDecisionRights.join("; "),
            failureEscalationCompensation:
              `${input.outcomeCriteria.fail}; compensation remains governed by ${input.legalAgreementReference}.`.slice(
                0,
                3000,
              ),
            humanFallback: "Pause the trial, preserve candidate rights, and route exceptions to the accountable human reviewer.",
            sourceLineage: `Review packet ${reviewPacket.id} version ${reviewPacket.version}.`,
            outputArtifactKeys: [],
            traceId,
            correlationId,
            dueAt: reviewAt,
            createdAt: now,
            updatedAt: now,
          });
          await tx.insert(eosApprovalRequests).values({
            id: approvalId,
            companyId: access.company.id,
            workPacketId,
            requestedByUserId: req.user.id,
            assignedToUserId: approver.userId,
            assignedToSeatId: approver.seatId,
            summary: `Authorize paid candidate trial: ${input.title}`,
            status: "pending",
            createdAt: now,
          });
          await tx.insert(eosTalentTrials).values(record);
          await tx.insert(eosAuditRecords).values({
            id: randomUUID(),
            companyId: access.company.id,
            actorUserId: req.user.id,
            action: "talent_trial.proposed",
            targetType: "talent_trial",
            targetId: id,
            traceId: policy.traceId || traceId,
            correlationId: policy.correlationId || correlationId,
            result: "awaiting_approval",
            details: {
              workPacketId,
              approvalId,
              reviewPacketId: reviewPacket.id,
              applicationStateChanged: false,
              seatAssignmentCreated: false,
              accessOrAuthorityGranted: false,
              paymentExecuted: false,
              policyDecisionId: policy.decisionId,
            },
            createdAt: now,
          });
        });
      } catch (error: any) {
        if (error?.code === "23505")
          throw new EosRouteError(
            409,
            "talent_trial_open_exists",
            "This application already has an open governed trial.",
          );
        throw error;
      }
      return {
        status: 201,
        body: { ...record, approvalStatus: "pending", readinessIssues: [] },
      };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/talent-trials/:trialId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const input = talentTrialUpdateSchema.parse(req.body);
      if (["approved", "accepted", "submitted"].includes(input.state))
        throw new EosRouteError(
          409,
          "talent_trial_actor_boundary",
          "Approval and candidate actions must use their dedicated actor boundary.",
        );
      const [record] = await db
        .select()
        .from(eosTalentTrials)
        .where(
          and(
            eq(eosTalentTrials.id, req.params.trialId),
            eq(eosTalentTrials.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(404, "talent_trial_not_found", "Trial not found.");
      assertMutableTalentProjection(record);
      const [[application], [approval]] = await Promise.all([
        db
          .select()
          .from(eosTalentApplications)
          .where(
            and(
              eq(eosTalentApplications.id, record.applicationId),
              eq(eosTalentApplications.companyId, access.company.id),
            ),
          ),
        db
          .select()
          .from(eosApprovalRequests)
          .where(eq(eosApprovalRequests.id, record.approvalId)),
      ]);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !application ||
        !approval ||
        !visible.has(application.ownerSeatId) ||
        !visible.has(record.targetSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(404, "talent_trial_not_found", "Trial not found.");
      if (!canTransitionTalentTrial(record.state as any, input.state))
        throw new EosRouteError(
          409,
          "talent_trial_transition_invalid",
          `Trial cannot move from ${record.state} to ${input.state}.`,
        );
      if (input.state === "offered" && application.state !== "trial_recommended")
        throw new EosRouteError(
          409,
          "talent_trial_application_state_invalid",
          "A trial can be offered only while the application is trial recommended.",
        );
      if (input.state === "active" && application.state !== "trial_recommended")
        throw new EosRouteError(
          409,
          "talent_trial_application_state_invalid",
          "An accepted trial can start only from the trial-recommended application stage.",
        );
      const outcomeStates = ["passed", "redirected", "extended", "failed"];
      if (outcomeStates.includes(input.state) && application.state !== "trial_active")
        throw new EosRouteError(
          409,
          "talent_trial_application_state_invalid",
          "A trial outcome can be recorded only for an active trial application.",
        );
      const candidateEvidenceIds = Array.isArray(record.candidateEvidenceIds)
        ? record.candidateEvidenceIds.map(String)
        : [];
      let candidateEvidenceRecords: Array<
        typeof eosTalentCandidateEvidence.$inferSelect
      > = [];
      if (["under_review", ...outcomeStates].includes(input.state)) {
        candidateEvidenceRecords = candidateEvidenceIds.length
          ? await db
              .select()
              .from(eosTalentCandidateEvidence)
              .where(
                and(
                  eq(eosTalentCandidateEvidence.companyId, access.company.id),
                  eq(eosTalentCandidateEvidence.applicationId, record.applicationId),
                  inArray(eosTalentCandidateEvidence.id, candidateEvidenceIds),
                ),
              )
          : [];
        const candidateEvidenceAvailable = candidateEvidenceRecords.every(
          (item) =>
            ["submitted", "promoted"].includes(item.state) &&
            (item.storageKey
              ? item.scanState === "clean"
              : item.scanState === "not_applicable"),
        );
        if (
          candidateEvidenceRecords.length !== candidateEvidenceIds.length ||
          !candidateEvidenceAvailable
        )
          throw new EosRouteError(
            409,
            "talent_trial_candidate_evidence_unavailable",
            "The candidate trial evidence must remain available and safe for human review.",
          );
      }
      const refs = await assertTalentReferences(access.company.id, {
        evidenceIds: input.outcomeEvidenceIds || [],
      });
      const verifiedEvidenceCount = refs.evidence.filter(
        (item) => item.verificationState === "verified",
      ).length;
      if (outcomeStates.includes(input.state)) {
        const outcomeEvidenceIds = new Set(input.outcomeEvidenceIds || []);
        const allCandidateEvidencePromoted = candidateEvidenceRecords.every(
          (item) =>
            item.state === "promoted" &&
            Boolean(item.promotedEvidenceId) &&
            outcomeEvidenceIds.has(String(item.promotedEvidenceId)),
        );
        if (!allCandidateEvidencePromoted)
          throw new EosRouteError(
            409,
            "talent_trial_candidate_evidence_unverified",
            "Every candidate trial submission must be human-verified into canonical Evidence and cited in the outcome.",
          );
        if (
          refs.evidence.some(
            (item) => item.workPacketId !== record.workPacketId,
          )
        )
          throw new EosRouteError(
            409,
            "talent_trial_evidence_packet_mismatch",
            "Every Trial outcome evidence record must belong to the Trial Work Packet.",
          );
      }
      const merged = {
        ...record,
        ...input,
        approvalStatus: approval.status,
      };
      const issues = talentTrialAdvancementIssues(
        merged,
        input.state,
        verifiedEvidenceCount,
      );
      if (issues.length)
        throw new EosRouteError(
          409,
          "talent_trial_incomplete",
          `Trial advancement requires: ${issues.join(", ")}.`,
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: outcomeStates.includes(input.state)
          ? "approve"
          : input.state === "active"
            ? "execute"
            : "decide",
        resource: "talent_trial",
        actionKey: `talent_trial.${input.state}`,
        purpose: "govern_bounded_trial_and_evidence",
        classification: record.classification,
        consequence: outcomeStates.includes(input.state) ? "material" : "routine",
        targetSeatId: record.targetSeatId,
        evidenceReferences: input.outcomeEvidenceIds || [],
      });
      const now = new Date();
      const outcomeByState: Record<string, string> = {
        passed: "pass",
        redirected: "redirect",
        extended: "extend",
        failed: "fail",
      };
      const updated = await db.transaction(async (tx) => {
        const [changed] = await tx
          .update(eosTalentTrials)
          .set({
            ...input,
            outcome: outcomeByState[input.state] || record.outcome,
            reviewerSeatId: outcomeStates.includes(input.state)
              ? access.seat.id
              : record.reviewerSeatId,
            reviewedAt: outcomeStates.includes(input.state) ? now : record.reviewedAt,
            learningStatus: outcomeStates.includes(input.state)
              ? "proposed"
              : record.learningStatus,
            updatedAt: now,
          })
          .where(
            and(
              eq(eosTalentTrials.id, record.id),
              eq(eosTalentTrials.state, record.state),
            ),
          )
          .returning();
        if (!changed)
          throw new EosRouteError(
            409,
            "talent_trial_concurrent_change",
            "The trial changed before this action completed.",
          );
        if (input.state === "active") {
          const applicationChanged = await tx
            .update(eosTalentApplications)
            .set({ state: "trial_active", updatedAt: now })
            .where(
              and(
                eq(eosTalentApplications.id, application.id),
                eq(eosTalentApplications.state, "trial_recommended"),
              ),
            )
            .returning({ id: eosTalentApplications.id });
          if (!applicationChanged[0])
            throw new EosRouteError(
              409,
              "talent_application_concurrent_change",
              "The application changed before the trial could start.",
            );
        }
        if (outcomeStates.includes(input.state)) {
          const applicationChanged = await tx
            .update(eosTalentApplications)
            .set({ state: "decision", updatedAt: now })
            .where(
              and(
                eq(eosTalentApplications.id, application.id),
                eq(eosTalentApplications.state, "trial_active"),
              ),
            )
            .returning({ id: eosTalentApplications.id });
          if (!applicationChanged[0])
            throw new EosRouteError(
              409,
              "talent_application_concurrent_change",
              "The application changed before the trial outcome could be recorded.",
            );
        }
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: `talent_trial.${input.state}`,
          targetType: "talent_trial",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: input.state,
          details: {
            from: record.state,
            to: input.state,
            applicationStateChanged:
              input.state === "active" || outcomeStates.includes(input.state),
            placementCreated: false,
            accessOrAuthorityGranted: false,
            paymentExecuted: false,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
        return changed;
      });
      return { body: { ...updated, approvalStatus: approval.status, readinessIssues: [] } };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/talent-trials/:trialId/learning-decision",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const input = z
        .object({
          decision: z.enum(["accepted", "rejected"]),
          rationale: z.string().trim().min(3).max(8000),
        })
        .parse(req.body);
      const [record] = await db
        .select()
        .from(eosTalentTrials)
        .where(
          and(
            eq(eosTalentTrials.id, req.params.trialId),
            eq(eosTalentTrials.companyId, access.company.id),
          ),
        );
      if (
        !record ||
        record.learningStatus !== "proposed" ||
        !["passed", "redirected", "extended", "failed"].includes(record.state)
      )
        throw new EosRouteError(
          409,
          "talent_trial_learning_unavailable",
          "A completed trial with an undecided learning proposal is required.",
        );
      assertMutableTalentProjection(record);
      const [application] = await db
        .select()
        .from(eosTalentApplications)
        .where(
          and(
            eq(eosTalentApplications.id, record.applicationId),
            eq(eosTalentApplications.companyId, access.company.id),
          ),
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !application ||
        !visible.has(application.ownerSeatId) ||
        !visible.has(record.targetSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(404, "talent_trial_not_found", "Trial not found.");
      const policy = await authorizeAction(req, access, {
        authorityClass: "approve",
        resource: "talent_trial_learning",
        actionKey: "talent_trial_learning.decide",
        purpose: "review_predicted_vs_actual_learning",
        classification: record.classification,
        consequence: "material",
        targetSeatId: record.targetSeatId,
        evidenceReferences: Array.isArray(record.outcomeEvidenceIds)
          ? record.outcomeEvidenceIds.map(String)
          : [],
      });
      const now = new Date();
      const updated = await db.transaction(async (tx) => {
        const [changed] = await tx
          .update(eosTalentTrials)
          .set({
            learningStatus: input.decision,
            learningDecisionRationale: input.rationale,
            learningReviewedByUserId: req.user.id,
            learningReviewedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(eosTalentTrials.id, record.id),
              eq(eosTalentTrials.learningStatus, "proposed"),
            ),
          )
          .returning();
        if (!changed)
          throw new EosRouteError(
            409,
            "talent_trial_learning_concurrent_change",
            "The learning proposal changed before the decision completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "talent_trial_learning.decided",
          targetType: "talent_trial",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: input.decision,
          details: {
            proposal: record.learningProposal,
            rationale: input.rationale,
            templateChangedAutomatically: false,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/talent-assessments",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const input = talentAssessmentCreateSchema.parse(req.body);
      const refs = await assertTalentReferences(access.company.id, {
        applicationId: input.applicationId,
        evidenceIds: input.evidenceIds,
      });
      if (
        !refs.application ||
        ["activated", "rejected", "withdrawn"].includes(refs.application.state)
      )
        throw new EosRouteError(
          409,
          "talent_application_closed",
          "Assessments cannot be added to a closed candidate lifecycle.",
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(refs.application.ownerSeatId) ||
        (refs.application.targetSeatId &&
          !visible.has(refs.application.targetSeatId))
      )
        throw new EosRouteError(
          404,
          "talent_application_not_found",
          "Talent application not found.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "talent_assessment",
        actionKey: "talent_assessment.create",
        purpose: "compose_minimum_sufficient_assessment",
        classification: input.classification,
        consequence: "material",
        targetSeatId:
          refs.application.targetSeatId || refs.application.ownerSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        applicationId: input.applicationId,
        assessmentKey: commandRecordKey("talent-assessment", input.title, id),
        assessmentType: input.assessmentType,
        title: input.title,
        state: "planned",
        decisionQuestion: input.decisionQuestion,
        evidenceExpected: input.evidenceExpected,
        validityScope: input.validityScope,
        candidateBurden: input.candidateBurden,
        candidateSubmission: input.candidateSubmission,
        internalEvaluation: input.internalEvaluation,
        consentRequired: input.consentRequired,
        consentCaptured: input.consentCaptured,
        evidenceIds: input.evidenceIds,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        schemaVersion: "talent-assessment-v1.0",
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosTalentAssessments).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "talent_assessment.created",
          targetType: "talent_assessment",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "planned",
          details: {
            applicationId: input.applicationId,
            assessmentType: input.assessmentType,
            consentRequired: input.consentRequired,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/talent-assessments/:assessmentId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const input = talentAssessmentUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosTalentAssessments)
        .where(
          and(
            eq(eosTalentAssessments.id, req.params.assessmentId),
            eq(eosTalentAssessments.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "talent_assessment_not_found",
          "Talent assessment not found.",
        );
      assertMutableTalentProjection(record);
      const refs = await assertTalentReferences(access.company.id, {
        applicationId: record.applicationId,
        evidenceIds: (input.evidenceIds || record.evidenceIds) as string[],
      });
      if (!refs.application)
        throw new EosRouteError(
          404,
          "talent_application_not_found",
          "Talent application not found.",
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(refs.application.ownerSeatId) ||
        (refs.application.targetSeatId &&
          !visible.has(refs.application.targetSeatId))
      )
        throw new EosRouteError(
          404,
          "talent_assessment_not_found",
          "Talent assessment not found.",
        );
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionTalentAssessment(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "talent_assessment_transition_invalid",
          `Talent assessment cannot move from ${record.state} to ${input.state}.`,
        );
      const merged = { ...record, ...input };
      const issues = input.state
        ? talentAssessmentAdvancementIssues(merged, input.state)
        : [];
      if (issues.length)
        throw new EosRouteError(
          409,
          "talent_assessment_evidence_required",
          `Assessment advancement requires: ${issues.join(", ")}.`,
        );
      if (
        input.state &&
        ["verified", "reviewed"].includes(input.state) &&
        refs.evidence.some((item) => item.verificationState !== "verified")
      )
        throw new EosRouteError(
          409,
          "talent_assessment_verified_evidence_required",
          "Verified and reviewed assessments require verified source evidence.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: input.state === "reviewed" ? "approve" : "decide",
        resource: "talent_assessment",
        actionKey: input.state
          ? "talent_assessment.transition"
          : "talent_assessment.update",
        purpose: "evaluate_job_relevant_evidence",
        classification: input.classification || record.classification,
        consequence: "material",
        targetSeatId:
          refs.application.targetSeatId || refs.application.ownerSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentAssessments)
          .set({ ...input, updatedAt: new Date() })
          .where(
            and(
              eq(eosTalentAssessments.id, record.id),
              eq(eosTalentAssessments.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "talent_assessment_concurrent_change",
            "The assessment changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state
            ? "talent_assessment.transitioned"
            : "talent_assessment.updated",
          targetType: "talent_assessment",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/talent-placements",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const input = talentPlacementCreateSchema.parse(req.body);
      const decidedBySeatId = input.decidedBySeatId || access.seat.id;
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      for (const seatId of [decidedBySeatId, input.targetSeatId])
        await assertCommandOwnerSeat(access.company.id, seatId, visible);
      const refs = await assertTalentReferences(access.company.id, {
        applicationId: input.applicationId,
        seatIds: [decidedBySeatId, input.targetSeatId],
        assignmentId: input.assignmentId,
        evidenceIds: input.evidenceIds,
      });
      if (!refs.application || refs.application.state !== "decision")
        throw new EosRouteError(
          409,
          "talent_decision_stage_required",
          "Placement starts only after the candidate lifecycle reaches the explicit decision stage.",
        );
      if (refs.assignment && refs.assignment.seatId !== input.targetSeatId)
        throw new EosRouteError(
          409,
          "talent_assignment_seat_mismatch",
          "The linked assignment must occupy the selected placement seat.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "approve",
        resource: "talent_placement",
        actionKey: "talent_placement.create",
        purpose: "record_attributable_hiring_decision",
        classification: input.classification,
        consequence: "irreversible",
        targetSeatId: input.targetSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        placementKey: commandRecordKey("talent-placement", input.rationale, id),
        applicationId: input.applicationId,
        targetSeatId: input.targetSeatId,
        decidedBySeatId,
        state: "pending",
        rationale: input.rationale,
        offerSummary: input.offerSummary,
        candidateResponse: input.candidateResponse,
        onboardingChecklist: input.onboardingChecklist,
        accessPlan: input.accessPlan,
        assignmentId: input.assignmentId || null,
        evidenceIds: input.evidenceIds,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        schemaVersion: "talent-placement-v1.0",
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosTalentPlacements).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "talent_placement.created",
          targetType: "talent_placement",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "pending",
          details: {
            applicationId: input.applicationId,
            targetSeatId: input.targetSeatId,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/talent-placements/:placementId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertTalentSurface(access);
      const input = talentPlacementUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosTalentPlacements)
        .where(
          and(
            eq(eosTalentPlacements.id, req.params.placementId),
            eq(eosTalentPlacements.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "talent_placement_not_found",
          "Talent placement not found.",
        );
      assertMutableTalentProjection(record);
      const [application] = await db
        .select()
        .from(eosTalentApplications)
        .where(
          and(
            eq(eosTalentApplications.id, record.applicationId),
            eq(eosTalentApplications.companyId, access.company.id),
          ),
        );
      if (!application)
        throw new EosRouteError(
          404,
          "talent_application_not_found",
          "Talent application not found.",
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.targetSeatId) ||
        !visible.has(record.decidedBySeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "talent_placement_not_found",
          "Talent placement not found.",
        );
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionTalentPlacement(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "talent_placement_transition_invalid",
          `Talent placement cannot move from ${record.state} to ${input.state}.`,
        );
      const merged = { ...record, ...input };
      const refs = await assertTalentReferences(access.company.id, {
        seatIds: [merged.targetSeatId, record.decidedBySeatId],
        assignmentId: merged.assignmentId || undefined,
        evidenceIds: merged.evidenceIds as string[],
      });
      const issues = input.state
        ? talentPlacementAdvancementIssues(merged, input.state)
        : [];
      if (issues.length)
        throw new EosRouteError(
          409,
          "talent_placement_evidence_required",
          `Placement advancement requires: ${issues.join(", ")}.`,
        );
      if (
        input.state &&
        [
          "offer_approved",
          "offer_accepted",
          "onboarding",
          "activated",
        ].includes(input.state) &&
        refs.evidence.some((item) => item.verificationState !== "verified")
      )
        throw new EosRouteError(
          409,
          "talent_placement_verified_evidence_required",
          "Offer, onboarding, and activation require verified evidence.",
        );
      if (input.state === "activated") {
        if (!application.candidateUserId)
          throw new EosRouteError(
            409,
            "talent_candidate_identity_link_required",
            "Activation requires the candidate's authenticated user identity to be linked first.",
          );
        if (
          !refs.assignment ||
          refs.assignment.seatId !== merged.targetSeatId ||
          refs.assignment.principalUserId !== application.candidateUserId ||
          refs.assignment.status !== "active" ||
          refs.assignment.operatingGrant !== "operate"
        )
          throw new EosRouteError(
            409,
            "talent_assignment_activation_invalid",
            "Activation requires an active operating assignment for the linked candidate identity in the selected seat.",
          );
      }
      const policy = await authorizeAction(req, access, {
        authorityClass: ["offer_approved", "activated", "rejected"].includes(
          input.state || "",
        )
          ? "approve"
          : "decide",
        resource: "talent_placement",
        actionKey: input.state
          ? "talent_placement.transition"
          : "talent_placement.update",
        purpose: "govern_offer_onboarding_and_activation",
        classification: input.classification || record.classification,
        consequence: "irreversible",
        targetSeatId: merged.targetSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const nextApplicationState: Record<string, string> = {
        onboarding: "onboarding",
        activated: "activated",
        rejected: "rejected",
        offer_declined: "rejected",
        hold: "hold",
        withdrawn: "withdrawn",
      };
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosTalentPlacements)
          .set({ ...input, updatedAt: new Date() })
          .where(
            and(
              eq(eosTalentPlacements.id, record.id),
              eq(eosTalentPlacements.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "talent_placement_concurrent_change",
            "The placement changed before this action completed.",
          );
        const applicationState = input.state
          ? nextApplicationState[input.state]
          : undefined;
        if (applicationState)
          await tx
            .update(eosTalentApplications)
            .set({
              state: applicationState,
              targetSeatId: merged.targetSeatId,
              updatedAt: new Date(),
            })
            .where(eq(eosTalentApplications.id, application.id));
        if (input.state === "activated")
          await tx
            .update(eosTalentNeeds)
            .set({ state: "filled", updatedAt: new Date() })
            .where(
              and(
                eq(eosTalentNeeds.id, application.talentNeedId),
                inArray(eosTalentNeeds.state, ["validated", "open", "paused"]),
              ),
            );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state
            ? "talent_placement.transitioned"
            : "talent_placement.updated",
          targetType: "talent_placement",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            applicationState: applicationState || application.state,
            assignmentId: changed[0].assignmentId,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/workforce-state",
    route(async (req) => {
      const access = await companyAccess(req);
      assertWorkforceSurface(access);
      await authorizeAction(req, access, {
        authorityClass: "view",
        resource: "workforce_review",
        actionKey: "workforce_state.read",
        purpose: "review_authorized_workforce_state",
        classification: "internal",
        consequence: "routine",
        targetSeatId: access.seat.id,
      });
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const [reviews, dialogue, plans, supportPlans, careerPaths, succession, metrics] = await Promise.all([
        db
          .select()
          .from(eosWorkforceReviews)
          .where(eq(eosWorkforceReviews.companyId, access.company.id))
          .orderBy(
            desc(eosWorkforceReviews.periodEnd),
            desc(eosWorkforceReviews.updatedAt),
          ),
        db
          .select()
          .from(eosWorkforceReviewDialogue)
          .where(eq(eosWorkforceReviewDialogue.companyId, access.company.id))
          .orderBy(
            eosWorkforceReviewDialogue.reviewId,
            eosWorkforceReviewDialogue.sequence,
          ),
        db
          .select()
          .from(eosDevelopmentPlans)
          .where(eq(eosDevelopmentPlans.companyId, access.company.id))
          .orderBy(desc(eosDevelopmentPlans.updatedAt)),
        db
          .select()
          .from(eosRoleSupportPlans)
          .where(eq(eosRoleSupportPlans.companyId, access.company.id))
          .orderBy(desc(eosRoleSupportPlans.updatedAt)),
        db
          .select()
          .from(eosCareerPathHypotheses)
          .where(eq(eosCareerPathHypotheses.companyId, access.company.id))
          .orderBy(desc(eosCareerPathHypotheses.updatedAt)),
        mayReview(access.role)
          ? db
              .select()
              .from(eosSuccessionHypotheses)
              .where(eq(eosSuccessionHypotheses.companyId, access.company.id))
              .orderBy(desc(eosSuccessionHypotheses.updatedAt))
          : [],
        db
          .select()
          .from(eosMetricsOutcomes)
          .where(eq(eosMetricsOutcomes.companyId, access.company.id))
          .orderBy(desc(eosMetricsOutcomes.updatedAt)),
      ]);
      const visibleReviews = reviews.filter(
        (item) =>
          visible.has(item.subjectSeatId) &&
          mayAccessClassification(access, item.classification),
      );
      const visiblePlans = plans.filter(
        (item) =>
          visible.has(item.subjectSeatId) &&
          mayAccessClassification(access, item.classification),
      );
      const visibleSupportPlans = supportPlans.filter(
        (item) =>
          visible.has(item.subjectSeatId) &&
          mayAccessClassification(access, item.classification),
      );
      const visibleCareerPaths = careerPaths.filter(
        (item) =>
          visible.has(item.subjectSeatId) &&
          mayAccessClassification(access, item.classification),
      );
      const visibleSuccession = succession.filter(
        (item) =>
          visible.has(item.criticalSeatId) &&
          (!item.candidateSeatId || visible.has(item.candidateSeatId)) &&
          mayAccessClassification(access, item.classification),
      );
      const visibleMetrics = metrics.filter(
        (item) =>
          visible.has(item.ownerSeatId) &&
          mayAccessClassification(access, item.classification),
      );
      const visibleReviewIds = new Set(visibleReviews.map((item) => item.id));
      const visibleDialogue = dialogue.filter((item) =>
        visibleReviewIds.has(item.reviewId),
      );
      const correctionByReview = new Map<string, string>();
      for (const item of visibleDialogue) {
        if (item.responseType === "correction_request")
          correctionByReview.set(item.reviewId, "requested");
        if (item.responseType === "correction_resolution")
          correctionByReview.set(item.reviewId, item.correctionDecision);
      }
      const projectedReviews = visibleReviews.map((item) => ({
        ...item,
        correctionStatus:
          correctionByReview.get(item.id) || item.correctionStatus,
      }));
      return {
        body: {
          generatedAt: new Date().toISOString(),
          reviews: projectedReviews,
          reviewDialogue: visibleDialogue,
          developmentPlans: visiblePlans,
          roleSupportPlans: visibleSupportPlans,
          careerPaths: visibleCareerPaths,
          successionHypotheses: visibleSuccession,
          metrics: visibleMetrics,
          canManageSuccession: mayReview(access.role),
          counts: {
            openReviews: projectedReviews.filter(
              (item) => item.state !== "closed",
            ).length,
            activeDevelopmentPlans: visiblePlans.filter((item) =>
              ["active", "paused"].includes(item.state),
            ).length,
            activeSupportPlans: visibleSupportPlans.filter((item) =>
              ["active", "ready_for_review"].includes(item.state),
            ).length,
            activeCareerPaths: visibleCareerPaths.filter((item) =>
              !["endorsed", "declined", "withdrawn"].includes(item.state),
            ).length,
            readySuccessors: visibleSuccession.filter(
              (item) =>
                item.state === "ready" && item.readinessWindow === "ready_now",
            ).length,
            unresolvedCorrections: projectedReviews.filter(
              (item) => item.correctionStatus === "requested",
            ).length,
          },
        },
      };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/workforce-reviews",
    route(async (req) => {
      const access = await companyAccess(req);
      assertWorkforceSurface(access);
      const input = workforceReviewCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      await Promise.all([
        assertCommandOwnerSeat(access.company.id, input.subjectSeatId, visible),
        assertCommandOwnerSeat(access.company.id, access.seat.id, visible),
      ]);
      const refs = await assertWorkforceReferences(access.company.id, {
        seatIds: [input.subjectSeatId, access.seat.id],
        assignmentId: input.assignmentId,
        workPacketIds: input.workPacketIds,
        metricIds: input.metricIds,
        evidenceIds: input.evidenceIds,
      });
      if (refs.assignment && refs.assignment.seatId !== input.subjectSeatId)
        throw new EosRouteError(
          400,
          "workforce_assignment_mismatch",
          "The assignment must occupy the review subject seat.",
        );
      const selfReview = input.subjectSeatId === access.seat.id;
      if (!selfReview && !mayReview(access.role))
        throw new EosRouteError(
          403,
          "workforce_review_denied",
          "Only a manager in the reporting path may open another seat's review.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "workforce_review",
        actionKey: "workforce_review.create",
        purpose: selfReview ? "prepare_self_review" : "review_role_outcomes",
        classification: input.classification,
        consequence: "material",
        targetSeatId: input.subjectSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        reviewKey: commandRecordKey(
          "workforce-review",
          input.outcomeSummary,
          id,
        ),
        subjectSeatId: input.subjectSeatId,
        assignmentId: input.assignmentId || null,
        reviewerSeatId: access.seat.id,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        state: "draft",
        performanceAttribution: input.performanceAttribution,
        outcomeSummary: input.outcomeSummary,
        strengths: input.strengths,
        gaps: input.gaps,
        managerObligations: input.managerObligations,
        employeeResponse: "",
        correctionStatus: "none",
        metricIds: input.metricIds,
        workPacketIds: input.workPacketIds,
        evidenceIds: input.evidenceIds,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        schemaVersion: "workforce-review-v1.0",
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosWorkforceReviews).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "workforce_review.created",
          targetType: "workforce_review",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "draft",
          details: {
            subjectSeatId: input.subjectSeatId,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/workforce-reviews/:reviewId/dialogue",
    route(async (req) => {
      const access = await companyAccess(req);
      assertWorkforceSurface(access);
      const input = workforceReviewDialogueCreateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosWorkforceReviews)
        .where(
          and(
            eq(eosWorkforceReviews.id, req.params.reviewId),
            eq(eosWorkforceReviews.companyId, access.company.id),
          ),
        )
        .limit(1);
      if (!record)
        throw new EosRouteError(
          404,
          "workforce_review_not_found",
          "Workforce review not found.",
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.subjectSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "workforce_review_not_found",
          "Workforce review not found.",
        );
      const employeeAction = [
        "employee_response",
        "correction_request",
      ].includes(input.responseType);
      const managerAction = [
        "manager_response",
        "correction_resolution",
      ].includes(input.responseType);
      if (employeeAction && record.subjectSeatId !== access.seat.id)
        throw new EosRouteError(
          403,
          "workforce_employee_dialogue_denied",
          "Only the reviewed employee may append an employee response or correction request.",
        );
      if (managerAction && !mayReview(access.role))
        throw new EosRouteError(
          403,
          "workforce_manager_dialogue_denied",
          "Only an authorized manager in the reporting path may append a manager response or correction resolution.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: employeeAction ? "execute" : "decide",
        resource: "workforce_review",
        actionKey: `workforce_review.${input.responseType}`,
        purpose: employeeAction
          ? "participate_in_transparent_review"
          : "respond_to_review_dialogue",
        classification: record.classification,
        consequence:
          input.responseType.includes("correction") ? "material" : "routine",
        targetSeatId: record.subjectSeatId,
      });
      const now = new Date();
      const dialogue = await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${access.company.id}, 24804)`,
        );
        const priorDialogue = await tx
          .select()
          .from(eosWorkforceReviewDialogue)
          .where(eq(eosWorkforceReviewDialogue.reviewId, record.id))
          .orderBy(eosWorkforceReviewDialogue.sequence);
        let correctionStatus = record.correctionStatus;
        for (const item of priorDialogue) {
          if (item.responseType === "correction_request")
            correctionStatus = "requested";
          if (item.responseType === "correction_resolution")
            correctionStatus = item.correctionDecision;
        }
        if (
          input.responseType === "correction_request" &&
          correctionStatus === "requested"
        )
          throw new EosRouteError(
            409,
            "workforce_correction_already_open",
            "Resolve the current correction request before opening another.",
          );
        if (
          input.responseType === "correction_resolution" &&
          correctionStatus !== "requested"
        )
          throw new EosRouteError(
            409,
            "workforce_correction_not_open",
            "A correction resolution requires an open employee request.",
          );
        const [created] = await tx
          .insert(eosWorkforceReviewDialogue)
          .values({
            id: randomUUID(),
            companyId: access.company.id,
            reviewId: record.id,
            sequence: priorDialogue.length + 1,
            authorSeatId: access.seat.id,
            responseType: input.responseType,
            body: input.body,
            correctionDecision: input.correctionDecision || "",
            recordedByUserId: req.user.id,
            createdAt: now,
          })
          .returning();
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: `workforce_review.${input.responseType}`,
          targetType: "workforce_review",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: input.correctionDecision || input.responseType,
          details: {
            dialogueId: created.id,
            authorSeatId: access.seat.id,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
        return created;
      });
      return { status: 201, body: dialogue };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/workforce-reviews/:reviewId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertWorkforceSurface(access);
      const input = workforceReviewUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosWorkforceReviews)
        .where(
          and(
            eq(eosWorkforceReviews.id, req.params.reviewId),
            eq(eosWorkforceReviews.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "workforce_review_not_found",
          "Workforce review not found.",
        );
      assertMutableWorkforceProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.subjectSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "workforce_review_not_found",
          "Workforce review not found.",
        );
      const selfAction = record.subjectSeatId === access.seat.id;
      const managerFields = [
        "performanceAttribution",
        "outcomeSummary",
        "strengths",
        "gaps",
        "managerObligations",
        "metricIds",
        "workPacketIds",
        "evidenceIds",
        "classification",
      ];
      if (
        !mayReview(access.role) &&
        Object.keys(input).some((key) => managerFields.includes(key))
      )
        throw new EosRouteError(
          403,
          "workforce_review_denied",
          "Employees may complete their review steps; append-only dialogue handles responses and corrections while scorecard judgments remain manager-governed.",
        );
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionWorkforceReview(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "workforce_review_transition_invalid",
          `Review cannot move from ${record.state} to ${input.state}.`,
        );
      if (input.state === "self_review" && !selfAction)
        throw new EosRouteError(
          403,
          "workforce_self_review_denied",
          "Only the reviewed seat may submit self review.",
        );
      if (input.state === "acknowledged" && !selfAction)
        throw new EosRouteError(
          403,
          "workforce_acknowledgement_denied",
          "Only the reviewed seat may acknowledge its review.",
        );
      const merged = { ...record, ...input };
      const refs = await assertWorkforceReferences(access.company.id, {
        workPacketIds: merged.workPacketIds as string[],
        metricIds: merged.metricIds as string[],
        evidenceIds: merged.evidenceIds as string[],
      });
      const issues = input.state
        ? workforceReviewAdvancementIssues(merged, input.state)
        : [];
      if (issues.length)
        throw new EosRouteError(
          409,
          "workforce_review_evidence_required",
          `Review advancement requires: ${issues.join(", ")}.`,
        );
      if (
        input.state &&
        ["calibrated", "acknowledged", "closed"].includes(input.state) &&
        refs.evidence.some((item) => item.verificationState !== "verified")
      )
        throw new EosRouteError(
          409,
          "workforce_review_verified_evidence_required",
          "Calibrated reviews require verified work evidence.",
        );
      const authorityClass: AuthorityClass =
        selfAction &&
        ["self_review", "acknowledged"].includes(input.state || "")
          ? "execute"
          : ["calibrated", "closed"].includes(input.state || "")
            ? "approve"
            : "decide";
      const policy = await authorizeAction(req, access, {
        authorityClass,
        resource: "workforce_review",
        actionKey: input.state
          ? "workforce_review.transition"
          : "workforce_review.update",
        purpose: selfAction
          ? "participate_in_review"
          : "govern_role_performance",
        classification: input.classification || record.classification,
        consequence: "material",
        targetSeatId: record.subjectSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const updates: any = { ...input, updatedAt: new Date() };
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosWorkforceReviews)
          .set(updates)
          .where(
            and(
              eq(eosWorkforceReviews.id, record.id),
              eq(eosWorkforceReviews.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "workforce_review_concurrent_change",
            "The review changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state
            ? "workforce_review.transitioned"
            : "workforce_review.updated",
          targetType: "workforce_review",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/career-paths",
    route(async (req) => {
      const access = await companyAccess(req);
      assertWorkforceSurface(access);
      const input = careerPathCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      await assertCommandOwnerSeat(
        access.company.id,
        input.subjectSeatId,
        visible,
      );
      const refs = await assertWorkforceReferences(access.company.id, {
        seatIds: [input.subjectSeatId, access.seat.id],
        assignmentId: input.assignmentId,
        positionAgreementIds: [
          ...(input.fromPositionAgreementId
            ? [input.fromPositionAgreementId]
            : []),
          ...(input.targetPositionAgreementId
            ? [input.targetPositionAgreementId]
            : []),
        ],
        evidenceIds: input.evidenceIds,
      });
      if (refs.assignment && refs.assignment.seatId !== input.subjectSeatId)
        throw new EosRouteError(
          400,
          "career_path_assignment_mismatch",
          "The assignment must occupy the career-path subject seat.",
        );
      const selfPath = input.subjectSeatId === access.seat.id;
      if (!selfPath && !mayReview(access.role))
        throw new EosRouteError(
          403,
          "career_path_denied",
          "Only a manager in the reporting path may record another seat's career hypothesis.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "career_path",
        actionKey: "career_path.create",
        purpose: selfPath
          ? "propose_personal_career_path"
          : "record_career_path_hypothesis",
        classification: input.classification,
        consequence: "routine",
        targetSeatId: input.subjectSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        pathKey: commandRecordKey(
          "career-path",
          input.targetRole || input.transitionType,
          id,
        ),
        subjectSeatId: input.subjectSeatId,
        assignmentId: input.assignmentId || null,
        sponsorSeatId: access.seat.id,
        origin: selfPath ? "employee" : "manager",
        fromPositionAgreementId: input.fromPositionAgreementId || null,
        targetPositionAgreementId: input.targetPositionAgreementId || null,
        targetRole: input.targetRole,
        transitionType: input.transitionType,
        careerTrack: input.careerTrack,
        state: "proposed",
        aspirationStatement: input.aspirationStatement,
        businessNeed: input.businessNeed,
        seatAvailability: input.seatAvailability,
        transitionCriteria: input.transitionCriteria,
        trainingRequirements: input.trainingRequirements,
        proofRequirements: input.proofRequirements,
        evidenceIds: input.evidenceIds,
        authorityChangeProposal: input.authorityChangeProposal,
        compensationChangeProposal: input.compensationChangeProposal,
        reviewAt: input.reviewAt ? new Date(input.reviewAt) : null,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        schemaVersion: "career-path-hypothesis-v1.0",
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosCareerPathHypotheses).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "career_path.created",
          targetType: "career_path",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "proposed",
          details: {
            subjectSeatId: input.subjectSeatId,
            targetRole: input.targetRole,
            transitionType: input.transitionType,
            origin: record.origin,
            assignmentChanged: false,
            authorityChanged: false,
            compensationChanged: false,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/career-paths/:pathId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertWorkforceSurface(access);
      const input = careerPathUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosCareerPathHypotheses)
        .where(
          and(
            eq(eosCareerPathHypotheses.id, req.params.pathId),
            eq(eosCareerPathHypotheses.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "career_path_not_found",
          "Career path not found.",
        );
      assertMutableWorkforceProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.subjectSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "career_path_not_found",
          "Career path not found.",
        );
      if (["endorsed", "declined", "withdrawn"].includes(record.state))
        throw new EosRouteError(
          409,
          "career_path_terminal",
          "Endorsed, declined, and withdrawn career paths are immutable.",
        );
      const selfPath = record.subjectSeatId === access.seat.id;
      const manager = mayReview(access.role);
      if (!selfPath && !manager)
        throw new EosRouteError(
          403,
          "career_path_denied",
          "The career path is outside this seat's reporting scope.",
        );
      if (
        selfPath &&
        !manager &&
        (input.state !== "withdrawn" || Object.keys(input).some((key) => key !== "state"))
      )
        throw new EosRouteError(
          403,
          "career_path_manager_review_required",
          "Employees may withdraw their own path; a manager governs review and evidence-readiness state.",
        );
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionCareerPath(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "career_path_transition_invalid",
          `Career path cannot move from ${record.state} to ${input.state}.`,
        );
      if (input.state === "endorsed" && !manager)
        throw new EosRouteError(
          403,
          "career_path_endorsement_denied",
          "A manager in the reporting path must endorse a career hypothesis.",
        );
      const merged = { ...record, ...input };
      careerPathCreateSchema.parse({
        subjectSeatId: merged.subjectSeatId,
        ...(merged.assignmentId ? { assignmentId: merged.assignmentId } : {}),
        ...(merged.fromPositionAgreementId
          ? { fromPositionAgreementId: merged.fromPositionAgreementId }
          : {}),
        ...(merged.targetPositionAgreementId
          ? { targetPositionAgreementId: merged.targetPositionAgreementId }
          : {}),
        targetRole: merged.targetRole,
        transitionType: merged.transitionType,
        careerTrack: merged.careerTrack,
        aspirationStatement: merged.aspirationStatement,
        businessNeed: merged.businessNeed,
        seatAvailability: merged.seatAvailability,
        transitionCriteria: merged.transitionCriteria,
        trainingRequirements: merged.trainingRequirements,
        proofRequirements: merged.proofRequirements,
        evidenceIds: merged.evidenceIds,
        authorityChangeProposal: merged.authorityChangeProposal,
        compensationChangeProposal: merged.compensationChangeProposal,
        ...(merged.reviewAt
          ? { reviewAt: new Date(merged.reviewAt).toISOString() }
          : {}),
        sourceAuthority: merged.sourceAuthority,
        classification: merged.classification,
      });
      const refs = await assertWorkforceReferences(access.company.id, {
        positionAgreementIds: [
          ...(merged.fromPositionAgreementId
            ? [merged.fromPositionAgreementId]
            : []),
          ...(merged.targetPositionAgreementId
            ? [merged.targetPositionAgreementId]
            : []),
        ],
        evidenceIds: merged.evidenceIds as string[],
      });
      const issues = input.state
        ? careerPathAdvancementIssues(merged, input.state)
        : [];
      if (issues.length)
        throw new EosRouteError(
          409,
          "career_path_evidence_required",
          `Career path advancement requires: ${issues.join(", ")}.`,
        );
      if (
        input.state &&
        ["evidence_ready", "endorsed"].includes(input.state) &&
        refs.evidence.some((item) => item.verificationState !== "verified")
      )
        throw new EosRouteError(
          409,
          "career_path_verified_evidence_required",
          "Evidence-ready and endorsed career paths require verified evidence.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass:
          input.state === "endorsed"
            ? "approve"
            : selfPath && input.state === "withdrawn"
              ? "execute"
              : "decide",
        resource: "career_path",
        actionKey: input.state ? "career_path.transition" : "career_path.update",
        purpose: "govern_career_mobility_hypothesis",
        classification: input.classification || record.classification,
        consequence: input.state === "endorsed" ? "material" : "routine",
        targetSeatId: record.subjectSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const updates: any = {
        ...input,
        ...(input.reviewAt ? { reviewAt: new Date(input.reviewAt) } : {}),
        updatedAt: new Date(),
      };
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosCareerPathHypotheses)
          .set(updates)
          .where(
            and(
              eq(eosCareerPathHypotheses.id, record.id),
              eq(eosCareerPathHypotheses.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "career_path_concurrent_change",
            "The career path changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state
            ? "career_path.transitioned"
            : "career_path.updated",
          targetType: "career_path",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            assignmentChanged: false,
            authorityChanged: false,
            compensationChanged: false,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/role-support-plans",
    route(async (req) => {
      const access = await companyAccess(req);
      assertWorkforceSurface(access);
      const input = roleSupportPlanCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      await assertCommandOwnerSeat(
        access.company.id,
        input.subjectSeatId,
        visible,
      );
      const refs = await assertWorkforceReferences(access.company.id, {
        seatIds: [input.subjectSeatId, access.seat.id],
        assignmentId: input.assignmentId,
        evidenceIds: input.evidenceIds,
      });
      if (refs.assignment && refs.assignment.seatId !== input.subjectSeatId)
        throw new EosRouteError(
          400,
          "role_support_assignment_mismatch",
          "The assignment must occupy the support-plan subject seat.",
        );
      const selfPlan = input.subjectSeatId === access.seat.id;
      if (!selfPlan && !mayReview(access.role))
        throw new EosRouteError(
          403,
          "role_support_plan_denied",
          "Only a manager in the reporting path may create support for another seat.",
        );
      if (selfPlan && ["guard", "transfer"].includes(input.supportMode))
        throw new EosRouteError(
          403,
          "role_support_governance_required",
          "Guard and transfer modes require a manager in the reporting path.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: ["guard", "transfer"].includes(input.supportMode)
          ? "decide"
          : "execute",
        resource: "role_support_plan",
        actionKey: "role_support_plan.create",
        purpose: selfPlan
          ? "choose_personal_role_support"
          : "govern_role_support",
        classification: input.classification,
        consequence: input.supportMode === "transfer" ? "material" : "routine",
        targetSeatId: input.subjectSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        supportKey: commandRecordKey(
          "role-support",
          `${input.supportMode}-${input.responsibility}`,
          id,
        ),
        subjectSeatId: input.subjectSeatId,
        assignmentId: input.assignmentId || null,
        managerSeatId: access.seat.id,
        responsibility: input.responsibility,
        objective: input.objective,
        supportMode: input.supportMode,
        state: "draft",
        humanOwnership: input.humanOwnership,
        supportInstructions: input.supportInstructions,
        guardrails: input.guardrails,
        proofRequirements: input.proofRequirements,
        evidenceIds: input.evidenceIds,
        transferTarget: input.transferTarget,
        reviewAt: input.reviewAt ? new Date(input.reviewAt) : null,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        schemaVersion: "role-support-plan-v1.0",
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosRoleSupportPlans).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "role_support_plan.created",
          targetType: "role_support_plan",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "draft",
          details: {
            subjectSeatId: input.subjectSeatId,
            supportMode: input.supportMode,
            authorityChanged: false,
            assignmentChanged: false,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/role-support-plans/:planId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertWorkforceSurface(access);
      const input = roleSupportPlanUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosRoleSupportPlans)
        .where(
          and(
            eq(eosRoleSupportPlans.id, req.params.planId),
            eq(eosRoleSupportPlans.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "role_support_plan_not_found",
          "Role support plan not found.",
        );
      assertMutableWorkforceProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.subjectSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "role_support_plan_not_found",
          "Role support plan not found.",
        );
      if (["completed", "cancelled"].includes(record.state))
        throw new EosRouteError(
          409,
          "role_support_plan_terminal",
          "Completed and cancelled support plans are immutable.",
        );
      const selfPlan = record.subjectSeatId === access.seat.id;
      const governedByManager = mayReview(access.role);
      if (!selfPlan && !governedByManager)
        throw new EosRouteError(
          403,
          "role_support_plan_denied",
          "The support plan is outside this seat's reporting scope.",
        );
      if (
        selfPlan &&
        !governedByManager &&
        ["guard", "transfer"].includes(record.supportMode)
      )
        throw new EosRouteError(
          403,
          "role_support_governance_required",
          "A manager must govern guard and transfer support modes.",
        );
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionRoleSupportPlan(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "role_support_transition_invalid",
          `Role support plan cannot move from ${record.state} to ${input.state}.`,
        );
      if (input.state === "completed" && !governedByManager)
        throw new EosRouteError(
          403,
          "role_support_completion_denied",
          "A manager in the reporting path must verify completion.",
        );
      const merged = { ...record, ...input };
      roleSupportPlanCreateSchema.parse({
        subjectSeatId: merged.subjectSeatId,
        ...(merged.assignmentId ? { assignmentId: merged.assignmentId } : {}),
        supportMode: merged.supportMode,
        responsibility: merged.responsibility,
        objective: merged.objective,
        humanOwnership: merged.humanOwnership,
        supportInstructions: merged.supportInstructions,
        guardrails: merged.guardrails,
        proofRequirements: merged.proofRequirements,
        evidenceIds: merged.evidenceIds,
        transferTarget: merged.transferTarget,
        ...(merged.reviewAt
          ? { reviewAt: new Date(merged.reviewAt).toISOString() }
          : {}),
        sourceAuthority: merged.sourceAuthority,
        classification: merged.classification,
      });
      const refs = await assertWorkforceReferences(access.company.id, {
        evidenceIds: merged.evidenceIds as string[],
      });
      const issues = input.state
        ? roleSupportPlanAdvancementIssues(merged, input.state)
        : [];
      if (issues.length)
        throw new EosRouteError(
          409,
          "role_support_evidence_required",
          `Support completion requires: ${issues.join(", ")}.`,
        );
      if (
        input.state === "completed" &&
        refs.evidence.some((item) => item.verificationState !== "verified")
      )
        throw new EosRouteError(
          409,
          "role_support_verified_evidence_required",
          "Completed support requires verified evidence.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass:
          input.state === "completed"
            ? "approve"
            : ["guard", "transfer"].includes(merged.supportMode) &&
                input.state === "active"
              ? "decide"
              : "execute",
        resource: "role_support_plan",
        actionKey: input.state
          ? "role_support_plan.transition"
          : "role_support_plan.update",
        purpose: "govern_role_support",
        classification: input.classification || record.classification,
        consequence: merged.supportMode === "transfer" ? "material" : "routine",
        targetSeatId: record.subjectSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const updates: any = {
        ...input,
        ...(input.reviewAt ? { reviewAt: new Date(input.reviewAt) } : {}),
        updatedAt: new Date(),
      };
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosRoleSupportPlans)
          .set(updates)
          .where(
            and(
              eq(eosRoleSupportPlans.id, record.id),
              eq(eosRoleSupportPlans.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "role_support_plan_concurrent_change",
            "The support plan changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state
            ? "role_support_plan.transitioned"
            : "role_support_plan.updated",
          targetType: "role_support_plan",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            supportMode: changed[0].supportMode,
            authorityChanged: false,
            assignmentChanged: false,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/development-plans",
    route(async (req) => {
      const access = await companyAccess(req);
      assertWorkforceSurface(access);
      const input = developmentPlanCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      await assertCommandOwnerSeat(
        access.company.id,
        input.subjectSeatId,
        visible,
      );
      const refs = await assertWorkforceReferences(access.company.id, {
        seatIds: [input.subjectSeatId, access.seat.id],
        assignmentId: input.assignmentId,
        positionAgreementId: input.targetPositionAgreementId,
        workPacketIds: input.workPacketIds,
        evidenceIds: input.evidenceIds,
      });
      if (refs.assignment && refs.assignment.seatId !== input.subjectSeatId)
        throw new EosRouteError(
          400,
          "development_assignment_mismatch",
          "The assignment must occupy the development-plan subject seat.",
        );
      const selfPlan = input.subjectSeatId === access.seat.id;
      if (!selfPlan && !mayReview(access.role))
        throw new EosRouteError(
          403,
          "development_plan_denied",
          "Only a manager in the reporting path may assign another seat's development plan.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "development_plan",
        actionKey: "development_plan.create",
        purpose: selfPlan
          ? "propose_professional_development"
          : "assign_professional_development",
        classification: input.classification,
        consequence: "routine",
        targetSeatId: input.subjectSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        planKey: commandRecordKey(
          "development-plan",
          input.targetRole || "role-development",
          id,
        ),
        subjectSeatId: input.subjectSeatId,
        assignmentId: input.assignmentId || null,
        managerSeatId: access.seat.id,
        targetPositionAgreementId: input.targetPositionAgreementId || null,
        targetRole: input.targetRole,
        state: "draft",
        capabilityGaps: input.capabilityGaps,
        developmentActions: input.developmentActions,
        successCriteria: input.successCriteria,
        workPacketIds: input.workPacketIds,
        evidenceIds: input.evidenceIds,
        reviewAt: input.reviewAt ? new Date(input.reviewAt) : null,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        schemaVersion: "development-plan-v1.0",
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosDevelopmentPlans).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "development_plan.created",
          targetType: "development_plan",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "draft",
          details: {
            subjectSeatId: input.subjectSeatId,
            targetRole: input.targetRole,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/development-plans/:planId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertWorkforceSurface(access);
      const input = developmentPlanUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosDevelopmentPlans)
        .where(
          and(
            eq(eosDevelopmentPlans.id, req.params.planId),
            eq(eosDevelopmentPlans.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "development_plan_not_found",
          "Development plan not found.",
        );
      assertMutableWorkforceProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.subjectSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "development_plan_not_found",
          "Development plan not found.",
        );
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionDevelopmentPlan(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "development_plan_transition_invalid",
          `Development plan cannot move from ${record.state} to ${input.state}.`,
        );
      if (
        input.state &&
        !mayReview(access.role) &&
        !["paused", "cancelled"].includes(input.state)
      )
        throw new EosRouteError(
          403,
          "development_plan_transition_denied",
          "Manager authority is required to activate or complete a development plan.",
        );
      const merged = { ...record, ...input };
      const refs = await assertWorkforceReferences(access.company.id, {
        positionAgreementId: merged.targetPositionAgreementId || undefined,
        workPacketIds: merged.workPacketIds as string[],
        evidenceIds: merged.evidenceIds as string[],
      });
      const issues = input.state
        ? developmentPlanAdvancementIssues(merged, input.state)
        : [];
      if (issues.length)
        throw new EosRouteError(
          409,
          "development_evidence_required",
          `Plan completion requires: ${issues.join(", ")}.`,
        );
      if (
        input.state === "completed" &&
        refs.evidence.some((item) => item.verificationState !== "verified")
      )
        throw new EosRouteError(
          409,
          "development_verified_evidence_required",
          "Completed development requires verified evidence.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass:
          input.state === "completed"
            ? "approve"
            : input.state
              ? "decide"
              : "execute",
        resource: "development_plan",
        actionKey: input.state
          ? "development_plan.transition"
          : "development_plan.update",
        purpose: "govern_professional_development",
        classification: input.classification || record.classification,
        consequence: "routine",
        targetSeatId: record.subjectSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const updates: any = {
        ...input,
        ...(input.reviewAt ? { reviewAt: new Date(input.reviewAt) } : {}),
        updatedAt: new Date(),
      };
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosDevelopmentPlans)
          .set(updates)
          .where(
            and(
              eq(eosDevelopmentPlans.id, record.id),
              eq(eosDevelopmentPlans.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "development_plan_concurrent_change",
            "The plan changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state
            ? "development_plan.transitioned"
            : "development_plan.updated",
          targetType: "development_plan",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/succession-hypotheses",
    route(async (req) => {
      const access = await companyAccess(req);
      assertWorkforceSurface(access);
      if (!mayReview(access.role))
        throw new EosRouteError(
          403,
          "succession_scope_denied",
          "Succession hypotheses are restricted to authorized managers and executives.",
        );
      const input = successionHypothesisCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const seatIds = [
        input.criticalSeatId,
        access.seat.id,
        input.candidateSeatId,
      ].filter((value): value is string => Boolean(value));
      for (const seatId of seatIds)
        await assertCommandOwnerSeat(access.company.id, seatId, visible);
      const refs = await assertWorkforceReferences(access.company.id, {
        seatIds,
        assignmentId: input.candidateAssignmentId,
        workPacketIds: input.workPacketId ? [input.workPacketId] : [],
        evidenceIds: input.evidenceIds,
      });
      if (refs.assignment && refs.assignment.seatId !== input.candidateSeatId)
        throw new EosRouteError(
          400,
          "succession_assignment_mismatch",
          "The candidate assignment must occupy the candidate seat.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: "decide",
        resource: "succession_hypothesis",
        actionKey: "succession_hypothesis.create",
        purpose: "govern_workforce_continuity",
        classification: input.classification,
        consequence: "material",
        targetSeatId: input.criticalSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        successionKey: commandRecordKey("succession", input.rationale, id),
        criticalSeatId: input.criticalSeatId,
        candidateSeatId: input.candidateSeatId || null,
        candidateAssignmentId: input.candidateAssignmentId || null,
        sponsorSeatId: access.seat.id,
        state: "hypothesis",
        readinessWindow: input.readinessWindow,
        rationale: input.rationale,
        proofGaps: input.proofGaps,
        developmentalAssignments: input.developmentalAssignments,
        externalHiringRequired: input.externalHiringRequired,
        workPacketId: input.workPacketId || null,
        evidenceIds: input.evidenceIds,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        schemaVersion: "succession-hypothesis-v1.0",
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.transaction(async (tx) => {
        await tx.insert(eosSuccessionHypotheses).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "succession_hypothesis.created",
          targetType: "succession_hypothesis",
          targetId: id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: "hypothesis",
          details: {
            criticalSeatId: input.criticalSeatId,
            candidateSeatId: input.candidateSeatId || null,
            policyDecisionId: policy.decisionId,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/succession-hypotheses/:hypothesisId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertWorkforceSurface(access);
      if (!mayReview(access.role))
        throw new EosRouteError(
          403,
          "succession_scope_denied",
          "Succession hypotheses are restricted to authorized managers and executives.",
        );
      const input = successionHypothesisUpdateSchema.parse(req.body);
      const [record] = await db
        .select()
        .from(eosSuccessionHypotheses)
        .where(
          and(
            eq(eosSuccessionHypotheses.id, req.params.hypothesisId),
            eq(eosSuccessionHypotheses.companyId, access.company.id),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "succession_hypothesis_not_found",
          "Succession hypothesis not found.",
        );
      assertMutableWorkforceProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.criticalSeatId) ||
        (record.candidateSeatId && !visible.has(record.candidateSeatId)) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "succession_hypothesis_not_found",
          "Succession hypothesis not found.",
        );
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionSuccession(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "succession_transition_invalid",
          `Succession hypothesis cannot move from ${record.state} to ${input.state}.`,
        );
      const merged = { ...record, ...input };
      const refs = await assertWorkforceReferences(access.company.id, {
        workPacketIds: merged.workPacketId ? [merged.workPacketId] : [],
        evidenceIds: merged.evidenceIds as string[],
      });
      const issues = input.state
        ? successionAdvancementIssues(merged, input.state)
        : [];
      if (issues.length)
        throw new EosRouteError(
          409,
          "succession_evidence_required",
          `Succession advancement requires: ${issues.join(", ")}.`,
        );
      if (
        input.state &&
        ["ready", "selected"].includes(input.state) &&
        refs.evidence.some((item) => item.verificationState !== "verified")
      )
        throw new EosRouteError(
          409,
          "succession_verified_evidence_required",
          "Ready or selected successors require verified readiness evidence.",
        );
      const policy = await authorizeAction(req, access, {
        authorityClass: input.state === "selected" ? "approve" : "decide",
        resource: "succession_hypothesis",
        actionKey: input.state
          ? "succession_hypothesis.transition"
          : "succession_hypothesis.update",
        purpose: "govern_workforce_continuity",
        classification: input.classification || record.classification,
        consequence: "material",
        targetSeatId: record.criticalSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const updates: any = { ...input, updatedAt: new Date() };
      const [updated] = await db.transaction(async (tx) => {
        const changed = await tx
          .update(eosSuccessionHypotheses)
          .set(updates)
          .where(
            and(
              eq(eosSuccessionHypotheses.id, record.id),
              eq(eosSuccessionHypotheses.state, record.state),
            ),
          )
          .returning();
        if (!changed[0])
          throw new EosRouteError(
            409,
            "succession_concurrent_change",
            "The succession hypothesis changed before this action completed.",
          );
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: input.state
            ? "succession_hypothesis.transitioned"
            : "succession_hypothesis.updated",
          targetType: "succession_hypothesis",
          targetId: record.id,
          traceId: policy.traceId,
          correlationId: policy.correlationId,
          result: changed[0].state,
          details: {
            from: record.state,
            to: changed[0].state,
            readinessWindow: changed[0].readinessWindow,
            policyDecisionId: policy.decisionId,
          },
          createdAt: new Date(),
        });
        return changed;
      });
      return { body: updated };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/systems-state",
    route(async (req) => {
      const access = await companyAccess(req);
      assertSystemsSurface(access);
      await authorizeAction(req, access, {
        authorityClass: "view",
        resource: "systems_registry",
        actionKey: "systems_state.read",
        purpose: "administer_systems_registry",
        classification: "confidential",
      });
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const [systems, bindings, bindingRevisions, entitlements, automations, health, incidents] =
        await Promise.all([
          db
            .select()
            .from(eosSystems)
            .where(eq(eosSystems.companyId, access.company.id))
            .orderBy(desc(eosSystems.updatedAt)),
          db
            .select()
            .from(eosIntegrationBindings)
            .where(eq(eosIntegrationBindings.companyId, access.company.id))
            .orderBy(desc(eosIntegrationBindings.updatedAt)),
          db
            .select()
            .from(eosIntegrationBindingRevisions)
            .where(eq(eosIntegrationBindingRevisions.companyId, access.company.id))
            .orderBy(desc(eosIntegrationBindingRevisions.configurationVersion))
            .limit(500),
          db
            .select()
            .from(eosToolEntitlements)
            .where(eq(eosToolEntitlements.companyId, access.company.id))
            .orderBy(desc(eosToolEntitlements.updatedAt)),
          db
            .select()
            .from(eosAutomations)
            .where(eq(eosAutomations.companyId, access.company.id))
            .orderBy(desc(eosAutomations.updatedAt)),
          db
            .select()
            .from(eosIntegrationHealthObservations)
            .where(
              eq(eosIntegrationHealthObservations.companyId, access.company.id),
            )
            .orderBy(desc(eosIntegrationHealthObservations.observedAt))
            .limit(200),
          db
            .select()
            .from(eosRisksControls)
            .where(
              and(
                eq(eosRisksControls.companyId, access.company.id),
                inArray(eosRisksControls.recordType, [
                  "incident",
                  "finding",
                  "remediation",
                ]),
              ),
            )
            .orderBy(desc(eosRisksControls.updatedAt)),
        ]);
      const visibleSystems = systems.filter(
        (item) =>
          visible.has(item.ownerSeatId) &&
          mayAccessClassification(access, item.classification),
      );
      const systemIds = new Set(visibleSystems.map((item) => item.id));
      const visibleBindings = bindings.filter(
        (item) =>
          visible.has(item.ownerSeatId) &&
          mayAccessClassification(access, item.classification) &&
          (!item.fromSystemId || systemIds.has(item.fromSystemId)) &&
          (!item.toSystemId || systemIds.has(item.toSystemId)),
      );
      const bindingIds = new Set(visibleBindings.map((item) => item.id));
      const now = new Date();
      const currentBindings = visibleBindings.map((item) => {
        const latest = health.find(
          (observation) => observation.integrationBindingId === item.id,
        );
        const stale =
          !latest || Boolean(latest.expiresAt && latest.expiresAt <= now);
        const projected = {
          ...item,
          healthState: stale ? "unknown" : item.healthState,
          healthObservationFresh: !stale,
          latestHealthObservation: latest || null,
        };
        return {
          ...projected,
          activationIssues: integrationActivationIssues(projected),
          configurationHistory: bindingRevisions.filter(
            (revision) => revision.integrationBindingId === item.id,
          ),
        };
      });
      return {
        body: {
          generatedAt: now.toISOString(),
          systems: visibleSystems,
          bindings: currentBindings,
          entitlements: entitlements.filter(
            (item) =>
              mayAccessClassification(access, item.classification) &&
              systemIds.has(item.systemId) &&
              (!item.integrationBindingId ||
                bindingIds.has(item.integrationBindingId)) &&
              (access.isOwner ||
                (item.granteeSeatId ? visible.has(item.granteeSeatId) : true)),
          ),
          automations: automations.filter(
            (item) =>
              visible.has(item.ownerSeatId) &&
              mayAccessClassification(access, item.classification) &&
              bindingIds.has(item.integrationBindingId),
          ),
          healthObservations: health.filter((item) =>
            bindingIds.has(item.integrationBindingId),
          ),
          incidents: incidents.filter(
            (item) =>
              visible.has(item.ownerSeatId) &&
              mayAccessClassification(access, item.classification) &&
              Array.from(bindingIds).some(
                (id) =>
                  item.capabilityProcessAssetKey === id ||
                  item.capabilityProcessAssetKey === `integration:${id}`,
              ),
          ),
        },
      };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/systems",
    route(async (req) => {
      const access = await companyAccess(req);
      assertSystemsSurface(access);
      const input = systemRegistryCreateSchema.parse(req.body);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const ownerSeatId = input.ownerSeatId || access.seat.id;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      await assertCommercialReferences(access.company.id, {
        stakeholderIds: input.vendorStakeholderId
          ? [input.vendorStakeholderId]
          : [],
      });
      const refs = await assertSystemsReferences(access.company.id, {
        evidenceIds: input.evidenceIds,
      });
      await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "system",
        actionKey: "system.create",
        purpose: "administer_systems_registry",
        classification: input.classification,
        consequence: "material",
        targetSeatId: ownerSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        systemKey: commandRecordKey("system", input.name, id),
        name: input.name,
        systemType: input.systemType,
        lifecycleState: input.lifecycleState,
        ownerSeatId,
        vendorStakeholderId: input.vendorStakeholderId || null,
        capabilities: input.capabilities,
        dataDomains: input.dataDomains,
        authoritativeFields: input.authoritativeFields,
        nativeAdminUrl: input.nativeAdminUrl || null,
        monthlyCost:
          input.monthlyCost === undefined ? null : String(input.monthlyCost),
        currency: input.currency,
        riskNotes: input.riskNotes,
        contractRenewalAt: input.contractRenewalAt
          ? new Date(input.contractRenewalAt)
          : null,
        replacementIntent: input.replacementIntent,
        sourceAuthority: input.sourceAuthority,
        sourceSystem: input.sourceSystem || null,
        externalId: input.externalId || null,
        evidenceIds: input.evidenceIds,
        classification: input.classification,
        schemaVersion: "system-registry-v1.0",
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      const trace = tracePair();
      await db.transaction(async (tx) => {
        await tx.insert(eosSystems).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "system.created",
          targetType: "system",
          targetId: id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: input.lifecycleState,
          details: {
            systemType: input.systemType,
            replacementIntent: input.replacementIntent,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/systems/:systemId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertSystemsSurface(access);
      const input = systemRegistryUpdateSchema.parse(req.body);
      if (input.ownerSeatId)
        throw new EosRouteError(
          409,
          "system_owner_rebind_requires_new_record",
          "System ownership changes require a superseding governed record.",
        );
      const [record] = await db
        .select()
        .from(eosSystems)
        .where(
          and(
            eq(eosSystems.companyId, access.company.id),
            eq(eosSystems.id, req.params.systemId),
          ),
        );
      if (!record)
        throw new EosRouteError(404, "system_not_found", "System not found.");
      assertMutableSystemsProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(404, "system_not_found", "System not found.");
      if (
        input.lifecycleState &&
        input.lifecycleState !== record.lifecycleState &&
        !canTransitionSystemLifecycle(
          record.lifecycleState as any,
          input.lifecycleState,
        )
      )
        throw new EosRouteError(
          409,
          "system_transition_invalid",
          `System cannot move from ${record.lifecycleState} to ${input.lifecycleState}.`,
        );
      const merged = { ...record, ...input };
      const refs = await assertSystemsReferences(access.company.id, {
        evidenceIds: merged.evidenceIds as string[],
      });
      if (input.lifecycleState === "active") {
        const missing = [
          !Array.isArray(merged.capabilities) || !merged.capabilities.length
            ? "capabilities"
            : "",
          !Array.isArray(merged.dataDomains) || !merged.dataDomains.length
            ? "data domains"
            : "",
          !Array.isArray(merged.authoritativeFields) ||
          !merged.authoritativeFields.length
            ? "authoritative fields"
            : "",
          merged.replacementIntent === "unknown" ? "replacement intent" : "",
          !refs.evidence.some((item) => item.verificationState === "verified")
            ? "verified evidence"
            : "",
        ].filter(Boolean);
        if (missing.length)
          throw new EosRouteError(
            409,
            "system_activation_incomplete",
            `System activation still requires: ${missing.join(", ")}.`,
          );
      }
      await authorizeAction(req, access, {
        authorityClass:
          input.lifecycleState === "active" ? "approve" : "decide",
        resource: "system",
        actionKey: "system.update",
        purpose: "administer_systems_registry",
        classification: record.classification,
        consequence: "material",
        targetSeatId: record.ownerSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const now = new Date();
      const update = {
        ...input,
        vendorStakeholderId: input.vendorStakeholderId || undefined,
        monthlyCost:
          input.monthlyCost === undefined
            ? undefined
            : String(input.monthlyCost),
        contractRenewalAt: input.contractRenewalAt
          ? new Date(input.contractRenewalAt)
          : undefined,
        updatedAt: now,
      };
      const [changed] = await db
        .update(eosSystems)
        .set(update)
        .where(
          and(
            eq(eosSystems.id, record.id),
            eq(eosSystems.lifecycleState, record.lifecycleState),
          ),
        )
        .returning();
      if (!changed)
        throw new EosRouteError(
          409,
          "system_concurrent_change",
          "The system changed before this update completed.",
        );
      const trace = tracePair();
      await db.insert(eosAuditRecords).values({
        id: randomUUID(),
        companyId: access.company.id,
        actorUserId: req.user.id,
        action: "system.updated",
        targetType: "system",
        targetId: record.id,
        traceId: trace.traceId,
        correlationId: trace.correlationId,
        result: changed.lifecycleState,
        details: { previousState: record.lifecycleState },
        createdAt: now,
      });
      return { body: changed };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/integration-bindings",
    route(async (req) => {
      const access = await companyAccess(req);
      assertSystemsSurface(access);
      const input = integrationBindingCreateSchema.parse(req.body);
      if (
        input.connectionState === "connected" ||
        input.lifecycleState === "active"
      )
        throw new EosRouteError(
          409,
          "integration_activation_requires_observation",
          "Create the binding first, then record provider-backed health and qualify activation.",
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const ownerSeatId = input.ownerSeatId || access.seat.id;
      const recoveryOwnerSeatId = input.recoveryOwnerSeatId || ownerSeatId;
      await Promise.all([
        assertCommandOwnerSeat(access.company.id, ownerSeatId, visible),
        assertCommandOwnerSeat(access.company.id, recoveryOwnerSeatId, visible),
      ]);
      const refs = await assertSystemsReferences(access.company.id, {
        systemIds: [input.fromSystemId, input.toSystemId].filter(
          (value): value is string => Boolean(value),
        ),
        workPacketId: input.workPacketId,
        evidenceIds: input.evidenceIds,
      });
      await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "integration_binding",
        actionKey: "integration_binding.create",
        purpose: "administer_systems_registry",
        classification: input.classification,
        consequence: "material",
        targetSeatId: ownerSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        integrationKey: commandRecordKey("integration", input.name, id),
        name: input.name,
        fromSystemId: input.fromSystemId || null,
        toSystemId: input.toSystemId || null,
        providerKey: input.providerKey,
        providerAccountReference: input.providerAccountReference,
        adapterKind: input.adapterKind,
        adapterReference: input.adapterReference,
        adapterVersion: input.adapterVersion,
        transport: input.transport,
        lifecycleState: input.lifecycleState,
        connectionState: input.connectionState,
        healthState: "unknown",
        ownerSeatId,
        recoveryOwnerSeatId,
        administratorReference: input.administratorReference,
        accountScope: input.accountScope,
        nativePermissions: input.nativePermissions,
        credentialReference: input.credentialReference || null,
        executionAuthority: input.executionAuthority,
        operations: input.operations,
        expectedEvents: input.expectedEvents,
        inputSchema: input.inputSchema,
        outputSchema: input.outputSchema,
        eventSchema: input.eventSchema,
        costModel: input.costModel,
        latencyBudgetMs: input.latencyBudgetMs ?? null,
        rateLimitPolicy: input.rateLimitPolicy,
        idempotencyStrategy: input.idempotencyStrategy,
        retryPolicy: input.retryPolicy,
        timeoutMs: input.timeoutMs ?? null,
        cancellationBehavior: input.cancellationBehavior,
        redactionPolicy: input.redactionPolicy,
        evidenceRequirements: input.evidenceRequirements,
        testCapability: input.testCapability,
        revocationProcedure: input.revocationProcedure,
        manualFallback: input.manualFallback,
        failureRecovery: input.failureRecovery,
        replacementStatus: input.replacementStatus,
        parityState: input.parityState,
        configurationVersion: 1,
        workPacketId: input.workPacketId || null,
        evidenceIds: input.evidenceIds,
        lastHealthAt: null,
        sourceAuthority: input.sourceAuthority,
        sourceSystem: input.sourceSystem || null,
        externalId: input.externalId || null,
        classification: input.classification,
        schemaVersion: "integration-binding-v2.0",
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      const trace = tracePair();
      await db.transaction(async (tx) => {
        await tx.insert(eosIntegrationBindings).values(record);
        await tx.insert(eosIntegrationBindingRevisions).values({
          id: randomUUID(),
          companyId: access.company.id,
          integrationBindingId: id,
          configurationVersion: 1,
          snapshot: integrationBindingConfigurationSnapshot(record),
          changeSummary: "Initial integration binding configuration",
          recordedByUserId: req.user.id,
          recordedBySeatId: access.seat.id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          createdAt: now,
        });
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "integration_binding.created",
          targetType: "integration_binding",
          targetId: id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: input.lifecycleState,
          details: {
            providerKey: input.providerKey,
            adapterKind: input.adapterKind,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/integration-bindings/:bindingId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertSystemsSurface(access);
      const input = integrationBindingUpdateSchema.parse(req.body);
      const {
        expectedConfigurationVersion,
        changeSummary,
        ...changes
      } = input;
      if (
        changes.ownerSeatId ||
        changes.recoveryOwnerSeatId ||
        changes.fromSystemId ||
        changes.toSystemId
      )
        throw new EosRouteError(
          409,
          "integration_context_rebind_requires_new_record",
          "Integration endpoints and accountable owners require a superseding governed binding.",
        );
      if (
        changes.connectionState ||
        "healthState" in req.body ||
        "lastHealthAt" in req.body
      )
        throw new EosRouteError(
          409,
          "integration_observation_required",
          "Connection and health state can change only through a provider-backed health observation.",
        );
      const [record] = await db
        .select()
        .from(eosIntegrationBindings)
        .where(
          and(
            eq(eosIntegrationBindings.companyId, access.company.id),
            eq(eosIntegrationBindings.id, req.params.bindingId),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "integration_binding_not_found",
          "Integration binding not found.",
        );
      if (
        expectedConfigurationVersion !== undefined &&
        expectedConfigurationVersion !== record.configurationVersion
      )
        throw new EosRouteError(
          409,
          "integration_configuration_version_conflict",
          `Integration configuration version ${record.configurationVersion} is current; refresh before saving.`,
        );
      assertMutableSystemsProjection(record);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(record.ownerSeatId) ||
        !mayAccessClassification(access, record.classification)
      )
        throw new EosRouteError(
          404,
          "integration_binding_not_found",
          "Integration binding not found.",
        );
      if (
        changes.lifecycleState &&
        changes.lifecycleState !== record.lifecycleState &&
        !canTransitionSystemLifecycle(
          record.lifecycleState as any,
          changes.lifecycleState,
        )
      )
        throw new EosRouteError(
          409,
          "integration_transition_invalid",
          `Integration cannot move from ${record.lifecycleState} to ${changes.lifecycleState}.`,
        );
      const merged = { ...record, ...changes };
      const refs = await assertSystemsReferences(access.company.id, {
        systemIds: [merged.fromSystemId, merged.toSystemId].filter(
          (value): value is string => Boolean(value),
        ),
        workPacketId: merged.workPacketId || undefined,
        evidenceIds: merged.evidenceIds as string[],
      });
      if (changes.lifecycleState === "active") {
        const issues = integrationActivationIssues(merged);
        const latest = await db
          .select()
          .from(eosIntegrationHealthObservations)
          .where(
            and(
              eq(eosIntegrationHealthObservations.companyId, access.company.id),
              eq(
                eosIntegrationHealthObservations.integrationBindingId,
                record.id,
              ),
            ),
          )
          .orderBy(desc(eosIntegrationHealthObservations.observedAt))
          .limit(1);
        if (
          !latest[0] ||
          !["live_provider", "monitoring", "recovery_test"].includes(
            latest[0].checkType,
          ) ||
          (latest[0].expiresAt && latest[0].expiresAt <= new Date())
        )
          issues.push("unexpired provider-backed health test");
        if (
          !refs.evidence.some((item) => item.verificationState === "verified")
        )
          issues.push("verified evidence");
        if (issues.length)
          throw new EosRouteError(
            409,
            "integration_activation_incomplete",
            `Integration activation still requires: ${Array.from(new Set(issues)).join(", ")}.`,
          );
      }
      await authorizeAction(req, access, {
        authorityClass:
          changes.lifecycleState === "active" ? "approve" : "decide",
        resource: "integration_binding",
        actionKey: "integration_binding.update",
        purpose: "administer_systems_registry",
        classification: record.classification,
        consequence: "material",
        targetSeatId: record.ownerSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const now = new Date();
      const nextConfigurationVersion = record.configurationVersion + 1;
      const update = {
        ...changes,
        credentialReference:
          changes.credentialReference === undefined
            ? undefined
            : changes.credentialReference,
        workPacketId: changes.workPacketId || undefined,
        configurationVersion: nextConfigurationVersion,
        schemaVersion: "integration-binding-v2.0",
        updatedAt: now,
      };
      const trace = tracePair();
      const changed = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(eosIntegrationBindings)
          .set(update)
          .where(
            and(
              eq(eosIntegrationBindings.id, record.id),
              eq(eosIntegrationBindings.lifecycleState, record.lifecycleState),
              eq(
                eosIntegrationBindings.configurationVersion,
                record.configurationVersion,
              ),
            ),
          )
          .returning();
        if (!updated)
          throw new EosRouteError(
            409,
            "integration_concurrent_change",
            "The integration changed before this update completed.",
          );
        const recordedChangeSummary =
          changeSummary ||
          (changes.lifecycleState &&
          changes.lifecycleState !== record.lifecycleState
            ? `Lifecycle transition to ${changes.lifecycleState}`
            : "Integration binding configuration updated");
        await tx.insert(eosIntegrationBindingRevisions).values({
          id: randomUUID(),
          companyId: access.company.id,
          integrationBindingId: record.id,
          configurationVersion: updated.configurationVersion,
          snapshot: integrationBindingConfigurationSnapshot(updated),
          changeSummary: recordedChangeSummary,
          recordedByUserId: req.user.id,
          recordedBySeatId: access.seat.id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          createdAt: now,
        });
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "integration_binding.updated",
          targetType: "integration_binding",
          targetId: record.id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: updated.lifecycleState,
          details: {
            previousState: record.lifecycleState,
            previousConfigurationVersion: record.configurationVersion,
            configurationVersion: updated.configurationVersion,
            changeSummary: recordedChangeSummary,
          },
          createdAt: now,
        });
        return updated;
      });
      return { body: changed };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/integration-health-observations",
    route(async (req) => {
      const access = await companyAccess(req);
      assertSystemsSurface(access);
      const input = integrationHealthObservationCreateSchema.parse(req.body);
      const refs = await assertSystemsReferences(access.company.id, {
        integrationBindingId: input.integrationBindingId,
        evidenceIds: input.evidenceIds,
      });
      const binding = refs.binding;
      if (!binding)
        throw new EosRouteError(
          404,
          "integration_binding_not_found",
          "Integration binding not found.",
        );
      assertMutableSystemsProjection(binding);
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      if (
        !visible.has(binding.ownerSeatId) ||
        !mayAccessClassification(access, binding.classification)
      )
        throw new EosRouteError(
          404,
          "integration_binding_not_found",
          "Integration binding not found.",
        );
      let observedHealthState = input.healthState;
      let externalReference = input.externalReference || null;
      if (["live_provider", "monitoring"].includes(input.checkType)) {
        const provider = binding.providerKey.toLowerCase();
        if (["gmail", "google_workspace", "google"].includes(provider)) {
          const checked = await gmail.verifyConnection(req.user.id);
          observedHealthState = checked.healthy
            ? "healthy"
            : checked.connected
              ? "degraded"
              : "unavailable";
          externalReference = "provider:google_workspace:server_verified";
        } else if (provider === "notion") {
          const checked = await notion.verifyConnection(req.user.id);
          observedHealthState = checked.healthy
            ? "healthy"
            : checked.connected
              ? "degraded"
              : "unavailable";
          externalReference = "provider:notion:server_verified";
        } else if (["umh", "universal_meta_harness"].includes(provider)) {
          observedHealthState = federationConfigured()
            ? "healthy"
            : "unavailable";
          externalReference = "provider:umh:deployment_verified";
        } else
          throw new EosRouteError(
            409,
            "live_provider_check_unsupported",
            "This adapter has no server-owned live health verifier. Use controlled fixture, recovery, or parity evidence without claiming live provider health.",
          );
      }
      if (!refs.evidence.some((item) => item.verificationState === "verified"))
        throw new EosRouteError(
          409,
          "verified_health_evidence_required",
          "A health observation requires verified test or provider evidence.",
        );
      await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "integration_health",
        actionKey: "integration_health.record",
        purpose: "verify_integration_health",
        classification: binding.classification,
        consequence: "material",
        targetSeatId: binding.ownerSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const observedAt = input.observedAt
        ? new Date(input.observedAt)
        : new Date();
      const expiresAt = input.expiresAt
        ? new Date(input.expiresAt)
        : new Date(observedAt.getTime() + 24 * 60 * 60 * 1000);
      const trace = tracePair();
      const observation = {
        id: randomUUID(),
        companyId: access.company.id,
        integrationBindingId: binding.id,
        observedByUserId: req.user.id,
        healthState: observedHealthState,
        checkType: input.checkType,
        summary: input.summary,
        externalReference,
        evidenceIds: input.evidenceIds,
        traceId: trace.traceId,
        correlationId: trace.correlationId,
        observedAt,
        expiresAt,
        createdAt: new Date(),
      };
      const providerBacked = [
        "live_provider",
        "monitoring",
        "recovery_test",
      ].includes(input.checkType);
      const connectionState =
        providerBacked && observedHealthState === "healthy"
          ? "connected"
          : observedHealthState === "unavailable"
            ? "failed"
            : binding.connectionState;
      await db.transaction(async (tx) => {
        await tx.insert(eosIntegrationHealthObservations).values(observation);
        await tx
          .update(eosIntegrationBindings)
          .set({
            healthState: observedHealthState,
            connectionState,
            lastHealthAt: observedAt,
            evidenceIds: Array.from(
              new Set([
                ...(binding.evidenceIds as string[]),
                ...input.evidenceIds,
              ]),
            ),
            updatedAt: new Date(),
          })
          .where(eq(eosIntegrationBindings.id, binding.id));
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "integration_health.observed",
          targetType: "integration_binding",
          targetId: binding.id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: observedHealthState,
          details: { checkType: input.checkType, expiresAt },
          createdAt: observation.createdAt,
        });
      });
      return { status: 201, body: observation };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/tool-entitlements",
    route(async (req) => {
      const access = await companyAccess(req);
      assertSystemsSurface(access);
      const input = toolEntitlementCreateSchema.parse(req.body);
      if (input.state === "active")
        throw new EosRouteError(
          409,
          "entitlement_activation_requires_review",
          "Create the entitlement proposal first, then qualify and activate it through review.",
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const revocationOwnerSeatId =
        input.revocationOwnerSeatId || access.seat.id;
      await assertCommandOwnerSeat(
        access.company.id,
        revocationOwnerSeatId,
        visible,
      );
      const refs = await assertSystemsReferences(access.company.id, {
        systemIds: [input.systemId],
        integrationBindingId: input.integrationBindingId,
        granteeSeatId: input.granteeSeatId,
        granteeSubjectId: input.granteeSubjectId,
        authorityGrantId: input.authorityGrantId,
        evidenceIds: input.evidenceIds,
      });
      await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "tool_entitlement",
        actionKey: "tool_entitlement.create",
        purpose: "administer_tool_entitlements",
        classification: input.classification,
        consequence: "material",
        targetSeatId: input.granteeSeatId || revocationOwnerSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        entitlementKey: commandRecordKey(
          "entitlement",
          input.providerResourceReference,
          id,
        ),
        systemId: input.systemId,
        integrationBindingId: input.integrationBindingId || null,
        granteeSeatId: input.granteeSeatId || null,
        granteeSubjectId: input.granteeSubjectId || null,
        providerResourceReference: input.providerResourceReference,
        nativePermissions: input.nativePermissions,
        authorityGrantId: input.authorityGrantId || null,
        credentialReference: input.credentialReference || null,
        masteryState: input.masteryState,
        state: input.state,
        revocationOwnerSeatId,
        evidenceIds: input.evidenceIds,
        effectiveFrom: input.effectiveFrom
          ? new Date(input.effectiveFrom)
          : now,
        effectiveUntil: input.effectiveUntil
          ? new Date(input.effectiveUntil)
          : null,
        lastReviewedAt: null,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        schemaVersion: "tool-entitlement-v1.0",
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      const trace = tracePair();
      await db.transaction(async (tx) => {
        await tx.insert(eosToolEntitlements).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "tool_entitlement.created",
          targetType: "tool_entitlement",
          targetId: id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: input.state,
          details: {
            systemId: input.systemId,
            granteeSeatId: input.granteeSeatId || null,
            granteeSubjectId: input.granteeSubjectId || null,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/tool-entitlements/:entitlementId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertSystemsSurface(access);
      const input = toolEntitlementUpdateSchema.parse(req.body);
      if (
        input.systemId ||
        input.integrationBindingId ||
        input.granteeSeatId ||
        input.granteeSubjectId ||
        input.revocationOwnerSeatId
      )
        throw new EosRouteError(
          409,
          "entitlement_rebind_requires_new_record",
          "Tool, resource, grantee, binding, and revocation ownership changes require a superseding entitlement.",
        );
      const [record] = await db
        .select()
        .from(eosToolEntitlements)
        .where(
          and(
            eq(eosToolEntitlements.companyId, access.company.id),
            eq(eosToolEntitlements.id, req.params.entitlementId),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "tool_entitlement_not_found",
          "Tool entitlement not found.",
        );
      assertMutableSystemsProjection(record);
      if (
        input.state &&
        input.state !== record.state &&
        !canTransitionEntitlement(record.state as any, input.state)
      )
        throw new EosRouteError(
          409,
          "entitlement_transition_invalid",
          `Entitlement cannot move from ${record.state} to ${input.state}.`,
        );
      const merged = { ...record, ...input };
      if (
        Number(Boolean(merged.granteeSeatId)) +
          Number(Boolean(merged.granteeSubjectId)) !==
        1
      )
        throw new EosRouteError(
          409,
          "entitlement_grantee_invalid",
          "An entitlement must retain exactly one canonical grantee.",
        );
      const refs = await assertSystemsReferences(access.company.id, {
        systemIds: [merged.systemId],
        integrationBindingId: merged.integrationBindingId || undefined,
        granteeSeatId: merged.granteeSeatId || undefined,
        granteeSubjectId: merged.granteeSubjectId || undefined,
        authorityGrantId: merged.authorityGrantId || undefined,
        evidenceIds: merged.evidenceIds as string[],
      });
      if (input.state === "active") {
        const issues = entitlementActivationIssues(merged);
        const latestHealth = merged.integrationBindingId
          ? await db
              .select()
              .from(eosIntegrationHealthObservations)
              .where(
                and(
                  eq(
                    eosIntegrationHealthObservations.companyId,
                    access.company.id,
                  ),
                  eq(
                    eosIntegrationHealthObservations.integrationBindingId,
                    merged.integrationBindingId,
                  ),
                ),
              )
              .orderBy(desc(eosIntegrationHealthObservations.observedAt))
              .limit(1)
          : [];
        const freshIntegrationHealth =
          !merged.integrationBindingId ||
          Boolean(
            latestHealth[0] &&
            (!latestHealth[0].expiresAt ||
              latestHealth[0].expiresAt > new Date()),
          );
        if (
          !refs.grant ||
          refs.grant.state !== "active" ||
          refs.grant.effectiveFrom > new Date() ||
          (refs.grant.effectiveUntil && refs.grant.effectiveUntil <= new Date())
        )
          issues.push("effective Authority Grant");
        if (
          merged.integrationBindingId &&
          (!refs.binding ||
            refs.binding.lifecycleState !== "active" ||
            refs.binding.healthState !== "healthy" ||
            !freshIntegrationHealth)
        )
          issues.push("active healthy integration");
        if (
          !refs.evidence.some((item) => item.verificationState === "verified")
        )
          issues.push("verified evidence");
        if (issues.length)
          throw new EosRouteError(
            409,
            "entitlement_activation_incomplete",
            `Entitlement activation still requires: ${Array.from(new Set(issues)).join(", ")}.`,
          );
      }
      await authorizeAction(req, access, {
        authorityClass: input.state === "active" ? "approve" : "decide",
        resource: "tool_entitlement",
        actionKey: "tool_entitlement.update",
        purpose: "administer_tool_entitlements",
        classification: record.classification,
        consequence: "material",
        targetSeatId: record.granteeSeatId || record.revocationOwnerSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const now = new Date();
      const update = {
        ...input,
        effectiveFrom: input.effectiveFrom
          ? new Date(input.effectiveFrom)
          : undefined,
        effectiveUntil: input.effectiveUntil
          ? new Date(input.effectiveUntil)
          : undefined,
        lastReviewedAt: input.state === "active" ? now : undefined,
        updatedAt: now,
      };
      const [changed] = await db
        .update(eosToolEntitlements)
        .set(update)
        .where(
          and(
            eq(eosToolEntitlements.id, record.id),
            eq(eosToolEntitlements.state, record.state),
          ),
        )
        .returning();
      if (!changed)
        throw new EosRouteError(
          409,
          "entitlement_concurrent_change",
          "The entitlement changed before this update completed.",
        );
      const trace = tracePair();
      await db.insert(eosAuditRecords).values({
        id: randomUUID(),
        companyId: access.company.id,
        actorUserId: req.user.id,
        action: "tool_entitlement.updated",
        targetType: "tool_entitlement",
        targetId: record.id,
        traceId: trace.traceId,
        correlationId: trace.correlationId,
        result: changed.state,
        details: { previousState: record.state },
        createdAt: now,
      });
      return { body: changed };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/automations",
    route(async (req) => {
      const access = await companyAccess(req);
      assertSystemsSurface(access);
      const input = automationCreateSchema.parse(req.body);
      if (input.lifecycleState === "enabled")
        throw new EosRouteError(
          409,
          "automation_enable_requires_review",
          "Create and review the automation before enabling it.",
        );
      const visible = await visibleSeatIds(
        access.company.id,
        access.seat.id,
        access.role,
      );
      const ownerSeatId = input.ownerSeatId || access.seat.id;
      await assertCommandOwnerSeat(access.company.id, ownerSeatId, visible);
      const refs = await assertSystemsReferences(access.company.id, {
        integrationBindingId: input.integrationBindingId,
        workPacketId: input.workPacketId,
        evidenceIds: input.evidenceIds,
      });
      await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "automation",
        actionKey: "automation.create",
        purpose: "administer_automations",
        classification: input.classification,
        consequence:
          input.consequence === "high_consequence"
            ? "irreversible"
            : input.consequence,
        targetSeatId: ownerSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const id = randomUUID();
      const now = new Date();
      const record = {
        id,
        companyId: access.company.id,
        portfolioId: access.company.portfolioId,
        automationKey: commandRecordKey("automation", input.name, id),
        name: input.name,
        integrationBindingId: input.integrationBindingId,
        ownerSeatId,
        triggerContract: input.triggerContract,
        actionContract: input.actionContract,
        lifecycleState: input.lifecycleState,
        consequence: input.consequence,
        failureBehavior: input.failureBehavior,
        manualFallback: input.manualFallback,
        workPacketId: input.workPacketId || null,
        evidenceIds: input.evidenceIds,
        lastRunState: "never",
        lastRunAt: null,
        nextRunAt: null,
        sourceAuthority: input.sourceAuthority,
        classification: input.classification,
        schemaVersion: "automation-v1.0",
        recordedByUserId: req.user.id,
        createdAt: now,
        updatedAt: now,
      };
      const trace = tracePair();
      await db.transaction(async (tx) => {
        await tx.insert(eosAutomations).values(record);
        await tx.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "automation.created",
          targetType: "automation",
          targetId: id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: input.lifecycleState,
          details: {
            integrationBindingId: input.integrationBindingId,
            consequence: input.consequence,
          },
          createdAt: now,
        });
      });
      return { status: 201, body: record };
    }),
  );

  app.patch(
    "/api/eos/companies/:companyId/automations/:automationId",
    route(async (req) => {
      const access = await companyAccess(req);
      assertSystemsSurface(access);
      const input = automationUpdateSchema.parse(req.body);
      if (input.ownerSeatId || input.integrationBindingId)
        throw new EosRouteError(
          409,
          "automation_rebind_requires_new_record",
          "Automation owner and binding changes require a superseding automation contract.",
        );
      const [record] = await db
        .select()
        .from(eosAutomations)
        .where(
          and(
            eq(eosAutomations.companyId, access.company.id),
            eq(eosAutomations.id, req.params.automationId),
          ),
        );
      if (!record)
        throw new EosRouteError(
          404,
          "automation_not_found",
          "Automation not found.",
        );
      assertMutableSystemsProjection(record);
      if (
        input.lifecycleState &&
        input.lifecycleState !== record.lifecycleState &&
        !canTransitionAutomation(
          record.lifecycleState as any,
          input.lifecycleState,
        )
      )
        throw new EosRouteError(
          409,
          "automation_transition_invalid",
          `Automation cannot move from ${record.lifecycleState} to ${input.lifecycleState}.`,
        );
      const merged = { ...record, ...input };
      const refs = await assertSystemsReferences(access.company.id, {
        integrationBindingId: merged.integrationBindingId,
        workPacketId: merged.workPacketId || undefined,
        evidenceIds: merged.evidenceIds as string[],
      });
      if (input.lifecycleState === "enabled") {
        const issues: string[] = [];
        const latestHealth = refs.binding
          ? await db
              .select()
              .from(eosIntegrationHealthObservations)
              .where(
                and(
                  eq(
                    eosIntegrationHealthObservations.companyId,
                    access.company.id,
                  ),
                  eq(
                    eosIntegrationHealthObservations.integrationBindingId,
                    refs.binding.id,
                  ),
                ),
              )
              .orderBy(desc(eosIntegrationHealthObservations.observedAt))
              .limit(1)
          : [];
        const freshIntegrationHealth = Boolean(
          latestHealth[0] &&
          (!latestHealth[0].expiresAt ||
            latestHealth[0].expiresAt > new Date()),
        );
        if (
          !refs.binding ||
          refs.binding.lifecycleState !== "active" ||
          refs.binding.healthState !== "healthy" ||
          !freshIntegrationHealth
        )
          issues.push("active healthy integration");
        if (!refs.workPacket || refs.workPacket.status !== "ready")
          issues.push("ready approved Work Packet");
        if (
          !refs.evidence.some((item) => item.verificationState === "verified")
        )
          issues.push("verified evidence");
        if (merged.consequence === "high_consequence")
          issues.push("human-executed high-consequence path");
        if (issues.length)
          throw new EosRouteError(
            409,
            "automation_enable_incomplete",
            `Automation enablement still requires: ${issues.join(", ")}.`,
          );
      }
      await authorizeAction(req, access, {
        authorityClass:
          input.lifecycleState === "enabled" ? "approve" : "decide",
        resource: "automation",
        actionKey: "automation.update",
        purpose: "administer_automations",
        classification: record.classification,
        consequence:
          merged.consequence === "high_consequence"
            ? "irreversible"
            : merged.consequence,
        targetSeatId: record.ownerSeatId,
        evidenceReferences: refs.evidence.map((item) => item.id),
      });
      const now = new Date();
      const update = { ...input, updatedAt: now };
      const [changed] = await db
        .update(eosAutomations)
        .set(update)
        .where(
          and(
            eq(eosAutomations.id, record.id),
            eq(eosAutomations.lifecycleState, record.lifecycleState),
          ),
        )
        .returning();
      if (!changed)
        throw new EosRouteError(
          409,
          "automation_concurrent_change",
          "The automation changed before this update completed.",
        );
      const trace = tracePair();
      await db.insert(eosAuditRecords).values({
        id: randomUUID(),
        companyId: access.company.id,
        actorUserId: req.user.id,
        action: "automation.updated",
        targetType: "automation",
        targetId: record.id,
        traceId: trace.traceId,
        correlationId: trace.correlationId,
        result: changed.lifecycleState,
        details: { previousState: record.lifecycleState },
        createdAt: now,
      });
      return { body: changed };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/integrations",
    route(async (req) => {
      const access = await companyAccess(req);
      assertSystemsSurface(access);
      await authorizeAction(req, access, {
        authorityClass: "view",
        resource: "integration",
        actionKey: "integration_provider_state.read",
        purpose: "administer_systems_registry",
        classification: "confidential",
      });
      const [googleWorkspace, notionConnection] = await Promise.all([
        gmail.verifyConnection(req.user.id),
        notion.verifyConnection(req.user.id),
      ]);
      const umhConfigured = federationConfigured();
      return {
        body: [
          {
            id: "google_workspace",
            name: "Google Workspace",
            description:
              "Gmail, Calendar, and Drive through user-authorized Google OAuth.",
            state: googleWorkspace.connected
              ? "connected"
              : googleWorkspace.configured
                ? "available"
                : "not_configured",
            health: googleWorkspace.healthy
              ? "healthy"
              : googleWorkspace.connected
                ? "degraded"
                : "not_connected",
            configured: googleWorkspace.configured,
            connected: googleWorkspace.connected,
            providerType: "oauth",
            authority: "provider_execution_after_local_approval",
            risk: "consequential_write",
            services: gmail.GOOGLE_WORKSPACE_SERVICES,
            serviceHealth: googleWorkspace.services,
            operations: gmail.GOOGLE_WORKSPACE_TOOLS,
            requiredScopes: gmail.requestedScopes(),
            grantedScopes: googleWorkspace.grantedScopes,
            executionAdapter: "EOS-owned Google Workspace OAuth adapter",
            manualFallback:
              "Copy an approved draft or event into the authorized Google Workspace client.",
            actions: googleWorkspace.connected
              ? ["verify", "reconnect", "disconnect"]
              : googleWorkspace.configured
                ? ["connect"]
                : [],
          },
          {
            id: "notion",
            name: "Notion",
            description:
              "Current product intent and canonical operating context.",
            state: notionConnection.connected
              ? "connected"
              : notionConnection.configured
                ? "available"
                : "not_configured",
            health: notionConnection.healthy
              ? "healthy"
              : notionConnection.connected
                ? "degraded"
                : "not_connected",
            configured: notionConnection.configured,
            connected: notionConnection.connected,
            providerType: "oauth",
            authority: "external_reference_provider",
            risk: "read_only",
            services: ["Workspace context"],
            serviceHealth: { "Workspace context": notionConnection.healthy },
            operations: notion.NOTION_TOOLS,
            requiredScopes: [
              "Read content shared with the EntrepreneurOS integration",
            ],
            workspace: notionConnection.workspace,
            executionAdapter: "EOS-owned Notion API adapter",
            manualFallback: "Open the canonical Notion workspace directly.",
            actions: notionConnection.connected
              ? ["verify", "reconnect", "disconnect"]
              : notionConnection.configured
                ? ["connect"]
                : [],
          },
          {
            id: "umh",
            name: "Universal Meta Harness",
            description:
              "Optional signed federation control plane; EOS remains authoritative for local work and approvals.",
            state: umhConfigured ? "connected" : "disabled",
            health: umhConfigured ? "configured" : "not_configured",
            configured: umhConfigured,
            connected: umhConfigured,
            providerType: "deployment_managed_federation",
            authority: "optional_control_plane",
            risk: "governed_federation",
            services: ["Signed command ingress", "Transactional event outbox"],
            operations: ["eos.action.propose.v1", "eos.command.outcome.read"],
            requiredScopes: [
              "Installation-bound issuer",
              "Ed25519 signing keys",
              "Replay-protected command scope",
            ],
            executionAdapter: "EOS-owned signed HTTPS projection adapter",
            capabilityManifest: "/.well-known/umh/capability-manifest",
            manualFallback:
              "Operate EOS work, approvals, audit, and evidence directly.",
            actions: ["view_manifest"],
          },
        ],
      };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/integrations/google/context",
    route(async (req) => {
      await companyAccess(req);
      if (!(await gmail.isConnected(req.user.id)))
        throw new EosRouteError(
          409,
          "google_not_connected",
          "Connect Google Workspace before loading Calendar and Drive context.",
        );
      return { body: await gmail.operatingContext(req.user.id) };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/integrations/notion/context",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!allowedSurfacesFor(access.role).includes("systems"))
        throw new EosRouteError(
          403,
          "notion_scope_denied",
          "Direct canonical workspace search is outside this seat's visibility scope.",
        );
      if (!(await notion.connectionSummary(req.user.id)).connected)
        throw new EosRouteError(
          409,
          "notion_not_connected",
          "Connect Notion before searching shared workspace context.",
        );
      const query =
        typeof req.query.q === "string" ? req.query.q.slice(0, 200) : "";
      try {
        return {
          body: {
            generatedAt: new Date().toISOString(),
            results: await notion.searchWorkspace(req.user.id, query, 20),
          },
        };
      } catch (error: any) {
        throw new EosRouteError(
          502,
          "notion_context_unavailable",
          String(error?.message || "Notion context could not be loaded."),
        );
      }
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/audit",
    route(async (req) => {
      const access = await companyAccess(req);
      if (
        !["founder", "portfolio_executive", "company_ceo"].includes(access.role)
      )
        throw new EosRouteError(
          403,
          "audit_scope_denied",
          "The company-wide audit trail is outside this seat's visibility scope.",
        );
      return {
        body: await db
          .select()
          .from(eosAuditRecords)
          .where(eq(eosAuditRecords.companyId, access.company.id))
          .orderBy(desc(eosAuditRecords.createdAt))
          .limit(200),
      };
    }),
  );

  app.get(
    "/api/eos/companies/:companyId/ai-budget",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!access.isOwner)
        throw new EosRouteError(
          403,
          "ai_budget_scope_denied",
          "Only the company owner can view AI spend controls.",
        );
      const now = new Date();
      const monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      const [budget] = await db
        .select()
        .from(aiBudgets)
        .where(eq(aiBudgets.companyId, access.company.id))
        .limit(1);
      const [usage] = await db
        .select({
          completedMicros: sql<number>`coalesce(sum(case when ${aiUsageLedger.status} = 'completed' then ${aiUsageLedger.actualCostMicros} else 0 end), 0)`,
          reservedMicros: sql<number>`coalesce(sum(case when ${aiUsageLedger.status} = 'reserved' then ${aiUsageLedger.reservedCostMicros} else 0 end), 0)`,
          failedCount: sql<number>`count(*) filter (where ${aiUsageLedger.status} = 'failed')`,
        })
        .from(aiUsageLedger)
        .where(
          and(
            eq(aiUsageLedger.companyId, access.company.id),
            gte(aiUsageLedger.createdAt, monthStart),
          ),
        );
      const entries = await db
        .select()
        .from(aiUsageLedger)
        .where(
          and(
            eq(aiUsageLedger.companyId, access.company.id),
            gte(aiUsageLedger.createdAt, monthStart),
          ),
        )
        .orderBy(desc(aiUsageLedger.createdAt))
        .limit(50);
      const [thresholdAlert] = budget
        ? await db
            .select()
            .from(aiBudgetAlerts)
            .where(
              and(
                eq(aiBudgetAlerts.companyId, access.company.id),
                eq(aiBudgetAlerts.monthStart, monthStart),
                eq(
                  aiBudgetAlerts.thresholdPercent,
                  budget.alertThresholdPercent,
                ),
              ),
            )
            .limit(1)
        : [];
      const completedMicros = Number(usage?.completedMicros || 0);
      const reservedMicros = Number(usage?.reservedMicros || 0);
      return {
        body: {
          configured: Boolean(budget),
          enabled: budget?.enabled || false,
          monthlyLimitMicros: budget?.monthlyLimitMicros || null,
          perRequestLimitMicros: budget?.perRequestLimitMicros || null,
          alertThresholdPercent: budget?.alertThresholdPercent || 80,
          thresholdAlert: thresholdAlert
            ? {
                createdAt: thresholdAlert.createdAt,
                usageMicros: thresholdAlert.usageMicros,
                limitMicros: thresholdAlert.limitMicros,
              }
            : null,
          spentMicros: completedMicros + reservedMicros,
          completedMicros,
          reservedMicros,
          failedCount: Number(usage?.failedCount || 0),
          monthStart,
          entries,
        },
      };
    }),
  );

  app.put(
    "/api/eos/companies/:companyId/ai-budget",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!access.isOwner)
        throw new EosRouteError(
          403,
          "ai_budget_scope_denied",
          "Only the company owner can change AI spend controls.",
        );
      const input = z
        .object({
          monthlyLimitDollars: z.number().positive().max(10_000),
          perRequestLimitDollars: z.number().positive().max(1_000),
          alertThresholdPercent: z.number().int().min(1).max(100).default(80),
          enabled: z.boolean(),
        })
        .refine(
          (value) => value.perRequestLimitDollars <= value.monthlyLimitDollars,
          "Per-request limit must not exceed the monthly limit.",
        )
        .parse(req.body);
      await authorizeAction(req, access, {
        authorityClass: "spend",
        resource: "ai_budget",
        actionKey: "ai_budget.update",
        purpose: "govern_ai_cost_controls",
        classification: "restricted",
        consequence: "material",
        amount: input.monthlyLimitDollars,
        currency: "USD",
      });
      const monthlyLimitMicros = Math.round(
        input.monthlyLimitDollars * 1_000_000,
      );
      const perRequestLimitMicros = Math.round(
        input.perRequestLimitDollars * 1_000_000,
      );
      const [budget] = await db
        .insert(aiBudgets)
        .values({
          companyId: access.company.id,
          monthlyLimitMicros,
          perRequestLimitMicros,
          alertThresholdPercent: input.alertThresholdPercent,
          enabled: input.enabled,
          updatedByUserId: req.user.id,
        })
        .onConflictDoUpdate({
          target: aiBudgets.companyId,
          set: {
            monthlyLimitMicros,
            perRequestLimitMicros,
            alertThresholdPercent: input.alertThresholdPercent,
            enabled: input.enabled,
            updatedByUserId: req.user.id,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (input.enabled) await evaluateAiBudgetThreshold(access.company.id);
      const trace = tracePair();
      await db.insert(eosAuditRecords).values({
        id: randomUUID(),
        companyId: access.company.id,
        actorUserId: req.user.id,
        action: "ai_budget.updated",
        targetType: "ai_budget",
        targetId: String(access.company.id),
        traceId: trace.traceId,
        correlationId: trace.correlationId,
        result: "configured",
        details: {
          monthlyLimitMicros,
          perRequestLimitMicros,
          alertThresholdPercent: input.alertThresholdPercent,
          enabled: input.enabled,
        },
        createdAt: new Date(),
      });
      return { body: budget };
    }),
  );

  app.post(
    "/api/eos/companies/:companyId/ai-usage/:usageId/reconcile",
    route(async (req) => {
      const access = await companyAccess(req);
      if (!access.isOwner)
        throw new EosRouteError(
          403,
          "ai_budget_scope_denied",
          "Only the company owner can reconcile AI usage.",
        );
      const input = z
        .object({
          status: z.enum(["completed", "failed"]),
          actualCostDollars: z.number().min(0).max(10_000).default(0),
          inputTokens: z.number().int().min(0).max(1_000_000_000).optional(),
          outputTokens: z.number().int().min(0).max(1_000_000_000).optional(),
          evidenceUri: z
            .string()
            .url()
            .refine((value) => {
              const url = new URL(value);
              return (
                url.protocol === "https:" &&
                !url.username &&
                !url.password &&
                !url.search &&
                !url.hash
              );
            }, "Secret-free HTTPS evidence URL required"),
        })
        .superRefine((value, context) => {
          if (value.status === "completed" && value.actualCostDollars <= 0)
            context.addIssue({
              code: "custom",
              path: ["actualCostDollars"],
              message: "Completed usage requires a positive actual cost.",
            });
        })
        .parse(req.body);
      await authorizeAction(req, access, {
        authorityClass: "execute",
        resource: "ai_usage",
        actionKey: "ai_usage.reconcile",
        purpose: "reconcile_ai_cost_evidence",
        classification: "restricted",
        consequence: "material",
        amount: input.actualCostDollars,
        currency: "USD",
        evidenceReferences: [input.evidenceUri],
        participants: {
          reconciler: { principalKey: req.user.id, seatId: access.seat.id },
        },
      });
      try {
        const usage = await reconcileAiSpend({
          id: req.params.usageId,
          companyId: access.company.id,
          userId: req.user.id,
          status: input.status,
          actualCostMicros: Math.round(input.actualCostDollars * 1_000_000),
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          evidenceUri: input.evidenceUri,
        });
        const trace = tracePair();
        await db.insert(eosAuditRecords).values({
          id: randomUUID(),
          companyId: access.company.id,
          actorUserId: req.user.id,
          action: "ai_usage.reconciled",
          targetType: "ai_usage",
          targetId: usage.id,
          traceId: trace.traceId,
          correlationId: trace.correlationId,
          result: input.status,
          details: {
            actualCostMicros: usage.actualCostMicros,
            evidenceUri: input.evidenceUri,
          },
          createdAt: new Date(),
        });
        return { body: usage };
      } catch (error) {
        if (error instanceof AiBudgetError)
          throw new EosRouteError(409, error.code, error.message);
        throw error;
      }
    }),
  );
}
