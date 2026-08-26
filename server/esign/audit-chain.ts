import { createHash, createHmac } from "node:crypto";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function canonicalize(value: JsonValue): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}

export type NativeEsignAuditEventInput = {
  envelopeId: string;
  recipientId: string | null;
  sequence: number;
  eventType: string;
  actorType: "operator" | "signer" | "system" | "provider";
  actorReference: string;
  eventProjection: Record<string, JsonValue>;
  occurredAt: string;
  previousEventSha256: string;
};

export function nativeEsignAuditEventSha256(input: NativeEsignAuditEventInput): string {
  return createHash("sha256").update(canonicalize(input as unknown as JsonValue), "utf8").digest("hex");
}

export function nativeEsignFingerprint(value: string): string {
  if (!value) return "";
  const encodedRoot = process.env.EOS_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!encodedRoot && process.env.NODE_ENV === "production")
    throw new Error("EOS_CREDENTIAL_ENCRYPTION_KEY is required for native e-sign fingerprinting.");
  const root = encodedRoot ? Buffer.from(encodedRoot, "base64") : Buffer.from("eos-native-esign-local-test-key", "utf8");
  const derived = createHmac("sha256", root).update("eos-native-esign-fingerprint-key.v1", "utf8").digest();
  return createHmac("sha256", derived).update(value, "utf8").digest("hex");
}

export function nativeEsignSignatureSha256(input: {
  envelopeId: string;
  recipientId: string;
  consentVersion: string;
  signatureMethod: string;
  signatureName: string;
  signatureCaptureSha256: string;
  fieldValues: Record<string, string | boolean>;
}): string {
  return createHash("sha256").update(canonicalize(input as unknown as JsonValue), "utf8").digest("hex");
}
