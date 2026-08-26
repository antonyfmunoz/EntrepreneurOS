import { and, desc, eq } from "drizzle-orm";
import { eosEsignEnvelopes, eosEsignIntegrityChecks } from "@shared/schema";
import { db } from "../db";
import { writeLog } from "../observability/logger";
import { recordNativeEsignIntegrityCheck, verifyNativeEsignEnvelopeIntegrity } from "./integrity";

const DEFAULT_RECHECK_MS = 24 * 60 * 60 * 1_000;
const DEFAULT_BATCH = 10;
let running = false;

export async function verifyScheduledNativeEsignIntegrityOnce(input: { now?: Date; recheckMs?: number; batch?: number; companyId?: number } = {}): Promise<{ checked: number; problems: number }> {
  if (running) return { checked: 0, problems: 0 };
  running = true;
  try {
    const now = input.now || new Date();
    const cutoff = new Date(now.getTime() - (input.recheckMs || DEFAULT_RECHECK_MS));
    const completed = await db.select().from(eosEsignEnvelopes)
      .where(input.companyId === undefined ? eq(eosEsignEnvelopes.state, "completed") : and(eq(eosEsignEnvelopes.state, "completed"), eq(eosEsignEnvelopes.companyId, input.companyId)))
      .orderBy(eosEsignEnvelopes.completedAt).limit(Math.max((input.batch || DEFAULT_BATCH) * 5, 25));
    let checked = 0;
    let problems = 0;
    for (const envelope of completed) {
      if (checked >= (input.batch || DEFAULT_BATCH)) break;
      const [latest] = await db.select().from(eosEsignIntegrityChecks)
        .where(eq(eosEsignIntegrityChecks.envelopeId, envelope.id))
        .orderBy(desc(eosEsignIntegrityChecks.checkedAt)).limit(1);
      if (latest && latest.checkedAt > cutoff) continue;
      try {
        const report = await verifyNativeEsignEnvelopeIntegrity(envelope.id);
        await recordNativeEsignIntegrityCheck({
          report, companyId: envelope.companyId, triggerType: "scheduled",
          reason: "Scheduled completed-envelope evidence recheck.",
        });
        checked += 1;
        if (report.state !== "passed") problems += 1;
        writeLog(report.state === "passed" ? "info" : "error", "native_esign_integrity_rechecked", {
          companyId: envelope.companyId, envelopeId: envelope.id, state: report.state,
          failureCodes: report.failureCodes, eventCount: report.eventCount, captureCount: report.captureCount,
        });
      } catch (error) {
        problems += 1;
        writeLog("error", "native_esign_integrity_recheck_failed", {
          companyId: envelope.companyId, envelopeId: envelope.id,
          error: error instanceof Error ? error.message : "unknown_error",
        });
      }
    }
    return { checked, problems };
  } finally {
    running = false;
  }
}

export function startNativeEsignIntegrityWorker(intervalMs = 60 * 60 * 1_000): () => void {
  const timer = setInterval(() => { void verifyScheduledNativeEsignIntegrityOnce(); }, intervalMs);
  timer.unref();
  void verifyScheduledNativeEsignIntegrityOnce();
  return () => clearInterval(timer);
}
