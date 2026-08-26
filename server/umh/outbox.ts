import { and, eq, asc, lt, lte, isNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import { umhEventOutbox, umhInstallations } from "@shared/schema";
import { FEDERATION_PROTOCOL_VERSION } from "./contracts";
import { federationConfig, outboundFederationConfigured } from "./config";
import { signFederationMessage } from "./crypto";

const MAX_BATCH_SIZE = 20;

function retryAt(attempts: number): Date {
  // 5s, 10s, 20s… capped at five minutes. Delivery is at-least-once.
  return new Date(Date.now() + Math.min(300_000, 5_000 * 2 ** Math.max(0, attempts - 1)));
}

export async function deliverFederationOutboxOnce(): Promise<number> {
  const config = federationConfig();
  if (!outboundFederationConfigured(config)) return 0;
  const [installation] = await db.select({ id: umhInstallations.id }).from(umhInstallations).where(and(
    eq(umhInstallations.umhInstallationId, config.installationId),
    eq(umhInstallations.issuer, config.issuer),
    eq(umhInstallations.enabled, true),
  )).limit(1);
  if (!installation) return 0;

  // A process can stop after claiming a row. Releasing old leases makes the
  // durable outbox recoverable across deployments and restarts.
  await db.update(umhEventOutbox)
    .set({ status: "pending", leasedAt: null })
    .where(and(
      eq(umhEventOutbox.installationId, installation.id),
      eq(umhEventOutbox.status, "delivering"),
      lt(umhEventOutbox.leasedAt, new Date(Date.now() - 60_000)),
    ));

  const candidates = await db.select().from(umhEventOutbox)
    .where(and(
      eq(umhEventOutbox.installationId, installation.id),
      eq(umhEventOutbox.status, "pending"),
      or(isNull(umhEventOutbox.nextAttemptAt), lte(umhEventOutbox.nextAttemptAt, sql`now()`)),
    ))
    .orderBy(asc(umhEventOutbox.createdAt))
    .limit(MAX_BATCH_SIZE);
  let delivered = 0;

  for (const candidate of candidates) {
    // Conditional claim prevents a second local worker from sending the same row
    // concurrently. Receiver idempotency still remains mandatory.
    const [claimed] = await db.update(umhEventOutbox)
      .set({ status: "delivering", attempts: candidate.attempts + 1, leasedAt: new Date() })
      .where(and(eq(umhEventOutbox.id, candidate.id), eq(umhEventOutbox.installationId, installation.id), eq(umhEventOutbox.status, "pending")))
      .returning();
    if (!claimed) continue;

    const payload = claimed.payload as Record<string, unknown>;
    const envelope = {
      protocolVersion: FEDERATION_PROTOCOL_VERSION,
      eventId: claimed.id,
      eventType: claimed.eventType,
      installationId: config.installationId,
      occurredAt: (claimed.createdAt || new Date()).toISOString(),
      traceId: typeof payload.traceId === "string" ? payload.traceId : undefined,
      correlationId: typeof payload.correlationId === "string" ? payload.correlationId : undefined,
      payload,
    };
    try {
      const response = await fetch(config.eventEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-eos-signature": signFederationMessage(envelope, config.eventPrivateKeyPem),
          "x-eos-installation-id": config.installationId,
        },
        body: JSON.stringify(envelope),
      });
      if (!response.ok) throw new Error(`UMH event endpoint returned ${response.status}`);
      await db.update(umhEventOutbox).set({ status: "delivered", deliveredAt: new Date(), leasedAt: null })
        .where(and(eq(umhEventOutbox.id, claimed.id), eq(umhEventOutbox.installationId, installation.id)));
      delivered += 1;
    } catch (error) {
      // Error detail stays local; it is deliberately not copied into an event payload.
      console.warn("UMH outbox delivery deferred", { eventId: claimed.id, error: error instanceof Error ? error.message : "unknown" });
      await db.update(umhEventOutbox).set({ status: "pending", nextAttemptAt: retryAt(claimed.attempts), leasedAt: null })
        .where(and(eq(umhEventOutbox.id, claimed.id), eq(umhEventOutbox.installationId, installation.id)));
    }
  }
  return delivered;
}

export function startFederationOutboxWorker(intervalMs = 5_000): () => void {
  const timer = setInterval(() => {
    void deliverFederationOutboxOnce();
  }, intervalMs);
  timer.unref();
  void deliverFederationOutboxOnce();
  return () => clearInterval(timer);
}
