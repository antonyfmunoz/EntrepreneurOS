import { createHash, randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z, ZodError } from "zod";
import {
  eosAuditRecords,
  eosCustomerSuccessAccounts,
  eosEvidence,
  eosIntegrationBindings,
  eosRecoveryAgreementInstances,
  eosRecoveryBillingManifests,
  eosRecoveryCall2Packets,
  eosRecoveryCalculatorSessions,
  eosRecoveryCampaignControls,
  eosRecoveryDeliveryPools,
  eosRecoveryEngagementEvents,
  eosRecoveryEngagements,
  eosRecoveryOpportunities,
  eosSeats,
  eosStakeholderRelationships,
  eosStakeholders,
  eosWorkPackets,
} from "@shared/schema";
import {
  engagementProgress,
  nextRecoveryEngagementState,
  recoveryCampaignDecisionSchema,
  recoveryCampaignUpsertSchema,
  recoveryEngagementCreateSchema,
  recoveryEngagementEvidenceSchema,
  recoveryEngagementTransitionSchema,
  recoveryOpportunityCreateSchema,
  recoveryOpportunityTransitionSchema,
  recoveryOpportunityTransitionAllowed,
  recoveryAttributionAllowed,
  recoveryPoolKeys,
  recoveryPoolUpdateSchema,
  type RecoveryEngagementState,
} from "@shared/recovery-operations";
import { allowedSurfacesFor } from "@shared/eos-runtime";
import { db } from "../db";
import { nativeContractContentSha256 } from "../esign/template-generation";
import { EosRouteError, authorizeAction, companyAccess, mayAccessClassification, visibleSeatIds } from "./eos-runtime";

type Access = Awaited<ReturnType<typeof companyAccess>>;
type Tx = any;

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof EosRouteError) return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof ZodError) return res.status(400).json({ code: "recovery_operations_input_invalid", message: error.issues[0]?.message || "Recovery operations input is invalid." });
      if (error instanceof Error && /Recovery engagement|Action /.test(error.message)) return res.status(409).json({ code: "recovery_operations_transition_invalid", message: error.message });
      next(error);
    }
  };
}

async function operationsAccess(req: Request, authorityClass: "view" | "execute" | "decide" | "approve", actionKey: string, classification = "confidential") {
  const access = await companyAccess(req);
  const surfaces = allowedSurfacesFor(access.role);
  if (!["commercial", "operations", "work-room"].some((surface) => surfaces.includes(surface as any))) throw new EosRouteError(403, "recovery_operations_scope_denied", "Live Recovery operations are outside this role's compiled workspace.");
  const policy = await authorizeAction(req, access, {
    authorityClass, resource: "recovery_engagement", actionKey,
    purpose: authorityClass === "view" ? "inspect_live_recovery_operations" : "operate_live_recovery_engagement",
    classification, consequence: ["decide", "approve"].includes(authorityClass) ? "material" : "routine", targetSeatId: access.seat.id,
  });
  return { access, policy };
}

async function visibleEvidence(companyId: number, ids: string[], access: Access) {
  const unique = Array.from(new Set(ids));
  if (!unique.length || unique.length !== ids.length) throw new EosRouteError(409, "recovery_operations_evidence_invalid", "Evidence references must be unique and non-empty.");
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  const rows = await db.select({ evidence: eosEvidence, packet: eosWorkPackets }).from(eosEvidence)
    .innerJoin(eosWorkPackets, eq(eosWorkPackets.id, eosEvidence.workPacketId))
    .where(and(eq(eosEvidence.companyId, companyId), eq(eosWorkPackets.companyId, companyId), inArray(eosEvidence.id, unique)));
  const allowed = rows.filter(({ evidence, packet }) => evidence.verificationState === "verified" && mayAccessClassification(access, evidence.dataClassification) && mayAccessClassification(access, packet.classification) && (access.isOwner || Boolean(packet.accountableSeatId && visible.has(packet.accountableSeatId))));
  if (allowed.length !== unique.length) throw new EosRouteError(409, "recovery_operations_evidence_invalid", "Every Evidence item must be verified and visible in this company, hierarchy, and classification scope.");
  return allowed.map(({ evidence }) => evidence);
}

async function visibleEngagement(companyId: number, engagementId: string, access: Access) {
  const engagement = await db.query.eosRecoveryEngagements.findFirst({ where: and(eq(eosRecoveryEngagements.id, engagementId), eq(eosRecoveryEngagements.companyId, companyId)) });
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  if (!engagement || !visible.has(engagement.ownerSeatId) || !mayAccessClassification(access, engagement.classification)) throw new EosRouteError(404, "recovery_engagement_not_found", "Recovery engagement not found in this authority scope.");
  return engagement;
}

function audit(companyId: number, userId: string, action: string, targetType: string, targetId: string, result: string, details: Record<string, unknown>) {
  return { id: randomUUID(), companyId, actorUserId: userId, action, targetType, targetId, traceId: randomUUID(), correlationId: targetId, result, details };
}

async function appendEvent(tx: Tx, values: {
  companyId: number; engagementId: string; eventType: string; entityType: "engagement" | "pool" | "campaign" | "opportunity" | "evidence" | "customer_success"; entityId: string;
  fromState: string; toState: string; engagementVersionBefore: number; engagementVersionAfter: number; evidenceIds: string[]; payload: Record<string, unknown>; policyDecisionId: string; recordedByUserId: string; recordedAt: Date;
}) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`recovery-engagement:${values.engagementId}`}))`);
  const [previous] = await tx.select().from(eosRecoveryEngagementEvents).where(eq(eosRecoveryEngagementEvents.engagementId, values.engagementId)).orderBy(desc(eosRecoveryEngagementEvents.sequence)).limit(1);
  const id = randomUUID(); const sequence = (previous?.sequence || 0) + 1; const previousEventSha256 = previous?.eventSha256 || "";
  const eventSha256 = nativeContractContentSha256({ schemaVersion: "eos-recovery-engagement-event.v1", id, sequence, previousEventSha256, ...values, recordedAt: values.recordedAt.toISOString() });
  const [event] = await tx.insert(eosRecoveryEngagementEvents).values({ id, sequence, previousEventSha256, eventSha256, ...values }).returning();
  return event;
}

function providerBindingReady(binding: typeof eosIntegrationBindings.$inferSelect | undefined | null) {
  return Boolean(binding && binding.lifecycleState === "active" && binding.connectionState === "connected" && binding.healthState === "healthy" && ["passing", "accepted_exception"].includes(binding.parityState) && binding.providerAccountReference && binding.credentialReference);
}

async function engagementBundle(engagement: typeof eosRecoveryEngagements.$inferSelect) {
  const [pools, campaigns, opportunities, events, customerSuccess] = await Promise.all([
    db.select().from(eosRecoveryDeliveryPools).where(eq(eosRecoveryDeliveryPools.engagementId, engagement.id)).orderBy(eosRecoveryDeliveryPools.poolKey),
    db.select().from(eosRecoveryCampaignControls).where(eq(eosRecoveryCampaignControls.engagementId, engagement.id)).orderBy(eosRecoveryCampaignControls.name),
    db.select().from(eosRecoveryOpportunities).where(eq(eosRecoveryOpportunities.engagementId, engagement.id)).orderBy(desc(eosRecoveryOpportunities.updatedAt)),
    db.select().from(eosRecoveryEngagementEvents).where(eq(eosRecoveryEngagementEvents.engagementId, engagement.id)).orderBy(eosRecoveryEngagementEvents.sequence),
    engagement.customerSuccessAccountId ? db.query.eosCustomerSuccessAccounts.findFirst({ where: eq(eosCustomerSuccessAccounts.id, engagement.customerSuccessAccountId) }) : null,
  ]);
  const eligiblePools = pools.filter((pool) => (engagement.eligiblePoolKeys as string[]).includes(pool.poolKey));
  const configuredPools = eligiblePools.filter((pool) => ["qualified", "approved", "active", "completed"].includes(pool.state));
  const applicableCampaigns = campaigns.filter((campaign) => (engagement.eligiblePoolKeys as string[]).includes(campaign.poolKey));
  return {
    ...engagement, progress: engagementProgress(engagement.state as RecoveryEngagementState), pools, campaigns, opportunities, events, customerSuccess,
    readiness: {
      poolsQualified: eligiblePools.length > 0 && configuredPools.length === eligiblePools.length,
      campaignsApproved: applicableCampaigns.length >= eligiblePools.length && applicableCampaigns.every((campaign) => ["approved", "tested", "active", "completed"].includes(campaign.state)),
      campaignsTested: applicableCampaigns.length >= eligiblePools.length && applicableCampaigns.every((campaign) => ["tested", "active", "completed"].includes(campaign.state)),
      opportunityCount: opportunities.length,
      qualifiedOpportunityCount: opportunities.filter((item) => ["qualified", "routed", "booked", "won"].includes(item.state)).length,
      customerSuccessLinked: engagement.mode === "client_zero" || Boolean(customerSuccess),
    },
  };
}

function assertTransitionPrerequisites(bundle: Awaited<ReturnType<typeof engagementBundle>>, action: string) {
  if (action === "record_baseline" && !bundle.pools.every((pool) => !(bundle.eligiblePoolKeys as string[]).includes(pool.poolKey) || pool.rawCount > 0)) throw new EosRouteError(409, "recovery_baseline_incomplete", "Every eligible pool requires an observed baseline count before audit.");
  if (action === "complete_audit" && !bundle.readiness.poolsQualified) throw new EosRouteError(409, "recovery_audit_incomplete", "Every eligible pool must be evidence-qualified before campaign design.");
  if (action === "approve_campaigns" && !bundle.readiness.campaignsApproved) throw new EosRouteError(409, "recovery_campaigns_incomplete", "Every eligible pool requires an approved campaign control before bounded launch.");
  if (action === "verify_bounded_launch" && (!bundle.readiness.campaignsTested || bundle.opportunities.length < 1)) throw new EosRouteError(409, "recovery_bounded_launch_unverified", "Bounded launch requires tested campaign controls and at least one real, minimized opportunity record.");
  if (action === "start_reporting" && bundle.opportunities.length < 1) throw new EosRouteError(409, "recovery_reporting_evidence_missing", "Reporting requires at least one real opportunity record; empty activity is recorded through pool evidence, not inferred.");
  if (action === "start_renewal_review" && !bundle.readiness.customerSuccessLinked) throw new EosRouteError(409, "recovery_customer_success_link_required", "A paid-client renewal review requires the canonical Customer Success account link.");
}

function requireEvidenceType(evidence: Array<typeof eosEvidence.$inferSelect>, allowed: string[], purpose: string) {
  if (!evidence.some((item) => allowed.includes(item.evidenceType))) throw new EosRouteError(409, "recovery_evidence_type_invalid", `${purpose} requires at least one verified ${allowed.join(", ").replaceAll("_", " ")} Evidence item.`);
}

const lifecycleEvidence: Partial<Record<string, string[]>> = {
  approve_scope: ["scope_approval", "consent_review"],
  complete_intake: ["consent_review", "operator_observation"],
  record_baseline: ["baseline_snapshot", "data_quality_receipt"],
  complete_audit: ["data_quality_receipt"],
  approve_campaigns: ["campaign_approval"],
  verify_bounded_launch: ["provider_receipt", "delivery_receipt", "communication_receipt"],
  start_reporting: ["delivery_receipt", "communication_receipt", "attribution_receipt"],
  start_guarantee_review: ["attribution_receipt", "client_confirmation"],
  start_renewal_review: ["client_confirmation", "attribution_receipt"],
  close: ["client_confirmation", "postmortem"],
  report_failure: ["operator_observation", "recovery_receipt", "provider_receipt"],
  restore_safe_state: ["recovery_receipt", "provider_receipt"],
};

export function registerRecoveryOperationsRoutes(app: Express): void {
  app.get("/api/eos/companies/:companyId/recovery-operations", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const { access } = await operationsAccess(req, "view", "recovery_operations.state.read");
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
    const [engagements, seats, evidenceRows, bindings, packets, sessions, agreements, billings, stakeholders, relationships, accounts] = await Promise.all([
      db.select().from(eosRecoveryEngagements).where(eq(eosRecoveryEngagements.companyId, companyId)).orderBy(desc(eosRecoveryEngagements.updatedAt)),
      db.select().from(eosSeats).where(eq(eosSeats.companyId, companyId)).orderBy(eosSeats.title),
      db.select({ evidence: eosEvidence, packet: eosWorkPackets }).from(eosEvidence).innerJoin(eosWorkPackets, eq(eosWorkPackets.id, eosEvidence.workPacketId)).where(and(eq(eosEvidence.companyId, companyId), eq(eosEvidence.verificationState, "verified"))),
      db.select().from(eosIntegrationBindings).where(eq(eosIntegrationBindings.companyId, companyId)).orderBy(eosIntegrationBindings.providerKey),
      db.select().from(eosRecoveryCall2Packets).where(eq(eosRecoveryCall2Packets.companyId, companyId)).orderBy(desc(eosRecoveryCall2Packets.updatedAt)),
      db.select().from(eosRecoveryCalculatorSessions).where(eq(eosRecoveryCalculatorSessions.companyId, companyId)),
      db.select().from(eosRecoveryAgreementInstances).where(eq(eosRecoveryAgreementInstances.companyId, companyId)),
      db.select().from(eosRecoveryBillingManifests).where(eq(eosRecoveryBillingManifests.companyId, companyId)),
      db.select().from(eosStakeholders).where(eq(eosStakeholders.companyId, companyId)),
      db.select().from(eosStakeholderRelationships).where(eq(eosStakeholderRelationships.companyId, companyId)),
      db.select().from(eosCustomerSuccessAccounts).where(eq(eosCustomerSuccessAccounts.companyId, companyId)),
    ]);
    const visibleEngagements = engagements.filter((item) => visible.has(item.ownerSeatId) && mayAccessClassification(access, item.classification));
    const bundles = await Promise.all(visibleEngagements.map(engagementBundle));
    const existingPacketIds = new Set(engagements.map((item) => item.call2PacketId).filter(Boolean));
    const eligiblePaidHandoffs = packets.filter((packet) => {
      const session = sessions.find((item) => item.id === packet.sessionId); const agreement = agreements.find((item) => item.call2PacketId === packet.id); const billing = agreement && billings.find((item) => item.agreementInstanceId === agreement.id);
      return packet.state === "handoff_ready" && packet.disposition === "closed_won_pending_agreement_payment" && agreement?.state === "signed" && billing?.state === "active" && session?.stakeholderId && session.relationshipId && !existingPacketIds.has(packet.id) && visible.has(packet.ownerSeatId);
    }).map((packet) => { const session = sessions.find((item) => item.id === packet.sessionId)!; const stakeholder = stakeholders.find((item) => item.id === session.stakeholderId); return { id: packet.id, title: `${stakeholder?.name || session.companyName || "Paid Recovery client"} · ${packet.recommendedPackage}`, stakeholderId: session.stakeholderId, relationshipId: session.relationshipId }; });
    const visibleEvidenceRows = evidenceRows.filter(({ evidence, packet }) => mayAccessClassification(access, evidence.dataClassification) && mayAccessClassification(access, packet.classification) && (access.isOwner || Boolean(packet.accountableSeatId && visible.has(packet.accountableSeatId))));
    res.json({
      generatedAt: new Date().toISOString(), engagements: bundles,
      seats: seats.filter((seat) => visible.has(seat.id) && seat.status === "active").map((seat) => ({ id: seat.id, title: seat.title, kind: seat.kind })),
      evidence: visibleEvidenceRows.map(({ evidence }) => ({ id: evidence.id, title: evidence.title, evidenceType: evidence.evidenceType, workPacketId: evidence.workPacketId })),
      bindings: bindings.filter((binding) => visible.has(binding.ownerSeatId)).map((binding) => ({ id: binding.id, providerKey: binding.providerKey, name: binding.name, lifecycleState: binding.lifecycleState, connectionState: binding.connectionState, healthState: binding.healthState, parityState: binding.parityState, ready: providerBindingReady(binding) })),
      eligiblePaidHandoffs,
      customerSuccessAccounts: accounts.filter((account) => visible.has(account.ownerSeatId)).map((account) => ({ id: account.id, stakeholderId: account.stakeholderId, relationshipId: account.relationshipId, lifecycleState: account.lifecycleState })),
      counts: { active: bundles.filter((item) => ["operating", "reporting", "guarantee_review", "renewal_review"].includes(item.state)).length, blocked: bundles.filter((item) => item.state === "recovery_required" || (item.blockers as unknown[]).length > 0).length, opportunities: bundles.reduce((sum, item) => sum + item.opportunities.length, 0), qualified: bundles.reduce((sum, item) => sum + item.readiness.qualifiedOpportunityCount, 0) },
      boundary: "Live Recovery operations preserve real first-party or paid-client state. EOS never infers consent, sends, provider delivery, payment, signature, booked work, won revenue, attribution, or customer acceptance without the corresponding authority and Evidence.",
    });
  }));

  app.post("/api/eos/companies/:companyId/recovery-operations/engagements", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = recoveryEngagementCreateSchema.parse(req.body); const { access, policy } = await operationsAccess(req, "execute", "recovery_operations.engagement.create", input.classification);
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role); if (!visible.has(input.ownerSeatId)) throw new EosRouteError(403, "recovery_owner_scope_denied", "The Recovery owner is outside this operator's visible hierarchy.");
    let stakeholderId: string | null = null; let relationshipId: string | null = null;
    if (input.mode === "paid_client") {
      const packet = await db.query.eosRecoveryCall2Packets.findFirst({ where: and(eq(eosRecoveryCall2Packets.id, input.call2PacketId!), eq(eosRecoveryCall2Packets.companyId, companyId)) });
      const session = packet ? await db.query.eosRecoveryCalculatorSessions.findFirst({ where: and(eq(eosRecoveryCalculatorSessions.id, packet.sessionId), eq(eosRecoveryCalculatorSessions.companyId, companyId)) }) : null;
      const agreement = packet ? await db.query.eosRecoveryAgreementInstances.findFirst({ where: and(eq(eosRecoveryAgreementInstances.call2PacketId, packet.id), eq(eosRecoveryAgreementInstances.companyId, companyId)) }) : null;
      const billing = agreement ? await db.query.eosRecoveryBillingManifests.findFirst({ where: and(eq(eosRecoveryBillingManifests.agreementInstanceId, agreement.id), eq(eosRecoveryBillingManifests.companyId, companyId)) }) : null;
      if (!packet || packet.state !== "handoff_ready" || packet.disposition !== "closed_won_pending_agreement_payment" || agreement?.state !== "signed" || billing?.state !== "active" || !session?.stakeholderId || !session.relationshipId) throw new EosRouteError(409, "recovery_paid_client_not_ready", "Paid-client delivery requires the exact closed-won handoff, signed agreement, active billing, and canonical customer identity.");
      stakeholderId = session.stakeholderId; relationshipId = session.relationshipId;
    }
    const id = randomUUID(); const workPacketId = randomUUID(); const now = new Date();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`recovery-engagement:${companyId}:${input.call2PacketId || input.title.toLowerCase()}`}))`);
      if (input.call2PacketId) { const [existing] = await tx.select().from(eosRecoveryEngagements).where(eq(eosRecoveryEngagements.call2PacketId, input.call2PacketId)).limit(1); if (existing) throw new EosRouteError(409, "recovery_engagement_exists", "This governed handoff already has a live Recovery engagement."); }
      await tx.insert(eosWorkPackets).values({ id: workPacketId, companyId, createdByUserId: req.user.id, accountableUserId: access.company.ownerUserId, accountableSeatId: input.ownerSeatId, title: input.title, objective: input.objective, status: "in_progress", priority: "urgent", source: "recovery_live_operations", visibility: "company", classification: input.classification, requiresApproval: true, toolPack: [], evidenceRequirements: ["Scope and consent authority", "Baseline and pool audit", "Campaign approval and bounded-launch receipt", "Opportunity and attribution evidence", "Weekly reporting and recovery receipts"], resourceIds: [id, ...(input.call2PacketId ? [input.call2PacketId] : [])], expectedOutput: "One live, evidence-backed Recovery operating loop with explicit exceptions and no unsupported provider or outcome claims.", acceptanceCriteria: "Eligible records, consent, approvals, provider effects, replies, routing, attribution, reporting, recovery, and closeout retain authoritative evidence.", constraintsPolicies: "Client Zero uses only lawful Empyrean first-party records. Paid-client mode requires signed agreement and active billing. No external effect is inferred from EOS state.", failureEscalationCompensation: "Pause affected campaigns, contain unsafe records, preserve provider receipts, and restore a proven safe state before resuming.", humanFallback: "The accountable Recovery operator performs the approved manual seam and attaches the external receipt.", sourceLineage: "Empyrean Recovery Pilot — Internal Company/Offer Instance; Client Zero Protocol v1; Post-Close Client Execution OS", outputArtifactKeys: [], traceId: randomUUID(), correlationId: id, createdAt: now, updatedAt: now });
      const [engagement] = await tx.insert(eosRecoveryEngagements).values({ id, companyId, mode: input.mode, title: input.title, call2PacketId: input.call2PacketId || null, stakeholderId, relationshipId, workPacketId, ownerSeatId: input.ownerSeatId, objective: input.objective, eligiblePoolKeys: input.eligiblePoolKeys, sourceBoundary: input.sourceBoundary, consentPolicy: input.consentPolicy, clientSideOwner: input.clientSideOwner, guaranteeWindowStart: input.guaranteeWindowStart || null, guaranteeWindowEnd: input.guaranteeWindowEnd || null, nextAction: input.nextAction, nextActionAt: input.nextActionAt || null, classification: input.classification, recordedByUserId: req.user.id, createdAt: now, updatedAt: now }).returning();
      await tx.insert(eosRecoveryDeliveryPools).values(recoveryPoolKeys.map((poolKey) => ({ id: randomUUID(), companyId, engagementId: id, poolKey, state: input.eligiblePoolKeys.includes(poolKey) ? "collecting" : "unconfigured", recordedByUserId: req.user.id, createdAt: now, updatedAt: now })));
      if (relationshipId && stakeholderId) {
        await tx.update(eosStakeholderRelationships).set({ relationshipType: "customer", state: "active", nextBestAction: "Complete paid-and-signed Recovery onboarding in EOS.", updatedAt: now }).where(and(eq(eosStakeholderRelationships.id, relationshipId), eq(eosStakeholderRelationships.companyId, companyId), eq(eosStakeholderRelationships.stakeholderId, stakeholderId)));
        await tx.update(eosStakeholders).set({ partyType: "customer", state: "active", updatedAt: now }).where(and(eq(eosStakeholders.id, stakeholderId), eq(eosStakeholders.companyId, companyId)));
      }
      const event = await appendEvent(tx, { companyId, engagementId: id, eventType: "engagement_created", entityType: "engagement", entityId: id, fromState: "none", toState: "draft", engagementVersionBefore: 0, engagementVersionAfter: 1, evidenceIds: [], payload: { mode: input.mode, eligiblePoolKeys: input.eligiblePoolKeys, paidAndSignedVerified: input.mode === "paid_client", externalEffectsExecuted: false }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      await tx.update(eosRecoveryEngagements).set({ lastEventId: event.id }).where(eq(eosRecoveryEngagements.id, id));
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "recovery_operations.engagement.created", "recovery_engagement", id, "draft", { mode: input.mode, eventSha256: event.eventSha256, policyDecisionId: policy.decisionId, externalEffectsExecuted: false }));
      return engagement;
    });
    res.status(201).json(await engagementBundle(result));
  }));

  app.post("/api/eos/companies/:companyId/recovery-operations/engagements/:engagementId/evidence", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = recoveryEngagementEvidenceSchema.parse(req.body); const initial = await companyAccess(req); const engagement = await visibleEngagement(companyId, req.params.engagementId, initial); const { access, policy } = await operationsAccess(req, "execute", "recovery_operations.evidence.record", input.dataClassification);
    if (["provider_receipt", "delivery_receipt", "communication_receipt", "attribution_receipt", "recovery_receipt", "client_confirmation"].includes(input.evidenceType)) throw new EosRouteError(409, "recovery_external_evidence_requires_authoritative_ingress", "Provider, delivery, communication, attribution, recovery, and client-confirmation receipts must enter through an authoritative provider, portal, or governed Evidence workflow; an operator note cannot mint them.");
    if (input.capturedAt && input.capturedAt > new Date()) throw new EosRouteError(409, "recovery_evidence_time_invalid", "Evidence cannot be captured from the future.");
    const now = new Date(); const id = randomUUID(); const evidenceKey = `recovery-engagement:${engagement.id}:${id}`;
    const evidence = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`recovery-engagement:${engagement.id}`}))`);
      const [current] = await tx.select().from(eosRecoveryEngagements).where(eq(eosRecoveryEngagements.id, engagement.id)).limit(1);
      if (!current) throw new EosRouteError(404, "recovery_engagement_not_found", "Recovery engagement not found.");
      const [created] = await tx.insert(eosEvidence).values({ id, companyId, workPacketId: engagement.workPacketId, recordedByUserId: req.user.id, evidenceType: input.evidenceType, title: input.title, uri: null, details: { sourceReference: input.sourceReference, operatorAttestation: true, externalEffectExecutedByEos: false }, evidenceKey, claimSubjectType: "recovery_engagement", claimSubjectKey: engagement.id, verificationState: "verified", confidenceQuality: "medium", dataClassification: input.dataClassification, sourceSystem: input.sourceSystem, consentRights: input.consentRights, supportedClaimSummary: input.supportedClaimSummary, verifierMethod: input.verifierMethod, templateLearningEligibility: "not_eligible", capturedAt: input.capturedAt || now, validFrom: input.capturedAt || now, createdAt: now }).returning();
      const event = await appendEvent(tx, { companyId, engagementId: engagement.id, eventType: "evidence_recorded", entityType: "evidence", entityId: id, fromState: current.state, toState: current.state, engagementVersionBefore: current.version, engagementVersionAfter: current.version, evidenceIds: [id], payload: { evidenceType: input.evidenceType, sourceSystem: input.sourceSystem, verificationBoundary: "operator_attestation_not_independent_provider_proof" }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      await tx.update(eosRecoveryEngagements).set({ evidenceIds: Array.from(new Set([...(current.evidenceIds as string[]), id])), lastEventId: event.id, updatedAt: now }).where(eq(eosRecoveryEngagements.id, engagement.id));
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "recovery_operations.evidence.recorded", "evidence", id, "verified_operator_attestation", { engagementId: engagement.id, eventSha256: event.eventSha256, policyDecisionId: policy.decisionId, independentProviderProof: false }));
      return created;
    });
    res.status(201).json(evidence);
  }));

  app.post("/api/eos/companies/:companyId/recovery-operations/engagements/:engagementId/transitions", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = recoveryEngagementTransitionSchema.parse(req.body); const initial = await companyAccess(req); const engagement = await visibleEngagement(companyId, req.params.engagementId, initial); const bundle = await engagementBundle(engagement); assertTransitionPrerequisites(bundle, input.action); const evidence = await visibleEvidence(companyId, input.evidenceIds, initial);
    if (lifecycleEvidence[input.action]) requireEvidenceType(evidence, lifecycleEvidence[input.action]!, `${input.action.replaceAll("_", " ")}`);
    const authorityClass = ["approve_scope", "approve_campaigns", "start_renewal_review", "close", "cancel"].includes(input.action) ? "decide" : "execute";
    const { policy } = await operationsAccess(req, authorityClass, `recovery_operations.engagement.${input.action}`, engagement.classification);
    const next = nextRecoveryEngagementState({ state: engagement.state as RecoveryEngagementState, action: input.action, returnState: engagement.returnState }); const now = new Date();
    const updated = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`recovery-engagement:${engagement.id}`}))`);
      const [current] = await tx.select().from(eosRecoveryEngagements).where(eq(eosRecoveryEngagements.id, engagement.id)).limit(1);
      if (!current || current.version !== input.expectedVersion || current.state !== engagement.state) throw new EosRouteError(409, "recovery_engagement_version_conflict", "The engagement changed before this transition. Refresh and try again.");
      const nextVersion = current.version + 1; const blockers = input.action === "report_failure" ? [input.blocker] : input.action === "restore_safe_state" ? [] : current.blockers;
      const event = await appendEvent(tx, { companyId, engagementId: current.id, eventType: input.action, entityType: "engagement", entityId: current.id, fromState: current.state, toState: next.state, engagementVersionBefore: current.version, engagementVersionAfter: nextVersion, evidenceIds: evidence.map((item) => item.id), payload: { note: input.note, blocker: input.blocker || null, nextAction: input.nextAction, externalEffectsExecuted: false }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [row] = await tx.update(eosRecoveryEngagements).set({ state: next.state, returnState: next.returnState, blockers, evidenceIds: Array.from(new Set([...(current.evidenceIds as string[]), ...evidence.map((item) => item.id)])), nextAction: input.nextAction, nextActionAt: input.nextActionAt || null, version: nextVersion, lastEventId: event.id, updatedAt: now }).where(and(eq(eosRecoveryEngagements.id, current.id), eq(eosRecoveryEngagements.version, current.version))).returning();
      if (!row) throw new EosRouteError(409, "recovery_engagement_version_conflict", "The engagement changed before this transition.");
      await tx.update(eosWorkPackets).set({ status: next.state === "closed" ? "completed" : next.state === "cancelled" ? "cancelled" : next.state === "recovery_required" ? "blocked" : "in_progress", completedAt: next.state === "closed" ? now : null, updatedAt: now }).where(eq(eosWorkPackets.id, current.workPacketId));
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, `recovery_operations.engagement.${input.action}`, "recovery_engagement", current.id, next.state, { eventSha256: event.eventSha256, policyDecisionId: policy.decisionId, evidenceIds: evidence.map((item) => item.id), externalEffectsExecuted: false }));
      return row;
    });
    res.json(await engagementBundle(updated));
  }));

  app.put("/api/eos/companies/:companyId/recovery-operations/engagements/:engagementId/pools/:poolKey", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = recoveryPoolUpdateSchema.parse(req.body); if (!recoveryPoolKeys.includes(req.params.poolKey as any)) throw new EosRouteError(400, "recovery_pool_invalid", "Unknown Recovery pool."); const initial = await companyAccess(req); const engagement = await visibleEngagement(companyId, req.params.engagementId, initial); if (!(engagement.eligiblePoolKeys as string[]).includes(req.params.poolKey)) throw new EosRouteError(409, "recovery_pool_not_in_scope", "This pool is outside the approved engagement scope."); const evidence = await visibleEvidence(companyId, input.evidenceIds, initial); const { policy } = await operationsAccess(req, "execute", "recovery_operations.pool.update", engagement.classification); const pool = await db.query.eosRecoveryDeliveryPools.findFirst({ where: and(eq(eosRecoveryDeliveryPools.engagementId, engagement.id), eq(eosRecoveryDeliveryPools.poolKey, req.params.poolKey)) }); if (!pool || pool.version !== input.expectedVersion) throw new EosRouteError(409, "recovery_pool_version_conflict", "The Recovery pool changed before this update.");
    const now = new Date(); const result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(eosRecoveryDeliveryPools).set({ state: input.state, sourceSystemReference: input.sourceSystemReference, rawCount: input.rawCount, eligibleCount: input.eligibleCount, excludedCount: input.excludedCount, activationReadyCount: input.activationReadyCount, exclusionSummary: input.exclusionSummary, qualificationNote: input.qualificationNote, evidenceIds: evidence.map((item) => item.id), version: pool.version + 1, updatedAt: now }).where(and(eq(eosRecoveryDeliveryPools.id, pool.id), eq(eosRecoveryDeliveryPools.version, pool.version))).returning(); if (!updated) throw new EosRouteError(409, "recovery_pool_version_conflict", "The Recovery pool changed before this update.");
      const event = await appendEvent(tx, { companyId, engagementId: engagement.id, eventType: "pool_updated", entityType: "pool", entityId: pool.id, fromState: pool.state, toState: updated.state, engagementVersionBefore: engagement.version, engagementVersionAfter: engagement.version, evidenceIds: evidence.map((item) => item.id), payload: { poolKey: pool.poolKey, rawCount: updated.rawCount, eligibleCount: updated.eligibleCount, excludedCount: updated.excludedCount, activationReadyCount: updated.activationReadyCount }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now }); await tx.update(eosRecoveryEngagements).set({ lastEventId: event.id, updatedAt: now }).where(eq(eosRecoveryEngagements.id, engagement.id)); return updated;
    }); res.json(result);
  }));

  app.put("/api/eos/companies/:companyId/recovery-operations/engagements/:engagementId/campaigns", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = recoveryCampaignUpsertSchema.parse(req.body); const initial = await companyAccess(req); const engagement = await visibleEngagement(companyId, req.params.engagementId, initial); if (!(engagement.eligiblePoolKeys as string[]).includes(input.poolKey)) throw new EosRouteError(409, "recovery_campaign_pool_not_in_scope", "Campaigns may only target an approved Recovery pool."); const visible = await visibleSeatIds(companyId, initial.seat.id, initial.role); if (!visible.has(input.routingOwnerSeatId) || !visible.has(input.escalationOwnerSeatId)) throw new EosRouteError(403, "recovery_campaign_owner_scope_denied", "Campaign owners must be inside this operator's visible hierarchy."); let binding = null; if (input.integrationBindingId) { binding = await db.query.eosIntegrationBindings.findFirst({ where: and(eq(eosIntegrationBindings.id, input.integrationBindingId), eq(eosIntegrationBindings.companyId, companyId)) }); if (!binding) throw new EosRouteError(409, "recovery_campaign_binding_invalid", "Select a company-local Integration Binding."); }
    const { policy } = await operationsAccess(req, "execute", "recovery_operations.campaign.configure", engagement.classification); const now = new Date(); const id = input.campaignId || randomUUID(); let beforeState = "none"; let campaign;
    await db.transaction(async (tx) => {
      if (input.campaignId) { const [current] = await tx.select().from(eosRecoveryCampaignControls).where(and(eq(eosRecoveryCampaignControls.id, input.campaignId), eq(eosRecoveryCampaignControls.engagementId, engagement.id))).limit(1); if (!current || current.version !== input.expectedVersion || !["draft", "rejected"].includes(current.state)) throw new EosRouteError(409, "recovery_campaign_version_conflict", "Only a current draft or rejected campaign can be edited."); beforeState = current.state; [campaign] = await tx.update(eosRecoveryCampaignControls).set({ poolKey: input.poolKey, name: input.name, channel: input.channel, integrationBindingId: input.integrationBindingId || null, messageVersionReference: input.messageVersionReference, consentBasis: input.consentBasis, quietHours: input.quietHours, cadence: input.cadence, stopConditions: input.stopConditions, optOutHandling: input.optOutHandling, routingOwnerSeatId: input.routingOwnerSeatId, escalationOwnerSeatId: input.escalationOwnerSeatId, state: "draft", approvalEvidenceIds: [], version: current.version + 1, updatedAt: now }).where(and(eq(eosRecoveryCampaignControls.id, current.id), eq(eosRecoveryCampaignControls.version, current.version))).returning(); }
      else { [campaign] = await tx.insert(eosRecoveryCampaignControls).values({ id, companyId, engagementId: engagement.id, poolKey: input.poolKey, name: input.name, channel: input.channel, integrationBindingId: input.integrationBindingId || null, messageVersionReference: input.messageVersionReference, consentBasis: input.consentBasis, quietHours: input.quietHours, cadence: input.cadence, stopConditions: input.stopConditions, optOutHandling: input.optOutHandling, routingOwnerSeatId: input.routingOwnerSeatId, escalationOwnerSeatId: input.escalationOwnerSeatId, recordedByUserId: req.user.id, createdAt: now, updatedAt: now }).returning(); }
      const event = await appendEvent(tx, { companyId, engagementId: engagement.id, eventType: "campaign_configured", entityType: "campaign", entityId: id, fromState: beforeState, toState: "draft", engagementVersionBefore: engagement.version, engagementVersionAfter: engagement.version, evidenceIds: [], payload: { poolKey: input.poolKey, channel: input.channel, bindingId: input.integrationBindingId || null, credentialMaterialStored: false }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now }); await tx.update(eosRecoveryCampaignControls).set({ lastEventId: event.id }).where(eq(eosRecoveryCampaignControls.id, id)); await tx.update(eosRecoveryEngagements).set({ lastEventId: event.id, updatedAt: now }).where(eq(eosRecoveryEngagements.id, engagement.id));
    }); res.status(input.campaignId ? 200 : 201).json(campaign);
  }));

  app.post("/api/eos/companies/:companyId/recovery-operations/engagements/:engagementId/campaigns/:campaignId/decisions", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = recoveryCampaignDecisionSchema.parse(req.body); const initial = await companyAccess(req); const engagement = await visibleEngagement(companyId, req.params.engagementId, initial); const evidence = await visibleEvidence(companyId, input.evidenceIds, initial); const campaign = await db.query.eosRecoveryCampaignControls.findFirst({ where: and(eq(eosRecoveryCampaignControls.id, req.params.campaignId), eq(eosRecoveryCampaignControls.engagementId, engagement.id), eq(eosRecoveryCampaignControls.companyId, companyId)) }); if (!campaign || campaign.version !== input.expectedVersion) throw new EosRouteError(409, "recovery_campaign_version_conflict", "The campaign changed before this decision.");
    const mapping: Record<string, { from: string[]; to: string; authority: "execute" | "approve" | "decide" }> = { submit: { from: ["draft"], to: "awaiting_approval", authority: "execute" }, approve: { from: ["awaiting_approval"], to: "approved", authority: "approve" }, reject: { from: ["awaiting_approval"], to: "rejected", authority: "approve" }, verify_test: { from: ["approved"], to: "tested", authority: "execute" }, activate: { from: ["tested", "paused"], to: "active", authority: "approve" }, pause: { from: ["active"], to: "paused", authority: "decide" }, complete: { from: ["active", "paused"], to: "completed", authority: "decide" } };
    const transition = mapping[input.decision]; if (!transition.from.includes(campaign.state)) throw new EosRouteError(409, "recovery_campaign_transition_invalid", `Campaign ${input.decision} is not allowed from ${campaign.state}.`);
    const campaignEvidence: Record<string, string[]> = { submit: ["campaign_approval", "operator_observation", "data_quality_receipt"], approve: ["campaign_approval"], reject: ["campaign_approval"], verify_test: ["provider_receipt", "delivery_receipt", "communication_receipt"], activate: ["provider_receipt", "delivery_receipt", "communication_receipt"], pause: ["operator_observation", "recovery_receipt", "provider_receipt"], complete: ["delivery_receipt", "attribution_receipt", "client_confirmation"] };
    requireEvidenceType(evidence, campaignEvidence[input.decision], `campaign ${input.decision.replaceAll("_", " ")}`);
    if (input.decision === "activate") { if (!["bounded_launch", "operating", "reporting", "guarantee_review"].includes(engagement.state)) throw new EosRouteError(409, "recovery_campaign_engagement_not_ready", "Campaign activation requires the bounded-launch or operating stage."); if (campaign.channel !== "manual") { const binding = campaign.integrationBindingId ? await db.query.eosIntegrationBindings.findFirst({ where: eq(eosIntegrationBindings.id, campaign.integrationBindingId) }) : null; if (!providerBindingReady(binding)) throw new EosRouteError(409, "recovery_campaign_binding_not_ready", "Automated campaign activation requires the exact active, connected, healthy, parity-qualified provider binding and managed-secret reference."); } }
    const { policy } = await operationsAccess(req, transition.authority, `recovery_operations.campaign.${input.decision}`, engagement.classification); const now = new Date(); const updated = await db.transaction(async (tx) => { const [row] = await tx.update(eosRecoveryCampaignControls).set({ state: transition.to, approvalEvidenceIds: Array.from(new Set([...(campaign.approvalEvidenceIds as string[]), ...evidence.map((item) => item.id)])), version: campaign.version + 1, updatedAt: now }).where(and(eq(eosRecoveryCampaignControls.id, campaign.id), eq(eosRecoveryCampaignControls.version, campaign.version))).returning(); if (!row) throw new EosRouteError(409, "recovery_campaign_version_conflict", "The campaign changed before this decision."); const event = await appendEvent(tx, { companyId, engagementId: engagement.id, eventType: `campaign_${input.decision}`, entityType: "campaign", entityId: campaign.id, fromState: campaign.state, toState: row.state, engagementVersionBefore: engagement.version, engagementVersionAfter: engagement.version, evidenceIds: evidence.map((item) => item.id), payload: { note: input.note, providerEffectExecutedByTransition: false }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now }); await tx.update(eosRecoveryCampaignControls).set({ lastEventId: event.id }).where(eq(eosRecoveryCampaignControls.id, campaign.id)); await tx.update(eosRecoveryEngagements).set({ lastEventId: event.id, updatedAt: now }).where(eq(eosRecoveryEngagements.id, engagement.id)); return row; }); res.json(updated);
  }));

  app.post("/api/eos/companies/:companyId/recovery-operations/engagements/:engagementId/opportunities", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = recoveryOpportunityCreateSchema.parse(req.body); const initial = await companyAccess(req); const engagement = await visibleEngagement(companyId, req.params.engagementId, initial); if (!["bounded_launch", "operating", "reporting", "guarantee_review", "renewal_review"].includes(engagement.state)) throw new EosRouteError(409, "recovery_opportunity_stage_invalid", "Real opportunities are recorded only after the engagement reaches bounded launch."); if (!(engagement.eligiblePoolKeys as string[]).includes(input.poolKey)) throw new EosRouteError(409, "recovery_opportunity_pool_not_in_scope", "The opportunity pool is outside this engagement's scope."); const visible = await visibleSeatIds(companyId, initial.seat.id, initial.role); if (!visible.has(input.ownerSeatId)) throw new EosRouteError(403, "recovery_opportunity_owner_scope_denied", "The opportunity owner is outside this operator's visible hierarchy."); const evidence = await visibleEvidence(companyId, input.evidenceIds, initial); const { policy } = await operationsAccess(req, "execute", "recovery_operations.opportunity.record", engagement.classification); const id = randomUUID(); const externalReferenceSha256 = createHash("sha256").update(`${companyId}:${engagement.id}:${input.poolKey}:${input.externalReference.trim()}`).digest("hex"); const now = new Date();
    const opportunity = await db.transaction(async (tx) => { const [created] = await tx.insert(eosRecoveryOpportunities).values({ id, companyId, engagementId: engagement.id, poolKey: input.poolKey, externalReferenceSha256, title: input.title, summary: input.summary, ownerSeatId: input.ownerSeatId, estimatedValueMinor: input.estimatedValueMinor, nextAction: input.nextAction, nextActionAt: input.nextActionAt || null, evidenceIds: evidence.map((item) => item.id), recordedByUserId: req.user.id, createdAt: now, updatedAt: now }).returning(); const event = await appendEvent(tx, { companyId, engagementId: engagement.id, eventType: "opportunity_identified", entityType: "opportunity", entityId: id, fromState: "none", toState: "identified", engagementVersionBefore: engagement.version, engagementVersionAfter: engagement.version, evidenceIds: evidence.map((item) => item.id), payload: { poolKey: input.poolKey, externalReferenceStored: false, estimatedValueMinor: input.estimatedValueMinor }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now }); await tx.update(eosRecoveryOpportunities).set({ lastEventId: event.id }).where(eq(eosRecoveryOpportunities.id, id)); await tx.update(eosRecoveryEngagements).set({ lastEventId: event.id, updatedAt: now }).where(eq(eosRecoveryEngagements.id, engagement.id)); return created; }); res.status(201).json(opportunity);
  }));

  app.post("/api/eos/companies/:companyId/recovery-operations/engagements/:engagementId/opportunities/:opportunityId/transitions", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = recoveryOpportunityTransitionSchema.parse(req.body); const initial = await companyAccess(req); const engagement = await visibleEngagement(companyId, req.params.engagementId, initial); const evidence = await visibleEvidence(companyId, input.evidenceIds, initial); const opportunity = await db.query.eosRecoveryOpportunities.findFirst({ where: and(eq(eosRecoveryOpportunities.id, req.params.opportunityId), eq(eosRecoveryOpportunities.engagementId, engagement.id), eq(eosRecoveryOpportunities.companyId, companyId)) }); if (!opportunity || opportunity.version !== input.expectedVersion) throw new EosRouteError(409, "recovery_opportunity_version_conflict", "The opportunity changed before this transition.");
    if (!recoveryOpportunityTransitionAllowed(opportunity.state as any, input.state)) throw new EosRouteError(409, "recovery_opportunity_transition_invalid", `Opportunity state ${opportunity.state} cannot advance to ${input.state}.`);
    if (!recoveryAttributionAllowed(input.state, input.attributionModel)) throw new EosRouteError(409, "recovery_attribution_invalid", "Direct attribution is recorded only for booked or won outcomes with Evidence.");
    const opportunityEvidence: Record<string, string[]> = { contacted: ["communication_receipt", "provider_receipt", "delivery_receipt"], replied: ["communication_receipt", "client_confirmation"], qualified: ["operator_observation", "communication_receipt", "data_quality_receipt"], routed: ["communication_receipt", "operator_observation"], booked: ["communication_receipt", "client_confirmation", "provider_receipt"], won: ["attribution_receipt", "client_confirmation", "provider_receipt"], lost: ["operator_observation", "communication_receipt", "client_confirmation"], suppressed: ["consent_review", "communication_receipt", "recovery_receipt"], disputed: ["operator_observation", "client_confirmation", "recovery_receipt"], identified: ["operator_observation", "data_quality_receipt"] };
    requireEvidenceType(evidence, opportunityEvidence[input.state], `opportunity ${input.state}`);
    const authorityClass = ["won", "lost", "suppressed"].includes(input.state) ? "decide" : "execute"; const { policy } = await operationsAccess(req, authorityClass, `recovery_operations.opportunity.${input.state}`, engagement.classification); const now = new Date();
    const updated = await db.transaction(async (tx) => { const [row] = await tx.update(eosRecoveryOpportunities).set({ state: input.state, actualValueMinor: input.actualValueMinor, attributionModel: input.attributionModel, nextAction: input.nextAction, nextActionAt: input.nextActionAt || null, evidenceIds: Array.from(new Set([...(opportunity.evidenceIds as string[]), ...evidence.map((item) => item.id)])), version: opportunity.version + 1, updatedAt: now }).where(and(eq(eosRecoveryOpportunities.id, opportunity.id), eq(eosRecoveryOpportunities.version, opportunity.version))).returning(); if (!row) throw new EosRouteError(409, "recovery_opportunity_version_conflict", "The opportunity changed before this transition."); const event = await appendEvent(tx, { companyId, engagementId: engagement.id, eventType: "opportunity_transitioned", entityType: "opportunity", entityId: opportunity.id, fromState: opportunity.state, toState: row.state, engagementVersionBefore: engagement.version, engagementVersionAfter: engagement.version, evidenceIds: evidence.map((item) => item.id), payload: { note: input.note, actualValueMinor: input.actualValueMinor, attributionModel: input.attributionModel }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now }); await tx.update(eosRecoveryOpportunities).set({ lastEventId: event.id }).where(eq(eosRecoveryOpportunities.id, opportunity.id)); await tx.update(eosRecoveryEngagements).set({ lastEventId: event.id, updatedAt: now }).where(eq(eosRecoveryEngagements.id, engagement.id)); return row; }); res.json(updated);
  }));

  app.post("/api/eos/companies/:companyId/recovery-operations/engagements/:engagementId/customer-success-link", route(async (req, res) => {
    const schema = z.object({ expectedVersion: z.coerce.number().int().positive(), customerSuccessAccountId: z.string().uuid(), evidenceIds: z.array(z.string().uuid()).min(1).max(20), note: z.string().trim().min(20).max(3000) }); const companyId = Number(req.params.companyId); const input = schema.parse(req.body); const initial = await companyAccess(req); const engagement = await visibleEngagement(companyId, req.params.engagementId, initial); if (engagement.mode !== "paid_client" || !engagement.stakeholderId || !engagement.relationshipId) throw new EosRouteError(409, "recovery_customer_success_link_not_applicable", "Customer Success linking applies only to a paid-client engagement."); const evidence = await visibleEvidence(companyId, input.evidenceIds, initial); const account = await db.query.eosCustomerSuccessAccounts.findFirst({ where: and(eq(eosCustomerSuccessAccounts.id, input.customerSuccessAccountId), eq(eosCustomerSuccessAccounts.companyId, companyId), eq(eosCustomerSuccessAccounts.stakeholderId, engagement.stakeholderId), eq(eosCustomerSuccessAccounts.relationshipId, engagement.relationshipId)) }); if (!account) throw new EosRouteError(409, "recovery_customer_success_account_invalid", "Select the Customer Success account for this exact canonical customer relationship."); const { policy } = await operationsAccess(req, "decide", "recovery_operations.customer_success.link", engagement.classification); const now = new Date();
    const updated = await db.transaction(async (tx) => { const [current] = await tx.select().from(eosRecoveryEngagements).where(eq(eosRecoveryEngagements.id, engagement.id)).limit(1); if (!current || current.version !== input.expectedVersion) throw new EosRouteError(409, "recovery_engagement_version_conflict", "The engagement changed before Customer Success linking."); const event = await appendEvent(tx, { companyId, engagementId: engagement.id, eventType: "customer_success_linked", entityType: "customer_success", entityId: account.id, fromState: current.state, toState: current.state, engagementVersionBefore: current.version, engagementVersionAfter: current.version + 1, evidenceIds: evidence.map((item) => item.id), payload: { note: input.note, stakeholderId: account.stakeholderId, relationshipId: account.relationshipId }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now }); const [row] = await tx.update(eosRecoveryEngagements).set({ customerSuccessAccountId: account.id, evidenceIds: Array.from(new Set([...(current.evidenceIds as string[]), ...evidence.map((item) => item.id)])), version: current.version + 1, lastEventId: event.id, updatedAt: now }).where(and(eq(eosRecoveryEngagements.id, current.id), eq(eosRecoveryEngagements.version, current.version))).returning(); return row; }); res.json(await engagementBundle(updated));
  }));
}
