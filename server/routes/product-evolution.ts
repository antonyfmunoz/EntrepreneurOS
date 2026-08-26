import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { ZodError } from "zod";
import {
  eosAuditRecords, eosEvidence, eosOfferPrograms, eosProductChangeProposals,
  eosProductEvolutionEvents, eosProductExperimentObservations, eosProductExperiments,
  eosProductFeedbackSignals, eosSeats, eosWorkPackets,
} from "@shared/schema";
import {
  nextRolloutStage, offerPatchSchema, productApplySchema, productCompatibilityReviewSchema,
  productExperimentConclusionSchema, productExperimentSchema, productExperimentTransitionSchema,
  productFeedbackSchema, productObservationSchema, productProposalSchema,
  productReleaseDecisionSchema, productRolloutAdvanceSchema, productRolloutRollbackSchema,
  productRolloutStartSchema,
} from "@shared/product-evolution";
import { allowedSurfacesFor } from "@shared/eos-runtime";
import { db } from "../db";
import { nativeContractContentSha256 } from "../esign/template-generation";
import { EosRouteError, authorizeAction, companyAccess, mayAccessClassification, visibleSeatIds } from "./eos-runtime";

type Access = Awaited<ReturnType<typeof companyAccess>>;

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof EosRouteError) return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof ZodError) return res.status(400).json({ code: "product_evolution_input_invalid", message: error.issues[0]?.message || "Product-evolution input is invalid." });
      next(error);
    }
  };
}

async function evolutionAccess(req: Request, authorityClass: "view" | "execute" | "decide", actionKey: string, classification = "confidential") {
  const access = await companyAccess(req);
  if (!allowedSurfacesFor(access.role).includes("operations")) throw new EosRouteError(403, "product_evolution_scope_denied", "Product evolution is outside this role's compiled Operations workspace.");
  const policy = await authorizeAction(req, access, {
    authorityClass, resource: "product_change_proposal", actionKey,
    purpose: authorityClass === "view" ? "inspect_product_evolution" : "govern_product_evolution",
    classification, consequence: authorityClass === "decide" ? "material" : "routine", targetSeatId: access.seat.id,
  });
  return { access, policy };
}

function offerSnapshot(offer: typeof eosOfferPrograms.$inferSelect) {
  return {
    id: offer.id, offerKey: offer.offerKey, name: offer.name, offerType: offer.offerType, state: offer.state,
    problemNeed: offer.problemNeed, promiseOutcome: offer.promiseOutcome, scopeInclusions: offer.scopeInclusions,
    exclusionsConstraints: offer.exclusionsConstraints, deliveryModel: offer.deliveryModel,
    pricingEconomicModel: offer.pricingEconomicModel, commercialTermsAuthority: offer.commercialTermsAuthority,
    metricKeys: offer.metricKeys, workflowKeys: offer.workflowKeys, classification: offer.classification,
  };
}

function hash(value: unknown) { return nativeContractContentSha256(value); }

async function visibleOffer(companyId: number, offerId: string, access: Access) {
  const offer = await db.query.eosOfferPrograms.findFirst({ where: and(eq(eosOfferPrograms.id, offerId), eq(eosOfferPrograms.companyId, companyId)) });
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  if (!offer || !visible.has(offer.ownerSeatId) || !mayAccessClassification(access, offer.classification)) throw new EosRouteError(404, "product_offer_not_found", "Offer not found in this authority scope.");
  return offer;
}

async function visibleProposal(companyId: number, proposalId: string, access: Access) {
  const proposal = await db.query.eosProductChangeProposals.findFirst({ where: and(eq(eosProductChangeProposals.id, proposalId), eq(eosProductChangeProposals.companyId, companyId)) });
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  if (!proposal || !visible.has(proposal.ownerSeatId) || !mayAccessClassification(access, proposal.classification)) throw new EosRouteError(404, "product_proposal_not_found", "Change proposal not found in this authority scope.");
  return proposal;
}

async function visibleExperiment(companyId: number, proposalId: string, experimentId: string, access: Access) {
  const experiment = await db.query.eosProductExperiments.findFirst({ where: and(eq(eosProductExperiments.id, experimentId), eq(eosProductExperiments.proposalId, proposalId), eq(eosProductExperiments.companyId, companyId)) });
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  if (!experiment || !visible.has(experiment.ownerSeatId) || !mayAccessClassification(access, experiment.classification)) throw new EosRouteError(404, "product_experiment_not_found", "Experiment not found in this authority scope.");
  return experiment;
}

async function verifiedEvidence(companyId: number, ids: string[], access: Access) {
  const unique = Array.from(new Set(ids));
  if (!unique.length || unique.length !== ids.length) throw new EosRouteError(409, "product_evolution_evidence_invalid", "Evidence references must be unique and non-empty.");
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  const rows = await db.select({ evidence: eosEvidence, packet: eosWorkPackets }).from(eosEvidence)
    .innerJoin(eosWorkPackets, eq(eosWorkPackets.id, eosEvidence.workPacketId))
    .where(and(eq(eosEvidence.companyId, companyId), eq(eosWorkPackets.companyId, companyId), inArray(eosEvidence.id, unique)));
  const allowed = rows.filter(({ evidence, packet }) => evidence.verificationState === "verified" && mayAccessClassification(access, evidence.dataClassification) && mayAccessClassification(access, packet.classification) && (access.isOwner || Boolean(packet.accountableSeatId && visible.has(packet.accountableSeatId))));
  if (allowed.length !== unique.length) throw new EosRouteError(409, "product_evolution_evidence_invalid", "Every Evidence item must be verified and visible in this company, hierarchy, and classification scope.");
  return allowed.map(({ evidence }) => evidence);
}

async function appendEvent(tx: any, values: {
  companyId: number; proposalId?: string | null; offerId: string; eventType: string;
  subjectType: "feedback" | "proposal" | "experiment" | "observation" | "offer"; subjectId: string;
  versionBefore: number; versionAfter: number; evidenceIds: string[]; payload: Record<string, unknown>;
  policyDecisionId: string; recordedByUserId: string; recordedAt: Date;
}) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`product-evolution-chain:${values.proposalId || `offer:${values.offerId}`}`}))`);
  const chainWhere = values.proposalId
    ? eq(eosProductEvolutionEvents.proposalId, values.proposalId)
    : and(eq(eosProductEvolutionEvents.offerId, values.offerId), isNull(eosProductEvolutionEvents.proposalId));
  const [previous] = await tx.select().from(eosProductEvolutionEvents).where(chainWhere).orderBy(desc(eosProductEvolutionEvents.recordedAt), desc(eosProductEvolutionEvents.id)).limit(1);
  const id = randomUUID(); const previousEventSha256 = previous?.eventSha256 || "";
  const eventSha256 = hash({ schemaVersion: "eos-product-evolution-event.v1", id, previousEventSha256, ...values, recordedAt: values.recordedAt.toISOString() });
  const [event] = await tx.insert(eosProductEvolutionEvents).values({ id, previousEventSha256, eventSha256, ...values }).returning();
  return event;
}

function audit(companyId: number, userId: string, action: string, targetType: string, targetId: string, result: string, policy: any, details: Record<string, unknown>) {
  return { id: randomUUID(), companyId, actorUserId: userId, action, targetType, targetId, traceId: policy.traceId, correlationId: policy.correlationId, result, details: { ...details, policyDecisionId: policy.decisionId }, createdAt: new Date() };
}

export function registerProductEvolutionRoutes(app: Express): void {
  app.get("/api/eos/companies/:companyId/product-evolution", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const { access } = await evolutionAccess(req, "view", "product_evolution.state.read");
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
    const [offers, feedback, proposals, experiments, observations, events, evidenceRows, seats] = await Promise.all([
      db.select().from(eosOfferPrograms).where(eq(eosOfferPrograms.companyId, companyId)).orderBy(eosOfferPrograms.name),
      db.select().from(eosProductFeedbackSignals).where(eq(eosProductFeedbackSignals.companyId, companyId)).orderBy(desc(eosProductFeedbackSignals.observedAt)),
      db.select().from(eosProductChangeProposals).where(eq(eosProductChangeProposals.companyId, companyId)).orderBy(desc(eosProductChangeProposals.updatedAt)),
      db.select().from(eosProductExperiments).where(eq(eosProductExperiments.companyId, companyId)).orderBy(desc(eosProductExperiments.updatedAt)),
      db.select().from(eosProductExperimentObservations).where(eq(eosProductExperimentObservations.companyId, companyId)).orderBy(desc(eosProductExperimentObservations.recordedAt)),
      db.select().from(eosProductEvolutionEvents).where(eq(eosProductEvolutionEvents.companyId, companyId)).orderBy(desc(eosProductEvolutionEvents.recordedAt)),
      db.select({ evidence: eosEvidence, packet: eosWorkPackets }).from(eosEvidence).innerJoin(eosWorkPackets, eq(eosWorkPackets.id, eosEvidence.workPacketId)).where(and(eq(eosEvidence.companyId, companyId), eq(eosEvidence.verificationState, "verified"))),
      db.select().from(eosSeats).where(and(eq(eosSeats.companyId, companyId), eq(eosSeats.status, "active"))).orderBy(eosSeats.title),
    ]);
    const visibleOffers = offers.filter((item) => visible.has(item.ownerSeatId) && mayAccessClassification(access, item.classification)); const offerIds = new Set(visibleOffers.map((item) => item.id));
    const visibleProposals = proposals.filter((item) => offerIds.has(item.offerId) && visible.has(item.ownerSeatId) && mayAccessClassification(access, item.classification)); const proposalIds = new Set(visibleProposals.map((item) => item.id));
    const visibleExperiments = experiments.filter((item) => proposalIds.has(item.proposalId) && visible.has(item.ownerSeatId) && mayAccessClassification(access, item.classification)); const experimentIds = new Set(visibleExperiments.map((item) => item.id));
    const visibleEvidence = evidenceRows.filter(({ evidence, packet }) => mayAccessClassification(access, evidence.dataClassification) && mayAccessClassification(access, packet.classification) && (access.isOwner || Boolean(packet.accountableSeatId && visible.has(packet.accountableSeatId))));
    res.json({
      generatedAt: new Date().toISOString(), offers: visibleOffers, feedback: feedback.filter((item) => offerIds.has(item.offerId) && mayAccessClassification(access, item.classification)), proposals: visibleProposals,
      experiments: visibleExperiments, observations: observations.filter((item) => proposalIds.has(item.proposalId) && experimentIds.has(item.experimentId)), events: events.filter((item) => offerIds.has(item.offerId) && (!item.proposalId || proposalIds.has(item.proposalId))),
      evidence: visibleEvidence.map(({ evidence }) => ({ id: evidence.id, title: evidence.title, evidenceType: evidence.evidenceType, dataClassification: evidence.dataClassification })),
      seats: seats.filter((item) => visible.has(item.id)).map((item) => ({ id: item.id, title: item.title, kind: item.kind })),
      counts: { offers: visibleOffers.length, signals: feedback.filter((item) => offerIds.has(item.offerId)).length, openProposals: visibleProposals.filter((item) => item.releaseDecision === "pending").length, runningExperiments: visibleExperiments.filter((item) => item.state === "running").length, activeRollouts: visibleProposals.filter((item) => item.rolloutState === "running").length, readyToApply: visibleProposals.filter((item) => item.rolloutState === "completed" && !item.appliedAt).length },
      boundary: "EOS records evidence-backed product learning and explicit release authority. Drafts are not released truth, telemetry references are not provider truth without receipts, and canonical offers change only through the final founder-controlled apply step.",
    });
  }));

  app.post("/api/eos/companies/:companyId/product-evolution/feedback", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = productFeedbackSchema.parse(req.body); const { access, policy } = await evolutionAccess(req, "execute", "product_evolution.feedback.record", input.classification);
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    await visibleOffer(companyId, input.offerId, access); const evidence = await verifiedEvidence(companyId, input.evidenceIds, access); const now = new Date(); const id = randomUUID();
    const signalSha256 = hash({ schemaVersion: "eos-product-feedback.v1", id, companyId, ...input, observedAt: input.observedAt.toISOString(), evidenceIds: evidence.map((item) => item.id) });
    const result = await db.transaction(async (tx) => {
      const [signal] = await tx.insert(eosProductFeedbackSignals).values({ id, companyId, offerId: input.offerId, source: input.source, sourceReference: input.sourceReference, summary: input.summary, observedAt: input.observedAt, evidenceIds: evidence.map((item) => item.id), classification: input.classification, signalSha256, recordedByUserId: req.user.id, recordedAt: now }).returning();
      const event = await appendEvent(tx, { companyId, proposalId: null, offerId: input.offerId, eventType: "feedback_recorded", subjectType: "feedback", subjectId: id, versionBefore: 0, versionAfter: 0, evidenceIds: evidence.map((item) => item.id), payload: { source: input.source, sourceReference: input.sourceReference, signalSha256 }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "product_evolution.feedback.recorded", "product_feedback", id, "recorded", policy, { eventSha256: event.eventSha256, signalSha256 })); return { signal, event };
    }); res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/product-evolution/proposals", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = productProposalSchema.parse(req.body); const { access, policy } = await evolutionAccess(req, "execute", "product_evolution.proposal.create", input.classification);
    if (access.company.id !== companyId || !mayAccessClassification(access, input.classification)) throw new EosRouteError(403, "product_evolution_scope_denied", "Proposal company or classification is outside this authority scope.");
    const offer = await visibleOffer(companyId, input.offerId, access); const visible = await visibleSeatIds(companyId, access.seat.id, access.role); if (!visible.has(input.ownerSeatId)) throw new EosRouteError(403, "product_evolution_owner_scope_denied", "Proposal owner is outside this operator's visible hierarchy.");
    const feedback = input.feedbackSignalIds.length ? await db.select().from(eosProductFeedbackSignals).where(and(eq(eosProductFeedbackSignals.companyId, companyId), inArray(eosProductFeedbackSignals.id, input.feedbackSignalIds))) : [];
    if (feedback.length !== input.feedbackSignalIds.length || feedback.some((item) => item.offerId !== offer.id || !mayAccessClassification(access, item.classification))) throw new EosRouteError(409, "product_feedback_reference_invalid", "Every feedback signal must be visible and belong to this offer.");
    const now = new Date(); const id = randomUUID(); const baselineOfferSnapshot = offerSnapshot(offer); const baselineOfferSha256 = hash(baselineOfferSnapshot);
    const proposalSha256 = hash({ schemaVersion: "eos-product-change-proposal.v1", id, companyId, offerId: offer.id, baselineOfferSha256, proposedPatch: input.proposedPatch, hypothesis: input.hypothesis, rollbackPlan: input.rollbackPlan, successMetric: input.successMetric, guardrailMetric: input.guardrailMetric, feedbackSignalIds: input.feedbackSignalIds });
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`product-proposal:${companyId}:${input.proposalKey}`}))`);
      const [proposal] = await tx.insert(eosProductChangeProposals).values({ id, companyId, offerId: offer.id, proposalKey: input.proposalKey, title: input.title, hypothesis: input.hypothesis, baselineOfferSnapshot, baselineOfferSha256, proposedPatch: input.proposedPatch, proposalSha256, rollbackPlan: input.rollbackPlan, successMetric: input.successMetric, guardrailMetric: input.guardrailMetric, feedbackSignalIds: input.feedbackSignalIds, ownerSeatId: input.ownerSeatId, classification: input.classification, recordedByUserId: req.user.id, createdAt: now, updatedAt: now }).returning();
      const event = await appendEvent(tx, { companyId, proposalId: id, offerId: offer.id, eventType: "proposal_created", subjectType: "proposal", subjectId: id, versionBefore: 0, versionAfter: 1, evidenceIds: [], payload: { baselineOfferSha256, proposalSha256, proposedPatch: input.proposedPatch, feedbackSignalIds: input.feedbackSignalIds }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "product_evolution.proposal.created", "product_change_proposal", id, "draft", policy, { eventSha256: event.eventSha256, proposalSha256 })); return { proposal, event };
    }); res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/product-evolution/proposals/:proposalId/compatibility-reviews", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = productCompatibilityReviewSchema.parse(req.body); const initial = await companyAccess(req); const proposal = await visibleProposal(companyId, req.params.proposalId, initial); const evidence = await verifiedEvidence(companyId, input.evidenceIds, initial); const { policy } = await evolutionAccess(req, "decide", "product_evolution.compatibility.decide", proposal.classification);
    if (proposal.compatibilityOutcome !== "pending") throw new EosRouteError(409, "product_compatibility_already_decided", "Compatibility is immutable after review; create a new proposal to revise it."); const now = new Date();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`product-proposal:${proposal.id}`}))`); const [current] = await tx.select().from(eosProductChangeProposals).where(eq(eosProductChangeProposals.id, proposal.id)).limit(1);
      if (!current || current.version !== input.expectedVersion || current.compatibilityOutcome !== "pending") throw new EosRouteError(409, "product_proposal_version_conflict", "The proposal changed before compatibility review."); const nextVersion = current.version + 1;
      const event = await appendEvent(tx, { companyId, proposalId: current.id, offerId: current.offerId, eventType: "compatibility_reviewed", subjectType: "proposal", subjectId: current.id, versionBefore: current.version, versionAfter: nextVersion, evidenceIds: evidence.map((item) => item.id), payload: { outcome: input.outcome, rationale: input.rationale, affectedWorkflows: input.affectedWorkflows, affectedSegments: input.affectedSegments, affectedContracts: input.affectedContracts, migrationPlan: input.migrationPlan }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [updated] = await tx.update(eosProductChangeProposals).set({ compatibilityOutcome: input.outcome, compatibilityRationale: input.rationale, compatibilityScope: { workflows: input.affectedWorkflows, segments: input.affectedSegments, contracts: input.affectedContracts }, migrationPlan: input.migrationPlan, compatibilityEvidenceIds: evidence.map((item) => item.id), version: nextVersion, lastEventId: event.id, updatedAt: now }).where(and(eq(eosProductChangeProposals.id, current.id), eq(eosProductChangeProposals.version, current.version))).returning();
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "product_evolution.compatibility.reviewed", "product_change_proposal", current.id, input.outcome, policy, { eventSha256: event.eventSha256 })); return { proposal: updated, event };
    }); res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/product-evolution/proposals/:proposalId/experiments", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = productExperimentSchema.parse(req.body); const initial = await companyAccess(req); const proposal = await visibleProposal(companyId, req.params.proposalId, initial); const { access, policy } = await evolutionAccess(req, "execute", "product_evolution.experiment.create", input.classification);
    if (proposal.version !== input.expectedProposalVersion) throw new EosRouteError(409, "product_proposal_version_conflict", "Refresh the proposal before creating an experiment.");
    if (!["compatible", "breaking"].includes(proposal.compatibilityOutcome)) throw new EosRouteError(409, "product_compatibility_required", "A decided compatible or migration-backed breaking review is required before experimentation.");
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role); if (!visible.has(input.ownerSeatId) || !mayAccessClassification(access, input.classification)) throw new EosRouteError(403, "product_evolution_owner_scope_denied", "Experiment owner or classification is outside this authority scope.");
    const now = new Date(); const id = randomUUID(); const experimentSha256 = hash({ schemaVersion: "eos-product-experiment.v1", id, companyId, proposalId: proposal.id, question: input.question, cohortScope: input.cohortScope, allocationPercent: input.allocationPercent, startsAt: input.startsAt, endsAt: input.endsAt, successMetric: proposal.successMetric, guardrailMetric: proposal.guardrailMetric });
    const result = await db.transaction(async (tx) => {
      const [experiment] = await tx.insert(eosProductExperiments).values({ id, companyId, proposalId: proposal.id, question: input.question, cohortScope: input.cohortScope, allocationPercent: input.allocationPercent, startsAt: input.startsAt, endsAt: input.endsAt, successMetric: proposal.successMetric, guardrailMetric: proposal.guardrailMetric, experimentSha256, ownerSeatId: input.ownerSeatId, classification: input.classification, recordedByUserId: req.user.id, createdAt: now, updatedAt: now }).returning();
      const event = await appendEvent(tx, { companyId, proposalId: proposal.id, offerId: proposal.offerId, eventType: "experiment_created", subjectType: "experiment", subjectId: id, versionBefore: 0, versionAfter: 1, evidenceIds: [], payload: { experimentSha256, cohortScope: input.cohortScope, allocationPercent: input.allocationPercent }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "product_evolution.experiment.created", "product_experiment", id, "planned", policy, { proposalId: proposal.id, eventSha256: event.eventSha256 })); return { experiment, event };
    }); res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/product-evolution/proposals/:proposalId/experiments/:experimentId/transitions", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = productExperimentTransitionSchema.parse(req.body); const initial = await companyAccess(req); const proposal = await visibleProposal(companyId, req.params.proposalId, initial); const experiment = await visibleExperiment(companyId, proposal.id, req.params.experimentId, initial); const evidence = input.evidenceIds.length ? await verifiedEvidence(companyId, input.evidenceIds, initial) : []; const { policy } = await evolutionAccess(req, "execute", "product_evolution.experiment.transition", experiment.classification);
    if (proposal.version !== input.expectedProposalVersion || experiment.version !== input.expectedVersion) throw new EosRouteError(409, "product_experiment_version_conflict", "The proposal or experiment changed before transition.");
    if ((input.state === "running" && experiment.state !== "planned") || (input.state === "stopped" && !["planned", "running"].includes(experiment.state))) throw new EosRouteError(409, "product_experiment_transition_invalid", `Experiment cannot move from ${experiment.state} to ${input.state}.`); const now = new Date();
    const result = await db.transaction(async (tx) => { const nextVersion = experiment.version + 1; const eventType = input.state === "running" ? "experiment_started" : "experiment_stopped";
      const event = await appendEvent(tx, { companyId, proposalId: proposal.id, offerId: proposal.offerId, eventType, subjectType: "experiment", subjectId: experiment.id, versionBefore: experiment.version, versionAfter: nextVersion, evidenceIds: evidence.map((item) => item.id), payload: { stateBefore: experiment.state, stateAfter: input.state, rationale: input.rationale }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [updated] = await tx.update(eosProductExperiments).set({ state: input.state, version: nextVersion, lastEventId: event.id, updatedAt: now }).where(and(eq(eosProductExperiments.id, experiment.id), eq(eosProductExperiments.version, experiment.version))).returning(); if (!updated) throw new EosRouteError(409, "product_experiment_version_conflict", "Experiment changed before transition.");
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, `product_evolution.experiment.${input.state}`, "product_experiment", experiment.id, input.state, policy, { eventSha256: event.eventSha256, rationale: input.rationale })); return { experiment: updated, event };
    }); res.json(result);
  }));

  app.post("/api/eos/companies/:companyId/product-evolution/proposals/:proposalId/experiments/:experimentId/observations", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = productObservationSchema.parse(req.body); const initial = await companyAccess(req); const proposal = await visibleProposal(companyId, req.params.proposalId, initial); const experiment = await visibleExperiment(companyId, proposal.id, req.params.experimentId, initial); const evidence = await verifiedEvidence(companyId, input.evidenceIds, initial); const { policy } = await evolutionAccess(req, "execute", "product_evolution.observation.record", experiment.classification);
    if (proposal.version !== input.expectedProposalVersion || experiment.version !== input.expectedExperimentVersion || experiment.state !== "running") throw new EosRouteError(409, "product_experiment_not_running", "Observations require the current version of a running experiment.");
    if (["provider_receipt", "reconciled"].includes(input.sourceAuthority) && evidence.some((item) => !["provider_receipt", "deployment_receipt", "analytics_receipt", "delivery_receipt", "communication_receipt"].includes(item.evidenceType))) throw new EosRouteError(409, "product_observation_receipt_invalid", "Provider-backed observations require verified provider, analytics, deployment, delivery, or communication receipt Evidence.");
    const now = new Date(); const id = randomUUID();
    const observationSha256 = hash({ schemaVersion: "eos-product-observation.v1", id, companyId, proposalId: proposal.id, experimentId: experiment.id, ...input, evidenceIds: evidence.map((item) => item.id) });
    const result = await db.transaction(async (tx) => { const [observation] = await tx.insert(eosProductExperimentObservations).values({ id, companyId, proposalId: proposal.id, experimentId: experiment.id, metricKey: input.metricKey, value: input.value, unit: input.unit, windowStart: input.windowStart, windowEnd: input.windowEnd, sourceAuthority: input.sourceAuthority, externalReference: input.externalReference, evidenceIds: evidence.map((item) => item.id), observationSha256, recordedByUserId: req.user.id, recordedAt: now }).returning();
      const event = await appendEvent(tx, { companyId, proposalId: proposal.id, offerId: proposal.offerId, eventType: "observation_recorded", subjectType: "observation", subjectId: id, versionBefore: 0, versionAfter: 0, evidenceIds: evidence.map((item) => item.id), payload: { metricKey: input.metricKey, value: input.value, unit: input.unit, sourceAuthority: input.sourceAuthority, externalReference: input.externalReference, observationSha256 }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "product_evolution.observation.recorded", "product_observation", id, "recorded", policy, { experimentId: experiment.id, eventSha256: event.eventSha256, observationSha256 })); return { observation, event };
    }); res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/product-evolution/proposals/:proposalId/experiments/:experimentId/conclusions", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = productExperimentConclusionSchema.parse(req.body); const initial = await companyAccess(req); const proposal = await visibleProposal(companyId, req.params.proposalId, initial); const experiment = await visibleExperiment(companyId, proposal.id, req.params.experimentId, initial); const evidence = await verifiedEvidence(companyId, input.evidenceIds, initial); const { policy } = await evolutionAccess(req, "decide", "product_evolution.experiment.conclude", experiment.classification);
    if (proposal.version !== input.expectedProposalVersion || experiment.version !== input.expectedVersion || experiment.state !== "running") throw new EosRouteError(409, "product_experiment_conclusion_invalid", "Only the current version of a running experiment may be concluded.");
    const observations = await db.select({ id: eosProductExperimentObservations.id }).from(eosProductExperimentObservations).where(eq(eosProductExperimentObservations.experimentId, experiment.id)).limit(1); if (!observations.length) throw new EosRouteError(409, "product_experiment_observation_required", "Record at least one evidence-backed observation before conclusion."); const now = new Date();
    const result = await db.transaction(async (tx) => { const nextVersion = experiment.version + 1; const event = await appendEvent(tx, { companyId, proposalId: proposal.id, offerId: proposal.offerId, eventType: "experiment_concluded", subjectType: "experiment", subjectId: experiment.id, versionBefore: experiment.version, versionAfter: nextVersion, evidenceIds: evidence.map((item) => item.id), payload: { result: input.result, conclusion: input.conclusion }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [updated] = await tx.update(eosProductExperiments).set({ state: "concluded", result: input.result, conclusion: input.conclusion, conclusionEvidenceIds: evidence.map((item) => item.id), version: nextVersion, lastEventId: event.id, updatedAt: now }).where(and(eq(eosProductExperiments.id, experiment.id), eq(eosProductExperiments.version, experiment.version))).returning();
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "product_evolution.experiment.concluded", "product_experiment", experiment.id, input.result, policy, { eventSha256: event.eventSha256 })); return { experiment: updated, event };
    }); res.json(result);
  }));

  app.post("/api/eos/companies/:companyId/product-evolution/proposals/:proposalId/release-decisions", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = productReleaseDecisionSchema.parse(req.body); const initial = await companyAccess(req); const proposal = await visibleProposal(companyId, req.params.proposalId, initial); const evidence = await verifiedEvidence(companyId, input.evidenceIds, initial); const { policy } = await evolutionAccess(req, "decide", "product_evolution.release.decide", proposal.classification);
    if (proposal.version !== input.expectedVersion || proposal.releaseDecision !== "pending" || proposal.compatibilityOutcome === "pending") throw new EosRouteError(409, "product_release_decision_invalid", "Release requires the current undecided proposal and a compatibility review.");
    const experiment = await db.query.eosProductExperiments.findFirst({ where: eq(eosProductExperiments.proposalId, proposal.id) });
    if (input.decision === "ship" && (!experiment || experiment.state !== "concluded" || experiment.result !== "met")) throw new EosRouteError(409, "product_release_evidence_insufficient", "Ship requires a concluded experiment whose declared success conditions were met."); const now = new Date();
    const result = await db.transaction(async (tx) => { const nextVersion = proposal.version + 1; const event = await appendEvent(tx, { companyId, proposalId: proposal.id, offerId: proposal.offerId, eventType: "release_decided", subjectType: "proposal", subjectId: proposal.id, versionBefore: proposal.version, versionAfter: nextVersion, evidenceIds: evidence.map((item) => item.id), payload: { decision: input.decision, rationale: input.rationale, experimentId: experiment?.id || null, experimentResult: experiment?.result || null }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [updated] = await tx.update(eosProductChangeProposals).set({ releaseDecision: input.decision, releaseRationale: input.rationale, releaseEvidenceIds: evidence.map((item) => item.id), version: nextVersion, lastEventId: event.id, updatedAt: now }).where(and(eq(eosProductChangeProposals.id, proposal.id), eq(eosProductChangeProposals.version, proposal.version))).returning();
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "product_evolution.release.decided", "product_change_proposal", proposal.id, input.decision, policy, { eventSha256: event.eventSha256 })); return { proposal: updated, event };
    }); res.json(result);
  }));

  app.post("/api/eos/companies/:companyId/product-evolution/proposals/:proposalId/rollouts", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = productRolloutStartSchema.parse(req.body); const initial = await companyAccess(req); const proposal = await visibleProposal(companyId, req.params.proposalId, initial); const evidence = await verifiedEvidence(companyId, input.evidenceIds, initial); const { policy } = await evolutionAccess(req, "decide", "product_evolution.rollout.start", proposal.classification);
    if (proposal.version !== input.expectedVersion || proposal.releaseDecision !== "ship" || proposal.rolloutState !== "not_started" || input.initialStage !== "internal") throw new EosRouteError(409, "product_rollout_start_invalid", "Rollout must begin internally from the current shipped proposal."); const now = new Date();
    const result = await db.transaction(async (tx) => { const nextVersion = proposal.version + 1; const event = await appendEvent(tx, { companyId, proposalId: proposal.id, offerId: proposal.offerId, eventType: "rollout_started", subjectType: "proposal", subjectId: proposal.id, versionBefore: proposal.version, versionAfter: nextVersion, evidenceIds: evidence.map((item) => item.id), payload: { stage: "internal", allocationPercent: input.allocationPercent, rollbackThreshold: input.rollbackThreshold }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [updated] = await tx.update(eosProductChangeProposals).set({ rolloutState: "running", rolloutStage: "internal", rolloutPercent: input.allocationPercent, rollbackThreshold: input.rollbackThreshold, version: nextVersion, lastEventId: event.id, updatedAt: now }).where(and(eq(eosProductChangeProposals.id, proposal.id), eq(eosProductChangeProposals.version, proposal.version))).returning();
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "product_evolution.rollout.started", "product_change_proposal", proposal.id, "internal", policy, { eventSha256: event.eventSha256 })); return { proposal: updated, event };
    }); res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/product-evolution/proposals/:proposalId/rollout-advances", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = productRolloutAdvanceSchema.parse(req.body); const initial = await companyAccess(req); const proposal = await visibleProposal(companyId, req.params.proposalId, initial); const evidence = await verifiedEvidence(companyId, [input.receiptEvidenceId], initial); const { policy } = await evolutionAccess(req, "decide", "product_evolution.rollout.advance", proposal.classification);
    if (!new Set(["provider_receipt", "deployment_receipt", "analytics_receipt", "delivery_receipt", "communication_receipt"]).has(evidence[0].evidenceType)) throw new EosRouteError(409, "product_rollout_receipt_invalid", "Rollout advancement requires verified deployment or provider receipt Evidence.");
    const expectedStage = proposal.rolloutStage ? nextRolloutStage(proposal.rolloutStage as any) : null; if (proposal.version !== input.expectedVersion || proposal.rolloutState !== "running" || input.stage !== expectedStage || input.allocationPercent < Number(proposal.rolloutPercent || 0) || (input.stage === "general" && input.allocationPercent !== 100)) throw new EosRouteError(409, "product_rollout_advance_invalid", "Rollout must advance one stage at a time, never reduce allocation, and reach 100% at general availability."); const now = new Date(); const completed = input.stage === "general" && input.allocationPercent === 100;
    const result = await db.transaction(async (tx) => { const nextVersion = proposal.version + 1; const event = await appendEvent(tx, { companyId, proposalId: proposal.id, offerId: proposal.offerId, eventType: completed ? "rollout_completed" : "rollout_advanced", subjectType: "proposal", subjectId: proposal.id, versionBefore: proposal.version, versionAfter: nextVersion, evidenceIds: evidence.map((item) => item.id), payload: { stageBefore: proposal.rolloutStage, stageAfter: input.stage, allocationPercent: input.allocationPercent, externalReference: input.externalReference, note: input.note }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [updated] = await tx.update(eosProductChangeProposals).set({ rolloutState: completed ? "completed" : "running", rolloutStage: input.stage, rolloutPercent: input.allocationPercent, rolloutExternalReference: input.externalReference, rolloutReceiptEvidenceId: input.receiptEvidenceId, version: nextVersion, lastEventId: event.id, updatedAt: now }).where(and(eq(eosProductChangeProposals.id, proposal.id), eq(eosProductChangeProposals.version, proposal.version))).returning();
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, completed ? "product_evolution.rollout.completed" : "product_evolution.rollout.advanced", "product_change_proposal", proposal.id, completed ? "completed" : input.stage, policy, { eventSha256: event.eventSha256, externalReference: input.externalReference })); return { proposal: updated, event };
    }); res.json(result);
  }));

  app.post("/api/eos/companies/:companyId/product-evolution/proposals/:proposalId/rollbacks", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = productRolloutRollbackSchema.parse(req.body); const initial = await companyAccess(req); const proposal = await visibleProposal(companyId, req.params.proposalId, initial); const evidence = await verifiedEvidence(companyId, input.evidenceIds, initial); const { policy } = await evolutionAccess(req, "decide", "product_evolution.rollout.rollback", proposal.classification);
    if (proposal.version !== input.expectedVersion || !["running", "completed"].includes(proposal.rolloutState) || proposal.appliedAt) throw new EosRouteError(409, "product_rollout_rollback_invalid", "Only an unapplied active or completed rollout may be rolled back."); const now = new Date();
    const result = await db.transaction(async (tx) => { const nextVersion = proposal.version + 1; const event = await appendEvent(tx, { companyId, proposalId: proposal.id, offerId: proposal.offerId, eventType: "rollout_rolled_back", subjectType: "proposal", subjectId: proposal.id, versionBefore: proposal.version, versionAfter: nextVersion, evidenceIds: evidence.map((item) => item.id), payload: { stage: proposal.rolloutStage, allocationPercent: proposal.rolloutPercent, rationale: input.rationale, rollbackPlan: proposal.rollbackPlan }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [updated] = await tx.update(eosProductChangeProposals).set({ rolloutState: "rolled_back", version: nextVersion, lastEventId: event.id, updatedAt: now }).where(and(eq(eosProductChangeProposals.id, proposal.id), eq(eosProductChangeProposals.version, proposal.version))).returning();
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "product_evolution.rollout.rolled_back", "product_change_proposal", proposal.id, "rolled_back", policy, { eventSha256: event.eventSha256, rationale: input.rationale })); return { proposal: updated, event };
    }); res.json(result);
  }));

  app.post("/api/eos/companies/:companyId/product-evolution/proposals/:proposalId/apply", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = productApplySchema.parse(req.body); const initial = await companyAccess(req); const proposal = await visibleProposal(companyId, req.params.proposalId, initial); const evidence = await verifiedEvidence(companyId, input.evidenceIds, initial); const { access, policy } = await evolutionAccess(req, "decide", "product_evolution.canonical_offer.apply", proposal.classification);
    if (!access.isOwner) throw new EosRouteError(403, "product_apply_founder_required", "Only the company founder/owner may apply a released change to the canonical offer.");
    if (proposal.version !== input.expectedVersion || proposal.rolloutState !== "completed" || proposal.releaseDecision !== "ship" || proposal.appliedAt) throw new EosRouteError(409, "product_apply_not_ready", "Only a current, shipped, completed, and unapplied rollout may change the canonical offer.");
    const offer = await visibleOffer(companyId, proposal.offerId, access); const currentHash = hash(offerSnapshot(offer)); if (currentHash !== proposal.baselineOfferSha256) throw new EosRouteError(409, "product_offer_baseline_changed", "The canonical offer changed since this proposal was drafted. Create a new proposal from the current offer.");
    const patch = offerPatchSchema.parse(proposal.proposedPatch); const now = new Date();
    const result = await db.transaction(async (tx) => { await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`product-offer:${offer.id}`}))`); const [current] = await tx.select().from(eosOfferPrograms).where(eq(eosOfferPrograms.id, offer.id)).limit(1); if (!current || hash(offerSnapshot(current)) !== proposal.baselineOfferSha256) throw new EosRouteError(409, "product_offer_baseline_changed", "The canonical offer changed before apply completed.");
      const nextVersion = proposal.version + 1; const event = await appendEvent(tx, { companyId, proposalId: proposal.id, offerId: offer.id, eventType: "canonical_offer_applied", subjectType: "offer", subjectId: offer.id, versionBefore: proposal.version, versionAfter: nextVersion, evidenceIds: evidence.map((item) => item.id), payload: { baselineOfferSha256: proposal.baselineOfferSha256, proposalSha256: proposal.proposalSha256, proposedPatch: patch, rationale: input.rationale }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [updatedOffer] = await tx.update(eosOfferPrograms).set({ ...patch, updatedAt: now }).where(and(eq(eosOfferPrograms.id, offer.id), eq(eosOfferPrograms.updatedAt, current.updatedAt))).returning();
      if (!updatedOffer) throw new EosRouteError(409, "product_offer_baseline_changed", "The canonical offer changed while apply was in progress.");
      const [updatedProposal] = await tx.update(eosProductChangeProposals).set({ appliedAt: now, version: nextVersion, lastEventId: event.id, updatedAt: now }).where(and(eq(eosProductChangeProposals.id, proposal.id), eq(eosProductChangeProposals.version, proposal.version))).returning();
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "product_evolution.canonical_offer.applied", "offer_program", offer.id, "applied", policy, { proposalId: proposal.id, eventSha256: event.eventSha256, baselineOfferSha256: proposal.baselineOfferSha256, resultingOfferSha256: hash(offerSnapshot(updatedOffer)) })); return { offer: updatedOffer, proposal: updatedProposal, event };
    }); res.json(result);
  }));
}
