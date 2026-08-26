import { and, eq, inArray, lte, sql } from "drizzle-orm";
import {
  eosEsignEnvelopes,
  eosEsignRecipients,
  eosRecoveryAgreementInstances,
} from "@shared/schema";
import { db } from "../db";
import { writeLog } from "../observability/logger";
import { appendNativeEsignAuditEvent } from "./events";

const ACTIVE_ENVELOPE_STATES = ["issued", "in_progress"];
const ACTIVE_RECIPIENT_STATES = ["pending", "sent", "opened", "consented"];

export async function expireDueNativeEsignEnvelopes(now = new Date(), batchSize = 100): Promise<number> {
  const boundedBatch = Math.max(1, Math.min(Math.trunc(batchSize), 500));
  const candidates = await db.select({ id: eosEsignEnvelopes.id })
    .from(eosEsignEnvelopes)
    .where(and(inArray(eosEsignEnvelopes.state, ACTIVE_ENVELOPE_STATES), lte(eosEsignEnvelopes.expiresAt, now)))
    .orderBy(eosEsignEnvelopes.expiresAt)
    .limit(boundedBatch);
  let expiredCount = 0;
  for (const candidate of candidates) {
    const expired = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM eos_esign_envelopes WHERE id = ${candidate.id} FOR UPDATE`);
      const envelope = await tx.query.eosEsignEnvelopes.findFirst({ where: eq(eosEsignEnvelopes.id, candidate.id) });
      if (!envelope || !ACTIVE_ENVELOPE_STATES.includes(envelope.state) || envelope.expiresAt > now) return false;
      const [updated] = await tx.update(eosEsignEnvelopes).set({
        state: "expired", version: envelope.version + 1, updatedAt: now,
      }).where(and(eq(eosEsignEnvelopes.id, envelope.id), eq(eosEsignEnvelopes.version, envelope.version), inArray(eosEsignEnvelopes.state, ACTIVE_ENVELOPE_STATES))).returning();
      if (!updated) return false;
      await tx.update(eosEsignRecipients).set({ state: "expired", version: sql`${eosEsignRecipients.version} + 1`, updatedAt: now })
        .where(and(eq(eosEsignRecipients.envelopeId, envelope.id), inArray(eosEsignRecipients.state, ACTIVE_RECIPIENT_STATES)));
      if (envelope.recoveryAgreementInstanceId)
        await tx.update(eosRecoveryAgreementInstances).set({ state: "expired", version: sql`${eosRecoveryAgreementInstances.version} + 1`, updatedAt: now })
          .where(and(eq(eosRecoveryAgreementInstances.id, envelope.recoveryAgreementInstanceId), eq(eosRecoveryAgreementInstances.companyId, envelope.companyId), eq(eosRecoveryAgreementInstances.state, "issued")));
      await appendNativeEsignAuditEvent(tx, {
        companyId: envelope.companyId,
        envelopeId: envelope.id,
        eventType: "envelope_expired",
        actorType: "system",
        occurredAt: now,
        eventProjection: { expiresAt: envelope.expiresAt.toISOString() },
      });
      return true;
    });
    if (expired) expiredCount += 1;
  }
  return expiredCount;
}

export function startNativeEsignLifecycleWorker(intervalMs = 5 * 60 * 1000): () => void {
  const boundedInterval = Math.max(30_000, Math.min(Math.trunc(intervalMs), 60 * 60 * 1000));
  const run = () => void expireDueNativeEsignEnvelopes().then((expiredCount) => {
    if (expiredCount) writeLog("info", "native_esign_envelopes_expired", { expiredCount });
  }).catch((error) => writeLog("error", "native_esign_lifecycle_worker_failed", { error }));
  run();
  const timer = setInterval(run, boundedInterval);
  timer.unref();
  return () => clearInterval(timer);
}
