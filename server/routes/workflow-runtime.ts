import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z, ZodError } from "zod";
import {
  eosApprovalRequests,
  eosAuditRecords,
  eosEvidence,
  eosIntegrationBindings,
  eosProcessDefinitions,
  eosSeats,
  eosSkillDefinitions,
  eosSkillInvocations,
  eosWorkflowRunEvents,
  eosWorkflowRuns,
  eosWorkPackets,
} from "@shared/schema";
import {
  nextWorkflowRunState,
  skillDefinitionCreateSchema,
  skillInvocationCreateSchema,
  workflowRunCreateSchema,
  workflowRunTransitionSchema,
} from "@shared/workflow-runtime";
import { allowedSurfacesFor } from "@shared/eos-runtime";
import { db } from "../db";
import { nativeContractContentSha256 } from "../esign/template-generation";
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
      if (error instanceof ZodError) return res.status(400).json({ code: "workflow_runtime_input_invalid", message: error.issues[0]?.message || "Workflow runtime input is invalid." });
      next(error);
    }
  };
}

async function runtimeAccess(req: Request, authorityClass: "view" | "execute" | "decide", actionKey: string, classification = "confidential") {
  const access = await companyAccess(req);
  if (!allowedSurfacesFor(access.role).includes("operations") && !access.isOwner)
    throw new EosRouteError(403, "workflow_runtime_scope_denied", "Workflow execution is outside this seat's compiled workspace.");
  const policy = await authorizeAction(req, access, {
    authorityClass,
    resource: "workflow_run",
    actionKey,
    purpose: authorityClass === "view" ? "inspect_workflow_runtime" : "operate_workflow_runtime",
    classification,
    consequence: authorityClass === "decide" ? "material" : "routine",
    targetSeatId: access.seat.id,
  });
  return { access, policy };
}

async function requireEvidence(companyId: number, evidenceIds: string[], requireVerified: boolean) {
  const unique = Array.from(new Set(evidenceIds));
  if (unique.length !== evidenceIds.length) throw new EosRouteError(409, "workflow_evidence_duplicate", "Workflow evidence references must be unique.");
  if (!unique.length) return [];
  const evidence = await db.select().from(eosEvidence).where(and(eq(eosEvidence.companyId, companyId), inArray(eosEvidence.id, unique)));
  if (evidence.length !== unique.length || (requireVerified && evidence.some((item) => item.verificationState !== "verified")))
    throw new EosRouteError(409, "workflow_evidence_invalid", requireVerified ? "Completion requires verified evidence from this company." : "Evidence must resolve inside this company.");
  return evidence;
}

function appendRunEventValues(input: {
  runId: string; companyId: number; sequence: number; action: string; fromState: string; toState: string;
  actorSeatId: string; actorUserId: string; note: string; policyDecisionId: string; evidenceIds?: string[]; approvalId?: string | null; blocker?: string;
}) {
  const projection = {
    schemaVersion: "eos.workflow-run-event.v1",
    runId: input.runId,
    sequence: input.sequence,
    action: input.action,
    fromState: input.fromState,
    toState: input.toState,
    actorSeatId: input.actorSeatId,
    note: input.note,
    evidenceIds: input.evidenceIds || [],
    approvalId: input.approvalId || null,
    blocker: input.blocker || "",
    policyDecisionId: input.policyDecisionId,
    recordedAt: new Date().toISOString(),
  };
  return {
    id: randomUUID(), runId: input.runId, companyId: input.companyId, sequence: input.sequence,
    action: input.action, fromState: input.fromState, toState: input.toState, actorSeatId: input.actorSeatId,
    eventProjection: projection, eventSha256: nativeContractContentSha256(projection), recordedByUserId: input.actorUserId, recordedAt: new Date(),
  };
}

export function registerWorkflowRuntimeRoutes(app: Express): void {
  app.get("/api/eos/companies/:companyId/workflow-runtime", route(async (req, res) => {
    const { access } = await runtimeAccess(req, "view", "workflow_runtime.read");
    const visible = await visibleSeatIds(access.company.id, access.seat.id, access.role);
    const [runs, skills] = await Promise.all([
      db.select().from(eosWorkflowRuns).where(eq(eosWorkflowRuns.companyId, access.company.id)).orderBy(desc(eosWorkflowRuns.updatedAt)),
      db.select().from(eosSkillDefinitions).where(eq(eosSkillDefinitions.companyId, access.company.id)).orderBy(asc(eosSkillDefinitions.name)),
    ]);
    const visibleRuns = runs.filter((run) => mayAccessClassification(access, run.classification) && (access.isOwner || visible.has(run.ownerSeatId) || Boolean(run.delegatedSeatId && visible.has(run.delegatedSeatId))));
    const runIds = visibleRuns.map((run) => run.id);
    const [events, invocations] = runIds.length ? await Promise.all([
      db.select().from(eosWorkflowRunEvents).where(and(eq(eosWorkflowRunEvents.companyId, access.company.id), inArray(eosWorkflowRunEvents.runId, runIds))).orderBy(asc(eosWorkflowRunEvents.recordedAt)),
      db.select().from(eosSkillInvocations).where(and(eq(eosSkillInvocations.companyId, access.company.id), inArray(eosSkillInvocations.runId, runIds))).orderBy(asc(eosSkillInvocations.createdAt)),
    ]) : [[], []];
    res.json({
      schemaVersion: "eos.workflow-runtime.v1",
      runs: visibleRuns.map((run) => ({ ...run, events: events.filter((event) => event.runId === run.id), invocations: invocations.filter((item) => item.runId === run.id) })),
      skills: skills.filter((skill) => mayAccessClassification(access, skill.classification)),
      counts: {
        queued: visibleRuns.filter((run) => run.state === "queued").length,
        active: visibleRuns.filter((run) => ["running", "waiting_input", "waiting_approval", "blocked"].includes(run.state)).length,
        completed: visibleRuns.filter((run) => run.state === "completed").length,
        failed: visibleRuns.filter((run) => run.state === "failed").length,
      },
    });
  }));

  app.post("/api/eos/companies/:companyId/skills", route(async (req, res) => {
    const input = skillDefinitionCreateSchema.parse(req.body);
    const { access, policy } = await runtimeAccess(req, "decide", "skill_definition.create", input.classification);
    if (input.providerBindingId) {
      const [binding] = await db.select().from(eosIntegrationBindings).where(and(eq(eosIntegrationBindings.id, input.providerBindingId), eq(eosIntegrationBindings.companyId, access.company.id))).limit(1);
      if (!binding) throw new EosRouteError(409, "skill_provider_binding_invalid", "The provider binding does not belong to this company.");
    }
    const [latest] = await db.select().from(eosSkillDefinitions).where(and(eq(eosSkillDefinitions.companyId, access.company.id), eq(eosSkillDefinitions.skillKey, input.skillKey))).orderBy(desc(eosSkillDefinitions.version)).limit(1);
    const now = new Date();
    const record = {
      id: randomUUID(), companyId: access.company.id, skillKey: input.skillKey, name: input.name, description: input.description,
      version: (latest?.version || 0) + 1, state: "draft", handlerKind: input.handlerKind, handlerReference: input.handlerReference,
      providerBindingId: input.providerBindingId || null, inputSchema: input.inputSchema, outputSchema: input.outputSchema,
      allowedModes: input.allowedModes, requiredAuthority: input.requiredAuthority, toolEntitlements: input.toolEntitlements,
      timeoutMs: input.timeoutMs, maxAttempts: input.maxAttempts, evidenceRequirements: input.evidenceRequirements,
      classification: input.classification, recordedByUserId: req.user.id, createdAt: now, updatedAt: now,
    };
    await db.transaction(async (tx) => {
      await tx.insert(eosSkillDefinitions).values(record);
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "skill_definition.created", targetType: "skill_definition", targetId: record.id, traceId: policy.traceId, correlationId: policy.correlationId, result: "draft", details: { skillKey: record.skillKey, version: record.version, policyDecisionId: policy.decisionId }, createdAt: now });
    });
    res.status(201).json(record);
  }));

  app.patch("/api/eos/companies/:companyId/skills/:skillId/state", route(async (req, res) => {
    const input = z.object({ state: z.enum(["review", "released", "paused", "retired"]), rationale: z.string().trim().min(20).max(4000) }).parse(req.body);
    const { access, policy } = await runtimeAccess(req, "decide", "skill_definition.transition", "restricted");
    const [skill] = await db.select().from(eosSkillDefinitions).where(and(eq(eosSkillDefinitions.id, req.params.skillId), eq(eosSkillDefinitions.companyId, access.company.id))).limit(1);
    if (!skill) throw new EosRouteError(404, "skill_not_found", "Skill definition not found.");
    const transitions: Record<string, string[]> = { draft: ["review", "retired"], review: ["released", "draft", "retired"], released: ["paused", "retired"], paused: ["released", "retired"] };
    if (!transitions[skill.state]?.includes(input.state)) throw new EosRouteError(409, "skill_transition_invalid", `Skill cannot move from ${skill.state} to ${input.state}.`);
    const [updated] = await db.update(eosSkillDefinitions).set({ state: input.state, updatedAt: new Date() }).where(and(eq(eosSkillDefinitions.id, skill.id), eq(eosSkillDefinitions.state, skill.state))).returning();
    if (!updated) throw new EosRouteError(409, "skill_concurrent_change", "The skill changed before this transition completed.");
    await db.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "skill_definition.transitioned", targetType: "skill_definition", targetId: skill.id, traceId: policy.traceId, correlationId: policy.correlationId, result: input.state, details: { from: skill.state, to: input.state, rationale: input.rationale, policyDecisionId: policy.decisionId }, createdAt: new Date() });
    res.json(updated);
  }));

  app.post("/api/eos/companies/:companyId/workflow-runs", route(async (req, res) => {
    const input = workflowRunCreateSchema.parse(req.body);
    if (containsCredentialMaterial(input.input)) throw new EosRouteError(409, "workflow_input_contains_credentials", "Workflow inputs may contain secret-manager references, but never credentials, passwords, tokens, or private keys.");
    const { access, policy } = await runtimeAccess(req, input.executionMode === "autonomous" ? "decide" : "execute", "workflow_run.create", input.classification);
    const visible = await visibleSeatIds(access.company.id, access.seat.id, access.role);
    const [process] = await db.select().from(eosProcessDefinitions).where(and(eq(eosProcessDefinitions.id, input.processDefinitionId), eq(eosProcessDefinitions.companyId, access.company.id))).limit(1);
    if (!process || !visible.has(process.accountableSeatId) || !mayAccessClassification(access, process.classification)) throw new EosRouteError(404, "process_not_found", "Released process definition not found in this authority scope.");
    if (process.releaseState !== "released" || !["implemented", "pre_live_qualified", "field_qualified"].includes(process.qualificationState))
      throw new EosRouteError(409, "process_not_executable", "A workflow run requires an implemented and released process version.");
    const [ownerSeat] = await db.select().from(eosSeats).where(and(eq(eosSeats.id, process.accountableSeatId), eq(eosSeats.companyId, access.company.id), eq(eosSeats.status, "active"))).limit(1);
    if (!ownerSeat) throw new EosRouteError(409, "workflow_owner_unavailable", "The accountable process seat is not active.");
    if (input.executionMode === "autonomous" && (ownerSeat.occupantUserId || ownerSeat.agentMode !== "autonomous"))
      throw new EosRouteError(409, "autonomous_mode_unavailable", "A human-occupied role uses its agent as an assistant and cannot run as an autonomous seat.");
    if (input.executionMode === "assisted" && !ownerSeat.occupantUserId)
      throw new EosRouteError(409, "assisted_mode_unavailable", "Assisted execution requires a human-occupied accountable seat.");
    if (input.executionMode === "delegated" && (!input.delegatedSeatId || !visible.has(input.delegatedSeatId)))
      throw new EosRouteError(409, "delegation_target_invalid", "Delegation must remain inside the current seat's visible reporting hierarchy.");
    if (input.workPacketId) {
      const [packet] = await db.select().from(eosWorkPackets).where(and(eq(eosWorkPackets.id, input.workPacketId), eq(eosWorkPackets.companyId, access.company.id))).limit(1);
      if (!packet || packet.processDefinitionId !== process.id) throw new EosRouteError(409, "workflow_packet_invalid", "The Work Packet must bind this exact company and process version.");
    }
    const existing = await db.select().from(eosWorkflowRuns).where(and(eq(eosWorkflowRuns.companyId, access.company.id), eq(eosWorkflowRuns.idempotencyKey, input.idempotencyKey))).limit(1);
    if (existing[0]) { res.status(200).json(existing[0]); return; }
    const id = randomUUID(); const now = new Date();
    const record = { id, companyId: access.company.id, portfolioId: access.company.portfolioId, runKey: `run:${process.processKey}:v${process.version}:${id}`, processDefinitionId: process.id, workPacketId: input.workPacketId || null, executionMode: input.executionMode, state: "queued", currentStep: 0, ownerSeatId: process.accountableSeatId, delegatedSeatId: input.delegatedSeatId || null, idempotencyKey: input.idempotencyKey, input: input.input, output: {}, evidenceIds: [], approvalId: null, blocker: "", scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null, classification: input.classification, version: 1, recordedByUserId: req.user.id, createdAt: now, updatedAt: now };
    await db.transaction(async (tx) => {
      await tx.insert(eosWorkflowRuns).values(record);
      await tx.insert(eosWorkflowRunEvents).values(appendRunEventValues({ runId: id, companyId: access.company.id, sequence: 1, action: "created", fromState: "none", toState: "queued", actorSeatId: access.seat.id, actorUserId: req.user.id, note: "Workflow run created from an immutable process version.", policyDecisionId: policy.decisionId }));
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "workflow_run.created", targetType: "workflow_run", targetId: id, traceId: policy.traceId, correlationId: policy.correlationId, result: "queued", details: { processDefinitionId: process.id, executionMode: input.executionMode, policyDecisionId: policy.decisionId }, createdAt: now });
    });
    res.status(201).json(record);
  }));

  app.post("/api/eos/companies/:companyId/workflow-runs/:runId/transition", route(async (req, res) => {
    const input = workflowRunTransitionSchema.parse(req.body);
    const { access, policy } = await runtimeAccess(req, ["complete", "cancel"].includes(input.action) ? "decide" : "execute", `workflow_run.${input.action}`, "confidential");
    const [run] = await db.select().from(eosWorkflowRuns).where(and(eq(eosWorkflowRuns.id, req.params.runId), eq(eosWorkflowRuns.companyId, access.company.id))).limit(1);
    if (!run) throw new EosRouteError(404, "workflow_run_not_found", "Workflow run not found.");
    if (run.version !== input.expectedVersion) throw new EosRouteError(409, "workflow_run_version_conflict", "The workflow run changed before this action.");
    const visible = await visibleSeatIds(access.company.id, access.seat.id, access.role);
    if (!access.isOwner && !visible.has(run.ownerSeatId) && !(run.delegatedSeatId && visible.has(run.delegatedSeatId))) throw new EosRouteError(404, "workflow_run_not_found", "Workflow run not found.");
    const nextState = nextWorkflowRunState(run.state, input.action);
    if (!nextState) throw new EosRouteError(409, "workflow_run_transition_invalid", `Workflow run cannot ${input.action} from ${run.state}.`);
    const [process] = await db.select().from(eosProcessDefinitions).where(eq(eosProcessDefinitions.id, run.processDefinitionId)).limit(1);
    const requirements = Array.isArray(process?.evidenceRequirements) ? process.evidenceRequirements : [];
    await requireEvidence(access.company.id, input.evidenceIds, input.action === "complete");
    if (input.action === "complete" && requirements.length && !input.evidenceIds.length) throw new EosRouteError(409, "workflow_completion_evidence_required", "This process requires verified completion evidence.");
    if (run.state === "waiting_approval" && input.action === "resume") {
      const [approval] = run.approvalId ? await db.select().from(eosApprovalRequests).where(and(eq(eosApprovalRequests.id, run.approvalId), eq(eosApprovalRequests.companyId, access.company.id))).limit(1) : [];
      if (!approval || approval.status !== "approved") throw new EosRouteError(409, "workflow_approval_pending", "The bound approval must be approved before the run can resume.");
    }
    if (input.approvalId) {
      const [approval] = await db.select().from(eosApprovalRequests).where(and(eq(eosApprovalRequests.id, input.approvalId), eq(eosApprovalRequests.companyId, access.company.id))).limit(1);
      if (!approval || (run.workPacketId && approval.workPacketId !== run.workPacketId)) throw new EosRouteError(409, "workflow_approval_invalid", "Approval must belong to this company and bound Work Packet.");
    }
    const now = new Date(); const nextVersion = run.version + 1;
    const event = appendRunEventValues({ runId: run.id, companyId: access.company.id, sequence: nextVersion, action: input.action, fromState: run.state, toState: nextState, actorSeatId: access.seat.id, actorUserId: req.user.id, note: input.note, policyDecisionId: policy.decisionId, evidenceIds: input.evidenceIds, approvalId: input.approvalId || run.approvalId, blocker: input.blocker });
    const [updated] = await db.transaction(async (tx) => {
      await tx.insert(eosWorkflowRunEvents).values(event);
      const rows = await tx.update(eosWorkflowRuns).set({ state: nextState, output: input.action === "complete" ? input.output : run.output, evidenceIds: input.evidenceIds.length ? input.evidenceIds : run.evidenceIds, approvalId: input.approvalId || run.approvalId, blocker: input.blocker, version: nextVersion, startedAt: input.action === "start" ? now : run.startedAt, completedAt: ["completed", "failed", "cancelled"].includes(nextState) ? now : null, updatedAt: now }).where(and(eq(eosWorkflowRuns.id, run.id), eq(eosWorkflowRuns.version, run.version), eq(eosWorkflowRuns.state, run.state))).returning();
      if (!rows[0]) throw new EosRouteError(409, "workflow_run_concurrent_change", "The workflow run changed before the transition completed.");
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: `workflow_run.${input.action}`, targetType: "workflow_run", targetId: run.id, traceId: policy.traceId, correlationId: policy.correlationId, result: nextState, details: { from: run.state, to: nextState, version: nextVersion, policyDecisionId: policy.decisionId }, createdAt: now });
      return rows;
    });
    res.json(updated);
  }));

  app.post("/api/eos/companies/:companyId/workflow-runs/:runId/skill-invocations", route(async (req, res) => {
    const input = skillInvocationCreateSchema.parse(req.body);
    if (containsCredentialMaterial(input.input)) throw new EosRouteError(409, "skill_input_contains_credentials", "Skill inputs may contain secret-manager references, but never credentials, passwords, tokens, or private keys.");
    const { access, policy } = await runtimeAccess(req, "execute", "skill_invocation.queue", "confidential");
    const [run] = await db.select().from(eosWorkflowRuns).where(and(eq(eosWorkflowRuns.id, req.params.runId), eq(eosWorkflowRuns.companyId, access.company.id))).limit(1);
    if (!run || run.state !== "running") throw new EosRouteError(409, "workflow_run_not_running", "Skills can be queued only for a running workflow.");
    const [skill] = await db.select().from(eosSkillDefinitions).where(and(eq(eosSkillDefinitions.id, input.skillDefinitionId), eq(eosSkillDefinitions.companyId, access.company.id))).limit(1);
    if (!skill || skill.state !== "released") throw new EosRouteError(409, "skill_not_released", "A workflow may invoke only a released skill version.");
    if (!Array.isArray(skill.allowedModes) || !skill.allowedModes.includes(run.executionMode)) throw new EosRouteError(409, "skill_mode_denied", "The skill is not released for this workflow execution mode.");
    if (skill.handlerKind === "provider") {
      const [binding] = skill.providerBindingId ? await db.select().from(eosIntegrationBindings).where(and(eq(eosIntegrationBindings.id, skill.providerBindingId), eq(eosIntegrationBindings.companyId, access.company.id))).limit(1) : [];
      if (!binding || binding.lifecycleState !== "active" || binding.connectionState !== "connected") throw new EosRouteError(409, "skill_provider_unavailable", "Provider execution remains blocked until its governed binding is active and connected.");
    }
    const existing = await db.select().from(eosSkillInvocations).where(and(eq(eosSkillInvocations.runId, run.id), eq(eosSkillInvocations.idempotencyKey, input.idempotencyKey))).limit(1);
    if (existing[0]) { res.status(200).json(existing[0]); return; }
    const now = new Date();
    const record = { id: randomUUID(), companyId: access.company.id, runId: run.id, skillDefinitionId: skill.id, stepIndex: input.stepIndex, state: "queued", attempt: 1, idempotencyKey: input.idempotencyKey, input: input.input, output: {}, error: "", evidenceIds: [], recordedByUserId: req.user.id, createdAt: now, updatedAt: now };
    await db.transaction(async (tx) => {
      await tx.insert(eosSkillInvocations).values(record);
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: access.company.id, actorUserId: req.user.id, action: "skill_invocation.queued", targetType: "skill_invocation", targetId: record.id, traceId: policy.traceId, correlationId: policy.correlationId, result: "queued", details: { runId: run.id, skillDefinitionId: skill.id, handlerKind: skill.handlerKind, externalEffectsExecuted: false, policyDecisionId: policy.decisionId }, createdAt: now });
    });
    res.status(201).json(record);
  }));
}
