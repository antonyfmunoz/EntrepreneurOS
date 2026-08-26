import { randomBytes, randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ZodError } from "zod";
import {
  eosAuditRecords, eosEvidence, eosIntegrationBindings, eosIntegrationOperationEvents,
  eosProviderIngressAlertAcknowledgements, eosProviderIngressAlertDeliveryAttempts, eosProviderIngressEvents, eosProviderIngressPolicies, eosProviderIngressReconciliationAttempts, eosProviderIngressRegistrations,
  eosProviderIngressWatchAttempts, eosProviderResourceSnapshots, eosWorkPackets, notifications,
} from "@shared/schema";
import { gmailWatchStartSchema, googleChannelStartSchema, providerExecutionEnabled, providerIngressAlertAcknowledgeSchema, providerIngressAlertReplaySchema, providerIngressConfigurationRotateSchema, providerIngressPolicyUpdateSchema, providerIngressRegistrationCreateSchema, providerIngressReplaySchema, providerIngressStateSchema, providerIngressTokenRevealSchema } from "@shared/integration-operations";
import { allowedSurfacesFor } from "@shared/eos-runtime";
import { db } from "../db";
import { nativeContractContentSha256 } from "../esign/template-generation";
import { getDriveStartPageToken, startCalendarWatch, startDriveChangesWatch, startMailboxWatch, stopGoogleChannel, stopMailboxWatch, verifyPubSubOidcToken } from "../integrations/gmail";
import { notionTokenFingerprint, parseNotionVerification, sha256, translateGmailPush, translateGoogleChannel, translateNotionEvent, verifyGoogleChannelToken, verifyNotionSignature } from "../integrations/provider-ingress";
import { reconcileProviderIngressEventOnce } from "../integrations/provider-ingress-worker";
import { providerIngressHealthSnapshot } from "../integrations/provider-ingress-health";
import { dispatchProviderIngressAlertOnce, providerIngressAlertKey } from "../integrations/provider-ingress-alerts";
import { decryptCredential, encryptCredential } from "../security/credential-encryption";
import { fixedWindowRateLimit } from "../middleware/rate-limit";
import { operationalAlertsConfigured } from "../observability/alerts";
import { EosRouteError, authorizeAction, companyAccess, mayAccessClassification, visibleSeatIds } from "./eos-runtime";

type Access = Awaited<ReturnType<typeof companyAccess>>;
type Policy = Awaited<ReturnType<typeof authorizeAction>>;
const inboundLimit = fixedWindowRateLimit({ limit: 240, windowMs: 60_000, namespace: "provider-native-ingress" });

function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: (error?: unknown) => void) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof EosRouteError) return res.status(error.status).json({ code: error.code, message: error.message });
      if (error instanceof ZodError) return res.status(400).json({ code: "provider_ingress_input_invalid", message: error.issues[0]?.message || "Provider-ingress input is invalid." });
      next(error);
    }
  };
}

type NativeProvider = "notion" | "gmail" | "google_drive" | "google_calendar";

function bindingSupportsProvider(value: string, provider: NativeProvider): boolean {
  const key = value.toLowerCase().replaceAll("-", "_");
  if (key.includes("notion")) return provider === "notion";
  if (key.includes("gmail")) return provider === "gmail";
  if (key.includes("google_workspace") || key === "google" || key.includes("google_drive")) return ["gmail", "google_drive", "google_calendar"].includes(provider);
  return false;
}

async function accessFor(req: Request, authorityClass: "view" | "decide" | "approve", actionKey: string, classification = "restricted") {
  const access = await companyAccess(req);
  if (!allowedSurfacesFor(access.role).includes("systems")) throw new EosRouteError(403, "provider_ingress_scope_denied", "Provider ingress is outside this role's compiled Systems workspace.");
  const policy = await authorizeAction(req, access, { authorityClass, resource: "integration_binding", actionKey, purpose: authorityClass === "view" ? "inspect_provider_ingress" : "govern_provider_ingress", classification, consequence: authorityClass === "view" ? "routine" : "material", targetSeatId: access.seat.id });
  return { access, policy };
}

async function bindingFor(companyId: number, bindingId: string, access: Access) {
  const binding = await db.query.eosIntegrationBindings.findFirst({ where: and(eq(eosIntegrationBindings.id, bindingId), eq(eosIntegrationBindings.companyId, companyId)) });
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  if (!binding || !visible.has(binding.ownerSeatId) || !mayAccessClassification(access, binding.classification)) throw new EosRouteError(404, "integration_binding_not_found", "Integration binding not found in this authority scope.");
  return binding;
}

async function evidenceFor(companyId: number, ids: string[], access: Access) {
  const unique = Array.from(new Set(ids));
  if (!unique.length || unique.length !== ids.length) throw new EosRouteError(409, "provider_ingress_evidence_invalid", "Evidence references must be unique and non-empty.");
  const visible = await visibleSeatIds(companyId, access.seat.id, access.role);
  const rows = await db.select({ evidence: eosEvidence, packet: eosWorkPackets }).from(eosEvidence).innerJoin(eosWorkPackets, eq(eosWorkPackets.id, eosEvidence.workPacketId)).where(and(eq(eosEvidence.companyId, companyId), inArray(eosEvidence.id, unique)));
  const allowed = rows.filter(({ evidence, packet }) => evidence.verificationState === "verified" && mayAccessClassification(access, evidence.dataClassification) && mayAccessClassification(access, packet.classification) && (access.isOwner || Boolean(packet.accountableSeatId && visible.has(packet.accountableSeatId))));
  if (allowed.length !== unique.length) throw new EosRouteError(409, "provider_ingress_evidence_invalid", "Every Evidence item must be verified and visible in this authority scope.");
  return allowed.map(({ evidence }) => evidence);
}

async function registrationFor(companyId: number, registrationId: string, access: Access) {
  const registration = await db.query.eosProviderIngressRegistrations.findFirst({ where: and(eq(eosProviderIngressRegistrations.id, registrationId), eq(eosProviderIngressRegistrations.companyId, companyId)) });
  if (!registration) throw new EosRouteError(404, "provider_ingress_not_found", "Provider ingress registration not found in this authority scope.");
  await bindingFor(companyId, registration.integrationBindingId, access);
  return registration;
}

function projection(registration: typeof eosProviderIngressRegistrations.$inferSelect, origin?: string) {
  const endpointPath = `/api/eos/provider-ingress/${registration.provider}/${registration.id}`;
  let endpointUrl: string | null = null;
  try { if (origin) endpointUrl = new URL(endpointPath, origin).toString(); } catch { endpointUrl = null; }
  const { verificationTokenCiphertext: _secret, ...safe } = registration;
  return { ...safe, verificationTokenAvailable: Boolean(registration.verificationTokenCiphertext), endpointPath, endpointUrl };
}

async function appendControlEvent(tx: any, registration: typeof eosProviderIngressRegistrations.$inferSelect, policy: Policy, userId: string, eventType: string, versionAfter: number, evidenceIds: string[], payload: Record<string, unknown>, versionBefore = registration.version) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`integration-operation-chain:${registration.integrationBindingId}`}))`);
  const [previous] = await tx.select().from(eosIntegrationOperationEvents).where(eq(eosIntegrationOperationEvents.integrationBindingId, registration.integrationBindingId)).orderBy(desc(eosIntegrationOperationEvents.recordedAt), desc(eosIntegrationOperationEvents.id)).limit(1);
  const id = randomUUID(); const recordedAt = new Date(); const previousEventSha256 = previous?.eventSha256 || "";
  const eventSha256 = nativeContractContentSha256({ schemaVersion: "eos-integration-operation-event.v1", id, companyId: registration.companyId, integrationBindingId: registration.integrationBindingId, eventType, subjectType: "provider_ingress", subjectId: registration.id, versionBefore, versionAfter, evidenceIds, payload, policyDecisionId: policy.decisionId, recordedByUserId: userId, recordedAt: recordedAt.toISOString(), previousEventSha256 });
  const [event] = await tx.insert(eosIntegrationOperationEvents).values({ id, companyId: registration.companyId, integrationBindingId: registration.integrationBindingId, eventType, subjectType: "provider_ingress", subjectId: registration.id, versionBefore, versionAfter, evidenceIds, payload, policyDecisionId: policy.decisionId, previousEventSha256, eventSha256, recordedByUserId: userId, recordedAt }).returning();
  return event;
}

function audit(companyId: number, userId: string, action: string, targetId: string, policy: Policy, details: Record<string, unknown>) {
  return { id: randomUUID(), companyId, actorUserId: userId, action, targetType: "provider_ingress", targetId, traceId: policy.traceId, correlationId: policy.correlationId, result: "success", details: { ...details, policyDecisionId: policy.decisionId }, createdAt: new Date() };
}

async function storeProviderEvent(registration: typeof eosProviderIngressRegistrations.$inferSelect, translated: { providerEventId: string; eventType: string; providerObjectReference: string; occurredAt: Date; projection: Record<string, unknown> }, verificationMethod: string, processingState: string) {
  const [existing] = await db.select().from(eosProviderIngressEvents).where(and(eq(eosProviderIngressEvents.registrationId, registration.id), eq(eosProviderIngressEvents.providerEventId, translated.providerEventId))).limit(1);
  if (existing) return { event: existing, duplicate: true };
  const id = randomUUID(); const receivedAt = new Date(); const payloadSha256 = nativeContractContentSha256(translated.projection);
  const eventSha256 = nativeContractContentSha256({ schemaVersion: "eos-provider-ingress-event.v1", id, registrationId: registration.id, integrationBindingId: registration.integrationBindingId, provider: registration.provider, providerEventId: translated.providerEventId, eventType: translated.eventType, providerObjectReference: translated.providerObjectReference, verificationMethod, processingState, payloadSha256, occurredAt: translated.occurredAt.toISOString(), receivedAt: receivedAt.toISOString() });
  return db.transaction(async (tx) => {
    const [event] = await tx.insert(eosProviderIngressEvents).values({ id, companyId: registration.companyId, registrationId: registration.id, integrationBindingId: registration.integrationBindingId, provider: registration.provider, providerEventId: translated.providerEventId, eventType: translated.eventType, providerObjectReference: translated.providerObjectReference, verificationMethod, processingState, payloadProjection: translated.projection, payloadSha256, eventSha256, occurredAt: translated.occurredAt, receivedAt }).onConflictDoNothing().returning();
    if (!event) {
      const [duplicate] = await tx.select().from(eosProviderIngressEvents).where(and(eq(eosProviderIngressEvents.registrationId, registration.id), eq(eosProviderIngressEvents.providerEventId, translated.providerEventId))).limit(1);
      return { event: duplicate, duplicate: true };
    }
    await tx.update(eosProviderIngressRegistrations).set({ state: "active", version: registration.state === "pending_verification" ? registration.version + 1 : registration.version, lastInboundEventAt: receivedAt, updatedAt: receivedAt }).where(and(eq(eosProviderIngressRegistrations.id, registration.id), eq(eosProviderIngressRegistrations.version, registration.version)));
    return { event, duplicate: false };
  });
}

async function currentHealthFor(registration: typeof eosProviderIngressRegistrations.$inferSelect) {
  const [events, reconciliationAttempts, watchAttempts, policies] = await Promise.all([
    db.select().from(eosProviderIngressEvents).where(eq(eosProviderIngressEvents.registrationId, registration.id)).orderBy(desc(eosProviderIngressEvents.receivedAt)).limit(1000),
    db.select().from(eosProviderIngressReconciliationAttempts).where(eq(eosProviderIngressReconciliationAttempts.registrationId, registration.id)).orderBy(desc(eosProviderIngressReconciliationAttempts.recordedAt)).limit(1000),
    db.select().from(eosProviderIngressWatchAttempts).where(eq(eosProviderIngressWatchAttempts.registrationId, registration.id)).orderBy(desc(eosProviderIngressWatchAttempts.recordedAt)).limit(1000),
    db.select().from(eosProviderIngressPolicies).where(eq(eosProviderIngressPolicies.registrationId, registration.id)).limit(1),
  ]);
  return { policy: policies[0], health: providerIngressHealthSnapshot({ registrations: [registration], events, reconciliationAttempts, watchAttempts, policies }) };
}

export function registerProviderIngressRoutes(app: Express): void {
  app.get("/api/eos/companies/:companyId/provider-ingress", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const { access } = await accessFor(req, "view", "integration_operations.provider_ingress.view");
    const registrations = await db.select().from(eosProviderIngressRegistrations).where(eq(eosProviderIngressRegistrations.companyId, companyId)).orderBy(desc(eosProviderIngressRegistrations.updatedAt));
    const visible: typeof registrations = [];
    for (const item of registrations) { try { await bindingFor(companyId, item.integrationBindingId, access); visible.push(item); } catch {} }
    const ids = visible.map((item) => item.id);
    const events = ids.length ? await db.select().from(eosProviderIngressEvents).where(inArray(eosProviderIngressEvents.registrationId, ids)).orderBy(desc(eosProviderIngressEvents.receivedAt)).limit(1000) : [];
    const reconciliationAttempts = ids.length ? await db.select().from(eosProviderIngressReconciliationAttempts).where(inArray(eosProviderIngressReconciliationAttempts.registrationId, ids)).orderBy(desc(eosProviderIngressReconciliationAttempts.recordedAt)).limit(1000) : [];
    const watchAttempts = ids.length ? await db.select().from(eosProviderIngressWatchAttempts).where(inArray(eosProviderIngressWatchAttempts.registrationId, ids)).orderBy(desc(eosProviderIngressWatchAttempts.recordedAt)).limit(1000) : [];
    const policies = ids.length ? await db.select().from(eosProviderIngressPolicies).where(inArray(eosProviderIngressPolicies.registrationId, ids)) : [];
    const alertDeliveryAttempts = ids.length ? await db.select().from(eosProviderIngressAlertDeliveryAttempts).where(inArray(eosProviderIngressAlertDeliveryAttempts.registrationId, ids)).orderBy(desc(eosProviderIngressAlertDeliveryAttempts.recordedAt)).limit(1000) : [];
    const alertAcknowledgements = ids.length ? await db.select().from(eosProviderIngressAlertAcknowledgements).where(inArray(eosProviderIngressAlertAcknowledgements.registrationId, ids)).orderBy(desc(eosProviderIngressAlertAcknowledgements.acknowledgedAt)).limit(1000) : [];
    const resourceSnapshots = ids.length ? await db.select().from(eosProviderResourceSnapshots).where(inArray(eosProviderResourceSnapshots.registrationId, ids)).orderBy(desc(eosProviderResourceSnapshots.recordedAt)).limit(1000) : [];
    const health = providerIngressHealthSnapshot({ registrations: visible, events, reconciliationAttempts, watchAttempts, policies });
    const acknowledgementByKey = new Map(alertAcknowledgements.map((item) => [item.alertKey, item]));
    res.json({
      registrations: visible.map((item) => projection(item, process.env.EOS_PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`)),
      events: events.map(({ payloadProjection: _payload, ...event }) => event),
      reconciliationAttempts: reconciliationAttempts.map(({ resultProjection: _projection, ...attempt }) => attempt),
      watchAttempts,
      policies,
      alertDeliveryAttempts: alertDeliveryAttempts.map(({ payloadProjection: _projection, ...attempt }) => attempt),
      alertAcknowledgements,
      resourceSnapshots,
      health: { ...health, counts: { ...health.counts, acknowledged: health.alerts.filter((item) => acknowledgementByKey.has(providerIngressAlertKey(item))).length, unacknowledged: health.alerts.filter((item) => !acknowledgementByKey.has(providerIngressAlertKey(item))).length }, alerts: health.alerts.map((item) => { const alertKey = providerIngressAlertKey(item); const acknowledgement = acknowledgementByKey.get(alertKey); return { ...item, alertKey, acknowledged: Boolean(acknowledgement), acknowledgementId: acknowledgement?.id || null, acknowledgedAt: acknowledgement?.acknowledgedAt || null, acknowledgedBySeatId: acknowledgement?.acknowledgedBySeatId || null }; }) },
      externalReceiverConfigured: operationalAlertsConfigured(),
      boundary: "Provider-native notifications are observations only. They never complete an EOS run without exact reconciliation evidence.",
    });
  }));

  app.post("/api/eos/companies/:companyId/integration-operations/bindings/:bindingId/provider-ingress", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = providerIngressRegistrationCreateSchema.parse(req.body); const { access, policy } = await accessFor(req, "decide", "integration_operations.provider_ingress.configure"); const binding = await bindingFor(companyId, req.params.bindingId, access); const evidence = await evidenceFor(companyId, input.evidenceIds, access);
    if (!bindingSupportsProvider(binding.providerKey, input.provider)) throw new EosRouteError(409, "provider_ingress_provider_mismatch", "The native ingress provider must match the selected integration binding.");
    if (binding.providerAccountReference && binding.providerAccountReference !== input.providerAccountReference) throw new EosRouteError(409, "provider_ingress_account_mismatch", "The ingress account must exactly match the binding account reference.");
    const existing = await db.query.eosProviderIngressRegistrations.findFirst({ where: and(eq(eosProviderIngressRegistrations.integrationBindingId, binding.id), eq(eosProviderIngressRegistrations.provider, input.provider)) });
    if (existing) throw new EosRouteError(409, "provider_ingress_exists", "This binding already has a provider-native ingress registration.");
    const authenticationMode = input.provider === "notion" ? "notion_hmac_sha256" : input.provider === "gmail" ? "google_pubsub_oidc" : "google_channel_token";
    const now = new Date(); const id = randomUUID(); const draft = { id, companyId, integrationBindingId: binding.id, controlWorkPacketId: evidence[0].workPacketId, provider: input.provider, authenticationMode, state: "pending_verification", authorizationUserId: req.user.id, providerAccountReference: input.providerAccountReference, providerSubscriptionReference: input.providerSubscriptionReference, resourceCollectionReference: input.resourceCollectionReference, providerResourceReference: "", reconciliationCursor: "", topicName: input.topicName, audience: input.audience, serviceAccountEmail: input.serviceAccountEmail, verificationTokenCiphertext: null, verificationTokenFingerprint: null, watchHistoryId: "", watchExpiresAt: null, version: 1, lastEventId: null, lastInboundEventAt: null, createdByUserId: req.user.id, updatedByUserId: req.user.id, createdAt: now, updatedAt: now } as typeof eosProviderIngressRegistrations.$inferSelect;
    const result = await db.transaction(async (tx) => { const event = await appendControlEvent(tx, { ...draft, version: 0 }, policy, req.user.id, "provider_ingress_configured", 1, input.evidenceIds, { provider: input.provider, authenticationMode: draft.authenticationMode, providerSubscriptionReference: input.providerSubscriptionReference, resourceCollectionReference: input.resourceCollectionReference, topicName: input.topicName, audience: input.audience, serviceAccountEmail: input.serviceAccountEmail, serviceObjectives: { watchRenewBeforeMinutes: 1440, reconciliationOverdueMinutes: 15, pendingVerificationMinutes: 60, externalEscalationEnabled: false, minimumEscalationSeverity: "material", maxDeliveryAttempts: 5 } }); const [registration] = await tx.insert(eosProviderIngressRegistrations).values({ ...draft, lastEventId: event.id }).returning(); await tx.insert(eosProviderIngressPolicies).values({ registrationId: registration.id, companyId, watchRenewBeforeMinutes: 1440, reconciliationOverdueMinutes: 15, pendingVerificationMinutes: 60, externalEscalationEnabled: false, minimumEscalationSeverity: "material", maxDeliveryAttempts: 5, version: 1, evidenceIds: input.evidenceIds, rationale: "Default provider-ingress service objectives established during governed registration.", lastEventId: event.id, updatedByUserId: req.user.id, createdAt: now, updatedAt: now }); await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.provider_ingress.configure", id, policy, { provider: input.provider })); return { registration, event }; });
    res.status(201).json({ registration: projection(result.registration, process.env.EOS_PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`), event: result.event });
  }));

  app.post("/api/eos/companies/:companyId/provider-ingress/:registrationId/verification-token", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = providerIngressTokenRevealSchema.parse(req.body); const { access, policy } = await accessFor(req, "decide", "integration_operations.provider_ingress.reveal_token"); const registration = await registrationFor(companyId, req.params.registrationId, access); await evidenceFor(companyId, input.evidenceIds, access);
    if (registration.provider !== "notion" || registration.version !== input.expectedVersion || !registration.verificationTokenCiphertext) throw new EosRouteError(409, "provider_ingress_token_unavailable", "The Notion verification token is unavailable or the registration changed.");
    await db.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.provider_ingress.reveal_token", registration.id, policy, { fingerprint: registration.verificationTokenFingerprint }));
    res.json({ verificationToken: decryptCredential(registration.verificationTokenCiphertext), fingerprint: registration.verificationTokenFingerprint });
  }));

  app.post("/api/eos/companies/:companyId/provider-ingress/:registrationId/policy", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = providerIngressPolicyUpdateSchema.parse(req.body); const { access, policy: authorization } = await accessFor(req, "decide", "integration_operations.provider_ingress.policy"); const registration = await registrationFor(companyId, req.params.registrationId, access); const evidence = await evidenceFor(companyId, input.evidenceIds, access);
    const current = await db.query.eosProviderIngressPolicies.findFirst({ where: and(eq(eosProviderIngressPolicies.registrationId, registration.id), eq(eosProviderIngressPolicies.companyId, companyId)) });
    if (!current || current.version !== input.expectedVersion) throw new EosRouteError(409, "provider_ingress_policy_changed", "The provider-ingress service objectives changed; refresh before saving.");
    const now = new Date();
    const result = await db.transaction(async (tx) => {
      const nextVersion = current.version + 1;
      const event = await appendControlEvent(tx, registration, authorization, req.user.id, "provider_ingress_policy_updated", nextVersion, input.evidenceIds, { watchRenewBeforeMinutes: input.watchRenewBeforeMinutes, reconciliationOverdueMinutes: input.reconciliationOverdueMinutes, pendingVerificationMinutes: input.pendingVerificationMinutes, externalEscalationEnabled: input.externalEscalationEnabled, minimumEscalationSeverity: input.minimumEscalationSeverity, maxDeliveryAttempts: input.maxDeliveryAttempts, rationale: input.rationale }, current.version);
      const [updated] = await tx.update(eosProviderIngressPolicies).set({ watchRenewBeforeMinutes: input.watchRenewBeforeMinutes, reconciliationOverdueMinutes: input.reconciliationOverdueMinutes, pendingVerificationMinutes: input.pendingVerificationMinutes, externalEscalationEnabled: input.externalEscalationEnabled, minimumEscalationSeverity: input.minimumEscalationSeverity, maxDeliveryAttempts: input.maxDeliveryAttempts, version: nextVersion, evidenceIds: evidence.map((item) => item.id), rationale: input.rationale, lastEventId: event.id, updatedByUserId: req.user.id, updatedAt: now }).where(and(eq(eosProviderIngressPolicies.registrationId, registration.id), eq(eosProviderIngressPolicies.version, current.version))).returning();
      if (!updated) throw new EosRouteError(409, "provider_ingress_policy_changed", "The service objectives changed before the update completed.");
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.provider_ingress.policy", registration.id, authorization, { versionBefore: current.version, versionAfter: nextVersion, externalEscalationEnabled: input.externalEscalationEnabled, minimumEscalationSeverity: input.minimumEscalationSeverity, evidenceIds: input.evidenceIds }));
      return { policy: updated, event };
    });
    res.json(result);
  }));

  app.post("/api/eos/companies/:companyId/provider-ingress/:registrationId/alerts/:alertKey/replay", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = providerIngressAlertReplaySchema.parse(req.body); const { access, policy: authorization } = await accessFor(req, "decide", "integration_operations.provider_ingress.alert_replay"); const registration = await registrationFor(companyId, req.params.registrationId, access); await evidenceFor(companyId, input.evidenceIds, access);
    const [latest] = await db.select().from(eosProviderIngressAlertDeliveryAttempts).where(and(eq(eosProviderIngressAlertDeliveryAttempts.registrationId, registration.id), eq(eosProviderIngressAlertDeliveryAttempts.alertKey, req.params.alertKey))).orderBy(desc(eosProviderIngressAlertDeliveryAttempts.attemptNumber)).limit(1);
    if (!latest || latest.outcome !== "dead_letter") throw new EosRouteError(409, "provider_ingress_alert_replay_unavailable", "Only a dead-lettered current provider alert can be replayed.");
    const { policy, health } = await currentHealthFor(registration);
    if (!policy || !policy.externalEscalationEnabled) throw new EosRouteError(409, "provider_ingress_escalation_disabled", "External escalation must be enabled before a dead-lettered alert can be replayed.");
    const alert = health.alerts.find((item) => providerIngressAlertKey(item) === req.params.alertKey);
    if (!alert) throw new EosRouteError(409, "provider_ingress_alert_resolved", "This alert is no longer active, so EOS will not replay stale escalation data.");
    const result = await dispatchProviderIngressAlertOnce({ alert, policy, companyId, recordedByUserId: req.user.id, trigger: "operator_replay", force: true });
    if (!result.processed || !("attempt" in result) || !("outcome" in result)) throw new EosRouteError(409, "provider_ingress_alert_replay_changed", "The alert delivery state changed before replay completed.");
    await db.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.provider_ingress.alert_replay", registration.id, authorization, { alertKey: req.params.alertKey, priorAttemptId: latest.id, replayAttemptId: result.attempt.id, outcome: result.outcome, rationale: input.rationale, evidenceIds: input.evidenceIds }));
    res.json(result);
  }));

  app.post("/api/eos/companies/:companyId/provider-ingress/:registrationId/alerts/:alertKey/acknowledge", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = providerIngressAlertAcknowledgeSchema.parse(req.body); const { access, policy: authorization } = await accessFor(req, "decide", "integration_operations.provider_ingress.alert_acknowledge"); const registration = await registrationFor(companyId, req.params.registrationId, access);
    if (input.evidenceIds.length) await evidenceFor(companyId, input.evidenceIds, access);
    const { health } = await currentHealthFor(registration);
    const alert = health.alerts.find((item) => providerIngressAlertKey(item) === req.params.alertKey);
    if (!alert) throw new EosRouteError(409, "provider_ingress_alert_not_current", "Only an exact current provider alert can be acknowledged.");
    const now = new Date();
    const acknowledgement = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`provider-ingress-alert-ack:${req.params.alertKey}`}))`);
      const [existing] = await tx.select().from(eosProviderIngressAlertAcknowledgements).where(eq(eosProviderIngressAlertAcknowledgements.alertKey, req.params.alertKey)).limit(1);
      if (existing) throw new EosRouteError(409, "provider_ingress_alert_already_acknowledged", "This exact provider alert already has a human acknowledgement receipt.");
      const id = randomUUID();
      const receiptSha256 = nativeContractContentSha256({ schemaVersion: "eos-provider-ingress-alert-acknowledgement.v1", id, companyId, registrationId: registration.id, alertKey: req.params.alertKey, alertId: alert.id, alertKind: alert.kind, severity: alert.severity, summary: alert.summary, observedAt: alert.observedAt, acknowledgementNote: input.acknowledgementNote, evidenceIds: input.evidenceIds, acknowledgedByUserId: req.user.id, acknowledgedBySeatId: access.seat.id, acknowledgedAt: now.toISOString() });
      const [inserted] = await tx.insert(eosProviderIngressAlertAcknowledgements).values({ id, companyId, registrationId: registration.id, alertKey: req.params.alertKey, alertId: alert.id, alertKind: alert.kind, severity: alert.severity, summary: alert.summary, observedAt: new Date(alert.observedAt), acknowledgementNote: input.acknowledgementNote, evidenceIds: input.evidenceIds, acknowledgedByUserId: req.user.id, acknowledgedBySeatId: access.seat.id, receiptSha256, acknowledgedAt: now }).returning();
      if (alert.sourceAttemptId) await tx.update(notifications).set({ read: true }).where(eq(notifications.id, `provider_ingress_${alert.sourceAttemptId}`));
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.provider_ingress.alert_acknowledge", req.params.alertKey, authorization, { registrationId: registration.id, alertId: alert.id, alertKind: alert.kind, severity: alert.severity, acknowledgementId: inserted.id, evidenceIds: input.evidenceIds, boundary: "Acknowledgement accepts operator responsibility but does not resolve the provider condition." }));
      return inserted;
    });
    res.status(201).json({ acknowledgement, boundary: "Human acknowledgement records responsibility only. It does not resolve the alert, which remains active until its provider condition is actually repaired." });
  }));

  app.post("/api/eos/companies/:companyId/provider-ingress/:registrationId/rotate-configuration", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = providerIngressConfigurationRotateSchema.parse(req.body); const { access, policy } = await accessFor(req, "decide", "integration_operations.provider_ingress.rotate_configuration"); const registration = await registrationFor(companyId, req.params.registrationId, access); await evidenceFor(companyId, input.evidenceIds, access);
    if (registration.version !== input.expectedVersion) throw new EosRouteError(409, "provider_ingress_changed", "The provider ingress registration changed before configuration rotation.");
    if (registration.provider === "notion" && (input.topicName || input.audience || input.serviceAccountEmail)) throw new EosRouteError(400, "provider_ingress_input_invalid", "Notion ingress does not use Google Pub/Sub configuration.");
    if (registration.provider === "gmail" && (!input.topicName.startsWith("projects/") || !input.audience || !input.serviceAccountEmail)) throw new EosRouteError(400, "provider_ingress_input_invalid", "Gmail ingress requires an exact Pub/Sub topic, audience, and push service-account email.");
    if (["google_drive", "google_calendar"].includes(registration.provider) && (input.providerSubscriptionReference || input.topicName || input.audience || input.serviceAccountEmail || !input.resourceCollectionReference)) throw new EosRouteError(400, "provider_ingress_input_invalid", "Google resource channel identifiers are EOS-managed and require only the exact resource collection reference.");
    const stopsActiveWatch = ["gmail", "google_drive", "google_calendar"].includes(registration.provider) && registration.state === "active";
    if (stopsActiveWatch && !input.confirmExternalEffect) throw new EosRouteError(409, "provider_ingress_external_confirmation_required", "Rotating an active provider registration stops its current watch and requires explicit confirmation.");
    if (stopsActiveWatch && !providerExecutionEnabled()) throw new EosRouteError(503, "provider_effects_disabled", "Provider effects are disabled; the active provider watch cannot be stopped safely before rotation.");
    const now = new Date();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`provider-ingress-configuration:${registration.id}`}))`);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`provider-ingress-watch:${registration.id}`}))`);
      const [current] = await tx.select().from(eosProviderIngressRegistrations).where(eq(eosProviderIngressRegistrations.id, registration.id)).limit(1);
      if (!current || current.version !== registration.version) throw new EosRouteError(409, "provider_ingress_changed", "The provider ingress registration changed before configuration rotation.");
      if (stopsActiveWatch && current.provider === "gmail") await stopMailboxWatch(current.authorizationUserId);
      if (stopsActiveWatch && ["google_drive", "google_calendar"].includes(current.provider)) await stopGoogleChannel(current.authorizationUserId, current.providerSubscriptionReference, current.providerResourceReference);
      const versionAfter = current.version + 1;
      const event = await appendControlEvent(tx, current, policy, req.user.id, "provider_ingress_configuration_rotated", versionAfter, input.evidenceIds, { provider: current.provider, priorState: current.state, providerSubscriptionReference: input.providerSubscriptionReference, topicName: input.topicName, audience: input.audience, serviceAccountEmail: input.serviceAccountEmail, activeWatchStopped: stopsActiveWatch, rationale: input.rationale });
      const [updated] = await tx.update(eosProviderIngressRegistrations).set({ providerSubscriptionReference: current.provider === "notion" || current.provider === "gmail" ? input.providerSubscriptionReference : "", resourceCollectionReference: ["google_drive", "google_calendar"].includes(current.provider) ? input.resourceCollectionReference : "", providerResourceReference: "", reconciliationCursor: "", topicName: current.provider === "gmail" ? input.topicName : "", audience: current.provider === "gmail" ? input.audience : "", serviceAccountEmail: current.provider === "gmail" ? input.serviceAccountEmail : "", verificationTokenCiphertext: null, verificationTokenFingerprint: null, watchHistoryId: "", watchExpiresAt: null, state: "pending_verification", version: versionAfter, lastEventId: event.id, updatedByUserId: req.user.id, updatedAt: now }).where(and(eq(eosProviderIngressRegistrations.id, current.id), eq(eosProviderIngressRegistrations.version, current.version))).returning();
      if (!updated) throw new EosRouteError(409, "provider_ingress_changed", "The provider ingress registration changed before configuration rotation.");
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.provider_ingress.rotate_configuration", registration.id, policy, { provider: registration.provider, fromVersion: registration.version, toVersion: versionAfter, activeWatchStopped: stopsActiveWatch, rationale: input.rationale, evidenceIds: input.evidenceIds }));
      return { updated, event };
    });
    res.json({ registration: projection(result.updated, process.env.EOS_PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`), event: result.event, nextAction: result.updated.provider === "gmail" ? "start_gmail_watch" : result.updated.provider === "notion" ? "complete_notion_verification" : "start_google_channel" });
  }));

  app.post("/api/eos/companies/:companyId/provider-ingress/:registrationId/start-gmail-watch", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = gmailWatchStartSchema.parse(req.body); const { access, policy } = await accessFor(req, "approve", "integration_operations.provider_ingress.start_watch"); const registration = await registrationFor(companyId, req.params.registrationId, access); await evidenceFor(companyId, input.evidenceIds, access);
    if (!providerExecutionEnabled()) throw new EosRouteError(503, "provider_effects_disabled", "Provider effects are disabled in this deployment.");
    if (registration.provider !== "gmail" || registration.version !== input.expectedVersion || registration.state === "revoked") throw new EosRouteError(409, "provider_ingress_changed", "The Gmail ingress registration is unavailable or changed.");
    const now = new Date(); const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`provider-ingress-watch:${registration.id}`}))`);
      const [current] = await tx.select().from(eosProviderIngressRegistrations).where(eq(eosProviderIngressRegistrations.id, registration.id)).limit(1);
      if (!current || current.version !== registration.version || current.state === "revoked") throw new EosRouteError(409, "provider_ingress_changed", "The Gmail ingress registration changed before watch activation.");
      const [latestAttempt] = await tx.select().from(eosProviderIngressWatchAttempts).where(eq(eosProviderIngressWatchAttempts.registrationId, registration.id)).orderBy(desc(eosProviderIngressWatchAttempts.attemptNumber)).limit(1);
      const attemptNumber = (latestAttempt?.attemptNumber || 0) + 1;
      const receipt = await startMailboxWatch(current.authorizationUserId, current.topicName, current.providerAccountReference);
      const receiptSha256 = nativeContractContentSha256({ registrationId: registration.id, attemptNumber, historyId: receipt.historyId, expiresAt: receipt.expiresAt.toISOString(), recordedAt: now.toISOString() });
      const event = await appendControlEvent(tx, current, policy, req.user.id, "provider_ingress_watch_started", current.version + 1, input.evidenceIds, { topicName: current.topicName, providerSubscriptionReference: current.providerSubscriptionReference, historyId: receipt.historyId, expiresAt: receipt.expiresAt.toISOString() });
      const [updated] = await tx.update(eosProviderIngressRegistrations).set({ state: "active", watchHistoryId: receipt.historyId, watchExpiresAt: receipt.expiresAt, version: current.version + 1, lastEventId: event.id, updatedByUserId: req.user.id, updatedAt: now }).where(and(eq(eosProviderIngressRegistrations.id, current.id), eq(eosProviderIngressRegistrations.version, current.version))).returning();
      if (!updated) throw new EosRouteError(409, "provider_ingress_changed", "The Gmail ingress registration changed before watch activation.");
      await tx.insert(eosProviderIngressWatchAttempts).values({ id: randomUUID(), companyId, registrationId: registration.id, attemptNumber, trigger: "manual", outcome: "succeeded", historyId: receipt.historyId, expiresAt: receipt.expiresAt, summary: "Gmail mailbox watch started or renewed from an exact provider receipt.", failureCode: "", nextAttemptAt: null, receiptSha256, recordedByUserId: req.user.id, recordedAt: now });
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.provider_ingress.start_watch", registration.id, policy, { expiresAt: receipt.expiresAt.toISOString(), watchAttemptNumber: attemptNumber }));
      return { updated, event };
    });
    res.json({ registration: projection(result.updated), event: result.event });
  }));

  app.post("/api/eos/companies/:companyId/provider-ingress/:registrationId/start-google-channel", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = googleChannelStartSchema.parse(req.body); const { access, policy } = await accessFor(req, "approve", "integration_operations.provider_ingress.start_watch"); const registration = await registrationFor(companyId, req.params.registrationId, access); await evidenceFor(companyId, input.evidenceIds, access);
    if (!providerExecutionEnabled()) throw new EosRouteError(503, "provider_effects_disabled", "Provider effects are disabled in this deployment.");
    if (!["google_drive", "google_calendar"].includes(registration.provider) || registration.version !== input.expectedVersion || registration.state === "revoked") throw new EosRouteError(409, "provider_ingress_changed", "The Google resource ingress registration is unavailable or changed.");
    const origin = process.env.EOS_PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`;
    const callbackUrl = new URL(`/api/eos/provider-ingress/${registration.provider}/${registration.id}`, origin);
    if (callbackUrl.protocol !== "https:") throw new EosRouteError(409, "provider_ingress_https_required", "Google resource channels require the deployment's exact public HTTPS origin.");
    const now = new Date(); const channelId = randomUUID(); const channelToken = randomBytes(32).toString("base64url");
    const createdReceipt: { value: { emailAddress: string; channelId: string; resourceId: string; cursor: string; expiresAt: Date } | null } = { value: null };
    let result: { updated: typeof eosProviderIngressRegistrations.$inferSelect; event: typeof eosIntegrationOperationEvents.$inferSelect; priorChannelId: string; priorResourceId: string; newChannelId: string };
    try { result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`provider-ingress-watch:${registration.id}`}))`);
      const [current] = await tx.select().from(eosProviderIngressRegistrations).where(eq(eosProviderIngressRegistrations.id, registration.id)).limit(1);
      if (!current || current.version !== registration.version || current.state === "revoked") throw new EosRouteError(409, "provider_ingress_changed", "The Google resource ingress registration changed before channel activation.");
      createdReceipt.value = current.provider === "google_drive"
        ? await (async () => { const baseline = current.reconciliationCursor || (await getDriveStartPageToken(current.authorizationUserId, current.providerAccountReference)).cursor; return startDriveChangesWatch(current.authorizationUserId, { channelId, channelToken, callbackUrl: callbackUrl.toString(), pageToken: baseline, expectedEmailAddress: current.providerAccountReference }); })()
        : await startCalendarWatch(current.authorizationUserId, { channelId, channelToken, callbackUrl: callbackUrl.toString(), calendarId: current.resourceCollectionReference, expectedEmailAddress: current.providerAccountReference });
      const receipt = createdReceipt.value;
      const [latestAttempt] = await tx.select().from(eosProviderIngressWatchAttempts).where(eq(eosProviderIngressWatchAttempts.registrationId, registration.id)).orderBy(desc(eosProviderIngressWatchAttempts.attemptNumber)).limit(1);
      const attemptNumber = (latestAttempt?.attemptNumber || 0) + 1;
      const tokenFingerprint = sha256(channelToken);
      const receiptProjection = { registrationId: registration.id, provider: registration.provider, attemptNumber, channelId: receipt.channelId, resourceId: receipt.resourceId, cursor: receipt.cursor, expiresAt: receipt.expiresAt.toISOString(), tokenFingerprint, recordedAt: now.toISOString() };
      const receiptSha256 = nativeContractContentSha256(receiptProjection);
      const event = await appendControlEvent(tx, current, policy, req.user.id, "provider_ingress_watch_started", current.version + 1, input.evidenceIds, receiptProjection);
      const [updated] = await tx.update(eosProviderIngressRegistrations).set({ state: "active", providerSubscriptionReference: receipt.channelId, providerResourceReference: receipt.resourceId, reconciliationCursor: receipt.cursor, verificationTokenCiphertext: encryptCredential(channelToken), verificationTokenFingerprint: tokenFingerprint, watchHistoryId: receipt.cursor, watchExpiresAt: receipt.expiresAt, version: current.version + 1, lastEventId: event.id, updatedByUserId: req.user.id, updatedAt: now }).where(and(eq(eosProviderIngressRegistrations.id, current.id), eq(eosProviderIngressRegistrations.version, current.version))).returning();
      if (!updated) throw new EosRouteError(409, "provider_ingress_changed", "The Google resource ingress registration changed before channel activation.");
      await tx.insert(eosProviderIngressWatchAttempts).values({ id: randomUUID(), companyId, registrationId: registration.id, attemptNumber, trigger: "manual", outcome: "succeeded", historyId: receipt.cursor, expiresAt: receipt.expiresAt, summary: `${registration.provider === "google_drive" ? "Google Drive" : "Google Calendar"} resource channel started or renewed from an exact provider receipt.`, failureCode: "", nextAttemptAt: null, receiptSha256, recordedByUserId: req.user.id, recordedAt: now });
      await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.provider_ingress.start_watch", registration.id, policy, { provider: registration.provider, expiresAt: receipt.expiresAt.toISOString(), watchAttemptNumber: attemptNumber, tokenFingerprint }));
      return { updated, event, priorChannelId: current.providerSubscriptionReference, priorResourceId: current.providerResourceReference, newChannelId: receipt.channelId };
    }); } catch (error) {
      if (createdReceipt.value) await stopGoogleChannel(registration.authorizationUserId, createdReceipt.value.channelId, createdReceipt.value.resourceId).catch(() => undefined);
      throw error;
    }
    if (result.priorChannelId && result.priorResourceId && result.priorChannelId !== result.newChannelId) void stopGoogleChannel(registration.authorizationUserId, result.priorChannelId, result.priorResourceId).catch(() => undefined);
    res.json({ registration: projection(result.updated), event: result.event });
  }));

  app.post("/api/eos/companies/:companyId/provider-ingress/events/:eventId/replay", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = providerIngressReplaySchema.parse(req.body); const { access, policy } = await accessFor(req, "decide", "integration_operations.provider_ingress.replay"); await evidenceFor(companyId, input.evidenceIds, access);
    if (!providerExecutionEnabled()) throw new EosRouteError(503, "provider_effects_disabled", "Provider effects are disabled in this deployment.");
    const event = await db.query.eosProviderIngressEvents.findFirst({ where: and(eq(eosProviderIngressEvents.id, req.params.eventId), eq(eosProviderIngressEvents.companyId, companyId)) });
    if (!event) throw new EosRouteError(404, "provider_ingress_event_not_found", "Provider ingress event not found in this authority scope.");
    await bindingFor(companyId, event.integrationBindingId, access);
    const [latest] = await db.select().from(eosProviderIngressReconciliationAttempts).where(eq(eosProviderIngressReconciliationAttempts.eventId, event.id)).orderBy(desc(eosProviderIngressReconciliationAttempts.attemptNumber)).limit(1);
    if (latest?.outcome !== "dead_letter") throw new EosRouteError(409, "provider_ingress_replay_unavailable", "Only a dead-lettered reconciliation can be replayed by an operator.");
    await db.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.provider_ingress.replay_requested", event.id, policy, { rationale: input.rationale, priorAttemptId: latest.id, evidenceIds: input.evidenceIds }));
    const result = await reconcileProviderIngressEventOnce(event.id, { trigger: "operator_replay", force: true, evidenceIds: input.evidenceIds, recordedByUserId: req.user.id });
    if (!result.processed || !("attempt" in result) || !("outcome" in result)) throw new EosRouteError(409, "provider_ingress_replay_changed", "The reconciliation changed before replay could be recorded.");
    if (result.outcome === "succeeded") await db.update(notifications).set({ read: true }).where(eq(notifications.id, `provider_ingress_${latest.id}`));
    await db.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.provider_ingress.replay", event.id, policy, { rationale: input.rationale, priorAttemptId: latest.id, replayAttemptId: result.attempt.id, outcome: result.outcome }));
    res.status(result.outcome === "succeeded" ? 200 : 202).json(result);
  }));

  app.post("/api/eos/companies/:companyId/provider-ingress/:registrationId/state", route(async (req, res) => {
    const companyId = Number(req.params.companyId); const input = providerIngressStateSchema.parse(req.body); const { access, policy } = await accessFor(req, "decide", "integration_operations.provider_ingress.state"); const registration = await registrationFor(companyId, req.params.registrationId, access); await evidenceFor(companyId, input.evidenceIds, access);
    if (registration.version !== input.expectedVersion || (input.state === "active" && registration.provider === "notion" && !registration.verificationTokenCiphertext)) throw new EosRouteError(409, "provider_ingress_changed", "The ingress registration is unavailable, unverified, or changed.");
    if (input.state === "revoked" && ["gmail", "google_drive", "google_calendar"].includes(registration.provider) && registration.state === "active") {
      if (!providerExecutionEnabled()) throw new EosRouteError(503, "provider_effects_disabled", "Provider effects are disabled; stop the provider watch before revoking local receipt acceptance.");
      if (registration.provider === "gmail") await stopMailboxWatch(registration.authorizationUserId);
      else await stopGoogleChannel(registration.authorizationUserId, registration.providerSubscriptionReference, registration.providerResourceReference);
    }
    const now = new Date(); const result = await db.transaction(async (tx) => { const event = await appendControlEvent(tx, registration, policy, req.user.id, "provider_ingress_state_changed", registration.version + 1, input.evidenceIds, { from: registration.state, to: input.state }); const [updated] = await tx.update(eosProviderIngressRegistrations).set({ state: input.state, watchExpiresAt: input.state === "revoked" ? null : registration.watchExpiresAt, version: registration.version + 1, lastEventId: event.id, updatedByUserId: req.user.id, updatedAt: now }).where(and(eq(eosProviderIngressRegistrations.id, registration.id), eq(eosProviderIngressRegistrations.version, registration.version))).returning(); if (!updated) throw new EosRouteError(409, "provider_ingress_changed", "The ingress registration changed before the update."); await tx.insert(eosAuditRecords).values(audit(companyId, req.user.id, "integration_operations.provider_ingress.state", registration.id, policy, { state: input.state })); return { updated, event }; });
    res.json({ registration: projection(result.updated), event: result.event });
  }));

  app.post("/api/eos/provider-ingress/notion/:registrationId", inboundLimit, async (req, res) => {
    const registration = await db.query.eosProviderIngressRegistrations.findFirst({ where: and(eq(eosProviderIngressRegistrations.id, req.params.registrationId), eq(eosProviderIngressRegistrations.provider, "notion")) });
    if (!registration || registration.state === "revoked") return res.status(404).json({ code: "provider_ingress_not_found" });
    if (!req.rawBody) return res.status(400).json({ code: "provider_ingress_raw_body_required" });
    const verification = parseNotionVerification(req.body);
    if (verification) {
      if (registration.verificationTokenCiphertext && notionTokenFingerprint(verification.verificationToken) !== registration.verificationTokenFingerprint) return res.status(409).json({ code: "provider_ingress_verification_conflict" });
      if (!registration.verificationTokenCiphertext) await db.update(eosProviderIngressRegistrations).set({ verificationTokenCiphertext: encryptCredential(verification.verificationToken), verificationTokenFingerprint: notionTokenFingerprint(verification.verificationToken), state: "pending_verification", version: registration.version + 1, updatedAt: new Date() }).where(and(eq(eosProviderIngressRegistrations.id, registration.id), eq(eosProviderIngressRegistrations.version, registration.version)));
      return res.status(200).json({ verification_token: verification.verificationToken });
    }
    if (!registration.verificationTokenCiphertext) return res.status(409).json({ code: "provider_ingress_unverified" });
    try { verifyNotionSignature(req.rawBody, req.get("x-notion-signature") || undefined, decryptCredential(registration.verificationTokenCiphertext)); const translated = translateNotionEvent(req.body); if (translated.workspaceId !== registration.providerAccountReference || (registration.providerSubscriptionReference && translated.subscriptionId !== registration.providerSubscriptionReference)) return res.status(202).json({ accepted: false, reason: "authority_scope_mismatch" }); const processingState = translated.providerObjectReference.startsWith("page:") ? "reconciliation_required" : "observed"; const result = await storeProviderEvent(registration, translated, "notion_hmac_sha256", processingState); return res.status(200).json({ accepted: true, duplicate: result.duplicate, reconciliationRequired: processingState === "reconciliation_required" }); }
    catch { return res.status(400).json({ code: "provider_ingress_invalid" }); }
  });

  app.post("/api/eos/provider-ingress/gmail/:registrationId", inboundLimit, async (req, res) => {
    const registration = await db.query.eosProviderIngressRegistrations.findFirst({ where: and(eq(eosProviderIngressRegistrations.id, req.params.registrationId), eq(eosProviderIngressRegistrations.provider, "gmail")) });
    if (!registration || registration.state !== "active") return res.status(404).json({ code: "provider_ingress_not_found" });
    try { const bearer = req.get("authorization")?.match(/^Bearer (.+)$/i)?.[1]; if (!bearer) throw new Error("Missing Pub/Sub bearer token."); await verifyPubSubOidcToken(bearer, registration.audience, registration.serviceAccountEmail); const translated = translateGmailPush(req.body); if (translated.subscription !== registration.providerSubscriptionReference || translated.emailAddress.toLowerCase() !== registration.providerAccountReference.toLowerCase()) return res.status(202).json({ accepted: false, reason: "authority_scope_mismatch" }); const result = await storeProviderEvent(registration, translated, "google_pubsub_oidc", "reconciliation_required"); return res.status(200).json({ accepted: true, duplicate: result.duplicate }); }
    catch { return res.status(400).json({ code: "provider_ingress_invalid" }); }
  });

  for (const provider of ["google_drive", "google_calendar"] as const) {
    app.post(`/api/eos/provider-ingress/${provider}/:registrationId`, inboundLimit, async (req, res) => {
      const registration = await db.query.eosProviderIngressRegistrations.findFirst({ where: and(eq(eosProviderIngressRegistrations.id, req.params.registrationId), eq(eosProviderIngressRegistrations.provider, provider)) });
      if (!registration || registration.state !== "active" || !registration.verificationTokenCiphertext) return res.status(404).json({ code: "provider_ingress_not_found" });
      try {
        verifyGoogleChannelToken(req.get("x-goog-channel-token") || undefined, decryptCredential(registration.verificationTokenCiphertext));
        const translated = translateGoogleChannel(provider, req.headers as Record<string, string | string[] | undefined>);
        if (translated.channelId !== registration.providerSubscriptionReference || translated.resourceId !== registration.providerResourceReference) return res.status(202).json({ accepted: false, reason: "authority_scope_mismatch" });
        const result = await storeProviderEvent(registration, translated, "google_channel_token", "reconciliation_required");
        return res.status(200).json({ accepted: true, duplicate: result.duplicate });
      } catch { return res.status(400).json({ code: "provider_ingress_invalid" }); }
    });
  }
}
