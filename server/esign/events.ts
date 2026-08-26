import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { eosEsignEvents, eosEsignWebhookDeliveries, eosEsignWebhookSubscriptions } from "@shared/schema";
import { nativeEsignAuditEventSha256 } from "./audit-chain";

export async function appendNativeEsignAuditEvent(
  executor: any,
  input: {
    companyId: number;
    envelopeId: string;
    recipientId?: string | null;
    eventType: typeof eosEsignEvents.$inferInsert.eventType;
    actorType: "operator" | "signer" | "system" | "provider";
    actorReference?: string;
    eventProjection?: Record<string, any>;
    occurredAt?: Date;
  },
) {
  await executor.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.envelopeId}))`);
  const [latest] = await executor.select().from(eosEsignEvents)
    .where(eq(eosEsignEvents.envelopeId, input.envelopeId))
    .orderBy(desc(eosEsignEvents.sequence)).limit(1);
  const occurredAt = input.occurredAt || new Date();
  const chainInput = {
    envelopeId: input.envelopeId,
    recipientId: input.recipientId || null,
    sequence: (latest?.sequence || 0) + 1,
    eventType: input.eventType,
    actorType: input.actorType,
    actorReference: input.actorReference || "",
    eventProjection: input.eventProjection || {},
    occurredAt: occurredAt.toISOString(),
    previousEventSha256: latest?.eventSha256 || "",
  };
  const [event] = await executor.insert(eosEsignEvents).values({
    id: randomUUID(), companyId: input.companyId, ...chainInput, occurredAt,
    eventSha256: nativeEsignAuditEventSha256(chainInput), recordedAt: new Date(),
  }).returning();
  const subscriptions = await executor.select().from(eosEsignWebhookSubscriptions)
    .where(eq(eosEsignWebhookSubscriptions.companyId, input.companyId));
  const active = subscriptions.filter((subscription: typeof eosEsignWebhookSubscriptions.$inferSelect) => {
    if (subscription.state !== "active") return false;
    const eventTypes = Array.isArray(subscription.eventTypes) ? subscription.eventTypes : [];
    return eventTypes.includes("*") || eventTypes.includes(input.eventType);
  });
  if (active.length) await executor.insert(eosEsignWebhookDeliveries).values(active.map((subscription: typeof eosEsignWebhookSubscriptions.$inferSelect) => ({
    id: randomUUID(), companyId: input.companyId, subscriptionId: subscription.id,
    eventId: event.id, state: "pending", attemptCount: 0, replayCount: 0,
    nextAttemptAt: occurredAt, createdAt: occurredAt, updatedAt: occurredAt,
  }))).onConflictDoNothing();
  return event;
}
