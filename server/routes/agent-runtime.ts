import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z, ZodError } from "zod";
import {
  eosAgentRunEvaluations,
  eosAgentSchedules,
  eosAuditRecords,
  eosAuthoritySubjects,
  eosEvidence,
  eosLearningProposals,
  eosProcessDefinitions,
  eosSeats,
  eosWorkflowRuns,
} from "@shared/schema";
import {
  agentEvaluationSchema,
  agentScheduleCreateSchema,
  agentScheduleTransitionSchema,
} from "@shared/agent-runtime";
import { allowedSurfacesFor } from "@shared/eos-runtime";
import { db } from "../db";
import { enqueueAgentEvent } from "../agents/scheduler";
import { containsCredentialMaterial } from "../security/credential-material";
import {
  EosRouteError,
  authorizeAction,
  companyAccess,
  mayAccessClassification,
  visibleSeatIds,
} from "./eos-runtime";

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof EosRouteError) return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof ZodError) return res.status(400).json({ code: "agent_runtime_input_invalid", message: error.issues[0]?.message || "Agent runtime input is invalid." });
      next(error);
    }
  };
}

async function agentAccess(req: Request, authorityClass: "view" | "execute" | "decide", actionKey: string, classification = "confidential") {
  const access = await companyAccess(req);
  if (!allowedSurfacesFor(access.role).includes("operations") && !access.isOwner)
    throw new EosRouteError(403, "agent_runtime_scope_denied", "Role Agent orchestration is outside this seat's compiled workspace.");
  const policy = await authorizeAction(req, access, { authorityClass, resource: "agent_schedule", actionKey, purpose: authorityClass === "view" ? "inspect_agent_runtime" : "govern_agent_runtime", classification, consequence: authorityClass === "decide" ? "material" : "routine", targetSeatId: access.seat.id });
  return { access, policy };
}

export function registerAgentRuntimeRoutes(app: Express): void {
  app.get("/api/eos/companies/:companyId/agent-runtime", route(async (req, res) => {
    const { access } = await agentAccess(req, "view", "agent_runtime.read");
    const visible = await visibleSeatIds(access.company.id, access.seat.id, access.role);
    const [schedules, evaluations] = await Promise.all([
      db.select().from(eosAgentSchedules).where(eq(eosAgentSchedules.companyId, access.company.id)).orderBy(asc(eosAgentSchedules.name)),
      db.select().from(eosAgentRunEvaluations).where(eq(eosAgentRunEvaluations.companyId, access.company.id)).orderBy(desc(eosAgentRunEvaluations.createdAt)),
    ]);
    const visibleSchedules = schedules.filter((schedule) => mayAccessClassification(access, schedule.classification) && (access.isOwner || visible.has(schedule.seatId)));
    res.json({
      schemaVersion: "eos.agent-runtime.v1",
      schedules: visibleSchedules,
      evaluations: evaluations.filter((evaluation) => access.isOwner || visible.has(evaluation.evaluatorSeatId)),
      counts: {
        active: visibleSchedules.filter((item) => item.state === "active").length,
        due: visibleSchedules.filter((item) => item.state === "active" && item.nextRunAt && item.nextRunAt <= new Date()).length,
        paused: visibleSchedules.filter((item) => item.state === "paused").length,
        needsReview: evaluations.filter((item) => item.outcome === "needs_review").length,
      },
    });
  }));

  app.post("/api/eos/companies/:companyId/agent-schedules", route(async (req, res) => {
    const input = agentScheduleCreateSchema.parse(req.body);
    if (containsCredentialMaterial(input.inputTemplate)) throw new EosRouteError(409, "agent_schedule_contains_credentials", "Role Agent schedules may use secret-manager references, but cannot store credentials, passwords, tokens, or private keys.");
    const { access, policy } = await agentAccess(req, "decide", "agent_schedule.create", input.classification);
    const visible = await visibleSeatIds(access.company.id, access.seat.id, access.role);
    if (!visible.has(input.seatId)) throw new EosRouteError(409, "agent_schedule_seat_invalid", "The scheduled seat must be inside the current reporting hierarchy.");
    const [seat, subject, process] = await Promise.all([
      db.select().from(eosSeats).where(and(eq(eosSeats.id, input.seatId), eq(eosSeats.companyId, access.company.id), eq(eosSeats.status, "active"))).limit(1).then((rows) => rows[0]),
      db.select().from(eosAuthoritySubjects).where(and(eq(eosAuthoritySubjects.id, input.authoritySubjectId), eq(eosAuthoritySubjects.companyId, access.company.id))).limit(1).then((rows) => rows[0]),
      db.select().from(eosProcessDefinitions).where(and(eq(eosProcessDefinitions.id, input.processDefinitionId), eq(eosProcessDefinitions.companyId, access.company.id))).limit(1).then((rows) => rows[0]),
    ]);
    if (!seat || !subject || !process || process.accountableSeatId !== seat.id || subject.seatId !== seat.id)
      throw new EosRouteError(409, "agent_schedule_contract_invalid", "Schedule, Authority Subject, process, and accountable seat must resolve to one company role context.");
    const now = new Date();
    const record = { id: randomUUID(), companyId: access.company.id, portfolioId: access.company.portfolioId, scheduleKey: input.scheduleKey, name: input.name, seatId: input.seatId, authoritySubjectId: input.authoritySubjectId, processDefinitionId: input.processDefinitionId, triggerKind: input.triggerKind, cadence: input.cadence, eventTypes: input.eventTypes, executionMode: input.executionMode, inputTemplate: input.inputTemplate, state: "draft", nextRunAt: input.nextRunAt ? new Date(input.nextRunAt) : null, lastRunAt: null, maxRunsPerDay: input.maxRunsPerDay, evaluationRequired: input.evaluationRequired, activationPolicyDecisionId: null, classification: input.classification, version: 1, recordedByUserId: req.user.id, createdAt: now, updatedAt: now };
    await db.transaction(async (tx) => {
      await tx.insert(eosAgentSchedules).values(record);
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "agent_schedule.created", targetType: "agent_schedule", targetId: record.id, traceId: policy.traceId, correlationId: policy.correlationId, result: "draft", details: { scheduleKey: record.scheduleKey, triggerKind: record.triggerKind, executionMode: record.executionMode, policyDecisionId: policy.decisionId }, createdAt: now });
    });
    res.status(201).json(record);
  }));

  app.patch("/api/eos/companies/:companyId/agent-schedules/:scheduleId/state", route(async (req, res) => {
    const input = agentScheduleTransitionSchema.parse(req.body);
    const { access, policy } = await agentAccess(req, "decide", "agent_schedule.transition", "restricted");
    const [schedule] = await db.select().from(eosAgentSchedules).where(and(eq(eosAgentSchedules.id, req.params.scheduleId), eq(eosAgentSchedules.companyId, access.company.id))).limit(1);
    if (!schedule) throw new EosRouteError(404, "agent_schedule_not_found", "Agent schedule not found.");
    if (schedule.version !== input.expectedVersion) throw new EosRouteError(409, "agent_schedule_version_conflict", "The schedule changed before this action.");
    const transitions: Record<string, string[]> = { draft: ["active", "retired"], active: ["paused", "retired"], paused: ["active", "retired"] };
    if (!transitions[schedule.state]?.includes(input.state)) throw new EosRouteError(409, "agent_schedule_transition_invalid", `Schedule cannot move from ${schedule.state} to ${input.state}.`);
    if (input.state === "active") {
      const [seat, subject, process] = await Promise.all([
        db.select().from(eosSeats).where(and(eq(eosSeats.id, schedule.seatId), eq(eosSeats.companyId, access.company.id), eq(eosSeats.status, "active"))).limit(1).then((rows) => rows[0]),
        db.select().from(eosAuthoritySubjects).where(eq(eosAuthoritySubjects.id, schedule.authoritySubjectId)).limit(1).then((rows) => rows[0]),
        db.select().from(eosProcessDefinitions).where(eq(eosProcessDefinitions.id, schedule.processDefinitionId)).limit(1).then((rows) => rows[0]),
      ]);
      if (!seat || !subject || !process || subject.status !== "active" || subject.verificationStatus !== "verified" || process.releaseState !== "released" || !["implemented", "pre_live_qualified", "field_qualified"].includes(process.qualificationState))
        throw new EosRouteError(409, "agent_schedule_activation_blocked", "Activation requires a verified active Authority Subject and an implemented, released process.");
      if (schedule.executionMode === "autonomous" && (seat.occupantUserId || seat.agentMode !== "autonomous"))
        throw new EosRouteError(409, "autonomous_schedule_blocked", "A human-occupied role keeps its agent in assistant mode and cannot activate autonomous scheduling.");
      if (schedule.executionMode === "assisted" && !seat.occupantUserId)
        throw new EosRouteError(409, "assisted_schedule_blocked", "Assisted scheduling requires a human-occupied role.");
    }
    const [updated] = await db.update(eosAgentSchedules).set({ state: input.state, activationPolicyDecisionId: input.state === "active" ? policy.decisionId : schedule.activationPolicyDecisionId, version: schedule.version + 1, updatedAt: new Date() }).where(and(eq(eosAgentSchedules.id, schedule.id), eq(eosAgentSchedules.version, schedule.version))).returning();
    if (!updated) throw new EosRouteError(409, "agent_schedule_concurrent_change", "The schedule changed before this action completed.");
    await db.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "agent_schedule.transitioned", targetType: "agent_schedule", targetId: schedule.id, traceId: policy.traceId, correlationId: policy.correlationId, result: input.state, details: { from: schedule.state, to: input.state, rationale: input.rationale, policyDecisionId: policy.decisionId }, createdAt: new Date() });
    res.json(updated);
  }));

  app.post("/api/eos/companies/:companyId/agent-events", route(async (req, res) => {
    const input = z.object({ eventType: z.string().trim().min(3).max(200), eventId: z.string().trim().min(8).max(240), payload: z.record(z.unknown()).default({}) }).parse(req.body);
    if (containsCredentialMaterial(input.payload)) throw new EosRouteError(409, "agent_event_contains_credentials", "Role Agent events may carry bounded facts and secret-manager references, but never credentials, passwords, tokens, or private keys.");
    const { access, policy } = await agentAccess(req, "execute", "agent_event.dispatch", "confidential");
    const runs = await enqueueAgentEvent({ companyId: access.company.id, eventType: input.eventType, eventId: input.eventId, payload: input.payload });
    await db.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "agent_event.dispatched", targetType: "agent_event", targetId: input.eventId, traceId: policy.traceId, correlationId: policy.correlationId, result: runs.length ? "runs_enqueued" : "no_matching_schedule", details: { eventType: input.eventType, runIds: runs.map((run) => run.id), policyDecisionId: policy.decisionId }, createdAt: new Date() });
    res.status(202).json({ eventId: input.eventId, matchingSchedules: runs.length, runIds: runs.map((run) => run.id) });
  }));

  app.post("/api/eos/companies/:companyId/workflow-runs/:runId/evaluation", route(async (req, res) => {
    const input = agentEvaluationSchema.parse(req.body);
    const { access, policy } = await agentAccess(req, "decide", "agent_run.evaluate", "confidential");
    const [run] = await db.select().from(eosWorkflowRuns).where(and(eq(eosWorkflowRuns.id, req.params.runId), eq(eosWorkflowRuns.companyId, access.company.id))).limit(1);
    if (!run || !["completed", "failed", "cancelled"].includes(run.state)) throw new EosRouteError(409, "agent_run_not_evaluable", "Evaluation requires a terminal workflow run.");
    if (run.version !== input.expectedRunVersion) throw new EosRouteError(409, "agent_run_version_conflict", "The run changed before evaluation.");
    if (input.evidenceIds.length) {
      const evidence = await db.select().from(eosEvidence).where(and(eq(eosEvidence.companyId, access.company.id), inArray(eosEvidence.id, input.evidenceIds)));
      if (evidence.length !== new Set(input.evidenceIds).size) throw new EosRouteError(409, "agent_evaluation_evidence_invalid", "Evaluation Evidence must resolve inside this company.");
    }
    const scheduleId = typeof (run.input as any)?._scheduleId === "string" ? (run.input as any)._scheduleId : null;
    const record = { id: randomUUID(), companyId: access.company.id, workflowRunId: run.id, scheduleId, evaluatorSeatId: access.seat.id, outcome: input.outcome, scores: input.scores, rationale: input.rationale, evidenceIds: input.evidenceIds, learningProposal: input.learningProposal, learningState: input.learningProposal ? "proposed" : "not_proposed", recordedByUserId: req.user.id, createdAt: new Date() };
    await db.transaction(async (tx) => {
      await tx.insert(eosAgentRunEvaluations).values(record);
      if (input.learningProposal) await tx.insert(eosLearningProposals).values({ id: randomUUID(), companyId: access.company.id, sourceType: "agent_evaluation", sourceId: record.id, title: `Review learning from run ${run.runKey}`, proposal: input.learningProposal, targetType: "skill", targetReference: run.processDefinitionId, evidenceIds: input.evidenceIds, state: "proposed", decisionRationale: "", decidedByUserId: null, decidedAt: null, classification: "restricted", recordedByUserId: req.user.id, createdAt: new Date() });
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "agent_run.evaluated", targetType: "workflow_run", targetId: run.id, traceId: policy.traceId, correlationId: policy.correlationId, result: input.outcome, details: { scores: input.scores, learningState: record.learningState, policyDecisionId: policy.decisionId }, createdAt: new Date() });
    });
    res.status(201).json(record);
  }));
}
