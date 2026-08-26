import { and, asc, eq, lt, lte } from "drizzle-orm";
import { eosEsignEnvelopes, eosEsignRecipients, eosEsignReminderSchedules } from "@shared/schema";
import { db } from "../db";
import { writeLog } from "../observability/logger";
import { deliverNativeEsignRecipient } from "./recipient-delivery";

export async function deliverNativeEsignRemindersOnce(now = new Date()): Promise<number> {
  await db.update(eosEsignReminderSchedules).set({ state: "active", leasedAt: null, lastFailureCode: "reminder_lease_expired", updatedAt: now })
    .where(and(eq(eosEsignReminderSchedules.state, "delivering"), lt(eosEsignReminderSchedules.leasedAt, new Date(now.getTime() - 90_000))));
  const due = await db.select().from(eosEsignReminderSchedules).where(and(eq(eosEsignReminderSchedules.state, "active"), lte(eosEsignReminderSchedules.nextReminderAt, now))).orderBy(asc(eosEsignReminderSchedules.nextReminderAt)).limit(20);
  let delivered = 0;
  for (const schedule of due) {
    const [claimed] = await db.update(eosEsignReminderSchedules).set({ state: "delivering", leasedAt: now, version: schedule.version + 1, updatedAt: now }).where(and(eq(eosEsignReminderSchedules.id, schedule.id), eq(eosEsignReminderSchedules.state, "active"), eq(eosEsignReminderSchedules.version, schedule.version))).returning();
    if (!claimed) continue;
    const [context] = await db.select({ envelope: eosEsignEnvelopes, recipient: eosEsignRecipients }).from(eosEsignEnvelopes).innerJoin(eosEsignRecipients, eq(eosEsignRecipients.id, schedule.recipientId)).where(and(eq(eosEsignEnvelopes.id, schedule.envelopeId), eq(eosEsignEnvelopes.companyId, schedule.companyId))).limit(1);
    if (!context || !["issued", "in_progress"].includes(context.envelope.state) || !["sent", "opened", "consented"].includes(context.recipient.state)) {
      await db.update(eosEsignReminderSchedules).set({ state: "completed", leasedAt: null, version: claimed.version + 1, updatedAt: now }).where(and(eq(eosEsignReminderSchedules.id, claimed.id), eq(eosEsignReminderSchedules.state, "delivering"), eq(eosEsignReminderSchedules.version, claimed.version)));
      continue;
    }
    const result = await deliverNativeEsignRecipient({ companyId: schedule.companyId, envelopeId: schedule.envelopeId, recipientId: schedule.recipientId, requestedByUserId: schedule.requestedByUserId, actorType: "system" });
    const sentCount = schedule.sentCount + (result.outcome === "delivered" ? 1 : 0);
    const terminal = sentCount >= schedule.maxReminders;
    await db.update(eosEsignReminderSchedules).set({ state: terminal ? "completed" : result.outcome === "failed" ? "failed" : "active", sentCount, nextReminderAt: new Date(now.getTime() + schedule.intervalDays * 86_400_000), lastFailureCode: result.failureCode || "", leasedAt: null, version: claimed.version + 1, updatedAt: new Date() }).where(and(eq(eosEsignReminderSchedules.id, claimed.id), eq(eosEsignReminderSchedules.state, "delivering"), eq(eosEsignReminderSchedules.version, claimed.version)));
    if (result.outcome === "delivered") delivered += 1;
  }
  return delivered;
}

export function startNativeEsignReminderWorker(intervalMs = 30_000): () => void {
  const run = () => void deliverNativeEsignRemindersOnce().catch((error) => writeLog("error", "native_esign_reminder_worker_failed", { error }));
  const timer = setInterval(run, intervalMs); timer.unref(); run(); return () => clearInterval(timer);
}
