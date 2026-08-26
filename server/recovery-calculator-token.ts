import { createHash, randomBytes } from "node:crypto";

export function createRecoverySessionSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function recoverySessionDigest(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}
