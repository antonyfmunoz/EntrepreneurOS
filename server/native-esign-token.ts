import { createHash, randomBytes } from "node:crypto";

export function createNativeEsignSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function nativeEsignTokenDigest(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function nativeEsignPath(secret: string): string {
  return `/sign/${encodeURIComponent(secret)}`;
}

export function nativeEsignUrl(
  secret: string,
  configuredOrigin = process.env.EOS_PUBLIC_ORIGIN || "",
): string {
  const origin = new URL(configuredOrigin);
  if (process.env.NODE_ENV === "production" && origin.protocol !== "https:")
    throw new Error("EOS_PUBLIC_ORIGIN must use HTTPS for native signing links.");
  return `${origin.origin}${nativeEsignPath(secret)}`;
}
