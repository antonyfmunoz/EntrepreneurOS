import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function key(): Buffer {
  const encoded = process.env.EOS_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!encoded) throw new Error("EOS credential encryption is not configured.");
  const value = Buffer.from(encoded, "base64");
  if (value.length !== 32) throw new Error("EOS_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return value;
}

export function credentialEncryptionConfigured(): boolean {
  try { key(); return true; } catch { return false; }
}

export function encryptCredential(plaintext: string): string {
  if (!plaintext) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptCredential(value: string): string {
  if (!value.startsWith(PREFIX)) throw new Error("Stored credential is not encrypted; reconnect the provider.");
  const [ivText, tagText, ciphertextText] = value.slice(PREFIX.length).split(".");
  if (!ivText || !tagText || !ciphertextText) throw new Error("Stored credential envelope is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
}
