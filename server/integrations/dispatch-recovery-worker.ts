import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, lt, sql } from "drizzle-orm";
import {
  eosAuditRecords,
  eosIntegrationBindings,
  eosIntegrationIncidents,
  eosIntegrationOperationalStates,
  eosIntegrationOperationEvents,
  eosIntegrationRuns,
  eosProviderExecutions,
} from "@shared/schema";
import { db } from "../db";
import { nativeContractContentSha256 } from "../esign/template-generation";
import { writeLog } from "../observability/logger";

const DEFAULT_RECOVERY_AFTER_MS = 5 * 60_000;
const MIN_RECOVERY_AFTER_MS = 60_000;
const MAX_RECOVERY_AFTER_MS = 24 * 60 * 60_000;
const MAX_BATCH = 20;

export function integrationDispatchRecoveryAfterMs(env: Record<string, string | undefined> = process.env): number {
  const parsed = Number(env.EOS_INTEGRATION_DISPATCH_RECOVERY_AFTER_MS || DEFAULT_RECOVERY_AFTER_MS);
  if (!Number.isFinite(parsed)) return DEFAULT_RECOVERY_AFTER_MS;
  return Math.min(MAX_RECOVERY_AFTER_MS, Math.max(MIN_RECOVERY_AFTER_MS, Math.floor(parsed)));
}

export function integrationDispatchRecoveryIntervalMs(env: Record<string, string | undefined> = process.env): number {
  const parsed = Number(env.EOS_INTEGRATION_DISPATCH_RECOVERY_INTERVAL_MS || 60_000);
  if (!Number.isFinite(parsed)) return 60_000;
  return Math.min(60 * 60_000, Math.max(10_000, Math.floor(parsed)));
}

async function appendRecoveryEvent(tx: any, values: {
  companyId: number;
  integrationBindingId: string;
  subjectType: "run" | "incident" | "operational_state";
  subjectId: string;
  versionBefore: number;
  versionAfter: number;
  evidenceIds: string[];
  payload: Record<string, unknown>;
  policyDecisionId: string;
  recordedByUserId: string;
  recordedAt: Date;
}) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`integration-operation-chain:${values.integrationBindingId}`}))`);
  const [previous] = await tx.select().from(eosIntegrationOperationEvents)
    .where(eq(eosIntegrationOperationEvents.integrationBindingId, values.integrationBindingId))
    .orderBy(desc(eosIntegrationOperationEvents.recordedAt), desc(eosIntegrationOperationEvents.id)).limit(1);
  const id = randomUUID();
  const previousEventSha256 = previous?.eventSha256 || "";
  const eventSha256 = nativeContractContentSha256({
    schemaVersion: "eos-integration-operation-event.v1",
    id,
    previousEventSha256,
    eventType: "dispatch_recovery_escalated",
    ...values,
    recordedAt: values.recordedAt.toISOString(),
  });
  const [event] = await tx.insert(eosIntegrationOperationEvents).values({
    id,
    previousEventSha256,
    eventSha256,
    eventType: "dispatch_recovery_escalated",
    ...values,
  }).returning();
  return event;
}

export async function escalateExpiredIntegrationDispatchesOnce(options: {
  now?: Date;
  recoveryAfterMs?: number;
  batchSize?: number;
} = {}): Promise<number> {
  const now = options.now || new Date();
  const recoveryAfterMs = options.recoveryAfterMs ?? integrationDispatchRecoveryAfterMs();
  const cutoff = new Date(now.getTime() - Math.max(1, recoveryAfterMs));
  const candidates = await db.select().from(eosIntegrationRuns)
    .where(and(eq(eosIntegrationRuns.state, "dispatching"), lt(eosIntegrationRuns.updatedAt, cutoff)))
    .orderBy(asc(eosIntegrationRuns.updatedAt)).limit(Math.min(MAX_BATCH, Math.max(1, options.batchSize || MAX_BATCH)));
  let escalated = 0;

  for (const candidate of candidates) {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`integration-run:${candidate.id}`}))`);
      const [run] = await tx.select().from(eosIntegrationRuns).where(eq(eosIntegrationRuns.id, candidate.id)).limit(1);
      if (!run || run.state !== "dispatching" || !run.providerExecutionId || run.updatedAt >= cutoff) return null;
      const [execution] = await tx.select().from(eosProviderExecutions).where(eq(eosProviderExecutions.id, run.providerExecutionId)).limit(1);
      const [binding] = await tx.select().from(eosIntegrationBindings).where(eq(eosIntegrationBindings.id, run.integrationBindingId)).limit(1);
      const [dispatchEvent] = await tx.select().from(eosIntegrationOperationEvents).where(eq(eosIntegrationOperationEvents.id, run.lastEventId!)).limit(1);
      if (!execution || !binding || !dispatchEvent || execution.status !== "executing" || execution.reconciliationStatus !== "pending") return null;

      const [claimed] = await tx.update(eosProviderExecutions).set({
        status: "uncertain",
        reconciliationStatus: "recovery_required",
        failureCode: "dispatch_lease_expired",
        updatedAt: now,
      }).where(and(
        eq(eosProviderExecutions.id, execution.id),
        eq(eosProviderExecutions.status, "executing"),
        eq(eosProviderExecutions.reconciliationStatus, "pending"),
      )).returning();
      if (!claimed) return null;

      const evidenceIds = Array.isArray(dispatchEvent.evidenceIds) ? dispatchEvent.evidenceIds as string[] : [];
      const runEvent = await appendRecoveryEvent(tx, {
        companyId: run.companyId,
        integrationBindingId: run.integrationBindingId,
        subjectType: "run",
        subjectId: run.id,
        versionBefore: run.version,
        versionAfter: run.version + 1,
        evidenceIds,
        payload: { providerExecutionId: execution.id, failureCode: "dispatch_lease_expired", providerOutcomeKnown: false, retryAuthorized: false },
        policyDecisionId: dispatchEvent.policyDecisionId,
        recordedByUserId: dispatchEvent.recordedByUserId,
        recordedAt: now,
      });
      const [updatedRun] = await tx.update(eosIntegrationRuns).set({
        version: run.version + 1,
        lastEventId: runEvent.id,
        updatedAt: now,
      }).where(and(eq(eosIntegrationRuns.id, run.id), eq(eosIntegrationRuns.version, run.version), eq(eosIntegrationRuns.state, "dispatching"))).returning();
      if (!updatedRun) return null;

      const [existingIncident] = await tx.select().from(eosIntegrationIncidents)
        .where(and(eq(eosIntegrationIncidents.runId, run.id), eq(eosIntegrationIncidents.state, "open"))).limit(1);
      let incident = existingIncident;
      if (!incident) {
        const incidentId = randomUUID();
        const incidentEvent = await appendRecoveryEvent(tx, {
          companyId: run.companyId,
          integrationBindingId: run.integrationBindingId,
          subjectType: "incident",
          subjectId: incidentId,
          versionBefore: 0,
          versionAfter: 1,
          evidenceIds,
          payload: { runId: run.id, providerExecutionId: execution.id, severity: "material", providerOutcomeKnown: false },
          policyDecisionId: dispatchEvent.policyDecisionId,
          recordedByUserId: dispatchEvent.recordedByUserId,
          recordedAt: now,
        });
        [incident] = await tx.insert(eosIntegrationIncidents).values({
          id: incidentId,
          companyId: run.companyId,
          integrationBindingId: run.integrationBindingId,
          runId: run.id,
          severity: "material",
          state: "open",
          summary: `${binding.name}: provider dispatch exceeded its recovery lease; the external outcome is unknown.`,
          recoveryPlan: `${binding.failureRecovery || binding.manualFallback} Verify provider state before recording a reconciled receipt or authorizing any retry.`,
          ownerSeatId: binding.recoveryOwnerSeatId,
          evidenceIds,
          version: 1,
          lastEventId: incidentEvent.id,
          openedAt: now,
          updatedAt: now,
        }).returning();
      }

      const [operational] = await tx.select().from(eosIntegrationOperationalStates)
        .where(eq(eosIntegrationOperationalStates.integrationBindingId, run.integrationBindingId)).limit(1);
      if (operational && !operational.activeIncidentId && incident) {
        const operationalEvent = await appendRecoveryEvent(tx, {
          companyId: run.companyId,
          integrationBindingId: run.integrationBindingId,
          subjectType: "operational_state",
          subjectId: run.integrationBindingId,
          versionBefore: operational.version,
          versionAfter: operational.version + 1,
          evidenceIds,
          payload: { runId: run.id, incidentId: incident.id, providerOutcomeKnown: false },
          policyDecisionId: dispatchEvent.policyDecisionId,
          recordedByUserId: dispatchEvent.recordedByUserId,
          recordedAt: now,
        });
        const [updatedOperational] = await tx.update(eosIntegrationOperationalStates).set({
          activeIncidentId: incident.id,
          version: operational.version + 1,
          lastEventId: operationalEvent.id,
          updatedAt: now,
        }).where(and(
          eq(eosIntegrationOperationalStates.integrationBindingId, run.integrationBindingId),
          eq(eosIntegrationOperationalStates.version, operational.version),
        )).returning();
        if (!updatedOperational) throw new Error("Integration operational state changed during dispatch recovery escalation.");
      }

      await tx.insert(eosAuditRecords).values({
        id: randomUUID(),
        companyId: run.companyId,
        actorUserId: dispatchEvent.recordedByUserId,
        action: "integration_operations.dispatch.recovery_escalated",
        targetType: "integration_run",
        targetId: run.id,
        traceId: execution.traceId,
        correlationId: execution.correlationId,
        result: "recovery_required",
        details: { providerExecutionId: execution.id, incidentId: incident?.id, providerOutcomeKnown: false, retryAuthorized: false, systemInitiated: true, eventSha256: runEvent.eventSha256 },
        createdAt: now,
      });
      return { runId: run.id, providerExecutionId: execution.id, incidentId: incident?.id };
    });
    if (!result) continue;
    escalated += 1;
    writeLog("warn", "integration_dispatch_recovery_escalated", result);
  }
  return escalated;
}

export function startIntegrationDispatchRecoveryWorker(intervalMs = integrationDispatchRecoveryIntervalMs()): () => void {
  const run = () => void escalateExpiredIntegrationDispatchesOnce().catch((error) => writeLog("error", "integration_dispatch_recovery_worker_failed", { error }));
  const timer = setInterval(run, intervalMs);
  timer.unref();
  run();
  return () => clearInterval(timer);
}
