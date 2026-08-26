import { and, eq } from "drizzle-orm";
import { eosEsignEnvelopes } from "@shared/schema";
import { db } from "../db";
import { writeLog } from "../observability/logger";
import { backUpEnvelopeCustody, custodySummary, ensureEnvelopeCustodyInventory, verifyEnvelopeCustody } from "./custody";

const DEFAULT_RECHECK_MS = 24 * 60 * 60 * 1_000;
const DEFAULT_BATCH = 10;
let running = false;

export async function reconcileNativeEsignCustodyOnce(input: { now?: Date; recheckMs?: number; batch?: number; companyId?: number } = {}): Promise<{ checked: number; backedUp: number; problems: number }> {
  if (running) return { checked: 0, backedUp: 0, problems: 0 };
  running = true;
  try {
    const now = input.now || new Date();
    const cutoff = new Date(now.getTime() - (input.recheckMs || DEFAULT_RECHECK_MS));
    const batch = input.batch || DEFAULT_BATCH;
    const envelopes = await db.select().from(eosEsignEnvelopes).where(input.companyId === undefined ? eq(eosEsignEnvelopes.state, "completed") : and(eq(eosEsignEnvelopes.state, "completed"), eq(eosEsignEnvelopes.companyId, input.companyId)))
      .orderBy(eosEsignEnvelopes.completedAt).limit(Math.max(batch * 5, 25));
    let checked = 0; let backedUp = 0; let problems = 0;
    for (const envelope of envelopes) {
      if (checked >= batch) break;
      try {
        await ensureEnvelopeCustodyInventory(envelope.companyId, envelope.id);
        const before = await custodySummary(envelope.companyId, envelope.id);
        if (!before) continue;
        const due = before.artifacts.some((artifact) => artifact.state !== "deleted" && (!artifact.lastVerifiedAt || artifact.lastVerifiedAt < cutoff));
        if (!due) continue;
        const verification = await verifyEnvelopeCustody(envelope.companyId, envelope.id, null);
        checked += 1;
        if (verification.state !== "passed") problems += 1;
        const after = await custodySummary(envelope.companyId, envelope.id);
        if (verification.state === "passed" && after?.policy?.backupRequired && after.backupConfigured && after.artifacts.some((artifact) => artifact.state === "active" && artifact.backupState !== "verified")) {
          const backup = await backUpEnvelopeCustody(envelope.companyId, envelope.id, null);
          if (backup.state === "passed") backedUp += 1;
          else problems += 1;
        }
        writeLog(verification.state === "passed" ? "info" : "error", "native_esign_custody_reconciled", {
          companyId: envelope.companyId, envelopeId: envelope.id, state: verification.state,
          artifactCount: verification.results.length,
        });
      } catch (error) {
        problems += 1;
        writeLog("error", "native_esign_custody_reconciliation_failed", {
          companyId: envelope.companyId, envelopeId: envelope.id,
          error: error instanceof Error ? error.message : "unknown_error",
        });
      }
    }
    return { checked, backedUp, problems };
  } finally { running = false; }
}

export function startNativeEsignCustodyWorker(intervalMs = 60 * 60 * 1_000): () => void {
  const timer = setInterval(() => { void reconcileNativeEsignCustodyOnce(); }, intervalMs);
  timer.unref();
  void reconcileNativeEsignCustodyOnce();
  return () => clearInterval(timer);
}
