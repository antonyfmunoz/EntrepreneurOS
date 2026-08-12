import { createHash, createPrivateKey, createPublicKey, sign, verify } from "crypto";

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

export function canonicalCommandBytes(value: unknown): Buffer {
  return Buffer.from(canonicalize(value), "utf8");
}

export function commandHash(value: unknown): string {
  return createHash("sha256").update(canonicalCommandBytes(value)).digest("hex");
}

export function verifyCommandSignature(value: unknown, signature: string, publicKeyPem: string): boolean {
  try {
    return verify(null, canonicalCommandBytes(value), createPublicKey(publicKeyPem), Buffer.from(signature, "base64url"));
  } catch {
    return false;
  }
}

export function signFederationMessage(value: unknown, privateKeyPem: string): string {
  return sign(null, canonicalCommandBytes(value), createPrivateKey(privateKeyPem)).toString("base64url");
}
