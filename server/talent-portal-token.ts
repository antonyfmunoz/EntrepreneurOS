import { createHash, randomBytes } from "node:crypto";

export function createTalentPortalSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function talentPortalDigest(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function talentPortalPath(secret: string): string {
  return `/talent-portal/${encodeURIComponent(secret)}`;
}

export function talentPortalUrl(secret: string, configuredOrigin = process.env.EOS_PUBLIC_ORIGIN || ""): string {
  const origin = new URL(configuredOrigin);
  if (process.env.NODE_ENV === "production" && origin.protocol !== "https:") {
    throw new Error("EOS_PUBLIC_ORIGIN must use HTTPS for candidate portal invitations.");
  }
  return `${origin.origin}${talentPortalPath(secret)}`;
}
