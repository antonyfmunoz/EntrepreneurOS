import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { companies, eosEsignDeliveryAttempts, eosEsignDocumentVersions, eosEsignEnvelopes, eosEsignRecipients } from "@shared/schema";
import { db } from "../db";
import * as gmail from "../integrations/gmail";
import { createNativeEsignSecret, nativeEsignTokenDigest, nativeEsignUrl } from "../native-esign-token";
import { appendNativeEsignAuditEvent } from "./events";
import { classifyNativeEsignDeliveryFailure, nativeEsignDeliveryEmail } from "./delivery";
import { nativeEsignRecipientRoutingState } from "@shared/native-esign";

export type NativeEsignRecipientDeliveryResult = {
  outcome: "delivered" | "uncertain" | "failed" | "skipped";
  attemptId?: string; providerMessageReference?: string; failureCode?: string;
};

export async function deliverNativeEsignRecipient(input: {
  companyId: number; envelopeId: string; recipientId: string; requestedByUserId: string;
  actorType?: "operator" | "system"; publicOrigin?: string;
}): Promise<NativeEsignRecipientDeliveryResult> {
  const [context] = await db.select({ envelope: eosEsignEnvelopes, recipient: eosEsignRecipients, document: eosEsignDocumentVersions, company: companies })
    .from(eosEsignEnvelopes).innerJoin(eosEsignRecipients, eq(eosEsignRecipients.envelopeId, eosEsignEnvelopes.id))
    .innerJoin(eosEsignDocumentVersions, eq(eosEsignDocumentVersions.id, eosEsignEnvelopes.documentVersionId))
    .innerJoin(companies, eq(companies.id, eosEsignEnvelopes.companyId))
    .where(and(eq(eosEsignEnvelopes.id, input.envelopeId), eq(eosEsignEnvelopes.companyId, input.companyId), eq(eosEsignRecipients.id, input.recipientId), eq(eosEsignRecipients.companyId, input.companyId))).limit(1);
  if (!context || !["issued", "in_progress"].includes(context.envelope.state) || !["pending", "sent", "opened", "consented"].includes(context.recipient.state) || context.envelope.expiresAt <= new Date() || context.recipient.deliveryAttemptCount >= 20)
    return { outcome: "skipped", failureCode: "native_esign_delivery_not_available" };
  const routingRecipients = await db.select({ routingOrder: eosEsignRecipients.routingOrder, state: eosEsignRecipients.state })
    .from(eosEsignRecipients)
    .where(and(eq(eosEsignRecipients.envelopeId, context.envelope.id), eq(eosEsignRecipients.companyId, input.companyId)));
  if (nativeEsignRecipientRoutingState({
    routingMode: context.envelope.routingMode as "sequential" | "parallel",
    recipients: routingRecipients,
    recipient: context.recipient,
  }) !== "active") return { outcome: "skipped", failureCode: "native_esign_routing_wait" };
  const secret = createNativeEsignSecret();
  const attemptId = randomUUID();
  const preparedAt = new Date();
  const attemptNumber = context.recipient.deliveryAttemptCount + 1;
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM eos_esign_recipients WHERE id = ${context.recipient.id} FOR UPDATE`);
    const current = await tx.query.eosEsignRecipients.findFirst({ where: and(eq(eosEsignRecipients.id, context.recipient.id), eq(eosEsignRecipients.companyId, input.companyId)) });
    if (!current || current.version !== context.recipient.version || current.deliveryAttemptCount !== context.recipient.deliveryAttemptCount) throw new Error("native_esign_delivery_changed");
    await tx.insert(eosEsignDeliveryAttempts).values({ id: attemptId, companyId: input.companyId, envelopeId: input.envelopeId, recipientId: current.id, attemptNumber, channel: "gmail", state: "prepared", tokenDigest: nativeEsignTokenDigest(secret), requestedByUserId: input.requestedByUserId, preparedAt });
    await tx.update(eosEsignRecipients).set({ state: current.state === "pending" ? "sent" : current.state, tokenDigest: nativeEsignTokenDigest(secret), tokenUsedAt: null, sentAt: preparedAt, deliveryState: "sending", deliveryAttemptCount: attemptNumber, lastDeliveryAttemptId: attemptId, providerMessageReference: "", version: current.version + 1, updatedAt: preparedAt }).where(and(eq(eosEsignRecipients.id, current.id), eq(eosEsignRecipients.version, current.version)));
    await appendNativeEsignAuditEvent(tx, { companyId: input.companyId, envelopeId: input.envelopeId, recipientId: current.id, eventType: "delivery_prepared", actorType: input.actorType || "system", actorReference: input.requestedByUserId, eventProjection: { attemptId, attemptNumber, channel: "gmail" } });
  });
  const signingUrl = nativeEsignUrl(secret, input.publicOrigin || new URL(process.env.EOS_PUBLIC_ORIGIN || "http://localhost:5000").origin);
  const email = nativeEsignDeliveryEmail({ signerName: context.recipient.signerName, companyName: context.company.name, documentTitle: context.document.title, envelopeSubject: context.envelope.subject, envelopeMessage: context.envelope.message, signingUrl, expiresAt: context.envelope.expiresAt });
  let messageId = "";
  try {
    const receipt = await gmail.sendEmail(input.requestedByUserId, { to: context.recipient.signerEmail, ...email });
    if (!receipt.messageId) throw new Error("Gmail returned no message receipt.");
    messageId = receipt.messageId;
  } catch (error) {
    const failure = classifyNativeEsignDeliveryFailure(error);
    const completedAt = new Date();
    await db.transaction(async (tx) => {
      await tx.update(eosEsignDeliveryAttempts).set({ state: failure.state, failureCode: failure.code, failureMessage: failure.safeMessage, completedAt }).where(and(eq(eosEsignDeliveryAttempts.id, attemptId), eq(eosEsignDeliveryAttempts.state, "prepared")));
      await tx.update(eosEsignRecipients).set({ deliveryState: failure.state, version: sql`${eosEsignRecipients.version} + 1`, updatedAt: completedAt }).where(and(eq(eosEsignRecipients.id, input.recipientId), eq(eosEsignRecipients.lastDeliveryAttemptId, attemptId), eq(eosEsignRecipients.deliveryState, "sending")));
      await appendNativeEsignAuditEvent(tx, { companyId: input.companyId, envelopeId: input.envelopeId, recipientId: input.recipientId, eventType: "delivery_failed", actorType: "provider", actorReference: "gmail", eventProjection: { attemptId, attemptNumber, deliveryState: failure.state, failureCode: failure.code } });
    });
    return { outcome: failure.state === "uncertain" ? "uncertain" : "failed", attemptId, failureCode: failure.code };
  }
  const deliveredAt = new Date();
  await db.transaction(async (tx) => {
    await tx.update(eosEsignDeliveryAttempts).set({ state: "delivered", providerMessageReference: messageId, completedAt: deliveredAt }).where(and(eq(eosEsignDeliveryAttempts.id, attemptId), eq(eosEsignDeliveryAttempts.state, "prepared")));
    await tx.update(eosEsignRecipients).set({ deliveryState: "delivered", lastDeliveredAt: deliveredAt, providerMessageReference: messageId, version: sql`${eosEsignRecipients.version} + 1`, updatedAt: deliveredAt }).where(and(eq(eosEsignRecipients.id, input.recipientId), eq(eosEsignRecipients.lastDeliveryAttemptId, attemptId), eq(eosEsignRecipients.deliveryState, "sending")));
    await appendNativeEsignAuditEvent(tx, { companyId: input.companyId, envelopeId: input.envelopeId, recipientId: input.recipientId, eventType: "delivery_succeeded", actorType: "provider", actorReference: "gmail", eventProjection: { attemptId, attemptNumber, providerMessageReference: messageId } });
  });
  return { outcome: "delivered", attemptId, providerMessageReference: messageId };
}
