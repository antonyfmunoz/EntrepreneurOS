import { randomUUID } from "node:crypto";
import { and, asc, count, eq, gte, inArray, like, lte, sql } from "drizzle-orm";
import {
  eosAgentEventOutbox,
  eosAgentSchedules,
  eosAuditRecords,
  eosAuthoritySubjects,
  eosProcessDefinitions,
  eosSeats,
  eosWorkflowRunEvents,
  eosWorkflowRuns,
} from "@shared/schema";
import { nextAgentScheduleAt } from "@shared/agent-runtime";
import { db } from "../db";
import { nativeContractContentSha256 } from "../esign/template-generation";
import { writeLog } from "../observability/logger";

type Schedule = typeof eosAgentSchedules.$inferSelect;

function runEvent(input: { runId: string; companyId: number; sequence: number; action: string; fromState: string; toState: string; seatId: string; userId: string; trigger: Record<string, unknown>; policyDecisionId: string; at: Date }) {
  const eventProjection = {
    schemaVersion: "eos.workflow-run-event.v1",
    runId: input.runId,
    sequence: input.sequence,
    action: input.action,
    fromState: input.fromState,
    toState: input.toState,
    actorSeatId: input.seatId,
    note: `Agent schedule ${String(input.trigger.kind)} trigger.`,
    trigger: input.trigger,
    evidenceIds: [], approvalId: null, blocker: "", policyDecisionId: input.policyDecisionId,
    recordedAt: input.at.toISOString(),
  };
  return {
    id: randomUUID(), runId: input.runId, companyId: input.companyId, sequence: input.sequence,
    action: input.action, fromState: input.fromState, toState: input.toState, actorSeatId: input.seatId,
    eventProjection, eventSha256: nativeContractContentSha256(eventProjection), recordedByUserId: input.userId, recordedAt: input.at,
  };
}

async function enqueueSchedule(scheduleId: string, trigger: Record<string, unknown>, now: Date) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`agent-schedule:${scheduleId}`}))`);
    const [schedule] = await tx.select().from(eosAgentSchedules).where(eq(eosAgentSchedules.id, scheduleId)).limit(1);
    if (!schedule || schedule.state !== "active") return null;
    const [process, seat, subject] = await Promise.all([
      tx.select().from(eosProcessDefinitions).where(and(eq(eosProcessDefinitions.id, schedule.processDefinitionId), eq(eosProcessDefinitions.companyId, schedule.companyId))).limit(1).then((rows: any[]) => rows[0]),
      tx.select().from(eosSeats).where(and(eq(eosSeats.id, schedule.seatId), eq(eosSeats.companyId, schedule.companyId), eq(eosSeats.status, "active"))).limit(1).then((rows: any[]) => rows[0]),
      tx.select().from(eosAuthoritySubjects).where(and(eq(eosAuthoritySubjects.id, schedule.authoritySubjectId), eq(eosAuthoritySubjects.companyId, schedule.companyId))).limit(1).then((rows: any[]) => rows[0]),
    ]);
    const runtimeValid = process && seat && subject && Boolean(schedule.activationPolicyDecisionId) && process.accountableSeatId === seat.id
      && process.releaseState === "released" && ["implemented", "pre_live_qualified", "field_qualified"].includes(process.qualificationState)
      && subject.status === "active" && subject.verificationStatus === "verified"
      && (subject.seatId === seat.id || subject.agentClass === "advisor_agent")
      && (schedule.executionMode !== "autonomous" || (!seat.occupantUserId && seat.agentMode === "autonomous"))
      && (schedule.executionMode !== "assisted" || Boolean(seat.occupantUserId));
    if (!runtimeValid) {
      await tx.update(eosAgentSchedules).set({ state: "paused", version: schedule.version + 1, updatedAt: now }).where(and(eq(eosAgentSchedules.id, schedule.id), eq(eosAgentSchedules.version, schedule.version)));
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: schedule.companyId, actorUserId: schedule.recordedByUserId, action: "agent_schedule.auto_paused", targetType: "agent_schedule", targetId: schedule.id, traceId: randomUUID(), correlationId: randomUUID(), result: "paused", details: { reason: "runtime_contract_invalid", externalEffectsExecuted: false }, createdAt: now });
      return null;
    }
    const triggerIdentity = String(trigger.id || trigger.scheduledFor || now.toISOString());
    const idempotencyKey = `agent-schedule:${schedule.id}:${triggerIdentity}`;
    const [existing] = await tx.select().from(eosWorkflowRuns).where(and(eq(eosWorkflowRuns.companyId, schedule.companyId), eq(eosWorkflowRuns.idempotencyKey, idempotencyKey))).limit(1);
    if (existing) return existing;
    const startOfUtcDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const [{ count: scheduledRunsToday }] = await tx.select({ count: count() }).from(eosWorkflowRuns).where(and(
      eq(eosWorkflowRuns.companyId, schedule.companyId),
      like(eosWorkflowRuns.idempotencyKey, `agent-schedule:${schedule.id}:%`),
      gte(eosWorkflowRuns.createdAt, startOfUtcDay),
    ));
    if (Number(scheduledRunsToday) >= schedule.maxRunsPerDay) {
      await tx.update(eosAgentSchedules).set({ state: "paused", version: schedule.version + 1, updatedAt: now }).where(and(eq(eosAgentSchedules.id, schedule.id), eq(eosAgentSchedules.version, schedule.version)));
      await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: schedule.companyId, actorUserId: schedule.recordedByUserId, action: "agent_schedule.daily_limit_reached", targetType: "agent_schedule", targetId: schedule.id, traceId: randomUUID(), correlationId: randomUUID(), result: "paused", details: { maxRunsPerDay: schedule.maxRunsPerDay }, createdAt: now });
      return null;
    }
    const id = randomUUID();
    const run = {
      id, companyId: schedule.companyId, portfolioId: schedule.portfolioId,
      runKey: `agent:${schedule.scheduleKey}:${id}`, processDefinitionId: schedule.processDefinitionId, workPacketId: null,
      executionMode: schedule.executionMode, state: "queued", currentStep: 0, ownerSeatId: schedule.seatId, delegatedSeatId: null,
      idempotencyKey, input: { ...(schedule.inputTemplate as Record<string, unknown>), _agentTrigger: trigger, _scheduleId: schedule.id },
      output: {}, evidenceIds: [], approvalId: null, blocker: "", scheduledFor: now, startedAt: null, completedAt: null,
      classification: schedule.classification, version: 1, recordedByUserId: schedule.recordedByUserId, createdAt: now, updatedAt: now,
    };
    await tx.insert(eosWorkflowRuns).values(run);
    await tx.insert(eosWorkflowRunEvents).values(runEvent({ runId: id, companyId: schedule.companyId, sequence: 1, action: "created", fromState: "none", toState: "queued", seatId: schedule.seatId, userId: schedule.recordedByUserId, trigger, policyDecisionId: schedule.activationPolicyDecisionId!, at: now }));
    let result: any = run;
    if (schedule.executionMode === "autonomous") {
      await tx.insert(eosWorkflowRunEvents).values(runEvent({ runId: id, companyId: schedule.companyId, sequence: 2, action: "start", fromState: "queued", toState: "running", seatId: schedule.seatId, userId: schedule.recordedByUserId, trigger, policyDecisionId: schedule.activationPolicyDecisionId!, at: now }));
      [result] = await tx.update(eosWorkflowRuns).set({ state: "running", version: 2, startedAt: now, updatedAt: now }).where(eq(eosWorkflowRuns.id, id)).returning();
    }
    const nextRunAt = schedule.triggerKind === "schedule" ? nextAgentScheduleAt(schedule.cadence, now) : schedule.nextRunAt;
    await tx.update(eosAgentSchedules).set({
      lastRunAt: now,
      nextRunAt: nextRunAt || schedule.nextRunAt,
      state: schedule.cadence === "once" ? "paused" : schedule.state,
      version: schedule.version + 1,
      updatedAt: now,
    }).where(and(eq(eosAgentSchedules.id, schedule.id), eq(eosAgentSchedules.version, schedule.version)));
    await tx.insert(eosAuditRecords).values({ id: randomUUID(), companyId: schedule.companyId, actorUserId: schedule.recordedByUserId, action: "agent_schedule.run_enqueued", targetType: "workflow_run", targetId: id, traceId: randomUUID(), correlationId: randomUUID(), result: result.state, details: { scheduleId: schedule.id, executionMode: schedule.executionMode, trigger, externalEffectsExecuted: false }, createdAt: now });
    return result;
  });
}

/**
 * A manual schedule is a deliberate operator command, not an event-dispatch
 * loophole. The route authorizes the caller and this helper keeps the
 * scheduler contract honest if it is reused by another internal surface.
 */
export async function enqueueManualAgentSchedule(input: {
  companyId: number;
  scheduleId: string;
  idempotencyKey: string;
  requestedAt?: Date;
}) {
  const [schedule] = await db.select({
    id: eosAgentSchedules.id,
    triggerKind: eosAgentSchedules.triggerKind,
    cadence: eosAgentSchedules.cadence,
  }).from(eosAgentSchedules).where(and(
    eq(eosAgentSchedules.id, input.scheduleId),
    eq(eosAgentSchedules.companyId, input.companyId),
  )).limit(1);
  if (!schedule || schedule.triggerKind !== "manual" || schedule.cadence !== "manual") return null;
  const now = input.requestedAt || new Date();
  return enqueueSchedule(schedule.id, {
    kind: "manual",
    id: input.idempotencyKey,
    requestedAt: now.toISOString(),
  }, now);
}

export async function enqueueDueAgentSchedulesOnce(now = new Date(), limit = 25) {
  const schedules = await db.select({ id: eosAgentSchedules.id }).from(eosAgentSchedules).where(and(
    eq(eosAgentSchedules.state, "active"), eq(eosAgentSchedules.triggerKind, "schedule"), lte(eosAgentSchedules.nextRunAt, now),
  )).orderBy(asc(eosAgentSchedules.nextRunAt)).limit(limit);
  let enqueued = 0;
  for (const schedule of schedules) if (await enqueueSchedule(schedule.id, { kind: "schedule", scheduledFor: now.toISOString() }, now)) enqueued += 1;
  return enqueued;
}

export async function enqueueAgentEvent(input: { companyId: number; eventType: string; eventId: string; payload: Record<string, unknown>; observedAt?: Date }) {
  const schedules = await db.select().from(eosAgentSchedules).where(and(eq(eosAgentSchedules.companyId, input.companyId), eq(eosAgentSchedules.state, "active"), eq(eosAgentSchedules.triggerKind, "event")));
  const matching = schedules.filter((schedule) => Array.isArray(schedule.eventTypes) && schedule.eventTypes.includes(input.eventType));
  const now = input.observedAt || new Date();
  const results = [];
  for (const schedule of matching) {
    const result = await enqueueSchedule(schedule.id, { kind: "event", id: input.eventId, eventType: input.eventType, payload: input.payload, observedAt: now.toISOString() }, now);
    if (result) results.push(result);
  }
  return results;
}

export type AgentEventInput = {
  id: string;
  companyId: number;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  occurredAt?: Date;
};

/**
 * Stores an internal event before delivery.  Reusing an ID is intentionally
 * idempotent: a retry cannot create a second governed Role Agent run.
 */
export async function recordAgentEvent(input: AgentEventInput) {
  const now = input.occurredAt || new Date();
  await db.insert(eosAgentEventOutbox).values({
    id: input.id,
    companyId: input.companyId,
    eventType: input.eventType,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload,
    state: "pending",
    attempts: 0,
    dispatchedRunIds: [],
    lastError: "",
    occurredAt: now,
    dispatchedAt: null,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();
  const [event] = await db.select().from(eosAgentEventOutbox).where(eq(eosAgentEventOutbox.id, input.id)).limit(1);
  return event || null;
}

export async function dispatchAgentEventOutboxEvent(eventId: string) {
  const [event] = await db.select().from(eosAgentEventOutbox).where(eq(eosAgentEventOutbox.id, eventId)).limit(1);
  if (!event) return null;
  if (event.state === "dispatched") return { event, runIds: Array.isArray(event.dispatchedRunIds) ? event.dispatchedRunIds as string[] : [], replayed: true };
  const now = new Date();
  try {
    const runs = await enqueueAgentEvent({
      companyId: event.companyId,
      eventType: event.eventType,
      eventId: event.id,
      payload: event.payload as Record<string, unknown>,
      observedAt: event.occurredAt,
    });
    const runIds = runs.map((run) => run.id);
    const [updated] = await db.update(eosAgentEventOutbox).set({
      state: "dispatched",
      attempts: event.attempts + 1,
      dispatchedRunIds: runIds,
      lastError: "",
      dispatchedAt: now,
      updatedAt: now,
    }).where(eq(eosAgentEventOutbox.id, event.id)).returning();
    return { event: updated || event, runIds, replayed: false };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 2000) : "Unknown Role Agent event dispatch failure.";
    await db.update(eosAgentEventOutbox).set({ state: "failed", attempts: event.attempts + 1, lastError: message, updatedAt: now }).where(eq(eosAgentEventOutbox.id, event.id));
    writeLog("error", "agent_event_dispatch_failed", { eventId: event.id, companyId: event.companyId, eventType: event.eventType, error });
    return { event: { ...event, state: "failed", attempts: event.attempts + 1, lastError: message }, runIds: [], replayed: false };
  }
}

export async function dispatchPendingAgentEventsOnce(limit = 50) {
  const events = await db.select({ id: eosAgentEventOutbox.id }).from(eosAgentEventOutbox).where(inArray(eosAgentEventOutbox.state, ["pending", "failed"])).orderBy(asc(eosAgentEventOutbox.occurredAt)).limit(limit);
  let dispatched = 0;
  for (const event of events) {
    const result = await dispatchAgentEventOutboxEvent(event.id);
    if (result?.event.state === "dispatched") dispatched += 1;
  }
  return dispatched;
}

export function startAgentScheduleWorker(intervalMs = 30_000) {
  const run = () => void Promise.all([enqueueDueAgentSchedulesOnce(), dispatchPendingAgentEventsOnce()]).then(([enqueued, dispatched]) => {
    if (enqueued || dispatched) writeLog("info", "agent_schedule_worker_completed", { enqueued, dispatched });
  }).catch((error) => writeLog("error", "agent_schedule_worker_failed", { error }));
  const timer = setInterval(run, Math.max(5_000, intervalMs)); timer.unref(); run();
  return () => clearInterval(timer);
}
