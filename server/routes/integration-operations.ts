import { createHash, randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ZodError } from "zod";
import {
  eosAdapterCapabilityManifests, eosAuditRecords, eosAutomations, eosEvidence,
  eosIntegrationBindings, eosIntegrationCutoverDecisions, eosIntegrationIncidents,
  eosIntegrationOperationalStates, eosIntegrationOperationEvents, eosIntegrationQualifications,
  eosIntegrationRunReceipts, eosIntegrationRuns, eosIntegrationWebhookEndpoints,
  eosIntegrationWebhookEvents, eosProviderExecutions, eosSeats, eosWorkPackets,
} from "@shared/schema";
import {
  adapterManifestCreateSchema, executableAdapterOperations, integrationCutoverSchema, integrationFallbackSchema,
  integrationIncidentTransitionSchema, integrationQualificationSchema, integrationRetrySchema,
  integrationRunCreateSchema, integrationRunExecuteSchema, integrationRunReceiptSchema, integrationAdapterEventSchema,
  integrationWebhookEndpointCreateSchema, integrationWebhookEndpointStateSchema, integrationWebhookSecretRotateSchema,
  providerExecutionEnabled, terminalRunState,
} from "@shared/integration-operations";
import { allowedSurfacesFor } from "@shared/eos-runtime";
import { db } from "../db";
import { nativeContractContentSha256 } from "../esign/template-generation";
import {
  AdapterDispatchError, adapterOperationIsExecutable, dispatchAllowlistedAdapterOperation,
  providerMatchesOperation, validateAdapterOperationRequest,
} from "../integrations/adapter-dispatch";
import {
  adapterWebhookSecretFingerprint, generateAdapterWebhookSecret, verifyAdapterWebhook,
} from "../integrations/adapter-webhook";
import { credentialEncryptionConfigured, decryptCredential, encryptCredential } from "../security/credential-encryption";
import { fixedWindowRateLimit } from "../middleware/rate-limit";
import { writeLog } from "../observability/logger";
import { EosRouteError, authorizeAction, companyAccess, mayAccessClassification, visibleSeatIds } from "./eos-runtime";

type Access = Awaited<ReturnType<typeof companyAccess>>;
type Policy = Awaited<ReturnType<typeof authorizeAction>>;
const adapterWebhookRateLimit = fixedWindowRateLimit({ limit: 180, windowMs: 60_000, namespace: "integration-adapter-webhooks" });

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof EosRouteError) return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof ZodError) return res.status(400).json({ code: "integration_operations_input_invalid", message: error.issues[0]?.message || "Integration-operations input is invalid." });
      next(error);
    }
  };
}

function hash(value: unknown) { return nativeContractContentSha256(value); }

async function operationsAccess(req: Request, authorityClass: "view" | "execute" | "decide" | "approve", actionKey: string, classification = "confidential") {
  const access = await companyAccess(req);
  if (!allowedSurfacesFor(access.role).includes("systems")) throw new EosRouteError(403, "integration_operations_scope_denied", "Integration operations are outside this role's compiled Systems workspace.");
  const policy = await authorizeAction(req, access, {
    authorityClass, resource: "integration_binding", actionKey,
    purpose: authorityClass === "view" ? "inspect_integration_operations" : "govern_integration_operations",
    classification, consequence: ["decide", "approve"].includes(authorityClass) ? "material" : "routine", targetSeatId: access.seat.id,
  });
  return { access, policy };
}

async function visibleBinding(companyId: number, bindingId: string, access: Access) {
  const binding = await db.query.eosIntegrationBindings.findFirst({ where: and(eq(eosIntegrationBindings.id, bindingId), eq(eosIntegrationBindings.companyId, companyId)) });
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  if (!binding || !visible.has(binding.ownerSeatId) || !mayAccessClassification(access, binding.classification)) throw new EosRouteError(404, "integration_binding_not_found", "Integration binding not found in this authority scope.");
  return binding;
}

async function visibleRun(companyId: number, runId: string, access: Access) {
  const run = await db.query.eosIntegrationRuns.findFirst({ where: and(eq(eosIntegrationRuns.id, runId), eq(eosIntegrationRuns.companyId, companyId)) });
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  if (!run || !visible.has(run.ownerSeatId) || !mayAccessClassification(access, run.classification)) throw new EosRouteError(404, "integration_run_not_found", "Integration run not found in this authority scope.");
  return run;
}

async function visibleIncident(companyId: number, incidentId: string, access: Access) {
  const incident = await db.query.eosIntegrationIncidents.findFirst({ where: and(eq(eosIntegrationIncidents.id, incidentId), eq(eosIntegrationIncidents.companyId, companyId)) });
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  if (!incident || !visible.has(incident.ownerSeatId)) throw new EosRouteError(404, "integration_incident_not_found", "Integration incident not found in this authority scope.");
  return incident;
}

async function visibleWebhookEndpoint(companyId: number, endpointId: string, access: Access) {
  const endpoint = await db.query.eosIntegrationWebhookEndpoints.findFirst({ where: and(eq(eosIntegrationWebhookEndpoints.id, endpointId), eq(eosIntegrationWebhookEndpoints.companyId, companyId)) });
  if (!endpoint) throw new EosRouteError(404, "integration_webhook_endpoint_not_found", "Adapter webhook endpoint not found in this authority scope.");
  await visibleBinding(companyId, endpoint.integrationBindingId, access);
  return endpoint;
}

function webhookEndpointProjection(endpoint: typeof eosIntegrationWebhookEndpoints.$inferSelect, origin?: string) {
  const endpointPath = `/api/eos/integration-webhooks/${endpoint.id}`;
  let endpointUrl: string | null = null;
  try { if (origin) endpointUrl = new URL(endpointPath, origin).toString(); } catch { endpointUrl = null; }
  return {
    id: endpoint.id, companyId: endpoint.companyId, integrationBindingId: endpoint.integrationBindingId,
    controlWorkPacketId: endpoint.controlWorkPacketId, acceptedEventTypes: endpoint.acceptedEventTypes,
    state: endpoint.state, secretFingerprint: endpoint.secretFingerprint, version: endpoint.version,
    previousSecretExpiresAt: endpoint.previousSecretExpiresAt, lastInboundEventAt: endpoint.lastInboundEventAt,
    createdAt: endpoint.createdAt, updatedAt: endpoint.updatedAt, endpointPath, endpointUrl,
  };
}

async function verifiedEvidence(companyId: number, ids: string[], access: Access) {
  const unique = Array.from(new Set(ids));
  if (!unique.length || unique.length !== ids.length) throw new EosRouteError(409, "integration_operations_evidence_invalid", "Evidence references must be unique and non-empty.");
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  const rows = await db.select({ evidence: eosEvidence, packet: eosWorkPackets }).from(eosEvidence).innerJoin(eosWorkPackets, eq(eosWorkPackets.id, eosEvidence.workPacketId)).where(and(eq(eosEvidence.companyId, companyId), eq(eosWorkPackets.companyId, companyId), inArray(eosEvidence.id, unique)));
  const allowed = rows.filter(({ evidence, packet }) => evidence.verificationState === "verified" && mayAccessClassification(access, evidence.dataClassification) && mayAccessClassification(access, packet.classification) && (access.isOwner || Boolean(packet.accountableSeatId && visible.has(packet.accountableSeatId))));
  if (allowed.length !== unique.length) throw new EosRouteError(409, "integration_operations_evidence_invalid", "Every Evidence item must be verified and visible in this company, hierarchy, and classification scope.");
  return allowed.map(({ evidence }) => evidence);
}

async function appendEvent(tx: any, values: {
  companyId: number; integrationBindingId: string; eventType: string; subjectType: string; subjectId: string;
  versionBefore: number; versionAfter: number; evidenceIds: string[]; payload: Record<string, unknown>;
  policyDecisionId: string; recordedByUserId: string; recordedAt: Date;
}) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`integration-operation-chain:${values.integrationBindingId}`}))`);
  const [previous] = await tx.select().from(eosIntegrationOperationEvents).where(eq(eosIntegrationOperationEvents.integrationBindingId, values.integrationBindingId)).orderBy(desc(eosIntegrationOperationEvents.recordedAt), desc(eosIntegrationOperationEvents.id)).limit(1);
  const id = randomUUID(); const previousEventSha256 = previous?.eventSha256 || "";
  const eventSha256 = hash({ schemaVersion: "eos-integration-operation-event.v1", id, previousEventSha256, ...values, recordedAt: values.recordedAt.toISOString() });
  const [event] = await tx.insert(eosIntegrationOperationEvents).values({ id, previousEventSha256, eventSha256, ...values }).returning();
  return event;
}

function audit(companyId: number, userId: string, action: string, targetType: string, targetId: string, result: string, policy: Policy, details: Record<string, unknown>) {
  return { id: randomUUID(), companyId, actorUserId: userId, action, targetType, targetId, traceId: policy.traceId, correlationId: policy.correlationId, result, details: { ...details, policyDecisionId: policy.decisionId }, createdAt: new Date() };
}

async function ensureOperationalState(tx: any, companyId: number, bindingId: string, now: Date) {
  const [state] = await tx.select().from(eosIntegrationOperationalStates).where(eq(eosIntegrationOperationalStates.integrationBindingId, bindingId)).limit(1);
  if (state) return state;
  const [created] = await tx.insert(eosIntegrationOperationalStates).values({ integrationBindingId: bindingId, companyId, trafficMode: "provider", consecutiveFailures: 0, version: 1, updatedAt: now }).returning();
  return created;
}

async function recordRunReceipt(tx: any, values: {
  companyId: number; run: typeof eosIntegrationRuns.$inferSelect; binding: typeof eosIntegrationBindings.$inferSelect;
  input: any; evidence: Array<typeof eosEvidence.$inferSelect>; policy: Policy; userId: string; now: Date;
}) {
  const { companyId, run, binding, input, evidence, policy, userId, now } = values;
  const attemptNumber = run.attemptCount + 1;
  const state = input.outcome === "succeeded" ? "succeeded" : attemptNumber >= run.maxAttempts ? "dead_letter" : input.outcome;
  const responseSha256 = hash(input.responseShape);
  const [previousReceipt] = await tx.select().from(eosIntegrationRunReceipts).where(eq(eosIntegrationRunReceipts.runId, run.id)).orderBy(desc(eosIntegrationRunReceipts.attemptNumber)).limit(1);
  const receiptId = randomUUID(); const previousReceiptSha256 = previousReceipt?.receiptSha256 || "";
  const receiptSha256 = hash({ schemaVersion: "eos-integration-run-receipt.v1", id: receiptId, runId: run.id, attemptNumber, outcome: input.outcome, authority: input.authority, externalReference: input.externalReference, summary: input.summary, responseSha256, latencyMs: input.latencyMs ?? null, evidenceIds: evidence.map((item) => item.id), previousReceiptSha256, recordedAt: now.toISOString() });
  const [receipt] = await tx.insert(eosIntegrationRunReceipts).values({ id: receiptId, companyId, runId: run.id, attemptNumber, outcome: input.outcome, authority: input.authority, externalReference: input.externalReference, summary: input.summary, responseShape: input.responseShape, responseSha256, latencyMs: input.latencyMs ?? null, evidenceIds: evidence.map((item) => item.id), previousReceiptSha256, receiptSha256, recordedByUserId: userId, recordedAt: now }).returning();
  const event = await appendEvent(tx, { companyId, integrationBindingId: binding.id, eventType: "receipt_recorded", subjectType: "run", subjectId: run.id, versionBefore: run.version, versionAfter: run.version + 1, evidenceIds: evidence.map((item) => item.id), payload: { attemptNumber, outcome: input.outcome, resultingState: state, authority: input.authority, externalReference: input.externalReference, receiptSha256 }, policyDecisionId: policy.decisionId, recordedByUserId: userId, recordedAt: now });
  const [updatedRun] = await tx.update(eosIntegrationRuns).set({ state, attemptCount: attemptNumber, latestReceiptId: receipt.id, version: run.version + 1, lastEventId: event.id, updatedAt: now }).where(and(eq(eosIntegrationRuns.id, run.id), eq(eosIntegrationRuns.version, run.version))).returning();
  if (!updatedRun) throw new EosRouteError(409, run.state === "dispatching" ? "integration_dispatch_recovery_required" : "integration_run_concurrent_change", run.state === "dispatching" ? "The provider request completed but its EOS run projection changed; reconcile the durable execution record before any retry." : "The run changed before its receipt was recorded.");

  let providerExecution = null;
  if (run.state === "dispatching" && run.providerExecutionId) {
    [providerExecution] = await tx.update(eosProviderExecutions).set({ status: input.outcome === "succeeded" ? "succeeded" : input.outcome, receipt: { integrationReceiptId: receipt.id, externalReference: input.externalReference, responseSha256, receiptSha256, authority: input.authority, outcome: input.outcome }, reconciliationStatus: input.authority === "reconciled" ? "reconciled" : input.outcome === "succeeded" ? "provider_accepted" : "pending_recovery", failureCode: input.outcome === "succeeded" ? null : String(input.responseShape?.code || input.outcome), executedAt: now, reconciledAt: input.authority === "reconciled" ? now : null, updatedAt: now }).where(eq(eosProviderExecutions.id, run.providerExecutionId)).returning();
  }

  const operational = await ensureOperationalState(tx, companyId, binding.id, now); const incidentRequired = input.outcome !== "succeeded"; let incident = null;
  if (incidentRequired) {
    [incident] = await tx.select().from(eosIntegrationIncidents).where(and(eq(eosIntegrationIncidents.runId, run.id), inArray(eosIntegrationIncidents.state, ["open", "acknowledged"]))).orderBy(desc(eosIntegrationIncidents.openedAt)).limit(1);
    if (!incident) { const incidentId = randomUUID(); const severity = state === "dead_letter" ? "critical" : input.outcome === "uncertain" ? "material" : "warning"; const incidentEvent = await appendEvent(tx, { companyId, integrationBindingId: binding.id, eventType: "incident_opened", subjectType: "incident", subjectId: incidentId, versionBefore: 0, versionAfter: 1, evidenceIds: evidence.map((item) => item.id), payload: { runId: run.id, severity, resultingRunState: state }, policyDecisionId: policy.decisionId, recordedByUserId: userId, recordedAt: now }); [incident] = await tx.insert(eosIntegrationIncidents).values({ id: incidentId, companyId, integrationBindingId: binding.id, runId: run.id, severity, state: "open", summary: `${binding.name}: ${input.summary}`, recoveryPlan: binding.failureRecovery || binding.manualFallback, ownerSeatId: binding.recoveryOwnerSeatId, evidenceIds: evidence.map((item) => item.id), version: 1, lastEventId: incidentEvent.id, openedAt: now, updatedAt: now }).returning(); }
  }
  const operationalEvent = await appendEvent(tx, { companyId, integrationBindingId: binding.id, eventType: "receipt_recorded", subjectType: "operational_state", subjectId: binding.id, versionBefore: operational.version, versionAfter: operational.version + 1, evidenceIds: evidence.map((item) => item.id), payload: { outcome: input.outcome, runId: run.id, incidentId: incident?.id || null }, policyDecisionId: policy.decisionId, recordedByUserId: userId, recordedAt: now });
  const [operationalState] = await tx.update(eosIntegrationOperationalStates).set({ consecutiveFailures: input.outcome === "succeeded" ? 0 : operational.consecutiveFailures + 1, lastRunAt: now, lastSuccessAt: input.outcome === "succeeded" ? now : operational.lastSuccessAt, activeIncidentId: incident?.id || operational.activeIncidentId, version: operational.version + 1, lastEventId: operationalEvent.id, updatedAt: now }).where(and(eq(eosIntegrationOperationalStates.integrationBindingId, binding.id), eq(eosIntegrationOperationalStates.version, operational.version))).returning();
  await tx.insert(eosAuditRecords).values(audit(companyId, userId, "integration_operations.receipt.recorded", "integration_run", run.id, state, policy, { eventSha256: event.eventSha256, receiptSha256, authority: input.authority, externalReference: input.externalReference, providerExecutionId: run.state === "dispatching" ? run.providerExecutionId : null }));
  return { run: updatedRun, receipt, incident, operationalState, providerExecution, event };
}

export async function processSignedAdapterWebhook(input: {
  endpointId: string;
  rawBody: Buffer;
  timestampHeader?: string;
  signatureHeader?: string;
  now?: Date;
}) {
  const now = input.now || new Date();
  const endpoint = await db.query.eosIntegrationWebhookEndpoints.findFirst({ where: eq(eosIntegrationWebhookEndpoints.id, input.endpointId) });
  if (!endpoint || endpoint.state !== "active") throw new Error("Adapter webhook endpoint is unavailable.");
  const secrets: Array<{ secret: string; keyVersion: "current" | "previous" }> = [{ secret: decryptCredential(endpoint.secretCiphertext), keyVersion: "current" }];
  if (endpoint.previousSecretCiphertext && endpoint.previousSecretExpiresAt && endpoint.previousSecretExpiresAt > now)
    secrets.push({ secret: decryptCredential(endpoint.previousSecretCiphertext), keyVersion: "previous" });
  const verificationKeyVersion = verifyAdapterWebhook({ rawBody: input.rawBody, timestampHeader: input.timestampHeader, signatureHeader: input.signatureHeader, secrets, nowMs: now.getTime() });
  const parsed = integrationAdapterEventSchema.parse(JSON.parse(input.rawBody.toString("utf8")));
  if (!(endpoint.acceptedEventTypes as string[]).includes(parsed.eventType)) throw new Error("Adapter event type is outside this endpoint's allowlist.");
  const payloadSha256 = createHash("sha256").update(input.rawBody).digest("hex");

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`integration-webhook:${endpoint.id}:${parsed.eventId}`}))`);
    const [duplicate] = await tx.select().from(eosIntegrationWebhookEvents).where(and(eq(eosIntegrationWebhookEvents.endpointId, endpoint.id), eq(eosIntegrationWebhookEvents.providerEventId, parsed.eventId))).limit(1);
    if (duplicate) return { duplicate: true, processingState: duplicate.processingState, providerEventId: duplicate.providerEventId, webhookEventId: duplicate.id, matchedRunId: duplicate.matchedRunId };
    const [binding] = await tx.select().from(eosIntegrationBindings).where(and(eq(eosIntegrationBindings.id, endpoint.integrationBindingId), eq(eosIntegrationBindings.companyId, endpoint.companyId))).limit(1);
    if (!binding) throw new Error("Adapter webhook binding is unavailable.");

    let run: typeof eosIntegrationRuns.$inferSelect | undefined;
    if (parsed.runId) [run] = await tx.select().from(eosIntegrationRuns).where(and(eq(eosIntegrationRuns.id, parsed.runId), eq(eosIntegrationRuns.companyId, endpoint.companyId), eq(eosIntegrationRuns.integrationBindingId, endpoint.integrationBindingId))).limit(1);
    else if (parsed.providerExecutionId) [run] = await tx.select().from(eosIntegrationRuns).where(and(eq(eosIntegrationRuns.providerExecutionId, parsed.providerExecutionId), eq(eosIntegrationRuns.companyId, endpoint.companyId), eq(eosIntegrationRuns.integrationBindingId, endpoint.integrationBindingId))).limit(1);
    else if (parsed.idempotencyKey) [run] = await tx.select().from(eosIntegrationRuns).where(and(eq(eosIntegrationRuns.idempotencyKey, parsed.idempotencyKey), eq(eosIntegrationRuns.companyId, endpoint.companyId), eq(eosIntegrationRuns.integrationBindingId, endpoint.integrationBindingId))).limit(1);
    if (run) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`integration-run:${run.id}`}))`);
      [run] = await tx.select().from(eosIntegrationRuns).where(and(eq(eosIntegrationRuns.id, run.id), eq(eosIntegrationRuns.companyId, endpoint.companyId), eq(eosIntegrationRuns.integrationBindingId, endpoint.integrationBindingId))).limit(1);
    }
    const exactRun = run?.state === "dispatching"
      && parsed.outcome !== "informational"
      && (!parsed.operation || parsed.operation === run.operation)
      && (!parsed.providerExecutionId || parsed.providerExecutionId === run.providerExecutionId)
      ? run : undefined;
    const eventId = randomUUID();
    const eventSha256 = hash({ schemaVersion: "eos-integration-webhook-event.v1", id: eventId, endpointId: endpoint.id, integrationBindingId: endpoint.integrationBindingId, providerEventId: parsed.eventId, eventType: parsed.eventType, outcome: parsed.outcome, externalReference: parsed.externalReference, payloadSha256, verificationKeyVersion, occurredAt: parsed.occurredAt, receivedAt: now.toISOString() });
    const [webhookEvent] = await tx.insert(eosIntegrationWebhookEvents).values({ id: eventId, companyId: endpoint.companyId, endpointId: endpoint.id, integrationBindingId: endpoint.integrationBindingId, providerEventId: parsed.eventId, eventType: parsed.eventType, operation: parsed.operation || null, outcome: parsed.outcome, externalReference: parsed.externalReference, summary: parsed.summary, payloadProjection: parsed, payloadSha256, signatureVersion: "v1", verificationKeyVersion, processingState: "unmatched", matchedRunId: null, receiptId: null, eventSha256, occurredAt: new Date(parsed.occurredAt), receivedAt: now }).returning();
    await tx.update(eosIntegrationWebhookEndpoints).set({ lastInboundEventAt: now, updatedAt: now }).where(eq(eosIntegrationWebhookEndpoints.id, endpoint.id));
    if (!exactRun) return { duplicate: false, processingState: "unmatched", providerEventId: parsed.eventId, webhookEventId: webhookEvent.id, matchedRunId: null };

    const [authorityEvent] = await tx.select().from(eosIntegrationOperationEvents).where(eq(eosIntegrationOperationEvents.id, exactRun.lastEventId!)).limit(1);
    const [execution] = exactRun.providerExecutionId ? await tx.select().from(eosProviderExecutions).where(eq(eosProviderExecutions.id, exactRun.providerExecutionId)).limit(1) : [];
    if (!authorityEvent) throw new Error("The matched integration run has no durable authority event.");
    const workPacketId = execution?.workPacketId || endpoint.controlWorkPacketId;
    const evidenceId = randomUUID();
    const [providerEvidence] = await tx.insert(eosEvidence).values({ id: evidenceId, companyId: endpoint.companyId, workPacketId, recordedByUserId: authorityEvent.recordedByUserId, evidenceType: "provider_receipt", title: `${binding.name} signed adapter event`, evidenceKey: `integration-webhook:${endpoint.id}:${parsed.eventId}`, claimSubjectType: "integration_run", claimSubjectKey: exactRun.id, verificationState: "verified", confidenceQuality: "authoritative", dataClassification: exactRun.classification, sourceSystem: binding.providerKey, producerProviderKey: binding.providerKey, supportedClaimSummary: "The configured adapter signed this bounded event projection; EOS matched it to the exact dispatch claim.", verifierMethod: `hmac-sha256-${verificationKeyVersion}-key`, details: { webhookEventId: webhookEvent.id, providerEventId: parsed.eventId, eventType: parsed.eventType, payloadSha256, externalReference: parsed.externalReference }, relatedEventKeys: [authorityEvent.id], createdAt: now }).returning();
    const policy = { decisionId: authorityEvent.policyDecisionId, traceId: execution?.traceId || `adapter-webhook:${webhookEvent.id}`, correlationId: execution?.correlationId || parsed.eventId } as Policy;
    const result = await recordRunReceipt(tx, { companyId: endpoint.companyId, run: exactRun, binding, input: { outcome: parsed.outcome, authority: "provider_receipt", externalReference: parsed.externalReference, summary: parsed.summary, responseShape: { webhookEventId: webhookEvent.id, providerEventId: parsed.eventId, eventType: parsed.eventType, payloadSha256, data: parsed.data }, evidenceIds: [providerEvidence.id] }, evidence: [providerEvidence], policy, userId: authorityEvent.recordedByUserId, now });
    const [reconciledEvent] = await tx.update(eosIntegrationWebhookEvents).set({ processingState: "reconciled", matchedRunId: exactRun.id, receiptId: result.receipt.id }).where(and(eq(eosIntegrationWebhookEvents.id, webhookEvent.id), eq(eosIntegrationWebhookEvents.processingState, "unmatched"))).returning();
    if (!reconciledEvent) throw new Error("Adapter webhook event changed before reconciliation completed.");
    return { duplicate: false, processingState: "reconciled", providerEventId: parsed.eventId, webhookEventId: webhookEvent.id, matchedRunId: exactRun.id, receiptId: result.receipt.id };
  });
}

export function registerIntegrationOperationsRoutes(app: Express): void {
  app.post("/api/eos/integration-webhooks/:endpointId", adapterWebhookRateLimit, async (req, res) => {
    if (!req.rawBody) return res.status(400).json({ code: "integration_webhook_invalid", message: "A signed raw adapter payload is required." });
    try {
      const result = await processSignedAdapterWebhook({ endpointId: req.params.endpointId, rawBody: req.rawBody, timestampHeader: req.header("x-eos-adapter-timestamp") || undefined, signatureHeader: req.header("x-eos-adapter-signature") || undefined });
      writeLog("info", "integration_adapter_webhook_processed", { endpointId: req.params.endpointId, providerEventId: result.providerEventId, processingState: result.processingState, duplicate: result.duplicate });
      return res.status(result.processingState === "reconciled" || result.duplicate ? 200 : 202).json(result);
    } catch (error) {
      writeLog("warn", "integration_adapter_webhook_rejected", { endpointId: req.params.endpointId, error });
      return res.status(400).json({ code: "integration_webhook_invalid", message: "Adapter webhook could not be verified or processed." });
    }
  });
  app.get("/api/eos/companies/:companyId/integration-operations", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const { access } = await operationsAccess(req, "view", "integration_operations.state.read");
    if (access.company.id !== companyId) throw new EosRouteError(404, "company_not_found", "Company not found in the active principal scope.");
    const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
    const [bindings, manifests, operationalStates, runs, receipts, providerExecutions, incidents, qualifications, cutovers, events, webhookEndpoints, webhookEvents, evidenceRows, seats] = await Promise.all([
      db.select().from(eosIntegrationBindings).where(eq(eosIntegrationBindings.companyId, companyId)).orderBy(desc(eosIntegrationBindings.updatedAt)),
      db.select().from(eosAdapterCapabilityManifests).where(eq(eosAdapterCapabilityManifests.companyId, companyId)).orderBy(desc(eosAdapterCapabilityManifests.recordedAt)),
      db.select().from(eosIntegrationOperationalStates).where(eq(eosIntegrationOperationalStates.companyId, companyId)).orderBy(desc(eosIntegrationOperationalStates.updatedAt)),
      db.select().from(eosIntegrationRuns).where(eq(eosIntegrationRuns.companyId, companyId)).orderBy(desc(eosIntegrationRuns.updatedAt)).limit(500),
      db.select().from(eosIntegrationRunReceipts).where(eq(eosIntegrationRunReceipts.companyId, companyId)).orderBy(desc(eosIntegrationRunReceipts.recordedAt)).limit(1000),
      db.select().from(eosProviderExecutions).where(eq(eosProviderExecutions.companyId, companyId)).orderBy(desc(eosProviderExecutions.createdAt)).limit(1000),
      db.select().from(eosIntegrationIncidents).where(eq(eosIntegrationIncidents.companyId, companyId)).orderBy(desc(eosIntegrationIncidents.updatedAt)).limit(500),
      db.select().from(eosIntegrationQualifications).where(eq(eosIntegrationQualifications.companyId, companyId)).orderBy(desc(eosIntegrationQualifications.recordedAt)).limit(500),
      db.select().from(eosIntegrationCutoverDecisions).where(eq(eosIntegrationCutoverDecisions.companyId, companyId)).orderBy(desc(eosIntegrationCutoverDecisions.decidedAt)).limit(500),
      db.select().from(eosIntegrationOperationEvents).where(eq(eosIntegrationOperationEvents.companyId, companyId)).orderBy(desc(eosIntegrationOperationEvents.recordedAt)).limit(1000),
      db.select().from(eosIntegrationWebhookEndpoints).where(eq(eosIntegrationWebhookEndpoints.companyId, companyId)).orderBy(desc(eosIntegrationWebhookEndpoints.updatedAt)),
      db.select().from(eosIntegrationWebhookEvents).where(eq(eosIntegrationWebhookEvents.companyId, companyId)).orderBy(desc(eosIntegrationWebhookEvents.receivedAt)).limit(1000),
      db.select({ evidence: eosEvidence, packet: eosWorkPackets }).from(eosEvidence).innerJoin(eosWorkPackets, eq(eosWorkPackets.id, eosEvidence.workPacketId)).where(and(eq(eosEvidence.companyId, companyId), eq(eosEvidence.verificationState, "verified"))),
      db.select().from(eosSeats).where(and(eq(eosSeats.companyId, companyId), eq(eosSeats.status, "active"))).orderBy(eosSeats.title),
    ]);
    const visibleBindings = bindings.filter((item) => visible.has(item.ownerSeatId) && mayAccessClassification(access, item.classification)); const bindingIds = new Set(visibleBindings.map((item) => item.id));
    const visibleRuns = runs.filter((item) => bindingIds.has(item.integrationBindingId) && visible.has(item.ownerSeatId) && mayAccessClassification(access, item.classification)); const runIds = new Set(visibleRuns.map((item) => item.id));
    const visibleEvidence = evidenceRows.filter(({ evidence, packet }) => mayAccessClassification(access, evidence.dataClassification) && mayAccessClassification(access, packet.classification) && (access.isOwner || Boolean(packet.accountableSeatId && visible.has(packet.accountableSeatId))));
    res.json({
      generatedAt: new Date().toISOString(), bindings: visibleBindings, manifests: manifests.filter((item) => bindingIds.has(item.integrationBindingId)), operationalStates: operationalStates.filter((item) => bindingIds.has(item.integrationBindingId)), runs: visibleRuns,
      receipts: receipts.filter((item) => runIds.has(item.runId)), providerExecutions: providerExecutions.filter((item) => visibleRuns.some((run) => run.providerExecutionId === item.id || (item.request as any)?.integrationRunId === run.id)).map((item) => ({ ...item, request: { integrationRunId: (item.request as any)?.integrationRunId, requestReference: (item.request as any)?.requestReference, requestSha256: (item.request as any)?.requestSha256, bindingConfigurationVersion: (item.request as any)?.bindingConfigurationVersion, manifestSha256: (item.request as any)?.manifestSha256 } })), incidents: incidents.filter((item) => bindingIds.has(item.integrationBindingId) && visible.has(item.ownerSeatId)), qualifications: qualifications.filter((item) => bindingIds.has(item.integrationBindingId)), cutovers: cutovers.filter((item) => bindingIds.has(item.integrationBindingId)), events: events.filter((item) => bindingIds.has(item.integrationBindingId)),
      webhookEndpoints: webhookEndpoints.filter((item) => bindingIds.has(item.integrationBindingId)).map((item) => webhookEndpointProjection(item, process.env.EOS_PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`)),
      webhookEvents: webhookEvents.filter((item) => bindingIds.has(item.integrationBindingId)).map(({ payloadProjection: _payloadProjection, ...item }) => item),
      evidence: visibleEvidence.map(({ evidence }) => ({ id: evidence.id, title: evidence.title, evidenceType: evidence.evidenceType, dataClassification: evidence.dataClassification })), seats: seats.filter((item) => visible.has(item.id)).map((item) => ({ id: item.id, title: item.title, kind: item.kind })),
      counts: { bindings: visibleBindings.length, frozenContracts: manifests.filter((item) => bindingIds.has(item.integrationBindingId)).length, openRuns: visibleRuns.filter((item) => !terminalRunState(item.state)).length, dispatchingRuns: visibleRuns.filter((item) => item.state === "dispatching").length, failedRuns: visibleRuns.filter((item) => ["failed", "uncertain", "dead_letter"].includes(item.state)).length, openIncidents: incidents.filter((item) => bindingIds.has(item.integrationBindingId) && item.state !== "resolved").length, nativeCutovers: operationalStates.filter((item) => bindingIds.has(item.integrationBindingId) && item.trafficMode === "native").length, activeWebhookEndpoints: webhookEndpoints.filter((item) => bindingIds.has(item.integrationBindingId) && item.state === "active").length, unmatchedWebhookEvents: webhookEvents.filter((item) => bindingIds.has(item.integrationBindingId) && item.processingState === "unmatched").length },
      executionCapability: { enabled: providerExecutionEnabled(), operations: executableAdapterOperations },
      boundary: "EOS dispatches only explicitly allowlisted Gmail and Notion operations after a durable claim and approval. EOS-owned adapter envelopes can reconcile only an exact stranded dispatch claim. Provider-native Notion and Gmail ingress remains a separate observation plane and never completes a run by implication.",
    });
  }));

  app.post("/api/eos/companies/:companyId/integration-operations/bindings/:bindingId/webhook-endpoints", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = integrationWebhookEndpointCreateSchema.parse(req.body); const initial = await companyAccess(req); const binding = await visibleBinding(companyId, req.params.bindingId, initial); const evidence = await verifiedEvidence(companyId, input.evidenceIds, initial); const { policy } = await operationsAccess(req, "decide", "integration_operations.webhook_endpoint.configure", binding.classification);
    if (!credentialEncryptionConfigured()) throw new EosRouteError(503, "integration_webhook_encryption_unavailable", "Configure the EOS credential-encryption key before provisioning an inbound signing secret.");
    const declaredEvents = new Set(Array.isArray(binding.expectedEvents) ? binding.expectedEvents.filter((item): item is string => typeof item === "string") : []);
    if (!declaredEvents.size) throw new EosRouteError(409, "integration_webhook_events_undeclared", "Declare the binding's expected event types before provisioning a signed endpoint.");
    const undeclared = input.acceptedEventTypes.filter((item) => !declaredEvents.has(item));
    if (undeclared.length) throw new EosRouteError(409, "integration_webhook_event_not_declared", `The endpoint cannot accept event types outside the binding contract: ${undeclared.join(", ")}.`);
    const now = new Date(); const id = randomUUID(); const secret = generateAdapterWebhookSecret(); const secretFingerprint = adapterWebhookSecretFingerprint(secret);
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`integration-webhook-binding:${binding.id}`}))`);
      const [existing] = await tx.select().from(eosIntegrationWebhookEndpoints).where(eq(eosIntegrationWebhookEndpoints.integrationBindingId, binding.id)).limit(1);
      if (existing) throw new EosRouteError(409, "integration_webhook_endpoint_exists", "This binding already has a managed endpoint; rotate or change its state instead.");
      const event = await appendEvent(tx, { companyId, integrationBindingId: binding.id, eventType: "webhook_endpoint_configured", subjectType: "webhook_endpoint", subjectId: id, versionBefore: 0, versionAfter: 1, evidenceIds: evidence.map((item) => item.id), payload: { acceptedEventTypes: input.acceptedEventTypes, secretFingerprint }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [endpoint] = await tx.insert(eosIntegrationWebhookEndpoints).values({ id, companyId, integrationBindingId: binding.id, controlWorkPacketId: evidence[0].workPacketId, acceptedEventTypes: input.acceptedEventTypes, state: "active", secretCiphertext: encryptCredential(secret), secretFingerprint, version: 1, lastEventId: event.id, createdByUserId: req.user.id, createdAt: now, updatedAt: now }).returning();
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.webhook_endpoint.configured", "integration_webhook_endpoint", id, "active", policy, { eventSha256: event.eventSha256, secretFingerprint, acceptedEventTypes: input.acceptedEventTypes }));
      return { endpoint, event };
    });
    res.status(201).json({ endpoint: webhookEndpointProjection(result.endpoint, process.env.EOS_PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`), secret, secretDisplay: "one_time", event: result.event });
  }));

  app.post("/api/eos/companies/:companyId/integration-operations/webhook-endpoints/:endpointId/rotate-secret", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = integrationWebhookSecretRotateSchema.parse(req.body); const initial = await companyAccess(req); const endpoint = await visibleWebhookEndpoint(companyId, req.params.endpointId, initial); const binding = await visibleBinding(companyId, endpoint.integrationBindingId, initial); const evidence = await verifiedEvidence(companyId, input.evidenceIds, initial); const { policy } = await operationsAccess(req, "decide", "integration_operations.webhook_endpoint.rotate", binding.classification);
    if (!credentialEncryptionConfigured()) throw new EosRouteError(503, "integration_webhook_encryption_unavailable", "Configure the EOS credential-encryption key before rotating an inbound signing secret.");
    if (endpoint.version !== input.expectedVersion) throw new EosRouteError(409, "integration_webhook_endpoint_conflict", "The endpoint changed; refresh before rotating its signing secret.");
    const now = new Date(); const secret = generateAdapterWebhookSecret(); const secretFingerprint = adapterWebhookSecretFingerprint(secret); const previousSecretExpiresAt = input.gracePeriodMinutes > 0 ? new Date(now.getTime() + input.gracePeriodMinutes * 60_000) : null;
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`integration-webhook-endpoint:${endpoint.id}`}))`);
      const event = await appendEvent(tx, { companyId, integrationBindingId: endpoint.integrationBindingId, eventType: "webhook_secret_rotated", subjectType: "webhook_endpoint", subjectId: endpoint.id, versionBefore: endpoint.version, versionAfter: endpoint.version + 1, evidenceIds: evidence.map((item) => item.id), payload: { previousSecretFingerprint: endpoint.secretFingerprint, secretFingerprint, gracePeriodMinutes: input.gracePeriodMinutes }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [updated] = await tx.update(eosIntegrationWebhookEndpoints).set({ secretCiphertext: encryptCredential(secret), previousSecretCiphertext: previousSecretExpiresAt ? endpoint.secretCiphertext : null, previousSecretExpiresAt, secretFingerprint, version: endpoint.version + 1, lastEventId: event.id, rotatedByUserId: req.user.id, updatedAt: now }).where(and(eq(eosIntegrationWebhookEndpoints.id, endpoint.id), eq(eosIntegrationWebhookEndpoints.version, endpoint.version))).returning();
      if (!updated) throw new EosRouteError(409, "integration_webhook_endpoint_concurrent_change", "The endpoint changed before secret rotation completed.");
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.webhook_endpoint.rotated", "integration_webhook_endpoint", endpoint.id, endpoint.state, policy, { eventSha256: event.eventSha256, previousSecretFingerprint: endpoint.secretFingerprint, secretFingerprint, gracePeriodMinutes: input.gracePeriodMinutes }));
      return { endpoint: updated, event };
    });
    res.json({ endpoint: webhookEndpointProjection(result.endpoint, process.env.EOS_PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`), secret, secretDisplay: "one_time", event: result.event });
  }));

  app.post("/api/eos/companies/:companyId/integration-operations/webhook-endpoints/:endpointId/state", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = integrationWebhookEndpointStateSchema.parse(req.body); const initial = await companyAccess(req); const endpoint = await visibleWebhookEndpoint(companyId, req.params.endpointId, initial); const binding = await visibleBinding(companyId, endpoint.integrationBindingId, initial); const evidence = await verifiedEvidence(companyId, input.evidenceIds, initial); const { policy } = await operationsAccess(req, "decide", "integration_operations.webhook_endpoint.state", binding.classification);
    if (endpoint.version !== input.expectedVersion || endpoint.state === input.state) throw new EosRouteError(409, "integration_webhook_endpoint_state_conflict", "The endpoint changed or is already in the requested state.");
    const now = new Date(); const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`integration-webhook-endpoint:${endpoint.id}`}))`);
      const event = await appendEvent(tx, { companyId, integrationBindingId: endpoint.integrationBindingId, eventType: "webhook_endpoint_state_changed", subjectType: "webhook_endpoint", subjectId: endpoint.id, versionBefore: endpoint.version, versionAfter: endpoint.version + 1, evidenceIds: evidence.map((item) => item.id), payload: { fromState: endpoint.state, toState: input.state }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [updated] = await tx.update(eosIntegrationWebhookEndpoints).set({ state: input.state, version: endpoint.version + 1, lastEventId: event.id, updatedAt: now }).where(and(eq(eosIntegrationWebhookEndpoints.id, endpoint.id), eq(eosIntegrationWebhookEndpoints.version, endpoint.version), eq(eosIntegrationWebhookEndpoints.state, endpoint.state))).returning();
      if (!updated) throw new EosRouteError(409, "integration_webhook_endpoint_concurrent_change", "The endpoint changed before its state transition completed.");
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.webhook_endpoint.state_changed", "integration_webhook_endpoint", endpoint.id, input.state, policy, { eventSha256: event.eventSha256, fromState: endpoint.state, toState: input.state }));
      return { endpoint: updated, event };
    });
    res.json({ endpoint: webhookEndpointProjection(result.endpoint, process.env.EOS_PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`), event: result.event });
  }));

  app.post("/api/eos/companies/:companyId/integration-operations/manifests", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = adapterManifestCreateSchema.parse(req.body); const initial = await companyAccess(req); const binding = await visibleBinding(companyId, input.integrationBindingId, initial); const evidence = await verifiedEvidence(companyId, input.evidenceIds, initial); const { policy } = await operationsAccess(req, "decide", "integration_operations.manifest.freeze", binding.classification);
    if (!Array.isArray(binding.operations) || !binding.operations.length) throw new EosRouteError(409, "adapter_manifest_incomplete", "Freeze at least one configured operation before creating a capability manifest.");
    const now = new Date(); const base = { integrationBindingId: binding.id, bindingConfigurationVersion: binding.configurationVersion, contractVersion: input.contractVersion, operations: binding.operations, expectedEvents: binding.expectedEvents, inputSchemaSha256: hash(binding.inputSchema), outputSchemaSha256: hash(binding.outputSchema), eventSchemaSha256: hash(binding.eventSchema), evidenceIds: evidence.map((item) => item.id) }; const id = randomUUID(); const manifestSha256 = hash({ schemaVersion: "eos-adapter-capability-manifest.v1", id, ...base });
    const result = await db.transaction(async (tx) => { const [manifest] = await tx.insert(eosAdapterCapabilityManifests).values({ id, companyId, ...base, manifestSha256, recordedByUserId: req.user.id, recordedAt: now }).returning(); await ensureOperationalState(tx, companyId, binding.id, now); const event = await appendEvent(tx, { companyId, integrationBindingId: binding.id, eventType: "manifest_frozen", subjectType: "manifest", subjectId: id, versionBefore: 0, versionAfter: 1, evidenceIds: base.evidenceIds, payload: { bindingConfigurationVersion: binding.configurationVersion, contractVersion: input.contractVersion, manifestSha256 }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now }); await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.manifest.frozen", "adapter_manifest", id, "frozen", policy, { eventSha256: event.eventSha256, manifestSha256 })); return { manifest, event }; });
    res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/integration-operations/runs", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = integrationRunCreateSchema.parse(req.body); const initial = await companyAccess(req); const binding = await visibleBinding(companyId, input.integrationBindingId, initial); const visible = await visibleSeatIds(companyId, initial.seat.id, initial.role); if (!visible.has(input.ownerSeatId)) throw new EosRouteError(404, "integration_run_owner_not_found", "Run owner is outside this authority scope."); const { policy } = await operationsAccess(req, "execute", "integration_operations.run.plan", input.classification);
    const [manifest] = await db.select().from(eosAdapterCapabilityManifests).where(and(eq(eosAdapterCapabilityManifests.integrationBindingId, binding.id), eq(eosAdapterCapabilityManifests.bindingConfigurationVersion, binding.configurationVersion))).orderBy(desc(eosAdapterCapabilityManifests.recordedAt)).limit(1);
    if (!manifest) throw new EosRouteError(409, "adapter_manifest_stale", "Freeze the current binding configuration before planning a run.");
    if (!(manifest.operations as unknown[]).includes(input.operation)) throw new EosRouteError(409, "adapter_operation_not_declared", "The requested operation is not declared by the frozen adapter manifest.");
    if (input.automationId) { const automation = await db.query.eosAutomations.findFirst({ where: and(eq(eosAutomations.id, input.automationId), eq(eosAutomations.companyId, companyId), eq(eosAutomations.integrationBindingId, binding.id)) }); if (!automation) throw new EosRouteError(404, "integration_automation_not_found", "Automation not found for this binding."); }
    const now = new Date(); const id = randomUUID(); const requestSha256 = hash({ schemaVersion: "eos-integration-run-request.v1", integrationBindingId: binding.id, manifestSha256: manifest.manifestSha256, operation: input.operation, idempotencyKey: input.idempotencyKey, requestReference: input.requestReference, requestShape: input.requestShape });
    const result = await db.transaction(async (tx) => { const [existing] = await tx.select().from(eosIntegrationRuns).where(and(eq(eosIntegrationRuns.integrationBindingId, binding.id), eq(eosIntegrationRuns.idempotencyKey, input.idempotencyKey))).limit(1); if (existing) { if (existing.requestSha256 !== requestSha256) throw new EosRouteError(409, "integration_run_idempotency_conflict", "This idempotency key already identifies a different request."); return { run: existing, replayed: true, event: null }; } const [run] = await tx.insert(eosIntegrationRuns).values({ id, companyId, integrationBindingId: binding.id, automationId: input.automationId || null, manifestId: manifest.id, operation: input.operation, idempotencyKey: input.idempotencyKey, requestReference: input.requestReference, requestShape: input.requestShape, requestSha256, state: "planned", attemptCount: 0, maxAttempts: input.maxAttempts, ownerSeatId: input.ownerSeatId, classification: input.classification, version: 1, createdByUserId: req.user.id, createdAt: now, updatedAt: now }).returning(); await ensureOperationalState(tx, companyId, binding.id, now); const event = await appendEvent(tx, { companyId, integrationBindingId: binding.id, eventType: "run_planned", subjectType: "run", subjectId: id, versionBefore: 0, versionAfter: 1, evidenceIds: [], payload: { operation: input.operation, requestSha256, manifestSha256: manifest.manifestSha256, externalEffectExecuted: false }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now }); await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.run.planned", "integration_run", id, "planned", policy, { eventSha256: event.eventSha256, externalEffectExecuted: false })); return { run, replayed: false, event }; });
    res.status(result.replayed ? 200 : 201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/integration-operations/runs/:runId/receipts", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = integrationRunReceiptSchema.parse(req.body); const initial = await companyAccess(req); const run = await visibleRun(companyId, req.params.runId, initial); const binding = await visibleBinding(companyId, run.integrationBindingId, initial); const evidence = await verifiedEvidence(companyId, input.evidenceIds, initial); const { policy } = await operationsAccess(req, "execute", "integration_operations.receipt.record", run.classification);
    const reconcilesDispatch = run.state === "dispatching" && input.authority === "reconciled";
    if (input.authority === "provider_observation") throw new EosRouteError(409, "integration_provider_observation_reserved", "Provider observations are written only by the native dispatcher.");
    if (run.version !== input.expectedVersion || (!reconcilesDispatch && !["planned", "retry_ready"].includes(run.state))) throw new EosRouteError(409, "integration_run_receipt_conflict", "Only a current planned or retry-ready run, or an explicitly reconciled stranded dispatch, may receive its next immutable receipt.");
    if (["provider_receipt", "reconciled"].includes(input.authority) && !evidence.some((item) => ["provider_receipt", "delivery_receipt", "deployment_receipt", "communication_receipt", "analytics_receipt"].includes(item.evidenceType))) throw new EosRouteError(409, "integration_provider_receipt_invalid", "Provider-backed outcomes require verified provider or delivery receipt Evidence.");
    const now = new Date();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`integration-run:${run.id}`}))`); const [current] = await tx.select().from(eosIntegrationRuns).where(eq(eosIntegrationRuns.id, run.id)).limit(1); if (!current || current.version !== run.version || current.state !== run.state) throw new EosRouteError(409, "integration_run_concurrent_change", "The run changed before its receipt was recorded.");
      return recordRunReceipt(tx, { companyId, run: current, binding, input, evidence, policy, userId: req.user.id, now });
    }); res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/integration-operations/runs/:runId/execute", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = integrationRunExecuteSchema.parse(req.body); const initial = await companyAccess(req); const run = await visibleRun(companyId, req.params.runId, initial); const binding = await visibleBinding(companyId, run.integrationBindingId, initial); const evidence = await verifiedEvidence(companyId, input.evidenceIds, initial); const { policy } = await operationsAccess(req, "approve", "integration_operations.provider.execute", run.classification);
    if (!providerExecutionEnabled()) throw new EosRouteError(409, "integration_provider_effects_disabled", "Allowlisted provider effects are disabled for this deployment.");
    if (run.version !== input.expectedVersion || !["planned", "retry_ready"].includes(run.state)) throw new EosRouteError(409, "integration_dispatch_conflict", "Only a current planned or retry-ready run may be dispatched.");
    if (!adapterOperationIsExecutable(run.operation) || !providerMatchesOperation(binding.providerKey, run.operation)) throw new EosRouteError(409, "integration_dispatch_unsupported", "This binding and operation do not map to an audited native dispatcher.");
    try { validateAdapterOperationRequest(run.operation, run.requestShape); } catch (error) { throw new EosRouteError(409, "integration_dispatch_request_invalid", error instanceof Error ? error.message : "The adapter request is invalid."); }
    if (binding.lifecycleState !== "active" || binding.connectionState !== "connected") throw new EosRouteError(409, "integration_binding_not_execution_ready", "Provider execution requires an active, connected integration binding.");
    const manifest = await db.query.eosAdapterCapabilityManifests.findFirst({ where: eq(eosAdapterCapabilityManifests.id, run.manifestId) });
    if (!manifest || manifest.bindingConfigurationVersion !== binding.configurationVersion) throw new EosRouteError(409, "integration_dispatch_manifest_stale", "The run no longer references the current frozen binding configuration.");
    const now = new Date(); const operational = await db.query.eosIntegrationOperationalStates.findFirst({ where: eq(eosIntegrationOperationalStates.integrationBindingId, binding.id) });
    if (!operational || operational.trafficMode !== "provider") throw new EosRouteError(409, "integration_dispatch_traffic_blocked", "Provider dispatch is allowed only while provider traffic mode is active.");
    // Approval and provider credential ownership are separate principals. A
    // manager may approve a founder-owned run, but must never cause EOS to
    // send through the manager's personal OAuth connection by accident.
    const runOwnerSeat = await db.query.eosSeats.findFirst({
      where: and(eq(eosSeats.id, run.ownerSeatId), eq(eosSeats.companyId, companyId)),
    });
    const bindingOwnerSeat = runOwnerSeat?.occupantUserId
      ? null
      : await db.query.eosSeats.findFirst({
        where: and(eq(eosSeats.id, binding.ownerSeatId), eq(eosSeats.companyId, companyId)),
      });
    const credentialOwnerUserId = runOwnerSeat?.occupantUserId
      || bindingOwnerSeat?.occupantUserId
      || req.user.id;
    const executionId = randomUUID(); const executionKey = `${run.idempotencyKey}:attempt:${run.attemptCount + 1}`;
    const claimed = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`integration-run:${run.id}`}))`);
      const [current] = await tx.select().from(eosIntegrationRuns).where(eq(eosIntegrationRuns.id, run.id)).limit(1);
      if (!current || current.version !== run.version || current.state !== run.state) throw new EosRouteError(409, "integration_run_concurrent_change", "The run changed before provider dispatch could be claimed.");
      const [providerExecution] = await tx.insert(eosProviderExecutions).values({ id: executionId, companyId, workPacketId: evidence[0].workPacketId, approvalId: null, requestedByUserId: req.user.id, provider: binding.providerKey, operation: run.operation, idempotencyKey: executionKey, status: "executing", request: { integrationRunId: run.id, requestReference: run.requestReference, requestSha256: run.requestSha256, requestShape: run.requestShape, bindingConfigurationVersion: binding.configurationVersion, manifestSha256: manifest.manifestSha256, credentialOwnerUserId }, receipt: {}, reconciliationStatus: "pending", failureCode: null, traceId: policy.traceId, correlationId: policy.correlationId, createdAt: now, updatedAt: now }).returning();
      const event = await appendEvent(tx, { companyId, integrationBindingId: binding.id, eventType: "dispatch_claimed", subjectType: "run", subjectId: run.id, versionBefore: run.version, versionAfter: run.version + 1, evidenceIds: evidence.map((item) => item.id), payload: { providerExecutionId: executionId, operation: run.operation, executionKey, externalEffectExecuted: false }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [claimedRun] = await tx.update(eosIntegrationRuns).set({ state: "dispatching", providerExecutionId: executionId, version: run.version + 1, lastEventId: event.id, updatedAt: now }).where(and(eq(eosIntegrationRuns.id, run.id), eq(eosIntegrationRuns.version, run.version))).returning();
      if (!claimedRun) throw new EosRouteError(409, "integration_run_concurrent_change", "The run changed before provider dispatch could be claimed.");
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.provider.claimed", "integration_run", run.id, "dispatching", policy, { eventSha256: event.eventSha256, providerExecutionId: executionId, externalEffectExecuted: false }));
      return { run: claimedRun, providerExecution };
    });

    const startedAt = Date.now(); let dispatchResult: Awaited<ReturnType<typeof dispatchAllowlistedAdapterOperation>> | null = null; let dispatchError: AdapterDispatchError | null = null;
    try { dispatchResult = await dispatchAllowlistedAdapterOperation({ userId: credentialOwnerUserId, providerKey: binding.providerKey, operation: run.operation, requestShape: run.requestShape }); }
    catch (error) { dispatchError = error instanceof AdapterDispatchError ? error : new AdapterDispatchError("provider_outcome_uncertain", error instanceof Error ? error.message : "Provider outcome is uncertain.", "uncertain"); }
    const completedAt = new Date(); const outcome = dispatchResult ? "succeeded" : dispatchError!.outcome; const authority = dispatchResult ? dispatchResult.authority : "provider_observation"; const externalReference = dispatchResult?.externalReference || `provider-execution:${executionId}`; const summary = dispatchResult?.summary || dispatchError!.message; const responseShape = dispatchResult?.responseShape || { code: dispatchError!.code, outcomeBoundary: dispatchError!.outcome, providerReferenceObserved: false };
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`integration-run:${run.id}`}))`);
      const [current] = await tx.select().from(eosIntegrationRuns).where(eq(eosIntegrationRuns.id, run.id)).limit(1);
      if (!current || current.state !== "dispatching" || current.providerExecutionId !== executionId || current.version !== claimed.run.version) throw new EosRouteError(409, "integration_dispatch_recovery_required", "The provider request completed but its EOS run projection changed; reconcile the durable execution record before any retry.");
      const evidenceId = randomUUID();
      const [providerEvidence] = await tx.insert(eosEvidence).values({ id: evidenceId, companyId, workPacketId: evidence[0].workPacketId, recordedByUserId: req.user.id, evidenceType: dispatchResult ? "provider_receipt" : "integration_execution_observation", title: dispatchResult ? `${binding.name} provider execution receipt` : `${binding.name} provider execution observation`, evidenceKey: `integration-dispatch:${executionId}`, claimSubjectType: "integration_run", claimSubjectKey: run.id, verificationState: "verified", confidenceQuality: dispatchResult ? "authoritative" : "bounded", dataClassification: run.classification, sourceSystem: binding.providerKey, producerProviderKey: binding.providerKey, supportedClaimSummary: dispatchResult ? "The allowlisted provider operation returned a durable provider reference." : "EOS observed a failed or uncertain provider dispatch; it does not claim the external effect completed.", verifierMethod: "Native allowlisted dispatcher recorded the bounded provider client result.", details: { providerExecutionId: executionId, operation: run.operation, outcome, authority, externalReference, responseShape }, relatedEventKeys: [claimed.run.lastEventId], createdAt: completedAt }).returning();
      return recordRunReceipt(tx, { companyId, run: current, binding, input: { outcome, authority, externalReference, summary, responseShape, latencyMs: Date.now() - startedAt, evidenceIds: [providerEvidence.id] }, evidence: [providerEvidence], policy, userId: req.user.id, now: completedAt });
    });
    res.status(dispatchResult ? 201 : dispatchError?.outcome === "uncertain" ? 202 : 201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/integration-operations/runs/:runId/retries", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = integrationRetrySchema.parse(req.body); const initial = await companyAccess(req); const run = await visibleRun(companyId, req.params.runId, initial); const evidence = await verifiedEvidence(companyId, input.evidenceIds, initial); const { policy } = await operationsAccess(req, "decide", "integration_operations.run.retry", run.classification);
    if (run.version !== input.expectedVersion || !["failed", "uncertain"].includes(run.state) || run.attemptCount >= run.maxAttempts) throw new EosRouteError(409, "integration_retry_invalid", "Only a current failed or uncertain run below its attempt limit may be retried.");
    if (run.state === "uncertain" && run.providerExecutionId && !evidence.some((item) => ["provider_receipt", "delivery_receipt", "communication_receipt"].includes(item.evidenceType))) throw new EosRouteError(409, "integration_uncertain_retry_unreconciled", "An uncertain provider mutation requires verified provider reconciliation Evidence before another attempt can be authorized.");
    const now = new Date(); const event = await db.transaction(async (tx) => { const created = await appendEvent(tx, { companyId, integrationBindingId: run.integrationBindingId, eventType: "retry_authorized", subjectType: "run", subjectId: run.id, versionBefore: run.version, versionAfter: run.version + 1, evidenceIds: evidence.map((item) => item.id), payload: { rationale: input.rationale, nextAttempt: run.attemptCount + 1 }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now }); const [updated] = await tx.update(eosIntegrationRuns).set({ state: "retry_ready", version: run.version + 1, lastEventId: created.id, updatedAt: now }).where(and(eq(eosIntegrationRuns.id, run.id), eq(eosIntegrationRuns.version, run.version))).returning(); if (!updated) throw new EosRouteError(409, "integration_run_concurrent_change", "The run changed before retry authorization completed."); await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.retry.authorized", "integration_run", run.id, "retry_ready", policy, { eventSha256: created.eventSha256 })); return { run: updated, event: created }; }); res.status(201).json(event);
  }));

  app.post("/api/eos/companies/:companyId/integration-operations/incidents/:incidentId/transitions", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = integrationIncidentTransitionSchema.parse(req.body); const initial = await companyAccess(req); const incident = await visibleIncident(companyId, req.params.incidentId, initial); const evidence = await verifiedEvidence(companyId, input.evidenceIds, initial); const { policy } = await operationsAccess(req, "decide", `integration_operations.incident.${input.state}`);
    const allowed = incident.state === "open" ? ["acknowledged", "resolved"] : incident.state === "acknowledged" ? ["resolved"] : []; if (incident.version !== input.expectedVersion || !allowed.includes(input.state)) throw new EosRouteError(409, "integration_incident_transition_invalid", `Incident cannot move from ${incident.state} to ${input.state}.`); const now = new Date();
    const result = await db.transaction(async (tx) => {
      const event = await appendEvent(tx, { companyId, integrationBindingId: incident.integrationBindingId, eventType: input.state === "resolved" ? "incident_resolved" : "incident_acknowledged", subjectType: "incident", subjectId: incident.id, versionBefore: incident.version, versionAfter: incident.version + 1, evidenceIds: evidence.map((item) => item.id), payload: { fromState: incident.state, toState: input.state, rationale: input.rationale }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
      const [updated] = await tx.update(eosIntegrationIncidents).set({ state: input.state, resolution: input.state === "resolved" ? input.rationale : incident.resolution, evidenceIds: Array.from(new Set([...(incident.evidenceIds as string[]), ...evidence.map((item) => item.id)])), resolvedAt: input.state === "resolved" ? now : null, version: incident.version + 1, lastEventId: event.id, updatedAt: now }).where(and(eq(eosIntegrationIncidents.id, incident.id), eq(eosIntegrationIncidents.version, incident.version))).returning();
      if (!updated) throw new EosRouteError(409, "integration_incident_concurrent_change", "The incident changed before this transition completed.");

      let operationalState = null;
      if (input.state === "resolved") {
        const state = await ensureOperationalState(tx, companyId, incident.integrationBindingId, now);
        if (state.activeIncidentId === incident.id) {
          const operationalEvent = await appendEvent(tx, { companyId, integrationBindingId: incident.integrationBindingId, eventType: "incident_resolved", subjectType: "operational_state", subjectId: incident.integrationBindingId, versionBefore: state.version, versionAfter: state.version + 1, evidenceIds: evidence.map((item) => item.id), payload: { incidentId: incident.id, activeIncidentCleared: true }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now });
          [operationalState] = await tx.update(eosIntegrationOperationalStates).set({ activeIncidentId: null, version: state.version + 1, lastEventId: operationalEvent.id, updatedAt: now }).where(and(eq(eosIntegrationOperationalStates.integrationBindingId, incident.integrationBindingId), eq(eosIntegrationOperationalStates.version, state.version), eq(eosIntegrationOperationalStates.activeIncidentId, incident.id))).returning();
          if (!operationalState) throw new EosRouteError(409, "integration_operational_concurrent_change", "Operational state changed before incident resolution completed.");
        }
      }

      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, `integration_operations.incident.${input.state}`, "integration_incident", incident.id, input.state, policy, { eventSha256: event.eventSha256, activeIncidentCleared: Boolean(operationalState) }));
      return { incident: updated, operationalState, event };
    }); res.json(result);
  }));

  app.post("/api/eos/companies/:companyId/integration-operations/bindings/:bindingId/fallback", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = integrationFallbackSchema.parse(req.body); const initial = await companyAccess(req); const binding = await visibleBinding(companyId, req.params.bindingId, initial); const evidence = await verifiedEvidence(companyId, input.evidenceIds, initial); const { policy } = await operationsAccess(req, "decide", "integration_operations.fallback.change", binding.classification); const now = new Date();
    const result = await db.transaction(async (tx) => { const state = await ensureOperationalState(tx, companyId, binding.id, now); if (state.version !== input.expectedVersion || state.trafficMode === input.trafficMode) throw new EosRouteError(409, "integration_fallback_conflict", "Refresh the current operational state before changing fallback mode."); if (input.trafficMode === "provider" && !state.lastSuccessAt) throw new EosRouteError(409, "integration_provider_restore_unqualified", "Record a successful provider-backed or reconciled run before restoring provider traffic."); const event = await appendEvent(tx, { companyId, integrationBindingId: binding.id, eventType: "fallback_changed", subjectType: "operational_state", subjectId: binding.id, versionBefore: state.version, versionAfter: state.version + 1, evidenceIds: evidence.map((item) => item.id), payload: { fromMode: state.trafficMode, toMode: input.trafficMode, rationale: input.rationale }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now }); const [updated] = await tx.update(eosIntegrationOperationalStates).set({ trafficMode: input.trafficMode, version: state.version + 1, lastEventId: event.id, updatedAt: now }).where(and(eq(eosIntegrationOperationalStates.integrationBindingId, binding.id), eq(eosIntegrationOperationalStates.version, state.version))).returning(); if (!updated) throw new EosRouteError(409, "integration_operational_concurrent_change", "Operational state changed before fallback transition completed."); await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.fallback.changed", "integration_binding", binding.id, input.trafficMode, policy, { eventSha256: event.eventSha256 })); return { operationalState: updated, event }; }); res.json(result);
  }));

  app.post("/api/eos/companies/:companyId/integration-operations/qualifications", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = integrationQualificationSchema.parse(req.body); const initial = await companyAccess(req); const binding = await visibleBinding(companyId, input.integrationBindingId, initial); const evidence = await verifiedEvidence(companyId, input.evidenceIds, initial); const { policy } = await operationsAccess(req, "decide", "integration_operations.qualification.record", binding.classification);
    const manifest = await db.query.eosAdapterCapabilityManifests.findFirst({ where: and(eq(eosAdapterCapabilityManifests.id, input.manifestId), eq(eosAdapterCapabilityManifests.companyId, companyId), eq(eosAdapterCapabilityManifests.integrationBindingId, binding.id)) }); if (!manifest || manifest.bindingConfigurationVersion !== binding.configurationVersion) throw new EosRouteError(409, "integration_qualification_manifest_stale", "Qualification must reference the current frozen adapter manifest."); const declared = new Set(manifest.operations as string[]); if (input.testedOperations.some((item: string) => !declared.has(item))) throw new EosRouteError(409, "integration_qualification_operation_invalid", "Qualification includes an operation absent from the manifest.");
    const successfulReceipts = await db.select({ run: eosIntegrationRuns, receipt: eosIntegrationRunReceipts }).from(eosIntegrationRuns).innerJoin(eosIntegrationRunReceipts, eq(eosIntegrationRunReceipts.runId, eosIntegrationRuns.id)).where(and(eq(eosIntegrationRuns.integrationBindingId, binding.id), eq(eosIntegrationRunReceipts.outcome, "succeeded"), inArray(eosIntegrationRunReceipts.authority, ["provider_receipt", "reconciled"]))); const proven = new Set(successfulReceipts.map(({ run }) => run.operation)); const unproven = input.testedOperations.filter((item: string) => !proven.has(item)); if (input.outcome === "passing" && (input.missingCapabilities.length || !input.rollbackValidated || input.environment === "fixture" || unproven.length)) throw new EosRouteError(409, "integration_qualification_incomplete", `Passing qualification requires no missing capabilities, a validated rollback, a non-fixture environment, and successful provider-backed receipts for every tested operation${unproven.length ? `; unproven: ${unproven.join(", ")}` : ""}.`);
    const now = new Date(); const id = randomUUID(); const base = { integrationBindingId: binding.id, manifestId: manifest.id, qualificationKey: input.qualificationKey, environment: input.environment, outcome: input.outcome, testedOperations: input.testedOperations, missingCapabilities: input.missingCapabilities, testSummary: input.testSummary, rollbackValidated: input.rollbackValidated, evidenceIds: evidence.map((item) => item.id) }; const qualificationSha256 = hash({ schemaVersion: "eos-integration-qualification.v1", id, manifestSha256: manifest.manifestSha256, ...base });
    const result = await db.transaction(async (tx) => { const [qualification] = await tx.insert(eosIntegrationQualifications).values({ id, companyId, ...base, qualificationSha256, recordedByUserId: req.user.id, recordedAt: now }).returning(); const state = await ensureOperationalState(tx, companyId, binding.id, now); const event = await appendEvent(tx, { companyId, integrationBindingId: binding.id, eventType: "qualification_recorded", subjectType: "operational_state", subjectId: binding.id, versionBefore: state.version, versionAfter: state.version + 1, evidenceIds: base.evidenceIds, payload: { qualificationId: id, outcome: input.outcome, environment: input.environment, qualificationSha256 }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now }); const [operationalState] = await tx.update(eosIntegrationOperationalStates).set({ currentQualificationId: id, version: state.version + 1, lastEventId: event.id, updatedAt: now }).where(and(eq(eosIntegrationOperationalStates.integrationBindingId, binding.id), eq(eosIntegrationOperationalStates.version, state.version))).returning(); await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.qualification.recorded", "integration_qualification", id, input.outcome, policy, { eventSha256: event.eventSha256, qualificationSha256 })); return { qualification, operationalState, event }; }); res.status(201).json(result);
  }));

  app.post("/api/eos/companies/:companyId/integration-operations/bindings/:bindingId/cutovers", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = integrationCutoverSchema.parse(req.body); const initial = await companyAccess(req); const binding = await visibleBinding(companyId, req.params.bindingId, initial); const evidence = await verifiedEvidence(companyId, input.evidenceIds, initial); const { policy } = await operationsAccess(req, "approve", "integration_operations.cutover.decide", binding.classification);
    const qualification = await db.query.eosIntegrationQualifications.findFirst({ where: and(eq(eosIntegrationQualifications.id, input.qualificationId), eq(eosIntegrationQualifications.companyId, companyId), eq(eosIntegrationQualifications.integrationBindingId, binding.id)) }); if (!qualification) throw new EosRouteError(404, "integration_qualification_not_found", "Qualification not found for this binding."); const manifest = await db.query.eosAdapterCapabilityManifests.findFirst({ where: eq(eosAdapterCapabilityManifests.id, qualification.manifestId) });
    if (input.decision === "approve_native") { const declared = new Set((manifest?.operations || []) as string[]); const tested = new Set(qualification.testedOperations as string[]); const untested = Array.from(declared).filter((item) => !tested.has(item)); if (!manifest || manifest.bindingConfigurationVersion !== binding.configurationVersion || qualification.outcome !== "passing" || !qualification.rollbackValidated || qualification.environment === "fixture" || untested.length) throw new EosRouteError(409, "integration_native_cutover_unqualified", `Native cutover requires the current manifest, passing non-fixture qualification, rollback validation, and complete operation coverage${untested.length ? `; untested: ${untested.join(", ")}` : ""}.`); }
    const now = new Date(); const id = randomUUID(); const decisionSha256 = hash({ schemaVersion: "eos-integration-cutover-decision.v1", id, integrationBindingId: binding.id, qualificationSha256: qualification.qualificationSha256, decision: input.decision, rationale: input.rationale, evidenceIds: evidence.map((item) => item.id), decidedAt: now.toISOString() });
    const result = await db.transaction(async (tx) => { const state = await ensureOperationalState(tx, companyId, binding.id, now); if (state.version !== input.expectedOperationalVersion || state.currentQualificationId !== qualification.id) throw new EosRouteError(409, "integration_cutover_state_conflict", "The operational state or current qualification changed; refresh before deciding cutover."); const trafficMode = input.decision === "approve_native" ? "native" : "provider"; const event = await appendEvent(tx, { companyId, integrationBindingId: binding.id, eventType: "cutover_decided", subjectType: "operational_state", subjectId: binding.id, versionBefore: state.version, versionAfter: state.version + 1, evidenceIds: evidence.map((item) => item.id), payload: { decision: input.decision, fromMode: state.trafficMode, toMode: trafficMode, qualificationId: qualification.id, decisionSha256 }, policyDecisionId: policy.decisionId, recordedByUserId: req.user.id, recordedAt: now }); const [decision] = await tx.insert(eosIntegrationCutoverDecisions).values({ id, companyId, integrationBindingId: binding.id, qualificationId: qualification.id, decision: input.decision, rationale: input.rationale, evidenceIds: evidence.map((item) => item.id), decisionSha256, policyDecisionId: policy.decisionId, decidedByUserId: req.user.id, decidedAt: now }).returning(); const [operationalState] = await tx.update(eosIntegrationOperationalStates).set({ trafficMode, version: state.version + 1, lastEventId: event.id, updatedAt: now }).where(and(eq(eosIntegrationOperationalStates.integrationBindingId, binding.id), eq(eosIntegrationOperationalStates.version, state.version))).returning(); await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.cutover.decided", "integration_binding", binding.id, input.decision, policy, { eventSha256: event.eventSha256, decisionSha256 })); return { decision, operationalState, event }; }); res.status(201).json(result);
  }));
}
