import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { eosProviderIngressEvents, eosProviderIngressPolicies, eosProviderIngressReconciliationAttempts, eosProviderIngressRegistrations, eosProviderIngressWatchAttempts, eosProviderResourceSnapshots, notifications } from "@shared/schema";
import { db } from "../db";
import { nativeContractContentSha256 } from "../esign/template-generation";
import * as gmail from "./gmail";
import * as notion from "./notion";
import { providerExecutionEnabled } from "@shared/integration-operations";
import { writeLog } from "../observability/logger";
import { dispatchProviderIngressAlertsOnce } from "./provider-ingress-alerts";
import { encryptCredential } from "../security/credential-encryption";

const RECONCILIATION_MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

type Clients = Pick<typeof gmail, "listMailboxHistory" | "startMailboxWatch" | "listDriveChanges" | "listCalendarChanges" | "getDriveStartPageToken" | "startDriveChangesWatch" | "startCalendarWatch" | "stopGoogleChannel"> & Pick<typeof notion, "connectionSummary" | "readPageSnapshot">;
const liveClients: Clients = { ...gmail, ...notion };

type ReconciliationOperation = "gmail_reconciliation" | "notion_snapshot" | "drive_reconciliation" | "calendar_reconciliation";
function failureCode(error: unknown, operation: ReconciliationOperation | "watch" = "gmail_reconciliation"): string {
  const explicit = (error as any)?.providerFailureCode;
  if (typeof explicit === "string" && /^provider_[a-z_]+$/.test(explicit)) return explicit;
  const status = Number((error as any)?.code || (error as any)?.response?.status);
  if (status === 404 && operation === "gmail_reconciliation") return "provider_history_cursor_stale";
  if (status === 410 && ["drive_reconciliation", "calendar_reconciliation"].includes(operation)) return "provider_reconciliation_cursor_stale";
  if (status === 404 && operation === "notion_snapshot") return "provider_resource_not_found";
  if (status === 401 || status === 403) return "provider_authorization_failed";
  if (error instanceof Error && /(mailbox|drive account|calendar account).*match/i.test(error.message)) return "provider_account_mismatch";
  if (operation === "notion_snapshot") return "provider_snapshot_unavailable";
  return operation === "watch" ? "provider_watch_unavailable" : "provider_reconciliation_unavailable";
}

function providerError(code: string, message: string): Error { return Object.assign(new Error(message), { providerFailureCode: code }); }
function canonicalNotionId(value: string): string {
  const canonical = value.toLowerCase().replaceAll("-", "");
  return /^[0-9a-f]{32}$/.test(canonical) ? canonical : "";
}

function terminalNotification(input: { attemptId: string; userId: string; companyId: number; registrationId: string; title: string; content: string; failureCode: string }) {
  return { id: `provider_ingress_${input.attemptId}`, userId: input.userId, title: input.title, content: input.content, type: "provider-ingress-action-required", read: false, href: `/company/${input.companyId}#modules`, relatedId: input.registrationId, metadata: { companyId: input.companyId, registrationId: input.registrationId, attemptId: input.attemptId, failureCode: input.failureCode, action: "open_integration_operations" }, createdAt: new Date() };
}

export async function reconcileProviderIngressEventOnce(eventId: string, options: { now?: Date; trigger?: "worker" | "operator_replay"; evidenceIds?: string[]; clients?: Clients; force?: boolean; recordedByUserId?: string } = {}) {
  const now = options.now || new Date(); const clients = options.clients || liveClients; const trigger = options.trigger || "worker";
  const event = await db.query.eosProviderIngressEvents.findFirst({ where: eq(eosProviderIngressEvents.id, eventId) });
  if (!event || event.processingState !== "reconciliation_required") return { processed: false, reason: "not_reconcilable" as const };
  const registration = await db.query.eosProviderIngressRegistrations.findFirst({ where: and(eq(eosProviderIngressRegistrations.id, event.registrationId), eq(eosProviderIngressRegistrations.companyId, event.companyId)) });
  if (!registration || !["gmail", "notion", "google_drive", "google_calendar"].includes(registration.provider) || registration.state === "revoked") return { processed: false, reason: "registration_unavailable" as const };
  const [latest] = await db.select().from(eosProviderIngressReconciliationAttempts).where(eq(eosProviderIngressReconciliationAttempts.eventId, event.id)).orderBy(desc(eosProviderIngressReconciliationAttempts.attemptNumber)).limit(1);
  if (!options.force && latest?.outcome === "succeeded") return { processed: false, reason: "already_reconciled" as const, attempt: latest };
  if (!options.force && latest?.outcome === "dead_letter") return { processed: false, reason: "dead_letter" as const, attempt: latest };
  if (!options.force && latest?.outcome === "retry_scheduled" && latest.nextAttemptAt && latest.nextAttemptAt > now) return { processed: false, reason: "retry_not_due" as const, attempt: latest };
  const attemptNumber = (latest?.attemptNumber || 0) + 1;
  const payload = event.payloadProjection as any;

  const recordFailure = async (error: unknown, operation: ReconciliationOperation, projectionInput: Record<string, unknown>) => {
    const code = failureCode(error, operation); const terminal = attemptNumber >= RECONCILIATION_MAX_ATTEMPTS; const outcome = terminal ? "dead_letter" : "retry_scheduled"; const nextAttemptAt = terminal ? null : new Date(now.getTime() + RETRY_DELAYS_MS[Math.min(attemptNumber - 1, RETRY_DELAYS_MS.length - 1)]);
    const projection = { ...projectionInput, failureCode: code }; const resultSha256 = nativeContractContentSha256(projection); const providerLabel = registration.provider === "notion" ? "Notion page snapshot" : registration.provider === "gmail" ? "Gmail history" : registration.provider === "google_drive" ? "Google Drive changes" : "Google Calendar changes";
    const [attempt] = await db.transaction(async (tx) => {
      const inserted = await tx.insert(eosProviderIngressReconciliationAttempts).values({ id: randomUUID(), companyId: event.companyId, registrationId: registration.id, eventId: event.id, attemptNumber, trigger, outcome, externalReference: "", summary: terminal ? `${providerLabel} reconciliation exhausted its bounded retry budget and requires operator replay.` : `${providerLabel} reconciliation is unavailable and has been scheduled for bounded retry.`, resultProjection: projection, resultSha256, failureCode: code, evidenceIds: options.evidenceIds || [], nextAttemptAt, recordedByUserId: options.recordedByUserId || registration.authorizationUserId, recordedAt: now }).onConflictDoNothing().returning();
      if (inserted[0] && terminal) await tx.insert(notifications).values(terminalNotification({ attemptId: inserted[0].id, userId: registration.authorizationUserId, companyId: registration.companyId, registrationId: registration.id, title: "Provider signal needs operator replay", content: `${providerLabel} reconciliation stopped after its bounded retry budget (${code}). Repair the provider path, attach evidence, and replay the exact signal.`, failureCode: code })).onConflictDoNothing();
      return inserted;
    });
    return attempt ? { processed: true, outcome, attempt } : { processed: false, reason: "concurrent_attempt" as const };
  };

  if (registration.provider === "notion") {
    const entity = payload?.entity;
    const pageId = entity?.type === "page" && typeof entity?.id === "string" ? entity.id : "";
    try {
      if (!pageId) throw providerError("provider_resource_unsupported", "The Notion event does not identify a page resource.");
      if (!canonicalNotionId(pageId)) throw providerError("provider_resource_unsupported", "The Notion event page identity is not canonical.");
      const connection = await clients.connectionSummary(registration.authorizationUserId);
      if (!connection.connected) throw providerError("provider_authorization_failed", "The Notion authorization is unavailable.");
      if (!connection.workspace?.workspaceId || connection.workspace.workspaceId !== registration.providerAccountReference) throw providerError("provider_account_mismatch", "The connected Notion workspace does not match the ingress authority scope.");
      const snapshot = await clients.readPageSnapshot(registration.authorizationUserId, pageId, 200);
      if (canonicalNotionId(snapshot.pageId) !== canonicalNotionId(pageId)) throw providerError("provider_resource_mismatch", "The Notion snapshot identity does not match the signed event resource.");
      const boundedContentSha256 = createHash("sha256").update(snapshot.boundedText).digest("hex");
      const [attempt] = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`provider-resource-snapshot:${registration.id}:${canonicalNotionId(snapshot.pageId)}`}))`);
        const [previous] = await tx.select().from(eosProviderResourceSnapshots).where(and(eq(eosProviderResourceSnapshots.registrationId, registration.id), eq(eosProviderResourceSnapshots.resourceId, snapshot.pageId))).orderBy(desc(eosProviderResourceSnapshots.recordedAt), desc(eosProviderResourceSnapshots.id)).limit(1);
        const id = randomUUID(); const previousSnapshotSha256 = previous?.snapshotSha256 || "";
        const snapshotProjection = { schemaVersion: "eos-provider-resource-snapshot.v1", id, companyId: event.companyId, registrationId: registration.id, eventId: event.id, provider: "notion", resourceType: "page", resourceId: snapshot.pageId, providerRevision: snapshot.lastEditedTime, title: snapshot.title, providerUrl: snapshot.url, boundedContentSha256, truncated: snapshot.truncated, previousSnapshotSha256, recordedByUserId: options.recordedByUserId || registration.authorizationUserId, recordedAt: now.toISOString() };
        const snapshotSha256 = nativeContractContentSha256(snapshotProjection);
        const resultProjection = { pageId: snapshot.pageId, title: snapshot.title, url: snapshot.url, lastEditedTime: snapshot.lastEditedTime, boundedContentSha256, truncated: snapshot.truncated, snapshotSha256 };
        const resultSha256 = nativeContractContentSha256(resultProjection);
        const inserted = await tx.insert(eosProviderIngressReconciliationAttempts).values({ id: randomUUID(), companyId: event.companyId, registrationId: registration.id, eventId: event.id, attemptNumber, trigger, outcome: "succeeded", externalReference: `notion:page:${snapshot.pageId}:${snapshot.lastEditedTime}`, summary: `Notion returned a bounded snapshot of ${snapshot.title} at its declared provider revision; this observation did not complete an EOS operation.`, resultProjection, resultSha256, failureCode: "", evidenceIds: options.evidenceIds || [], nextAttemptAt: null, recordedByUserId: options.recordedByUserId || registration.authorizationUserId, recordedAt: now }).onConflictDoNothing().returning();
        if (inserted[0]) await tx.insert(eosProviderResourceSnapshots).values({ id, companyId: event.companyId, registrationId: registration.id, eventId: event.id, provider: "notion", resourceType: "page", resourceId: snapshot.pageId, providerRevision: snapshot.lastEditedTime, title: snapshot.title, providerUrl: snapshot.url, boundedContentSha256, truncated: snapshot.truncated, previousSnapshotSha256, snapshotSha256, recordedByUserId: options.recordedByUserId || registration.authorizationUserId, recordedAt: now }).onConflictDoNothing();
        return inserted;
      });
      return attempt ? { processed: true, outcome: "succeeded" as const, attempt } : { processed: false, reason: "concurrent_attempt" as const };
    } catch (error) { return recordFailure(error, "notion_snapshot", { pageId }); }
  }

  if (registration.provider === "google_drive" || registration.provider === "google_calendar") {
    const observedCursor = registration.reconciliationCursor;
    const operation = registration.provider === "google_drive" ? "drive_reconciliation" as const : "calendar_reconciliation" as const;
    try {
      const recordedByUserId = options.recordedByUserId || registration.authorizationUserId;
      const [attempt] = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`provider-reconciliation-cursor:${registration.id}`}))`);
        const [current] = await tx.select().from(eosProviderIngressRegistrations).where(eq(eosProviderIngressRegistrations.id, registration.id)).limit(1);
        const baselineCursor = current?.reconciliationCursor || "";
        if (!baselineCursor) throw providerError("provider_reconciliation_cursor_missing", "The provider reconciliation cursor is unavailable.");
        const result = registration.provider === "google_drive"
          ? await clients.listDriveChanges(registration.authorizationUserId, baselineCursor, 25)
          : await clients.listCalendarChanges(registration.authorizationUserId, registration.resourceCollectionReference, baselineCursor);
        const deduplicated = Array.from(new Map(result.changes.map((change) => [change.resourceId, change])).values());
        const resultProjection = { provider: registration.provider, collectionReference: registration.resourceCollectionReference, baselineCursorSha256: createHash("sha256").update(baselineCursor).digest("hex"), nextCursorSha256: createHash("sha256").update(result.nextCursor).digest("hex"), changeCount: deduplicated.length, truncated: result.truncated, resources: deduplicated.map((change) => ({ resourceId: change.resourceId, resourceState: change.resourceState, providerRevision: change.providerRevision, title: change.title, providerUrl: change.providerUrl })) };
        const resultSha256 = nativeContractContentSha256(resultProjection);
        const inserted = await tx.insert(eosProviderIngressReconciliationAttempts).values({ id: randomUUID(), companyId: event.companyId, registrationId: registration.id, eventId: event.id, attemptNumber, trigger, outcome: "succeeded", externalReference: `${registration.provider}:changes:${createHash("sha256").update(result.nextCursor).digest("hex")}`, summary: `${registration.provider === "google_drive" ? "Google Drive" : "Google Calendar"} reconciliation observed ${deduplicated.length} bounded metadata change${deduplicated.length === 1 ? "" : "s"}; it did not prove an EOS operation completed.`, resultProjection, resultSha256, failureCode: "", evidenceIds: options.evidenceIds || [], nextAttemptAt: null, recordedByUserId, recordedAt: now }).onConflictDoNothing().returning();
        if (!inserted[0]) return inserted;
        for (const resource of deduplicated) {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`provider-resource-snapshot:${registration.id}:${resource.resourceId}`}))`);
          const [previous] = await tx.select().from(eosProviderResourceSnapshots).where(and(eq(eosProviderResourceSnapshots.registrationId, registration.id), eq(eosProviderResourceSnapshots.resourceId, resource.resourceId))).orderBy(desc(eosProviderResourceSnapshots.recordedAt), desc(eosProviderResourceSnapshots.id)).limit(1);
          const id = randomUUID(); const previousSnapshotSha256 = previous?.snapshotSha256 || ""; const metadataProjection = resource.metadata;
          const boundedContentSha256 = nativeContractContentSha256(metadataProjection);
          const snapshotProjection = { schemaVersion: "eos-provider-resource-snapshot.v1", id, companyId: event.companyId, registrationId: registration.id, eventId: event.id, provider: registration.provider, resourceType: registration.provider === "google_drive" ? "file" : "event", resourceId: resource.resourceId, resourceState: resource.resourceState, providerRevision: resource.providerRevision, title: resource.title, providerUrl: resource.providerUrl, metadataProjection, boundedContentSha256, truncated: result.truncated, previousSnapshotSha256, recordedByUserId, recordedAt: now.toISOString() };
          const snapshotSha256 = nativeContractContentSha256(snapshotProjection);
          await tx.insert(eosProviderResourceSnapshots).values({ id, companyId: event.companyId, registrationId: registration.id, eventId: event.id, provider: registration.provider, resourceType: registration.provider === "google_drive" ? "file" : "event", resourceId: resource.resourceId, resourceState: resource.resourceState, providerRevision: resource.providerRevision, title: resource.title, providerUrl: resource.providerUrl, metadataProjection, boundedContentSha256, truncated: result.truncated, previousSnapshotSha256, snapshotSha256, recordedByUserId, recordedAt: now }).onConflictDoNothing();
        }
        await tx.update(eosProviderIngressRegistrations).set({ reconciliationCursor: result.nextCursor, watchHistoryId: result.nextCursor, updatedAt: now }).where(and(eq(eosProviderIngressRegistrations.id, registration.id), eq(eosProviderIngressRegistrations.reconciliationCursor, baselineCursor)));
        return inserted;
      });
      return attempt ? { processed: true, outcome: "succeeded" as const, attempt } : { processed: false, reason: "concurrent_attempt" as const };
    } catch (error) { return recordFailure(error, operation, { observedCursorSha256: observedCursor ? createHash("sha256").update(observedCursor).digest("hex") : "", collectionReference: registration.resourceCollectionReference }); }
  }

  const targetHistoryId = typeof payload?.historyId === "string" ? payload.historyId : "";
  try {
    const [attempt] = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`provider-reconciliation-cursor:${registration.id}`}))`);
      const [current] = await tx.select().from(eosProviderIngressRegistrations).where(eq(eosProviderIngressRegistrations.id, registration.id)).limit(1);
      const baselineHistoryId = current?.watchHistoryId || "";
      if (!/^\d+$/.test(targetHistoryId) || !/^\d+$/.test(baselineHistoryId)) throw new Error("Gmail history cursor is unavailable.");
      const result: Awaited<ReturnType<Clients["listMailboxHistory"]>> = BigInt(targetHistoryId) <= BigInt(baselineHistoryId)
        ? { latestHistoryId: baselineHistoryId, changes: [], truncated: false }
        : await clients.listMailboxHistory(registration.authorizationUserId, baselineHistoryId, 10);
      const nextHistoryId = BigInt(result.latestHistoryId) > BigInt(targetHistoryId) ? result.latestHistoryId : targetHistoryId;
      const projection = { baselineHistoryId, targetHistoryId, nextHistoryId, changeCount: result.changes.length, changes: result.changes, truncated: result.truncated };
      const id = randomUUID(); const resultSha256 = nativeContractContentSha256(projection);
      const inserted = await tx.insert(eosProviderIngressReconciliationAttempts).values({ id, companyId: event.companyId, registrationId: registration.id, eventId: event.id, attemptNumber, trigger, outcome: "succeeded", externalReference: `gmail-history:${nextHistoryId}`, summary: `Gmail history reconciliation observed ${result.changes.length} bounded mailbox change${result.changes.length === 1 ? "" : "s"}; it did not prove an EOS operation completed.`, resultProjection: projection, resultSha256, failureCode: "", evidenceIds: options.evidenceIds || [], nextAttemptAt: null, recordedByUserId: options.recordedByUserId || registration.authorizationUserId, recordedAt: now }).onConflictDoNothing().returning();
      if (inserted[0] && BigInt(nextHistoryId) > BigInt(baselineHistoryId)) await tx.update(eosProviderIngressRegistrations).set({ watchHistoryId: nextHistoryId, updatedAt: now }).where(and(eq(eosProviderIngressRegistrations.id, registration.id), eq(eosProviderIngressRegistrations.watchHistoryId, baselineHistoryId)));
      return inserted;
    });
    return attempt ? { processed: true, outcome: "succeeded" as const, attempt } : { processed: false, reason: "concurrent_attempt" as const };
  } catch (error) {
    return recordFailure(error, "gmail_reconciliation", { observedHistoryId: registration.watchHistoryId, targetHistoryId });
  }
}

export async function reconcileDueProviderIngressEventsOnce(options: { now?: Date; limit?: number; clients?: Clients } = {}) {
  if (!providerExecutionEnabled()) return 0;
  const now = options.now || new Date(); const limit = Math.min(100, Math.max(1, options.limit || 25));
  const events = await db.select().from(eosProviderIngressEvents).where(eq(eosProviderIngressEvents.processingState, "reconciliation_required")).orderBy(asc(eosProviderIngressEvents.receivedAt)).limit(limit * 4);
  let processed = 0;
  for (const event of events) {
    if (processed >= limit) break;
    const result = await reconcileProviderIngressEventOnce(event.id, { now, clients: options.clients });
    if (result.processed) processed += 1;
  }
  return processed;
}

export async function renewGmailWatchOnce(registrationId: string, options: { now?: Date; clients?: Clients } = {}) {
  if (!providerExecutionEnabled()) return { processed: false, reason: "provider_effects_disabled" as const };
  const now = options.now || new Date(); const clients = options.clients || liveClients;
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`provider-ingress-watch:${registrationId}`}))`);
    const [registration] = await tx.select().from(eosProviderIngressRegistrations).where(and(eq(eosProviderIngressRegistrations.id, registrationId), eq(eosProviderIngressRegistrations.provider, "gmail"), eq(eosProviderIngressRegistrations.state, "active"))).limit(1);
    if (!registration) return { processed: false, reason: "registration_unavailable" as const };
    const prior = await tx.select().from(eosProviderIngressWatchAttempts).where(eq(eosProviderIngressWatchAttempts.registrationId, registration.id)).orderBy(desc(eosProviderIngressWatchAttempts.attemptNumber)).limit(RECONCILIATION_MAX_ATTEMPTS);
    const latest = prior[0];
    if (latest?.outcome === "retry_scheduled" && latest.nextAttemptAt && latest.nextAttemptAt > now) return { processed: false, reason: "retry_not_due" as const };
    if (latest?.outcome === "dead_letter") return { processed: false, reason: "dead_letter" as const };
    const attemptNumber = (latest?.attemptNumber || 0) + 1;
    let receipt: Awaited<ReturnType<Clients["startMailboxWatch"]>>;
    try {
      receipt = await clients.startMailboxWatch(registration.authorizationUserId, registration.topicName, registration.providerAccountReference);
    } catch (error) {
      const firstPriorSuccess = prior.findIndex((item) => item.outcome === "succeeded");
      const failureCount = firstPriorSuccess === -1 ? prior.length + 1 : firstPriorSuccess + 1;
      const terminal = failureCount >= RECONCILIATION_MAX_ATTEMPTS;
      const outcome = terminal ? "dead_letter" : "retry_scheduled";
      const nextAttemptAt = terminal ? null : new Date(now.getTime() + RETRY_DELAYS_MS[Math.min(failureCount - 1, RETRY_DELAYS_MS.length - 1)]);
      const code = failureCode(error, "watch");
      const receiptSha256 = nativeContractContentSha256({ registrationId: registration.id, attemptNumber, outcome, code, recordedAt: now.toISOString() });
      const [attempt] = await tx.insert(eosProviderIngressWatchAttempts).values({ id: randomUUID(), companyId: registration.companyId, registrationId: registration.id, attemptNumber, trigger: "worker", outcome, historyId: "", expiresAt: null, summary: terminal ? "Gmail watch renewal exhausted its retry budget and requires operator action." : "Gmail watch renewal failed and has been scheduled for bounded retry.", failureCode: code, nextAttemptAt, receiptSha256, recordedByUserId: registration.authorizationUserId, recordedAt: now }).returning();
      if (terminal && registration.watchExpiresAt && registration.watchExpiresAt <= now) await tx.update(eosProviderIngressRegistrations).set({ state: "failed", updatedAt: now }).where(eq(eosProviderIngressRegistrations.id, registration.id));
      if (terminal) await tx.insert(notifications).values(terminalNotification({ attemptId: attempt.id, userId: registration.authorizationUserId, companyId: registration.companyId, registrationId: registration.id, title: "Gmail mailbox watch needs attention", content: `Mailbox-watch renewal stopped after its bounded retry budget (${code}). Repair authorization or configuration, then renew it from Integration Operations.`, failureCode: code })).onConflictDoNothing();
      return { processed: true, outcome, attempt };
    }
    const projection = { registrationId: registration.id, attemptNumber, historyId: receipt.historyId, expiresAt: receipt.expiresAt.toISOString(), recordedAt: now.toISOString() };
    const receiptSha256 = nativeContractContentSha256(projection);
    const [attempt] = await tx.insert(eosProviderIngressWatchAttempts).values({ id: randomUUID(), companyId: registration.companyId, registrationId: registration.id, attemptNumber, trigger: "worker", outcome: "succeeded", historyId: receipt.historyId, expiresAt: receipt.expiresAt, summary: "Gmail mailbox watch renewed from an exact provider receipt.", failureCode: "", nextAttemptAt: null, receiptSha256, recordedByUserId: registration.authorizationUserId, recordedAt: now }).returning();
    await tx.update(eosProviderIngressRegistrations).set({ state: "active", watchHistoryId: registration.watchHistoryId || receipt.historyId, watchExpiresAt: receipt.expiresAt, updatedAt: now }).where(eq(eosProviderIngressRegistrations.id, registration.id));
    return { processed: true, outcome: "succeeded" as const, attempt };
  });
}

export async function renewGoogleChannelOnce(registrationId: string, options: { now?: Date; clients?: Clients } = {}) {
  if (!providerExecutionEnabled()) return { processed: false, reason: "provider_effects_disabled" as const };
  const now = options.now || new Date(); const clients = options.clients || liveClients;
  const origin = process.env.EOS_PUBLIC_ORIGIN || "";
  let baseUrl: URL;
  try { baseUrl = new URL(origin); } catch { return { processed: false, reason: "public_origin_unavailable" as const }; }
  if (baseUrl.protocol !== "https:") return { processed: false, reason: "public_origin_unavailable" as const };
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`provider-ingress-watch:${registrationId}`}))`);
    const [registration] = await tx.select().from(eosProviderIngressRegistrations).where(and(eq(eosProviderIngressRegistrations.id, registrationId), inArray(eosProviderIngressRegistrations.provider, ["google_drive", "google_calendar"]), eq(eosProviderIngressRegistrations.state, "active"))).limit(1);
    if (!registration) return { processed: false, reason: "registration_unavailable" as const };
    const prior = await tx.select().from(eosProviderIngressWatchAttempts).where(eq(eosProviderIngressWatchAttempts.registrationId, registration.id)).orderBy(desc(eosProviderIngressWatchAttempts.attemptNumber)).limit(RECONCILIATION_MAX_ATTEMPTS);
    const latest = prior[0];
    if (latest?.outcome === "retry_scheduled" && latest.nextAttemptAt && latest.nextAttemptAt > now) return { processed: false, reason: "retry_not_due" as const };
    if (latest?.outcome === "dead_letter") return { processed: false, reason: "dead_letter" as const };
    const attemptNumber = (latest?.attemptNumber || 0) + 1;
    const channelId = randomUUID(); const channelToken = randomUUID() + randomUUID(); const callbackUrl = new URL(`/api/eos/provider-ingress/${registration.provider}/${registration.id}`, baseUrl).toString();
    try {
      const receipt = registration.provider === "google_drive"
        ? await (async () => { const baseline = registration.reconciliationCursor || (await clients.getDriveStartPageToken(registration.authorizationUserId, registration.providerAccountReference)).cursor; return clients.startDriveChangesWatch(registration.authorizationUserId, { channelId, channelToken, callbackUrl, pageToken: baseline, expectedEmailAddress: registration.providerAccountReference }); })()
        : await clients.startCalendarWatch(registration.authorizationUserId, { channelId, channelToken, callbackUrl, calendarId: registration.resourceCollectionReference, expectedEmailAddress: registration.providerAccountReference });
      const tokenFingerprint = createHash("sha256").update(channelToken).digest("hex");
      const projection = { registrationId: registration.id, provider: registration.provider, attemptNumber, channelId: receipt.channelId, resourceId: receipt.resourceId, cursorSha256: createHash("sha256").update(receipt.cursor).digest("hex"), expiresAt: receipt.expiresAt.toISOString(), tokenFingerprint, recordedAt: now.toISOString() };
      const receiptSha256 = nativeContractContentSha256(projection);
      const [attempt] = await tx.insert(eosProviderIngressWatchAttempts).values({ id: randomUUID(), companyId: registration.companyId, registrationId: registration.id, attemptNumber, trigger: "worker", outcome: "succeeded", historyId: receipt.cursor, expiresAt: receipt.expiresAt, summary: `${registration.provider === "google_drive" ? "Google Drive" : "Google Calendar"} resource channel renewed from an exact provider receipt.`, failureCode: "", nextAttemptAt: null, receiptSha256, recordedByUserId: registration.authorizationUserId, recordedAt: now }).returning();
      await tx.update(eosProviderIngressRegistrations).set({ providerSubscriptionReference: receipt.channelId, providerResourceReference: receipt.resourceId, reconciliationCursor: receipt.cursor, watchHistoryId: receipt.cursor, watchExpiresAt: receipt.expiresAt, verificationTokenCiphertext: encryptCredential(channelToken), verificationTokenFingerprint: tokenFingerprint, updatedAt: now }).where(eq(eosProviderIngressRegistrations.id, registration.id));
      return { processed: true, outcome: "succeeded" as const, attempt, priorChannelId: registration.providerSubscriptionReference, priorResourceId: registration.providerResourceReference, registration };
    } catch (error) {
      const firstPriorSuccess = prior.findIndex((item) => item.outcome === "succeeded"); const failureCount = firstPriorSuccess === -1 ? prior.length + 1 : firstPriorSuccess + 1;
      const terminal = failureCount >= RECONCILIATION_MAX_ATTEMPTS; const outcome = terminal ? "dead_letter" : "retry_scheduled"; const nextAttemptAt = terminal ? null : new Date(now.getTime() + RETRY_DELAYS_MS[Math.min(failureCount - 1, RETRY_DELAYS_MS.length - 1)]); const code = failureCode(error, "watch");
      const receiptSha256 = nativeContractContentSha256({ registrationId: registration.id, attemptNumber, outcome, code, recordedAt: now.toISOString() });
      const [attempt] = await tx.insert(eosProviderIngressWatchAttempts).values({ id: randomUUID(), companyId: registration.companyId, registrationId: registration.id, attemptNumber, trigger: "worker", outcome, historyId: "", expiresAt: null, summary: terminal ? "Google resource channel renewal exhausted its retry budget and requires operator action." : "Google resource channel renewal failed and has been scheduled for bounded retry.", failureCode: code, nextAttemptAt, receiptSha256, recordedByUserId: registration.authorizationUserId, recordedAt: now }).returning();
      if (terminal && registration.watchExpiresAt && registration.watchExpiresAt <= now) await tx.update(eosProviderIngressRegistrations).set({ state: "failed", updatedAt: now }).where(eq(eosProviderIngressRegistrations.id, registration.id));
      if (terminal) await tx.insert(notifications).values(terminalNotification({ attemptId: attempt.id, userId: registration.authorizationUserId, companyId: registration.companyId, registrationId: registration.id, title: "Google resource channel needs attention", content: `Resource-channel renewal stopped after its bounded retry budget (${code}). Repair authorization or configuration, then renew it from Integration Operations.`, failureCode: code })).onConflictDoNothing();
      return { processed: true, outcome, attempt };
    }
  });
  if ("priorChannelId" in result && result.priorChannelId && result.priorResourceId) void clients.stopGoogleChannel(result.registration.authorizationUserId, result.priorChannelId, result.priorResourceId).catch(() => undefined);
  return result;
}

export async function renewExpiringGmailWatchesOnce(options: { now?: Date; renewBeforeMs?: number; limit?: number; clients?: Clients } = {}) {
  if (!providerExecutionEnabled()) return 0;
  const now = options.now || new Date(); const limit = Math.min(100, Math.max(1, options.limit || 25));
  const registrations = await db.select().from(eosProviderIngressRegistrations).where(and(eq(eosProviderIngressRegistrations.provider, "gmail"), eq(eosProviderIngressRegistrations.state, "active"))).orderBy(asc(eosProviderIngressRegistrations.watchExpiresAt)).limit(1000);
  const policies = registrations.length ? await db.select().from(eosProviderIngressPolicies).where(inArray(eosProviderIngressPolicies.registrationId, registrations.map((item) => item.id))) : [];
  const due = registrations.filter((registration) => {
    if (!registration.watchExpiresAt) return true;
    const configuredMs = (policies.find((item) => item.registrationId === registration.id)?.watchRenewBeforeMinutes || 1440) * 60_000;
    const renewBeforeMs = options.renewBeforeMs === undefined ? configuredMs : Math.min(6 * 24 * 60 * 60_000, Math.max(60_000, options.renewBeforeMs));
    return registration.watchExpiresAt.getTime() <= now.getTime() + renewBeforeMs;
  }).slice(0, limit);
  let processed = 0; for (const registration of due) { const result = await renewGmailWatchOnce(registration.id, { now, clients: options.clients }); if (result.processed) processed += 1; } return processed;
}

export async function renewExpiringGoogleChannelsOnce(options: { now?: Date; renewBeforeMs?: number; limit?: number; clients?: Clients } = {}) {
  if (!providerExecutionEnabled()) return 0;
  const now = options.now || new Date(); const limit = Math.min(100, Math.max(1, options.limit || 25));
  const registrations = await db.select().from(eosProviderIngressRegistrations).where(and(inArray(eosProviderIngressRegistrations.provider, ["google_drive", "google_calendar"]), eq(eosProviderIngressRegistrations.state, "active"))).orderBy(asc(eosProviderIngressRegistrations.watchExpiresAt)).limit(1000);
  const policies = registrations.length ? await db.select().from(eosProviderIngressPolicies).where(inArray(eosProviderIngressPolicies.registrationId, registrations.map((item) => item.id))) : [];
  const due = registrations.filter((registration) => { if (!registration.watchExpiresAt) return true; const configuredMs = (policies.find((item) => item.registrationId === registration.id)?.watchRenewBeforeMinutes || 1440) * 60_000; const renewBeforeMs = options.renewBeforeMs === undefined ? configuredMs : Math.min(6 * 24 * 60 * 60_000, Math.max(60_000, options.renewBeforeMs)); return registration.watchExpiresAt.getTime() <= now.getTime() + renewBeforeMs; }).slice(0, limit);
  let processed = 0; for (const registration of due) { const renewed = await renewGoogleChannelOnce(registration.id, { now, clients: options.clients }); if (renewed.processed) processed += 1; } return processed;
}

export function startProviderIngressWorker(options: { intervalMs?: number } = {}) {
  const configured = options.intervalMs || Number(process.env.EOS_PROVIDER_INGRESS_WORKER_INTERVAL_MS || 60_000); const intervalMs = Math.min(15 * 60_000, Math.max(10_000, Number.isFinite(configured) ? configured : 60_000));
  if (!providerExecutionEnabled()) return () => {};
  const tick = async () => { try { const reconciled = await reconcileDueProviderIngressEventsOnce(); const renewedGmail = await renewExpiringGmailWatchesOnce(); const renewedGoogleChannels = await renewExpiringGoogleChannelsOnce(); const alerts = await dispatchProviderIngressAlertsOnce(); if (reconciled || renewedGmail || renewedGoogleChannels || alerts.processed) writeLog("info", "provider_ingress_worker_completed", { reconciled, renewedGmail, renewedGoogleChannels, alerts }); } catch (error) { writeLog("error", "provider_ingress_worker_failed", { error }); } };
  const timer = setInterval(() => void tick(), intervalMs); timer.unref(); void tick(); return () => clearInterval(timer);
}
