import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADAPTER_WEBHOOK_SIGNATURE_VERSION = "v1";
export const ADAPTER_WEBHOOK_TOLERANCE_SECONDS = 300;

export function generateAdapterWebhookSecret(): string {
  return `eoswhsec_${randomBytes(32).toString("base64url")}`;
}

export function adapterWebhookSecretFingerprint(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function signAdapterWebhook(secret: string, timestamp: number, rawBody: Buffer): string {
  return `${ADAPTER_WEBHOOK_SIGNATURE_VERSION}=${createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest("hex")}`;
}

export function verifyAdapterWebhook(input: {
  rawBody: Buffer;
  timestampHeader?: string;
  signatureHeader?: string;
  secrets: Array<{ secret: string; keyVersion: "current" | "previous" }>;
  nowMs?: number;
  toleranceSeconds?: number;
}): "current" | "previous" {
  const timestamp = Number(input.timestampHeader);
  if (!Number.isInteger(timestamp) || timestamp <= 0) throw new Error("Adapter webhook timestamp is invalid.");
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const tolerance = input.toleranceSeconds ?? ADAPTER_WEBHOOK_TOLERANCE_SECONDS;
  if (Math.abs(nowSeconds - timestamp) > tolerance) throw new Error("Adapter webhook timestamp is outside the replay window.");
  const match = /^v1=([0-9a-f]{64})$/i.exec(input.signatureHeader || "");
  if (!match) throw new Error("Adapter webhook signature is missing or malformed.");
  const provided = Buffer.from(match[1], "hex");
  for (const candidate of input.secrets) {
    const expected = createHmac("sha256", candidate.secret).update(`${timestamp}.`).update(input.rawBody).digest();
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) return candidate.keyVersion;
  }
  throw new Error("Adapter webhook signature is invalid.");
}
