import { createHash, createHmac, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, lt, lte } from "drizzle-orm";
import {
  companies,
  eosEsignCompletionDeliveries,
  eosEsignCompletionDeliveryAttempts,
  eosEsignDocumentVersions,
  eosEsignEnvelopes,
  eosEsignEvents,
  eosEsignRecipients,
  eosEsignWebhookAttempts,
  eosEsignWebhookDeliveries,
  eosEsignWebhookSubscriptions,
} from "@shared/schema";
import { db } from "../db";
import { decryptCredential } from "../security/credential-encryption";
import { writeLog } from "../observability/logger";
import * as gmail from "../integrations/gmail";
import { nativeEsignCompletionEmail, classifyNativeEsignDeliveryFailure } from "./delivery";
import { appendNativeEsignAuditEvent } from "./events";
import { parseNativeEsignWebhookEndpoint, postNativeEsignWebhook } from "./webhook-egress";

const MAX_BATCH = 20;
const MAX_ATTEMPTS_PER_REPLAY = 8;
const LEASE_MS = 90_000;

export function nativeEsignRetryAt(attempt: number, now = Date.now()): Date {
  return new Date(now + Math.min(60 * 60_000, 15_000 * 2 ** Math.max(0, attempt - 1)));
}

function allowedAttempts(replayCount: number): number {
  return MAX_ATTEMPTS_PER_REPLAY * (replayCount + 1);
}

function safeFailure(error: unknown): { code: string; message: string } {
  const message = error instanceof Error ? error.message : "Delivery failed.";
  if (/private|reserved|loopback|resolve|https|port|credentials|fragment/i.test(message))
    return { code: "webhook_endpoint_blocked", message: "The webhook endpoint failed the outbound network policy." };
  if (/decrypt|credential|encryption|secret/i.test(message))
    return { code: "delivery_secret_unavailable", message: "The protected delivery credential is unavailable." };
  if (/abort|timeout/i.test(message))
    return { code: "delivery_timeout", message: "The destination did not respond before the delivery deadline." };
  return { code: "delivery_failed", message: "The destination did not acknowledge the delivery." };
}

function webhookBody(input: {
  deliveryId: string;
  event: typeof eosEsignEvents.$inferSelect;
}): string {
  return JSON.stringify({
    schemaVersion: "eos-native-esign-webhook.v1",
    deliveryId: input.deliveryId,
    event: {
      id: input.event.id,
      companyId: input.event.companyId,
      envelopeId: input.event.envelopeId,
      recipientId: input.event.recipientId,
      sequence: input.event.sequence,
      type: input.event.eventType,
      actorType: input.event.actorType,
      projection: input.event.eventProjection,
      occurredAt: input.event.occurredAt.toISOString(),
      eventSha256: input.event.eventSha256,
      previousEventSha256: input.event.previousEventSha256,
    },
  });
}

export async function deliverNativeEsignWebhooksOnce(): Promise<number> {
  const now = new Date();
  await db.update(eosEsignWebhookDeliveries).set({ state: "retry", leasedAt: null, nextAttemptAt: now, updatedAt: now })
    .where(and(eq(eosEsignWebhookDeliveries.state, "delivering"), lt(eosEsignWebhookDeliveries.leasedAt, new Date(now.getTime() - LEASE_MS))));
  const candidates = await db.select({ delivery: eosEsignWebhookDeliveries }).from(eosEsignWebhookDeliveries)
    .innerJoin(eosEsignWebhookSubscriptions, eq(eosEsignWebhookSubscriptions.id, eosEsignWebhookDeliveries.subscriptionId))
    .where(and(inArray(eosEsignWebhookDeliveries.state, ["pending", "retry"]), lte(eosEsignWebhookDeliveries.nextAttemptAt, now), eq(eosEsignWebhookSubscriptions.state, "active")))
    .orderBy(asc(eosEsignWebhookDeliveries.createdAt)).limit(MAX_BATCH);
  let deliveredCount = 0;
  for (const row of candidates) {
    const candidate = row.delivery;
    const [claimed] = await db.update(eosEsignWebhookDeliveries).set({ state: "delivering", leasedAt: now, attemptCount: candidate.attemptCount + 1, updatedAt: now })
      .where(and(eq(eosEsignWebhookDeliveries.id, candidate.id), inArray(eosEsignWebhookDeliveries.state, ["pending", "retry"]))).returning();
    if (!claimed) continue;
    const [context] = await db.select({ subscription: eosEsignWebhookSubscriptions, event: eosEsignEvents })
      .from(eosEsignWebhookSubscriptions)
      .innerJoin(eosEsignEvents, eq(eosEsignEvents.id, claimed.eventId))
      .where(and(eq(eosEsignWebhookSubscriptions.id, claimed.subscriptionId), eq(eosEsignWebhookSubscriptions.companyId, claimed.companyId))).limit(1);
    const attemptedAt = new Date();
    let httpStatus: number | null = null;
    let outcome: "delivered" | "retry" | "dead_letter" = "retry";
    let failure = { code: "subscription_unavailable", message: "The webhook subscription is unavailable." };
    let requestSha256 = createHash("sha256").update("unavailable").digest("hex");
    try {
      if (!context || context.subscription.state !== "active") throw new Error("Webhook subscription is not active.");
      const endpoint = parseNativeEsignWebhookEndpoint(context.subscription.endpointUrl);
      const body = webhookBody({ deliveryId: claimed.id, event: context.event });
      requestSha256 = createHash("sha256").update(body, "utf8").digest("hex");
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const secret = decryptCredential(context.subscription.secretCiphertext);
      const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex");
      httpStatus = await postNativeEsignWebhook(endpoint, {
          "content-type": "application/json",
          "user-agent": "EntrepreneurOS-Native-Esign/1.0",
          "x-eos-delivery-id": claimed.id,
          "x-eos-event-id": context.event.id,
          "x-eos-timestamp": timestamp,
          "x-eos-signature": `v1=${signature}`,
        }, body);
      if (httpStatus < 200 || httpStatus >= 300) throw new Error(`Webhook returned ${httpStatus}.`);
      outcome = "delivered";
      failure = { code: "", message: "" };
    } catch (error) {
      failure = safeFailure(error);
      outcome = claimed.attemptCount >= allowedAttempts(claimed.replayCount) ? "dead_letter" : "retry";
    }
    const completedAt = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(eosEsignWebhookAttempts).values({
        id: randomUUID(), companyId: claimed.companyId, deliveryId: claimed.id,
        attemptNumber: claimed.attemptCount, requestSha256, outcome, httpStatus,
        failureCode: failure.code, attemptedAt, completedAt,
      });
      await tx.update(eosEsignWebhookDeliveries).set({
        state: outcome, leasedAt: null, deliveredAt: outcome === "delivered" ? completedAt : null,
        nextAttemptAt: outcome === "retry" ? nativeEsignRetryAt(claimed.attemptCount, completedAt.getTime()) : completedAt,
        lastHttpStatus: httpStatus, lastFailureCode: failure.code, lastFailureMessage: failure.message, updatedAt: completedAt,
      }).where(and(eq(eosEsignWebhookDeliveries.id, claimed.id), eq(eosEsignWebhookDeliveries.state, "delivering")));
    });
    writeLog(outcome === "delivered" ? "info" : outcome === "dead_letter" ? "error" : "warn", "native_esign_webhook_delivery_reconciled", {
      companyId: claimed.companyId, deliveryId: claimed.id, subscriptionId: claimed.subscriptionId,
      state: outcome, attemptCount: claimed.attemptCount, httpStatus, failureCode: failure.code || undefined,
    });
    if (outcome === "delivered") deliveredCount += 1;
  }
  return deliveredCount;
}

export async function deliverNativeEsignCompletionsOnce(): Promise<number> {
  const now = new Date();
  await db.update(eosEsignCompletionDeliveries).set({ state: "retry", leasedAt: null, nextAttemptAt: now, updatedAt: now })
    .where(and(eq(eosEsignCompletionDeliveries.state, "delivering"), lt(eosEsignCompletionDeliveries.leasedAt, new Date(now.getTime() - LEASE_MS))));
  const candidates = await db.select().from(eosEsignCompletionDeliveries)
    .where(and(inArray(eosEsignCompletionDeliveries.state, ["pending", "retry"]), lte(eosEsignCompletionDeliveries.nextAttemptAt, now)))
    .orderBy(asc(eosEsignCompletionDeliveries.createdAt)).limit(MAX_BATCH);
  let deliveredCount = 0;
  for (const candidate of candidates) {
    const [claimed] = await db.update(eosEsignCompletionDeliveries).set({ state: "delivering", leasedAt: now, attemptCount: candidate.attemptCount + 1, updatedAt: now })
      .where(and(eq(eosEsignCompletionDeliveries.id, candidate.id), inArray(eosEsignCompletionDeliveries.state, ["pending", "retry"]))).returning();
    if (!claimed) continue;
    const [context] = await db.select({ delivery: eosEsignCompletionDeliveries, recipient: eosEsignRecipients, envelope: eosEsignEnvelopes, document: eosEsignDocumentVersions, company: companies })
      .from(eosEsignCompletionDeliveries)
      .innerJoin(eosEsignRecipients, eq(eosEsignRecipients.id, eosEsignCompletionDeliveries.recipientId))
      .innerJoin(eosEsignEnvelopes, eq(eosEsignEnvelopes.id, eosEsignCompletionDeliveries.envelopeId))
      .innerJoin(eosEsignDocumentVersions, eq(eosEsignDocumentVersions.id, eosEsignEnvelopes.documentVersionId))
      .innerJoin(companies, eq(companies.id, eosEsignCompletionDeliveries.companyId))
      .where(eq(eosEsignCompletionDeliveries.id, claimed.id)).limit(1);
    const attemptedAt = new Date();
    let providerMessageReference = "";
    let outcome: "delivered" | "retry" | "dead_letter" = "retry";
    let failure = { code: "completion_context_unavailable", message: "The completion delivery context is unavailable." };
    try {
      if (!context || context.envelope.state !== "completed" || !context.envelope.completedAt) throw new Error("Completion context is unavailable.");
      const secret = decryptCredential(claimed.tokenCiphertext);
      const origin = new URL(process.env.EOS_PUBLIC_ORIGIN || "").origin;
      const base = `${origin}/api/eos/native-esign/public/completion/${encodeURIComponent(secret)}`;
      const email = nativeEsignCompletionEmail({
        signerName: context.recipient.signerName, companyName: context.company.name,
        documentTitle: context.document.title, completedAt: context.envelope.completedAt,
        completedDocumentUrl: `${base}/document`, receiptUrl: `${base}/receipt`, finalSha256: context.envelope.finalSha256,
      });
      const receipt = await gmail.sendEmail(claimed.requestedByUserId, { to: context.recipient.signerEmail, ...email });
      if (!receipt.messageId) throw new Error("Gmail returned no message receipt.");
      providerMessageReference = receipt.messageId;
      outcome = "delivered";
      failure = { code: "", message: "" };
    } catch (error) {
      const classified = classifyNativeEsignDeliveryFailure(error);
      failure = { code: classified.code, message: classified.safeMessage };
      outcome = claimed.attemptCount >= allowedAttempts(claimed.replayCount) ? "dead_letter" : "retry";
    }
    const completedAt = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(eosEsignCompletionDeliveryAttempts).values({
        id: randomUUID(), companyId: claimed.companyId, deliveryId: claimed.id,
        attemptNumber: claimed.attemptCount, outcome, providerMessageReference,
        failureCode: failure.code, attemptedAt, completedAt,
      });
      await tx.update(eosEsignCompletionDeliveries).set({
        state: outcome, leasedAt: null, providerMessageReference,
        deliveredAt: outcome === "delivered" ? completedAt : null,
        tokenCiphertext: outcome === "delivered" ? "" : claimed.tokenCiphertext,
        nextAttemptAt: outcome === "retry" ? nativeEsignRetryAt(claimed.attemptCount, completedAt.getTime()) : completedAt,
        lastFailureCode: failure.code, lastFailureMessage: failure.message, updatedAt: completedAt,
      }).where(and(eq(eosEsignCompletionDeliveries.id, claimed.id), eq(eosEsignCompletionDeliveries.state, "delivering")));
      await tx.update(eosEsignRecipients).set({
        completionDeliveryState: outcome, completionDeliveryAttemptCount: claimed.attemptCount,
        version: context ? context.recipient.version + 1 : undefined, updatedAt: completedAt,
      }).where(eq(eosEsignRecipients.id, claimed.recipientId));
      if (context) await appendNativeEsignAuditEvent(tx, {
        companyId: claimed.companyId, envelopeId: claimed.envelopeId, recipientId: claimed.recipientId,
        eventType: outcome === "delivered" ? "completion_delivery_succeeded" : "completion_delivery_failed",
        actorType: outcome === "delivered" ? "provider" : "system",
        eventProjection: { deliveryId: claimed.id, attemptNumber: claimed.attemptCount, outcome, providerMessageReference: providerMessageReference || undefined, failureCode: failure.code || undefined },
      });
    });
    writeLog(outcome === "delivered" ? "info" : outcome === "dead_letter" ? "error" : "warn", "native_esign_completion_delivery_reconciled", {
      companyId: claimed.companyId, envelopeId: claimed.envelopeId, recipientId: claimed.recipientId,
      deliveryId: claimed.id, state: outcome, attemptCount: claimed.attemptCount, failureCode: failure.code || undefined,
    });
    if (outcome === "delivered") deliveredCount += 1;
  }
  return deliveredCount;
}

export async function deliverNativeEsignOperationsOnce(): Promise<{ webhooks: number; completions: number }> {
  const [webhooks, completions] = await Promise.all([deliverNativeEsignWebhooksOnce(), deliverNativeEsignCompletionsOnce()]);
  return { webhooks, completions };
}

export function startNativeEsignOperationsWorker(intervalMs = 5_000): () => void {
  const timer = setInterval(() => { void deliverNativeEsignOperationsOnce(); }, intervalMs);
  timer.unref();
  void deliverNativeEsignOperationsOnce();
  return () => clearInterval(timer);
}
