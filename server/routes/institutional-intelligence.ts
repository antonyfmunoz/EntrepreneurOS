import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ZodError } from "zod";
import {
  eosAuditRecords, eosEvidence, eosInstitutionalMemoryRecords, eosLearningProposals,
  eosPostmortems, eosRealityObservations, eosScenarioModels,
} from "@shared/schema";
import {
  learningDecisionSchema, postmortemCreateSchema, postmortemTransitionSchema,
  realityObservationCreateSchema, scenarioCreateSchema, scenarioTransitionSchema,
} from "@shared/institutional-intelligence";
import { allowedSurfacesFor } from "@shared/eos-runtime";
import { db } from "../db";
import { nativeContractContentSha256 } from "../esign/template-generation";
import { EosRouteError, authorizeAction, companyAccess, mayAccessClassification } from "./eos-runtime";

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof EosRouteError) return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof ZodError) return res.status(400).json({ code: "institutional_intelligence_input_invalid", message: error.issues[0]?.message || "Institutional intelligence input is invalid." });
      next(error);
    }
  };
}

async function intelligenceAccess(req: Request, authorityClass: "view" | "execute" | "decide", actionKey: string, classification = "confidential") {
  const access = await companyAccess(req);
  if (!access.isOwner && !allowedSurfacesFor(access.role).some((surface) => ["operations", "strategy", "intelligence"].includes(surface)))
    throw new EosRouteError(403, "institutional_intelligence_scope_denied", "Institutional intelligence is outside this seat's compiled workspace.");
  const policy = await authorizeAction(req, access, { authorityClass, resource: "institutional_intelligence", actionKey, purpose: authorityClass === "view" ? "inspect_institutional_intelligence" : "govern_institutional_intelligence", classification, consequence: authorityClass === "decide" ? "material" : "routine", targetSeatId: access.seat.id });
  return { access, policy };
}

async function evidenceFor(companyId: number, ids: string[], verified = false) {
  const unique = Array.from(new Set(ids));
  if (unique.length !== ids.length) throw new EosRouteError(409, "intelligence_evidence_duplicate", "Evidence references must be unique.");
  if (!unique.length) return [];
  const records = await db.select().from(eosEvidence).where(and(eq(eosEvidence.companyId, companyId), inArray(eosEvidence.id, unique)));
  if (records.length !== unique.length || (verified && records.some((item) => item.verificationState !== "verified")))
    throw new EosRouteError(409, "intelligence_evidence_invalid", verified ? "This decision requires verified Evidence from the same company." : "Evidence must resolve inside this company.");
  return records;
}

function audit(input: { companyId: number; userId: string; action: string; targetType: string; targetId: string; result: string; policy: any; details?: Record<string, unknown> }) {
  return db.insert(eosAuditRecords).values({ id: randomUUID(), companyId: input.companyId, actorUserId: input.userId, action: input.action, targetType: input.targetType, targetId: input.targetId, traceId: input.policy.traceId, correlationId: input.policy.correlationId, result: input.result, details: { ...(input.details || {}), policyDecisionId: input.policy.decisionId }, createdAt: new Date() });
}

export function registerInstitutionalIntelligenceRoutes(app: Express): void {
  app.get("/api/eos/companies/:companyId/institutional-intelligence", route(async (req, res) => {
    const { access } = await intelligenceAccess(req, "view", "institutional_intelligence.read");
    const [observations, scenarios, postmortems, proposals, memories] = await Promise.all([
      db.select().from(eosRealityObservations).where(eq(eosRealityObservations.companyId, access.company.id)).orderBy(desc(eosRealityObservations.observedAt)),
      db.select().from(eosScenarioModels).where(eq(eosScenarioModels.companyId, access.company.id)).orderBy(desc(eosScenarioModels.updatedAt)),
      db.select().from(eosPostmortems).where(eq(eosPostmortems.companyId, access.company.id)).orderBy(desc(eosPostmortems.updatedAt)),
      db.select().from(eosLearningProposals).where(eq(eosLearningProposals.companyId, access.company.id)).orderBy(desc(eosLearningProposals.createdAt)),
      db.select().from(eosInstitutionalMemoryRecords).where(eq(eosInstitutionalMemoryRecords.companyId, access.company.id)).orderBy(desc(eosInstitutionalMemoryRecords.createdAt)),
    ]);
    const supersededObservationIds = new Set(observations.map((item) => item.supersedesObservationId).filter(Boolean));
    const supersededMemoryIds = new Set(memories.map((item) => item.supersedesMemoryId).filter(Boolean));
    const now = new Date();
    res.json({
      schemaVersion: "eos.institutional-intelligence.v1",
      observations: observations.filter((item) => mayAccessClassification(access, item.classification)).map((item) => ({ ...item, current: !supersededObservationIds.has(item.id), stale: Boolean(item.freshnessExpiresAt && item.freshnessExpiresAt <= now) })),
      scenarios: scenarios.filter((item) => mayAccessClassification(access, item.classification)),
      postmortems: postmortems.filter((item) => mayAccessClassification(access, item.classification)),
      learningProposals: access.isOwner ? proposals : [],
      memories: memories.filter((item) => mayAccessClassification(access, item.classification)).map((item) => ({ ...item, current: !supersededMemoryIds.has(item.id) && item.state === "verified" })),
      counts: { staleReality: observations.filter((item) => item.freshnessExpiresAt && item.freshnessExpiresAt <= now && !supersededObservationIds.has(item.id)).length, openScenarios: scenarios.filter((item) => ["draft", "analyzed"].includes(item.state)).length, unreviewedPostmortems: postmortems.filter((item) => ["draft", "review"].includes(item.state)).length, pendingLearning: proposals.filter((item) => item.state === "proposed").length, currentMemory: memories.filter((item) => !supersededMemoryIds.has(item.id) && item.state === "verified").length },
    });
  }));

  app.post("/api/eos/companies/:companyId/reality-observations", route(async (req, res) => {
    const input = realityObservationCreateSchema.parse(req.body);
    const { access, policy } = await intelligenceAccess(req, input.state === "verified" ? "decide" : "execute", "reality_observation.record", input.classification);
    await evidenceFor(access.company.id, input.evidenceIds, input.state === "verified");
    if (input.supersedesObservationId) {
      const [prior] = await db.select().from(eosRealityObservations).where(and(eq(eosRealityObservations.id, input.supersedesObservationId), eq(eosRealityObservations.companyId, access.company.id))).limit(1);
      if (!prior || prior.subject !== input.subject) throw new EosRouteError(409, "reality_supersession_invalid", "A correction must supersede an observation about the same company subject.");
    }
    const projection = { schemaVersion: "eos.reality-observation.v1", companyId: access.company.id, ...input };
    const record = { id: randomUUID(), companyId: access.company.id, ...input, freshnessExpiresAt: input.freshnessExpiresAt ? new Date(input.freshnessExpiresAt) : null, observedAt: new Date(input.observedAt), supersedesObservationId: input.supersedesObservationId || null, contentSha256: nativeContractContentSha256(projection), recordedByUserId: req.user.id, createdAt: new Date() };
    await db.transaction(async (tx) => { await tx.insert(eosRealityObservations).values(record); await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "reality_observation.recorded", targetType: "reality_observation", targetId: record.id, traceId: policy.traceId, correlationId: policy.correlationId, result: input.state, details: { evidenceIds: input.evidenceIds, supersedesObservationId: record.supersedesObservationId, policyDecisionId: policy.decisionId }, createdAt: new Date() }); });
    res.status(201).json(record);
  }));

  app.post("/api/eos/companies/:companyId/scenarios", route(async (req, res) => {
    const input = scenarioCreateSchema.parse(req.body); const { access, policy } = await intelligenceAccess(req, "execute", "scenario.create", input.classification);
    await evidenceFor(access.company.id, input.evidenceIds);
    const now = new Date(); const record = { id: randomUUID(), companyId: access.company.id, ...input, result: {}, state: "draft", ownerSeatId: access.seat.id, version: 1, recordedByUserId: req.user.id, createdAt: now, updatedAt: now };
    await db.transaction(async (tx) => { await tx.insert(eosScenarioModels).values(record); await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "scenario.created", targetType: "scenario", targetId: record.id, traceId: policy.traceId, correlationId: policy.correlationId, result: "draft", details: { assumptionCount: input.assumptions.length, branchCount: input.branches.length, simulationIsNotReality: true, policyDecisionId: policy.decisionId }, createdAt: now }); });
    res.status(201).json(record);
  }));

  app.patch("/api/eos/companies/:companyId/scenarios/:scenarioId", route(async (req, res) => {
    const input = scenarioTransitionSchema.parse(req.body); const { access, policy } = await intelligenceAccess(req, ["selected", "rejected"].includes(input.state) ? "decide" : "execute", "scenario.transition", "restricted");
    const [scenario] = await db.select().from(eosScenarioModels).where(and(eq(eosScenarioModels.id, req.params.scenarioId), eq(eosScenarioModels.companyId, access.company.id))).limit(1);
    if (!scenario) throw new EosRouteError(404, "scenario_not_found", "Scenario not found.");
    if (scenario.version !== input.expectedVersion) throw new EosRouteError(409, "scenario_version_conflict", "The scenario changed before this decision.");
    const transitions: Record<string, string[]> = { draft: ["analyzed", "archived"], analyzed: ["selected", "rejected", "archived"], selected: ["archived"], rejected: ["archived"] };
    if (!transitions[scenario.state]?.includes(input.state)) throw new EosRouteError(409, "scenario_transition_invalid", `Scenario cannot move from ${scenario.state} to ${input.state}.`);
    await evidenceFor(access.company.id, input.evidenceIds, ["selected", "rejected"].includes(input.state));
    const [updated] = await db.update(eosScenarioModels).set({ state: input.state, result: input.result, evidenceIds: input.evidenceIds, version: scenario.version + 1, updatedAt: new Date() }).where(and(eq(eosScenarioModels.id, scenario.id), eq(eosScenarioModels.version, scenario.version))).returning();
    await audit({ companyId: access.company.id, userId: req.user.id, action: "scenario.transitioned", targetType: "scenario", targetId: scenario.id, result: input.state, policy, details: { from: scenario.state, rationale: input.rationale, simulationIsNotReality: true, evidenceIds: input.evidenceIds } });
    res.json(updated);
  }));

  app.post("/api/eos/companies/:companyId/postmortems", route(async (req, res) => {
    const input = postmortemCreateSchema.parse(req.body); const { access, policy } = await intelligenceAccess(req, "execute", "postmortem.create", input.classification);
    await evidenceFor(access.company.id, input.evidenceIds); const now = new Date();
    const record = { id: randomUUID(), companyId: access.company.id, ...input, state: "draft", ownerSeatId: access.seat.id, reviewedByUserId: null, reviewedAt: null, recordedByUserId: req.user.id, createdAt: now, updatedAt: now };
    await db.transaction(async (tx) => { await tx.insert(eosPostmortems).values(record); await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "postmortem.created", targetType: "postmortem", targetId: record.id, traceId: policy.traceId, correlationId: policy.correlationId, result: "draft", details: { eventType: input.eventType, evidenceIds: input.evidenceIds, policyDecisionId: policy.decisionId }, createdAt: now }); });
    res.status(201).json(record);
  }));

  app.patch("/api/eos/companies/:companyId/postmortems/:postmortemId", route(async (req, res) => {
    const input = postmortemTransitionSchema.parse(req.body); const { access, policy } = await intelligenceAccess(req, input.state === "review" ? "execute" : "decide", "postmortem.transition", "restricted");
    const [record] = await db.select().from(eosPostmortems).where(and(eq(eosPostmortems.id, req.params.postmortemId), eq(eosPostmortems.companyId, access.company.id))).limit(1);
    if (!record) throw new EosRouteError(404, "postmortem_not_found", "Postmortem not found.");
    const transitions: Record<string, string[]> = { draft: ["review"], review: ["accepted", "rejected"] };
    if (!transitions[record.state]?.includes(input.state)) throw new EosRouteError(409, "postmortem_transition_invalid", `Postmortem cannot move from ${record.state} to ${input.state}.`);
    if (input.state === "accepted" && (!Array.isArray(record.evidenceIds) || !record.evidenceIds.length || !Array.isArray(record.rootCauses) || !record.rootCauses.length || !Array.isArray(record.correctiveActions) || !record.correctiveActions.length)) throw new EosRouteError(409, "postmortem_acceptance_incomplete", "Acceptance requires Evidence, root causes, and corrective actions.");
    await evidenceFor(access.company.id, record.evidenceIds as string[], input.state === "accepted"); const now = new Date();
    const [updated] = await db.transaction(async (tx) => {
      const rows = await tx.update(eosPostmortems).set({ state: input.state, reviewedByUserId: input.state === "review" ? null : req.user.id, reviewedAt: input.state === "review" ? null : now, updatedAt: now }).where(and(eq(eosPostmortems.id, record.id), eq(eosPostmortems.state, record.state))).returning();
      if (!rows[0]) throw new EosRouteError(409, "postmortem_concurrent_change", "The postmortem changed before this review.");
      if (input.state === "accepted" && input.learningProposal) await tx.insert(eosLearningProposals).values({ id: randomUUID(), companyId: access.company.id, sourceType: "postmortem", sourceId: record.id, title: input.learningProposal.title, proposal: input.learningProposal.proposal, targetType: input.learningProposal.targetType, targetReference: input.learningProposal.targetReference, evidenceIds: record.evidenceIds, state: "proposed", decisionRationale: "", decidedByUserId: null, decidedAt: null, classification: "restricted", recordedByUserId: req.user.id, createdAt: now });
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "postmortem.transitioned", targetType: "postmortem", targetId: record.id, traceId: policy.traceId, correlationId: policy.correlationId, result: input.state, details: { from: record.state, rationale: input.rationale, learningProposed: Boolean(input.learningProposal), policyDecisionId: policy.decisionId }, createdAt: now });
      return rows;
    });
    res.json(updated);
  }));

  app.patch("/api/eos/companies/:companyId/learning-proposals/:proposalId", route(async (req, res) => {
    const input = learningDecisionSchema.parse(req.body); const { access, policy } = await intelligenceAccess(req, "decide", "learning_proposal.decide", "restricted");
    const [proposal] = await db.select().from(eosLearningProposals).where(and(eq(eosLearningProposals.id, req.params.proposalId), eq(eosLearningProposals.companyId, access.company.id))).limit(1);
    if (!proposal) throw new EosRouteError(404, "learning_proposal_not_found", "Learning proposal not found.");
    const allowed = proposal.state === "proposed" ? ["accepted", "rejected"] : proposal.state === "accepted" ? ["implemented"] : [];
    if (!allowed.includes(input.state)) throw new EosRouteError(409, "learning_transition_invalid", `Learning cannot move from ${proposal.state} to ${input.state}.`);
    if (input.state === "implemented" && proposal.targetType !== "memory") throw new EosRouteError(409, "learning_target_implementation_unsupported", "This route may promote reviewed learning only into institutional memory; process, skill, policy, template, and model-route changes require their own governed version lifecycle.");
    await evidenceFor(access.company.id, proposal.evidenceIds as string[], input.state !== "rejected"); const now = new Date();
    let memory: any = null;
    if (input.state === "implemented" && input.memory?.supersedesMemoryId) {
      const [prior] = await db.select().from(eosInstitutionalMemoryRecords).where(and(eq(eosInstitutionalMemoryRecords.id, input.memory.supersedesMemoryId), eq(eosInstitutionalMemoryRecords.companyId, access.company.id))).limit(1);
      if (!prior || prior.kind !== input.memory.kind) throw new EosRouteError(409, "institutional_memory_supersession_invalid", "Replacement memory must supersede the same memory kind inside this company.");
    }
    await db.transaction(async (tx) => {
      await tx.update(eosLearningProposals).set({ state: input.state, decisionRationale: input.rationale, decidedByUserId: req.user.id, decidedAt: now }).where(and(eq(eosLearningProposals.id, proposal.id), eq(eosLearningProposals.state, proposal.state)));
      if (input.state === "implemented" && input.memory) {
        const projection = { schemaVersion: "eos.institutional-memory.v1", companyId: access.company.id, sourceType: "learning_proposal", sourceId: proposal.id, ...input.memory, evidenceIds: proposal.evidenceIds };
        memory = { id: randomUUID(), companyId: access.company.id, ...input.memory, sourceType: "learning_proposal", sourceId: proposal.id, evidenceIds: proposal.evidenceIds, validFrom: new Date(input.memory.validFrom), validUntil: input.memory.validUntil ? new Date(input.memory.validUntil) : null, state: "verified", supersedesMemoryId: input.memory.supersedesMemoryId || null, classification: "restricted", contentSha256: nativeContractContentSha256(projection), approvedByUserId: req.user.id, createdAt: now };
        await tx.insert(eosInstitutionalMemoryRecords).values(memory);
      }
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "learning_proposal.transitioned", targetType: "learning_proposal", targetId: proposal.id, traceId: policy.traceId, correlationId: policy.correlationId, result: input.state, details: { from: proposal.state, rationale: input.rationale, memoryId: memory?.id || null, automaticLearningApplied: false, policyDecisionId: policy.decisionId }, createdAt: now });
    });
    res.json({ proposal: { ...proposal, state: input.state, decisionRationale: input.rationale, decidedByUserId: req.user.id, decidedAt: now }, memory });
  }));
}
