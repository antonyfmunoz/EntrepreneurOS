import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ZodError } from "zod";
import {
  companies,
  eosAdvisorContributions,
  eosAdvisorDecisionOutcomes,
  eosAdvisorDeliberations,
  eosAuditRecords,
  eosEvidence,
  eosLearningProposals,
  portfolios,
} from "@shared/schema";
import {
  advisorCalibrationSchema,
  advisorDecisionSchema,
  advisorDeliberationCreateSchema,
} from "@shared/advisor-deliberation";
import { buildAdvisorCouncil, selectAdvisorSeats } from "@shared/eos-runtime";
import { db } from "../db";
import { advanceAdvisorDeliberation } from "../advisors/deliberation";
import {
  EosRouteError,
  authorizeAction,
  companyAccess,
} from "./eos-runtime";

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof EosRouteError) return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof ZodError) return res.status(400).json({ code: "advisor_deliberation_input_invalid", message: error.issues[0]?.message || "Advisor deliberation input is invalid." });
      if (error instanceof Error && error.message === "advisor_deliberation_not_advanceable") return res.status(409).json({ code: error.message, message: "This deliberation cannot advance from its current state." });
      next(error);
    }
  };
}

async function founderAccess(req: Request, authorityClass: "view" | "decide", actionKey: string) {
  const access = await companyAccess(req);
  if (!access.isOwner) throw new EosRouteError(403, "advisor_deliberation_private", "Portfolio advisory deliberations are private to the founder's Executive Assistant channel.");
  const policy = await authorizeAction(req, access, { authorityClass, resource: "advisor_deliberation", actionKey, purpose: authorityClass === "view" ? "inspect_advisor_deliberation" : "govern_advisor_deliberation", classification: "restricted", consequence: authorityClass === "decide" ? "material" : "routine", targetSeatId: access.seat.id });
  return { access, policy };
}

async function evidenceForCompany(companyId: number, evidenceIds: string[]) {
  if (!evidenceIds.length) return [];
  const unique = Array.from(new Set(evidenceIds));
  if (unique.length !== evidenceIds.length) throw new EosRouteError(409, "advisor_evidence_duplicate", "Advisor evidence references must be unique.");
  const evidence = await db.select().from(eosEvidence).where(and(eq(eosEvidence.companyId, companyId), inArray(eosEvidence.id, unique)));
  if (evidence.length !== unique.length) throw new EosRouteError(409, "advisor_evidence_invalid", "Every evidence reference must resolve inside this company.");
  return evidence;
}

export function registerAdvisorDeliberationRoutes(app: Express): void {
  app.get("/api/eos/companies/:companyId/advisor-deliberations", route(async (req, res) => {
    const { access } = await founderAccess(req, "view", "advisor_deliberation.read");
    const deliberations = await db.select().from(eosAdvisorDeliberations).where(eq(eosAdvisorDeliberations.companyId, access.company.id)).orderBy(desc(eosAdvisorDeliberations.updatedAt));
    const ids = deliberations.map((item) => item.id);
    const [contributions, outcomes] = ids.length ? await Promise.all([
      db.select().from(eosAdvisorContributions).where(inArray(eosAdvisorContributions.deliberationId, ids)).orderBy(desc(eosAdvisorContributions.createdAt)),
      db.select().from(eosAdvisorDecisionOutcomes).where(inArray(eosAdvisorDecisionOutcomes.deliberationId, ids)).orderBy(desc(eosAdvisorDecisionOutcomes.decidedAt)),
    ]) : [[], []];
    res.json({ schemaVersion: "eos.advisor-deliberation-registry.v1", deliberations: deliberations.map((item) => ({ ...item, contributions: contributions.filter((record) => record.deliberationId === item.id), outcome: outcomes.find((record) => record.deliberationId === item.id) || null })) });
  }));

  app.post("/api/eos/companies/:companyId/advisor-deliberations", route(async (req, res) => {
    const input = advisorDeliberationCreateSchema.parse(req.body);
    const { access, policy } = await founderAccess(req, "decide", "advisor_deliberation.create");
    const evidence = await evidenceForCompany(access.company.id, input.evidenceIds);
    const portfolio = access.company.portfolioId ? await db.select().from(portfolios).where(eq(portfolios.id, access.company.portfolioId)).limit(1).then((rows) => rows[0]) : null;
    const council = buildAdvisorCouncil({ founderName: req.user.fullName || req.user.username, portfolioName: portfolio?.name, companyName: access.company.name, founderProfile: access.company.founderProfile as Record<string, unknown>, companyGoals: access.company.goals });
    const knownIds = new Set(council.advisors.map((advisor) => advisor.id));
    if (input.requestedAdvisorIds.some((id) => !knownIds.has(id))) throw new EosRouteError(409, "advisor_panel_invalid", "Every requested advisor must belong to the canonical fifteen-seat council.");
    const advisors = input.requestedAdvisorIds.length ? council.advisors.filter((advisor) => input.requestedAdvisorIds.includes(advisor.id))
      : input.panelMode === "full_council" ? council.advisors : selectAdvisorSeats(council.advisors, `${input.question} ${input.decisionContext}`, 5);
    const now = new Date(); const id = randomUUID();
    const record = {
      id, companyId: access.company.id, portfolioId: access.company.portfolioId, founderSeatId: access.seat.id,
      question: input.question,
      contextPacket: {
        schemaVersion: "eos.advisor-context-packet.v1",
        founderName: council.personalization.founderName,
        portfolioName: council.personalization.portfolioName,
        companyName: access.company.name,
        founderVision: council.personalization.founderVision,
        founderValues: council.personalization.founderValues,
        decisionStyle: council.personalization.decisionStyle,
        companyGoals: council.personalization.companyGoals,
        decisionContext: input.decisionContext,
        evidence: evidence.map((item) => ({ id: item.id, title: item.title, verificationState: item.verificationState, confidenceQuality: item.confidenceQuality, supportedClaimSummary: item.supportedClaimSummary })),
        capturedAt: now.toISOString(),
      },
      panelMode: input.panelMode, advisorIds: advisors.map((advisor) => advisor.id), state: "draft", synthesis: "", materialDissent: [],
      decisionDueAt: input.decisionDueAt ? new Date(input.decisionDueAt) : null, classification: "restricted", traceId: policy.traceId, correlationId: policy.correlationId,
      version: 1, recordedByUserId: req.user.id, createdAt: now, updatedAt: now,
    };
    await db.transaction(async (tx) => {
      await tx.insert(eosAdvisorDeliberations).values(record);
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "advisor_deliberation.created", targetType: "advisor_deliberation", targetId: id, traceId: policy.traceId, correlationId: policy.correlationId, result: "draft", details: { panelMode: input.panelMode, advisorIds: record.advisorIds, evidenceIds: input.evidenceIds, policyDecisionId: policy.decisionId }, createdAt: now });
    });
    res.status(201).json(record);
  }));

  app.post("/api/eos/companies/:companyId/advisor-deliberations/:deliberationId/advance", route(async (req, res) => {
    const { access, policy } = await founderAccess(req, "decide", "advisor_deliberation.advance");
    const [deliberation] = await db.select().from(eosAdvisorDeliberations).where(and(eq(eosAdvisorDeliberations.id, req.params.deliberationId), eq(eosAdvisorDeliberations.companyId, access.company.id))).limit(1);
    if (!deliberation) throw new EosRouteError(404, "advisor_deliberation_not_found", "Advisor deliberation not found.");
    const updated = await advanceAdvisorDeliberation(deliberation.id);
    await db.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "advisor_deliberation.advanced", targetType: "advisor_deliberation", targetId: deliberation.id, traceId: policy.traceId, correlationId: policy.correlationId, result: updated?.state || deliberation.state, details: { from: deliberation.state, to: updated?.state || deliberation.state, policyDecisionId: policy.decisionId }, createdAt: new Date() });
    res.json(updated);
  }));

  app.post("/api/eos/companies/:companyId/advisor-deliberations/:deliberationId/decision", route(async (req, res) => {
    const input = advisorDecisionSchema.parse(req.body);
    const { access, policy } = await founderAccess(req, "decide", "advisor_deliberation.decide");
    const [deliberation] = await db.select().from(eosAdvisorDeliberations).where(and(eq(eosAdvisorDeliberations.id, req.params.deliberationId), eq(eosAdvisorDeliberations.companyId, access.company.id))).limit(1);
    if (!deliberation || deliberation.state !== "synthesis_ready") throw new EosRouteError(409, "advisor_deliberation_not_decidable", "A founder decision requires completed synthesis.");
    if (deliberation.version !== input.expectedVersion) throw new EosRouteError(409, "advisor_deliberation_version_conflict", "The deliberation changed before the decision.");
    await evidenceForCompany(access.company.id, input.evidenceIds);
    const now = new Date();
    const outcome = { id: randomUUID(), companyId: access.company.id, deliberationId: deliberation.id, decision: input.decision, rationale: input.rationale, acceptedClaims: input.acceptedClaims, rejectedClaims: input.rejectedClaims, decisionEvidenceIds: input.evidenceIds, outcome: null, outcomeSummary: "", outcomeEvidenceIds: [], claimOutcomes: [], learningProposal: "", learningState: "not_proposed", decidedByUserId: req.user.id, decidedAt: now, calibratedAt: null };
    await db.transaction(async (tx) => {
      await tx.insert(eosAdvisorDecisionOutcomes).values(outcome);
      await tx.update(eosAdvisorDeliberations).set({ state: "decided", version: deliberation.version + 1, updatedAt: now }).where(and(eq(eosAdvisorDeliberations.id, deliberation.id), eq(eosAdvisorDeliberations.version, deliberation.version)));
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "advisor_deliberation.decided", targetType: "advisor_deliberation", targetId: deliberation.id, traceId: policy.traceId, correlationId: policy.correlationId, result: "decided", details: { evidenceIds: input.evidenceIds, acceptedClaims: input.acceptedClaims, rejectedClaims: input.rejectedClaims, policyDecisionId: policy.decisionId }, createdAt: now });
    });
    res.status(201).json(outcome);
  }));

  app.post("/api/eos/companies/:companyId/advisor-deliberations/:deliberationId/calibration", route(async (req, res) => {
    const input = advisorCalibrationSchema.parse(req.body);
    const { access, policy } = await founderAccess(req, "decide", "advisor_deliberation.calibrate");
    const [deliberation] = await db.select().from(eosAdvisorDeliberations).where(and(eq(eosAdvisorDeliberations.id, req.params.deliberationId), eq(eosAdvisorDeliberations.companyId, access.company.id))).limit(1);
    if (!deliberation || deliberation.state !== "decided") throw new EosRouteError(409, "advisor_deliberation_not_calibratable", "Calibration requires a recorded founder decision.");
    if (deliberation.version !== input.expectedVersion) throw new EosRouteError(409, "advisor_deliberation_version_conflict", "The deliberation changed before calibration.");
    await evidenceForCompany(access.company.id, input.outcomeEvidenceIds);
    const contributions = await db.select({ id: eosAdvisorContributions.id }).from(eosAdvisorContributions).where(eq(eosAdvisorContributions.deliberationId, deliberation.id));
    const contributionIds = new Set(contributions.map((item) => item.id));
    if (input.claimOutcomes.some((item) => !contributionIds.has(item.contributionId))) throw new EosRouteError(409, "advisor_claim_outcome_invalid", "Every calibrated claim must belong to this deliberation.");
    const now = new Date();
    const [updatedOutcome] = await db.transaction(async (tx) => {
      const rows = await tx.update(eosAdvisorDecisionOutcomes).set({ outcome: input.outcome, outcomeSummary: input.outcomeSummary, outcomeEvidenceIds: input.outcomeEvidenceIds, claimOutcomes: input.claimOutcomes, learningProposal: input.learningProposal, learningState: input.learningProposal ? "proposed" : "not_proposed", calibratedAt: now }).where(eq(eosAdvisorDecisionOutcomes.deliberationId, deliberation.id)).returning();
      if (input.learningProposal) await tx.insert(eosLearningProposals).values({ id: randomUUID(), companyId: access.company.id, sourceType: "advisor_calibration", sourceId: deliberation.id, title: `Review advisor learning: ${deliberation.question.slice(0, 160)}`, proposal: input.learningProposal, targetType: "memory", targetReference: deliberation.id, evidenceIds: input.outcomeEvidenceIds, state: "proposed", decisionRationale: "", decidedByUserId: null, decidedAt: null, classification: "restricted", recordedByUserId: req.user.id, createdAt: now });
      await tx.update(eosAdvisorDeliberations).set({ state: "calibrated", version: deliberation.version + 1, updatedAt: now }).where(and(eq(eosAdvisorDeliberations.id, deliberation.id), eq(eosAdvisorDeliberations.version, deliberation.version)));
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "advisor_deliberation.calibrated", targetType: "advisor_deliberation", targetId: deliberation.id, traceId: policy.traceId, correlationId: policy.correlationId, result: input.outcome, details: { outcomeEvidenceIds: input.outcomeEvidenceIds, claimOutcomes: input.claimOutcomes, learningState: input.learningProposal ? "proposed" : "not_proposed", policyDecisionId: policy.decisionId }, createdAt: now });
      return rows;
    });
    res.json(updatedOutcome);
  }));
}
