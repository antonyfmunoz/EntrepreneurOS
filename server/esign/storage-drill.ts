import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { eosEsignStorageDrills } from "@shared/schema";
import { db } from "../db";
import {
  backUpNativeEsignArtifact,
  nativeEsignBackupConfigured,
  nativeEsignStorageIdentitySha256,
  nativeEsignStorageProvider,
  probeNativeEsignStoragePlane,
  readNativeEsignArtifact,
  removeNativeEsignArtifact,
  restoreNativeEsignArtifact,
  storeNativeEsignArtifact,
} from "../artifacts/native-esign-files";
import { writeLog } from "../observability/logger";

type DrillStep = {
  key: string;
  state: "passed" | "failed";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  failureCode: string;
};

const STALE_DRILL_MS = 30 * 60 * 1_000;

function canonical(value: unknown): string {
  if (value === undefined || value === null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).filter((key) => object[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function failureCode(error: unknown): string {
  const candidate = error instanceof Error ? error.message.split(":")[0] : "native_esign_storage_drill_failed";
  return /^[a-z0-9_.-]{1,200}$/i.test(candidate) ? candidate.toLowerCase() : "native_esign_storage_drill_failed";
}

function receiptSha256(input: {
  id: string;
  companyId: number;
  requestedByUserId: string;
  reason: string;
  state: "passed" | "failed";
  primaryProvider: string;
  backupProvider: string;
  primaryIdentitySha256: string;
  backupIdentitySha256: string;
  capabilitySnapshot: Record<string, unknown>;
  steps: DrillStep[];
  failureCode: string;
  startedAt: Date;
  completedAt: Date;
}): string {
  return sha256(canonical({
    ...input,
    startedAt: input.startedAt.toISOString(),
    completedAt: input.completedAt.toISOString(),
  }));
}

async function closeStaleDrill(companyId: number, now: Date): Promise<void> {
  const [running] = await db.select().from(eosEsignStorageDrills)
    .where(and(eq(eosEsignStorageDrills.companyId, companyId), eq(eosEsignStorageDrills.state, "running")))
    .limit(1);
  if (!running) return;
  if (now.getTime() - running.startedAt.getTime() < STALE_DRILL_MS)
    throw new Error("native_esign_storage_drill_running");
  const steps = [
    ...((Array.isArray(running.steps) ? running.steps : []) as DrillStep[]),
    {
      key: "stale_run_recovered",
      state: "failed" as const,
      startedAt: now.toISOString(),
      completedAt: now.toISOString(),
      durationMs: 0,
      failureCode: "native_esign_storage_drill_abandoned",
    },
  ];
  const capabilities = (running.capabilitySnapshot || {}) as Record<string, unknown>;
  const receipt = receiptSha256({
    id: running.id,
    companyId,
    requestedByUserId: running.requestedByUserId,
    reason: running.reason,
    state: "failed",
    primaryProvider: running.primaryProvider,
    backupProvider: running.backupProvider,
    primaryIdentitySha256: running.primaryIdentitySha256,
    backupIdentitySha256: running.backupIdentitySha256,
    capabilitySnapshot: capabilities,
    steps,
    failureCode: "native_esign_storage_drill_abandoned",
    startedAt: running.startedAt,
    completedAt: now,
  });
  await db.update(eosEsignStorageDrills).set({
    state: "failed", steps, failureCode: "native_esign_storage_drill_abandoned",
    receiptSha256: receipt, completedAt: now,
  }).where(and(eq(eosEsignStorageDrills.id, running.id), eq(eosEsignStorageDrills.state, "running")));
}

export async function listNativeEsignStorageDrills(companyId: number, limit = 20) {
  return db.select().from(eosEsignStorageDrills)
    .where(eq(eosEsignStorageDrills.companyId, companyId))
    .orderBy(desc(eosEsignStorageDrills.startedAt))
    .limit(Math.max(1, Math.min(limit, 100)));
}

export function nativeEsignStorageDrillQualifiesForProduction(
  drill: typeof eosEsignStorageDrills.$inferSelect | undefined,
  reviewedAt: Date,
  now = new Date(),
): boolean {
  if (!drill || drill.state !== "passed" || !drill.completedAt || !drill.receiptSha256) return false;
  if (drill.completedAt > new Date(reviewedAt.getTime() + 5 * 60_000)) return false;
  if (drill.completedAt < new Date(now.getTime() - 30 * 86_400_000)) return false;
  const capabilities = drill.capabilitySnapshot as { primary?: Record<string, unknown>; backup?: Record<string, unknown> };
  const planes = [capabilities.primary, capabilities.backup];
  if (drill.primaryIdentitySha256 === drill.backupIdentitySha256 || planes.some((plane) => !plane)) return false;
  for (const plane of planes as Record<string, unknown>[]) {
    if (plane.provider !== "s3" || plane.reachable !== true || plane.shared !== true) return false;
    if (plane.requestedEncryption !== "sse_kms" || plane.defaultEncryption !== "enabled") return false;
    if (plane.versioning !== "enabled" || plane.objectLock !== "enabled" || plane.lifecycle !== "enabled") return false;
  }
  const steps = (Array.isArray(drill.steps) ? drill.steps : []) as DrillStep[];
  const requiredSteps = new Set([
    "storage_planes_independent", "primary_write", "primary_read_verify", "backup_write_verify",
    "primary_loss_simulation", "backup_restore_verify", "primary_cleanup", "backup_cleanup",
  ]);
  if (steps.length !== requiredSteps.size || steps.some((step) => step.state !== "passed" || !requiredSteps.delete(step.key)) || requiredSteps.size) return false;
  const expectedReceipt = receiptSha256({
    id: drill.id,
    companyId: drill.companyId,
    requestedByUserId: drill.requestedByUserId,
    reason: drill.reason,
    state: "passed",
    primaryProvider: drill.primaryProvider,
    backupProvider: drill.backupProvider,
    primaryIdentitySha256: drill.primaryIdentitySha256,
    backupIdentitySha256: drill.backupIdentitySha256,
    capabilitySnapshot: drill.capabilitySnapshot as Record<string, unknown>,
    steps,
    failureCode: drill.failureCode,
    startedAt: drill.startedAt,
    completedAt: drill.completedAt,
  });
  return expectedReceipt === drill.receiptSha256;
}

export async function runNativeEsignStorageDrill(input: {
  companyId: number;
  requestedByUserId: string;
  reason: string;
  env?: NodeJS.ProcessEnv;
}) {
  const env = input.env || process.env;
  if (!nativeEsignBackupConfigured(env)) throw new Error("native_esign_backup_not_configured");
  const startedAt = new Date();
  await closeStaleDrill(input.companyId, startedAt);

  const [primaryCapabilities, backupCapabilities] = await Promise.all([
    probeNativeEsignStoragePlane(env, "primary"),
    probeNativeEsignStoragePlane(env, "backup"),
  ]);
  const id = randomUUID();
  const primaryProvider = nativeEsignStorageProvider(env, "primary");
  const backupProvider = nativeEsignStorageProvider(env, "backup");
  const primaryIdentitySha256 = nativeEsignStorageIdentitySha256(env, "primary");
  const backupIdentitySha256 = nativeEsignStorageIdentitySha256(env, "backup");
  const capabilitySnapshot = { primary: primaryCapabilities, backup: backupCapabilities };
  await db.insert(eosEsignStorageDrills).values({
    id,
    companyId: input.companyId,
    requestedByUserId: input.requestedByUserId,
    reason: input.reason,
    state: "running",
    primaryProvider,
    backupProvider,
    primaryIdentitySha256,
    backupIdentitySha256,
    capabilitySnapshot,
    steps: [],
    startedAt,
  }).catch((error) => {
    const code = (error as { code?: string })?.code;
    if (code === "23505") throw new Error("native_esign_storage_drill_running");
    throw error;
  });

  const storageKey = `native-esign-drills/${input.companyId}/${id}.json`;
  const payload = Buffer.from(JSON.stringify({
    contract: "eos-native-esign-storage-drill.v1",
    drillId: id,
    companyId: input.companyId,
    nonce: randomBytes(32).toString("hex"),
    createdAt: startedAt.toISOString(),
  }), "utf8");
  const expectedSha256 = sha256(payload);
  const steps: DrillStep[] = [];
  let mainFailureCode = "";

  const step = async (key: string, operation: () => Promise<void>) => {
    const stepStartedAt = new Date();
    try {
      await operation();
      const completedAt = new Date();
      steps.push({ key, state: "passed", startedAt: stepStartedAt.toISOString(), completedAt: completedAt.toISOString(), durationMs: completedAt.getTime() - stepStartedAt.getTime(), failureCode: "" });
    } catch (error) {
      const completedAt = new Date();
      const code = failureCode(error);
      steps.push({ key, state: "failed", startedAt: stepStartedAt.toISOString(), completedAt: completedAt.toISOString(), durationMs: completedAt.getTime() - stepStartedAt.getTime(), failureCode: code });
      throw new Error(code);
    }
  };

  try {
    await step("storage_planes_independent", async () => {
      if (primaryIdentitySha256 === backupIdentitySha256)
        throw new Error("native_esign_storage_planes_not_independent");
      if (!primaryCapabilities.reachable || !backupCapabilities.reachable)
        throw new Error("native_esign_storage_plane_unreachable");
    });
    await step("primary_write", async () => { await storeNativeEsignArtifact(storageKey, payload, env, "primary"); });
    await step("primary_read_verify", async () => {
      const actual = await readNativeEsignArtifact(storageKey, env, "primary");
      if (actual.length !== payload.length || sha256(actual) !== expectedSha256)
        throw new Error("native_esign_storage_drill_primary_mismatch");
    });
    await step("backup_write_verify", async () => {
      const backup = await backUpNativeEsignArtifact(storageKey, expectedSha256, env);
      if (backup.sizeBytes !== payload.length || backup.sha256 !== expectedSha256)
        throw new Error("native_esign_storage_drill_backup_mismatch");
    });
    await step("primary_loss_simulation", async () => {
      await removeNativeEsignArtifact(storageKey, env, "primary");
      let stillReadable = false;
      try { await readNativeEsignArtifact(storageKey, env, "primary"); stillReadable = true; } catch { /* expected */ }
      if (stillReadable) throw new Error("native_esign_storage_drill_primary_delete_unconfirmed");
    });
    await step("backup_restore_verify", async () => {
      const restored = await restoreNativeEsignArtifact(storageKey, expectedSha256, env);
      const actual = await readNativeEsignArtifact(storageKey, env, "primary");
      if (restored.sizeBytes !== payload.length || restored.sha256 !== expectedSha256 || sha256(actual) !== expectedSha256)
        throw new Error("native_esign_storage_drill_restore_mismatch");
    });
  } catch (error) {
    mainFailureCode = failureCode(error);
  }

  for (const plane of ["primary", "backup"] as const) {
    try {
      await step(`${plane}_cleanup`, async () => {
        await removeNativeEsignArtifact(storageKey, env, plane);
        let stillReadable = false;
        try { await readNativeEsignArtifact(storageKey, env, plane); stillReadable = true; } catch { /* expected */ }
        if (stillReadable) throw new Error("native_esign_storage_drill_cleanup_unconfirmed");
      });
    } catch (error) {
      if (!mainFailureCode) mainFailureCode = failureCode(error);
    }
  }

  const completedAt = new Date();
  const state = mainFailureCode ? "failed" as const : "passed" as const;
  const receipt = receiptSha256({
    id,
    companyId: input.companyId,
    requestedByUserId: input.requestedByUserId,
    reason: input.reason,
    state,
    primaryProvider,
    backupProvider,
    primaryIdentitySha256,
    backupIdentitySha256,
    capabilitySnapshot,
    steps,
    failureCode: mainFailureCode,
    startedAt,
    completedAt,
  });
  const [completed] = await db.update(eosEsignStorageDrills).set({
    state,
    steps,
    receiptSha256: receipt,
    failureCode: mainFailureCode,
    completedAt,
  }).where(and(eq(eosEsignStorageDrills.id, id), eq(eosEsignStorageDrills.state, "running"))).returning();
  if (!completed) throw new Error("native_esign_storage_drill_receipt_failed");

  writeLog(state === "passed" ? "info" : "error", "native_esign_storage_drill_completed", {
    companyId: input.companyId,
    drillId: id,
    state,
    failureCode: mainFailureCode || undefined,
    primaryProvider,
    backupProvider,
    receiptSha256: receipt,
  });
  return completed;
}
